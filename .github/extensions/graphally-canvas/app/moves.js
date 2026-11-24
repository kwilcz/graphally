// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Moving an element in the source tree: before or after a sibling, into the sibling before it,
// out of its parent, into a new group or out of one; and where its path will be afterwards, so
// an element without an id stays selected. Paths are the source's: "0.2" is the third child of
// the diagram's first element.
import { view, layerOf } from './view.js';

const UNSEEN = new Set(['script', 'style', 'template']);
// Elements that hold no boxes: nothing is moved into them.
const LEAVES = new Set(['icon', 'img', 'br', 'hr', 'input', 'i', 'b', 'small', 'code', 'svg']);

export const parentPath = path => (path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '');
const indexOf = path => Number(path.split('.').at(-1));
const childPath = (parent, index) => (parent ? `${parent}.${index}` : String(index));
const isWithin = (inner, outer) => inner === outer || inner.startsWith(`${outer}.`);

// Every child of an element as the source has it (style and script too), in order.
const childrenOf = parent => (view.state?.layers ?? []).filter(layer => layer.path !== ''
  && parentPath(layer.path) === parent);
const seen = layer => !layer.virtual && !UNSEEN.has(layer.tag);

// The children a person sees: without style and script, and through the tbody a table gets from
// the parser, not written in the source.
export const visibleChildrenOf = parent => childrenOf(parent)
  .flatMap(child => (child.virtual ? visibleChildrenOf(child.path) : seen(child) ? [child] : []));

export const canHoldChildren = layer => Boolean(layer) && !LEAVES.has(layer.tag) && !UNSEEN.has(layer.tag);

// A path once the element at `removed` is gone: a later sibling of it, or anything inside one,
// moves up by one.
function shifted(path, removed) {
  const parent = parentPath(removed), prefix = parent ? `${parent}.` : '';
  if (path === parent || !path.startsWith(prefix)) return path;
  const rest = path.slice(prefix.length).split('.');
  if (Number(rest[0]) > indexOf(removed)) rest[0] = String(Number(rest[0]) - 1);
  return prefix + rest.join('.');
}

// Where an element moved into `into`, before `before` (or last), stands afterwards.
export function pathAfterPlace(moved, into, before) {
  const parent = shifted(into, moved);
  if (before) return childPath(parent, indexOf(shifted(before, moved)));
  const count = childrenOf(into).length - (parentPath(moved) === into ? 1 : 0);
  return childPath(parent, count);
}

export function placeMove(path, into, before) {
  if (isWithin(into, path)) return null;
  const edits = [{ op: 'place', path, into, ...(before ? { before } : {}) }];
  return { edits, path: pathAfterPlace(path, into, before) };
}

// Before the sibling before it (step -1), or after the one after it (step 1).
export function moveAmong(path, step) {
  const all = childrenOf(parentPath(path)), siblings = all.filter(seen);
  const target = siblings[siblings.findIndex(layer => layer.path === path) + step];
  if (!target) return null;
  const before = step < 0 ? target.path : all[all.indexOf(target) + 1]?.path ?? null;
  return placeMove(path, parentPath(path), before);
}

// Last into the sibling before it.
export function indent(path) {
  const siblings = childrenOf(parentPath(path)).filter(seen);
  const target = siblings[siblings.findIndex(layer => layer.path === path) - 1];
  return canHoldChildren(target) ? placeMove(path, target.path, null) : null;
}

// Out of its parent, to stand right after it.
export function outdent(path) {
  const parent = parentPath(path);
  if (!parent) return null;
  const all = childrenOf(parentPath(parent)), next = all[all.findIndex(layer => layer.path === parent) + 1];
  return placeMove(path, parentPath(parent), next?.path ?? null);
}

// A drop on a layer: before it, after it, or last inside it.
export function layerDrop(path, target, zone) {
  if (zone === 'inside') return canHoldChildren(layerOf(target)) ? placeMove(path, target, null) : null;
  if (zone === 'before') return placeMove(path, parentPath(target), target);
  const all = childrenOf(parentPath(target)), next = all[all.findIndex(layer => layer.path === target) + 1];
  return placeMove(path, parentPath(target), next?.path ?? null);
}

export const wrapMove = path => ({ edits: [{ op: 'wrap', path, html: '<div class="group">' }], path });

export const canUnwrap = layer => Boolean(layer?.path) && childrenOf(layer.path).some(seen);

export const unwrapMove = path => ({
  edits: [{ op: 'unwrap', path }], path: childrenOf(path).some(seen) ? path : null,
});
