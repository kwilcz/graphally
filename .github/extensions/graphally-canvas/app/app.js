// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas page: draws the diagram the canvas sends, again whenever the file changes (keeping
// the zoom, the scroll and the selection), and wires the pointer, the keys and the panels to the
// edits they make.
import { view, byId, onRefresh, setStatus, layerOf } from './view.js';
import { readDifferently, MISMATCH, kindOf } from './consistency.js';
import { drawSource } from './stage.js';
import { Overlay } from './overlay.js';
import { enablePointer } from './pointer.js';
import { drawSelection, pointerActionsFor } from './canvas.js';
import { showPanels, resolveSelection } from './panels.js';
import { styleLists } from './styles-panel.js';
import { decodedText } from './dom.js';
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

// Draws a state; it becomes the page's own (what edits are made against) once its drawing is.
async function show(next) {
  const first = !view.state, scroll = { left: stage.scrollLeft, top: stage.scrollTop }, carried = carriedKind();
  Object.assign(byId('file'), { textContent: next.name, title: next.filePath });
  if (first) byId('lists').replaceChildren(...styleLists(next.styles.tokens));
  const drawn = await drawSource(stage, next.source);
  previewReplaced();
  for (const layer of next.layers) layer.text = decodedText(layer.text);
  view.state = next;
  Object.assign(view, drawn ?? { svg: null, model: null, parsed: null, colorOf: null });
  view.overlay = drawn ? new Overlay(drawn.svg) : null;
  if (drawn) {
    enablePointer(drawn.svg, drawn.model, pointerActionsFor(next.version));
    showScale(applyZoom(stage, drawn.svg, view.zoom));
    Object.assign(stage, { scrollLeft: scroll.left, scrollTop: scroll.top });
  }
  settle(next, drawn, carried);
  drawSelection();
  showPanels();
  actions.editPendingText();
}

// After a redraw: whether the page and the file number the elements alike, and the selection
// found again (one without an id carried by path is dropped when another kind stands there now).
function settle(next, drawn, carried) {
  view.mismatch = drawn && readDifferently(next.layers, drawn.parsed);
  if (view.mismatch) setStatus(MISMATCH.replace('WHERE', view.mismatch), true);
  view.selection = resolveSelection(view.selection ?? next.selection[0]);
  if (carried && kindOf(layerOf(view.selection?.path)) !== carried) view.selection = null;
  view.also = view.selection ? view.also.map(resolveSelection).filter(item => item?.kind === 'element') : [];
  view.ownEdit = false;
}

// The kind of the selected element when it has no id and the coming change is not the page's own.
const carriedKind = () => (view.selection?.kind === 'element' && !view.selection.id && !view.ownEdit
  ? kindOf(layerOf(view.selection.path)) : null);


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
// The properties panel left behind while a field was typed in is drawn once the field is left.
byId('properties').addEventListener('input', event => { event.target.dataset.dirty = 'yes'; });
byId('properties').addEventListener('change', event => { delete event.target.dataset.dirty; });
byId('properties').addEventListener('focusout', () => setTimeout(() => view.panelBehind && showPanels()));

const events = new EventSource('events');
events.onmessage = message => {
  latest = JSON.parse(message.data);
  drawLatest();
};
events.onerror = () => setStatus('The canvas lost its server: reconnecting… (closing the canvas ends it)', true);
events.onopen = () => byId('status').classList.contains('error') && setStatus('');
// The agent's selection replaces the person's, every element of it.
events.addEventListener('selection', message => {
  const [first = null, ...rest] = JSON.parse(message.data);
  view.selection = resolveSelection(first);
  view.also = view.selection ? rest.map(resolveSelection).filter(item => item?.kind === 'element') : [];
  drawSelection();
  showPanels();
});

enableKeys(zoom);
byId('undo').addEventListener('click', actions.undo);
byId('open-help').addEventListener('click', () => byId('help').showModal());
for (const kind of ['box', 'group', 'text']) byId(`add-${kind}`).addEventListener('click', () => actions.add(kind));
byId('toggle-layers').addEventListener('click', event => {
  const open = document.body.classList.toggle('layers-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
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
