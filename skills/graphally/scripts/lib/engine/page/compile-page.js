// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// <diagram>: the page is the layout. The author writes ordinary HTML and CSS and the browser
// places everything; an optional script then connects and draws by name (script/). This lays the
// page out and hands it to build-figure.js, which turns it into SVG.
import { S, hostTheme, shadowBox } from '../style.js';
import { escapeXml } from '../svg.js';
import { utilitiesFor } from '../css/utilities.js';
import { materializePseudo } from '../css/pseudo.js';
import { SHAPE_CSS } from '../shapes/shape-css.js';
import { runBeforeScripts } from '../script/before-script.js';
import { PAGE_CSS } from './page-css.js';
import { buildFigure } from './build-figure.js';
import { layoutModelOf } from './layout-model.js';

const TITLE_FONT = "600 15px Inter, 'Segoe UI', system-ui, sans-serif";
const SUBTITLE_STYLE = 'font-size: 12.5px; color: var(--muted); margin-bottom: 4px';
const PLAIN_SCRIPT_HINT =
  'a browser runs it on its own when the file is opened: write <script type="graphally">';

// The page the diagram is laid out on: its width, and its title and subtitle above the content.
function createPage(diagram, problems) {
  const widthAttribute = diagram.getAttribute('width'), width = Number(widthAttribute) || 1200;
  if (widthAttribute != null && !(Number(widthAttribute) > 0)) {
    problems.push({
      rule: 'bad-attribute', attr: 'width', value: widthAttribute,
      hint: 'a number of pixels, as in width=1200',
    });
  }
  const root = document.createElement('div');
  root.className = 'graphally-page';
  root.style.cssText = `position:absolute; left:0; top:0; width:${width}px; padding:${S.pad}px;`;
  const title = diagram.getAttribute('title'), subtitle = diagram.getAttribute('subtitle');
  const add = html => root.insertAdjacentHTML('beforeend', html);
  if (title) add(`<div style="font: ${TITLE_FONT}; margin-bottom: 4px">${escapeXml(title)}</div>`);
  if (subtitle) add(`<div style="${SUBTITLE_STYLE}">${escapeXml(subtitle)}</div>`);
  if (title || subtitle) add(`<div style="height: ${S.titleGap - 4}px"></div>`);
  return root;
}

// A copy of a child for the page. The page is laid out in a shadow root, where :root names
// nothing: a diagram's :root rule (custom properties, a font) is the page's.
function pageCopy(child) {
  const copy = child.cloneNode(true);
  if (copy.nodeType !== 1 || copy.tagName !== 'STYLE') return copy;
  copy.textContent = copy.textContent.replace(/:root\b/g, '.graphally-page');
  return copy;
}

// The diagram's scripts, by kind, and the rest of it copied onto the page. <script
// type="graphally"> draws after layout, with before it runs before; <script
// type="application/json"> is the connections, as data. A script without a type of its own also
// runs as a page script when the file is opened in a browser (the viewer), before graphally has
// laid anything out.
function takeScripts(diagram, root, problems) {
  const scripts = { drawing: [], before: [], connections: [] };
  for (const child of diagram.childNodes) {
    if (child.nodeType !== 1 || child.tagName !== 'SCRIPT') {
      root.appendChild(pageCopy(child));
      continue;
    }
    const type = (child.getAttribute('type') || '').toLowerCase();
    if (!type || /javascript|module/.test(type)) {
      problems.push({ rule: 'plain-script', hint: PLAIN_SCRIPT_HINT });
    }
    if (type === 'application/json') scripts.connections.push(child.textContent);
    else if (child.hasAttribute('before')) scripts.before.push(child.textContent);
    else scripts.drawing.push(child.textContent);
  }
  return scripts;
}

// nudge="dx,dy" moves an element from where the layout put it (the edit command writes it).
function applyNudges(root, problems) {
  for (const element of root.querySelectorAll('[nudge]')) {
    const value = element.getAttribute('nudge'), offset = value.split(',').map(Number);
    if (offset.length !== 2 || offset.some(number => !Number.isFinite(number))) {
      problems.push({
        rule: 'bad-attribute', attr: 'nudge', value, ...(element.id ? { id: element.id } : {}),
        hint: 'two numbers, as in nudge="20,-10"',
      });
      continue;
    }
    element.style.translate = `${offset[0]}px ${offset[1]}px`;
  }
}

// The figure, built while the page is laid out, with the layout model when an editor asks for it.
function builtFigure(setup, scripts) {
  const result = buildFigure({ ...setup, scripts: scripts.drawing, connections: scripts.connections });
  if (setup.options.model) result.model = layoutModelOf(setup.root);
  return result;
}

export function compilePage(diagram, options, measurer) {
  const problems = [];
  const root = createPage(diagram, problems);
  const scripts = takeScripts(diagram, root, problems);
  applyNudges(root, problems);
  // Laid out in a shadow root, the page is the diagram's own: its <style> applies to it alone,
  // and the CSS of a page it is embedded in (a site theme, a .card of its own) stays out.
  const box = shadowBox(`${hostTheme(options.css)}\n${PAGE_CSS}${SHAPE_CSS}`);
  box.host.dataset.theme = options.theme === 'dark' ? 'dark' : 'light';
  box.root.append(root);
  runBeforeScripts(root, scripts.before, problems);
  // Utility classes (flex, justify-center, gap-6): read after the before-scripts, which may have
  // added some, and removed with the page.
  const utilities = document.createElement('style');
  utilities.textContent = utilitiesFor(root, problems);
  root.prepend(utilities);
  materializePseudo(root);
  try {
    return builtFigure({ root, diagram, options, measurer, problems }, scripts);
  } finally {
    box.host.remove();
  }
}
