#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node tf2graphally.mjs <terraform dir> [--out draft.html] [--title "…"]
// Writes a draft graphally diagram of what the configuration deploys and prints a summary.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { terraformToDiagram } from './lib/terraform.js';
import { registerPack, resolveIcon } from './lib/icons.js';
import { loadPacks } from './lib/iconpack.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const dir = args.find((a, i) => !a.startsWith('--') && !['--out', '--title'].includes(args[i - 1]));
if (!dir) { console.error('usage: tf2graphally <terraform dir> [--out draft.html] [--title "…"]'); process.exit(2); }
for (const [vendor, pack] of Object.entries(loadPacks(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')))) registerPack(vendor, pack);
const icons = name => { const r = resolveIcon(name); return r && !r.error; };

const { html, summary } = terraformToDiagram(dir, { title: opt('--title'), icons });
const out = opt('--out') || 'draft.html';
fs.writeFileSync(out, html);
const folded = Object.entries(summary.folded).map(([k, v]) => `${v} ${k}`).join(', ');
console.log(`${out}  ${summary.resources} resources${summary.modules ? `, ${summary.modules + 1} modules` : ''} -> ${summary.groups} boxes, ${summary.nodes} nodes, ${summary.links} links`);
if (folded) console.log(`  folded into links and labels: ${folded}`);
if (summary.skipped.length) console.log(`  data sources not drawn: ${summary.skipped.join(', ')}`);
