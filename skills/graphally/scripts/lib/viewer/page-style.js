// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The styles the viewer adds: Inter's faces and the page around the diagrams, and what each
// diagram's shadow root shows.
import { hostTheme } from '../engine/style.js';

export const WEIGHTS = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };

// One weight of Inter: the file at fontBase, else an installed Inter.
const fontFace = (fontBase, weight, name) => '@font-face { font-family: Inter; '
  + `font-weight: ${weight}; font-display: block; `
  + `src: url("${fontBase}Inter-${name}.woff2") format("woff2"), local("Inter ${name}"), local("Inter"); }`;

const fontFaces = fontBase => Object.entries(WEIGHTS)
  .map(([weight, name]) => fontFace(fontBase, weight, name))
  .join('\n');

// The body of a file that holds only diagrams, when it does not ask for the light theme.
const DIAGRAM_PAGE_BODY = 'html[data-graphally-page]:not([data-graphally-theme="light"]) body';

// A diagram follows the reader's light or dark setting unless it names a theme. A file that holds
// only diagrams follows too (data-graphally-page); a page they are embedded in keeps its own
// colours. Fonts are declared here: a shadow root uses the page's.
export function addPageStyle(fontBase) {
  const style = document.createElement('style');
  style.textContent = `${fontFaces(fontBase)}\ndiagram { display: none; }
@media (prefers-color-scheme: dark) { ${DIAGRAM_PAGE_BODY} { background: #0f131e; color: #e3e8f3; } }
.graphally-view { display: block; margin: 16px auto; width: max-content; max-width: 100%; overflow: auto; }`;
  document.head.append(style);
}

const PROBLEMS_FONT = '12px/1.5 Inter, "Segoe UI", system-ui, sans-serif';

// What a shadow root shows: the theme's tokens on its host, and a box that inherits no font or
// spacing from the page (a letter-spacing on body would widen every label).
export const viewCss = theme => `${hostTheme(theme)}
.view { all: initial; display: block; }
svg { display: block; }
.problems { font: ${PROBLEMS_FONT}; color: var(--rust); margin: 6px 0 0; padding: 0 0 0 18px; }`;
