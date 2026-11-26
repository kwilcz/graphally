// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What styles an element, ordered as the browser's cascade orders it: its style attribute, then
// every rule that matches it by specificity and source order, with each declaration that another
// one beats marked as overridden. The rules are the diagram's own <style>, its utility classes
// (the engine writes them first, as `.graphally-page .name`: specificity 0,2,0) and graphally's
// defaults (in :where(), specificity 0). Matching runs on the source as parsed, where each
// element carries its path (data-src).
import { specificity, partsOf, compareWeights } from './selectors.js';

// A property's name as CSS compares it: custom properties (--myAccent) keep their case.
export const propertyName = name => (name.startsWith('--') ? name : name.toLowerCase());

const PSEUDO = /::?(before|after)\b/;
// Rules rank by origin, then by their order within it: defaults, utilities, the diagram's own.
const ORDER = { default: 0, utility: 1e4, rule: 2e4, inline: 3e4 };
const WEIGHT = { default: [0, 0, 0], utility: [0, 2, 0], inline: [0, 0, 0] };
const withoutPseudo = part => part.replace(PSEUDO, '') || '*';

export function declarationsOf(css) {
  return partsOf(css, ';').filter(part => part.includes(':')).map(part => {
    const colon = part.indexOf(':'), value = part.slice(colon + 1).trim();
    return {
      property: propertyName(part.slice(0, colon).trim()),
      value: value.replace(/\s*!\s*important$/i, ''), important: /!\s*important$/i.test(value),
    };
  });
}

function matches(element, selector) {
  try {
    return element.matches(selector);
  } catch {
    return false;   // a selector this browser cannot read matches nothing
  }
}

// The most specific part of a selector list that matches the element, and whether it styles the
// element's ::before or ::after.
function matchOf(element, selector) {
  const found = partsOf(selector, ',').filter(part => matches(element, withoutPseudo(part)))
    .map(part => ({ pseudo: PSEUDO.exec(part)?.[1] ?? null, specificity: specificity(part) }));
  return found.reduce((best, match) => (!best || compareWeights(match.specificity, best.specificity) > 0
    ? match : best), null);
}

function applies(media) {
  if (!media) return true;
  const condition = media.replace(/^@\w+\s*/, '');
  if (media.startsWith('@media')) return matchMedia(condition).matches;
  return media.startsWith('@supports') ? CSS.supports(condition) : true;
}

// How many elements a rule styles: editing it changes them all.
function countOf(root, selector) {
  try {
    return root.querySelectorAll(partsOf(selector, ',').map(withoutPseudo).join(',')).length;
  } catch {
    return 0;
  }
}

function ruleEntries(element, root, rules, origin) {
  return rules.filter(rule => !rule.nested).flatMap((rule, at) => {
    const match = matchOf(element, rule.selector);
    if (!match) return [];
    return [{
      origin, rule, selector: rule.selector, pseudo: match.pseudo, specificity: WEIGHT[origin] ?? match.specificity,
      order: ORDER[origin] + at, active: applies(rule.media),
      count: origin === 'rule' ? countOf(root, rule.selector) : 0,
      declarations: rule.declarations.map(declaration => ({ ...declaration })),
    }];
  });
}

// A utility that nests (space-y-2) styles the element's children, not the element.
const utilityEntries = (element, utilities) => [...element.classList].filter(name => utilities[name])
  .map((name, at) => ({
    origin: 'utility', cls: name, selector: `.${name}`, pseudo: null, specificity: WEIGHT.utility,
    order: ORDER.utility + at, active: true, nested: utilities[name].nested ?? null,
    declarations: declarationsOf(utilities[name].css),
  }));

const keyOf = (entry, declaration) => [Number(declaration.important), Number(entry.origin === 'inline'),
  ...entry.specificity, entry.order];
const counts = entry => entry.active && !entry.pseudo && !entry.nested;

// Per property, the declaration with the highest key wins; every other one is overridden.
function markOverridden(entries) {
  const winners = new Map();
  const candidates = entries.filter(counts)
    .flatMap(entry => entry.declarations.map(declaration => ({ entry, declaration })));
  for (const { entry, declaration } of candidates) {
    const best = winners.get(declaration.property), key = keyOf(entry, declaration);
    if (!best || compareWeights(key, best.key) >= 0) winners.set(declaration.property, { key, declaration, entry });
  }
  for (const declaration of entries.flatMap(entry => entry.declarations)) {
    declaration.overridden = winners.get(declaration.property)?.declaration !== declaration;
  }
  return winners;
}

const ranked = (one, other) => Number(Boolean(one.pseudo)) - Number(Boolean(other.pseudo))
  || compareWeights(other.specificity, one.specificity) || other.order - one.order;

// The element's cascade: its entries, most important first, and per property the winner.
export function cascadeOf(element, root, styles) {
  const inline = {
    origin: 'inline', selector: 'style', pseudo: null, specificity: WEIGHT.inline, order: ORDER.inline,
    active: true, declarations: declarationsOf(element.getAttribute('style') || ''),
  };
  const rules = [...ruleEntries(element, root, styles.rules, 'rule'), ...utilityEntries(element, styles.utilities),
    ...ruleEntries(element, root, styles.defaults, 'default')].sort(ranked);
  const entries = [inline, ...rules];
  return { entries, winners: markOverridden(entries) };
}
