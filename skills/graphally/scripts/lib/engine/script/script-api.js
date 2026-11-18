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

// A curve's control point: off the middle of the straight line, square to it, by the bend.
function curveControl(from, to, bend) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
  return { x: (from.x + to.x) / 2 - dy / length * bend, y: (from.y + to.y) / 2 + dx / length * bend };
}

export function createScriptApi(figure, geometry) {
  const { find, point, facingEnds, originOf, markBox } = geometry;
  // A drawn mark, and the handle the script gets for it (to animate it).
  const mark = item => {
    figure.drawings.push(item);
    return { mark: item };
  };
  const line = (from, to, path, via, options) =>
    mark({ kind: 'path', path, options: { arrow: true, ...options }, ends: [from, to], via });
  const api = {
    el: reference => find(reference)[0],
    all: selector => find(selector),
    pt: pointAt,
    mid: (a, b) => {
      const [from, to] = [point(a), point(b)];
      return pointAt((from.x + to.x) / 2, (from.y + to.y) / 2);
    },
    lerp: (a, b, fraction) => {
      const [from, to] = [point(a), point(b)];
      return pointAt(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction);
    },
    connect(a, b, options = {}) {
      const statement = figure.edges.length + 1, via = [].concat(options.via || []).map(point);
      for (const from of find(a)) {
        for (const to of find(b)) figure.edges.push({ from: from.el, to: to.el, options, statement, via });
      }
    },
    arrow(a, b, options = {}) {
      const [from, to] = facingEnds(a, b);
      return line(from, to, `M${pathPoint(from)} L${pathPoint(to)}`, api.mid(from, to), options);
    },
    curve(a, b, options = {}) {
      const [from, to] = facingEnds(a, b);
      const control = curveControl(from, to, options.bend === undefined ? 40 : options.bend);
      const via = pointAt((from.x + 2 * control.x + to.x) / 4, (from.y + 2 * control.y + to.y) / 4);
      return line(from, to, `M${pathPoint(from)} Q${pathPoint(control)} ${pathPoint(to)}`, via, options);
    },
    depend: (a, b, options = {}) => drawDependency(figure, geometry, a, b, options),
    draw: {
      moveTo: start => pathBuilder(point(start), figure.drawings, point),
      arc: (centre, radius, from, to) => {
        const start = arcPoint(point(centre), radius, from);
        return pathBuilder(start, figure.drawings, point).arc(centre, radius, from, to);
      },
    },
    gate: (at, label = '', options = {}) => mark({ kind: 'gate', at: point(at), label, options }),
    text: (at, text, options = {}) => mark({ kind: 'text', at: point(at), text: String(text), options }),
    icon(at, name, options = {}) {
      const symbol = iconSymbol(figure, name);
      return symbol ? mark({ kind: 'icon', at: point(at), symbol, options }) : undefined;
    },
    shape: (kind, at, options = {}) => mark({ kind: 'shape', shape: kind, at: point(at), options }),
    // animate(target, keyframes, options), as element.animate in a browser: an element (id,
    // selector, box) or a mark the script drew moves when the figure is shown. The still figure
    // is where it rests.
    animate(reference, frames, options = {}) {
      if (!Array.isArray(frames) || !frames.length) {
        throw new Error('animate takes a list of keyframes, as element.animate does');
      }
      const marked = reference?.mark, targets = marked ? [marked] : find(reference);
      for (const target of targets) {
        const index = figure.animations.length;
        const origin = originOf(options.origin, marked ? markBox(marked) : target);
        figure.animations.push({ frames, options, origin });
        if (marked) marked.animation = index;
        else figure.animationOf.set(target.el, index);
      }
    },
  };
  return api;
}

export function runDrawingScripts(figure, api, scripts) {
  for (const code of scripts) runAuthorScript(code, api, figure.problems);
}
