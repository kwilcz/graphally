// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Every samples/*/diagram.html and docs/diagrams/*.html rendered through the CLI, the layout
// each SVG carries, and how far a layout moves when a box is added: a stable re-render against
// --recompute, on fixed copies of two diagrams (tools/test/fixtures), so the showcase can change.
import fs from 'node:fs';
import path from 'node:path';
import { table } from './harness.mjs';
import {
  check, checkSucceeded, folder, percent, readSnapshot, render, replaceOnce, root, summaries, tail, trouble, write,
} from './helpers.mjs';

// Every sample and docs diagram, relative to the root.
function listSources() {
  const samples = fs.readdirSync(path.join(root, 'samples')).sort()
    .map(dir => path.join('samples', dir, 'diagram.html'));
  const docs = fs.readdirSync(path.join(root, 'docs/diagrams')).filter(file => file.endsWith('.html')).sort()
    .map(file => path.join('docs/diagrams', file));
  return [...samples, ...docs].filter(source => fs.existsSync(path.join(root, source)));
}

const sources = listSources();
// Each source's diagrams, from the samples test's render, for the layout test to read.
const renders = new Map();

// The source copied into a folder of its own, where its files land.
function copySource(source) {
  const dir = folder(path.join('out', source.replace(/\.html$/, '').split(/[\\/]/).join('-')));
  const file = path.join(dir, path.basename(source));
  fs.copyFileSync(path.join(root, source), file);
  return { source, dir, file };
}

// One render for all of them.
export async function samples() {
  const copies = sources.map(copySource);
  const result = await render(copies.map(copy => copy.file), null, ['--no-viewer']);
  const all = summaries(result.text);
  for (const copy of copies) {
    renders.set(copy.source, { summaries: all.filter(line => path.dirname(line.svg) === copy.dir) });
  }
  check(result.code === 0, `exit ${result.code}: ${trouble(result.text).join('; ') || tail(result.text)}`);
}

// What is wrong with one diagram's layout, against its summary line: nothing, or one entry.
function layoutProblems(source, line) {
  if (!line.nodes) return [];   // nothing named, nothing to record
  const name = `${source} (${path.basename(line.svg)})`;
  let snapshot;
  try {
    snapshot = readSnapshot(line.svg);
  } catch (error) {
    return [`${name}: ${error.message}`];
  }
  const count = Object.keys(snapshot.nodes || {}).length;
  return count === line.nodes ? [] : [`${name}: ${count} nodes in the layout, ${line.nodes} in the summary`];
}

export async function layout() {
  const problems = [];
  for (const [source, { summaries: lines }] of renders) {
    if (!lines.length) problems.push(`${source}: no diagram in the output`);
    for (const line of lines) problems.push(...layoutProblems(source, line));
  }
  check(!problems.length, problems.join('; '));
}

const ENGINE = '<div class=node id=engine><icon name="container app"></icon>' +
  'scheduling-engine<small>internal</small></div>';
const AUDIT = '<div class=node id=audit><icon name="container app"></icon>audit worker<small>batch</small></div>';
const APP = '<div class=node id=app><icon name="app service"></icon>App Service<small>VNet integration</small></div>';
const BATCH = '<div class=node id=batch><icon name="app service"></icon>Batch worker<small>nightly jobs</small></div>';

// Edits by literal replacement: one new node inside one existing group, and one link from it
// to an existing node.
const EDITS = {
  architecture: { newNode: 'audit', pairs: [
    [ENGINE, `${ENGINE}\n    ${AUDIT}`],
    ['["engine", "cosmos", "locations"],', '["engine", "cosmos", "locations"], ["audit", "sql", "audit rows"],'],
  ] },
  network: { newNode: 'batch', pairs: [
    [APP, `${APP}\n      ${BATCH}`],
    ['["pesql", "sql", "private link"],', '["pesql", "sql", "private link"], ["batch", "pest", "blob reads"],'],
  ] },
};
const SHARES = ['nodes', 'arranged', 'edges'];

function samePlace(first, second) {
  return Math.abs(first[0] - second[0]) <= 0.5 && Math.abs(first[1] - second[1]) <= 0.5;
}

// An empty set counts as unchanged.
function share(count, total) {
  return total ? count / total : 1;
}

// The innermost group whose rect holds the centre of the box.
function groupOf(snapshot, [x, y, w, h]) {
  const centreX = x + w / 2;
  const centreY = y + h / 2;
  const holding = Object.entries(snapshot.groups).filter(([, group]) =>
    centreX >= group[0] && centreX <= group[0] + group[2] && centreY >= group[1] && centreY <= group[1] + group[3]);
  return holding.sort(([, first], [, second]) => first[2] * first[3] - second[2] * second[3])[0]?.[0];
}

function offsetInGroup(snapshot, nodeId, group) {
  const box = snapshot.nodes[nodeId];
  const groupBox = snapshot.groups[group];
  return [box[0] - groupBox[0], box[1] - groupBox[1]];
}

function keptPlaceInGroup(before, after, nodeId) {
  const group = groupOf(before, before.nodes[nodeId]);
  if (!group || !after.groups[group]) return false;
  return samePlace(offsetInGroup(before, nodeId, group), offsetInGroup(after, nodeId, group));
}

// Share of the nodes and of the edges present in both snapshots that did not move (within
// 0.5 px), that kept their place inside their group (offset from the innermost group whose
// rect holds the node's centre), and that kept their sides.
function shares(before, after) {
  const nodes = Object.keys(before.nodes).filter(nodeId => Object.hasOwn(after.nodes, nodeId));
  const edges = Object.keys(before.edges).filter(key => Object.hasOwn(after.edges, key));
  const unmoved = nodes.filter(nodeId => samePlace(before.nodes[nodeId], after.nodes[nodeId]));
  const arranged = nodes.filter(nodeId => keptPlaceInGroup(before, after, nodeId));
  const sameSides = edges.filter(key =>
    before.edges[key].out === after.edges[key].out && before.edges[key].in === after.edges[key].in);
  return {
    nodes: share(unmoved.length, nodes.length),
    arranged: share(arranged.length, nodes.length),
    edges: share(sameSides.length, edges.length),
  };
}

// Writes source into dir, renders it into dir/out and reads back the layout.
async function renderedLayout(dir, source, flags = []) {
  checkSucceeded(await render(write(dir, source), path.join(dir, 'out'), flags));
  return readSnapshot(path.join(dir, 'out', 'diagram.svg'));
}

async function checkStability(name, { newNode, pairs }) {
  const source = fs.readFileSync(path.join(root, 'tools/test/fixtures', `${name}.html`), 'utf8');
  const edited = pairs.reduce((text, [anchor, replacement]) => replaceOnce(text, anchor, replacement), source);
  const warmDir = folder(`stability-${name}`);
  const coldDir = folder(`stability-${name}-recompute`);
  const before = await renderedLayout(warmDir, source);
  const warm = await renderedLayout(warmDir, edited);
  const cold = await renderedLayout(coldDir, edited, ['--recompute']);
  check(Object.hasOwn(warm.nodes, newNode), `new node ${newNode} is not in the layout`);
  const stable = shares(before, warm);
  const recomputed = shares(before, cold);
  table.push([name, ...SHARES.map(kind => percent(stable[kind])), ...SHARES.map(kind => percent(recomputed[kind]))]);
  const compared = SHARES.map(kind => `${kind} ${percent(stable[kind])} vs ${percent(recomputed[kind])}`).join(', ');
  check(SHARES.every(kind => stable[kind] >= recomputed[kind]),
    `the stable render moved more than --recompute (${compared})`);
}

export async function stability() {
  const problems = [];
  for (const [name, edit] of Object.entries(EDITS)) {
    try {
      await checkStability(name, edit);
    } catch (error) {
      problems.push(`${name}: ${error.message}`);
    }
  }
  check(!problems.length, problems.join('; '));
}
