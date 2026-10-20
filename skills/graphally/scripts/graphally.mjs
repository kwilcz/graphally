#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// graphally render <file.html> [--png | --png2x] [--dark] [--inline] [--out dir] [--json]
//
// Writes <name>.svg next to the source (or in --out). Prints one short line per
// diagram, then one line per problem. --png also writes a preview image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage, serve } from './lib/browser.mjs';
import { PACKS, fetchPacks, findPack } from './lib/iconpack.mjs';

const argv = process.argv.slice(2);
if (argv[0] === 'render') argv.shift();
const flag = f => argv.includes(f);
const opt = f => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
if (!file) { console.error('usage: node graphally.mjs render <file.html> [--png | --png2x] [--dark] [--inline] [--out dir] [--json]'); process.exit(2); }
if (!fs.existsSync(file)) { console.log(`error: no such file: ${file}`); process.exit(2); }
const outDir = opt('--out') || path.dirname(file);
const base = path.basename(file).replace(/\.html?$/, '');
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(outDir, { recursive: true });

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

let browser, server;
try {
  server = await serve(skillRoot, path.dirname(path.resolve(file)), iconFiles);
  browser = await launch();
  const page = await openPage(browser, { scale });
  const q = new URLSearchParams({ src: `${server.origin}/src/${encodeURIComponent(path.basename(file))}`, theme: flag('--dark') ? 'dark' : '', inline: flag('--inline') ? '1' : '', debug: flag('--debug') ? '1' : '' });
  await page.goto(`${server.origin}/scripts/lib/harness.html?${q}`);
  await page.waitFor('document.body && document.body.dataset.ready === "1"');
  const error = await page.evaluate('window.__error || null');
  if (error || page.errors.length) throw new Error(error || page.errors.join('; '));
  const results = await page.evaluate('window.__results.map(({ id, svg, width, height, problems, stats }) => ({ id, svg, width, height, problems, stats }))');
  if (flag('--debug')) console.log(JSON.stringify(await page.evaluate('window.__debug || null')));
  let exit = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const name = results.length === 1 ? base : `${base}.${r.id || i + 1}`;
    const svgPath = path.join(outDir, `${name}.svg`);
    fs.writeFileSync(svgPath, r.svg + '\n');
    if (flag('--png') || flag('--png2x')) {
      await page.viewport(Math.max(800, r.width), Math.max(600, r.height));
      const box = await page.evaluate(`(() => { const b = document.querySelectorAll('.out svg')[${i}].getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()`);
      fs.writeFileSync(path.join(outDir, `${name}.png`), await page.screenshot(box));
    }
    if (flag('--json')) { console.log(JSON.stringify({ ...r, svg: svgPath })); continue; }
    // Icons from a pack that is not downloaded are one note, not a problem to fix.
    const offline = r.problems.filter(p => p.rule === 'unknown-icon' && /not downloaded/.test(p.hint || ''));
    r.problems = r.problems.filter(p => !offline.includes(p));
    const s = r.stats;
    console.log(`${svgPath}  ${r.width}×${r.height}  ${s.nodes} nodes, ${s.edges} edges, ${s.crossings} crossings  ${r.problems.length ? r.problems.length + ' problem(s):' : 'ok'}`);
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
}
