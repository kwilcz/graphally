// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The diagram's JSON connections as text: the block, the span of each entry (so untouched entries
// keep their text), and the edits that add, change or remove one.

const BLOCK = /(<script\b[^>]*type\s*=\s*["']?application\/json["']?[^>]*>)([\s\S]*?)(<\/script>)/i;

// Reads one character of the block's body: a top-level entry starts at a string or a bracket
// at depth 1 and ends where its closing bracket brings the depth back to 1.
function scan(body, i, state, spans) {
  const c = body[i];
  if (state.inString) {
    if (c === '"') state.inString = false;
    return c === '\\' ? i + 1 : i;
  }
  if ((c === '"' || c === '[' || c === '{') && state.depth === 1 && state.start < 0) state.start = i;
  if (c === '"') state.inString = true;
  else if (c === '[' || c === '{') state.depth++;
  else if (c === ']' || c === '}') closeBracket(state, i, spans);
  return i;
}

function closeBracket(state, i, spans) {
  state.depth--;
  if (state.depth !== 1 || state.start < 0) return;
  spans.push([state.start, i + 1]);
  state.start = -1;
}

function entrySpans(body) {
  const spans = [], state = { depth: 0, inString: false, start: -1 };
  for (let i = 0; i < body.length; i++) i = scan(body, i, state, spans);
  return spans;
}

// The JSON block of a diagram's text, or null.
export function connectionsBlock(text) {
  const match = text.match(BLOCK);
  if (!match) return null;
  const start = match.index + match[1].length, body = match[2];
  return { start, end: start + body.length, body, entries: entrySpans(body), value: JSON.parse(body) };
}

// The text with an empty block added before </diagram>, for a first connection.
export function withEmptyBlock(text) {
  const at = text.lastIndexOf('</diagram>');
  return `${text.slice(0, at)}<script type="application/json">\n[\n]\n</script>\n${text.slice(at)}`;
}

// A connection's key: its id, else from->to, with #2, #3 for repeats.
export function keyOf(entry, seen) {
  const { id, from, to } = Array.isArray(entry) ? { from: entry[0], to: entry[1] } : entry;
  const base = id || `${from}->${to}`;
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  return count > 1 ? `${base}#${count}` : base;
}

// An entry as an object: ["a", "b", "label"] is { from, to, label }.
const arrayAsObject = entry => ({ from: entry[0], to: entry[1], ...(entry[2] ? { label: entry[2] } : {}) });
export const asObject = entry => (Array.isArray(entry) ? arrayAsObject(entry) : { ...entry });

// A value as JSON, with a space after each comma between its items.
const formatValue = value => JSON.stringify(value).replace(/,(?=["[\d-])/g, ', ');

// One entry in the house style: { "from": "a", "to": "b", "label": "x" }.
function formatEntry(entry) {
  if (Array.isArray(entry)) return JSON.stringify(entry).replace(/,/g, ', ');
  const fields = Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${formatValue(value)}`);
  return `{ ${fields.join(', ')} }`;
}

// The entry's index by its key; an unknown key is an error.
function indexOfKey(block, key) {
  const seen = new Map(), index = block.value.findIndex(entry => keyOf(entry, seen) === key);
  if (index < 0) throw new Error(`no connection "${key}" in the JSON connections`);
  return index;
}

// A new connection after the last one, indented like the first.
function connect({ body, entries }, { op, ...entry }) {
  if (!entry.from || !entry.to) throw new Error('connect needs "from" and "to"');
  const indent = entries.length ? (body.slice(0, entries[0][0]).match(/[ \t]*$/) || [''])[0] : '  ';
  const last = entries.at(-1);
  if (!last) return body.replace(/\[\s*\]/, `[\n${indent}${formatEntry(entry)}\n]`);
  return `${body.slice(0, last[1])},\n${indent}${formatEntry(entry)}${body.slice(last[1])}`;
}

// A connection's options changed; a null value removes one.
function changeLine(block, { key, set }) {
  const index = indexOfKey(block, key), [start, end] = block.entries[index], entry = asObject(block.value[index]);
  for (const [name, value] of Object.entries(set || {})) {
    if (value == null) delete entry[name];
    else entry[name] = value;
  }
  return block.body.slice(0, start) + formatEntry(entry) + block.body.slice(end);
}

// A connection removed, with the comma and line break that separate it from a neighbour.
function removeLine(block, { key }) {
  const index = indexOfKey(block, key), [start, end] = block.entries[index], { body } = block;
  const after = body.slice(end);
  if (index > 0) return body.slice(0, start).replace(/,\s*$/, '') + after;
  return body.slice(0, start) + after.replace(/^\s*,\s*/, '');
}

export const CONNECTION_EDITS = { connect, line: changeLine, unline: removeLine };

// The first connection with an end among the ids, and what becomes of it: removed, or, from a
// list of ends, kept without them.
function lineToAny(block, ids) {
  const seen = new Map();
  for (const entry of block.value) {
    const key = keyOf(entry, seen), line = asObject(entry);
    const ends = ['from', 'to'].filter(end => [line[end]].flat().some(name => ids.has(name)));
    if (!ends.length) continue;
    const kept = Object.fromEntries(ends.map(end => [end, [line[end]].flat().filter(name => !ids.has(name))]));
    const keepsList = ends.every(end => Array.isArray(line[end]) && kept[end].length);
    return keepsList ? changeLine(block, { key, set: kept }) : removeLine(block, { key });
  }
  return null;
}

// The text without the connections to any of the ids (an element removed with its boxes).
export function withoutLinesTo(text, ids) {
  for (let block = connectionsBlock(text); block && ids.size;) {
    const body = lineToAny(block, ids);
    if (body === null) return text;
    text = text.slice(0, block.start) + body + text.slice(block.end);
    block = connectionsBlock(text);
  }
  return text;
}
