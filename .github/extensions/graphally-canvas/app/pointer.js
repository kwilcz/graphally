// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Pressing on the drawing. On a box: a drag moves it, and letting go writes the move (a nudge);
// a press that does not move is a click that selects it. On a line: a click that selects it.
// Anywhere else: a click that clears the selection.

// A press that travels less than this, in drawing pixels, is a click.
const CLICK_SLOP = 3;

const svgPoint = (svg, event) => new DOMPoint(event.clientX, event.clientY)
  .matrixTransform(svg.getScreenCTM().inverse());

function dragBox(svg, box, press, { onMove, onPick }) {
  const origin = svgPoint(svg, press), base = box.getAttribute('transform') || '';
  let dx = 0, dy = 0;
  const follow = event => {
    const point = svgPoint(svg, event);
    [dx, dy] = [point.x - origin.x, point.y - origin.y];
    box.setAttribute('transform', `${base} translate(${dx} ${dy})`);
  };
  const letGo = event => {
    svg.removeEventListener('pointermove', follow);
    svg.removeEventListener('pointerup', letGo);
    svg.removeEventListener('pointercancel', letGo);
    const moved = event.type === 'pointerup' && Math.hypot(dx, dy) >= CLICK_SLOP;
    if (!moved) box.setAttribute('transform', base);
    if (moved) onMove(box.dataset.id, Math.round(dx), Math.round(dy));
    else if (event.type === 'pointerup') onPick({ kind: 'box', id: box.dataset.id });
  };
  svg.setPointerCapture(press.pointerId);
  svg.addEventListener('pointermove', follow);
  svg.addEventListener('pointerup', letGo);
  svg.addEventListener('pointercancel', letGo);
}

export function enablePointer(svg, handlers) {
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const line = event.target.closest('.canvas-hit') && event.target.closest('g[data-edge]');
    const box = !line && event.target.closest('g[data-id]');
    if (line) handlers.onPick({ kind: 'line', id: line.dataset.edge });
    else if (box) dragBox(svg, box, event, handlers);
    else handlers.onPick(null);
  });
}
