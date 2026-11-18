// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// timeline(container, options): one grid column per day (or per week), from the month of the first
// dated element to the month after the last one (or from from to to). The lines are named
// d2026-03-02 (each day), m2026-03 (each month), start and end, so CSS places anything by date;
// dated elements go on them, and the months, quarters and years come back, ready to label a header.
import { dayOf, isoOf, nextMonthStart } from './dates.js';

const startAndEnd = element => [dayOf(element.dataset.start), dayOf(element.dataset.end)];

// The range: as given, else the dated elements inside out to whole months, with half a month of
// room after the last date for labels that follow a bar. Null when nothing inside is dated.
function rangeOf(box, from, to) {
  let lo = dayOf(from), hi = dayOf(to);
  if (!Number.isNaN(lo) && !Number.isNaN(hi)) return { lo, hi };
  const days = [...box.querySelectorAll('[data-start]')].flatMap(startAndEnd);
  const dated = days.filter(Number.isFinite);
  if (!dated.length) return null;
  if (Number.isNaN(lo)) lo = dayOf(`${isoOf(Math.min(...dated)).slice(0, 7)}-01`);
  if (Number.isNaN(hi)) hi = dayOf(nextMonthStart(isoOf(Math.max(...dated) + 14)));
  return { lo, hi };
}

// The month a track begins, when it is the first track of a month not named yet: by the day, the
// month whose first day it is; by the week, the month it reaches into.
function monthBegunAt(day, index, step, hi, months) {
  const iso = isoOf(day), reached = isoOf(Math.min(day + step - 1, hi - 1)).slice(0, 7);
  const isNew = month => !months.some(each => each.month === month);
  const begins = index === 0
    || (step === 1 ? iso.endsWith('-01') : reached !== isoOf(day - 1).slice(0, 7) && isNew(reached));
  const month = step === 1 || index === 0 ? iso.slice(0, 7) : reached;
  return begins && isNew(month) ? month : null;
}

// One track per day (or week); its start line is named d<date>, and the first track of each
// month also m<YYYY-MM>. The first line is also "start".
function namedLines(starts, step, hi) {
  const months = [];
  const lines = starts.map((day, index) => {
    const iso = isoOf(day), names = [`d${iso}`, ...(index === 0 ? ['start'] : [])];
    const month = monthBegunAt(day, index, step, hi, months);
    if (month) {
      names.push(`m${month}`);
      months.push({ name: `m${month}`, month, start: iso });
    }
    return names;
  });
  return { lines, months };
}

const monthLabel = month => new Date(`${month}-01T00:00:00Z`).toLocaleString('en', { timeZone: 'UTC', month: 'short' });

function finishMonths(months, hi) {
  months.forEach((month, index) => {
    const next = months[index + 1];
    month.end = next ? next.start : isoOf(hi);
    month.label = monthLabel(month.month);
    month.column = `${month.name} / ${next ? next.name : 'end'}`;
  });
}

// Months grouped by a key (a quarter, a year), each group with the columns it spans.
function spansOf(months, keyOf) {
  const groups = [];
  for (const month of months) {
    const key = keyOf(month.month), last = groups.at(-1);
    if (last && last.key === key) last.to = month;
    else groups.push({ key, from: month, to: month });
  }
  return groups.map((group, index) => {
    const next = groups[index + 1];
    return { label: group.key, column: `${group.from.name} / ${next ? next.from.name : 'end'}` };
  });
}

const quarterOf = month => `Q${Math.floor((Number(month.slice(5)) - 1) / 3) + 1} ${month.slice(0, 4)}`;

// The line at or before a day (or at or after it, rounding up); "end" past the last track.
const lineFinder = (starts, lo, step) => (day, up) => {
  const index = Math.max(0, Math.min(starts.length, (up ? Math.ceil : Math.floor)((day - lo) / step)));
  return index >= starts.length ? 'end' : `d${isoOf(starts[index])}`;
};

// Dated elements inside go on their lines; dates between lines snap outwards.
function placeDated(box, { lo, hi }, lineAt) {
  for (const element of box.querySelectorAll('[data-start]')) {
    const start = dayOf(element.dataset.start), end = dayOf(element.dataset.end);
    if (Number.isNaN(start)) continue;
    const from = Math.min(Math.max(start, lo), hi), to = Math.min(Math.max(Number.isNaN(end) ? start : end, from), hi);
    const first = lineAt(from, false), last = lineAt(to, true);
    element.style.gridColumn = last !== first ? `${first} / ${last}` : `${first} / span 1`;
  }
}

// The checks of a timeline's options: the problem's fields and hint when one fails.
function invalidRange(box, range, from, to, step) {
  if (!box) return [{}, 'timeline(container): no such container'];
  if (!range) return [{}, 'no dated elements inside: give from and to, or call schedule() first'];
  const { lo, hi } = range;
  if (Number.isNaN(lo) || Number.isNaN(hi) || hi <= lo) {
    return [{ value: `${from}..${to}` }, 'from and to as YYYY-MM-DD, to after from'];
  }
  if ((hi - lo) / step > 1500) return [{}, `${Math.round(hi - lo)} days is too long by the day: give unit: 'week'`];
  return null;
}

// The grid's columns: the lead column, if any, then one track per day (or week), its lines named.
function templateColumnsOf(lines, lead, hi) {
  const leadTrack = lead ? `[lead] ${lead} ` : '';
  const tracks = lines.map(names => `[${names.join(' ')}] minmax(0, 1fr)`).join(' ');
  return `${leadTrack}${tracks} [d${isoOf(hi)} end]`;
}

export function timeline(box, { from, to, lead = '', unit = 'day' } = {}, problems) {
  const step = unit === 'week' ? 7 : 1, range = box ? rangeOf(box, from, to) : null;
  const invalid = invalidRange(box, range, from, to, step);
  if (invalid) {
    problems.push({ rule: 'bad-option', option: 'timeline', ...invalid[0], hint: invalid[1] });
    return null;
  }
  const { lo, hi } = range, starts = [];
  for (let day = lo; day < hi; day += step) starts.push(day);
  const { lines, months } = namedLines(starts, step, hi);
  box.style.display = box.style.display || 'grid';
  box.style.gridTemplateColumns = templateColumnsOf(lines, lead, hi);
  finishMonths(months, hi);
  const lineAt = lineFinder(starts, lo, step);
  placeDated(box, range, lineAt);
  return {
    from: isoOf(lo), to: isoOf(hi), months,
    quarters: spansOf(months, quarterOf), years: spansOf(months, month => month.slice(0, 4)),
    column: (a, b) => `${lineAt(dayOf(a), false)} / ${b ? lineAt(dayOf(b), true) : 'span 1'}`,
  };
}
