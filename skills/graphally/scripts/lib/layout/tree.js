// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Hierarchies: management groups, org charts, module trees. Nesting in the source is the
// hierarchy. Children sit side by side under their parent, centred (a simple tidy tree in
// the spirit of Reingold & Tilford 1981); a node with stack=true lists its children
// vertically on a spine, which keeps long leaf lists narrow. <level> bands label ranges of
// depth, like "Management groups" or "Subscriptions".
import { S, T } from '../style.js';
import { sizeNodes } from './areas.js';

const GAP_X = 28, GAP_Y = 44, STACK_INDENT = 28, STACK_GAP = 12;
const BAND = { head: 0, padTop: 18, padBottom: 18, gap: 12, padX: 16, gutterMax: 170 };

export function layoutTree(model, m) {
  const style = model.attrs['node-style'];
  if (style) for (const n of model.nodes.values()) if (!n.attrs.style) n.style = style;
  sizeNodes(model, m);
  const roots = [...model.nodes.values()].filter(n => !n.treeParent);
  const kidsOf = n => n.kids || [];
  const stacked = n => (n.attrs.stack || model.attrs.stack === 'leaves') && kidsOf(n).length > 1 && kidsOf(n).every(k => !kidsOf(k).length);

  // Depth and per-depth heights.
  // Depth: from nesting, or forced with depth=N; leaves=bottom puts every leaf on the
  // deepest row (all subscriptions in one band, whatever their parent's depth).
  const depthOf = new Map();
  const setDepth = (n, d) => {
    const forced = Number(n.attrs.depth);
    const dd = Number.isFinite(forced) && n.attrs.depth !== undefined ? Math.max(forced, d) : d;
    depthOf.set(n.id, dd);
    kidsOf(n).forEach(k => setDepth(k, dd + 1));
  };
  roots.forEach(r => setDepth(r, 0));
  let maxDepth = Math.max(0, ...depthOf.values());
  if (model.attrs.leaves === 'bottom') {
    for (const n of model.nodes.values()) if (!kidsOf(n).length && n.treeParent && n.attrs.depth === undefined) depthOf.set(n.id, maxDepth);
  }
  for (const n of model.nodes.values()) if (stacked(n)) {
    const d = Math.max(...kidsOf(n).map(k => depthOf.get(k.id)));
    kidsOf(n).forEach(k => depthOf.set(k.id, d));
  }
  maxDepth = Math.max(0, ...depthOf.values());
  const lv = (model.levels || []).slice().sort((a, b) => a.lo - b.lo);
  for (let i = 1; i < lv.length; i++) if (lv[i].lo <= lv[i - 1].hi)
    model.problems.push({ rule: 'level-overlap', a: lv[i - 1].label, b: lv[i].label, hint: 'each depth can belong to one <level> only; use leaves=bottom or depth=N on nodes' });
  const levelH = Array(maxDepth + 1).fill(0);
  for (const n of model.nodes.values()) {
    const d = depthOf.get(n.id);
    if (n.treeParent && stacked(n.treeParent)) continue;
    levelH[d] = Math.max(levelH[d], n.fh);
  }
  for (const n of model.nodes.values()) if (stacked(n)) {
    const block = kidsOf(n).reduce((s, k) => s + k.fh, 0) + STACK_GAP * (kidsOf(n).length - 1);
    const d = depthOf.get(kidsOf(n)[0].id);
    levelH[d] = Math.max(levelH[d], block);
  }

  // Subtree widths.
  const width = new Map();
  const measure = n => {
    let w;
    if (stacked(n)) w = Math.max(n.fw, n.fw / 2 + STACK_INDENT + Math.max(...kidsOf(n).map(k => k.fw)) - 0);
    else if (kidsOf(n).length) w = Math.max(n.fw, kidsOf(n).reduce((s, k) => s + measure(k), 0) + GAP_X * (kidsOf(n).length - 1));
    else w = n.fw;
    width.set(n.id, w);
    return w;
  };
  roots.forEach(measure);

  // Vertical positions, with band padding where bands start and end.
  const levels = (model.levels || []).slice().sort((a, b) => a.lo - b.lo);
  const titleH = (model.title ? 22 : 0) + (model.subtitle ? 18 : 0);
  let y = S.pad + (titleH ? titleH + S.titleGap : 0);
  const levelY = [];
  const bandSpans = [];
  for (let d = 0; d <= maxDepth; d++) {
    const starts = levels.find(b => b.lo === d);
    if (starts) { bandSpans.push({ band: starts, top: y }); y += BAND.head + BAND.padTop; }
    levelY[d] = y;
    y += levelH[d];
    const ends = levels.find(b => b.hi === d);
    if (ends) { const span = bandSpans.find(s => s.band === ends); span.bottom = y + BAND.padBottom; y += BAND.padBottom + BAND.gap; }
    else y += GAP_Y;
  }
  const contentBottom = y - (levels.find(b => b.hi === maxDepth) ? BAND.gap : GAP_Y);

  // Horizontal positions.
  const geo = { nodes: new Map(), groups: new Map(), bodies: new Map(), legendBox: null, fixedRoutes: [] };
  // Band titles live in a gutter on the left, so tree lines never cross them.
  const gutter = levels.length ? Math.min(BAND.gutterMax, Math.max(...levels.map(b => Math.max(...m.wrap(b.label, T.group, BAND.gutterMax - 2 * BAND.padX).map(l => m.width(l, T.group))))) + 2 * BAND.padX) : 0;
  const leftPad = S.pad + (levels.length ? gutter + BAND.padX : 0);
  const place = (n, left) => {
    const w = width.get(n.id), d = depthOf.get(n.id);
    if (stacked(n)) {
      const x = left;
      geo.nodes.set(n.id, { x, y: levelY[d], w: n.fw, h: n.fh, node: n });
      const spine = x + n.fw / 2;
      let ky = levelY[depthOf.get(kidsOf(n)[0].id)];
      for (const k of kidsOf(n)) {
        const inset = 0;
        geo.nodes.set(k.id, { x: spine + STACK_INDENT - inset, y: ky, w: k.fw, h: k.fh, node: k });
        ky += k.fh + STACK_GAP;
      }
      return;
    }
    if (kidsOf(n).length) {
      const total = kidsOf(n).reduce((s, k) => s + width.get(k.id), 0) + GAP_X * (kidsOf(n).length - 1);
      let at = left + (w - total) / 2;
      for (const k of kidsOf(n)) { place(k, at); at += width.get(k.id) + GAP_X; }
      const first = geo.nodes.get(kidsOf(n)[0].id), last = geo.nodes.get(kidsOf(n).at(-1).id);
      const cx = (first.x + first.w / 2 + last.x + last.w / 2) / 2;
      geo.nodes.set(n.id, { x: cx - n.fw / 2, y: levelY[d], w: n.fw, h: n.fh, node: n });
    } else geo.nodes.set(n.id, { x: left + (w - n.fw) / 2, y: levelY[d], w: n.fw, h: n.fh, node: n });
  };
  let left = leftPad;
  for (const r of roots) { place(r, left); left += width.get(r.id) + GAP_X * 2; }
  const contentRight = Math.max(...[...geo.nodes.values()].map(r => r.x + r.w));
  const titleW = Math.max(model.title ? m.width(model.title, T.title) : 0, model.subtitle ? m.width(model.subtitle, T.subtitle) : 0);
  const W = Math.ceil(Math.max(contentRight + (levels.length ? BAND.padX : 0) + S.pad, S.pad * 2 + titleW));
  // Centre the tree if the title made the canvas wider.
  const shift = Math.max(0, (W - S.pad * 2 - (levels.length ? gutter + BAND.padX * 2 : 0) - (contentRight - leftPad)) / 2);
  if (shift > 1) for (const r of geo.nodes.values()) r.x += shift;

  // Icon-style nodes were placed by footprint; the node itself is the icon, label below.
  // Stacked children align their icon (not their label) to the spine.
  for (const r of geo.nodes.values()) {
    const n = r.node;
    if (n.style !== 'icon') continue;
    const stackedKid = n.treeParent && stacked(n.treeParent);
    const ix = stackedKid ? r.x : r.x + (r.w - n.w) / 2;
    n.extLabel.box = { x: ix + n.w / 2 - n.extLabel.w / 2, y: r.y + n.h + 6, w: n.extLabel.w, h: n.extLabel.h };
    Object.assign(r, { x: ix, w: n.w, h: n.h, round: true });
  }
  const vis = r => r;

  // Bus connectors: parent down to a bar, bar down to each child.
  const arrows = !!model.attrs.arrows;
  for (const n of model.nodes.values()) {
    if (!kidsOf(n).length) continue;
    const p = geo.nodes.get(n.id);
    if (stacked(n)) {
      const sx = p.x + p.w / 2, sTop = (p.node.extLabel?.box ? p.node.extLabel.box.y + p.node.extLabel.box.h : p.y + p.h) + 4;
      for (const k of kidsOf(n)) {
        const c = geo.nodes.get(k.id), v = vis(c);
        const cy = v.y + v.h / 2;
        geo.fixedRoutes.push({ edge: { from: n.id, to: k.id, line: !arrows }, points: [{ x: sx, y: sTop }, { x: sx, y: cy }, { x: v.x, y: cy }] });
      }
      continue;
    }
    const px = p.x + p.w / 2, top = Math.min(...kidsOf(n).map(k => vis(geo.nodes.get(k.id)).y));
    const bottom = (p.node.extLabel?.box ? p.node.extLabel.box.y + p.node.extLabel.box.h : p.y + p.h) + 4;
    const mid = bottom + (top - bottom) / 2;
    for (const k of kidsOf(n)) {
      const c = vis(geo.nodes.get(k.id)), cx = c.x + c.w / 2;
      const pts = Math.abs(cx - px) < 0.5 ? [{ x: px, y: bottom }, { x: px, y: c.y }]
        : [{ x: px, y: bottom }, { x: px, y: mid }, { x: cx, y: mid }, { x: cx, y: c.y }];
      geo.fixedRoutes.push({ edge: { from: n.id, to: k.id, line: !arrows }, points: pts });
    }
  }

  // Bands as full-width groups.
  for (const s of bandSpans) {
    const id = `#level${s.band.lo}`;
    const g = { id, kind: 'group', label: s.band.label, icon: s.band.icon, sub: '', style: 'band', depth: 0, children: [], attrs: {} };
    const r = { x: S.pad, y: s.top, w: W - 2 * S.pad, h: (s.bottom ?? contentBottom + BAND.padBottom) - s.top };
    g.lines = m.wrap(g.label, T.group, gutter - 2 * BAND.padX);
    const headW = Math.max(...g.lines.map(l => m.width(l, T.group)));
    geo.groups.set(id, { ...r, group: g, gutter, head: { x: r.x + BAND.padX, y: r.y + 14, w: headW, h: g.lines.length * 16 } });
  }

  geo.width = W;
  geo.height = Math.ceil(contentBottom + (levels.find(b => b.hi === maxDepth) ? BAND.padBottom : 0) + S.pad);
  geo.title = titleH ? { x: S.pad, y: S.pad, w: titleW, h: titleH } : null;
  return geo;
}
