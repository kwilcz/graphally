// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The routed connections as SVG: each line in a group the next render and the edit command read
// back, and its label on top of everything.
import { S, T } from '../style.js';
import { fmt, openTag, svgElement, escapeXml, roundedPath } from '../svg.js';
import { toneOf } from '../shared/tokens.js';
import { SIDES } from '../route/geometry.js';
import { haloAt } from './colors.js';
import { flowMarks } from './motion.js';
import { hopsOf } from './hops.js';
import { lineEnds, lineWidth, routeRoom, tuckedPoints } from './line-ends.js';

// The sides a line was routed by, and the sides the author fixed.
const sidesOf = (route, fixed) => ({
  'data-sides': route.out != null && route.in != null ? `${SIDES[route.out]},${SIDES[route.in]}` : null,
  'data-out': fixed.out != null ? SIDES[fixed.out] : null,
  'data-in': fixed.in != null ? SIDES[fixed.in] : null,
});

function lineOf(figure, route, markers, steps, hops) {
  const { edge } = route;
  const plainTone = edge.accent ? 'var(--woad)' : 'var(--ink)';
  const tone = edge.off ? 'var(--muted)' : figure.colorOf(toneOf(edge.color)) || plainTone;
  const width = lineWidth(edge), geometry = lineEnds(edge.ends, width, routeRoom(route.points, S.edge.radius));
  const path = roundedPath(tuckedPoints(route.points, geometry), S.edge.radius, hops, S.edge.hop);
  const line = svgElement('path', {
    d: path,
    style: `fill: none; stroke: ${tone}`,
    'stroke-width': width,
    ...markers.endAttributes(edge.ends, tone, geometry),
  });
  const delay = edge.step ? steps.delayOf(edge.step) : 0;
  const flow = edge.flow ? flowMarks(figure, path, route.points, tone, delay) : '';
  const group = openTag('g', {
    'data-edge': escapeXml(edge.key), ...sidesOf(route, edge.override || {}), 'data-step': edge.step || null,
  });
  return `${group}${line}${flow}</g>`;
}

function labelOf(figure, route) {
  const { edge, label } = route;
  const baseline = figure.measurer.baseline(label.y, label.h, T.edge);
  const halo = haloAt(figure.boxes, label.x + label.w / 2, label.y + label.h / 2);
  const tone = edge.off ? 'var(--muted)' : figure.lineLabel.color || 'var(--ink)';
  return svgElement('text', {
    'data-step': edge.step || null,
    class: T.edge,
    x: fmt(label.x),
    y: fmt(baseline),
    style: `${figure.lineLabel.font}fill: ${tone}; ${halo}`,
  }, escapeXml(label.text));
}

export function drawRoutes(figure, routes, markers, steps) {
  const hops = hopsOf(routes);
  return {
    lines: routes.map((route, index) => lineOf(figure, route, markers, steps, hops[index])),
    labels: routes.filter(route => route.label).map(route => labelOf(figure, route)),
  };
}
