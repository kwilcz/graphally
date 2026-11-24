// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What the canvas page knows at any moment: the state the server sent (the file's source, its
// layers, lines and CSS), the drawing and its layout model, the source as parsed, the selection,
// and the zoom; and the edits it sends.
import { api } from './api.js';

export const view = {
  state: null, svg: null, model: null, parsed: null, colorOf: null, overlay: null,
  selection: null, also: [], connecting: null, zoom: 'fit', folded: new Set(), pendingText: null,
};

export const byId = id => document.getElementById(id);

export function setStatus(text, error = false) {
  const status = byId('status');
  status.textContent = text;
  status.classList.toggle('error', error);
}

export const layerOf = path => view.state?.layers.find(layer => layer.path === path) ?? null;

export const selectedEntry = () => (view.selection?.kind === 'element' ? view.model?.entry(view.selection.path) : null);

export const selectedLayer = () => (view.selection?.kind === 'element' ? layerOf(view.selection.path) : null);

// The element as the source has it, parsed and stamped with its path.
export const sourceElement = path => (path === '' ? view.parsed
  : view.parsed?.querySelector(`[data-src="${CSS.escape(path)}"]`) ?? null);

export const elementSelection = (path, id) => ({ kind: 'element', path, ...(id ? { id } : {}) });

// What redraws the selection and the panels, set by the page; called when either changes.
const refreshers = [];
export const onRefresh = refresher => refreshers.push(refresher);
export const refresh = () => refreshers.forEach(refresher => refresher());

// Selects one thing (any others selected with it are let go), or, with also, keeps them: the
// elements Shift+click added.
export function setSelection(selection, also = []) {
  view.selection = selection;
  view.also = selection ? also : [];
  api.select(selection ? [selection, ...view.also] : []);
  refresh();
}

// Sends edits to the file. What to select afterwards is set first: the file's new state can
// reach the page before the answer does.
export async function edit(edits, selectAfter) {
  if (selectAfter !== undefined) Object.assign(view, { selection: selectAfter, also: [] });
  const { errors = [] } = await api.edit(edits, view.state?.version);
  setStatus(errors.map(error => error.message).join('; '), errors.length > 0);
  return errors;
}
