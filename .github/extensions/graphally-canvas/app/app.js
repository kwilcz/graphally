// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas page: draws the diagram the canvas sends, again whenever the file changes (keeping
// the zoom, the scroll and the selection), and wires the pointer, the keys and the panels to the
// edits they make.
import { view, byId, onRefresh } from './view.js';
import { drawSource } from './stage.js';
import { Overlay } from './overlay.js';
import { enablePointer } from './pointer.js';
import { drawSelection, pointerActions } from './canvas.js';
import { showPanels, resolveSelection } from './panels.js';
import { styleLists } from './styles-panel.js';
import { enableKeys } from './keys.js';
import { actions } from './actions.js';
import { applyZoom, zoomAround, stepped, scaleOf } from './zoom.js';
import { previewReplaced } from './preview.js';

const stage = byId('stage');
const showScale = scale => { byId('zoom-level').textContent = `${Math.round(scale * 100)}%`; };

const zoom = {
  set(next, point) {
    view.zoom = next;
    if (view.svg) showScale(zoomAround(stage, view.svg, next, point));
    drawSelection();
  },
  step(direction, point) {
    if (view.svg) zoom.set(stepped(scaleOf(stage, view.svg, view.zoom), direction), point);
  },
};

async function show(next) {
  const first = !view.state, scroll = { left: stage.scrollLeft, top: stage.scrollTop };
  view.state = next;
  byId('file').textContent = next.name;
  if (first) byId('lists').replaceChildren(...styleLists(next.styles.tokens));
  const drawn = await drawSource(stage, next.source);
  previewReplaced();
  Object.assign(view, drawn ?? { svg: null, model: null, parsed: null, colorOf: null });
  view.overlay = drawn ? new Overlay(drawn.svg) : null;
  if (drawn) {
    enablePointer(drawn.svg, drawn.model, pointerActions);
    showScale(applyZoom(stage, drawn.svg, view.zoom));
    Object.assign(stage, { scrollLeft: scroll.left, scrollTop: scroll.top });
  }
  view.selection = resolveSelection(view.selection ?? next.selection[0]);
  drawSelection();
  showPanels();
}

// The latest state the canvas sent, drawn once the drawing before it is done.
let latest = null, drawing = false;
async function drawLatest() {
  if (drawing) return;
  drawing = true;
  while (latest) {
    const next = latest;
    latest = null;
    await show(next).catch(error => { byId('status').textContent = `Could not draw the diagram: ${error.message}`; });
  }
  drawing = false;
}

onRefresh(() => {
  drawSelection();
  showPanels();
});

const events = new EventSource('events');
events.onmessage = message => {
  latest = JSON.parse(message.data);
  drawLatest();
};
events.addEventListener('selection', message => {
  view.selection = resolveSelection(JSON.parse(message.data)[0] ?? null);
  drawSelection();
  showPanels();
});

enableKeys(zoom);
byId('undo').addEventListener('click', actions.undo);
byId('redo').addEventListener('click', actions.redo);
byId('zoom-in').addEventListener('click', () => zoom.step(1));
byId('zoom-out').addEventListener('click', () => zoom.step(-1));
byId('zoom-level').addEventListener('click', () => zoom.set(1));
byId('zoom-fit').addEventListener('click', () => zoom.set('fit'));
stage.addEventListener('wheel', event => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  zoom.step(event.deltaY < 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
}, { passive: false });
addEventListener('resize', () => view.zoom === 'fit' && zoom.set('fit'));
