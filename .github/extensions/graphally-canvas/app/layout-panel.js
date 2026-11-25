// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The selection's own layout, when it lays out others. A grid: its columns and its rows, each
// with a button that adds one and one that takes the last away (disabled, saying why, where the
// template cannot change so). A list: how many items it holds and in which direction, with a
// button that adds one like its last. Other containers have no layout of their own to grow.
import { element, button } from './dom.js';
import { tracksOf } from './grid.js';
import { trackEdits, trackOwner } from './tracks.js';

const NAMES = { col: ['Columns', 'column'], row: ['Rows', 'row'] };

function stepButton(model, entry, axis, step, act) {
  const { problem, edits } = trackEdits(model, entry, axis, step), [, one] = NAMES[axis];
  const title = step > 0 ? `Add a ${one}` : `Take the last ${one} away`;
  const made = button(step > 0 ? '+' : '−', () => act.edit(edits), title);
  if (problem) Object.assign(made, { disabled: true, title: problem });
  return made;
}

function trackRow(model, entry, axis, act) {
  const owner = trackOwner(model, entry, axis), count = owner ? tracksOf(model, owner, axis).length : 0;
  const whose = owner && owner !== entry ? ' (its parent grid\'s)' : '';
  return element('div', { className: 'inline-fields' }, [
    element('span', { textContent: NAMES[axis][0] }),
    element('span', { className: 'count', textContent: `${count}${whose}` }),
    stepButton(model, entry, axis, -1, act), stepButton(model, entry, axis, 1, act),
  ]);
}

function listRow(model, entry, layer, act) {
  const items = model.childrenOf(entry.src).length;
  const direction = entry.layout.dir.startsWith('row') ? 'a row' : 'a column';
  return element('div', { className: 'inline-fields' }, [
    element('span', { textContent: 'Items' }),
    element('span', { className: 'count', textContent: `${items}, in ${direction}` }),
    button('+ Item', () => act.addItem(layer), 'Add an item like the last one'),
  ]);
}

export function layoutControls(model, entry, layer, act) {
  if (entry?.layout.kind === 'grid') return ['col', 'row'].map(axis => trackRow(model, entry, axis, act));
  if (entry?.layout.kind === 'flex') return [listRow(model, entry, layer, act)];
  return [];
}
