// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The figure's size: what the page shows, a turned element by its outline on the page, and the
// script's drawings, which may reach past the page.
import { S } from '../style.js';
import { endsOf } from './markers.js';

// The points of a path's data, control points included (a curve stays inside them).
export const pointsOfPath = path =>
  [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));

// How far right and down a drawing reaches.
function reachOf(drawing) {
  const options = drawing.options || {}, { at } = drawing;
  if (drawing.kind === 'path') {
    // Room for half the stroke, and for an arrowhead or tail mark at an end that has one: a
    // plain rule drawn to the page's edge stays inside it.
    const ends = endsOf(options, false, []), halfStroke = (options.width || 1.5) / 2;
    const points = drawing.points || pointsOfPath(drawing.path);
    return points.map((point, index) => {
      const isHead = index === points.length - 1 && ends.head !== 'none';
      const isTail = index === 0 && ends.tail !== 'none';
      const margin = halfStroke + (isHead || isTail ? 5 : 0);
      return { x: point.x + margin, y: point.y + margin };
    });
  }
  if (drawing.kind === 'text') {
    // Text is measured roughly: a character is about 0.6 of the font size wide.
    const size = options.size || 12, width = drawing.text.length * size * 0.6;
    const rightOfAnchor = { start: width, middle: width / 2, end: 0 }[options.anchor || 'middle'] ?? 0;
    return [{ x: at.x + rightOfAnchor, y: at.y + size }];
  }
  if (drawing.kind === 'gate' || drawing.kind === 'icon') {
    const half = (options.size || (drawing.kind === 'gate' ? 30 : 24)) / 2;
    return [{ x: at.x + half, y: at.y + half }];
  }
  if (drawing.kind === 'shape') {
    const size = options.size || 44, width = options.w || size;
    const height = options.h || (options.w ? width : size);
    return [{ x: at.x + width / 2, y: at.y + height / 2 }];
  }
  return [];
}

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
