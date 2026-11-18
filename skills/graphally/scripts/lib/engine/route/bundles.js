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

// Each edge's bundle, numbered from 1 (0: none), and whether it fans in to a shared target. A
// fan-in (lines from different sources into one box) is found first; a fan-out (from one box to
// different targets) bundles the lines left.
export function bundlesOf(edges) {
  const groupBy = keyOf => {
    const groups = new Map();
    for (const edge of edges) {
      const key = keyOf(edge);
      if (key) listAt(groups, key).push(edge);
    }
    return groups;
  };
  const fanIns = groupBy(edge => meaningOf(edge) && `>${edge.to}|${meaningOf(edge)}`);
  const fanOuts = groupBy(edge => meaningOf(edge) && `<${edge.from}|${meaningOf(edge)}`);
  const keyOf = new Map();
  for (const [key, list] of fanIns) {
    if (new Set(list.map(edge => edge.from)).size > 1) for (const edge of list) keyOf.set(edge, key);
  }
  for (const [key, list] of fanOuts) {
    if (new Set(list.map(edge => edge.to)).size < 2) continue;
    for (const edge of list) if (!keyOf.has(edge)) keyOf.set(edge, key);
  }
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

// A bundle meets its shared box on one side, the side its longest line chose: a line that came
// in on another side is routed again to that one, so the lines can merge, unless that costs it
// a long detour or the side is set by hand.
export function alignBundleSides(router, connections, paths, grid) {
  const members = new Map();
  connections.forEach((connection, index) => {
    if (connection.bundle && paths[index]) listAt(members, connection.bundle).push(index);
  });
  for (const list of members.values()) {
    const sharedSide = index => (connections[index].fanIn ? paths[index].goalSide : paths[index].startSide);
    const lead = list.reduce((a, b) => (spanOf(connections[b]) > spanOf(connections[a]) ? b : a));
    for (const index of list) {
      const connection = connections[index];
      const [shared, other] = connection.fanIn ? ['target', 'source'] : ['source', 'target'];
      const side = sharedSide(lead);
      if (sharedSide(index) === side || connection.edge.override?.[DIRECTION[shared]] != null) continue;
      const here = portsOf(connection, shared, grid, router.clearance).filter(port => port.side === side);
      const there = router.freePorts(connection, other, grid);
      if (!here.length) continue;
      markUse(grid, paths[index].cells, -1, connection.bundle);
      const [starts, goals] = shared === 'source' ? [here, there] : [there, here];
      const path = astar(grid, starts, goals, connection);
      if (path && weightOf(path) <= weightOf(paths[index]) + 3 * BEND + 300) paths[index] = path;
      markUse(grid, paths[index].cells, 1, connection.bundle);
    }
  }
}
