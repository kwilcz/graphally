// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A diagram's own icon sets: <diagram icon-sets="acme: ../brand/icons; flags: ../brand/flags.svg">
// names a folder of SVG files (each file one icon, named by the file) or a sprite (one SVG of
// <symbol id="…">) under a prefix, and <icon name="acme:shield"> draws one. An icon drawn in one
// colour takes the CSS colour of the <icon>; one of several colours keeps them. Shared by the
// render page and the browser viewer, so it uses nothing but strings.
import { svgEntry, kebab } from './engine/icons/icon-svg.js';

const RESERVED = new Set(['azure', 'aws', 'ph']);

// "acme: ../brand/icons; flags: x.svg" -> [{ prefix, path }]; the built-in packs' names stay theirs.
export function parseIconSets(value) {
  return String(value || '').split(';').map(part => /^\s*([a-z][a-z0-9-]*)\s*:\s*(.+?)\s*$/i.exec(part))
    .filter(Boolean).map(([, prefix, path]) => ({ prefix: prefix.toLowerCase(), path }))
    .filter(set => !RESERVED.has(set.prefix));
}

export const isSprite = path => /\.svg(?:[?#]|$)/i.test(path);

// A sprite's symbols, each as an SVG of its own, by id.
export function spriteFiles(text) {
  const files = {};
  for (const [, attributes, body] of String(text).matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const id = /\sid="([^"]+)"/.exec(attributes)?.[1], viewBox = /\sviewBox="([^"]+)"/.exec(attributes)?.[1];
    if (id && viewBox) files[id] = `<svg viewBox="${viewBox}">${body}</svg>`;
  }
  return files;
}

const STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;

// The class rules of an exported icon's stylesheet: .cls-1 { fill: #1d1d1b } as cls-1 -> 'fill: #1d1d1b;'.
function classRules(svg) {
  const css = [...svg.matchAll(STYLE)].map(match => match[1]).join('').replace(/<!\[CDATA\[|\]\]>/g, '');
  const rules = new Map();
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = selectors.split(',').map(each => /^\s*\.([\w-]+)\s*$/.exec(each)?.[1]).filter(Boolean);
    names.forEach(name => rules.set(name, `${rules.get(name) || ''}${body.trim()};`));
  }
  return rules;
}

// The class rules written on the elements instead.
function inlineClasses(svg) {
  const rules = classRules(svg);
  return svg.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/\sclass="([^"]*)"/g, (whole, names) => {
    const style = names.split(/\s+/).map(name => rules.get(name) || '').join('');
    return style ? ` style="${style.replace(/"/g, "'")}"` : '';
  });
}

const PAINTS = /\b(fill|stroke|stop-color)(="|\s*:\s*)([^";]+)/g;
const NO_PAINT = /^(none|transparent|currentcolor|inherit|url\(.*)$/i;
const CARRIED = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'fill-rule', 'clip-rule', 'opacity'];
const ROOT_PAINT = new RegExp(`\\s(${CARRIED.join('|')})="[^"]*"`, 'g');

const coloursIn = svg => new Set([...svg.matchAll(PAINTS)].map(match => match[3].trim().toLowerCase())
  .filter(colour => !NO_PAINT.test(colour)));
const rootPaintOf = svg => [...(/<svg\b[^>]*>/.exec(svg)?.[0] || '').matchAll(ROOT_PAINT)]
  .map(match => match[0]).join('');
const toCurrent = (whole, name, joint, colour) => `${name}${joint}`
  + `${NO_PAINT.test(colour.trim()) ? colour : 'currentColor'}`;

// The icon in one colour paints in currentColor; the root's paint attributes carry over to its body.
function recolour(svg, body) {
  const carried = rootPaintOf(svg);
  if (coloursIn(svg).size > 1) return `<g${carried}>${body}</g>`;
  const rootPaint = carried.replace(PAINTS, toCurrent), fill = /\sfill=/.test(rootPaint) ? '' : ' fill="currentColor"';
  return `<g${fill}${rootPaint}>${body.replace(PAINTS, toCurrent)}</g>`;
}

// One icon's SVG file as a pack entry, or null when it is not an SVG drawing.
export function ownIcon(svg) {
  const text = /<style/.test(svg) ? inlineClasses(svg) : svg.replace(/\sclass="[^"]*"/g, '');
  const entry = svgEntry(text.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/gi, ''));
  return entry && { viewBox: entry.viewBox, body: recolour(text, entry.body) };
}

// The pack of a set: its icons by name, a file's name in lower case with dashes (ShieldCheck.svg
// is shield-check).
export function iconSetPack(files) {
  const pack = {};
  for (const [name, svg] of Object.entries(files)) {
    const icon = ownIcon(svg), key = kebab(name);
    if (icon && key && !pack[key]) pack[key] = icon;
  }
  return pack;
}
