#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// graphally render <file.html>... [--png | --png2x] [--dark | --themes] [--inline] [--out dir] [--json] [--recompute] [--no-viewer] [--jobs n]
//
// Writes <name>.svg next to the source (or in --out). Prints one short line per
// diagram, then one line per problem. --png also writes a preview image; --dark draws the
// dark theme, --themes writes both (<name>.svg and <name>-dark.svg). The layout of
// the earlier renders is reused unless --recompute is given. A diagram file without the
// viewer header gets it (unless --no-viewer), so it opens in any browser. Several files
// render in one browser, --jobs at a time (by default one fewer than the processors, at most
// four), and print in the order given. The work is render() in lib/api.mjs; this reads the flags.
import { render } from './lib/api.mjs';

const USAGE = 'usage: node graphally.mjs render <file.html>... [--png | --png2x] [--dark | --themes] [--inline] [--out dir] [--json] [--recompute] [--no-viewer] [--jobs n]';
const argv = process.argv.slice(2);
if (argv[0] === 'render') argv.shift();
const flag = f => argv.includes(f);
const opt = f => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--jobs');
if (!files.length) { console.error(USAGE); process.exit(2); }
try {
  const r = await render(files, {
    out: opt('--out'), png: flag('--png'), png2x: flag('--png2x'), dark: flag('--dark'), themes: flag('--themes'), inline: flag('--inline'),
    json: flag('--json'), recompute: flag('--recompute'), viewer: !flag('--no-viewer'), jobs: opt('--jobs'), debug: flag('--debug'),
    log: line => console.log(line),
  });
  process.exitCode = r.exitCode;
} catch (e) {
  console.log(`error: ${e.message}`);
  process.exit(e.exitCode ?? 1);
}
