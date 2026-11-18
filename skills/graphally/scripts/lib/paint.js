// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// CSS that component styles lean on, read from the computed style so the page can draw it as
// SVG: linear gradients, box shadows and transforms. ::before and ::after are turned into real
// elements before the page is read, so the walk sees their boxes like any other.

const COLOR = /^(?:(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)|#[\da-f]+|[a-z]+)$/i;
const LENGTH = /^-?[\d.]+(px)?$/;
const RADIANS_PER = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI, grad: Math.PI / 200 };

// Splits a CSS list at its top-level separators, leaving those inside parentheses alone:
// "rgb(1, 2, 3) 0px, red 4px" is two items at commas, and "rgb(1, 2, 3) 0px" two at spaces.
export function splitTopLevel(list, separator = ',') {
  const items = [];
  let depth = 0, current = '';
  const isSeparator = character => (separator === ' ' ? /\s/.test(character) : character === separator);
  for (const character of list) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (depth === 0 && isSeparator(character)) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

// A colour as SVG wants it: an opaque colour and its opacity apart, since not every SVG reader
// takes rgba() in a fill.
export function colorAndOpacity(color) {
  const rgba = /^rgba\(([^,]+),([^,]+),([^,]+),\s*([\d.]+)\)$/.exec(color || '');
  if (!rgba) return [color, 1];
  const [red, green, blue, alpha] = rgba.slice(1).map(part => part.trim());
  return [`rgb(${red}, ${green}, ${blue})`, Number(alpha)];
}

// The direction a linear-gradient() runs in, as a unit vector (x right, y down).
function directionOf(args, box) {
  const angle = /^(-?[\d.]+)(deg|rad|turn|grad)$/.exec(args[0]);
  if (angle) {
    args.shift();
    const radians = Number(angle[1]) * RADIANS_PER[angle[2]];
    return { x: Math.sin(radians), y: -Math.cos(radians) };
  }
  if (!args[0].startsWith('to ')) return { x: 0, y: 1 };                 // the default: to bottom
  const keyword = args.shift();
  const horizontal = /right/.test(keyword) ? 1 : /left/.test(keyword) ? -1 : 0;
  const vertical = /bottom/.test(keyword) ? 1 : /top/.test(keyword) ? -1 : 0;
  // Towards a corner, the line is square to the diagonal joining the other two corners.
  const x = horizontal && vertical ? horizontal * box.h : horizontal;
  const y = horizontal && vertical ? vertical * box.w : vertical;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

// The colour stops of a linear-gradient(), each at an offset along the gradient line (0 to 1).
// A stop with two positions is two stops; a stop without one shares the room between its
// neighbours; no stop sits before the one ahead of it.
function stopsOf(args, lineLength) {
  const stops = [];
  for (const arg of args) {
    const words = splitTopLevel(arg, ' '), color = words.shift();
    if (!COLOR.test(color)) continue;                                     // a colour hint: the curve is left to the browser
    const offsets = words.map(position => (position.endsWith('%') ? parseFloat(position) / 100 : parseFloat(position) / lineLength));
    if (!offsets.length) stops.push({ color, at: null });
    for (const at of offsets) stops.push({ color, at });
  }
  if (stops.length < 2) return null;
  stops[0].at ??= 0;
  stops.at(-1).at ??= 1;
  for (let index = 1; index < stops.length; index++) {
    if (stops[index].at != null) continue;
    let next = index;
    while (stops[next].at == null) next++;
    const from = stops[index - 1].at, step = (stops[next].at - from) / (next - index + 1);
    for (let missing = index; missing < next; missing++) stops[missing].at = from + step * (missing - index + 1);
  }
  for (let index = 1; index < stops.length; index++) stops[index].at = Math.max(stops[index].at, stops[index - 1].at);
  return stops;
}

// The first linear-gradient() of a computed background-image, laid on a box: the line it runs
// along and its stops. As in CSS, the line runs through the box's centre, just long enough
// for its ends to reach the corners furthest along it.
export function linearGradient(backgroundImage, box) {
  const layer = splitTopLevel(backgroundImage || '').find(candidate => /^linear-gradient\(/.test(candidate));
  if (!layer) return null;
  const args = splitTopLevel(layer.slice(layer.indexOf('(') + 1, -1));
  const direction = directionOf(args, box);
  const lineLength = Math.abs(box.w * direction.x) + Math.abs(box.h * direction.y);
  const stops = stopsOf(args, lineLength);
  if (!stops) return null;
  const centreX = box.x + box.w / 2, centreY = box.y + box.h / 2, half = lineLength / 2;
  return { x1: centreX - direction.x * half, y1: centreY - direction.y * half, x2: centreX + direction.x * half, y2: centreY + direction.y * half, stops };
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

// The element's rotate, scale and transform as one matrix, or null when together they only
// move it: the browser's boxes already show a move (translate, nudge), but not a turn.
export function turnMatrixOf(style) {
  const parts = [
    style.rotate !== 'none' && `rotate(${style.rotate})`,
    style.scale !== 'none' && `scale(${style.scale.split(' ').join(',')})`,
    style.transform !== 'none' && style.transform,
  ].filter(Boolean);
  if (!parts.length) return null;
  try {
    const matrix = new DOMMatrix(parts.join(' '));
    const linearChange = Math.abs(matrix.a - 1) + Math.abs(matrix.b) + Math.abs(matrix.c) + Math.abs(matrix.d - 1);
    return linearChange < 1e-6 ? null : matrix;
  } catch {
    return null;                                                          // a 3D rotate the matrix cannot hold
  }
}

// The text of a computed content value: its strings, with CSS escapes, and attr(name) read
// from the element (content: attr(data-step) numbers a list from its markup).
function contentText(content, element) {
  const parts = content.matchAll(/"((?:[^"\\]|\\.)*)"|attr\(\s*([\w-]+)\s*\)/g);
  return [...parts].map(([, quoted, attribute]) => {
    if (attribute) return element.getAttribute(attribute) || '';
    return quoted
      .replace(/\\([\da-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1');
  }).join('');
}

// ::before and ::after have no box the page can read, so each becomes a real element: a
// <g-pseudo> with the pseudo-element's computed style and text, in its place among the
// element's children. The pseudo-elements themselves are then switched off.
export function materializePseudo(root) {
  const replacements = [];
  for (const element of [...root.querySelectorAll('*')]) {
    if (!(element instanceof HTMLElement) || /^(ICON|IMG|SVG|STYLE|SCRIPT|G-PSEUDO)$/i.test(element.tagName)) continue;
    for (const which of ['before', 'after']) {
      const style = getComputedStyle(element, `::${which}`);
      if (style.content === 'none' || style.content === 'normal' || style.display === 'none') continue;
      const stand = document.createElement('g-pseudo');
      for (const property of style) {
        if (property === 'content' || property.startsWith('--') || /^(animation|transition)/.test(property)) continue;
        stand.style.setProperty(property, style.getPropertyValue(property));
      }
      stand.textContent = contentText(style.content, element);
      replacements.push({ element, which, stand });
    }
  }
  for (const { element, which, stand } of replacements) {
    element.setAttribute(`data-g-${which}`, '');
    if (which === 'before') element.prepend(stand);
    else element.append(stand);
  }
  const switchOff = document.createElement('style');
  switchOff.textContent = '[data-g-before]::before, [data-g-after]::after { content: none !important; }';
  root.prepend(switchOff);
}
