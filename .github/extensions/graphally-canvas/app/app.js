// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas page: draws the diagram the canvas sends, again whenever the file changes, and turns
// clicks, drags, typing and the panels into edits of the file.
import { api } from './api.js';
import { drawSource } from './stage.js';
import { Overlay, frame, segment, trace } from './overlay.js';
import { enablePointer } from './pointer.js';
import { dropEdits } from './drop.js';
import { editText } from './text-editor.js';
import { showLayers } from './layers.js';
import { showProperties } from './properties.js';

const byId = id => document.getElementById(id);
const view = { state: null, svg: null, model: null, overlay: null, selection: null, connecting: null };
const setStatus = text => { byId('status').textContent = text; };
const layerOf = path => view.state?.layers.find(layer => layer.path === path) ?? null;
const selectedEntry = () => (view.selection?.kind === 'element' ? view.model?.entry(view.selection.path) : null);

async function edit(edits) {
  const { errors = [] } = await api.edit(edits);
  setStatus(errors.map(error => error.message).join('; '));
}

function drawSelection() {
  const entry = selectedEntry(), key = view.selection?.kind === 'line' ? view.selection.id : null;
  const line = key && view.svg?.querySelector(`g[data-edge="${CSS.escape(key)}"] path`);
  view.overlay?.show('selection', entry ? frame(entry.box) : line ? trace(line.getAttribute('d')) : null);
}

function showPanels() {
  const { selection, state } = view, path = selection?.kind === 'element' ? selection.path : null;
  showLayers(byId('layers'), state?.layers ?? [], path, layer => select(view.model?.entry(layer.path)));
  const lineEntry = key => state.lines.find(line => line.key === key);
  const line = selection?.kind === 'line' ? { key: selection.id, entry: lineEntry(selection.id) } : null;
  showProperties(byId('properties'), { layer: path !== null ? layerOf(path) : null, line }, panelActions);
  byId('undo').disabled = !state?.canUndo;
  byId('redo').disabled = !state?.canRedo;
}

function setSelection(selection) {
  view.selection = selection;
  api.select(selection ? [selection] : []);
  drawSelection();
  showPanels();
}

function connectTo(entry) {
  const from = view.connecting;
  view.connecting = null;
  if (!entry?.id) return setStatus('Connect to a box with an id: give it one in its properties.');
  setStatus('');
  return edit([{ op: 'connect', from, to: entry.id }]);
}

function select(entry) {
  if (view.connecting) return connectTo(entry);
  return setSelection(entry ? { kind: 'element', path: entry.src, ...(entry.id ? { id: entry.id } : {}) } : null);
}

function nudge(entry, delta) {
  const [x0, y0] = (layerOf(entry.src)?.nudge || '0,0').split(',').map(Number);
  const x = Math.round(x0 + delta.x), y = Math.round(y0 + delta.y);
  return edit([{ op: 'attr', path: entry.src, name: 'nudge', value: x || y ? `${x},${y}` : null }]);
}

function editTextOf(entry) {
  const layer = entry && layerOf(entry.src);
  if (!layer) return;
  if (!layer.text && view.model.childrenOf(entry.src).length) setStatus('Double-click the text itself to edit it.');
  else editText(view.svg, entry.box, layer.text, text => edit([{ op: 'text', path: entry.src, text }]));
}

const pointerActions = {
  selectedEntry, select, editText: editTextOf,
  selectLine: key => setSelection({ kind: 'line', id: key }),
  hover: entry => view.overlay?.show('hover', entry && entry !== selectedEntry() ? frame(entry.box, 1) : null),
  drag(entry, delta, drop) {
    view.overlay.show('ghost', frame({ ...entry.box, x: entry.box.x + delta.x, y: entry.box.y + delta.y }, 0));
    const marker = drop?.kind === 'cell' ? frame(drop.rect, 0) : drop && segment(drop.line);
    view.overlay.show('drop', drop && !drop.noop ? marker : null);
  },
  drop(entry, drop, delta, alt) {
    view.overlay.show('ghost', null);
    view.overlay.show('drop', null);
    view.selection = { kind: 'element', path: entry.src, ...(entry.id ? { id: entry.id } : {}) };
    if (alt) nudge(entry, delta);
    else if (drop && !drop.noop) edit(dropEdits(entry, drop));
  },
};

const panelActions = {
  edit,
  selectParent: () => {
    const entry = selectedEntry(), parent = entry && view.model.parentOf(entry);
    select(parent?.src ? parent : null);
  },
  startConnect: id => {
    view.connecting = id;
    setStatus(`Click the box to connect ${id} to (Esc cancels).`);
  },
};

// A selection from before a redraw, or from the agent: an element found again by its id when it
// has one (a move changes paths), else by its path.
function resolve(item) {
  if (!item || !view.model) return null;
  if (item.kind === 'line') return item;
  const entry = item.id ? view.model.withId(item.id) : view.model.entry(item.path);
  return entry ? { kind: 'element', path: entry.src, ...(entry.id ? { id: entry.id } : {}) } : null;
}

async function show(next) {
  view.state = next;
  byId('file').textContent = next.name;
  const drawn = await drawSource(byId('stage'), next.source);
  Object.assign(view, drawn ?? { svg: null, model: null }, { overlay: drawn ? new Overlay(drawn.svg) : null });
  if (drawn) enablePointer(drawn.svg, drawn.model, pointerActions);
  view.selection = resolve(view.selection ?? next.selection[0]);
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
    await show(next).catch(error => setStatus(`Could not draw the diagram: ${error.message}`));
  }
  drawing = false;
}

// Escape ends connecting, or else steps the selection out to the parent.
function escape() {
  if (!view.connecting) return panelActions.selectParent();
  view.connecting = null;
  return setStatus('');
}

const KEYS = {
  Escape: escape,
  Delete: () => removeSelection(),
  Backspace: () => removeSelection(),
  Enter: () => editTextOf(selectedEntry()),
};

function removeSelection() {
  if (view.selection?.kind === 'element') edit([{ op: 'remove', path: view.selection.path }]);
  if (view.selection?.kind === 'line') edit([{ op: 'unline', key: view.selection.id }]);
}

function duplicateSelection() {
  if (view.selection?.kind === 'element') edit([{ op: 'duplicate', path: view.selection.path }]);
}

function onKey(event) {
  if (event.target.matches('input, select')) return;
  const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (mod && key === 'z') api[event.shiftKey ? 'redo' : 'undo']();
  else if (mod && key === 'y') api.redo();
  else if (mod && key === 'd') duplicateSelection();
  else if (!mod && KEYS[event.key]) KEYS[event.key]();
  else return;
  event.preventDefault();
}

const events = new EventSource('events');
events.onmessage = message => {
  latest = JSON.parse(message.data);
  drawLatest();
};
events.addEventListener('selection', message => {
  view.selection = resolve(JSON.parse(message.data)[0] ?? null);
  drawSelection();
  showPanels();
});
document.addEventListener('keydown', onKey);
byId('undo').addEventListener('click', () => api.undo());
byId('redo').addEventListener('click', () => api.redo());
