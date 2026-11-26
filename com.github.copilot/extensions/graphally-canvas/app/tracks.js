// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Adding a grid's column or row, or taking its last one away, where the source writes its template:
// a utility class (grid-cols-3 becomes grid-cols-4), an arbitrary one (grid-cols-[100px_1fr]), a
// rule of the diagram's <style> or the style attribute. A trailing repeat(11, auto) counts one more
// or one less; any other last track is copied, or dropped. Named areas get a "." cell in each row,
// or a row of them. A subgrid's columns are its parent grid's, so its parent's template changes.
// A grid whose rows come from its content (no row template) has no rows to add here: a box
// dropped past its last row makes one.
import { cascadeOf } from './cascade.js';
import { partsOf } from './selectors.js';
import { view, sourceElement } from './view.js';
import { tracksOf, placedByLine, spanOf } from './grid.js';

const TEMPLATE = { col: 'grid-template-columns', row: 'grid-template-rows' };

// The track list with one track more (step 1) or less (-1), or null when it cannot change so.
export function steppedList(list, step) {
  const tracks = partsOf(list, ' '), at = tracks.findLastIndex(track => !track.startsWith('['));
  const repeat = /^repeat\(\s*(\d+)\s*,(.*)\)$/s.exec(tracks[at] ?? '');
  if (at < 0 || /^repeat\(\s*auto-/.test(tracks[at]) || list.trim() === 'subgrid') return null;
  if (repeat) {
    const count = Number(repeat[1]) + step;
    tracks.splice(at, 1, ...(count > 0 ? [`repeat(${count},${repeat[2]})`] : []));
  } else tracks.splice(at + (step > 0 ? 1 : 0), step > 0 ? 0 : 1, ...(step > 0 ? [tracks[at]] : []));
  return tracks.length && tracks.some(track => !track.startsWith('[')) ? tracks.join(' ') : null;
}

// Named areas with a column of "." cells more, a row of them more, or the last of either less.
function steppedAreas(areas, axis, step) {
  const rows = [...areas.matchAll(/"([^"]*)"/g)].map(([, row]) => row.trim().split(/\s+/));
  if (step > 0) return (axis === 'col' ? rows.map(row => [...row, '.']) : [...rows, rows[0].map(() => '.')])
    .map(row => `"${row.join(' ')}"`).join(' ');
  const kept = axis === 'col' ? rows.map(row => row.slice(0, -1)) : rows.slice(0, -1);
  const left = new Set(kept.flat()), lost = rows.flat().filter(name => name !== '.' && !left.has(name));
  return lost.length ? null : kept.map(row => `"${row.join(' ')}"`).join(' ');
}

// A declaration's new value written where the winning one is: its class, its rule, its attribute.
function writeOver(grid, winner, property, value, classValue) {
  const { entry } = winner;
  if (entry.origin === 'utility') {
    const classes = grid.classes.split(/\s+/).map(name => (name === entry.cls ? classValue(value) : name));
    return { op: 'attr', path: grid.src, name: 'class', value: classes.join(' ') };
  }
  const set = { [property]: value };
  if (entry.origin === 'rule' && entry.count === 1) return { op: 'rule', rule: entry.rule.index, set };
  return { op: 'style', path: grid.src, set };
}

// The grid whose template holds an axis's tracks: the grid itself, or the one a subgrid takes them from.
export function trackOwner(model, grid, axis) {
  let at = grid;
  const takes = axis === 'col' ? 'cols' : 'rows';
  while (at && at.layout.kind === 'grid' && at.layout.subgrid?.[takes]) at = model.parentOf(at);
  return at?.layout.kind === 'grid' ? at : null;
}

const asClass = (axis, list) => (/^repeat\((\d+), minmax\(0, 1fr\)\)$/.test(list)
  ? `grid-${axis}s-${/\d+/.exec(list)[0]}` : `grid-${axis}s-[${list.replace(/\s+/g, '_')}]`);

// Whether an element stands in the grid's last track on an axis (a step back would leave it out);
// one that spans to the last line (1 / -1) shrinks with the grid.
function lastTrackTaken(model, grid, axis, count) {
  const inside = model.entries.filter(entry => entry.src.startsWith(`${grid.src}.`) && placedByLine(entry, axis)
    && !String(entry.place[axis][1]).startsWith('-'));
  return inside.some(entry => Number(entry.place[axis][0]) + spanOf(entry, axis, count) - 1 >= count);
}

// The edits that add (step 1) or remove (-1) a column or row of a grid, or why they cannot.
export function trackEdits(model, grid, axis, step) {
  const owner = trackOwner(model, grid, axis), element = owner && sourceElement(owner.src);
  if (!element) return { problem: 'No grid holds these tracks.' };
  const cascade = cascadeOf(element, view.parsed, view.state.styles), winner = cascade.winners.get(TEMPLATE[axis]);
  const tracks = axis === 'col' ? 'columns' : 'rows';
  if (!winner) return { problem: `Its ${tracks} come from its content: drop a box past the last one to add one.` };
  const count = tracksOf(model, owner, axis).length;
  const taken = step < 0 && (count <= 1 || lastTrackTaken(model, owner, axis, count));
  if (taken) return { problem: 'A box stands in the last one: move it first.' };
  const list = steppedList(winner.declaration.value, step);
  if (!list) return { problem: 'This template repeats to fill the space: change it in the Styles.' };
  const edits = [writeOver(owner, winner, TEMPLATE[axis], list, value => asClass(axis, value))];
  const areas = cascade.winners.get('grid-template-areas');
  if (areas && areas.declaration.value !== 'none') {
    const value = steppedAreas(areas.declaration.value, axis, step);
    if (!value) return { problem: 'An area would be lost: move what stands in it first.' };
    const asArbitrary = text => `[grid-template-areas:${text.replace(/\s+/g, '_')}]`;
    edits.push(writeOver(owner, areas, 'grid-template-areas', value, asArbitrary));
  }
  return { edits, owner };
}
