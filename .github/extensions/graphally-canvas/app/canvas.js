// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What the canvas shows over the drawing, and what the pointer does with it: the selection, its
// span handles and the grid it sits in; while dragging, the element's ghost, where it would land
// and the grid it would land in; and the edits a drop or a resize makes.
import { view, selectedEntry, edit, elementSelection } from './view.js';
import { frame, segment, trace, label } from './overlay.js';
import { dropEdits } from './drop.js';
import { handlesOf } from './grid-drop.js';
import { cellsOf, areasOf } from './grid.js';
import { placementEdits, lineValue } from './placement.js';
import { actions } from './actions.js';
import { pathAfterPlace } from './moves.js';

const HANDLE = 4;

// A grid's cells, or its named areas with their names, as dashed outlines.
function gridShapes(grid) {
  if (!grid || grid.layout.kind !== 'grid') return null;
  if (!grid.layout.areas) return cellsOf(view.model, grid).map(cell => frame(cell, 0));
  return areasOf(view.model, grid).flatMap(({ name, rect }) => [frame(rect, 0), label(rect.x + 4, rect.y + 12, name)]);
}

// The grid to show for an element: its own, else the one it sits in.
const gridAround = entry => (entry?.layout.kind === 'grid' ? entry : entry && view.model.parentOf(entry));

export function drawSelection() {
  const { overlay, selection, svg } = view;
  if (!overlay) return;
  const entry = selectedEntry(), key = selection?.kind === 'line' ? selection.id : null;
  const line = key && svg.querySelector(`g[data-edge="${CSS.escape(key)}"] path`);
  overlay.show('grid', gridShapes(gridAround(entry)));
  overlay.show('selection', entry ? frame(entry.box) : line ? trace(line.getAttribute('d')) : null);
  const square = ({ x, y }) => frame({ x: x - HANDLE, y: y - HANDLE, w: 2 * HANDLE, h: 2 * HANDLE }, 0);
  overlay.show('handle', handlesOf(view.model, entry).map(square));
}

function clearDrag() {
  for (const part of ['ghost', 'drop', 'grid']) view.overlay.show(part, null);
}

export const pointerActions = {
  selectedEntry,
  select: actions.select,
  selectLine: actions.selectLine,
  editText: actions.editText,
  hover: entry => view.overlay?.show('hover', entry && entry !== selectedEntry() ? frame(entry.box, 1) : null),
  drag(entry, delta, drop) {
    view.overlay.show('handle', null);
    view.overlay.show('ghost', frame({ ...entry.box, x: entry.box.x + delta.x, y: entry.box.y + delta.y }, 0));
    const marker = drop && (drop.kind === 'place' ? segment(drop.line) : frame(drop.rect, 0));
    view.overlay.show('drop', drop && !drop.noop ? marker : null);
    view.overlay.show('grid', drop?.grid ? gridShapes(view.model.entry(drop.grid)) : null);
  },
  drop(entry, drop, delta, alt) {
    clearDrag();
    if (alt) return nudge(entry, delta, elementSelection(entry.src, entry.id));
    if (!drop || drop.noop) return drawSelection();
    const path = drop.into === null ? entry.src : pathAfterPlace(entry.src, drop.into, drop.before ?? null);
    return edit(dropEdits(entry, drop), elementSelection(path, entry.id));
  },
  resizing(resize) {
    view.overlay.show('drop', resize && !resize.noop ? frame(resize.rect, 0) : null);
  },
  resized(entry, resize) {
    view.overlay.show('drop', null);
    if (!resize || resize.noop) return drawSelection();
    const property = resize.axis === 'col' ? 'grid-column' : 'grid-row';
    return edit(placementEdits(entry.src, { [property]: lineValue(resize.start, resize.span) }));
  },
};

function nudge(entry, delta, selectAfter) {
  const layer = view.state.layers.find(found => found.path === entry.src);
  const [x0, y0] = (layer?.nudge || '0,0').split(',').map(Number);
  const x = Math.round(x0 + delta.x), y = Math.round(y0 + delta.y);
  return edit([{ op: 'attr', path: entry.src, name: 'nudge', value: x || y ? `${x},${y}` : null }], selectAfter);
}
