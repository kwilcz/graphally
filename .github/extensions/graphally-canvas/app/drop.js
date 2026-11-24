// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where a dragged element lands, from what places the elements under the pointer: a column of a
// grid it is placed in by line (a lane of a process, a step of a plan), or a place among the
// children of a flex, flowing or auto-placed container, before the child the pointer is ahead of.
// Grids of named areas (the regions of an architecture map) take no drop of their own: their
// groups do.

const center = (box, axis) => box[axis] + (axis === 'x' ? box.w : box.h) / 2;
const isExplicit = line => line !== undefined && line !== 'auto';

// Each track's [start, end], from where the first one starts.
function spansOf(tracks, gap, start) {
  let at = start;
  return tracks.map(size => {
    const span = [at, at + size];
    at += size + gap;
    return span;
  });
}

// A grid's columns, its own or, for a subgrid (a lane), those of the grid it takes them from.
function columnsOf(model, grid) {
  for (let at = grid; at; at = model.parentOf(at)) {
    const { kind, cols, colGap, origin } = at.layout;
    if (kind === 'grid' && cols.length) return spansOf(cols, colGap, origin.x);
  }
  return [];
}

// How many columns an element spans, from its grid lines (3 / span 2, or 3 / 5).
function spanOf([start, end]) {
  if (/^span \d+$/.test(end)) return Number(end.split(' ')[1]);
  return /^\d+$/.test(start) && /^\d+$/.test(end) ? Number(end) - Number(start) : 1;
}

// The column a point is over or, in the gap between two, the nearer one.
const columnAt = (columns, x) => columns.findIndex(([, end], index) => {
  const next = columns[index + 1];
  return !next || x < (end + next[0]) / 2;
});

function cellDrop(model, grid, dragged, point) {
  const columns = columnsOf(model, grid);
  if (!columns.length) return null;
  const nearest = columnAt(columns, point.x);
  const span = Math.min(spanOf(dragged.place.col), columns.length - nearest);
  const [left] = columns[nearest], right = columns[nearest + span - 1][1];
  const into = grid.src !== dragged.parent ? grid.src : null;
  const rect = { x: left, y: grid.box.y, w: right - left, h: grid.box.h };
  const noop = !into && String(nearest + 1) === dragged.place.col[0];
  return { kind: 'cell', col: nearest + 1, colSpan: span, into, rect, noop };
}

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

export function dropFor(model, dragged, point) {
  const holder = model.holderAt(point, dragged);
  if (!holder || (holder.layout.kind === 'grid' && holder.layout.areas)) return null;
  const byLine = holder.layout.kind === 'grid' && isExplicit(dragged.place?.col?.[0]);
  if (byLine) return cellDrop(model, holder, dragged, point);
  return placeDrop(model, holder, dragged, point);
}

// The edits a drop makes: the grid line first (paths stay as they are), then the move.
export function dropEdits(dragged, drop) {
  if (drop.kind === 'cell') {
    const cell = { op: 'cell', path: dragged.src, col: drop.col, colSpan: drop.colSpan };
    return drop.into ? [cell, { op: 'place', path: dragged.src, into: drop.into }] : [cell];
  }
  return [{ op: 'place', path: dragged.src, into: drop.into, ...(drop.before ? { before: drop.before } : {}) }];
}
