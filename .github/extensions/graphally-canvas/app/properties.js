// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The properties panel: what the selection is and what can be changed on it. An element: moving
// out to its parent, duplicating, grouping, deleting or connecting it; its id, classes and own
// text; where its layout places it; the CSS that styles it; and its lines. A line: its label and
// sides, and deleting it. Each change is one edit of the source.
import { element, button, field, section } from './dom.js';
import { stylesOf } from './styles-panel.js';
import { canSplit } from './lines.js';

const VARIANTS = ['external', 'accent', 'disabled'];
const BLOCKS = /\b(node|figure|card|tile|group|box|pill|tag|banner|band|key)\b/;
const SIDES = ['', 'top', 'right', 'bottom', 'left'];
const SCRIPT_LINE = 'A drawing script in the diagram draws this line: edit it in the source.';
const HINT = 'Click a box or a line to select it; click again to go into it. Drag it to move it within its '
  + 'layout: another cell, another place in its row or column, another group. Alt-drag nudges it. Drag the dot '
  + 'off its corner to another box to draw a line. Double-click text to edit it. Arrows walk the tree; '
  + 'Alt+arrows move the selection among its siblings and in or out.';

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

// The box's icon, by name, with the names graphally knows to choose from.
function iconField(icon, act) {
  const setIcon = name => name && act.edit([{ op: 'attr', path: icon.path, name: 'name', value: name }]);
  const label = field('Icon', icon.name, setIcon);
  const input = label.querySelector('input');
  input.setAttribute('list', 'icon-names');
  input.addEventListener('focus', () => act.iconNames().then(names => fillIconList(names)), { once: true });
  return label;
}

function fillIconList(names) {
  const list = document.getElementById('icon-names');
  if (list && !list.childElementCount) list.append(...names.map(value => element('option', { value })));
}

function elementFields({ layer, icon }, act) {
  const set = (name, value) => act.edit([{ op: 'attr', path: layer.path, name, value: value || null }]);
  return [
    field('Id', layer.id, value => act.renameId(layer, value)),
    field('Classes', layer.classes, value => set('class', value)),
    layer.text ? field('Text', layer.text, text => act.edit([{ op: 'text', path: layer.path, text }])) : null,
    icon ? iconField(icon, act) : null,
    BLOCKS.test(layer.classes) ? variants(layer, classes => set('class', classes.join(' '))) : null,
  ];
}

function elementControls(context, act) {
  const { layer, cascade, styles, placement, lines } = context;
  return [
    element('h3', { textContent: `<${layer.tag}>${layer.id ? ` #${layer.id}` : ''}` }),
    actionsOf(layer, act),
    section('Element', elementFields(context, act)),
    placement?.length ? section('Placement', placement) : null,
    cascade ? section('Styles', stylesOf(cascade, layer, styles, act)) : null,
    lines?.length ? section('Lines', lines) : null,
  ];
}

// A line written with others ("from": ["a", "b"]) shares their options: the panel says so, and
// offers to split it out to change it alone.
function sharedNote({ entry, count }) {
  if (count < 2) return null;
  const others = `${count - 1} other line${count > 2 ? 's' : ''}`;
  const text = `Written with ${others} (${entry.key}): a change here changes them all.`;
  return element('p', { className: 'hint', textContent: text });
}

function lineControls({ key, found }, act) {
  const heading = element('h3', { textContent: `line ${key}` });
  if (!found) return [heading, element('p', { className: 'hint', textContent: SCRIPT_LINE })];
  const { entry } = found, set = change => act.edit([{ op: 'line', key: entry.key, set: change }]);
  return [heading, sharedNote(found), field('Label', entry.label, label => set({ label: label || null })),
    choice('Out', entry.out, SIDES, out => set({ out })), choice('In', entry.in, SIDES, side => set({ in: side })),
    element('div', { className: 'actions' }, [
      canSplit(found) ? button('Split out', () => act.splitLine(found, key), 'Give this line an entry of its own')
        : null,
      button('Delete line', () => act.removeLine(found)),
    ])];
}

// Several elements selected (Shift+click): what can be done to them together.
const severalControls = (count, act) => [
  element('h3', { textContent: `${count} elements` }),
  element('div', { className: 'actions' }, [
    button('Group', () => act.wrap(), 'Put them, side by side in one parent, into a new group (Ctrl+G)'),
    button('Delete', () => act.remove(), 'Delete them all, with their lines'),
    button('Select one', act.selectParent, 'Keep only the first selected (Esc)'),
  ]),
  element('p', { className: 'hint', textContent: 'Shift+click adds an element to the selection, or takes it away.' }),
];

export function showProperties(panel, context, act) {
  const controls = context.several ? severalControls(context.several, act)
    : context.layer ? elementControls(context, act)
      : context.line ? lineControls(context.line, act) : [element('p', { className: 'hint', textContent: HINT })];
  panel.replaceChildren(...controls.filter(Boolean));
}
