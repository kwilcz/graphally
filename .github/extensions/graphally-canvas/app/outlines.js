// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Outlines over the drawing that show what the eye cannot: every grid's columns and rows (or its
// named areas), and, while an element is dragged, every container that can take it, the one it
// would go into labelled. Plain <div>s have no border of their own; these make them visible.
import { view } from './view.js';
import { frame, label } from './overlay.js';
import { cellsOf, areasOf } from './grid.js';
import { growStrips } from './grid-grow.js';

// A grid's cells, or its named areas with their names, as dashed outlines.
export function gridShapes(grid) {
  if (!grid || grid.layout.kind !== 'grid') return null;
  if (!grid.layout.areas) return cellsOf(view.model, grid).map(cell => frame(cell, 0));
  return areasOf(view.model, grid).flatMap(({ name, rect }) => [frame(rect, 0), label(rect.x + 4, rect.y + 12, name)]);
}

// Every grid in the drawing.
export const allGridShapes = () => view.model.entries.filter(entry => entry.layout.kind === 'grid' && entry.src)
  .flatMap(grid => gridShapes(grid) ?? []);

// A container's name as its markup says it: div#edge, div.lane.
function nameOf(entry) {
  if (entry.id) return `${entry.tag}#${entry.id}`;
  const plain = entry.classes.split(/\s+/).find(name => name && !/[[:]/.test(name));
  return plain ? `${entry.tag}.${plain}` : entry.tag;
}

// The containers that can take a dragged element (Ctrl: any), cached for the drag.
let cached = { key: null, holders: [] };
function holdersOf(dragged, anywhere) {
  const key = `${view.state?.version}|${dragged.src}|${anywhere}`;
  if (cached.key !== key) cached = { key, holders: view.model.holdersFor(dragged, anywhere) };
  return cached.holders;
}

// The outlines while dragging: every container that can take the element, and the one it would go
// into (its path), stronger and named.
export function showTargets(dragged, anywhere, holderPath) {
  const holders = holdersOf(dragged, anywhere), holder = holders.find(entry => entry.src === holderPath);
  const others = holders.filter(entry => entry !== holder && entry.src);
  view.overlay.show('targets', others.map(entry => frame(entry.box, 1)));
  const named = holder?.src && label(holder.box.x + 3, holder.box.y - 4, nameOf(holder));
  view.overlay.show('holder', named ? [frame(holder.box, 1), named] : null);
}

// The strips past the edges of the grid a drag is over, where a dropped box makes a new column or
// row; the one under the pointer is the drop's own marker.
export function showStrips(dragged, drop) {
  const grid = drop?.grid && view.model.entry(drop.grid), scale = view.svg.getScreenCTM().a;
  const strips = growStrips(view.model, grid, dragged, scale).filter(strip => strip.axis !== drop?.grow);
  view.overlay.show('add', strips.flatMap(({ rect }) => [frame(rect, 0),
    label(rect.x + rect.w / 2 - 3 / scale, rect.y + rect.h / 2 + 4 / scale, '+')]));
}
