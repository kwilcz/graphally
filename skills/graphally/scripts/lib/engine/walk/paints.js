// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Paints: gradients, shadow blurs and clips go into the figure's <defs>, and outlines on top.
import { fmt, roundTo, openTag, svgElement, boxAttributes } from '../svg.js';
import { colorAndOpacity } from '../css/values.js';
import { DASH_PATTERN } from '../css/box.js';

// Ids are unique in the figure: its id, the kind, and how many paints come before.
const nextPaintId = (figure, kind) => `${figure.id}-${kind}${figure.paints.length}`;
const opacityValue = opacity => (opacity < 1 ? roundTo(opacity, 3) : null);

// A linear-gradient() background as a fill: the gradient goes in the defs, the fill points at it.
export function gradientFill(figure, gradient) {
  const gradientId = nextPaintId(figure, 'grad');
  const stops = gradient.stops.map(stop => {
    const [color, opacity] = colorAndOpacity(figure.paintOf(stop.color) || 'rgba(0, 0, 0, 0)');
    return svgElement('stop', {
      offset: roundTo(stop.at, 4),
      'stop-color': color,
      'stop-opacity': opacityValue(opacity),
    });
  });
  const line = { x1: fmt(gradient.x1), y1: fmt(gradient.y1), x2: fmt(gradient.x2), y2: fmt(gradient.y2) };
  const definition = { id: gradientId, gradientUnits: 'userSpaceOnUse', ...line };
  figure.paints.push(svgElement('linearGradient', definition, stops.join('')));
  return `url(#${gradientId})`;
}

// A Gaussian blur for a shadow. Its region reaches three deviations past the shape, where the
// blur has faded out; a CSS blur of B is a Gaussian of deviation B/2.
function blurFilter(figure, shape, blur) {
  const filterId = nextPaintId(figure, 'blur'), reach = blur * 1.5;
  const region = { x: shape.x - reach, y: shape.y - reach, w: shape.w + 2 * reach, h: shape.h + 2 * reach };
  const gaussian = svgElement('feGaussianBlur', { stdDeviation: fmt(blur / 2) });
  const definition = { id: filterId, filterUnits: 'userSpaceOnUse', ...boxAttributes(region) };
  figure.paints.push(svgElement('filter', definition, gaussian));
  return `url(#${filterId})`;
}

// A box-shadow: the box grown by its spread and moved by its offset, then blurred. Its corners
// grow with the spread, as a browser draws them.
export function shadowOf(figure, shadow, box, cornerRadius) {
  const [color, opacity] = colorAndOpacity(figure.paintOf(shadow.color) || 'rgb(0, 0, 0)');
  const shape = {
    x: box.x + shadow.x - shadow.spread,
    y: box.y + shadow.y - shadow.spread,
    w: box.w + 2 * shadow.spread,
    h: box.h + 2 * shadow.spread,
  };
  return svgElement('rect', {
    ...boxAttributes(shape),
    rx: fmt(cornerRadius > 0 ? Math.max(0, cornerRadius + shadow.spread) : 0),
    style: `fill: ${color}`,
    'fill-opacity': opacityValue(opacity),
    filter: shadow.blur > 0 && blurFilter(figure, shape, shadow.blur),
  });
}

// overflow other than visible clips what is inside to the padding box, corners included. An
// element with nothing inside (an empty Gantt bar) needs no clip.
export function clipsContent(element, style) {
  if (style.overflowX === 'visible' && style.overflowY === 'visible') return false;
  return [...element.childNodes].some(child => child.nodeType === 1 || child.textContent.trim());
}

export function openClip(figure, box, border, cornerRadius) {
  const clipId = nextPaintId(figure, 'clip'), [top, right, bottom, left] = border.widths;
  const inner = { x: box.x + left, y: box.y + top, w: box.w - left - right, h: box.h - top - bottom };
  const innerRadius = Math.max(0, cornerRadius - Math.max(top, left));
  const rect = svgElement('rect', { ...boxAttributes(inner), rx: fmt(innerRadius) });
  figure.paints.push(svgElement('clipPath', { id: clipId }, rect));
  figure.out.push(openTag('g', { 'clip-path': `url(#${clipId})` }));
}

// outline: a ring outside the border, outline-offset away from it, round where the border is.
export function outlineOf(figure, style, box, cornerRadius) {
  const width = style.outlineStyle === 'none' ? 0 : parseFloat(style.outlineWidth) || 0;
  if (!width) return null;
  const outset = (parseFloat(style.outlineOffset) || 0) + width / 2;
  const ring = { x: box.x - outset, y: box.y - outset, w: box.w + 2 * outset, h: box.h + 2 * outset };
  return svgElement('rect', {
    ...boxAttributes(ring),
    rx: fmt(cornerRadius > 0 ? cornerRadius + outset : 0),
    style: `fill: none; stroke: ${figure.paintOf(style.outlineColor) || 'var(--ink)'}`,
    'stroke-width': fmt(width),
    'stroke-dasharray': DASH_PATTERN[style.outlineStyle],
  });
}
