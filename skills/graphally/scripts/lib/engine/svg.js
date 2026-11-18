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
