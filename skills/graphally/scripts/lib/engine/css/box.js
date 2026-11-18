// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// An element's box as its computed style describes it: borders, corners, content box, shadows.
import { splitTopLevel } from './values.js';

// The dash pattern of a border or outline style, as SVG's stroke-dasharray.
export const DASH_PATTERN = { dashed: '5 4', dotted: '1.5 3' };

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

const LENGTH = /^-?[\d.]+(px)?$/;

// An element's border, side by side (top, right, bottom, left): each side's width, style and
// colour. A side whose style is none has no width. Uniform: all four sides alike and drawn.
export function bordersOf(style) {
  const sides = SIDES.map(side => ({
    width: style[`border${side}Style`] === 'none' ? 0 : parseFloat(style[`border${side}Width`]) || 0,
    style: style[`border${side}Style`],
    color: style[`border${side}Color`],
  }));
  const widths = sides.map(side => side.width);
  return {
    sides,
    widths,
    uniform: widths.every(width => width === widths[0]) && widths[0] > 0,
    drawn: widths.some(Boolean),
  };
}

// The corner radius an element is drawn with: its top-left radius, in pixels or as a share of
// its shorter side, and never more than half the box.
export function cornerRadiusOf(style, box) {
  const value = style.borderTopLeftRadius;
  const shorterSide = Math.min(box.w, box.h);
  const radius = value.endsWith('%') ? shorterSide * parseFloat(value) / 100 : parseFloat(value) || 0;
  return Math.min(radius, box.w / 2, box.h / 2);
}

// The box inside an element's border and padding, where its content is drawn.
export function contentBoxOf(style, box) {
  const pixels = property => parseFloat(style[property]) || 0;
  const left = box.x + pixels('borderLeftWidth') + pixels('paddingLeft');
  const top = box.y + pixels('borderTopWidth') + pixels('paddingTop');
  return {
    x: left,
    y: top,
    w: box.w - left + box.x - pixels('borderRightWidth') - pixels('paddingRight'),
    h: box.h - top + box.y - pixels('borderBottomWidth') - pixels('paddingBottom'),
  };
}

// A computed box-shadow as a list in painting order: the last in the CSS list is painted first.
// Inset shadows are left out: they paint inside the box, under its content, and the figure has
// no layer there.
export function boxShadows(boxShadow) {
  if (!boxShadow || boxShadow === 'none') return [];
  return splitTopLevel(boxShadow).map(shadow => {
    const words = splitTopLevel(shadow, ' ');
    if (words.includes('inset')) return null;
    const color = words.find(word => !LENGTH.test(word)) || 'rgb(0, 0, 0)';
    const [x = 0, y = 0, blur = 0, spread = 0] = words.filter(word => LENGTH.test(word)).map(parseFloat);
    return { color, x, y, blur, spread };
  }).filter(Boolean).reverse();
}

// A length of a clip-path point in pixels: px, a percentage of the box's side, or calc() of them.
function lengthIn(value, full) {
  const expression = value
    .replace(/^calc\((.*)\)$/, '$1')
    .replace(/(-?[\d.]+)%/g, (_, number) => `(${number}*${full}/100)`)
    .replace(/(-?[\d.]+)px/g, '($1)');
  return /^[\d.\s+\-*/()]+$/.test(expression) ? Function(`return ${expression}`)() : 0;
}

// clip-path: polygon(…) as points on the page, resolved against the element's own box; null for
// any other clip-path.
export function polygonOf(clipPath, box) {
  const polygon = /^polygon\((.*)\)$/.exec(clipPath || '');
  if (!polygon) return null;
  return polygon[1].split(/,(?![^(]*\))/).map(point => {
    const [x, y] = point.trim().match(/calc\([^)]*\)|\S+/g);
    return { x: box.x + lengthIn(x, box.w), y: box.y + lengthIn(y, box.h) };
  });
}
