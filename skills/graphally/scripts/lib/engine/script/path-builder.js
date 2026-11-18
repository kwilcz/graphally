// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// draw.moveTo(p).lineTo(p)…: a path drawn as on a canvas, its points named by the script.
import { fmt } from '../svg.js';

// A point on a circle, degrees clockwise from the right, as in canvas.
export const arcPoint = (centre, radius, degrees) => ({
  x: centre.x + radius * Math.cos(degrees * Math.PI / 180),
  y: centre.y + radius * Math.sin(degrees * Math.PI / 180),
});

const pair = point => `${fmt(point.x)},${fmt(point.y)}`;

// Each command as [path data, the points it adds]: control points and an arc's samples count, so
// the page grows to hold the path.
const lineCommand = end => [`L${pair(end)}`, [end]];
const quadraticCommand = (control, end) => [`Q${pair(control)} ${pair(end)}`, [control, end]];
const cubicCommand = (first, second, end) => [`C${pair(first)} ${pair(second)} ${pair(end)}`, [first, second, end]];

// arc(centre, radius, startDegrees, endDegrees): a line to the arc's start, then the arc.
function arcCommand(centre, radius, from, to) {
  const start = arcPoint(centre, radius, from), end = arcPoint(centre, radius, to);
  const sweep = to > from ? 1 : 0, large = Math.abs(to - from) > 180 ? 1 : 0;
  const samples = Array.from({ length: 25 }, (_, step) => arcPoint(centre, radius, from + (to - from) * step / 24));
  return [`L${pair(start)} A${fmt(radius)},${fmt(radius)} 0 ${large} ${sweep} ${pair(end)}`, samples];
}

// A path from a start point; point() turns what the script names into a point.
export function pathBuilder(start, drawings, point) {
  const commands = [`M${pair(start)}`], mark = { kind: 'path', path: commands[0], options: {}, points: [start] };
  drawings.push(mark);
  const add = ([command, points]) => {
    mark.points.push(...points);
    commands.push(command);
    mark.path = commands.join(' ');
    return builder;
  };
  const builder = {
    mark,
    lineTo: to => add(lineCommand(point(to))),
    quadraticCurveTo: (control, to) => add(quadraticCommand(point(control), point(to))),
    bezierCurveTo: (first, second, to) => add(cubicCommand(point(first), point(second), point(to))),
    arc: (centre, radius, from, to) => add(arcCommand(point(centre), radius, from, to)),
    closePath: () => add(['Z', []]),
    style: options => { Object.assign(mark.options, options); return builder; },
  };
  return builder;
}
