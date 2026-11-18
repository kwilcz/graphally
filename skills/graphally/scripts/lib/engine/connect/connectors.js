// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The script's connections, routed by route.js round the page's boxes.
import { routeEdges } from '../route/route.js';
import { endsOf } from '../page/markers.js';
import { pageModel } from './page-model.js';

// The sides of a box, as route.js numbers them.
export const SIDES = ['right', 'bottom', 'left', 'top'];

// The sides a line leaves and enters by, where the author fixed them, as route.js's numbers.
function sidesFixed(options, problems) {
  for (const end of ['out', 'in']) {
    if (options[end] == null || SIDES.includes(options[end])) continue;
    problems.push({
      rule: 'bad-option', option: end, value: String(options[end]),
      hint: 'a side: top, right, bottom or left',
    });
  }
  const fixed = ['out', 'in'].filter(end => SIDES.includes(options[end]));
  return Object.fromEntries(fixed.map(end => [end, SIDES.indexOf(options[end])]));
}

// The step an element appears in: its own, or that of the stepped box it sits in.
const stepIn = element => Number(element.closest('[data-step]')?.getAttribute('data-step')) || 0;

// A connection as a route.js edge between the boxes named from and to.
function edgeOf(call, index, from, to, key, problems) {
  const { options } = call;
  const override = sidesFixed(options, problems);
  // A line to or from a disabled part is disabled too: grey and dashed, like the part.
  const off = !!options.disabled || [call.from, call.to].some(element => element.closest('.disabled'));
  const ends = endsOf(options, true, problems);
  if (off && !ends.dash) ends.dash = '5 4';
  return {
    id: `e${index}`, key, from, to, label: options.label || '', ends, off,
    // A line appears with the later of its two ends.
    step: Math.max(stepIn(call.from), stepIn(call.to)),
    flow: !!options.flow, accent: !!options.accent, color: options.color, width: options.width,
    stmt: call.statement,
    ...(Object.keys(override).length ? { override } : {}),
  };
}

// via: each waypoint is a point the router passes through (it blocks nothing), and the line is
// routed leg by leg; joinLegs joins the legs again. The label goes on the middle leg.
function addLegs({ model, geometry, rootGroup }, edge, via) {
  const waypoints = via.map((point, index) => {
    const id = `${edge.key}~${index + 1}`, node = { id, kind: 'node', parent: rootGroup, shape: '' };
    model.nodes.set(id, node);
    const at = { x: Math.round(point.x), y: Math.round(point.y), w: 0, h: 0 };
    geometry.nodes.set(id, { ...at, node, round: true, virtual: true });
    return id;
  });
  const stops = [edge.from, ...waypoints, edge.to], count = stops.length - 1;
  const { override, ...shared } = edge;
  for (let index = 0; index < count; index++) {
    const fixed = {
      ...(index === 0 && override?.out != null ? { out: override.out } : {}),
      ...(index === count - 1 && override?.in != null ? { in: override.in } : {}),
    };
    model.edges.push({
      ...shared, id: `${edge.id}~${index}`, key: `${edge.key}~${index}`,
      from: stops[index], to: stops[index + 1],
      label: index === count >> 1 ? edge.label : '', stmt: 0, leg: { edge, index, count },
      ...(Object.keys(fixed).length ? { override: fixed } : {}),
    });
  }
}

// The legs of a line routed through waypoints, joined back into one route.
function joinLegs(routes) {
  const joined = [], legsOf = new Map();
  for (const route of routes) {
    const { leg } = route.edge;
    if (!leg) {
      joined.push(route);
      continue;
    }
    if (!legsOf.has(leg.edge)) legsOf.set(leg.edge, []);
    legsOf.get(leg.edge)[leg.index] = route;
  }
  for (const [edge, legs] of legsOf) {
    const routed = legs.filter(Boolean);
    if (routed.length !== routed[0].edge.leg.count) continue;   // a leg failed: reported as unroutable
    joined.push({
      edge,
      points: legs.flatMap((route, index) => (index ? route.points.slice(1) : route.points)),
      label: legs.find(route => route.label)?.label,
      labelCrowded: legs.some(route => route.labelCrowded),
      out: legs[0].out,
      in: legs.at(-1).in,
    });
  }
  return joined;
}

export function routeConnections(figure, size) {
  const { boxes, texts, drawings, edges: calls, problems } = figure;
  if (!calls.length) return [];
  const { previous } = figure.options;
  const page = pageModel({ boxes, texts, drawings, calls, problems, previous, size });
  const boxOf = element => boxes.find(entry => entry.element === element);
  const repeats = new Map();
  calls.forEach((call, index) => {
    const fromBox = boxOf(call.from), toBox = boxOf(call.to);
    if (!fromBox || !toBox) {
      const missing = fromBox ? call.to : call.from;
      problems.push({ rule: 'unknown-id', id: missing.id || '(element without id)' });
      return;
    }
    const from = page.keyOf.get(fromBox), to = page.keyOf.get(toBox);
    // A second line between the same boxes is told apart by its number: a->b#2.
    const base = call.options.id || `${from}->${to}`, repeat = (repeats.get(base) || 0) + 1;
    repeats.set(base, repeat);
    const edge = edgeOf(call, index, from, to, repeat > 1 ? `${base}#${repeat}` : base, problems);
    if (call.via.length) addLegs(page, edge, call.via);
    else page.model.edges.push(edge);
  });
  return joinLegs(routeEdges(page.model, page.geometry, figure.measurer));
}

// For --debug: the routes and the router's log, on the page for the CLI to read.
export function exposeRoutes(routes) {
  window.__debug = {
    log: globalThis.__routeLog,
    hard: globalThis.__routeHard,
    routes: routes.map(route => ({
      from: route.edge.from, to: route.edge.to,
      points: route.points.map(point => [Math.round(point.x), Math.round(point.y)]),
    })),
  };
}
