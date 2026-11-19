// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// After the first pass, each line's ports are fixed: lines that share a side spread along it.
import { listAt } from '../shared/maps.js';

// The lines on each side of each box, with where each heads: walk away from the port until the
// path leaves the port's line; that coordinate orders the lines along the side, so they do not
// cross.
function sideUsers(connections, paths) {
  const users = new Map();
  connections.forEach((connection, index) => {
    const path = paths[index];
    if (!path) return;
    for (const [which, side] of [['source', path.startSide], ['target', path.goalSide]]) {
      const points = which === 'source' ? path.points : [...path.points].reverse();
      const axis = side % 2 === 0 ? 'y' : 'x', base = points[0][axis];
      const away = points.find(point => Math.abs(point[axis] - base) > 1);
      const id = connection[which].id;
      const entry = users.get(`${id}|${side}`) || { id, side, list: [] };
      users.set(`${id}|${side}`, entry);
      entry.list.push({ index, which, heading: away ? away[axis] : base });
    }
  });
  return users;
}

// The middle of a side.
const middleOf = (rect, side) => (side % 2 === 0 ? rect.y + rect.h / 2 : rect.x + rect.w / 2);

// Lines that share a side split it evenly: one at the middle, two at a third and two thirds,
// n at k/(n+1) of its free stretch, in the order they head off. A bundle meets its shared box at
// one point, and a circle or diamond is met at its points.
function spreadSide(router, { id, side, list }, connections, fixed) {
  const rect = router.rectOf(id);
  const bundles = new Set(list.map(user => connections[user.index].bundle));
  const oneBundle = list.length > 1 && bundles.size === 1 && !bundles.has(0);
  if (oneBundle || router.geometry.nodes.get(id)?.round) {
    for (const user of list) fixed[user.index][user.which] = { side, coord: middleOf(rect, side) };
    return;
  }
  list.sort((a, b) => a.heading - b.heading);
  const along = side % 2 === 0 ? rect.h : rect.w, origin = side % 2 === 0 ? rect.y : rect.x;
  const free = [];
  for (let at = origin + 6; at <= origin + along - 6; at += 2) {
    if (router.sideFree(id, side, at)) free.push(at);
  }
  const lo = free.length ? free[0] - 6 : origin, hi = free.length ? free.at(-1) + 6 : origin + along;
  list.forEach((user, order) => {
    fixed[user.index][user.which] = { side, coord: lo + (hi - lo) * (order + 1) / (list.length + 1) };
  });
}

// The middle 80% of a side, where a straight line may meet it; a circle or diamond only at its
// point.
function straightStretch(router, id, side) {
  const rect = router.rectOf(id), upright = side % 2 === 0;
  const origin = upright ? rect.y : rect.x, length = upright ? rect.h : rect.w;
  if (router.geometry.nodes.get(id)?.round) return [origin + length / 2, origin + length / 2];
  return [origin + length * 0.1, origin + length * 0.9];
}

// Where a line between two facing sides can run straight, inside the middle 80% of both: for two
// lone ends, the point nearest the middle of their ports; for one lone end, the port of the other
// end, which other lines share (a bundle meets its box at one point) and so stays. Null for none.
function straightAt(router, connection, ends, alone) {
  const { source, target } = ends;
  const [sourceLo, sourceHi] = straightStretch(router, connection.source.id, source.side);
  const [targetLo, targetHi] = straightStretch(router, connection.target.id, target.side);
  const lo = Math.max(sourceLo, targetLo), hi = Math.min(sourceHi, targetHi);
  if (lo > hi) return null;
  if (alone.source && alone.target) return Math.min(hi, Math.max(lo, (source.coord + target.coord) / 2));
  const shared = alone.source ? target.coord : source.coord;
  return shared >= lo && shared <= hi ? shared : null;
}

// One exception: a line alone on a side, facing its other end, runs straight where it can, so it
// takes no step a pixel or two high. Without room for that it keeps its port and takes the step.
function straighten(router, connection, ends, users) {
  const { source, target } = ends;
  if (!source || !target || (source.side + 2) % 4 !== target.side) return;
  const isAlone = (end, which) => users.get(`${connection[which].id}|${end.side}`).list.length === 1;
  const alone = { source: isAlone(source, 'source'), target: isAlone(target, 'target') };
  if (!alone.source && !alone.target) return;
  const coord = straightAt(router, connection, ends, alone);
  if (coord === null) return;
  if (!router.sideFree(connection.source.id, source.side, coord)) return;
  if (!router.sideFree(connection.target.id, target.side, coord)) return;
  source.coord = coord;
  target.coord = coord;
}

// Each connection's fixed ports, { source, target } of { side, coord }, from the first pass.
export function spreadPorts(router, connections, paths) {
  const users = sideUsers(connections, paths), fixed = connections.map(() => ({}));
  for (const sideUse of users.values()) spreadSide(router, sideUse, connections, fixed);
  connections.forEach((connection, index) => straighten(router, connection, fixed[index], users));
  return fixed;
}
