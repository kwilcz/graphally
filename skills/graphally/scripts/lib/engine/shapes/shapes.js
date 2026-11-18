// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Shapes: <div shape="cylinder">, <i shape="gateway parallel">, and the script's shape(). A shape
// is a base and optional markers. The base is a path over the element's box (bases.js); the
// browser lays the element out as a box, and its background and border become the shape's fill
// and outline. Markers are drawn inside (markers.js): a gateway's ×, an event's clock or
// envelope, a task's loop.
import { fmt, svgElement } from '../svg.js';
import { BASES, ALIASES } from './bases.js';
import { markersOf } from './markers.js';

const SHAPE_NAMES = [...Object.keys(BASES), ...Object.keys(ALIASES)];
const MARKS = [
  'exclusive', 'parallel', 'inclusive', 'complex', 'event-based', 'start', 'timer', 'message',
  'signal', 'error', 'terminate', 'loop', 'multi', 'sequential', 'ad-hoc', 'transaction', 'collection',
  'input', 'output', 'subprocess', 'user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule',
  'escalation', 'conditional', 'link', 'compensation', 'cancel', 'multiple', 'parallel-multiple', 'throw',
  'non-interrupting',
];

// "gateway parallel" -> { base: 'gateway', marks: ['parallel'], round }, or { error, options }
// for a word that is not a shape or a marker.
export function parseShape(text) {
  const words = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const name = ALIASES[words[0]] || words[0];
  if (!BASES[name]) return { error: words[0] || '(empty)', options: SHAPE_NAMES };
  const marks = words.slice(1), unknown = marks.find(mark => !MARKS.includes(mark));
  if (unknown) return { error: unknown, options: MARKS };
  return { base: name, marks: [...(BASES[name].marks || []), ...marks], round: !!BASES[name].round };
}

// SVG for one shape over a box. style: { fill, stroke, width, dash } as CSS values ('none' for
// no fill or outline). The outline sits inside the box, as a CSS border does.
export function drawShape(spec, box, style) {
  const base = BASES[spec.base], inset = style.stroke === 'none' ? 0 : style.width / 2;
  // A non-interrupting event (BPMN 2.0.2, Table 10.93) has dashed rings.
  const broken = base.event && spec.marks.includes('non-interrupting');
  if (broken) style = { ...style, dash: '4 2.6' };
  if (base.dash) style = { ...style, dash: base.dash };
  const inner = {
    x: box.x + inset, y: box.y + inset, w: Math.max(0, box.w - 2 * inset), h: Math.max(0, box.h - 2 * inset),
  };
  const ink = style.stroke === 'none' ? 'var(--ink)' : style.stroke;
  const paint = (d, fill = style.fill) => svgElement('path', {
    d, style: `fill: ${fill}; stroke: ${style.stroke}`,
    'stroke-width': fmt(style.width), 'stroke-dasharray': style.dash || null,
  });
  const line = (d, width = 1.5, fill = 'none', extra = {}) => svgElement('path', {
    d, style: `fill: ${fill}; stroke: ${ink}`, 'stroke-width': fmt(width),
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra,
  });
  return [
    ...(base.under?.(inner) || []).map(d => paint(d)),
    paint(base.path(inner), base.open ? 'none' : style.fill),
    ...(base.lines?.(inner) || []).map(d => line(d, Math.max(1, style.width || 1.5))),
    ...markersOf({ base, spec, box, inset, style, ink, line, broken }),
  ];
}
