// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The two vendors' icons, each turned into one pack: name -> { viewBox, body, folder, file }.
//
//   azure  Microsoft's official icons, as published in the draw.io repository at the commit named
//          in assets/icon-sources/azure.txt.
//   aws    AWS Architecture Icons, from the aws-icons package on the npm registry.
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { svgEntry, kebab } from '../engine/icons/icon-svg.js';
import { download } from './download.mjs';

const AWS_PACKAGE = 'aws-icons', AWS_VERSION = '3.3.0';

// The lines of assets/icon-sources/azure.txt: the commit, then the icons' paths.
function readAzureList(skillRoot) {
  return fs.readFileSync(path.join(skillRoot, 'assets/icon-sources/azure.txt'), 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

export async function fetchAzure(skillRoot, tmp, log) {
  const list = readAzureList(skillRoot);
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

export async function fetchAws(skillRoot, tmp, log) {
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

