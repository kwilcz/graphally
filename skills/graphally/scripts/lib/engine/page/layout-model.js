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

// A grid's tracks and gaps, from the corner of its content box, where its first track starts.
function gridOf(style, box) {
  const left = box.x + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const top = box.y + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
  return {
    kind: 'grid', cols: pixelsIn(style.gridTemplateColumns), rows: pixelsIn(style.gridTemplateRows),
    colGap: parseFloat(style.columnGap) || 0, rowGap: parseFloat(style.rowGap) || 0,
    areas: style.gridTemplateAreas !== 'none', subgrid: style.gridTemplateColumns.startsWith('subgrid'),
    origin: { x: round(left), y: round(top) },
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

function entryOf(element, page) {
  const style = getComputedStyle(element), box = boxOf(element, page);
  return {
    src: element.dataset.src, parent: element.parentElement.closest('[data-src]')?.dataset.src ?? '',
    id: element.id || null, tag: element.localName, classes: element.getAttribute('class') || '',
    box, layout: layoutOf(style, box), place: placeOf(style),
  };
}

// The page itself (src ''), then every stamped element in it.
export function layoutModelOf(root) {
  const page = root.getBoundingClientRect(), style = getComputedStyle(root), box = boxOf(root, page);
  const rootEntry = { src: '', parent: null, id: null, tag: 'diagram', classes: '', box, layout: layoutOf(style, box) };
  return [rootEntry, ...[...root.querySelectorAll('[data-src]')].map(element => entryOf(element, page))];
}
