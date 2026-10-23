#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// graphally render <file.html> [--png | --png2x] [--dark | --themes] [--inline] [--out dir] [--json] [--recompute] [--no-viewer]
//
// Writes <name>.svg next to the source (or in --out). Prints one short line per
// diagram, then one line per problem. --png also writes a preview image; --dark draws the
// dark theme, --themes writes both (<name>.svg and <name>-dark.svg). The layout of
// the earlier renders is reused unless --recompute is given. A diagram file without the
// viewer header gets it (unless --no-viewer), so it opens in any browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, serve } from './lib/browser.mjs';
import { readLayout } from './lib/snapshot.mjs';
import { PACKS, fetchPacks, findPack } from './lib/iconpack.mjs';
import { withViewer } from './lib/viewerheader.mjs';

const argv = process.argv.slice(2);
if (argv[0] === 'render') argv.shift();
const flag = f => argv.includes(f);
const opt = f => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
if (!file) { console.error('usage: node graphally.mjs render <file.html> [--png | --png2x] [--dark | --themes] [--inline] [--out dir] [--json] [--recompute] [--no-viewer]'); process.exit(2); }
if (!fs.existsSync(file)) { console.log(`error: no such file: ${file}`); process.exit(2); }
if (!flag('--no-viewer') && addViewer(file)) console.log(`${file}: added the viewer header; the file now opens in a browser`);
const outDir = opt('--out') || path.dirname(file);
const base = path.basename(file).replace(/\.html?$/, '');
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(outDir, { recursive: true });
const source = path.relative(outDir, file).split(path.sep).join('/');
const recompute = flag('--recompute');
const previous = recompute ? [] : readPrevious(outDir, base, source);

// The PNG is a preview for checking the layout; --png2x renders it sharp enough to publish.
const scale = flag('--png2x') ? 2 : 1;
// First run: download the cloud icon packs. Without a network the diagram still renders,
// and icons it names are reported with the command to fetch them later.
for (const name of PACKS.filter(n => !findPack(skillRoot, n))) {
  if (process.env.GRAPHALLY_OFFLINE) break;
  console.log(`graphally: downloading the ${name} icon pack (first run only)`);
  try { await fetchPacks(skillRoot, [name]); }
  catch (e) { console.log(`note: ${name} icons not downloaded (${e.message.split('\n')[0]}); run node ${path.join(skillRoot, 'scripts/fetch-icons.mjs')} when online`); }
}
const iconFiles = Object.fromEntries(PACKS.map(n => [`/icons/${n}.json`, findPack(skillRoot, n)]).filter(([, f]) => f));

let browser, server, prevFile = null;
try {
  const files = { ...iconFiles };
  if (!recompute) {
    prevFile = path.join(os.tmpdir(), `graphally-previous-${process.pid}.json`);
    fs.writeFileSync(prevFile, JSON.stringify(previous));
    files['/previous.json'] = prevFile;
  }
  server = await serve(skillRoot, path.dirname(path.resolve(file)), files);
  browser = await launch();
  // Compile at scale 1 whatever the PNG's scale: text metrics differ at 2x, and the SVG must not.
  const page = await openPage(browser);
  const q = new URLSearchParams({ src: `${server.origin}/src/${encodeURIComponent(path.basename(file))}`, source, theme: flag('--dark') ? 'dark' : '', inline: flag('--inline') ? '1' : '', debug: flag('--debug') ? '1' : '' });
  await page.goto(`${server.origin}/scripts/lib/harness.html?${q}`);
  await page.waitFor('document.body && document.body.dataset.ready === "1"');
  const error = await page.evaluate('window.__error || null');
  if (error || page.errors.length) throw new Error(error || page.errors.join('; '));
  const results = await page.evaluate('window.__results.map(({ id, svg, width, height, problems, stats, snapshot }) => ({ id, svg, width, height, problems, stats, snapshot }))');
  if (flag('--debug')) console.log(JSON.stringify(await page.evaluate('window.__debug || null')));
  let exit = 0;
  const taken = new Map();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    // The k-th diagram with this id gets the k-th previous snapshot with it (same as run.js).
    const id = r.id || '', k = taken.get(id) || 0;
    taken.set(id, k + 1);
    const prev = previous.filter(s => (s.id || '') === id)[k];
    const name = results.length === 1 ? base : `${base}.${r.id || i + 1}`;
    const svgPath = path.join(outDir, `${name}.svg`);
    fs.writeFileSync(svgPath, r.svg + '\n');
    // --themes: the dark copy beside it (<name>-dark.svg). Same layout, the dark tokens.
    const dark = flag('--themes') && !flag('--dark');
    if (dark) fs.writeFileSync(path.join(outDir, `${name}-dark.svg`), r.svg.replace(/^<svg ([^>]*?)class="graphally"(?! data-theme)/, '<svg $1class="graphally" data-theme="dark"') + '\n');
    if (flag('--png') || flag('--png2x')) {
      await page.viewport(Math.max(800, r.width), Math.max(600, r.height), scale);
      const sel = `document.querySelectorAll('.out svg')[${i}]`;
      const box = await page.evaluate(`(() => { const b = ${sel}.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()`);
      fs.writeFileSync(path.join(outDir, `${name}.png`), await page.screenshot(box));
      if (dark) {
        await page.evaluate(`${sel}.setAttribute('data-theme', 'dark')`);
        fs.writeFileSync(path.join(outDir, `${name}-dark.png`), await page.screenshot(box));
        await page.evaluate(`${sel}.removeAttribute('data-theme')`);
      }
    }
    if (flag('--json')) { console.log(JSON.stringify({ ...r, svg: svgPath })); continue; }
    // Icons from a pack that is not downloaded are one note, not a problem to fix.
    const offline = r.problems.filter(p => p.rule === 'unknown-icon' && /not downloaded/.test(p.hint || ''));
    r.problems = r.problems.filter(p => !offline.includes(p));
    const s = r.stats;
    console.log(`${svgPath}  ${r.width}×${r.height}  ${s.nodes} nodes, ${s.edges} edges, ${s.crossings} crossings  ${r.problems.length ? r.problems.length + ' problem(s):' : 'ok'}`);
    const now = r.snapshot || readLayout(r.svg);
    if (prev && now) for (const line of droppedOverrides(prev, now)) console.log(line);
    if (offline.length) console.log(`  note: drawn without ${offline.length} icon(s) (${[...new Set(offline.map(p => p.icon))].slice(0, 6).join(', ')}): the icon packs are not downloaded; run node ${path.join(skillRoot, 'scripts/fetch-icons.mjs')} when online`);
    for (const p of r.problems) {
      const { rule, hint, ...rest } = p;
      console.log(`  ${rule}: ${Object.entries(rest).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`).join(' ')}${hint ? `  (${hint})` : ''}`);
    }
    if (r.problems.length) exit = 1;
  }
  process.exitCode = exit;
} catch (e) {
  console.log(`error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.close();
  if (prevFile) fs.rmSync(prevFile, { force: true });
}

// The layouts of the earlier renders, read from <base>.svg and <base>.<id>.svg in dir, in
// name order. A layout recorded for another source file is skipped.
function readPrevious(dir, base, source) {
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.startsWith(`${base}.`) && n.endsWith('.svg')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })); } catch {}
  const snaps = [];
  for (const n of names) {
    try {
      const s = readLayout(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (s && (!s.source || s.source === source)) snaps.push(s);
    } catch {}
  }
  return snaps;
}

// One line per override of prev that next no longer has. A node or link that is gone is
// "removed"; one that is still there lost its override ("attribute removed").
function droppedOverrides(prev, next) {
  const has = (o, k) => Object.hasOwn(o || {}, k);
  const lines = [];
  for (const id of Object.keys(prev.overrides?.nodes || {})) if (!has(next.overrides?.nodes, id))
    lines.push(`  note: override dropped: nudge on ${id} (${has(next.nodes, id) ? 'attribute' : 'node'} removed)`);
  for (const [key, was] of Object.entries(prev.overrides?.edges || {})) {
    const now = next.overrides?.edges?.[key];
    if (!now) lines.push(`  note: override dropped: sides of ${key} (${has(next.edges, key) ? 'attribute' : 'link'} removed)`);
    else for (const end of ['out', 'in']) if (was[end] && !now[end]) lines.push(`  note: override dropped: ${end} side of ${key} (attribute removed)`);
  }
  return lines;
}

// Adds the viewer header to the file when it lacks one; true when it did.
function addViewer(f) {
  const text = fs.readFileSync(f, 'utf8'), out = withViewer(text);
  if (out === text) return false;
  fs.writeFileSync(f, out);
  return true;
}
