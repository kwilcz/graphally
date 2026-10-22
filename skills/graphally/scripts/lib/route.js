// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Orthogonal edge routing around boxes.
//
// A* over a sparse grid made from the obstacles' (inflated) edges and the centres of the
// channels between them, in the spirit of orthogonal visibility graphs (Wybrow, Marriott
// & Stuckey 2009). Cost = length + bends + crossings + overlap with earlier routes +
// distance travelled through groups the edge does not belong to. Two passes: the first
// chooses which side of each node an edge uses; the second spreads edges that share a side
// and routes again with fixed ports. Then parallel segments are separated and labels are
// placed where they collide with nothing.
import { S, T } from './style.js';

const BEND = 36, CROSS = 70, OVERLAP = 22, FOREIGN = 2.2;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // E S W N

export function routeEdges(model, geo, m) {
  const P = geo.nodePad ?? S.edge.nodePad;
  // Lanes and tree bands are rows to cross, not containers to avoid.
  const groupsList = [...geo.groups.entries()].filter(([, r]) => !r.lane && r.group.style !== 'band' || !r.gutter).map(([id, r]) => ({ id, ...r, depth: r.group.depth }));
  const gIndex = new Map(groupsList.map((g, i) => [g.id, i]));

  // Hard obstacles: nodes, group titles, the title block, the legend.
  const hard = [];
  for (const [id, r] of geo.nodes) if (!r.virtual) hard.push({ id, x: r.x - P, y: r.y - P, w: r.w + 2 * P, h: r.h + 2 * P, node: true });
  for (const g of groupsList) if (g.head) hard.push({ id: `${g.id}#head`, x: g.head.x - 6, y: g.head.y - 3, w: g.head.w + 14, h: g.head.h + 6 });
  for (const o of geo.extraObstacles || []) hard.push({ ...pad(o, 4), id: o.id });
  if (geo.title) hard.push({ id: '#title', ...pad(geo.title, 6) });
  if (geo.legend) hard.push({ id: '#legend', ...pad(geo.legend, 8) });

  const rectOf = id => geo.nodes.get(id) || geo.groups.get(id);
  // Is the point just outside this side at coordinate c free? Tested exactly, not on the grid.
  const sideFree = (id, side, c) => {
    const r = rectOf(id), out = model.groups.has(id) ? 10 : P;
    const x = side === 0 ? r.x + r.w + out : side === 2 ? r.x - out : c;
    const y = side === 1 ? r.y + r.h + out : side === 3 ? r.y - out : c;
    return !hard.some(o => x > o.x + 0.01 && x < o.x + o.w - 0.01 && y > o.y + 0.01 && y < o.y + o.h - 0.01);
  };
  // What stands just outside the middle of a side, for the problem that reports the side blocked.
  const blockerOf = (id, side) => {
    const r = rectOf(id), out = model.groups.has(id) ? 10 : P;
    const x = side === 0 ? r.x + r.w + out : side === 2 ? r.x - out : r.x + r.w / 2;
    const y = side === 1 ? r.y + r.h + out : side === 3 ? r.y - out : r.y + r.h / 2;
    const o = hard.find(o => o.id !== id && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
    return o ? { by: o.id } : {};
  };
  const ancestors = id => {
    const out = new Set();
    let n = model.nodes.get(id) || model.groups.get(id);
    while (n) { if (gIndex.has(n.id)) out.add(gIndex.get(n.id)); n = n.parent; }
    return out;
  };

  const bundleOf = new Map();
  for (const e of model.edges) {
    if (!e.stmt) continue;
    const sameTo = model.edges.filter(q => q.stmt === e.stmt && q.to === e.to).length > 1;
    const sameFrom = model.edges.filter(q => q.stmt === e.stmt && q.from === e.from).length > 1;
    if (sameTo) bundleOf.set(e, `${e.stmt}>${e.to}`); else if (sameFrom) bundleOf.set(e, `${e.stmt}<${e.from}`);
  }
  const bundleIds = new Map([...new Set(bundleOf.values())].map((k, i) => [k, i + 1]));
  const edges = model.edges.filter(e => e.from !== e.to && rectOf(e.from) && rectOf(e.to)).map(e => ({
    bundle: bundleIds.get(bundleOf.get(e)) || 0,
    e, a: rectOf(e.from), b: rectOf(e.to), allowed: new Set([...ancestors(e.from), ...ancestors(e.to)]),
    aGroup: model.groups.has(e.from), bGroup: model.groups.has(e.to),
  }));
  // Short edges first: they have the fewest good options.
  edges.sort((p, q) => manhattan(center(p.a), center(p.b)) - manhattan(center(q.a), center(q.b)));

  // ---- pass 1: free sides ----
  const extraX = new Set(), extraY = new Set();
  for (const r of [...geo.nodes.values(), ...geo.groups.values()]) { extraX.add(r.x + r.w / 2); extraY.add(r.y + r.h / 2); }
  for (const E of edges) {
    const oy = overlap(E.a.y, E.a.h, E.b.y, E.b.h), ox = overlap(E.a.x, E.a.w, E.b.x, E.b.w);
    if (oy) extraY.add(oy.mid);
    if (ox) extraX.add(ox.mid);
  }
  let grid = buildGrid(geo, hard, groupsList, extraX, extraY);
  if (globalThis.__routeDebug) globalThis.__routeHard = hard.map(o => [o.id, Math.round(o.x), Math.round(o.y), Math.round(o.w), Math.round(o.h)]);
  // A circle or diamond has one attachment point per side. Two flows out of the same point
  // of a gateway cannot be told apart, so a side already in use costs extra.
  const sideUse = new Map(), SIDE_TAKEN = 300;
  const useOf = (id, side, dir) => (sideUse.get(`${id}|${side}`) || []).filter(d => !dir || d === dir).length;
  // Candidate ports of one edge end. An override fixes its side (hard): only ports there; if that
  // side is blocked, all ports stay and the override is reported once. Without one, the side the
  // previous render used is preferred (soft): +400 on the ports of every other side.
  const warned = new Set();
  const endPorts = (E, which, ports) => {
    const dir = which === 'a' ? 'out' : 'in', ov = E.e.override?.[dir];
    if (ov != null) {
      const on = ports.filter(q => q.side === ov);
      if (!on.length && !warned.has(`${E.e.key}|${dir}`)) {
        warned.add(`${E.e.key}|${dir}`);
        model.problems.push({ rule: 'override-ignored', id: E.e.key, attr: dir, why: 'side blocked', ...blockerOf(which === 'a' ? E.e.from : E.e.to, ov) });
      }
      return on.length ? on : ports;
    }
    const prev = ['right', 'bottom', 'left', 'top'].indexOf(model.previous?.edges?.[E.e.key]?.[dir]);
    if (prev >= 0) for (const q of ports) if (q.side !== prev) q.pen = (q.pen || 0) + 400;
    return ports;
  };
  const first = edges.map(E => {
    const starts = endPorts(E, 'a', portsOf(E.a, E, 'a', grid, P)), goals = endPorts(E, 'b', portsOf(E.b, E, 'b', grid, P));
    if (E.a.round) for (const q of starts) q.pen = (q.pen || 0) + SIDE_TAKEN * useOf(E.e.from, q.side);
    if (E.b.round) for (const q of goals) q.pen = (q.pen || 0) + SIDE_TAKEN * useOf(E.e.to, q.side, 'out');
    const path = astar(grid, starts, goals, E.allowed, gIndex, E.bundle);
    if (globalThis.__routeDebug) (globalThis.__routeLog ||= []).push({ e: `${E.e.from}->${E.e.to}`, starts: starts.map(q => [q.side, grid.xs[q.i], grid.ys[q.j]]), goals: goals.map(q => [q.side, grid.xs[q.i], grid.ys[q.j]]), chose: path && [path.startSide, path.goalSide, Math.round(path.cost)] });
    if (path) {
      markUse(grid, path.cells, 1, E.bundle);
      for (const [id, side, dir] of [[E.e.from, path.startSide, 'out'], [E.e.to, path.goalSide, 'in']]) (sideUse.get(`${id}|${side}`) || sideUse.set(`${id}|${side}`, []).get(`${id}|${side}`)).push(dir);
    }
    return path;
  });

  // ---- spread ports that share a side ----
  const ends = new Map();
  edges.forEach((E, k) => {
    const p = first[k];
    if (!p) return;
    for (const [which, side, other, otherSide] of [['a', p.startSide, p.points.at(-1), p.goalSide], ['b', p.goalSide, p.points[0], p.startSide]]) {
      const id = which === 'a' ? E.e.from : E.e.to;
      const key = `${id}|${side}`;
      // Order edges along a side by where they head: walk away from the port until the path
      // leaves the port's line; that coordinate decides the slot, so edges do not cross.
      const pts = which === 'a' ? p.points : [...p.points].reverse();
      const axis = side % 2 === 0 ? 'y' : 'x', base = pts[0][axis];
      const away = pts.find(q => Math.abs(q[axis] - base) > 1);
      const sortBy = away ? away[axis] : base;
      (ends.get(key) || ends.set(key, []).get(key)).push({ k, which, side, coord: which === 'a' ? p.startCoord : p.goalCoord, sortBy, other, facing: (side + 2) % 4 === otherSide });
    }
  });
  const fixed = edges.map(() => ({}));
  for (const [key, list] of ends) {
    const [id, sideS] = key.split('|'), side = Number(sideS), r = rectOf(id);
    const bundles = new Set(list.map(it => edges[it.k].bundle));
    if (list.length > 1 && bundles.size === 1 && !bundles.has(0)) {
      // A fan-in/fan-out bundle meets its shared node at one point.
      const c = side % 2 === 0 ? r.y + r.h / 2 : r.x + r.w / 2;
      for (const it of list) fixed[it.k][it.which] = { side, coord: c };
      continue;
    }
    if (list.length === 1 || geo.nodes.get(id)?.round) {
      // Circles and diamonds attach at their points; every edge on that side shares it.
      for (const it of list) fixed[it.k][it.which] = { side, coord: geo.nodes.get(id)?.round ? (side % 2 === 0 ? r.y + r.h / 2 : r.x + r.w / 2) : it.coord };
      continue;
    }
    list.sort((p, q) => p.sortBy - q.sortBy);
    const along = side % 2 === 0 ? r.h : r.w, origin = side % 2 === 0 ? r.y : r.x;
    // Free stretch of this side (the part whose outside points are not blocked).
    const free = [];
    for (let c = origin + 6; c <= origin + along - 6; c += 2) if (sideFree(id, side, c)) free.push(c);
    const lo = free.length ? free[0] : origin + 6, hi = free.length ? free.at(-1) : origin + along - 6;
    const span = hi - lo, centre = (lo + hi) / 2;
    const step = Math.min(S.edge.portGap * 1.6, list.length > 1 ? span / (list.length - 1) : 0);
    const startAt = centre - (step * (list.length - 1)) / 2;
    // Lines from facing sides whose other end lies along the free stretch aim for its
    // coordinate, so they run straight in; the rest keep their evenly spaced slot. A forward and a backward pass keep the order and a
    // port gap between neighbours; when the side is too short for that, even spacing it is.
    const axis = side % 2 === 0 ? 'y' : 'x', gap = Math.min(S.edge.portGap, step || S.edge.portGap);
    const straight = it => it.facing && it.other[axis] >= lo && it.other[axis] <= hi;
    const c = list.map((it, i) => (straight(it) ? it.other[axis] : startAt + i * step));
    // Two labelled neighbours need room for a label between them.
    const gapAt = i => (edges[list[i].k].e.label && edges[list[i - 1].k].e.label ? Math.max(gap, 24) : gap);
    for (let i = 1; i < c.length; i++) c[i] = Math.max(c[i], c[i - 1] + gapAt(i));
    c[c.length - 1] = Math.min(c.at(-1), hi);
    for (let i = c.length - 2; i >= 0; i--) c[i] = Math.min(c[i], c[i + 1] - gapAt(i + 1));
    const fits = c[0] >= lo - 0.5;
    list.forEach((it, i) => { fixed[it.k][it.which] = { side, coord: fits ? c[i] : startAt + i * step }; });
  }

  // ---- straighten: an edge alone on two facing sides gets one shared coordinate ----
  const freeOn = (id, side) => {
    const r = rectOf(id), along = side % 2 === 0 ? r.h : r.w, origin = side % 2 === 0 ? r.y : r.x, out = [];
    if (geo.nodes.get(id)?.round) return [origin + along / 2];
    for (let c = origin + 8; c <= origin + along - 8; c += 2) if (sideFree(id, side, c)) out.push(c);
    return out;
  };
  edges.forEach((E, k) => {
    const f = fixed[k], p = first[k];
    if (!f.a || !f.b || !p || (f.a.side + 2) % 4 !== f.b.side) return;
    if ((ends.get(`${E.e.from}|${f.a.side}`) || []).length !== 1 || (ends.get(`${E.e.to}|${f.b.side}`) || []).length !== 1) return;
    const A = new Set(freeOn(E.e.from, f.a.side).map(Math.round)), both = freeOn(E.e.to, f.b.side).map(Math.round).filter(c => A.has(c));
    if (!both.length) return;
    const want = (f.a.coord + f.b.coord) / 2;
    const c = both.reduce((best, v) => (Math.abs(v - want) < Math.abs(best - want) ? v : best), both[0]);
    if (globalThis.__routeDebug) (globalThis.__routeLog ||= []).push({ straighten: `${E.e.from}->${E.e.to}`, c, was: [f.a.coord, f.b.coord] });
    f.a.coord = c; f.b.coord = c;
  });

  // ---- pass 2: fixed ports ----
  for (const f of fixed) for (const w of ['a', 'b']) if (f[w]) (f[w].side % 2 === 0 ? extraY : extraX).add(f[w].coord);
  grid = buildGrid(geo, hard, groupsList, extraX, extraY);
  const endsOf = k => {
    const E = edges[k], f = fixed[k];
    return [(f.a ? [portAt(E.a, f.a.side, f.a.coord, grid, P)] : endPorts(E, 'a', portsOf(E.a, E, 'a', grid, P))).filter(Boolean),
            (f.b ? [portAt(E.b, f.b.side, f.b.coord, grid, P)] : endPorts(E, 'b', portsOf(E.b, E, 'b', grid, P))).filter(Boolean)];
  };
  const paths = edges.map((E, k) => {
    const [starts, goals] = endsOf(k);
    const path = astar(grid, starts, goals, E.allowed, gIndex, E.bundle);
    if (path) markUse(grid, path.cells, 1, E.bundle);
    return path;
  });
  // Rip up and reroute: each edge is routed again with every other edge in place, so
  // early edges stop blocking the good routes of later ones.
  for (let round = 0; round < 3; round++) {
    let changed = false;
    edges.forEach((E, k) => {
      if (!paths[k]) return;
      markUse(grid, paths[k].cells, -1, E.bundle);
      const [starts, goals] = endsOf(k);
      const again = astar(grid, starts, goals, E.allowed, gIndex, E.bundle);
      if (again) { changed ||= again.cells.join() !== paths[k].cells.join(); paths[k] = again; }
      markUse(grid, paths[k].cells, 1, E.bundle);
    });
    if (!changed) break;
  }
  const routes = edges.map((E, k) => {
    const path = paths[k] || first[k];
    if (!path) { model.problems.push({ rule: 'unroutable', from: E.e.from, to: E.e.to }); return null; }
    return { edge: E.e, bundle: E.bundle, points: simplify(path.points), out: path.startSide, in: path.goalSide };
  }).filter(Boolean);

  nudge(routes);
  placeLabels(routes, geo, hard, m);
  return routes;
}

// ---------- geometry helpers ----------

const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const manhattan = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
function overlap(a0, al, b0, bl) {
  const lo = Math.max(a0, b0), hi = Math.min(a0 + al, b0 + bl);
  return hi - lo >= 16 ? { lo, hi, mid: (lo + hi) / 2 } : null;
}

// ---------- grid ----------

function buildGrid(geo, hard, groupsList, extraX, extraY) {
  const xsSet = new Set([2, geo.width - 2, ...extraX]), ysSet = new Set([2, geo.height - 2, ...extraY]);
  for (const o of hard) { xsSet.add(o.x); xsSet.add(o.x + o.w); ysSet.add(o.y); ysSet.add(o.y + o.h); }
  for (const g of groupsList) { xsSet.add(g.x - 10); xsSet.add(g.x + g.w + 10); ysSet.add(g.y - 10); ysSet.add(g.y + g.h + 10); }
  for (const t of geo.taken || []) if (t.x1 === t.x2) xsSet.add(t.x1); else ysSet.add(t.y1);
  const channel = vals => {           // centres of the gaps between consecutive lines
    const v = [...vals].sort((a, b) => a - b);
    for (let i = 0; i + 1 < v.length; i++) if (v[i + 1] - v[i] > 24) vals.add((v[i] + v[i + 1]) / 2);
  };
  channel(xsSet); channel(ysSet);
  const xs = [...xsSet].map(v => Math.round(v * 2) / 2).filter(v => v >= 0 && v <= geo.width).sort((a, b) => a - b);
  const ys = [...ysSet].map(v => Math.round(v * 2) / 2).filter(v => v >= 0 && v <= geo.height).sort((a, b) => a - b);
  const ux = [...new Set(xs)], uy = [...new Set(ys)];
  const nx = ux.length, ny = uy.length;
  const inside = (x, y) => {
    for (const o of hard) if (x > o.x + 0.01 && x < o.x + o.w - 0.01 && y > o.y + 0.01 && y < o.y + o.h - 0.01) return true;
    return false;
  };
  const innermost = (x, y) => {
    let best = -1, depth = -1;
    groupsList.forEach((g, i) => { if (x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h && g.depth > depth) { best = i; depth = g.depth; } });
    return best;
  };
  // Running along a group's border reads as part of the box: flag those segments.
  const hugH = (x, y) => groupsList.some(g => x > g.x - 2 && x < g.x + g.w + 2 && (Math.abs(y - g.y) < 5 || Math.abs(y - g.y - g.h) < 5));
  const hugV = (x, y) => groupsList.some(g => y > g.y - 2 && y < g.y + g.h + 2 && (Math.abs(x - g.x) < 5 || Math.abs(x - g.x - g.w) < 5));
  const okP = new Uint8Array(nx * ny), okH = new Uint8Array(nx * ny), okV = new Uint8Array(nx * ny);
  const bH = new Uint8Array(nx * ny), bV = new Uint8Array(nx * ny);
  const gH = new Int16Array(nx * ny), gV = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) okP[j * nx + i] = inside(ux[i], uy[j]) ? 0 : 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (i + 1 < nx && okP[k] && okP[k + 1]) {
      const mx = (ux[i] + ux[i + 1]) / 2;
      okH[k] = inside(mx, uy[j]) ? 0 : 1;
      gH[k] = innermost(mx, uy[j]);
      bH[k] = hugH(mx, uy[j]) ? 1 : 0;
    }
    if (j + 1 < ny && okP[k] && okP[k + nx]) {
      const my = (uy[j] + uy[j + 1]) / 2;
      okV[k] = inside(ux[i], my) ? 0 : 1;
      gV[k] = innermost(ux[i], my);
      bV[k] = hugV(ux[i], my) ? 1 : 0;
    }
  }
  // Lines drawn by other means (page mode's script) are taken: running along one costs as
  // overlap, crossing one as a crossing.
  const useH = new Uint8Array(nx * ny), useV = new Uint8Array(nx * ny);
  // A grid line within 3px of a drawn line counts as on it.
  const near = (vals, c) => vals.flatMap((v, i) => (Math.abs(v - c) <= 3 ? [i] : []));
  for (const t of geo.taken || []) {
    const v = t.x1 === t.x2, [lo, hi] = v ? [Math.min(t.y1, t.y2), Math.max(t.y1, t.y2)] : [Math.min(t.x1, t.x2), Math.max(t.x1, t.x2)];
    if (v) for (const i of near(ux, t.x1)) for (let j = 0; j + 1 < ny; j++) { if (uy[j] >= lo - 0.5 && uy[j + 1] <= hi + 0.5) useV[j * nx + i] = 1; }
    else for (const j of near(uy, t.y1)) for (let i = 0; i + 1 < nx; i++) { if (ux[i] >= lo - 0.5 && ux[i + 1] <= hi + 0.5) useH[j * nx + i] = 1; }
  }
  return { xs: ux, ys: uy, nx, ny, okP, okH, okV, gH, gV, bH, bV, useH, useV,
    ownH: new Int16Array(nx * ny), ownV: new Int16Array(nx * ny),
    ix: new Map(ux.map((v, i) => [v, i])), iy: new Map(uy.map((v, i) => [v, i])) };
}

const snap = (map, arr, v) => {
  const r = Math.round(v * 2) / 2;
  if (map.has(r)) return map.get(r);
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - v) < Math.abs(arr[best] - v)) best = i;
  return best;
};

// A port: the point on the box edge, and the grid point just outside it.
function portAt(r, side, coord, grid, P, isGroup) {
  const out = isGroup ? 10 : P;
  let bx, by, ox, oy;
  // An icon node's label hangs below it; a connection downwards starts under the label.
  const below = r.node?.style === 'icon' && r.node.extLabel?.box ? r.node.extLabel.box.y + r.node.extLabel.box.h + 3 : null;
  if (side === 0) { bx = r.x + r.w; by = coord; ox = bx + out; oy = by; }
  else if (side === 2) { bx = r.x; by = coord; ox = bx - out; oy = by; }
  else if (side === 1) { bx = coord; by = below ?? r.y + r.h; ox = bx; oy = by + out; }
  else { bx = coord; by = r.y; ox = bx; oy = by - out; }
  const i = snap(grid.ix, grid.xs, ox), j = snap(grid.iy, grid.ys, oy);
  if (!grid.okP[j * grid.nx + i]) return null;
  // Keep the first segment perpendicular: the snapped grid point defines the port.
  if (side % 2 === 0) by = grid.ys[j]; else bx = grid.xs[i];
  return { i, j, side, coord: side % 2 === 0 ? grid.ys[j] : grid.xs[i], boundary: { x: bx, y: by }, dir: side };
}

function portsOf(r, E, which, grid, P) {
  const other = which === 'a' ? E.b : E.a;
  const isGroup = which === 'a' ? E.aGroup : E.bGroup;
  const out = [];
  const oy = overlap(r.y, r.h, other.y, other.h), ox = overlap(r.x, r.w, other.x, other.w);
  for (const side of [0, 1, 2, 3]) {
    const mid = side % 2 === 0 ? r.y + r.h / 2 : r.x + r.w / 2;
    const centre = portAt(r, side, mid, grid, P, isGroup);
    out.push(centre);
    if (r.round) continue;
    if (side % 2 === 0 && oy) out.push(portAt(r, side, oy.mid, grid, P, isGroup));
    if (side % 2 === 1 && ox) out.push(portAt(r, side, ox.mid, grid, P, isGroup));
    // If the middle of a side is blocked, try along the side: an edge may leave through
    // whatever part of the side is free instead of going round to another side.
    if (!centre) for (const t of [0.25, 0.75, 0.15, 0.85]) {
      const c = side % 2 === 0 ? r.y + r.h * t : r.x + r.w * t;
      const q = portAt(r, side, c, grid, P, isGroup);
      if (q) { out.push(q); break; }
    }
  }
  return out.filter(Boolean);
}

// ---------- search ----------

function astar(grid, starts, goals, allowed, gIndex, bundle = 0) {
  if (!starts.length || !goals.length) return null;
  const { nx, ny, xs, ys } = grid, N = nx * ny;
  const dist = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1);
  const heap = new Heap();
  const goalAt = new Map();
  for (const g of goals) goalAt.set(g.j * nx + g.i, g);
  const h = k => { const x = xs[k % nx], y = ys[(k / nx) | 0]; let best = Infinity;
    for (const g of goals) best = Math.min(best, Math.abs(xs[g.i] - x) + Math.abs(ys[g.j] - y)); return best; };
  for (const s of starts) {
    const k = s.j * nx + s.i, st = k * 4 + s.dir;
    const d0 = s.pen || 0;
    if (dist[st] > d0) { dist[st] = d0; prev[st] = -2 - starts.indexOf(s); heap.push(d0 + h(k), st); }
  }
  let best = Infinity, bestState = -1, bestGoal = null;
  while (heap.size) {
    const [f, st] = heap.pop();
    if (f >= best) break;
    const g0 = dist[st];
    if (f - h((st / 4) | 0) > g0 + 1e-6) continue;
    const k = (st / 4) | 0, d = st & 3, i = k % nx, j = (k / nx) | 0;
    const goal = goalAt.get(k);
    if (goal) {
      const inward = (goal.dir + 2) % 4;              // arriving means moving into the box
      const total = g0 + (d === inward ? 0 : BEND) + (goal.pen || 0);
      if (total < best) { best = total; bestState = st; bestGoal = goal; }
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;
      const ni = i + DX[nd], nj = j + DY[nd];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const seg = nd === 0 ? k : nd === 2 ? k - 1 : nd === 1 ? k : k - nx;
      const horizontal = nd % 2 === 0;
      if (!(horizontal ? grid.okH[seg] : grid.okV[seg])) continue;
      const nk = nj * nx + ni;
      const len = horizontal ? Math.abs(xs[ni] - xs[i]) : Math.abs(ys[nj] - ys[j]);
      const grp = horizontal ? grid.gH[seg] : grid.gV[seg];
      let c = len * ((grp >= 0 && !allowed.has(grp) ? 1 + FOREIGN : 1) + ((horizontal ? grid.bH[seg] : grid.bV[seg]) ? 2 : 0));
      if (nd !== d) c += BEND;
      const own = bundle && (horizontal ? grid.ownH[seg] : grid.ownV[seg]) === bundle;
      if (own) c = len * 0.35;                              // ride the bundle's trunk
      else c += (horizontal ? grid.useH[seg] : grid.useV[seg]) * OVERLAP;
      // Crossing an earlier route at the point we arrive at.
      if (!own) {
        if (horizontal) { if ((nj > 0 && grid.useV[nk - nx] && grid.ownV[nk - nx] !== bundle) || (nj < ny - 1 && grid.useV[nk] && grid.ownV[nk] !== bundle)) c += CROSS; }
        else if ((ni > 0 && grid.useH[nk - 1] && grid.ownH[nk - 1] !== bundle) || (ni < nx - 1 && grid.useH[nk] && grid.ownH[nk] !== bundle)) c += CROSS;
      }
      const ns = nk * 4 + nd, g1 = g0 + c;
      if (g1 < dist[ns]) { dist[ns] = g1; prev[ns] = st; heap.push(g1 + h(nk), ns); }
    }
  }
  if (bestState < 0) return null;
  const cells = [];
  let st = bestState, startIdx = 0;
  while (st >= 0) { cells.push(st); const p = prev[st]; if (p < -1) { startIdx = -2 - p; break; } st = p; }
  cells.reverse();
  const start = starts[startIdx];
  const pts = [start.boundary, ...cells.map(s => { const k = (s / 4) | 0; return { x: xs[k % nx], y: ys[(k / nx) | 0] }; }), bestGoal.boundary];
  return { points: pts, cells: cells.map(s => (s / 4) | 0), startSide: start.side, goalSide: bestGoal.side,
    startCoord: start.coord, goalCoord: bestGoal.coord, cost: best };
}

function markUse(grid, cells, delta = 1, bundle = 0) {
  const own = (arr, k) => { if (delta > 0) { if (bundle) arr[k] = bundle; } else if (arr[k] === bundle) arr[k] = 0; };
  for (let t = 1; t < cells.length; t++) {
    const a = cells[t - 1], b = cells[t];
    if (b === a + 1) { grid.useH[a] += delta; own(grid.ownH, a); } else if (b === a - 1) { grid.useH[b] += delta; own(grid.ownH, b); }
    else if (b === a + grid.nx) { grid.useV[a] += delta; own(grid.ownV, a); } else if (b === a - grid.nx) { grid.useV[b] += delta; own(grid.ownV, b); }
  }
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(f, v) { const a = this.a; a.push([f, v]); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l; if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } }
    return top; }
}

function simplify(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && Math.abs(out.at(-1).x - p.x) < 0.01 && Math.abs(out.at(-1).y - p.y) < 0.01) continue;
    out.push({ x: p.x, y: p.y });
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3);
      if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)) out.splice(-2, 1);
      else break;
    }
  }
  return out;
}

// ---------- separate parallel segments ----------

function nudge(routes) {
  for (const horizontal of [true, false]) {
    const segs = [];
    routes.forEach((r, ri) => {
      const p = r.points;
      for (let s = 1; s < p.length - 2; s++) {           // interior segments only; ends attach to ports
        const a = p[s], b = p[s + 1];
        if (horizontal ? Math.abs(a.y - b.y) < 0.01 : Math.abs(a.x - b.x) < 0.01)
          segs.push({ ri, s, at: horizontal ? a.y : a.x, lo: Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), hi: Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y),
            key: horizontal ? (p[s - 1].y + p[s + 2].y) / 2 : (p[s - 1].x + p[s + 2].x) / 2 });
      }
    });
    const byLine = new Map();
    for (const sg of segs) { const k = Math.round(sg.at); (byLine.get(k) || byLine.set(k, []).get(k)).push(sg); }
    for (const list of byLine.values()) {
      list.sort((a, b) => a.lo - b.lo);
      let cluster = [], hi = -Infinity;
      const flush = () => {
        const ris = new Set(cluster.map(c => c.ri));
        const sameBundle = routes[cluster[0].ri].bundle && cluster.every(c => routes[c.ri].bundle === routes[cluster[0].ri].bundle);
        if (ris.size > 1 && !sameBundle) {
          cluster.sort((a, b) => a.key - b.key);
          const step = 7;
          cluster.forEach((c, i) => {
            const off = (i - (cluster.length - 1) / 2) * step;
            const p = routes[c.ri].points;
            if (horizontal) { p[c.s].y += off; p[c.s + 1].y += off; } else { p[c.s].x += off; p[c.s + 1].x += off; }
          });
        }
        cluster = [];
      };
      for (const sg of list) { if (sg.lo > hi - 1 && cluster.length) { flush(); hi = -Infinity; } cluster.push(sg); hi = Math.max(hi, sg.hi); }
      if (cluster.length) flush();
    }
  }
}

// ---------- labels ----------

function placeLabels(routes, geo, hard, m) {
  const placed = [];
  // Labels may sit in a node's routing margin, but not on the node itself.
  const inner = (geo.nodePad ?? S.edge.nodePad) - 3;
  const blocks = [...hard.map(o => ({ x: o.x + (o.node ? inner : 0), y: o.y + (o.node ? inner : 0),
    w: o.w - (o.node ? 2 * inner : 0), h: o.h - (o.node ? 2 * inner : 0) }))];
  for (const t of geo.taken || []) blocks.push({ x: Math.min(t.x1, t.x2) - 3, y: Math.min(t.y1, t.y2) - 3, w: Math.abs(t.x2 - t.x1) + 6, h: Math.abs(t.y2 - t.y1) + 6 });
  // A label straddling a box's border reads as part of the box: the border lines block.
  for (const r of geo.groups.values()) {
    if (r.group.style === 'plain') continue;
    const t = 3;
    blocks.push({ x: r.x - t, y: r.y - t, w: r.w + 2 * t, h: 2 * t }, { x: r.x - t, y: r.y + r.h - t, w: r.w + 2 * t, h: 2 * t });
    if (!r.lane) blocks.push({ x: r.x - t, y: r.y - t, w: 2 * t, h: r.h + 2 * t }, { x: r.x + r.w - t, y: r.y - t, w: 2 * t, h: r.h + 2 * t });
  }
  // Another edge's line within a few pixels makes a label ambiguous, as if on that line.
  const segsOf = r => r.points.slice(1).map((q, i) => { const a = r.points[i]; return { x: Math.min(a.x, q.x) - 6, y: Math.min(a.y, q.y) - 6, w: Math.abs(a.x - q.x) + 12, h: Math.abs(a.y - q.y) + 12 }; });
  const lines = routes.map(segsOf);
  const hits = (r) => blocks.some(b => intersects(r, b)) || placed.some(b => intersects(r, b))
    || r.x < 2 || r.y < 2 || r.x + r.w > geo.width - 2 || r.y + r.h > geo.height - 2;
  // Longest labels first: they have the fewest places to go.
  const order = routes.map((r, i) => i).filter(i => routes[i].edge.label)
    .sort((a, b) => m.width(routes[b].edge.label, T.edge) - m.width(routes[a].edge.label, T.edge));
  const labelled = new Set();
  for (const ri of order) {
    const r = routes[ri], text = r.edge.label;
    // a, b -> c : label   draws the label once, on the first of its edges to be placed,
    // when the edges share an end (fan-in or fan-out).
    const fan = r.edge.stmt && routes.some(q => q !== r && q.edge.stmt === r.edge.stmt && (q.edge.to === r.edge.to || q.edge.from === r.edge.from));
    if (fan && labelled.has(r.edge.stmt)) continue;
    if (fan) labelled.add(r.edge.stmt);
    const w = m.width(text, T.edge), h = 14;
    const p = r.points, cands = [];
    const total = p.reduce((s, q, i) => s + (i ? Math.abs(q.x - p[i - 1].x) + Math.abs(q.y - p[i - 1].y) : 0), 0);
    const fromGateway = geo.nodes.get(r.edge.from)?.node?.shape === 'gateway';
    let run = 0;
    for (let s = 0; s + 1 < p.length; s++) {
      const a = p[s], b = p[s + 1], len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const middle = fromGateway ? (run + len / 2) / (total || 1) * 0.8 : Math.abs(run + len / 2 - total / 2) / (total || 1);
      run += len;
      if (len < 18) continue;
      const horizontal = Math.abs(a.y - b.y) < 0.01;
      // Every few pixels along the segment, preferring its middle.
      const ts = [0.5];
      for (let d = 6; d < len / 2; d += 6) ts.push(0.5 - d / len, 0.5 + d / len);
      for (const t of ts) {
        const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t, off = Math.abs(t - 0.5) * 0.4;
        if (horizontal && len >= Math.min(w + 16, w * 0.75 + 24)) {
          cands.push({ x: cx - w / 2, y: cy - h - 3, w, h, score: middle + off });
          cands.push({ x: cx - w / 2, y: cy + 4, w, h, score: middle + off + 0.15 });
        }
        if (!horizontal && len >= h + 16) {
          cands.push({ x: cx + 7, y: cy - h / 2, w, h, score: middle + off + 0.25 });
          cands.push({ x: cx - 7 - w, y: cy - h / 2, w, h, score: middle + off + 0.35 });
        }
        // On the line itself, the halo interrupting it: for narrow channels.
        if (!horizontal && len >= h + 24) cands.push({ x: cx - w / 2, y: cy - h / 2, w, h, score: middle + off + 0.6, inline: true });
        if (horizontal && len >= w + 24) cands.push({ x: cx - w / 2, y: cy - h / 2, w, h, score: middle + off + 0.7, inline: true });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    // Best: touches nothing. Next: lies over another edge's line (its halo cuts the line).
    const crossesLine = c => lines.some((ls, k) => k !== ri && ls.some(b => intersects(c, b)));
    let spot = cands.find(c => !hits(c) && !crossesLine(c)) || cands.find(c => !hits(c));
    if (!spot) {
      // Nowhere clean: the spot that covers the least, text and boxes weighing most.
      const cost = c => 10 * hard.filter(o => intersects(c, o)).length + 10 * placed.filter(b => intersects(c, b)).length
        + 3 * blocks.filter(b => intersects(c, b)).length + (crossesLine(c) ? 1 : 0) + c.score
        + (c.x < 2 || c.y < 2 || c.x + c.w > geo.width - 2 || c.y + c.h > geo.height - 2 ? 100 : 0);
      spot = cands.reduce((best, c) => (!best || cost(c) < cost(best) ? c : best), null);
      if (!spot) { const a = p[0], b = p.at(-1); spot = { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - h / 2, w, h }; }
      // Only a label over text, a node or another label is a problem worth a re-render;
      // touching a box border is the best the space allows.
      r.labelCrowded = hard.some(o => intersects(spot, o) && (o.node || o.id.includes('#'))) || placed.some(b => intersects(spot, b));
    }
    placed.push({ x: spot.x - 4, y: spot.y - 1, w: spot.w + 8, h: spot.h + 2 });   // keep neighbours apart
    r.label = { text, x: spot.x, y: spot.y, w, h };
  }
}

const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
