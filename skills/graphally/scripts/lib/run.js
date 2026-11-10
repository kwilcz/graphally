// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Browser side of the CLI: load a diagram file, resolve parts, compile every <diagram>.
import { compile, registerPack } from './index.js';
import { resolveIcon } from './icons.js';

const NS_ATTRS = ['id'];
try {
  const q = new URLSearchParams(location.search);
  const src = new URL(q.get('src'));
  if (q.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  // Layout snapshots of the earlier renders, served by the CLI at prev (none with --recompute).
  const prevAt = q.get('prev') ?? '/previous.json';
  const [previousIn, css, text] = await Promise.all([
    prevAt ? fetch(new URL(prevAt, location.href)).then(r => (r.ok ? r.json() : [])).catch(() => []) : [],
    fetch(new URL('../../assets/theme.css', import.meta.url)).then(r => r.text()),
    fetch(src).then(r => r.text()),
  ]);
  const previous = Array.isArray(previousIn) ? previousIn : [];

  const host = document.createElement('div');
  host.innerHTML = text;
  await resolveIncludes(host, src);
  await embedImages(host, src);
  // Icon packs are served at /icons/<vendor>.json when downloaded (scripts/fetch-icons.mjs).
  // They weigh 3 MB, so they are fetched only when the diagram may need them: an <icon> that
  // is not a generic one, or a script, which can draw or make icons.
  const generic = name => resolveIcon(name)?.kind === 'generic';
  if ([...host.querySelectorAll('icon')].some(i => !generic(i.getAttribute('name') || '')) || [...host.querySelectorAll('script[type="graphally"]')].some(s => /icon/i.test(s.textContent))) {
    const packs = await Promise.all(['azure', 'aws'].map(vendor => fetch(new URL(`/icons/${vendor}.json`, location.href)).then(r => (r.ok ? r.json() : null)).catch(() => null)));
    ['azure', 'aws'].forEach((vendor, i) => { if (packs[i]) registerPack(vendor, packs[i]); });
  }
  // A part file (no <diagram>) renders on its own, wrapped in a diagram.
  if (!host.querySelector('diagram')) {
    const d = document.createElement('diagram');
    d.append(...host.childNodes);
    host.append(d);
  }
  await document.fonts.ready;
  const results = [], taken = new Map();
  for (const el of host.querySelectorAll('diagram')) {
    // The k-th diagram with this id gets the k-th previous snapshot with it (same as the CLI).
    const id = el.id || '', k = taken.get(id) || 0;
    taken.set(id, k + 1);
    const prev = previous.filter(s => (s?.id || '') === id)[k];
    const r = compile(el, { standalone: q.get('inline') !== '1', css, theme: q.get('theme') || el.getAttribute('theme') || 'light', debug: q.get('debug') === '1', previous: prev, source: q.get('source') || '' });
    const wrap = document.createElement('div');
    wrap.className = 'out';
    wrap.innerHTML = r.svg;
    document.body.append(wrap);
    results.push({ id: el.id, ...r });
  }
  window.__results = results;
} catch (e) {
  window.__error = String(e.stack || e);
}
document.body.dataset.ready = '1';
// The CLI waits for this call (a binding it adds to the page); opened elsewhere, it is absent.
window.graphallyReady?.('1');

// <include src="parts/app.html"> is replaced by the part. The part's root group id becomes
// its namespace: ids inside are prefixed ("app.web"), and links inside resolve locally.
async function resolveIncludes(root, base, depth = 0) {
  for (const inc of [...root.querySelectorAll('include')]) {
    const url = new URL(inc.getAttribute('src'), base);
    const t = document.createElement('template');
    t.innerHTML = await (await fetch(url)).text();
    const part = t.content.querySelector('group, band, zone');
    if (part?.id) {
      const ns = part.id;
      part.dataset.ns = ns;
      for (const el of part.querySelectorAll('[id]')) el.id = `${ns}.${el.id}`;
    }
    // A part's images are relative to the part.
    for (const img of t.content.querySelectorAll('img[src]')) img.setAttribute('src', new URL(img.getAttribute('src'), url).href);
    if (depth < 8) await resolveIncludes(t.content, url, depth + 1);
    // An unclosed <include …> swallows what follows it; give that back first.
    inc.after(...inc.childNodes);
    inc.replaceWith(t.content);
  }
}

// <img src="logo.svg">: the file goes into the SVG as a data: URL, so the drawing holds it
// wherever it is opened. One that cannot be read is left linked (the engine says so).
async function embedImages(root, base) {
  await Promise.all([...root.querySelectorAll('img[src]')].map(async img => {
    const url = new URL(img.getAttribute('src'), base);
    if (url.protocol !== 'data:') {
      img.dataset.src = img.getAttribute('src');
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(r.status);
        const type = (r.headers.get('content-type') || '').split(';')[0] || 'image/png';
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        img.src = `data:${type};base64,${btoa(bin)}`;
      } catch { img.src = url.href; }
    }
    // Laid out at its own size, the image must have loaded first.
    await img.decode().catch(() => {});
  }));
}
