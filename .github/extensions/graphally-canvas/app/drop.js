// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where a dragged element lands, from what places the elements under the pointer: a cell or an
// area of a grid (grid-drop.js), or a place among the children of a flex, flowing or auto-placed
// container, before the child the pointer is ahead of; and the edits that move it there.
import { gridAxes, cellDrop, areaDrop } from './grid-drop.js';
import { placementEdits, lineValue } from './placement.js';

const center = (box, axis) => box[axis] + (axis === 'x' ? box.w : box.h) / 2;

// The line that shows where in a container the element goes: before a child, or after the last.
function markerOf(holder, siblings, before, axis) {
  const box = before?.box ?? siblings.at(-1)?.box;
  if (!box) {
    const { x, y, w } = holder.box;
    return { x1: x + 6, y1: y + 6, x2: x + w - 6, y2: y + 6 };
  }
  if (axis === 'x') {
    const x = before ? box.x - 4 : box.x + box.w + 4;
    return { x1: x, y1: box.y, x2: x, y2: box.y + box.h };
  }
  const y = before ? box.y - 4 : box.y + box.h + 4;
  return { x1: box.x, y1: y, x2: box.x + box.w, y2: y };
}

// In reading order: the first child below the pointer, or on its row and to its right.
const readingNext = (siblings, point) => siblings.find(entry => point.y < entry.box.y
  || (point.y <= entry.box.y + entry.box.h && point.x < center(entry.box, 'x')));

function placeDrop(model, holder, dragged, point) {
  const inFlow = entry => entry !== dragged && entry.place?.position !== 'absolute';
  const siblings = model.childrenOf(holder.src).filter(inFlow);
  const { kind, dir, wrap } = holder.layout;
  const axis = kind === 'flex' && !wrap && dir.startsWith('row') ? 'x' : kind === 'grid' || wrap ? null : 'y';
  const before = axis ? siblings.find(entry => point[axis] < center(entry.box, axis)) : readingNext(siblings, point);
  const noop = holder.src === dragged.parent && (before ?? null) === model.nextOf(dragged);
  const line = markerOf(holder, siblings, before, axis ?? 'x');
  return { kind: 'place', into: holder.src, before: before?.src ?? null, line, noop };
}

// The drop for a point; with `anywhere`, any container under it takes the element.
export function dropFor(model, dragged, point, anywhere = false) {
  const holder = model.holderAt(point, dragged, anywhere);
  if (!holder) return null;
  if (holder.layout.kind === 'grid' && holder.layout.areas) return areaDrop(model, holder, dragged, point);
  const axes = holder.layout.kind === 'grid' ? gridAxes(model, holder, dragged) : {};
  if (axes.col || axes.row) return cellDrop(model, holder, dragged, point, axes);
  return placeDrop(model, holder, dragged, point);
}

function placingEdits(dragged, drop) {
  if (drop.kind === 'area') {
    const swap = drop.swap ? placementEdits(drop.swap.path, { 'grid-area': drop.swap.area }) : [];
    return [...placementEdits(dragged.src, { 'grid-area': drop.area }), ...swap];
  }
  const lines = cells => Object.fromEntries([['grid-column', cells.col], ['grid-row', cells.row]]
    .filter(([, cell]) => cell).map(([property, cell]) => [property, lineValue(cell.start, cell.span)]));
  const swap = drop.swap ? placementEdits(drop.swap.path, lines(drop.swap)) : [];
  return [...placementEdits(dragged.src, lines(drop)), ...swap];
}

// The edits a drop makes: where the element sits in its grid first (paths stay as they are),
// then the move into its new container.
export function dropEdits(dragged, drop) {
  if (drop.kind === 'place') {
    return [{ op: 'place', path: dragged.src, into: drop.into, ...(drop.before ? { before: drop.before } : {}) }];
  }
  const move = drop.into !== null ? [{ op: 'place', path: dragged.src, into: drop.into }] : [];
  return [...placingEdits(dragged, drop), ...move];
}
