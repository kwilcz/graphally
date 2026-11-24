// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// More than one element selected (Shift+click adds or takes one away): deleting them all, or
// putting siblings into one new group, in their order. Paths are the source's; edits that remove
// or move elements go in an order that keeps the paths of those still to come.
import { parentPath } from './moves.js';

const steps = path => path.split('.').map(Number);
const isWithin = (inner, outer) => inner === outer || inner.startsWith(`${outer}.`);

// Source order: by each step of the path in turn.
export function bySourceOrder(one, other) {
  const a = steps(one), b = steps(other);
  for (let at = 0; at < Math.min(a.length, b.length); at++) if (a[at] !== b[at]) return a[at] - b[at];
  return a.length - b.length;
}

// The paths without those inside another of them: deleting a group deletes what it holds.
export const outermost = paths => paths.filter(path => !paths.some(other => other !== path && isWithin(path, other)));

// Removes each, the last in the source first, so the paths before it stay as they are.
export const removeEdits = paths => outermost(paths).sort(bySourceOrder).reverse()
  .map(path => ({ op: 'remove', path }));

// Puts siblings into one new group where the first of them stood: the first is wrapped, then
// each other moves in after it, its path one less for every sibling moved before it.
export function groupEdits(paths) {
  const sorted = [...new Set(paths)].sort(bySourceOrder), parent = parentPath(sorted[0]);
  if (sorted.some(path => parentPath(path) !== parent)) return null;
  const [first, ...rest] = sorted, last = path => Number(path.split('.').at(-1));
  const moved = rest.map((path, index) => {
    const now = last(path) - index;
    return { op: 'place', path: parent ? `${parent}.${now}` : String(now), into: first };
  });
  return [{ op: 'wrap', path: first, html: '<div class="group">' }, ...moved];
}
