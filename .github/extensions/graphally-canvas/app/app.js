// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas page: draws the diagram the canvas sends, again whenever the file changes, and turns
// drags, clicks and the toolbar into edits of the file.
import { api } from './api.js';
import { drawSource } from './stage.js';
import { Selection } from './selection.js';
import { enablePointer } from './pointer.js';
import { Tools } from './tools.js';

const stage = document.getElementById('stage'), status = document.getElementById('status');
const setStatus = text => { status.textContent = text; };
let state = { lines: [] }, svg = null;

async function edit(edits) {
  const { errors = [] } = await api.edit(edits);
  setStatus(errors.map(error => error.message).join('; '));
}

const selection = new Selection(items => api.select(items));
const tools = new Tools(document, { edit, setStatus });

function showSelection() {
  if (svg) selection.draw(svg);
  tools.update(state.lines, selection.item);
}

function pick(item) {
  if (tools.pick(item)) return;
  selection.set(item);
  showSelection();
}

const move = (id, dx, dy) => edit([{ op: 'move', id, dx, dy }]);

async function show(next) {
  state = next;
  selection.adopt(next.selection);
  document.getElementById('file').textContent = next.name;
  svg = await drawSource(stage, next.source);
  if (svg) enablePointer(svg, { onMove: move, onPick: pick });
  showSelection();
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

const events = new EventSource('events');
events.onmessage = event => {
  latest = JSON.parse(event.data);
  drawLatest();
};
events.addEventListener('selection', event => {
  selection.adopt(JSON.parse(event.data));
  showSelection();
});

document.addEventListener('keydown', event => {
  if (event.target.matches('input, select')) return;
  if (event.key === 'Escape') {
    tools.cancel();
    pick(null);
  }
  if (['Delete', 'Backspace'].includes(event.key) && selection.item?.kind === 'line') tools.removeLine();
});
