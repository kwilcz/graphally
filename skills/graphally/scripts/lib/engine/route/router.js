// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What every stage of the router reads: the boxes as obstacles and containers, and what may be
// asked of them.
import { S } from '../style.js';
import { CONTAINER_MARGIN, SIDE_CHANGED, endLengthFor } from './costs.js';
import { SIDES, inflate } from './geometry.js';
import { portsOf } from './ports.js';

// The override of each end: out at the source, in at the target.
export const DIRECTION = { source: 'out', target: 'in' };

export function createRouter(model, geometry, measurer) {
  const clearance = geometry.nodePad ?? S.edge.nodePad;
  // Lanes are rows to cross, not containers to avoid.
  const containers = [...geometry.groups.entries()]
    .filter(([, rect]) => !rect.lane)
    .map(([id, rect]) => ({ id, ...rect, depth: rect.group.depth }));
  const containerIndex = new Map(containers.map((container, index) => [container.id, index]));
  // Obstacles: the nodes with their clearance, and text that sits in no node.
  const obstacles = [];
  for (const [id, rect] of geometry.nodes) {
    if (!rect.virtual) obstacles.push({ id, ...inflate(rect, clearance), node: true });
  }
  for (const text of geometry.extraObstacles || []) obstacles.push({ ...inflate(text, 4), id: text.id });

  const rectOf = id => geometry.nodes.get(id) || geometry.groups.get(id);
  // The point just outside a side, at a coordinate along it.
  const outsidePoint = (id, side, along) => {
    const rect = rectOf(id), out = model.groups.has(id) ? CONTAINER_MARGIN : clearance;
    const x = side === 0 ? rect.x + rect.w + out : side === 2 ? rect.x - out : along;
    const y = side === 1 ? rect.y + rect.h + out : side === 3 ? rect.y - out : along;
    return { x, y };
  };
  // Is the point just outside this side at a coordinate free? Tested exactly, not on the grid.
  const sideFree = (id, side, along) => {
    const { x, y } = outsidePoint(id, side, along);
    const inside = o => x > o.x + 0.01 && x < o.x + o.w - 0.01 && y > o.y + 0.01 && y < o.y + o.h - 0.01;
    return !obstacles.some(inside);
  };
  // What stands just outside the middle of a side, for the problem that reports the side blocked.
  const blockerOf = (id, side) => {
    const rect = rectOf(id);
    const { x, y } = outsidePoint(id, side, side % 2 === 0 ? rect.y + rect.h / 2 : rect.x + rect.w / 2);
    const blocker = obstacles.find(o => o.id !== id && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
    return blocker ? { by: blocker.id } : {};
  };
  // The containers a box sits in, by index.
  const containersAround = id => {
    const around = new Set();
    for (let item = model.nodes.get(id) || model.groups.get(id); item; item = item.parent) {
      if (containerIndex.has(item.id)) around.add(containerIndex.get(item.id));
    }
    return around;
  };
  // The ports an end may use, given the author's override and the previous render. An override
  // fixes the side (hard): only ports there; if that side is blocked, all ports stay and the
  // override is reported once. Without one, the side the previous render used is preferred
  // (soft): the ports of every other side cost more.
  const warned = new Set();
  const endPorts = (connection, which, ports) => {
    const { edge } = connection, direction = DIRECTION[which], fixedSide = edge.override?.[direction];
    if (fixedSide != null) {
      const onSide = ports.filter(port => port.side === fixedSide), warning = `${edge.key}|${direction}`;
      if (!onSide.length && !warned.has(warning)) {
        warned.add(warning);
        model.problems.push({
          rule: 'override-ignored', id: edge.key, attr: direction, why: 'side blocked',
          ...blockerOf(connection[which].id, fixedSide),
        });
      }
      return onSide.length ? onSide : ports;
    }
    const previousSide = SIDES.indexOf(model.previous?.edges?.[edge.key]?.[direction]);
    if (previousSide >= 0) {
      for (const port of ports) {
        if (port.side !== previousSide) port.penalty = (port.penalty || 0) + SIDE_CHANGED;
      }
    }
    return ports;
  };
  // An end's ports on the grid, as the override and the previous render allow.
  const freePorts = (connection, which, grid) =>
    endPorts(connection, which, portsOf(connection, which, grid, clearance));
  return {
    model, geometry, measurer, clearance, endLength: endLengthFor(clearance),
    containers, obstacles, rectOf, sideFree, containersAround, endPorts, freePorts,
  };
}
