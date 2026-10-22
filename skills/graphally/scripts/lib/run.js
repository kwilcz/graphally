// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Browser side of the CLI: load a diagram file, resolve parts, compile every <diagram>.
import { compile, registerPack } from './index.js';

const NS_ATTRS = ['id'];
try {
  const q = new URLSearchParams(location.search);
  const src = new URL(q.get('src'));
  if (q.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  // Icon packs are served at /icons/<vendor>.json when downloaded (scripts/fetch-icons.mjs).
  for (const vendor of ['azure', 'aws']) {
    try { const res = await fetch(new URL(`/icons/${vendor}.json`, location.href)); if (res.ok) registerPack(vendor, await res.json()); } catch {}
  }
  // Layout snapshots of the earlier renders, served by the CLI (none with --recompute).
  let previous = [];
  try { const res = await fetch(new URL('/previous.json', location.href)); if (res.ok) previous = await res.json(); } catch {}
  if (!Array.isArray(previous)) previous = [];
  const css = await (await fetch(new URL('../../assets/theme.css', import.meta.url))).text();

  const host = document.createElement('div');
  host.innerHTML = await (await fetch(src)).text();
  await resolveIncludes(host, src);
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
    if (depth < 8) await resolveIncludes(t.content, url, depth + 1);
    // An unclosed <include …> swallows what follows it; give that back first.
    inc.after(...inc.childNodes);
    inc.replaceWith(t.content);
  }
}
