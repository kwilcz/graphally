// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Geometry by name: the points and boxes the script works with. Nobody writes a coordinate.
import { closestName } from '../shared/messages.js';

// A selector, as opposed to a bare id.
const SELECTOR = /^[#.[]|[\s>:]/;

// A point the script can move from: p.down(10), p.right(20), p.move(dx, dy).
export const pointAt = (x, y) => ({
  x, y,
  down: distance => pointAt(x, y + distance),
  up: distance => pointAt(x, y - distance),
  left: distance => pointAt(x - distance, y),
  right: distance => pointAt(x + distance, y),
  move: (dx, dy) => pointAt(x + dx, y + dy),
});

// An element's box with its named points: center, the middle of each side, the corners, and
// at(side, fraction) for any point along a side.
export function boxGeometry(element, { x, y, w, h }) {
  const centerX = x + w / 2, centerY = y + h / 2;
  const at = (side, fraction = 0.5) => {
    if (side === 'top') return pointAt(x + w * fraction, y);
    if (side === 'bottom') return pointAt(x + w * fraction, y + h);
    if (side === 'left') return pointAt(x, y + h * fraction);
    return pointAt(x + w, y + h * fraction);
  };
  return {
    el: element, id: element.id, x, y, w, h,
    center: pointAt(centerX, centerY),
    top: pointAt(centerX, y),
    bottom: pointAt(centerX, y + h),
    left: pointAt(x, centerY),
    right: pointAt(x + w, centerY),
    topLeft: pointAt(x, y),
    topRight: pointAt(x + w, y),
    bottomLeft: pointAt(x, y + h),
    bottomRight: pointAt(x + w, y + h),
    at,
  };
}

// The point an animation turns and scales about: keywords and percentages of the target's box
// ('center', '50% 20%', 'left top'), px from its top left, or a point or element.
function originAt(words, box) {
  if (/^(top|bottom)$/.test(words[0])) words.reverse();
  const along = (word = 'center', length) => {
    if (/%$/.test(word)) return length * parseFloat(word) / 100;
    if (/px$/.test(word)) return parseFloat(word);
    return length * ({ left: 0, top: 0, right: 1, bottom: 1 }[word] ?? 0.5);
  };
  return pointAt(box.x + along(words[0], box.w), box.y + along(words[1], box.h));
}

// The box a drawn mark covers, for an animation's origin.
function markBox(mark) {
  const points = mark.points || mark.ends;
  if (points) {
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  const defaultSize = { text: 0, gate: 30, shape: 36 }[mark.kind] ?? 24;
  const size = mark.kind === 'text' ? 0 : mark.options.size || defaultSize;
  const w = mark.options.w || size, h = mark.options.h || (mark.options.w ? w : size);
  return { x: mark.at.x - w / 2, y: mark.at.y - h / 2, w, h };
}

// What the script names, made geometry: boxes by reference, points by box or point.
export function createGeometry(figure) {
  const { root } = figure;
  const geometryOf = element => boxGeometry(element, figure.boxOf(element));
  const ids = () => [...root.querySelectorAll('[id]')].map(element => element.id);
  // Every box a reference names: a box the script already has, a list, an id or a selector.
  const find = reference => {
    if (reference && reference.el) return [reference];
    if (Array.isArray(reference)) return reference.flatMap(find);
    const name = String(reference);
    const found = [...root.querySelectorAll(SELECTOR.test(name) ? name : `#${CSS.escape(name)}`)];
    if (!found.length) {
      const suggestion = closestName(name, ids());
      throw new Error(`no element "${name}"${suggestion ? `; did you mean "${suggestion}"?` : ''}`);
    }
    return found.map(geometryOf);
  };
  // A box (element, id or selector) or a point. Anything else is an error with the script's
  // line, not a line drawn to NaN.
  const spot = reference => {
    if (reference && reference.el) return reference;
    if (typeof reference === 'string' || Array.isArray(reference)) return find(reference)[0];
    if (reference && Number.isFinite(reference.x) && Number.isFinite(reference.y)) return reference;
    const shown = typeof reference === 'object' ? JSON.stringify(reference) : String(reference);
    throw new Error(`${shown} is not an element or a point`);
  };
  const point = reference => { const found = spot(reference); return found.el ? found.center : found; };
  // Two boxes: their facing sides. Points: as given.
  const facingEnds = (fromRef, toRef) => {
    const from = spot(fromRef), to = spot(toRef);
    if (!from.el || !to.el) return [from.el ? from.center : from, to.el ? to.center : to];
    const dx = to.center.x - from.center.x, dy = to.center.y - from.center.y;
    const sideways = Math.abs(dx) * from.h >= Math.abs(dy) * from.w;
    if (sideways) return dx > 0 ? [from.right, to.left] : [from.left, to.right];
    return dy > 0 ? [from.bottom, to.top] : [from.top, to.bottom];
  };
  const originOf = (value, box) => {
    if (value != null && typeof value === 'object') return point(value);
    return originAt(String(value ?? 'center').trim().split(/\s+/), box);
  };
  return { geometryOf, find, spot, point, facingEnds, originOf, markBox };
}
