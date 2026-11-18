// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// <diagram>: the page is the layout. The author writes ordinary HTML and CSS; the
// browser places everything. An optional <script> then runs with the geometry of every
// element and connects and draws by name: el('id').right, mid(a, b), connect(a, b), arrow,
// curve, draw.moveTo(…).lineTo(…), gate, text, icon, shape. Nobody writes a coordinate.
// This file turns the laid-out page into SVG: backgrounds, borders, clip-path shapes, text
// line by line, icons; then the connectors (routed by route.js) and the script's drawings.
import { S, T, hostTheme, shadowBox } from './style.js';
import { schedule, timeline } from './time.js';
import { sequence } from './seq.js';
import { utilitiesFor } from './utilities.js';
import { resolveIcon, symbolFor } from './icons.js';
import { routeEdges } from './route.js';
import { parseShape, drawShape, SHAPE_CSS } from './shapes.js';
import * as paint from './paint.js';
import { fmt, roundTo, openTag, svgElement, attributesOf, boxAttributes } from './svg.js';

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
const ENDS = ['arrow', 'open', 'circle', 'dot', 'diamond', 'open-diamond', 'slash', 'none'];

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
/* disabled: a part that is there but does not run. Grey, faded and dashed, icon included;
   a line to or from it turns grey and dashed too. */
:where(.graphally-page .disabled) { filter: grayscale(1); opacity: .5; }
:where(.graphally-page :is(.node, .tile, .card, .box, .group, .swatch).disabled) { border-style: dashed; }
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
  // Laid out in a shadow root, the page is the diagram's own: its <style> applies to it alone,
  // and the CSS of a page it is embedded in (a site theme, a .card of its own) stays out.
  const box = shadowBox(`${hostTheme(opts.css)}\n${PAGE_CSS}${SHAPE_CSS}`);
  box.host.dataset.theme = opts.theme === 'dark' ? 'dark' : 'light';
  box.root.append(root);
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
  paint.materializePseudo(root);
  try {
    return build(root, el, id, scripts, lines, opts, m, problems);
  } finally {
    box.host.remove();
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

  const pageRect = root.getBoundingClientRect();
  const boxOf = element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left - pageRect.left, y: rect.top - pageRect.top, w: rect.width, h: rect.height };
  };
  const colors = tokenColors(root);
  const paintOf = c => (!c || /rgba\(.*,\s*0\)$/.test(c) || c === 'transparent' ? null : colors.get(c) || portable(c));

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
  // animate(): what moves, keyed for the SVG; see motionCss. An element's output is wrapped in
  // a group of its own (animOf), a drawn mark carries its index (mark.anim).
  const anims = [], animOf = new Map();
  const markBox = m => {
    const ps = m.pts || m.ends;
    if (ps) { const xs = ps.map(q => q.x), ys = ps.map(q => q.y), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
    const sz = m.kind === 'text' ? 0 : m.o.size || (m.kind === 'gate' ? 30 : m.kind === 'shape' ? 36 : 24), w = m.o.w || sz, h = m.o.h || (m.o.w ? w : sz);
    return { x: m.p.x - w / 2, y: m.p.y - h / 2, w, h };
  };
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
    arrow(a, b, o2 = {}) { const [p, q] = ends(a, b); return mark({ kind: 'path', d: `M${fmt(p.x)},${fmt(p.y)} L${fmt(q.x)},${fmt(q.y)}`, o: { arrow: true, ...o2 }, ends: [p, q], via: api.mid(p, q) }); },
    curve(a, b, o2 = {}) {
      const [p, q] = ends(a, b), bend = opt(o2.bend, 40), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
      const c = { x: (p.x + q.x) / 2 - dy / len * bend, y: (p.y + q.y) / 2 + dx / len * bend };
      return mark({ kind: 'path', d: `M${fmt(p.x)},${fmt(p.y)} Q${fmt(c.x)},${fmt(c.y)} ${fmt(q.x)},${fmt(q.y)}`, o: { arrow: true, ...o2 }, ends: [p, q], via: pt((p.x + 2 * c.x + q.x) / 4, (p.y + 2 * c.y + q.y) / 4) });
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
    gate(p, label = '', o2 = {}) { return mark({ kind: 'gate', p: point(p), label, o: o2 }); },
    text(p, str, o2 = {}) { return mark({ kind: 'text', p: point(p), str: String(str), o: o2 }); },
    icon(p, name, o2 = {}) {
      const r = resolveIcon(name, order);
      if (!r || r.error) { problems.push({ rule: 'unknown-icon', icon: name, suggest: r?.suggestions }); return; }
      const sym = symbolFor(r, id);
      symbols.set(sym.id, sym.markup);
      return mark({ kind: 'icon', p: point(p), sym: sym.id, o: o2 });
    },
    shape(kind, p, o2 = {}) { return mark({ kind: 'shape', shape: kind, p: point(p), o: o2 }); },
    // animate(target, keyframes, options), as element.animate in a browser: an element (id,
    // selector, box) or a mark the script drew moves when the figure is shown. The still figure
    // is where it rests.
    animate(ref, frames, o2 = {}) {
      if (!Array.isArray(frames) || !frames.length) throw new Error('animate takes a list of keyframes, as element.animate does');
      const marked = ref?.mark, targets = marked ? [marked] : find(ref);
      for (const t of targets) {
        const box = marked ? markBox(marked) : t, i = anims.length;
        anims.push({ frames, o: o2, origin: originOf(o2.origin, box) });
        if (marked) marked.anim = i; else animOf.set(t.el, i);
      }
    },
  };
  // A drawn mark, and the handle the script gets for it (to animate it).
  function mark(item) { drawings.push(item); return { mark: item }; }
  // The point an animation turns and scales about: keywords and percentages of the target's
  // box ('center', '50% 20%', 'left top'), px from its top left, or a point or element.
  const originOf = (v, box) => {
    if (v != null && typeof v === 'object') return point(v);
    const words = String(v ?? 'center').trim().split(/\s+/);
    if (/^(top|bottom)$/.test(words[0])) words.reverse();
    const at = (w = 'center', len) => (/%$/.test(w) ? len * parseFloat(w) / 100 : /px$/.test(w) ? parseFloat(w) : len * ({ left: 0, top: 0, right: 1, bottom: 1 }[w] ?? 0.5));
    return pt(box.x + at(words[0], box.w), box.y + at(words[1], box.h));
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

  // ----- text -----
  const textMeasure = document.createElement('canvas').getContext('2d');
  const fontOf = style => `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const ascentOf = style => {
    textMeasure.font = fontOf(style);
    return textMeasure.measureText('Hg').fontBoundingBoxAscent;
  };
  const CASE = { uppercase: text => text.toUpperCase(), lowercase: text => text.toLowerCase() };
  const casedFor = style => CASE[style.textTransform] || (text => text);

  // The lines a text node wraps to, each with its words and its place on the page. The browser
  // may break a word at a hyphen, so a word is read piece by piece, one piece per line.
  const linesOf = node => {
    const range = document.createRange(), lines = [];
    const rectsOf = (from, to) => {
      range.setStart(node, from);
      range.setEnd(node, to);
      return [...range.getClientRects()].filter(rect => rect.width);
    };
    const piecesOf = (start, word) => {
      const end = start + word.length;
      if (rectsOf(start, end).length <= 1) return [[word, rectsOf(start, end)[0]]];
      const breaks = [0];
      let lineTop = rectsOf(start, start + 1)[0]?.top;
      for (let index = 1; index < word.length; index++) {
        const top = rectsOf(start + index, start + index + 1)[0]?.top;
        if (top != null && lineTop != null && Math.abs(top - lineTop) > 2) breaks.push(index);
        if (top != null) lineTop = top;
      }
      breaks.push(word.length);
      return breaks.slice(1).map((pieceEnd, piece) =>
        [word.slice(breaks[piece], pieceEnd), rectsOf(start + breaks[piece], start + pieceEnd)[0]]);
    };
    for (const match of node.textContent.matchAll(/\S+/g)) {
      for (const [word, rect] of piecesOf(match.index, match[0])) {
        if (!rect) continue;
        const top = rect.top - pageRect.top;
        let line = lines.find(candidate => Math.abs(candidate.top - top) < 2);
        if (!line) {
          line = { top, left: rect.left - pageRect.left, right: 0, words: [], height: rect.height };
          lines.push(line);
        }
        line.words.push(word);
        line.right = rect.right - pageRect.left;
      }
    }
    return lines;
  };
  // Underline and line-through reach the text from its own element or any one around it.
  const decorationsOf = owner => {
    const decorations = new Set();
    for (let element = owner; element && element !== root; element = element.parentElement) {
      for (const decoration of getComputedStyle(element).textDecorationLine.split(' ')) {
        if (decoration === 'underline' || decoration === 'line-through') decorations.add(decoration);
      }
    }
    return [...decorations];
  };
  // The style attribute of a line of text: its font, spacing, decoration and colour.
  const textStyleOf = (style, owner) => {
    const decorations = decorationsOf(owner);
    return [
      `font-family: ${esc(style.fontFamily)}`,
      `font-size: ${style.fontSize}`,
      `font-weight: ${style.fontWeight}`,
      style.fontStyle !== 'normal' && `font-style: ${style.fontStyle}`,
      style.letterSpacing !== 'normal' && `letter-spacing: ${style.letterSpacing}`,
      decorations.length && `text-decoration: ${decorations.join(' ')}`,
      `fill: ${paintOf(style.color) || 'var(--ink)'}`,
    ].filter(Boolean).join('; ');
  };
  // text-overflow: ellipsis on the block that clips a line: the right edge of the block's
  // content box, where the browser cuts the line. Null when nothing cuts it.
  const ellipsisEdgeOf = owner => {
    let block = owner;
    const isInline = element => getComputedStyle(element).display.startsWith('inline');
    while (block !== root && isInline(block)) block = block.parentElement;
    const blockStyle = getComputedStyle(block);
    if (blockStyle.textOverflow !== 'ellipsis' || blockStyle.overflowX === 'visible') return null;
    const contentRight = block.getBoundingClientRect().right - pageRect.left;
    return contentRight - parseFloat(blockStyle.borderRightWidth) - parseFloat(blockStyle.paddingRight);
  };
  // The longest start of the text that fits the width with an ellipsis after it.
  const withEllipsis = (text, style, width) => {
    textMeasure.font = fontOf(style);
    let kept = text;
    while (kept && textMeasure.measureText(`${kept}…`).width > width) kept = kept.slice(0, -1);
    return `${kept.trimEnd()}…`;
  };
  // A text node becomes one <text> per line it wraps to, at the place the browser gave it.
  const textOf = (node, owner) => {
    if (!node.textContent.trim()) return;
    const style = getComputedStyle(owner);
    const ascent = ascentOf(style), cased = casedFor(style);
    const lines = linesOf(node);
    const textStyle = textStyleOf(style, owner);
    const ellipsisEdge = ellipsisEdgeOf(owner);
    for (const line of lines) {
      let text = cased(line.words.join(' '));
      if (ellipsisEdge != null && line.right > ellipsisEdge + 0.5) {
        text = withEllipsis(text, style, ellipsisEdge - line.left);
        line.right = line.left + textMeasure.measureText(text).width;
      }
      texts.push({ x: line.left, y: line.top, w: line.right - line.left, h: line.height, owner, str: text });
      const position = { x: fmt(line.left), y: fmt(line.top + ascent) };
      out.push(svgElement('text', { ...position, style: textStyle }, esc(text)));
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
  // ----- pictures: icons, images and inline SVG -----
  const IMAGE_ASPECT = { contain: 'xMidYMid meet', 'scale-down': 'xMidYMid meet', cover: 'xMidYMid slice' };
  const PICTURE_TAGS = new Set(['ICON', 'IMG', 'svg']);
  const isPicture = element => PICTURE_TAGS.has(element.tagName);
  const inkOf = style => paintOf(style.color) || 'var(--ink)';

  // An inline <svg>, copied into the figure at its content box and coloured by its CSS colour.
  // Without a viewBox, the drawing keeps the size its own width and height gave it.
  const inlineSvgOf = (element, style, placement) => {
    const copy = element.cloneNode(true);
    for (const attribute of ['x', 'y', 'width', 'height', 'style', 'class', 'id']) {
      copy.removeAttribute(attribute);
    }
    const width = element.getAttribute('width'), height = element.getAttribute('height');
    if (!copy.hasAttribute('viewBox') && Number(width) > 0 && Number(height) > 0) {
      copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    copy.setAttribute('style', `color: ${inkOf(style)}`);
    return new XMLSerializer().serializeToString(copy).replace(/^<svg /, `<svg${attributesOf(placement)} `);
  };
  // An <img>, embedded as a data: URL by the CLI (run.js) so the SVG keeps it wherever it is
  // opened. An image that did not load, or could not be embedded, is reported.
  const imageOf = (element, style, placement) => {
    const source = element.currentSrc || element.src;
    const written = element.dataset.src || element.getAttribute('src') || '';
    if (!element.complete || !element.naturalWidth) {
      problems.push({
        rule: 'image-missing', src: written,
        hint: 'the image did not load: check the path, relative to the diagram file',
      });
      return null;
    }
    if (!source.startsWith('data:')) {
      problems.push({
        rule: 'image-link', warn: true, src: written,
        hint: 'the SVG links the image instead of holding it: use a file next to the diagram',
      });
    }
    const aspect = IMAGE_ASPECT[style.objectFit] || 'none';
    return svgElement('image', { href: esc(source), ...placement, preserveAspectRatio: aspect });
  };
  const drawPicture = (element, style, box) => {
    if (element.tagName === 'ICON') {
      if (!element.dataset.symbol) return;
      const symbol = { href: `#${element.dataset.symbol}`, ...boxAttributes(box) };
      out.push(svgElement('use', { ...symbol, style: `color: ${inkOf(style)}` }));
      return;
    }
    const placement = boxAttributes(paint.contentBoxOf(style, box));
    const drawn = element.tagName === 'svg' ? inlineSvgOf : imageOf;
    const picture = drawn(element, style, placement);
    if (picture) out.push(picture);
  };

  // ----- paints: gradients, shadow blurs and clips, collected for the <defs> -----
  const paints = [];
  const nextPaintId = kind => `${id}-${kind}${paints.length}`;
  const opacityValue = opacity => (opacity < 1 ? roundTo(opacity, 3) : null);

  // A linear-gradient() background as a fill: the gradient goes in the defs, the fill points at it.
  const gradientFill = gradient => {
    const gradientId = nextPaintId('grad');
    const stops = gradient.stops.map(stop => {
      const [color, opacity] = paint.colorAndOpacity(paintOf(stop.color) || 'rgba(0, 0, 0, 0)');
      return svgElement('stop', {
        offset: roundTo(stop.at, 4),
        'stop-color': color,
        'stop-opacity': opacityValue(opacity),
      });
    });
    const line = { x1: fmt(gradient.x1), y1: fmt(gradient.y1), x2: fmt(gradient.x2), y2: fmt(gradient.y2) };
    const definition = { id: gradientId, gradientUnits: 'userSpaceOnUse', ...line };
    paints.push(svgElement('linearGradient', definition, stops.join('')));
    return `url(#${gradientId})`;
  };
  // A Gaussian blur for a shadow. Its region reaches three deviations past the shape, where the
  // blur has faded out; a CSS blur of B is a Gaussian of deviation B/2.
  const blurFilter = (shape, blur) => {
    const filterId = nextPaintId('blur'), reach = blur * 1.5;
    const region = { x: shape.x - reach, y: shape.y - reach, w: shape.w + 2 * reach, h: shape.h + 2 * reach };
    const gaussian = svgElement('feGaussianBlur', { stdDeviation: fmt(blur / 2) });
    const definition = { id: filterId, filterUnits: 'userSpaceOnUse', ...boxAttributes(region) };
    paints.push(svgElement('filter', definition, gaussian));
    return `url(#${filterId})`;
  };
  // A box-shadow: the box grown by its spread and moved by its offset, then blurred. Its corners
  // grow with the spread, as a browser draws them.
  const shadowOf = (shadow, box, cornerRadius) => {
    const [color, opacity] = paint.colorAndOpacity(paintOf(shadow.color) || 'rgb(0, 0, 0)');
    const shape = {
      x: box.x + shadow.x - shadow.spread,
      y: box.y + shadow.y - shadow.spread,
      w: box.w + 2 * shadow.spread,
      h: box.h + 2 * shadow.spread,
    };
    return svgElement('rect', {
      ...boxAttributes(shape),
      rx: fmt(cornerRadius > 0 ? Math.max(0, cornerRadius + shadow.spread) : 0),
      style: `fill: ${color}`,
      'fill-opacity': opacityValue(opacity),
      filter: shadow.blur > 0 && blurFilter(shape, shadow.blur),
    });
  };
  // overflow other than visible clips what is inside to the padding box, corners included. An
  // element with nothing inside (an empty Gantt bar) needs no clip.
  const clipsContent = (element, style) => {
    if (style.overflowX === 'visible' && style.overflowY === 'visible') return false;
    return [...element.childNodes].some(child => child.nodeType === 1 || child.textContent.trim());
  };
  const openClip = (box, border, cornerRadius) => {
    const clipId = nextPaintId('clip'), [top, right, bottom, left] = border.widths;
    const inner = { x: box.x + left, y: box.y + top, w: box.w - left - right, h: box.h - top - bottom };
    const innerRadius = Math.max(0, cornerRadius - Math.max(top, left));
    const rect = svgElement('rect', { ...boxAttributes(inner), rx: fmt(innerRadius) });
    paints.push(svgElement('clipPath', { id: clipId }, rect));
    out.push(openTag('g', { 'clip-path': `url(#${clipId})` }));
  };
  // outline: a ring outside the border, outline-offset away from it, round where the border is.
  const outlineOf = (style, box, cornerRadius) => {
    const width = style.outlineStyle === 'none' ? 0 : parseFloat(style.outlineWidth) || 0;
    if (!width) return null;
    const outset = (parseFloat(style.outlineOffset) || 0) + width / 2;
    const ring = { x: box.x - outset, y: box.y - outset, w: box.w + 2 * outset, h: box.h + 2 * outset };
    return svgElement('rect', {
      ...boxAttributes(ring),
      rx: fmt(cornerRadius > 0 ? cornerRadius + outset : 0),
      style: `fill: none; stroke: ${paintOf(style.outlineColor) || 'var(--ink)'}`,
      'stroke-width': fmt(width),
      'stroke-dasharray': paint.DASH_PATTERN[style.outlineStyle],
    });
  };

  // ----- turns: rotate, scale and transform -----
  // A turned element is read unturned and drawn in a group that turns it about its
  // transform-origin, with all inside it. Its outline on the page, turned, is kept for the page's
  // size; its boxes and text, read unturned, are marked so that the checks leave them out.
  const turnedOutlines = [];
  const startTurn = (element, style) => {
    const matrix = paint.turnMatrixOf(style);
    if (!matrix) return null;
    const [originX, originY] = style.transformOrigin.split(' ').map(parseFloat);
    const inlineTransforms = [element.style.transform, element.style.rotate, element.style.scale];
    turnedOutlines.push(boxOf(element));
    const firstBox = boxes.length, firstText = texts.length;
    element.style.transform = element.style.rotate = element.style.scale = 'none';
    const unturned = boxOf(element), pivotX = unturned.x + originX, pivotY = unturned.y + originY;
    // The matrix turns about the page's origin; shifted so that it turns about the pivot instead.
    const shiftX = pivotX + matrix.e - matrix.a * pivotX - matrix.c * pivotY;
    const shiftY = pivotY + matrix.f - matrix.b * pivotX - matrix.d * pivotY;
    const placed = [matrix.a, matrix.b, matrix.c, matrix.d, shiftX, shiftY];
    return {
      group: openTag('g', { transform: `matrix(${placed.map(value => roundTo(value, 4)).join(' ')})` }),
      end: () => {
        [element.style.transform, element.style.rotate, element.style.scale] = inlineTransforms;
        for (const entry of [...boxes.slice(firstBox), ...texts.slice(firstText)]) entry.turned = true;
      },
    };
  };

  // ----- frames: an element's background, border and shadows -----
  // The frame the computed style describes. A gradient goes into the defs as it is read.
  const frameOf = (style, box) => {
    const gradient = paint.linearGradient(style.backgroundImage, box);
    const background = paintOf(style.backgroundColor) || (gradient && paintOf(gradient.stops[0].color));
    const frame = {
      background,
      fill: gradient ? gradientFill(gradient) : background,
      shadows: paint.boxShadows(style.boxShadow),
      border: paint.bordersOf(style),
      polygon: polygonOf(style.clipPath, box),
      cornerRadius: paint.cornerRadiusOf(style, box),
    };
    frame.visible = Boolean(background || frame.border.drawn || frame.polygon || frame.shadows.length);
    return frame;
  };
  // shape="…": the library's shape, or null; an unknown name is reported with a suggestion.
  const shapeOf = element => {
    if (!element.hasAttribute('shape')) return null;
    const shape = parseShape(element.getAttribute('shape'));
    if (!shape.error) return shape;
    const suggestion = closest(shape.error, shape.options);
    const suggest = suggestion ? { suggest: suggestion } : {};
    problems.push({ rule: 'unknown-shape', shape: shape.error, ...suggest });
    return null;
  };
  // The library draws the element's background and border as its shape.
  const drawShapedFrame = (element, shape, frame, box, parentBox) => {
    const top = frame.border.sides[0];
    out.push(...drawShape(shape, box, {
      fill: frame.background || 'none',
      stroke: top.width ? paintOf(top.color) || 'var(--ink)' : 'none',
      width: top.width,
      dash: paint.DASH_PATTERN[top.style] || '',
    }));
    return {
      e: element, b: box, painted: true, parent: parentBox,
      bg: frame.background, round: shape.round, plain: false,
    };
  };
  // The fill, stroked when all four sides of the border match: a polygon for a clip-path, else a
  // rectangle inset by half the border, so that the stroke lies inside the box.
  const frameBodyOf = (frame, box) => {
    const { border, polygon, cornerRadius } = frame, top = border.sides[0];
    const fill = `fill: ${frame.fill || 'none'}`;
    const fillAndStroke = border.uniform
      ? {
        style: `${fill}; stroke: ${paintOf(top.color)}`,
        'stroke-width': top.width,
        'stroke-dasharray': paint.DASH_PATTERN[top.style],
      }
      : { style: fill };
    if (polygon) {
      const points = polygon.map(point => `${fmt(point.x)},${fmt(point.y)}`).join(' ');
      return svgElement('polygon', { points, ...fillAndStroke });
    }
    if (border.uniform) {
      const inset = top.width / 2;
      const inner = { x: box.x + inset, y: box.y + inset, w: box.w - top.width, h: box.h - top.width };
      const innerRadius = Math.max(0, cornerRadius - inset);
      return svgElement('rect', { ...boxAttributes(inner), rx: fmt(innerRadius), ...fillAndStroke });
    }
    if (frame.fill) return svgElement('rect', { ...boxAttributes(box), rx: fmt(cornerRadius), ...fillAndStroke });
    return null;
  };
  // Borders that differ per side: a line along each side that has one, drawn just inside it.
  const sideBordersOf = (border, box) => {
    const left = box.x, top = box.y, right = box.x + box.w, bottom = box.y + box.h;
    const edges = [
      { from: [left, top], to: [right, top], inward: [0, 1] },
      { from: [right, top], to: [right, bottom], inward: [-1, 0] },
      { from: [left, bottom], to: [right, bottom], inward: [0, -1] },
      { from: [left, top], to: [left, bottom], inward: [1, 0] },
    ];
    return border.sides.flatMap((side, index) => {
      if (!side.width) return [];
      const { from, to, inward } = edges[index];
      const shiftX = inward[0] * side.width / 2, shiftY = inward[1] * side.width / 2;
      return [svgElement('line', {
        x1: fmt(from[0] + shiftX),
        y1: fmt(from[1] + shiftY),
        x2: fmt(to[0] + shiftX),
        y2: fmt(to[1] + shiftY),
        style: `stroke: ${paintOf(side.color) || 'var(--ink)'}`,
        'stroke-width': side.width,
        'stroke-dasharray': paint.DASH_PATTERN[side.style],
      })];
    });
  };
  // A frame drawn from its parts: shadows, then the body, then the borders that differ per side.
  // A round frame is a circle to the router; a plain one has nothing drawn.
  const drawBoxFrame = (element, frame, box, parentBox) => {
    const { border, polygon, cornerRadius } = frame;
    if (!polygon) for (const shadow of frame.shadows) out.push(shadowOf(shadow, box, cornerRadius));
    const body = frameBodyOf(frame, box);
    if (body) out.push(body);
    if (!border.uniform && !polygon) out.push(...sideBordersOf(border, box));
    const circular = cornerRadius >= Math.min(box.w, box.h) / 2 - 0.5 && Math.abs(box.w - box.h) < 2;
    const round = (Boolean(polygon) && polygon.length === 4) || circular;
    const plain = !frame.background && !border.drawn && !polygon && !frame.shadows.length;
    return { e: element, b: box, painted: true, parent: parentBox, bg: frame.background, round, plain };
  };
  // Draws an element's frame and enters it in the boxes the router and the checks see. An
  // element with nothing drawn is entered only when it has an id, for lines to reach it.
  const drawFrame = (element, style, box, parentBox) => {
    const frame = frameOf(style, box);
    const shape = shapeOf(element);
    let ownBox = null;
    if (shape) ownBox = drawShapedFrame(element, shape, frame, box, parentBox);
    else if (frame.visible) ownBox = drawBoxFrame(element, frame, box, parentBox);
    else if (element.id) ownBox = { e: element, b: box, painted: false, parent: parentBox };
    if (ownBox) boxes.push(ownBox);
    return { frame, ownBox };
  };
  // A list item with disc bullets: its bullet, before its first line.
  const bulletOf = (element, style) => {
    if (style.display !== 'list-item' || style.listStyleType !== 'disc' || !element.firstChild) return null;
    const range = document.createRange();
    range.selectNodeContents(element);
    const firstLine = range.getClientRects()[0];
    if (!firstLine) return null;
    const fontSize = parseFloat(style.fontSize);
    return svgElement('circle', {
      cx: fmt(firstLine.left - pageRect.left - fontSize * 0.7),
      cy: fmt(firstLine.top - pageRect.top + firstLine.height * 0.55),
      r: fmt(fontSize * 0.17),
      style: `fill: ${inkOf(style)}`,
    });
  };

  // ----- the walk -----
  let greyed = false;
  // data-step="n": the element appears in its turn when the figure is shown (see motionCss).
  const steps = new Set();
  const stepOf = e => {
    const v = e.getAttribute('data-step');
    if (v == null) return 0;
    if (!(Number(v) > 0)) { problems.push({ rule: 'bad-attribute', attr: 'data-step', value: v, ...(e.id ? { id: e.id } : {}), hint: 'a number from 1, the order the element appears in' }); return 0; }
    steps.add(Number(v));
    return Number(v);
  };
  // The groups an element is drawn in, outermost first: its step and animation when the figure
  // is shown, its opacity and grey filter (what disabled does), and its turn. Returns the
  // function that closes them, innermost first.
  const openGroups = (element, style, turn) => {
    const opacity = parseFloat(style.opacity), grey = /grayscale\((?!0\b|0%)/.test(style.filter);
    if (grey) greyed = true;
    const step = stepOf(element), animation = animOf.get(element);
    const groups = [
      step && openTag('g', { 'data-step': step }),
      animation != null && openTag('g', { 'data-anim': animation }),
      (opacity < 1 || grey) && openTag('g', {
        opacity: opacity < 1 && fmt(opacity),
        filter: grey && `url(#${id}-grey)`,
      }),
      turn?.group,
    ].filter(Boolean);
    out.push(...groups);
    return () => {
      for (let count = 0; count < groups.length; count++) out.push('</g>');
      turn?.end();
    };
  };
  // An element's own drawing: its id group (the layout the next render reads back, see
  // snapshot.mjs), its frame and bullet, what is inside it (clipped when it clips) and its outline.
  const drawElement = (element, style, box, parentBox) => {
    if (element.id) {
      const nudge = element.getAttribute('nudge');
      const layout = [box.x, box.y, box.w, box.h].map(value => Math.round(value * 2) / 2).join(',');
      out.push(openTag('g', {
        'data-id': esc(element.id),
        'data-box': layout,
        'data-nudge': nudge ? esc(nudge) : null,
      }));
    }
    const { frame, ownBox } = drawFrame(element, style, box, parentBox);
    const bullet = bulletOf(element, style);
    if (bullet) out.push(bullet);
    const clipped = clipsContent(element, style);
    if (clipped) openClip(box, frame.border, frame.cornerRadius);
    for (const child of element.childNodes) {
      if (child.nodeType === 3) textOf(child, element);
      else if (isDrawnElement(child)) visit(child, ownBox || parentBox);
    }
    if (clipped) out.push('</g>');
    const outline = outlineOf(style, box, frame.cornerRadius);
    if (outline) out.push(outline);
    if (element.id) out.push('</g>');
  };
  const isDrawnElement = node => node.nodeType === 1 && node.tagName !== 'STYLE' && node.tagName !== 'SCRIPT';
  const visit = (element, parentBox) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const turn = startTurn(element, style);
    const box = boxOf(element);
    const closeGroups = openGroups(element, style, turn);
    if (isPicture(element)) {
      drawPicture(element, style, box);
      boxes.push({ e: element, b: box, painted: true, parent: parentBox });
    } else {
      drawElement(element, style, box, parentBox);
    }
    closeGroups();
  };
  for (const child of root.childNodes) {
    if (child.nodeType === 3) textOf(child, root);
    else if (child.nodeType === 1 && child.tagName !== 'STYLE') visit(child, null);
  }

  // ---------- connectors: route.js on the page's boxes ----------
  const far = drawingsReach(drawings);
  // The page's size: what it shows, a turned element by its outline on the page.
  const shownRects = [
    ...boxes.filter(entry => !entry.turned).map(entry => entry.b),
    ...texts.filter(text => !text.turned),
    ...turnedOutlines,
  ];
  const rightEdges = shownRects.map(rect => rect.x + rect.w + S.pad);
  const bottomEdges = shownRects.map(rect => rect.y + rect.h + S.pad);
  const W = Math.ceil(Math.max(root.scrollWidth, ...rightEdges, far.x + S.pad));
  const H = Math.ceil(Math.max(...bottomEdges, far.y + S.pad, 2 * S.pad));
  const routes = connectors(boxes, texts, edges, drawings, problems, m, W, H, opts.previous);
  for (const r of routes) if (r.labelCrowded) problems.push({ rule: 'label-crowded', edge: `${r.edge.from} -> ${r.edge.to}`, label: r.edge.label, hint: 'widen the gap the line runs through, or shorten the label' });
  overlaps(routes, problems);
  shortEnds(routes, drawings, problems);
  const width = parseFloat(root.style.width);
  if (W > width + 2 * S.pad + 1) problems.push({ rule: 'page-overflow', width, content: W - 2 * S.pad, hint: 'the content is wider than width: widen width, or narrow the columns' });
  if (opts.debug) window.__debug = { log: globalThis.__routeLog, hard: globalThis.__routeHard, routes: routes.map(r => ({ from: r.edge.from, to: r.edge.to, points: r.points.map(p => [Math.round(p.x), Math.round(p.y)]) })) };

  // ---------- assemble ----------
  const markers = new Set(), lineOut = [], labelOut = [], drawOut = [];
  const stepOrder = [...steps].sort((a, b) => a - b), delayOf = n => 0.3 + stepOrder.indexOf(n) * 0.5;
  let flows = 0;
  for (const rt of routes) {
    const e = rt.edge, tone = e.off ? 'var(--muted)' : paintOf(toneOf(e.color)) || (e.accent ? 'var(--woad)' : 'var(--ink)');
    const ov = e.leg?.edge.override || e.override || {};
    const sides = (rt.out != null && rt.in != null ? ` data-sides="${SIDES[rt.out]},${SIDES[rt.in]}"` : '')
      + ['out', 'in'].filter(k => ov[k] != null).map(k => ` data-${k}="${SIDES[ov[k]]}"`).join('');
    const d = rounded(rt.points, S.edge.radius), stepAt = e.step ? ` data-step="${e.step}"` : '';
    if (e.flow) flows++;
    lineOut.push(`<g data-edge="${esc(e.key)}"${sides}${stepAt}><path d="${d}" style="fill: none; stroke: ${tone}" stroke-width="${e.width || (e.accent ? 2 : S.edge.width)}"${endAttrs(id, e.ends, tone, markers)}></path>${e.flow ? flowMarks(d, rt.points, tone, boxes, e.step ? delayOf(e.step) : 0) : ''}</g>`);
    if (rt.label) {
      const halo = under(boxes, rt.label.x + rt.label.w / 2, rt.label.y + rt.label.h / 2) || 'var(--bg)';
      labelOut.push(`<text${stepAt} class="${T.edge}" x="${fmt(rt.label.x)}" y="${fmt(m.baseline(rt.label.y, rt.label.h, T.edge))}" style="fill: ${e.off ? 'var(--muted)' : 'var(--ink)'}; paint-order: stroke; stroke: ${halo}; stroke-width: 4px; stroke-linejoin: round">${esc(rt.label.text)}</text>`);
    }
  }
  for (const d of drawings) {
    const o2 = d.o, color = paintOf(toneOf(o2.color || o2.tone)) || 'var(--ink)', at = drawOut.length;
    if (d.anim != null) drawOut.push(`<g data-anim="${d.anim}">`);
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
      // halo: a rim of the colour under it, as edge labels have, so a line through it does not cross the words.
      const halo = o2.halo ? `; paint-order: stroke; stroke: ${under(boxes, d.p.x, d.p.y) || 'var(--bg)'}; stroke-width: 4px; stroke-linejoin: round` : '';
      drawOut.push(`<text x="${fmt(d.p.x)}" y="${fmt(d.p.y + size * 0.35)}" text-anchor="${anchor}" style="font: ${o2.italic ? 'italic ' : ''}${o2.weight || 400} ${size}px Inter, 'Segoe UI', system-ui, sans-serif; fill: ${color}${halo}">${esc(d.str)}</text>`);
    } else if (d.kind === 'icon') {
      const s = o2.size || 24;
      drawOut.push(`<use href="#${d.sym}" x="${fmt(d.p.x - s / 2)}" y="${fmt(d.p.y - s / 2)}" width="${s}" height="${s}"></use>`);
    } else if (d.kind === 'shape') {
      // The same library as shape="…"; BPMN events and gateways default to their sizes.
      const spec = parseShape(d.shape);
      if (spec.error) { problems.push({ rule: 'unknown-shape', shape: spec.error, ...(closest(spec.error, spec.options) ? { suggest: closest(spec.error, spec.options) } : {}) }); drawOut.length = at; continue; }
      const size = o2.size || (['start', 'event', 'end'].includes(spec.base) ? 36 : spec.base === 'gateway' ? 44 : spec.base === 'cycle' ? 28 : 24);
      const w = o2.w || size, h = o2.h || (o2.w ? w : size);
      drawOut.push(...drawShape(spec, { x: d.p.x - w / 2, y: d.p.y - h / 2, w, h },
        { fill: paintOf(toneOf(o2.fill || 'card')), stroke: paintOf(toneOf(o2.stroke || o2.color)) || 'var(--ink)', width: o2.width || (spec.base === 'end' ? 3 : 1.5), dash: o2.dashed ? '5 4' : '' }));
    }
    if (d.anim != null) drawOut.push('</g>');
  }
  // Turned boxes and text were read unturned, so the checks on overlap leave them out.
  const unturnedTexts = texts.filter(text => !text.turned);
  check(unturnedTexts, problems);
  overflows(boxes.filter(entry => !entry.turned), unturnedTexts, root, problems);
  const defs = [...[...markers].map(k => {
    const [mid, kind, color] = k.split('|'), [ref, body] = MARKER[kind];
    return `<marker id="${mid}" viewBox="0 0 10 10" refX="${ref}" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">${body(color)}</marker>`;
  }), ...symbols.values(), ...paints, ...(greyed ? [`<filter id="${id}-grey" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"></feColorMatrix></filter>`] : [])];
  const label = [el.getAttribute('title'), el.getAttribute('subtitle')].filter(Boolean).join('. ') || 'Diagram';
  const style = (opts.standalone ? `<style>${opts.css}</style>\n` : '') + (stepOrder.length || flows || anims.length ? `<style>${motionCss(stepOrder, delayOf, animCss(anims, id, problems))}</style>\n` : '');
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
  // BPMN (2.0.2, 10.5.1): a default flow starts with a slash, a conditional one with an open diamond.
  const tail = o.tail ?? (o.message ? 'circle' : o.default ? 'slash' : o.conditional ? 'open-diamond' : o.both ? head : 'none');
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
  slash: [10, c => `<path d="M0.8,8.8 L6.8,1.2" style="fill: none; stroke: ${c}" stroke-width="1.4" stroke-linecap="round"></path>`],
};

const arcPoint = (c, r, deg) => ({ x: c.x + r * Math.cos(deg * Math.PI / 180), y: c.y + r * Math.sin(deg * Math.PI / 180) });

// How far right and down the script's drawings reach, so the figure grows to hold them. A
// path counts its points and control points (a curve stays inside them); text is measured
// roughly, from its size.
// The points of a path's data, control points included (a curve stays inside them).
const pointsOfPath = path =>
  [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));

function drawingsReach(drawings) {
  let right = 0, bottom = 0;
  const reach = (x, y) => {
    if (x > right) right = x;
    if (y > bottom) bottom = y;
  };
  for (const drawing of drawings) {
    const options = drawing.o || {};
    if (drawing.kind === 'path') {
      // Room for half the stroke, and for an arrowhead or tail mark at an end that has one:
      // a plain rule drawn to the page's edge stays inside it.
      const ends = endsOf(options, false, []), halfStroke = (options.width || 1.5) / 2;
      const points = drawing.pts || pointsOfPath(drawing.d);
      points.forEach((point, index) => {
        const isHead = index === points.length - 1 && ends.head !== 'none';
        const isTail = index === 0 && ends.tail !== 'none';
        const margin = halfStroke + (isHead || isTail ? 5 : 0);
        reach(point.x + margin, point.y + margin);
      });
    } else if (drawing.kind === 'text') {
      // Text is measured roughly: a character is about 0.6 of the font size wide.
      const size = options.size || 12, width = drawing.str.length * size * 0.6;
      const rightOfAnchor = { start: width, middle: width / 2, end: 0 }[options.anchor || 'middle'] ?? 0;
      reach(drawing.p.x + rightOfAnchor, drawing.p.y + size);
    } else if (drawing.kind === 'gate' || drawing.kind === 'icon') {
      const half = (options.size || (drawing.kind === 'gate' ? 30 : 24)) / 2;
      reach(drawing.p.x + half, drawing.p.y + half);
    } else if (drawing.kind === 'shape') {
      const size = options.size || 44, width = options.w || size;
      const height = options.h || (options.w ? width : size);
      reach(drawing.p.x + width / 2, drawing.p.y + height / 2);
    }
  }
  return { x: right, y: bottom };
}

function pathBuilder(start, drawings, point) {
  const d = [`M${fmt(start.x)},${fmt(start.y)}`], item = { kind: 'path', d: '', o: {}, pts: [start] };
  drawings.push(item);
  const sync = () => { item.d = d.join(' '); return api; };
  const api = {
    mark: item,
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

// Motion, for a reader whose browser shows it: a line with flow carries gaps that move along it
// and a dot that travels it; data-step boxes, and their lines, appear in order, once. Both are
// marks on top of the still figure, which is complete without them: the marks start hidden
// (an attribute, which what ignores CSS keeps), the stylesheet shows them only when motion is
// allowed, and a reveal ends where the still is. A PNG is the still: the renderer captures with
// reduced motion. The keyframes are named g-*, after graphally's other classes.
function flowMarks(d, pts, tone, boxes, delay) {
  let len = 0, best = 0, mid = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    len += l;
    if (l > best) { best = l; mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  }
  // The gaps take the colour under the line, as a label's halo does; the dot, the line's colour
  // (blue on a plain line), ringed so it reads on the line itself. One speed for every dot.
  const gap = under(boxes, mid.x, mid.y) || 'var(--bg)', dot = tone === 'var(--ink)' ? 'var(--woad)' : tone;
  return `<path class="g-flow" d="${d}" visibility="hidden" style="fill: none; stroke: ${gap}" stroke-width="1.5"></path>`
    + `<circle class="g-dot" r="4" visibility="hidden" style="fill: ${dot}; stroke: var(--card)" stroke-width="1.5">`
    + `<animateMotion dur="${fmt(Math.max(1.2, len / 70))}s"${delay ? ` begin="${fmt(delay)}s"` : ''} repeatCount="indefinite" path="${d}"></animateMotion></circle>`;
}
function motionCss(order, delayOf, anim) {
  return `@media (prefers-reduced-motion: no-preference) {
  svg.graphally .g-flow, svg.graphally .g-dot { visibility: visible; }
  svg.graphally .g-flow { stroke-dasharray: 3 9; animation: g-flow 0.9s linear infinite; }
  svg.graphally [data-step] { animation: g-in 0.5s backwards; }
${order.map(n => `  svg.graphally [data-step="${n}"] { animation-delay: ${fmt(delayOf(n))}s; }`).join('\n')}${anim.rules}
}
@keyframes g-flow { to { stroke-dashoffset: -12; } }
@keyframes g-in { from { opacity: 0; transform: translateY(6px); } }${anim.keyframes}`;
}

// animate(): one rule and one @keyframes per animation, as element.animate's keyframes and
// options say. A keyframe takes opacity, rotate (a number is degrees), translate (a number or
// [dx, dy] in px) and scale, with offset (0 to 1; spread evenly when left out) and easing. The
// options: duration and delay (ms), iterations (Infinity: for ever), easing (linear unless
// told), direction, fill (none unless told), and the origin it turns about, worked out when
// animate() was called. Values go into CSS, so only plain ones pass; anything else is a problem.
const KEYFRAME = {
  opacity: v => num(v),
  rotate: v => (typeof v === 'number' ? `${num(v)}deg` : v),
  translate: v => [].concat(v).map(n => (typeof n === 'number' ? `${num(n)}px` : n)).join(' '),
  scale: v => [].concat(v).map(n => (typeof n === 'number' ? num(n) : n)).join(' '),
};
const num = v => String(Math.round(Number(v) * 1000) / 1000);
const plain = v => /^[-\w\s.,%()#]*$/.test(String(v));
function animCss(anims, id, problems) {
  let rules = '', keyframes = '';
  anims.forEach((a, i) => {
    const o = a.o, name = `${id}-a${i}`, bad = (option, value, hint) => problems.push({ rule: 'bad-option', option, value: String(value), hint });
    const frames = a.frames.map(f => ({ ...f })), n = frames.length;
    // Offsets as element.animate spreads them: the first at 0, the last at 1, the rest evenly between the given ones.
    if (frames[0].offset == null) frames[0].offset = 0;
    if (frames[n - 1].offset == null) frames[n - 1].offset = n > 1 ? 1 : 0;
    for (let k = 1; k < n; k++) if (frames[k].offset == null) {
      let j = k; while (frames[j].offset == null) j++;
      const a0 = frames[k - 1].offset, a1 = frames[j].offset;
      for (let m = k; m < j; m++) frames[m].offset = a0 + (a1 - a0) * (m - k + 1) / (j - k + 1);
    }
    const body = frames.map(f => {
      const decl = [];
      for (const [key, v] of Object.entries(f)) {
        if (key === 'offset') continue;
        if (key === 'easing') { if (plain(v)) decl.push(`animation-timing-function: ${v}`); else bad('animate easing', v, 'an easing as in CSS: linear, ease-in-out, cubic-bezier(…)'); continue; }
        if (!KEYFRAME[key]) { bad('animate', key, 'a keyframe takes opacity, rotate, translate, scale, offset and easing'); continue; }
        const css = KEYFRAME[key](v);
        if (plain(css)) decl.push(`${key}: ${css}`); else bad(`animate ${key}`, v, 'a number, or a plain CSS value');
      }
      return `  ${num(f.offset * 100)}% { ${decl.join('; ')}; }`;
    }).join('\n');
    const easing = plain(o.easing ?? 'linear') ? o.easing ?? 'linear' : 'linear', fill = /^(none|forwards|backwards|both)$/.test(o.fill ?? 'none') ? o.fill ?? 'none' : 'none';
    const dir = /^(normal|reverse|alternate|alternate-reverse)$/.test(o.direction ?? 'normal') ? o.direction ?? 'normal' : 'normal';
    const iter = o.iterations === Infinity || o.iterations === 'infinite' ? 'infinite' : Number(o.iterations) > 0 ? num(o.iterations) : '1';
    rules += `\n  svg.graphally [data-anim="${i}"] { transform-box: view-box; transform-origin: ${num(a.origin.x)}px ${num(a.origin.y)}px; animation: ${name} ${num(o.duration ?? 1000)}ms ${easing} ${num(o.delay ?? 0)}ms ${iter} ${dir} ${fill}; }`;
    keyframes += `\n@keyframes ${name} {\n${body}\n}`;
  });
  return { rules, keyframes };
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

// A colour every SVG reader knows. The browser computes color-mix() to color(srgb …) and the
// newer spaces to oklab(), lab() or color(display-p3 …), which Office, Inkscape and most
// converters do not read: those become rgb(). srgb is read exactly; any other space is
// painted on a pixel and read back. A colour made of the theme's tokens (var(--woad), or a
// color-mix() of them, as a drawing script may give) stays as written, so it follows the dark
// theme like every other token; so does anything the pixel cannot read.
const portableMemo = new Map();
let pixel;
function portable(c) {
  if (/^(rgba?\(|#)/.test(c) || c.includes('var(')) return c;
  if (portableMemo.has(c)) return portableMemo.get(c);
  let out;
  const s = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(c);
  if (s) {
    const [r, g, b] = s.slice(1, 4).map(v => Math.round(Math.min(1, Math.max(0, +v)) * 255)), a = s[4] === undefined ? 1 : +s[4];
    out = a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;
  } else {
    pixel ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    pixel.fillStyle = '#010203';
    pixel.fillStyle = c;
    if (pixel.fillStyle === '#010203') out = c;
    else {
      pixel.clearRect(0, 0, 1, 1);
      pixel.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
      out = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    }
  }
  portableMemo.set(c, out);
  return out;
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
  // A row of a stack (a BPMN lane, a band of a phase chart) is a band to cross, not a box to
  // keep out of: a line between two rows runs straight over the rows between them. A row spans
  // its parent, a row of the same width lies above or below it, and it has no frame of its own
  // (a framed box, a subnet in a network, is a container whatever its width).
  const framed = b => { const cs = getComputedStyle(b.e); return ['Top', 'Right', 'Bottom', 'Left'].every(s => cs[`border${s}Style`] !== 'none' && parseFloat(cs[`border${s}Width`]) > 0); };
  const near = (a, c) => Math.abs(a - c) <= 2;
  const row = b => hasChild.has(b) && !ends.has(b.e) && b.parent && b.b.w >= b.parent.b.w * 0.9 && !framed(b)
    && boxes.some(o => o !== b && o.parent === b.parent && hasChild.has(o) && near(o.b.x, b.b.x) && near(o.b.w, b.b.w));
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
    (isGroup ? geo.groups : geo.nodes).set(key, isGroup ? { ...px(b.b), group: obj, ...(row(b) ? { lane: true } : {}) } : { ...px(b.b), node: obj, round: b.round });
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
    // A line to or from a disabled part is disabled too: grey and dashed, like the part.
    const off = !!c.o.disabled || [c.from, c.to].some(e => e.closest('.disabled')), ends = endsOf(c.o, true, problems);
    if (off && !ends.dash) ends.dash = '5 4';
    // A line appears with the later of its two ends (an end inside a stepped box takes its step).
    const stepIn = e => Number(e.closest('[data-step]')?.getAttribute('data-step')) || 0;
    const step = Math.max(stepIn(c.from), stepIn(c.to));
    const edge = { id: `e${i}`, key: k > 1 ? `${base}#${k}` : base, from, to, label: c.o.label || '', ends, off, step, flow: !!c.o.flow,
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

// A box, an icon or a line of text that sticks out of the painted box holding it: a node
// wider than its group, a word wider than its card. A warning, not a problem: it may be meant,
// so the render still passes. What is placed with position: absolute is placed on purpose (a
// badge hung on a corner, a BPMN timer on a task's edge, a label beside its bar), and so is all
// inside it: those are left alone. Only a drawn block has an edge to stick out of; a plain
// wrapper has none, and an inline span's box is its line, not a frame.
function overflows(boxes, texts, root, problems) {
  const styleOf = element => getComputedStyle(element);
  const isFrame = entry =>
    entry.painted && !entry.plain && entry.e.tagName !== 'ICON' && styleOf(entry.e).display !== 'inline';
  const framed = new Map(boxes.filter(isFrame).map(entry => [entry.e, entry]));
  // The element's ancestors up to the page, nearest first.
  const ancestorsOf = function* (element, stop = root) {
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor === stop || ancestor === root) return;
      yield ancestor;
    }
  };
  const holderOf = element => {
    for (const ancestor of ancestorsOf(element)) if (framed.has(ancestor)) return framed.get(ancestor);
    return null;
  };
  // Left alone on purpose: the element or an ancestor below its holder is absolutely positioned,
  // or an ancestor clips it (overflow: hidden, truncate).
  const leftAlone = (element, holder) => {
    // A text's holder may be its own element: then nothing lies between them.
    const belowHolder = element === holder.e ? [] : [element, ...ancestorsOf(element, holder.e)];
    if (belowHolder.some(node => /^(absolute|fixed)$/.test(styleOf(node).position))) return true;
    return [...ancestorsOf(element)].some(ancestor => styleOf(ancestor).overflowX !== 'visible');
  };
  // An element's name in a warning: its id, else its tag and classes (utility classes left out).
  const nameOf = element => {
    if (element.id) return element.id;
    const classes = [...element.classList].filter(name => !name.startsWith('[')).map(name => `.${name}`);
    return `${element.tagName.toLowerCase()}${classes.join('')}`;
  };
  // How far a rect sticks out of its holder on each side, where it is more than a pixel.
  const overhangOf = (holderRect, rect) => [
    ['left', holderRect.x - rect.x],
    ['right', rect.x + rect.w - holderRect.x - holderRect.w],
    ['top', holderRect.y - rect.y],
    ['bottom', rect.y + rect.h - holderRect.y - holderRect.h],
  ].filter(([, distance]) => distance > 1);
  const warn = (what, holder, sides) => problems.push({
    rule: 'box-overflow', warn: true, box: what, in: nameOf(holder.e),
    by: sides.map(([side, distance]) => `${side} ${Math.round(distance)}px`).join(', '),
    hint: 'widen the box that holds it, or narrow what is inside; leave it when it is meant',
  });
  // The sides where something sticks out of its holder; none when it has no holder or is left alone.
  const sidesOut = (element, holder, rect) => {
    if (!holder || leftAlone(element, holder)) return [];
    return overhangOf(holder.b, rect);
  };
  for (const entry of boxes) {
    if (!entry.painted) continue;
    const holder = holderOf(entry.e), sides = sidesOut(entry.e, holder, entry.b);
    if (sides.length) warn(nameOf(entry.e), holder, sides);
  }
  // Text: once per element, by the line that sticks out furthest.
  const worstLines = new Map();
  for (const text of texts) {
    const holder = framed.get(text.owner) || holderOf(text.owner), sides = sidesOut(text.owner, holder, text);
    if (!sides.length) continue;
    const furthest = Math.max(...sides.map(([, distance]) => distance)), worst = worstLines.get(text.owner);
    if (worst && furthest <= worst.furthest) continue;
    worstLines.set(text.owner, { furthest, holder, sides, str: text.str });
  }
  const quoted = str => (str.length > 24 ? `${str.slice(0, 24)}…` : str);
  for (const { holder, sides, str } of worstLines.values()) warn(`text "${quoted(str)}"`, holder, sides);
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
