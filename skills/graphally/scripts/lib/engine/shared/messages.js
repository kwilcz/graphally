// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// How a problem names things: "did you mean" the nearest known name, and a short quote of a text.

// The edit distance between two names: insertions, deletions and substitutions.
function editDistance(from, to) {
  const row = Array.from({ length: to.length + 1 }, (_, index) => index);
  for (let i = 1; i <= from.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= to.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (from[i - 1] === to[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[to.length];
}

// The candidate nearest to the name, if it is near enough to be what was meant: within two
// edits, or a third of the name's length for a long name.
export function closestName(name, candidates) {
  const ranked = candidates
    .map(candidate => [candidate, editDistance(name, candidate)])
    .sort((a, b) => a[1] - b[1]);
  const [best] = ranked;
  return best && best[1] <= Math.max(2, name.length / 3) ? best[0] : undefined;
}

// A text as a problem quotes it: its first 24 characters.
export const excerpt = text => (text.length > 24 ? `${text.slice(0, 24)}…` : text);
