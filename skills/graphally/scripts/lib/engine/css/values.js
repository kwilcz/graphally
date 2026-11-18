// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// CSS values as the computed style gives them, taken apart: lists, and colours with alpha.

// Splits a CSS list at its top-level separators, leaving those inside parentheses alone:
// "rgb(1, 2, 3) 0px, red 4px" is two items at commas, and "rgb(1, 2, 3) 0px" two at spaces.
export function splitTopLevel(list, separator = ',') {
  const items = [];
  let depth = 0, current = '';
  const isSeparator = character => (separator === ' ' ? /\s/.test(character) : character === separator);
  const flush = () => {
    if (current.trim()) items.push(current.trim());
    current = '';
  };
  for (const character of list) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (depth === 0 && isSeparator(character)) flush();
    else current += character;
  }
  flush();
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
