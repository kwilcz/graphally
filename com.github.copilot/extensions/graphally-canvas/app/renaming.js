// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A new id for an element: the edits that give it, and carry its lines (their ends, the anchors on
// it, the points they pass by) and the rules that name it (#old) along; or why it cannot be given.
// What the canvas cannot rewrite (a drawing script, an attribute that names the id) is pointed out.
import { view } from './view.js';

const ends = value => [].concat(value ?? []);
// The lines that name an id: as an end, an anchor on it ("fd.top"), or a point they pass by.
const namesId = (value, id) => typeof value === 'string' && (value === id || value.startsWith(`${id}.`));
const named = (lines, id) => lines.filter(entry => [...ends(entry.from), ...ends(entry.to), ...ends(entry.via)]
  .some(value => namesId(value, id)));

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
  const one = end => (namesId(end, old) ? next + end.slice(old.length) : end);
  const swap = value => (Array.isArray(value) ? value.map(one) : one(value));
  const set = { from: swap(entry.from), to: swap(entry.to), ...(entry.via ? { via: swap(entry.via) } : {}) };
  return { op: 'line', key: entry.key, set };
});

// What else in the diagram names an id the canvas cannot rewrite: a drawing script, an attribute.
function leftovers(old) {
  const source = view.state.source, places = [];
  const scripts = [...source.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)];
  if (scripts.some(([, body]) => new RegExp(`(['"\`])${old}[.'"\`]`).test(body))) places.push('a drawing script');
  // Attributes that name an element by its id: data-*, for, aria-*, and links to #id.
  const value = `\\s*=\\s*["']?`, ends = `(?=["'\\s>])`;
  const naming = `\\s(data-[\\w-]+|for|aria-[\\w-]+)${value}${old}${ends}|\\shref${value}#${old}${ends}`;
  if (new RegExp(naming).test(source)) places.push('an attribute');
  return places;
}

function renamedRules(old, next) {
  const naming = () => new RegExp(`#${old}(?![\\w-])`, 'g');
  return view.state.styles.rules.filter(rule => !rule.nested && naming().test(rule.selector))
    .map(rule => ({ op: 'rule', rule: rule.index, rename: rule.selector.replace(naming(), `#${next}`) }));
}

// The rename's edits and what still names the old id, or the problem that stops it.
export function renaming(layer, next) {
  const problem = idProblem(layer, next);
  if (problem) return { problem };
  const edits = [{ op: 'attr', path: layer.path, name: 'id', value: next || null }];
  if (layer.id && next) edits.push(...renamedEnds(layer.id, next), ...renamedRules(layer.id, next));
  return { edits, rest: layer.id && next ? leftovers(layer.id) : [] };
}
