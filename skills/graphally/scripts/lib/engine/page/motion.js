// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Motion, for a reader whose browser shows it: a line with flow carries gaps that move along it
// and a dot that travels it; data-step boxes, and their lines, appear in order, once. Both are
// marks on top of the still figure, which is complete without them: the marks start hidden
// (an attribute, which what ignores CSS keeps), the stylesheet shows them only when motion is
// allowed, and a reveal ends where the still is. A PNG is the still: the renderer captures with
// reduced motion. The keyframes are named g-*, after graphally's other classes.
import { fmt, svgElement } from '../svg.js';
import { colorUnder } from './colors.js';

// The order the steps appear in, and when each starts, in seconds.
export function stepTimes(steps) {
  const order = [...steps].sort((a, b) => a - b);
  return { order, delayOf: step => 0.3 + order.indexOf(step) * 0.5 };
}

// A routed line's length, and the middle of its longest run.
function lengthAndMiddle(points) {
  let length = 0, longest = 0, middle = points[0];
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1], to = points[index], run = Math.hypot(to.x - from.x, to.y - from.y);
    length += run;
    if (run > longest) {
      longest = run;
      middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }
  }
  return { length, middle };
}

// The marks of a line with flow. The gaps take the colour under the line, as a label's halo
// does; the dot, the line's colour (blue on a plain line), ringed so it reads on the line
// itself. One speed for every dot.
export function flowMarks(figure, path, points, tone, delay) {
  const { length, middle } = lengthAndMiddle(points);
  const gap = colorUnder(figure.boxes, middle.x, middle.y) || 'var(--bg)';
  const dot = tone === 'var(--ink)' ? 'var(--woad)' : tone;
  const travel = svgElement('animateMotion', {
    dur: `${fmt(Math.max(1.2, length / 70))}s`,
    begin: delay ? `${fmt(delay)}s` : null,
    repeatCount: 'indefinite',
    path,
  });
  return svgElement('path', {
    class: 'g-flow', d: path, visibility: 'hidden', style: `fill: none; stroke: ${gap}`, 'stroke-width': 1.5,
  }) + svgElement('circle', {
    class: 'g-dot', r: 4, visibility: 'hidden',
    style: `fill: ${dot}; stroke: var(--card)`, 'stroke-width': 1.5,
  }, travel);
}

// The stylesheet of the figure's motion: flow, steps, and the animations of animate().
export function motionCss({ order, delayOf }, animation) {
  const stepDelays = order.map(step =>
    `  svg.graphally [data-step="${step}"] { animation-delay: ${fmt(delayOf(step))}s; }`);
  return `@media (prefers-reduced-motion: no-preference) {
  svg.graphally .g-flow, svg.graphally .g-dot { visibility: visible; }
  svg.graphally .g-flow { stroke-dasharray: 3 9; animation: g-flow 0.9s linear infinite; }
  svg.graphally [data-step] { animation: g-in 0.5s backwards; }
${stepDelays.join('\n')}${animation.rules}
}
@keyframes g-flow { to { stroke-dashoffset: -12; } }
@keyframes g-in { from { opacity: 0; transform: translateY(6px); } }${animation.keyframes}`;
}
