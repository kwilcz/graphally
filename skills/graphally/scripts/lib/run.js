// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Browser side of the CLI: load a diagram file, resolve its parts and images, compile every
// <diagram>, and tell the CLI it is done.
import { compile, registerPack } from './engine/index.js';
import { resolveIcon } from './engine/icons/icons.js';
import { loadPageFonts, withFonts } from './page-fonts.js';
import { loadIconSets } from './page-icon-sets.js';
import { resolveIncludes, embedImages, missingParts } from './page-parts.js';

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

// Icon packs are served at /icons/<vendor>.json when downloaded (scripts/fetch-icons.mjs). They
// weigh megabytes, so they are fetched only when the diagram may need them: the cloud packs for an
// <icon> that neither the generic set nor the diagram's own sets hold, or for a script (which can
// draw or make icons), Phosphor when a name or the script asks for ph:.
function packsNeeded(host, own) {
  const names = [...host.querySelectorAll('icon')].map(icon => icon.getAttribute('name') || '');
  const scripts = [...host.querySelectorAll('script[type="graphally"]')].map(script => script.textContent);
  const theirs = name => /^ph[:/]/i.test(name) || own.includes(/^([a-z][\w-]*):/i.exec(name)?.[1].toLowerCase());
  const cloud = names.some(name => !theirs(name) && resolveIcon(name)?.kind !== 'generic')
    || scripts.some(text => /icon/i.test(text));
  const ph = names.some(name => /^ph[:/]/i.test(name)) || scripts.some(text => /['"`]ph:/.test(text));
  return [...(cloud ? ['azure', 'aws'] : []), ...(ph ? ['ph'] : [])];
}

async function loadPacks(vendors) {
  const fetchPack = vendor => fetch(new URL(`/icons/${vendor}.json`, location.href))
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  const packs = await Promise.all(vendors.map(fetchPack));
  vendors.forEach((vendor, index) => { if (packs[index]) registerPack(vendor, packs[index]); });
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
function compileAll(host, previous, css, request, fonts) {
  const results = [], taken = new Map();
  for (const diagram of host.querySelectorAll('diagram')) {
    const id = diagram.id || '', k = taken.get(id) || 0;
    taken.set(id, k + 1);
    const theme = request.theme || diagram.getAttribute('theme') || 'light';
    const options = {
      standalone: !request.inline, css, theme, debug: request.debug,
      previous: previous.filter(layout => (layout?.id || '') === id)[k], source: request.source,
    };
    const result = withFonts(compile(diagram, options), fonts.get(diagram)), wrap = document.createElement('div');
    result.problems.push(...missingParts(diagram));
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
  await loadPacks(packsNeeded(host, await loadIconSets(host, request.src)));
  wrapPart(host);
  const fonts = await loadPageFonts(host, request.src);
  await document.fonts.ready;
  window.__results = compileAll(host, previous, css, request, fonts);
}

try {
  await run();
} catch (error) {
  window.__error = String(error.stack || error);
}
document.body.dataset.ready = '1';
// The CLI waits for this call (a binding it adds to the page); opened elsewhere, it is absent.
window.graphallyReady?.('1');
