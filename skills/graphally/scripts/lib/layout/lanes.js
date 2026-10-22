// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Processes: BPMN-style swimlanes and plain flowcharts.
//
// Columns come from the order of the flow (longest path over the links, with cycles broken
// in source order), rows from lanes. Every single node in a lane sits on the lane's centre
// line, so a flow that stays in a lane is a straight line. Lane titles live in a left
// gutter. Edges are drawn by the shared router.
import { S, T } from '../style.js';
import { sizeNodes } from './areas.js';

const LANE_PAD = 26, MIN_LANE = 96, STACK_GAP = 36, GUTTER_MAX = 150;

export function layoutLanes(model, m) {
  sizeNodes(model, m);
  // A gateway's label sits above and to the left of the diamond, leaving all four corners
  // free for flows; the footprint grows to the left to hold it.
  for (const n of model.nodes.values()) if (n.shape === 'gateway' && n.extLabel) {
    n.left = Math.max(n.w / 2, n.extLabel.w + 8);
    n.fw = n.left + n.w / 2;
  }
  const root = model.root;
  let lanes = root.children.filter(c => c.kind === 'group');
  const loose = root.children.filter(c => c.kind === 'node');
  const implicit = !lanes.length;
  if (implicit) lanes = [{ id: '#flow', kind: 'group', label: '', style: 'lane', children: loose, depth: 0, attrs: {}, implicit: true }];
  else if (loose.length) lanes = [{ id: '#loose', kind: 'group', label: '', style: 'lane', children: loose, depth: 0, attrs: {} }, ...lanes];

  // Boundary events (<event on=task>) sit on their task's border and take no column.
  const host = new Map();
  for (const n of model.nodes.values()) if (n.shape === 'event' && n.attrs.on && model.nodes.has(n.attrs.on)) host.set(n.id, n.attrs.on);
  const laneOf = new Map();
  const nodes = [];
  lanes.forEach((l, li) => l.children.filter(c => c.kind === 'node' && !host.has(c.id)).forEach(n => { laneOf.set(n.id, li); nodes.push(n); }));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const flow = model.edges.map(e => ({ from: host.get(e.from) || e.from, to: host.get(e.to) || e.to, label: e.label }));

  // Ranks: longest path, cycles broken by source order (an edge back to an earlier node
  // does not push it right).
  const preds = new Map(nodes.map(n => [n.id, []]));
  for (const e of flow) {
    if (!preds.has(e.from) || !preds.has(e.to) || e.from === e.to) continue;
    if (order.get(e.to) > order.get(e.from) || !reaches(e.to, e.from, flow, order)) preds.get(e.to).push(e.from);
  }
  const rank = new Map(), busy = new Set();
  const rankOf = id => {
    if (rank.has(id)) return rank.get(id);
    if (busy.has(id)) return 0;
    busy.add(id);
    const r = Math.max(0, ...preds.get(id).map(p => rankOf(p) + 1));
    busy.delete(id); rank.set(id, r);
    return r;
  };
  nodes.forEach(n => rankOf(n.id));

  // Cells: lane × rank.
  const cells = new Map();
  for (const n of nodes) { const k = `${laneOf.get(n.id)}|${rank.get(n.id)}`; (cells.get(k) || cells.set(k, []).get(k)).push(n); }
  const ranks = Math.max(0, ...rank.values()) + 1;
  const colW = Array(ranks).fill(0);
  for (const n of nodes) colW[rank.get(n.id)] = Math.max(colW[rank.get(n.id)], n.fw);

  const titleH = (model.title ? 22 : 0) + (model.subtitle ? 18 : 0);
  const top0 = S.pad + (titleH ? titleH + S.titleGap : 0);
  const gutter = implicit ? 0 : Math.min(GUTTER_MAX, Math.max(80, ...lanes.map(l => Math.max(...m.wrap(l.label || ' ', T.group, GUTTER_MAX - 28).map(x => m.width(x, T.group))) + 28)));
  const left0 = S.pad + gutter + (implicit ? 0 : 28);
  // Each gap between columns holds the labels of the edges crossing it.
  const GAP_X = Number(model.attrs['col-gap']) || 44;
  const gapAfter = Array(ranks).fill(GAP_X);
  for (const e of flow) {
    // Labels of flows that change lanes go beside the vertical part; only flows within a
    // lane need the gap.
    if (!e.label || !rank.has(e.from) || !rank.has(e.to) || laneOf.get(e.from) !== laneOf.get(e.to)) continue;
    const lo = Math.min(rank.get(e.from), rank.get(e.to)), hi = Math.max(rank.get(e.from), rank.get(e.to));
    if (hi === lo + 1) gapAfter[lo] = Math.max(gapAfter[lo], Math.ceil(m.width(e.label, T.edge) + 30));
  }
  const colX = [];
  let x = left0;
  for (let r = 0; r < ranks; r++) { colX[r] = x; x += colW[r] + gapAfter[r]; }
  const contentRight = x - gapAfter[ranks - 1];

  // Lane heights and node positions.
  const geo = { nodes: new Map(), groups: new Map(), bodies: new Map(), legendBox: null, extraObstacles: [] };
  let y = top0;
  lanes.forEach((l, li) => {
    let need = MIN_LANE;
    for (let r = 0; r < ranks; r++) {
      const cell = cells.get(`${li}|${r}`) || [];
      if (!cell.length) continue;
      const block = cell.reduce((s, n) => s + n.fh, 0) + STACK_GAP * (cell.length - 1);
      // A single node is centred on the shape, so its label below needs room twice over.
      const below = n => Math.max(n.fh - n.h / 2, ...[...host].filter(([, t]) => t === n.id).map(([b]) => n.h / 2 + model.nodes.get(b).fh - model.nodes.get(b).h / 2));
      const single = cell.length === 1 ? 2 * Math.max(cell[0].h / 2, below(cell[0])) : block;
      need = Math.max(need, single + 2 * LANE_PAD);
    }
    const laneTop = y, laneH = need, mid = laneTop + laneH / 2;
    for (let r = 0; r < ranks; r++) {
      const cell = cells.get(`${li}|${r}`) || [];
      if (!cell.length) continue;
      if (cell.length === 1) place(geo, cell[0], colX[r] + (colW[r] - cell[0].fw) / 2, mid - cell[0].h / 2);
      else {
        const block = cell.reduce((s, n) => s + n.fh, 0) + STACK_GAP * (cell.length - 1);
        let cy = mid - block / 2;
        for (const n of cell) { place(geo, n, colX[r] + (colW[r] - n.fw) / 2, cy + (n.shape === 'gateway' && n.extLabel ? n.extLabel.h + 6 : 0)); cy += n.fh + STACK_GAP; }
      }
    }
    if (!l.implicit) {
      const g = { ...l, style: 'lane', depth: 0, laneIndex: lanes.filter(q => !q.implicit).indexOf(l) };
      g.lines = m.wrap(l.label || '', T.group, gutter - 28);
      const r = { x: S.pad, y: laneTop, w: contentRight + 28 - S.pad, h: laneH };
      geo.groups.set(l.id, { ...r, group: g, gutter, lane: true, head: { x: r.x + 14, y: r.y + (laneH - g.lines.length * 16) / 2, w: gutter - 28, h: g.lines.length * 16 } });
    }
    y += laneH;
  });

  for (const [b, t] of host) {
    const n = model.nodes.get(b), r = geo.nodes.get(t);
    if (!r) continue;
    place(geo, n, r.x + r.w - 26 - n.fw / 2, r.y + r.h - n.h / 2);
    // Its label goes beside it, below the task, so the flow can leave straight down.
    if (n.extLabel) {
      const q = geo.nodes.get(b), lb = { x: q.x + q.w + 4, y: r.y + r.h + 4, w: n.extLabel.w, h: n.extLabel.h };
      n.extLabel.box = lb;
      const o = geo.extraObstacles.find(o => o.id === `${b}#label`);
      Object.assign(o, lb);
    }
  }

  const titleW = Math.max(model.title ? m.width(model.title, T.title) : 0, model.subtitle ? m.width(model.subtitle, T.subtitle) : 0);
  geo.width = Math.ceil(Math.max(contentRight + (implicit ? 0 : 28) + S.pad, titleW + 2 * S.pad));
  geo.height = Math.ceil(y + S.pad);
  geo.title = titleH ? { x: S.pad, y: S.pad, w: titleW, h: titleH } : null;
  return geo;
}

// Shape box for routing; the footprint (with an outside label) is centred under it.
function place(geo, n, fx, sy) {
  const sx = n.left !== undefined ? fx + n.left - n.w / 2 : fx + (n.fw - n.w) / 2;
  geo.nodes.set(n.id, { x: sx, y: sy, w: n.w, h: n.h, node: n, round: n.shape === 'start' || n.shape === 'end' || n.shape === 'event' || n.shape === 'gateway' });
  if (n.extLabel) {
    const above = n.shape === 'gateway';            // BPMN habit: frees the lower corner for branches
    const lb = { x: above ? sx + n.w / 2 - 8 - n.extLabel.w : fx + (n.fw - n.extLabel.w) / 2, y: above ? sy - 4 - n.extLabel.h : sy + n.h + 6, w: n.extLabel.w, h: n.extLabel.h };
    n.extLabel.box = lb;
    n.extLabel.align = above ? 'end' : 'middle';
    geo.extraObstacles.push({ id: `${n.id}#label`, ...lb });
  }
}

function reaches(from, to, edges, order) {
  const seen = new Set([from]), stack = [from];
  while (stack.length) {
    const v = stack.pop();
    if (v === to) return true;
    for (const e of edges) if (e.from === v && !seen.has(e.to) && order.has(e.to)) { seen.add(e.to); stack.push(e.to); }
  }
  return false;
}
