// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// compile(<diagram>) -> { svg, width, height, problems, stats, snapshot }
import { parseDiagram } from './parse.js';
import { createMeasurer } from './measure.js';
import { layoutAreas } from './layout/areas.js';
import { layoutTree } from './layout/tree.js';
import { layoutLanes } from './layout/lanes.js';
import { layoutSequence } from './layout/sequence.js';
import { layoutGantt } from './layout/gantt.js';
import { routeEdges } from './route.js';
import { compilePage } from './page.js';
import { renderSvg, edgeKey } from './render.js';
import { check } from './check.js';
import { S } from './style.js';
export { registerPack } from './icons.js';

let counter = 0;

export function compile(el, opts = {}) {
  if (opts.debug) globalThis.__routeDebug = true;
  // <diagram layout=html>: plain HTML and CSS, laid out by the browser (page.js).
  if ((el.getAttribute('layout') || '').toLowerCase() === 'html') {
    const m = createMeasurer();
    try { return compilePage(el, opts, m); } finally { m.dispose(); }
  }
  const model = parseDiagram(el);
  model.previous = opts.previous || null;
  const allEdges = model.edges;   // before badgeSharedLinks drops some: their overrides still belong in the snapshot
  const m = createMeasurer();
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;';
  document.body.appendChild(host);
  try {
    const kind = model.root.layout;
    const own = ['tree', 'lanes', 'flow', 'sequence', 'gantt', 'timeline'];
    if (!own.includes(kind)) badgeSharedLinks(model);
    const geo = kind === 'tree' ? layoutTree(model, m) : kind === 'lanes' || kind === 'flow' ? layoutLanes(model, m)
      : kind === 'sequence' ? layoutSequence(model, m) : kind === 'gantt' || kind === 'timeline' ? layoutGantt(model, m) : layoutAreas(model, m, host);
    for (const n of model.nodes.values()) if (n.nudge) nudgeNode(geo, n);
    snapToPixels(geo);
    const routes = [...(geo.fixedRoutes || []), ...(['sequence', 'gantt', 'timeline'].includes(kind) ? [] : routeEdges(model, geo, m))];
    const id = el.id || `gr${++counter}`;
    const snapshot = snapshotOf(el, opts, model, geo, routes, allEdges);
    const { svg, texts } = renderSvg(model, geo, routes, m, { ...opts, id, snapshot });
    const { problems, crossings } = check(model, geo, routes, texts);
    if (opts.debug) window.__debug = { log: globalThis.__routeLog, hard: globalThis.__routeHard, routes: routes.map(r => ({ from: r.edge.from, to: r.edge.to, points: r.points.map(p => [Math.round(p.x), Math.round(p.y)]) })),
      nodes: [...geo.nodes.entries()].map(([id, r]) => [id, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]) };
    return { svg, width: geo.width, height: geo.height, problems,
      stats: { nodes: model.nodes.size, groups: model.groups.size - 1, edges: routes.length, crossings }, snapshot };
  } finally {
    host.remove();
    m.dispose();
  }
}

const SIDES = ['right', 'bottom', 'left', 'top'];
const r2 = v => Math.round(v * 2) / 2;

// The layout: where the boxes and routed edges landed, and the overrides of the source.
// render.js writes it onto the SVG's elements as data attributes; snapshot.mjs reads it back.
// Edges without sides (sequence and Gantt lines) are left out.
function snapshotOf(el, opts, model, geo, routes, allEdges) {
  const rect = r => [r.x, r.y, r.w, r.h].map(r2);
  const sides = o => Object.fromEntries(['out', 'in'].filter(k => o[k] != null).map(k => [k, SIDES[o[k]]]));
  return {
    id: el.id || '', source: opts.source || '',
    nodes: Object.fromEntries([...geo.nodes].map(([id, r]) => [id, rect(r)])),
    groups: Object.fromEntries([...geo.groups].filter(([id]) => id !== '__root').map(([id, r]) => [id, rect(r)])),
    edges: Object.fromEntries(routes.filter(rt => rt.out != null && rt.in != null).map(rt => [edgeKey(rt.edge), sides(rt)])),
    overrides: {
      nodes: Object.fromEntries([...model.nodes.values()].filter(n => n.nudge).map(n => [n.id, { nudge: [n.nudge.dx, n.nudge.dy] }])),
      edges: Object.fromEntries(allEdges.filter(e => e.override).map(e => [edgeKey(e), sides(e.override)])),
    },
  };
}

// A link between a whole group and an item of a <band> (shared platform services) becomes
// a badge in the group's header: the band item's icon. Reference architectures draw such
// services without wires; a wire per tier crosses everything between the tier and the band.
function badgeSharedLinks(model) {
  const bandOf = new Map();
  const mark = (c, band) => { bandOf.set(c.id, band); (c.children || []).forEach(k => mark(k, band)); };
  for (const g of model.groups.values()) if (g.style === 'band' && g.parent?.id === '__root') mark(g, g);
  const keep = [];
  for (const e of model.edges) {
    const fb = bandOf.get(e.from), tb = bandOf.get(e.to);
    const [inside, other] = tb && !fb ? [e.to, e.from] : fb && !tb ? [e.from, e.to] : [];
    const g = other && model.groups.get(other), item = inside && model.nodes.get(inside);
    if (!g || !item || model.attrs['band-links'] === 'lines') { keep.push(e); continue; }
    g.badges ||= [];
    if (!g.badges.some(b => b.id === item.id)) g.badges.push({ id: item.id, icon: item.icon, label: item.label, edge: e.label || '' });
    model.badged = true;
    if (item.icon && !model.badgeSample) model.badgeSample = { icon: item.icon };
  }
  model.edges = keep;
}

// A nudge (<node nudge="dx,dy">) moves the box with its outside label and that label's obstacle.
// The node's groups grow to keep it inside (right, down and left; their titles stay on top),
// and so does the canvas.
function nudgeNode(geo, n) {
  const q = geo.nodes.get(n.id);
  if (!q) return;
  const { dx, dy } = n.nudge, move = o => { o.x += dx; o.y += dy; };
  move(q);
  if (n.extLabel?.box) move(n.extLabel.box);
  const o = geo.extraObstacles?.find(o => o.id === `${n.id}#label`);
  if (o) move(o);
  let box = union(q, n.extLabel?.box || q);
  const { padX, padBottom } = S.group;
  for (let g = n.parent; g && g.id !== '__root'; g = g.parent) {
    const r = geo.groups.get(g.id);
    if (!r) continue;
    const x0 = Math.min(r.x, box.x - padX), x1 = Math.max(r.x + r.w, box.x + box.w + padX);
    r.h = Math.max(r.y + r.h, box.y + box.h + padBottom) - r.y;
    r.x = x0; r.w = x1 - x0;
    box = union(box, r);
  }
  geo.width = Math.max(geo.width, Math.ceil(box.x + box.w + S.pad));
  geo.height = Math.max(geo.height, Math.ceil(box.y + box.h + S.pad));
}
const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };

// Whole-pixel geometry: crisp strokes, and the router's grid lines then coincide exactly
// with box edges (a fractional edge rounded inside its own box once blocked a port).
function snapToPixels(geo) {
  const r = q => { if (!q) return; const x2 = Math.round(q.x + q.w), y2 = Math.round(q.y + q.h); q.x = Math.round(q.x); q.y = Math.round(q.y); q.w = x2 - q.x; q.h = y2 - q.y; };
  for (const q of geo.nodes.values()) { r(q); if (q.node.extLabel?.box) r(q.node.extLabel.box); }
  for (const q of geo.groups.values()) { r(q); r(q.head); r(q.badges); }
  for (const q of (geo.bodies?.values() || [])) r(q);
  for (const q of geo.extraObstacles || []) r(q);
  r(geo.title); r(geo.legend); r(geo.legendBox);
}
