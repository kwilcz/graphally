// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A drawn line and the connection it is written as. Most lines are an entry of their own; a line
// written in a list of ends ({ "from": ["a", "b"], "to": "c" }) shares its entry with the others,
// so a change to the entry changes them all. One such line can be split out into an entry of its
// own, with the same options, or deleted alone. A line a drawing script draws has no entry.

const ends = value => [].concat(value ?? []);
const one = list => (list.length === 1 ? list[0] : list);

// An end as the drawing names it: "db.top" (an anchor on db) is db.
const elementOf = end => (/^[\w-]+\.[a-z]+$/i.test(end) ? end.split('.')[0] : end);
const baseOf = key => key.replace(/#\d+$/, '');

// How many lines of each key a drawing script drew: the drawing draws them before the entries, so
// the entries' repeats of a key are numbered after them.
function scriptCounts(pairs, drawnKeys) {
  const counts = new Map();
  for (const key of drawnKeys) counts.set(baseOf(key), (counts.get(baseOf(key)) || 0) + 1);
  for (const { base } of pairs) counts.set(base, (counts.get(base) || 0) - 1);
  return counts;
}

// Every line the entries draw, keyed as the drawing keys them: one per pair of ends, from the
// first end of a list on, its id or "from->to", with #2, #3 for a key drawn again.
function drawnLines(lines, drawnKeys) {
  const pairs = lines.flatMap(entry => {
    const count = ends(entry.from).length * ends(entry.to).length;
    return ends(entry.from).flatMap(from => ends(entry.to).map(to => ({
      entry, count, pair: count > 1 ? { from, to } : null, base: entry.id || `${elementOf(from)}->${elementOf(to)}`,
    })));
  });
  const repeats = new Map([...scriptCounts(pairs, drawnKeys)].map(([base, count]) => [base, Math.max(0, count)]));
  return pairs.map(line => {
    const repeat = (repeats.get(line.base) || 0) + 1;
    repeats.set(line.base, repeat);
    return { ...line, key: repeat > 1 ? `${line.base}#${repeat}` : line.base };
  });
}

// The keys of the lines a drawing shows, in the order it drew them.
export const drawnKeysOf = svg => [...(svg?.querySelectorAll('g[data-edge]') ?? [])].map(group => group.dataset.edge);

// The entry a drawn line (its key, as the drawing names it) comes from, the ends that line joins
// when it is one of a list, and how many lines the entry draws; a line a script draws has none.
export function entryOfDrawn(lines, key, drawnKeys = []) {
  const found = drawnLines(lines, drawnKeys).find(line => line.key === key);
  return found ? { entry: found.entry, pair: found.pair, count: found.count } : null;
}

// The entry without the line's own end: the list it is in loses it. Ends listed on both sides
// cannot lose one line alone.
function narrowed({ entry, pair }) {
  const from = ends(entry.from), to = ends(entry.to);
  if (from.length > 1 && to.length === 1) return { from: one(from.filter(name => name !== pair.from)) };
  if (to.length > 1 && from.length === 1) return { to: one(to.filter(name => name !== pair.to)) };
  return null;
}

export const canSplit = found => Boolean(found?.pair && found.count > 1 && narrowed(found));

// The line in an entry of its own, with the options of the one it shared.
export function splitEdits(found) {
  const { key, from, to, id, ...options } = found.entry;
  return [{ op: 'line', key, set: narrowed(found) }, { op: 'connect', ...found.pair, ...options }];
}

// Deletes the line: its entry, or, for one of a list, its end from the list.
export function deleteEdits(found) {
  if (canSplit(found)) return [{ op: 'line', key: found.entry.key, set: narrowed(found) }];
  return [{ op: 'unline', key: found.entry.key }];
}
