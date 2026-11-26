// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The styles of the selection, as the cascade orders them, each declaration edited where it is
// written: in the element's style attribute, in a rule of the diagram's <style> (which may style
// other elements too: the panel says how many), or, for a utility class, by changing the class.
// graphally's defaults are shown, not edited: a rule of the diagram's own overrides them.
import { element, button, textField } from './dom.js';
import { propertyName } from './cascade.js';

const PROPERTIES = [
  'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'gap', 'row-gap',
  'column-gap', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-column', 'grid-row',
  'grid-area', 'width', 'height', 'min-width', 'max-width', 'padding', 'margin', 'border', 'border-left',
  'border-radius', 'background', 'color', 'font-size', 'font-weight', 'line-height', 'text-align', 'opacity',
  'position', 'top', 'left', 'z-index', 'box-shadow', 'white-space', 'text-transform', 'letter-spacing',
];
const COLOR = /var\(--|#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(/i;
const ORIGINS = { inline: 'style attribute', utility: 'utility class', default: 'graphally' };

// The lists the fields suggest from: CSS properties, and the theme's colour tokens as values.
export function styleLists(tokens) {
  const list = (id, values) => element('datalist', { id }, values.map(value => element('option', { value })));
  return [list('css-properties', PROPERTIES), list('css-values', tokens.map(token => `var(--${token})`))];
}

function swatch(value, colorOf) {
  if (!COLOR.test(value)) return null;
  return element('span', { className: 'swatch', title: value, style: `background: ${colorOf(value)}` });
}

// A declaration to edit: renaming its property moves its value; emptying either removes it.
function declarationRow(declaration, set, colorOf) {
  const { property, value } = declaration;
  const name = textField(property, next => {
    if (propertyName(next) !== property) set({ [property]: null, ...(next ? { [propertyName(next)]: value } : {}) });
  }, { className: 'property', list: 'css-properties' });
  const edit = textField(value, next => set({ [property]: next || null }), { className: 'value', list: 'css-values' });
  const classes = ['declaration', declaration.overridden && 'overridden', declaration.important && 'important'];
  return element('div', { className: classes.filter(Boolean).join(' ') }, [
    name, element('span', { textContent: ':' }), swatch(value, colorOf), edit,
    button('×', () => set({ [property]: null }), `Remove ${property}`),
  ]);
}

function newRow(set) {
  const value = textField('', next => next && name.value.trim() && set({ [propertyName(name.value.trim())]: next }),
    { className: 'value', list: 'css-values', placeholder: 'value' });
  const name = textField('', () => {}, { className: 'property', list: 'css-properties', placeholder: 'add property' });
  name.addEventListener('keydown', event => event.key === 'Enter' && value.focus());
  return element('div', { className: 'declaration new' }, [name, element('span', { textContent: ':' }), value]);
}

const readOnlyRow = declaration => element('div', {
  className: `declaration${declaration.overridden ? ' overridden' : ''}`,
  textContent: `${declaration.property}: ${declaration.value}${declaration.important ? ' !important' : ''}`,
});

function metaOf(entry) {
  const notes = [entry.pseudo && `::${entry.pseudo}`, entry.rule?.media, entry.nested && `children ${entry.nested}`,
    entry.count > 1 && `${entry.count} elements`, ORIGINS[entry.origin]];
  return element('span', { className: 'meta', textContent: notes.filter(Boolean).join(' · ') });
}

// Whether the browser can read a selector.
function readable(selector) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function renameRule(entry, next, act) {
  if (!next || next === entry.selector) return;
  if (!readable(next)) act.say(`"${next}" is not a selector the browser can read.`, true);
  else act.edit([{ op: 'rule', rule: entry.rule.index, rename: next }]);
}

// A rule's selector or a utility class, to rename it where it is written; else a label.
function labelOf(entry, act) {
  if (entry.origin === 'utility') {
    return textField(entry.cls, next => act.renameClass(entry.cls, next), { className: 'selector' });
  }
  if (entry.origin === 'rule' && !entry.rule.nested) {
    return textField(entry.selector, next => renameRule(entry, next, act),
      { className: 'selector', title: 'The rule\'s selector: Enter renames it' });
  }
  const text = entry.origin === 'inline' ? 'this element' : entry.selector;
  return element('code', { className: 'selector', textContent: text });
}

function headerOf(entry, act) {
  const remove = entry.origin === 'rule' && !entry.rule.nested
    && button('×', () => act.edit([{ op: 'rule', rule: entry.rule.index, remove: true }]), 'Delete this rule');
  return element('div', { className: 'rule-head' }, [labelOf(entry, act), metaOf(entry), remove]);
}

function block(entry, set, act) {
  const rows = entry.declarations.map(declaration => (set ? declarationRow(declaration, set, act.colorOf)
    : readOnlyRow(declaration)));
  return element('div', { className: `rule ${entry.origin}${entry.active ? '' : ' inactive'}` },
    [headerOf(entry, act), ...rows, set && newRow(set)]);
}

// A selector for a new rule for the element: its id, else the first class that is not a utility.
function newSelector(layer, utilities) {
  if (layer.id) return `#${layer.id}`;
  const kind = layer.classes.split(/\s+/).find(name => name && !utilities[name]);
  return kind ? `.${kind}` : layer.tag;
}

export function stylesOf(cascade, layer, styles, act) {
  const setterOf = entry => {
    if (entry.origin === 'inline') return set => act.edit([{ op: 'style', path: layer.path, set }]);
    if (entry.origin !== 'rule' || entry.rule.nested) return null;
    return set => act.edit([{ op: 'rule', rule: entry.rule.index, set }]);
  };
  const own = cascade.entries.filter(entry => entry.origin !== 'default');
  const defaults = cascade.entries.filter(entry => entry.origin === 'default');
  const selector = newSelector(layer, styles.utilities);
  return [
    ...own.map(entry => block(entry, setterOf(entry), act)),
    defaults.length ? element('details', { className: 'defaults' }, [
      element('summary', { textContent: `graphally defaults (${defaults.length})` }),
      ...defaults.map(entry => block(entry, null, act)),
    ]) : null,
    styles.rules.some(rule => rule.selector === selector && !rule.media) ? null
      : element('div', { className: 'actions' }, [button(`New rule ${selector}`,
        () => act.edit([{ op: 'rule', selector, set: {} }]), 'Add a rule to the diagram\'s <style>')]),
  ].filter(Boolean);
}
