// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// compile(<diagram>) -> { svg, width, height, problems, stats }
import { parseDiagram } from './parse.js';
import { createMeasurer } from './measure.js';
import { layoutAreas } from './layout/areas.js';
import { layoutTree } from './layout/tree.js';
import { layoutLanes } from './layout/lanes.js';
import { layoutSequence } from './layout/sequence.js';
import { layoutGantt } from './layout/gantt.js';
import { routeEdges } from './route.js';
import { renderSvg } from './render.js';
import { check } from './check.js';
export { registerPack } from './icons.js';

let counter = 0;

export function compile(el, opts = {}) {
  if (opts.debug) globalThis.__routeDebug = true;
  const model = parseDiagram(el);
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
    snapToPixels(geo);
    const routes = [...(geo.fixedRoutes || []), ...(['sequence', 'gantt', 'timeline'].includes(kind) ? [] : routeEdges(model, geo, m))];
    const id = el.id || `gr${++counter}`;
    const { svg, texts } = renderSvg(model, geo, routes, m, { ...opts, id });
    const { problems, crossings } = check(model, geo, routes, texts);
    if (opts.debug) window.__debug = { log: globalThis.__routeLog, hard: globalThis.__routeHard, routes: routes.map(r => ({ from: r.edge.from, to: r.edge.to, points: r.points.map(p => [Math.round(p.x), Math.round(p.y)]) })),
      nodes: [...geo.nodes.entries()].map(([id, r]) => [id, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]) };
    return { svg, width: geo.width, height: geo.height, problems,
      stats: { nodes: model.nodes.size, groups: model.groups.size - 1, edges: routes.length, crossings } };
  } finally {
    host.remove();
    m.dispose();
  }
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
