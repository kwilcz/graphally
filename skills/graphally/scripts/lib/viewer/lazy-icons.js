// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The icon packs as an index of names and files: an icon a diagram uses is fetched on first use,
// and its pack entry is filled in place. A diagram's own sets (icon-sets="acme: brand/icons") are
// read from the page's address: a folder an icon at a time, by its file name, a sprite whole.
import { registerPack } from '../engine/index.js';
import { svgEntry } from '../engine/icons/icon-svg.js';
import { parseIconSets, isSprite, spriteFiles, iconSetPack, ownIcon } from '../icon-sets.js';

// An entry whose body, read by a compile, marks it as used until it is fetched. own: the folder
// of a diagram's own set.
function lazyEntry(file, vendor, used, own) {
  const entry = { viewBox: '0 0 24 24', file, vendor, own, ready: false };
  let body = '';
  Object.defineProperty(entry, 'body', {
    enumerable: true,
    get() {
      if (!entry.ready) used.add(entry);
      return body;
    },
    set(value) { body = value; },
  });
  return entry;
}

// Phosphor paints in currentColor from its root, which an entry drops; the body carries it.
const bodyOf = (entry, body) => (entry.vendor === 'ph' ? `<g fill="currentColor">${body}</g>` : body);

const iconOf = (entry, text) => {
  if (entry.own) return ownIcon(text);
  const icon = svgEntry(text);
  return icon && { viewBox: icon.viewBox, body: bodyOf(entry, icon.body) };
};

// The first of an entry's files that answers (a folder of a diagram's own is tried in several spellings).
async function firstFound(base, files) {
  for (const file of [].concat(files)) {
    const response = await fetch(base + file.split('/').map(encodeURIComponent).join('/')).catch(() => null);
    if (response?.ok) return response.text();
  }
  return null;
}

async function fetchIcon(entry, sources) {
  const text = await firstFound(entry.own || sources[entry.vendor], entry.file);
  const icon = text && iconOf(entry, text);
  if (icon) Object.assign(entry, icon);
  entry.ready = true;
}

// A pack without an index: each name's entry made on first use, its file named by fileOf.
function namedPack(fileOf, vendor, used, own) {
  const entries = new Map();
  return new Proxy({}, {
    get(target, name) {
      if (typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name)) return undefined;
      if (!entries.has(name)) entries.set(name, lazyEntry(fileOf(name), vendor, used, own));
      return entries.get(name);
    },
    ownKeys: () => [...entries.keys()],
    getOwnPropertyDescriptor: (target, name) => (entries.has(name)
      ? { enumerable: true, configurable: true } : undefined),
  });
}

// Phosphor's file follows from a name's weight: rocket-launch-bold is bold/rocket-launch-bold.svg,
// rocket-launch is regular/rocket-launch.svg.
const WEIGHT = /-(bold|fill|light|thin|duotone)$/;
const phosphorFile = name => `${WEIGHT.exec(name)?.[1] || 'regular'}/${name}.svg`;

// A folder cannot be listed from a page: the file of shield-check is tried as shield-check.svg,
// shield_check.svg, ShieldCheck.svg and shieldCheck.svg.
const spellings = name => {
  const words = name.split('-'), capital = word => word.charAt(0).toUpperCase() + word.slice(1);
  const pascal = words.map(capital).join(''), camel = words[0] + words.slice(1).map(capital).join('');
  return [...new Set([name, words.join('_'), pascal, camel])].map(each => `${each}.svg`);
};

const textAt = url => fetch(url).then(response => (response.ok ? response.text() : '')).catch(() => '');

// The sets a diagram names, registered before it is drawn.
export async function registerIconSets(diagram, used) {
  for (const { prefix, path } of parseIconSets(diagram.getAttribute('icon-sets'))) {
    const url = new URL(isSprite(path) ? path : `${path.replace(/\/$/, '')}/`, document.baseURI).href;
    if (isSprite(path)) registerPack(prefix, iconSetPack(spriteFiles(await textAt(url))));
    else registerPack(prefix, namedPack(spellings, prefix, used, url));
  }
}

// The packs registered; used holds the entries a compile read, fetch() fetches them.
export function registerLazyPacks(index, sources) {
  const used = new Set();
  for (const vendor of ['azure', 'aws']) {
    const entries = Object.entries(index[vendor].files).map(([name, file]) => [name, lazyEntry(file, vendor, used)]);
    registerPack(vendor, Object.fromEntries(entries));
  }
  if (sources.ph) registerPack('ph', namedPack(phosphorFile, 'ph', used));
  return { used, fetch: entries => Promise.all([...entries].map(entry => fetchIcon(entry, sources))) };
}
