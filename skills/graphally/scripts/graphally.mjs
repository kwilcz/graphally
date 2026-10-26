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
// four), and print in the order given.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, serve } from './lib/browser.mjs';
import { readLayout } from './lib/snapshot.mjs';
import { PACKS, fetchPacks, findPack } from './lib/iconpack.mjs';
import { VIEWER, withViewer } from './lib/viewerheader.mjs';

const USAGE = 'usage: node graphally.mjs render <file.html>... [--png | --png2x] [--dark | --themes] [--inline] [--out dir] [--json] [--recompute] [--no-viewer] [--jobs n]';
const argv = process.argv.slice(2);
if (argv[0] === 'render') argv.shift();
const flag = f => argv.includes(f);
const opt = f => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--jobs');
if (!files.length) { console.error(USAGE); process.exit(2); }
for (const f of files) if (!fs.existsSync(f)) { console.log(`error: no such file: ${f}`); process.exit(2); }
const outOpt = opt('--out');
const baseOf = f => path.basename(f).replace(/\.html?$/, '');
if (outOpt && new Set(files.map(baseOf)).size < files.length) { console.log('error: two sources share a name, so their files would overwrite each other in --out: render them separately, or without --out'); process.exit(2); }
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recompute = flag('--recompute');
// The PNG is a preview for checking the layout; --png2x renders it sharp enough to publish.
const scale = flag('--png2x') ? 2 : 1;
const dark = flag('--themes') && !flag('--dark');

// One job per file: where it writes, and the layouts of its earlier renders.
const jobs = files.map((file, n) => {
  const outDir = outOpt || path.dirname(file), base = baseOf(file);
  fs.mkdirSync(outDir, { recursive: true });
  const source = path.relative(outDir, file).split(path.sep).join('/');
  const out = [];
  const header = flag('--no-viewer') ? null : addViewer(file);
  if (header === 'added') out.push(`${file}: added the viewer header; the file now opens in a browser`);
  else if (header === 'updated') out.push(`${file}: the viewer header now loads ${VIEWER.split('/')[5]}, the major version that drew it`);
  return { n, file, outDir, base, source, previous: recompute ? [] : readPrevious(outDir, base, source), out, exit: 0, done: false };
});

// First run: download the cloud icon packs. Without a network the diagram still renders,
// and icons it names are reported with the command to fetch them later.
for (const name of PACKS.filter(n => !findPack(skillRoot, n))) {
  if (process.env.GRAPHALLY_OFFLINE) break;
  console.log(`graphally: downloading the ${name} icon pack (first run only)`);
  try { await fetchPacks(skillRoot, [name]); }
  catch (e) { console.log(`note: ${name} icons not downloaded (${e.message.split('\n')[0]}); run node ${path.join(skillRoot, 'scripts/fetch-icons.mjs')} when online`); }
}

let browser, server;
try {
  const served = Object.fromEntries(PACKS.map(n => [`/icons/${n}.json`, findPack(skillRoot, n)]).filter(([, f]) => f));
  for (const j of jobs) if (!recompute) served[`/previous/${j.n}.json`] = { body: JSON.stringify(j.previous) };
  server = await serve(skillRoot, jobs.map(j => path.dirname(path.resolve(j.file))), served);
  browser = await launch();
  const want = Number(opt('--jobs')) || Math.min(4, Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1));
  const pages = await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs.length, want)) }, () => openPage(browser)));
  // Each file's lines print once it and every file before it are done.
  let printed = 0;
  const flush = () => { while (printed < jobs.length && jobs[printed].done) { for (const line of jobs[printed].out) console.log(line); printed++; } };
  let next = 0;
  await Promise.all(pages.map(async page => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try { await renderJob(page, job); }
      catch (e) { job.out.push(`error: ${jobs.length > 1 ? `${job.file}: ` : ''}${e.message}`); job.exit = 1; }
      job.done = true;
      flush();
    }
  }));
  process.exitCode = Math.max(...jobs.map(j => j.exit));
} catch (e) {
  console.log(`error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.close();
}

// Compiles one file in a page and writes its SVG (and PNG) files; its lines go to job.out.
async function renderJob(page, job) {
  const log = line => job.out.push(line);
  // Compile at scale 1 whatever the PNG's scale: text metrics differ at 2x, and the SVG must not.
  await page.viewport(1400, 900, 1);
  const q = new URLSearchParams({ src: `${server.origin}/src/${job.n}/${encodeURIComponent(path.basename(job.file))}`, source: job.source, theme: flag('--dark') ? 'dark' : '', inline: flag('--inline') ? '1' : '', debug: flag('--debug') ? '1' : '', prev: recompute ? '' : `/previous/${job.n}.json` });
  await page.goto(`${server.origin}/scripts/lib/harness.html?${q}`);
  await page.ready();
  const error = await page.evaluate('window.__error || null');
  if (error || page.errors.length) throw new Error(error || page.errors.join('; '));
  const results = await page.evaluate('window.__results.map(({ id, svg, width, height, problems, stats, snapshot }) => ({ id, svg, width, height, problems, stats, snapshot }))');
  if (flag('--debug')) log(JSON.stringify(await page.evaluate('window.__debug || null')));
  const taken = new Map();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    // The k-th diagram with this id gets the k-th previous snapshot with it (same as run.js).
    const id = r.id || '', k = taken.get(id) || 0;
    taken.set(id, k + 1);
    const prev = job.previous.filter(s => (s.id || '') === id)[k];
    const name = results.length === 1 ? job.base : `${job.base}.${r.id || i + 1}`;
    const svgPath = path.join(job.outDir, `${name}.svg`);
    fs.writeFileSync(svgPath, r.svg + '\n');
    // --themes: the dark copy beside it (<name>-dark.svg). Same layout, the dark tokens.
    if (dark) fs.writeFileSync(path.join(job.outDir, `${name}-dark.svg`), r.svg.replace(/^<svg ([^>]*?)class="graphally"(?! data-theme)/, '<svg $1class="graphally" data-theme="dark"') + '\n');
    if (flag('--png') || flag('--png2x')) {
      // --png is a preview, encoded for speed; --png2x is for publishing, encoded small.
      const fast = scale === 1;
      await page.viewport(Math.max(800, r.width), Math.max(600, r.height), scale);
      const sel = `document.querySelectorAll('.out svg')[${i}]`;
      const box = await page.evaluate(`(() => { const b = ${sel}.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()`);
      fs.writeFileSync(path.join(job.outDir, `${name}.png`), await page.screenshot(box, { fast }));
      if (dark) {
        await page.evaluate(`${sel}.setAttribute('data-theme', 'dark')`);
        fs.writeFileSync(path.join(job.outDir, `${name}-dark.png`), await page.screenshot(box, { fast }));
        await page.evaluate(`${sel}.removeAttribute('data-theme')`);
      }
    }
    if (flag('--json')) { log(JSON.stringify({ ...r, svg: svgPath })); continue; }
    // Icons from a pack that is not downloaded are one note, not a problem to fix.
    const offline = r.problems.filter(p => p.rule === 'unknown-icon' && /not downloaded/.test(p.hint || ''));
    r.problems = r.problems.filter(p => !offline.includes(p));
    const s = r.stats;
    log(`${svgPath}  ${r.width}×${r.height}  ${s.nodes} nodes, ${s.edges} edges, ${s.crossings} crossings  ${r.problems.length ? r.problems.length + ' problem(s):' : 'ok'}`);
    const now = r.snapshot || readLayout(r.svg);
    if (prev && now) for (const line of droppedOverrides(prev, now)) log(line);
    if (offline.length) log(`  note: drawn without ${offline.length} icon(s) (${[...new Set(offline.map(p => p.icon))].slice(0, 6).join(', ')}): the icon packs are not downloaded; run node ${path.join(skillRoot, 'scripts/fetch-icons.mjs')} when online`);
    for (const p of r.problems) {
      const { rule, hint, ...rest } = p;
      log(`  ${rule}: ${Object.entries(rest).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`).join(' ')}${hint ? `  (${hint})` : ''}`);
    }
    if (r.problems.length) job.exit = 1;
  }
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

// One line per override of prev that next no longer has. A box or connection that is gone is
// "removed"; one that is still there lost its override ("attribute removed").
function droppedOverrides(prev, next) {
  const has = (o, k) => Object.hasOwn(o || {}, k);
  const lines = [];
  for (const id of Object.keys(prev.overrides?.nodes || {})) if (!has(next.overrides?.nodes, id))
    lines.push(`  note: override dropped: nudge on ${id} (${has(next.nodes, id) ? 'attribute' : 'node'} removed)`);
  for (const [key, was] of Object.entries(prev.overrides?.edges || {})) {
    const now = next.overrides?.edges?.[key];
    if (!now) lines.push(`  note: override dropped: sides of ${key} (${has(next.edges, key) ? 'attribute' : 'connection'} removed)`);
    else for (const end of ['out', 'in']) if (was[end] && !now[end]) lines.push(`  note: override dropped: ${end} side of ${key} (attribute removed)`);
  }
  return lines;
}

// Adds the viewer header to the file when it lacks one, or moves an older major range
// forward: 'added', 'updated', or null when the file is left as it was.
function addViewer(f) {
  const text = fs.readFileSync(f, 'utf8'), out = withViewer(text);
  if (out === text) return null;
  fs.writeFileSync(f, out);
  return /graphally\.js["']/.test(text) ? 'updated' : 'added';
}
