// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Font files a diagram declares itself, in CSS: @font-face { font-family: 'Acme Sans'; font-weight: 700;
// src: url(brand/AcmeSans-Bold.ttf) } in its <style>, the path relative to the diagram file. A
// company's licensed fonts come this way. Shared by the render page and the browser viewer, so it
// uses nothing but strings.

const TYPES = {
  ttf: ['font/ttf', 'truetype'], otf: ['font/otf', 'opentype'],
  woff: ['font/woff', 'woff'], woff2: ['font/woff2', 'woff2'],
};

// A file's media type and CSS format, from its extension (or a data: URL's own type).
export function typeOf(url) {
  const data = /^data:font\/(ttf|otf|woff2?)/i.exec(url), file = /\.(ttf|otf|woff2?)(?:[?#]|$)/i.exec(url);
  const extension = (data || file)?.[1].toLowerCase();
  return extension ? { mime: TYPES[extension][0], format: TYPES[extension][1] } : null;
}

const descriptor = (body, name) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1].trim();
const SOURCE = /(?:^|;)\s*src\s*:\s*((?:\([^)]*\)|"[^"]*"|'[^']*'|[^;])+)/i;

// One @font-face body as a face: its family, its file (the first url() of a known type; local()
// names an installed font, which needs no file), weight, style and characters.
function faceOf(body) {
  const family = descriptor(body, 'font-family')?.replace(/^['"]|['"]$/g, '');
  const urls = [...(SOURCE.exec(body)?.[1] || '').matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map(match => match[2]);
  const url = urls.find(typeOf) || urls[0];
  if (!family || !url) return null;
  const weight = descriptor(body, 'font-weight') || '400', style = descriptor(body, 'font-style') || 'normal';
  return { family, url, weight, style, range: descriptor(body, 'unicode-range') };
}

// The faces a diagram's own <style> declares with @font-face.
export function declaredFaces(diagram) {
  const css = [...diagram.querySelectorAll('style')].map(style => style.textContent).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].map(([, body]) => faceOf(body)).filter(Boolean);
}

// The descriptors a FontFace takes for a face.
export const faceDescriptors = face => ({
  weight: face.weight, style: face.style, ...(face.range ? { unicodeRange: face.range } : {}),
});

// The face's rule with its file inside, for the SVG.
export function fileRule(face, data) {
  const format = typeOf(face.url)?.format, range = face.range ? `unicode-range:${face.range};` : '';
  return `@font-face{font-family:'${face.family.replace(/'/g, '')}';font-weight:${face.weight};`
    + `font-style:${face.style};${range}src:url(${data})${format ? ` format('${format}')` : ''}}`;
}
