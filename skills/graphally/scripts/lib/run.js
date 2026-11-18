// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Browser side of the CLI: load a diagram file, resolve its parts and images, compile every
// <diagram>, and tell the CLI it is done.
import { compile, registerPack } from './engine/index.js';
import { resolveIcon } from './engine/icons/icons.js';

const text = url => fetch(url).then(response => response.text());

// What the CLI asks for, in the page's query: the file, its theme, and where its earlier layouts are.
function readRequest() {
  const query = new URLSearchParams(location.search);
  return {
    src: new URL(query.get('src')), theme: query.get('theme'),
    inline: query.get('inline') === '1', debug: query.get('debug') === '1',
    source: query.get('source') || '', previousAt: query.get('prev') ?? '/previous.json',
  };
}

// Layout snapshots of the earlier renders, served by the CLI (none with --recompute).
async function readPrevious(previousAt) {
  if (!previousAt) return [];
  const previous = await fetch(new URL(previousAt, location.href))
    .then(response => (response.ok ? response.json() : []))
    .catch(() => []);
  return Array.isArray(previous) ? previous : [];
}

// The part's root group id becomes its namespace: ids inside are prefixed ("app.web").
function namespacePart(content) {
  const part = content.querySelector('group, band, zone');
  if (!part?.id) return;
  part.dataset.ns = part.id;
  for (const element of part.querySelectorAll('[id]')) element.id = `${part.id}.${element.id}`;
}

// A part's images are relative to the part.
function rebaseImages(content, url) {
  for (const image of content.querySelectorAll('img[src]')) {
    image.setAttribute('src', new URL(image.getAttribute('src'), url).href);
  }
}

// <include src="parts/app.html"> is replaced by the part, whose links resolve locally.
async function resolveInclude(include, base, depth) {
  const url = new URL(include.getAttribute('src'), base), template = document.createElement('template');
  template.innerHTML = await text(url);
  namespacePart(template.content);
  rebaseImages(template.content, url);
  if (depth < 8) await resolveIncludes(template.content, url, depth + 1);
  // An unclosed <include …> swallows what follows it; give that back first.
  include.after(...include.childNodes);
  include.replaceWith(template.content);
}

async function resolveIncludes(root, base, depth = 0) {
  for (const include of [...root.querySelectorAll('include')]) await resolveInclude(include, base, depth);
}

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
async function inlineImage(image, url) {
  image.dataset.src = image.getAttribute('src');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    image.src = await dataUrl(response);
  } catch {
    image.src = url.href;
  }
}

async function embedImage(image, base) {
  const url = new URL(image.getAttribute('src'), base);
  if (url.protocol !== 'data:') await inlineImage(image, url);
  await image.decode().catch(() => {});
}

const embedImages = (root, base) => {
  const images = [...root.querySelectorAll('img[src]')];
  return Promise.all(images.map(image => embedImage(image, base)));
};

// Icon packs are served at /icons/<vendor>.json when downloaded (scripts/fetch-icons.mjs). They
// weigh 3 MB, so they are fetched only when the diagram may need them: an <icon> that is not a
// generic one, or a script, which can draw or make icons.
function mayNeedPacks(host) {
  const generic = name => resolveIcon(name)?.kind === 'generic';
  const icons = [...host.querySelectorAll('icon')].some(icon => !generic(icon.getAttribute('name') || ''));
  return icons
    || [...host.querySelectorAll('script[type="graphally"]')].some(script => /icon/i.test(script.textContent));
}

async function loadPacks() {
  const fetchPack = vendor => fetch(new URL(`/icons/${vendor}.json`, location.href))
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  const packs = await Promise.all(['azure', 'aws'].map(fetchPack));
  ['azure', 'aws'].forEach((vendor, index) => { if (packs[index]) registerPack(vendor, packs[index]); });
}

// A part file (no <diagram>) renders on its own, wrapped in a diagram.
function wrapPart(host) {
  if (host.querySelector('diagram')) return;
  const diagram = document.createElement('diagram');
  diagram.append(...host.childNodes);
  host.append(diagram);
}

// Each diagram compiled and shown; the k-th diagram with an id gets the k-th earlier layout with it
// (as the CLI does).
function compileAll(host, previous, css, request) {
  const results = [], taken = new Map();
  for (const diagram of host.querySelectorAll('diagram')) {
    const id = diagram.id || '', k = taken.get(id) || 0;
    taken.set(id, k + 1);
    const theme = request.theme || diagram.getAttribute('theme') || 'light';
    const options = {
      standalone: !request.inline, css, theme, debug: request.debug,
      previous: previous.filter(layout => (layout?.id || '') === id)[k], source: request.source,
    };
    const result = compile(diagram, options), wrap = document.createElement('div');
    wrap.className = 'out';
    wrap.innerHTML = result.svg;
    document.body.append(wrap);
    results.push({ id: diagram.id, ...result });
  }
  return results;
}

async function run() {
  const request = readRequest();
  if (request.theme === 'dark') document.documentElement.dataset.theme = 'dark';
  const [previous, css, source] = await Promise.all([
    readPrevious(request.previousAt),
    text(new URL('../../assets/theme.css', import.meta.url)),
    text(request.src),
  ]);
  const host = document.createElement('div');
  host.innerHTML = source;
  await resolveIncludes(host, request.src);
  await embedImages(host, request.src);
  if (mayNeedPacks(host)) await loadPacks();
  wrapPart(host);
  await document.fonts.ready;
  window.__results = compileAll(host, previous, css, request);
}

try {
  await run();
} catch (error) {
  window.__error = String(error.stack || error);
}
document.body.dataset.ready = '1';
// The CLI waits for this call (a binding it adds to the page); opened elsewhere, it is absent.
window.graphallyReady?.('1');
