// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Adding an element: a box, a group or a line of text, written as graphally's building blocks. It
// goes into the selection when the selection holds boxes (a group, a lane, an empty container),
// else right after the selection; with nothing selected, last in the diagram, before its scripts.
// The new element is selected with its text ready to type.
import { view, layerOf } from './view.js';
import { parentPath, canHoldChildren } from './moves.js';

const UNSEEN = new Set(['script', 'style', 'template']);
const HEADING = /^h[1-6]$/;

const MARKUP = {
  box: id => `<div class="node" id="${id}">New box</div>`,
  group: id => `<div class="group" id="${id}"><h4>New group</h4></div>`,
  text: () => '<p>New text</p>',
};

const childrenOf = parent => view.state.layers.filter(layer => layer.path !== '' && parentPath(layer.path) === parent);
const childPath = (parent, index) => (parent ? `${parent}.${index}` : String(index));

// A container to add into: it takes children and has no text of its own, and holds boxes, only a
// heading, or nothing.
function holdsBoxes(layer) {
  if (!canHoldChildren(layer) || layer.text) return false;
  const children = childrenOf(layer.path).filter(child => !UNSEEN.has(child.tag));
  return !children.length || children.every(child => HEADING.test(child.tag))
    || children.some(child => child.id || childrenOf(child.path).length);
}

// The next sibling after a path, or, with none, after the last element a script does not follow.
function nextAfter(parent, path) {
  const all = childrenOf(parent);
  if (path !== null) return all[all.findIndex(layer => layer.path === path) + 1]?.path ?? null;
  const lastSeen = all.findLastIndex(layer => !UNSEEN.has(layer.tag));
  return all[lastSeen + 1]?.path ?? null;
}

// Where a new element goes: into a container, before a sibling (or last).
function spotFor(layer) {
  if (!layer) return { into: '', before: nextAfter('', null) };
  if (holdsBoxes(layer)) return { into: layer.path, before: null };
  return { into: parentPath(layer.path), before: nextAfter(parentPath(layer.path), layer.path) };
}

function freeId(stem) {
  const taken = new Set(view.state.layers.map(layer => layer.id).filter(Boolean));
  let number = 1;
  while (taken.has(`${stem}-${number}`)) number++;
  return `${stem}-${number}`;
}

// The insert edit for a kind of element, and the path and id the new element will have.
export function addition(kind, selectedPath) {
  const { into, before } = spotFor(selectedPath === null ? null : layerOf(selectedPath));
  const id = kind === 'text' ? null : freeId(kind);
  const path = before ?? childPath(into, childrenOf(into).length);
  const edit = { op: 'insert', into, ...(before ? { before } : {}), html: MARKUP[kind](id) };
  return { edits: [edit], path, id };
}
