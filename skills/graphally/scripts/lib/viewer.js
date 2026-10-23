// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer: a diagram file that loads graphally.js renders itself when it is opened in a
// browser, double-clicked from disk included. tools/build-viewer.mjs bundles this file, the
// engine, the theme and an index of the icon packs into skills/graphally/viewer/graphally.js.
//
// The icon artwork is not in the bundle: the index names each icon's file, and the viewer
// fetches only the icons a diagram uses, from where the skill gets them (the draw.io
// repository for Azure, the aws-icons package for AWS). The Inter typeface comes from the
// inter-ui package, so the boxes measure the same text as in a render. A page can point
// any of these at a mirror before it loads graphally.js:
//   <script>graphallyOptions = { azure: 'https://…/azure2/', aws: 'https://…/icons/', font: 'https://…/web/' }</script>
import { compile, registerPack } from './index.js';
import { svgEntry } from './iconsvg.js';
import THEME from '../../assets/theme.css';

const WEIGHTS = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };

export function start(index) {
  const o = { azure: index.azure.base, aws: index.aws.base, font: index.font, ...(globalThis.graphallyOptions || {}) };
  const faces = Object.entries(WEIGHTS).map(([w, name]) => `@font-face { font-family: Inter; font-weight: ${w}; font-display: block; src: url("${o.font}Inter-${name}.woff2") format("woff2"), local("Inter ${name}"), local("Inter"); }`).join('\n');
  const style = document.createElement('style');
  // A diagram follows the reader's light or dark setting unless it names a theme; the page
  // around it follows too.
  const prefersDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  style.textContent = `${faces}\n${THEME}\ndiagram { display: none; }
@media (prefers-color-scheme: dark) { html:not([data-graphally-theme="light"]) body { background: #0f131e; color: #e3e8f3; } }
.graphally-view { margin: 16px auto; width: max-content; max-width: 100%; overflow: auto; }
.graphally-view svg { display: block; }
.graphally-problems { font: 12px/1.5 Inter, "Segoe UI", system-ui, sans-serif; color: var(--rust, #b4472a); margin: 6px 0 0; padding: 0 0 0 18px; }`;
  document.head.append(style);

  // An icon used by a diagram is fetched on first use; its pack entry is filled in place.
  const used = new Set();
  for (const vendor of ['azure', 'aws']) {
    const pack = {};
    for (const [name, file] of Object.entries(index[vendor].files)) {
      const entry = { viewBox: '0 0 24 24', file, vendor, ready: false };
      let body = '';
      Object.defineProperty(entry, 'body', { enumerable: true, get() { if (!entry.ready) used.add(entry); return body; }, set(v) { body = v; } });
      pack[name] = entry;
    }
    registerPack(vendor, pack);
  }
  const fetchIcons = entries => Promise.all([...entries].map(async e => {
    try {
      const res = await fetch(o[e.vendor] + e.file.split('/').map(encodeURIComponent).join('/'));
      const def = res.ok && svgEntry(await res.text());
      if (def) { e.viewBox = def.viewBox; e.body = def.body; }
    } catch {}
    e.ready = true;
  }));

  async function render() {
    await document.fonts.ready;
    await Promise.race([Promise.all(Object.keys(WEIGHTS).map(w => document.fonts.load(`${w} 13px Inter`))), new Promise(r => setTimeout(r, 4000))]).catch(() => {});
    for (const el of document.querySelectorAll('diagram')) {
      let out = el.nextElementSibling?.classList.contains('graphally-view') ? el.nextElementSibling : null;
      if (!out) { out = document.createElement('div'); out.className = 'graphally-view'; el.after(out); }
      try {
        const opts = { standalone: false, css: THEME, theme: el.getAttribute('theme') || (prefersDark() ? 'dark' : 'light'), source: location.pathname.split('/').pop() };
        if (el.getAttribute('theme')) document.documentElement.dataset.graphallyTheme = el.getAttribute('theme');
        let r = compile(el, opts);
        // The first pass names the icons the diagram draws; the second draws them.
        if (used.size) { const want = [...used]; used.clear(); await fetchIcons(want); r = compile(el, opts); }
        const problems = [...r.problems];
        if (el.querySelector('include')) problems.unshift({ rule: 'include', hint: 'a file opened from disk cannot read its parts: render it with graphally, or put the parts in this file' });
        out.innerHTML = r.svg;
        if (problems.length) {
          const list = document.createElement('ul');
          list.className = 'graphally-problems';
          for (const p of problems) { const li = document.createElement('li'); const { rule, hint, ...rest } = p; li.textContent = `${rule}: ${Object.entries(rest).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}${hint ? ` (${hint})` : ''}`; list.append(li); }
          out.append(list);
        }
      } catch (e) { out.textContent = `graphally could not draw this diagram: ${e.message}`; }
    }
    document.documentElement.dataset.graphally = 'ready';
  }

  globalThis.graphally = { render };
  // Switching the system theme redraws the diagrams in the other one.
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', render, { once: true }); else render();
}
