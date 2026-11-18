#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/update-azure-icon-list.mjs <draw.io checkout>
// Rewrites skills/graphally/assets/icon-sources/azure.txt: the draw.io commit and the
// paths of its Azure icons, which scripts/fetch-icons.mjs downloads. A blob-less clone is
// enough: git clone --filter=blob:none --no-checkout https://github.com/jgraph/drawio
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PREFIX = 'src/main/webapp/img/lib/azure2/';
const OUT = new URL('../skills/graphally/assets/icon-sources/azure.txt', import.meta.url);

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/update-azure-icon-list.mjs <draw.io checkout>');
  process.exit(2);
}
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const files = git('ls-tree', '-r', 'HEAD', '--name-only', PREFIX)
  .split('\n')
  .filter(file => file.endsWith('.svg'))
  .map(file => file.slice(PREFIX.length));
fs.writeFileSync(OUT, [
  "# Azure icons: Microsoft's official set as published in https://github.com/jgraph/drawio",
  `# commit ${commit}, ${PREFIX}. One path per line; scripts/fetch-icons.mjs downloads them.`,
  `commit ${commit}`, ...files, ''].join('\n'));
console.log(`${files.length} icons at ${commit}`);
