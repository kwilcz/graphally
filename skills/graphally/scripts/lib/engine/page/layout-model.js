// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// For an editor (compile's model option): each element the editor stamped with data-src, its
// place in the source tree, with its box on the page and what places it, read from the laid-out
// page before it is removed. Elements a helper made are not in the source, carry no data-src
// and are left out.

const round = value => Math.round(value * 10) / 10;
const pixelsIn = value => (value.match(/-?[\d.]+px/g) || []).map(parseFloat);

function boxOf(element, page) {
  const rect = element.getBoundingClientRect();
  return {
    x: round(rect.left - page.left), y: round(rect.top - page.top), w: round(rect.width), h: round(rect.height),
  };
}

// A grid's named areas, row by row ("." for a cell no area takes), or null.
const areasOf = value => (value === 'none' ? null
  : [...value.matchAll(/"([^"]*)"/g)].map(([, row]) => row.trim().split(/\s+/)));

const edges = (style, side) => parseFloat(style[`border${side}Width`]) + parseFloat(style[`padding${side}`]);

// A grid's tracks and gaps, with its content box (where the first track starts) and how it spreads
// the room its tracks leave (justify-content, align-content); on an axis it takes from its parent
// grid (subgrid), it has no tracks of its own.
function gridOf(style, box) {
  const left = box.x + edges(style, 'Left'), top = box.y + edges(style, 'Top');
  const size = { w: round(box.w - edges(style, 'Left') - edges(style, 'Right')),
    h: round(box.h - edges(style, 'Top') - edges(style, 'Bottom')) };
  const subgrid = {
    cols: style.gridTemplateColumns.startsWith('subgrid'), rows: style.gridTemplateRows.startsWith('subgrid'),
  };
  return {
    kind: 'grid', cols: subgrid.cols ? [] : pixelsIn(style.gridTemplateColumns),
    rows: subgrid.rows ? [] : pixelsIn(style.gridTemplateRows),
    colGap: parseFloat(style.columnGap) || 0, rowGap: parseFloat(style.rowGap) || 0,
    areas: areasOf(style.gridTemplateAreas), subgrid, origin: { x: round(left), y: round(top) }, size,
    spread: { col: style.justifyContent, row: style.alignContent },
  };
}

// How an element lays out its children: in a grid, in a flex row or column, or in normal flow.
function layoutOf(style, box) {
  const { display } = style;
  if (display.includes('grid')) return gridOf(style, box);
  if (display.includes('flex')) return { kind: 'flex', dir: style.flexDirection, wrap: style.flexWrap !== 'nowrap' };
  return { kind: display === 'contents' ? 'contents' : 'flow' };
}

const placeOf = style => ({
  position: style.position,
  col: [style.gridColumnStart, style.gridColumnEnd], row: [style.gridRowStart, style.gridRowEnd],
});

// Whether an element has text of its own (a box named "Send reminder"), not only elements.
const hasText = element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());

function entryOf(element, page) {
  const style = getComputedStyle(element), box = boxOf(element, page);
  return {
    src: element.dataset.src, parent: element.parentElement.closest('[data-src]')?.dataset.src ?? '',
    id: element.id || null, tag: element.localName, classes: element.getAttribute('class') || '',
    text: hasText(element), box, layout: layoutOf(style, box), place: placeOf(style),
  };
}

// The page itself (src ''), then every stamped element in it.
export function layoutModelOf(root) {
  const page = root.getBoundingClientRect(), style = getComputedStyle(root), box = boxOf(root, page);
  const rootEntry = { src: '', parent: null, id: null, tag: 'diagram', classes: '', box, layout: layoutOf(style, box) };
  return [rootEntry, ...[...root.querySelectorAll('[data-src]')].map(element => entryOf(element, page))];
}
