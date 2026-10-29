#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/version.mjs                       prints the version
// node tools/version.mjs 2.4.0                 writes it everywhere it is kept
// node tools/version.mjs --check               exits 1 unless every place agrees
// node tools/version.mjs --kind [label...]          prints the release the labels ask for: build, minor or major
// node tools/version.mjs --next build|minor|major   prints the next version of that kind
//
// The version is kept in four places, which must agree: SKILL.md (metadata.version, which
// ships with the skill folder on its own), the plugin and marketplace manifests (read by
// plugin updates), and the skill folder's package.json (the npm package, which is the same
// folder). The release is tagged v<version>.
// A pull request's label chooses its release: "major", else "minor", else "build" (also with no
// label). --next steps up from the newer of the last v-tag and the version on origin/main.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACES = [
  { file: 'skills/graphally/SKILL.md', re: /^(  version: ")(\d+\.\d+\.\d+)(")$/m },
  { file: '.claude-plugin/plugin.json', re: /^(  "version": ")(\d+\.\d+\.\d+)(")/m },
  { file: '.claude-plugin/marketplace.json', re: /^(      "version": ")(\d+\.\d+\.\d+)(")/m },
  { file: 'skills/graphally/package.json', re: /^(  "version": ")(\d+\.\d+\.\d+)(")/m },
];
const SEMVER = /^\d+\.\d+\.\d+$/;
const read = p => { const m = p.re.exec(fs.readFileSync(path.join(root, p.file), 'utf8')); if (!m) throw new Error(`no version in ${p.file}`); return m[2]; };
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? a : b; return a; };
const git = (...args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };

const [arg, kind] = process.argv.slice(2);
if (!arg) console.log(read(PLACES[0]));
else if (arg === '--check') {
  const found = PLACES.map(p => `${p.file} ${read(p)}`);
  if (new Set(PLACES.map(read)).size > 1) { console.log(`the versions differ:\n  ${found.join('\n  ')}\nset them with: node tools/version.mjs <version>`); process.exit(1); }
  console.log(read(PLACES[0]));
} else if (arg === '--kind') {
  const labels = process.argv.slice(3).flatMap(a => a.split(/[\s,]+/));
  console.log(labels.includes('major') ? 'major' : labels.includes('minor') ? 'minor' : 'build');
} else if (arg === '--next') {
  if (!['build', 'minor', 'major'].includes(kind)) { console.error('usage: node tools/version.mjs --next build|minor|major'); process.exit(2); }
  const tags = git('tag', '--list', 'v*').split('\n').map(t => t.trim().slice(1)).filter(t => SEMVER.test(t));
  const onMain = /^  version: "(\d+\.\d+\.\d+)"$/m.exec(git('show', 'origin/main:skills/graphally/SKILL.md'))?.[1];
  const base = [...tags, onMain].filter(Boolean).reduce(newer, '0.0.0');
  const [major, minor, build] = base.split('.').map(Number);
  console.log(kind === 'major' ? `${major + 1}.0.0` : kind === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${build + 1}`);
} else if (SEMVER.test(arg)) {
  for (const p of PLACES) {
    const f = path.join(root, p.file), text = fs.readFileSync(f, 'utf8');
    if (!p.re.test(text)) throw new Error(`no version in ${p.file}`);
    fs.writeFileSync(f, text.replace(p.re, `$1${arg}$3`));
  }
  console.log(arg);
} else { console.error(`not a version: ${arg} (want x.y.z)`); process.exit(2); }
