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

// The places a label may go on a route, each scored: lower is nearer the line's middle and the
// better side of it.
function candidatesOf(points, width) {
  let total = 0, run = 0;
  for (let index = 1; index < points.length; index++) {
    const point = points[index], before = points[index - 1];
    total += Math.abs(point.x - before.x) + Math.abs(point.y - before.y);
  }
  const candidates = [];
  for (let s = 0; s + 1 < points.length; s++) {
    const a = points[s], b = points[s + 1], length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const middle = Math.abs(run + length / 2 - total / 2) / (total || 1);
    run += length;
    if (length < 18) continue;
    const horizontal = Math.abs(a.y - b.y) < 0.01;
    // Every few pixels along the run, its middle first.
    const fractions = [0.5];
    for (let d = 6; d < length / 2; d += 6) fractions.push(0.5 - d / length, 0.5 + d / length);
    for (const t of fractions) {
      const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t, score = middle + Math.abs(t - 0.5) * 0.4;
      const at = (x, y, extra, inline) =>
        candidates.push({ x, y, w: width, h: HEIGHT, score: score + extra, ...inline });
      if (horizontal && length >= Math.min(width + 16, width * 0.75 + 24)) {
        at(cx - width / 2, cy - HEIGHT - 3, 0);
        at(cx - width / 2, cy + 4, 0.15);
      }
      if (!horizontal && length >= HEIGHT + 16) {
        at(cx + 7, cy - HEIGHT / 2, 0.25);
        at(cx - 7 - width, cy - HEIGHT / 2, 0.35);
      }
      // On the line itself, the halo interrupting it: for narrow channels.
      if (!horizontal && length >= HEIGHT + 24) at(cx - width / 2, cy - HEIGHT / 2, 0.6, { inline: true });
      if (horizontal && length >= width + 24) at(cx - width / 2, cy - HEIGHT / 2, 0.7, { inline: true });
    }
  }
  return candidates.sort((a, b) => a.score - b.score);
}

export function placeLabels(router, routes) {
  const { geometry, obstacles, measurer } = router, blocks = blocksOf(router), placed = [];
  const { width: pageWidth, height: pageHeight } = geometry;
  const offPage = r => r.x < 2 || r.y < 2 || r.x + r.w > pageWidth - 2 || r.y + r.h > pageHeight - 2;
  const hits = r => blocks.some(b => intersects(r, b)) || placed.some(b => intersects(r, b)) || offPage(r);
  // Another line within a few pixels makes a label ambiguous, as if on that line.
  const nearLines = routes.map(route => route.points.slice(1).map((q, index) => {
    const p = route.points[index];
    const x = Math.min(p.x, q.x) - 6, y = Math.min(p.y, q.y) - 6;
    return { x, y, w: Math.abs(p.x - q.x) + 12, h: Math.abs(p.y - q.y) + 12 };
  }));
  const widthOf = text => measurer.width(text, T.edge);
  // Longest labels first: they have the fewest places to go.
  const order = routes.map((route, index) => index).filter(index => routes[index].edge.label)
    .sort((a, b) => widthOf(routes[b].edge.label) - widthOf(routes[a].edge.label));
  const labelledTrees = new Set();
  for (const index of order) {
    const route = routes[index], text = route.edge.label;
    // The lines of a bundle that merged into one tree carry one label, drawn on the first of them
    // to be placed; a line of the bundle that runs on its own keeps its label.
    if (route.tree && labelledTrees.has(route.tree)) continue;
    if (route.tree) labelledTrees.add(route.tree);
    const width = widthOf(text), candidates = candidatesOf(route.points, width);
    const crossesLine = c =>
      nearLines.some((boxes, other) => other !== index && boxes.some(b => intersects(c, b)));
    // Best: touches nothing. Next: lies over another line (its halo cuts the line).
    let spot = candidates.find(c => !hits(c) && !crossesLine(c)) || candidates.find(c => !hits(c));
    if (!spot) {
      // Nowhere clean: the spot that covers the least, text and boxes weighing most.
      const covered = (c, list) => list.filter(b => intersects(c, b)).length;
      const cost = c => 10 * covered(c, obstacles) + 10 * covered(c, placed) + 3 * covered(c, blocks)
        + (crossesLine(c) ? 1 : 0) + c.score + (offPage(c) ? 100 : 0);
      spot = candidates.reduce((best, c) => (!best || cost(c) < cost(best) ? c : best), null);
      if (!spot) {
        const a = route.points[0], b = route.points.at(-1);
        spot = { x: (a.x + b.x) / 2 - width / 2, y: (a.y + b.y) / 2 - HEIGHT / 2, w: width, h: HEIGHT };
      }
      // Only a label over a node, over an obstacle whose id has a '#', or over another label is a
      // problem worth a re-render; touching a box border is the best the space allows.
      route.labelCrowded = obstacles.some(o => intersects(spot, o) && (o.node || o.id.includes('#')))
        || placed.some(b => intersects(spot, b));
    }
    placed.push({ x: spot.x - 4, y: spot.y - 1, w: spot.w + 8, h: spot.h + 2 });   // keep neighbours apart
    route.label = { text, x: spot.x, y: spot.y, w: width, h: HEIGHT };
  }
}
