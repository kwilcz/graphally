// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Changing where an element sits in its grid, where the source places it. The cascade says which
// declaration places it now: a utility class is swapped for another (col-[3] for col-[5]); the
// style attribute, or a rule that styles this element alone, is changed in place. When a rule
// several elements share places it, or nothing does, the element gets a utility class of its own,
// which beats the rule (0,2,0 against a class) or, against a stronger rule, a style attribute.
import { cascadeOf } from './cascade.js';
import { compareWeights } from './selectors.js';
import { view, sourceElement } from './view.js';

const FAMILIES = {
  'grid-column': ['grid-column', 'grid-column-start', 'grid-column-end', 'grid-area'],
  'grid-row': ['grid-row', 'grid-row-start', 'grid-row-end', 'grid-area'],
  'grid-area': ['grid-area', 'grid-column', 'grid-row', 'grid-column-start', 'grid-row-start'],
};
const asClassValue = value => String(value).replace(/\s*\/\s*/g, '/').replace(/\s+/g, '_');
const UTILITIES = {
  'grid-column': value => `col-[${asClassValue(value)}]`,
  'grid-row': value => `row-[${asClassValue(value)}]`,
  'grid-area': value => `[grid-area:${asClassValue(value)}]`,
};
// The utility classes that place an element on each property's axis.
const PLACING = {
  'grid-column': /^col-|^\[grid-column[:-]/, 'grid-row': /^row-|^\[grid-row[:-]/,
  'grid-area': /^\[grid-area:|^col-|^row-|^\[grid-(column|row)[:-]/,
};
const UTILITY_WEIGHT = [0, 2, 0];

// The declaration that places the element on a property's axis now, with what it is in.
function placingNow(cascade, property) {
  for (const name of FAMILIES[property]) {
    const winner = cascade.winners.get(name);
    if (winner) return winner;
  }
  return null;
}

// Where a new value of the property goes: 'utility', 'inline', or a rule's index.
function whereTo(winner) {
  const entry = winner?.entry;
  if (!entry || entry.origin === 'default' || entry.origin === 'utility') return 'utility';
  if (entry.origin === 'inline') return 'inline';
  if (entry.count === 1 && !entry.pseudo) return entry.rule.index;
  return compareWeights(entry.specificity, UTILITY_WEIGHT) < 0 ? 'utility' : 'inline';
}

// The class list with a new placing class where the first old one stood (or last), and no other.
function withUtility(classes, placing, added) {
  const at = classes.findIndex(name => placing.test(name));
  const kept = classes.filter((name, index) => index === at || !placing.test(name));
  return at < 0 ? [...kept, added] : kept.map(name => (placing.test(name) ? added : name));
}

// The edits that set these placement properties ({ 'grid-column': '3 / span 2' }) on an element.
export function placementEdits(path, set) {
  const element = sourceElement(path);
  if (!element) return [];
  const cascade = cascadeOf(element, view.parsed, view.state.styles), inline = {}, rules = new Map();
  let classes = (element.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  for (const [property, value] of Object.entries(set)) {
    const where = whereTo(placingNow(cascade, property));
    if (where === 'utility') classes = withUtility(classes, PLACING[property], UTILITIES[property](value));
    else if (where === 'inline') inline[property] = value;
    else rules.set(where, { ...rules.get(where), [property]: value });
  }
  const edits = [...rules].map(([rule, changes]) => ({ op: 'rule', rule, set: changes }));
  if (Object.keys(inline).length) edits.push({ op: 'style', path, set: inline });
  if (classes.join(' ') !== (element.getAttribute('class') || '').split(/\s+/).filter(Boolean).join(' ')) {
    edits.push({ op: 'attr', path, name: 'class', value: classes.join(' ') || null });
  }
  return edits;
}

// A line's value for a start and a span: 3, or 3 / span 2.
export const lineValue = (start, span) => (span > 1 ? `${start} / span ${span}` : String(start));
