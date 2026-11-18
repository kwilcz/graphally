// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Checks on the page's boxes and text: what overlaps, and what sticks out of what holds it.
import { S } from '../style.js';
import { excerpt } from '../shared/messages.js';

const styleOf = element => getComputedStyle(element);

// The content is wider than the width the author set.
export function checkPageWidth(figure, size) {
  const width = parseFloat(figure.root.style.width);
  if (size.width <= width + 2 * S.pad + 1) return;
  figure.problems.push({
    rule: 'page-overflow', width, content: size.width - 2 * S.pad,
    hint: 'the content is wider than width: widen width, or narrow the columns',
  });
}

const ownerName = owner => owner.id || owner.tagName.toLowerCase();

// Two lines of text of different elements on top of each other.
function textOverlaps(texts, problems) {
  for (let first = 0; first < texts.length; first++) {
    for (let second = first + 1; second < texts.length; second++) {
      const a = texts[first], b = texts[second];
      if (a.owner === b.owner) continue;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX <= 2 || overlapY <= 2) continue;
      problems.push({
        rule: 'text-overlap', a: ownerName(a.owner), b: ownerName(b.owner),
        hint: 'give the text more room, or move one of them',
      });
    }
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

// A box, an icon or a line of text that sticks out of the painted box holding it: a node wider
// than its group, a word wider than its card. A warning, not a problem: it may be meant, so the
// render still passes. What is placed with position: absolute is placed on purpose (a badge
// hung on a corner, a BPMN timer on a task's edge, a label beside its bar), and so is all
// inside it: those are left alone.
function boxOverflows(boxes, texts, root, problems) {
  const frames = new Map(boxes.filter(isFrame).map(entry => [entry.element, entry]));
  const holderOf = element => {
    for (const ancestor of ancestorsOf(element, root)) if (frames.has(ancestor)) return frames.get(ancestor);
    return null;
  };
  // Left alone on purpose: the element or an ancestor below its holder is absolutely
  // positioned, or an ancestor clips it (overflow: hidden, truncate). A text's holder may be its
  // own element: then nothing lies between them.
  const leftAlone = (element, holder) => {
    if (element !== holder.element) {
      const belowHolder = [element, ...ancestorsOf(element, root, holder.element)];
      if (belowHolder.some(node => /^(absolute|fixed)$/.test(styleOf(node).position))) return true;
    }
    return [...ancestorsOf(element, root)].some(ancestor => styleOf(ancestor).overflowX !== 'visible');
  };
  const sidesOut = (element, holder, rect) =>
    (!holder || leftAlone(element, holder) ? [] : overhangOf(holder.box, rect));
  const warn = (what, holder, sides) => problems.push({
    rule: 'box-overflow', warn: true, box: what, in: nameOf(holder.element),
    by: sides.map(([side, distance]) => `${side} ${Math.round(distance)}px`).join(', '),
    hint: 'widen the box that holds it, or narrow what is inside; leave it when it is meant',
  });
  for (const entry of boxes) {
    if (!entry.painted) continue;
    const holder = holderOf(entry.element), sides = sidesOut(entry.element, holder, entry.box);
    if (sides.length) warn(nameOf(entry.element), holder, sides);
  }
  // Text: once per element, by the line that sticks out furthest.
  const worstLines = new Map();
  for (const line of texts) {
    const holder = frames.get(line.owner) || holderOf(line.owner), sides = sidesOut(line.owner, holder, line);
    if (!sides.length) continue;
    const furthest = Math.max(...sides.map(([, distance]) => distance)), worst = worstLines.get(line.owner);
    if (worst && furthest <= worst.furthest) continue;
    worstLines.set(line.owner, { furthest, holder, sides, text: line.text });
  }
  for (const { holder, sides, text } of worstLines.values()) warn(`text "${excerpt(text)}"`, holder, sides);
}

// Turned boxes and text were read unturned, so the checks leave them out.
export function checkBoxes(figure) {
  const unturnedTexts = figure.texts.filter(text => !text.turned);
  textOverlaps(unturnedTexts, figure.problems);
  boxOverflows(figure.boxes.filter(entry => !entry.turned), unturnedTexts, figure.root, figure.problems);
}
