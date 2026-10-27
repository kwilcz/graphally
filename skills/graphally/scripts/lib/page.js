// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// <diagram>: the page is the layout. The author writes ordinary HTML and CSS; the
// browser places everything. An optional <script> then runs with the geometry of every
// element and connects and draws by name: el('id').right, mid(a, b), connect(a, b), arrow,
// curve, draw.moveTo(…).lineTo(…), gate, text, icon, shape. Nobody writes a coordinate.
// This file turns the laid-out page into SVG: backgrounds, borders, clip-path shapes, text
// line by line, icons; then the connectors (routed by route.js) and the script's drawings.
import { S, T } from './style.js';
import { schedule, timeline } from './time.js';
import { sequence } from './seq.js';
import { utilitiesFor } from './utilities.js';
import { resolveIcon, symbolFor } from './icons.js';
import { routeEdges } from './route.js';
import { parseShape, drawShape, SHAPE_CSS } from './shapes.js';

const fmt = n => String(Math.round(n * 10) / 10);
// A polyline with its corners rounded by r: the path of a line with bends.
function rounded(pts, r) {
  let d = `M${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y), d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d1 < 0.01 || d2 < 0.01) continue;
    const k = Math.min(r, d1 / 2, d2 / 2);
    d += ` L${fmt(p1.x - (p1.x - p0.x) / d1 * k)},${fmt(p1.y - (p1.y - p0.y) / d1 * k)} Q${fmt(p1.x)},${fmt(p1.y)} ${fmt(p1.x + (p2.x - p1.x) / d2 * k)},${fmt(p1.y + (p2.y - p1.y) / d2 * k)}`;
  }
  const last = pts.at(-1);
  return d + ` L${fmt(last.x)},${fmt(last.y)}`;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SIDES = ['right', 'bottom', 'left', 'top'];
const TOKENS = ['ink', 'muted', 'line', 'woad', 'rust', 'teal', 'green', 'purple', 'amber', 'wash', 'card', 'bg', 'icon-soft', 'vnet', 'note', 'lane-a', 'lane-b', 'lane-c', 'lane-d'];
const TONE_ALIASES = { blue: 'woad', red: 'rust' };
// Line ends: head at the end of a line, tail at its start.
const ENDS = ['arrow', 'open', 'circle', 'dot', 'diamond', 'open-diamond', 'none'];

// Defaults for the page and its building blocks; layout and spacing are utility classes
// (utilities.js) or plain CSS. :where() keeps their specificity at zero, so any rule of the
// author wins.
const PAGE_CSS = `
:where(.graphally-page) { font: 400 13px Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif; color: var(--ink); line-height: 1.35; }
:where(.graphally-page *) { box-sizing: border-box; }
:where(.graphally-page h1, .graphally-page h2, .graphally-page h3, .graphally-page h4, .graphally-page p, .graphally-page ul) { margin: 0; }
:where(.graphally-page h1) { font-size: 22px; font-weight: 700; } :where(.graphally-page h2) { font-size: 17px; font-weight: 600; }
:where(.graphally-page h3) { font-size: 14px; font-weight: 600; } :where(.graphally-page h4) { font-size: 13px; font-weight: 600; }
:where(.graphally-page ul) { padding-left: 16px; }
:where(.graphally-page icon) { display: inline-block; width: 24px; height: 24px; flex: none; vertical-align: middle; }
:where(.graphally-page .card) { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
:where(.graphally-page .box) { border: 1.5px solid var(--ink); border-radius: 6px; padding: 8px 12px; background: var(--card); }
:where(.graphally-page .pill) { background: var(--wash); border-radius: 999px; padding: 4px 12px; text-align: center; }
:where(.graphally-page .tag) { display: inline-block; background: var(--wash); border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; }
:where(.graphally-page .banner) { background: var(--ink); color: var(--card); border-radius: 6px; padding: 10px 16px; font-weight: 600; }
/* Building blocks, styled like the rest of graphally: plain CSS that any rule of yours
   overrides (they have no specificity). Text after an icon is the name; <small> the line
   under it. */
:where(.graphally-page .group) { display: flex; flex-direction: column; gap: 18px; background: var(--wash); border: 1px solid var(--line); border-radius: 10px; padding: 10px 16px 16px; }
:where(.graphally-page .group .group) { background: var(--card); }
:where(.graphally-page .group > h4) { display: flex; align-items: center; gap: 6px; margin: 0 0 -6px; font-size: 12px; font-weight: 600; color: var(--muted); }
:where(.graphally-page .group > h4 > icon) { width: 18px; height: 18px; }
:where(.graphally-page .group > h4 small, .graphally-page .band > h4 small) { font-weight: 400; font-size: 11.5px; }
:where(.graphally-page .group.dashed, .graphally-page .group.external) { background: none; border: 1.2px dashed var(--muted); }
:where(.graphally-page .group.plain) { background: none; border: 0; padding: 0; }
:where(.graphally-page .group.vnet) { background: var(--vnet); border: 1.4px solid var(--woad); }
:where(.graphally-page .group.subnet) { background: var(--card); border: 1.1px dashed var(--woad); }
:where(.graphally-page .group.region) { background: none; border: 1.4px dashed var(--woad); border-radius: 12px; }
:where(.graphally-page .group:is(.vnet, .subnet, .region) > h4) { color: var(--woad); }
:where(.graphally-page .badges) { display: flex; gap: 4px; margin-left: auto; }
:where(.graphally-page .badge) { display: inline-flex; padding: 2px; background: var(--card); border: 1px solid var(--line); border-radius: 4px; }
:where(.graphally-page .badge > icon) { width: 16px; height: 16px; }
:where(.graphally-page .node) { display: grid; grid-template-columns: 1fr; align-items: center; column-gap: 10px; min-width: 150px; max-width: 210px; min-height: 48px; padding: 9px 12px; background: var(--card); border: 1.3px solid var(--ink); border-radius: 6px; font-weight: 500; line-height: 16px; }
:where(.graphally-page .node:has(> icon)) { grid-template-columns: auto 1fr; }
:where(.graphally-page .node > icon) { grid-row: 1 / span 2; width: 26px; height: 26px; }
:where(.graphally-page :is(.node, .tile, .figure) > small) { grid-column: -2; font-size: 11.5px; font-weight: 400; line-height: 15px; color: var(--muted); }
:where(.graphally-page :is(.node, .tile).external) { border-style: dashed; border-color: var(--muted); }
:where(.graphally-page :is(.node, .tile).accent) { border: 2px solid var(--woad); color: var(--woad); }
:where(.graphally-page .figure.external) { color: var(--muted); }
:where(.graphally-page .figure.accent) { color: var(--woad); font-weight: 650; }
:where(.graphally-page .tile) { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 112px; padding: 10px 6px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; text-align: center; font-size: 12.5px; font-weight: 500; line-height: 15px; }
:where(.graphally-page .tile > icon) { width: 40px; height: 40px; }
:where(.graphally-page .figure) { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 104px; text-align: center; font-size: 12.5px; font-weight: 500; line-height: 15px; }
:where(.graphally-page .figure > icon) { width: 48px; height: 48px; }
:where(.graphally-page .band) { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; background: var(--wash); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; }
:where(.graphally-page .band > h4) { flex-basis: 100%; margin: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
:where(.graphally-page .key) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 22px; font-size: 11.5px; color: var(--muted); }
:where(.graphally-page .key > *) { display: flex; align-items: center; gap: 8px; }
:where(.graphally-page .swatch) { display: inline-block; width: 30px; border-top: 1.5px solid var(--ink); }
:where(.graphally-page .swatch.dashed) { border-top-style: dashed; }
:where(.graphally-page .swatch.box) { width: 26px; height: 14px; border: 1.2px dashed var(--muted); border-radius: 4px; }
/* What sequence() makes. */
:where(.graphally-page .seq) { column-gap: 18px; }
:where(.graphally-page .seq > [data-who]) { min-width: 0; }
:where(.graphally-page .msg) { padding: 6px 0 14px; text-align: center; font-size: 12.5px; }
:where(.graphally-page .msg.self) { justify-self: start; margin-left: calc(50% + 48px); padding-bottom: 24px; text-align: left; white-space: nowrap; }
:where(.graphally-page .msg > .label) { padding: 0 4px; background: var(--bg); }
:where(.graphally-page .num) { display: inline-grid; place-items: center; width: 17px; height: 17px; margin-right: 6px; border-radius: 50%; background: var(--ink); color: var(--card); font-size: 10px; font-weight: 700; vertical-align: 1px; }
:where(.graphally-page .lifeline) { justify-self: center; width: 0; border-left: 1px dashed var(--line); }
:where(.graphally-page .activation) { justify-self: center; width: 12px; margin-top: -9px; background: var(--card); border: 1.2px solid var(--ink); }
:where(.graphally-page :is(.frag-box, .frag-tab, .frag-else, .frag-end)) { margin-inline: max(0px, calc(100% / var(--k) / 2 - 38px + var(--depth) * 12px)); }
:where(.graphally-page .frag-box) { border: 1px solid var(--ink); }
:where(.graphally-page .frag-tab) { white-space: nowrap; display: flex; align-items: center; gap: 10px; font-size: 11.5px; }
:where(.graphally-page .frag-tab > b) { padding: 3px 16px 3px 8px; background: var(--card); border: 1px solid var(--ink); border-width: 0 1px 1px 0; clip-path: polygon(0 0, 100% 0, 100% 55%, calc(100% - 8px) 100%, 0 100%); font-size: 11px; }
:where(.graphally-page .guard) { color: var(--muted); }
:where(.graphally-page .frag-else) { padding: 4px 8px; border-top: 1px dashed var(--ink); font-size: 11.5px; }
:where(.graphally-page .frag-end) { height: 12px; }
:where(.graphally-page .who-group) { margin: -36px calc(100% / var(--k) / 2 - 124px) 0; }
`;

export function compilePage(el, opts, m) {
  const problems = [];
  const id = el.id || 'pg';
  if (!document.getElementById('graphally-page-css')) {
    const st = document.createElement('style');
    st.id = 'graphally-page-css';
    st.textContent = PAGE_CSS + SHAPE_CSS;
    document.head.appendChild(st);
  }
  const wAttr = el.getAttribute('width'), width = Number(wAttr) || 1200;
  if (wAttr != null && !(Number(wAttr) > 0)) problems.push({ rule: 'bad-attribute', attr: 'width', value: wAttr, hint: 'a number of pixels, as in width=1200' });
  const root = document.createElement('div');
  root.className = 'graphally-page';
  root.style.cssText = `position:absolute; left:0; top:0; width:${width}px; padding:${S.pad}px;`;
  const title = el.getAttribute('title'), subtitle = el.getAttribute('subtitle');
  if (title) root.insertAdjacentHTML('beforeend', `<div style="font: 600 15px Inter, 'Segoe UI', system-ui, sans-serif; margin-bottom: 4px">${esc(title)}</div>`);
  if (subtitle) root.insertAdjacentHTML('beforeend', `<div style="font-size: 12.5px; color: var(--muted); margin-bottom: 4px">${esc(subtitle)}</div>`);
  if (title || subtitle) root.insertAdjacentHTML('beforeend', `<div style="height: ${S.titleGap - 4}px"></div>`);
  // <script> is drawing code; <script type="application/json"> is the connections, as data.
  const scripts = [], lines = [], before = [];
  // A drawing script without a type of its own also runs as a page script when the file is
  // opened in a browser (the viewer), before graphally has laid anything out.
  for (const c of el.childNodes) {
    if (c.nodeType === 1 && c.tagName === 'SCRIPT') {
      const type = (c.getAttribute('type') || '').toLowerCase();
      if (!type || /javascript|module/.test(type)) problems.push({ rule: 'plain-script', hint: 'a browser runs it on its own when the file is opened: write <script type="graphally">' });
      (type === 'application/json' ? lines : c.hasAttribute('before') ? before : scripts).push(c.textContent);
    } else root.appendChild(c.cloneNode(true));
  }
  // nudge="dx,dy" moves an element from where the layout put it (the edit command writes it).
  for (const e of root.querySelectorAll('[nudge]')) {
    const v = e.getAttribute('nudge').split(',').map(Number);
    if (v.length !== 2 || v.some(n => !Number.isFinite(n))) { problems.push({ rule: 'bad-attribute', attr: 'nudge', value: e.getAttribute('nudge'), ...(e.id ? { id: e.id } : {}), hint: 'two numbers, as in nudge="20,-10"' }); continue; }
    e.style.translate = `${v[0]}px ${v[1]}px`;
  }
  document.body.appendChild(root);
  // <script type="graphally" before>: runs on the page before it is laid out, to make or
  // place elements (rows from a list, bars on a timeline). Dates come from time.js.
  const pre = {
    root, el: sel => root.querySelector(/^[#.[]|[\s>:]/.test(sel) ? sel : `#${CSS.escape(sel)}`), all: sel => [...root.querySelectorAll(sel)],
    make: (tag, attrs = {}, text = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text) e.textContent = text; return e; },
    schedule: (sel = '[data-start], [data-after], [data-at]') => schedule(typeof sel === 'string' ? [...root.querySelectorAll(sel)] : [].concat(sel), root, problems),
    timeline: (box, o2) => timeline(typeof box === 'string' ? root.querySelector(box) : box, o2, problems),
    sequence: (box, o2) => sequence(typeof box === 'string' ? root.querySelector(box) : box, o2, problems),
  };
  for (const code of before) {
    try { new Function(...Object.keys(pre), code)(...Object.values(pre)); }
    catch (e) { const line = String(e.stack || '').match(/<anonymous>:(\d+):\d+/); problems.push({ rule: 'script-error', when: 'before', message: e.message, ...(line ? { line: Number(line[1]) - 2 } : {}) }); }
  }
  // Utility classes (flex, justify-center, gap-6): written after the before-script, which
  // may have added some, and removed with the page.
  const ut = document.createElement('style');
  ut.textContent = utilitiesFor(root, problems);
  root.prepend(ut);
  try {
    return build(root, el, id, scripts, lines, opts, m, problems);
  } finally {
    root.remove();
  }
}

function build(root, el, id, scripts, lines, opts, m, problems) {
  // Icons: <icon name="app service" size=32> becomes a sized box drawn with the icon's symbol.
  const symbols = new Map();
  const order = String(el.getAttribute('icons') || 'azure').toLowerCase() === 'aws' ? ['aws', 'azure'] : ['azure', 'aws'];
  for (const ic of root.querySelectorAll('icon')) {
    const size = ic.getAttribute('size');
    if (size) { ic.style.width = `${size}px`; ic.style.height = `${size}px`; }
    const r = resolveIcon(ic.getAttribute('name') || '', order);
    if (!r || r.error) { problems.push({ rule: 'unknown-icon', icon: ic.getAttribute('name'), suggest: r?.suggestions }); continue; }
    const sym = symbolFor(r, id);
    symbols.set(sym.id, sym.markup);
    ic.dataset.symbol = sym.id;
  }

  const o = root.getBoundingClientRect();
  const boxOf = e => {
    const r = e.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  };
  const colors = tokenColors(root);
  const paintOf = c => (!c || /rgba\(.*,\s*0\)$/.test(c) || c === 'transparent' ? null : colors.get(c) || c);

  // ---------- the script: geometry by name, connections and drawings ----------
  const pt = (x, y) => ({ x, y, down: d => pt(x, y + d), up: d => pt(x, y - d), left: d => pt(x - d, y), right: d => pt(x + d, y), move: (dx, dy) => pt(x + dx, y + dy) });
  const geom = e => {
    const { x, y, w, h } = boxOf(e), cx = x + w / 2, cy = y + h / 2;
    return {
      el: e, id: e.id, x, y, w, h, center: pt(cx, cy), top: pt(cx, y), bottom: pt(cx, y + h), left: pt(x, cy), right: pt(x + w, cy),
      topLeft: pt(x, y), topRight: pt(x + w, y), bottomLeft: pt(x, y + h), bottomRight: pt(x + w, y + h),
      at: (side, t = 0.5) => side === 'top' ? pt(x + w * t, y) : side === 'bottom' ? pt(x + w * t, y + h) : side === 'left' ? pt(x, y + h * t) : pt(x + w, y + h * t),
    };
  };
  const ids = () => [...root.querySelectorAll('[id]')].map(e => e.id);
  const find = ref => {
    if (ref && ref.el) return [ref];
    if (Array.isArray(ref)) return ref.flatMap(find);
    const s = String(ref);
    const sel = /^[#.[]|[\s>:]/.test(s) ? s : `#${CSS.escape(s)}`;
    const found = [...root.querySelectorAll(sel)];
    if (!found.length) throw new Error(`no element "${s}"${closest(s, ids()) ? `; did you mean "${closest(s, ids())}"?` : ''}`);
    return found.map(geom);
  };
  const edges = [], drawings = [], dependRuns = [];
  const opt = (v, d) => (v === undefined ? d : v);
  // What the script names: a box (element, id or selector) or a point. Anything else is an
  // error with the script's line, not a line drawn to NaN.
  const spot = ref => {
    if (ref && ref.el) return ref;
    if (typeof ref === 'string' || Array.isArray(ref)) return find(ref)[0];
    if (ref && Number.isFinite(ref.x) && Number.isFinite(ref.y)) return ref;
    throw new Error(`${typeof ref === 'object' ? JSON.stringify(ref) : String(ref)} is not an element or a point`);
  };
  const point = ref => { const s = spot(ref); return s.el ? s.center : s; };
  const api = {
    el: ref => find(ref)[0],
    all: sel => find(sel),
    pt,
    mid: (a, b) => { const [p, q] = [point(a), point(b)]; return pt((p.x + q.x) / 2, (p.y + q.y) / 2); },
    lerp: (a, b, t) => { const [p, q] = [point(a), point(b)]; return pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t); },
    connect(a, b, o2 = {}) {
      const stmt = edges.length + 1, via = [].concat(o2.via || []).map(point);
      for (const f of find(a)) for (const t of find(b)) edges.push({ from: f.el, to: t.el, o: o2, stmt, via });
    },
    arrow(a, b, o2 = {}) { const [p, q] = ends(a, b); drawings.push({ kind: 'path', d: `M${fmt(p.x)},${fmt(p.y)} L${fmt(q.x)},${fmt(q.y)}`, o: { arrow: true, ...o2 }, ends: [p, q], via: api.mid(p, q) }); },
    curve(a, b, o2 = {}) {
      const [p, q] = ends(a, b), bend = opt(o2.bend, 40), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
      const c = { x: (p.x + q.x) / 2 - dy / len * bend, y: (p.y + q.y) / 2 + dx / len * bend };
      drawings.push({ kind: 'path', d: `M${fmt(p.x)},${fmt(p.y)} Q${fmt(c.x)},${fmt(c.y)} ${fmt(q.x)},${fmt(q.y)}`, o: { arrow: true, ...o2 }, ends: [p, q], via: pt((p.x + 2 * c.x + q.x) / 4, (p.y + 2 * c.y + q.y) / 4) });
    },
    // depend(a, b): a finish-to-start dependency on a time chart, from a to the start of b.
    // It may leave a by its back or anywhere along its underside (its top when b is above),
    // and arrives at b's start, or straight into its top near the start. Of the clear ways
    // the shortest wins, a corner counting as 40px. Clear means: CLEAR from every other dated
    // element ([data-start], [data-at]) and off the upright runs of dependencies into other
    // tasks; every run between corners at least BEND long; the last run at least LAST long,
    // unless the whole line is one straight drop; and it touches a box only within the middle
    // 80% of a side, never at a corner. A long way round goes along a row edge, where the band
    // between two rows' bars is.
    depend(a, b, o2 = {}) {
      const [p, q] = [spot(a), spot(b)];
      if (!p.el || !q.el) throw new Error('depend(a, b) takes two elements');
      const CLEAR = 12, CLEAR_Y = 6, LAST = 24, FIRST = 20, BEND = 18;
      // Obstacles: the other dated elements with a body (a today line has none).
      const bars = find('[data-start], [data-at]').filter(r => r.el !== p.el && r.el !== q.el && r.w > 1 && r.h > 1);
      const runs = dependRuns.filter(v => v.to !== q.el);
      const free = (x1, y1, x2, y2) => bars.every(r => Math.max(x1, x2) < r.x - CLEAR || Math.min(x1, x2) > r.x + r.w + CLEAR || Math.max(y1, y2) < r.y - CLEAR_Y || Math.min(y1, y2) > r.y + r.h + CLEAR_Y)
        && (x1 !== x2 || runs.every(v => Math.abs(v.x - x1) > 6 || Math.max(y1, y2) < v.y1 - 3 || Math.min(y1, y2) > v.y2 + 3));
      const sx = p.x + p.w, kx = sx + FIRST, y1 = p.center.y, y2 = q.center.y, ex = q.x - LAST, down = y2 > y1;
      const rowEdge = (r, below) => { const row = geom(r.el.parentElement);
        return below ? (row.y + row.h > r.y + r.h + 2 ? row.y + row.h : r.y + r.h + BEND) : (row.y < r.y - 2 ? row.y : r.y - BEND); };
      const ya = rowEdge(p, down), yb = rowEdge(q, !down), pEdge = down ? p.y + p.h : p.y, qEdge = down ? q.y : q.y + q.h;
      // Where a line may touch a top or bottom: the middle 80% of it.
      const inner = (r, x) => x >= r.x + r.w * 0.1 && x <= r.x + r.w * 0.9;
      const xs = new Set([ex, q.x + 12, q.x + 20, q.x + q.w / 2, q.x + q.w * 0.1, p.x + p.w * 0.9, p.x + p.w / 2]);
      for (let x = kx; x <= Math.max(ex, q.x + 20); x += 4) xs.add(x);
      for (let x = p.x + 12; x < sx; x += 6) xs.add(x);
      for (const r of bars) for (const o of [CLEAR + 2, CLEAR + 8, CLEAR + 14]) { xs.add(r.x - o); xs.add(r.x + r.w + o); }
      const leaves = x => [
        ...(x >= kx ? [[[sx, y1], [x, y1]]] : []),
        ...[0, 8, 16, 24, 32].map(d => [[sx, y1], [kx + d, y1], [kx + d, ya], [x, ya]]),
        ...(inner(p, x) ? [[[x, pEdge]]] : []),
      ];
      const arrivals = (x, leave) => [
        ...(x <= ex ? [[[x, y2], [q.x, y2]]] : []),
        ...(inner(q, x) && x <= q.x + Math.max(40, q.w / 2) ? [[[x, qEdge]]] : []),
        [[x, yb], [ex, yb], [ex, y2], [q.x, y2]],
      ];
      const clear = path => path.every((v, k) => !k || free(path[k - 1][0], path[k - 1][1], v[0], v[1]));
      let pts = null;
      for (const bend of [BEND, 12, 6, 0]) {
        let best = Infinity;
        for (const x of xs) for (const leave of leaves(x)) for (const arrive of arrivals(x, leave)) {
          const path = [...leave, ...arrive].filter((v, k, a) => !k || v[0] !== a[k - 1][0] || v[1] !== a[k - 1][1]);
          const lens = path.slice(1).map((v, k) => Math.abs(v[0] - path[k][0]) + Math.abs(v[1] - path[k][1]));
          if (lens.length > 1 && (lens.some(n => n < bend) || lens.at(-1) < Math.min(LAST, Math.max(bend, 12)))) continue;
          if (lens.length === 1 && lens[0] < 6) continue;
          const score = (path.length - 2) * 40 + lens.reduce((n, l) => n + l, 0);
          if (score < best && clear(path)) { best = score; pts = path; }
        }
        if (pts) break;
      }
      pts ||= [[sx, y1], [kx, y1], [kx, yb], [ex, yb], [ex, y2], [q.x, y2]];
      for (let k = 1; k < pts.length; k++) if (pts[k][0] === pts[k - 1][0]) dependRuns.push({ x: pts[k][0], y1: Math.min(pts[k][1], pts[k - 1][1]), y2: Math.max(pts[k][1], pts[k - 1][1]), to: q.el });
      const ps = pts.map(([x, y]) => pt(x, y));
      drawings.push({ kind: 'path', d: rounded(ps, 4), o: { arrow: true, ...o2 }, ends: [ps[0], ps.at(-1)], via: ps[Math.floor(ps.length / 2)] });
    },
    draw: { moveTo: p => pathBuilder(point(p), drawings, point), arc: (c, r, a0, a1) => pathBuilder(arcPoint(point(c), r, a0), drawings, point).arc(c, r, a0, a1) },
    gate(p, label = '', o2 = {}) { drawings.push({ kind: 'gate', p: point(p), label, o: o2 }); },
    text(p, str, o2 = {}) { drawings.push({ kind: 'text', p: point(p), str: String(str), o: o2 }); },
    icon(p, name, o2 = {}) {
      const r = resolveIcon(name, order);
      if (!r || r.error) { problems.push({ rule: 'unknown-icon', icon: name, suggest: r?.suggestions }); return; }
      const sym = symbolFor(r, id);
      symbols.set(sym.id, sym.markup);
      drawings.push({ kind: 'icon', p: point(p), sym: sym.id, o: o2 });
    },
    shape(kind, p, o2 = {}) { drawings.push({ kind: 'shape', shape: kind, p: point(p), o: o2 }); },
  };
  // Two boxes: the facing sides. Points: as given.
  const ends = (ra, rb) => {
    const a = spot(ra), b = spot(rb);
    if (!a.el || !b.el) return [a.el ? a.center : a, b.el ? b.center : b];
    const dx = b.center.x - a.center.x, dy = b.center.y - a.center.y;
    return Math.abs(dx) * a.h >= Math.abs(dy) * a.w ? (dx > 0 ? [a.right, b.left] : [a.left, b.right]) : (dy > 0 ? [a.bottom, b.top] : [a.top, b.bottom]);
  };
  for (const code of scripts) {
    try { new Function(...Object.keys(api), code)(...Object.values(api)); }
    catch (e) {
      const line = String(e.stack || '').match(/<anonymous>:(\d+):\d+/);
      problems.push({ rule: 'script-error', message: e.message, ...(line ? { line: Number(line[1]) - 2 } : {}) });
    }
  }
  // The connections as data: [{ "from": "a", "to": "b", "label": "…", …options of connect }],
  // or ["a", "b", "label"]. via points are [x, y] or "id.anchor" (anchor: top, right, center …).
  for (const text of lines) {
    let list;
    try { list = JSON.parse(text); } catch (e) { problems.push({ rule: 'bad-lines', message: e.message, hint: 'the connections must be a JSON array' }); continue; }
    if (!Array.isArray(list)) { problems.push({ rule: 'bad-lines', message: 'not an array', hint: 'the connections must be a JSON array' }); continue; }
    list.forEach((item, n) => {
      const o = Array.isArray(item) ? { from: item[0], to: item[1], ...(item[2] ? { label: item[2] } : {}) } : { ...item };
      try {
        if (!o.from || !o.to) throw new Error('needs "from" and "to"');
        const anchor = v => {
          if (Array.isArray(v)) return pt(Number(v[0]), Number(v[1]));
          const [ref, side = 'center'] = String(v).split('.'), b = find(ref)[0];
          if (!b[side]?.x && b[side]?.x !== 0) throw new Error(`"${v}": no anchor "${side}"`);
          return b[side];
        };
        const { from, to, via, ...rest } = o;
        api.connect(from, to, { ...rest, ...(via ? { via: [].concat(Array.isArray(via[0]) || typeof via[0] === 'string' ? via : [via]).map(anchor) } : {}) });
      } catch (e) { problems.push({ rule: 'bad-line', line: n + 1, message: e.message }); }
    });
  }

  // ---------- the page as boxes and text ----------
  const out = [], texts = [], boxes = [];
  const ctx = document.createElement('canvas').getContext('2d');
  const ascentOf = cs => { ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return ctx.measureText('Hg').fontBoundingBoxAscent; };
  const textOf = (node, owner) => {
    if (!node.textContent.trim()) return;
    const cs = getComputedStyle(owner);
    const fill = paintOf(cs.color) || 'var(--ink)', asc = ascentOf(cs);
    const range = document.createRange(), lines = [];
    // A word's pieces, one per line: the browser may break a word at a hyphen.
    const rects = (i, a, b) => { range.setStart(node, i + a); range.setEnd(node, i + b); return [...range.getClientRects()].filter(r => r.width); };
    const piecesOf = (i, word) => {
      if (rects(i, 0, word.length).length <= 1) return [[word, rects(i, 0, word.length)[0]]];
      const cuts = [0];
      for (let k = 1, top = rects(i, 0, 1)[0]?.top; k < word.length; k++) {
        const t = rects(i, k, k + 1)[0]?.top;
        if (t != null && top != null && Math.abs(t - top) > 2) cuts.push(k);
        if (t != null) top = t;
      }
      cuts.push(word.length);
      return cuts.slice(1).map((end, n) => [word.slice(cuts[n], end), rects(i, cuts[n], end)[0]]);
    };
    for (const w of node.textContent.matchAll(/\S+/g)) for (const [word, r] of piecesOf(w.index, w[0])) {
      if (!r) continue;
      const top = r.top - o.top;
      let line = lines.find(l => Math.abs(l.top - top) < 2);
      if (!line) lines.push(line = { top, left: r.left - o.left, right: 0, words: [], h: r.height });
      line.words.push(word); line.right = r.right - o.left;
    }
    const tt = cs.textTransform, transform = s => tt === 'uppercase' ? s.toUpperCase() : tt === 'lowercase' ? s.toLowerCase() : s;
    const ls = cs.letterSpacing !== 'normal' ? `; letter-spacing: ${cs.letterSpacing}` : '';
    // Underline and line-through reach the text from its own element or any one around it.
    const deco = new Set();
    for (let a = owner; a && a !== root; a = a.parentElement) for (const d of getComputedStyle(a).textDecorationLine.split(' ')) if (d === 'underline' || d === 'line-through') deco.add(d);
    const td = deco.size ? `; text-decoration: ${[...deco].join(' ')}` : '';
    for (const l of lines) {
      const str = transform(l.words.join(' '));
      texts.push({ x: l.left, y: l.top, w: l.right - l.left, h: l.h, owner, str });
      out.push(`<text x="${fmt(l.left)}" y="${fmt(l.top + asc)}" style="font-family: ${esc(cs.fontFamily)}; font-size: ${cs.fontSize}; font-weight: ${cs.fontWeight}${cs.fontStyle !== 'normal' ? `; font-style: ${cs.fontStyle}` : ''}${ls}${td}; fill: ${fill}">${esc(str)}</text>`);
    }
  };
  // clip-path: polygon(…) with %, px and calc(), resolved against the element's own box.
  const len = (v, full) => {
    const expr = v.replace(/^calc\((.*)\)$/, '$1').replace(/(-?[\d.]+)%/g, (_, n) => `(${n}*${full}/100)`).replace(/(-?[\d.]+)px/g, '($1)');
    return /^[\d.\s+\-*/()]+$/.test(expr) ? Function(`return ${expr}`)() : 0;
  };
  const polygonOf = (clip, b) => {
    const mm = /^polygon\((.*)\)$/.exec(clip || '');
    if (!mm) return null;
    return mm[1].split(/,(?![^(]*\))/).map(p => {
      const [xs, ys] = p.trim().match(/calc\([^)]*\)|\S+/g);
      return { x: b.x + len(xs, b.w), y: b.y + len(ys, b.h) };
    });
  };
  const visit = (e, parentBox) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const b = boxOf(e);
    if (e.tagName === 'ICON') {
      if (e.dataset.symbol) out.push(`<use href="#${e.dataset.symbol}" x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" style="color: ${paintOf(cs.color) || 'var(--ink)'}"></use>`);
      boxes.push({ e, b, painted: true, parent: parentBox });
      return;
    }
    // The layout the next render reads back (snapshot.mjs), with the author's nudge.
    const nudge = e.getAttribute('nudge') ? ` data-nudge="${esc(e.getAttribute('nudge'))}"` : '';
    const open = e.id ? out.push(`<g data-id="${esc(e.id)}" data-box="${[b.x, b.y, b.w, b.h].map(v => Math.round(v * 2) / 2).join(',')}"${nudge}>`) : 0;
    const bg = paintOf(cs.backgroundColor);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => (cs[`border${s}Style`] === 'none' ? 0 : parseFloat(cs[`border${s}Width`]) || 0));
    const bc = paintOf(cs.borderTopColor), dashed = cs.borderTopStyle === 'dashed' ? ' stroke-dasharray="5 4"' : cs.borderTopStyle === 'dotted' ? ' stroke-dasharray="1.5 3"' : '';
    const poly = polygonOf(cs.clipPath, b);
    const rr = cs.borderTopLeftRadius;
    const rx = Math.min(rr.endsWith('%') ? Math.min(b.w, b.h) * parseFloat(rr) / 100 : parseFloat(rr) || 0, b.w / 2, b.h / 2);
    const uniform = bw.every(w => w === bw[0]) && bw[0] > 0;
    let me = null;
    // shape="…": the library draws the element's background and border as that shape.
    const spec = e.hasAttribute('shape') ? parseShape(e.getAttribute('shape')) : null;
    if (spec?.error) problems.push({ rule: 'unknown-shape', shape: spec.error, ...(closest(spec.error, spec.options) ? { suggest: closest(spec.error, spec.options) } : {}) });
    if (spec && !spec.error) {
      const st = cs.borderTopStyle;
      out.push(...drawShape(spec, b, { fill: bg || 'none', stroke: bw[0] ? bc || 'var(--ink)' : 'none', width: bw[0], dash: st === 'dashed' ? '5 4' : st === 'dotted' ? '1.5 3' : '' }));
      me = { e, b, painted: true, parent: parentBox, bg, round: spec.round, plain: false };
      boxes.push(me);
    } else if (bg || uniform || bw.some(Boolean) || poly) {
      const stroke = uniform ? ` style="fill: ${bg || 'none'}; stroke: ${bc}" stroke-width="${bw[0]}"${dashed}` : ` style="fill: ${bg || 'none'}"`;
      if (poly) out.push(`<polygon points="${poly.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(' ')}"${stroke}></polygon>`);
      else if (uniform) { const h = bw[0] / 2; out.push(`<rect x="${fmt(b.x + h)}" y="${fmt(b.y + h)}" width="${fmt(b.w - bw[0])}" height="${fmt(b.h - bw[0])}" rx="${fmt(Math.max(0, rx - h))}"${stroke}></rect>`); }
      else if (bg) out.push(`<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" rx="${fmt(rx)}"${stroke}></rect>`);
      if (!uniform && !poly) {
        const sides = [[b.x, b.y, b.x + b.w, b.y], [b.x + b.w, b.y, b.x + b.w, b.y + b.h], [b.x, b.y + b.h, b.x + b.w, b.y + b.h], [b.x, b.y, b.x, b.y + b.h]];
        bw.forEach((w, i) => {
          if (!w) return;
          const side = ['Top', 'Right', 'Bottom', 'Left'][i], c = paintOf(cs[`border${side}Color`]) || 'var(--ink)', st = cs[`border${side}Style`];
          const [x1, y1, x2, y2] = sides[i], dx = i === 1 ? -w / 2 : i === 3 ? w / 2 : 0, dy = i === 0 ? w / 2 : i === 2 ? -w / 2 : 0;
          out.push(`<line x1="${fmt(x1 + dx)}" y1="${fmt(y1 + dy)}" x2="${fmt(x2 + dx)}" y2="${fmt(y2 + dy)}" style="stroke: ${c}" stroke-width="${w}"${st === 'dashed' ? ' stroke-dasharray="5 4"' : st === 'dotted' ? ' stroke-dasharray="1.5 3"' : ''}></line>`);
        });
      }
      me = { e, b, painted: true, parent: parentBox, bg, round: !!poly && poly.length === 4 || (rx >= Math.min(b.w, b.h) / 2 - 0.5 && Math.abs(b.w - b.h) < 2), plain: !bg && !bw.some(Boolean) && !poly };
      boxes.push(me);
    } else if (e.id) { me = { e, b, painted: false, parent: parentBox }; boxes.push(me); }
    if (cs.display === 'list-item' && cs.listStyleType === 'disc') {
      const first = e.firstChild && document.createRange();
      if (first) {
        first.selectNodeContents(e);
        const r = first.getClientRects()[0];
        if (r) { const fs = parseFloat(cs.fontSize); out.push(`<circle cx="${fmt(r.left - o.left - fs * 0.7)}" cy="${fmt(r.top - o.top + r.height * 0.55)}" r="${fmt(fs * 0.17)}" style="fill: ${paintOf(cs.color) || 'var(--ink)'}"></circle>`); }
      }
    }
    for (const c of e.childNodes) {
      if (c.nodeType === 3) textOf(c, e);
      else if (c.nodeType === 1 && c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT') visit(c, me || parentBox);
    }
    if (open) out.push('</g>');
  };
  for (const c of root.childNodes) {
    if (c.nodeType === 3) textOf(c, root);
    else if (c.nodeType === 1 && c.tagName !== 'STYLE') visit(c, null);
  }

  // ---------- connectors: route.js on the page's boxes ----------
  const far = drawingsReach(drawings);
  const W = Math.ceil(Math.max(root.scrollWidth, ...boxes.map(x => x.b.x + x.b.w + S.pad), ...texts.map(t => t.x + t.w + S.pad), far.x + S.pad));
  const H = Math.ceil(Math.max(...boxes.map(x => x.b.y + x.b.h + S.pad), ...texts.map(t => t.y + t.h + S.pad), far.y + S.pad, 2 * S.pad));
  const routes = connectors(boxes, texts, edges, drawings, problems, m, W, H, opts.previous);
  for (const r of routes) if (r.labelCrowded) problems.push({ rule: 'label-crowded', edge: `${r.edge.from} -> ${r.edge.to}`, label: r.edge.label, hint: 'widen the gap the line runs through, or shorten the label' });
  overlaps(routes, problems);
  shortEnds(routes, drawings, problems);
  const width = parseFloat(root.style.width);
  if (W > width + 2 * S.pad + 1) problems.push({ rule: 'page-overflow', width, content: W - 2 * S.pad, hint: 'the content is wider than width: widen width, or narrow the columns' });
  if (opts.debug) window.__debug = { log: globalThis.__routeLog, hard: globalThis.__routeHard, routes: routes.map(r => ({ from: r.edge.from, to: r.edge.to, points: r.points.map(p => [Math.round(p.x), Math.round(p.y)]) })) };

  // ---------- assemble ----------
  const markers = new Set(), lineOut = [], labelOut = [], drawOut = [];
  for (const rt of routes) {
    const e = rt.edge, tone = paintOf(toneOf(e.color)) || (e.accent ? 'var(--woad)' : 'var(--ink)');
    const ov = e.leg?.edge.override || e.override || {};
    const sides = (rt.out != null && rt.in != null ? ` data-sides="${SIDES[rt.out]},${SIDES[rt.in]}"` : '')
      + ['out', 'in'].filter(k => ov[k] != null).map(k => ` data-${k}="${SIDES[ov[k]]}"`).join('');
    lineOut.push(`<g data-edge="${esc(e.key)}"${sides}><path d="${rounded(rt.points, S.edge.radius)}" style="fill: none; stroke: ${tone}" stroke-width="${e.width || (e.accent ? 2 : S.edge.width)}"${endAttrs(id, e.ends, tone, markers)}></path></g>`);
    if (rt.label) {
      const halo = under(boxes, rt.label.x + rt.label.w / 2, rt.label.y + rt.label.h / 2) || 'var(--bg)';
      labelOut.push(`<text class="${T.edge}" x="${fmt(rt.label.x)}" y="${fmt(m.baseline(rt.label.y, rt.label.h, T.edge))}" style="fill: var(--ink); paint-order: stroke; stroke: ${halo}; stroke-width: 4px; stroke-linejoin: round">${esc(rt.label.text)}</text>`);
    }
  }
  for (const d of drawings) {
    const o2 = d.o, color = paintOf(toneOf(o2.color || o2.tone)) || 'var(--ink)';
    if (d.kind === 'path') {
      drawOut.push(`<path d="${d.d}" style="fill: ${paintOf(toneOf(o2.fill)) || 'none'}; stroke: ${color}" stroke-width="${o2.width || S.edge.width}"${endAttrs(id, endsOf(o2, false, problems), color, markers)}></path>`);
      // arrow and curve labels: beside the middle of a vertical line, above a horizontal one.
      if (o2.label && d.via) {
        const [p, q] = d.ends, upright = Math.abs(q.x - p.x) < Math.abs(q.y - p.y), x = d.via.x + (upright ? 7 : 0), y = d.via.y - (upright ? 0 : 9);
        const halo = under(boxes, x, y) || 'var(--bg)';
        labelOut.push(`<text class="${T.edge}" x="${fmt(x)}" y="${fmt(y + 4)}" text-anchor="${upright ? 'start' : 'middle'}" style="fill: var(--ink); paint-order: stroke; stroke: ${halo}; stroke-width: 4px; stroke-linejoin: round">${esc(o2.label)}</text>`);
      }
    } else if (d.kind === 'gate') {
      const s = (o2.size || 30) / 2, { x, y } = d.p, fill = paintOf(toneOf(o2.fill || o2.tone || 'rust')) || 'var(--rust)';
      drawOut.push(`<polygon points="${fmt(x)},${fmt(y - s)} ${fmt(x + s)},${fmt(y)} ${fmt(x)},${fmt(y + s)} ${fmt(x - s)},${fmt(y)}" style="fill: ${fill}; stroke: var(--card)" stroke-width="2"></polygon>`);
      if (d.label) drawOut.push(`<text x="${fmt(x)}" y="${fmt(y + 4)}" text-anchor="middle" style="font: 700 11px Inter, 'Segoe UI', system-ui, sans-serif; fill: var(--card)">${esc(d.label)}</text>`);
    } else if (d.kind === 'text') {
      const size = o2.size || 12, anchor = o2.anchor || 'middle';
      drawOut.push(`<text x="${fmt(d.p.x)}" y="${fmt(d.p.y + size * 0.35)}" text-anchor="${anchor}" style="font: ${o2.italic ? 'italic ' : ''}${o2.weight || 400} ${size}px Inter, 'Segoe UI', system-ui, sans-serif; fill: ${color}">${esc(d.str)}</text>`);
    } else if (d.kind === 'icon') {
      const s = o2.size || 24;
      drawOut.push(`<use href="#${d.sym}" x="${fmt(d.p.x - s / 2)}" y="${fmt(d.p.y - s / 2)}" width="${s}" height="${s}"></use>`);
    } else if (d.kind === 'shape') {
      // The same library as shape="…"; BPMN events and gateways default to their sizes.
      const spec = parseShape(d.shape);
      if (spec.error) { problems.push({ rule: 'unknown-shape', shape: spec.error, ...(closest(spec.error, spec.options) ? { suggest: closest(spec.error, spec.options) } : {}) }); continue; }
      const size = o2.size || (['start', 'event', 'end'].includes(spec.base) ? 36 : spec.base === 'gateway' ? 44 : spec.base === 'cycle' ? 28 : 24);
      const w = o2.w || size, h = o2.h || (o2.w ? w : size);
      drawOut.push(...drawShape(spec, { x: d.p.x - w / 2, y: d.p.y - h / 2, w, h },
        { fill: paintOf(toneOf(o2.fill || 'card')), stroke: paintOf(toneOf(o2.stroke || o2.color)) || 'var(--ink)', width: o2.width || (spec.base === 'end' ? 3 : 1.5), dash: o2.dashed ? '5 4' : '' }));
    }
  }
  check(texts, problems);
  const defs = [...[...markers].map(k => {
    const [mid, kind, color] = k.split('|'), [ref, body] = MARKER[kind];
    return `<marker id="${mid}" viewBox="0 0 10 10" refX="${ref}" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">${body(color)}</marker>`;
  }), ...symbols.values()];
  const label = [el.getAttribute('title'), el.getAttribute('subtitle')].filter(Boolean).join('. ') || 'Diagram';
  const style = opts.standalone ? `<style>${opts.css}</style>\n` : '';
  const theme = opts.theme === 'dark' ? ' data-theme="dark"' : '';
  // The figure paints its own background, so it reads on a dark page as on a light one:
  // the theme's --bg, a colour of the author's (background="#fff"), or none (background=none).
  const bgAttr = (el.getAttribute('background') || '').trim();
  const bg = bgAttr === 'none' ? '' : `<rect class="g-bg" width="${W}" height="${H}" style="fill: ${bgAttr ? esc(bgAttr) : 'var(--bg)'}"></rect>\n`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="graphally"${theme}${opts.source ? ` data-source="${esc(opts.source)}"` : ''} viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">\n${style}<defs>${defs.join('\n')}</defs>\n${bg}<g>\n${out.join('\n')}\n${lineOut.join('\n')}\n${drawOut.join('\n')}\n${labelOut.join('\n')}\n</g>\n</svg>`;
  return { svg, width: W, height: H, problems, stats: { nodes: boxes.filter(x => x.e.id).length, groups: 0, edges: routes.length, crossings: crossings(routes) }, snapshot: null };
}

// One marker per kind and colour: "<id>-m<n>|<kind>|<colour>" keys keep both for the defs.
function markerId(id, kind, color, markers) {
  const existing = [...markers].find(k => k.endsWith(`|${kind}|${color}`));
  if (existing) return existing.split('|')[0];
  const mid = `${id}-m${markers.size}`;
  markers.add(`${mid}|${kind}|${color}`);
  return mid;
}
// marker-start and marker-end attributes for a line's ends.
const endAttrs = (id, en, color, markers) =>
  `${en.dash ? ` stroke-dasharray="${en.dash}"` : ''}${en.head !== 'none' ? ` marker-end="url(#${markerId(id, en.head, color, markers)})"` : ''}${en.tail !== 'none' ? ` marker-start="url(#${markerId(id, en.tail, color, markers)})"` : ''}`;
const toneOf = v => (v && TOKENS.includes(TONE_ALIASES[v] || v) ? `var(--${TONE_ALIASES[v] || v})` : v);

// head, tail and dash of a line from its options. message: a BPMN message flow (dashed, an open
// circle at the source, an open arrowhead). arrowDefault: whether the line has a head unless told.
function endsOf(o, arrowDefault, problems) {
  const head = o.head ?? (o.message ? 'open' : o.arrow === false ? 'none' : o.arrow || arrowDefault ? 'arrow' : 'none');
  const tail = o.tail ?? (o.message ? 'circle' : o.both ? head : 'none');
  for (const v of [head, tail]) if (!ENDS.includes(v)) problems.push({ rule: 'bad-option', option: 'head/tail', value: v, hint: ENDS.join(', ') });
  return { head: ENDS.includes(head) ? head : 'arrow', tail: ENDS.includes(tail) ? tail : 'none',
    dash: o.message || o.dashed || o.async ? '5 4' : o.dotted ? '1.5 3' : '' };
}
const MARKER = {
  arrow: [9, c => `<path d="M0,0 L10,5 L0,10 z" style="fill: ${c}"></path>`],
  open: [9, c => `<path d="M1,1 L9,5 L1,9" style="fill: none; stroke: ${c}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>`],
  circle: [9, c => `<circle cx="5" cy="5" r="3.7" style="fill: var(--card); stroke: ${c}" stroke-width="1.3"></circle>`],
  dot: [8.5, c => `<circle cx="5" cy="5" r="3.3" style="fill: ${c}"></circle>`],
  diamond: [10, c => `<path d="M0,5 L5,1.5 L10,5 L5,8.5 z" style="fill: ${c}"></path>`],
  'open-diamond': [10, c => `<path d="M0.6,5 L5,1.9 L9.4,5 L5,8.1 z" style="fill: var(--card); stroke: ${c}" stroke-width="1.2"></path>`],
};

const arcPoint = (c, r, deg) => ({ x: c.x + r * Math.cos(deg * Math.PI / 180), y: c.y + r * Math.sin(deg * Math.PI / 180) });

// How far right and down the script's drawings reach, so the figure grows to hold them. A
// path counts its points and control points (a curve stays inside them); text is measured
// roughly, from its size.
function drawingsReach(drawings) {
  let x = 0, y = 0;
  const reach = (px, py) => { if (px > x) x = px; if (py > y) y = py; };
  for (const d of drawings) {
    const o = d.o || {};
    if (d.kind === 'path') {
      const w = (o.width || 1.5) / 2 + 5;
      const pts = d.pts || [...d.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
      for (const p of pts) reach(p.x + w, p.y + w);
    } else if (d.kind === 'text') {
      const size = o.size || 12, wide = d.str.length * size * 0.6, anchor = o.anchor || 'middle';
      reach(d.p.x + (anchor === 'start' ? wide : anchor === 'middle' ? wide / 2 : 0), d.p.y + size);
    } else if (d.kind === 'gate' || d.kind === 'icon') {
      const s = (o.size || (d.kind === 'gate' ? 30 : 24)) / 2;
      reach(d.p.x + s, d.p.y + s);
    } else if (d.kind === 'shape') {
      const size = o.size || 44, w = o.w || size, h = o.h || (o.w ? w : size);
      reach(d.p.x + w / 2, d.p.y + h / 2);
    }
  }
  return { x, y };
}

function pathBuilder(start, drawings, point) {
  const d = [`M${fmt(start.x)},${fmt(start.y)}`], item = { kind: 'path', d: '', o: {}, pts: [start] };
  drawings.push(item);
  const sync = () => { item.d = d.join(' '); return api; };
  const api = {
    lineTo: p => { p = point(p); item.pts.push(p); d.push(`L${fmt(p.x)},${fmt(p.y)}`); return sync(); },
    quadraticCurveTo: (c, p) => { [c, p] = [point(c), point(p)]; item.pts.push(c, p); d.push(`Q${fmt(c.x)},${fmt(c.y)} ${fmt(p.x)},${fmt(p.y)}`); return sync(); },
    bezierCurveTo: (c1, c2, p) => { [c1, c2, p] = [point(c1), point(c2), point(p)]; item.pts.push(c1, c2, p); d.push(`C${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(p.x)},${fmt(p.y)}`); return sync(); },
    // arc(centre, radius, startDeg, endDeg): degrees clockwise from the right, as in canvas.
    arc: (c, r, a0, a1) => {
      c = point(c);
      const p = arcPoint(c, r, a0), q = arcPoint(c, r, a1), sweep = a1 > a0 ? 1 : 0, large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      for (let k = 0; k <= 24; k++) item.pts.push(arcPoint(c, r, a0 + (a1 - a0) * k / 24));
      d.push(`L${fmt(p.x)},${fmt(p.y)} A${fmt(r)},${fmt(r)} 0 ${large} ${sweep} ${fmt(q.x)},${fmt(q.y)}`);
      return sync();
    },
    closePath: () => { d.push('Z'); return sync(); },
    style: o => { Object.assign(item.o, o); return api; },
  };
  sync();
  return api;
}

// The colours of the theme tokens, so a box painted var(--wash) stays var(--wash) in the SVG
// (and follows the dark theme).
function tokenColors(root) {
  const probe = document.createElement('div');
  root.appendChild(probe);
  const map = new Map();
  for (const t of TOKENS) { probe.style.color = `var(--${t})`; const c = getComputedStyle(probe).color; if (!map.has(c)) map.set(c, `var(--${t})`); }
  probe.remove();
  return map;
}

// The innermost painted box under a point: its colour is the halo behind a label there.
function under(boxes, x, y) {
  let best = null;
  for (const b of boxes) if (b.bg && x >= b.b.x && x <= b.b.x + b.b.w && y >= b.b.y && y <= b.b.y + b.b.h && (!best || b.b.w * b.b.h < best.b.w * best.b.h)) best = b;
  return best?.bg;
}

// The page's boxes become route.js nodes and groups: a box that holds other boxes is a group
// (a line may cross into it), the rest are nodes (lines go round them). Text that sits in no
// node is an obstacle too, so lines do not run through headings or free text.
function connectors(boxes, texts, calls, drawings, problems, m, W, H, previous) {
  if (!calls.length) return [];
  // previous: the layout of the last render; a line keeps the sides it used there (soft).
  const keyOf = new Map(), model = { nodes: new Map(), groups: new Map(), edges: [], problems, previous: previous || null, attrs: {} };
  const rootG = { id: '__root', kind: 'group', style: 'root', children: [], parent: null, depth: -1 };
  model.groups.set('__root', rootG);
  // The author set the gaps; a 6px clearance lets lines use any gap wider than 12px.
  const geo = { nodes: new Map(), groups: new Map(), extraObstacles: [], title: null, legend: null, width: W, height: H, nodePad: 6 };
  // The script's straight lines (gate lines, arrows) are taken: connections avoid running on them.
  geo.taken = [];
  for (const d of drawings) {
    if (d.kind !== 'path') continue;
    let prev = null;
    for (const [, cmd, x, y] of d.d.matchAll(/([MLQCAZ])\s*(?:(-?[\d.]+),(-?[\d.]+))?/g)) {
      const p = cmd === 'M' || cmd === 'L' ? { x: +x, y: +y } : null;   // only M and L end where their first pair says
      if (p && cmd === 'L' && prev) {
        if (Math.abs(p.x - prev.x) < 0.5) geo.taken.push({ x1: prev.x, y1: prev.y, x2: prev.x, y2: p.y });
        else if (Math.abs(p.y - prev.y) < 0.5) geo.taken.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: prev.y });
      }
      prev = p;
    }
  }
  // An icon without an id is part of the box it sits in: that box stays one solid card.
  const decor = b => b.e.tagName === 'ICON' && !b.e.id;
  const hasChild = new Set(boxes.filter(b => !decor(b)).map(b => b.parent).filter(Boolean));
  let n = 0;
  // Boxes without an id are named by tag and class in problems: div.lane@2.
  boxes.forEach(b => keyOf.set(b, b.e.id || `${b.e.tagName.toLowerCase()}${[...b.e.classList].map(c => `.${c}`).join('')}@${n++}`));
  const objOf = new Map();
  // Whole pixels, as snapToPixels in index.js: the router's grid is rounded, and a fractional
  // box edge (a 1fr column) rounds inside its own box and blocks every port on that side.
  const px = r => { const x = Math.round(r.x), y = Math.round(r.y); return { x, y, w: Math.round(r.x + r.w) - x, h: Math.round(r.y + r.h) - y }; };
  // A full-width strip without an id (a section's header bar, a divider) is decoration: lines
  // may cross it; its text still blocks them.
  const strip = b => !b.e.id && !hasChild.has(b) && b.parent && Math.abs(b.b.w - b.parent.b.w) <= 6 && b.b.h <= 48;
  // So is a box painted behind boxes it does not hold in the HTML (a lane's or a band's
  // background in the same grid cells): it would otherwise wall in everything on top of it.
  const ends = new Set(calls.flatMap(c => [c.from, c.to]));
  const holds = (a, q) => q.x >= a.x - 0.5 && q.y >= a.y - 0.5 && q.x + q.w <= a.x + a.w + 0.5 && q.y + q.h <= a.y + a.h + 0.5;
  const behind = b => !hasChild.has(b) && !ends.has(b.e) && boxes.some((o, i) => i > boxes.indexOf(b) && holds(b.b, o.b));
  const ensure = b => {
    if (!b) return rootG;
    if (objOf.has(b)) return objOf.get(b);
    if (strip(b) || behind(b) || (decor(b) && b.parent && !hasChild.has(b.parent))) { const p = ensure(b.parent); objOf.set(b, p); return p; }
    const parent = ensure(b.parent), key = keyOf.get(b);
    const isGroup = hasChild.has(b);
    const obj = isGroup ? { id: key, kind: 'group', style: b.plain || !b.painted ? 'plain' : 'box', children: [], parent, depth: parent.depth + 1 } : { id: key, kind: 'node', parent, shape: '' };
    objOf.set(b, obj);
    (isGroup ? model.groups : model.nodes).set(key, obj);
    parent.children?.push(obj);
    (isGroup ? geo.groups : geo.nodes).set(key, isGroup ? { ...px(b.b), group: obj } : { ...px(b.b), node: obj, round: b.round });
    return obj;
  };
  boxes.forEach(ensure);
  const inNode = t => [...geo.nodes.values()].some(r => t.x >= r.x - 1 && t.y >= r.y - 1 && t.x + t.w <= r.x + r.w + 1 && t.y + t.h <= r.y + r.h + 1);
  texts.forEach(t => { if (!inNode(t)) geo.extraObstacles.push({ id: `text "${t.str.length > 24 ? `${t.str.slice(0, 24)}…` : t.str}"`, ...px(t) }); });
  const boxFor = e => boxes.find(b => b.e === e);
  const seen = new Map();
  calls.forEach((c, i) => {
    const fb = boxFor(c.from), tb = boxFor(c.to);
    if (!fb || !tb) { problems.push({ rule: 'unknown-id', id: (!fb ? c.from : c.to).id || '(element without id)' }); return; }
    const from = keyOf.get(fb), to = keyOf.get(tb), base = c.o.id || `${from}->${to}`, k = (seen.get(base) || 0) + 1;
    seen.set(base, k);
    for (const k of ['out', 'in']) if (c.o[k] != null && !SIDES.includes(c.o[k])) problems.push({ rule: 'bad-option', option: k, value: String(c.o[k]), hint: 'a side: top, right, bottom or left' });
    const override = Object.fromEntries(['out', 'in'].filter(s => SIDES.includes(c.o[s])).map(s => [s, SIDES.indexOf(c.o[s])]));
    const edge = { id: `e${i}`, key: k > 1 ? `${base}#${k}` : base, from, to, label: c.o.label || '', ends: endsOf(c.o, true, problems),
      accent: !!c.o.accent, color: c.o.color, width: c.o.width, stmt: c.stmt, ...(Object.keys(override).length ? { override } : {}) };
    if (!c.via.length) { model.edges.push(edge); return; }
    // via: each waypoint is a point the router passes through (it blocks nothing), and the line
    // is routed leg by leg; the legs are joined again below. The label goes on the middle leg.
    const stops = [from, ...c.via.map((p, j) => {
      const vid = `${edge.key}~${j + 1}`, obj = { id: vid, kind: 'node', parent: rootG, shape: '' };
      model.nodes.set(vid, obj);
      geo.nodes.set(vid, { x: Math.round(p.x), y: Math.round(p.y), w: 0, h: 0, node: obj, round: true, virtual: true });
      return vid;
    }), to], n = stops.length - 1;
    for (let j = 0; j < n; j++) {
      const ov = { ...(j === 0 && edge.override?.out != null ? { out: edge.override.out } : {}), ...(j === n - 1 && edge.override?.in != null ? { in: edge.override.in } : {}) };
      const { override, ...rest } = edge;
      model.edges.push({ ...rest, id: `${edge.id}~${j}`, key: `${edge.key}~${j}`, from: stops[j], to: stops[j + 1], label: j === n >> 1 ? edge.label : '',
        stmt: 0, leg: { edge, i: j, n }, ...(Object.keys(ov).length ? { override: ov } : {}) });
    }
  });
  return joinLegs(routeEdges(model, geo, m));
}

// The legs of a line routed through waypoints, joined back into one route.
function joinLegs(routes) {
  const out = [], legs = new Map();
  for (const rt of routes) {
    const L = rt.edge.leg;
    if (!L) { out.push(rt); continue; }
    (legs.get(L.edge) || legs.set(L.edge, []).get(L.edge))[L.i] = rt;
  }
  for (const [edge, parts] of legs) {
    if (parts.filter(Boolean).length !== parts.find(Boolean).edge.leg.n) continue;   // a leg failed: reported as unroutable
    out.push({ edge, points: parts.flatMap((r, i) => (i ? r.points.slice(1) : r.points)), label: parts.find(r => r.label)?.label, labelCrowded: parts.some(r => r.labelCrowded), out: parts[0].out, in: parts.at(-1).in });
  }
  return out;
}

function check(texts, problems) {
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.owner === b.owner) continue;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 2 && oy > 2) problems.push({ rule: 'text-overlap', a: a.owner.id || a.owner.tagName.toLowerCase(), b: b.owner.id || b.owner.tagName.toLowerCase(), hint: 'give the text more room, or move one of them' });
  }
}

// An arrowhead or tail mark on an end segment shorter than 12px sits on the bend before it.
function shortEnds(routes, drawings, problems) {
  const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y), MIN = 12;
  const report = (line, end) => problems.push({ rule: 'short-end', line, end, hint: 'the mark sits on a bend: give the line more room before the box, or other sides or via points' });
  for (const r of routes) {
    const p = r.points, en = r.edge.ends;
    if (en.head !== 'none' && len(p.at(-2), p.at(-1)) < MIN) report(r.edge.key, 'head');
    if (en.tail !== 'none' && len(p[0], p[1]) < MIN) report(r.edge.key, 'tail');
  }
  for (const d of drawings) {
    if (d.kind !== 'path' || /[QCA]/.test(d.d)) continue;              // curves and arcs: their own shape
    const p = [...d.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] })), en = endsOf(d.o, false, []);
    if (p.length < 2) continue;
    const name = d.o.label || 'a drawn line';
    if (en.head !== 'none' && len(p.at(-2), p.at(-1)) < MIN) report(name, 'head');
    if (en.tail !== 'none' && len(p[0], p[1]) < MIN) report(name, 'tail');
  }
}

// Two routed lines on one stretch of the same track read as one line.
function overlaps(routes, problems) {
  const segs = routes.map(r => r.points.slice(1).map((q, i) => [r.points[i], q]).filter(([p, q]) => Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5));
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const a = routes[i].edge, b = routes[j].edge;
    if (routes[i].tree && routes[i].tree === routes[j].tree) continue;   // a bundle's lines merged into one trunk
    const shared = segs[i].some(([p, q]) => segs[j].some(([u, v]) => {
      const flat = Math.abs(p.y - q.y) < 0.5, same = flat ? Math.abs(u.y - v.y) < 0.5 && Math.abs(p.y - u.y) < 2 : Math.abs(u.x - v.x) < 0.5 && Math.abs(p.x - u.x) < 2;
      if (!same) return false;
      const [k] = flat ? ['x'] : ['y'], lo = Math.max(Math.min(p[k], q[k]), Math.min(u[k], v[k])), hi = Math.min(Math.max(p[k], q[k]), Math.max(u[k], v[k]));
      return hi - lo > 12;
    }));
    if (shared) problems.push({ rule: 'lines-overlap', a: a.key, b: b.key, hint: 'give one of them via points or other sides' });
  }
}

function crossings(routes) {
  const segs = routes.map(r => r.points.slice(1).map((q, i) => [r.points[i], q]));
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++)
    for (const [a, b] of segs[i]) for (const [c, d] of segs[j]) {
      const h1 = Math.abs(a.y - b.y) < 0.5, h2 = Math.abs(c.y - d.y) < 0.5;
      if (h1 === h2) continue;
      const [hs, vs] = h1 ? [[a, b], [c, d]] : [[c, d], [a, b]];
      const x = vs[0].x, y = hs[0].y;
      if (x > Math.min(hs[0].x, hs[1].x) + 1 && x < Math.max(hs[0].x, hs[1].x) - 1 && y > Math.min(vs[0].y, vs[1].y) + 1 && y < Math.max(vs[0].y, vs[1].y) - 1) n++;
    }
  return n;
}

function closest(s, list) {
  const d = (a, b) => {
    const mm = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { let prev = mm[0]; mm[0] = i; for (let j = 1; j <= b.length; j++) { const t = mm[j]; mm[j] = Math.min(mm[j] + 1, mm[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
    return mm[b.length];
  };
  const best = list.map(x => [x, d(s, x)]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, s.length / 3) ? best[0] : undefined;
}
