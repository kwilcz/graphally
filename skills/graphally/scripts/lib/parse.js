// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Parse a <diagram> element into a model. The source is small HTML:
//
//   <diagram title="…">
//     <layout> users edge app data </layout>          areas, like CSS grid-template-areas
//     <group id=app label="Application" icon=aca>
//       <node id=api icon="container app">Jobs API | validates tokens</node>
//     </group>
//     <links>
//       users -> api : HTTPS
//       api ~> bus : job events                         ~> is asynchronous (dashed)
//     </links>
//   </diagram>

const OPS = [
  ['<~>', { dashed: true, both: true }], ['<->', { both: true }], ['~>', { dashed: true }],
  ['=>', { accent: true }], ['->', {}], ['~~', { dashed: true, line: true }], ['--', { line: true }],
];

export function parseDiagram(el) {
  const model = {
    title: el.getAttribute('title') || '', subtitle: el.getAttribute('subtitle') || '',
    legend: el.getAttribute('legend') !== 'none' && el.getAttribute('legend') !== 'off',
    attrs: attrs(el),
    nodes: new Map(), groups: new Map(), edges: [], problems: [], order: [],
  };
  const root = { id: '__root', kind: 'group', style: 'root', children: [], parent: null, ...layoutOf(el, true), depth: -1 };
  model.root = root;
  model.groups.set(root.id, root);
  walk(el, root, model);
  resolveEdges(model);
  return model;
}

function attrs(el) {
  const o = {};
  for (const a of el.attributes) o[a.name] = a.value === '' ? true : a.value;
  return o;
}

function layoutOf(el, isRoot) {
  const map = [...el.children].find(c => c.tagName === 'LAYOUT');
  if (map) {
    const rows = map.textContent.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/\s+/));
    return { layout: 'map', map: rows };
  }
  const l = (el.getAttribute('layout') || '').toLowerCase();
  return { layout: l || (isRoot ? 'auto' : 'stack'), cols: Number(el.getAttribute('cols')) || 0 };
}

function walk(el, parent, model) {
  for (const c of el.children) {
    const tag = c.tagName;
    if (tag === 'GROUP' || tag === 'BAND' || tag === 'ZONE' || tag === 'LANE' || tag === 'POOL') {
      const a = attrs(c);
      const g = {
        id: a.id || `g${model.groups.size}`, kind: 'group', label: a.label || '', sub: a.sub || '', icon: a.icon || '',
        style: a.style || (tag === 'BAND' ? 'band' : tag === 'LANE' ? 'lane' : tag === 'POOL' ? 'pool' : a.external ? 'external' : 'box'),
        external: !!a.external, accent: !!a.accent, area: a.area || '', parent, children: [], depth: parent.depth + 1,
        ns: c.dataset?.ns || '', attrs: a, ...layoutOf(c),
      };
      // A band is a full-width row of shared services: side by side unless told otherwise.
      if (tag === 'BAND' && !c.getAttribute('layout') && g.layout === 'stack') g.layout = 'row';
      if (model.groups.has(g.id) || model.nodes.has(g.id)) model.problems.push({ rule: 'duplicate-id', id: g.id });
      model.groups.set(g.id, g);
      parent.children.push(g);
      model.order.push(g.id);
      walk(c, g, model);
    } else if (tag === 'NODE' || SHAPES[tag]) {
      const a = attrs(c);
      const small = c.querySelector('small');
      const own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      let [label, sub] = own.split('|').map(s => s.trim());
      if (small) sub = small.textContent.trim();
      const n = {
        id: a.id || `n${model.nodes.size}`, kind: 'node', label: label || a.id || '', sub: sub || '', icon: a.icon || '',
        style: a.style || (SHAPES[tag] ? 'shape' : 'card'), shape: SHAPES[tag] || '', kind2: a.type || a.kind || '',
        external: !!a.external, accent: !!a.accent, ghost: !!a.ghost, area: a.area || '',
        parent, attrs: a,
      };
      const nudge = c.getAttribute('nudge');
      if (nudge !== null) {
        const d = nudgeOf(nudge);
        if (d) n.nudge = d;
        else model.problems.push({ rule: 'bad-override', id: n.id, attr: 'nudge', value: nudge, hint: 'use nudge="dx,dy" in pixels' });
      }
      if (model.groups.has(n.id) || model.nodes.has(n.id)) model.problems.push({ rule: 'duplicate-id', id: n.id });
      model.nodes.set(n.id, n);
      parent.children.push(n);
      model.order.push(n.id);
      // Nested nodes form a tree (layout=tree): <node>Parent <node>Child</node></node>
      const kids = [...c.children].filter(k => k.tagName === 'NODE');
      if (kids.length) {
        n.kids = [];
        const holder = { id: n.id + '#kids', kind: 'holder', children: [], depth: parent.depth, parent };
        walk(c, holder, model);
        for (const k of holder.children) {
          k.parent = parent;
          if (!k.treeParent) { k.treeParent = n; n.kids.push(k); }   // deeper nodes keep theirs
          parent.children.push(k);
        }
      }
    } else if ((tag === 'LINKS' || tag === 'EDGES') && model.root.layout === 'sequence') {
      model.seqText = (model.seqText || '') + c.textContent + '\n';   // ordered messages, read by the sequence layout
    } else if (tag === 'LINKS' || tag === 'EDGES') {
      const ns = c.closest('[data-ns]')?.dataset.ns || '';
      parseLinks(c.textContent, ns, model);
    } else if (tag === 'EDGE' || tag === 'LINK') {
      // Long form, for tools that prefer elements: <edge from=a to=b label=… async>, or <link …> (the same).
      // id names the edge (its key); out / in fix the side the edge leaves / enters.
      const a = attrs(c), ns = c.closest('[data-ns]')?.dataset.ns || '';
      const override = {};
      for (const end of ['out', 'in']) {
        const v = c.getAttribute(end);
        if (v === null) continue;
        const s = SIDES.indexOf(v.trim().toLowerCase());
        if (s >= 0) override[end] = s;
        else model.problems.push({ rule: 'bad-override', id: a.id || `${a.from}->${a.to}`, attr: end, value: v, hint: 'use right, bottom, left or top' });
      }
      model.edges.push({ from: split(a.from), to: split(a.to), label: a.label || '', dashed: !!(a.async || a.dashed),
        both: !!a.both, accent: !!a.accent, line: !!a.line, ns, linkId: a.id || '', ...(Object.keys(override).length ? { override } : {}) });
    } else if (tag === 'LEVEL') {
      // <level label="Management groups" depth="2-3"> — a labelled band across tree levels
      const a = attrs(c);
      const [lo, hi] = String(a.depth ?? a.levels ?? '0').split('-').map(Number);
      (model.levels ||= []).push({ label: a.label || '', icon: a.icon || '', lo, hi: Number.isNaN(hi) || hi === undefined ? lo : hi });
    } else if (tag !== 'LAYOUT') {
      walk(c, parent, model);   // tolerate wrappers
    }
  }
}

const split = v => String(v || '').split(/[\s,]+/).filter(Boolean);
// Side names in router order: 0 right, 1 bottom, 2 left, 3 top.
const SIDES = ['right', 'bottom', 'left', 'top'];
// nudge="dx,dy" or "dx dy" (pixels, may be negative or decimal); null when not two numbers.
const nudgeOf = v => {
  const t = String(v).trim().split(/[\s,]+/);
  return t.length === 2 && t.every(x => /^[+-]?(\d+\.?\d*|\.\d+)$/.test(x)) ? { dx: Number(t[0]), dy: Number(t[1]) } : null;
};

// Process shapes (BPMN-flavoured). <gateway type=parallel>, <event type=timer>…
const SHAPES = { START: 'start', END: 'end', EVENT: 'event', TASK: 'task', GATEWAY: 'gateway', SUBPROCESS: 'subprocess', DECISION: 'gateway', STEP: 'task', MILESTONE: 'milestone', BAR: 'task' };

export function parseLinks(text, ns, model) {
  for (const raw of text.split(/\n|;/)) {
    const line = raw.replace(/(^|\s)(#|\/\/).*$/, '').trim();
    if (!line) continue;
    let rest = line, label = '';
    const colon = rest.indexOf(':');
    if (colon >= 0) { label = rest.slice(colon + 1).trim(); rest = rest.slice(0, colon); }
    // Split into refs and operators, allowing chains: a -> b -> c
    const parts = [];
    let buf = rest;
    while (buf.length) {
      let found = null;
      for (const [op] of OPS) {
        const i = buf.indexOf(op);
        if (i >= 0 && (found === null || i < found.i)) found = { i, op };
      }
      if (!found) { parts.push(buf.trim()); break; }
      parts.push(buf.slice(0, found.i).trim(), found.op);
      buf = buf.slice(found.i + found.op.length);
    }
    if (parts.length < 3) { model.problems.push({ rule: 'bad-link', line }); continue; }
    model._stmt = (model._stmt || 0) + 1;
    for (let i = 0; i + 2 < parts.length; i += 2) {
      const style = OPS.find(([o]) => o === parts[i + 1])[1];
      model.edges.push({ from: split(parts[i]), to: split(parts[i + 2]), label, ns, stmt: model._stmt, ...style });
    }
  }
}

function resolveEdges(model) {
  const known = id => model.nodes.has(id) || model.groups.has(id);
  const resolve = (ref, ns) => {
    if (ns && !ref.includes('.') && known(`${ns}.${ref}`)) return `${ns}.${ref}`;
    return ref;
  };
  const all = [...model.nodes.keys(), ...model.groups.keys()].filter(k => k !== '__root');
  const out = [];
  for (const e of model.edges) {
    for (const f of e.from) for (const t of e.to) {
      const from = resolve(f, e.ns), to = resolve(t, e.ns);
      const missing = [from, to].filter(x => !known(x));
      if (missing.length) {
        for (const m of missing) model.problems.push({ rule: 'unknown-id', id: m, suggest: closest(m, all) });
        continue;
      }
      out.push({ ...e, from, to, id: `e${out.length}` });
    }
  }
  // key: the link's id, else from->to; a repeat of the same key gets #2, #3 … in output order.
  const seen = new Map();
  for (const e of out) {
    const base = e.linkId || `${e.from}->${e.to}`, n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    e.key = n > 1 ? `${base}#${n}` : base;
  }
  model.edges = out;
}

function closest(s, list) {
  const d = (a, b) => {
    const m = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = m[0]; m[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return m[b.length];
  };
  const best = list.map(x => [x, d(s, x)]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, s.length / 3) ? best[0] : undefined;
}
