// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Orthogonal routing around boxes: A* over a sparse grid (grid.js, search.js). Two passes: the
// first chooses which side of each box a line uses; then lines that share a side spread along it
// (spread.js), and the second routes again with fixed ports, a bundle as one tree (trees.js).
// Then parallel runs are moved apart (separate.js) and labels are placed where they collide with
// nothing (labels.js).
import { listAt } from '../shared/maps.js';
import { TRUNK, SIDE_TAKEN, marksOf } from './costs.js';
import { sharedSpan, simplify, spanOf } from './geometry.js';
import { Router } from './router.js';
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
  const { model } = router, { bundleOf, fansIn } = bundlesOf(model.edges);
  const endOf = id => ({ id, rect: router.rectOf(id), isGroup: model.groups.has(id) });
  const isRoutable = edge => edge.from !== edge.to && router.rectOf(edge.from) && router.rectOf(edge.to);
  const routable = model.edges.filter(isRoutable);
  const connections = routable.map(edge => ({
    edge, bundle: bundleOf(edge), fanIn: fansIn(edge), marks: marksOf(edge),
    source: endOf(edge.from), target: endOf(edge.to),
    allowed: new Set([...router.containersAround(edge.from), ...router.containersAround(edge.to)]),
  }));
  return connections.sort((a, b) => spanOf(a) - spanOf(b));
}

const addLines = (lines, xs, ys) => {
  xs.forEach(x => lines.x.add(x));
  ys.forEach(y => lines.y.add(y));
};

// Grid lines of the first pass: through every box's centre, where a full-length end would turn,
// and through the middle of the stretch each line's two boxes share.
function firstPassLines({ geometry, endLength }, connections) {
  const lines = { x: new Set(), y: new Set() }, rects = [...geometry.nodes.values(), ...geometry.groups.values()];
  for (const rect of rects) addLines(lines, [rect.x + rect.w / 2], [rect.y + rect.h / 2]);
  const real = endLength ? rects.filter(rect => !rect.virtual) : [];
  for (const rect of real) {
    const xs = [rect.x - endLength, rect.x + rect.w + endLength];
    const ys = [rect.y - endLength, rect.y + rect.h + endLength];
    addLines(lines, xs, ys);
  }
  for (const { source: { rect: a }, target: { rect: b } } of connections) {
    const acrossY = sharedSpan(a.y, a.h, b.y, b.h), acrossX = sharedSpan(a.x, a.w, b.x, b.w);
    addLines(lines, acrossX ? [acrossX.mid] : [], acrossY ? [acrossY.mid] : []);
  }
  return lines;
}

// A circle or diamond has one attachment point per side: a side already in use costs more.
class SideUse {
  constructor() { this.uses = new Map(); }

  count(id, side, direction) {
    return (this.uses.get(`${id}|${side}`) || []).filter(used => !direction || used === direction).length;
  }

  penalize(end, ports, direction) {
    if (!end.rect.round) return;
    for (const port of ports) {
      port.penalty = (port.penalty || 0) + SIDE_TAKEN * this.count(end.id, port.side, direction);
    }
  }

  record({ source, target }, path) {
    listAt(this.uses, `${source.id}|${path.startSide}`).push('out');
    listAt(this.uses, `${target.id}|${path.goalSide}`).push('in');
  }
}

function logFirstRoute(grid, { source, target }, starts, goals, path) {
  if (!globalThis.__routeDebug) return;
  const at = port => [port.side, grid.xs[port.i], grid.ys[port.j]];
  const chose = path && [path.startSide, path.goalSide, Math.round(path.cost)];
  (globalThis.__routeLog ||= []).push({
    e: `${source.id}->${target.id}`, starts: starts.map(at), goals: goals.map(at), chose,
  });
}

function routeFirst(router, grid, connection, sideUse) {
  const starts = router.freePorts(connection, 'source', grid), goals = router.freePorts(connection, 'target', grid);
  sideUse.penalize(connection.source, starts);
  sideUse.penalize(connection.target, goals, 'out');
  const path = astar(grid, starts, goals, connection);
  logFirstRoute(grid, connection, starts, goals, path);
  if (path) {
    markUse(grid, path.cells, 1, connection.bundle);
    sideUse.record(connection, path);
  }
  return path;
}

// The first pass: every line with free ports, in turn.
function firstPass(router, connections, grid) {
  const sideUse = new SideUse();
  return connections.map(connection => routeFirst(router, grid, connection, sideUse));
}

// A bundle's lines merge and split away from its boxes: an end with a mark (the one arrowhead of
// a fan-in, each arrowhead of a fan-out) gets a grid line a full trunk's length out.
const hasTrunkRoom = (connection, which) => connection.bundle && connection.marks[which === 'target' ? 'head' : 'tail'];

function trunkLine(rect, side) {
  if (side === 0) return ['x', rect.x + rect.w + TRUNK];
  if (side === 2) return ['x', rect.x - TRUNK];
  return side === 1 ? ['y', rect.y + rect.h + TRUNK] : ['y', rect.y - TRUNK];
}

// Two trunks a few pixels apart would be drawn side by side: the later one is left out, and its
// port snaps to the first.
function addTrunkLines(connections, fixed, lines) {
  const trunks = { x: [], y: [] };
  const addTrunk = ([axis, value]) => {
    if (trunks[axis].some(other => Math.abs(other - value) < 12)) return;
    trunks[axis].push(value);
    lines[axis].add(value);
  };
  connections.forEach((connection, index) => {
    for (const which of ['source', 'target']) {
      const port = fixed[index][which];
      if (port && hasTrunkRoom(connection, which)) addTrunk(trunkLine(connection[which].rect, port.side));
    }
  });
}

function addFixedPortLines(fixed, lines) {
  const ports = fixed.flatMap(({ source, target }) => [source, target]).filter(Boolean);
  for (const port of ports) (port.side % 2 === 0 ? lines.y : lines.x).add(port.coord);
}

// A connection's ports in the second pass: at its fixed places, else as free as before.
function fixedPortsOf(router, grid, connection, fixed) {
  const portsAt = which => {
    const port = fixed[which];
    if (!port) return router.freePorts(connection, which, grid);
    const longer = hasTrunkRoom(connection, which) ? TRUNK : 0;
    return [portAt(connection[which], port.side, port.coord, grid, router.clearance, longer)];
  };
  return [portsAt('source').filter(Boolean), portsAt('target').filter(Boolean)];
}

// The second pass, on a grid with lines through the fixed ports and the trunks.
function secondPass(router, connections, fixed, lines) {
  addFixedPortLines(fixed, lines);
  addTrunkLines(connections, fixed, lines);
  const grid = buildGrid(router, lines.x, lines.y);
  const portsFor = index => fixedPortsOf(router, grid, connections[index], fixed[index]);
  const paths = routeTrees(grid, connections, portsFor);
  ripUpAndReroute(grid, connections, paths, portsFor);
  return paths;
}

function routeOf(model, connection, path, index) {
  const { edge, bundle } = connection;
  if (!path) {
    model.problems.push({ rule: 'unroutable', from: edge.from, to: edge.to });
    return null;
  }
  const tree = bundle ? `${bundle}.${path.tree ?? index}` : 0;
  return { edge, bundle, tree, points: simplify(path.points), out: path.startSide, in: path.goalSide };
}

function exposeObstacles(router) {
  if (!globalThis.__routeDebug) return;
  globalThis.__routeHard = router.obstacles.map(o => [o.id, ...[o.x, o.y, o.w, o.h].map(Math.round)]);
}

export function routeEdges(model, geometry, measurer) {
  const router = new Router(model, geometry, measurer);
  const connections = connectionsOf(router), lines = firstPassLines(router, connections);
  const grid = buildGrid(router, lines.x, lines.y);
  exposeObstacles(router);
  const first = firstPass(router, connections, grid);
  alignBundleSides(router, connections, first, grid);
  const fixed = spreadPorts(router, connections, first);
  const paths = secondPass(router, connections, fixed, lines);
  const routes = connections
    .map((connection, index) => routeOf(model, connection, paths[index] || first[index], index))
    .filter(Boolean);
  separateParallels(routes);
  placeLabels(router, routes);
  return routes;
}
