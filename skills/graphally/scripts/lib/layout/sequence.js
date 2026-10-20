// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Sequence diagrams: participants across the top, time running down.
//
//   <diagram layout=sequence numbered>
//     <node id=app icon="app service">Web app</node> …
//     <links>
//     user -> app : GET /orders
//     app -> entra : authorize | PKCE          (text after | goes under the arrow)
//     entra --> app : code                     (--> is a reply, dashed)
//     note app : validates state
//     loop every 50 minutes … else … end       (also alt, opt, par, critical, break)
//     </links>
//
// Columns are as close as the cards and the labels between them allow. A call opens an
// activation bar on the callee that closes with its reply. Fragments enclose the
// lifelines their messages touch.
import { S, T } from '../style.js';
import { sizeNodes } from './areas.js';

const ROW = 18, BAR = 10, MSG_MAX = 260, NOTE_MAX = 200, FRAG_PAD = 26;

export function layoutSequence(model, m) {
  sizeNodes(model, m);
  // Participants in document order; a group around participants draws as a box behind
  // their columns.
  const parts = [], boxes = [];
  for (const c of model.root.children) {
    if (c.kind === 'node') parts.push(c);
    else if (c.kind === 'group') {
      const kids = c.children.filter(k => k.kind === 'node');
      if (kids.length) { boxes.push({ g: c, first: parts.length, last: parts.length + kids.length - 1 }); parts.push(...kids); }
    }
  }
  const index = new Map(parts.map((p, i) => [p.id, i]));
  const steps = parseSteps(model.seqText || '', index, model, parts);

  // ---- horizontal: each lifeline as close as cards and labels allow ----
  const W = Math.max(...parts.map(p => p.fw));
  const msgW = s => s.lines.length ? Math.max(...s.lines.map(l => m.width(l, T.msg)), ...s.subs.map(l => m.width(l, T.sub))) + (model.attrs.numbered ? 22 : 0) : 0;
  for (const s of steps) {
    if (s.kind === 'msg') {
      s.lines = s.label ? m.wrap(s.label, T.msg, MSG_MAX) : [];
      s.subs = s.sub ? m.wrap(s.sub, T.sub, MSG_MAX) : [];
      s.w = msgW(s);
    } else if (s.kind === 'note') {
      s.lines = m.wrap(s.text, T.sub, NOTE_MAX);
      s.w = Math.ceil(Math.max(...s.lines.map(l => m.width(l, T.sub))) + 24);
    }
  }
  const need = parts.map(() => new Map());       // need[j].get(i): x_j - x_i >= value
  const req = (i, j, v) => { if (i > j) [i, j] = [j, i]; if (i === j) return; need[j].set(i, Math.max(need[j].get(i) || 0, v)); };
  for (let i = 1; i < parts.length; i++) req(i - 1, i, W + 36);
  let rightExtra = 0;
  for (const s of steps) {
    if (s.kind === 'msg' && s.from !== s.to) req(s.from, s.to, s.w + 36);
    if (s.kind === 'msg' && s.from === s.to) { if (s.from + 1 < parts.length) req(s.from, s.from + 1, 40 + s.w + 16); else rightExtra = Math.max(rightExtra, 40 + s.w - W / 2); }
    if (s.kind === 'note' && s.over.length === 1) {
      const i = s.over[0];
      if (i + 1 < parts.length) req(i, i + 1, (s.w + W) / 2 + 14); else rightExtra = Math.max(rightExtra, s.w / 2 - W / 2);
      if (i > 0) req(i - 1, i, (s.w + W) / 2 + 14);
    }
  }
  const titleH = (model.title ? 22 : 0) + (model.subtitle ? 18 : 0);
  const boxPad = boxes.length ? 14 : 0;
  const x = [];
  parts.forEach((p, j) => { x[j] = j ? Math.max(...[...need[j]].map(([i, v]) => x[i] + v)) : S.pad + boxPad + W / 2; });

  // ---- vertical ----
  const geo = { nodes: new Map(), groups: new Map(), bodies: new Map(), legendBox: null, fixedRoutes: [], decor: [], extraObstacles: [] };
  const top = S.pad + (titleH ? titleH + S.titleGap : 0) + (boxes.length ? 26 : 0);
  const headH = Math.max(...parts.map(p => p.fh));
  parts.forEach((p, j) => geo.nodes.set(p.id, { x: x[j] - p.w / 2, y: top + headH - p.fh, w: p.w, h: p.h, node: p }));
  for (const [id, r] of geo.nodes) if (r.node.extLabel) { r.node.extLabel.box = { x: r.x + r.w / 2 - r.node.extLabel.w / 2, y: r.y + r.h + 6, w: r.node.extLabel.w, h: r.node.extLabel.h }; Object.assign(r, { round: true }); }
  let y = top + headH + 28;
  const active = parts.map(() => []);            // open activations: { from, y }
  const timeline = [];                             // every message: its y and both ends
  const bars = [];
  const frags = [];
  let n = 0;
  const edgeX = (i, toward) => x[i] + (active[i].length ? (toward > x[i] ? 1 : -1) * (BAR / 2 + (active[i].length - 1) * 4) : 0);
  for (const s of steps) {
    if (s.kind === 'open') { frags.push({ ...s, top: y, sections: [], touched: new Set(), selfRight: 0, depth: frags.filter(f => !f.bottom).length }); y += 30; continue; }
    const open = frags.filter(f => !f.bottom);
    const cur = open.at(-1);
    if (s.kind === 'else') { if (cur) { cur.sections.push({ y: y + 2, label: s.label }); y += 30; } continue; }
    if (s.kind === 'end') { if (cur) { cur.bottom = y + 4; y += 16; } continue; }
    if (s.kind === 'note') {
      const xs = s.over.map(i => x[i]);
      const w = s.over.length > 1 ? Math.max(s.w, Math.max(...xs) - Math.min(...xs) + 40) : s.w;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, h = s.lines.length * 15 + 14;
      geo.decor.push({ t: 'rect', layer: 'over', x: cx - w / 2, y, w, h, fill: 'note', stroke: 'line', rx: 4 });
      s.lines.forEach((l, i) => geo.decor.push({ t: 'text', layer: 'over', str: l, x: cx, y: y + 7 + i * 15, h: 15, cls: T.sub, anchor: 'middle' }));
      open.forEach(f => s.over.forEach(i => f.touched.add(i)));
      y += h + 16;
      continue;
    }
    // A message.
    const { from: a, to: b } = s;
    open.forEach(f => { f.touched.add(a); f.touched.add(b); });
    const labelH = s.lines.length * 16;
    timeline.push({ y: y + labelH + 4, a, b });
    n++;
    if (a === b) {
      // Self call: out to the right and back.
      const x0 = edgeX(a, x[a] + 1), x1 = x0 + 34, y0 = y + Math.max(0, labelH - 10), y1 = y0 + 22;
      geo.fixedRoutes.push({ edge: { from: parts[a].id, to: parts[a].id, dashed: s.reply, accent: s.accent, open: s.async }, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
      placeLabel(s, x1 + 8, y0 - 1, 'start', n);
      open.forEach(f => { f.selfRight = Math.max(f.selfRight, x1 + 8 + s.w); });
      y = y1 + ROW + s.subs.length * 15;
      continue;
    }
    y += labelH + 4;
    const dir = x[b] > x[a] ? 1 : -1;
    // Activation: a call opens a bar on the callee; the matching reply closes it.
    if (s.reply) {
      const k = active[a].map(q => q.from).lastIndexOf(b);
      const xa = edgeX(a, x[b]);
      if (k >= 0) { const q = active[a].splice(k, 1)[0]; bars.push({ i: a, y0: q.y, y1: y, level: k }); }
      push(s, xa, edgeX(b, x[a]), dir);
    } else {
      const xa = edgeX(a, x[b]);
      if (!s.async) active[b].push({ from: a, y });
      push(s, xa, edgeX(b, x[a]), dir);
    }
    y += 10 + s.subs.length * 15 + ROW;
  }
  // A call never answered: its bar lasts while the callee keeps taking part in the
  // messages that follow, and ends at the first message without it.
  for (let i = 0; i < parts.length; i++) for (const q of active[i]) {
    let end = q.y;
    for (const t of timeline) { if (t.y <= q.y) continue; if (t.a !== i && t.b !== i) break; end = t.y; }
    bars.push({ i, y0: q.y, y1: Math.max(q.y + 14, end) + 6, level: 0 });
  }
  const bottom = y + 6;

  function push(s, xa, xb, dir) {
    geo.fixedRoutes.push({ edge: { from: parts[s.from].id, to: parts[s.to].id, dashed: s.reply, accent: s.accent, open: s.async }, points: [{ x: xa, y }, { x: xb, y }] });
    placeLabel(s, (xa + xb) / 2, y - 4 - s.lines.length * 16, 'middle', n);
    s.subs.forEach((l, i) => geo.decor.push({ t: 'text', layer: 'over', str: l, x: (xa + xb) / 2, y: y + 4 + i * 15, h: 15, cls: T.sub, anchor: 'middle', tone: 'muted', halo: true }));
  }
  function placeLabel(s, ax, ty, anchor, num) {
    if (!s.lines.length && !model.attrs.numbered) return;
    const w = s.w - (model.attrs.numbered ? 22 : 0);
    let lx = anchor === 'middle' ? ax - s.w / 2 : ax;
    if (model.attrs.numbered) {
      geo.decor.push({ t: 'circle', layer: 'over', cx: lx + 8, cy: ty + (s.lines.length ? 8 : -2), r: 8, fill: 'ink' });
      geo.decor.push({ t: 'text', layer: 'over', str: String(num), x: lx + 8, y: ty + (s.lines.length ? 0 : -10), h: 16, cls: T.num, anchor: 'middle', tone: 'card' });
      lx += 22;
    }
    s.lines.forEach((l, i) => geo.decor.push({ t: 'text', layer: 'over', str: l, x: lx, y: ty + i * 16, h: 16, cls: T.msg, anchor: 'start', halo: true }));
  }

  // Lifelines, bars, fragments, participant boxes.
  parts.forEach((p, j) => {
    const r = geo.nodes.get(p.id);
    const from = p.extLabel?.box ? p.extLabel.box.y + p.extLabel.box.h + 4 : r.y + r.h;
    geo.decor.push({ t: 'line', layer: 'under', x1: x[j], y1: from, x2: x[j], y2: bottom, stroke: 'line', dash: '4 4', width: 1.2 });
  });
  for (const b of bars) geo.decor.push({ t: 'rect', layer: 'mid', x: x[b.i] - BAR / 2 + b.level * 4, y: b.y0, w: BAR, h: Math.max(8, b.y1 - b.y0), fill: 'card', stroke: 'ink', rx: 1, width: 1.2 });
  let right = x.at(-1) + W / 2 + rightExtra;
  for (const f of frags) {
    if (!f.bottom) f.bottom = bottom - 8;
    const ids = [...f.touched];
    if (!ids.length) continue;
    const inset = f.depth * 8;
    const lo = Math.min(...ids.map(i => x[i])) - FRAG_PAD + inset;
    let hi = Math.max(...ids.map(i => x[i])) + FRAG_PAD - inset;
    hi = Math.max(hi, f.selfRight + 10 - inset);
    const tagW = m.width(f.fkind, T.frag) + 18, condW = f.label ? m.width(`[${f.label}]`, T.sub) + 12 : 0;
    hi = Math.max(hi, lo + tagW + condW + 12);
    right = Math.max(right, hi);
    geo.decor.push({ t: 'rect', layer: 'under', x: lo, y: f.top, w: hi - lo, h: f.bottom - f.top, fill: 'none', stroke: 'muted', rx: 2, width: 1.1 });
    // The tag sits on top of lifelines and activation bars, as in UML tools.
    geo.decor.push({ t: 'path', layer: 'over', d: `M${lo},${f.top + 20} H${lo + tagW - 6} L${lo + tagW},${f.top + 14} V${f.top}`, fill: 'wash', stroke: 'muted', width: 1.1, closeTo: { x: lo, y: f.top } });
    geo.decor.push({ t: 'text', layer: 'over', str: f.fkind, x: lo + 8, y: f.top + 2, h: 16, cls: T.frag, anchor: 'start' });
    if (f.label) geo.decor.push({ t: 'text', layer: 'over', str: `[${f.label}]`, x: lo + tagW + 8, y: f.top + 2, h: 16, cls: T.sub, anchor: 'start', tone: 'muted', halo: true });
    for (const sec of f.sections) {
      geo.decor.push({ t: 'line', layer: 'under', x1: lo, y1: sec.y, x2: hi, y2: sec.y, stroke: 'muted', dash: '5 4', width: 1.1 });
      if (sec.label) geo.decor.push({ t: 'text', layer: 'over', str: `[${sec.label}]`, x: lo + 8, y: sec.y + 4, h: 16, cls: T.sub, anchor: 'start', tone: 'muted', halo: true });
    }
  }
  for (const bx of boxes) {
    const lo = x[bx.first] - W / 2 - 12, hi = x[bx.last] + W / 2 + 12;
    geo.groups.set(bx.g.id, { x: lo, y: top - 26, w: hi - lo, h: bottom - top + 34, group: { ...bx.g, depth: 0 }, head: { x: lo + 12, y: top - 22, w: m.width(bx.g.label || '', T.group), h: 16 } });
  }

  const titleW = Math.max(model.title ? m.width(model.title, T.title) : 0, model.subtitle ? m.width(model.subtitle, T.subtitle) : 0);
  geo.width = Math.ceil(Math.max(right + boxPad + S.pad, titleW + 2 * S.pad));
  geo.height = Math.ceil(bottom + (boxes.length ? 12 : 0) + S.pad);
  geo.title = titleH ? { x: S.pad, y: S.pad, w: titleW, h: titleH } : null;
  return geo;
}

// Lines of the <links> block, in order.
function parseSteps(text, index, model, parts) {
  const steps = [];
  const ref = name => {
    const i = index.get(name.trim());
    if (i === undefined) model.problems.push({ rule: 'unknown-id', id: name.trim(), suggest: closest(name.trim(), [...index.keys()]) });
    return i;
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/(^|\s)(#|\/\/).*$/, '').trim();
    if (!line) continue;
    let mm;
    if ((mm = /^(loop|alt|opt|par|critical|break|group)\b\s*(.*)$/i.exec(line))) { steps.push({ kind: 'open', fkind: mm[1].toLowerCase(), label: mm[2] }); continue; }
    if ((mm = /^(else|and)\b\s*(.*)$/i.exec(line))) { steps.push({ kind: 'else', label: mm[2] }); continue; }
    if (/^end\b/i.test(line)) { steps.push({ kind: 'end' }); continue; }
    if ((mm = /^note\s+(?:over\s+|left of\s+|right of\s+)?([^:]+):\s*(.*)$/i.exec(line))) {
      const over = mm[1].split(',').map(ref).filter(i => i !== undefined);
      if (over.length) steps.push({ kind: 'note', over, text: mm[2] });
      continue;
    }
    if ((mm = /^(.+?)\s*(-->|->|~>|=>)\s*([^:]+?)\s*(?::\s*(.*))?$/.exec(line))) {
      const a = ref(mm[1]), b = ref(mm[3]);
      if (a === undefined || b === undefined) continue;
      const [label, sub] = (mm[4] || '').split('|').map(t => t.trim());
      steps.push({ kind: 'msg', from: a, to: b, label: label || '', sub: sub || '', reply: mm[2] === '-->', async: mm[2] === '~>', accent: mm[2] === '=>' });
      continue;
    }
    model.problems.push({ rule: 'bad-line', line, hint: 'a message (a -> b : text), note x : text, loop/alt/opt/par … end' });
  }
  return steps;
}

function closest(s, list) {
  let best = list[0], d = Infinity;
  for (const c of list) { const k = lev(s, c); if (k < d) { d = k; best = c; } }
  return best;
}
function lev(a, b) {
  const m = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = m[0]; m[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return m[b.length];
}
