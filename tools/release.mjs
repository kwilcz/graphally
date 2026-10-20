#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node tools/release.mjs next           prints the version the next release gets, if any
// node tools/release.mjs stamp <ver>    writes <ver> into .claude-plugin/plugin.json
// Used by .github/workflows/release.yml. Versions are MAJOR.MINOR.PATCH, tagged vX.Y.Z.
// Only the major is set by hand: raise it in plugin.json and the next release is X.0.0.
// Otherwise the minor goes up when a release changes what users install (the skill or
// the plugin manifests), and the patch goes up when only the rest of the repository did.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const manifest = new URL('../.claude-plugin/plugin.json', import.meta.url);
const SHIPPED = ['skills/graphally/', '.claude-plugin/'];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

function next() {
  const declared = String(JSON.parse(fs.readFileSync(manifest, 'utf8')).version ?? '');
  const major = Number(declared.split('.')[0]);
  if (!declared || !Number.isInteger(major)) throw new Error(`plugin.json: version "${declared}" does not start with a major number`);
  const tagged = git('tag', '--points-at', 'HEAD', '--list', 'v*').split('\n').find(t => SEMVER.test(t.slice(1)));
  if (tagged) return { reason: `this commit is already ${tagged}` };
  const last = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n').find(t => SEMVER.test(t.slice(1)));
  if (!last) return { version: SEMVER.test(declared) ? declared : `${major}.0.0`, bump: 'first release' };
  const changed = git('diff', '--name-only', last, 'HEAD').split('\n').filter(Boolean);
  if (!changed.length) return { reason: `nothing changed since ${last}` };
  const [M, m, p] = last.slice(1).match(SEMVER).slice(1).map(Number);
  if (major < M) throw new Error(`plugin.json: major version ${major} is below the last release, ${last}`);
  if (major > M) return { version: `${major}.0.0`, bump: 'major, raised in plugin.json' };
  return changed.some(f => SHIPPED.some(s => f.startsWith(s)))
    ? { version: `${M}.${m + 1}.0`, bump: 'minor: the skill or plugin changed' }
    : { version: `${M}.${m}.${p + 1}`, bump: 'patch: only the repository around the skill changed' };
}

function stamp(version) {
  if (!SEMVER.test(version)) throw new Error(`not a MAJOR.MINOR.PATCH version: ${version}`);
  const text = fs.readFileSync(manifest, 'utf8');
  if (!/"version"\s*:/.test(text)) throw new Error('plugin.json has no "version" field');
  fs.writeFileSync(manifest, text.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`));
  console.log(`plugin.json: version ${version}`);
}

try {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'next') {
    const r = next();
    if (!r.version) { console.log(`no release: ${r.reason}`); process.exit(0); }
    console.log(`next release: v${r.version} (${r.bump})`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${r.version}\ntag=v${r.version}\n`);
  } else if (cmd === 'stamp' && arg) {
    stamp(arg);
  } else {
    console.error('usage: node tools/release.mjs next | stamp <version>');
    process.exit(2);
  }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
