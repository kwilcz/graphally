// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The properties panel: what the selection is and what can be changed on it. An element: moving
// out to its parent, duplicating, grouping, deleting or connecting it; its id, classes and own
// text; where its layout places it; the CSS that styles it; and its lines. A line: its label and
// sides, and deleting it. Each change is one edit of the source.
import { element, button, field, section } from './dom.js';
import { stylesOf } from './styles-panel.js';

const VARIANTS = ['external', 'accent', 'disabled'];
const BLOCKS = /\b(node|figure|card|tile|group|box|pill|tag|banner|band|key)\b/;
const SIDES = ['', 'top', 'right', 'bottom', 'left'];
const NOT_EDITABLE = 'This line comes from a list of ends or a drawing script: edit it in the source.';
const HINT = 'Click a box or a line to select it; click again to go into it. Drag it to move it within its '
  + 'layout: another cell, another place in its row or column, another group. Alt-drag nudges it. Double-click '
  + 'text to edit it. Esc selects the parent; Alt+arrows move the selection among its siblings and in or out.';

function choice(label, value, options, onChange) {
  const select = element('select', {}, options.map(option => new Option(option || 'auto', option)));
  select.value = value ?? '';
  select.addEventListener('change', () => onChange(select.value || null));
  return element('label', {}, [label, select]);
}

// A building block's variants as switches, each one a class on or off.
function variants(layer, setClasses) {
  const classes = layer.classes.split(/\s+/).filter(Boolean);
  return element('div', { className: 'variants' }, VARIANTS.map(name => {
    const box = element('input', { type: 'checkbox', checked: classes.includes(name) });
    const toggled = () => (box.checked ? [...classes, name] : classes.filter(other => other !== name));
    box.addEventListener('change', () => setClasses(toggled()));
    return element('label', {}, [box, name]);
  }));
}

function actionsOf(layer, act) {
  return element('div', { className: 'actions' }, [
    button('Parent', act.selectParent, 'Select the element around it (Esc)'),
    button('Duplicate', () => act.edit([{ op: 'duplicate', path: layer.path }]), 'Ctrl+D'),
    button('Group', () => act.wrap(layer), 'Put it in a new group (Ctrl+G)'),
    act.canUnwrap(layer) ? button('Ungroup', () => act.unwrap(layer), 'Put its children in its place (Ctrl+Shift+G)')
      : null,
    button('Delete', () => act.edit([{ op: 'remove', path: layer.path }]), 'Delete, with its lines'),
    layer.id ? button('Connect to…', () => act.startConnect(layer.id), 'Then click the box to connect') : null,
  ]);
}

function elementFields(layer, act) {
  const set = (name, value) => act.edit([{ op: 'attr', path: layer.path, name, value: value || null }]);
  return [
    field('Id', layer.id, value => set('id', value)),
    field('Classes', layer.classes, value => set('class', value)),
    layer.text ? field('Text', layer.text, text => act.edit([{ op: 'text', path: layer.path, text }])) : null,
    BLOCKS.test(layer.classes) ? variants(layer, classes => set('class', classes.join(' '))) : null,
  ];
}

function elementControls(context, act) {
  const { layer, cascade, styles, placement, lines } = context;
  return [
    element('h3', { textContent: `<${layer.tag}>${layer.id ? ` #${layer.id}` : ''}` }),
    actionsOf(layer, act),
    section('Element', elementFields(layer, act)),
    placement?.length ? section('Placement', placement) : null,
    cascade ? section('Styles', stylesOf(cascade, layer, styles, act)) : null,
    lines?.length ? section('Lines', lines) : null,
  ];
}

function lineControls({ key, entry }, act) {
  const heading = element('h3', { textContent: `line ${key}` });
  if (!entry) return [heading, element('p', { textContent: NOT_EDITABLE })];
  const set = change => act.edit([{ op: 'line', key, set: change }]);
  return [heading, field('Label', entry.label, label => set({ label: label || null })),
    choice('Out', entry.out, SIDES, out => set({ out })), choice('In', entry.in, SIDES, side => set({ in: side })),
    element('div', { className: 'actions' }, [button('Delete line', () => act.edit([{ op: 'unline', key }]))])];
}

export function showProperties(panel, context, act) {
  const controls = context.layer ? elementControls(context, act)
    : context.line ? lineControls(context.line, act) : [element('p', { className: 'hint', textContent: HINT })];
  panel.replaceChildren(...controls.filter(Boolean));
}
