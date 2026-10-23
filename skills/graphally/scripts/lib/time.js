// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Dates for page mode: the arithmetic an author should not do by hand, as two primitives a
// before-layout script calls. Neither decides how anything looks.
//
//   schedule(elements)            data-after="a,b" data-duration="2w" (or data-start, data-end,
//                                 data-at) become data-start and data-end, YYYY-MM-DD
//   timeline(container, options)  one grid column per day (or per week), from the month of the
//                                 first dated element to the month after the last one (or from
//                                 from to to). The lines are named d2026-03-02 (each day),
//                                 m2026-03 (each month), start and end, so CSS places anything by
//                                 date; dated elements go on them, and the months, quarters and
//                                 years come back, ready to label a header
//
// Days are calendar days, 2w is 14 of them, and an end date is a boundary: a task that
// follows another starts on the day the other ends.
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

export function timeline(box, { from, to, lead = '', unit = 'day' } = {}, problems) {
  if (!box) { problems.push({ rule: 'bad-option', option: 'timeline', hint: 'timeline(container): no such container' }); return null; }
  // The range: as given, else the dated elements inside, out to whole months.
  let lo = dayOf(from), hi = dayOf(to);
  if (Number.isNaN(lo) || Number.isNaN(hi)) {
    const days = [...box.querySelectorAll('[data-start]')].flatMap(e => [dayOf(e.dataset.start), dayOf(e.dataset.end)]).filter(Number.isFinite);
    if (!days.length) { problems.push({ rule: 'bad-option', option: 'timeline', hint: 'no dated elements inside: give from and to, or call schedule() first' }); return null; }
    // Half a month of room after the last date, for labels that follow a bar.
    const first = isoOf(Math.min(...days)), last = isoOf(Math.max(...days) + 14);
    if (Number.isNaN(lo)) lo = dayOf(`${first.slice(0, 7)}-01`);
    if (Number.isNaN(hi)) { const [y, m] = last.slice(0, 7).split('-').map(Number); hi = dayOf(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`); }
  }
  if (Number.isNaN(lo) || Number.isNaN(hi) || hi <= lo) { problems.push({ rule: 'bad-option', option: 'timeline', value: `${from}..${to}`, hint: 'from and to as YYYY-MM-DD, to after from' }); return null; }
  const step = unit === 'week' ? 7 : 1;
  if ((hi - lo) / step > 1500) { problems.push({ rule: 'bad-option', option: 'timeline', hint: `${Math.round(hi - lo)} days is too long by the day: give unit: 'week'` }); return null; }
  // One track per day (or week); its start line is named d<date>, and the first track of
  // each month also m<YYYY-MM>. The first line is also "start", the last "end".
  const starts = [];
  for (let d = lo; d < hi; d += step) starts.push(d);
  const months = [];
  const lines = starts.map((d, i) => {
    const iso = isoOf(d), names = [`d${iso}`];
    if (i === 0) names.push('start');
    const month = isoOf(Math.min(d + step - 1, hi - 1)).slice(0, 7);
    if (i === 0 || (step === 1 ? iso.endsWith('-01') : month !== isoOf(d - 1).slice(0, 7) && !months.some(m => m.month === month))) {
      const mm = step === 1 ? iso.slice(0, 7) : (i === 0 ? iso.slice(0, 7) : month);
      if (!months.some(m => m.month === mm)) { names.push(`m${mm}`); months.push({ name: `m${mm}`, month: mm, start: iso }); }
    }
    return names;
  });
  const endName = `d${isoOf(hi)}`;
  box.style.display = box.style.display || 'grid';
  box.style.gridTemplateColumns = `${lead ? `[lead] ${lead} ` : ''}${lines.map(n => `[${n.join(' ')}] minmax(0, 1fr)`).join(' ')} [${endName} end]`;
  const label = (iso, o) => new Date(`${iso}-01T00:00:00Z`).toLocaleString('en', { timeZone: 'UTC', ...o });
  months.forEach((m, i) => { const next = months[i + 1]; m.end = next ? next.start : isoOf(hi); m.label = label(m.month, { month: 'short' }); m.column = `${m.name} / ${next ? next.name : 'end'}`; });
  const span = key => {
    const out = [];
    for (const m of months) { const k = key(m.month); if (!out.length || out.at(-1).key !== k) out.push({ key: k, from: m, to: m }); else out.at(-1).to = m; }
    return out.map((g, i) => ({ ...g, column: `${g.from.name} / ${out[i + 1] ? out[i + 1].from.name : 'end'}` }));
  };
  const quarters = span(m => `Q${Math.floor((Number(m.slice(5)) - 1) / 3) + 1} ${m.slice(0, 4)}`).map(q => ({ label: q.key, column: q.column }));
  const years = span(m => m.slice(0, 4)).map(y => ({ label: y.key, column: y.column }));
  // Dated elements inside go on their lines (dates between lines snap outwards).
  const lineAt = (d, up) => { const k = Math.max(0, Math.min(starts.length, (up ? Math.ceil : Math.floor)((d - lo) / step))); return k >= starts.length ? 'end' : `d${isoOf(starts[k])}`; };
  for (const e of box.querySelectorAll('[data-start]')) {
    const s = dayOf(e.dataset.start), en = dayOf(e.dataset.end);
    if (Number.isNaN(s)) continue;
    const a = Math.min(Math.max(s, lo), hi), b = Math.min(Math.max(Number.isNaN(en) ? s : en, a), hi);
    const A = lineAt(a, false), B = lineAt(b, true);
    e.style.gridColumn = B !== A ? `${A} / ${B}` : `${A} / span 1`;
  }
  return { from: isoOf(lo), to: isoOf(hi), months, quarters, years, column: (a, b) => `${lineAt(dayOf(a), false)} / ${b ? lineAt(dayOf(b), true) : 'span 1'}` };
}
