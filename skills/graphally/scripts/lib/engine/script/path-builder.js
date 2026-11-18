// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// draw.moveTo(p).lineTo(p)…: a path drawn as on a canvas, its points named by the script.
import { fmt } from '../svg.js';

// A point on a circle, degrees clockwise from the right, as in canvas.
export const arcPoint = (centre, radius, degrees) => ({
  x: centre.x + radius * Math.cos(degrees * Math.PI / 180),
  y: centre.y + radius * Math.sin(degrees * Math.PI / 180),
});

const pair = point => `${fmt(point.x)},${fmt(point.y)}`;

// A path from a start point; point() turns what the script names into a point. The path's
// points (control points and an arc's samples included) let the page grow to hold it.
export function pathBuilder(start, drawings, point) {
  const commands = [`M${pair(start)}`], item = { kind: 'path', path: '', options: {}, points: [start] };
  drawings.push(item);
  const add = (command, ...points) => {
    item.points.push(...points);
    commands.push(command);
    item.path = commands.join(' ');
    return builder;
  };
  const builder = {
    mark: item,
    lineTo: to => { const end = point(to); return add(`L${pair(end)}`, end); },
    quadraticCurveTo: (control, to) => {
      const [bend, end] = [point(control), point(to)];
      return add(`Q${pair(bend)} ${pair(end)}`, bend, end);
    },
    bezierCurveTo: (control1, control2, to) => {
      const [first, second, end] = [point(control1), point(control2), point(to)];
      return add(`C${pair(first)} ${pair(second)} ${pair(end)}`, first, second, end);
    },
    // arc(centre, radius, startDegrees, endDegrees): degrees clockwise from the right.
    arc: (centreRef, radius, from, to) => {
      const centre = point(centreRef);
      const startPoint = arcPoint(centre, radius, from), endPoint = arcPoint(centre, radius, to);
      const sweep = to > from ? 1 : 0, large = Math.abs(to - from) > 180 ? 1 : 0;
      const sampleAt = step => arcPoint(centre, radius, from + (to - from) * step / 24);
      const samples = Array.from({ length: 25 }, (_, step) => sampleAt(step));
      const arc = `A${fmt(radius)},${fmt(radius)} 0 ${large} ${sweep} ${pair(endPoint)}`;
      return add(`L${pair(startPoint)} ${arc}`, ...samples);
    },
    closePath: () => add('Z'),
    style: options => { Object.assign(item.options, options); return builder; },
  };
  item.path = commands.join(' ');
  return builder;
}
