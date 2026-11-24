// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What can be done to the selection, from a key, a button, the layers panel or the pointer: select
// and step out, connect, edit text, delete, duplicate, move among siblings and in or out of them,
// group and ungroup, rename a class. Each change is an edit of the file; the selection follows
// the element, by its id or by where its path will be.
import { api } from './api.js';
import {
  view, edit, setSelection, setStatus, selectedEntry, selectedLayer, layerOf, elementSelection,
} from './view.js';
import {
  parentPath, moveAmong, indent, outdent, layerDrop, wrapMove, unwrapMove, canUnwrap,
} from './moves.js';
import { editText } from './text-editor.js';

function applyMove(move, layer, selectAfter) {
  if (!move) return setStatus('It cannot go there.', true);
  return edit(move.edits, selectAfter ?? (move.path === null ? null : elementSelection(move.path, layer?.id)));
}

function connectTo(entry) {
  const from = view.connecting;
  view.connecting = null;
  if (!entry?.id) return setStatus('Connect to a box with an id: give it one in its properties.', true);
  setStatus('');
  return edit([{ op: 'connect', from, to: entry.id }]);
}

const withSelected = run => () => {
  const layer = selectedLayer();
  return layer ? run(layer) : undefined;
};

export const actions = {
  edit,
  undo: () => api.undo(),
  redo: () => api.redo(),
  colorOf: value => view.colorOf?.(value) ?? value,
  canUnwrap,

  select(entry) {
    if (view.connecting) return connectTo(entry);
    return setSelection(entry ? elementSelection(entry.src, entry.id) : null);
  },
  pick: layer => actions.select(layer ? view.model?.entry(layer.path) ?? { src: layer.path, id: layer.id } : null),
  selectLine: key => setSelection({ kind: 'line', id: key }),
  selectParent() {
    const entry = selectedEntry(), parent = entry && view.model.parentOf(entry);
    setSelection(parent?.src ? elementSelection(parent.src, parent.id) : null);
  },
  startConnect(id) {
    view.connecting = id;
    setStatus(`Click the box to connect ${id} to (Esc cancels).`);
  },
  cancelConnect() {
    view.connecting = null;
    setStatus('');
  },

  editText(entry) {
    const layer = entry && layerOf(entry.src);
    if (!layer) return;
    if (!layer.text && view.model.childrenOf(entry.src).length) setStatus('Double-click the text itself to edit it.');
    else editText(view.svg, entry.box, layer.text, text => edit([{ op: 'text', path: entry.src, text }]));
  },
  remove() {
    if (view.selection?.kind === 'line') return edit([{ op: 'unline', key: view.selection.id }], null);
    const layer = selectedLayer(), parent = layer && parentPath(layer.path);
    const selectAfter = parent ? elementSelection(parent, layerOf(parent)?.id) : null;
    return layer && edit([{ op: 'remove', path: layer.path }], selectAfter);
  },
  duplicate: withSelected(layer => {
    const index = Number(layer.path.split('.').at(-1)), parent = parentPath(layer.path);
    const copy = parent ? `${parent}.${index + 1}` : `${index + 1}`;
    return edit([{ op: 'duplicate', path: layer.path }], elementSelection(copy));
  }),
  step: direction => withSelected(layer => applyMove(moveAmong(layer.path, direction), layer))(),
  indent: withSelected(layer => applyMove(indent(layer.path), layer)),
  outdent: withSelected(layer => applyMove(outdent(layer.path), layer)),
  wrap: (layer = selectedLayer()) => layer && applyMove(wrapMove(layer.path), layer, elementSelection(layer.path)),
  unwrap: (layer = selectedLayer()) => layer && canUnwrap(layer)
    && applyMove(unwrapMove(layer.path), layer, elementSelection(layer.path)),
  dropOnLayer: (path, target, zone) => applyMove(layerDrop(path, target, zone), layerOf(path)),
  fold(path) {
    if (!view.folded.delete(path)) view.folded.add(path);
    setSelection(view.selection);
  },
  renameClass(old, next) {
    const layer = selectedLayer();
    if (!layer) return;
    const classes = layer.classes.split(/\s+/).filter(Boolean)
      .flatMap(name => (name === old ? next.split(/\s+/) : [name]));
    edit([{ op: 'attr', path: layer.path, name: 'class', value: classes.filter(Boolean).join(' ') || null }]);
  },
};
