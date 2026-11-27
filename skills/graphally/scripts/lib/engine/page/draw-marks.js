// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The script's drawings as SVG: paths, gates, text, icons and shapes, each where the script put
// it; a mark that animates in a group of its own.
import { S, T } from '../style.js';
import { fmt, openTag, svgElement, escapeXml } from '../svg.js';
import { toneOf } from '../shared/tokens.js';
import { closestName } from '../shared/messages.js';
import { parseShape, drawShape } from '../shapes/shapes.js';
import { haloAt } from './colors.js';
import { endsOf } from './markers.js';

const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
// BPMN events and gateways have sizes of their own.
const SHAPE_SIZE = { start: 36, event: 36, end: 36, gateway: 44, cycle: 28 };

const colorOf = (figure, value, fallback) => figure.colorOf(toneOf(value)) || fallback;

// arrow and curve labels: beside the middle of a vertical line, above a horizontal one.
function pathLabel(figure, { ends: [from, to], via, options }) {
  const upright = Math.abs(to.x - from.x) < Math.abs(to.y - from.y);
  const x = via.x + (upright ? 7 : 0), y = via.y - (upright ? 0 : 9);
  return svgElement('text', {
    class: T.edge, x: fmt(x), y: fmt(y + 4), 'text-anchor': upright ? 'start' : 'middle',
    style: `fill: var(--ink); ${haloAt(figure.boxes, x, y)}`,
  }, escapeXml(options.label));
}

function pathMark(figure, drawing, markers, labels) {
  const { options } = drawing, color = colorOf(figure, options.color || options.tone, 'var(--ink)');
  const path = svgElement('path', {
    d: drawing.path,
    style: `fill: ${colorOf(figure, options.fill, 'none')}; stroke: ${color}`,
    'stroke-width': options.width || S.edge.width,
    ...markers.endAttributes(endsOf(options, false, figure.problems), color),
  });
  if (options.label && drawing.via) labels.push(pathLabel(figure, drawing));
  return [path];
}

function gateMark(figure, { at: { x, y }, label, options }) {
  const half = (options.size || 30) / 2;
  const fill = colorOf(figure, options.fill || options.tone || 'rust', 'var(--rust)');
  const corners = [[x, y - half], [x + half, y], [x, y + half], [x - half, y]];
  const gate = svgElement('polygon', {
    points: corners.map(([cornerX, cornerY]) => `${fmt(cornerX)},${fmt(cornerY)}`).join(' '),
    style: `fill: ${fill}; stroke: var(--card)`, 'stroke-width': 2,
  });
  if (!label) return [gate];
  return [gate, svgElement('text', {
    x: fmt(x), y: fmt(y + 4), 'text-anchor': 'middle', style: `font: 700 11px ${FONT}; fill: var(--card)`,
  }, escapeXml(label))];
}

// halo: a rim of the colour under the text, as edge labels have. font: a family the diagram loads.
function textMark(figure, { at, text, options }) {
  const size = options.size || 12, color = colorOf(figure, options.color || options.tone, 'var(--ink)');
  const halo = options.halo ? `; ${haloAt(figure.boxes, at.x, at.y)}` : '';
  const family = options.font ? `'${String(options.font).replace(/['";]/g, '')}', ${FONT}` : FONT;
  const font = `${options.italic ? 'italic ' : ''}${options.weight || 400} ${size}px ${family}`;
  return [svgElement('text', {
    x: fmt(at.x), y: fmt(at.y + size * 0.35), 'text-anchor': options.anchor || 'middle',
    style: `font: ${font}; fill: ${color}${halo}`,
  }, escapeXml(text))];
}

// color paints a line icon (ph:…), which draws in the current colour.
function iconMark(figure, { at, symbol, options }) {
  const size = options.size || 24, color = options.color && colorOf(figure, options.color, null);
  return [svgElement('use', {
    href: `#${symbol}`, x: fmt(at.x - size / 2), y: fmt(at.y - size / 2), width: size, height: size,
    ...(color ? { style: `color: ${color}` } : {}),
  })];
}

// The same library as shape="…". An unknown shape is a problem, and nothing is drawn.
function shapeMark(figure, { shape, at, options }) {
  const spec = parseShape(shape);
  if (spec.error) {
    const suggestion = closestName(spec.error, spec.options);
    figure.problems.push({
      rule: 'unknown-shape', shape: spec.error, ...(suggestion ? { suggest: suggestion } : {}),
    });
    return null;
  }
  const size = options.size || (SHAPE_SIZE[spec.base] ?? 24);
  const w = options.w || size, h = options.h || (options.w ? w : size);
  return drawShape(spec, { x: at.x - w / 2, y: at.y - h / 2, w, h }, {
    fill: colorOf(figure, options.fill || 'card', null),
    stroke: colorOf(figure, options.stroke || options.color, 'var(--ink)'),
    width: options.width || (spec.base === 'end' ? 3 : 1.5),
    dash: options.dashed ? '5 4' : '',
  });
}

function markOf(figure, drawing, markers, labels) {
  if (drawing.kind === 'path') return pathMark(figure, drawing, markers, labels);
  if (drawing.kind === 'gate') return gateMark(figure, drawing);
  if (drawing.kind === 'text') return textMark(figure, drawing);
  if (drawing.kind === 'icon') return iconMark(figure, drawing);
  if (drawing.kind === 'shape') return shapeMark(figure, drawing);
  return [];
}

export function drawMarks(figure, markers) {
  const marks = [], labels = [];
  for (const drawing of figure.drawings) {
    const mark = markOf(figure, drawing, markers, labels);
    if (!mark) continue;
    if (drawing.animation == null) marks.push(...mark);
    else marks.push(openTag('g', { 'data-anim': drawing.animation }), ...mark, '</g>');
  }
  return { marks, labels };
}
