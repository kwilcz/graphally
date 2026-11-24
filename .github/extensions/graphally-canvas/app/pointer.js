// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The pointer on the drawing. A press grabs an element (the selection, when it lands inside it;
// else the nearest element its layout moves as a whole). Dragging it shows where it would land,
// and letting go moves it there; with Ctrl held any container under the pointer takes it, and
// with Alt held it is nudged instead. A press on one of the selection's span handles changes its
// span in its grid; one on its link handle draws a line to the box it is let go over. A press
// that does not move is a click: it selects what it grabbed or, on the
// selection again, one level further in. A press on a line selects the line; a double click
// edits the text under the pointer, or the label of the line.
import { dropFor } from './drop.js';
import { spanResize } from './grid-drop.js';
import { linkTarget } from './linking.js';

// A press that travels less than this many screen pixels is a click; a handle is this far reach.
const DRAG_SLOP = 4;
const HANDLE_REACH = 7;
const CURSORS = { col: 'ew-resize', row: 'ns-resize', link: 'crosshair' };

const svgPoint = (svg, event) => new DOMPoint(event.clientX, event.clientY)
  .matrixTransform(svg.getScreenCTM().inverse());
const scaleOf = svg => svg.getScreenCTM().a;

function clickTarget(model, { hit, grabbed, current }) {
  if (current && grabbed === current && hit !== current) return model.stepToward(current, hit);
  return grabbed;
}

// The selection's handle within reach of a point (a span handle or its link handle), or null.
const handleAt = (svg, actions, point) => actions.handleAt(point, HANDLE_REACH / scaleOf(svg));

// Follows the pointer from a press until it is let go, calling move and up with each point.
function track(svg, press, { move, up }) {
  const onMove = event => move(svgPoint(svg, event), event);
  const onUp = event => {
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    up(svgPoint(svg, event), event);
  };
  svg.setPointerCapture(press.event.pointerId);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
}

function followDrag(svg, model, actions, press) {
  let dragging = false, drop = null, delta = { x: 0, y: 0 };
  track(svg, press, {
    move(point, event) {
      delta = { x: point.x - press.point.x, y: point.y - press.point.y };
      dragging ||= Math.hypot(delta.x, delta.y) * scaleOf(svg) >= DRAG_SLOP;
      drop = dragging && !event.altKey ? dropFor(model, press.grabbed, point, event.ctrlKey || event.metaKey) : null;
      if (dragging) actions.drag(press.grabbed, delta, drop, event.altKey);
    },
    up(point, event) {
      if (dragging) actions.drop(press.grabbed, event.altKey ? null : drop, delta, event.altKey);
      else if (event.shiftKey) actions.toggle(press.grabbed);
      else actions.select(clickTarget(model, press));
    },
  });
}

function followResize(svg, model, actions, press, handle) {
  let resize = null;
  track(svg, press, {
    move(point) {
      resize = spanResize(model, press.current, handle.axis, point);
      actions.resizing(press.current, resize);
    },
    up: () => actions.resized(press.current, resize),
  });
}

function followLink(svg, model, actions, press) {
  let target = null;
  track(svg, press, {
    move(point) {
      target = linkTarget(model, press.current, point);
      actions.linking(press.current, point, target);
    },
    up: () => actions.linked(press.current, target),
  });
}

function press(svg, model, actions, event) {
  if (event.button !== 0) return;
  // The press is the canvas's: no text selection, no native drag.
  event.preventDefault();
  // The selection's own handles come first: they sit where lines meet its sides.
  const point = svgPoint(svg, event), current = actions.selectedEntry(), handle = handleAt(svg, actions, point);
  if (handle?.kind === 'link') return followLink(svg, model, actions, { event, point, current });
  if (handle) return followResize(svg, model, actions, { event, point, current }, handle);
  const line = event.target.closest('.canvas-hit') && event.target.closest('g[data-edge]');
  if (line) return actions.selectLine(line.dataset.edge);
  const hit = model.at(point);
  if (!hit) return actions.select(null);
  const grabbed = current && model.isWithin(hit.src, current.src) ? current : model.movableOf(hit);
  return followDrag(svg, model, actions, { event, point, hit, grabbed, current });
}

function hover(svg, model, actions, event) {
  if (event.buttons) return;
  const point = svgPoint(svg, event), handle = handleAt(svg, actions, point);
  svg.style.cursor = handle ? CURSORS[handle.kind === 'link' ? 'link' : handle.axis] : '';
  actions.hover(handle ? null : model.at(point));
}

export function enablePointer(svg, model, actions) {
  svg.addEventListener('pointerdown', event => press(svg, model, actions, event));
  svg.addEventListener('pointermove', event => hover(svg, model, actions, event));
  svg.addEventListener('pointerleave', () => actions.hover(null));
  svg.addEventListener('dblclick', event => {
    const line = event.target.closest('.canvas-hit') && event.target.closest('g[data-edge]');
    const point = svgPoint(svg, event);
    if (line) actions.editLabel(line.dataset.edge, point);
    else actions.editText(model.at(point));
  });
}
