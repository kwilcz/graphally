// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What can be done to the selection, from a key, a button, the layers panel or the pointer: select
// (selecting.js), edit text, delete, duplicate, move among siblings and in or out of them, group and
// ungroup, add, rename an id or a class. Each change is an edit of the file; the selection follows
// the element, by its id or by where its path will be.
import { api } from './api.js';
import {
  view, edit, setSelection, setStatus, selectedLayer, layerOf, elementSelection,
} from './view.js';
import {
  parentPath, moveAmong, indent, outdent, layerDrop, wrapMove, unwrapMove, canUnwrap, visibleChildrenOf,
} from './moves.js';
import { addition } from './adding.js';
import { removeEdits, groupEdits } from './multi.js';
import { renaming } from './renaming.js';
import { selecting } from './selecting.js';
import { editText } from './text-editor.js';
import { entryOfDrawn, splitEdits, deleteEdits, drawnKeysOf } from './lines.js';

function applyMove(move, layer, selectAfter, version) {
  if (!move) return setStatus('It cannot go there.', true);
  return edit(move.edits, selectAfter ?? (move.path === null ? null : elementSelection(move.path, layer?.id)), version);
}

let iconNames = null;

// What is selected once an element is gone: its parent.
function parentSelection(path) {
  const parent = parentPath(path);
  return parent ? elementSelection(parent, layerOf(parent)?.id) : null;
}

// Where a copy of an element lands: right after it.
function copyPath(path) {
  const index = Number(path.split('.').at(-1)), parent = parentPath(path);
  return parent ? `${parent}.${index + 1}` : `${index + 1}`;
}

// Writes an element just added and readies its text to type (editPendingText), unless refused.
function addThenType(edits, selection, pending) {
  view.pendingText = { ...pending, written: false, after: view.state.version };
  return edit(edits, selection).then(errors => {
    if (errors.length) view.pendingText = null;
    else view.pendingText.written = true;
    actions.editPendingText();
  });
}

// Several siblings into one new group, selected afterwards where the first of them stood.
const UNGROUPABLE = 'Only elements side by side in one parent, not a paragraph or a heading, go into one group.';

function groupSelected(paths, version) {
  const edits = groupEdits(paths, layerOf(parentPath(paths[0]))?.tag);
  if (!edits) return setStatus(UNGROUPABLE, true);
  return edit(edits, elementSelection(edits[0].path), version);
}

const withSelected = run => () => {
  const layer = selectedLayer();
  return layer ? run(layer) : undefined;
};

export const actions = {
  ...selecting,
  edit,
  undo: () => { view.ownEdit = true; return api.undo(); },
  redo: () => { view.ownEdit = true; return api.redo(); },
  colorOf: value => view.colorOf?.(value) ?? value,
  say: (text, error = false) => setStatus(text, error),
  canUnwrap,


  editText(entry) {
    const layer = entry && layerOf(entry.src);
    if (!layer) return;
    if (!layer.text && view.model.childrenOf(entry.src).length) setStatus('Double-click the text itself to edit it.');
    else {
      const version = view.state.version;
      const setText = text => edit([{ op: 'text', path: entry.src, text }], undefined, version);
      editText(view.svg, entry.box, layer.text, setText);
    }
  },
  splitLine: (found, key, version) => edit(splitEdits(found), { kind: 'line', id: key }, version),
  removeLine: (found, version) => edit(deleteEdits(found), null, version),
  // A line's label, edited where it was double-clicked; a line a script draws has none to edit.
  editLabel(key, point) {
    const found = entryOfDrawn(view.state.lines, key, drawnKeysOf(view.svg));
    if (!found) return setStatus('A drawing script draws this line: edit it in the source.', true);
    const box = { x: point.x - 70, y: point.y - 12, w: 140, h: 24 }, version = view.state.version;
    const setLabel = label => edit([{ op: 'line', key: found.entry.key, set: { label: label || null } }],
      { kind: 'line', id: key }, version);
    return editText(view.svg, box, found.entry.label ?? '', setLabel);
  },
  removeElement: (layer, version) => edit([{ op: 'remove', path: layer.path }], parentSelection(layer.path), version),
  remove() {
    if (view.also.length) return edit(removeEdits(actions.selectedPaths()), null);
    if (view.selection?.kind === 'line') {
      const found = entryOfDrawn(view.state.lines, view.selection.id, drawnKeysOf(view.svg));
      if (found) return actions.removeLine(found);
      return setStatus('A drawing script draws this line: edit it in the source.', true);
    }
    const layer = selectedLayer();
    return layer && actions.removeElement(layer);
  },
  duplicate: withSelected(layer => edit([{ op: 'duplicate', path: layer.path }],
    elementSelection(copyPath(layer.path)))),
  step: direction => withSelected(layer => applyMove(moveAmong(layer.path, direction), layer))(),
  indent: withSelected(layer => applyMove(indent(layer.path), layer)),
  outdent: withSelected(layer => applyMove(outdent(layer.path), layer)),
  // A version, when given, is the one the caller's paths are from (a panel drawn earlier).
  wrap(layer = selectedLayer(), version = undefined) {
    if (view.also.length) return groupSelected(actions.selectedPaths(), version);
    return layer && applyMove(wrapMove(layer.path), layer, elementSelection(layer.path), version);
  },
  unwrap: (layer = selectedLayer(), version = undefined) => layer && canUnwrap(layer)
    && applyMove(unwrapMove(layer.path), layer, elementSelection(layer.path), version),
  dropOnLayer: (path, target, zone, version) => applyMove(layerDrop(path, target, zone), layerOf(path), undefined,
    version),
  // Adds a box, a group or a text and selects it, its text ready to type (when it is drawn).
  add(kind) {
    const { edits, path, id, textPath } = addition(kind, selectedLayer()?.path ?? null);
    return addThenType(edits, elementSelection(path, id), { path: textPath, id: kind === 'group' ? null : id });
  },
  // An element just added has its text ready to type, once its edit is written and it is drawn
  // (whichever comes last); one whose edit was refused has none.
  editPendingText() {
    const pending = view.pendingText;
    if (!pending?.written || !view.model || view.state.version <= pending.after) return;
    const entry = (pending.id && view.model.withId(pending.id)) || view.model.entry(pending.path);
    if (!entry || !layerOf(entry.src)?.text) return;
    view.pendingText = null;
    actions.editText(entry);
  },
  // The icon names to suggest, asked of the server once.
  iconNames: () => (iconNames ??= api.icons().then(answer => answer.names ?? [])),
  fold(path) {
    if (!view.folded.delete(path)) view.folded.add(path);
    setSelection(view.selection);
  },
  // A new id for an element; its lines and the rules that name it (#old) follow it.
  renameId(layer, next, version) {
    const { problem, edits, rest } = renaming(layer, next);
    if (problem) return setStatus(problem, true);
    return edit(edits, elementSelection(layer.path, next || undefined), version).then(errors => {
      if (errors.length || !rest.length) return;
      const verb = rest.length > 1 ? 'name' : 'names';
      setStatus(`Renamed; ${rest.join(' and ')} still ${verb} "${layer.id}": change it there.`, true);
    });
  },
  // Adds an item to a list: a copy of its last one, its text ready to type.
  addItem(layer) {
    const last = visibleChildrenOf(layer.path).at(-1);
    if (!last) return actions.add('box');
    const copy = copyPath(last.path);
    return addThenType([{ op: 'duplicate', path: last.path }], elementSelection(copy), { path: copy, id: null });
  },
  renameClass(old, next) {
    const layer = selectedLayer();
    if (!layer) return;
    const classes = layer.classes.split(/\s+/).filter(Boolean)
      .flatMap(name => (name === old ? next.split(/\s+/) : [name]));
    edit([{ op: 'attr', path: layer.path, name: 'class', value: classes.filter(Boolean).join(' ') || null }]);
  },
};
