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
  .canvas-landed rect { fill: none; stroke: var(--woad); stroke-width: 2; stroke-dasharray: 6 3; }
  svg.canvas-previewing > :not(.canvas-overlay) { visibility: hidden; }
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

// The new diagram takes the old one's place in a holder; its view, right after it, keeps showing
// the old drawing until the new one is ready, so a redraw does not flash.
function placeDiagram(holder, diagram) {
  const old = holder.querySelector(':scope > diagram');
  if (old && old.nextElementSibling?.classList.contains('graphally-view')) old.replaceWith(diagram);
  else holder.replaceChildren(diagram);
}

// The source's diagram, parsed, each element stamped with its path and the whole marked for an
// editor (the viewer then hands back its layout model); null when there is none.
function parsedDiagram(source) {
  const parsed = new DOMParser().parseFromString(source, 'text/html').querySelector('diagram');
  if (!parsed) return null;
  stamp(parsed, null);
  parsed.setAttribute('data-edit', '');
  return parsed;
}

// Draws a diagram in a holder, alone: no other diagram on the page is drawn again.
async function drawIn(holder, parsed) {
  const diagram = document.importNode(parsed, true);
  placeDiagram(holder, diagram);
  await globalThis.graphally.render(diagram);
  const view = diagram.nextElementSibling, svg = view?.shadowRoot?.querySelector('svg');
  return svg && view.graphallyModel ? { view, svg, model: new Model(view.graphallyModel) } : null;
}

// Draws the source's diagram; returns its SVG, its layout model, the source as parsed (for the
// cascade to match selectors on) and a colour resolver, or null.
export async function drawSource(stage, source) {
  const parsed = parsedDiagram(source);
  if (!parsed) {
    stage.textContent = 'This file holds no <diagram>.';
    return null;
  }
  const drawn = await drawIn(stage, parsed);
  if (!drawn) return null;
  const root = drawn.svg.getRootNode();
  root.append(Object.assign(document.createElement('style'), { textContent: CANVAS_CSS }));
  addLineHits(drawn.svg);
  return { svg: drawn.svg, model: drawn.model, parsed, colorOf: colorResolver(root) };
}

function previewHolder(stage) {
  const found = stage.querySelector(':scope > .canvas-preview');
  if (found) return found;
  const made = Object.assign(document.createElement('div'), { className: 'canvas-preview' });
  stage.append(made);
  return made;
}

// Draws a preview of a source under the drawing, at its scale and with its top-left corner, so
// the drawing's overlay lies over it as over the drawing; returns its SVG and layout model.
export async function drawPreview(stage, source, drawing) {
  const parsed = parsedDiagram(source), holder = previewHolder(stage);
  const drawn = parsed && await drawIn(holder, parsed);
  if (!drawn) return null;
  const at = drawing.getBoundingClientRect(), scale = at.width / drawing.viewBox.baseVal.width;
  const width = `${drawn.svg.viewBox.baseVal.width * scale}px`;
  Object.assign(drawn.svg.style, { width, height: 'auto', maxWidth: 'none' });
  holder.hidden = false;
  const now = drawn.svg.getBoundingClientRect();
  holder.style.left = `${(parseFloat(holder.style.left) || 0) + at.left - now.left}px`;
  holder.style.top = `${(parseFloat(holder.style.top) || 0) + at.top - now.top}px`;
  return drawn;
}

export function hidePreview(stage) {
  const holder = stage.querySelector(':scope > .canvas-preview');
  if (holder) holder.hidden = true;
}
