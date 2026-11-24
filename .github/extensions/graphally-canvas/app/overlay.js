// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What the canvas draws over the diagram, in the drawing's own units: the selection and its
// handles, the element under the pointer, the grid it sits in, where a dragged element would
// land, and the dragged element's ghost.
const SVG = 'http://www.w3.org/2000/svg';

function make(name, attributes) {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

export const frame = (box, pad = 3) => make('rect', {
  x: box.x - pad, y: box.y - pad, width: box.w + 2 * pad, height: box.h + 2 * pad, rx: 5,
});
export const segment = ({ x1, y1, x2, y2 }) => make('line', { x1, y1, x2, y2 });
export const dot = (x, y, r) => make('circle', { cx: x, cy: y, r });
export const trace = d => make('path', { d });
export function label(x, y, text) {
  const made = make('text', { x, y });
  made.textContent = text;
  return made;
}

export class Overlay {
  constructor(svg) {
    this.layer = make('g', { class: 'canvas-overlay' });
    svg.append(this.layer);
    this.parts = {};
  }

  // Shows one part (selection, hover, drop, ghost) as these shapes, or clears it with none.
  show(part, shapes) {
    this.parts[part]?.remove();
    delete this.parts[part];
    if (!shapes || (Array.isArray(shapes) && !shapes.length)) return;
    const group = make('g', { class: `canvas-${part}` });
    group.append(...[shapes].flat());
    this.layer.append(group);
    this.parts[part] = group;
  }
}
