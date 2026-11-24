// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What is selected: a box (its data-id) or a line (its data-edge key), outlined over the drawing
// and told to the canvas, where the agent reads it.
const SVG = 'http://www.w3.org/2000/svg';

const elementOf = (svg, item) => (item.kind === 'box'
  ? svg.querySelector(`g[data-id="${CSS.escape(item.id)}"]`)
  : svg.querySelector(`g[data-edge="${CSS.escape(item.id)}"] path`));

// A dashed frame around a box, a little out from it.
function boxOutline(element) {
  const box = element.getBBox(), frame = document.createElementNS(SVG, 'rect');
  const at = { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8, rx: 6 };
  for (const [name, value] of Object.entries(at)) frame.setAttribute(name, value);
  frame.setAttribute('class', 'canvas-outline');
  return frame;
}

// A wide, light stroke along a line.
function lineOutline(element) {
  const glow = document.createElementNS(SVG, 'path');
  glow.setAttribute('d', element.getAttribute('d'));
  glow.setAttribute('class', 'canvas-line');
  return glow;
}

export class Selection {
  constructor(onChange) {
    Object.assign(this, { item: null, onChange });
  }

  // Picked on the page: kept, and told to the canvas.
  set(item) {
    this.item = item;
    this.onChange(item ? [item] : []);
  }

  // Picked by the agent, through the canvas: kept, without telling it back.
  adopt(items) {
    this.item = items[0] ?? null;
  }

  draw(svg) {
    svg.querySelector('.canvas-selection')?.remove();
    const element = this.item && elementOf(svg, this.item);
    if (!element) return;
    const layer = document.createElementNS(SVG, 'g');
    layer.setAttribute('class', 'canvas-selection');
    layer.append(this.item.kind === 'box' ? boxOutline(element) : lineOutline(element));
    svg.append(layer);
  }
}
