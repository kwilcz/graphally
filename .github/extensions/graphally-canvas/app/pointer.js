// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The pointer on the drawing. A press grabs an element (the selection, when it lands inside it;
// else the nearest element its layout moves as a whole). Dragging it shows where it would land,
// and letting go moves it there; with Alt held it is nudged instead. A press that does not move
// is a click: it selects what it grabbed or, on the selection again, one level further in. A
// press on a line selects the line; a double click edits the text under the pointer.
import { dropFor } from './drop.js';

// A press that travels less than this, in drawing pixels, is a click.
const DRAG_SLOP = 4;

const svgPoint = (svg, event) => new DOMPoint(event.clientX, event.clientY)
  .matrixTransform(svg.getScreenCTM().inverse());

function clickTarget(model, { hit, grabbed, current }) {
  if (current && grabbed === current && hit !== current) return model.stepToward(current, hit);
  return grabbed;
}

function follow(svg, model, actions, press) {
  let dragging = false, drop = null, delta = { x: 0, y: 0 };
  const move = event => {
    const point = svgPoint(svg, event);
    delta = { x: point.x - press.point.x, y: point.y - press.point.y };
    dragging ||= Math.hypot(delta.x, delta.y) >= DRAG_SLOP;
    drop = dragging && !event.altKey ? dropFor(model, press.grabbed, point) : null;
    if (dragging) actions.drag(press.grabbed, delta, drop);
  };
  const up = event => {
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerup', up);
    if (dragging) actions.drop(press.grabbed, event.altKey ? null : drop, delta, event.altKey);
    else actions.select(clickTarget(model, press));
  };
  svg.setPointerCapture(press.event.pointerId);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
}

function press(svg, model, actions, event) {
  if (event.button !== 0) return;
  // The press is the canvas's: no text selection, no native drag.
  event.preventDefault();
  const line = event.target.closest('.canvas-hit') && event.target.closest('g[data-edge]');
  if (line) return actions.selectLine(line.dataset.edge);
  const point = svgPoint(svg, event), hit = model.at(point);
  if (!hit) return actions.select(null);
  const current = actions.selectedEntry();
  const grabbed = current && model.isWithin(hit.src, current.src) ? current : model.movableOf(hit);
  return follow(svg, model, actions, { event, point, hit, grabbed, current });
}

export function enablePointer(svg, model, actions) {
  svg.addEventListener('pointerdown', event => press(svg, model, actions, event));
  svg.addEventListener('pointermove', event => {
    if (!event.buttons) actions.hover(model.at(svgPoint(svg, event)));
  });
  svg.addEventListener('pointerleave', () => actions.hover(null));
  svg.addEventListener('dblclick', event => actions.editText(model.at(svgPoint(svg, event))));
}
