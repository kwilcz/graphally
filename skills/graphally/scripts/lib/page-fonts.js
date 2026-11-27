// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The render page's display fonts: each face a diagram names (a Google font in fonts="…", or a file
// of its own in an @font-face rule) is loaded before layout, so its text is measured in it, and
// embedded in the SVG, so the figure looks the same wherever it is opened; <diagram
// embed-fonts="no"> keeps the files out where a font's licence forbids embedding.
import { facesFor, faceRule, diagramText } from './fonts.js';
import { declaredFaces, faceDescriptors, fileRule, typeOf } from './font-files.js';
import { nearUrl } from './near.js';

const base64 = buffer => {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
};

// A face's file, loaded into the page; its bytes, or null when it could not be read or used.
async function loadFile(url, family, descriptors) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.arrayBuffer(), font = new FontFace(family, data, descriptors);
    await font.load();
    document.fonts.add(font);
    return data;
  } catch {
    return null;
  }
}

const GOOGLE_HINT = 'the text falls back to the theme font: check the family on fonts.google.com, '
  + 'or render once online';
const FILE_HINT = 'the file did not load: check its path (relative to the diagram file) '
  + 'and that it is a ttf, otf, woff or woff2';

// A Google face from the render's server (downloaded by the CLI); a missing one is reported once,
// for its Latin file.
async function googleFace(face) {
  const data = await loadFile(new URL(`/fonts/${face.file}`, location.href), face.family,
    { weight: face.weight, unicodeRange: face.range });
  if (data) return { rule: faceRule(face, `data:font/woff2;base64,${base64(data)}`) };
  return face.subset === 'latin' ? { missing: { font: `${face.family} ${face.weight}`, hint: GOOGLE_HINT } } : {};
}

// A face of the diagram's own, from the file its @font-face names.
async function fileFace(face, base) {
  const data = await loadFile(nearUrl(base, face.url), face.family, faceDescriptors(face));
  if (!data) return { missing: { font: `${face.family} ${face.weight}`, file: face.url, hint: FILE_HINT } };
  const mime = typeOf(face.url)?.mime || 'font/ttf';
  return { rule: fileRule(face, `data:${mime};base64,${base64(data)}`) };
}

// For each diagram that names fonts: the CSS that embeds them, and the faces that did not load.
export async function loadPageFonts(host, base) {
  const fonts = new Map();
  for (const diagram of host.querySelectorAll('diagram')) {
    const google = facesFor(diagram.getAttribute('fonts'), diagramText(diagram));
    const files = declaredFaces(diagram).map(face => fileFace(face, base));
    const loaded = await Promise.all([...google.map(googleFace), ...files]);
    if (!loaded.length) continue;
    const embedded = diagram.getAttribute('embed-fonts') !== 'no';
    const css = embedded ? loaded.map(face => face.rule).filter(Boolean).join('') : '';
    fonts.set(diagram, { css, missing: loaded.map(face => face.missing).filter(Boolean) });
  }
  return fonts;
}

// The figure with its fonts inside its SVG, and a warning for each face that could not be loaded.
export function withFonts(result, fonts) {
  if (!fonts) return result;
  const svg = fonts.css ? result.svg.replace(/^<svg[^>]*>/, open => `${open}<style>${fonts.css}</style>`) : result.svg;
  const warnings = fonts.missing.map(missing => ({ rule: 'font-missing', warn: true, ...missing }));
  return { ...result, svg, problems: [...result.problems, ...warnings] };
}
