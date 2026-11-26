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
  description: 'Elements are named by id or by path (their place in the source, as get_diagram lists its '
    + 'layers). text {text} sets an element\'s own text; attr {name, value} sets an attribute (null removes '
    + 'it); cell {col?, row?, colSpan?, rowSpan?} puts it in a grid cell; place {into, before?} moves it into '
    + 'an element, before one of its children; remove, duplicate; insert {into, before?, html} writes new '
    + 'markup; wrap {html?} puts it in a new element (an opening tag, <div> by default); unwrap puts its '
    + 'children in its place. style {set} sets declarations of its style attribute, and rule {rule | selector, '
    + 'set, rename?, remove?} those of a rule of the diagram\'s <style> (rule is its index, as get_diagram lists '
    + 'styles.rules; a new selector adds a rule); in set, null removes a declaration. move {id, dx, dy} adds '
    + 'to a nudge and nudge {id, x, y} sets it. connect {from, to, label?} adds a line; line {key, set} '
    + 'changes its options; unline {key} removes it. A line\'s key is its id, else "from->to", with "#2", '
    + '"#3" for repeats.',
  properties: {
    op: {
      type: 'string',
      enum: [
        'text', 'attr', 'cell', 'place', 'remove', 'duplicate', 'insert', 'wrap', 'unwrap', 'style', 'rule',
        'move', 'nudge', 'connect', 'line', 'unline',
      ],
    },
    id: { type: 'string' }, path: { type: 'string' }, into: { type: 'string' }, before: { type: 'string' },
    text: { type: 'string' }, name: { type: 'string' }, value: { type: ['string', 'null'] }, html: { type: 'string' },
    col: { type: 'integer' }, row: { type: 'integer' }, colSpan: { type: 'integer' }, rowSpan: { type: 'integer' },
    dx: { type: 'number' }, dy: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' },
    from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' },
    out: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
    in: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
    key: { type: 'string' }, set: { type: 'object' },
    rule: { type: 'integer' }, selector: { type: 'string' }, rename: { type: 'string' }, remove: { type: 'boolean' },
  },
  required: ['op'],
};

export const EDITS = {
  type: 'object',
  properties: {
    edits: { type: 'array', minItems: 1, items: EDIT },
    version: {
      type: 'integer',
      description: 'The version get_diagram returned. Edits that name elements by path should give it: if the '
        + 'file changed since, the paths may name other elements, and the edits are refused.',
    },
  },
  required: ['edits'],
  additionalProperties: false,
};

export const SELECTION = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'What to select: an element by its id or its path in the source (as get_diagram lists '
        + 'its layers), or a line by its key. An empty list clears it.',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['element', 'line'] }, id: { type: 'string' }, path: { type: 'string' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};
