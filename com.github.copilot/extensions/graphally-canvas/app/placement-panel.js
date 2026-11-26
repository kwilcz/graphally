// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where the selection sits, as fields: in a grid placed by line, its column and row with their
// spans; in a grid of named areas, its area; and anywhere, its nudge. Each change is written where
// the source places the element (placement.js).
import { element } from './dom.js';
import { tracksOf, placedByLine, spanOf, areaOf } from './grid.js';
import { placementEdits, lineValue } from './placement.js';

function number(value, onChange, max) {
  const input = element('input', { type: 'number', min: 1, max, value, className: 'number' });
  input.addEventListener('change', () => onChange(Math.max(1, Math.min(max, Number(input.value) || 1))));
  return input;
}

// A column or row: where it starts and how many tracks it spans.
function lineRow(model, entry, axis, act) {
  const tracks = tracksOf(model, model.parentOf(entry), axis).length;
  if (!tracks) return null;
  const start = placedByLine(entry, axis) ? Number(entry.place[axis][0]) : null;
  const span = spanOf(entry, axis, tracks);
  const property = axis === 'col' ? 'grid-column' : 'grid-row';
  const set = (from, across) => act.edit(placementEdits(entry.src, { [property]: lineValue(from, across) }));
  return element('div', { className: 'inline-fields' }, [
    element('span', { textContent: axis === 'col' ? 'Column' : 'Row' }),
    number(start ?? '', from => set(from, span), tracks),
    element('span', { textContent: 'span' }),
    number(span, across => set(start ?? 1, across), tracks),
  ]);
}

function areaRow(grid, entry, act) {
  const names = [...new Set(grid.layout.areas.flat().filter(name => name !== '.'))];
  const select = element('select', {}, [new Option('auto', ''), ...names.map(name => new Option(name, name))]);
  select.value = areaOf(entry) ?? '';
  select.addEventListener('change', () => act.edit(placementEdits(entry.src, { 'grid-area': select.value || 'auto' })));
  return element('label', { className: 'inline-fields' }, [element('span', { textContent: 'Area' }), select]);
}

function nudgeRow(layer, act) {
  const [x, y] = (layer.nudge || '0,0').split(',').map(Number);
  const set = (nx, ny) => act.edit([{
    op: 'attr', path: layer.path, name: 'nudge', value: nx || ny ? `${nx},${ny}` : null,
  }]);
  const field = (value, onChange) => {
    const input = element('input', { type: 'number', value, className: 'number' });
    input.addEventListener('change', () => onChange(Math.round(Number(input.value) || 0)));
    return input;
  };
  return element('div', { className: 'inline-fields' }, [
    element('span', { textContent: 'Nudge' }), field(x, nx => set(nx, y)), field(y, ny => set(x, ny)),
  ]);
}

export function placementControls(model, entry, layer, act) {
  const grid = entry && model.parentOf(entry);
  const rows = [];
  if (grid?.layout.kind === 'grid' && grid.layout.areas) rows.push(areaRow(grid, entry, act));
  else if (grid?.layout.kind === 'grid') rows.push(...['col', 'row'].map(axis => lineRow(model, entry, axis, act)));
  return [...rows.filter(Boolean), nudgeRow(layer, act)];
}
