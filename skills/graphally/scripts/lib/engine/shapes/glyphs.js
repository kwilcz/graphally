// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Glyphs: the markers inside events, gateways and tasks, each drawn once on a 16-unit grid
// centred on 8,8 and placed at any size, so an end event's envelope is the send task's. A part
// is [path, kind, stroke width in px]: 'line' is open, or filled on a filled marker; 'stroke' is
// never filled; 'ink' always is; 'open' and 'shut' appear only on an open or a filled marker,
// 'shut' drawn in the card colour to cut into the fill.
import { fmt, svgElement } from '../svg.js';

// Path data written over several lines, as one.
const path = text => text.trim().replace(/\s+/g, ' ');

const ENVELOPE = path(`
  M2,3.5 H14 A1,1 0 0 1 15,4.5 V11.5 A1,1 0 0 1 14,12.5 H2 A1,1 0 0 1 1,11.5 V4.5 A1,1 0 0 1 2,3.5 Z`);
const GEAR = path(`
  M6.81,2.84 L6.86,0.79 A7.3,7.3 0 0 1 9.14,0.79 L9.19,2.84 A5.3,5.3 0 0 1 10.81,3.51 L12.29,2.09
  A7.3,7.3 0 0 1 13.91,3.71 L12.49,5.19 A5.3,5.3 0 0 1 13.16,6.81 L15.21,6.86 A7.3,7.3 0 0 1 15.21,9.14
  L13.16,9.19 A5.3,5.3 0 0 1 12.49,10.81 L13.91,12.29 A7.3,7.3 0 0 1 12.29,13.91 L10.81,12.49
  A5.3,5.3 0 0 1 9.19,13.16 L9.14,15.21 A7.3,7.3 0 0 1 6.86,15.21 L6.81,13.16 A5.3,5.3 0 0 1 5.19,12.49
  L3.71,13.91 A7.3,7.3 0 0 1 2.09,12.29 L3.51,10.81 A5.3,5.3 0 0 1 2.84,9.19 L0.79,9.14
  A7.3,7.3 0 0 1 0.79,6.86 L2.84,6.81 A5.3,5.3 0 0 1 3.51,5.19 L2.09,3.71 A7.3,7.3 0 0 1 3.71,2.09
  L5.19,3.51 A5.3,5.3 0 0 1 6.81,2.84 Z`);
const HAND = path(`
  M4,6.5 H7.5 L9.6,4.1 A0.8,0.8 0 0 1 10.9,5 L9.8,6.5 H14.2 A0.8,0.8 0 0 1 14.2,8.1 H13.4
  A0.8,0.8 0 0 1 13.4,9.7 H12.8 A0.8,0.8 0 0 1 12.8,11.3 H12 A0.8,0.8 0 0 1 12,12.9 H4 Z
  M10.4,8.1 H13.4 M10.4,9.7 H12.8 M10.4,11.3 H12`);

export const GLYPH = {
  message: [
    [ENVELOPE, 'line', 1.2],
    ['M1.4,4.2 L8,9 L14.6,4.2', 'open', 1.2],
    ['M3,5.3 L8,9 L13,5.3', 'shut', 1.3],
  ],
  timer: [
    ['M0.38,8 A7.62,7.62 0 1 1 15.62,8 A7.62,7.62 0 1 1 0.38,8 Z', 'stroke', 1.3],
    ['M8,2.67 V8 L11.81,9.9', 'stroke', 1.3],
  ],
  signal: [['M8,1.52 L14.48,12.57 L1.52,12.57 Z', 'line', 1.3]],
  error: [['M2.67,13.33 L5.71,2.67 L8.76,8.38 L13.33,2.67 L10.29,13.33 L7.24,7.62 Z', 'line', 1.3]],
  escalation: [['M8,1.14 L12.57,14.1 L8,9.9 L3.43,14.1 Z', 'line', 1.3]],
  conditional: [
    ['M3.81,1.9 H12.19 V14.1 H3.81 Z', 'stroke', 1.2],
    ['M5.33,4.57 H10.67 M5.33,6.86 H10.67 M5.33,9.14 H10.67 M5.33,11.43 H10.67', 'stroke', 1],
  ],
  link: [['M2.29,5.71 L8.38,5.71 L8.38,3.05 L14.1,8 L8.38,12.95 L8.38,10.29 L2.29,10.29 Z', 'line', 1.3]],
  compensation: [['M1.52,8 L7.62,3.81 L7.62,12.19 Z M7.62,8 L13.71,3.81 L13.71,12.19 Z', 'line', 1.3]],
  cancel: [[path(`
    M10.96,3.21 L12.79,5.04 L9.83,8 L12.79,10.96 L10.96,12.79 L8,9.83 L5.04,12.79 L3.21,10.96 L6.17,8
    L3.21,5.04 L5.04,3.21 L8,6.17 Z`), 'line', 1.2]],
  multiple: [['M8,2.21 L13.94,6.53 L11.67,13.51 L4.33,13.51 L2.06,6.53 Z', 'line', 1.3]],
  'parallel-multiple': [
    ['M6.1,2.06 H9.9 V6.1 H13.94 V9.9 H9.9 V13.94 H6.1 V9.9 H2.06 V6.1 H6.1 Z', 'line', 1.2],
  ],
  terminate: [['M1.14,8 A6.86,6.86 0 1 1 14.86,8 A6.86,6.86 0 1 1 1.14,8 Z', 'ink', 1]],
  'gateway exclusive': [['M3.5,3.5 L12.5,12.5 M12.5,3.5 L3.5,12.5', 'stroke', 2.6]],
  'gateway parallel': [['M2.38,8 H13.62 M8,2.38 V13.62', 'stroke', 2.8]],
  'gateway inclusive': [['M2.83,8 A5.17,5.17 0 1 1 13.17,8 A5.17,5.17 0 1 1 2.83,8 Z', 'stroke', 2.4]],
  'ad-hoc': [['M1.5,9.5 C3.5,5.2 6,5.2 8,8 C10,10.8 12.5,10.8 14.5,6.5', 'stroke', 1.5]],
  arrow: [['M2,5.5 H8.5 V2.5 L14.5,8 L8.5,13.5 V10.5 H2 Z', 'line', 1.2]],
  'gateway complex': [
    ['M2.38,8 H13.62 M8,2.38 V13.62 M3.95,3.95 L12.05,12.05 M12.05,3.95 L3.95,12.05', 'stroke', 2.6],
  ],
  user: [
    ['M4.8,5 A3.2,3.2 0 1 1 11.2,5 A3.2,3.2 0 1 1 4.8,5 Z', 'stroke', 1.2],
    ['M2,15 C2,10.5 4.5,9.2 8,9.2 C11.5,9.2 14,10.5 14,15 Z', 'stroke', 1.2],
  ],
  service: [[GEAR, 'stroke', 1.1], ['M5.8,8 A2.2,2.2 0 1 1 10.2,8 A2.2,2.2 0 1 1 5.8,8 Z', 'stroke', 1.1]],
  manual: [['M1,6.5 H4 V12.9 H1 Z', 'stroke', 1.1], [HAND, 'stroke', 1.1]],
  // A scroll: both sides curve alike, 9 apart, and each line is centred on the page at its height.
  script: [
    [path(`
      M4.5,1.5 H13.5 C11.5,4 11.5,5.5 12.5,8 C13.5,10.5 13.5,12 11.5,14.5 H2.5 C4.5,12 4.5,10.5 3.5,8
      C2.5,5.5 2.5,4 4.5,1.5 Z`), 'stroke', 1.1],
    ['M4.85,5 H9.85 M5.5,8 H10.5 M6.15,11 H11.15', 'stroke', 1],
  ],
  'business-rule': [
    ['M1,2.5 H15 V13.5 H1 Z', 'stroke', 1.1],
    ['M1,2.5 H15 V5.5 H1 Z', 'ink', 1.1],
    ['M1,9.5 H15 M5.5,5.5 V13.5', 'stroke', 1],
  ],
};

const shown = (kind, filled) => (kind === 'open' ? !filled : kind === 'shut' ? filled : true);

// A glyph centred on cx,cy, size px across, in the ink colour; the stroke widths stay in px at any size.
export function glyph(name, cx, cy, size, filled, ink) {
  const scale = size / 16;
  const factor = +scale.toFixed(4);
  const transform = `matrix(${factor} 0 0 ${factor} ${fmt(cx - 8 * scale)} ${fmt(cy - 8 * scale)})`;
  return GLYPH[name].filter(([, kind]) => shown(kind, filled)).map(([d, kind, width]) => svgElement('path', {
    d, transform,
    style: `fill: ${kind === 'ink' || (kind === 'line' && filled) ? ink : 'none'}; `
      + `stroke: ${kind === 'shut' ? 'var(--card)' : ink}`,
    'stroke-width': +(width / scale).toFixed(2),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
}
