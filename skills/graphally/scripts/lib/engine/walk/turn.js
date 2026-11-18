// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Turns: rotate, scale and transform. A turned element is read unturned and drawn in a group that
// turns it about its transform-origin, with all inside it. Its outline on the page, turned, is
// kept for the page's size; its boxes and text, read unturned, are marked so that the checks
// leave them out.
import { roundTo, openTag } from '../svg.js';
import { turnMatrixOf } from '../css/transform.js';

// The group that turns the element, and the function that ends the turn once all inside it is
// drawn; null for an element that does not turn.
export function startTurn(figure, element, style) {
  const matrix = turnMatrixOf(style);
  if (!matrix) return null;
  const [originX, originY] = style.transformOrigin.split(' ').map(parseFloat);
  const inlineTransforms = [element.style.transform, element.style.rotate, element.style.scale];
  figure.turnedOutlines.push(figure.boxOf(element));
  const firstBox = figure.boxes.length, firstText = figure.texts.length;
  element.style.transform = element.style.rotate = element.style.scale = 'none';
  const unturned = figure.boxOf(element), pivotX = unturned.x + originX, pivotY = unturned.y + originY;
  // The matrix turns about the page's origin; shifted so that it turns about the pivot instead.
  const shiftX = pivotX + matrix.e - matrix.a * pivotX - matrix.c * pivotY;
  const shiftY = pivotY + matrix.f - matrix.b * pivotX - matrix.d * pivotY;
  const placed = [matrix.a, matrix.b, matrix.c, matrix.d, shiftX, shiftY];
  return {
    group: openTag('g', { transform: `matrix(${placed.map(value => roundTo(value, 4)).join(' ')})` }),
    end: () => {
      [element.style.transform, element.style.rotate, element.style.scale] = inlineTransforms;
      const inside = [...figure.boxes.slice(firstBox), ...figure.texts.slice(firstText)];
      for (const entry of inside) entry.turned = true;
    },
  };
}
