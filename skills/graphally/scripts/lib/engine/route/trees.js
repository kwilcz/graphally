// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The second pass, with fixed ports. A bundle routes as a tree: its longest line first, then each
// other line may end (fan-in) or start (fan-out) on any cell of the lines already routed, and
// takes that line's way from there. The lines meet on one trunk, drawn once, instead of running
// side by side. Then every other line is ripped up and routed again with the rest in place.
import { spanOf } from './geometry.js';
import { astar, markUse } from './search.js';

// The direction of a path's step from cell t to the next: 0 east, 1 south, 2 west, 3 north.
function directionAt(cells, t) {
  const a = cells[t], b = cells[t + 1];
  return b === a + 1 ? 0 : b === a - 1 ? 2 : b > a ? 1 : 3;
}

// The inner cells of the bundle's routed lines, as ports: not a trunk's first or last cell,
// which are its own ports.
function addTrunkPorts(grid, connections, paths, index, starts, goals) {
  const connection = connections[index];
  paths.forEach((trunk, other) => {
    if (other === index || !trunk || !connection.bundle) return;
    if (connections[other].bundle !== connection.bundle) return;
    for (let t = 1; t < trunk.cells.length - 1; t++) {
      const cell = trunk.cells[t], i = cell % grid.nx, j = (cell / grid.nx) | 0;
      const direction = directionAt(trunk.cells, t), on = { path: trunk, at: t };
      const at = { i, j, boundary: { x: grid.xs[i], y: grid.ys[j] } };
      if (connection.fanIn) {
        const inward = (direction + 2) % 4;
        goals.push({ ...at, dir: inward, side: trunk.goalSide, coord: trunk.goalCoord, trunk: on });
      } else {
        starts.push({ ...at, dir: direction, side: trunk.startSide, coord: trunk.startCoord, trunk: on });
      }
    }
  });
}

// A path that reached a trunk takes the trunk's remainder (or, from a trunk, its beginning), and
// joins its tree.
function joinTrunk(path) {
  if (!path) return path;
  let { points, cells } = path;
  const joined = { ...path }, toTrunk = path.goal?.trunk, fromTrunk = path.start?.trunk;
  if (toTrunk) {
    const trunk = toTrunk.path;
    points = [...points, ...trunk.points.slice(toTrunk.at + 2)];
    cells = [...cells, ...trunk.cells.slice(toTrunk.at + 1)];
    Object.assign(joined, { goalSide: trunk.goalSide, goalCoord: trunk.goalCoord });
  }
  if (fromTrunk) {
    const trunk = fromTrunk.path;
    points = [...trunk.points.slice(0, fromTrunk.at + 1), ...points];
    cells = [...trunk.cells.slice(0, fromTrunk.at), ...cells];
    Object.assign(joined, { startSide: trunk.startSide, startCoord: trunk.startCoord });
  }
  if (toTrunk || fromTrunk) joined.tree = (toTrunk || fromTrunk).path.tree;
  return { ...joined, points, cells };
}

// Routes every connection on the grid of fixed ports; portsFor(index) gives its starts and goals.
export function routeTrees(grid, connections, portsFor) {
  const paths = new Array(connections.length).fill(null), routed = new Set();
  connections.forEach((connection, index) => {
    if (routed.has(index)) return;
    const members = connection.bundle
      ? connections.map((other, j) => (other.bundle === connection.bundle ? j : -1)).filter(j => j >= 0)
        .sort((a, b) => spanOf(connections[b]) - spanOf(connections[a]))
      : [index];
    for (const member of members) {
      const line = connections[member], [starts, goals] = portsFor(member);
      addTrunkPorts(grid, connections, paths, member, starts, goals);
      const path = joinTrunk(astar(grid, starts, goals, line));
      if (path) {
        // A line that reached the shared end's port on its own still meets the others there.
        const sharedEnd = other => (line.fanIn ? other.cells.at(-1) : other.cells[0]);
        const twin = members.find(j => paths[j] && sharedEnd(paths[j]) === sharedEnd(path));
        path.tree ??= twin !== undefined ? paths[twin].tree : member;
        markUse(grid, path.cells, 1, line.bundle);
      }
      paths[member] = path;
      routed.add(member);
    }
  });
  return paths;
}

// Rip up and reroute: each line outside a bundle is routed again with every other line in
// place, so early lines stop blocking the good routes of later ones. A bundle keeps its tree.
export function ripUpAndReroute(grid, connections, paths, portsFor) {
  for (let round = 0; round < 3; round++) {
    let changed = false;
    connections.forEach((connection, index) => {
      if (!paths[index] || connection.bundle) return;
      markUse(grid, paths[index].cells, -1, connection.bundle);
      const [starts, goals] = portsFor(index);
      const again = astar(grid, starts, goals, connection);
      if (again) {
        changed ||= again.cells.join() !== paths[index].cells.join();
        paths[index] = again;
      }
      markUse(grid, paths[index].cells, 1, connection.bundle);
    });
    if (!changed) break;
  }
}
