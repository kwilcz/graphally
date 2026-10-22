// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Edits of a page-mode diagram's source, as text patches that keep the rest of the file as
// written: the edit command and agents change a diagram through these.
//
//   { op: 'move', id, dx, dy }          adds to the element's nudge="dx,dy"
//   { op: 'nudge', id, x, y }           sets it (0,0 removes it)
//   { op: 'connect', from, to, …opts }  adds a connection to the JSON block
//   { op: 'line', key, set: { … } }     changes a connection's options (null removes one)
//   { op: 'unline', key }               removes a connection
//
// A connection's key is its "id", else "from->to", with "#2", "#3" for repeats: the key the
// SVG carries on <g data-edge>.

// The span of the n-th <diagram> (or the one with that id) in the file.
function diagramSpan(src, which) {
  const re = /<diagram\b[^>]*>[\s\S]*?<\/diagram>/g, all = [...src.matchAll(re)];
  const m = typeof which === 'string' ? all.find(x => new RegExp(`\\bid\\s*=\\s*["']?${which}["'\\s>]`).test(x[0].slice(0, x[0].indexOf('>') + 1))) : all[which || 0];
  if (!m) throw new Error(typeof which === 'string' ? `no <diagram id=${which}>` : 'no <diagram> in the file');
  return { start: m.index, end: m.index + m[0].length, text: m[0] };
}

// The start tag of the element with this id, inside the diagram.
function tagOf(text, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp(`<([a-zA-Z][\\w-]*)\\b(?:[^>"']|"[^"]*"|'[^']*')*?\\bid\\s*=\\s*(?:"${esc}"|'${esc}'|${esc})(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`));
  if (!m) throw new Error(`no element with id "${id}"`);
  return { start: m.index, end: m.index + m[0].length, text: m[0] };
}

// Sets (or, with null, removes) one attribute in a start tag.
function setAttr(tag, name, value) {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`);
  if (value == null) return tag.replace(re, '');
  const attr = ` ${name}="${value}"`;
  return re.test(tag) ? tag.replace(re, attr) : tag.replace(/\s*\/?>$/, m => attr + m);
}
const getAttr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`)); return m ? m[1] ?? m[2] ?? m[3] : null; };

// The JSON block and the text span of each top-level entry, so untouched entries keep their text.
function linesBlock(text) {
  const m = text.match(/(<script\b[^>]*type\s*=\s*["']?application\/json["']?[^>]*>)([\s\S]*?)(<\/script>)/i);
  if (!m) return null;
  const bodyStart = m.index + m[1].length, body = m[2];
  const entries = [];
  let depth = 0, inStr = false, start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; if (depth === 1 && start < 0) start = i; continue; }
    if (c === '[' || c === '{') { if (depth === 1 && start < 0) start = i; depth++; continue; }
    if (c === ']' || c === '}') { depth--; if (depth === 1 && start >= 0) { entries.push([start, i + 1]); start = -1; } continue; }
  }
  return { start: bodyStart, end: bodyStart + body.length, body, entries, value: JSON.parse(body) };
}
const keyOf = (o, seen) => {
  const e = Array.isArray(o) ? { from: o[0], to: o[1] } : o, base = e.id || `${e.from}->${e.to}`, k = (seen.get(base) || 0) + 1;
  seen.set(base, k);
  return k > 1 ? `${base}#${k}` : base;
};
// One entry in the house style: { "from": "a", "to": "b", "label": "x" }.
const fmt = o => (Array.isArray(o) ? JSON.stringify(o).replace(/,/g, ', ') : `{ ${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v).replace(/,(?=["\[\d-])/g, ', ')}`).join(', ')} }`);

export function applyEdits(src, edits, { diagram } = {}) {
  const applied = [], errors = [];
  for (const ed of [].concat(edits)) {
    try {
      const d = diagramSpan(src, diagram);
      let text = d.text;
      if (ed.op === 'move' || ed.op === 'nudge') {
        const t = tagOf(text, ed.id), [x0, y0] = (getAttr(t.text, 'nudge') || '0,0').split(',').map(Number);
        const x = Math.round(ed.op === 'move' ? x0 + Number(ed.dx) : Number(ed.x)), y = Math.round(ed.op === 'move' ? y0 + Number(ed.dy) : Number(ed.y));
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('move needs numbers');
        text = text.slice(0, t.start) + setAttr(t.text, 'nudge', x || y ? `${x},${y}` : null) + text.slice(t.end);
      } else if (ed.op === 'connect' || ed.op === 'line' || ed.op === 'unline') {
        let b = linesBlock(text);
        if (!b) {
          if (ed.op !== 'connect') throw new Error(`no connection "${ed.key}": the diagram has no JSON connections`);
          const at = text.lastIndexOf('</diagram>');
          text = `${text.slice(0, at)}<script type="application/json">\n[\n]\n</script>\n${text.slice(at)}`;
          b = linesBlock(text);
        }
        let body = b.body;
        if (ed.op === 'connect') {
          const { op, ...entry } = ed;
          if (!entry.from || !entry.to) throw new Error('connect needs "from" and "to"');
          const indent = b.entries.length ? (body.slice(0, b.entries[0][0]).match(/[ \t]*$/) || [''])[0] : '  ';
          const last = b.entries.at(-1);
          body = last ? `${body.slice(0, last[1])},\n${indent}${fmt(entry)}${body.slice(last[1])}` : body.replace(/\[\s*\]/, `[\n${indent}${fmt(entry)}\n]`);
        } else {
          const seen = new Map(), i = b.value.findIndex(o => keyOf(o, seen) === ed.key);
          if (i < 0) throw new Error(`no connection "${ed.key}" in the JSON connections`);
          const [s, e] = b.entries[i];
          if (ed.op === 'unline') {
            // Remove the entry with the comma and line break that separate it from a neighbour.
            const before = body.slice(0, s).replace(/,\s*$/, ''), after = body.slice(e);
            body = i > 0 ? before + after : body.slice(0, s) + after.replace(/^\s*,\s*/, '');
          } else {
            const o = Array.isArray(b.value[i]) ? { from: b.value[i][0], to: b.value[i][1], ...(b.value[i][2] ? { label: b.value[i][2] } : {}) } : { ...b.value[i] };
            for (const [k, v] of Object.entries(ed.set || {})) { if (v == null) delete o[k]; else o[k] = v; }
            body = body.slice(0, s) + fmt(o) + body.slice(e);
          }
        }
        JSON.parse(body);
        text = text.slice(0, b.start) + body + text.slice(b.end);
      } else throw new Error(`unknown edit "${ed.op}"`);
      src = src.slice(0, d.start) + text + src.slice(d.end);
      applied.push(ed);
    } catch (e) { errors.push({ edit: ed, message: e.message }); }
  }
  return { source: src, applied, errors };
}

// The connections of a diagram as data (for an agent to read).
export function readLines(src, { diagram } = {}) {
  const b = linesBlock(diagramSpan(src, diagram).text);
  if (!b) return [];
  const seen = new Map();
  return b.value.map(o => ({ key: keyOf(o, seen), ...(Array.isArray(o) ? { from: o[0], to: o[1], ...(o[2] ? { label: o[2] } : {}) } : o) }));
}
