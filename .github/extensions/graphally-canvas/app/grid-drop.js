// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where an element dragged over a grid lands. In a grid whose elements are placed by line (the
// steps of a process, the slabs of a stack) it is a cell: the column and row under the pointer,
// taken on each axis the element (or most of its new siblings) is placed on, keeping its span;
// in a grid of named areas (the regions of an architecture map) it is an area. An element that
// already holds the cell or the area trades places with it.
import { tracksOf, trackAt, placedByLine, spanOf, areaOf, areasOf } from './grid.js';

const contains = ({ x, y, w, h }, point) => point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
const distance = ({ x, y, w, h }, point) => Math.hypot(x + w / 2 - point.x, y + h / 2 - point.y);

// The axes a drop in this grid sets: those the element is placed on by line, else those most of
// the grid's other elements are.
export function gridAxes(model, grid, dragged) {
  const others = model.childrenOf(grid.src).filter(entry => entry !== dragged);
  const placed = axis => others.filter(entry => placedByLine(entry, axis)).length;
  const most = axis => others.length > 0 && placed(axis) * 2 >= others.length;
  const own = dragged.parent === grid.src;
  return {
    col: (own && placedByLine(dragged, 'col')) || most('col'),
    row: (own && placedByLine(dragged, 'row')) || most('row'),
  };
}

// The track under the pointer on one axis, moved back so the element's span still fits.
function cellOn(model, grid, dragged, point, axis) {
  const tracks = tracksOf(model, grid, axis);
  if (!tracks.length) return null;
  const span = Math.min(spanOf(dragged, axis, tracks.length), tracks.length);
  const first = Math.min(trackAt(tracks, axis === 'col' ? point.x : point.y), tracks.length - span);
  return { start: first + 1, span, from: tracks[first][0], to: tracks[first + span - 1][1] };
}

// The element already at the cell's start on every axis the drop sets, to trade places with.
function holderOf(model, grid, dragged, cells) {
  const at = (entry, axis) => !cells[axis] || entry.place[axis][0] === String(cells[axis].start);
  return model.childrenOf(grid.src).find(entry => entry !== dragged && at(entry, 'col') && at(entry, 'row')) ?? null;
}

// Where the element is now on an axis, as the cell a swap gives the element it trades with.
const cellNow = (dragged, axis, cell) => cell && placedByLine(dragged, axis)
  && { start: Number(dragged.place[axis][0]), span: cell.span };

export function cellDrop(model, grid, dragged, point, axes) {
  const col = axes.col ? cellOn(model, grid, dragged, point, 'col') : null;
  const row = axes.row ? cellOn(model, grid, dragged, point, 'row') : null;
  if (!col && !row) return null;
  const { box } = grid, into = grid.src !== dragged.parent ? grid.src : null;
  const rect = {
    x: col?.from ?? box.x, w: col ? col.to - col.from : box.w,
    y: row?.from ?? box.y, h: row ? row.to - row.from : box.h,
  };
  const same = (cell, axis) => !cell || (String(cell.start) === dragged.place[axis][0]
    && cell.span === spanOf(dragged, axis, tracksOf(model, grid, axis).length));
  // Only the axes that change are written, and traded with an element already there.
  const cells = { col: into || !same(col, 'col') ? col : null, row: into || !same(row, 'row') ? row : null };
  const holder = into ? null : holderOf(model, grid, dragged, { col, row });
  const swap = holder
    && { path: holder.src, col: cellNow(dragged, 'col', cells.col), row: cellNow(dragged, 'row', cells.row) };
  return {
    kind: 'cell', grid: grid.src, ...cells, into, rect,
    swap: swap && (swap.col || swap.row) ? swap : null, noop: !cells.col && !cells.row,
  };
}

export function areaDrop(model, grid, dragged, point) {
  const areas = areasOf(model, grid);
  if (!areas.length) return null;
  const target = areas.find(area => contains(area.rect, point))
    ?? areas.reduce((best, area) => (distance(area.rect, point) < distance(best.rect, point) ? area : best));
  const own = dragged.parent === grid.src, from = own ? areaOf(dragged) : null;
  const holder = model.childrenOf(grid.src).find(entry => entry !== dragged && areaOf(entry) === target.name);
  if (holder && !from) return null;
  return {
    kind: 'area', grid: grid.src, area: target.name, rect: target.rect, into: own ? null : grid.src,
    swap: holder ? { path: holder.src, area: from } : null, noop: from === target.name,
  };
}

// The handles on a grid element's edges that change its span: its right edge for its columns,
// its bottom edge for its rows, on each axis it is placed on by line.
export function handlesOf(model, entry) {
  const grid = entry && model.parentOf(entry);
  if (grid?.layout.kind !== 'grid') return [];
  const { x, y, w, h } = entry.box, positive = axis => Number(entry.place[axis][0]) > 0;
  const resizable = axis => placedByLine(entry, axis) && positive(axis) && tracksOf(model, grid, axis).length;
  return ['col', 'row'].filter(resizable)
    .map(axis => ({ axis, x: axis === 'col' ? x + w : x + w / 2, y: axis === 'col' ? y + h / 2 : y + h }));
}

// The span a handle dragged to a point gives: from the element's first track to the one under it.
export function spanResize(model, entry, axis, point) {
  const tracks = tracksOf(model, model.parentOf(entry), axis), first = Number(entry.place[axis][0]) - 1;
  const last = Math.max(first, trackAt(tracks, axis === 'col' ? point.x : point.y)), span = last - first + 1;
  const [from, to] = [tracks[first][0], tracks[last][1]], { box } = entry;
  const rect = axis === 'col' ? { x: from, w: to - from, y: box.y, h: box.h }
    : { x: box.x, w: box.w, y: from, h: to - from };
  return { axis, start: first + 1, span, rect, noop: span === spanOf(entry, axis, tracks.length) };
}
