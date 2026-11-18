// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The routing grid, in the spirit of orthogonal visibility graphs (Wybrow, Marriott & Stuckey
// 2009): lines through every obstacle's edges, every container's margin, the centres of the
// boxes and of the channels between them. A route runs from grid point to grid point. Each
// segment, indexed by its west or north end, knows whether it is free, the innermost container
// it runs in, whether it hugs a container's border, how many routes use it, and the bundle
// that owns it.
import { CONTAINER_MARGIN } from './costs.js';

const range = (from, to) => Array.from({ length: Math.max(0, to - from) }, (_, offset) => from + offset);

// The first index of the sorted values above low (or at least as high as high, when inclusive).
function searchSorted(values, bound, from, inclusive) {
  let low = from, high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (inclusive ? values[middle] >= bound : values[middle] > bound) high = middle;
    else low = middle + 1;
  }
  return low;
}

// The index range [first, last) of the sorted values strictly between low and high.
function indexRange(values, low, high) {
  const first = searchSorted(values, low, 0, false);
  return [first, searchSorted(values, high, first, true)];
}

// Calls visit(cell) for every cell in the index ranges.
function eachCell(nx, [i0, i1], [j0, j1], visit) {
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) visit(j * nx + i);
}

// The grid lines of one axis: those given, and the centre of every gap of more than 24px
// between two of them; rounded to half pixels, on the page, sorted, each once.
function gridLines(lines, size) {
  const sorted = [...lines].sort((a, b) => a - b);
  for (let i = 0; i + 1 < sorted.length; i++) {
    if (sorted[i + 1] - sorted[i] > 24) lines.add((sorted[i] + sorted[i + 1]) / 2);
  }
  const rounded = [...lines].map(value => Math.round(value * 2) / 2).filter(value => value >= 0 && value <= size);
  return [...new Set(rounded.sort((a, b) => a - b))];
}

function gridLinesThrough({ geometry, obstacles, containers }, extraX, extraY) {
  const xLines = new Set([2, geometry.width - 2, ...extraX]), yLines = new Set([2, geometry.height - 2, ...extraY]);
  const add = (x0, x1, y0, y1) => {
    xLines.add(x0);
    xLines.add(x1);
    yLines.add(y0);
    yLines.add(y1);
  };
  for (const o of obstacles) add(o.x, o.x + o.w, o.y, o.y + o.h);
  const margin = CONTAINER_MARGIN;
  for (const c of containers) add(c.x - margin, c.x + c.w + margin, c.y - margin, c.y + c.h + margin);
  for (const run of geometry.taken || []) {
    if (run.x1 === run.x2) xLines.add(run.x1);
    else yLines.add(run.y1);
  }
  return { xs: gridLines(xLines, geometry.width), ys: gridLines(yLines, geometry.height) };
}

// The lines, and the midpoints of the segments between them, where segments are tested.
function linesOf(xs, ys) {
  const midpoints = values => range(0, values.length - 1).map(i => (values[i] + values[i + 1]) / 2);
  return { xs, ys, nx: xs.length, ny: ys.length, cells: xs.length * ys.length, midX: midpoints(xs), midY: midpoints(ys) };
}

// The points and segments inside an obstacle: more than 0.01 within it.
function obstacleFlags(obstacles, { nx, cells, xs, ys, midX, midY }) {
  const flags = { point: new Uint8Array(cells), runH: new Uint8Array(cells), runV: new Uint8Array(cells) };
  const mark = (target, xValues, yValues, o) => {
    const across = indexRange(xValues, o.x + 0.01, o.x + o.w - 0.01), down = indexRange(yValues, o.y + 0.01, o.y + o.h - 0.01);
    eachCell(nx, across, down, cell => { target[cell] = 1; });
  };
  for (const o of obstacles) {
    mark(flags.point, xs, ys, o);
    mark(flags.runH, midX, ys, o);
    mark(flags.runV, xs, midY, o);
  }
  return flags;
}

// The innermost container around each segment: the deepest, the first of equals.
function markInnermost(container, index, { owner, depth }, nx, xValues, yValues) {
  const across = indexRange(xValues, container.x, container.x + container.w);
  const down = indexRange(yValues, container.y, container.y + container.h);
  eachCell(nx, across, down, cell => {
    if (container.depth <= depth[cell]) return;
    depth[cell] = container.depth;
    owner[cell] = index;
  });
}

// The lines within 5px of a container's two edges on one axis (searched within 6px of each).
const nearEdge = (line, start, size) => Math.abs(line - start) < 5 || Math.abs(line - start - size) < 5;
function edgeLines(values, start, size) {
  const ranges = [indexRange(values, start - 6, start + 6), indexRange(values, start + size - 6, start + size + 6)];
  return ranges.flatMap(([first, last]) => range(first, last)).filter(index => nearEdge(values[index], start, size));
}

// Running along a container's border reads as part of the box: the segments along its top and
// bottom, and down its sides, are flagged.
function markBorders(container, flags, { nx, xs, ys, midX, midY }) {
  const { x, y, w, h } = container;
  const [across0, across1] = indexRange(midX, x - 2, x + w + 2), [down0, down1] = indexRange(midY, y - 2, y + h + 2);
  for (const j of edgeLines(ys, y, h)) for (let i = across0; i < across1; i++) flags.hugH[j * nx + i] = 1;
  for (const i of edgeLines(xs, x, w)) for (let j = down0; j < down1; j++) flags.hugV[j * nx + i] = 1;
}

function containerFlags(containers, lines) {
  const { cells, nx, xs, ys, midX, midY } = lines;
  const horizontal = { owner: new Int16Array(cells).fill(-1), depth: new Float64Array(cells).fill(-1) };
  const vertical = { owner: new Int16Array(cells).fill(-1), depth: new Float64Array(cells).fill(-1) };
  const borders = { hugH: new Uint8Array(cells), hugV: new Uint8Array(cells) };
  containers.forEach((container, index) => {
    markInnermost(container, index, horizontal, nx, midX, ys);
    markInnermost(container, index, vertical, nx, xs, midY);
    markBorders(container, borders, lines);
  });
  return { innerH: horizontal.owner, innerV: vertical.owner, ...borders };
}

// A segment is free when both its ends are and nothing stands on it; only a free one keeps its
// container and border flags.
function segments({ nx, ny, cells }, inside, around) {
  const grid = {
    freePoint: inside.point.map(flag => (flag ? 0 : 1)),
    freeH: new Uint8Array(cells), freeV: new Uint8Array(cells),
    containerH: new Int16Array(cells), containerV: new Int16Array(cells),
    hugH: new Uint8Array(cells), hugV: new Uint8Array(cells),
  };
  const open = (cell, next, run, inner, hug, axis) => {
    if (!grid.freePoint[cell] || !grid.freePoint[next]) return;
    grid[`free${axis}`][cell] = run[cell] ? 0 : 1;
    grid[`container${axis}`][cell] = inner[cell];
    grid[`hug${axis}`][cell] = hug[cell];
  };
  for (let cell = 0; cell < cells; cell++) {
    if (cell % nx + 1 < nx) open(cell, cell + 1, inside.runH, around.innerH, around.hugH, 'H');
    if (((cell / nx) | 0) + 1 < ny) open(cell, cell + nx, inside.runV, around.innerV, around.hugV, 'V');
  }
  return grid;
}

// Lines drawn by other means (the drawing script) are taken: running along one costs as
// overlap, crossing one as a crossing. A grid line within 3px of a drawn line counts as on it.
function takenFlags(taken, { nx, ny, cells, xs, ys }) {
  const used = { usedH: new Uint8Array(cells), usedV: new Uint8Array(cells) };
  const near = (values, at) => range(0, values.length).filter(index => Math.abs(values[index] - at) <= 3);
  const within = (values, count, lo, hi) => range(0, count - 1).filter(k => values[k] >= lo - 0.5 && values[k + 1] <= hi + 0.5);
  for (const run of taken) {
    const upright = run.x1 === run.x2;
    const [lo, hi] = upright ? [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)] : [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)];
    const lines = upright ? near(xs, run.x1) : near(ys, run.y1), steps = upright ? within(ys, ny, lo, hi) : within(xs, nx, lo, hi);
    const mark = upright ? (line, step) => { used.usedV[step * nx + line] = 1; } : (line, step) => { used.usedH[line * nx + step] = 1; };
    for (const line of lines) steps.forEach(step => mark(line, step));
  }
  return used;
}

export function buildGrid(router, extraX, extraY) {
  const { xs, ys } = gridLinesThrough(router, extraX, extraY), lines = linesOf(xs, ys);
  const grid = segments(lines, obstacleFlags(router.obstacles, lines), containerFlags(router.containers, lines));
  return {
    ...grid, ...takenFlags(router.geometry.taken || [], lines),
    xs, ys, nx: lines.nx, ny: lines.ny,
    bundleH: new Int16Array(lines.cells), bundleV: new Int16Array(lines.cells),
    endLength: router.endLength,
    indexOfX: new Map(xs.map((value, index) => [value, index])),
    indexOfY: new Map(ys.map((value, index) => [value, index])),
  };
}
