// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The inputs the canvas and its actions take, as JSON Schema for the app and the agent.

export const NOTHING = { type: 'object', properties: {}, additionalProperties: false };

export const OPEN = {
  type: 'object',
  properties: {
    filePath: {
      type: 'string', minLength: 1,
      description: 'The graphally diagram (.html) to show, relative to the workspace (default diagram.html).',
    },
  },
  additionalProperties: false,
};

// One edit, as the skill's edit command takes it. Other connection options (dashed, color, via,
// both, arrow) pass through to connect and line.
const EDIT = {
  type: 'object',
  description: 'move {id, dx, dy} adds to a box\'s nudge; nudge {id, x, y} sets it (0,0 removes it); '
    + 'connect {from, to, label?, out?, in?} adds a line; line {key, set} changes a line\'s options '
    + '(a null value removes one); unline {key} removes a line. A line\'s key is its id, else "from->to", '
    + 'with "#2", "#3" for repeats.',
  properties: {
    op: { type: 'string', enum: ['move', 'nudge', 'connect', 'line', 'unline'] },
    id: { type: 'string' },
    dx: { type: 'number' }, dy: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' },
    from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' },
    out: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
    in: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
    key: { type: 'string' }, set: { type: 'object' },
  },
  required: ['op'],
};

export const EDITS = {
  type: 'object',
  properties: { edits: { type: 'array', minItems: 1, items: EDIT } },
  required: ['edits'],
  additionalProperties: false,
};

export const SELECTION = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'What to select: boxes by their id, lines by their key. An empty list clears it.',
      items: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['box', 'line'] }, id: { type: 'string' } },
        required: ['kind', 'id'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};
