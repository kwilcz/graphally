// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What is drawn inside a shape: an intermediate event's second ring, a repeat badge's arrows, a
// gateway's or an event's glyph, a task's type and its markers along the bottom, a
// transaction's double border, and a data object's arrow. BPMN conventions: a thin circle
// starts, a thick one ends, a double one is an intermediate event.
import { fmt, svgElement } from '../svg.js';
import { polygon, circlePath, roundRect } from './paths.js';
import { GLYPH, glyph } from './glyphs.js';

const TASK_TYPES = ['user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule'];

// Two arcs, each ending in a solid head drawn to scale (a line marker would swamp them).
function cycleArrows({ base, cx, cy, r, ink, line }) {
  if (!base.cycle) return [];
  const radius = r * 0.52, width = Math.max(1.3, r * 0.13), head = r * 0.36;
  const pointAt = degrees =>
    [cx + radius * Math.cos(degrees * Math.PI / 180), cy + radius * Math.sin(degrees * Math.PI / 180)];
  const marks = [];
  for (const [from, to] of [[200, 330], [20, 150]]) {
    const [x0, y0] = pointAt(from), [x1, y1] = pointAt(to - 14), [ex, ey] = pointAt(to);
    const arc = `M${fmt(x0)},${fmt(y0)} A${fmt(radius)},${fmt(radius)} 0 0 1 ${fmt(x1)},${fmt(y1)}`;
    marks.push(line(arc, width));
    // The head points along the turning direction (clockwise): tangent (-sin, cos).
    const angle = to * Math.PI / 180;
    const tx = -Math.sin(angle), ty = Math.cos(angle), nx = Math.cos(angle), ny = Math.sin(angle);
    const tip = [ex + tx * head * 0.55, ey + ty * head * 0.55];
    const left = [ex - tx * head * 0.45 + nx * head * 0.5, ey - ty * head * 0.45 + ny * head * 0.5];
    const right = [ex - tx * head * 0.45 - nx * head * 0.5, ey - ty * head * 0.45 - ny * head * 0.5];
    marks.push(svgElement('path', { d: polygon([tip, left, right]), style: `fill: ${ink}; stroke: none` }));
  }
  return marks;
}

// An event-based gateway (BPMN 2.0.2, 10.6.6) waits for whichever event comes first: a pentagon
// in a double circle. Starting a process, the circle is single; the parallel variant, which also
// starts one, holds an open cross. Both are the events' own glyphs. Any other gateway shows the
// glyph of its kind; an event, that of its trigger, filled when it ends or throws.
function centralGlyphs({ base, has, marks, cx, cy, r, ink, line }) {
  if (base.gateway && has('event-based')) {
    const parallel = has('parallel'), single = parallel || has('start'), ring = r * 0.5;
    return [
      line(circlePath(cx, cy, ring), 1.2),
      ...(single ? [] : [line(circlePath(cx, cy, ring - 2.5), 1.2)]),
      ...glyph(parallel ? 'parallel-multiple' : 'multiple', cx, cy, r * (single ? 0.82 : 0.69), false, ink),
    ];
  }
  if (base.gateway) {
    const kinds = marks.filter(mark => GLYPH[`gateway ${mark}`]);
    return kinds.flatMap(mark => glyph(`gateway ${mark}`, cx, cy, r * 1.07, false, ink));
  }
  if (base.event) {
    const filled = base.event === 'end' || has('throw');
    return marks.filter(mark => GLYPH[mark]).flatMap(mark => glyph(mark, cx, cy, r * 1.05, filled, ink));
  }
  return [];
}

// How each marker along an activity's bottom is drawn, centred on mx,my.
const BOTTOM_DRAWN = {
  'ad-hoc': ({ mx, my, ink }) => glyph('ad-hoc', mx, my, 13, false, ink),
  compensation: ({ mx, my, ink }) => glyph('compensation', mx, my, 13, false, ink),
  subprocess: ({ mx, my, line }) => {
    const left = fmt(mx - 6), right = fmt(mx + 6), top = fmt(my - 6), bottom = fmt(my + 6);
    const plus = `M${fmt(mx - 3.5)},${fmt(my)} H${fmt(mx + 3.5)} M${fmt(mx)},${fmt(my - 3.5)} V${fmt(my + 3.5)}`;
    return [line(`M${left},${top} H${right} V${bottom} H${left} Z ${plus}`, 1.2)];
  },
  loop: ({ mx, my, line }) => {
    const end = `${fmt(mx - 4.5)},${fmt(my + 3.5)}`;
    return [line(`M${fmt(mx + 4.5)},${fmt(my + 3.5)} A5.5,5.5 0 1 0 ${end} M${end} l-0.5,-3.5 M${end} l3.3,-1`, 1.3)];
  },
  sequential: ({ mx, my, line }) => {
    const bar = dy => `M${fmt(mx - 5)},${fmt(my + dy)} H${fmt(mx + 5)}`;
    return [line(`${bar(-4)} ${bar(0)} ${bar(4)}`, 1.5)];
  },
  multi: ({ mx, my, line }) => [line(uprightBars(mx, my), 1.5)],
  collection: ({ mx, my, line }) => [line(uprightBars(mx, my), 1.5)],
};

// Three upright bars: multi-instance in parallel, or a collection.
function uprightBars(mx, my) {
  const bar = dx => `M${fmt(mx + dx)},${fmt(my - 5)} V${fmt(my + 5)}`;
  return `${bar(-4)} ${bar(0)} ${bar(4)}`;
}

// The markers side by side at the bottom middle of an activity. Multi-instance (BPMN 2.0.2,
// 10.3.5): three upright bars run the instances in parallel, three flat ones one after another;
// sequential multi-instance shows only its flat bars. Ad-hoc (~) and compensation (the event's
// rewind glyph) sit among them.
function bottomMarkers({ base, has, marks, box, inset, cx, ink, line }) {
  if (base.event || base.gateway) return [];
  const shown = marks.filter(mark => Object.hasOwn(BOTTOM_DRAWN, mark) && !(mark === 'multi' && has('sequential')));
  const my = box.y + box.h - inset - 12 / 2 - 5;
  return shown.flatMap((mark, index) => BOTTOM_DRAWN[mark]({ mx: cx + (index - (shown.length - 1) / 2) * (12 + 6), my, ink, line }));
}

// An intermediate event's second ring, inside the first.
function eventRing({ base, cx, cy, r, inset, style, line, broken }) {
  if (base.event !== 'event') return [];
  const width = Math.min(style.width || 1.5, 1.5);
  return [line(circlePath(cx, cy, r - inset - 3.5), width, 'none', { 'stroke-dasharray': broken ? '3.4 2.2' : null })];
}

// A task's type sits in its top-left corner (BPMN 2.0.2, 10.3.3); send and receive are the
// message glyph, filled and open, as on a throwing and a catching event.
function taskType({ base, marks, box, inset, ink }) {
  const type = !base.event && !base.gateway && marks.find(mark => TASK_TYPES.includes(mark));
  if (!type) return [];
  const name = type === 'send' || type === 'receive' ? 'message' : type;
  return glyph(name, box.x + inset + 14, box.y + inset + 14, 16, type === 'send', ink);
}

// A transaction (10.3.7) is drawn with a double border.
function transactionBorder({ base, has, box, inset, style, line }) {
  if (base.event || base.gateway || !has('transaction')) return [];
  const inner = { x: box.x + inset + 3, y: box.y + inset + 3, w: box.w - 2 * inset - 6, h: box.h - 2 * inset - 6 };
  return [line(roundRect(inner, 7), Math.max(1, style.width || 1.5))];
}

// A data object (10.4.1) is an input with an open arrow in its corner, an output with a filled
// one, and a collection with three bars below, as a multi-instance task.
function dataArrow({ spec, has, box, inset, ink }) {
  if (spec.base !== 'note' || !(has('input') || has('output'))) return [];
  return glyph('arrow', box.x + inset + 10, box.y + inset + 10, 13, has('output'), ink);
}

const MARKERS = [eventRing, cycleArrows, centralGlyphs, taskType, transactionBorder, dataArrow, bottomMarkers];

// The markers of a shape, in drawing order. line(d, width, fill, extra) draws a stroke in the
// ink colour.
export function markersOf({ base, spec, box, inset, style, ink, line, broken }) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, r = Math.min(box.w, box.h) / 2;
  const has = mark => spec.marks.includes(mark);
  const shape = { base, spec, has, marks: spec.marks, box, inset, style, cx, cy, r, ink, line, broken };
  return MARKERS.flatMap(draw => draw(shape));
}
