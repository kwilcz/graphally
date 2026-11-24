// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A drawn line and the connection it is written as. Most lines are an entry of their own; a line
// written in a list of ends ({ "from": ["a", "b"], "to": "c" }) shares its entry with the others,
// so a change to the entry changes them all. One such line can be split out into an entry of its
// own, with the same options, or deleted alone. A line a drawing script draws has no entry.

const ends = value => [].concat(value ?? []);
const one = list => (list.length === 1 ? list[0] : list);

// The entry a drawn line (its key, as the drawing names it) comes from, the ends that line joins
// when it is one of a list, and how many lines the entry draws.
export function entryOfDrawn(lines, key) {
  const direct = lines.find(line => line.key === key);
  if (direct) return { entry: direct, pair: null, count: ends(direct.from).length * ends(direct.to).length };
  const [from, to] = key.replace(/#\d+$/, '').split('->');
  const entry = lines.find(line => ends(line.from).includes(from) && ends(line.to).includes(to));
  return entry ? { entry, pair: { from, to }, count: ends(entry.from).length * ends(entry.to).length } : null;
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
