// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Line hops: where two routed lines cross, one jumps the other with a small arc, so a crossing
// never reads as a junction. The horizontal line jumps; where it has no room (a bend or its end
// too close), the vertical one does; where neither has, they cross plain. Lines of one bundle's
// tree never jump each other, and where a trunk jumps, every line drawn along it jumps alike.
import { S } from '../style.js';
import { pairsOf } from '../shared/maps.js';

// Room a hop leaves before a rounded bend, and before a line's end (its arrowhead or its box).
const BEND_ROOM = S.edge.radius + 1;
const END_ROOM = 12;

const isFlat = ([from, to]) => Math.abs(from.y - to.y) < 0.5;
const isUpright = ([from, to]) => Math.abs(from.x - to.x) < 0.5;
const segmentsOf = points => points.slice(1).map((point, index) => [points[index], point]);
const strictlyInside = (value, a, b) => value > Math.min(a, b) + 1 && value < Math.max(a, b) - 1;

// Where a horizontal run crosses a vertical one, away from both their ends; else null.
function crossingOf(flat, upright) {
  const x = upright[0].x, y = flat[0].y;
  if (!strictlyInside(x, flat[0].x, flat[1].x) || !strictlyInside(y, upright[0].y, upright[1].y)) return null;
  return { x, y };
}

// Whether segment k of a line has room for a hop centred at a coordinate along it.
function hasRoom(points, k, at) {
  const [from, to] = [points[k], points[k + 1]], axis = isFlat([from, to]) ? 'x' : 'y';
  const fromRoom = k === 0 ? END_ROOM : BEND_ROOM, toRoom = k === points.length - 2 ? END_ROOM : BEND_ROOM;
  const [low, high] = from[axis] < to[axis]
    ? [from[axis] + fromRoom, to[axis] - toRoom]
    : [to[axis] + toRoom, from[axis] - fromRoom];
  return at - S.edge.hop >= low && at + S.edge.hop <= high;
}

const sameTree = (a, b) => Boolean(a.tree) && a.tree === b.tree;
const runsOf = (routes, index) => segmentsOf(routes[index].points)
  .map((run, segment) => ({ run, route: index, segment }));

// Records where two runs cross, if they do: the place, with the flat and the upright runs through it.
function addCrossing(places, one, other) {
  const [flat, upright] = isFlat(one.run) && isUpright(other.run) ? [one, other]
    : isUpright(one.run) && isFlat(other.run) ? [other, one] : [];
  const point = flat && crossingOf(flat.run, upright.run);
  if (!point) return;
  const key = `${point.x},${point.y}`;
  if (!places.has(key)) places.set(key, { ...point, flat: new Map(), upright: new Map() });
  places.get(key).flat.set(flat.route, flat.segment);
  places.get(key).upright.set(upright.route, upright.segment);
}

function addCrossingsOf(places, runs, others) {
  for (const one of runs) for (const other of others) addCrossing(places, one, other);
}

// Every crossing of two lines from different trees, by place.
function crossingsOf(routes) {
  const places = new Map();
  for (const [a, b] of pairsOf(routes.map((route, index) => index))) {
    if (!sameTree(routes[a], routes[b])) addCrossingsOf(places, runsOf(routes, a), runsOf(routes, b));
  }
  return [...places.values()];
}

// The side a vertical hop bulges to: towards the longer stretch of the flat line it jumps, away
// from that line's nearer end (often its arrowhead). 1 is right, -1 left.
function uprightSide(routes, place) {
  const [route, segment] = [...place.flat][0], points = routes[route].points;
  const [from, to] = [points[segment], points[segment + 1]];
  return Math.max(from.x, to.x) - place.x > place.x - Math.min(from.x, to.x) ? 1 : -1;
}

// The lines that jump at a crossing, where along their run, and to which side: the flat ones,
// upwards, when all have room; else the upright ones.
function jumpersAt(routes, place) {
  const fits = (runs, at) => [...runs].every(([route, segment]) => hasRoom(routes[route].points, segment, at));
  const jump = (runs, at, side) => [...runs].map(([route, segment]) => ({ route, segment, at, side }));
  if (fits(place.flat, place.x)) return jump(place.flat, place.x, 1);
  if (fits(place.upright, place.y)) return jump(place.upright, place.y, uprightSide(routes, place));
  return [];
}

// Each route's hops, { segment, at, side }, in the order of the routes: side 1 bulges up from a
// flat run or right of an upright one, -1 the other way.
export function hopsOf(routes) {
  const hops = routes.map(() => []);
  for (const place of crossingsOf(routes)) {
    for (const { route, ...hop } of jumpersAt(routes, place)) hops[route].push(hop);
  }
  return hops;
}
