// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The properties panel: what the selection is and what can be changed on it. An element: its id,
// classes and own text, a building block's variants, and moving out to its parent, duplicating,
// deleting or connecting it. A line: its label and sides, and deleting it. Each change is one
// edit of the source.
const VARIANTS = ['external', 'accent', 'disabled'];
const BLOCKS = /\b(node|figure|card|tile|group|box|pill|tag|banner|band|key)\b/;
const SIDES = ['', 'top', 'right', 'bottom', 'left'];
const NOT_EDITABLE = 'This line comes from a list of ends or a drawing script: edit it in the source.';
const HINT = 'Click a box or a line to select it; click again to go into it. Drag to move it within its layout '
  + '(Alt-drag nudges it). Double-click text to edit it. Esc selects the parent.';

function element(name, properties = {}, children = []) {
  const made = Object.assign(document.createElement(name), properties);
  made.append(...children);
  return made;
}

function field(label, value, onChange) {
  const input = element('input', { value: value ?? '' });
  input.addEventListener('change', () => onChange(input.value.trim()));
  return element('label', {}, [label, input]);
}

function choice(label, value, options, onChange) {
  const select = element('select', {}, options.map(option => new Option(option || 'auto', option)));
  select.value = value ?? '';
  select.addEventListener('change', () => onChange(select.value || null));
  return element('label', {}, [label, select]);
}

function button(text, onClick, title = '') {
  const made = element('button', { type: 'button', textContent: text, title });
  made.addEventListener('click', onClick);
  return made;
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

function elementControls(layer, act) {
  const set = (name, value) => act.edit([{ op: 'attr', path: layer.path, name, value: value || null }]);
  const controls = [element('h3', { textContent: `<${layer.tag}>${layer.id ? ` #${layer.id}` : ''}` })];
  controls.push(field('Id', layer.id, value => set('id', value)));
  controls.push(field('Classes', layer.classes, value => set('class', value)));
  if (layer.text) controls.push(field('Text', layer.text, text => act.edit([{ op: 'text', path: layer.path, text }])));
  if (BLOCKS.test(layer.classes)) controls.push(variants(layer, classes => set('class', classes.join(' '))));
  controls.push(element('div', { className: 'actions' }, [
    button('Parent', act.selectParent, 'Select the element around it (Esc)'),
    button('Duplicate', () => act.edit([{ op: 'duplicate', path: layer.path }]), 'Ctrl+D'),
    button('Delete', () => act.edit([{ op: 'remove', path: layer.path }]), 'Delete, with its lines'),
    ...(layer.id ? [button('Connect to…', () => act.startConnect(layer.id), 'Then click the box to connect')] : []),
  ]));
  return controls;
}

function lineControls({ key, entry }, act) {
  const heading = element('h3', { textContent: `line ${key}` });
  if (!entry) return [heading, element('p', { textContent: NOT_EDITABLE })];
  const set = change => act.edit([{ op: 'line', key, set: change }]);
  return [heading, field('Label', entry.label, label => set({ label: label || null })),
    choice('Out', entry.out, SIDES, out => set({ out })), choice('In', entry.in, SIDES, side => set({ in: side })),
    element('div', { className: 'actions' }, [button('Delete line', () => act.edit([{ op: 'unline', key }]))])];
}

export function showProperties(panel, { layer, line }, act) {
  if (layer) panel.replaceChildren(...elementControls(layer, act));
  else if (line) panel.replaceChildren(...lineControls(line, act));
  else panel.replaceChildren(element('p', { className: 'hint', textContent: HINT }));
}
