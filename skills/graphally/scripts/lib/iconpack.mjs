// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Cloud icon packs. The skill ships no vendor artwork: packs are downloaded from their
// upstream sources into the skill's assets/icons/ (or a user cache when the skill folder
// is read-only) and turned into one JSON file per vendor: name -> { viewBox, body, folder }.
//
//   azure  Microsoft's official icons, as published in the draw.io repository at the
//          commit named in assets/icon-sources/azure.txt.
//   aws    AWS Architecture Icons, from the aws-icons package on the npm registry.
import { execFileSync, spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { svgEntry, kebab } from './iconsvg.js';

export const PACKS = ['azure', 'aws'];
const AWS_PACKAGE = 'aws-icons', AWS_VERSION = '3.3.0';

// ---------- where packs live ----------

export function iconDirs(skillRoot) {
  const cache = process.env.XDG_CACHE_HOME || (process.platform === 'win32' ? process.env.LOCALAPPDATA : null) || path.join(os.homedir(), '.cache');
  return [path.join(skillRoot, 'assets/icons'), path.join(cache, 'graphally/icons')];
}

export function findPack(skillRoot, name) {
  for (const dir of iconDirs(skillRoot)) { const f = path.join(dir, `${name}.json`); if (fs.existsSync(f)) return f; }
  return null;
}

function writableDir(skillRoot) {
  for (const dir of iconDirs(skillRoot)) {
    try { fs.mkdirSync(dir, { recursive: true }); const probe = path.join(dir, '.write-test'); fs.writeFileSync(probe, ''); fs.rmSync(probe); return dir; } catch {}
  }
  throw new Error('no writable place for icon packs (tried the skill folder and the user cache)');
}

export function loadPacks(skillRoot) {
  const out = {};
  for (const name of PACKS) { const f = findPack(skillRoot, name); if (f) try { out[name] = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} }
  return out;
}

// ---------- downloading ----------

const hasCurl = (() => { let v; return () => (v ??= (() => { try { execFileSync('curl', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })()); })();

// Downloads [url, file] pairs. curl is preferred: it honours proxy settings everywhere.
async function download(pairs, onProgress) {
  if (hasCurl()) {
    const config = pairs.map(([u, f]) => `url = "${u}"\noutput = "${f.replace(/\\/g, '/')}"`).join('\n');
    await new Promise((resolve, reject) => {
      const p = spawn('curl', ['--silent', '--show-error', '--fail', '--location', '--retry', '2', '--create-dirs', '--max-time', '120', '--parallel', '--parallel-max', '16', '-K', '-'], { stdio: ['pipe', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', d => { err += d; });
      p.on('error', reject);
      p.on('close', code => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `curl exited with ${code}`))));
      p.stdin.end(config + '\n');
    });
    onProgress?.(pairs.length);
    return;
  }
  let done = 0;
  const queue = [...pairs];
  const worker = async () => {
    for (let job; (job = queue.shift());) {
      const [u, f] = job;
      const res = await fetch(u, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`${res.status} ${u}`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
}

// ---------- turning SVG files into a pack ----------

// svgEntry and kebab live in iconsvg.js, which the browser viewer shares.
export { svgEntry, kebab };

// ---------- the two vendors ----------

async function fetchAzure(skillRoot, tmp, log) {
  const list = fs.readFileSync(path.join(skillRoot, 'assets/icon-sources/azure.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const commit = list.shift().replace(/^commit\s+/, '');
  const base = `https://raw.githubusercontent.com/jgraph/drawio/${commit}/src/main/webapp/img/lib/azure2/`;
  log?.(`azure: ${list.length} icons from github.com/jgraph/drawio`);
  await download(list.map(p => [base + p.split('/').map(encodeURIComponent).join('/'), path.join(tmp, 'azure', p)]));
  const pack = {};
  for (const p of list.sort()) {
    const [folder, file] = p.split('/');
    const name = file.replace(/\.svg$/, '').replace(/_/g, '-').toLowerCase();
    if (pack[name]) continue;                                   // the same icon appears in several folders
    const e = svgEntry(fs.readFileSync(path.join(tmp, 'azure', p), 'utf8'));
    if (e) pack[name] = { ...e, folder, file };
  }
  return pack;
}

async function fetchAws(skillRoot, tmp, log) {
  const url = `https://registry.npmjs.org/${AWS_PACKAGE}/-/${AWS_PACKAGE}-${AWS_VERSION}.tgz`;
  log?.(`aws: AWS Architecture Icons from npm (${AWS_PACKAGE}@${AWS_VERSION})`);
  const file = path.join(tmp, 'aws.tgz');
  await download([[url, file]]);
  const pack = {};
  // Service icons first, so a resource icon never shadows the service of the same name.
  const order = ['architecture-service', 'architecture-group', 'resource', 'category'];
  const files = untar(gunzipSync(fs.readFileSync(file))).filter(f => /^package\/icons\/[^/]+\/[^/]+\.svg$/.test(f.name))
    .sort((a, b) => order.indexOf(a.name.split('/')[2]) - order.indexOf(b.name.split('/')[2]));
  for (const f of files) {
    const folder = f.name.split('/')[2], name = kebab(path.basename(f.name));
    if (pack[name]) continue;
    const e = svgEntry(f.data.toString('utf8'));
    if (e) pack[name] = { ...e, folder, file: path.basename(f.name) };
  }
  return pack;
}

// Minimal ustar reader: enough for an npm tarball.
function untar(buf) {
  const out = [];
  for (let off = 0; off + 512 <= buf.length;) {
    const header = buf.subarray(off, off + 512);
    if (header.every(b => b === 0)) break;
    const field = (a, b) => header.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(field(124, 136).trim() || '0', 8);
    const name = (field(345, 500) ? field(345, 500) + '/' : '') + field(0, 100);
    const type = field(156, 157);
    if (type === '0' || type === '') out.push({ name, data: buf.subarray(off + 512, off + 512 + size) });
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

export async function fetchPacks(skillRoot, names = PACKS, log) {
  const dir = writableDir(skillRoot);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-icons-'));
  const done = [];
  try {
    for (const name of names) {
      const pack = await (name === 'azure' ? fetchAzure : fetchAws)(skillRoot, tmp, log);
      if (!Object.keys(pack).length) throw new Error(`${name}: no icons found in the download`);
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(pack));
      done.push(`${name}: ${Object.keys(pack).length} icons`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { dir, done };
}
