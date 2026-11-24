// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Drawing a line by hand: the selection's link handle (a dot off its top-right corner) dragged to
// another box connects the two. Lines join ids, so a box without one is given one from its text
// (Front Door: front-door), or from its tag.
import { view, layerOf } from './view.js';

const OFFSET = 9;

export const linkHandleOf = entry => (entry?.src
  ? { x: entry.box.x + entry.box.w + OFFSET, y: entry.box.y - OFFSET } : null);

const slug = text => String(text || '').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// An id for a box that has none: its text, or its tag, made unique.
function newId(layer, taken) {
  const stem = slug(layer.text).slice(0, 24) || layer.tag;
  let id = stem, number = 2;
  while (taken.has(id)) id = `${stem}-${number++}`;
  taken.add(id);
  return id;
}

// The edits that connect two boxes, giving each an id it lacks; and the new line's key.
export function linkEdits(from, to) {
  const taken = new Set(view.state.layers.map(layer => layer.id).filter(Boolean)), edits = [];
  const idOf = entry => {
    if (entry.id) return entry.id;
    const id = newId(layerOf(entry.src) ?? { tag: entry.tag }, taken);
    edits.push({ op: 'attr', path: entry.src, name: 'id', value: id });
    return id;
  };
  const ends = { from: idOf(from), to: idOf(to) };
  edits.push({ op: 'connect', ...ends });
  return { edits, key: `${ends.from}->${ends.to}` };
}

// The box a link would end at under the pointer: the one its layout moves as a whole, not the
// box it starts from nor one around it.
export function linkTarget(model, from, point) {
  const hit = model.at(point), target = hit && model.movableOf(hit);
  if (!target?.src || target === from || model.isWithin(from.src, target.src)) return null;
  return target;
}
