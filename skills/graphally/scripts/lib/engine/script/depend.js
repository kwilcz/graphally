// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// depend(a, b): a finish-to-start dependency on a time chart, from a to the start of b. It may
// leave a by its back or anywhere along its underside (its top when b is above), and arrives at
// b's start, or straight into its top near the start. Of the clear ways the shortest wins, a
// corner counting as 40px. Clear means: CLEAR from every other dated element ([data-start],
// [data-at]) and off the upright runs of dependencies into other tasks; every run between
// corners at least BEND long; the last run at least LAST long, unless the whole line is one
// straight drop; and it touches a box only within the middle 80% of a side, never at a corner.
// A long way round goes along a row edge, where the band between two rows' bars is.
import { roundedPath } from '../svg.js';
import { pointAt } from './geometry.js';

const CLEAR = 12, CLEAR_Y = 6, LAST = 24, FIRST = 20, BEND = 18;

// The edge of a bar's row a line may run along, below or above the bar; a bend's length past the
// bar when the row hugs it.
function rowEdge(geometry, bar, below) {
  const row = geometry.geometryOf(bar.el.parentElement);
  if (below) return row.y + row.h > bar.y + bar.h + 2 ? row.y + row.h : bar.y + bar.h + BEND;
  return row.y < bar.y - 2 ? row.y : bar.y - BEND;
}

// Where the line starts, turns and arrives, by name.
function layoutOf(geometry, from, to) {
  const back = from.x + from.w, down = to.center.y > from.center.y;
  return {
    back,
    knee: back + FIRST,
    fromY: from.center.y,
    toY: to.center.y,
    entry: to.x - LAST,
    fromRow: rowEdge(geometry, from, down),
    toRow: rowEdge(geometry, to, !down),
    fromEdge: down ? from.y + from.h : from.y,
    toEdge: down ? to.y : to.y + to.h,
  };
}

// Whether a straight run keeps clear of the other bars and, when upright, of the upright runs of
// dependencies into other tasks.
function clearanceOf(bars, runs) {
  const clearOfBar = (x1, y1, x2, y2) => bar =>
    Math.max(x1, x2) < bar.x - CLEAR || Math.min(x1, x2) > bar.x + bar.w + CLEAR
    || Math.max(y1, y2) < bar.y - CLEAR_Y || Math.min(y1, y2) > bar.y + bar.h + CLEAR_Y;
  const clearOfRun = (x1, y1, x2, y2) => run =>
    Math.abs(run.x - x1) > 6 || Math.max(y1, y2) < run.y1 - 3 || Math.min(y1, y2) > run.y2 + 3;
  return (x1, y1, x2, y2) =>
    bars.every(clearOfBar(x1, y1, x2, y2)) && (x1 !== x2 || runs.every(clearOfRun(x1, y1, x2, y2)));
}

// The x positions worth trying for the line's upright run.
function candidateXs(from, to, bars, layout) {
  const xs = new Set([
    layout.entry, to.x + 12, to.x + 20, to.x + to.w / 2, to.x + to.w * 0.1,
    from.x + from.w * 0.9, from.x + from.w / 2,
  ]);
  for (let x = layout.knee; x <= Math.max(layout.entry, to.x + 20); x += 4) xs.add(x);
  for (let x = from.x + 12; x < layout.back; x += 6) xs.add(x);
  for (const bar of bars) {
    for (const offset of [CLEAR + 2, CLEAR + 8, CLEAR + 14]) {
      xs.add(bar.x - offset);
      xs.add(bar.x + bar.w + offset);
    }
  }
  return xs;
}

// Where a line may touch a top or bottom: the middle 80% of it.
const withinMiddle = (bar, x) => x >= bar.x + bar.w * 0.1 && x <= bar.x + bar.w * 0.9;

// The ways a line may leave the first bar for an upright run at x, and arrive at the second.
function leavingPaths(x, from, layout) {
  const start = [layout.back, layout.fromY];
  return [
    ...(x >= layout.knee ? [[start, [x, layout.fromY]]] : []),
    ...[0, 8, 16, 24, 32].map(step => {
      const turn = layout.knee + step;
      return [start, [turn, layout.fromY], [turn, layout.fromRow], [x, layout.fromRow]];
    }),
    ...(withinMiddle(from, x) ? [[[x, layout.fromEdge]]] : []),
  ];
}
function arrivingPaths(x, to, layout) {
  return [
    ...(x <= layout.entry ? [[[x, layout.toY], [to.x, layout.toY]]] : []),
    ...(withinMiddle(to, x) && x <= to.x + Math.max(40, to.w / 2) ? [[[x, layout.toEdge]]] : []),
    [[x, layout.toRow], [layout.entry, layout.toRow], [layout.entry, layout.toY], [to.x, layout.toY]],
  ];
}

// Whether a path's runs are long enough: one straight drop at least 6px; with corners, every run
// at least the bend and the last at least LAST (or the bend, when that is shorter). A path that
// has shrunk to a point passes.
function fitsBend(lengths, bend) {
  if (lengths.length === 1) return lengths[0] >= 6;
  if (lengths.length === 0) return true;
  const lastTooShort = lengths.at(-1) < Math.min(LAST, Math.max(bend, 12));
  return !(lengths.some(length => length < bend) || lastTooShort);
}

// A path with no point twice in a row, and the length of one of its runs.
const withoutRepeats = path =>
  path.filter((point, index) => !index || point[0] !== path[index - 1][0] || point[1] !== path[index - 1][1]);
const runLength = (from, to) => Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);

// Every way there is: out of from by each way it may leave, into to by each way it may arrive,
// at each candidate x; each with its runs' lengths and its score, a corner counting as 40px.
function candidatePaths(xs, from, to, layout) {
  const paths = [...xs].flatMap(x => leavingPaths(x, from, layout)
    .flatMap(leave => arrivingPaths(x, to, layout).map(arrive => withoutRepeats([...leave, ...arrive]))));
  return paths.map(path => {
    const lengths = path.slice(1).map((point, index) => runLength(path[index], point));
    return { path, lengths, score: (path.length - 2) * 40 + lengths.reduce((sum, length) => sum + length, 0) };
  });
}

// The cheapest clear way whose runs fit the bend; the first of equals.
function cheapestClear(candidates, bend, isClear) {
  let best = null;
  for (const candidate of candidates) {
    if (!fitsBend(candidate.lengths, bend) || (best && candidate.score >= best.score)) continue;
    if (isClear(candidate.path)) best = candidate;
  }
  return best?.path || null;
}

// The shortest clear path, trying tighter bends only when the roomier ones find none.
function shortestClearPath(xs, from, to, layout, isFree) {
  const isFreeLeg = (start, end) => isFree(start[0], start[1], end[0], end[1]);
  const isClear = path => path.every((point, index) => !index || isFreeLeg(path[index - 1], point));
  const candidates = candidatePaths(xs, from, to, layout);
  for (const bend of [BEND, 12, 6, 0]) {
    const path = cheapestClear(candidates, bend, isClear);
    if (path) return path;
  }
  return null;
}

// When no clear way is found: out of the back, along the row edge, and into the start.
const fallbackPath = (to, layout) => [
  [layout.back, layout.fromY], [layout.knee, layout.fromY], [layout.knee, layout.toRow],
  [layout.entry, layout.toRow], [layout.entry, layout.toY], [to.x, layout.toY],
];

// The upright runs of a dependency, which the lines into other tasks keep off.
function recordUprightRuns(figure, corners, to) {
  for (let index = 1; index < corners.length; index++) {
    const [x, y] = corners[index], [previousX, previousY] = corners[index - 1];
    if (x === previousX) {
      figure.dependRuns.push({ x, y1: Math.min(y, previousY), y2: Math.max(y, previousY), to: to.el });
    }
  }
}

export function drawDependency(figure, geometry, fromRef, toRef, options) {
  const [from, to] = [geometry.spot(fromRef), geometry.spot(toRef)];
  if (!from.el || !to.el) throw new Error('depend(a, b) takes two elements');
  // Obstacles: the other dated elements with a body (a today line has none).
  const isObstacle = bar => bar.el !== from.el && bar.el !== to.el && bar.w > 1 && bar.h > 1;
  const bars = geometry.find('[data-start], [data-at]').filter(isObstacle);
  const runs = figure.dependRuns.filter(run => run.to !== to.el);
  const layout = layoutOf(geometry, from, to);
  const xs = candidateXs(from, to, bars, layout);
  const corners = shortestClearPath(xs, from, to, layout, clearanceOf(bars, runs)) || fallbackPath(to, layout);
  recordUprightRuns(figure, corners, to);
  const points = corners.map(([x, y]) => pointAt(x, y));
  figure.drawings.push({
    kind: 'path', path: roundedPath(points, 4), options: { arrow: true, ...options },
    ends: [points[0], points.at(-1)], via: points[Math.floor(points.length / 2)],
  });
}
