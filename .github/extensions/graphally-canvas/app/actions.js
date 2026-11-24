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

function applyMove(move, layer, selectAfter, version) {
  if (!move) return setStatus('It cannot go there.', true);
  return edit(move.edits, selectAfter ?? (move.path === null ? null : elementSelection(move.path, layer?.id)), version);
}

function connectTo(entry) {
  const from = view.connecting;
  view.connecting = null;
  if (!entry?.id) return setStatus('Connect to a box with an id: give it one in its properties.', true);
  setStatus('');
  return edit([{ op: 'connect', from, to: entry.id }]);
}

let iconNames = null;

const ends = value => [].concat(value ?? []);
const named = (lines, id) => lines.filter(entry => [...ends(entry.from), ...ends(entry.to)].includes(id));

function idProblem(layer, next) {
  if (next === (layer.id ?? '')) return 'It has that id already.';
  if (next && !/^[A-Za-z][\w-]*$/.test(next)) return `"${next}" is not an id: a letter, then letters, digits, - or _.`;
  if (next && view.state.layers.some(other => other.id === next)) return `Another element has the id "${next}".`;
  if (!next && named(view.state.lines, layer.id).length) {
    return 'Lines join this box by its id: delete them, or give it another.';
  }
  return null;
}

// The lines that name an old id, given the new one; the last first, as a line's key can count the
// same lines before it.
const renamedEnds = (old, next) => named(view.state.lines, old).reverse().map(entry => {
  const one = end => (end === old ? next : end), swap = value => (Array.isArray(value) ? value.map(one) : one(value));
  return { op: 'line', key: entry.key, set: { from: swap(entry.from), to: swap(entry.to) } };
});

function renamedRules(old, next) {
  const naming = () => new RegExp(`#${old}(?![\\w-])`, 'g');
  return view.state.styles.rules.filter(rule => !rule.nested && naming().test(rule.selector))
    .map(rule => ({ op: 'rule', rule: rule.index, rename: rule.selector.replace(naming(), `#${next}`) }));
}

// Several siblings into one new group, selected afterwards where the first of them stood.
const UNGROUPABLE = 'Only elements side by side in one parent, not a paragraph or a heading, go into one group.';

function groupSelected(paths, version) {
  const edits = groupEdits(paths, layerOf(parentPath(paths[0]))?.tag);
  if (!edits) return setStatus(UNGROUPABLE, true);
  return edit(edits, elementSelection(edits[0].path), version);
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
    const found = entryOfDrawn(view.state.lines, key);
    if (!found) return setStatus('A drawing script draws this line: edit it in the source.', true);
    const box = { x: point.x - 70, y: point.y - 12, w: 140, h: 24 }, version = view.state.version;
    const setLabel = label => edit([{ op: 'line', key: found.entry.key, set: { label: label || null } }],
      { kind: 'line', id: key }, version);
    return editText(view.svg, box, found.entry.label ?? '', setLabel);
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
  // A new id for an element; its lines and the rules that name it (#old) follow it.
  renameId(layer, next, version) {
    const problem = idProblem(layer, next);
    if (problem) return setStatus(problem, true);
    const edits = [{ op: 'attr', path: layer.path, name: 'id', value: next || null }];
    if (layer.id && next) edits.push(...renamedEnds(layer.id, next), ...renamedRules(layer.id, next));
    return edit(edits, elementSelection(layer.path, next || undefined), version);
  },
  renameClass(old, next) {
    const layer = selectedLayer();
    if (!layer) return;
    const classes = layer.classes.split(/\s+/).filter(Boolean)
      .flatMap(name => (name === old ? next.split(/\s+/) : [name]));
    edit([{ op: 'attr', path: layer.path, name: 'class', value: classes.filter(Boolean).join(' ') || null }]);
  },
};
