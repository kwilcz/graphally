// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The walk: the laid-out page, element by element, becomes the figure's markup, boxes and text.
import { fmt, openTag, svgElement, escapeXml } from '../svg.js';
import { drawText } from './text.js';
import { isPicture, drawPicture } from './picture.js';
import { clipsContent, openClip, outlineOf } from './paints.js';
import { startTurn } from './turn.js';
import { drawFrame } from './frame.js';

// data-step="n": the element appears in its turn when the figure is shown (see motion.js).
function stepOf(figure, element) {
  const value = element.getAttribute('data-step');
  if (value == null) return 0;
  if (!(Number(value) > 0)) {
    figure.problems.push({
      rule: 'bad-attribute', attr: 'data-step', value, ...(element.id ? { id: element.id } : {}),
      hint: 'a number from 1, the order the element appears in',
    });
    return 0;
  }
  figure.steps.add(Number(value));
  return Number(value);
}

// The groups an element is drawn in, outermost first: its step and animation when the figure is
// shown, its opacity and grey filter (what disabled does), and its turn. Returns the function
// that closes them, innermost first.
function openGroups(figure, element, style, turn) {
  const opacity = parseFloat(style.opacity), grey = /grayscale\((?!0\b|0%)/.test(style.filter);
  if (grey) figure.greyed = true;
  const step = stepOf(figure, element), animation = figure.animationOf.get(element);
  const groups = [
    step && openTag('g', { 'data-step': step }),
    animation != null && openTag('g', { 'data-anim': animation }),
    (opacity < 1 || grey) && openTag('g', {
      opacity: opacity < 1 && fmt(opacity),
      filter: grey && `url(#${figure.id}-grey)`,
    }),
    turn?.group,
  ].filter(Boolean);
  figure.out.push(...groups);
  return () => {
    for (let count = 0; count < groups.length; count++) figure.out.push('</g>');
    turn?.end();
  };
}

// A list item with disc bullets: its bullet, before its first line.
function bulletOf(figure, element, style) {
  if (style.display !== 'list-item' || style.listStyleType !== 'disc' || !element.firstChild) return null;
  const range = document.createRange();
  range.selectNodeContents(element);
  const firstLine = range.getClientRects()[0];
  if (!firstLine) return null;
  const fontSize = parseFloat(style.fontSize);
  return svgElement('circle', {
    cx: fmt(firstLine.left - figure.pageRect.left - fontSize * 0.7),
    cy: fmt(firstLine.top - figure.pageRect.top + firstLine.height * 0.55),
    r: fmt(fontSize * 0.17),
    style: `fill: ${figure.paintOf(style.color) || 'var(--ink)'}`,
  });
}

// The layout the next render reads back (snapshot.mjs): the element's box, and the author's nudge.
function layoutGroup(element, box) {
  const nudge = element.getAttribute('nudge');
  return openTag('g', {
    'data-id': escapeXml(element.id),
    'data-box': [box.x, box.y, box.w, box.h].map(value => Math.round(value * 2) / 2).join(','),
    'data-nudge': nudge ? escapeXml(nudge) : null,
  });
}

const isDrawnElement = node => node.nodeType === 1 && node.tagName !== 'STYLE' && node.tagName !== 'SCRIPT';

// An element's own drawing: its frame and bullet, what is inside it (clipped when it clips) and
// its outline, in a group with its id when it has one.
function drawElement(figure, element, style, box, parentBox) {
  if (element.id) figure.out.push(layoutGroup(element, box));
  const { frame, ownBox } = drawFrame(figure, element, style, box, parentBox);
  const bullet = bulletOf(figure, element, style);
  if (bullet) figure.out.push(bullet);
  const clipped = clipsContent(element, style);
  if (clipped) openClip(figure, box, frame.border, frame.cornerRadius);
  for (const child of element.childNodes) {
    if (child.nodeType === 3) drawText(figure, child, element);
    else if (isDrawnElement(child)) visit(figure, child, ownBox || parentBox);
  }
  if (clipped) figure.out.push('</g>');
  const outline = outlineOf(figure, style, box, frame.cornerRadius);
  if (outline) figure.out.push(outline);
  if (element.id) figure.out.push('</g>');
}

// A picture (an icon, an image, an inline SVG), in a group with its id when it has one, as any
// element is, so the next render reads its box back too.
function drawPictureElement(figure, element, style, box, parentBox) {
  if (element.id) figure.out.push(layoutGroup(element, box));
  drawPicture(figure, element, style, box);
  if (element.id) figure.out.push('</g>');
  figure.boxes.push({ element, box, painted: true, parent: parentBox });
}

function visit(figure, element, parentBox) {
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return;
  const turn = startTurn(figure, element, style);
  const box = figure.boxOf(element);
  const closeGroups = openGroups(figure, element, style, turn);
  const draw = isPicture(element) ? drawPictureElement : drawElement;
  draw(figure, element, style, box, parentBox);
  closeGroups();
}

export function walkPage(figure) {
  for (const child of figure.root.childNodes) {
    if (child.nodeType === 3) drawText(figure, child, figure.root);
    else if (child.nodeType === 1 && child.tagName !== 'STYLE') visit(figure, child, null);
  }
}
