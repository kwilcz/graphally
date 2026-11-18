// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Shared by every test: the paths, the work folder, the checks, one CLI run and what is read
// back from its output and its files, and the two small diagrams most tests start from.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLayout } from '../../skills/graphally/scripts/lib/snapshot.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const skillDir = path.join(root, 'skills/graphally');
const cli = path.join(skillDir, 'scripts/graphally.mjs');
export const keep = process.argv.includes('--keep');
export const work = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-test-'));

export function check(condition, message) {
  if (!condition) throw new Error(message);
}

// The last two lines a run printed, on one line.
export function tail(text) {
  return text.trim().split('\n').slice(-2).join(' | ').slice(0, 300);
}

export function checkSucceeded(result) {
  check(result.code === 0, `exit ${result.code}: ${tail(result.text)}`);
}

// A render that fails (exit 1) and reports pattern; the message names what was expected.
export function checkReported(result, pattern, expected) {
  check(result.code === 1 && pattern.test(result.text), `expected ${expected}: ${tail(result.text)}`);
}

export function percent(share) {
  return `${Math.round(100 * share)}%`;
}

// How often a global pattern occurs in text.
export function countOf(text, pattern) {
  return (text.match(pattern) || []).length;
}

// A long regular expression from shorter String.raw parts, which keep their backslashes as a
// regex literal would.
export function longPattern(...parts) {
  return new RegExp(parts.join(''));
}

// A folder of that name in the work folder, made if new.
export function folder(name) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Writes text as dir/diagram.html and returns that path.
export function write(dir, text) {
  const file = path.join(dir, 'diagram.html');
  fs.writeFileSync(file, text);
  return file;
}

// Runs a command to its end: its exit code and what it printed on both streams.
export function run(command, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, options);
    let text = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { text += chunk; });
    child.on('error', error => { text += error.message; });
    child.on('close', code => resolve({ code, text }));
  });
}

// One CLI run: its exit code and what it printed, when it ends. file may be a list (one
// batch); out may be null, to write next to each source.
export function render(file, out, flags = []) {
  const outFlags = out ? ['--out', out] : [];
  return run(process.execPath, [cli, 'render', ...[].concat(file), ...outFlags, ...flags], { timeout: 600000 });
}

// Writes source into dir, renders it into out, checks the render passed and returns the SVG.
export async function renderedSvg(dir, out, source, flags = []) {
  checkSucceeded(await render(write(dir, source), out, flags));
  return svgOf(out);
}

// The diagrams of a render that failed or reported problems, one entry each, with their lines.
export function trouble(text) {
  const entries = [];
  let open = false;
  for (const line of text.split('\n')) {
    if (/^error:/.test(line) || /problem\(s\):$/.test(line)) {
      entries.push(line);
      open = true;
    } else if (open && /^  \S/.test(line)) {
      entries[entries.length - 1] += ` | ${line.trim()}`;
    } else {
      open = false;
    }
  }
  return entries;
}

// The summary line of each diagram in a render: "<svg path>  WxH  N nodes, …".
export function summaries(text) {
  const lines = text.matchAll(/^(.+?\.svg)\s+[\d.]+×[\d.]+\s+(\d+) nodes,/gm);
  return [...lines].map(match => ({ svg: match[1], nodes: Number(match[2]) }));
}

// The layout an SVG carries on its elements (data-box, data-sides …). Throws when there is none.
export function readSnapshot(svg) {
  const snapshot = readLayout(fs.readFileSync(svg, 'utf8'));
  check(snapshot, `no layout in ${path.basename(svg)}`);
  return snapshot;
}

// The box [x, y, w, h] of one node in an SVG file's layout.
export function nodeRect(svg, nodeId) {
  const box = readSnapshot(svg).nodes?.[nodeId];
  check(box, `no node ${nodeId} in the snapshot`);
  return box;
}

// The source with the one occurrence of anchor replaced. Throws when anchor is not there exactly once.
export function replaceOnce(source, anchor, replacement) {
  check(source.split(anchor).length === 2, `edit anchor not found once: ${anchor.slice(0, 40)}`);
  return source.replace(anchor, () => replacement);
}

export function svgOf(out) {
  return fs.readFileSync(path.join(out, 'diagram.svg'), 'utf8');
}

// A routed line's path data.
export function edgePath(svg, key) {
  const match = svg.match(new RegExp(`<g data-edge="${key.replace(/>/g, '&gt;')}"[^>]*><path d="([^"]+)"`));
  check(match, `no edge ${key}`);
  return match[1];
}

// The points of path data, in order.
export function pointsOf(pathData) {
  return [...pathData.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
}

// The small diagram: two groups side by side, three boxes, one connection. attr goes on b1;
// line is the connection entry.
export function twoGroups({ attr = '', line = '["a1", "b1", "flow"]' } = {}) {
  return [
    '<diagram width=760 title="Sides test">',
    '<div class="grid grid-cols-2 gap-x-40 items-start">',
    '  <div class=group id=ga><h4>Left</h4><div class=node id=a1>Alpha<small>first</small></div>' +
      '<div class=node id=a2>Beta<small>second</small></div></div>',
    `  <div class=group id=gb><h4>Right</h4><div class=node id=b1${attr}>Gamma<small>third</small></div></div>`,
    '</div>',
    `<script type="application/json">[${line}]</script>`,
    '</diagram>',
    '',
  ].join('\n');
}

// One card, a with the text A, for figures that need a single box.
export const CARD_A = '<div class=card id=a>A</div>';

// A small figure written as HTML and CSS, with a drawing script.
export function pageDiagram(body, script = '', attrs = 'width=700') {
  return `<diagram ${attrs}>\n${body}\n<script type="graphally">\n${script}\n</script>\n</diagram>\n`;
}
