// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// One job per file: where it writes, its lines, and the layouts of its earlier renders.
import fs from 'node:fs';
import path from 'node:path';
import { readLayout } from '../snapshot.mjs';
import { LOADS, VIEWER, withViewer } from '../viewerheader.mjs';

const baseOf = file => path.basename(file).replace(/\.html?$/, '');
const refuse = message => Object.assign(new Error(message), { exitCode: 2 });

// A file that does not exist, or two that would write over each other in out, stop the render.
export function checkFiles(files, options) {
  for (const file of files) if (!fs.existsSync(file)) throw refuse(`no such file: ${file}`);
  if (options.out && new Set(files.map(baseOf)).size < files.length) {
    throw refuse('two sources share a name, so their files would overwrite each other in --out: render them separately, or without --out');
  }
}

// Adds the viewer header to the file when it lacks one, or moves an older major range forward:
// 'added', 'updated', or null when the file is left as it was.
function addViewer(file) {
  const text = fs.readFileSync(file, 'utf8'), withHeader = withViewer(text);
  if (withHeader === text) return null;
  fs.writeFileSync(file, withHeader);
  return LOADS.test(text) ? 'updated' : 'added';
}

function viewerNotes(file, options) {
  const header = options.viewer === false ? null : addViewer(file);
  if (header === 'added') return [`${file}: added the viewer header; the file now opens in a browser`];
  return header === 'updated' ? [`${file}: the viewer header now loads ${VIEWER}`] : [];
}

// The SVG files of earlier renders of a source: <base>.svg and <base>.<id>.svg, in name order.
function renderedNames(dir, base) {
  try {
    return fs.readdirSync(dir).filter(name => name.startsWith(`${base}.`) && name.endsWith('.svg'))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  } catch {
    return [];
  }
}

function layoutIn(file) {
  try {
    return readLayout(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// The layouts of the earlier renders; a layout recorded for another source file is skipped.
function readPrevious(dir, base, source) {
  return renderedNames(dir, base).map(name => layoutIn(path.join(dir, name))).filter(layout => layout && (!layout.source || layout.source === source));
}

export function createJob(file, index, options) {
  const outDir = options.out || path.dirname(file), base = baseOf(file);
  fs.mkdirSync(outDir, { recursive: true });
  const source = path.relative(outDir, file).split(path.sep).join('/'), out = viewerNotes(file, options);
  const previous = options.recompute ? [] : readPrevious(outDir, base, source);
  return { index, file, outDir, base, source, diagrams: [], previous, out, exit: 0, done: false };
}
