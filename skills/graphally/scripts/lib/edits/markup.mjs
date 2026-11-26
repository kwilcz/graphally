// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The diagram's markup as text: a <diagram>, an element's start tag, an attribute in it.

// Where the file's comments are: a <diagram> inside one is not a diagram.
const commentsIn = source => [...source.matchAll(/<!--[\s\S]*?-->/g)]
  .map(match => [match.index, match.index + match[0].length]);

// The span of the n-th <diagram> (or the one with that id) in the file.
export function diagramSpan(source, which) {
  const comments = commentsIn(source);
  const commented = match => comments.some(([from, to]) => match.index > from && match.index < to);
  const all = [...source.matchAll(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g)].filter(match => !commented(match));
  const startTag = match => match[0].slice(0, match[0].indexOf('>') + 1);
  const hasId = match => new RegExp(`\\bid\\s*=\\s*["']?${which}["'\\s>]`).test(startTag(match));
  const match = typeof which === 'string' ? all.find(hasId) : all[which || 0];
  if (!match) throw new Error(typeof which === 'string' ? `no <diagram id=${which}>` : 'no <diagram> in the file');
  return { start: match.index, end: match.index + match[0].length, text: match[0] };
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The start tag of the element with this id, inside the diagram.
export function tagOf(text, id) {
  const name = escapeRegExp(id), attributes = `(?:[^>"']|"[^"]*"|'[^']*')*`;
  const idAttribute = `\\bid\\s*=\\s*(?:"${name}"|'${name}'|${name})(?=[\\s/>])`;
  const match = text.match(new RegExp(`<([a-zA-Z][\\w-]*)\\b${attributes}?${idAttribute}${attributes}>`));
  if (!match) throw new Error(`no element with id "${id}"`);
  return { start: match.index, end: match.index + match[0].length, text: match[0] };
}

const attributePattern = name => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`);

// An attribute's value written as the one before it was: bare or in single quotes when it was
// and the value allows it, else in double quotes.
function quoted(value, before) {
  const text = String(value).replace(/&/g, '&amp;');
  if (before?.[3] !== undefined && /^[^\s"'=<>`]+$/.test(text)) return text;
  if ((before?.[2] !== undefined || text.includes('"')) && !text.includes("'")) return `'${text}'`;
  return `"${text.replace(/"/g, '&quot;')}"`;
}

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' };
// An attribute's text as the browser reads it: its character references decoded.
const decoded = text => text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (reference, name) => {
  const hex = name[1]?.toLowerCase() === 'x';
  if (name[0] === '#') return String.fromCodePoint(Number(hex ? `0${name.slice(1)}` : name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? reference;
});

// Sets (or, with null, removes) one attribute in a start tag.
export function setAttribute(tag, name, value) {
  const pattern = attributePattern(name), before = tag.match(pattern);
  if (value == null) return tag.replace(pattern, '');
  const attribute = ` ${name}=${quoted(value, before)}`;
  return before ? tag.replace(pattern, () => attribute) : tag.replace(/\s*\/?>$/, end => attribute + end);
}

export function getAttribute(tag, name) {
  const match = tag.match(attributePattern(name));
  return match ? decoded(match[1] ?? match[2] ?? match[3]) : null;
}

// A text with a span of it replaced.
export const splice = (text, { start, end }, replacement) => text.slice(0, start) + replacement + text.slice(end);
