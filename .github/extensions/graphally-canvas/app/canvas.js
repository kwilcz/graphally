// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What the canvas shows over the drawing, and what the pointer does with it: the selection, its
// span handles and the grid it sits in; while dragging, the element's ghost, where it would land,
// the grid it would land in and a preview of the diagram after the drop; and the edits a drop, a
// nudge or a resize makes.
import { view, selectedEntry, edit, elementSelection } from './view.js';
import { frame, segment, trace, label, dot } from './overlay.js';
import { dropEdits } from './drop.js';
import { handlesOf } from './grid-drop.js';
import { cellsOf, areasOf } from './grid.js';
import { placementEdits, lineValue } from './placement.js';
import { actions } from './actions.js';
import { pathAfterPlace } from './moves.js';
import { preview, endPreview, previewReplaced } from './preview.js';
import { linkHandleOf, linkEdits } from './linking.js';

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
  const also = view.also.map(item => view.model.entry(item.path)).filter(Boolean).map(found => frame(found.box));
  const main = entry ? frame(entry.box) : line ? trace(line.getAttribute('d')) : null;
  overlay.show('selection', [main, ...also].filter(Boolean));
  const square = ({ x, y }) => frame({ x: x - HANDLE, y: y - HANDLE, w: 2 * HANDLE, h: 2 * HANDLE }, 0);
  const link = linkHandleOf(entry);
  overlay.show('handle', [...handlesOf(view.model, entry).map(square), ...(link ? [dot(link.x, link.y, HANDLE)] : [])]);
}

// The selection's handle within reach of a point: a span handle, its link handle, or none.
function handleAt(point, reach) {
  const entry = selectedEntry(), near = ({ x, y }) => Math.abs(x - point.x) <= reach && Math.abs(y - point.y) <= reach;
  const link = linkHandleOf(entry);
  if (link && near(link)) return { kind: 'link' };
  const span = handlesOf(view.model, entry).find(near);
  return span ? { kind: 'span', ...span } : null;
}

function clearDrag() {
  for (const part of ['ghost', 'drop', 'grid', 'landed', 'selection', 'handle', 'hover']) view.overlay.show(part, null);
}

// What a drag would do: its edits, and where the element will stand (its path) once they are made.
function gestureOf(entry, drop, delta, alt) {
  if (alt) return { edits: nudgeEdits(entry, delta), path: entry.src };
  if (!drop || drop.noop) return { edits: [], path: entry.src };
  const path = drop.into === null ? entry.src : pathAfterPlace(entry.src, drop.into, drop.before ?? null);
  return { edits: dropEdits(entry, drop), path };
}

const resizeEdits = (entry, resize) => (!resize || resize.noop ? [] : placementEdits(entry.src, {
  [resize.axis === 'col' ? 'grid-column' : 'grid-row']: lineValue(resize.start, resize.span),
}));

// Marks where the element lands in a preview: its box there, found by its id or its new path.
const landing = (entry, path) => drawn => {
  const landed = drawn && ((entry.id && drawn.model.withId(entry.id)) || drawn.model.entry(path));
  if (!drawn) return;
  view.overlay.show('drop', null);
  view.overlay.show('landed', landed ? frame(landed.box, 2) : null);
};

// Makes a gesture's edits, the preview staying until the drawing they bring replaces it.
function commit(edits, selectAfter) {
  if (!edits.length) {
    endPreview();
    return drawSelection();
  }
  endPreview({ untilRedraw: true });
  return edit(edits, selectAfter).then(errors => errors.length && previewReplaced());
}

export const pointerActions = {
  selectedEntry,
  select: actions.select,
  toggle: actions.toggle,
  selectLine: actions.selectLine,
  editText: actions.editText,
  editLabel: actions.editLabel,
  hover: entry => view.overlay?.show('hover', entry && entry !== selectedEntry() ? frame(entry.box, 1) : null),
  drag(entry, delta, drop, alt) {
    clearDrag();
    view.overlay.show('ghost', frame({ ...entry.box, x: entry.box.x + delta.x, y: entry.box.y + delta.y }, 0));
    const marker = drop && (drop.kind === 'place' ? segment(drop.line) : frame(drop.rect, 0));
    view.overlay.show('drop', drop && !drop.noop ? marker : null);
    view.overlay.show('grid', drop?.grid ? gridShapes(view.model.entry(drop.grid)) : null);
    const gesture = gestureOf(entry, drop, delta, alt);
    preview(gesture.edits, landing(entry, gesture.path));
  },
  drop(entry, drop, delta, alt) {
    clearDrag();
    const gesture = gestureOf(entry, drop, delta, alt);
    return commit(gesture.edits, elementSelection(gesture.path, entry.id));
  },
  resizing(entry, resize) {
    clearDrag();
    view.overlay.show('drop', resize && !resize.noop ? frame(resize.rect, 0) : null);
    preview(resizeEdits(entry, resize), landing(entry, entry.src));
  },
  resized(entry, resize) {
    clearDrag();
    return commit(resizeEdits(entry, resize), elementSelection(entry.src, entry.id));
  },
  handleAt,
  // A line drawn from the selection: a straight rubber band to the pointer, the box it would join,
  // and a preview of the line routed there.
  linking(from, point, target) {
    clearDrag();
    const { x, y, w, h } = from.box;
    view.overlay.show('ghost', segment({ x1: x + w / 2, y1: y + h / 2, x2: point.x, y2: point.y }));
    view.overlay.show('drop', target ? frame(target.box, 3) : null);
    preview(target ? linkEdits(from, target).edits : null, () => {});
  },
  linked(from, target) {
    clearDrag();
    if (!target) return commit([], null);
    const { edits, key } = linkEdits(from, target);
    return commit(edits, { kind: 'line', id: key });
  },
};

function nudgeEdits(entry, delta) {
  const layer = view.state.layers.find(found => found.path === entry.src);
  const [x0, y0] = (layer?.nudge || '0,0').split(',').map(Number);
  const x = Math.round(x0 + delta.x), y = Math.round(y0 + delta.y);
  if (x === x0 && y === y0) return [];
  return [{ op: 'attr', path: entry.src, name: 'nudge', value: x || y ? `${x},${y}` : null }];
}
