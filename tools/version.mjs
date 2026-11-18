#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/version.mjs                       prints the version
// node tools/version.mjs 2.4.0                 writes it everywhere it is kept
// node tools/version.mjs --check               exits 1 unless every place agrees
// node tools/version.mjs --kind [label...]          prints the release the labels ask for: build, minor or major
// node tools/version.mjs --next build|minor|major   prints the next version of that kind
//
// The version is kept in five places, which must agree: SKILL.md (metadata.version, which
// ships with the skill folder on its own), the Agent Plugins manifest (plugin.json), the
// Claude Code plugin and marketplace manifests (read by plugin updates), and the skill
// folder's package.json (the npm package, which is the same folder). The release is tagged
// v<version>.
// A pull request's label chooses its release: "major", else "minor", else "build" (also with no
// label). --next steps up from the newer of the last v-tag and the version on origin/main.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACES = [
  { file: 'skills/graphally/SKILL.md', re: /^(  version: ")(\d+\.\d+\.\d+)(")$/m },
  { file: 'plugin.json', re: /^(  "version": ")(\d+\.\d+\.\d+)(")/m },
  { file: '.claude-plugin/plugin.json', re: /^(  "version": ")(\d+\.\d+\.\d+)(")/m },
  { file: '.claude-plugin/marketplace.json', re: /^(      "version": ")(\d+\.\d+\.\d+)(")/m },
  { file: 'skills/graphally/package.json', re: /^(  "version": ")(\d+\.\d+\.\d+)(")/m },
];
const SEMVER = /^\d+\.\d+\.\d+$/;
const KINDS = ['build', 'minor', 'major'];

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

function read(place) {
  const match = place.re.exec(fs.readFileSync(path.join(root, place.file), 'utf8'));
  if (!match) throw new Error(`no version in ${place.file}`);
  return match[2];
}

// The newer of two versions, a when they are equal.
function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  const differs = [0, 1, 2].find(i => x[i] !== y[i]);
  if (differs === undefined) return a;
  return x[differs] > y[differs] ? a : b;
}

// git's output, or '' when it fails (no tags, no origin/main).
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function checkAgree() {
  if (new Set(PLACES.map(read)).size > 1) {
    const found = PLACES.map(place => `${place.file} ${read(place)}`);
    console.log(`the versions differ:\n  ${found.join('\n  ')}\nset them with: node tools/version.mjs <version>`);
    process.exit(1);
  }
  console.log(read(PLACES[0]));
}

function printKind(labelArgs) {
  const labels = labelArgs.flatMap(arg => arg.split(/[\s,]+/));
  console.log(KINDS.slice().reverse().find(kind => labels.includes(kind)) ?? 'build');
}

// The newer of the last v-tag and the version on origin/main.
function released() {
  const tags = git('tag', '--list', 'v*').split('\n').map(tag => tag.trim().slice(1)).filter(tag => SEMVER.test(tag));
  const onMain = /^  version: "(\d+\.\d+\.\d+)"$/m.exec(git('show', 'origin/main:skills/graphally/SKILL.md'))?.[1];
  return [...tags, onMain].filter(Boolean).reduce(newer, '0.0.0');
}

function printNext(kind) {
  if (!KINDS.includes(kind)) fail('usage: node tools/version.mjs --next build|minor|major', 2);
  const [major, minor, build] = released().split('.').map(Number);
  const next = { major: `${major + 1}.0.0`, minor: `${major}.${minor + 1}.0`, build: `${major}.${minor}.${build + 1}` };
  console.log(next[kind]);
}

function writeVersion(version) {
  for (const place of PLACES) {
    const file = path.join(root, place.file), text = fs.readFileSync(file, 'utf8');
    if (!place.re.test(text)) throw new Error(`no version in ${place.file}`);
    fs.writeFileSync(file, text.replace(place.re, `$1${version}$3`));
  }
  console.log(version);
}

const COMMANDS = {
  '--check': checkAgree,
  '--kind': () => printKind(process.argv.slice(3)),
  '--next': () => printNext(process.argv[3]),
};

const arg = process.argv[2];
if (!arg) console.log(read(PLACES[0]));
else if (Object.hasOwn(COMMANDS, arg)) COMMANDS[arg]();
else if (SEMVER.test(arg)) writeVersion(arg);
else fail(`not a version: ${arg} (want x.y.z)`, 2);
