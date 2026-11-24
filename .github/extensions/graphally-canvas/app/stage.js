// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The diagram on the stage: the source's <diagram>, each element stamped with its path in the
// source (data-src, the numbering the skill's edits use), drawn by the graphally viewer, which
// hands back the drawing and the layout model (each element's box and what places it).
import { Model } from './model.js';

// What the canvas adds to the drawing: a wide, unseen stroke along each line to click it by, and
// the overlay's parts, in the diagram's accent colour.
const CANVAS_CSS = `
  .canvas-hit { fill: none; stroke: transparent; stroke-width: 12; pointer-events: stroke; cursor: pointer; }
  .canvas-overlay * { pointer-events: none; }
  .canvas-selection rect { fill: none; stroke: var(--woad); stroke-width: 2; }
  .canvas-selection path { fill: none; stroke: var(--woad); stroke-width: 6; stroke-opacity: 0.35; }
  .canvas-hover rect { fill: none; stroke: var(--woad); stroke-width: 1; stroke-dasharray: 3 3; stroke-opacity: 0.7; }
  .canvas-drop line { stroke: var(--woad); stroke-width: 3; stroke-linecap: round; }
  .canvas-drop rect { fill: var(--woad); fill-opacity: 0.1; stroke: var(--woad); stroke-dasharray: 5 3; }
  .canvas-ghost rect { fill: var(--woad); fill-opacity: 0.12; stroke: var(--woad); stroke-opacity: 0.6; }
  .canvas-grid rect { fill: none; stroke: var(--woad); stroke-opacity: 0.45; stroke-dasharray: 2 3; }
  .canvas-grid text { fill: var(--woad); fill-opacity: 0.8; font: 600 10px sans-serif; }
  .canvas-handle rect { fill: var(--card); stroke: var(--woad); stroke-width: 1.5; }
`;

// Each element's path among its parent's elements, from the diagram down: "0", "0.2", "0.2.1".
function stamp(element, path) {
  [...element.children].forEach((child, index) => {
    const at = path === null ? String(index) : `${path}.${index}`;
    child.setAttribute('data-src', at);
    stamp(child, at);
  });
}

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

// A colour as the drawing resolves it, theme tokens (var(--woad)) included.
function colorResolver(root) {
  const probe = Object.assign(document.createElement('i'), { hidden: true });
  root.append(probe);
  return value => {
    probe.style.color = '';
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
}

// The new diagram takes the old one's place; its view, right after it, keeps showing the old
// drawing until the new one is ready, so a redraw does not flash.
function placeDiagram(stage, diagram) {
  const old = stage.querySelector('diagram');
  if (old && old.nextElementSibling?.classList.contains('graphally-view')) old.replaceWith(diagram);
  else stage.replaceChildren(diagram);
}

// Draws the source's diagram; returns its SVG, its layout model, the source as parsed (each
// element stamped with its path, for the cascade to match selectors on) and a colour resolver,
// or null.
export async function drawSource(stage, source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html').querySelector('diagram');
  if (!parsed) {
    stage.textContent = 'This file holds no <diagram>.';
    return null;
  }
  stamp(parsed, null);
  parsed.setAttribute('data-edit', '');
  placeDiagram(stage, document.importNode(parsed, true));
  await globalThis.graphally.render();
  const view = stage.querySelector('.graphally-view'), svg = view?.shadowRoot?.querySelector('svg');
  if (!svg || !view.graphallyModel) return null;
  const root = svg.getRootNode();
  root.append(Object.assign(document.createElement('style'), { textContent: CANVAS_CSS }));
  addLineHits(svg);
  return { svg, model: new Model(view.graphallyModel), parsed, colorOf: colorResolver(root) };
}
