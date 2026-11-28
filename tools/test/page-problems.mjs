// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What a page reports, and connections as data: problems, nudges and edits.
import fs from 'node:fs';
import path from 'node:path';
import { readLayout } from '../../skills/graphally/scripts/lib/snapshot.mjs';
import { applyEdits, readLines } from '../../skills/graphally/scripts/lib/edits.mjs';
import {
  CARD_A, check, checkReported, checkSucceeded, folder, pageDiagram, render, svgOf, tail, write,
} from './helpers.mjs';

const OVERFLOWS = '<div class=group style="position: relative; width: 200px"><h4>G</h4>' +
  '<div class=node id=big style="width: 260px">Too wide</div>' +
  '<b id=badge style="position: absolute; top: -8px; left: -8px; width: 16px; height: 16px; ' +
  'background: var(--woad)"></b>' +
  '</div><div style="width: 100px"><div class=card id=free style="width: 160px">Free</div></div>';
const CLOSE = '<style>.r { display: flex; gap: 14px }</style>' +
  '<div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>';
const NARROW_GAP = [
  '<style>.g { display: grid; grid-template-columns: 1fr 1fr; gap: 60px 16px } ' +
    '.top { grid-column: 1 / -1; justify-self: center; width: 160px } .h { height: 60px }</style>',
  '<div class=g><div class="card top" id=a>A</div><div class="card h" id=x>X</div><div class="card h" id=y>Y</div>' +
    '<div class=card id=b>B</div><div class=card id=c>C</div></div>',
].join('\n');
const THROUGH_GAP = "const gap = mid(el('x').right, el('y').left); " +
  "connect('a', 'b', { via: [gap] }); connect('a', 'c', { via: [gap] })";
const BPMN_FRAGMENT = [
  '<style>.p { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: 110px 110px; ' +
    'gap: 0 50px; align-items: center; justify-items: center }</style>',
  '<div class=p><i shape=start id=s style="grid-area: 1 / 1"></i>' +
    '<div shape=task id=t1 style="grid-area: 1 / 2">Submit</div>' +
    '<div shape=task id=t2 style="grid-area: 2 / 2">Validate</div>',
  '<i shape="gateway exclusive" id=g style="grid-area: 2 / 3"></i>' +
    '<div shape="task loop" id=t3 style="grid-area: 1 / 4">Correct</div>' +
    '<i shape=end id=e style="grid-area: 2 / 4"></i></div>',
].join('\n');
const BPMN_FLOWS = "connect('s', 't1'); connect('t1', 't2'); connect('t2', 'g'); " +
  "connect('g', 't3', { label: 'invalid' }); connect('g', 'e', { label: 'valid' }); " +
  "connect('t3', 't1', { label: 'resubmit' })";

// A node wider than its group is a warning, and the render passes. A badge placed on the
// group's corner with position: absolute is meant, and so is the overflow of a plain wrapper.
async function checkBoxOverflow(dir, out) {
  const wide = await render(write(dir, pageDiagram(OVERFLOWS)), out);
  const oneWarning = /ok, 1 warning:/.test(wide.text) &&
    /warning: box-overflow: box=big in=div\.group by=right \d+px/.test(wide.text);
  check(wide.code === 0 && oneWarning && !/badge|free/.test(wide.text),
    `expected one box-overflow warning, for big: ${tail(wide.text)}`);
}

// Two lines squeezed through one narrow gap share a stretch.
async function checkSharedGap(dir, out) {
  const result = await render(write(dir, pageDiagram(NARROW_GAP, THROUGH_GAP)), out);
  checkReported(result, /lines-overlap: a=a->b b=a->c/, 'lines-overlap');
}

// An arrowhead on a too-short end is reported; a BPMN fragment routes with full-length ends.
async function checkShortEnds(dir, out) {
  const shortArrow = pageDiagram(CARD_A, "arrow(el('a').bottom.down(20), el('a').bottom.down(28))");
  const short = await render(write(dir, shortArrow), out);
  checkReported(short,/short-end: line=a drawn line end=head/, 'short-end');
  const whole = await render(write(dir, pageDiagram(BPMN_FRAGMENT, BPMN_FLOWS)), out);
  checkSucceeded(whole);
  check(!/flow-missing/.test(whole.text), `a whole process reports a missing flow: ${tail(whole.text)}`);
  // The flow into the end event left out: a warning names it.
  const cut = BPMN_FLOWS.replace("connect('g', 'e', { label: 'valid' }); ", '');
  const open = await render(write(dir, pageDiagram(BPMN_FRAGMENT, cut)), out);
  check(open.code === 0 && /warning: flow-missing: step=e gap=no flow reaches it/.test(open.text),
    `expected a flow-missing warning for e: ${tail(open.text)}`);
}

const HEADING_BETWEEN = '<style>.r { display: grid; grid-template-columns: 140px 140px; gap: 120px 200px } ' +
  'h3 { grid-column: 1 / -1; justify-self: center; margin: 0 }</style><div class=r>' +
  '<h3 id=note>A heading between the rows</h3><div class=card id=a>A</div><div class=card id=b>B</div></div>';
const THROUGH_HEADING = "connect('a', 'b', { via: [pt(mid(el('a').right, el('b').left).x, el('note').center.y)] })";

// A line forced through a heading, a drawn text past the page's left edge, and a task's label
// under its type's marker (where the author's padding takes the room back) are reported.
async function checkTextHits(dir, out) {
  const through = await render(write(dir, pageDiagram(HEADING_BETWEEN, THROUGH_HEADING)), out);
  checkReported(through, /line-through-text: line=a->b text="A heading between the rows"/, 'line-through-text');
  const cut = pageDiagram(CARD_A, "text(pt(10, 20), 'a label that runs off the left', { anchor: 'end' })");
  checkReported(await render(write(dir, cut), out), /text-cut: text="a label that runs off the left"/, 'text-cut');
  const task = padding => `<div shape="task user" id=t style="width: 130px${padding}">Review the claim</div>`;
  checkSucceeded(await render(write(dir, pageDiagram(task(''))), out));
  checkReported(await render(write(dir, pageDiagram(task('; padding: 8px 10px'))), out),
    /marker-overlap: box=t text="Review the claim"/, 'marker-overlap');
}

export async function pageProblems() {
  const dir = folder('page-problems');
  const out = path.join(dir, 'out');
  const narrow = await render(write(dir, pageDiagram('<div class=card>A</div>', '', 'width=12px')), out);
  checkReported(narrow, /bad-attribute: attr=width value=12px/, 'bad-attribute for width');
  await checkBoxOverflow(dir, out);
  const longLabel = pageDiagram(CLOSE, "connect('a', 'b', { label: 'a label far too long for this gap' })");
  checkReported(await render(write(dir, longLabel), out), /label-crowded: edge=a -> b/, 'label-crowded');
  await checkSharedGap(dir, out);
  await checkShortEnds(dir, out);
  await checkTextHits(dir, out);
  const tooWide = pageDiagram('<div style="width: 900px" class=card>wide</div>', '', 'width=600');
  const wide = await render(write(dir, tooWide), out);
  checkReported(wide, /page-overflow: width=600 content=9\d\d/, 'page-overflow');
}

// Connections as data, nudge, edits, and lines that keep their sides across an edit.
const DATA = `<diagram width=760>
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
const WORKER = '<div class=card id=worker>Worker</div>';
const DATA_EDITS = [
  { op: 'connect', from: 'worker', to: 'audit', label: 'records' },
  { op: 'line', key: 'web->api', set: { label: 'orders in' } },
  { op: 'move', id: 'queue', dx: 10, dy: 0 },
];

// Each routed line's sides, by its key.
function sidesOf(svg) {
  const lines = svg.matchAll(/data-edge="([^"]+)" data-sides="([^"]+)"/g);
  return Object.fromEntries([...lines].map(match => [match[1].replace(/&gt;/g, '>'), match[2]]));
}

// Renders file into out and reads back its layout and each line's sides.
async function routed(file, out) {
  checkSucceeded(await render(file, out));
  const svg = svgOf(out);
  return { snapshot: readLayout(svg), sides: sidesOf(svg) };
}

function checkAsWritten({ snapshot, sides }) {
  check(Object.keys(sides).length === 5, `expected 5 routed connections, got ${Object.keys(sides).join(', ')}`);
  const keys = readLines(DATA).map(line => line.key).join(' ');
  check(keys === 'web->api api->db api->queue queue->worker worker->db', 'connection keys');
  // nudge: queue sits 20px lower than worker's row would put it
  const { queue, worker } = snapshot.nodes;
  check(Math.abs(queue[1] - worker[1] - 20) <= 1, `queue nudge: ${queue} vs ${worker}`);
}

// edits: a new box and connection, a new label and a move, written into the source.
function editedData() {
  const result = applyEdits(DATA.replace(WORKER, `${WORKER}<div class=card id=audit>Audit</div>`), DATA_EDITS);
  check(!result.errors.length, `edits failed: ${JSON.stringify(result.errors)}`);
  const written = /id=queue nudge="10,20"/.test(result.source) &&
    /\{ "from": "worker", "to": "audit", "label": "records" \}/.test(result.source) &&
    /"label": "orders in"/.test(result.source);
  check(written, 'edits not in the source');
  return result.source;
}

// Everything the edits did not touch keeps its place and its sides.
function checkKept(before, after) {
  const moved = Object.keys(before.snapshot.nodes).filter(key =>
    key !== 'queue' && JSON.stringify(before.snapshot.nodes[key]) !== JSON.stringify(after.snapshot.nodes[key]));
  check(!moved.length, `boxes moved by an unrelated edit: ${moved.join(', ')}`);
  const flipped = Object.keys(before.sides).filter(key =>
    !key.startsWith('queue') && !key.endsWith('queue') && before.sides[key] !== after.sides[key]);
  check(!flipped.length, `lines changed sides: ${flipped.join(', ')}`);
  check(after.sides['worker->audit'], 'the new connection is not routed');
}

export async function pageData() {
  const dir = folder('page-data');
  const out = path.join(dir, 'out');
  const file = write(dir, DATA);
  const before = await routed(file, out);
  checkAsWritten(before);
  fs.writeFileSync(file, editedData());
  checkKept(before, await routed(file, out));
  // a broken entry is reported, the rest still renders
  const bad = await render(write(dir, DATA.replace('["queue", "worker"],', '["queue"],')), out);
  checkReported(bad, /bad-line: line=4 message=needs "from" and "to"/, 'bad-line');
}
