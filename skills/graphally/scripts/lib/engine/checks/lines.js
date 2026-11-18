// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Checks on the routed lines and the script's drawn lines: what reads wrong once drawn.
import { endsOf } from '../page/markers.js';
import { pointsOfPath } from '../page/page-size.js';
import { pairsOf } from '../shared/maps.js';

// An end mark needs a run this long before it, or it sits on the bend.
const SHORTEST_END = 12;

const distance = (from, to) => Math.hypot(to.x - from.x, to.y - from.y);
const segmentsOf = points => points.slice(1).map((point, index) => [points[index], point]);
const isStraight = ([from, to]) => Math.abs(from.x - to.x) < 0.5 || Math.abs(from.y - to.y) < 0.5;

// A label the router could not fit in the gap its line runs through.
function crowdedLabels(routes, problems) {
  for (const { labelCrowded, edge } of routes) {
    if (!labelCrowded) continue;
    problems.push({
      rule: 'label-crowded', edge: `${edge.from} -> ${edge.to}`, label: edge.label,
      hint: 'widen the gap the line runs through, or shorten the label',
    });
  }
}

// Two straight segments on the same track, side by side for more than 12px.
function shareTrack([p, q], [u, v]) {
  const flat = Math.abs(p.y - q.y) < 0.5;
  const sameTrack = flat
    ? Math.abs(u.y - v.y) < 0.5 && Math.abs(p.y - u.y) < 2
    : Math.abs(u.x - v.x) < 0.5 && Math.abs(p.x - u.x) < 2;
  if (!sameTrack) return false;
  const axis = flat ? 'x' : 'y';
  const start = Math.max(Math.min(p[axis], q[axis]), Math.min(u[axis], v[axis]));
  const end = Math.min(Math.max(p[axis], q[axis]), Math.max(u[axis], v[axis]));
  return end - start > 12;
}

// Two routed lines on one stretch of the same track read as one line; a bundle's lines merged
// into one trunk are meant to.
function overlappingLines(routes, problems) {
  const lines = routes.map(route => ({ route, runs: segmentsOf(route.points).filter(isStraight) }));
  for (const [a, b] of pairsOf(lines)) {
    if (a.route.tree && a.route.tree === b.route.tree) continue;
    if (!a.runs.some(run => b.runs.some(other => shareTrack(run, other)))) continue;
    problems.push({
      rule: 'lines-overlap', a: a.route.edge.key, b: b.route.edge.key,
      hint: 'give one of them via points or other sides',
    });
  }
}

// An arrowhead or tail mark on an end segment shorter than 12px sits on the bend before it.
function shortEnds(routes, drawings, problems) {
  const checkEnds = (points, ends, line) => {
    const report = end => problems.push({
      rule: 'short-end', line, end,
      hint: 'the mark sits on a bend: give the line more room before the box, or other sides or via points',
    });
    if (ends.head !== 'none' && distance(points.at(-2), points.at(-1)) < SHORTEST_END) report('head');
    if (ends.tail !== 'none' && distance(points[0], points[1]) < SHORTEST_END) report('tail');
  };
  for (const route of routes) checkEnds(route.points, route.edge.ends, route.edge.key);
  for (const drawing of drawings) {
    if (drawing.kind !== 'path' || /[QCA]/.test(drawing.path)) continue;   // curves and arcs: their own shape
    const points = pointsOfPath(drawing.path);
    if (points.length < 2) continue;
    checkEnds(points, endsOf(drawing.options, false, []), drawing.options.label || 'a drawn line');
  }
}

export function checkLines(figure, routes) {
  crowdedLabels(routes, figure.problems);
  overlappingLines(routes, figure.problems);
  shortEnds(routes, figure.drawings, figure.problems);
}

// A horizontal run of one line through a vertical run of another, away from their ends.
function crosses([a, b], [c, d]) {
  const firstFlat = Math.abs(a.y - b.y) < 0.5, secondFlat = Math.abs(c.y - d.y) < 0.5;
  if (firstFlat === secondFlat) return false;
  const [flat, upright] = firstFlat ? [[a, b], [c, d]] : [[c, d], [a, b]];
  const x = upright[0].x, y = flat[0].y;
  return x > Math.min(flat[0].x, flat[1].x) + 1 && x < Math.max(flat[0].x, flat[1].x) - 1
    && y > Math.min(upright[0].y, upright[1].y) + 1 && y < Math.max(upright[0].y, upright[1].y) - 1;
}

// How many of the other runs one run crosses.
const crossingsOf = (run, others) => others.filter(other => crosses(run, other)).length;

// How many times the routed lines cross each other, for the render's stats.
export function countCrossings(routes) {
  const segments = routes.map(route => segmentsOf(route.points));
  const crossingsBetween = ([a, b]) => a.reduce((count, run) => count + crossingsOf(run, b), 0);
  return pairsOf(segments).reduce((count, pair) => count + crossingsBetween(pair), 0);
}
