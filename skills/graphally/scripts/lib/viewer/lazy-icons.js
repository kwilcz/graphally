// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The icon packs as an index of names and files: an icon a diagram uses is fetched on first use,
// and its pack entry is filled in place.
import { registerPack } from '../engine/index.js';
import { svgEntry } from '../engine/icons/icon-svg.js';

// An entry whose body, read by a compile, marks it as used until it is fetched.
function lazyEntry(file, vendor, used) {
  const entry = { viewBox: '0 0 24 24', file, vendor, ready: false };
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

async function fetchIcon(entry, sources) {
  try {
    const response = await fetch(sources[entry.vendor] + entry.file.split('/').map(encodeURIComponent).join('/'));
    const icon = response.ok && svgEntry(await response.text());
    if (icon) Object.assign(entry, { viewBox: icon.viewBox, body: icon.body });
  } catch {}
  entry.ready = true;
}

// The packs registered; used holds the entries a compile read, fetch() fetches them.
export function registerLazyPacks(index, sources) {
  const used = new Set();
  for (const vendor of ['azure', 'aws']) {
    const entries = Object.entries(index[vendor].files).map(([name, file]) => [name, lazyEntry(file, vendor, used)]);
    registerPack(vendor, Object.fromEntries(entries));
  }
  return { used, fetch: entries => Promise.all([...entries].map(entry => fetchIcon(entry, sources))) };
}
