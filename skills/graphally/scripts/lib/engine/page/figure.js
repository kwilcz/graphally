// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The figure as it is built: the laid-out page, and what each stage adds to it. The stages
// (build-figure.js) take it in turn; each reads what the ones before it left.
import { tokenColors, painter } from './colors.js';

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
    pageRect: null, paintOf: null,
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
}
