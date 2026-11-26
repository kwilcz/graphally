// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer: a diagram file that loads graphally.min.js renders itself when it is opened in a
// browser, double-clicked from disk included. tools/build-viewer.mjs bundles this file, the
// engine, the theme and an index of the icon packs into skills/graphally/viewer/graphally.min.js.
//
// The icon artwork is not in the bundle: the index names each icon's file, and the viewer
// fetches only the icons a diagram uses, from where the skill gets them (the draw.io
// repository for Azure, the aws-icons package for AWS). The Inter typeface comes from the
// inter-ui package, so the boxes measure the same text as in a render. A page can point
// any of these at a mirror before it loads graphally.min.js:
//   <script>graphallyOptions = { azure: 'https://…/azure2/', aws: 'https://…/icons/', font: 'https://…/web/' }</script>
//
// A page may hold any number of diagrams, and a diagram may sit in a page of its own (a
// site, a wiki). Each is isolated: its <style> applies to it alone, the page's CSS does not
// reach it, and it is shown in a shadow root, so its SVG ids do not meet another diagram's.
// The page restyles a diagram only through the theme's tokens, set on .graphally-view.
import { compile } from './engine/index.js';
import THEME from '../../assets/theme.css';
import { WEIGHTS, addPageStyle } from './viewer/page-style.js';
import { muteDiagramStyles, keepDiagramStylesMuted } from './viewer/mute-styles.js';
import { registerLazyPacks } from './viewer/lazy-icons.js';
import { viewOf, show, problemsList, failureNote } from './viewer/diagram-view.js';

const prefersDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
const INCLUDE_PROBLEM = {
  rule: 'include',
  hint: 'a file opened from disk cannot read its parts: render it with graphally, or put the parts in this file',
};

async function fontsLoaded() {
  await document.fonts.ready;
  const faces = Promise.all(Object.keys(WEIGHTS).map(weight => document.fonts.load(`${weight} 13px Inter`)));
  await Promise.race([faces, new Promise(resolve => setTimeout(resolve, 4000))]).catch(() => {});
}

// An <img> is laid out at its own size, so it must have loaded first.
const decodeImagesIn = diagram => [...diagram.querySelectorAll('img')]
  .map(image => image.decode().catch(() => {}));
const imagesDecoded = diagrams => Promise.all(diagrams.flatMap(decodeImagesIn));

// A file of diagrams and nothing else (what graphally writes) is theirs to colour.
const DIAGRAM_FILE_TAGS = /^(DIAGRAM|SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/;
const isDiagramFile = () => [...document.body.children]
  .every(child => DIAGRAM_FILE_TAGS.test(child.tagName) || child.classList.contains('graphally-view'));

// The first compile names the icons the diagram draws; a second draws them, once fetched.
async function compileWithIcons(diagram, options, icons) {
  const result = compile(diagram, options);
  if (!icons.used.size) return result;
  const wanted = [...icons.used];
  icons.used.clear();
  await icons.fetch(wanted);
  return compile(diagram, options);
}

// The diagram's SVG and, below it, its problems. Warnings are for the author at the render; a
// reader of the page is not shown them.
async function diagramNodes(diagram, view, icons, alone) {
  const theme = diagram.getAttribute('theme') || (prefersDark() ? 'dark' : 'light');
  const source = location.pathname.split('/').pop(), model = diagram.hasAttribute('data-edit');
  const options = { standalone: false, css: THEME, theme, source, model };
  view.dataset.theme = theme;
  if (alone && diagram.getAttribute('theme')) {
    document.documentElement.dataset.graphallyTheme = diagram.getAttribute('theme');
  }
  const result = await compileWithIcons(diagram, options, icons);
  // An editor (data-edit on the diagram) reads each element's box and layout from the view.
  if (model) view.graphallyModel = result.model;
  const problems = result.problems.filter(problem => !problem.warn);
  if (diagram.querySelector('include')) problems.unshift(INCLUDE_PROBLEM);
  const template = document.createElement('template');
  template.innerHTML = result.svg;
  return [...template.content.childNodes, ...(problems.length ? [problemsList(problems)] : [])];
}

async function renderDiagram(diagram, icons, alone) {
  const { view, shadow } = viewOf(diagram);
  try {
    show(shadow, await diagramNodes(diagram, view, icons, alone));
  } catch (error) {
    show(shadow, [failureNote(error)]);
  }
}

// Every diagram on the page, or only the one given (an editor redrawing one of its own).
async function renderAll(icons, only) {
  await fontsLoaded();
  muteDiagramStyles();
  const diagrams = only ? [only] : [...document.querySelectorAll('diagram')];
  await imagesDecoded(diagrams);
  const alone = isDiagramFile();
  if (alone) document.documentElement.dataset.graphallyPage = '';
  for (const diagram of diagrams) await renderDiagram(diagram, icons, alone);
  document.documentElement.dataset.graphally = 'ready';
}

export function start(index) {
  const sources = {
    azure: index.azure.base, aws: index.aws.base, font: index.font,
    ...(globalThis.graphallyOptions || {}),
  };
  addPageStyle(sources.font);
  keepDiagramStylesMuted();
  const icons = registerLazyPacks(index, sources), render = only => renderAll(icons, only);
  globalThis.graphally = { render };
  // Switching the system theme redraws the diagrams in the other one.
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => render(), { once: true });
  else render();
}
