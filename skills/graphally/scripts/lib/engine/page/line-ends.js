// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The ends of a thick line. A thin line's 9px head has wings of 3.75px on each side of it; a thick
// line's head keeps those wings, so it is the line's width and 7.5px, no larger than it needs to be.
// A thick line stops just inside its arrowhead, where the head's sides cover its square end, and
// reaches the head straight: a curve ends in a short straight run, and a routed line's head is kept
// off its last corner. Lines up to 2.5px keep the plain 9px ends, drawn as before.

import { S } from '../style.js';

const PLAIN = 9, WINGS = 7.5, THIN = 2.5, STRAIGHT = 6;

// A connection's width: its own, else an accent line's 2px or the theme's.
export const lineWidth = edge => edge.width || (edge.accent ? 2 : S.edge.width);

const thick = width => (Number(width) || 0) > THIN;

// The size of a line's ends, in pixels: the line's width and the wings, the room allowing.
export function endSize(width, room = Infinity) {
  if (!thick(width)) return PLAIN;
  const wanted = Math.round((Number(width) + WINGS) * 2) / 2;
  return Math.max(PLAIN, Math.min(wanted, Math.floor(room)));
}

// One end: its size, and how far the line stops before the tip (a filled arrowhead's sides cover a
// line's end from about the line's width before the tip).
function endOf(kind, width, room) {
  const size = endSize(width, room);
  return { size, tuck: kind === 'arrow' && thick(width) ? Math.min(Number(width) + 1, size - 1) : 0 };
}

// Both ends of a line. room: for a routed line, the straight run each end has before its corner.
export function lineEnds(ends, width, room = {}) {
  return { start: endOf(ends.tail, width, room.start), end: endOf(ends.head, width, room.end) };
}

// A point moved from p towards q by length, when the run between them is longer.
function towards(p, q, length) {
  const d = Math.hypot(q.x - p.x, q.y - p.y);
  return d > length + 2 ? { x: p.x + ((q.x - p.x) / d) * length, y: p.y + ((q.y - p.y) / d) * length } : p;
}

// The straight run each end of a routed line has before its first corner turns (radius: the corner's).
export function routeRoom(points, radius) {
  const run = (p, q) => Math.hypot(q.x - p.x, q.y - p.y) - (points.length > 2 ? radius : 0) - 3;
  return { start: run(points[0], points[1]), end: run(points.at(-1), points.at(-2)) };
}

// A routed line's corner points, its ends pulled in by their tucks.
export function tuckedPoints(points, { start, end }) {
  if (!start.tuck && !end.tuck) return points;
  const out = points.slice();
  if (start.tuck) out[0] = towards(out[0], out[1], start.tuck);
  if (end.tuck) out[out.length - 1] = towards(out.at(-1), out.at(-2), end.tuck);
  return out;
}

const PAIR = /(-?[\d.]+),(-?[\d.]+)/g;
const fmt = value => String(Math.round(value * 10) / 10);
const at = pair => ({ x: Number(pair[1]), y: Number(pair[2]) });
const written = point => `${fmt(point.x)},${fmt(point.y)}`;

// A drawn path with the coordinate pairs at the given indexes replaced.
function replacePairs(d, pairs, replacements) {
  let out = d;
  for (const [index, point] of [...replacements].sort((a, b) => b[0] - a[0])) {
    const pair = pairs[index];
    out = `${out.slice(0, pair.index)}${written(point)}${out.slice(pair.index + pair[0].length)}`;
  }
  return out;
}

const shifted = (point, from, to) => ({ x: point.x + to.x - from.x, y: point.y + to.y - from.y });

// One end of a drawn path pulled in by its tuck. A straight last run is shortened; a curve is
// ended earlier, its control point moved with its end so it keeps its direction, and joined to
// the tucked end by a straight run, so the line meets its arrowhead straight. An arc's end stays.
function tuckPathEnd(d, { size, tuck }, atStart) {
  const pairs = [...d.matchAll(PAIR)], commands = d.match(/[a-z]/gi) || [];
  const command = (atStart ? commands[1] : commands.at(-1) || '').toUpperCase();
  if (!tuck || pairs.length < 2 || !/^[LCQS]$/.test(command)) return d;
  const [endIndex, nextIndex] = atStart ? [0, 1] : [pairs.length - 1, pairs.length - 2];
  const end = at(pairs[endIndex]), next = at(pairs[nextIndex]);
  const lineEnd = towards(end, next, tuck);
  if (lineEnd === end) return d;
  if (command === 'L') return replacePairs(d, pairs, [[endIndex, lineEnd]]);
  const curveEnd = towards(end, next, tuck + Math.max(STRAIGHT, size / 2));
  if (curveEnd === end) return replacePairs(d, pairs, [[endIndex, lineEnd]]);
  const moved = replacePairs(d, pairs, [[endIndex, curveEnd], [nextIndex, shifted(next, end, curveEnd)]]);
  return atStart ? moved.replace(/^\s*M\s*/, `M${written(lineEnd)} L`) : `${moved} L${written(lineEnd)}`;
}

export const tuckedPath = (d, { start, end }) => tuckPathEnd(tuckPathEnd(d, end, false), start, true);
