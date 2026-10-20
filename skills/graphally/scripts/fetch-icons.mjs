#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node fetch-icons.mjs [azure] [aws] [--force]
// Downloads the cloud icon packs (both by default) from their upstream sources into the
// skill's assets/icons/, or into ~/.cache/graphally/icons when the skill folder is
// read-only. Packs already present are kept unless --force is given.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, fetchPacks, findPack } from './lib/iconpack.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const asked = args.filter(a => PACKS.includes(a));
const names = (asked.length ? asked : PACKS).filter(n => args.includes('--force') || !findPack(skillRoot, n));
if (!names.length) { console.log(`icons already present: ${(asked.length ? asked : PACKS).map(n => findPack(skillRoot, n)).join(', ')}`); process.exit(0); }
try {
  const { dir, done } = await fetchPacks(skillRoot, names, line => console.log(line));
  console.log(`${done.join(', ')} -> ${dir}`);
} catch (e) {
  console.log(`error: ${e.message}`);
  process.exit(1);
}
