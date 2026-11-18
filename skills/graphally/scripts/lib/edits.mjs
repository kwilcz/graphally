// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Edits of a diagram's source, as text patches that keep the rest of the file as written: the
// edit command and agents change a diagram through these.
//
//   { op: 'move', id, dx, dy }          adds to the element's nudge="dx,dy"
//   { op: 'nudge', id, x, y }           sets it (0,0 removes it)
//   { op: 'connect', from, to, …opts }  adds a connection to the JSON block
//   { op: 'line', key, set: { … } }     changes a connection's options (null removes one)
//   { op: 'unline', key }               removes a connection
//
// A connection's key is its "id", else "from->to", with "#2", "#3" for repeats: the key the SVG
// carries on <g data-edge>.
import { diagramSpan, tagOf, getAttribute, setAttribute, splice } from './edits/markup.mjs';
import { connectionsBlock, withEmptyBlock, keyOf, asObject, CONNECTION_EDITS } from './edits/connections.mjs';

// move adds to the nudge, nudge sets it; a nudge of 0,0 is none.
function nudgeEdit(text, edit) {
  const tag = tagOf(text, edit.id), [x0, y0] = (getAttribute(tag.text, 'nudge') || '0,0').split(',').map(Number);
  const moving = edit.op === 'move';
  const x = Math.round(moving ? x0 + Number(edit.dx) : Number(edit.x)), y = Math.round(moving ? y0 + Number(edit.dy) : Number(edit.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('move needs numbers');
  return splice(text, tag, setAttribute(tag.text, 'nudge', x || y ? `${x},${y}` : null));
}

// The diagram's JSON block, made empty for a first connection.
function blockFor(text, edit) {
  const block = connectionsBlock(text);
  if (block) return { text, block };
  if (edit.op !== 'connect') throw new Error(`no connection "${edit.key}": the diagram has no JSON connections`);
  const withBlock = withEmptyBlock(text);
  return { text: withBlock, block: connectionsBlock(withBlock) };
}

function connectionEdit(text, edit) {
  const found = blockFor(text, edit), body = CONNECTION_EDITS[edit.op](found.block, edit);
  JSON.parse(body);
  return splice(found.text, found.block, body);
}

const EDITS = { move: nudgeEdit, nudge: nudgeEdit, connect: connectionEdit, line: connectionEdit, unline: connectionEdit };

function applyEdit(source, edit, diagram) {
  const span = diagramSpan(source, diagram);
  if (!Object.hasOwn(EDITS, edit.op)) throw new Error(`unknown edit "${edit.op}"`);
  return splice(source, span, EDITS[edit.op](span.text, edit));
}

export function applyEdits(source, edits, { diagram } = {}) {
  const applied = [], errors = [];
  for (const edit of [].concat(edits)) {
    try {
      source = applyEdit(source, edit, diagram);
      applied.push(edit);
    } catch (error) {
      errors.push({ edit, message: error.message });
    }
  }
  return { source, applied, errors };
}

// The connections of a diagram as data (for an agent to read).
export function readLines(source, { diagram } = {}) {
  const block = connectionsBlock(diagramSpan(source, diagram).text);
  if (!block) return [];
  const seen = new Map();
  return block.value.map(entry => ({ key: keyOf(entry, seen), ...asObject(entry) }));
}
