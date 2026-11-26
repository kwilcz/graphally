// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// While a drag goes on, the diagram as it will be once the drag ends: the edits the drop would make
// are applied by the canvas server, which leaves the file alone, and the result is drawn under the
// overlay, at the drawing's scale and corner. Neighbours make room and lines take their new routes
// as the pointer moves. Drops are still found on the drawing as it was, so a target does not
// slide away as the preview reflows. One preview is drawn at a time; the newest wish wins.
import { api } from './api.js';
import { view, byId } from './view.js';
import { drawPreview, hidePreview } from './stage.js';

let wanted = null, shown = null, busy = false, generation = 0, onDrawn = () => {}, basis;

function hide() {
  view.svg?.classList.remove('canvas-previewing');
  hidePreview(byId('stage'));
}

async function drawWanted(edits, current) {
  const { source, errors = [] } = await api.preview(edits, basis);
  if (current !== generation || errors.length) return null;
  const drawn = await drawPreview(byId('stage'), source, view.svg);
  if (current !== generation || !drawn) {
    if (current !== generation) hidePreview(byId('stage'));
    return null;
  }
  view.svg.classList.add('canvas-previewing');
  return drawn;
}

async function drawNext(current) {
  const edits = wanted;
  shown = JSON.stringify(edits);
  if (!edits) hide();
  else onDrawn(await drawWanted(edits, current));
}

// Draws the newest wish until the preview shows it; a drag that ended stops it where it is.
async function pump() {
  if (busy) return;
  busy = true;
  const current = generation;
  try {
    while (current === generation && JSON.stringify(wanted) !== shown) await drawNext(current);
  } finally {
    busy = false;
    if (current !== generation && wanted) pump();
  }
}

// Shows what these edits, made against a version of the source, would draw (none: the drawing as
// it is); onDrawn hears of each preview drawn, with its layout model, to mark where the dragged
// element lands in it.
export function preview(edits, drawn = onDrawn, version = view.state?.version) {
  onDrawn = drawn;
  basis = version;
  wanted = edits?.length && !view.mismatch ? edits : null;
  pump();
}

// Ends the previews: at once, or, when an edit is on its way, once the new drawing replaces it.
export function endPreview({ untilRedraw = false } = {}) {
  generation += 1;
  wanted = null;
  shown = null;
  if (!untilRedraw) hide();
}

// The drawing the file's new state brought replaces any preview.
export const previewReplaced = () => endPreview();
