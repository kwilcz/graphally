// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// linear-gradient(): the line a gradient runs along and its colour stops, laid on a box.
import { splitTopLevel } from './values.js';

const COLOR = /^(?:(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)|#[\da-f]+|[a-z]+)$/i;

const RADIANS_PER = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI, grad: Math.PI / 200 };

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

// One argument's stops: a stop with two positions is two stops, one without a position is one
// whose offset is filled in later. A bare position is a colour hint, which bends the blend
// between two stops: left out.
function argumentStops(arg, lineLength) {
  const words = splitTopLevel(arg, ' '), color = words.shift();
  if (!COLOR.test(color)) return [];
  const offsetOf = position => parseFloat(position) / (position.endsWith('%') ? 100 : lineLength);
  return words.length ? words.map(position => ({ color, at: offsetOf(position) })) : [{ color, at: null }];
}

// Stops without an offset share the room between their neighbours evenly.
function fillOffsets(stops, index) {
  let next = index;
  while (stops[next].at == null) next++;
  const from = stops[index - 1].at, step = (stops[next].at - from) / (next - index + 1);
  for (let missing = index; missing < next; missing++) stops[missing].at = from + step * (missing - index + 1);
}

// The colour stops of a linear-gradient(), each at an offset along the gradient line (0 to 1);
// no stop sits before the one ahead of it.
function stopsOf(args, lineLength) {
  const stops = args.flatMap(arg => argumentStops(arg, lineLength));
  if (stops.length < 2) return null;
  stops[0].at ??= 0;
  stops.at(-1).at ??= 1;
  for (let index = 1; index < stops.length; index++) if (stops[index].at == null) fillOffsets(stops, index);
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
  return {
    x1: centreX - direction.x * half,
    y1: centreY - direction.y * half,
    x2: centreX + direction.x * half,
    y2: centreY + direction.y * half,
    stops,
  };
}
