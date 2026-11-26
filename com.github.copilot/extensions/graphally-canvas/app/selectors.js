// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Reading selectors: a list's parts, and a selector's specificity as Selectors Level 4 counts it
// (ids; classes, attributes and pseudo-classes; types and pseudo-elements). :where() counts
// nothing; :is(), :not() and :has() count as their most specific argument.

// Top-level parts of a list, split at this character, never inside (…), […] or quotes.
export function partsOf(text, separator) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  [...text].forEach((char, at) => {
    if (quote) quote = char === quote ? null : quote;
    else if (char === '"' || char === "'") quote = char;
    else depth += '(['.includes(char) ? 1 : ')]'.includes(char) ? -1 : 0;
    if (char === separator && depth === 0 && !quote) {
      parts.push(text.slice(start, at));
      start = at + 1;
    }
  });
  return [...parts, text.slice(start)].map(part => part.trim()).filter(Boolean);
}

const add = (one, other) => one.map((value, at) => value + other[at]);
const greatest = list => list.reduce((best, weight) => (compareWeights(weight, best) > 0 ? weight : best), [0, 0, 0]);
const LEGACY_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);
const NAME = String.raw`(?:[\w-]|\\.)+`;
const SIMPLE = new RegExp(String.raw`^(#${NAME})|^(\.${NAME}|\[[^\]]*\]|:${NAME})|^(::${NAME}|[a-zA-Z](?:[\w-]|\\.)*)`);

export function compareWeights(one, other) {
  for (let at = 0; at < one.length; at++) if (one[at] !== other[at]) return one[at] - other[at];
  return 0;
}

function closingParen(text, open) {
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    depth += text[at] === '(' ? 1 : text[at] === ')' ? -1 : 0;
    if (depth === 0) return at;
  }
  return text.length;
}

// What a functional pseudo-class counts: nothing, its most specific argument, or one class.
function functional(name, argument) {
  if (name === 'where') return [0, 0, 0];
  if (['is', 'not', 'has', 'matches', '-webkit-any'].includes(name)) {
    return greatest(partsOf(argument, ',').map(specificity));
  }
  return name.startsWith(':') ? [0, 0, 1] : [0, 1, 0];
}

function simple(token) {
  if (token[1]) return [1, 0, 0];
  if (token[2]) return token[2].startsWith(':') && LEGACY_ELEMENTS.has(token[2].slice(1)) ? [0, 0, 1] : [0, 1, 0];
  return [0, 0, 1];
}

export function specificity(selector) {
  let weight = [0, 0, 0];
  for (let at = 0; at < selector.length;) {
    const rest = selector.slice(at), call = /^(::?)([\w-]+)\(/.exec(rest);
    if (call) {
      const close = closingParen(selector, at + call[0].length - 1);
      const name = call[1] === '::' ? `:${call[2]}` : call[2];
      weight = add(weight, functional(name, selector.slice(at + call[0].length, close)));
      at = close + 1;
      continue;
    }
    const token = SIMPLE.exec(rest);
    if (token) weight = add(weight, simple(token));
    at += token ? token[0].length : 1;
  }
  return weight;
}
