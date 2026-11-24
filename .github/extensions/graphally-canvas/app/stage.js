// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The diagram on the stage: the source's <diagram>, drawn by the graphally viewer into a view
// beside it. In the drawn SVG, boxes carry data-id and lines data-edge.

// What the canvas adds to the drawing: a wide, unseen stroke along each line to click it by, and
// the selection's outline, in the diagram's accent colour.
const CANVAS_CSS = `
  g[data-id] { cursor: grab; }
  .canvas-hit { fill: none; stroke: transparent; stroke-width: 12; pointer-events: stroke; cursor: pointer; }
  .canvas-outline { fill: none; stroke: var(--woad); stroke-width: 2; stroke-dasharray: 5 3; pointer-events: none; }
  .canvas-line { fill: none; stroke: var(--woad); stroke-width: 6; stroke-opacity: 0.35; pointer-events: none; }
`;

function addLineHits(svg) {
  for (const line of svg.querySelectorAll('g[data-edge]')) {
    const path = line.querySelector('path');
    if (!path) continue;
    const hit = path.cloneNode(false);
    for (const name of ['style', 'marker-end', 'marker-start', 'stroke-dasharray']) hit.removeAttribute(name);
    hit.setAttribute('class', 'canvas-hit');
    line.append(hit);
  }
}

// Draws the source's diagram, and returns its SVG, ready to click and drag; null with none.
export async function drawSource(stage, source) {
  const diagram = new DOMParser().parseFromString(source, 'text/html').querySelector('diagram');
  if (!diagram) {
    stage.textContent = 'This file holds no <diagram>.';
    return null;
  }
  stage.replaceChildren(document.importNode(diagram, true));
  await globalThis.graphally.render();
  const svg = stage.querySelector('.graphally-view')?.shadowRoot?.querySelector('svg');
  if (!svg) return null;
  svg.getRootNode().append(Object.assign(document.createElement('style'), { textContent: CANVAS_CSS }));
  addLineHits(svg);
  return svg;
}
