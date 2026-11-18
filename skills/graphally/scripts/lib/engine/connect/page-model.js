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

const PATH_COMMAND = /([MLQCAZ])\s*(?:(-?[\d.]+),(-?[\d.]+))?/g;

// A line from a point to the next, when it runs straight across or down.
function straightRun({ x: x1, y: y1 }, point) {
  if (Math.abs(point.x - x1) < 0.5) return { x1, y1, x2: x1, y2: point.y };
  if (Math.abs(point.y - y1) < 0.5) return { x1, y1, x2: point.x, y2: y1 };
  return null;
}

// The straight runs of a path's L commands; only M and L end where their first pair says.
function runsOfPath(path) {
  const runs = [];
  let previous = null;
  for (const [, command, x, y] of path.matchAll(PATH_COMMAND)) {
    const point = command === 'M' || command === 'L' ? { x: +x, y: +y } : null;
    const run = point && command === 'L' && previous ? straightRun(previous, point) : null;
    if (run) runs.push(run);
    previous = point;
  }
  return runs;
}

// The script's straight lines (gate lines, arrows) are taken: connections avoid running on them.
const takenRuns = drawings => drawings.filter(drawing => drawing.kind === 'path').flatMap(drawing => runsOfPath(drawing.path));

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

// What each box is to the router: a group when it holds boxes, else a node; or part of the box
// it sits in.
class BoxRoles {
  constructor(boxes, calls) {
    this.boxes = boxes;
    this.holdsBoxes = new Set(boxes.filter(entry => !this.isDecor(entry)).map(entry => entry.parent).filter(Boolean));
    this.lineEnds = new Set(calls.flatMap(call => [call.from, call.to]));
  }

  // An icon without an id is part of the box it sits in: that box stays one solid card.
  isDecor({ element }) { return element.tagName === 'ICON' && !element.id; }

  isGroup(entry) { return this.holdsBoxes.has(entry); }

  // A full-width strip without an id (a section's header bar, a divider) is decoration: lines
  // may cross it; its text still blocks them.
  isStrip(entry) {
    return !entry.element.id && !this.isGroup(entry) && entry.parent
      && Math.abs(entry.box.w - entry.parent.box.w) <= 6 && entry.box.h <= 48;
  }

  // So is a box painted behind boxes it does not hold in the HTML (a lane's or a band's
  // background in the same grid cells): it would otherwise wall in everything on top of it.
  isBackdrop(entry) {
    const { boxes } = this;
    return !this.isGroup(entry) && !this.lineEnds.has(entry.element)
      && boxes.some((other, index) => index > boxes.indexOf(entry) && holds(entry.box, other.box));
  }

  isPartOfParent(entry) {
    return this.isStrip(entry) || this.isBackdrop(entry) || (this.isDecor(entry) && entry.parent && !this.isGroup(entry.parent));
  }

  // A row of a stack (a BPMN lane, a band of a phase chart) is a band to cross, not a box to
  // keep out of: a line between two rows runs straight over the rows between them. A row spans
  // its parent, a row of the same width lies above or below it, and it has no frame of its own
  // (a framed box, a subnet in a network, is a container whatever its width).
  isRow(entry) {
    return this.isGroup(entry) && !this.lineEnds.has(entry.element) && entry.parent
      && entry.box.w >= entry.parent.box.w * 0.9 && !isFramed(entry.element) && this.hasRowBeside(entry);
  }

  hasRowBeside(entry) {
    return this.boxes.some(other => other !== entry && other.parent === entry.parent && this.isGroup(other)
      && near(other.box.x, entry.box.x) && near(other.box.w, entry.box.w));
  }
}

const insideNode = (text, rect) => text.x >= rect.x - 1 && text.y >= rect.y - 1
  && text.x + text.w <= rect.x + rect.w + 1 && text.y + text.h <= rect.y + rect.h + 1;

class PageModel {
  constructor({ boxes, drawings, calls, problems, previous, size }) {
    this.rootGroup = { id: '__root', style: 'root', parent: null, depth: -1 };
    // previous: the layout of the last render; a line keeps the sides it used there (soft).
    this.model = { nodes: new Map(), groups: new Map([['__root', this.rootGroup]]), edges: [], problems, previous: previous || null };
    // The author set the gaps; a 6px clearance lets lines use any gap wider than 12px.
    this.geometry = { nodes: new Map(), groups: new Map(), extraObstacles: [], ...size, nodePad: 6, taken: takenRuns(drawings) };
    this.roles = new BoxRoles(boxes, calls);
    this.keyOf = keysOf(boxes);
    this.objectOf = new Map();
  }

  // The router's object for a box: its own, or its parent's when it is part of it.
  ensure(entry) {
    if (!entry) return this.rootGroup;
    if (!this.objectOf.has(entry)) this.objectOf.set(entry, this.roles.isPartOfParent(entry) ? this.ensure(entry.parent) : this.add(entry));
    return this.objectOf.get(entry);
  }

  add(entry) {
    const parent = this.ensure(entry.parent), id = this.keyOf.get(entry), box = wholePixels(entry.box);
    if (!this.roles.isGroup(entry)) {
      const node = { id, parent };
      this.model.nodes.set(id, node);
      this.geometry.nodes.set(id, { ...box, node, round: entry.round });
      return node;
    }
    const group = { id, style: entry.plain || !entry.painted ? 'plain' : 'box', parent, depth: parent.depth + 1 };
    this.model.groups.set(id, group);
    this.geometry.groups.set(id, { ...box, group, ...(this.roles.isRow(entry) ? { lane: true } : {}) });
    return group;
  }

  addTextObstacles(texts) {
    const nodes = [...this.geometry.nodes.values()];
    for (const text of texts.filter(each => !nodes.some(rect => insideNode(each, rect)))) {
      this.geometry.extraObstacles.push({ id: `text "${excerpt(text.text)}"`, ...wholePixels(text) });
    }
  }
}

export function pageModel(page) {
  const built = new PageModel(page);
  page.boxes.forEach(entry => built.ensure(entry));
  built.addTextObstacles(page.texts);
  return { model: built.model, geometry: built.geometry, keyOf: built.keyOf, rootGroup: built.rootGroup };
}
