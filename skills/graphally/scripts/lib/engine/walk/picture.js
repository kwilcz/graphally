// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Pictures: icons, images and inline SVG, drawn in the element's content box.
import { svgElement, attributesOf, boxAttributes, escapeXml } from '../svg.js';
import { contentBoxOf } from '../css/box.js';

const IMAGE_ASPECT = { contain: 'xMidYMid meet', 'scale-down': 'xMidYMid meet', cover: 'xMidYMid slice' };
const PICTURE_TAGS = new Set(['ICON', 'IMG', 'svg']);

export const isPicture = element => PICTURE_TAGS.has(element.tagName);
const inkOf = (figure, style) => figure.paintOf(style.color) || 'var(--ink)';

// An inline <svg>, copied into the figure at its content box and coloured by its CSS colour.
// Without a viewBox, the drawing keeps the size its own width and height gave it.
function inlineSvgOf(figure, element, style, placement) {
  const copy = element.cloneNode(true);
  for (const attribute of ['x', 'y', 'width', 'height', 'style', 'class', 'id']) {
    copy.removeAttribute(attribute);
  }
  const width = element.getAttribute('width'), height = element.getAttribute('height');
  if (!copy.hasAttribute('viewBox') && Number(width) > 0 && Number(height) > 0) {
    copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  copy.setAttribute('style', `color: ${inkOf(figure, style)}`);
  // An inline SVG clips to its box unless its CSS says overflow: visible, as in a page.
  if (style.overflow === 'visible') copy.setAttribute('overflow', 'visible');
  return new XMLSerializer().serializeToString(copy).replace(/^<svg /, `<svg${attributesOf(placement)} `);
}

// An <img>, embedded as a data: URL by the CLI (run.js) so the SVG keeps it wherever it is
// opened. An image that did not load, or could not be embedded, is reported.
function imageOf(figure, element, style, placement) {
  const source = element.currentSrc || element.src;
  const written = element.dataset.src || element.getAttribute('src') || '';
  if (!element.complete || !element.naturalWidth) {
    figure.problems.push({
      rule: 'image-missing', src: written,
      hint: 'the image did not load: check the path, relative to the diagram file',
    });
    return null;
  }
  if (!source.startsWith('data:')) {
    figure.problems.push({
      rule: 'image-link', warn: true, src: written,
      hint: 'the SVG links the image instead of holding it: use a file next to the diagram',
    });
  }
  const aspect = IMAGE_ASPECT[style.objectFit] || 'none';
  return svgElement('image', { href: escapeXml(source), ...placement, preserveAspectRatio: aspect });
}

export function drawPicture(figure, element, style, box) {
  if (element.tagName === 'ICON') {
    if (!element.dataset.symbol) return;
    const symbol = { href: `#${element.dataset.symbol}`, ...boxAttributes(box) };
    figure.out.push(svgElement('use', { ...symbol, style: `color: ${inkOf(figure, style)}` }));
    return;
  }
  const placement = boxAttributes(contentBoxOf(style, box));
  const drawn = element.tagName === 'svg' ? inlineSvgOf : imageOf;
  const picture = drawn(figure, element, style, placement);
  if (picture) figure.out.push(picture);
}
