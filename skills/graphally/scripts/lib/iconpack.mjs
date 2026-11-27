// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Icon packs. The skill ships no vendor artwork: packs are downloaded from their upstream
// sources into the skill's assets/icons/ (or a user cache when the skill folder is read-only)
// and turned into one JSON file per pack: name -> { viewBox, body, folder }.
//
//   azure  Microsoft's official icons, as published in the draw.io repository at the
//          commit named in assets/icon-sources/azure.txt.
//   aws    AWS Architecture Icons, from the aws-icons package on the npm registry.
//   ph     Phosphor's line icons (MIT) in six weights, written ph:rocket-launch or ph:rocket-launch-bold.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { svgEntry, kebab } from './engine/icons/icon-svg.js';
import { fetchAzure, fetchAws, fetchPhosphor } from './icon-packs/vendors.mjs';

export const PACKS = ['azure', 'aws', 'ph'];
const FETCHERS = { azure: fetchAzure, aws: fetchAws, ph: fetchPhosphor };

// Where packs live: the skill's assets/icons/, else a user cache when the skill folder is read-only.
export function iconDirs(skillRoot) {
  const cache = process.env.XDG_CACHE_HOME
    || (process.platform === 'win32' ? process.env.LOCALAPPDATA : null)
    || path.join(os.homedir(), '.cache');
  return [path.join(skillRoot, 'assets/icons'), path.join(cache, 'graphally/icons')];
}

export function findPack(skillRoot, name) {
  return iconDirs(skillRoot).map(dir => path.join(dir, `${name}.json`)).find(file => fs.existsSync(file)) || null;
}

function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, '');
    fs.rmSync(probe);
    return true;
  } catch {
    return false;
  }
}

function writableDir(skillRoot) {
  const dir = iconDirs(skillRoot).find(isWritable);
  if (!dir) throw new Error('no writable place for icon packs (tried the skill folder and the user cache)');
  return dir;
}

function readPack(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// The downloaded packs, by vendor.
export function loadPacks(skillRoot) {
  const packs = PACKS
    .map(name => [name, findPack(skillRoot, name)])
    .filter(([, file]) => file)
    .map(([name, file]) => [name, readPack(file)]);
  return Object.fromEntries(packs.filter(([, pack]) => pack));
}

// svgEntry and kebab live in engine/icons/icon-svg.js, which the browser viewer shares.
export { svgEntry, kebab };

async function fetchPack(name, skillRoot, dir, tmp, log) {
  const pack = await FETCHERS[name](skillRoot, tmp, log);
  if (!Object.keys(pack).length) throw new Error(`${name}: no icons found in the download`);
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(pack));
  return `${name}: ${Object.keys(pack).length} icons`;
}

export async function fetchPacks(skillRoot, names = PACKS, log) {
  const dir = writableDir(skillRoot), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphally-icons-')), done = [];
  try {
    for (const name of names) done.push(await fetchPack(name, skillRoot, dir, tmp, log));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { dir, done };
}
