// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// SVG markup for the figure, written one way: an element from its name and its attributes, in
// the order given. A null, undefined or false value leaves its attribute out. Values are written
// as given, so the caller rounds numbers (fmt) and escapes text.

// A number rounded to a tenth of a pixel, the precision the figure is written at.
export const fmt = value => String(Math.round(value * 10) / 10);

// A number rounded to the given count of decimals, for values finer than a pixel.
export const roundTo = (value, digits) => String(Math.round(value * 10 ** digits) / 10 ** digits);

// Attributes as markup, each with the space before it.
export const attributesOf = attributes => Object.entries(attributes)
  .filter(([, value]) => value != null && value !== false)
  .map(([name, value]) => ` ${name}="${value}"`)
  .join('');

// An opening tag, for a group whose content follows.
export const openTag = (name, attributes = {}) => `<${name}${attributesOf(attributes)}>`;

// A whole element, with its content.
export const svgElement = (name, attributes = {}, content = '') =>
  `${openTag(name, attributes)}${content}</${name}>`;

// The position and size of a box as attributes.
export const boxAttributes = box => ({ x: fmt(box.x), y: fmt(box.y), width: fmt(box.w), height: fmt(box.h) });

// Text as markup can hold it: in an attribute or between tags.
export const escapeXml = text => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pathPoint = point => `${fmt(point.x)},${fmt(point.y)}`;

// The path data of a polyline whose corners are rounded with the given radius (smaller where
// a segment is too short for it): the path of a line with bends.
export function roundedPath(points, radius) {
  let path = `M${pathPoint(points[0])}`;
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1], corner = points[index], after = points[index + 1];
    const lengthIn = Math.hypot(corner.x - before.x, corner.y - before.y);
    const lengthOut = Math.hypot(after.x - corner.x, after.y - corner.y);
    if (lengthIn < 0.01 || lengthOut < 0.01) continue;
    const cut = Math.min(radius, lengthIn / 2, lengthOut / 2);
    const curveStart = {
      x: corner.x - (corner.x - before.x) / lengthIn * cut,
      y: corner.y - (corner.y - before.y) / lengthIn * cut,
    };
    const curveEnd = {
      x: corner.x + (after.x - corner.x) / lengthOut * cut,
      y: corner.y + (after.y - corner.y) / lengthOut * cut,
    };
    path += ` L${pathPoint(curveStart)} Q${pathPoint(corner)} ${pathPoint(curveEnd)}`;
  }
  return `${path} L${pathPoint(points.at(-1))}`;
}
