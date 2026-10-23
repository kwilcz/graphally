// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Dates for page mode: the arithmetic an author should not do by hand, as two primitives a
// before-layout script calls. Neither decides how anything looks.
//
//   schedule(elements)            data-after="a,b" data-duration="2w" (or data-start, data-end,
//                                 data-at) become data-start and data-end, YYYY-MM-DD
//   timeline(container, options)  one grid column per day between from and to, with grid lines
//                                 named d2026-03-02 (each day) and m2026-03 (each month), so CSS
//                                 places anything by date; dated children are placed on them
//
// Days are calendar days, 2w is 14 of them, and an end date is a boundary: a task after
// another starts on the day it ends (as in layout=gantt).
const DAY = 86400000;
export const dayOf = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? Date.parse(`${v}T00:00:00Z`) / DAY : NaN);
export const isoOf = d => new Date(d * DAY).toISOString().slice(0, 10);
export const lengthOf = v => { const m = /^([\d.]+)\s*([dw]?)$/.exec(String(v || '')); return m ? Number(m[1]) * (m[2] === 'w' ? 7 : 1) : NaN; };

export function schedule(els, root, problems) {
  const byId = id => root.querySelector(`#${CSS.escape(id)}`);
  const done = new Map();
  const resolve = (e, seen = new Set()) => {
    if (done.has(e)) return done.get(e);
    if (seen.has(e)) { problems.push({ rule: 'schedule-loop', id: e.id }); return { s: 0, e: 0 }; }
    seen.add(e);
    const d = e.dataset;
    let s = dayOf(d.start ?? d.at), end = dayOf(d.end);
    if (Number.isNaN(s) && d.after) {
      const deps = d.after.split(/[\s,]+/).map(id => { const x = byId(id); if (!x) problems.push({ rule: 'unknown-id', id, on: e.id }); return x; }).filter(Boolean);
      if (deps.length) s = Math.max(...deps.map(x => resolve(x, seen).e));
    }
    if (Number.isNaN(end) && !Number.isNaN(s)) end = s + (Number.isNaN(lengthOf(d.duration)) ? 0 : lengthOf(d.duration));
    if (Number.isNaN(s)) { problems.push({ rule: 'no-start', id: e.id, hint: 'give data-start (or data-at), or data-after' }); s = end = 0; }
    const r = { s, e: Math.max(end, s) };
    done.set(e, r);
    d.start = isoOf(r.s); d.end = isoOf(r.e);
    return r;
  };
  for (const e of els) resolve(e);
  return els.map(e => done.get(e));
}

export function timeline(box, { from, to, lead = '' } = {}, problems) {
  const lo = dayOf(from), hi = dayOf(to);
  if (Number.isNaN(lo) || Number.isNaN(hi) || hi <= lo) { problems.push({ rule: 'bad-option', option: 'timeline', value: `${from}..${to}`, hint: 'from and to as YYYY-MM-DD, to after from' }); return null; }
  const tracks = [], months = [];
  for (let d = lo; d <= hi; d++) {
    const iso = isoOf(d), names = [`d${iso}`];
    if (d < hi && (d === lo || iso.endsWith('-01'))) { names.push(`m${iso.slice(0, 7)}`); months.push({ name: `m${iso.slice(0, 7)}`, month: iso.slice(0, 7), start: iso }); }
    tracks.push(`[${names.join(' ')}]${d < hi ? ' minmax(0, 1fr)' : ''}`);
  }
  months.forEach((m, i) => { m.end = months[i + 1]?.start ?? isoOf(hi); m.label = new Date(`${m.start}T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' }); m.column = `${m.name} / ${months[i + 1]?.name ?? `d${isoOf(hi)}`}`; });
  box.style.display = box.style.display || 'grid';
  box.style.gridTemplateColumns = `${lead ? `[lead] ${lead} ` : ''}${tracks.join(' ')}`;
  // Dated children of the grid (and of its subgrid rows) go on their lines.
  for (const e of box.querySelectorAll('[data-start]')) {
    const s = dayOf(e.dataset.start), en = dayOf(e.dataset.end);
    if (Number.isNaN(s)) continue;
    const a = Math.min(Math.max(s, lo), hi), b = Math.min(Math.max(Number.isNaN(en) ? s : en, a), hi);
    e.style.gridColumn = b > a ? `d${isoOf(a)} / d${isoOf(b)}` : `d${isoOf(a)} / span 1`;
  }
  return { months, column: (a, b) => `d${a} / d${b ?? a}` };
}
