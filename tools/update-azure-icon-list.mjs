#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// node tools/update-azure-icon-list.mjs <draw.io checkout>
// Rewrites skills/graphally/assets/icon-sources/azure.txt: the draw.io commit and the
// paths of its Azure icons, which scripts/fetch-icons.mjs downloads. A blob-less clone is
// enough: git clone --filter=blob:none --no-checkout https://github.com/jgraph/drawio
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/update-azure-icon-list.mjs <draw.io checkout>'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const prefix = 'src/main/webapp/img/lib/azure2/';
const files = git('ls-tree', '-r', 'HEAD', '--name-only', prefix).split('\n').filter(f => f.endsWith('.svg')).map(f => f.slice(prefix.length));
const out = new URL('../skills/graphally/assets/icon-sources/azure.txt', import.meta.url);
fs.writeFileSync(out, [
  "# Azure icons: Microsoft's official set as published in https://github.com/jgraph/drawio",
  `# commit ${commit}, ${prefix}. One path per line; scripts/fetch-icons.mjs downloads them.`,
  `commit ${commit}`, ...files, ''].join('\n'));
console.log(`${files.length} icons at ${commit}`);
