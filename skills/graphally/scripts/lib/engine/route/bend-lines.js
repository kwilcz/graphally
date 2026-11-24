// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where a route would rather bend, of ways that cost the same: a line across its way, which the
// search pulls its bends towards (search.js, BEND_PULL). A bundle bends on its gather line, so its
// lines meet early and run on as one trunk; a line from one box to the facing side of another
// bends midway between them, so a Z-shaped line turns in the middle of the gap, not against a box.
import { S } from '../style.js';

// A step shorter than this (four corner radii) is no Z but a kink: in the middle of a long line it
// draws the eye, so it keeps its bends where they fall, most often at an end.
const SMALL_STEP = 4 * S.edge.radius;

// A box's edge on a side: 0 right, 1 bottom, 2 left, 3 top.
const edgeOf = (rect, side) => [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y][side];

// The line midway between two boxes, across the way from a side of one to the facing side of the
// other, for ports `step` apart along those sides. Null when the sides do not face each other,
// the boxes leave no gap between them, or the step is small.
export function middleLine(source, sourceSide, target, targetSide, step) {
  if ((sourceSide + 2) % 4 !== targetSide || step < SMALL_STEP) return null;
  const from = edgeOf(source, sourceSide), to = edgeOf(target, targetSide), forward = sourceSide < 2 ? 1 : -1;
  if ((to - from) * forward <= 0) return null;
  return { across: sourceSide % 2 === 0 ? 'x' : 'y', at: (from + to) / 2 };
}

// The line a bundle gathers on: across the way to the shared box, through the unshared end
// nearest that box. Lines from boxes side by side meet right beside them, and a line from
// further away runs on to meet the one whose box is nearest. Null for a bundle of one, or one
// whose lines meet the shared box at different ports and so cannot share a trunk.
function gatherLine(grid, connections, members, portsFor) {
  const fanIn = connections[members[0]].fanIn;
  const ends = members.map(member => {
    const [starts, goals] = portsFor(member);
    return fanIn ? { own: starts[0], shared: goals[0] } : { own: goals[0], shared: starts[0] };
  }).filter(end => end.own && end.shared);
  const atShared = end => end.shared.i === ends[0].shared.i && end.shared.j === ends[0].shared.j;
  if (ends.length < 2 || !ends.every(atShared)) return null;
  const across = ends[0].shared.side % 2 === 0 ? 'x' : 'y';
  const at = port => (across === 'x' ? grid.xs[port.i] : grid.ys[port.j]);
  const shared = at(ends[0].shared);
  const nearest = ends.map(end => at(end.own)).reduce((a, b) => (Math.abs(b - shared) < Math.abs(a - shared) ? b : a));
  return { across, at: nearest };
}

// The line a route bends on: its bundle's gather line, or, for a line on its own with its ports
// fixed, the middle of the gap it crosses. Null for none.
export function bendLineOf(grid, connections, members, portsFor) {
  const connection = connections[members[0]];
  if (connection.bundle) return gatherLine(grid, connections, members, portsFor);
  const [starts, goals] = portsFor(members[0]);
  if (starts.length !== 1 || goals.length !== 1) return null;
  const step = Math.abs(starts[0].coord - goals[0].coord);
  return middleLine(connection.source.rect, starts[0].side, connection.target.rect, goals[0].side, step);
}
