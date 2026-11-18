// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Dates as day numbers: days since 1970-01-01, in UTC. Days are calendar days, 2w is 14 of them,
// and an end date is a boundary: a task that follows another starts on the day the other ends.
const DAY = 86400000;

export const dayOf = value => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? Date.parse(`${value}T00:00:00Z`) / DAY : NaN);
export const isoOf = day => new Date(day * DAY).toISOString().slice(0, 10);

// A duration in days: "10", "10d" or "2w".
export function lengthOf(value) {
  const match = /^([\d.]+)\s*([dw]?)$/.exec(String(value || ''));
  return match ? Number(match[1]) * (match[2] === 'w' ? 7 : 1) : NaN;
}

// The first day of the month after a date's: "2026-12-15" is "2027-01-01".
export function nextMonthStart(iso) {
  const [year, month] = iso.slice(0, 7).split('-').map(Number);
  return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
}
