// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Box layout for architecture-style diagrams.
//
// The browser does the placement: a layout map becomes CSS grid-template-areas, a group
// becomes a flex stack, row or grid. We only size nodes (from measured text), build the
// boxes, read the result back, and then nudge nodes inside their groups so that
// connected nodes line up and more edges come out straight.
import { S, T } from '../style.js';

export function layoutAreas(model, m, host) {
  sizeNodes(model, m);
  const legend = legendEntries(model);
  const dom = buildDom(model, m, legend);
  host.appendChild(dom.root);
  const geo = readBack(model, dom, m);
  host.removeChild(dom.root);
  shrink(model, geo);
  align(model, geo, m);
  shrinkWidth(model, geo);
  syncLabels(geo);
  geo.legend = legend.length ? { ...geo.legendBox, entries: legend } : null;
  return geo;
}

// ---------- nodes ----------

export function sizeNodes(model, m) {
  const cards = [...model.nodes.values()].filter(n => n.style === 'card');
  const natural = n => 2 * S.card.padX + (n.icon ? S.card.icon + S.card.iconGap : 0)
    + Math.max(m.width(n.label, T.label), n.sub ? m.width(n.sub, T.sub) : 0);
  const widest = Math.max(0, ...cards.map(natural));
  // On a re-render cards keep their previous width, so a longer new label wraps instead of
  // widening every card and shifting the whole diagram.
  const kept = model.previous && cards.map(n => model.previous.nodes?.[n.id]?.[2]).find(Boolean);
  const W = Number(model.attrs['node-width']) || kept || Math.ceil(Math.min(S.card.maxW, Math.max(S.card.minW, widest)));
  for (const n of model.nodes.values()) {
    if (n.style === 'card') {
      const textW = W - 2 * S.card.padX - (n.icon ? S.card.icon + S.card.iconGap : 0);
      n.lines = m.wrap(n.label, T.label, textW);
      n.subLines = n.sub ? m.wrap(n.sub, T.sub, textW) : [];
      n.w = W;
      n.h = Math.max(S.card.minH, 2 * S.card.padY + n.lines.length * S.card.line + n.subLines.length * S.card.subLine);
    } else if (n.style === 'icon') {
      // The icon is the node; the label sits outside, below, so edges end at the icon.
      const k = S.icon;
      n.w = n.h = k.icon;
      n.lines = []; n.subLines = [];
      const lines = m.wrap(n.label, T.tile, k.w - 8), subs = n.sub ? m.wrap(n.sub, T.sub, k.w - 8) : [];
      const w = Math.max(...lines.map(l => m.width(l, T.tile)), ...subs.map(l => m.width(l, T.sub)));
      n.extLabel = { lines, subs, w: Math.ceil(w), h: lines.length * k.line + subs.length * k.subLine };
      n.fw = Math.max(k.icon, n.extLabel.w);
      n.fh = k.icon + 6 + n.extLabel.h;
    } else if (n.style === 'tile') {
      const k = S[n.style];
      n.lines = m.wrap(n.label, T.tile, k.w - 8);
      n.subLines = n.sub ? m.wrap(n.sub, T.sub, k.w - 8) : [];
      n.w = k.w;
      n.h = (n.style === 'tile' ? 2 * S.tile.padY : 4) + k.icon + k.gap + n.lines.length * k.line + n.subLines.length * k.subLine;
    } else if (n.style === 'shape') {
      sizeShape(n, m, model);
    } else {                                   // chip
      n.lines = [n.label];
      n.subLines = [];
      n.w = Math.ceil(2 * S.chip.padX + m.width(n.label, T.sub));
      n.h = S.chip.h;
    }
    if (!n.fw) { n.fw = n.w; n.fh = n.h; }
  }
}

// Process shapes: tasks are boxes with the label inside; events and gateways are small
// symbols with the label outside, below. fw/fh is the footprint including that label.
function sizeShape(n, m, model) {
  if (n.shape === 'task' || n.shape === 'subprocess') {
    const tasks = [...model.nodes.values()].filter(x => x.shape === 'task' || x.shape === 'subprocess');
    const W = model._taskW ??= Math.ceil(Math.min(144, Math.max(112, ...tasks.map(x => m.width(x.label, T.label) + 28))));
    n.lines = m.wrap(n.label, T.label, W - 24 - (n.icon ? 30 : 0));
    n.subLines = n.sub ? m.wrap(n.sub, T.sub, W - 24) : [];
    n.w = W;
    n.h = Math.max(56, 22 + n.lines.length * 16 + n.subLines.length * 15 + (n.shape === 'subprocess' ? 10 : 0));
    n.fw = n.w; n.fh = n.h;
    return;
  }
  const size = n.shape === 'gateway' ? 46 : 36;
  n.w = n.h = size;
  n.lines = []; n.subLines = [];
  const text = [n.label, n.sub].filter(Boolean).join(' ');
  if (text) {
    const lines = m.wrap(text, T.sub, 128);
    const w = Math.max(...lines.map(l => m.width(l, T.sub)));
    n.extLabel = { lines, w: Math.ceil(w), h: lines.length * 14 };
    n.fw = Math.max(size, Math.ceil(w));
    n.fh = size + 6 + n.extLabel.h;
  } else { n.fw = size; n.fh = size; }
}

function legendEntries(model) {
  if (!model.legend) return [];
  const e = [];
  const edges = model.edges;
  const nodes = [...model.nodes.values()];
  if (edges.some(x => !x.dashed && !x.line)) e.push({ kind: 'sync', label: model.attrs['key-sync'] || 'synchronous call' });
  if (edges.some(x => x.dashed)) e.push({ kind: 'async', label: model.attrs['key-async'] || 'asynchronous message or event' });
  if (nodes.some(n => n.external) || [...model.groups.values()].some(g => g.external)) e.push({ kind: 'external', label: model.attrs['key-external'] || 'outside our control' });
  if (model.badged) e.push({ kind: 'badge', label: model.attrs['key-badge'] || 'uses the shared service with this icon' });
  return e.length > 1 || e.some(x => x.kind === 'external' || x.kind === 'badge') ? e : [];
}

// ---------- boxes ----------

const cssIdent = id => 'a' + [...id].map(c => /[a-zA-Z0-9_-]/.test(c) ? c : '_' + c.charCodeAt(0).toString(16)).join('');

function buildDom(model, m, legend) {
  const els = new Map();
  const root = div('position:absolute;left:0;top:0;width:max-content;box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;');
  root.style.padding = `${S.pad}px`;
  root.style.gap = `${S.titleGap}px`;
  let titleEl = null;
  if (model.title || model.subtitle) {
    const h = (model.title ? 22 : 0) + (model.subtitle ? 18 : 0);
    const w = Math.max(model.title ? m.width(model.title, T.title) : 0, model.subtitle ? m.width(model.subtitle, T.subtitle) : 0);
    titleEl = div(`width:${Math.ceil(w)}px;height:${h}px;flex:none;`);
    root.appendChild(titleEl);
  }
  let legendEl = null;
  const legendSize = () => {
    const w = 64 + Math.max(...legend.map(e => m.width(e.label, T.key)));
    return [Math.ceil(w), 22 + legend.length * 24];
  };
  const usesKeyArea = model.root.layout === 'map' && model.root.map.flat().includes('key');
  const body = groupBody(model.root, model, els, m, () => {
    if (!legend.length) return null;
    const [w, h] = legendSize();
    legendEl = div(`width:${w}px;height:${h}px;grid-area:${cssIdent('key')};align-self:start;justify-self:start;`);
    return legendEl;
  });
  root.appendChild(body);
  if (legend.length && !usesKeyArea) {
    const [w, h] = legendSize();
    legendEl = div(`width:${w}px;height:${h}px;flex:none;`);
    root.appendChild(legendEl);
  }
  return { root, els, body, titleEl, legendEl };
}

function div(css) { const d = document.createElement('div'); d.style.cssText = css; return d; }

function groupBody(g, model, els, m, makeLegend) {
  const body = div('box-sizing:border-box;');
  let layout = g.layout;
  let map = g.map;
  if (layout === 'auto') {
    const auto = autoTiers(g, model);
    if (auto) { layout = 'map'; map = auto; } else layout = 'stack';
  }
  if (layout === 'map') {
    const cols = Math.max(...map.map(r => r.length));
    const rows = map.map(r => [...r, ...Array(cols - r.length).fill('.')]);
    // A <band> missing from the map becomes a full-width row at the bottom.
    for (const c of g.children) if (c.style === 'band' && !map.flat().includes(c.area || c.id.split('.').pop()))
      rows.push(Array(cols).fill(c.area || c.id.split('.').pop()));
    const names = new Set(rows.flat().filter(t => t !== '.'));
    // Gaps are tracks of their own, so each can be as wide as the edge labels crossing it.
    const gaps = columnGaps(g, rows, model, m, Number(g.attrs?.['col-gap'] ?? model.attrs['col-gap'] ?? S.colGap));
    const wide = rows.map(r => r.flatMap((t, c) => (c + 1 < cols ? [t, t !== '.' && r[c + 1] === t ? t : '.'] : [t])));
    body.style.display = 'grid';
    body.style.gridTemplateAreas = wide.map(r => `"${r.map(t => (t === '.' ? '.' : cssIdent(t))).join(' ')}"`).join(' ');
    body.style.gridTemplateColumns = Array.from({ length: cols }, (_, c) => (c + 1 < cols ? `auto ${gaps[c]}px` : 'auto')).join(' ');
    body.style.columnGap = '0px';
    body.style.rowGap = `${Number(g.attrs?.['row-gap'] ?? model.attrs['row-gap'] ?? S.rowGap)}px`;
    body.style.justifyContent = 'start';
    body.style.alignContent = 'start';
    for (const c of g.children) {
      const el = itemEl(c, model, els, m);
      const area = c.area || c.id.split('.').pop();
      const full = names.has(c.id) ? c.id : area;
      if (names.has(full)) el.style.gridArea = cssIdent(full);
      else model.problems.push({ rule: 'not-in-layout', id: c.id, hint: `add "${full}" to the <layout> map of ${g.id === '__root' ? 'the diagram' : g.id}` });
      body.appendChild(el);
    }
    if (names.has('key') && g.id === '__root') { const l = makeLegend(); if (l) body.appendChild(l); }
    for (const t of names) if (t !== 'key' && !g.children.some(c => c.id === t || (c.area || c.id.split('.').pop()) === t))
      model.problems.push({ rule: 'empty-area', area: t, hint: 'no group or node with this id' });
  } else if (layout === 'row') {
    // Boxes in a row share a top edge; single nodes centre on each other.
    const boxes = g.children.some(c => c.kind === 'group');
    body.style.cssText += `display:flex;flex-direction:row;align-items:${boxes ? 'flex-start' : 'center'};gap:${rowGap(g, model, m)}px;`;
    for (const c of g.children) body.appendChild(itemEl(c, model, els, m));
  } else if (layout === 'grid') {
    const cols = g.cols || Math.ceil(Math.sqrt(g.children.length));
    body.style.cssText += `display:grid;grid-template-columns:repeat(${cols}, max-content);gap:${S.stackGap}px;align-items:start;justify-items:center;align-content:start;`;
    for (const c of g.children) body.appendChild(itemEl(c, model, els, m));
  } else {
    body.style.cssText += `display:flex;flex-direction:column;align-items:center;gap:${stackGap(g, model)}px;`;
    for (const c of g.children) body.appendChild(itemEl(c, model, els, m));
  }
  return body;
}

// The gap between two columns of a map must hold the labels of edges that cross it between
// side-by-side items, clear of both boxes' borders.
function columnGaps(g, rows, model, m, base) {
  const cols = rows[0].length, gaps = Array(Math.max(0, cols - 1)).fill(base);
  const top = new Map();
  const mark = (c, id) => { top.set(c.id, id); (c.children || []).forEach(k => mark(k, id)); };
  for (const c of g.children) mark(c, c.area || c.id.split('.').pop());
  const span = name => {
    let c0 = Infinity, c1 = -1, r0 = Infinity, r1 = -1;
    rows.forEach((r, ri) => r.forEach((t, ci) => { if (t === name) { c0 = Math.min(c0, ci); c1 = Math.max(c1, ci); r0 = Math.min(r0, ri); r1 = Math.max(r1, ri); } }));
    return c1 < 0 ? null : { c0, c1, r0, r1 };
  };
  for (const e of model.edges) {
    if (!e.label) continue;
    const a = top.get(e.from), b = top.get(e.to);
    if (!a || !b || a === b) continue;
    const A = span(a), B = span(b);
    if (!A || !B || A.r1 < B.r0 || B.r1 < A.r0) continue;
    const [L, R] = A.c1 < B.c0 ? [A, B] : B.c1 < A.c0 ? [B, A] : [];
    if (!L || R.c0 !== L.c1 + 1) continue;
    gaps[L.c1] = Math.max(gaps[L.c1], Math.ceil(m.width(e.label, T.edge) + 28));
  }
  return gaps;
}

// Items side by side in a row: room for the labels of edges between neighbours.
function rowGap(g, model, m) {
  const top = new Map();
  const mark = (c, id) => { top.set(c.id, id); (c.children || []).forEach(k => mark(k, id)); };
  g.children.forEach(c => mark(c, c.id));
  const index = new Map(g.children.map((c, i) => [c.id, i]));
  let gap = S.stackGap * 1.5;
  for (const e of model.edges) {
    const a = top.get(e.from), b = top.get(e.to);
    if (!a || !b || a === b || Math.abs(index.get(a) - index.get(b)) !== 1) continue;
    gap = Math.max(gap, e.label ? Math.ceil(m.width(e.label, T.edge) + 28) : 40);
  }
  return gap;
}

// Items linked to each other inside one stack need room between them for the edge and
// its label; unlinked items sit closer.
function stackGap(g, model) {
  // Links between items, or between anything inside them (two subnets whose resources talk).
  const top = new Map();
  const mark = (c, id) => { top.set(c.id, id); (c.children || []).forEach(k => mark(k, id)); };
  g.children.forEach(c => mark(c, c.id));
  const inside = e => top.has(e.from) && top.has(e.to) && top.get(e.from) !== top.get(e.to);
  const linked = model.edges.some(inside);
  const labelled = model.edges.some(e => inside(e) && e.label);
  return labelled ? S.stackGap + 30 : linked ? S.stackGap + 18 : S.stackGap;
}

function itemEl(c, model, els, m) {
  if (c.kind === 'node') {
    const el = div(`width:${c.fw ?? c.w}px;height:${c.fh ?? c.h}px;flex:none;box-sizing:border-box;justify-self:center;align-self:center;`);
    els.set(c.id, el);
    return el;
  }
  const plain = c.style === 'plain';
  const head = (c.label || c.icon || c.badges) ? (plain ? S.plain.head : S.group.head) : 0;
  const headW = (c.icon ? S.group.icon + 6 : 0) + (c.label ? m.width(c.label, T.group) : 0) + (c.sub ? 8 + m.width(c.sub, T.gsub) : 0);
  c.headW = headW; c.headH = head;
  c.badgeW = c.badges ? c.badges.length * (S.group.badge + S.group.badgeGap) - S.group.badgeGap : 0;
  const box = div('box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;');
  const padX = plain ? 0 : S.group.padX;
  box.style.padding = `${plain ? 0 : S.group.padTop}px ${padX}px ${plain ? 0 : S.group.padBottom}px`;
  box.style.minWidth = `${Math.ceil(headW + (c.badgeW ? c.badgeW + 12 : 0) + 2 * padX)}px`;
  const headEl = div(`height:${head}px;flex:none;`);
  box.appendChild(headEl);
  const body = groupBody(c, model, els, m);
  body.style.flex = '1';
  box.appendChild(body);
  els.set(c.id, box);
  els.set(c.id + '\u0000body', body);
  return box;
}

// Columns from the flow of traffic: longest path over the graph of top-level items.
// Bands (style=band) go in a full-width row at the bottom.
function autoTiers(g, model) {
  const items = g.children.filter(c => c.style !== 'band');
  const bands = g.children.filter(c => c.style === 'band');
  if (items.length < 2) return null;
  const owner = new Map();
  const mark = (c, top) => { owner.set(c.id, top); if (c.children) c.children.forEach(k => mark(k, top)); };
  g.children.forEach(c => mark(c, c.id));
  const out = new Map(items.map(c => [c.id, new Set()]));
  for (const e of model.edges) {
    const a = owner.get(e.from), b = owner.get(e.to);
    if (a && b && a !== b && out.has(a) && out.has(b)) out.get(a).add(b);
  }
  const layer = new Map(), state = new Map();
  const visit = id => {
    if (state.get(id) === 2) return layer.get(id);
    if (state.get(id) === 1) return -1;            // cycle: ignore the back edge
    state.set(id, 1);
    let l = 0;
    for (const [src, outs] of out) if (outs.has(id)) { const p = visit(src); if (p >= 0) l = Math.max(l, p + 1); }
    state.set(id, 2); layer.set(id, l);
    return l;
  };
  items.forEach(c => visit(c.id));
  const columns = [];
  for (const c of items) (columns[layer.get(c.id)] ||= []).push(c.id);
  const cols = columns.filter(Boolean);
  const R = Math.max(...cols.map(c => c.length));
  const rows = Array.from({ length: R }, () => []);
  for (const col of cols) {
    let r = 0;
    col.forEach((id, i) => {
      const span = Math.floor(R / col.length) + (i < R % col.length ? 1 : 0);
      for (let k = 0; k < span; k++) rows[r++].push(id);
    });
  }
  for (const b of bands) rows.push(Array(cols.length).fill(b.id));
  return rows;
}

// ---------- read back ----------

function readBack(model, dom, m) {
  const o = dom.root.getBoundingClientRect();
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; };
  const geo = { width: Math.ceil(o.width), height: Math.ceil(o.height), nodes: new Map(), groups: new Map(), bodies: new Map() };
  geo.extraObstacles = [];
  for (const [id, n] of model.nodes) {
    if (!dom.els.has(id)) continue;
    const f = rect(dom.els.get(id));
    const above = n.shape === 'gateway' && n.extLabel;
    const r = { x: f.x + (f.w - n.w) / 2, y: f.y + (above ? n.extLabel.h + 6 : 0), w: n.w, h: n.h, node: n, round: ['start', 'end', 'event', 'gateway'].includes(n.shape) || n.style === 'icon' };
    geo.nodes.set(id, r);
    if (n.extLabel) { n.extLabel.box = { x: f.x + (f.w - n.extLabel.w) / 2, y: above ? f.y : f.y + n.h + 6, w: n.extLabel.w, h: n.extLabel.h }; geo.extraObstacles.push({ id: `${id}#label`, ...n.extLabel.box }); }
  }
  for (const [id, g] of model.groups) {
    if (id === '__root') continue;
    if (!dom.els.has(id)) continue;
    const r = rect(dom.els.get(id));
    const plain = g.style === 'plain';
    const head = g.headH ? { x: r.x + (plain ? 0 : S.group.padX), y: r.y + (plain ? 0 : S.group.padTop - 2), w: g.headW, h: g.headH } : null;
    const badges = g.badgeW ? { x: r.x + r.w - (plain ? 0 : S.group.padX) - g.badgeW, y: (head ? head.y : r.y) + ((g.headH || S.group.head) - S.group.badge) / 2, w: g.badgeW, h: S.group.badge } : null;
    geo.groups.set(id, { ...r, group: g, head, badges });
    if (badges) geo.extraObstacles.push({ id: `${id}#badges`, ...badges });
    geo.bodies.set(id, rect(dom.els.get(id + '\u0000body')));
  }
  geo.bodies.set('__root', rect(dom.body));
  geo.title = dom.titleEl ? rect(dom.titleEl) : null;
  geo.legendBox = dom.legendEl ? rect(dom.legendEl) : null;
  return geo;
}

// ---------- shrink under-filled groups ----------

// A grid stretches every item to its area. A group whose content fills little of that
// area becomes a large empty box, the clearest sign of an unprofessional diagram. Such
// groups shrink to their content and slide within the area towards what they connect to.
function shrink(model, geo) {
  const desc = g => (g.children || []).flatMap(c => (c.kind === 'group' ? [c, ...desc(c)] : [c]));
  // Innermost first, so a parent measures its children after they have shrunk.
  const groups = [...model.groups.values()].filter(g => g.id !== '__root' && geo.groups.has(g.id)).sort((a, b) => b.depth - a.depth);
  for (const g of groups) {
    const parentLayout = g.parent?.layout === 'auto' ? 'map' : g.parent?.layout;
    if (parentLayout !== 'map' && parentLayout !== 'grid') continue;
    const r = geo.groups.get(g.id), body = geo.bodies.get(g.id);
    const items = desc(g).map(c => (c.kind === 'node' ? footprint(geo, c) : geo.groups.get(c.id))).filter(Boolean);
    if (!items.length) continue;
    const bottom = Math.max(...items.map(q => q.y + q.h));
    const padBottom = g.style === 'plain' ? 0 : S.group.padBottom;
    const need = Math.ceil(bottom - r.y + padBottom);
    // Network containers keep no empty floor: a VNet is as tall as its subnets.
    const container = g.style === 'vnet' || g.style === 'region' || g.style === 'subnet';
    if ((need >= r.h * 0.62 && !(container && r.h - need >= 48)) || r.h - need < 24) continue;
    // Slide towards neighbours outside the group (only those to the left or right).
    const inside = new Set(desc(g).map(c => c.id));
    const pulls = [];
    for (const e of model.edges) {
      const [a, b] = inside.has(e.from) && !inside.has(e.to) ? [e.from, e.to] : inside.has(e.to) && !inside.has(e.from) ? [e.to, e.from] : [];
      if (!a) continue;
      const qa = geo.nodes.get(a), qb = geo.nodes.get(b) || geo.groups.get(b);
      if (!qa || !qb || Math.abs((qb.x + qb.w / 2) - (qa.x + qa.w / 2)) < (qa.w + qb.w) / 2) continue;
      pulls.push(qb.y + qb.h / 2 - (qa.y + qa.h / 2));
    }
    const room = r.h - need;
    const dy = pulls.length ? Math.round(Math.min(Math.max(pulls.reduce((s2, v) => s2 + v, 0) / pulls.length, 0), room)) : 0;
    for (const c of desc(g)) {
      if (c.kind === 'node') {
        const q = geo.nodes.get(c.id);
        if (q) q.y += dy;
        if (c.extLabel?.box) c.extLabel.box.y += dy;
      } else {
        const q = geo.groups.get(c.id);
        if (q) { q.y += dy; if (q.head) q.head.y += dy; if (q.badges) q.badges.y += dy; }
        const qb = geo.bodies.get(c.id);
        if (qb) qb.y += dy;
      }
    }
    for (const o of geo.extraObstacles) if (inside.has(o.id.split('#')[0]) || o.id === `${g.id}#badges`) o.y += dy;
    r.y += dy;
    if (r.head) r.head.y += dy;
    if (r.badges) r.badges.y += dy;
    body.y += dy;
    body.h -= r.h - need;
    r.h = need;
  }
}

// Outside labels follow their node after any move; their obstacles are rebuilt.
export function syncLabels(geo) {
  geo.extraObstacles = (geo.extraObstacles || []).filter(o => !o.id.endsWith('#label'));
  for (const [id, r] of geo.nodes) {
    const L = r.node.extLabel;
    if (!L) continue;
    const above = r.node.shape === 'gateway';
    L.box = { x: r.x + r.w / 2 - L.w / 2, y: above ? r.y - 6 - L.h : r.y + r.h + 6, w: L.w, h: L.h };
    geo.extraObstacles.push({ id: `${id}#label`, ...L.box });
  }
}

const footprint = (geo, n) => {
  const q = geo.nodes.get(n.id);
  if (!q) return null;
  return n.extLabel?.box ? { x: q.x, y: q.y, w: q.w, h: n.extLabel.box.y + n.extLabel.box.h - q.y } : q;
};

// ---------- alignment ----------

// Slide nodes inside stacks (and rows) towards the nodes they connect to, keeping order,
// gaps and the group's bounds. Straight edges are the biggest single gain in readability
// after avoiding crossings (Ware et al. 2002: path continuity).
function align(model, geo, m) {
  const neighbours = new Map();
  for (const e of model.edges) {
    if (!geo.nodes.has(e.from) || !geo.nodes.has(e.to)) continue;
    (neighbours.get(e.from) || neighbours.set(e.from, []).get(e.from)).push(e.to);
    (neighbours.get(e.to) || neighbours.set(e.to, []).get(e.to)).push(e.from);
  }
  const containers = [...model.groups.values()].filter(g => geo.bodies.has(g.id) && g.children.length);
  // Groups whose members did not change keep their arrangement from the previous render.
  const prev = model.previous;
  const kept = new Set(prev ? containers.filter(g => sameMembers(g, prev)).map(g => g.id) : []);
  for (let pass = 0; pass < 4; pass++) {
    for (const g of containers) {
      const layout = g.layout === 'auto' ? 'stack' : g.layout;
      if (layout !== 'stack' && layout !== 'row') continue;
      if (g.children.some(c => c.kind !== 'node')) continue;
      const vertical = layout === 'stack';
      const body = geo.bodies.get(g.id);
      const items = g.children.map(c => geo.nodes.get(c.id)).filter(Boolean);
      const [lo, hi] = vertical ? [body.y, body.y + body.h] : [body.x, body.x + body.w];
      // Positions and sizes are of the footprint: shape plus any label outside it.
      const above = r => (vertical && r.node.extLabel && r.node.shape === 'gateway' ? r.node.extLabel.h + 6 : 0);
      const pos = r => (vertical ? r.y - above(r) : r.x + (r.w - (r.node.fw ?? r.w)) / 2);
      const size = r => (vertical ? (r.node.fh ?? r.h) : (r.node.fw ?? r.w));
      const desired = items.map(r => {
        const ns = (neighbours.get(r.node.id) || []).map(id => geo.nodes.get(id))
          .filter(q => q && (vertical ? Math.abs(q.x - r.x) > r.w : Math.abs(q.y - r.y) > r.h));
        if (!ns.length) return null;
        // Aim the shape's centre (not the footprint's) at the neighbours.
        const shapeOffset = vertical ? above(r) + r.h / 2 : size(r) / 2;
        return ns.reduce((s, q) => s + (vertical ? q.y + q.h / 2 : q.x + q.w / 2), 0) / ns.length - shapeOffset;
      });
      const gap = vertical ? stackGap(g, model) : rowGap(g, model, m);
      const total = items.reduce((s, r) => s + size(r), 0) + gap * (items.length - 1);
      if (hi - lo - total < 1) continue;
      let p;
      if (!kept.has(g.id) && desired.every(d => d === null)) {
        // No pulls: centre the stack in its space.
        let at = lo + (hi - lo - total) / 2;
        p = items.map(r => { const v = at; at += size(r) + gap; return v; });
      } else {
        // Kept: each item keeps its previous offset from the group's top-left corner. The
        // snapshot holds positions after nudges, which are applied again later: take them off.
        p = kept.has(g.id) ? items.map(r => {
          const q = prev.nodes[r.node.id], pg = prev.groups[g.id], gr = geo.groups.get(g.id);
          const [nx, ny] = prev.overrides?.nodes?.[r.node.id]?.nudge || [0, 0];
          return vertical ? gr.y + q[1] - ny - pg[1] - above(r) : gr.x + q[0] - nx - pg[0] + (r.w - (r.node.fw ?? r.w)) / 2;
        }) : items.map((r, i) => desired[i] ?? pos(r));
        for (let i = 0; i < p.length; i++) p[i] = Math.max(p[i], i ? p[i - 1] + size(items[i - 1]) + gap : lo);
        for (let i = p.length - 1; i >= 0; i--) p[i] = Math.min(p[i], i < p.length - 1 ? p[i + 1] - size(items[i]) - gap : hi - size(items[i]));
        for (let i = 0; i < p.length; i++) p[i] = Math.max(p[i], i ? p[i - 1] + size(items[i - 1]) + gap : lo);
      }
      items.forEach((r, i) => { if (vertical) r.y = Math.round(p[i] + above(r)); else r.x = Math.round(p[i] + ((r.node.fw ?? r.w) - r.w) / 2); });
    }
    // The other axis: each node slides on its own towards neighbours above/below (in a
    // stack) or left/right (in a row), within its group, so those edges come out straight.
    for (const g of containers) {
      const layout = g.layout === 'auto' ? 'stack' : g.layout;
      if (layout !== 'stack' && layout !== 'row') continue;
      if (g.children.some(c => c.kind !== 'node')) continue;
      const vertical = layout === 'stack', body = geo.bodies.get(g.id);
      for (const c of g.children) {
        const r = geo.nodes.get(c.id);
        if (!r) continue;
        // Only neighbours this node can line up with without leaving its group.
        const ns = (neighbours.get(c.id) || []).map(id => geo.nodes.get(id))
          .filter(q => q && (vertical ? Math.abs(q.y - r.y) > r.h && q.x + q.w / 2 > body.x && q.x + q.w / 2 < body.x + body.w
            : Math.abs(q.x - r.x) > r.w && q.y + q.h / 2 > body.y && q.y + q.h / 2 < body.y + body.h));
        if (!ns.length) continue;
        if (vertical) {
          const want = ns.reduce((s, q) => s + q.x + q.w / 2, 0) / ns.length - r.w / 2;
          r.x = Math.round(Math.min(Math.max(want, body.x), body.x + body.w - r.w));
          r.slid = true;
        } else {
          const want = ns.reduce((s, q) => s + q.y + q.h / 2, 0) / ns.length - r.h / 2;
          r.y = Math.round(Math.min(Math.max(want, body.y), body.y + body.h - r.h));
          r.slid = true;
        }
      }
      // Nodes with nothing to line up with stay in line with their siblings that moved.
      const moved = g.children.map(c => geo.nodes.get(c.id)).filter(r => r?.slid);
      if (moved.length) for (const c of g.children) {
        const r = geo.nodes.get(c.id);
        if (!r || r.slid) continue;
        const near = moved.reduce((b, q) => (Math.abs(vertical ? q.y - r.y : q.x - r.x) < Math.abs(vertical ? b.y - r.y : b.x - r.x) ? q : b), moved[0]);
        if (vertical) r.x = near.x + (near.w - r.w) / 2; else r.y = near.y + (near.h - r.h) / 2;
      }
    }
  }
}

// Same members as in the previous render: the group and each child were there, and the previous
// nodes whose centres lay inside the group's previous rect are exactly its children now.
function sameMembers(g, prev) {
  const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : null);
  const pg = own(prev.groups, g.id);
  if (!pg || g.children.some(c => !own(prev.nodes, c.id))) return false;
  const [x, y, w, h] = pg;
  const inside = Object.keys(prev.nodes).filter(id => {
    const [nx, ny, nw, nh] = prev.nodes[id], cx = nx + nw / 2, cy = ny + nh / 2;
    return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
  });
  return inside.length === g.children.length && g.children.every(c => inside.includes(c.id));
}

// A box in a wide map column whose content fills little of its width shrinks to its
// content, keeping its left edge (the vertical twin of shrink()).
function shrinkWidth(model, geo) {
  const desc = g => (g.children || []).flatMap(c => (c.kind === 'group' ? [c, ...desc(c)] : [c]));
  const groups = [...model.groups.values()].filter(g => g.id !== '__root' && geo.groups.has(g.id) && g.style !== 'band').sort((a, b) => b.depth - a.depth);
  for (const g of groups) {
    const parentLayout = g.parent?.layout === 'auto' ? 'map' : g.parent?.layout;
    if (parentLayout !== 'map') continue;
    const r = geo.groups.get(g.id), body = geo.bodies.get(g.id);
    const items = desc(g).map(c => (c.kind === 'node' ? footprint(geo, c) : geo.groups.get(c.id))).filter(Boolean);
    if (!items.length) continue;
    // Content may have slid to either side; the box closes in from both.
    const pad = g.style === 'plain' ? 0 : S.group.padX;
    const left = Math.min(...items.map(q => q.x)), right = Math.max(...items.map(q => q.x + q.w));
    const headW = (r.head ? r.head.w : 0) + (g.badgeW ? g.badgeW + 12 : 0);
    const x0 = Math.max(r.x, left - pad), w = Math.ceil(Math.max(right + pad - x0, headW + 2 * pad));
    if (w >= r.w * 0.62 || r.w - w < 40) continue;
    const dx = x0 - r.x;
    body.x += dx; body.w -= r.w - w;
    r.x = x0; r.w = w;
    if (r.head) r.head.x += dx;
    if (r.badges) {
      r.badges.x = r.x + r.w - pad - g.badgeW;
      const o = geo.extraObstacles.find(o => o.id === `${g.id}#badges`);
      if (o) o.x = r.badges.x;
    }
  }
}
