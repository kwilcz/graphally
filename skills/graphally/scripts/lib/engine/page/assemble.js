// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The figure's SVG: the defs and stylesheet, its background, then the page, the lines, the
// script's drawings and, on top, every label.
import { openTag, svgElement, escapeXml } from '../svg.js';
import { countCrossings } from '../checks/lines.js';
import { motionCss } from './motion.js';
import { animationCss } from './animation.js';

// What disabled parts are drawn through: their colours made grey.
const greyFilter = figureId => svgElement('filter', {
  id: `${figureId}-grey`, 'color-interpolation-filters': 'sRGB',
}, svgElement('feColorMatrix', { type: 'saturate', values: 0 }));

function stylesheetOf(figure, routes, steps) {
  const { options } = figure;
  const moves = steps.order.length || routes.some(route => route.edge.flow) || figure.animations.length;
  const motion = moves ? motionCss(steps, animationCss(figure.animations, figure.id, figure.problems)) : null;
  const ownCss = options.standalone ? `<style>${options.css}</style>\n` : '';
  return ownCss + (motion ? `<style>${motion}</style>\n` : '');
}

// The figure paints its own background, so it reads on a dark page as on a light one: the
// theme's --bg, a colour of the author's (background="#fff"), or none (background=none).
function backgroundOf(diagram, { width, height }) {
  const color = (diagram.getAttribute('background') || '').trim();
  if (color === 'none') return '';
  const fill = color ? escapeXml(color) : 'var(--bg)';
  return `${svgElement('rect', { class: 'g-bg', width, height, style: `fill: ${fill}` })}\n`;
}

function defsOf(figure, markers) {
  const defs = [...markers.defs(), ...figure.symbols.values(), ...figure.paints];
  return figure.greyed ? [...defs, greyFilter(figure.id)] : defs;
}

function svgOpenTag({ diagram, options }, { width, height }) {
  const titles = [diagram.getAttribute('title'), diagram.getAttribute('subtitle')];
  const label = titles.filter(Boolean).join('. ') || 'Diagram';
  return openTag('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    class: 'graphally',
    'data-theme': options.theme === 'dark' ? 'dark' : null,
    'data-source': options.source ? escapeXml(options.source) : null,
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: 'img',
    'aria-label': escapeXml(label),
  });
}

// Bottom to top: the page, the lines, the script's drawings, and every label.
const layersOf = (figure, lines, marks) =>
  [figure.out, lines.lines, marks.marks, [...lines.labels, ...marks.labels]].map(layer => layer.join('\n')).join('\n');

const statsOf = (figure, routes) => ({
  nodes: figure.boxes.filter(entry => entry.element.id).length,
  groups: 0,
  edges: routes.length,
  crossings: countCrossings(routes),
});

export function assembleSvg(figure, { routes, lines, marks, markers, steps, size }) {
  const defs = defsOf(figure, markers), stylesheet = stylesheetOf(figure, routes, steps);
  const head = `${stylesheet}<defs>${defs.join('\n')}</defs>\n${backgroundOf(figure.diagram, size)}`;
  const svg = `${svgOpenTag(figure, size)}\n${head}<g>\n${layersOf(figure, lines, marks)}\n</g>\n</svg>`;
  return {
    svg, width: size.width, height: size.height,
    problems: figure.problems, stats: statsOf(figure, routes), snapshot: null,
  };
}
