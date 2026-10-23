#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/test.mjs [--keep]
// The regression and v2 suite. Renders every samples/*/diagram.html and docs/diagrams/*.html
// through the CLI, then small diagrams written here: the layout each SVG carries, nudge, link sides,
// bad and dropped overrides, how far a layout moves when a node is added (a stable
// re-render against --recompute), and page mode (shapes, script errors, routing, problems). Works in a fresh folder under os.tmpdir(), removed at the
// end unless --keep, which prints its path. Exits 1 when a test fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readLayout } from '../skills/graphally/scripts/lib/snapshot.mjs';
import { applyEdits, readLines } from '../skills/graphally/scripts/lib/edits.mjs';
import { launch, openPage } from '../skills/graphally/scripts/lib/browser.mjs';
import { findPack } from '../skills/graphally/scripts/lib/iconpack.mjs';

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
    ['<div class=node id=engine><icon name="container app"></icon>scheduling-engine<small>internal</small></div>',
      '<div class=node id=engine><icon name="container app"></icon>scheduling-engine<small>internal</small></div>\n    <div class=node id=audit><icon name="container app"></icon>audit worker<small>batch</small></div>'],
    ['["engine", "cosmos", "locations"],', '["engine", "cosmos", "locations"], ["audit", "sql", "audit rows"],'],
  ] },
  network: { id: 'batch', pairs: [
    ['<div class=node id=app><icon name="app service"></icon>App Service<small>VNet integration</small></div>',
      '<div class=node id=app><icon name="app service"></icon>App Service<small>VNet integration</small></div>\n      <div class=node id=batch><icon name="app service"></icon>Batch worker<small>nightly jobs</small></div>'],
    ['["pesql", "sql", "private link"],', '["pesql", "sql", "private link"], ["batch", "pest", "blob reads"],'],
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

async function test(name, fn) {
  total++;
  try { await fn(); console.log(`ok  ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}

await test('samples', () => {
  const bad = [];
  for (const p of sources) {
    const out = folder(path.join('out', p.replace(/\.html$/, '').split(/[\\/]/).join('-')));
    const r = render(path.join(root, p), out, ['--no-viewer']);
    renders.set(p, { ...r, summaries: summaries(r.text) });
    if (r.code !== 0) bad.push(`${p} exit ${r.code} (${tail(r.text)})`);
  }
  check(!bad.length, bad.join('; '));
});

await test('layout', () => {
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

await test('nudge', () => {
  const a = folder('nudge-base'), b = folder('nudge-moved');
  const ra = render(write(a, doc()), path.join(a, 'out'), ['--recompute']);
  const rb = render(write(b, doc({ attr: NUDGE })), path.join(b, 'out'), ['--recompute']);
  ok0(ra); ok0(rb);
  const [x0, y0] = rect(path.join(a, 'out', 'diagram.svg'), 'b1');
  const [x1, y1] = rect(path.join(b, 'out', 'diagram.svg'), 'b1');
  check(Math.abs(y1 - y0 - 24) <= 1 && Math.abs(x1 - x0) <= 1, `b1 moved by (${x1 - x0}, ${y1 - y0}), expected (0, 24)`);
});

await test('sides', () => {
  const d = folder('sides'), out = path.join(d, 'out');
  // a2 is the lower node of its stack, so its bottom side is free (a1's is blocked by a2).
  ok0(render(write(d, doc({ links: '<link from=a2 to=b1 out=bottom in=bottom>' })), out));
  const e = readSnapshot(path.join(out, 'diagram.svg')).edges?.['a2->b1'];
  check(e && Object.keys(e).length === 2 && e.out === 'bottom' && e.in === 'bottom', `edge a2->b1 is ${JSON.stringify(e)}`);
});

await test('blocked-side', () => {
  const d = folder('blocked-side');
  const r = render(write(d, doc({ links: '<link from=a1 to=b1 out=bottom>' })), path.join(d, 'out'));
  check(r.code === 1 && /override-ignored: id=a1->b1 attr=out/.test(r.text), `expected override-ignored for a1->b1 out: ${tail(r.text)}`);
});

await test('bad-override', () => {
  const d = folder('bad-override');
  const r = render(write(d, doc({ links: '<link from=a1 to=b1 out=diagonal>' })), path.join(d, 'out'));
  check(r.code === 1, `exit ${r.code}, expected 1`);
  check(/bad-override/.test(r.text), `no bad-override line: ${tail(r.text)}`);
});

await test('dropped', () => {
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

await test('stability', () => {
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
const page = (body, script = '', attrs = 'width=700') => `<diagram layout=html ${attrs}>\n${body}\n<script type="graphally">\n${script}\n</script>\n</diagram>\n`;
const svgOf = out => fs.readFileSync(path.join(out, 'diagram.svg'), 'utf8');
// A routed line's path, and its corners (each bend is drawn as a Q curve).
const edgePath = (svg, key) => { const m = svg.match(new RegExp(`<g data-edge="${key.replace(/>/g, '&gt;')}"[^>]*><path d="([^"]+)"`)); check(m, `no edge ${key}`); return m[1]; };
const corners = d => (d.match(/Q/g) || []).length;
const pointsOf = d => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));

await test('page-shapes', () => {
  const d = folder('page-shapes'), out = path.join(d, 'out');
  const names = ['cylinder', 'document', 'note', 'cloud', 'hexagon', 'chevron', 'task loop', 'gateway parallel', 'event timer', 'end message', 'start'];
  ok0(render(write(d, page(names.map((n, i) => `<div shape="${n}" id=s${i}></div>`).join('\n'))), out));
  const svg = svgOf(out);
  check(names.every((_, i) => svg.includes(`data-id="s${i}"`)), 'a shape is missing from the SVG');
  const bad = render(write(d, page('<div shape=cylindr>x</div>')), out);
  check(bad.code === 1 && /unknown-shape: shape=cylindr suggest=cylinder/.test(bad.text), `expected unknown-shape with a suggestion: ${tail(bad.text)}`);
});

await test('page-script-errors', () => {
  const d = folder('page-script'), out = path.join(d, 'out'), body = '<div class=card id=a>A</div><div class=card id=b>B</div>';
  const r1 = render(write(d, page(body, "arrow('a', 'b')\narrow('nope', 'b')")), out);
  check(r1.code === 1 && /script-error: message=no element "nope" line=3/.test(r1.text), `expected a script error for "nope" on line 3: ${tail(r1.text)}`);
  const r2 = render(write(d, page(body, "arrow({ x: 3 }, 'b')")), out);
  check(r2.code === 1 && /is not an element or a point line=2/.test(r2.text), `expected a script error for a non-point on line 2: ${tail(r2.text)}`);
});

await test('page-routing', () => {
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

await test('bundles', () => {
  // Lines into one box with the same label merge into one trunk, written in one statement or
  // not, and end on one long straight stretch with one label; unlabelled ones stay apart.
  const merged = (svg, keys) => {
    const ends = keys.map(k => pointsOf(edgePath(svg, k)).slice(-2).map(p => `${p.x},${p.y}`).join(' '));
    const [a, b] = pointsOf(edgePath(svg, keys[0])).slice(-2);
    check(new Set(ends).size === 1, `the lines end apart: ${ends.join(' | ')}`);
    check(Math.hypot(b.x - a.x, b.y - a.y) >= 30, `the shared end is ${Math.hypot(b.x - a.x, b.y - a.y)} px long`);
    check(svg.split('>copy</text>').length === 2, `${svg.split('>copy</text>').length - 1} copy labels`);
  };
  const c = folder('bundles-classic'), cOut = path.join(c, 'out');
  ok0(render(write(c, doc({ links: '<links>\na1 -> b1 : copy\na2 -> b1 : copy\n</links>' })), cOut, ['--recompute']));
  merged(svgOf(cOut), ['a1->b1', 'a2->b1']);
  const d = folder('bundles-page'), out = path.join(d, 'out');
  const grid = `<style>.g { display: grid; grid-template-columns: 160px 1fr 160px; gap: 30px 120px } .tall { grid-column: 3; grid-row: 1 / span 3 }</style>
<div class=g><div class=card id=a style="grid-row: 1">A</div><div class=card id=b style="grid-row: 2">B</div><div class=card id=c style="grid-row: 3">C</div><div class="card tall" id=t>T</div></div>`;
  ok0(render(write(d, page(grid, "for (const k of ['a', 'b', 'c']) connect(k, 't', { label: 'copy' })")), out));
  merged(svgOf(out), ['a->t', 'b->t', 'c->t']);
});

await test('page-problems', () => {
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

// Connections as data, nudge, edits, and lines that keep their sides across an edit.
const DATA = `<diagram layout=html width=760>
<style>.g { display: grid; grid-template-columns: repeat(3, 1fr); gap: 60px 80px; align-items: center }</style>
<div class=g>
  <div class=card id=web>Web</div><div class=card id=api>API</div><div shape=cylinder id=db>DB</div>
  <div class=card id=queue nudge="0,20">Queue</div><div class=card id=worker>Worker</div>
</div>
<script type="application/json">
[
  { "from": "web", "to": "api", "label": "orders" },
  { "from": "api", "to": "db", "label": "writes" },
  ["api", "queue", "events"],
  ["queue", "worker"],
  { "from": "worker", "to": "db", "label": "updates" }
]
</script>
</diagram>
`;
const sidesOf = svg => Object.fromEntries([...svg.matchAll(/data-edge="([^"]+)" data-sides="([^"]+)"/g)].map(m => [m[1].replace(/&gt;/g, '>'), m[2]]));

await test('page-data', () => {
  const d = folder('page-data'), out = path.join(d, 'out'), f = write(d, DATA);
  ok0(render(f, out));
  const svg0 = svgOf(out), lay0 = readLayout(svg0), sides0 = sidesOf(svg0);
  check(Object.keys(sides0).length === 5, `expected 5 routed connections, got ${Object.keys(sides0).join(', ')}`);
  check(readLines(DATA).map(l => l.key).join(' ') === 'web->api api->db api->queue queue->worker worker->db', 'connection keys');
  // nudge: queue sits 20px lower than worker's row would put it
  check(Math.abs(lay0.nodes.queue[1] - lay0.nodes.worker[1] - 20) <= 1, `queue nudge: ${lay0.nodes.queue} vs ${lay0.nodes.worker}`);
  // edits: a new box and connection; everything else keeps its place and its sides
  const r = applyEdits(DATA.replace('<div class=card id=worker>Worker</div>', '<div class=card id=worker>Worker</div><div class=card id=audit>Audit</div>'),
    [{ op: 'connect', from: 'worker', to: 'audit', label: 'records' }, { op: 'line', key: 'web->api', set: { label: 'orders in' } }, { op: 'move', id: 'queue', dx: 10, dy: 0 }]);
  check(!r.errors.length, `edits failed: ${JSON.stringify(r.errors)}`);
  check(/id=queue nudge="10,20"/.test(r.source) && /\{ "from": "worker", "to": "audit", "label": "records" \}/.test(r.source) && /"label": "orders in"/.test(r.source), 'edits not in the source');
  fs.writeFileSync(f, r.source);
  ok0(render(f, out));
  const svg1 = svgOf(out), lay1 = readLayout(svg1), sides1 = sidesOf(svg1);
  const moved = Object.keys(lay0.nodes).filter(k => k !== 'queue' && JSON.stringify(lay0.nodes[k]) !== JSON.stringify(lay1.nodes[k]));
  check(!moved.length, `boxes moved by an unrelated edit: ${moved.join(', ')}`);
  const flipped = Object.keys(sides0).filter(k => !k.startsWith('queue') && !k.endsWith('queue') && sides0[k] !== sides1[k]);
  check(!flipped.length, `lines changed sides: ${flipped.join(', ')}`);
  check(sides1['worker->audit'], 'the new connection is not routed');
  // a broken entry is reported, the rest still renders
  const bad = render(write(d, DATA.replace('["queue", "worker"],', '["queue"],')), out);
  check(bad.code === 1 && /bad-line: line=4 message=needs "from" and "to"/.test(bad.text), `expected bad-line: ${tail(bad.text)}`);
});

// The viewer: a diagram file opened from disk renders itself as the CLI renders it. A local
// server stands in for the icon CDNs, serving each icon back from the downloaded packs.
await test('viewer', async () => {
  const d = folder('viewer'), skill = path.join(root, 'skills/graphally');
  fs.copyFileSync(path.join(skill, 'viewer/graphally.js'), path.join(d, 'graphally.js'));
  const packs = Object.fromEntries(['azure', 'aws'].map(v => [v, Object.values(JSON.parse(fs.readFileSync(findPack(skill, v), 'utf8')))]));
  let fetched = 0;
  const srv = http.createServer((req, res) => {
    const [, vendor, ...rest] = decodeURIComponent(req.url).split('/'), file = rest.join('/');
    const e = packs[vendor]?.find(x => `${x.folder}/${x.file}` === file);
    res.writeHead(e ? 200 : 404, { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' });
    if (e) fetched++;
    res.end(e ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${e.viewBox}">${e.body}</svg>` : '');
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await launch();
  try {
    for (const name of ['architecture', 'aws', 'page']) {
      const src = fs.readFileSync(path.join(root, 'samples', name, 'diagram.html'), 'utf8').replace(/<script src="[^"]*graphally\.js"><\/script>\n?/, '');
      const f = path.join(d, `${name}.html`), out = path.join(d, `out-${name}`);
      fs.writeFileSync(f, `<!doctype html>\n<script>graphallyOptions = { azure: '${base}/azure/', aws: '${base}/aws/', font: '${base}/font/' }</script>\n<script src="graphally.js"></script>\n${src}`);
      ok0(render(f, out, ['--recompute']));
      const cli = readLayout(fs.readFileSync(path.join(out, `${name}.svg`), 'utf8'));
      const page = await openPage(browser, { width: 2000, height: 1400 });
      await page.goto(pathToFileURL(f).href);
      await page.waitFor('document.documentElement.dataset.graphally === "ready"', 30000);
      const svg = await page.evaluate(`document.querySelector('.graphally-view svg')?.outerHTML || ''`);
      const shown = readLayout(svg), problems = await page.evaluate(`document.querySelector('.graphally-problems')?.textContent || ''`);
      check(shown, `${name}: the viewer drew no diagram (${problems})`);
      const moved = Object.keys(cli.nodes).filter(id => !shown.nodes[id] || cli.nodes[id].some((v, i) => Math.abs(v - shown.nodes[id][i]) > 0.5));
      check(!moved.length, `${name}: the viewer placed ${moved.join(', ')} elsewhere than the render`);
      check(!problems, `${name}: the viewer reported ${problems}`);
      check(!page.errors.length, `${name}: page errors: ${page.errors.join(' | ')}`);
      if (name !== 'page') check(/<symbol id="[^"]+" viewBox="[^"]+"><(?:path|g|defs|rect|circle|ellipse|polygon)/.test(svg), `${name}: icons drawn empty`);
    }
    check(fetched > 10, `the viewer fetched only ${fetched} icons`);
  } finally { await browser.close(); srv.close(); }
  // The render adds the header once; a plain drawing script is reported.
  const h = write(folder('viewer-header'), page('<div class=card id=a>A</div>', ''));
  ok0(render(h, path.join(path.dirname(h), 'out'))); ok0(render(h, path.join(path.dirname(h), 'out')));
  const text = fs.readFileSync(h, 'utf8');
  check(text.startsWith('<!doctype html>') && text.split('graphally.js').length === 2, `header: ${text.slice(0, 200)}`);
  const r = render(write(folder('viewer-plain'), page('<div class=card id=a>A</div>', '').replace('<script type="graphally">', '<script>')), path.join(work, 'viewer-plain', 'out'));
  check(r.code === 1 && /plain-script/.test(r.text), `expected plain-script: ${tail(r.text)}`);
});

await test('page-utilities', () => {
  const d = folder('page-utilities'), out = path.join(d, 'out');
  const body = `<style>.wobble { color: red }</style>
<div class="flex justify-center gap-6 p-4"><div class=card id=a>A</div><div class=card id=b>B</div><div class=card id=c>C</div></div>
<div class="grid grid-cols-[100px_1fr_100px] gap-x-[20px] mt-10"><div class="card col-start-3" id=r>R</div><div class="card col-span-full mx-auto w-40" id=w>W</div></div>
<p class="wobble text-muted">note</p>`;
  const r = render(write(d, page(body, '')), out);
  ok0(r);
  const svg = path.join(out, 'diagram.svg'), [a, b, c] = ['a', 'b', 'c'].map(id => rect(svg, id));
  // The content box is 700px wide and starts 24px in, so its middle is at 374.
  const mid = (a[0] + c[0] + c[2]) / 2;
  check(Math.abs(mid - 374) < 1, `justify-center: the row's middle is at ${mid}, not 374`);
  check(Math.abs(b[0] - a[0] - a[2] - 24) < 0.5, `gap-6: ${b[0] - a[0] - a[2]}px between the boxes, not 24`);
  const R = rect(svg, 'r'), W = rect(svg, 'w');
  check(Math.abs(R[0] - (724 - 100)) < 1 && Math.abs(R[2] - 100) < 1, `col-start-3 in a 100px track: ${R}`);
  check(Math.abs(W[2] - 160) < 0.5 && Math.abs(W[0] + W[2] / 2 - 374) < 1, `w-40 mx-auto: ${W}`);
  check(R[1] - (a[1] + a[3]) > 40 + 16 - 1, `mt-10 and p-4: ${R[1] - (a[1] + a[3])}px below the row`);
  // A class that reads like a utility and means nothing is reported; the author's own is not.
  const bad = render(write(d, page('<div class="flex bg-blue-500 md:flex jusitfy-center wobble">x</div>', '')), out);
  check(bad.code === 1 && /unknown-utility: class=bg-blue-500/.test(bad.text) && /class=md:flex/.test(bad.text), `expected unknown-utility: ${tail(bad.text)}`);
  check(!/wobble/.test(bad.text), 'an author class was reported as a utility');
});

await test('page-before-and-dates', () => {
  const d = folder('page-dates'), out = path.join(d, 'out');
  const body = `<div id=plan class="grid gap-y-2">
<div class=card id=t1 data-start=2026-03-02 data-duration=2w>One</div>
<div class=card id=t2 data-after=t1 data-duration=10d>Two</div>
<div class=card id=t3 data-after="t1 t2" data-end=2026-04-30>Three</div>
</div>`;
  const before = `<script type="graphally" before>
schedule();
const t = timeline('#plan');
for (const m of t.months) root.querySelector('#plan').append(make('div', { id: 'm' + m.month, style: 'grid-row: 4; grid-column: ' + m.column }, m.label));
</script>`;
  const r = render(write(d, page(body + before, '')), out);
  ok0(r);
  const svg = path.join(out, 'diagram.svg'), [t1, t2, t3] = ['t1', 't2', 't3'].map(id => rect(svg, id));
  // Two weeks then ten days: t2 starts where t1 ends, t3 where t2 ends; day widths agree.
  check(Math.abs(t2[0] - (t1[0] + t1[2])) < 1 && Math.abs(t3[0] - (t2[0] + t2[2])) < 1, `dependencies: ${t1} ${t2} ${t3}`);
  const day = t1[2] / 14;
  check(Math.abs(t2[2] / day - 10) < 0.1, `10d is ${t2[2] / day} days wide`);
  // An end date is a boundary: 2026-03-26 to 2026-04-30 is 35 days.
  check(Math.abs(t3[2] / day - 35) < 0.2, `t3 from 2026-03-26 to 2026-04-30 is ${t3[2] / day} days wide`);
  const mar = rect(svg, 'm2026-03'), apr = rect(svg, 'm2026-04');
  check(Math.abs(mar[0] - (t1[0] - day)) < 1 && Math.abs(apr[0] - (mar[0] + 31 * day)) < 1, `month headers off the day grid: ${mar} ${apr}`);
  const loop = render(write(d, page('<div id=p><div id=x data-after=y data-duration=1d></div><div id=y data-after=x data-duration=1d></div></div>', '').replace('</diagram>', '<script type="graphally" before>schedule()</script></diagram>')), out);
  check(loop.code === 1 && /schedule-loop/.test(loop.text), `expected schedule-loop: ${tail(loop.text)}`);
});

await test('page-sequence', () => {
  const d = folder('page-sequence'), out = path.join(d, 'out');
  const body = `<div class=seq id=seq>
<div class=node id=a data-who>A</div><div class=node id=b data-who>B</div><div class=node id=c data-who>C</div>
<p class=msg id=m1 data-from=a data-to=c>call</p>
<div class=frag data-kind=alt data-guard=ok><p class=msg id=m2 data-from=c data-to=b>ask</p><div class=else></div><p class="msg reply" id=m3 data-from=b data-to=c>told</p></div>
<p class="msg reply" id=m4 data-from=c data-to=a>done</p>
</div><script type="graphally" before>sequence('#seq')</script>`;
  const r = render(write(d, page(body, '', 'width=900')), out);
  ok0(r);
  const svgFile = path.join(out, 'diagram.svg'), [a, b, c, m1, m2, m3, m4] = ['a', 'b', 'c', 'm1', 'm2', 'm3', 'm4'].map(id => rect(svgFile, id));
  check(a[0] < b[0] && b[0] < c[0] && a[1] === c[1], `participants not in one row, in order: ${a} ${b} ${c}`);
  check(m1[1] >= a[1] + a[3] && m2[1] > m1[1] && m3[1] > m2[1] && m4[1] > m3[1], 'messages not one per row, in order');
  // A message spans from its leftmost participant to its rightmost, either way round.
  check(m1[0] <= a[0] + 1 && m1[0] + m1[2] >= c[0] + c[2] - 1 && m4[2] === m1[2], `message spans: ${m1} ${m4}`);
  const svg = svgOf(out), num = (svg.match(/>[1-4]<\/text>/g) || []).length;
  check(num === 4, `expected four numbers, found ${num}`);
  check(/alt/.test(svg) && /\[ok\]/.test(svg), 'fragment tab missing');
});

await test('page-depend', () => {
  const d = folder('page-depend'), out = path.join(d, 'out');
  // a ends where c starts two rows down; b sits between them across that date, so the
  // dependency must go around b, never through it.
  const body = `<style>.r { display: grid; grid-template-columns: subgrid; grid-column: 1 / -1; height: 40px; align-items: center } .r > i { height: 20px; background: var(--lane-a) }</style>
<div id=p class=grid>
<div class=r><i id=a data-start=2026-03-02 data-duration=2w></i></div>
<div class=r><i id=b data-start=2026-03-09 data-duration=3w></i></div>
<div class=r><i id=c data-after=a data-duration=1w></i></div>
</div><script type="graphally" before>schedule(); timeline('#p', { lead: '0px' })</script>`;
  const r = render(write(d, page(body, "depend('a', 'c')")), out);
  ok0(r);
  const svg = svgOf(out), file = path.join(out, 'diagram.svg'), [A, B, C] = ['a', 'b', 'c'].map(id => rect(file, id));
  const m = svg.match(/<path d="(M[^"]+)"[^>]*marker-end/);
  check(m, 'no dependency drawn');
  const pts = pointsOf(m[1]), first = pts[0], last = pts.at(-1);
  check(Math.abs(first.x - (A[0] + A[2])) < 1 && Math.abs(last.x - C[0]) < 1, `the line does not run from the end of a to the start of c: ${m[1]}`);
  // No corner or crossing point inside b: every segment stays outside its box.
  const inside = (x, y) => x > B[0] && x < B[0] + B[2] && y > B[1] && y < B[1] + B[3];
  for (let k = 1; k < pts.length; k++) for (let t = 0; t <= 1; t += 0.05)
    check(!inside(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t), `the dependency crosses b: ${m[1]}`);
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
