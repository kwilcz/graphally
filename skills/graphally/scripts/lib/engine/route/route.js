// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Orthogonal routing around boxes: A* over a sparse grid (grid.js, search.js). Two passes: the
// first chooses which side of each box a line uses; then lines that share a side spread along it
// (spread.js), and the second routes again with fixed ports, a bundle as one tree (trees.js).
// Then parallel runs are moved apart (separate.js) and labels are placed where they collide with
// nothing (labels.js).
import { listAt } from '../shared/maps.js';
import { TRUNK, SIDE_TAKEN, marksOf } from './costs.js';
import { sharedSpan, simplify, spanOf } from './geometry.js';
import { createRouter } from './router.js';
import { buildGrid } from './grid.js';
import { portAt } from './ports.js';
import { astar, markUse } from './search.js';
import { bundlesOf, alignBundleSides } from './bundles.js';
import { spreadPorts } from './spread.js';
import { routeTrees, ripUpAndReroute } from './trees.js';
import { separateParallels } from './separate.js';
import { placeLabels } from './labels.js';

// The edges there is a way for (two different boxes the router knows), shortest first: they
// have the fewest good options.
function connectionsOf(router) {
  const { model, rectOf } = router, { bundleOf, fansIn } = bundlesOf(model.edges);
  const endOf = id => ({ id, rect: rectOf(id), isGroup: model.groups.has(id) });
  const routable = model.edges.filter(edge => edge.from !== edge.to && rectOf(edge.from) && rectOf(edge.to));
  const connections = routable.map(edge => ({
    edge, bundle: bundleOf(edge), fanIn: fansIn(edge), marks: marksOf(edge),
    source: endOf(edge.from), target: endOf(edge.to),
    allowed: new Set([...router.containersAround(edge.from), ...router.containersAround(edge.to)]),
  }));
  return connections.sort((a, b) => spanOf(a) - spanOf(b));
}

// Grid lines of the first pass: through every box's centre, where a full-length end would turn,
// and through the middle of the stretch each line's two boxes share.
function firstLines(router, connections) {
  const { geometry, endLength } = router, extraX = new Set(), extraY = new Set();
  const rects = [...geometry.nodes.values(), ...geometry.groups.values()];
  for (const rect of rects) {
    extraX.add(rect.x + rect.w / 2);
    extraY.add(rect.y + rect.h / 2);
  }
  if (endLength) {
    for (const rect of rects) {
      if (rect.virtual) continue;
      extraX.add(rect.x - endLength);
      extraX.add(rect.x + rect.w + endLength);
      extraY.add(rect.y - endLength);
      extraY.add(rect.y + rect.h + endLength);
    }
  }
  for (const { source, target } of connections) {
    const acrossY = sharedSpan(source.rect.y, source.rect.h, target.rect.y, target.rect.h);
    const acrossX = sharedSpan(source.rect.x, source.rect.w, target.rect.x, target.rect.w);
    if (acrossY) extraY.add(acrossY.mid);
    if (acrossX) extraX.add(acrossX.mid);
  }
  return { extraX, extraY };
}

// The first pass: every line with free ports, in turn. A side of a circle or diamond that is
// already used costs more.
function firstPass(router, connections, grid) {
  const sideUse = new Map();
  const usesOf = (id, side, direction) =>
    (sideUse.get(`${id}|${side}`) || []).filter(used => !direction || used === direction).length;
  return connections.map(connection => {
    const starts = router.freePorts(connection, 'source', grid);
    const goals = router.freePorts(connection, 'target', grid);
    const { source, target } = connection;
    const addPenalty = (port, uses) => { port.penalty = (port.penalty || 0) + SIDE_TAKEN * uses; };
    if (source.rect.round) for (const port of starts) addPenalty(port, usesOf(source.id, port.side));
    if (target.rect.round) for (const port of goals) addPenalty(port, usesOf(target.id, port.side, 'out'));
    const path = astar(grid, starts, goals, connection);
    if (globalThis.__routeDebug) {
      const at = port => [port.side, grid.xs[port.i], grid.ys[port.j]];
      (globalThis.__routeLog ||= []).push({
        e: `${source.id}->${target.id}`, starts: starts.map(at), goals: goals.map(at),
        chose: path && [path.startSide, path.goalSide, Math.round(path.cost)],
      });
    }
    if (path) {
      markUse(grid, path.cells, 1, connection.bundle);
      listAt(sideUse, `${source.id}|${path.startSide}`).push('out');
      listAt(sideUse, `${target.id}|${path.goalSide}`).push('in');
    }
    return path;
  });
}

// A bundle's lines merge and split away from its boxes: an end with a mark (the one arrowhead of
// a fan-in, each arrowhead of a fan-out) gets a grid line a full trunk's length out. Two such
// lines a few pixels apart would draw two trunks side by side: the later one is left out, and its
// port snaps to the first.
const hasTrunkRoom = (connection, which) =>
  connection.bundle && connection.marks[which === 'target' ? 'head' : 'tail'];

function addTrunkLines(connections, fixed, extraX, extraY) {
  const trunks = { x: [], y: [] };
  const addTrunk = (axis, value) => {
    if (trunks[axis].some(other => Math.abs(other - value) < 12)) return;
    trunks[axis].push(value);
    (axis === 'x' ? extraX : extraY).add(value);
  };
  connections.forEach((connection, index) => {
    for (const which of ['source', 'target']) {
      const port = fixed[index][which];
      if (!port || !hasTrunkRoom(connection, which)) continue;
      const { rect } = connection[which];
      if (port.side === 0) addTrunk('x', rect.x + rect.w + TRUNK);
      else if (port.side === 2) addTrunk('x', rect.x - TRUNK);
      else if (port.side === 1) addTrunk('y', rect.y + rect.h + TRUNK);
      else addTrunk('y', rect.y - TRUNK);
    }
  });
}

export function routeEdges(model, geometry, measurer) {
  const router = createRouter(model, geometry, measurer);
  const connections = connectionsOf(router);
  const { extraX, extraY } = firstLines(router, connections);
  let grid = buildGrid(router, extraX, extraY);
  if (globalThis.__routeDebug) {
    globalThis.__routeHard = router.obstacles.map(o => [o.id, ...[o.x, o.y, o.w, o.h].map(Math.round)]);
  }
  const first = firstPass(router, connections, grid);
  alignBundleSides(router, connections, first, grid);
  const fixed = spreadPorts(router, connections, first);

  // The second pass, on a grid with lines through the fixed ports and the trunks.
  for (const ports of fixed) {
    for (const which of ['source', 'target']) {
      if (ports[which]) (ports[which].side % 2 === 0 ? extraY : extraX).add(ports[which].coord);
    }
  }
  addTrunkLines(connections, fixed, extraX, extraY);
  grid = buildGrid(router, extraX, extraY);
  const portsFor = index => {
    const connection = connections[index], ports = fixed[index];
    const portsAt = which => {
      const port = ports[which];
      if (!port) return router.freePorts(connection, which, grid);
      const longer = hasTrunkRoom(connection, which) ? TRUNK : 0;
      return [portAt(connection[which], port.side, port.coord, grid, router.clearance, longer)];
    };
    return [portsAt('source').filter(Boolean), portsAt('target').filter(Boolean)];
  };
  const paths = routeTrees(grid, connections, portsFor);
  ripUpAndReroute(grid, connections, paths, portsFor);

  const routes = connections.map((connection, index) => {
    const path = paths[index] || first[index], { edge, bundle } = connection;
    if (!path) {
      model.problems.push({ rule: 'unroutable', from: edge.from, to: edge.to });
      return null;
    }
    const tree = bundle ? `${bundle}.${path.tree ?? index}` : 0;
    return { edge, bundle, tree, points: simplify(path.points), out: path.startSide, in: path.goalSide };
  }).filter(Boolean);
  separateParallels(routes);
  placeLabels(router, routes);
  return routes;
}
