#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node tools/test.mjs [--keep]
// The regression and v2 suite. Renders every samples/*/diagram.html and docs/diagrams/*.html
// through the CLI, then small diagrams written here: the layout snapshot, nudge, link sides,
// bad and dropped overrides, and how far a layout moves when a node is added (a stable
// re-render against --recompute). Works in a fresh folder under os.tmpdir(), removed at the
// end unless --keep, which prints its path. Exits 1 when a test fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/graphally/scripts/graphally.mjs');
const keep = process.argv.includes('--keep');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-test-'));

const check = (ok, msg) => { if (!ok) throw new Error(msg); };
const ok0 = r => check(r.code === 0, `exit ${r.code}: ${tail(r.text)}`);
const tail = text => text.trim().split('\n').slice(-2).join(' | ').slice(0, 300);
const folder = name => { const d = path.join(work, name); fs.mkdirSync(d, { recursive: true }); return d; };
const write = (dir, text) => { const f = path.join(dir, 'diagram.html'); fs.writeFileSync(f, text); return f; };
const pct = x => `${Math.round(100 * x)}%`;

// One CLI run: its exit code and what it printed.
function render(file, out, flags = []) {
  const r = spawnSync(process.execPath, [cli, 'render', file, '--out', out, ...flags], { encoding: 'utf8', timeout: 600000 });
  return { code: r.status, text: (r.stdout || '') + (r.stderr || '') + (r.error ? r.error.message : '') };
}
// The summary line of each diagram in a render: "<svg path>  WxH  N nodes, …".
const summaries = text => [...text.matchAll(/^(.+?\.svg)\s+[\d.]+×[\d.]+\s+(\d+) nodes,/gm)].map(m => ({ svg: m[1], nodes: Number(m[2]) }));
// The layout snapshot written into an SVG. Throws when there is none.
function readSnapshot(svg) {
  const m = fs.readFileSync(svg, 'utf8').match(/<metadata id="graphally-layout"><!\[CDATA\[([\s\S]*?)\]\]><\/metadata>/);
  check(m, `no snapshot in ${path.basename(svg)}`);
  return JSON.parse(m[1]);
}
const rect = (svg, id) => { const r = readSnapshot(svg).nodes?.[id]; check(r, `no node ${id} in the snapshot`); return r; };
// The source with the one occurrence of a replaced by b. Throws when a is not there exactly once.
const replaceOnce = (src, a, b) => { check(src.split(a).length === 2, `edit anchor not found once: ${a.slice(0, 40)}`); return src.replace(a, () => b); };

// The small diagram: two groups side by side, three nodes, one link. attr goes on node b1.
const doc = ({ attr = '', links = '<links>\na1 -> b1 : flow\n</links>' } = {}) => `<diagram title="Nudge test">
<layout>
left  right
</layout>
<group id=ga label="Left" area=left>
  <node id=a1>Alpha | first</node>
  <node id=a2>Beta | second</node>
</group>
<group id=gb label="Right" area=right>
  <node id=b1${attr}>Gamma | third</node>
</group>
${links}
</diagram>
`;
const NUDGE = ' nudge="0,24"';

// Edits by literal replacement: one new node inside one existing group, and one link from it
// to an existing node. id is the new node.
const EDITS = {
  architecture: { id: 'audit', pairs: [
    ['<node id=engine icon="container app">scheduling-engine | internal</node>',
      '<node id=engine icon="container app">scheduling-engine | internal</node>\n  <node id=audit icon="container app">audit worker | batch</node>'],
    ['engine -> cosmos : locations', 'engine -> cosmos : locations\naudit -> sql : audit rows'],
  ] },
  network: { id: 'batch', pairs: [
    ['<node id=app icon="app service">App Service | VNet integration</node>',
      '<node id=app icon="app service">App Service | VNet integration</node>\n    <node id=batch icon="app service">Batch worker | nightly jobs</node>'],
    ['app -> pesql : SQL', 'app -> pesql : SQL\nbatch -> pest : blob reads'],
  ] },
};

// Share of the nodes and of the edges present in both snapshots that did not move (within
// 0.5 px), that kept their place inside their group (offset from the innermost group whose
// rect holds the node's centre), and that kept their sides. An empty set counts as unchanged.
function shares(a, b) {
  const nodes = Object.keys(a.nodes).filter(id => Object.hasOwn(b.nodes, id));
  const edges = Object.keys(a.edges).filter(k => Object.hasOwn(b.edges, k));
  const same = (p, q) => Math.abs(p[0] - q[0]) <= 0.5 && Math.abs(p[1] - q[1]) <= 0.5;
  const share = (n, d) => (d ? n / d : 1);
  const groupOf = (snap, [x, y, w, h]) => Object.entries(snap.groups)
    .filter(([, g]) => x + w / 2 >= g[0] && x + w / 2 <= g[0] + g[2] && y + h / 2 >= g[1] && y + h / 2 <= g[1] + g[3])
    .sort(([, p], [, q]) => p[2] * p[3] - q[2] * q[3])[0]?.[0];
  const inGroup = id => {
    const g = groupOf(a, a.nodes[id]);
    if (!g || !b.groups[g]) return false;
    const off = (s, r) => [s.nodes[id][0] - r[0], s.nodes[id][1] - r[1]];
    return same(off(a, a.groups[g]), off(b, b.groups[g]));
  };
  return {
    nodes: share(nodes.filter(id => same(a.nodes[id], b.nodes[id])).length, nodes.length),
    arranged: share(nodes.filter(inGroup).length, nodes.length),
    edges: share(edges.filter(k => a.edges[k].out === b.edges[k].out && a.edges[k].in === b.edges[k].in).length, edges.length),
  };
}
// Gantt plans and timelines place bars by date and keep no node boxes in the snapshot.
const timeChart = p => /layout=["']?(gantt|timeline)\b/.test(fs.readFileSync(path.join(root, p), 'utf8'));

const sources = [
  ...fs.readdirSync(path.join(root, 'samples')).sort().map(d => path.join('samples', d, 'diagram.html')),
  ...fs.readdirSync(path.join(root, 'docs/diagrams')).filter(f => f.endsWith('.html')).sort().map(f => path.join('docs/diagrams', f)),
].filter(p => fs.existsSync(path.join(root, p)));
const renders = new Map();
const table = [];
let total = 0, failed = 0;

function test(name, fn) {
  total++;
  try { fn(); console.log(`ok  ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}

test('samples', () => {
  const bad = [];
  for (const p of sources) {
    const out = folder(path.join('out', p.replace(/\.html$/, '').split(/[\\/]/).join('-')));
    const r = render(path.join(root, p), out);
    renders.set(p, { ...r, summaries: summaries(r.text) });
    if (r.code !== 0) bad.push(`${p} exit ${r.code} (${tail(r.text)})`);
  }
  check(!bad.length, bad.join('; '));
});

test('snapshot', () => {
  const bad = [];
  for (const [p, r] of renders) {
    if (!r.summaries.length) bad.push(`${p}: no diagram in the output`);
    for (const s of r.summaries) {
      const name = `${p} (${path.basename(s.svg)})`;
      let snap;
      try { snap = readSnapshot(s.svg); } catch (e) { bad.push(`${name}: ${e.message}`); continue; }
      const n = Object.keys(snap.nodes || {}).length;
      if (snap.v !== 1) bad.push(`${name}: snapshot v is ${snap.v}`);
      else if (n !== s.nodes && !timeChart(p)) bad.push(`${name}: ${n} nodes in the snapshot, ${s.nodes} in the summary`);
    }
  }
  check(!bad.length, bad.join('; '));
});

test('nudge', () => {
  const a = folder('nudge-base'), b = folder('nudge-moved');
  const ra = render(write(a, doc()), path.join(a, 'out'), ['--recompute']);
  const rb = render(write(b, doc({ attr: NUDGE })), path.join(b, 'out'), ['--recompute']);
  ok0(ra); ok0(rb);
  const [x0, y0] = rect(path.join(a, 'out', 'diagram.svg'), 'b1');
  const [x1, y1] = rect(path.join(b, 'out', 'diagram.svg'), 'b1');
  check(Math.abs(y1 - y0 - 24) <= 1 && Math.abs(x1 - x0) <= 1, `b1 moved by (${x1 - x0}, ${y1 - y0}), expected (0, 24)`);
});

test('sides', () => {
  const d = folder('sides'), out = path.join(d, 'out');
  // a2 is the lower node of its stack, so its bottom side is free (a1's is blocked by a2).
  ok0(render(write(d, doc({ links: '<link from=a2 to=b1 out=bottom in=bottom>' })), out));
  const e = readSnapshot(path.join(out, 'diagram.svg')).edges?.['a2->b1'];
  check(e && Object.keys(e).length === 2 && e.out === 'bottom' && e.in === 'bottom', `edge a2->b1 is ${JSON.stringify(e)}`);
});

test('blocked-side', () => {
  const d = folder('blocked-side');
  const r = render(write(d, doc({ links: '<link from=a1 to=b1 out=bottom>' })), path.join(d, 'out'));
  check(r.code === 1 && /override-ignored: id=a1->b1 attr=out/.test(r.text), `expected override-ignored for a1->b1 out: ${tail(r.text)}`);
});

test('bad-override', () => {
  const d = folder('bad-override');
  const r = render(write(d, doc({ links: '<link from=a1 to=b1 out=diagonal>' })), path.join(d, 'out'));
  check(r.code === 1, `exit ${r.code}, expected 1`);
  check(/bad-override/.test(r.text), `no bad-override line: ${tail(r.text)}`);
});

test('dropped', () => {
  const d = folder('dropped'), out = path.join(d, 'out'), f = write(d, doc({ attr: NUDGE }));
  ok0(render(f, out));
  write(d, doc());
  const r = render(f, out);
  ok0(r);
  check(r.text.includes('override dropped: nudge on b1 (attribute removed)'), 'no "override dropped: nudge on b1 (attribute removed)" line');
  const fresh = render(f, out, ['--recompute']);
  ok0(fresh);
  check(!fresh.text.includes('override dropped'), 'a --recompute render still reports a dropped override');
});

test('stability', () => {
  const bad = [];
  for (const [name, { id, pairs }] of Object.entries(EDITS)) {
    try {
      const src = fs.readFileSync(path.join(root, 'samples', name, 'diagram.html'), 'utf8');
      const edited = pairs.reduce((s, [a, b]) => replaceOnce(s, a, b), src);
      const warmDir = folder(`stability-${name}`), coldDir = folder(`stability-${name}-recompute`);
      ok0(render(write(warmDir, src), path.join(warmDir, 'out')));
      const before = readSnapshot(path.join(warmDir, 'out', 'diagram.svg'));
      ok0(render(write(warmDir, edited), path.join(warmDir, 'out')));
      const warm = readSnapshot(path.join(warmDir, 'out', 'diagram.svg'));
      ok0(render(write(coldDir, edited), path.join(coldDir, 'out'), ['--recompute']));
      const cold = readSnapshot(path.join(coldDir, 'out', 'diagram.svg'));
      check(Object.hasOwn(warm.nodes, id), `new node ${id} is not in the layout`);
      const s = shares(before, warm), c = shares(before, cold);
      table.push([name, pct(s.nodes), pct(s.arranged), pct(s.edges), pct(c.nodes), pct(c.arranged), pct(c.edges)]);
      check(['nodes', 'arranged', 'edges'].every(k => s[k] >= c[k]), `the stable render moved more than --recompute (${['nodes', 'arranged', 'edges'].map(k => `${k} ${pct(s[k])} vs ${pct(c[k])}`).join(', ')})`);
    } catch (e) { bad.push(`${name}: ${e.message}`); }
  }
  check(!bad.length, bad.join('; '));
});

if (table.length) {
  const rows = [['sample', 'stable: nodes', 'in group', 'sides', 'recompute: nodes', 'in group', 'sides'], ...table];
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  for (const r of rows) console.log(`  ${r.map((c, i) => String(c).padEnd(w[i])).join('  ')}`.trimEnd());
}
console.log(`${total - failed} passed, ${failed} failed`);
if (keep) console.log(`kept: ${work}`);
else fs.rmSync(work, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
