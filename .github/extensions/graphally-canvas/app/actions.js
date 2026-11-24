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
  parentPath, moveAmong, indent, outdent, layerDrop, wrapMove, unwrapMove, canUnwrap, visibleChildrenOf,
} from './moves.js';
import { addition } from './adding.js';
import { removeEdits, groupEdits } from './multi.js';
import { editText } from './text-editor.js';
import { entryOfDrawn, splitEdits, deleteEdits } from './lines.js';

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

let iconNames = null;

// Several siblings into one new group, selected afterwards where the first of them stood.
function groupSelected(paths) {
  const edits = groupEdits(paths);
  if (!edits) return setStatus('Only elements side by side in one parent go into one group.', true);
  return edit(edits, elementSelection(edits[0].path));
}

function stepFrom(layer, direction) {
  if (direction === 'in') return visibleChildrenOf(layer.path)[0];
  const siblings = visibleChildrenOf(parentPath(layer.path));
  const at = siblings.findIndex(found => found.path === layer.path);
  return siblings[at + (direction === 'next' ? 1 : -1)];
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
  say: (text, error = false) => setStatus(text, error),
  canUnwrap,

  select(entry) {
    if (view.connecting) return connectTo(entry);
    return setSelection(entry ? elementSelection(entry.src, entry.id) : null);
  },
  pick: (layer, add = false) => {
    const entry = layer ? view.model?.entry(layer.path) ?? { src: layer.path, id: layer.id } : null;
    return add ? actions.toggle(entry) : actions.select(entry);
  },
  // Adds an element to the selection, or takes it away: Shift+click.
  toggle(entry) {
    if (!entry?.src || view.connecting) return actions.select(entry);
    const all = [view.selection, ...view.also].filter(item => item?.kind === 'element');
    const kept = all.filter(item => item.path !== entry.src);
    const next = kept.length < all.length ? kept : [...all, elementSelection(entry.src, entry.id)];
    return setSelection(next[0] ?? null, next.slice(1));
  },
  selectedPaths: () => [view.selection, ...view.also].filter(item => item?.kind === 'element').map(item => item.path),
  selectLine: key => setSelection({ kind: 'line', id: key }),
  selectParent() {
    if (view.also.length) return setSelection(view.selection);
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
  splitLine: (found, key) => edit(splitEdits(found), { kind: 'line', id: key }),
  removeLine: found => edit(deleteEdits(found), null),
  // A line's label, edited where it was double-clicked; a line a script draws has none to edit.
  editLabel(key, point) {
    const found = entryOfDrawn(view.state.lines, key);
    if (!found) return setStatus('A drawing script draws this line: edit it in the source.', true);
    const box = { x: point.x - 70, y: point.y - 12, w: 140, h: 24 };
    return editText(view.svg, box, found.entry.label ?? '',
      label => edit([{ op: 'line', key: found.entry.key, set: { label: label || null } }], { kind: 'line', id: key }));
  },
  remove() {
    if (view.also.length) return edit(removeEdits(actions.selectedPaths()), null);
    if (view.selection?.kind === 'line') {
      const found = entryOfDrawn(view.state.lines, view.selection.id);
      if (found) return actions.removeLine(found);
      return setStatus('A drawing script draws this line: edit it in the source.', true);
    }
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
  wrap(layer = selectedLayer()) {
    if (view.also.length) return groupSelected(actions.selectedPaths());
    return layer && applyMove(wrapMove(layer.path), layer, elementSelection(layer.path));
  },
  unwrap: (layer = selectedLayer()) => layer && canUnwrap(layer)
    && applyMove(unwrapMove(layer.path), layer, elementSelection(layer.path)),
  dropOnLayer: (path, target, zone) => applyMove(layerDrop(path, target, zone), layerOf(path)),
  // Adds a box, a group or a text and selects it, its text ready to type (when it is drawn).
  add(kind) {
    const { edits, path, id } = addition(kind, selectedLayer()?.path ?? null);
    view.pendingText = { path, id };
    return edit(edits, elementSelection(path, id));
  },
  // Selects the sibling before or after the selection, its parent, or its first child.
  navigate(direction) {
    const layer = selectedLayer();
    if (direction === 'out') return actions.selectParent();
    const target = layer ? stepFrom(layer, direction) : visibleChildrenOf('')[0];
    return target ? setSelection(elementSelection(target.path, target.id)) : undefined;
  },
  // The icon names to suggest, asked of the server once.
  iconNames: () => (iconNames ??= api.icons().then(answer => answer.names ?? [])),
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
