// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The files a diagram names, read in the render page: its parts (<include src="parts/app.html">, a
// house style shared by several diagrams) and its images. A path is relative to the file that names
// it and may lead out of the diagram's folder (../style/house.html); the render's server reads it
// from disk at /near. A part that cannot be read is reported, not dropped in silence.
import { nearUrl } from './near.js';

const ADDRESS = /^[a-z][a-z0-9+.-]+:/i;

// A path joined to a folder, both relative to the diagram file: 'parts' + 'app.html', '' + '../x'.
function joined(folder, path) {
  const out = [];
  for (const piece of `${folder}/${path}`.split('/').filter(each => each && each !== '.')) {
    if (piece === '..' && out.length && out.at(-1) !== '..') out.pop();
    else out.push(piece);
  }
  return out.join('/');
}
const folderOf = file => file.split('/').slice(0, -1).join('/');

// The part's root group id becomes its namespace: ids inside are prefixed ("app.web").
function namespacePart(content) {
  const part = content.querySelector('group, band, zone');
  if (!part?.id) return;
  part.dataset.ns = part.id;
  for (const element of part.querySelectorAll('[id]')) element.id = `${part.id}.${element.id}`;
}

// A part's images are relative to the part: written relative to the diagram file instead.
function rebaseImages(content, folder) {
  for (const image of content.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src');
    if (!ADDRESS.test(src)) image.setAttribute('src', joined(folder, src));
  }
}

// Where a part that could not be read stood: a template, which is not drawn, naming it.
function missingPart(file) {
  const marker = document.createElement('template');
  marker.dataset.missingPart = file;
  return marker;
}

// <include src="…"> replaced by the part it names, the part's own parts and images resolved from it.
async function resolveInclude(include, source, folder, depth) {
  const file = joined(folder, include.getAttribute('src') || '');
  const response = await fetch(nearUrl(source, file)).catch(() => null);
  // An unclosed <include …> swallows what follows it; give that back first.
  include.after(...include.childNodes);
  if (!response?.ok) return include.replaceWith(missingPart(file));
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  namespacePart(template.content);
  rebaseImages(template.content, folderOf(file));
  if (depth < 8) await resolveIncludes(template.content, source, folderOf(file), depth + 1);
  return include.replaceWith(template.content);
}

export async function resolveIncludes(root, source, folder = '', depth = 0) {
  for (const include of [...root.querySelectorAll('include')]) await resolveInclude(include, source, folder, depth);
}

// The parts a diagram names that could not be read, as problems.
export const missingParts = diagram => [...diagram.querySelectorAll('template[data-missing-part]')]
  .map(marker => ({
    rule: 'part-missing', src: marker.dataset.missingPart,
    hint: 'the part did not load: check its path, relative to the file that includes it',
  }));

async function dataUrl(response) {
  const type = (response.headers.get('content-type') || '').split(';')[0] || 'image/png';
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

// <img src="logo.svg">: the file goes into the SVG as a data: URL, so the drawing holds it wherever
// it is opened. One that cannot be read is left linked (the engine says so). Laid out at its own
// size, the image must have loaded first.
async function embedImage(image, source) {
  const src = image.getAttribute('src');
  if (/^data:/i.test(src)) return image.decode().catch(() => {});
  const url = nearUrl(source, src);
  image.dataset.src = src;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    image.src = await dataUrl(response);
  } catch {
    image.src = url.href;
  }
  return image.decode().catch(() => {});
}

export const embedImages = (root, source) => Promise.all([...root.querySelectorAll('img[src]')]
  .map(image => embedImage(image, source)));
