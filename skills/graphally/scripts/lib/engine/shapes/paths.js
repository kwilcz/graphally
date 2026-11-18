// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The path data of the shapes, each over a box { x, y, w, h }.
import { fmt } from '../svg.js';

// A closed polygon through [x, y] points.
export const polygon = points => `M${points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' L')} Z`;

// A circle as two half arcs. The radius is half the rounded chord, never rounded on its own: a
// radius a hair longer than half the chord turns each large arc past a half and draws an oval.
const halfChord = (from, to) => String(Math.round((Number(to) - Number(from)) * 50) / 100);
export function circlePath(cx, cy, r) {
  const left = fmt(cx - r), right = fmt(cx + r), y = fmt(cy), radius = halfChord(left, right);
  return `M${left},${y} A${radius},${radius} 0 1 1 ${right},${y} A${radius},${radius} 0 1 1 ${left},${y} Z`;
}

// The largest circle centred in the box.
export const circleIn = ({ x, y, w, h }) => circlePath(x + w / 2, y + h / 2, Math.min(w, h) / 2);

export function ellipsePath({ x, y, w, h }) {
  const left = fmt(x), right = fmt(x + w), middle = fmt(y + h / 2);
  const arc = `A${halfChord(left, right)},${fmt(h / 2)} 0 1 1`;
  return `M${left},${middle} ${arc} ${right},${middle} ${arc} ${left},${middle} Z`;
}

export const diamondPath = ({ x, y, w, h }) =>
  polygon([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]);

// A box with its corners rounded by radius (no more than half a side).
export function roundRect({ x, y, w, h }, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  return `M${fmt(x + r)},${fmt(y)} H${fmt(x + w - r)} Q${fmt(x + w)},${fmt(y)} ${fmt(x + w)},${fmt(y + r)}`
    + ` V${fmt(y + h - r)} Q${fmt(x + w)},${fmt(y + h)} ${fmt(x + w - r)},${fmt(y + h)}`
    + ` H${fmt(x + r)} Q${fmt(x)},${fmt(y + h)} ${fmt(x)},${fmt(y + h - r)}`
    + ` V${fmt(y + r)} Q${fmt(x)},${fmt(y)} ${fmt(x + r)},${fmt(y)} Z`;
}

// A box with half-round ends on its shorter sides.
export function stadiumPath({ x, y, w, h }) {
  const r = Math.min(w, h) / 2, arc = `A${fmt(r)},${fmt(r)} 0 0 1`;
  if (w >= h) {
    return `M${fmt(x + r)},${fmt(y)} H${fmt(x + w - r)} ${arc} ${fmt(x + w - r)},${fmt(y + h)}`
      + ` H${fmt(x + r)} ${arc} ${fmt(x + r)},${fmt(y)} Z`;
  }
  return `M${fmt(x)},${fmt(y + r)} ${arc} ${fmt(x + w)},${fmt(y + r)}`
    + ` V${fmt(y + h - r)} ${arc} ${fmt(x)},${fmt(y + h - r)} Z`;
}

// A sheet whose bottom edge waves.
export function documentPath({ x, y, w, h }) {
  const wave = Math.min(h * 0.12, 10);
  return `M${fmt(x)},${fmt(y)} H${fmt(x + w)} V${fmt(y + h - wave)}`
    + ` C${fmt(x + w * 0.75)},${fmt(y + h - 3 * wave)} ${fmt(x + w * 0.25)},${fmt(y + h + wave)}`
    + ` ${fmt(x)},${fmt(y + h - wave)} Z`;
}

// A block arrow, drawn along u (its length) and v (its width), then turned to its direction.
// Upright arrows hold their text across the shaft: a wider shaft, a shorter head.
export const arrowPath = direction => ({ x, y, w, h }) => {
  const upright = direction === 'up' || direction === 'down';
  const length = upright ? h : w, width = upright ? w : h;
  const shaft = width * (upright ? 0.64 : 0.5), side = (width - shaft) / 2;
  const head = Math.min(width * (upright ? 0.5 : 0.9), length * (upright ? 0.38 : 0.45));
  const points = [
    [0, side], [length - head, side], [length - head, 0], [length, width / 2],
    [length - head, width], [length - head, side + shaft], [0, side + shaft],
  ];
  const turned = ([u, v]) => {
    if (direction === 'right') return [x + u, y + v];
    if (direction === 'left') return [x + length - u, y + v];
    return direction === 'down' ? [x + v, y + u] : [x + v, y + length - u];
  };
  return polygon(points.map(turned));
};
