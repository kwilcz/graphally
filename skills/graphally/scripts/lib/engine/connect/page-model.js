// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The page's boxes as route.js sees them: a box that holds other boxes is a group (a line may
// cross into it), the rest are nodes (lines go round them). Text that sits in no node is an
// obstacle too, so lines do not run through headings or free text.
import { excerpt } from '../shared/messages.js';

// Whole pixels: the router's grid is rounded, and a fractional box edge (a 1fr column) rounds
// inside its own box and blocks every port on that side.
function wholePixels(rect) {
  const x = Math.round(rect.x), y = Math.round(rect.y);
  return { x, y, w: Math.round(rect.x + rect.w) - x, h: Math.round(rect.y + rect.h) - y };
}

const near = (a, b) => Math.abs(a - b) <= 2;
const holds = (outer, inner) => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5
  && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5;
const isFramed = element => {
  const style = getComputedStyle(element);
  return ['Top', 'Right', 'Bottom', 'Left']
    .every(side => style[`border${side}Style`] !== 'none' && parseFloat(style[`border${side}Width`]) > 0);
};

// The script's straight lines (gate lines, arrows) are taken: connections avoid running on them.
function takenRuns(drawings) {
  const taken = [];
  for (const drawing of drawings) {
    if (drawing.kind !== 'path') continue;
    let previous = null;
    for (const [, command, x, y] of drawing.path.matchAll(/([MLQCAZ])\s*(?:(-?[\d.]+),(-?[\d.]+))?/g)) {
      // Only M and L end where their first pair says.
      const point = command === 'M' || command === 'L' ? { x: +x, y: +y } : null;
      if (point && command === 'L' && previous) {
        const { x: x1, y: y1 } = previous;
        if (Math.abs(point.x - x1) < 0.5) taken.push({ x1, y1, x2: x1, y2: point.y });
        else if (Math.abs(point.y - y1) < 0.5) taken.push({ x1, y1, x2: point.x, y2: y1 });
      }
      previous = point;
    }
  }
  return taken;
}

// Each box's name for the router: its id, else its tag and classes and a number (div.lane@2).
function keysOf(boxes) {
  const keys = new Map();
  let unnamed = 0;
  for (const entry of boxes) {
    const { element } = entry;
    const classes = [...element.classList].map(name => `.${name}`).join('');
    keys.set(entry, element.id || `${element.tagName.toLowerCase()}${classes}@${unnamed++}`);
  }
  return keys;
}

export function pageModel({ boxes, texts, drawings, calls, problems, previous, size }) {
  const rootGroup = { id: '__root', kind: 'group', style: 'root', children: [], parent: null, depth: -1 };
  // previous: the layout of the last render; a line keeps the sides it used there (soft).
  const model = {
    nodes: new Map(), groups: new Map(), edges: [], problems, previous: previous || null, attrs: {},
  };
  model.groups.set('__root', rootGroup);
  // The author set the gaps; a 6px clearance lets lines use any gap wider than 12px.
  const geometry = {
    nodes: new Map(), groups: new Map(), extraObstacles: [], title: null, legend: null,
    width: size.width, height: size.height, nodePad: 6,
  };
  geometry.taken = takenRuns(drawings);
  // An icon without an id is part of the box it sits in: that box stays one solid card.
  const isDecor = entry => entry.element.tagName === 'ICON' && !entry.element.id;
  const parents = boxes.filter(entry => !isDecor(entry)).map(entry => entry.parent);
  const holdsBoxes = new Set(parents.filter(Boolean));
  const keyOf = keysOf(boxes);
  const lineEnds = new Set(calls.flatMap(call => [call.from, call.to]));
  // A full-width strip without an id (a section's header bar, a divider) is decoration: lines
  // may cross it; its text still blocks them.
  const isStrip = entry => !entry.element.id && !holdsBoxes.has(entry) && entry.parent
    && Math.abs(entry.box.w - entry.parent.box.w) <= 6 && entry.box.h <= 48;
  // So is a box painted behind boxes it does not hold in the HTML (a lane's or a band's
  // background in the same grid cells): it would otherwise wall in everything on top of it.
  const isBackdrop = entry => !holdsBoxes.has(entry) && !lineEnds.has(entry.element)
    && boxes.some((other, index) => index > boxes.indexOf(entry) && holds(entry.box, other.box));
  // A row of a stack (a BPMN lane, a band of a phase chart) is a band to cross, not a box to
  // keep out of: a line between two rows runs straight over the rows between them. A row spans
  // its parent, a row of the same width lies above or below it, and it has no frame of its own
  // (a framed box, a subnet in a network, is a container whatever its width).
  const isRow = entry => holdsBoxes.has(entry) && !lineEnds.has(entry.element) && entry.parent
    && entry.box.w >= entry.parent.box.w * 0.9 && !isFramed(entry.element)
    && boxes.some(other => other !== entry && other.parent === entry.parent && holdsBoxes.has(other)
      && near(other.box.x, entry.box.x) && near(other.box.w, entry.box.w));
  const isPartOfParent = entry => isStrip(entry) || isBackdrop(entry)
    || (isDecor(entry) && entry.parent && !holdsBoxes.has(entry.parent));
  const objectOf = new Map();
  const ensure = entry => {
    if (!entry) return rootGroup;
    if (objectOf.has(entry)) return objectOf.get(entry);
    if (isPartOfParent(entry)) {
      const parent = ensure(entry.parent);
      objectOf.set(entry, parent);
      return parent;
    }
    const parent = ensure(entry.parent), key = keyOf.get(entry), isGroup = holdsBoxes.has(entry);
    const style = entry.plain || !entry.painted ? 'plain' : 'box';
    const object = isGroup
      ? { id: key, kind: 'group', style, children: [], parent, depth: parent.depth + 1 }
      : { id: key, kind: 'node', parent, shape: '' };
    objectOf.set(entry, object);
    (isGroup ? model.groups : model.nodes).set(key, object);
    parent.children?.push(object);
    const lane = isRow(entry) ? { lane: true } : {};
    if (isGroup) geometry.groups.set(key, { ...wholePixels(entry.box), group: object, ...lane });
    else geometry.nodes.set(key, { ...wholePixels(entry.box), node: object, round: entry.round });
    return object;
  };
  boxes.forEach(ensure);
  const inNode = text => [...geometry.nodes.values()].some(rect =>
    text.x >= rect.x - 1 && text.y >= rect.y - 1 && text.x + text.w <= rect.x + rect.w + 1
    && text.y + text.h <= rect.y + rect.h + 1);
  for (const text of texts) {
    if (inNode(text)) continue;
    geometry.extraObstacles.push({ id: `text "${excerpt(text.text)}"`, ...wholePixels(text) });
  }
  return { model, geometry, keyOf, rootGroup };
}
