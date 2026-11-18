// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// CSS that component styles lean on, read from the computed style so the page can draw it as
// SVG: linear gradients, box shadows and transforms. ::before and ::after are turned into real
// elements before the page is read, so the walk sees their boxes like any other.

// The dash pattern of a border or outline style, as SVG's stroke-dasharray.
export const DASH_PATTERN = { dashed: '5 4', dotted: '1.5 3' };

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
const COLOR = /^(?:(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)|#[\da-f]+|[a-z]+)$/i;
const LENGTH = /^-?[\d.]+(px)?$/;
const SKIPPED_TAGS = /^(ICON|IMG|SVG|STYLE|SCRIPT|G-PSEUDO)$/i;
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
    // A bare position is a colour hint, which bends the blend between two stops: left out.
    if (!COLOR.test(color)) continue;
    const offsetOf = position => parseFloat(position) / (position.endsWith('%') ? 100 : lineLength);
    const offsets = words.map(offsetOf);
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
    for (let missing = index; missing < next; missing++) {
      stops[missing].at = from + step * (missing - index + 1);
    }
  }
  for (let index = 1; index < stops.length; index++) {
    stops[index].at = Math.max(stops[index].at, stops[index - 1].at);
  }
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
  return {
    x1: centreX - direction.x * half,
    y1: centreY - direction.y * half,
    x2: centreX + direction.x * half,
    y2: centreY + direction.y * half,
    stops,
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
    // How far the matrix's linear part is from the identity: nothing means only a move.
    const linearPart = [matrix.a - 1, matrix.b, matrix.c, matrix.d - 1];
    const change = linearPart.reduce((sum, value) => sum + Math.abs(value), 0);
    return change < 1e-6 ? null : matrix;
  } catch {
    // A rotate about a 3D axis, which a 2D matrix cannot hold.
    return null;
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

// The properties a stand-in takes over: all but content (its text is set apart), custom
// properties and animations, which would replay on the stand-in.
const copied = property =>
  property !== 'content' && !property.startsWith('--') && !/^(animation|transition)/.test(property);

// ::before and ::after have no box the page can read, so each becomes a real element: a
// <g-pseudo> with the pseudo-element's computed style and text, in its place among the
// element's children. The pseudo-elements themselves are then switched off.
export function materializePseudo(root) {
  const replacements = [];
  for (const element of [...root.querySelectorAll('*')]) {
    if (!(element instanceof HTMLElement) || SKIPPED_TAGS.test(element.tagName)) continue;
    for (const which of ['before', 'after']) {
      const style = getComputedStyle(element, `::${which}`);
      if (style.content === 'none' || style.content === 'normal' || style.display === 'none') continue;
      const stand = document.createElement('g-pseudo');
      for (const property of style) {
        if (!copied(property)) continue;
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
