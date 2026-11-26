// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Growing a grid by dropping a box past it: a strip along its right edge makes a new column, one
// along its bottom edge a new row, on each axis its boxes are placed on by line (a grid of named
// areas grows from the properties, where the new cells can be named). The box goes into the new
// track; on the other axis, into the track under the pointer.
import { tracksOf, trackAt } from './grid.js';
import { gridAxes } from './grid-drop.js';
import { trackOwner } from './tracks.js';

// How far past a grid's edge its strips reach, in screen pixels.
const REACH = 26;

const contains = ({ x, y, w, h }, point) => point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;

// The strips of a grid a dragged element could grow, each with the axis it grows and its track count.
export function growStrips(model, grid, dragged, scale = 1) {
  if (grid?.layout.kind !== 'grid' || grid.layout.areas) return [];
  const axes = gridAxes(model, grid, dragged), { x, y, w, h } = grid.box, reach = REACH / scale;
  // A box that spans its grid's whole axis (1 / -1) goes into no single new track of it.
  const spansAll = axis => dragged.parent === grid.src && String(dragged.place?.[axis]?.[1]).startsWith('-');
  return ['col', 'row'].filter(axis => axes[axis] && !spansAll(axis) && trackOwner(model, grid, axis)).map(axis => ({
    axis, grid, count: tracksOf(model, trackOwner(model, grid, axis), axis).length,
    rect: axis === 'col' ? { x: x + w, y, w: reach, h } : { x, y: y + h, w, h: reach },
  }));
}

// The track under the pointer on the axis a strip does not grow, or none when no line places it.
function across(model, strip, dragged, point) {
  const axis = strip.axis === 'col' ? 'row' : 'col';
  if (!gridAxes(model, strip.grid, dragged)[axis]) return null;
  const tracks = tracksOf(model, strip.grid, axis);
  return tracks.length ? { start: trackAt(tracks, axis === 'col' ? point.x : point.y) + 1, span: 1 } : null;
}

const area = ({ box }) => box.w * box.h;

// The drop for a point in a strip of a grid that can take the element, or null; where the strips
// of a grid and of one inside it overlap (a lane in its process), the inner one's.
export function growDrop(model, dragged, point, anywhere, scale) {
  const grids = model.holdersFor(dragged, anywhere).filter(entry => entry.layout.kind === 'grid');
  for (const grid of grids.sort((one, other) => area(one) - area(other))) {
    const strip = growStrips(model, grid, dragged, scale).find(found => contains(found.rect, point));
    if (!strip) continue;
    const cells = { col: null, row: null, [strip.axis]: { start: strip.count + 1, span: 1 } };
    cells[strip.axis === 'col' ? 'row' : 'col'] = across(model, strip, dragged, point);
    return {
      kind: 'cell', grid: grid.src, grow: strip.axis, ...cells, rect: strip.rect, swap: null, noop: false,
      into: grid.src !== dragged.parent ? grid.src : null,
    };
  }
  return null;
}
