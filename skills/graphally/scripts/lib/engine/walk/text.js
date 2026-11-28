// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Text: each line a text node wraps to becomes a <text> at the place the browser gave it.
import { fmt, svgElement, escapeXml } from '../svg.js';

const textMeasure = document.createElement('canvas').getContext('2d');
const fontOf = style => `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
const CASE = { uppercase: text => text.toUpperCase(), lowercase: text => text.toLowerCase() };
const casedFor = style => CASE[style.textTransform] || (text => text);

function ascentOf(style) {
  textMeasure.font = fontOf(style);
  return textMeasure.measureText('Hg').fontBoundingBoxAscent;
}

// The pieces of a word, one per line it is on: the browser may break a word at a hyphen.
function piecesOf(rectsOf, start, word) {
  const end = start + word.length;
  if (rectsOf(start, end).length <= 1) return [[word, rectsOf(start, end)[0]]];
  const breaks = [0];
  let lineTop = rectsOf(start, start + 1)[0]?.top;
  for (let index = 1; index < word.length; index++) {
    const top = rectsOf(start + index, start + index + 1)[0]?.top;
    if (top != null && lineTop != null && Math.abs(top - lineTop) > 2) breaks.push(index);
    if (top != null) lineTop = top;
  }
  breaks.push(word.length);
  return breaks.slice(1).map((pieceEnd, piece) =>
    [word.slice(breaks[piece], pieceEnd), rectsOf(start + breaks[piece], start + pieceEnd)[0]]);
}

// The lines a text node wraps to, each with its words and its place on the page.
function linesOf(node, pageRect) {
  const range = document.createRange(), lines = [];
  const rectsOf = (from, to) => {
    range.setStart(node, from);
    range.setEnd(node, to);
    return [...range.getClientRects()].filter(rect => rect.width);
  };
  for (const match of node.textContent.matchAll(/\S+/g)) {
    const pieces = piecesOf(rectsOf, match.index, match[0]).filter(([, rect]) => rect);
    for (const [word, rect] of pieces) addToLine(lines, word, rect, pageRect);
  }
  return lines;
}

// A piece of a word on the line at its height, a new line when none is there yet.
function addToLine(lines, word, rect, pageRect) {
  const top = rect.top - pageRect.top;
  let line = lines.find(candidate => Math.abs(candidate.top - top) < 2);
  if (!line) {
    line = { top, left: rect.left - pageRect.left, right: 0, words: [], height: rect.height };
    lines.push(line);
  }
  line.words.push(word);
  line.right = rect.right - pageRect.left;
}

// Underline and line-through reach the text from its own element or any one around it.
function decorationsOf(owner, root) {
  const lines = [];
  for (let element = owner; element && element !== root; element = element.parentElement) {
    lines.push(...getComputedStyle(element).textDecorationLine.split(' '));
  }
  return [...new Set(lines.filter(line => line === 'underline' || line === 'line-through'))];
}

// The style attribute of a line of text: its font, spacing, decoration and colour.
function textStyleOf(figure, style, owner) {
  const decorations = decorationsOf(owner, figure.root);
  return [
    `font-family: ${escapeXml(style.fontFamily)}`,
    `font-size: ${style.fontSize}`,
    `font-weight: ${style.fontWeight}`,
    style.fontStyle !== 'normal' && `font-style: ${style.fontStyle}`,
    style.letterSpacing !== 'normal' && `letter-spacing: ${style.letterSpacing}`,
    decorations.length && `text-decoration: ${decorations.join(' ')}`,
    `fill: ${figure.paintOf(style.color) || 'var(--ink)'}`,
  ].filter(Boolean).join('; ');
}

// text-overflow: ellipsis on the block that clips a line: the right edge of the block's content
// box, where the browser cuts the line. Null when nothing cuts it.
function ellipsisEdgeOf(owner, root, pageRect) {
  let block = owner;
  const isInline = element => getComputedStyle(element).display.startsWith('inline');
  while (block !== root && isInline(block)) block = block.parentElement;
  const blockStyle = getComputedStyle(block);
  if (blockStyle.textOverflow !== 'ellipsis' || blockStyle.overflowX === 'visible') return null;
  const contentRight = block.getBoundingClientRect().right - pageRect.left;
  return contentRight - parseFloat(blockStyle.borderRightWidth) - parseFloat(blockStyle.paddingRight);
}

// The longest start of the text that fits the width with an ellipsis after it.
function withEllipsis(text, style, width) {
  textMeasure.font = fontOf(style);
  let kept = text;
  while (kept && textMeasure.measureText(`${kept}…`).width > width) kept = kept.slice(0, -1);
  return `${kept.trimEnd()}…`;
}

// Text set on its side (writing-mode: sideways-lr reads upward, as a BPMN pool's name;
// vertical-rl and sideways-rl read downward): one <text>, turned a quarter round about the
// centre of the box the browser gave it, its baseline at the ascent from that box's top.
function drawSideways(figure, node, owner, style) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect(), page = figure.pageRect;
  const cx = rect.left - page.left + rect.width / 2, cy = rect.top - page.top + rect.height / 2;
  const turn = style.writingMode === 'sideways-lr' ? -90 : 90;
  const text = casedFor(style)(node.textContent.trim().replace(/\s+/g, ' '));
  const size = parseFloat(style.fontSize), base = cy - rect.width / 2 + ascentOf(style);
  figure.texts.push({ x: cx - rect.width / 2, y: cy - rect.height / 2, w: rect.width, h: rect.height,
    owner, text, base, size, sideways: true });
  const attributes = { x: fmt(cx), y: fmt(base), 'text-anchor': 'middle',
    transform: `rotate(${turn} ${fmt(cx)} ${fmt(cy)})`, style: textStyleOf(figure, style, owner) };
  figure.out.push(svgElement('text', attributes, escapeXml(text)));
}

export function drawText(figure, node, owner) {
  if (!node.textContent.trim()) return;
  const style = getComputedStyle(owner);
  if (style.writingMode !== 'horizontal-tb') return drawSideways(figure, node, owner, style);
  const ascent = ascentOf(style), cased = casedFor(style);
  const lines = linesOf(node, figure.pageRect);
  const textStyle = textStyleOf(figure, style, owner);
  const ellipsisEdge = ellipsisEdgeOf(owner, figure.root, figure.pageRect);
  for (const line of lines) {
    let text = cased(line.words.join(' '));
    if (ellipsisEdge != null && line.right > ellipsisEdge + 0.5) {
      text = withEllipsis(text, style, ellipsisEdge - line.left);
      line.right = line.left + textMeasure.measureText(text).width;
    }
    const base = line.top + ascent, size = parseFloat(style.fontSize);
    const w = line.right - line.left;
    figure.texts.push({ x: line.left, y: line.top, w, h: line.height, owner, text, base, size });
    const position = { x: fmt(line.left), y: fmt(line.top + ascent) };
    figure.out.push(svgElement('text', { ...position, style: textStyle }, escapeXml(text)));
  }
}
