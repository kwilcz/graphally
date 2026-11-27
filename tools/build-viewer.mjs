#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/build-viewer.mjs
// Builds skills/graphally/viewer/graphally.min.js, the script a diagram file loads to render
// itself in a browser: the engine (scripts/lib/viewer.js and what it imports), the theme,
// and an index of the icon packs (icon name -> its file upstream, no artwork). Needs the
// icon packs (node skills/graphally/scripts/fetch-icons.mjs) and npx, which fetches the
// pinned esbuild. The output is committed; the render workflow rebuilds it on pull requests.
// The readable code is scripts/lib; .gitattributes marks the bundle generated, so GitHub
// folds it in diffs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ESBUILD = 'esbuild@0.24.0', INTER = 'inter-ui@4.1.1', AWS = 'aws-icons@3.3.0';
const PHOSPHOR = '@phosphor-icons/core@2.1.1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills/graphally');
const { findPack } = await import(path.join(skill, 'scripts/lib/iconpack.mjs'));

const FETCH_ICONS = 'node skills/graphally/scripts/fetch-icons.mjs';
const BANNER = '/* graphally viewer · Copyright (c) 2026 Kamil Wilczyński (kwilcz) · Apache License 2.0 · ' +
  'https://github.com/kwilcz/graphally */';

// A pack's index: icon name -> its file upstream.
function packFiles(name) {
  const file = findPack(skill, name);
  if (!file) throw new Error(`no ${name} icon pack: run ${FETCH_ICONS}`);
  const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Object.values(pack).some(entry => !entry.file)) {
    throw new Error(`the ${name} pack predates the viewer: run ${FETCH_ICONS} --force`);
  }
  return Object.fromEntries(Object.entries(pack).map(([key, entry]) => [key, `${entry.folder}/${entry.file}`]));
}

// The draw.io commit the Azure icons are taken from.
function drawioCommit() {
  const sources = fs.readFileSync(path.join(skill, 'assets/icon-sources/azure.txt'), 'utf8');
  return sources.match(/^commit\s+(\w+)/m)[1];
}

function iconIndex() {
  return {
    azure: {
      base: `https://raw.githubusercontent.com/jgraph/drawio/${drawioCommit()}/src/main/webapp/img/lib/azure2/`,
      files: packFiles('azure'),
    },
    aws: { base: `https://cdn.jsdelivr.net/npm/${AWS}/icons/`, files: packFiles('aws') },
    ph: { base: `https://cdn.jsdelivr.net/npm/${PHOSPHOR}/assets/` },
    font: `https://cdn.jsdelivr.net/npm/${INTER}/web/`,
  };
}

// The bundle's entry: the viewer, started with the index.
function writeEntry(tmp, index) {
  fs.writeFileSync(path.join(tmp, 'index.json'), JSON.stringify(index));
  const viewer = JSON.stringify(path.join(skill, 'scripts/lib/viewer.js'));
  const entry = `import { start } from ${viewer};\nimport index from './index.json';\nstart(index);\n`;
  fs.writeFileSync(path.join(tmp, 'entry.js'), entry);
}

function bundle(entry, out) {
  const windows = process.platform === 'win32';
  const args = [
    '--yes', ESBUILD, entry, '--bundle', '--format=iife', '--minify', '--legal-comments=none',
    '--loader:.css=text', `--banner:js=${BANNER}`, `--outfile=${out}`, '--log-level=warning',
  ];
  execFileSync(windows ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: windows });
}

const index = iconIndex();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-viewer-'));
try {
  writeEntry(tmp, index);
  const out = path.join(skill, 'viewer/graphally.min.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  bundle(path.join(tmp, 'entry.js'), out);
  console.log(`${path.relative(root, out)}: ${Math.round(fs.statSync(out).size / 1024)} KB`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
