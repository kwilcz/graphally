// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The render page's own icon sets: each set a diagram names in icon-sets="…" is read whole (a
// folder's SVG files, which the render's server sends as one answer, or a sprite) and registered as
// a pack, so a wrong name is reported with the set's nearest names.
import { registerPack } from './engine/index.js';
import { parseIconSets, isSprite, spriteFiles, iconSetPack } from './icon-sets.js';
import { nearUrl } from './near.js';

async function setFiles(base, path) {
  try {
    const response = await fetch(nearUrl(base, path));
    if (!response.ok) return {};
    return isSprite(path) ? spriteFiles(await response.text()) : await response.json();
  } catch {
    return {};
  }
}

// A set that could not be read stays unknown, and its icons say so.
async function registerSet(base, { prefix, path }) {
  const pack = iconSetPack(await setFiles(base, path));
  if (Object.keys(pack).length) registerPack(prefix, pack);
  return prefix;
}

// The prefixes of the sets the page's diagrams name, for the page to know which names are theirs.
export function loadIconSets(host, base) {
  const sets = [...host.querySelectorAll('diagram[icon-sets]')]
    .flatMap(diagram => parseIconSets(diagram.getAttribute('icon-sets')));
  return Promise.all(sets.map(set => registerSet(base, set)));
}
