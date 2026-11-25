// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Snapping a nudged box (Alt-drag) to the boxes it sits among, its siblings and its container:
// its left, centre or right to another's left, centre or right, and its top, middle or bottom
// likewise, when they come within a few pixels on screen. What is inside other boxes (their icons
// and labels) is not a line to snap to. The lines it snaps to come back as guides.
const REACH = 6;
const AXES = { x: ['x', 'w', 'y', 'h'], y: ['y', 'h', 'x', 'w'] };

// A box's three lines on an axis: its start, its middle and its end.
const linesOf = (box, axis) => {
  const [at, size] = AXES[axis];
  return [box[at], box[at] + box[size] / 2, box[at] + box[size]];
};

// The nearest line of another box to one of the moved box's lines, within reach, on one axis.
function nearest(moved, others, axis, reach) {
  const have = linesOf(moved, axis);
  const pairs = others.flatMap(other => linesOf(other.box, axis)
    .flatMap(want => have.map(line => ({ gap: want - line, at: want, other }))));
  const near = pairs.filter(pair => Math.abs(pair.gap) <= reach);
  return near.reduce((best, pair) => (!best || Math.abs(pair.gap) < Math.abs(best.gap) ? pair : best), null);
}

// The guide along a snapped line, from the moved box to the one it lines up with.
function guide(found, moved, axis) {
  const [, , across, length] = AXES[axis], { box } = found.other;
  const from = Math.min(moved[across], box[across]);
  const to = Math.max(moved[across] + moved[length], box[across] + box[length]);
  if (axis === 'x') return { x1: found.at, y1: from, x2: found.at, y2: to };
  return { x1: from, y1: found.at, x2: to, y2: found.at };
}

// The nudge's delta snapped to the boxes around, and the guides of the lines it snapped to.
export function snapped(model, entry, delta, scale) {
  const reach = REACH / scale, guides = [], result = { ...delta };
  const parent = model.parentOf(entry);
  const others = [...model.childrenOf(entry.parent).filter(other => other !== entry), ...(parent?.src ? [parent] : [])];
  for (const axis of ['x', 'y']) {
    const moved = { ...entry.box, x: entry.box.x + result.x, y: entry.box.y + result.y };
    const found = nearest(moved, others, axis, reach);
    if (!found) continue;
    result[axis] += found.gap;
    guides.push(guide(found, { ...moved, [axis]: moved[axis] + found.gap }, axis));
  }
  return { delta: result, guides };
}
