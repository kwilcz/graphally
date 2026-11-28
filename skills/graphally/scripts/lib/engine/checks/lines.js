// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Checks on the routed lines and the script's drawn lines: what reads wrong once drawn.
import { endsOf } from '../page/markers.js';
import { pointsOfPath } from '../page/page-size.js';
import { pairsOf } from '../shared/maps.js';
import { lineWidth } from '../page/line-ends.js';
import { inkOf } from './boxes.js';

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

// Connections drawn alike (one colour, one dash) in different widths. A width is a meaning: the
// figure states it (a key, a label), or the lines are drawn alike.
const lookOf = edge => [edge.color || '', edge.accent ? 'accent' : '', edge.off ? 'off' : '', edge.ends.dash || '']
  .join('|');
function unevenWidths(routes, problems) {
  const looks = new Map();
  for (const { edge } of routes) {
    if (!looks.has(lookOf(edge))) looks.set(lookOf(edge), new Map());
    const widths = looks.get(lookOf(edge));
    if (!widths.has(lineWidth(edge))) widths.set(lineWidth(edge), edge.key);
  }
  for (const widths of [...looks.values()].filter(each => each.size > 1)) {
    problems.push({
      rule: 'line-widths', warn: true, widths: [...widths.keys()].join(','), lines: [...widths.values()].join(' '),
      hint: 'lines drawn alike have different widths: draw them alike, or give the width a meaning the key states',
    });
  }
}

// A straight run that cuts through a box by more than 2px on both axes.
function cutsBox([from, to], box) {
  const left = Math.min(from.x, to.x), right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y), bottom = Math.max(from.y, to.y);
  const acrossX = Math.min(right, box.x + box.w - 2) - Math.max(left, box.x + 2);
  const acrossY = Math.min(bottom, box.y + box.h - 2) - Math.max(top, box.y + 2);
  return acrossX >= 0 && acrossY >= 0 && (acrossX > 0 || acrossY > 0);
}

// A line drawn through text, judged by the band its glyphs fill: the words read struck through.
function throughText(routes, texts, problems) {
  const inks = texts.map(text => ({ text: text.text, box: { x: text.x, w: text.w, ...inkOf(text) } }));
  for (const { points, edge } of routes) {
    const hit = inks.find(ink => segmentsOf(points).some(segment => cutsBox(segment, ink.box)));
    if (!hit) continue;
    problems.push({
      rule: 'line-through-text', line: edge.key, text: `"${String(hit.text).slice(0, 40)}"`,
      hint: 'move the text or the line clear: widen the gap, move the title, or give the line out, in or via',
    });
  }
}

export function checkLines(figure, routes) {
  throughText(routes, figure.texts, figure.problems);
  crowdedLabels(routes, figure.problems);
  overlappingLines(routes, figure.problems);
  shortEnds(routes, figure.drawings, figure.problems);
  unevenWidths(routes, figure.problems);
}

// A drawn text's box, its width judged leniently (half the size a character), so only text that
// is plainly cut is reported; at is its middle, across its height.
function drawnTextBox({ at, text, options = {} }) {
  const size = options.size || 12, width = text.length * size * 0.5;
  const left = { start: 0, middle: width / 2, end: width }[options.anchor || 'middle'] ?? width / 2;
  return { x: at.x - left, y: at.y - size / 2, w: width, h: size };
}
const outside = (box, { width, height }) => box.x < -1 || box.y < -1
  || box.x + box.w > width + 1 || box.y + box.h > height + 1;

// A line's label or a drawn text the page's edge cuts: the SVG shows the page and nothing past it.
export function checkCutText(figure, routes, size) {
  const labels = routes.filter(route => route.label).map(({ label }) => ({ box: label, text: label.text }));
  const drawn = figure.drawings.filter(drawing => drawing.kind === 'text')
    .map(drawing => ({ box: drawnTextBox(drawing), text: drawing.text }));
  for (const { box, text } of [...labels, ...drawn]) {
    if (!outside(box, size)) continue;
    figure.problems.push({
      rule: 'text-cut', text: `"${String(text).slice(0, 40)}"`,
      hint: 'the page edge cuts it: move it in, or give it room with padding or width',
    });
  }
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
