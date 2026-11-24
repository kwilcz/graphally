// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The drawing's scale: fitted to the stage's width, or a step from 25% to 400%. The point under
// the pointer (or the stage's centre) stays where it is as the scale changes.
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
const GUTTER = 32;

const naturalWidth = svg => svg.viewBox.baseVal?.width || svg.getBBox().width;

export function scaleOf(stage, svg, zoom) {
  if (zoom !== 'fit') return zoom;
  return Math.min(2, Math.max(0.1, (stage.clientWidth - GUTTER) / naturalWidth(svg)));
}

// Sets the drawing's width for the zoom and returns the scale it took.
export function applyZoom(stage, svg, zoom) {
  const scale = scaleOf(stage, svg, zoom);
  Object.assign(svg.style, { width: `${Math.round(naturalWidth(svg) * scale)}px`, height: 'auto', maxWidth: 'none' });
  return scale;
}

// The next step in from the current scale (direction 1) or out (-1).
export function stepped(scale, direction) {
  const next = direction > 0 ? STEPS.find(step => step > scale + 0.001) : STEPS.findLast(step => step < scale - 0.001);
  return next ?? scale;
}

// Changes the scale keeping a point of the stage (client coordinates) over the same part of the
// drawing.
export function zoomAround(stage, svg, zoom, point) {
  const before = stage.getBoundingClientRect(), old = svg.getBoundingClientRect();
  const at = point ?? { x: before.left + stage.clientWidth / 2, y: before.top + stage.clientHeight / 2 };
  const fraction = { x: (at.x - old.left) / old.width, y: (at.y - old.top) / old.height };
  const scale = applyZoom(stage, svg, zoom), now = svg.getBoundingClientRect();
  stage.scrollLeft += now.left + fraction.x * now.width - at.x;
  stage.scrollTop += now.top + fraction.y * now.height - at.y;
  return scale;
}
