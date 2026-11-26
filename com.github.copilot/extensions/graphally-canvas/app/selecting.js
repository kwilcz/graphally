// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Selecting: a click, Shift+click, a layer, a line, the parent, or by key a sibling or the first
// child. While a line is being connected, a click picks the box it goes to instead.
import { view, edit, setSelection, setStatus, selectedEntry, selectedLayer, elementSelection } from './view.js';
import { parentPath, visibleChildrenOf } from './moves.js';

function connectTo(entry) {
  const from = view.connecting;
  view.connecting = null;
  if (!entry?.id) return setStatus('Connect to a box with an id: give it one in its properties.', true);
  setStatus('');
  return edit([{ op: 'connect', from, to: entry.id }]);
}

function stepFrom(layer, direction) {
  if (direction === 'in') return visibleChildrenOf(layer.path)[0];
  const siblings = visibleChildrenOf(parentPath(layer.path));
  const at = siblings.findIndex(found => found.path === layer.path);
  return siblings[at + (direction === 'next' ? 1 : -1)];
}

export const selecting = {
  // A click's target; while connecting, the line goes to the element with an id under the pointer.
  select(entry, hit = entry) {
    if (view.connecting) return connectTo(hit && view.model.withIdAround(hit, entry));
    return setSelection(entry ? elementSelection(entry.src, entry.id) : null);
  },
  pick: (layer, add = false) => {
    const entry = layer ? view.model?.entry(layer.path) ?? { src: layer.path, id: layer.id } : null;
    return add ? selecting.toggle(entry) : selecting.select(entry);
  },
  // Adds an element to the selection, or takes it away: Shift+click.
  toggle(entry) {
    if (!entry?.src || view.connecting) return selecting.select(entry);
    const all = [view.selection, ...view.also].filter(item => item?.kind === 'element');
    const kept = all.filter(item => item.path !== entry.src);
    const next = kept.length < all.length ? kept : [...all, elementSelection(entry.src, entry.id)];
    return setSelection(next[0] ?? null, next.slice(1));
  },
  selectedPaths: () => [view.selection, ...view.also].filter(item => item?.kind === 'element')
    .map(item => item.path),
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
  // Selects the sibling before or after the selection, its parent, or its first child.
  navigate(direction) {
    const layer = selectedLayer();
    if (direction === 'out') return selecting.selectParent();
    const target = layer ? stepFrom(layer, direction) : visibleChildrenOf('')[0];
    return target ? setSelection(elementSelection(target.path, target.id)) : undefined;
  },
};
