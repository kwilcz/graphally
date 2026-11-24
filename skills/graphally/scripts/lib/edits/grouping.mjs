// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Putting an element in a new container, and a container's children in its place:
//
//   { op: 'wrap', path | id, html? }   wraps it in html, an opening tag (<div> when none); the
//                                      classes that place it in its parent's layout (col-[2],
//                                      [grid-area:edge], self-center) move to the wrapper
//   { op: 'unwrap', path | id }        puts its content in its place (its placing classes go to
//                                      its child, when it has one) and removes its lines
import { getAttribute, setAttribute } from './markup.mjs';
import { sourceTree, nodeAtPath } from './tree.mjs';
import { checkNesting } from './nesting.mjs';
import { cutOf, indentOfNode } from './placing.mjs';
import { withoutLinesTo } from './connections.mjs';
import { elementOf } from './structure.mjs';

const PLACING = /^(col|row)-|^\[grid-(area|column|row)[:-]|^(self|justify-self|place-self|order)-/;
const splice = (text, start, end, insert) => text.slice(0, start) + insert + text.slice(end);
const ownsLines = (text, node) => cutOf(text, node).start !== node.start;
const reindented = (markup, from, to) => markup.split('\n')
  .map((line, index) => (index > 0 && line.startsWith(from) ? to + line.slice(from.length) : line)).join('\n');

function openingTag(html) {
  const open = String(html || '<div>').trim(), name = /^<([a-zA-Z][\w-]*)\b[^<>]*>$/.exec(open)?.[1];
  if (!name) throw new Error(`"${open}" is not an opening tag`);
  return { open, name };
}

// The element's markup without the classes that place it, and those classes.
function withoutPlacing(text, node) {
  const tag = text.slice(node.start, node.openEnd), classes = (getAttribute(tag, 'class') || '').split(/\s+/);
  const placing = classes.filter(name => PLACING.test(name));
  if (!placing.length) return { markup: text.slice(node.start, node.end), placing };
  const kept = classes.filter(name => name && !PLACING.test(name)).join(' ') || null;
  return { markup: setAttribute(tag, 'class', kept) + text.slice(node.openEnd, node.end), placing };
}

// The element holding a node in the tree: the diagram for one at its top.
const parentOf = (tree, node) => nodeAtPath(tree, node.path.split('.').slice(0, -1).join('.'));

function wrapEdit(text, edit) {
  const tree = sourceTree(text), node = elementOf(text, tree, edit), { open, name } = openingTag(edit.html);
  checkNesting(parentOf(tree, node)?.tag, name.toLowerCase());
  checkNesting(name.toLowerCase(), node.tag);
  const { markup, placing } = withoutPlacing(text, node);
  const own = getAttribute(open, 'class');
  const wrapper = placing.length ? setAttribute(open, 'class', [own, ...placing].filter(Boolean).join(' ')) : open;
  if (!ownsLines(text, node)) return splice(text, node.start, node.end, `${wrapper}${markup}</${name}>`);
  const indent = indentOfNode(text, node);
  const inner = reindented(markup, indent, `${indent}  `);
  return splice(text, node.start, node.end, `${wrapper}\n${indent}  ${inner}\n${indent}</${name}>`);
}

// The content's lines, each moved one level out, to stand where the container stood. The level
// is read from the lines that start in the content, not from one after the opening tag.
function contentLines(text, node, indent) {
  const lines = text.slice(node.openEnd, node.closeStart).replace(/\n[ \t]*$/, '').split('\n');
  const indents = lines.slice(1).filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0]);
  const level = indents.reduce((least, found) => (found.length < least.length ? found : least), indents[0] ?? '');
  return lines.map(line => (line.startsWith(level) && level ? indent + line.slice(level.length)
    : line.trim() ? indent + line.trimStart() : null)).filter(line => line !== null);
}

// A container's placing classes go to its one child, as wrap took them from it.
function handedDown(text, node) {
  const tag = text.slice(node.start, node.openEnd), child = node.children.length === 1 ? node.children[0] : null;
  const placing = (getAttribute(tag, 'class') || '').split(/\s+/).filter(name => PLACING.test(name));
  if (!placing.length || !child) return text;
  const childTag = text.slice(child.start, child.openEnd), own = getAttribute(childTag, 'class');
  const classes = [own, ...placing].filter(Boolean).join(' ');
  return splice(text, child.start, child.openEnd, setAttribute(childTag, 'class', classes));
}

function unwrapEdit(text, edit) {
  const tree = sourceTree(text), wrapper = elementOf(text, tree, edit);
  const holder = parentOf(tree, wrapper)?.tag;
  for (const child of wrapper.children.filter(found => !found.virtual)) checkNesting(holder, child.tag);
  const handed = handedDown(text, wrapper);
  const node = elementOf(handed, sourceTree(handed), edit);
  const id = getAttribute(handed.slice(node.start, node.openEnd), 'id');
  const content = handed.slice(node.openEnd, node.closeStart);
  let edited;
  if (!ownsLines(handed, node)) edited = splice(handed, node.start, node.end, content);
  else {
    const cut = cutOf(handed, node), lines = contentLines(handed, node, indentOfNode(handed, node));
    edited = splice(handed, cut.start, cut.end, lines.length ? `${lines.join('\n')}\n` : '');
  }
  return id ? withoutLinesTo(edited, new Set([id])) : edited;
}

export const GROUPING_EDITS = { wrap: wrapEdit, unwrap: unwrapEdit };
