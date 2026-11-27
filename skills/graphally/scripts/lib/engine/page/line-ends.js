// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The ends of a thick line. A line's head and tail grow with its width, about three and a half
// times it, so a thick stream ends in an arrowhead wider than itself; and a thick line stops inside
// its arrowhead's base instead of running under the arrow to its tip, where its square end would
// show on both sides of the point. Lines up to 2.5px keep the plain 9px ends, drawn as before.

const PLAIN = 9;

// The size of a line's ends, in pixels.
export const endSize = width => Math.max(PLAIN, Math.round((Number(width) || 0) * 3.6));

// How far a filled arrowhead's tip lies ahead of the point the line stops at: the line ends 0.6 of
// the head's length before the tip, under its widest part.
const tuckOf = (kind, size) => (kind === 'arrow' && size > PLAIN ? 0.6 * size : 0);
export const tucks = (ends, width) => ({
  start: tuckOf(ends.tail, endSize(width)), end: tuckOf(ends.head, endSize(width)),
});

// A point moved from p towards q by length.
function towards(p, q, length) {
  const d = Math.hypot(q.x - p.x, q.y - p.y);
  return d > length + 2 ? { x: p.x + ((q.x - p.x) / d) * length, y: p.y + ((q.y - p.y) / d) * length } : p;
}

// A routed line's corner points, its ends pulled in by their tucks.
export function tuckedPoints(points, { start, end }) {
  if (!start && !end) return points;
  const out = points.slice();
  if (start) out[0] = towards(out[0], out[1], start);
  if (end) out[out.length - 1] = towards(out.at(-1), out.at(-2), end);
  return out;
}

const PAIR = /(-?[\d.]+),(-?[\d.]+)/g;
const fmt = value => String(Math.round(value * 10) / 10);

// A drawn path's coordinate pairs moved by (dx, dy), at the given indexes.
function movePairs(d, pairs, indexes, dx, dy) {
  let out = d;
  for (const index of [...indexes].sort((a, b) => b - a)) {
    const pair = pairs[index], x = Number(pair[1]) + dx, y = Number(pair[2]) + dy;
    out = `${out.slice(0, pair.index)}${fmt(x)},${fmt(y)}${out.slice(pair.index + pair[0].length)}`;
  }
  return out;
}

// One end of a drawn path pulled in along its direction there: the end point and, on a curve, the
// control point beside it, so the curve keeps its direction. An arc's end stays.
function tuckPathEnd(d, length, atStart) {
  const pairs = [...d.matchAll(PAIR)], commands = d.match(/[a-z]/gi) || [];
  const command = (atStart ? commands[1] : commands.at(-1) || '').toUpperCase();
  if (!length || pairs.length < 2 || !/^[LCQS]$/.test(command)) return d;
  const [endIndex, nextIndex] = atStart ? [0, 1] : [pairs.length - 1, pairs.length - 2];
  const end = { x: Number(pairs[endIndex][1]), y: Number(pairs[endIndex][2]) };
  const next = { x: Number(pairs[nextIndex][1]), y: Number(pairs[nextIndex][2]) };
  const moved = towards(end, next, length);
  if (moved === end) return d;
  const indexes = command === 'L' ? [endIndex] : [endIndex, nextIndex];
  return movePairs(d, pairs, indexes, moved.x - end.x, moved.y - end.y);
}

export const tuckedPath = (d, { start, end }) => tuckPathEnd(tuckPathEnd(d, end, false), start, true);
