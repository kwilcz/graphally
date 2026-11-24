// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A drawn line and the connection it is written as. Most lines are an entry of their own; a line
// written in a list of ends ({ "from": ["a", "b"], "to": "c" }) shares its entry with the others,
// so a change to the entry changes them all. One such line can be split out into an entry of its
// own, with the same options, or deleted alone. A line a drawing script draws has no entry.

const ends = value => [].concat(value ?? []);
const one = list => (list.length === 1 ? list[0] : list);

// Every line the entries draw, keyed as the drawing keys them: one per pair of ends, from the
// first end of a list on, its id or "from->to", with #2, #3 for a key drawn again.
function drawnLines(lines) {
  const repeats = new Map();
  return lines.flatMap(entry => {
    const count = ends(entry.from).length * ends(entry.to).length;
    return ends(entry.from).flatMap(from => ends(entry.to).map(to => {
      const base = entry.id || `${from}->${to}`, repeat = (repeats.get(base) || 0) + 1;
      repeats.set(base, repeat);
      return { key: repeat > 1 ? `${base}#${repeat}` : base, entry, pair: count > 1 ? { from, to } : null, count };
    }));
  });
}

// The entry a drawn line (its key, as the drawing names it) comes from, the ends that line joins
// when it is one of a list, and how many lines the entry draws; a line a script draws has none.
export function entryOfDrawn(lines, key) {
  const found = drawnLines(lines).find(line => line.key === key);
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
