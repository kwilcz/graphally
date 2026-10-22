// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Time charts: Gantt plans and timelines.
//
//   <diagram layout=gantt today=2026-03-02>
//     <lane label="Platform">
//       <task id=net start=2026-01-12 end=2026-02-06>Hub network</task>
//       <task id=aks after=net duration=3w accent>AKS cluster</task>
//       <milestone id=golive at=2026-04-01>Go-live</milestone>
//     </lane>
//     <links> net -> aks </links>
//   </diagram>
//
// Dates (YYYY-MM-DD) or plain numbers; durations in d, w (days) or plain units. One row
// per task, lanes as bands with their titles in a left gutter, the axis on top with ticks
// chosen from the span (days, weeks or months), dependencies as elbow arrows from the end
// of one bar to the start of the next.
import { S, T } from '../style.js';

const ROW = 30, BAR = 22, GAP = 6, LANE_PAD = 10, AXIS = 34, DAY = 86400000;

export function layoutGantt(model, m) {
  const lanes = model.root.children.filter(c => c.kind === 'group');
  const loose = model.root.children.filter(c => c.kind === 'node');
  const all = loose.length || !lanes.length ? [{ id: '#all', label: '', children: loose, implicit: true }, ...lanes] : lanes;
  const items = all.flatMap(l => l.children.filter(c => c.kind === 'node').map(n => ({ n, lane: l })));
  const isDate = items.some(({ n }) => /^\d{4}-\d{2}-\d{2}$/.test(n.attrs.start || n.attrs.at || n.attrs.end || ''));
  const num = v => (v === undefined || v === '' ? NaN : isDate && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(v + 'T00:00:00Z') / DAY : Number(v));
  const dur = v => { const mm = /^([\d.]+)\s*([dw]?)$/.exec(String(v || '')); return mm ? Number(mm[1]) * (mm[2] === 'w' ? 7 : 1) : NaN; };

  // Resolve start and end, following after= references (in any order).
  const byId = new Map(items.map(it => [it.n.id, it]));
  const resolve = (it, seen = new Set()) => {
    if (it.done) return it;
    if (seen.has(it)) { it.s = it.e = 0; return it; }
    seen.add(it);
    const a = it.n.attrs;
    let s = num(a.start ?? a.at), e = num(a.end);
    if (Number.isNaN(s) && a.after) {
      const deps = String(a.after).split(/[\s,]+/).map(id => byId.get(id)).filter(Boolean);
      if (deps.length) s = Math.max(...deps.map(d => resolve(d, seen).e));
      else model.problems.push({ rule: 'unknown-id', id: a.after, on: it.n.id });
    }
    if (Number.isNaN(e) && !Number.isNaN(s)) e = s + (Number.isNaN(dur(a.duration)) ? 0 : dur(a.duration));
    if (Number.isNaN(s)) { model.problems.push({ rule: 'no-start', id: it.n.id, hint: 'give start= (or at= for a milestone), or after=<id>' }); s = e = 0; }
    it.s = s; it.e = Math.max(e, s); it.mile = it.n.shape === 'milestone' || it.e === it.s; it.done = true;
    return it;
  };
  items.forEach(it => resolve(it));
  const today = num(model.attrs.today);
  let lo = Math.min(...items.map(it => it.s)), hi = Math.max(...items.map(it => it.e));
  if (!Number.isNaN(today)) { lo = Math.min(lo, today); hi = Math.max(hi, today); }
  const span = Math.max(1, hi - lo);

  // Scale: wide enough that the shortest bar can hold a few letters, within reason.
  const labelW = it => m.width(it.n.label, T.msg) + 16;
  const titleH = (model.title ? 22 : 0) + (model.subtitle ? 18 : 0);
  const gutter = all.some(l => l.label) ? Math.min(170, Math.max(90, ...all.map(l => m.width(l.label || '', T.group) + 32))) : 0;
  const width = Number(model.attrs.width) || Math.min(1500, Math.max(1000, items.length * 70));
  const tail = Math.max(0, ...items.map(it => labelW(it) + 10));   // room for labels after the last bar
  const px = (width - gutter - 2 * S.pad) / (span + span * 0.02) ;
  const x0 = S.pad + gutter + 12;
  const X = t => x0 + (t - lo) * px;

  const geo = { nodes: new Map(), groups: new Map(), bodies: new Map(), legendBox: null, fixedRoutes: [], decor: [], extraObstacles: [] };
  const top = S.pad + (titleH ? titleH + S.titleGap : 0);
  let y = top + AXIS;
  const rows = new Map();
  let right = X(hi);
  all.forEach((l, li) => {
    const list = items.filter(it => it.lane === l);
    if (!list.length) return;
    const laneTop = y;
    y += LANE_PAD;
    for (const it of list) {
      const cy = y + ROW / 2;
      rows.set(it.n.id, { cy, x1: X(it.s), x2: X(it.e) });
      const n = it.n, w = labelW(it);
      if (it.mile) {
        const cx = X(it.s), k = 8;
        geo.decor.push({ t: 'path', layer: 'over', d: `M${cx},${cy - k} L${cx + k},${cy} L${cx},${cy + k} L${cx - k},${cy} Z`, fill: n.accent ? 'woad' : 'ink', stroke: n.accent ? 'woad' : 'ink', width: 1 });
        geo.decor.push({ t: 'text', layer: 'over', str: n.label, x: cx + k + 6, y: cy - 8, h: 16, cls: T.msg, anchor: 'start', tone: n.accent ? 'woad' : undefined });
        right = Math.max(right, cx + k + 6 + w);
      } else {
        const x1 = X(it.s), x2 = X(it.e), bw = Math.max(4, x2 - x1);
        const fill = n.accent ? 'woad' : n.attrs.done !== undefined ? 'line' : 'icon-soft';
        geo.decor.push({ t: 'rect', layer: 'mid', x: x1, y: cy - BAR / 2, w: bw, h: BAR, fill: n.external || n.ghost ? 'card' : fill, stroke: n.accent ? 'woad' : n.external || n.ghost ? 'muted' : 'woad', rx: 5, width: 1.2, dash: n.external || n.ghost ? '5 4' : null });
        // The label sits inside the bar when it fits, else just after it.
        const inside = w <= bw;
        geo.decor.push({ t: 'text', layer: 'over', str: n.label, x: inside ? x1 + 8 : x2 + 8, y: cy - 8, h: 16, cls: T.msg, anchor: 'start', tone: inside && n.accent ? 'card' : n.attrs.done !== undefined ? 'muted' : undefined });
        if (n.sub) geo.decor.push({ t: 'text', layer: 'over', str: n.sub, x: (inside ? x2 : x2 + w) + 8, y: cy - 8, h: 16, cls: T.sub, anchor: 'start', tone: 'muted' });
        right = Math.max(right, inside ? x2 : x2 + 8 + w + (n.sub ? m.width(n.sub, T.sub) + 8 : 0));
      }
      y += ROW + GAP;
    }
    y += LANE_PAD - GAP;
    if (!l.implicit || l.label) {
      const g = { ...l, style: 'lane', depth: 0, laneIndex: li, lines: m.wrap(l.label || '', T.group, gutter - 28) };
      geo.groups.set(l.id, { x: S.pad, y: laneTop, w: 0, h: y - laneTop, group: g, gutter, lane: true, head: { x: S.pad + 14, y: laneTop + (y - laneTop - g.lines.length * 16) / 2, w: gutter - 28, h: g.lines.length * 16 } });
    }
  });
  const bottom = y;
  right = Math.max(right, X(hi)) + 16;
  for (const r of geo.groups.values()) r.w = right - S.pad;

  // Axis: ticks at days, weeks or months, labels on top, faint lines down the chart.
  const ticks = [];
  if (isDate) {
    const start = new Date(lo * DAY), stepDays = span <= 16 ? 1 : span <= 120 ? 7 : 0;
    if (stepDays) {
      let d = new Date(start); if (stepDays === 7) while (d.getUTCDay() !== 1) d = new Date(d.getTime() + DAY);
      for (; d.getTime() / DAY <= hi; d = new Date(d.getTime() + stepDays * DAY)) ticks.push({ t: d.getTime() / DAY, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
    } else {
      for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (start.getUTCDate() > 1 ? 1 : 0), 1)); d.getTime() / DAY <= hi; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
        ticks.push({ t: d.getTime() / DAY, label: d.toLocaleDateString('en-GB', { month: 'short', year: d.getUTCMonth() === 0 || !ticks.length ? 'numeric' : undefined, timeZone: 'UTC' }) });
    }
  } else {
    const raw = span / 8, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map(k => k * mag).find(s => s >= raw);
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push({ t, label: `${+t.toFixed(6)}${model.attrs.unit && t === Math.ceil(lo / step) * step ? ` ${model.attrs.unit}` : ''}` });
  }
  geo.decor.push({ t: 'line', layer: 'under', x1: x0 - 12, y1: top + AXIS - 6, x2: right, y2: top + AXIS - 6, stroke: 'line', width: 1 });
  let lastEnd = -Infinity;
  for (const k of ticks) {
    const tx = X(k.t), w = m.width(k.label, T.sub);
    geo.decor.push({ t: 'line', layer: 'under', x1: tx, y1: top + AXIS - 10, x2: tx, y2: bottom, stroke: 'line', width: 0.8, dash: '2 4' });
    if (tx - w / 2 > lastEnd + 8) { geo.decor.push({ t: 'text', layer: 'over', str: k.label, x: tx, y: top + 4, h: 16, cls: T.sub, anchor: 'middle', tone: 'muted' }); lastEnd = tx + w / 2; }
  }
  if (!Number.isNaN(today)) {
    const tx = X(today);
    geo.decor.push({ t: 'line', layer: 'over', x1: tx, y1: top + AXIS - 10, x2: tx, y2: bottom, stroke: 'rust', width: 1.4, dash: '5 3' });
    geo.decor.push({ t: 'text', layer: 'over', str: 'today', x: tx + 4, y: bottom + 2, h: 16, cls: T.sub, anchor: 'start', tone: 'rust' });
  }

  // Dependencies leave the underside of a bar near its end (its label may follow the bar)
  // and enter the next bar at its start.
  for (const e of model.edges) {
    const a = rows.get(e.from), b = rows.get(e.to);
    if (!a || !b) continue;
    const down = b.cy > a.cy ? 1 : -1;
    // Drop where no bar in the rows between is in the way, as near the end as possible.
    const between = [...rows.values()].filter(r => (r.cy - a.cy) * down > 0 && (b.cy - r.cy) * down > 0);
    let ex = a.x1 === a.x2 ? a.x2 : Math.max(a.x1 + 4, a.x2 - 8);
    for (let c = ex; c >= a.x1 + 4; c -= 3) if (!between.some(r => c > r.x1 - 3 && c < r.x2 + 3)) { ex = c; break; }
    const ey = a.cy + down * (a.x1 === a.x2 ? 9 : BAR / 2), sx = b.x1, sy = b.cy;
    const pts = sx >= ex + 10
      ? [{ x: ex, y: ey }, { x: ex, y: sy }, { x: sx, y: sy }]
      : [{ x: ex, y: ey }, { x: ex, y: sy - down * (ROW + GAP) / 2 }, { x: sx - 10, y: sy - down * (ROW + GAP) / 2 }, { x: sx - 10, y: sy }, { x: sx, y: sy }];
    geo.fixedRoutes.push({ edge: { ...e, line: false }, points: pts });
  }

  const titleW = Math.max(model.title ? m.width(model.title, T.title) : 0, model.subtitle ? m.width(model.subtitle, T.subtitle) : 0);
  geo.width = Math.ceil(Math.max(right + S.pad, titleW + 2 * S.pad));
  geo.height = Math.ceil(bottom + (Number.isNaN(today) ? 0 : 20) + S.pad);
  geo.title = titleH ? { x: S.pad, y: S.pad, w: titleW, h: titleH } : null;
  return geo;
}
