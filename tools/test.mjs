#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node tools/test.mjs [--keep]
// The regression and v2 suite. Renders every samples/*/diagram.html and docs/diagrams/*.html
// through the CLI, then small diagrams written here: the layout each SVG carries, nudge, link sides,
// bad and dropped overrides, how far a layout moves when a node is added (a stable
// re-render against --recompute), and page mode (shapes, script errors, routing, problems). Works in a fresh folder under os.tmpdir(), removed at the
// end unless --keep, which prints its path. Exits 1 when a test fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLayout } from '../skills/graphally/scripts/lib/snapshot.mjs';

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
// The layout an SVG carries on its elements (data-box, data-sides …). Throws when there is none.
function readSnapshot(svg) {
  const l = readLayout(fs.readFileSync(svg, 'utf8'));
  check(l, `no layout in ${path.basename(svg)}`);
  return l;
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
// Gantt plans and timelines place bars by date and carry no node boxes.
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

test('layout', () => {
  const bad = [];
  for (const [p, r] of renders) {
    if (!r.summaries.length) bad.push(`${p}: no diagram in the output`);
    for (const s of r.summaries) {
      if (timeChart(p) || !s.nodes) continue;   // nothing named, nothing to record
      const name = `${p} (${path.basename(s.svg)})`;
      let snap;
      try { snap = readSnapshot(s.svg); } catch (e) { bad.push(`${name}: ${e.message}`); continue; }
      const n = Object.keys(snap.nodes || {}).length;
      if (n !== s.nodes) bad.push(`${name}: ${n} nodes in the layout, ${s.nodes} in the summary`);
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

// Page mode: a figure written as HTML and CSS, with a drawing script.
const page = (body, script = '', attrs = 'width=700') => `<diagram layout=html ${attrs}>\n${body}\n<script>\n${script}\n</script>\n</diagram>\n`;
const svgOf = out => fs.readFileSync(path.join(out, 'diagram.svg'), 'utf8');
// A routed line's path, and its corners (each bend is drawn as a Q curve).
const edgePath = (svg, key) => { const m = svg.match(new RegExp(`<g data-edge="${key.replace(/>/g, '&gt;')}"><path d="([^"]+)"`)); check(m, `no edge ${key}`); return m[1]; };
const corners = d => (d.match(/Q/g) || []).length;
const pointsOf = d => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));

test('page-shapes', () => {
  const d = folder('page-shapes'), out = path.join(d, 'out');
  const names = ['cylinder', 'document', 'note', 'cloud', 'hexagon', 'chevron', 'task loop', 'gateway parallel', 'event timer', 'end message', 'start'];
  ok0(render(write(d, page(names.map((n, i) => `<div shape="${n}" id=s${i}></div>`).join('\n'))), out));
  const svg = svgOf(out);
  check(names.every((_, i) => svg.includes(`data-id="s${i}"`)), 'a shape is missing from the SVG');
  const bad = render(write(d, page('<div shape=cylindr>x</div>')), out);
  check(bad.code === 1 && /unknown-shape: shape=cylindr suggest=cylinder/.test(bad.text), `expected unknown-shape with a suggestion: ${tail(bad.text)}`);
});

test('page-script-errors', () => {
  const d = folder('page-script'), out = path.join(d, 'out'), body = '<div class=card id=a>A</div><div class=card id=b>B</div>';
  const r1 = render(write(d, page(body, "arrow('a', 'b')\narrow('nope', 'b')")), out);
  check(r1.code === 1 && /script-error: message=no element "nope" line=3/.test(r1.text), `expected a script error for "nope" on line 3: ${tail(r1.text)}`);
  const r2 = render(write(d, page(body, "arrow({ x: 3 }, 'b')")), out);
  check(r2.code === 1 && /is not an element or a point line=2/.test(r2.text), `expected a script error for a non-point on line 2: ${tail(r2.text)}`);
});

test('page-routing', () => {
  const d = folder('page-routing'), out = path.join(d, 'out');
  // A lane's background, laid in the same grid cells, does not wall in the tasks on it.
  ok0(render(write(d, page(`<style>.l { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 60px } .bg { grid-column: 1 / -1; grid-row: 1; background: var(--wash) } .t { grid-row: 1; margin: 30px 0 }</style>
<div class=l><div class=bg></div><div class="card t" id=a style="grid-column: 1">A</div><div class="card t" id=b style="grid-column: 3">B</div></div>`, "connect('a', 'b')")), out));
  check(corners(edgePath(svgOf(out), 'a->b')) === 0, 'the line from a to b bends round the lane background');
  // Lines from facing sides keep their own heights on a shared side.
  ok0(render(write(d, page(`<style>.g { display: grid; grid-template-columns: 160px 1fr 160px; gap: 30px 120px } .tall { grid-column: 3; grid-row: 1 / span 3 }</style>
<div class=g><div class=card id=a style="grid-row: 1">A</div><div class=card id=b style="grid-row: 2">B</div><div class=card id=c style="grid-row: 3">C</div><div class="card tall" id=t>T</div></div>`,
    "connect('a', 't'); connect('b', 't'); connect('c', 't')")), out));
  const svg = svgOf(out), bent = ['a', 'b', 'c'].filter(k => corners(edgePath(svg, `${k}->t`)));
  check(!bent.length, `lines into t bend: ${bent.join(', ')}`);
  // A via line passes through its waypoint, far below the straight path.
  ok0(render(write(d, page(`<style>.r { display: flex; gap: 200px; padding-bottom: 120px }</style><div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>`,
    "connect('a', 'b', { via: [mid(el('a').bottom, el('b').bottom).down(80)] })")), out));
  const low = Math.max(...pointsOf(edgePath(svgOf(out), 'a->b')).map(p => p.y)), a = readLayout(svgOf(out)).nodes.a;
  check(Math.abs(low - (a[1] + a[3] + 80)) <= 1.5, `the via line's lowest point is ${low}, expected ${a[1] + a[3] + 80}`);
});

test('page-problems', () => {
  const d = folder('page-problems'), out = path.join(d, 'out');
  const r1 = render(write(d, page('<div class=card>A</div>', '', 'width=12px')), out);
  check(r1.code === 1 && /bad-attribute: attr=width value=12px/.test(r1.text), `expected bad-attribute for width: ${tail(r1.text)}`);
  const r2 = render(write(d, page('<style>.r { display: flex; gap: 14px }</style><div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>',
    "connect('a', 'b', { label: 'a label far too long for this gap' })")), out);
  check(r2.code === 1 && /label-crowded: edge=a -> b/.test(r2.text), `expected label-crowded: ${tail(r2.text)}`);
  // Two lines squeezed through one narrow gap share a stretch.
  const r3 = render(write(d, page(`<style>.g { display: grid; grid-template-columns: 1fr 1fr; gap: 60px 16px } .top { grid-column: 1 / -1; justify-self: center; width: 160px } .h { height: 60px }</style>
<div class=g><div class="card top" id=a>A</div><div class="card h" id=x>X</div><div class="card h" id=y>Y</div><div class=card id=b>B</div><div class=card id=c>C</div></div>`,
    "const gap = mid(el('x').right, el('y').left); connect('a', 'b', { via: [gap] }); connect('a', 'c', { via: [gap] })")), out);
  check(r3.code === 1 && /lines-overlap: a=a->b b=a->c/.test(r3.text), `expected lines-overlap: ${tail(r3.text)}`);
  // An arrowhead on a too-short end is reported; a BPMN fragment routes with full-length ends.
  const r5 = render(write(d, page('<div class=card id=a>A</div>', "arrow(el('a').bottom.down(20), el('a').bottom.down(28))")), out);
  check(r5.code === 1 && /short-end: line=a drawn line end=head/.test(r5.text), `expected short-end: ${tail(r5.text)}`);
  ok0(render(write(d, page(`<style>.p { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: 110px 110px; gap: 0 50px; align-items: center; justify-items: center }</style>
<div class=p><i shape=start id=s style="grid-area: 1 / 1"></i><div shape=task id=t1 style="grid-area: 1 / 2">Submit</div><div shape=task id=t2 style="grid-area: 2 / 2">Validate</div>
<i shape="gateway exclusive" id=g style="grid-area: 2 / 3"></i><div shape="task loop" id=t3 style="grid-area: 1 / 4">Correct</div><i shape=end id=e style="grid-area: 2 / 4"></i></div>`,
    "connect('s', 't1'); connect('t1', 't2'); connect('t2', 'g'); connect('g', 't3', { label: 'invalid' }); connect('g', 'e', { label: 'valid' }); connect('t3', 't1', { label: 'resubmit' })")), out));
  const r4 = render(write(d, page('<div style="width: 900px" class=card>wide</div>', '', 'width=600')), out);
  check(r4.code === 1 && /page-overflow: width=600 content=9\d\d/.test(r4.text), `expected page-overflow: ${tail(r4.text)}`);
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
