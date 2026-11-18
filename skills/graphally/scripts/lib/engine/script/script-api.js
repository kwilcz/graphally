// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What a <script type="graphally"> sees: it runs after the page is laid out, with the geometry of
// every element, and connects and draws by name: el('id').right, mid(a, b), connect(a, b), arrow,
// curve, depend, draw.moveTo(…).lineTo(…), gate, text, icon, shape, animate.
import { fmt } from '../svg.js';
import { iconSymbol } from '../page/page-icons.js';
import { pointAt } from './geometry.js';
import { pathBuilder, arcPoint } from './path-builder.js';
import { drawDependency } from './depend.js';
import { runAuthorScript } from './run-script.js';

const pathPoint = point => `${fmt(point.x)},${fmt(point.y)}`;
const partWay = (a, b, fraction) => a + (b - a) * fraction;
const between = (from, to, fraction) => pointAt(partWay(from.x, to.x, fraction), partWay(from.y, to.y, fraction));
const middle = (from, to) => pointAt((from.x + to.x) / 2, (from.y + to.y) / 2);

// A curve's control point: off the middle of the straight line, square to it, by the bend.
function curveControl(from, to, bend) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
  return { x: (from.x + to.x) / 2 - dy / length * bend, y: (from.y + to.y) / 2 + dx / length * bend };
}

// A drawn mark, and the handle the script gets for it (to animate it).
const addMark = (figure, item) => {
  figure.drawings.push(item);
  return { mark: item };
};

// Points and boxes by name.
function pointsApi({ find, point }) {
  return {
    el: reference => find(reference)[0],
    all: selector => find(selector),
    pt: pointAt,
    mid: (a, b) => middle(point(a), point(b)),
    lerp: (a, b, fraction) => between(point(a), point(b), fraction),
  };
}

// Connections routed round the boxes, and dependency lines on a time chart.
function connectionsApi(figure, geometry) {
  return {
    connect(a, b, options = {}) {
      const statement = figure.edges.length + 1, via = [].concat(options.via || []).map(geometry.point);
      for (const from of geometry.find(a)) {
        for (const to of geometry.find(b)) figure.edges.push({ from: from.el, to: to.el, options, statement, via });
      }
    },
    depend: (a, b, options = {}) => drawDependency(figure, geometry, a, b, options),
  };
}

// Lines drawn where the script says: straight, curved, or a path of its own.
function linesApi(figure, { facingEnds, point }) {
  const line = (from, to, path, via, options) =>
    addMark(figure, { kind: 'path', path, options: { arrow: true, ...options }, ends: [from, to], via });
  return {
    arrow(a, b, options = {}) {
      const [from, to] = facingEnds(a, b);
      return line(from, to, `M${pathPoint(from)} L${pathPoint(to)}`, middle(from, to), options);
    },
    curve(a, b, options = {}) {
      const [from, to] = facingEnds(a, b);
      const control = curveControl(from, to, options.bend === undefined ? 40 : options.bend);
      const via = pointAt((from.x + 2 * control.x + to.x) / 4, (from.y + 2 * control.y + to.y) / 4);
      return line(from, to, `M${pathPoint(from)} Q${pathPoint(control)} ${pathPoint(to)}`, via, options);
    },
    draw: {
      moveTo: start => pathBuilder(point(start), figure.drawings, point),
      arc: (centre, radius, from, to) => {
        const start = arcPoint(point(centre), radius, from);
        return pathBuilder(start, figure.drawings, point).arc(centre, radius, from, to);
      },
    },
  };
}

// Marks placed at a point: a gate, text, an icon, a shape.
function marksApi(figure, { point }) {
  const at = (kind, where, fields) => addMark(figure, { kind, at: point(where), ...fields });
  return {
    gate: (where, label = '', options = {}) => at('gate', where, { label, options }),
    text: (where, text, options = {}) => at('text', where, { text: String(text), options }),
    icon(where, name, options = {}) {
      const symbol = iconSymbol(figure, name);
      return symbol ? addMark(figure, { kind: 'icon', at: point(where), symbol, options }) : undefined;
    },
    shape: (kind, where, options = {}) => addMark(figure, { kind: 'shape', shape: kind, at: point(where), options }),
  };
}

// animate(target, keyframes, options), as element.animate in a browser: an element (id,
// selector, box) or a mark the script drew moves when the figure is shown. The still figure is
// where it rests.
function animateApi(figure, { find, originOf, markBox }) {
  return function animate(reference, frames, options = {}) {
    if (!Array.isArray(frames) || !frames.length) {
      throw new Error('animate takes a list of keyframes, as element.animate does');
    }
    const marked = reference?.mark, targets = marked ? [marked] : find(reference);
    for (const target of targets) {
      const index = figure.animations.length;
      figure.animations.push({ frames, options, origin: originOf(options.origin, marked ? markBox(marked) : target) });
      if (marked) marked.animation = index;
      else figure.animationOf.set(target.el, index);
    }
  };
}

export function createScriptApi(figure, geometry) {
  return {
    ...pointsApi(geometry), ...connectionsApi(figure, geometry), ...linesApi(figure, geometry),
    ...marksApi(figure, geometry), animate: animateApi(figure, geometry),
  };
}

export function runDrawingScripts(figure, api, scripts) {
  for (const code of scripts) runAuthorScript(code, api, figure.problems);
}
