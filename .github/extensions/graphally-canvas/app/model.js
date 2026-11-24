// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The laid-out diagram as the canvas knows it: the engine's layout model (each element's box and
// what places it, by its path in the source) and the questions the canvas asks of it.
import { canNest } from './nesting.js';

const UNSEEN = new Set(['script', 'style', 'template']);
// Elements that hold no boxes, and headings, which title a container rather than fill it.
const LEAVES = new Set(['icon', 'img', 'br', 'hr', 'input', 'i', 'b', 'small', 'code', 'svg', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'p']);
const HEADINGS = /^h[1-6]$/;
// Utility classes say how an element looks or where it sits, not what it is.
const UTILITY_NAMES = ['p[xytrbl]?', 'm[xytrbl]?', 'gap', 'w', 'h', 'min', 'max', 'size', 'basis', 'flex', 'grid',
  'col', 'row', 'justify', 'items', 'self', 'content', 'place', 'text', 'font', 'leading', 'tracking', 'rounded',
  'border', 'bg', 'top', 'right', 'bottom', 'left', 'inset', 'z', 'order', 'opacity', 'space', 'aspect', 'outline'];
const DISPLAY_NAMES = 'absolute|relative|block|inline|hidden|contents';
const UTILITY = new RegExp(`[[:]|^-?(${UTILITY_NAMES.join('|')})(-|$)|^(${DISPLAY_NAMES})$`);

const contains = (box, point) => point.x >= box.x && point.x <= box.x + box.w
  && point.y >= box.y && point.y <= box.y + box.h;
const area = box => box.w * box.h;
// The smallest of the elements, the later (deeper) one of two the same size.
const smallest = entries => entries.reduce(
  (best, entry) => (!best || area(entry.box) <= area(best.box) ? entry : best), null);
const isExplicit = line => line !== undefined && line !== 'auto';

const kindsOf = entry => entry.classes.split(/\s+/).filter(name => name && !UTILITY.test(name));

// Two elements of one kind: the same tag, and a class that says what they are in common when the
// dragged one has such a class.
function resembles(one, other) {
  if (one.tag !== other.tag) return false;
  const kinds = kindsOf(other);
  return !kinds.length || kindsOf(one).some(kind => kinds.includes(kind));
}

export class Model {
  constructor(entries) {
    this.entries = entries.filter(entry => !UNSEEN.has(entry.tag));
    this.byPath = new Map(this.entries.map(entry => [entry.src, entry]));
  }

  entry(path) { return this.byPath.get(path) ?? null; }

  withId(id) { return this.entries.find(entry => entry.id === id) ?? null; }

  parentOf(entry) { return entry.parent === null ? null : this.entry(entry.parent); }

  childrenOf(path) { return this.entries.filter(entry => entry.parent === path && area(entry.box) > 0); }

  // Whether the element at `inner` is the one at `outer` or inside it.
  isWithin(inner, outer) { return inner === outer || outer === '' || inner.startsWith(`${outer}.`); }

  // The smallest element under a point: where a click lands.
  at(point) {
    return smallest(this.entries.filter(entry => entry.src && area(entry.box) > 0 && contains(entry.box, point)));
  }

  // What a press grabs: the nearest element, out from where it landed, that its layout moves as a
  // whole (one with an id, or a child of a flex or grid container); a wrapper that carries the
  // grid column for it (a BPMN event with its caption) is grabbed in its place, unless the element
  // has a column of its own.
  movableOf(entry) {
    let grabbed = entry;
    for (let at = entry; at?.src; at = this.parentOf(at)) {
      const kind = this.parentOf(at)?.layout.kind;
      if (at.id || kind === 'flex' || kind === 'grid') {
        grabbed = at;
        break;
      }
    }
    if (isExplicit(grabbed.place?.col?.[0])) return grabbed;
    const wrapper = this.parentOf(grabbed);
    const carriesCell = wrapper?.src && !wrapper.id && this.parentOf(wrapper)?.layout.kind === 'grid';
    return carriesCell && isExplicit(wrapper.place.col[0]) ? wrapper : grabbed;
  }

  // The child of `outer` on the way to `inner`: one level further in, for a click inside a selection.
  stepToward(outer, inner) {
    const rest = inner.src.slice(outer.src ? outer.src.length + 1 : 0).split('.');
    return this.entry(outer.src ? `${outer.src}.${rest[0]}` : rest[0]) ?? inner;
  }

  // The deepest element under a point that can take the dragged one in: not it or inside it.
  holderAt(point, dragged, anywhere = false) {
    const fits = entry => !this.isWithin(entry.src, dragged.src) && contains(entry.box, point)
      && canNest(entry.tag, dragged.tag)
      && (anywhere ? !LEAVES.has(entry.tag) && entry.layout.kind !== 'contents' : this.canHold(entry, dragged));
    return smallest(this.entries.filter(fits));
  }

  // A container takes an element it already holds one like: its own parent, or one with a child
  // of the same tag and kind (a group of nodes takes a node, a list of chips a chip; a node, whose
  // children are an icon and its text, takes none). An empty one, or one with only a heading (a
  // new group), takes anything; a box with only text of its own is no container.
  canHold(entry, dragged) {
    if (entry.layout.kind === 'contents' || LEAVES.has(entry.tag)) return false;
    if (entry.src === dragged.parent) return true;
    const children = this.entries.filter(child => child.parent === entry.src);
    if (entry.src && !entry.text && children.every(child => HEADINGS.test(child.tag))) return true;
    return children.some(child => area(child.box) > 0 && resembles(child, dragged));
  }

  // The element with an id a line would join, for a hit inside a box: the nearest one around the
  // hit, inside the box (a BPMN event inside its wrapper), else the box itself.
  withIdAround(hit, box) {
    for (let at = hit; at?.src; at = this.parentOf(at)) {
      if (at.id) return at;
      if (at === box) break;
    }
    return box;
  }

  // The element after this one among its parent's children, or null for the last.
  nextOf(entry) {
    const siblings = this.childrenOf(entry.parent), index = siblings.indexOf(entry);
    return siblings[index + 1] ?? null;
  }
}
