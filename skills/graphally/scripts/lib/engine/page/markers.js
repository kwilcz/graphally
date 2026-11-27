// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Line ends: the head at a line's end and the tail at its start, drawn as SVG markers.
import { svgElement } from '../svg.js';
import { DASH_PATTERN } from '../css/box.js';

const ENDS = ['arrow', 'open', 'circle', 'dot', 'diamond', 'open-diamond', 'slash', 'none'];

// message: a BPMN message flow (dashed, an open circle at the source, an open arrowhead).
// arrowDefault: whether the line has a head unless told.
function headOf(options, arrowDefault) {
  if (options.head != null) return options.head;
  if (options.message) return 'open';
  if (options.arrow === false) return 'none';
  return options.arrow || arrowDefault ? 'arrow' : 'none';
}

// BPMN (2.0.2, 10.5.1): a default flow starts with a slash, a conditional one with an open diamond.
function tailOf(options, head) {
  if (options.tail != null) return options.tail;
  if (options.message) return 'circle';
  if (options.default) return 'slash';
  if (options.conditional) return 'open-diamond';
  return options.both ? head : 'none';
}

function dashOf(options) {
  if (options.message || options.dashed || options.async) return DASH_PATTERN.dashed;
  return options.dotted ? DASH_PATTERN.dotted : '';
}

// The head, tail and dash of a line, from its options.
export function endsOf(options, arrowDefault, problems) {
  const head = headOf(options, arrowDefault), tail = tailOf(options, head);
  for (const end of [head, tail]) {
    if (ENDS.includes(end)) continue;
    problems.push({ rule: 'bad-option', option: 'head/tail', value: end, hint: ENDS.join(', ') });
  }
  return {
    head: ENDS.includes(head) ? head : 'arrow',
    tail: ENDS.includes(tail) ? tail : 'none',
    dash: dashOf(options),
  };
}

// Each end's marker: where it sits on the line's end (refX), and its drawing in a colour.
const MARKER = {
  arrow: [9, color => svgElement('path', { d: 'M0,0 L10,5 L0,10 z', style: `fill: ${color}` })],
  open: [9, color => svgElement('path', {
    d: 'M1,1 L9,5 L1,9', style: `fill: none; stroke: ${color}`,
    'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  })],
  circle: [9, color => svgElement('circle', {
    cx: 5, cy: 5, r: 3.7, style: `fill: var(--card); stroke: ${color}`, 'stroke-width': 1.3,
  })],
  dot: [8.5, color => svgElement('circle', { cx: 5, cy: 5, r: 3.3, style: `fill: ${color}` })],
  diamond: [10, color => svgElement('path', { d: 'M0,5 L5,1.5 L10,5 L5,8.5 z', style: `fill: ${color}` })],
  'open-diamond': [10, color => svgElement('path', {
    d: 'M0.6,5 L5,1.9 L9.4,5 L5,8.1 z', style: `fill: var(--card); stroke: ${color}`, 'stroke-width': 1.2,
  })],
  slash: [10, color => svgElement('path', {
    d: 'M0.8,8.8 L6.8,1.2', style: `fill: none; stroke: ${color}`,
    'stroke-width': 1.4, 'stroke-linecap': 'round',
  })],
};

// Where a marker sits on its line's end. A thick line stops `tuck` before its arrowhead's tip
// (line-ends.js), so that head is placed ahead of the line's end by as much.
const refOf = (kind, { size, tuck }) => (tuck ? Math.round((10 - (10 * tuck) / size) * 100) / 100 : MARKER[kind][0]);

// The figure's markers: one per kind, colour, size and tuck, numbered as they are first used.
export function createMarkers(figureId) {
  const markers = new Map();
  const markerId = (kind, color, end) => {
    const key = `${kind}|${color}|${end.size}|${end.tuck}`;
    if (!markers.has(key)) markers.set(key, { id: `${figureId}-m${markers.size}`, kind, color, end });
    return markers.get(key).id;
  };
  return {
    // A line's dash and its marker-end and marker-start, as attributes; geometry: its ends' sizes
    // and tucks (line-ends.js).
    endAttributes: (ends, color, geometry) => ({
      'stroke-dasharray': ends.dash || null,
      'marker-end': ends.head !== 'none' && `url(#${markerId(ends.head, color, geometry.end)})`,
      'marker-start': ends.tail !== 'none' && `url(#${markerId(ends.tail, color, geometry.start)})`,
    }),
    defs: () => [...markers.values()].map(({ id, kind, color, end }) => svgElement('marker', {
      id, viewBox: '0 0 10 10', refX: refOf(kind, end), refY: 5, markerUnits: 'userSpaceOnUse',
      markerWidth: end.size, markerHeight: end.size, orient: 'auto-start-reverse',
    }, MARKER[kind][1](color))),
  };
}
