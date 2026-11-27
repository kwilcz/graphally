// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Line labels, each where it collides with nothing: near the middle of its line, above or below
// a horizontal run, beside an upright one, or on the line itself in a narrow channel.
import { T } from '../style.js';
import { intersects } from './geometry.js';

const HEIGHT = 14;

// What a label may not cover: nodes (their routing margin aside), drawn lines, and the borders
// of boxes, which a label straddling them would read as part of.
function blocksOf(router) {
  const { geometry, obstacles, clearance } = router, inner = clearance - 3, edge = 3;
  const blocks = obstacles.map(o => ({
    x: o.x + (o.node ? inner : 0), y: o.y + (o.node ? inner : 0),
    w: o.w - (o.node ? 2 * inner : 0), h: o.h - (o.node ? 2 * inner : 0),
  }));
  for (const run of geometry.taken || []) {
    const x = Math.min(run.x1, run.x2) - 3, y = Math.min(run.y1, run.y2) - 3;
    blocks.push({ x, y, w: Math.abs(run.x2 - run.x1) + 6, h: Math.abs(run.y2 - run.y1) + 6 });
  }
  for (const rect of geometry.groups.values()) {
    if (rect.group.style === 'plain') continue;
    blocks.push({ x: rect.x - edge, y: rect.y - edge, w: rect.w + 2 * edge, h: 2 * edge });
    blocks.push({ x: rect.x - edge, y: rect.y + rect.h - edge, w: rect.w + 2 * edge, h: 2 * edge });
    if (rect.lane) continue;
    blocks.push({ x: rect.x - edge, y: rect.y - edge, w: 2 * edge, h: rect.h + 2 * edge });
    blocks.push({ x: rect.x + rect.w - edge, y: rect.y - edge, w: 2 * edge, h: rect.h + 2 * edge });
  }
  return blocks;
}

const runLength = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function routeLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += runLength(points[index], points[index - 1]);
  return total;
}

// Every few pixels along a run, its middle first.
function fractionsAlong(length) {
  const fractions = [0.5];
  for (let d = 6; d < length / 2; d += 6) fractions.push(0.5 - d / length, 0.5 + d / length);
  return fractions;
}

// The places for a label at a fraction along a run: above or below a horizontal run, beside an
// upright one, or on the line itself, its halo interrupting it, in a narrow channel.
function spotsAt(run, t, { w: width, h: height }) {
  const { a, b, length, middle, horizontal } = run;
  const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t, score = middle + Math.abs(t - 0.5) * 0.4;
  const at = (x, y, extra, inline) => ({ x, y, w: width, h: height, score: score + extra, ...inline });
  const spots = [];
  if (horizontal && length >= Math.min(width + 16, width * 0.75 + 24)) {
    spots.push(at(cx - width / 2, cy - height - 3, 0), at(cx - width / 2, cy + 4, 0.15));
  }
  if (!horizontal && length >= height + 16) {
    spots.push(at(cx + 7, cy - height / 2, 0.25), at(cx - 7 - width, cy - height / 2, 0.35));
  }
  if (!horizontal && length >= height + 24) spots.push(at(cx - width / 2, cy - height / 2, 0.6, { inline: true }));
  if (horizontal && length >= width + 24) spots.push(at(cx - width / 2, cy - height / 2, 0.7, { inline: true }));
  return spots;
}

// The places a label may go on a route, best first: lower scores lie nearer the line's middle
// and on the better side of it. Runs shorter than 18px hold none.
function candidatesOf(points, size) {
  const total = routeLength(points), candidates = [];
  let travelled = 0;
  for (let s = 0; s + 1 < points.length; s++) {
    const a = points[s], b = points[s + 1], length = runLength(a, b);
    const middle = Math.abs(travelled + length / 2 - total / 2) / (total || 1);
    travelled += length;
    const run = { a, b, length, middle, horizontal: Math.abs(a.y - b.y) < 0.01 };
    if (length >= 18) candidates.push(...fractionsAlong(length).flatMap(t => spotsAt(run, t, size)));
  }
  return candidates.sort((a, b) => a.score - b.score);
}

// Each run of a line, widened by 6px: another label there would read as on that line.
const nearBoxes = points => points.slice(1).map((q, index) => {
  const p = points[index], x = Math.min(p.x, q.x) - 6, y = Math.min(p.y, q.y) - 6;
  return { x, y, w: Math.abs(p.x - q.x) + 12, h: Math.abs(p.y - q.y) + 12 };
});
const covered = (spot, rects) => rects.filter(rect => intersects(spot, rect)).length;

// Where labels may go: what blocks them, the labels placed so far, and the lines near each route.
class LabelSpace {
  constructor(router, routes) {
    this.geometry = router.geometry;
    this.obstacles = router.obstacles;
    this.blocks = blocksOf(router);
    this.placed = [];
    this.nearLines = routes.map(route => nearBoxes(route.points));
  }

  offPage(r) {
    const { width, height } = this.geometry;
    return r.x < 2 || r.y < 2 || r.x + r.w > width - 2 || r.y + r.h > height - 2;
  }

  hits(r) {
    return this.blocks.some(b => intersects(r, b)) || this.placed.some(b => intersects(r, b)) || this.offPage(r);
  }

  crossesLine(spot, index) {
    return this.nearLines.some((boxes, other) => other !== index && boxes.some(b => intersects(spot, b)));
  }

  // Best: touches nothing. Next: lies over another line (its halo cuts the line).
  cleanSpot(candidates, index) {
    return candidates.find(c => !this.hits(c) && !this.crossesLine(c, index)) || candidates.find(c => !this.hits(c));
  }

  // Nowhere clean: the spot that covers the least, text and boxes weighing most.
  leastCovering(candidates, index) {
    const cost = c => 10 * covered(c, this.obstacles) + 10 * covered(c, this.placed) + 3 * covered(c, this.blocks)
      + (this.crossesLine(c, index) ? 1 : 0) + c.score + (this.offPage(c) ? 100 : 0);
    return candidates.reduce((best, c) => (!best || cost(c) < cost(best) ? c : best), null);
  }

  // Only a label over a node, over an obstacle whose id has a '#', or over another label is a
  // problem worth a re-render; touching a box border is the best the space allows.
  isCrowded(spot) {
    return this.obstacles.some(o => intersects(spot, o) && (o.node || o.id.includes('#')))
      || this.placed.some(b => intersects(spot, b));
  }

  // A placed label keeps its neighbours a little apart.
  place(spot) { this.placed.push({ x: spot.x - 4, y: spot.y - 1, w: spot.w + 8, h: spot.h + 2 }); }
}

// With no candidate at all: the middle between the line's ends.
function middleSpot(points, { w, h }) {
  const a = points[0], b = points.at(-1);
  return { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - h / 2, w, h };
}

function placeLabel(space, route, index, size) {
  const candidates = candidatesOf(route.points, size);
  let spot = space.cleanSpot(candidates, index);
  if (!spot) {
    spot = space.leastCovering(candidates, index) || middleSpot(route.points, size);
    route.labelCrowded = space.isCrowded(spot);
  }
  space.place(spot);
  route.label = { text: route.edge.label, x: spot.x, y: spot.y, w: size.w, h: size.h };
}

// Longest labels first: they have the fewest places to go. The lines of a bundle that merged
// into one tree carry one label, drawn on the first of them to be placed; a line of the bundle
// that runs on its own keeps its label.
export function placeLabels(router, routes) {
  const space = new LabelSpace(router, routes), widthOf = text => router.measurer.width(text, T.edge);
  // A label in the theme's font is 14px tall; one in a font of the author's own, as tall as it measures.
  const height = router.measurer.styles.has(T.edge) ? Math.ceil(router.measurer.text('Hg', T.edge).h) : HEIGHT;
  const order = routes.map((route, index) => index).filter(index => routes[index].edge.label)
    .sort((a, b) => widthOf(routes[b].edge.label) - widthOf(routes[a].edge.label));
  const labelledTrees = new Set();
  for (const index of order) {
    const { tree } = routes[index];
    if (tree && labelledTrees.has(tree)) continue;
    if (tree) labelledTrees.add(tree);
    placeLabel(space, routes[index], index, { w: widthOf(routes[index].edge.label), h: height });
  }
}
