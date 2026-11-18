// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Colours as the figure writes them: the theme's tokens by name, everything else in a form every
// SVG reader knows.
import { TOKENS } from '../shared/tokens.js';

// The colours of the theme tokens, so a box painted var(--wash) stays var(--wash) in the SVG
// (and follows the dark theme).
export function tokenColors(root) {
  const probe = document.createElement('div');
  root.appendChild(probe);
  const colors = new Map();
  for (const token of TOKENS) {
    probe.style.color = `var(--${token})`;
    const color = getComputedStyle(probe).color;
    if (!colors.has(color)) colors.set(color, `var(--${token})`);
  }
  probe.remove();
  return colors;
}

const TRANSPARENT = /rgba\(.*,\s*0\)$/;

// A computed colour as the figure paints it: its token, a portable colour, or null for none.
export const painter = tokens => color => {
  if (!color || TRANSPARENT.test(color) || color === 'transparent') return null;
  return tokens.get(color) || portable(color);
};

const SRGB = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/;
const rgb = (red, green, blue, alpha) =>
  (alpha >= 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${+alpha.toFixed(3)})`);

function srgbColor(match) {
  const channel = value => Math.round(Math.min(1, Math.max(0, +value)) * 255);
  const [red, green, blue] = match.slice(1, 4).map(channel);
  return rgb(red, green, blue, match[4] === undefined ? 1 : +match[4]);
}

// A colour painted on a pixel and read back; as given when the canvas does not know it.
let pixel;
function paintedColor(color) {
  pixel ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  pixel.fillStyle = '#010203';
  pixel.fillStyle = color;
  if (pixel.fillStyle === '#010203') return color;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = pixel.getImageData(0, 0, 1, 1).data;
  return rgb(red, green, blue, alpha / 255);
}

// A colour every SVG reader knows. The browser computes color-mix() to color(srgb …) and the
// newer spaces to oklab(), lab() or color(display-p3 …), which Office, Inkscape and most
// converters do not read: those become rgb(). srgb is read exactly; any other space is
// painted on a pixel and read back. A colour made of the theme's tokens (var(--woad), or a
// color-mix() of them, as a drawing script may give) stays as written, so it follows the dark
// theme like every other token; so does anything the pixel cannot read.
const portableColors = new Map();
export function portable(color) {
  if (/^(rgba?\(|#)/.test(color) || color.includes('var(')) return color;
  if (!portableColors.has(color)) {
    const srgb = SRGB.exec(color);
    portableColors.set(color, srgb ? srgbColor(srgb) : paintedColor(color));
  }
  return portableColors.get(color);
}

const holds = (box, x, y) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;

// The colour of the innermost painted box under a point.
export function colorUnder(boxes, x, y) {
  let innermost = null;
  for (const entry of boxes) {
    if (!entry.background || !holds(entry.box, x, y)) continue;
    if (!innermost || entry.box.w * entry.box.h < innermost.box.w * innermost.box.h) innermost = entry;
  }
  return innermost?.background;
}

// A halo: a rim of the colour under a text, so a line through it does not cross the words.
export const haloAt = (boxes, x, y) => {
  const rim = colorUnder(boxes, x, y) || 'var(--bg)';
  return `paint-order: stroke; stroke: ${rim}; stroke-width: 4px; stroke-linejoin: round`;
};
