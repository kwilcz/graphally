// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The figure as it is built: the laid-out page, and what each stage adds to it. The stages
// (build-figure.js) take it in turn; each reads what the ones before it left.
import { tokenColors, painter, writtenColors } from './colors.js';
import { T, TEXT_SIZE } from '../style.js';

export function createFigure({ root, diagram, options, measurer, problems }) {
  const figure = {
    root, diagram, options, measurer, problems,
    id: diagram.id || 'pg',
    // The icons' symbols for the defs, by id.
    symbols: new Map(),
    // What the script adds: connections, drawn marks and animations (an element's by the element,
    // a mark's on the mark), and the upright runs of its dependency lines.
    edges: [], drawings: [], animations: [], animationOf: new Map(), dependRuns: [],
    // What the walk adds: the markup, the boxes and lines of text the router and the checks see,
    // the paints for the defs, the outlines of turned elements, the steps, and whether anything
    // is drawn grey.
    out: [], boxes: [], texts: [], paints: [], turnedOutlines: [], steps: new Set(), greyed: false,
    // Set when the page is measured.
    pageRect: null, paintOf: null, colorOf: null, lineLabel: { font: '', color: null },
    // An element's box on the page.
    boxOf: element => {
      const rect = element.getBoundingClientRect(), page = figure.pageRect;
      return { x: rect.left - page.left, y: rect.top - page.top, w: rect.width, h: rect.height };
    },
  };
  return figure;
}

// Reads where the laid-out page is, and the colours of the theme's tokens.
export function measurePage(figure) {
  figure.pageRect = figure.root.getBoundingClientRect();
  figure.paintOf = painter(tokenColors(figure.root));
  figure.colorOf = writtenColors(figure.root, figure.paintOf);
  readLineLabel(figure);
}

// A custom property as the author wrote it in the diagram's style. Its computed value has its
// var()s replaced, which would fix a theme token (var(--ink)) at its light colour.
function writtenProperty(root, name) {
  const pattern = new RegExp(`${name}\\s*:\\s*([^;}]+)`);
  for (const style of root.querySelectorAll('style')) {
    const match = style.textContent.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

// The lines' labels in a style of the author's own, set on :root: --line-label-font (a CSS font,
// 600 14px 'IBM Plex Sans') and --line-label-color. Measured in it, so the router leaves them room.
// The theme's line label, 11.5px, grows with --text-size like the rest of the theme's text.
const LABEL_FAMILY = 'Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';
function scaledLabelFont(textSizeValue) {
  const size = /^[\d.]+px$/.test(textSizeValue) ? parseFloat(textSizeValue) : TEXT_SIZE;
  return size === TEXT_SIZE ? '' : `400 ${(11.5 * size) / TEXT_SIZE}px ${LABEL_FAMILY}`;
}

function readLineLabel(figure) {
  const style = getComputedStyle(figure.root), own = name => style.getPropertyValue(name).trim();
  const font = own('--line-label-font') || scaledLabelFont(own('--text-size'));
  const color = writtenProperty(figure.root, '--line-label-color') || own('--line-label-color');
  figure.lineLabel = { font: font ? `font: ${font}; ` : '', color: color ? figure.colorOf(color) : null };
  if (font) figure.measurer.restyle(T.edge, `font: ${font}`);
}
