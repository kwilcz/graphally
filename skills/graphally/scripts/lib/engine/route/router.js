// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What every stage of the router asks of the boxes: which are obstacles and containers, what is
// just outside a side, and which ports an end may use.
import { S } from '../style.js';
import { CONTAINER_MARGIN, SIDE_CHANGED, endLengthFor } from './costs.js';
import { SIDES, inflate } from './geometry.js';
import { portsOf } from './ports.js';

// The override of each end: out at the source, in at the target.
export const DIRECTION = { source: 'out', target: 'in' };

const strictlyInside = ({ x, y }, o) => x > o.x + 0.01 && x < o.x + o.w - 0.01
  && y > o.y + 0.01 && y < o.y + o.h - 0.01;
const inside = ({ x, y }, o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h;

// Lanes are rows to cross, not containers to avoid.
function containersOf(geometry) {
  return [...geometry.groups.entries()]
    .filter(([, rect]) => !rect.lane)
    .map(([id, rect]) => ({ id, ...rect, depth: rect.group.depth }));
}

// The nodes with their clearance, and text that sits in no node.
function obstaclesOf(geometry, clearance) {
  const nodes = [...geometry.nodes].filter(([, rect]) => !rect.virtual);
  return [
    ...nodes.map(([id, rect]) => ({ id, ...inflate(rect, clearance), node: true })),
    ...(geometry.extraObstacles || []).map(text => ({ ...inflate(text, 4), id: text.id })),
  ];
}

export class Router {
  constructor(model, geometry, measurer) {
    this.model = model;
    this.geometry = geometry;
    this.measurer = measurer;
    this.clearance = geometry.nodePad ?? S.edge.nodePad;
    this.endLength = endLengthFor(this.clearance);
    this.containers = containersOf(geometry);
    this.containerIndex = new Map(this.containers.map((container, index) => [container.id, index]));
    this.obstacles = obstaclesOf(geometry, this.clearance);
    this.warned = new Set();
  }

  rectOf(id) { return this.geometry.nodes.get(id) || this.geometry.groups.get(id); }

  // The point just outside a side, at a coordinate along it.
  outsidePoint(id, side, along) {
    const rect = this.rectOf(id), out = this.model.groups.has(id) ? CONTAINER_MARGIN : this.clearance;
    const x = side === 0 ? rect.x + rect.w + out : side === 2 ? rect.x - out : along;
    const y = side === 1 ? rect.y + rect.h + out : side === 3 ? rect.y - out : along;
    return { x, y };
  }

  // Is the point just outside a side at a coordinate free? Tested exactly, not on the grid.
  sideFree(id, side, along) {
    const point = this.outsidePoint(id, side, along);
    return !this.obstacles.some(o => strictlyInside(point, o));
  }

  // What stands just outside the middle of a side, for the problem that reports the side blocked.
  blockerOf(id, side) {
    const rect = this.rectOf(id), middle = side % 2 === 0 ? rect.y + rect.h / 2 : rect.x + rect.w / 2;
    const point = this.outsidePoint(id, side, middle);
    const blocker = this.obstacles.find(o => o.id !== id && inside(point, o));
    return blocker ? { by: blocker.id } : {};
  }

  // The containers a box sits in, by index.
  containersAround(id) {
    const { model, containerIndex } = this, around = new Set();
    for (let item = model.nodes.get(id) || model.groups.get(id); item; item = item.parent) {
      if (containerIndex.has(item.id)) around.add(containerIndex.get(item.id));
    }
    return around;
  }

  // An end's ports on the grid, as the author's override and the previous render allow.
  freePorts(connection, which, grid) {
    const ports = portsOf(connection, which, grid, this.clearance);
    const fixedSide = connection.edge.override?.[DIRECTION[which]];
    return fixedSide == null
      ? this.preferPrevious(connection, which, ports)
      : this.onFixedSide(connection, which, ports, fixedSide);
  }

  // An override fixes the side (hard): only ports there. If that side is blocked, all ports stay
  // and the override is reported, once.
  onFixedSide(connection, which, ports, side) {
    const onSide = ports.filter(port => port.side === side);
    if (!onSide.length) this.warnBlocked(connection, which, side);
    return onSide.length ? onSide : ports;
  }

  warnBlocked(connection, which, side) {
    const { key } = connection.edge, direction = DIRECTION[which], warning = `${key}|${direction}`;
    if (this.warned.has(warning)) return;
    this.warned.add(warning);
    const blocker = this.blockerOf(connection[which].id, side);
    this.model.problems.push({ rule: 'override-ignored', id: key, attr: direction, why: 'side blocked', ...blocker });
  }

  // Without an override, the side the previous render used is preferred (soft): the ports of
  // every other side cost more.
  preferPrevious(connection, which, ports) {
    const previous = SIDES.indexOf(this.model.previous?.edges?.[connection.edge.key]?.[DIRECTION[which]]);
    if (previous < 0) return ports;
    for (const port of ports.filter(each => each.side !== previous)) port.penalty = (port.penalty || 0) + SIDE_CHANGED;
    return ports;
  }
}
