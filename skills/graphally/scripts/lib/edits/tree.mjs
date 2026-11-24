// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A diagram's markup as a tree, with where each element sits in the source: its tags, its
// children and its own runs of text. Elements are numbered as a browser numbers them, by their
// place among their parent's elements ("2.0.1": the second child of the first child of the third
// child of <diagram>), so a number stamped on the page names the same element here.
import { getAttribute } from './markup.mjs';

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
// Elements whose content is no children of theirs: raw text, or a template's own fragment.
const RAW = new Set(['script', 'style', 'textarea', 'title', 'template']);
// Elements whose start ends an open <p>, as the HTML parser does.
const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer',
  'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul',
  'li', 'dd', 'dt',
]);
// An element whose start ends an open sibling of these kinds.
const ENDS_SIBLING = { li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], tr: ['td', 'th', 'tr'], td: ['td', 'th'],
  th: ['td', 'th'], option: ['option'] };
const TAG = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

const elementNode = (tag, start, openEnd) => ({
  tag, start, openEnd, closeStart: null, end: null, children: [], texts: [],
});

// Ends the element on top of the stack where the next markup starts, as an end tag left out does.
function endImplicitly(stack, at) {
  const node = stack.pop();
  node.closeStart = at;
  node.end = at;
}

function addText(node, text, from, to) {
  const run = text.slice(from, to);
  if (!run.trim()) return;
  node.texts.push({ start: from + run.length - run.trimStart().length, end: to - (run.length - run.trimEnd().length) });
}

// What an element's start ends first: an open <p> before a block, a list item before the next.
function endBefore(stack, tag, at) {
  if (stack.at(-1).tag === 'p' && CLOSES_P.has(tag)) endImplicitly(stack, at);
  for (let ends = ENDS_SIBLING[tag]; ends?.includes(stack.at(-1).tag);) endImplicitly(stack, at);
  if (tag === 'tr' && stack.at(-1).tag === 'table') {
    const body = { ...elementNode('tbody', at, at), virtual: true };
    stack.at(-1).children.push(body);
    stack.push(body);
  }
}

// An element starts; returns where reading goes on (past the content of a raw-text element).
function openElement(stack, text, match, next) {
  const name = match[2].toLowerCase(), start = match.index;
  // Outside an <svg>, the browser reads <image> as <img>.
  const tag = name === 'image' && !stack.some(open => open.tag === 'svg') ? 'img' : name;
  endBefore(stack, tag, start);
  const node = elementNode(tag, start, next);
  stack.at(-1).children.push(node);
  // Inside an <svg> (or MathML), <rect … /> closes itself; in HTML the slash means nothing.
  const foreign = tag === 'svg' || tag === 'math' || stack.some(open => open.tag === 'svg' || open.tag === 'math');
  if (VOID.has(tag) || (foreign && /\/\s*$/.test(match[3]))) {
    Object.assign(node, { closeStart: next, end: next });
    return next;
  }
  if (!RAW.has(tag)) {
    stack.push(node);
    return next;
  }
  const close = text.toLowerCase().indexOf(`</${tag}`, next);
  Object.assign(node, close < 0 ? { closeStart: text.length, end: text.length }
    : { closeStart: close, end: text.indexOf('>', close) + 1 });
  return node.end;
}

// An end tag closes the nearest open element it names, and any left open inside it. One that
// closes nothing is dropped, as the browser drops it, except </p> and </br>: the browser makes an
// empty <p>, and a <br>, of them. Those count in the numbering, as the browser's elements, and
// are not edited, as the source has no element there.
function closeElement(stack, tag, start, end) {
  const depth = stack.findLastIndex((node, index) => index > 0 && node.tag === tag);
  if (depth < 0 && (tag === 'p' || tag === 'br')) {
    stack.at(-1).children.push({ ...elementNode(tag, start, start), closeStart: start, end: start, virtual: true });
  }
  if (depth < 0) return;
  while (stack.length - 1 > depth) endImplicitly(stack, start);
  Object.assign(stack.pop(), { closeStart: start, end });
}

function number(node, path) {
  node.children.forEach((child, index) => {
    child.path = path === null ? String(index) : `${path}.${index}`;
    number(child, child.path);
  });
}

// The tree of a diagram's text (from <diagram> to </diagram>): its root's one child is the
// diagram, whose descendants carry their paths.
export function sourceTree(text) {
  const root = elementNode('#root', 0, 0), stack = [root];
  let at = 0, match;
  TAG.lastIndex = 0;
  while ((match = TAG.exec(text))) {
    addText(stack.at(-1), text, at, match.index);
    at = TAG.lastIndex;
    if (match[1]) closeElement(stack, match[1].toLowerCase(), match.index, at);
    else if (match[2]) TAG.lastIndex = at = openElement(stack, text, match, at);
  }
  addText(stack.at(-1), text, at, text.length);
  while (stack.length > 1) endImplicitly(stack, text.length);
  const diagram = root.children[0];
  if (diagram) number(diagram, null);
  return diagram || root;
}

export function nodeAtPath(tree, path) {
  if (path === '' || path === undefined) return tree;
  return String(path).split('.').reduce((node, index) => node?.children[Number(index)], tree) || null;
}

export function nodeWithId(tree, text, id) {
  const walk = node => {
    if (getAttribute(text.slice(node.start, node.openEnd), 'id') === id) return node;
    for (const child of node.children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return tree.children.map(walk).find(Boolean) || null;
}

// Every element of the tree, depth first.
export const nodesOf = tree => tree.children.flatMap(child => [child, ...nodesOf(child)]);
