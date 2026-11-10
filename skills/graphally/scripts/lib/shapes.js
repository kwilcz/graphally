// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Shapes: <div shape="cylinder">, <i shape="gateway parallel">, and the
// script's shape(). A shape is a base and optional markers. The base is a path over the
// element's box; the browser lays the element out as a box, and the element's background
// and border become the shape's fill and outline. Markers are drawn inside: a gateway's ×,
// an event's clock or envelope, a task's loop. BPMN conventions: a thin circle starts, a thick
// one ends, a double one is an intermediate event.

const f = n => String(Math.round(n * 10) / 10);
const poly = pts => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')} Z`;
// Two half arcs. The radius is half the rounded chord, never rounded on its own: a radius a
// hair longer than half the chord turns each large arc past a half and draws an oval.
const half = (a, b) => String(Math.round((Number(b) - Number(a)) * 50) / 100);
const circle = (cx, cy, r) => { const a = f(cx - r), b = f(cx + r), y = f(cy), q = half(a, b); return `M${a},${y} A${q},${q} 0 1 1 ${b},${y} A${q},${q} 0 1 1 ${a},${y} Z`; };

// Block arrows: drawn along u (length) and v (width), then turned to their direction.
const arrow = dir => ({ x, y, w, h }) => {
  const along = dir === 'up' || dir === 'down', len = along ? h : w, wid = along ? w : h;
  // Upright arrows hold their text across the shaft: a wider shaft, a shorter head.
  const t = wid * (along ? 0.64 : 0.5), head = Math.min(wid * (along ? 0.5 : 0.9), len * (along ? 0.38 : 0.45)), a = (wid - t) / 2;
  const pts = [[0, a], [len - head, a], [len - head, 0], [len, wid / 2], [len - head, wid], [len - head, a + t], [0, a + t]];
  const map = ([u, v]) => (dir === 'right' ? [x + u, y + v] : dir === 'left' ? [x + len - u, y + v] : dir === 'down' ? [x + v, y + u] : [x + v, y + len - u]);
  return poly(pts.map(map));
};
const stadium = ({ x, y, w, h }) => {
  const r = Math.min(w, h) / 2;
  return w >= h
    ? `M${f(x + r)},${f(y)} H${f(x + w - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)} Z`
    : `M${f(x)},${f(y + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h - r)} A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)} Z`;
};
const roundRect = ({ x, y, w, h }, r) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)},${f(y)} H${f(x + w - r)} Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + r)} V${f(y + h - r)} Q${f(x + w)},${f(y + h)} ${f(x + w - r)},${f(y + h)} H${f(x + r)} Q${f(x)},${f(y + h)} ${f(x)},${f(y + h - r)} V${f(y + r)} Q${f(x)},${f(y)} ${f(x + r)},${f(y)} Z`;
};
const doc = ({ x, y, w, h }) => {
  const a = Math.min(h * 0.12, 10);
  return `M${f(x)},${f(y)} H${f(x + w)} V${f(y + h - a)} C${f(x + w * 0.75)},${f(y + h - 3 * a)} ${f(x + w * 0.25)},${f(y + h + a)} ${f(x)},${f(y + h - a)} Z`;
};
const ry = ({ w, h }) => Math.min(h * 0.12, w * 0.2, 10);
const fold = ({ w, h }) => Math.min(14, w * 0.25, h * 0.3);

// path(box) -> d. under(box) -> paths drawn behind, in the same fill. lines(box) -> strokes
// over the fill (a cylinder's rim). round: lines meet it at the middle of a side.
const BASES = {
  rect: { path: b => roundRect(b, 0) },
  rounded: { path: b => roundRect(b, 10) },
  stadium: { path: stadium },
  ellipse: { path: ({ x, y, w, h }) => { const a = f(x), b = f(x + w), q = half(a, b), m = f(y + h / 2); return `M${a},${m} A${q},${f(h / 2)} 0 1 1 ${b},${m} A${q},${f(h / 2)} 0 1 1 ${a},${m} Z`; }, round: true },
  circle: { path: ({ x, y, w, h }) => circle(x + w / 2, y + h / 2, Math.min(w, h) / 2), round: true },
  // The top half of an ellipse filling the box: a box twice as wide as it is high is a half disc.
  semicircle: { path: ({ x, y, w, h }) => `M${f(x)},${f(y + h)} A${f(w / 2)},${f(h)} 0 0 1 ${f(x + w)},${f(y + h)} Z` },
  diamond: { path: ({ x, y, w, h }) => poly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]), round: true },
  hexagon: { path: ({ x, y, w, h }) => { const k = Math.min(h * 0.29, w / 4); return poly([[x + k, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x + k, y + h], [x, y + h / 2]]); } },
  triangle: { path: ({ x, y, w, h }) => poly([[x + w / 2, y], [x + w, y + h], [x, y + h]]) },
  parallelogram: { path: ({ x, y, w, h }) => { const k = Math.min(h * 0.35, w / 4); return poly([[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]]); } },
  trapezoid: { path: ({ x, y, w, h }) => { const k = Math.min(h * 0.35, w / 4); return poly([[x + k, y], [x + w - k, y], [x + w, y + h], [x, y + h]]); } },
  chevron: { path: ({ x, y, w, h }) => { const k = Math.min(h / 2, w / 4, 20); return poly([[x, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x, y + h], [x + k, y + h / 2]]); } },
  'chevron-start': { path: ({ x, y, w, h }) => { const k = Math.min(h / 2, w / 4, 20); return poly([[x, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x, y + h]]); } },
  'arrow-right': { path: arrow('right') }, 'arrow-left': { path: arrow('left') },
  'arrow-up': { path: arrow('up') }, 'arrow-down': { path: arrow('down') },
  cylinder: {
    path: b => { const { x, y, w, h } = b, r = ry(b); return `M${f(x)},${f(y + r)} A${f(w / 2)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h - r)} A${f(w / 2)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)} Z`; },
    lines: b => { const { x, y, w } = b, r = ry(b); return [`M${f(x)},${f(y + r)} A${f(w / 2)},${f(r)} 0 0 0 ${f(x + w)},${f(y + r)}`]; },
  },
  'cylinder-h': {
    path: b => { const { x, y, w, h } = b, r = Math.min(w * 0.12, h * 0.2, 10); return `M${f(x + r)},${f(y)} H${f(x + w - r)} A${f(r)},${f(h / 2)} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x + r)} A${f(r)},${f(h / 2)} 0 0 1 ${f(x + r)},${f(y)} Z`; },
    lines: b => { const { x, y, w, h } = b, r = Math.min(w * 0.12, h * 0.2, 10); return [`M${f(x + w - r)},${f(y)} A${f(r)},${f(h / 2)} 0 0 0 ${f(x + w - r)},${f(y + h)}`]; },
  },
  document: { path: doc },
  documents: {
    path: ({ x, y, w, h }) => doc({ x, y: y + 8, w: w - 8, h: h - 8 }),
    under: ({ x, y, w, h }) => [doc({ x: x + 8, y, w: w - 8, h: h - 8 }), doc({ x: x + 4, y: y + 4, w: w - 8, h: h - 8 })],
  },
  note: {
    path: b => { const { x, y, w, h } = b, k = fold(b); return poly([[x, y], [x + w - k, y], [x + w, y + k], [x + w, y + h], [x, y + h]]); },
    lines: b => { const { x, y, w } = b, k = fold(b); return [`M${f(x + w - k)},${f(y)} V${f(y + k)} H${f(x + w)}`]; },
  },
  callout: {
    path: ({ x, y, w, h }) => {
      const t = Math.min(14, h * 0.25), bh = h - t, r = Math.min(8, bh / 2);
      return `M${f(x + r)},${f(y)} H${f(x + w - r)} Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + r)} V${f(y + bh - r)} Q${f(x + w)},${f(y + bh)} ${f(x + w - r)},${f(y + bh)} H${f(x + w * 0.34)} L${f(x + w * 0.14)},${f(y + h)} L${f(x + w * 0.2)},${f(y + bh)} H${f(x + r)} Q${f(x)},${f(y + bh)} ${f(x)},${f(y + bh - r)} V${f(y + r)} Q${f(x)},${f(y)} ${f(x + r)},${f(y)} Z`;
    },
  },
  cloud: {
    path: ({ x, y, w, h }) => {
      const p = (u, v) => `${f(x + u * w)},${f(y + v * h)}`;
      return `M${p(0.25, 0.88)} C${p(0.04, 0.88)} ${p(-0.01, 0.56)} ${p(0.17, 0.48)} C${p(0.12, 0.22)} ${p(0.36, 0.08)} ${p(0.5, 0.24)} C${p(0.58, 0.02)} ${p(0.9, 0.06)} ${p(0.85, 0.36)} C${p(1.03, 0.4)} ${p(1.03, 0.84)} ${p(0.8, 0.88)} Z`;
    },
  },
  'manual-input': { path: ({ x, y, w, h }) => poly([[x, y + h * 0.28], [x + w, y], [x + w, y + h], [x, y + h]]) },
  predefined: {
    path: b => roundRect(b, 0),
    lines: ({ x, y, w, h }) => { const k = Math.min(10, w / 10); return [`M${f(x + k)},${f(y)} V${f(y + h)} M${f(x + w - k)},${f(y)} V${f(y + h)}`]; },
  },
  delay: { path: ({ x, y, w, h }) => { const r = Math.min(h / 2, w / 2); return `M${f(x)},${f(y)} H${f(x + w - r)} A${f(r)},${f(h / 2)} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x)} Z`; } },
  'off-page': { path: ({ x, y, w, h }) => poly([[x, y], [x + w, y], [x + w, y + h * 0.68], [x + w / 2, y + h], [x, y + h * 0.68]]) },
  // BPMN
  task: { path: b => roundRect(b, 10) },
  subprocess: { path: b => roundRect(b, 10), marks: ['subprocess'] },
  start: { path: ({ x, y, w, h }) => circle(x + w / 2, y + h / 2, Math.min(w, h) / 2), round: true, event: 'start' },
  event: { path: ({ x, y, w, h }) => circle(x + w / 2, y + h / 2, Math.min(w, h) / 2), round: true, event: 'event' },
  end: { path: ({ x, y, w, h }) => circle(x + w / 2, y + h / 2, Math.min(w, h) / 2), round: true, event: 'end' },
  gateway: { path: ({ x, y, w, h }) => poly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]), round: true, gateway: true },
  // A repeat badge: a ring holding two arrows chasing each other round.
  // BPMN artifacts (10.7): a text annotation is an open bracket beside its text; a group is a
  // rounded box drawn dash-dot, a line style no other element uses.
  annotation: { path: ({ x, y, w, h }) => `M${f(x + Math.min(12, w))},${f(y)} H${f(x)} V${f(y + h)} H${f(x + Math.min(12, w))}`, open: true },
  group: { path: b => roundRect(b, 10), dash: '9 3 1.5 3' },
  cycle: { path: ({ x, y, w, h }) => circle(x + w / 2, y + h / 2, Math.min(w, h) / 2), round: true, cycle: true },
};
const ALIASES = {
  box: 'rect', process: 'rect', square: 'rect', pill: 'stadium', terminator: 'stadium', oval: 'ellipse',
  decision: 'diamond', rhombus: 'diamond', io: 'parallelogram', data: 'parallelogram',
  database: 'cylinder', db: 'cylinder', 'data-store': 'cylinder', queue: 'cylinder-h',
  'data-object': 'note', 'folded': 'note', subroutine: 'predefined', 'multi-document': 'documents',
  'start-event': 'start', 'end-event': 'end', 'intermediate': 'event', 'intermediate-event': 'event', activity: 'task',
  'sub-process': 'subprocess', arrow: 'arrow-right', step: 'chevron-start', repeat: 'cycle', refresh: 'cycle', loop: 'cycle',
};
const MARKS = ['exclusive', 'parallel', 'inclusive', 'complex', 'event-based', 'start', 'timer', 'message', 'signal', 'error', 'terminate', 'loop', 'multi', 'sequential', 'ad-hoc', 'transaction', 'subprocess', 'user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule',
  'escalation', 'conditional', 'link', 'compensation', 'cancel', 'multiple', 'parallel-multiple', 'throw', 'non-interrupting'];

// Glyphs: the markers inside events, gateways and tasks, each drawn once on a 16-unit grid
// centred on 8,8 and placed at any size, so an end event's envelope is the send task's. A
// part is [path, kind, stroke width in px]: 'line' is open, or filled on a filled marker;
// 'stroke' is never filled; 'ink' always is; 'open' and 'shut' appear only on an open or a
// filled marker, 'shut' drawn in the card colour to cut into the fill.
const ENVELOPE = 'M2,3.5 H14 A1,1 0 0 1 15,4.5 V11.5 A1,1 0 0 1 14,12.5 H2 A1,1 0 0 1 1,11.5 V4.5 A1,1 0 0 1 2,3.5 Z';
const GLYPH = {
  message: [[ENVELOPE, 'line', 1.2], ['M1.4,4.2 L8,9 L14.6,4.2', 'open', 1.2], ['M3,5.3 L8,9 L13,5.3', 'shut', 1.3]],
  timer: [['M0.38,8 A7.62,7.62 0 1 1 15.62,8 A7.62,7.62 0 1 1 0.38,8 Z', 'stroke', 1.3], ['M8,2.67 V8 L11.81,9.9', 'stroke', 1.3]],
  signal: [['M8,1.52 L14.48,12.57 L1.52,12.57 Z', 'line', 1.3]],
  error: [['M2.67,13.33 L5.71,2.67 L8.76,8.38 L13.33,2.67 L10.29,13.33 L7.24,7.62 Z', 'line', 1.3]],
  escalation: [['M8,1.14 L12.57,14.1 L8,9.9 L3.43,14.1 Z', 'line', 1.3]],
  conditional: [['M3.81,1.9 H12.19 V14.1 H3.81 Z', 'stroke', 1.2], ['M5.33,4.57 H10.67 M5.33,6.86 H10.67 M5.33,9.14 H10.67 M5.33,11.43 H10.67', 'stroke', 1]],
  link: [['M2.29,5.71 L8.38,5.71 L8.38,3.05 L14.1,8 L8.38,12.95 L8.38,10.29 L2.29,10.29 Z', 'line', 1.3]],
  compensation: [['M1.52,8 L7.62,3.81 L7.62,12.19 Z M7.62,8 L13.71,3.81 L13.71,12.19 Z', 'line', 1.3]],
  cancel: [['M10.96,3.21 L12.79,5.04 L9.83,8 L12.79,10.96 L10.96,12.79 L8,9.83 L5.04,12.79 L3.21,10.96 L6.17,8 L3.21,5.04 L5.04,3.21 L8,6.17 Z', 'line', 1.2]],
  multiple: [['M8,2.21 L13.94,6.53 L11.67,13.51 L4.33,13.51 L2.06,6.53 Z', 'line', 1.3]],
  'parallel-multiple': [['M6.1,2.06 H9.9 V6.1 H13.94 V9.9 H9.9 V13.94 H6.1 V9.9 H2.06 V6.1 H6.1 Z', 'line', 1.2]],
  terminate: [['M1.14,8 A6.86,6.86 0 1 1 14.86,8 A6.86,6.86 0 1 1 1.14,8 Z', 'ink', 1]],
  'gateway exclusive': [['M3.5,3.5 L12.5,12.5 M12.5,3.5 L3.5,12.5', 'stroke', 2.6]],
  'gateway parallel': [['M2.38,8 H13.62 M8,2.38 V13.62', 'stroke', 2.8]],
  'gateway inclusive': [['M2.83,8 A5.17,5.17 0 1 1 13.17,8 A5.17,5.17 0 1 1 2.83,8 Z', 'stroke', 2.4]],
  'ad-hoc': [['M1.5,9.5 C3.5,5.2 6,5.2 8,8 C10,10.8 12.5,10.8 14.5,6.5', 'stroke', 1.5]],
  'gateway complex': [['M2.38,8 H13.62 M8,2.38 V13.62 M3.95,3.95 L12.05,12.05 M12.05,3.95 L3.95,12.05', 'stroke', 2.6]],
  user: [['M4.8,5 A3.2,3.2 0 1 1 11.2,5 A3.2,3.2 0 1 1 4.8,5 Z', 'stroke', 1.2], ['M2,15 C2,10.5 4.5,9.2 8,9.2 C11.5,9.2 14,10.5 14,15 Z', 'stroke', 1.2]],
  service: [['M6.81,2.84 L6.86,0.79 A7.3,7.3 0 0 1 9.14,0.79 L9.19,2.84 A5.3,5.3 0 0 1 10.81,3.51 L12.29,2.09 A7.3,7.3 0 0 1 13.91,3.71 L12.49,5.19 A5.3,5.3 0 0 1 13.16,6.81 L15.21,6.86 A7.3,7.3 0 0 1 15.21,9.14 L13.16,9.19 A5.3,5.3 0 0 1 12.49,10.81 L13.91,12.29 A7.3,7.3 0 0 1 12.29,13.91 L10.81,12.49 A5.3,5.3 0 0 1 9.19,13.16 L9.14,15.21 A7.3,7.3 0 0 1 6.86,15.21 L6.81,13.16 A5.3,5.3 0 0 1 5.19,12.49 L3.71,13.91 A7.3,7.3 0 0 1 2.09,12.29 L3.51,10.81 A5.3,5.3 0 0 1 2.84,9.19 L0.79,9.14 A7.3,7.3 0 0 1 0.79,6.86 L2.84,6.81 A5.3,5.3 0 0 1 3.51,5.19 L2.09,3.71 A7.3,7.3 0 0 1 3.71,2.09 L5.19,3.51 A5.3,5.3 0 0 1 6.81,2.84 Z', 'stroke', 1.1], ['M5.8,8 A2.2,2.2 0 1 1 10.2,8 A2.2,2.2 0 1 1 5.8,8 Z', 'stroke', 1.1]],
  manual: [['M1,6.5 H4 V12.9 H1 Z', 'stroke', 1.1], ['M4,6.5 H7.5 L9.6,4.1 A0.8,0.8 0 0 1 10.9,5 L9.8,6.5 H14.2 A0.8,0.8 0 0 1 14.2,8.1 H13.4 A0.8,0.8 0 0 1 13.4,9.7 H12.8 A0.8,0.8 0 0 1 12.8,11.3 H12 A0.8,0.8 0 0 1 12,12.9 H4 Z M10.4,8.1 H13.4 M10.4,9.7 H12.8 M10.4,11.3 H12', 'stroke', 1.1]],
  // A scroll: both sides curve alike, 9 apart, and each line is centred on the page at its height.
  script: [['M4.5,1.5 H13.5 C11.5,4 11.5,5.5 12.5,8 C13.5,10.5 13.5,12 11.5,14.5 H2.5 C4.5,12 4.5,10.5 3.5,8 C2.5,5.5 2.5,4 4.5,1.5 Z', 'stroke', 1.1], ['M4.85,5 H9.85 M5.5,8 H10.5 M6.15,11 H11.15', 'stroke', 1]],
  'business-rule': [['M1,2.5 H15 V13.5 H1 Z', 'stroke', 1.1], ['M1,2.5 H15 V5.5 H1 Z', 'ink', 1.1], ['M1,9.5 H15 M5.5,5.5 V13.5', 'stroke', 1]],
};
// A glyph centred on cx,cy, size px across; the stroke widths stay in px at any size.
const glyph = (name, cx, cy, size, filled, ink) => {
  const k = size / 16, at = `matrix(${+k.toFixed(4)} 0 0 ${+k.toFixed(4)} ${f(cx - 8 * k)} ${f(cy - 8 * k)})`;
  return GLYPH[name].filter(([, kind]) => kind === 'open' ? !filled : kind === 'shut' ? filled : true).map(([d, kind, w]) =>
    `<path d="${d}" transform="${at}" style="fill: ${kind === 'ink' || (kind === 'line' && filled) ? ink : 'none'}; stroke: ${kind === 'shut' ? 'var(--card)' : ink}" stroke-width="${+(w / k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"></path>`);
};

const TASK_TYPES = ['user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule'];

export const SHAPE_NAMES = [...Object.keys(BASES), ...Object.keys(ALIASES)];
export const MARK_NAMES = MARKS;

// "gateway parallel" -> { base: 'gateway', marks: ['parallel'] }, or { error, suggest }.
export function parseShape(text) {
  const words = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const name = ALIASES[words[0]] || words[0];
  if (!BASES[name]) return { error: words[0] || '(empty)', options: SHAPE_NAMES };
  const marks = words.slice(1), bad = marks.find(k => !MARKS.includes(k));
  if (bad) return { error: bad, options: MARKS };
  return { base: name, marks: [...(BASES[name].marks || []), ...marks], round: !!BASES[name].round };
}

// SVG for one shape over box b. st: { fill, stroke, width, dash } as CSS values ('none' for
// no fill or outline). The outline sits inside the box, as a CSS border does.
export function drawShape(spec, b, st) {
  const def = BASES[spec.base], h = st.stroke === 'none' ? 0 : st.width / 2;
  // A non-interrupting event (BPMN 2.0.2, Table 10.93) has dashed rings.
  const broken = def.event && spec.marks.includes('non-interrupting');
  if (broken) st = { ...st, dash: '4 2.6' };
  if (def.dash) st = { ...st, dash: def.dash };
  const box = { x: b.x + h, y: b.y + h, w: Math.max(0, b.w - 2 * h), h: Math.max(0, b.h - 2 * h) };
  const ink = st.stroke === 'none' ? 'var(--ink)' : st.stroke;
  const paint = (d, fill = st.fill) => `<path d="${d}" style="fill: ${fill}; stroke: ${st.stroke}" stroke-width="${f(st.width)}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}></path>`;
  const line = (d, w = 1.5, fill = 'none') => `<path d="${d}" style="fill: ${fill}; stroke: ${ink}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"></path>`;
  const out = [...(def.under?.(box) || []).map(d => paint(d)), paint(def.path(box), def.open ? 'none' : st.fill), ...(def.lines?.(box) || []).map(d => line(d, Math.max(1, st.width || 1.5)))];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2;
  if (def.event === 'event') out.push(line(circle(cx, cy, r - h - 3.5), Math.min(st.width || 1.5, 1.5)).replace('></path>', broken ? ` stroke-dasharray="3.4 2.2"></path>` : '></path>'));
  if (def.cycle) {
    // Two arcs, each ending in a solid head drawn to scale (a line marker would swamp them).
    const a = r * 0.52, w = Math.max(1.3, r * 0.13), head = r * 0.36, pt = deg => [cx + a * Math.cos(deg * Math.PI / 180), cy + a * Math.sin(deg * Math.PI / 180)];
    for (const [from, to] of [[200, 330], [20, 150]]) {
      const [x0, y0] = pt(from), [x1, y1] = pt(to - 14), [ex, ey] = pt(to);
      out.push(line(`M${f(x0)},${f(y0)} A${f(a)},${f(a)} 0 0 1 ${f(x1)},${f(y1)}`, w));
      // The head points along the turning direction (clockwise): tangent (-sin, cos).
      const t = to * Math.PI / 180, tx = -Math.sin(t), ty = Math.cos(t), nx = Math.cos(t), ny = Math.sin(t);
      out.push(`<path d="${poly([[ex + tx * head * 0.55, ey + ty * head * 0.55], [ex - tx * head * 0.45 + nx * head * 0.5, ey - ty * head * 0.45 + ny * head * 0.5], [ex - tx * head * 0.45 - nx * head * 0.5, ey - ty * head * 0.45 - ny * head * 0.5]])}" style="fill: ${ink}; stroke: none"></path>`);
    }
  }
  // An event-based gateway (BPMN 2.0.2, 10.6.6) waits for whichever event comes first: a
  // pentagon in a double circle. Starting a process, the circle is single; the parallel
  // variant, which also starts one, holds an open cross. Both are the events' own glyphs.
  const marks = spec.marks, mark = k => marks.includes(k);
  if (def.gateway && mark('event-based')) {
    const parallel = mark('parallel'), single = parallel || mark('start'), c = r * 0.5;
    out.push(line(circle(cx, cy, c), 1.2));
    if (!single) out.push(line(circle(cx, cy, c - 2.5), 1.2));
    out.push(...glyph(parallel ? 'parallel-multiple' : 'multiple', cx, cy, r * (single ? 0.82 : 0.69), false, ink));
  } else if (def.gateway) {
    for (const k of marks) if (GLYPH['gateway ' + k]) out.push(...glyph('gateway ' + k, cx, cy, r * 1.07, false, ink));
  } else if (def.event) {
    // An end or throwing event's marker is filled; a catching one's is open.
    const filled = def.event === 'end' || mark('throw');
    for (const k of marks) if (GLYPH[k]) out.push(...glyph(k, cx, cy, r * 1.05, filled, ink));
  }
  // A task's type sits in its top-left corner (BPMN 2.0.2, 10.3.3); send and receive are the
  // message glyph, filled and open, as on a throwing and a catching event.
  const kind = !def.event && !def.gateway && marks.find(k => TASK_TYPES.includes(k));
  if (kind) out.push(...glyph(kind === 'send' || kind === 'receive' ? 'message' : kind, b.x + h + 14, b.y + h + 14, 16, kind === 'send', ink));
  // Task markers sit side by side at the bottom middle.
  // Multi-instance (BPMN 2.0.2, 10.3.5): three upright bars run the instances in parallel, three
  // flat ones one after another.
  // A transaction (10.3.7) is drawn with a double border.
  if (!def.event && !def.gateway && mark('transaction')) out.push(line(roundRect({ x: b.x + h + 3, y: b.y + h + 3, w: b.w - 2 * h - 6, h: b.h - 2 * h - 6 }, 7), Math.max(1, st.width || 1.5)));
  // Ad-hoc (~) and compensation (the event's rewind glyph) sit among the bottom markers.
  const bottom = spec.marks.filter(k => ['loop', 'multi', 'sequential', 'ad-hoc', 'compensation', 'subprocess'].includes(k) && !(k === 'multi' && mark('sequential')) && !def.event && !def.gateway);
  bottom.forEach((k, i) => {
    const s = 12, mx = cx + (i - (bottom.length - 1) / 2) * (s + 6), my = b.y + b.h - h - s / 2 - 5;
    if (k === 'ad-hoc' || k === 'compensation') out.push(...glyph(k, mx, my, 13, false, ink));
    if (k === 'subprocess') out.push(line(`M${f(mx - s / 2)},${f(my - s / 2)} H${f(mx + s / 2)} V${f(my + s / 2)} H${f(mx - s / 2)} Z M${f(mx - 3.5)},${f(my)} H${f(mx + 3.5)} M${f(mx)},${f(my - 3.5)} V${f(my + 3.5)}`, 1.2));
    if (k === 'loop') out.push(line(`M${f(mx + 4.5)},${f(my + 3.5)} A5.5,5.5 0 1 0 ${f(mx - 4.5)},${f(my + 3.5)} M${f(mx - 4.5)},${f(my + 3.5)} l-0.5,-3.5 M${f(mx - 4.5)},${f(my + 3.5)} l3.3,-1`, 1.3));
    if (k === 'sequential') out.push(line(`M${f(mx - 5)},${f(my - 4)} H${f(mx + 5)} M${f(mx - 5)},${f(my)} H${f(mx + 5)} M${f(mx - 5)},${f(my + 4)} H${f(mx + 5)}`, 1.5));
    if (k === 'multi') out.push(line(`M${f(mx - 4)},${f(my - 5)} V${f(my + 5)} M${f(mx)},${f(my - 5)} V${f(my + 5)} M${f(mx + 4)},${f(my - 5)} V${f(my + 5)}`, 1.5));
  });
  return out;
}

// Shape defaults, at zero specificity: any rule of the author wins. An activity with a marker
// at its bottom (subprocess, loop, multi-instance) keeps its label clear of it. Every shape is a
// box with an outline and centred content; events and gateways have their BPMN sizes.
const any = names => names.map(n => `[shape~="${n}"]`).join(', ');
// The shape's name only, not a marker: `task loop` is a task, not the `loop` badge.
const first = names => names.map(n => `[shape="${n}"], [shape^="${n} "]`).join(', ');
export const SHAPE_CSS = `
:where(.graphally-page [shape]) { border: 1.5px solid var(--ink); background: var(--card); display: grid; place-items: center; text-align: center; padding: 8px 12px; }
:where(.graphally-page :is(${any(['start', 'start-event', 'event', 'intermediate', 'intermediate-event', 'end', 'end-event'])})) { width: 36px; height: 36px; padding: 0; }
:where(.graphally-page :is(${any(['end', 'end-event'])})) { border-width: 3px; }
:where(.graphally-page :is(${any(['gateway'])})) { width: 44px; height: 44px; padding: 0; }
:where(.graphally-page :is(${first(['cycle', 'repeat', 'refresh', 'loop'])})) { width: 28px; height: 28px; padding: 0; }
:where(.graphally-page :is(${first(['annotation'])})) { background: none; place-items: center start; text-align: left; padding: 6px 10px 6px 14px; }
:where(.graphally-page :is(${first(['group'])})) { background: none; place-items: stretch; padding: 14px; }
:where(.graphally-page :is(${any(['task', 'activity', 'subprocess', 'sub-process'])})) { padding: 10px 14px; min-height: 52px; }
:where(.graphally-page :is(${any(['subprocess', 'sub-process'])}, :is(${any(['task', 'activity'])}):is(${any(['loop', 'multi', 'sequential', 'ad-hoc', 'compensation'])}))) { padding-bottom: 22px; }
:where(.graphally-page :is(${any(['diamond', 'decision', 'rhombus'])})) { padding: 22px 30px; min-height: 64px; }
:where(.graphally-page :is(${any(['circle'])})) { aspect-ratio: 1; padding: 10px; }
:where(.graphally-page :is(${any(['ellipse', 'oval'])})) { padding: 12px 26px; }
:where(.graphally-page :is(${any(['cylinder', 'database', 'db', 'data-store'])})) { padding: 22px 12px 14px; }
:where(.graphally-page :is(${any(['cylinder-h', 'queue'])})) { padding: 8px 26px 8px 16px; }
:where(.graphally-page :is(${any(['document', 'documents', 'multi-document'])})) { padding: 8px 12px 18px; }
:where(.graphally-page :is(${any(['documents', 'multi-document'])})) { padding: 16px 20px 22px 12px; }
:where(.graphally-page :is(${any(['note', 'data-object', 'folded'])})) { padding: 8px 22px 8px 12px; }
:where(.graphally-page :is(${any(['callout'])})) { padding: 8px 12px 22px; }
:where(.graphally-page :is(${any(['cloud'])})) { padding: 22px 30px 18px; }
:where(.graphally-page :is(${any(['chevron', 'chevron-start', 'step'])})) { padding: 8px 30px; }
:where(.graphally-page :is(${any(['hexagon', 'parallelogram', 'io', 'data', 'trapezoid'])})) { padding: 8px 28px; }
:where(.graphally-page :is(${any(['triangle'])})) { padding: 30% 20% 8px; }
:where(.graphally-page :is(${any(['predefined', 'subroutine'])})) { padding: 8px 22px; }
:where(.graphally-page :is(${any(['delay'])})) { padding: 8px 26px 8px 12px; }
:where(.graphally-page :is(${any(['manual-input'])})) { padding: 18px 12px 8px; }
:where(.graphally-page :is(${any(['off-page'])})) { padding: 8px 12px 18px; }
:where(.graphally-page :is(${any(['stadium', 'pill', 'terminator'])})) { padding: 8px 20px; }
:where(.graphally-page :is(${any(['arrow', 'arrow-right', 'arrow-left'])})) { padding: 8px 34px 8px 14px; }
:where(.graphally-page :is(${any(['arrow-left'])})) { padding: 8px 14px 8px 34px; }
:where(.graphally-page :is(${any(['arrow-up', 'arrow-down'])})) { padding: 12px 24px 38px; }
:where(.graphally-page :is(${any(['arrow-up'])})) { padding: 38px 24px 12px; }
`;
