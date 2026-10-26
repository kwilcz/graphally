// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Shapes: <div shape="cylinder">, <i shape="gateway parallel">, and the
// script's shape(). A shape is a base and optional markers. The base is a path over the
// element's box; the browser lays the element out as a box, and the element's background
// and border become the shape's fill and outline. Markers are drawn inside: a gateway's ×,
// an event's clock or envelope, a task's loop. BPMN conventions: a thin circle starts, a thick
// one ends, a double one is an intermediate event.

const f = n => String(Math.round(n * 10) / 10);
const poly = pts => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')} Z`;
const circle = (cx, cy, r) => `M${f(cx - r)},${f(cy)} A${f(r)},${f(r)} 0 1 1 ${f(cx + r)},${f(cy)} A${f(r)},${f(r)} 0 1 1 ${f(cx - r)},${f(cy)} Z`;

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
  ellipse: { path: ({ x, y, w, h }) => `M${f(x)},${f(y + h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 ${f(x + w)},${f(y + h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 ${f(x)},${f(y + h / 2)} Z`, round: true },
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
const MARKS = ['exclusive', 'parallel', 'inclusive', 'timer', 'message', 'signal', 'error', 'terminate', 'loop', 'multi', 'subprocess'];

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
  const box = { x: b.x + h, y: b.y + h, w: Math.max(0, b.w - 2 * h), h: Math.max(0, b.h - 2 * h) };
  const ink = st.stroke === 'none' ? 'var(--ink)' : st.stroke;
  const paint = (d, fill = st.fill) => `<path d="${d}" style="fill: ${fill}; stroke: ${st.stroke}" stroke-width="${f(st.width)}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}></path>`;
  const line = (d, w = 1.5, fill = 'none') => `<path d="${d}" style="fill: ${fill}; stroke: ${ink}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"></path>`;
  const out = [...(def.under?.(box) || []).map(d => paint(d)), paint(def.path(box)), ...(def.lines?.(box) || []).map(d => line(d, Math.max(1, st.width || 1.5)))];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2;
  if (def.event === 'event') out.push(line(circle(cx, cy, r - h - 3.5), Math.min(st.width || 1.5, 1.5)));
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
  for (const k of spec.marks) {
    if (def.gateway) {
      const s = r * 0.3;
      if (k === 'exclusive') out.push(line(`M${f(cx - s)},${f(cy - s)} L${f(cx + s)},${f(cy + s)} M${f(cx + s)},${f(cy - s)} L${f(cx - s)},${f(cy + s)}`, 2.6));
      if (k === 'parallel') out.push(line(`M${f(cx - s * 1.25)},${f(cy)} H${f(cx + s * 1.25)} M${f(cx)},${f(cy - s * 1.25)} V${f(cy + s * 1.25)}`, 2.8));
      if (k === 'inclusive') out.push(line(circle(cx, cy, s * 1.15), 2.4));
    } else if (def.event) {
      const g = r * 0.5, filled = def.event === 'end';
      if (k === 'timer') {
        out.push(line(circle(cx, cy, g), 1.3));
        out.push(line(`M${f(cx)},${f(cy - g * 0.7)} V${f(cy)} L${f(cx + g * 0.5)},${f(cy + g * 0.25)}`, 1.3));
      }
      if (k === 'message') {
        const w2 = g * 0.95, h2 = g * 0.65;
        out.push(line(`M${f(cx - w2)},${f(cy - h2)} H${f(cx + w2)} V${f(cy + h2)} H${f(cx - w2)} Z`, 1.3, filled ? ink : 'none'));
        out.push(`<path d="M${f(cx - w2)},${f(cy - h2)} L${f(cx)},${f(cy + h2 * 0.15)} L${f(cx + w2)},${f(cy - h2)}" style="fill: none; stroke: ${filled ? 'var(--card)' : ink}" stroke-width="1.3" stroke-linejoin="round"></path>`);
      }
      if (k === 'signal') out.push(line(poly([[cx, cy - g * 0.85], [cx + g * 0.85, cy + g * 0.6], [cx - g * 0.85, cy + g * 0.6]]), 1.3, filled ? ink : 'none'));
      if (k === 'error') out.push(line(poly([[cx - g * 0.7, cy + g * 0.7], [cx - g * 0.3, cy - g * 0.7], [cx + g * 0.1, cy + g * 0.05], [cx + g * 0.7, cy - g * 0.7], [cx + g * 0.3, cy + g * 0.7], [cx - g * 0.1, cy - g * 0.05]]), 1.3, filled ? ink : 'none'));
      if (k === 'terminate') out.push(line(circle(cx, cy, g * 0.9), 1, ink));
    }
  }
  // Task markers sit side by side at the bottom middle.
  const bottom = spec.marks.filter(k => ['loop', 'multi', 'subprocess'].includes(k) && !def.event && !def.gateway);
  bottom.forEach((k, i) => {
    const s = 12, mx = cx + (i - (bottom.length - 1) / 2) * (s + 6), my = b.y + b.h - h - s / 2 - 5;
    if (k === 'subprocess') out.push(line(`M${f(mx - s / 2)},${f(my - s / 2)} H${f(mx + s / 2)} V${f(my + s / 2)} H${f(mx - s / 2)} Z M${f(mx - 3.5)},${f(my)} H${f(mx + 3.5)} M${f(mx)},${f(my - 3.5)} V${f(my + 3.5)}`, 1.2));
    if (k === 'loop') out.push(line(`M${f(mx + 4.5)},${f(my + 3.5)} A5.5,5.5 0 1 0 ${f(mx - 4.5)},${f(my + 3.5)} M${f(mx - 4.5)},${f(my + 3.5)} l-0.5,-3.5 M${f(mx - 4.5)},${f(my + 3.5)} l3.3,-1`, 1.3));
    if (k === 'multi') out.push(line(`M${f(mx - 4)},${f(my - 5)} V${f(my + 5)} M${f(mx)},${f(my - 5)} V${f(my + 5)} M${f(mx + 4)},${f(my - 5)} V${f(my + 5)}`, 1.5));
  });
  return out;
}

// Shape defaults, at zero specificity: any rule of the author wins. Every shape is a
// box with an outline and centred content; events and gateways have their BPMN sizes.
const any = names => names.map(n => `[shape~="${n}"]`).join(', ');
export const SHAPE_CSS = `
:where(.graphally-page [shape]) { border: 1.5px solid var(--ink); background: var(--card); display: grid; place-items: center; text-align: center; padding: 8px 12px; }
:where(.graphally-page :is(${any(['start', 'start-event', 'event', 'intermediate', 'intermediate-event', 'end', 'end-event'])})) { width: 36px; height: 36px; padding: 0; }
:where(.graphally-page :is(${any(['end', 'end-event'])})) { border-width: 3px; }
:where(.graphally-page :is(${any(['gateway'])})) { width: 44px; height: 44px; padding: 0; }
:where(.graphally-page :is(${any(['cycle', 'repeat', 'refresh', 'loop'])})) { width: 28px; height: 28px; padding: 0; }
:where(.graphally-page :is(${any(['task', 'activity', 'subprocess', 'sub-process'])})) { padding: 10px 14px; min-height: 52px; }
:where(.graphally-page :is(${any(['subprocess', 'sub-process'])})) { padding-bottom: 22px; }
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
