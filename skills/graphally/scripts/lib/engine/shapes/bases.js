// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The bases a shape is drawn from. path(box): the outline. under(box): paths drawn behind it, in
// the same fill. lines(box): strokes over the fill (a cylinder's rim). round: lines meet it at
// the middle of a side. open: not filled. dash: its own line style. event, gateway and cycle:
// what its markers are (markers.js).
import { fmt } from '../svg.js';
import {
  polygon, circleIn, ellipsePath, diamondPath, roundRect, stadiumPath, documentPath, arrowPath,
} from './paths.js';

const cylinderRim = ({ w, h }) => Math.min(h * 0.12, w * 0.2, 10);
const pipeRim = ({ w, h }) => Math.min(w * 0.12, h * 0.2, 10);
const fold = ({ w, h }) => Math.min(14, w * 0.25, h * 0.3);
const slant = ({ w, h }) => Math.min(h * 0.35, w / 4);
const notch = ({ w, h }) => Math.min(h / 2, w / 4, 20);

function cylinderPath(box) {
  const { x, y, w, h } = box, r = cylinderRim(box), arc = `A${fmt(w / 2)},${fmt(r)} 0 0 1`;
  return `M${fmt(x)},${fmt(y + r)} ${arc} ${fmt(x + w)},${fmt(y + r)}`
    + ` V${fmt(y + h - r)} ${arc} ${fmt(x)},${fmt(y + h - r)} Z`;
}

function pipePath(box) {
  const { x, y, w, h } = box, r = pipeRim(box), arc = `A${fmt(r)},${fmt(h / 2)} 0 0 1`;
  return `M${fmt(x + r)},${fmt(y)} H${fmt(x + w - r)} ${arc} ${fmt(x + w - r)},${fmt(y + h)}`
    + ` H${fmt(x + r)} ${arc} ${fmt(x + r)},${fmt(y)} Z`;
}

function calloutPath({ x, y, w, h }) {
  const tail = Math.min(14, h * 0.25), bottom = h - tail, r = Math.min(8, bottom / 2);
  return `M${fmt(x + r)},${fmt(y)} H${fmt(x + w - r)} Q${fmt(x + w)},${fmt(y)} ${fmt(x + w)},${fmt(y + r)}`
    + ` V${fmt(y + bottom - r)} Q${fmt(x + w)},${fmt(y + bottom)} ${fmt(x + w - r)},${fmt(y + bottom)}`
    + ` H${fmt(x + w * 0.34)} L${fmt(x + w * 0.14)},${fmt(y + h)} L${fmt(x + w * 0.2)},${fmt(y + bottom)}`
    + ` H${fmt(x + r)} Q${fmt(x)},${fmt(y + bottom)} ${fmt(x)},${fmt(y + bottom - r)}`
    + ` V${fmt(y + r)} Q${fmt(x)},${fmt(y)} ${fmt(x + r)},${fmt(y)} Z`;
}

function cloudPath({ x, y, w, h }) {
  const at = (u, v) => `${fmt(x + u * w)},${fmt(y + v * h)}`;
  return `M${at(0.25, 0.88)} C${at(0.04, 0.88)} ${at(-0.01, 0.56)} ${at(0.17, 0.48)}`
    + ` C${at(0.12, 0.22)} ${at(0.36, 0.08)} ${at(0.5, 0.24)}`
    + ` C${at(0.58, 0.02)} ${at(0.9, 0.06)} ${at(0.85, 0.36)}`
    + ` C${at(1.03, 0.4)} ${at(1.03, 0.84)} ${at(0.8, 0.88)} Z`;
}

function delayPath({ x, y, w, h }) {
  const r = Math.min(h / 2, w / 2);
  return `M${fmt(x)},${fmt(y)} H${fmt(x + w - r)}`
    + ` A${fmt(r)},${fmt(h / 2)} 0 0 1 ${fmt(x + w - r)},${fmt(y + h)} H${fmt(x)} Z`;
}

const plainBox = box => roundRect(box, 0);
const roundedBox = box => roundRect(box, 10);

export const BASES = {
  rect: { path: plainBox },
  rounded: { path: roundedBox },
  stadium: { path: stadiumPath },
  ellipse: { path: ellipsePath, round: true },
  circle: { path: circleIn, round: true },
  // The top half of an ellipse filling the box: a box twice as wide as it is high is a half disc.
  semicircle: {
    path: ({ x, y, w, h }) => {
      const bottom = fmt(y + h);
      return `M${fmt(x)},${bottom} A${fmt(w / 2)},${fmt(h)} 0 0 1 ${fmt(x + w)},${bottom} Z`;
    },
  },
  diamond: { path: diamondPath, round: true },
  hexagon: {
    path: ({ x, y, w, h }) => {
      const k = Math.min(h * 0.29, w / 4);
      return polygon([
        [x + k, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x + k, y + h], [x, y + h / 2],
      ]);
    },
  },
  triangle: { path: ({ x, y, w, h }) => polygon([[x + w / 2, y], [x + w, y + h], [x, y + h]]) },
  parallelogram: {
    path: box => {
      const { x, y, w, h } = box, k = slant(box);
      return polygon([[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]]);
    },
  },
  trapezoid: {
    path: box => {
      const { x, y, w, h } = box, k = slant(box);
      return polygon([[x + k, y], [x + w - k, y], [x + w, y + h], [x, y + h]]);
    },
  },
  chevron: {
    path: box => {
      const { x, y, w, h } = box, k = notch(box);
      return polygon([
        [x, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x, y + h], [x + k, y + h / 2],
      ]);
    },
  },
  'chevron-start': {
    path: box => {
      const { x, y, w, h } = box, k = notch(box);
      return polygon([[x, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x, y + h]]);
    },
  },
  'arrow-right': { path: arrowPath('right') },
  'arrow-left': { path: arrowPath('left') },
  'arrow-up': { path: arrowPath('up') },
  'arrow-down': { path: arrowPath('down') },
  cylinder: {
    path: cylinderPath,
    lines: box => {
      const { x, y, w } = box, r = cylinderRim(box);
      return [`M${fmt(x)},${fmt(y + r)} A${fmt(w / 2)},${fmt(r)} 0 0 0 ${fmt(x + w)},${fmt(y + r)}`];
    },
  },
  'cylinder-h': {
    path: pipePath,
    lines: box => {
      const { x, y, w, h } = box, r = pipeRim(box);
      return [`M${fmt(x + w - r)},${fmt(y)} A${fmt(r)},${fmt(h / 2)} 0 0 0 ${fmt(x + w - r)},${fmt(y + h)}`];
    },
  },
  document: { path: documentPath },
  documents: {
    path: ({ x, y, w, h }) => documentPath({ x, y: y + 8, w: w - 8, h: h - 8 }),
    under: ({ x, y, w, h }) => [
      documentPath({ x: x + 8, y, w: w - 8, h: h - 8 }),
      documentPath({ x: x + 4, y: y + 4, w: w - 8, h: h - 8 }),
    ],
  },
  note: {
    path: box => {
      const { x, y, w, h } = box, k = fold(box);
      return polygon([[x, y], [x + w - k, y], [x + w, y + k], [x + w, y + h], [x, y + h]]);
    },
    lines: box => {
      const { x, y, w } = box, k = fold(box);
      return [`M${fmt(x + w - k)},${fmt(y)} V${fmt(y + k)} H${fmt(x + w)}`];
    },
  },
  callout: { path: calloutPath },
  cloud: { path: cloudPath },
  'manual-input': {
    path: ({ x, y, w, h }) => polygon([[x, y + h * 0.28], [x + w, y], [x + w, y + h], [x, y + h]]),
  },
  predefined: {
    path: plainBox,
    lines: ({ x, y, w, h }) => {
      const k = Math.min(10, w / 10);
      return [`M${fmt(x + k)},${fmt(y)} V${fmt(y + h)} M${fmt(x + w - k)},${fmt(y)} V${fmt(y + h)}`];
    },
  },
  delay: { path: delayPath },
  'off-page': {
    path: ({ x, y, w, h }) => polygon([
      [x, y], [x + w, y], [x + w, y + h * 0.68], [x + w / 2, y + h], [x, y + h * 0.68],
    ]),
  },
  // BPMN
  task: { path: roundedBox },
  subprocess: { path: roundedBox, marks: ['subprocess'] },
  start: { path: circleIn, round: true, event: 'start' },
  event: { path: circleIn, round: true, event: 'event' },
  end: { path: circleIn, round: true, event: 'end' },
  gateway: { path: diamondPath, round: true, gateway: true },
  // BPMN artifacts (10.7): a text annotation is an open bracket beside its text; a group is a
  // rounded box drawn dash-dot, a line style no other element uses.
  annotation: {
    path: ({ x, y, w, h }) => {
      const end = fmt(x + Math.min(12, w));
      return `M${end},${fmt(y)} H${fmt(x)} V${fmt(y + h)} H${end}`;
    },
    open: true,
  },
  group: { path: roundedBox, dash: '9 3 1.5 3' },
  // A repeat badge: a ring holding two arrows chasing each other round.
  cycle: { path: circleIn, round: true, cycle: true },
};

export const ALIASES = {
  box: 'rect', process: 'rect', square: 'rect', pill: 'stadium', terminator: 'stadium', oval: 'ellipse',
  decision: 'diamond', rhombus: 'diamond', io: 'parallelogram', data: 'parallelogram',
  database: 'cylinder', db: 'cylinder', 'data-store': 'cylinder', queue: 'cylinder-h',
  'data-object': 'note', folded: 'note', subroutine: 'predefined', 'multi-document': 'documents',
  'start-event': 'start', 'end-event': 'end', intermediate: 'event', 'intermediate-event': 'event',
  activity: 'task', 'sub-process': 'subprocess', arrow: 'arrow-right', step: 'chevron-start',
  repeat: 'cycle', refresh: 'cycle', loop: 'cycle',
};
