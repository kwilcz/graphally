// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The rules of a diagram's <style> elements, with where each part sits in the text, so an edit
// can change one declaration and keep the rest as written. Rules inside @media, @supports and
// @layer are read with their condition; @keyframes, @font-face and the like are left out. A rule
// that nests rules of its own is read without its declarations, and is not edited.
import { sourceTree, nodesOf } from './tree.mjs';

const CONDITIONS = /^@(media|supports|layer|container)\b/;

// Past the ) that closes the ( at `open`: url(data:…;…) holds a ; that ends nothing.
function pastParens(text, open, to) {
  let depth = 0;
  for (let at = open; at < to; at = pastToken(text, at, to, false)) {
    depth += text[at] === '(' ? 1 : text[at] === ')' ? -1 : 0;
    if (depth === 0) return at + 1;
  }
  return to;
}

// Past one comment, string or bracketed run starting at `at`, or one character.
function pastToken(text, at, to, parens = true) {
  const char = text[at];
  if (char === '/' && text[at + 1] === '*') {
    const end = text.indexOf('*/', at + 2);
    return end < 0 || end + 2 > to ? to : end + 2;
  }
  if (char === '(' && parens) return pastParens(text, at, to);
  if (char !== '"' && char !== "'") return at + 1;
  let next = at + 1;
  while (next < to && text[next] !== char) next += text[next] === '\\' ? 2 : 1;
  return Math.min(next + 1, to);
}

// A property's name as CSS compares it: custom properties (--myAccent) keep their case.
export const propertyName = name => (name.startsWith('--') ? name : name.toLowerCase());

// The next of these characters outside comments and strings, or `to`.
function nextOf(text, at, to, chars) {
  let next = at;
  while (next < to && !chars.includes(text[next])) next = pastToken(text, next, to);
  return next;
}

// The } that closes the block opened at `open`.
function blockEnd(text, open, to) {
  let depth = 0;
  for (let at = open; at < to; at = pastToken(text, at, to)) {
    at = nextOf(text, at, to, '{}');
    if (at >= to) break;
    depth += text[at] === '{' ? 1 : -1;
    if (depth === 0) return at;
  }
  return to;
}

// Past spaces and comments: where the text of a selector or a declaration starts.
function startOf(text, at, to) {
  let next = at;
  while (next < to && (/\s/.test(text[next]) || text.startsWith('/*', next))) next = pastToken(text, next, to);
  return next;
}

const trimEnd = (text, from, to) => from + text.slice(from, to).trimEnd().length;

function declarationOf(text, from, to) {
  const start = startOf(text, from, to), colon = nextOf(text, start, to, ':');
  if (start >= to || colon >= to) return null;
  const valueStart = startOf(text, colon + 1, to);
  let valueEnd = trimEnd(text, valueStart, to);
  const important = /!\s*important$/i.test(text.slice(valueStart, valueEnd));
  if (important) valueEnd = trimEnd(text, valueStart, text.lastIndexOf('!', valueEnd));
  const end = text[to] === ';' ? to + 1 : trimEnd(text, start, to);
  return {
    property: propertyName(text.slice(start, colon).trim()), value: text.slice(valueStart, valueEnd),
    important, start, end, valueStart, valueEnd,
  };
}

function declarationsOf(text, open, close) {
  const declarations = [];
  for (let at = open + 1; at < close;) {
    const end = nextOf(text, at, close, ';');
    const declaration = declarationOf(text, at, end);
    if (declaration) declarations.push(declaration);
    at = end + 1;
  }
  return declarations;
}

function ruleOf(text, at, open, close, media) {
  const start = startOf(text, at, open), nested = nextOf(text, open + 1, close, '{') < close;
  const selector = text.slice(start, open).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  return { selector, media, nested, start, open, close, declarations: nested ? [] : declarationsOf(text, open, close) };
}

function rulesIn(text, from, to, media, rules) {
  for (let at = from; at < to;) {
    const open = nextOf(text, at, to, '{}');
    if (open >= to || text[open] === '}') break;
    const close = blockEnd(text, open, to), prelude = text.slice(startOf(text, at, open), open).trim();
    if (CONDITIONS.test(prelude)) rulesIn(text, open + 1, close, prelude, rules);
    else if (!prelude.startsWith('@')) rules.push(ruleOf(text, at, open, close, media));
    at = close + 1;
  }
  return rules;
}

// The diagram's rules in source order, each with its index among them all.
export function styleRules(text, tree = sourceTree(text)) {
  const blocks = nodesOf(tree).filter(node => node.tag === 'style');
  const rules = blocks.flatMap(node => rulesIn(text, node.openEnd, node.closeStart, null, []));
  return rules.map((rule, index) => ({ ...rule, index }));
}

// The rules of a stylesheet that is not in a diagram (the building blocks' defaults).
export const sheetRules = css => rulesIn(css, 0, css.length, null, []).map((rule, index) => ({ ...rule, index }));

// A style attribute's declarations, in the same shape, read as a rule's body.
export const inlineDeclarations = value => declarationsOf(`{${value}}`, 0, value.length + 1)
  .map(({ property, value: text, important }) => ({ property, value: text, important }));
