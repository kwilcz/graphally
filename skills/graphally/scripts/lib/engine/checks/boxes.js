// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Checks on the page's boxes and text: what overlaps, and what sticks out of what holds it.
import { S } from '../style.js';
import { excerpt } from '../shared/messages.js';
import { pairsOf } from '../shared/maps.js';

const styleOf = element => getComputedStyle(element);
const isPositioned = element => /^(absolute|fixed)$/.test(styleOf(element).position);
const clipsOverflow = element => styleOf(element).overflowX !== 'visible';

// The content is wider than the width the author set.
export function checkPageWidth(figure, size) {
  const width = parseFloat(figure.root.style.width);
  if (size.width <= width + 2 * S.pad + 1) return;
  figure.problems.push({
    rule: 'page-overflow', width, content: size.width - 2 * S.pad,
    hint: 'the content is wider than width: widen width, or narrow the columns',
  });
}

const overlap = (a, b, start, size) => Math.min(a[start] + a[size], b[start] + b[size]) - Math.max(a[start], b[start]);

// Two lines of text of different elements on top of each other, judged by the band their glyphs
// fill, not by their line boxes: display type set tight (a numeral at line-height 1) has line
// boxes that overlap where its glyphs do not. Capitals, figures and ascenders reach about 0.78 of
// the size above the baseline, other lower case 0.55; descenders 0.22 below. Accented letters
// and other scripts count as reaching both.
const TALL = /[A-Z0-9bdfhiklt!?#$%&'"/\\()[\]{}|@^]|[^\x00-\x7F]/;
const LOW = /[gjpqyQ,;()[\]{}|/\\_@]|[^\x00-\x7F]/;
export function inkOf({ text, base, size, sideways, y, h }) {
  if (sideways) return { y, h };
  const top = base - (TALL.test(text) ? 0.78 : 0.55) * size, bottom = base + (LOW.test(text) ? 0.22 : 0.02) * size;
  return { y: top, h: bottom - top };
}
const touching = (a, b) => overlap(inkOf(a), inkOf(b), 'y', 'h') <= Math.max(2, Math.min(a.size, b.size) * 0.05);
const quoted = text => `"${text.length > 28 ? `${text.slice(0, 27).trimEnd()}…` : text}"`;

function textOverlaps(texts, problems) {
  for (const [a, b] of pairsOf(texts)) {
    if (a.owner === b.owner || overlap(a, b, 'x', 'w') <= 2 || touching(a, b)) continue;
    problems.push({
      rule: 'text-overlap', a: nameOf(a.owner), b: nameOf(b.owner), texts: `${quoted(a.text)} / ${quoted(b.text)}`,
      hint: 'give the text more room, or move one of them',
    });
  }
}

// An element's ancestors up to stop or the page, nearest first.
function* ancestorsOf(element, root, stop = root) {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor === stop || ancestor === root) return;
    yield ancestor;
  }
}

// An element's name in a warning: its id, else its tag and classes (utility classes left out).
function nameOf(element) {
  if (element.id) return element.id;
  const classes = [...element.classList].filter(name => !name.startsWith('[')).map(name => `.${name}`);
  return `${element.tagName.toLowerCase()}${classes.join('')}`;
}

// How far a rect sticks out of its holder on each side, where it is more than a pixel.
const overhangOf = (holder, rect) => [
  ['left', holder.x - rect.x],
  ['right', rect.x + rect.w - holder.x - holder.w],
  ['top', holder.y - rect.y],
  ['bottom', rect.y + rect.h - holder.y - holder.h],
].filter(([, distance]) => distance > 1);

// Only a drawn block has an edge to stick out of; a plain wrapper has none, and an inline
// span's box is its line, not a frame.
const isFrame = entry => entry.painted && !entry.plain && entry.element.tagName !== 'ICON'
  && styleOf(entry.element).display !== 'inline';

// The painted boxes that hold what is inside them, and what sticks out of them.
class Holders {
  constructor(boxes, root) {
    this.root = root;
    this.frames = new Map(boxes.filter(isFrame).map(entry => [entry.element, entry]));
  }

  // The nearest painted box around an element.
  holderOf(element) {
    const ancestor = [...ancestorsOf(element, this.root)].find(each => this.frames.has(each));
    return ancestor ? this.frames.get(ancestor) : null;
  }

  // A text's holder may be its own element.
  holderOfText(owner) { return this.frames.get(owner) || this.holderOf(owner); }

  // The element or an ancestor below its holder is absolutely positioned.
  positionedBelow(element, holder) {
    if (element === holder.element) return false;
    return [element, ...ancestorsOf(element, this.root, holder.element)].some(isPositioned);
  }

  // An ancestor clips it (overflow: hidden, truncate).
  clipped(element) { return [...ancestorsOf(element, this.root)].some(clipsOverflow); }

  // The sides where a rect sticks out of its holder; none when it has none or is left alone.
  sidesOut(element, holder, rect) {
    if (!holder || this.positionedBelow(element, holder) || this.clipped(element)) return [];
    return overhangOf(holder.box, rect);
  }
}

const overflowWarning = (what, holder, sides) => ({
  rule: 'box-overflow', warn: true, box: what, in: nameOf(holder.element),
  by: sides.map(([side, distance]) => `${side} ${Math.round(distance)}px`).join(', '),
  hint: 'widen the box that holds it, or narrow what is inside; leave it when it is meant',
});

// Text: once per element, by the line that sticks out furthest.
function worstTextLines(texts, holders) {
  const worst = new Map();
  for (const line of texts) {
    const holder = holders.holderOfText(line.owner), sides = holders.sidesOut(line.owner, holder, line);
    const furthest = Math.max(...sides.map(([, distance]) => distance)), known = worst.get(line.owner);
    const furthestSoFar = sides.length && !(known && furthest <= known.furthest);
    if (furthestSoFar) worst.set(line.owner, { furthest, holder, sides, text: line.text });
  }
  return [...worst.values()];
}

// A box, an icon or a line of text that sticks out of the painted box holding it: a node wider
// than its group, a word wider than its card. A warning, not a problem: it may be meant, so the
// render still passes. What is placed with position: absolute is placed on purpose (a badge
// hung on a corner, a BPMN timer on a task's edge, a label beside its bar), and so is all
// inside it: those are left alone.
function boxOverflows(boxes, texts, root, problems) {
  const holders = new Holders(boxes, root);
  for (const entry of boxes.filter(each => each.painted)) {
    const holder = holders.holderOf(entry.element), sides = holders.sidesOut(entry.element, holder, entry.box);
    if (sides.length) problems.push(overflowWarning(nameOf(entry.element), holder, sides));
  }
  for (const { holder, sides, text } of worstTextLines(texts, holders)) {
    problems.push(overflowWarning(`text "${excerpt(text)}"`, holder, sides));
  }
}

// A task's label under its type's marker, which sits in the top-left corner, 6 to 22px in.
const TASK_TYPES = ['user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule'];
const isTyped = element => {
  const words = (element.getAttribute('shape') || '').trim().split(/\s+/);
  return /^(task|activity)$/.test(words[0]) && words.some(word => TASK_TYPES.includes(word));
};
function markerOverlaps(boxes, texts, problems) {
  for (const { element, box } of boxes.filter(entry => isTyped(entry.element))) {
    const mark = { x: box.x + 6, y: box.y + 6, w: 16, h: 16 };
    const hit = texts.find(text => text.owner === element && overlap(text, mark, 'x', 'w') > 0
      && overlap(inkOf(text), mark, 'y', 'h') > 0);
    if (!hit) continue;
    problems.push({
      rule: 'marker-overlap', box: nameOf(element), text: quoted(hit.text),
      hint: 'the label runs under the task type marker: keep padding-left at 26px, or shorten the label',
    });
  }
}

// Turned boxes and text were read unturned, so the checks leave them out.
export function checkBoxes(figure) {
  const unturnedTexts = figure.texts.filter(text => !text.turned);
  textOverlaps(unturnedTexts, figure.problems);
  markerOverlaps(figure.boxes.filter(entry => !entry.turned), unturnedTexts, figure.problems);
  boxOverflows(figure.boxes.filter(entry => !entry.turned), unturnedTexts, figure.root, figure.problems);
}
