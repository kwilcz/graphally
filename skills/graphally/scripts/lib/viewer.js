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
//
// A page may hold any number of diagrams, and a diagram may sit in a page of its own (a
// site, a wiki). Each is isolated: its <style> applies to it alone, the page's CSS does not
// reach it, and it is shown in a shadow root, so its SVG ids do not meet another diagram's.
// The page restyles a diagram only through the theme's tokens, set on .graphally-view.
import { compile, registerPack } from './index.js';
import { svgEntry } from './iconsvg.js';
import { hostTheme } from './style.js';
import THEME from '../../assets/theme.css';

const WEIGHTS = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };

export function start(index) {
  const o = { azure: index.azure.base, aws: index.aws.base, font: index.font, ...(globalThis.graphallyOptions || {}) };
  const faces = Object.entries(WEIGHTS).map(([w, name]) => `@font-face { font-family: Inter; font-weight: ${w}; font-display: block; src: url("${o.font}Inter-${name}.woff2") format("woff2"), local("Inter ${name}"), local("Inter"); }`).join('\n');
  const style = document.createElement('style');
  // A diagram follows the reader's light or dark setting unless it names a theme. A file that
  // holds only diagrams follows too (data-graphally-page); a page they are embedded in keeps
  // its own colours. Fonts are declared here: a shadow root uses the page's.
  const prefersDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  style.textContent = `${faces}\ndiagram { display: none; }
@media (prefers-color-scheme: dark) { html[data-graphally-page]:not([data-graphally-theme="light"]) body { background: #0f131e; color: #e3e8f3; } }
.graphally-view { display: block; margin: 16px auto; width: max-content; max-width: 100%; overflow: auto; }`;
  document.head.append(style);
  // What a shadow root shows: the theme's tokens on its host, and a box that inherits no font
  // or spacing from the page (a letter-spacing on body would widen every label).
  const VIEW_CSS = `${hostTheme(THEME)}
.view { all: initial; display: block; }
svg { display: block; }
.problems { font: 12px/1.5 Inter, "Segoe UI", system-ui, sans-serif; color: var(--rust); margin: 6px 0 0; padding: 0 0 0 18px; }`;

  // A diagram's <style> is for that diagram, but a browser applies a <style> to the whole page
  // wherever it sits. Each one is switched off as soon as it is parsed (and again whenever it
  // is rewritten, which makes a new sheet); compile() lays the diagram out with a copy of it.
  const mute = () => { for (const s of document.querySelectorAll('diagram style, diagram link[rel~="stylesheet"]')) if (s.sheet && !s.sheet.disabled) s.sheet.disabled = true; };
  mute();
  new MutationObserver(mute).observe(document.documentElement, { childList: true, subtree: true });
  for (const s of document.querySelectorAll('diagram link[rel~="stylesheet"]')) s.addEventListener('load', mute);

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
    mute();
    const diagrams = [...document.querySelectorAll('diagram')];
    // A file of diagrams and nothing else (what graphally writes) is theirs to colour.
    const alone = [...document.body.children].every(c => /^(DIAGRAM|SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(c.tagName) || c.classList.contains('graphally-view'));
    if (alone) document.documentElement.dataset.graphallyPage = '';
    for (const el of diagrams) {
      let out = el.nextElementSibling?.classList.contains('graphally-view') ? el.nextElementSibling : null;
      if (!out) { out = document.createElement('div'); out.className = 'graphally-view'; el.after(out); }
      const shadow = out.shadowRoot || out.attachShadow({ mode: 'open' });
      const show = nodes => { const css = document.createElement('style'), view = document.createElement('div'); css.textContent = VIEW_CSS; view.className = 'view'; view.append(...nodes); shadow.replaceChildren(css, view); };
      try {
        const opts = { standalone: false, css: THEME, theme: el.getAttribute('theme') || (prefersDark() ? 'dark' : 'light'), source: location.pathname.split('/').pop() };
        out.dataset.theme = opts.theme;
        if (alone && el.getAttribute('theme')) document.documentElement.dataset.graphallyTheme = el.getAttribute('theme');
        let r = compile(el, opts);
        // The first pass names the icons the diagram draws; the second draws them.
        if (used.size) { const want = [...used]; used.clear(); await fetchIcons(want); r = compile(el, opts); }
        // Warnings are for the author at the render; a reader of the page is not shown them.
        const problems = r.problems.filter(p => !p.warn);
        if (el.querySelector('include')) problems.unshift({ rule: 'include', hint: 'a file opened from disk cannot read its parts: render it with graphally, or put the parts in this file' });
        const t = document.createElement('template');
        t.innerHTML = r.svg;
        const nodes = [...t.content.childNodes];
        if (problems.length) {
          const list = document.createElement('ul');
          list.className = 'problems';
          for (const p of problems) { const li = document.createElement('li'); const { rule, hint, ...rest } = p; li.textContent = `${rule}: ${Object.entries(rest).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}${hint ? ` (${hint})` : ''}`; list.append(li); }
          nodes.push(list);
        }
        show(nodes);
      } catch (e) { const p = document.createElement('p'); p.className = 'problems'; p.textContent = `graphally could not draw this diagram: ${e.message}`; show([p]); }
    }
    document.documentElement.dataset.graphally = 'ready';
  }

  globalThis.graphally = { render };
  // Switching the system theme redraws the diagrams in the other one.
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', render, { once: true }); else render();
}
