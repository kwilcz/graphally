// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Rectangles and polylines, as the router measures them.

// The sides of a box, as the router numbers them: 0 east, 1 south, 2 west, 3 north.
export const SIDES = ['right', 'bottom', 'left', 'top'];

export const inflate = ({ x, y, w, h }, by) => ({ x: x - by, y: y - by, w: w + 2 * by, h: h + 2 * by });
export const center = rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
export const manhattan = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
export const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The stretch two spans share on one axis, when it is at least 16px long.
export function sharedSpan(startA, lengthA, startB, lengthB) {
  const lo = Math.max(startA, startB), hi = Math.min(startA + lengthA, startB + lengthB);
  return hi - lo >= 16 ? { lo, hi, mid: (lo + hi) / 2 } : null;
}

// How far apart a connection's two boxes are, centre to centre.
export const spanOf = connection => manhattan(center(connection.source.rect), center(connection.target.rect));

const same = (a, b) => Math.abs(a - b) < 0.01;
const samePoint = (p, q) => same(p.x, q.x) && same(p.y, q.y);
const inLine = ([a, b, c]) => (same(a.x, b.x) && same(b.x, c.x)) || (same(a.y, b.y) && same(b.y, c.y));

// A polyline without repeated points and without the middle point of three in a line.
export function simplify(points) {
  const simple = [];
  for (const point of points) {
    if (simple.length && samePoint(simple.at(-1), point)) continue;
    simple.push({ x: point.x, y: point.y });
    while (simple.length >= 3 && inLine(simple.slice(-3))) simple.splice(-2, 1);
  }
  return simple;
}
