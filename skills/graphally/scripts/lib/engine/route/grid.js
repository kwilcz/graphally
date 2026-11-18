// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The routing grid, in the spirit of orthogonal visibility graphs (Wybrow, Marriott & Stuckey
// 2009): lines through every obstacle's edges, every container's margin, the centres of the
// boxes and of the channels between them. A route runs from grid point to grid point. Each
// segment, indexed by its west or north end, knows whether it is free, the innermost container
// it runs in, whether it hugs a container's border, how many routes use it, and the bundle
// that owns it.
import { CONTAINER_MARGIN } from './costs.js';

// The index range [first, last) of the sorted values strictly between low and high.
function indexRange(values, low, high) {
  let first = 0, end = values.length;
  while (first < end) {
    const middle = (first + end) >> 1;
    if (values[middle] > low) end = middle;
    else first = middle + 1;
  }
  let last = first;
  end = values.length;
  while (last < end) {
    const middle = (last + end) >> 1;
    if (values[middle] >= high) end = middle;
    else last = middle + 1;
  }
  return [first, last];
}

// The grid lines of one axis: those given, and the centre of every gap of more than 24px
// between two of them; rounded to half pixels, on the page, sorted, each once.
function gridLines(lines, size) {
  const sorted = [...lines].sort((a, b) => a - b);
  for (let i = 0; i + 1 < sorted.length; i++) {
    if (sorted[i + 1] - sorted[i] > 24) lines.add((sorted[i] + sorted[i + 1]) / 2);
  }
  const rounded = [...lines]
    .map(value => Math.round(value * 2) / 2)
    .filter(value => value >= 0 && value <= size);
  return [...new Set(rounded.sort((a, b) => a - b))];
}

// Each box is marked on the cells it covers, found by binary search, instead of every cell
// being tested against every box. A point is inside an obstacle when it is more than 0.01
// within it, inside a container when strictly within it.
function markInside(flags, nx, xValues, yValues, x0, x1, y0, y1) {
  const [i0, i1] = indexRange(xValues, x0, x1), [j0, j1] = indexRange(yValues, y0, y1);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) flags[j * nx + i] = 1;
}

// The innermost container around each segment: the deepest, the first of equals.
function markContainer(container, index, owner, depth, nx, xValues, yValues) {
  const [i0, i1] = indexRange(xValues, container.x, container.x + container.w);
  const [j0, j1] = indexRange(yValues, container.y, container.y + container.h);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const cell = j * nx + i;
      if (container.depth > depth[cell]) {
        depth[cell] = container.depth;
        owner[cell] = index;
      }
    }
  }
}

// Running along a container's border (within 5px of it) reads as part of the box.
function markBorders(container, hugH, hugV, { nx, xs, ys, midX, midY }) {
  const { x, y, w, h } = container;
  const [across0, across1] = indexRange(midX, x - 2, x + w + 2);
  for (const [first, last] of [indexRange(ys, y - 6, y + 6), indexRange(ys, y + h - 6, y + h + 6)]) {
    for (let j = first; j < last; j++) {
      const line = ys[j];
      if (!(Math.abs(line - y) < 5 || Math.abs(line - y - h) < 5)) continue;
      for (let i = across0; i < across1; i++) hugH[j * nx + i] = 1;
    }
  }
  const [down0, down1] = indexRange(midY, y - 2, y + h + 2);
  for (const [first, last] of [indexRange(xs, x - 6, x + 6), indexRange(xs, x + w - 6, x + w + 6)]) {
    for (let i = first; i < last; i++) {
      const line = xs[i];
      if (!(Math.abs(line - x) < 5 || Math.abs(line - x - w) < 5)) continue;
      for (let j = down0; j < down1; j++) hugV[j * nx + i] = 1;
    }
  }
}

// Lines drawn by other means (the drawing script) are taken: running along one costs as
// overlap, crossing one as a crossing. A grid line within 3px of a drawn line counts as on it.
function markTaken(taken, usedH, usedV, { nx, ny, xs, ys }) {
  const near = (values, at) => values.flatMap((value, index) => (Math.abs(value - at) <= 3 ? [index] : []));
  for (const run of taken) {
    if (run.x1 === run.x2) {
      const lo = Math.min(run.y1, run.y2), hi = Math.max(run.y1, run.y2);
      for (const i of near(xs, run.x1)) {
        for (let j = 0; j + 1 < ny; j++) {
          if (ys[j] >= lo - 0.5 && ys[j + 1] <= hi + 0.5) usedV[j * nx + i] = 1;
        }
      }
    } else {
      const lo = Math.min(run.x1, run.x2), hi = Math.max(run.x1, run.x2);
      for (const j of near(ys, run.y1)) {
        for (let i = 0; i + 1 < nx; i++) {
          if (xs[i] >= lo - 0.5 && xs[i + 1] <= hi + 0.5) usedH[j * nx + i] = 1;
        }
      }
    }
  }
}

export function buildGrid(router, extraX, extraY) {
  const { geometry, obstacles, containers } = router, taken = geometry.taken || [];
  const xLines = new Set([2, geometry.width - 2, ...extraX]);
  const yLines = new Set([2, geometry.height - 2, ...extraY]);
  for (const o of obstacles) {
    xLines.add(o.x);
    xLines.add(o.x + o.w);
    yLines.add(o.y);
    yLines.add(o.y + o.h);
  }
  for (const c of containers) {
    xLines.add(c.x - CONTAINER_MARGIN);
    xLines.add(c.x + c.w + CONTAINER_MARGIN);
    yLines.add(c.y - CONTAINER_MARGIN);
    yLines.add(c.y + c.h + CONTAINER_MARGIN);
  }
  for (const run of taken) {
    if (run.x1 === run.x2) xLines.add(run.x1);
    else yLines.add(run.y1);
  }
  const xs = gridLines(xLines, geometry.width), ys = gridLines(yLines, geometry.height);
  const nx = xs.length, ny = ys.length, cells = nx * ny;
  // Segments are tested at their midpoints.
  const midX = [], midY = [];
  for (let i = 0; i + 1 < nx; i++) midX.push((xs[i] + xs[i + 1]) / 2);
  for (let j = 0; j + 1 < ny; j++) midY.push((ys[j] + ys[j + 1]) / 2);
  const lines = { nx, ny, xs, ys, midX, midY };

  const pointInside = new Uint8Array(cells);
  const runInsideH = new Uint8Array(cells), runInsideV = new Uint8Array(cells);
  for (const o of obstacles) {
    const x0 = o.x + 0.01, x1 = o.x + o.w - 0.01, y0 = o.y + 0.01, y1 = o.y + o.h - 0.01;
    markInside(pointInside, nx, xs, ys, x0, x1, y0, y1);
    markInside(runInsideH, nx, midX, ys, x0, x1, y0, y1);
    markInside(runInsideV, nx, xs, midY, x0, x1, y0, y1);
  }
  const innerH = new Int16Array(cells).fill(-1), innerV = new Int16Array(cells).fill(-1);
  const depthH = new Float64Array(cells).fill(-1), depthV = new Float64Array(cells).fill(-1);
  const bordersH = new Uint8Array(cells), bordersV = new Uint8Array(cells);
  containers.forEach((container, index) => {
    markContainer(container, index, innerH, depthH, nx, midX, ys);
    markContainer(container, index, innerV, depthV, nx, xs, midY);
    markBorders(container, bordersH, bordersV, lines);
  });

  // A segment is free when both its ends are and nothing stands on it.
  const freePoint = new Uint8Array(cells), freeH = new Uint8Array(cells), freeV = new Uint8Array(cells);
  const containerH = new Int16Array(cells), containerV = new Int16Array(cells);
  const hugH = new Uint8Array(cells), hugV = new Uint8Array(cells);
  for (let cell = 0; cell < cells; cell++) freePoint[cell] = pointInside[cell] ? 0 : 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cell = j * nx + i;
      if (i + 1 < nx && freePoint[cell] && freePoint[cell + 1]) {
        freeH[cell] = runInsideH[cell] ? 0 : 1;
        containerH[cell] = innerH[cell];
        hugH[cell] = bordersH[cell];
      }
      if (j + 1 < ny && freePoint[cell] && freePoint[cell + nx]) {
        freeV[cell] = runInsideV[cell] ? 0 : 1;
        containerV[cell] = innerV[cell];
        hugV[cell] = bordersV[cell];
      }
    }
  }
  const usedH = new Uint8Array(cells), usedV = new Uint8Array(cells);
  markTaken(taken, usedH, usedV, lines);
  return {
    xs, ys, nx, ny, freePoint, freeH, freeV, containerH, containerV, hugH, hugV, usedH, usedV,
    bundleH: new Int16Array(cells), bundleV: new Int16Array(cells),
    endLength: router.endLength,
    indexOfX: new Map(xs.map((value, index) => [value, index])),
    indexOfY: new Map(ys.map((value, index) => [value, index])),
  };
}
