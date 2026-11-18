// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Bundles: lines that share an end and mean the same thing route as one tree. They were written
// in one statement (a, b -> c), or are labelled alike in the same style. Unlabelled lines from
// separate statements stay apart: nothing says they carry the same thing.
import { listAt } from '../shared/maps.js';
import { BEND } from './costs.js';
import { manhattan, simplify, spanOf } from './geometry.js';
import { portsOf } from './ports.js';
import { DIRECTION } from './router.js';
import { astar, markUse } from './search.js';

// What a line carries: its label and style, or else the statement it was written in.
function meaningOf(edge) {
  if (edge.label) {
    const { ends } = edge;
    const style = [!!edge.accent, edge.color || '', ends ? [ends.head, ends.tail, ends.dash] : 0];
    return `"${edge.label}"${JSON.stringify(style)}`;
  }
  return edge.stmt ? `#${edge.stmt}` : null;
}

function groupBy(edges, keyOf) {
  const groups = new Map();
  for (const edge of edges) {
    const key = keyOf(edge);
    if (key) listAt(groups, key).push(edge);
  }
  return groups;
}

// Lines that share one end and leave from (or go to) more than one box at the other.
const fans = (list, end) => new Set(list.map(edge => edge[end])).size > 1;

// Each edge's bundle, numbered from 1 (0: none), and whether it fans in to a shared target. A
// fan-in (lines from different sources into one box) is found first; a fan-out (from one box to
// different targets) bundles the lines left.
export function bundlesOf(edges) {
  const fanIns = groupBy(edges, edge => meaningOf(edge) && `>${edge.to}|${meaningOf(edge)}`);
  const fanOuts = groupBy(edges, edge => meaningOf(edge) && `<${edge.from}|${meaningOf(edge)}`);
  const keyOf = new Map();
  const bundle = (list, key) => list.forEach(edge => keyOf.set(edge, key));
  for (const [key, list] of fanIns) if (fans(list, 'from')) bundle(list, key);
  for (const [key, list] of fanOuts) if (fans(list, 'to')) bundle(list.filter(edge => !keyOf.has(edge)), key);
  const numbers = new Map([...new Set(keyOf.values())].map((key, index) => [key, index + 1]));
  return {
    bundleOf: edge => numbers.get(keyOf.get(edge)) || 0,
    fansIn: edge => (keyOf.get(edge) || '').startsWith('>'),
  };
}

// A path's length and bends, as the bundle step compares two ways.
function weightOf(path) {
  let length = 0;
  const { points } = path;
  for (let index = 1; index < points.length; index++) length += manhattan(points[index], points[index - 1]);
  return length + BEND * Math.max(0, simplify(points).length - 2);
}

// The routed lines of each bundle, by index.
function bundleMembers(connections, paths) {
  const members = new Map();
  connections.forEach((connection, index) => {
    if (connection.bundle && paths[index]) listAt(members, connection.bundle).push(index);
  });
  return [...members.values()];
}

// A line routed again to meet its bundle's shared box on the given side, when it can and the
// way is not much longer.
function alignToSide(router, grid, connection, paths, index, side) {
  const [shared, other] = connection.fanIn ? ['target', 'source'] : ['source', 'target'];
  if (connection.edge.override?.[DIRECTION[shared]] != null) return;
  const here = portsOf(connection, shared, grid, router.clearance).filter(port => port.side === side);
  const there = router.freePorts(connection, other, grid);
  if (!here.length) return;
  markUse(grid, paths[index].cells, -1, connection.bundle);
  const [starts, goals] = shared === 'source' ? [here, there] : [there, here];
  const path = astar(grid, starts, goals, connection);
  if (path && weightOf(path) <= weightOf(paths[index]) + 3 * BEND + 300) paths[index] = path;
  markUse(grid, paths[index].cells, 1, connection.bundle);
}

// A bundle meets its shared box on one side, the side its longest line chose: a line that came
// in on another side is routed again to that one, so the lines can merge, unless that costs it
// a long detour or the side is set by hand.
export function alignBundleSides(router, connections, paths, grid) {
  for (const list of bundleMembers(connections, paths)) {
    const sharedSide = index => (connections[index].fanIn ? paths[index].goalSide : paths[index].startSide);
    const lead = list.reduce((a, b) => (spanOf(connections[b]) > spanOf(connections[a]) ? b : a));
    const side = sharedSide(lead), strays = list.filter(index => sharedSide(index) !== side);
    for (const index of strays) alignToSide(router, grid, connections[index], paths, index, side);
  }
}
