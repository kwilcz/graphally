#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/build-viewer.mjs
// Builds skills/graphally/viewer/graphally.js, the script a diagram file loads to render
// itself in a browser: the engine (scripts/lib/viewer.js and what it imports), the theme,
// and an index of the icon packs (icon name -> its file upstream, no artwork). Needs the
// icon packs (node skills/graphally/scripts/fetch-icons.mjs) and npx, which fetches the
// pinned esbuild. The output is committed; the render workflow rebuilds it on pull requests.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ESBUILD = 'esbuild@0.24.0', INTER = 'inter-ui@4.1.1', AWS = 'aws-icons@3.3.0';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills/graphally');
const { findPack } = await import(path.join(skill, 'scripts/lib/iconpack.mjs'));

const pack = name => {
  const f = findPack(skill, name);
  if (!f) throw new Error(`no ${name} icon pack: run node skills/graphally/scripts/fetch-icons.mjs`);
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (Object.values(p).some(e => !e.file)) throw new Error(`the ${name} pack predates the viewer: run node skills/graphally/scripts/fetch-icons.mjs --force`);
  return Object.fromEntries(Object.entries(p).map(([k, e]) => [k, `${e.folder}/${e.file}`]));
};
const commit = fs.readFileSync(path.join(skill, 'assets/icon-sources/azure.txt'), 'utf8').match(/^commit\s+(\w+)/m)[1];
const index = {
  azure: { base: `https://raw.githubusercontent.com/jgraph/drawio/${commit}/src/main/webapp/img/lib/azure2/`, files: pack('azure') },
  aws: { base: `https://cdn.jsdelivr.net/npm/${AWS}/icons/`, files: pack('aws') },
  font: `https://cdn.jsdelivr.net/npm/${INTER}/web/`,
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-viewer-'));
try {
  fs.writeFileSync(path.join(tmp, 'index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(tmp, 'entry.js'), `import { start } from ${JSON.stringify(path.join(skill, 'scripts/lib/viewer.js'))};\nimport index from './index.json';\nstart(index);\n`);
  const out = path.join(skill, 'viewer/graphally.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const banner = '/* graphally viewer · Copyright (c) 2026 Kamil Wilczyński (kwilcz) · Apache License 2.0 · https://github.com/kwilcz/graphally */';
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', ESBUILD, path.join(tmp, 'entry.js'), '--bundle', '--format=iife', '--minify', '--legal-comments=none',
    '--loader:.css=text', `--banner:js=${banner}`, `--outfile=${out}`, '--log-level=warning'], { stdio: 'inherit', shell: process.platform === 'win32' });
  console.log(`${path.relative(root, out)}: ${Math.round(fs.statSync(out).size / 1024)} KB`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
