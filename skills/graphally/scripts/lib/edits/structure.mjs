// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Edits of a diagram's content and structure, on an element named by its path in the source tree
// (tree.mjs) or by its id. Each is a text patch: the rest of the file stays as written.
//
//   { op: 'text', path | id, text, index? }       sets one of the element's own runs of text
//   { op: 'attr', path | id, name, value }        sets an attribute (null removes it)
//   { op: 'cell', path | id, col?, row?, colSpan?, rowSpan? }   puts it in a grid cell
//   { op: 'place', path | id, into, before? }     moves it into an element, before a child of it
//   { op: 'remove', path | id }                   removes it, and the lines to its boxes
//   { op: 'duplicate', path | id }                writes a copy after it, with new ids
//   { op: 'insert', into, before?, html }         writes new markup into an element
import { getAttribute, setAttribute } from './markup.mjs';
import { sourceTree, nodeAtPath, nodeWithId } from './tree.mjs';
import { cutOf, spotOf, spotAfter, fitted, indentOfNode } from './placing.mjs';
import { withoutLinesTo } from './connections.mjs';

const escapeText = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const splice = (text, start, end, insert) => text.slice(0, start) + insert + text.slice(end);
const contains = (outer, inner) => outer === inner || outer.children.some(child => contains(child, inner));
const idsIn = markup => [...markup.matchAll(/\sid\s*=\s*["']?([\w-]+)/g)].map(match => match[1]);

function elementOf(text, tree, edit) {
  const node = edit.path !== undefined ? nodeAtPath(tree, edit.path) : nodeWithId(tree, text, edit.id);
  if (!node || node === tree || node.virtual) {
    throw new Error(edit.path !== undefined ? `no element at ${edit.path}` : `no element with id "${edit.id}"`);
  }
  return node;
}

function containerOf(tree, into) {
  const node = nodeAtPath(tree, into ?? '');
  if (!node) throw new Error(`no element at ${into}`);
  return node;
}

function textEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit), run = node.texts[edit.index || 0];
  if (run) return splice(text, run.start, run.end, escapeText(edit.text));
  if (node.children.length) throw new Error('the element has no text of its own');
  return splice(text, node.openEnd, node.closeStart, escapeText(edit.text));
}

function attrEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit);
  const tag = text.slice(node.start, node.openEnd);
  return splice(text, node.start, node.openEnd, setAttribute(tag, edit.name, edit.value));
}

// A grid line as a utility class: col-[3], or col-[3/span_2] across two tracks.
const lineClass = (axis, start, span) => (span > 1 ? `${axis}-[${start}/span_${span}]` : `${axis}-[${start}]`);
const PLACEMENT = axis => new RegExp(`^${axis}-(\\[[^\\]]*\\]|start-\\S+|end-\\S+|span-\\S+|auto)$`);

function cellEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit), tag = text.slice(node.start, node.openEnd);
  let classes = (getAttribute(tag, 'class') || '').split(/\s+/).filter(Boolean);
  for (const [axis, start, span] of [['col', edit.col, edit.colSpan], ['row', edit.row, edit.rowSpan]]) {
    if (start == null) continue;
    classes = [...classes.filter(name => !PLACEMENT(axis).test(name)), lineClass(axis, start, span || 1)];
  }
  return splice(text, node.start, node.openEnd, setAttribute(tag, 'class', classes.join(' ')));
}

function placeEdit(text, edit) {
  const tree = sourceTree(text), node = elementOf(text, tree, edit), into = containerOf(tree, edit.into);
  if (contains(node, into)) throw new Error('an element cannot move into itself');
  const before = edit.before != null ? containerOf(tree, edit.before) : null;
  if (before === node) return text;
  const cut = cutOf(text, node), spot = spotOf(text, into, before);
  if (spot.at > cut.start && spot.at < cut.end) return text;
  const moved = fitted(text.slice(node.start, node.end), indentOfNode(text, node), spot);
  if (spot.at >= cut.end) return splice(splice(text, spot.at, spot.at, moved), cut.start, cut.end, '');
  return splice(splice(text, cut.start, cut.end, ''), spot.at, spot.at, moved);
}

function removeEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit), cut = cutOf(text, node);
  const ids = new Set(idsIn(text.slice(node.start, node.end)));
  return withoutLinesTo(splice(text, cut.start, cut.end, ''), ids);
}

// A copy's ids: each one's name with the first free number after it (fd-2, fd-3…).
function renamedIds(markup, taken) {
  return idsIn(markup).reduce((copy, id) => {
    let number = 2;
    while (taken.has(`${id}-${number}`)) number++;
    taken.add(`${id}-${number}`);
    return copy.replace(new RegExp(`(\\sid\\s*=\\s*["']?)${id}(?=["'\\s>])`), `$1${id}-${number}`);
  }, markup);
}

function duplicateEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit), spot = spotAfter(text, node);
  const copy = renamedIds(text.slice(node.start, node.end), new Set(idsIn(text)));
  return splice(text, spot.at, spot.at, fitted(copy, indentOfNode(text, node), spot));
}

function insertEdit(text, edit) {
  const tree = sourceTree(text), into = containerOf(tree, edit.into);
  const spot = spotOf(text, into, edit.before != null ? containerOf(tree, edit.before) : null);
  return splice(text, spot.at, spot.at, fitted(String(edit.html).trim(), '', spot));
}

export const STRUCTURE_EDITS = {
  text: textEdit, attr: attrEdit, cell: cellEdit, place: placeEdit,
  remove: removeEdit, duplicate: duplicateEdit, insert: insertEdit,
};
