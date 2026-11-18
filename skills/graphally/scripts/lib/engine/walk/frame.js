// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Frames: an element's background, border and shadows, and the box the router and checks see.
import { fmt, svgElement, boxAttributes } from '../svg.js';
import { linearGradient } from '../css/gradient.js';
import { DASH_PATTERN, bordersOf, cornerRadiusOf, boxShadows, polygonOf } from '../css/box.js';
import { parseShape, drawShape } from '../shapes/shapes.js';
import { closestName } from '../shared/messages.js';
import { gradientFill, shadowOf } from './paints.js';

// The frame the computed style describes. A gradient goes into the defs as it is read.
function frameOf(figure, style, box) {
  const gradient = linearGradient(style.backgroundImage, box);
  const firstStop = gradient && figure.paintOf(gradient.stops[0].color);
  const background = figure.paintOf(style.backgroundColor) || firstStop;
  const frame = {
    background,
    fill: gradient ? gradientFill(figure, gradient) : background,
    shadows: boxShadows(style.boxShadow),
    border: bordersOf(style),
    polygon: polygonOf(style.clipPath, box),
    cornerRadius: cornerRadiusOf(style, box),
  };
  frame.visible = Boolean(background || frame.border.drawn || frame.polygon || frame.shadows.length);
  return frame;
}

// shape="…": the library's shape, or null; an unknown name is reported with a suggestion.
function shapeOf(figure, element) {
  if (!element.hasAttribute('shape')) return null;
  const shape = parseShape(element.getAttribute('shape'));
  if (!shape.error) return shape;
  const suggestion = closestName(shape.error, shape.options);
  const suggest = suggestion ? { suggest: suggestion } : {};
  figure.problems.push({ rule: 'unknown-shape', shape: shape.error, ...suggest });
  return null;
}

// The library draws the element's background and border as its shape.
function drawShapedFrame(figure, shape, frame, box) {
  const top = frame.border.sides[0];
  figure.out.push(...drawShape(shape, box, {
    fill: frame.background || 'none',
    stroke: top.width ? figure.paintOf(top.color) || 'var(--ink)' : 'none',
    width: top.width,
    dash: DASH_PATTERN[top.style] || '',
  }));
  return { round: shape.round, plain: false };
}

// The fill, stroked when all four sides of the border match: a polygon for a clip-path, else a
// rectangle inset by half the border, so that the stroke lies inside the box.
function frameBodyOf(figure, frame, box) {
  const { border, polygon, cornerRadius } = frame, top = border.sides[0];
  const fill = `fill: ${frame.fill || 'none'}`;
  const stroke = {
    style: `${fill}; stroke: ${figure.paintOf(top.color)}`,
    'stroke-width': top.width,
    'stroke-dasharray': DASH_PATTERN[top.style],
  };
  const fillAndStroke = border.uniform ? stroke : { style: fill };
  if (polygon) {
    const points = polygon.map(point => `${fmt(point.x)},${fmt(point.y)}`).join(' ');
    return svgElement('polygon', { points, ...fillAndStroke });
  }
  if (border.uniform) {
    const inset = top.width / 2;
    const inner = { x: box.x + inset, y: box.y + inset, w: box.w - top.width, h: box.h - top.width };
    const innerRadius = Math.max(0, cornerRadius - inset);
    return svgElement('rect', { ...boxAttributes(inner), rx: fmt(innerRadius), ...fillAndStroke });
  }
  if (!frame.fill) return null;
  return svgElement('rect', { ...boxAttributes(box), rx: fmt(cornerRadius), ...fillAndStroke });
}

// Borders that differ per side: a line along each side that has one, drawn just inside it.
function sideBordersOf(figure, border, box) {
  const left = box.x, top = box.y, right = box.x + box.w, bottom = box.y + box.h;
  const edges = [
    { from: [left, top], to: [right, top], inward: [0, 1] },
    { from: [right, top], to: [right, bottom], inward: [-1, 0] },
    { from: [left, bottom], to: [right, bottom], inward: [0, -1] },
    { from: [left, top], to: [left, bottom], inward: [1, 0] },
  ];
  return border.sides.flatMap((side, index) => {
    if (!side.width) return [];
    const { from, to, inward } = edges[index];
    const shiftX = inward[0] * side.width / 2, shiftY = inward[1] * side.width / 2;
    return [svgElement('line', {
      x1: fmt(from[0] + shiftX),
      y1: fmt(from[1] + shiftY),
      x2: fmt(to[0] + shiftX),
      y2: fmt(to[1] + shiftY),
      style: `stroke: ${figure.paintOf(side.color) || 'var(--ink)'}`,
      'stroke-width': side.width,
      'stroke-dasharray': DASH_PATTERN[side.style],
    })];
  });
}

// A frame drawn from its parts: shadows, then the body, then the borders that differ per side.
// A round frame is a circle to the router; a plain one has nothing drawn.
function drawBoxFrame(figure, frame, box) {
  const { border, polygon, cornerRadius } = frame;
  if (!polygon) {
    for (const shadow of frame.shadows) figure.out.push(shadowOf(figure, shadow, box, cornerRadius));
  }
  const body = frameBodyOf(figure, frame, box);
  if (body) figure.out.push(body);
  if (!border.uniform && !polygon) figure.out.push(...sideBordersOf(figure, border, box));
  const circular = cornerRadius >= Math.min(box.w, box.h) / 2 - 0.5 && Math.abs(box.w - box.h) < 2;
  return {
    round: (Boolean(polygon) && polygon.length === 4) || circular,
    plain: !frame.background && !border.drawn && !polygon && !frame.shadows.length,
  };
}

// Draws an element's frame and enters it in the boxes the router and the checks see. An element
// with nothing drawn is entered only when it has an id, for lines to reach it.
export function drawFrame(figure, element, style, box, parentBox) {
  const frame = frameOf(figure, style, box);
  const shape = shapeOf(figure, element);
  const entry = { element, box, painted: true, parent: parentBox, background: frame.background };
  let ownBox = null;
  if (shape) ownBox = { ...entry, ...drawShapedFrame(figure, shape, frame, box) };
  else if (frame.visible) ownBox = { ...entry, ...drawBoxFrame(figure, frame, box) };
  else if (element.id) ownBox = { element, box, painted: false, parent: parentBox };
  if (ownBox) figure.boxes.push(ownBox);
  return { frame, ownBox };
}
