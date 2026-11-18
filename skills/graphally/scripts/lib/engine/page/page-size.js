// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The figure's size: what the page shows, a turned element by its outline on the page, and the
// script's drawings, which may reach past the page.
import { S } from '../style.js';
import { endsOf } from './markers.js';

// The points of a path's data, control points included (a curve stays inside them).
export const pointsOfPath = path =>
  [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));

// Room for half the stroke, and for an arrowhead or tail mark at an end that has one: a plain
// rule drawn to the page's edge stays inside it.
function pathReach(drawing, options) {
  const ends = endsOf(options, false, []), halfStroke = (options.width || 1.5) / 2;
  const points = drawing.points || pointsOfPath(drawing.path);
  const marked = index => (index === points.length - 1 && ends.head !== 'none') || (index === 0 && ends.tail !== 'none');
  return points.map((point, index) => {
    const margin = halfStroke + (marked(index) ? 5 : 0);
    return { x: point.x + margin, y: point.y + margin };
  });
}

// Text is measured roughly: a character is about 0.6 of the font size wide.
function textReach({ at, text }, options) {
  const size = options.size || 12, width = text.length * size * 0.6;
  const rightOfAnchor = { start: width, middle: width / 2, end: 0 }[options.anchor || 'middle'] ?? 0;
  return [{ x: at.x + rightOfAnchor, y: at.y + size }];
}

const squareReach = defaultSize => ({ at }, options) => {
  const half = (options.size || defaultSize) / 2;
  return [{ x: at.x + half, y: at.y + half }];
};

function shapeReach({ at }, options) {
  const size = options.size || 44, width = options.w || size, height = options.h || (options.w ? width : size);
  return [{ x: at.x + width / 2, y: at.y + height / 2 }];
}

// How far right and down each kind of drawing reaches.
const REACH = { path: pathReach, text: textReach, gate: squareReach(30), icon: squareReach(24), shape: shapeReach };
const reachOf = drawing => (Object.hasOwn(REACH, drawing.kind) ? REACH[drawing.kind](drawing, drawing.options || {}) : []);

function drawingsReach(drawings) {
  let right = 0, bottom = 0;
  for (const point of drawings.flatMap(reachOf)) {
    if (point.x > right) right = point.x;
    if (point.y > bottom) bottom = point.y;
  }
  return { x: right, y: bottom };
}

export function pageSize(figure) {
  const far = drawingsReach(figure.drawings);
  const shownRects = [
    ...figure.boxes.filter(entry => !entry.turned).map(entry => entry.box),
    ...figure.texts.filter(text => !text.turned),
    ...figure.turnedOutlines,
  ];
  const rightEdges = shownRects.map(rect => rect.x + rect.w + S.pad);
  const bottomEdges = shownRects.map(rect => rect.y + rect.h + S.pad);
  return {
    width: Math.ceil(Math.max(figure.root.scrollWidth, ...rightEdges, far.x + S.pad)),
    height: Math.ceil(Math.max(...bottomEdges, far.y + S.pad, 2 * S.pad)),
  };
}
