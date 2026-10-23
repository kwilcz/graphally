#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// graphally edit <file.html> [--diagram id] <edits…>
//
//   --move id dx,dy           move an element by dx,dy (adds to its nudge)
//   --nudge id x,y            set its nudge (0,0 removes it)
//   --connect from to [label] ['{json}']  add a connection, with options: '{"dashed": true, "out": "right"}'
//   --line 'a->b' '{json}'    change a connection's options, merged into the ones it has
//                             ('{"label": "reads", "via": [[400, 80]]}'; null removes one)
//   --unline 'a->b'           remove a connection (quote keys: > is a shell redirection)
//   --edits '[{…}]'           several edits as JSON (see lib/edits.mjs)
//   --lines                   print the connections, with their keys, as JSON
//
// Edits a diagram's source in place and keeps the rest of the file as written.
// Render it afterwards to see the result; the render keeps everything else where it was.
import fs from 'node:fs';
import { applyEdits, readLines } from './lib/edits.mjs';

const argv = process.argv.slice(2);
if (argv[0] === 'edit') argv.shift();
const file = argv[0];
if (!file || file.startsWith('--')) { console.error('usage: node edit.mjs <file.html> [--diagram id] --move id dx,dy | --nudge id x,y | --connect from to [label] | --line key json | --unline key | --edits json | --lines'); process.exit(2); }
if (!fs.existsSync(file)) { console.log(`error: no such file: ${file}`); process.exit(2); }
const src = fs.readFileSync(file, 'utf8');
const di = argv.indexOf('--diagram'), diagram = di > 0 ? argv[di + 1] : undefined;
const pair = v => v.split(',').map(Number);

if (argv.includes('--lines')) { console.log(JSON.stringify(readLines(src, { diagram }), null, 2)); process.exit(0); }
const edits = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i], next = () => argv[++i];
  if (a === '--diagram') next();
  else if (a === '--move') { const id = next(), [dx, dy] = pair(next()); edits.push({ op: 'move', id, dx, dy }); }
  else if (a === '--nudge') { const id = next(), [x, y] = pair(next()); edits.push({ op: 'nudge', id, x, y }); }
  else if (a === '--connect') {
    const from = next(), to = next(), more = () => argv[i + 1] && !argv[i + 1].startsWith('--');
    const label = more() && !argv[i + 1].startsWith('{') ? next() : '', options = more() && argv[i + 1].startsWith('{') ? JSON.parse(next()) : {};
    edits.push({ op: 'connect', from, to, ...(label ? { label } : {}), ...options });
  } else if (a === '--line') { const key = next(); edits.push({ op: 'line', key, set: JSON.parse(next()) }); }
  else if (a === '--unline') edits.push({ op: 'unline', key: next() });
  else if (a === '--edits') edits.push(...[].concat(JSON.parse(next())));
  else { console.log(`error: unknown option ${a}`); process.exit(2); }
}
const r = applyEdits(src, edits, { diagram });
if (r.applied.length) fs.writeFileSync(file, r.source);
console.log(`${file}: ${r.applied.length} edit(s) applied${r.errors.length ? `, ${r.errors.length} failed` : ''}`);
for (const e of r.errors) console.log(`  ${e.edit.op}: ${e.message}`);
process.exitCode = r.errors.length ? 1 : 0;
