// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// One file, compiled in a page: each of its diagrams written as SVG (and PNG), and reported.
import fs from 'node:fs';
import path from 'node:path';
import { reportDiagram } from './report.mjs';

const RESULTS = 'window.__results.map(({ id, svg, width, height, problems, stats, snapshot }) =>'
  + ' ({ id, svg, width, height, problems, stats, snapshot }))';

function pageUrl({ origin }, job, options) {
  const query = new URLSearchParams({
    src: `${origin}/src/${job.index}/${encodeURIComponent(path.basename(job.file))}`, source: job.source,
    theme: options.dark ? 'dark' : '', inline: options.inline ? '1' : '', debug: options.debug ? '1' : '',
    prev: options.recompute ? '' : `/previous/${job.index}.json`,
  });
  return `${origin}/scripts/lib/harness.html?${query}`;
}

// Compiled at scale 1 whatever the PNG's scale: text metrics differ at 2x, and the SVG must not.
async function compileFile(page, job, { options, server }) {
  await page.viewport(1400, 900, 1);
  await page.goto(pageUrl(server, job, options));
  await page.ready();
  const error = await page.evaluate('window.__error || null');
  if (error || page.errors.length) throw new Error(error || page.errors.join('; '));
  const results = await page.evaluate(RESULTS);
  if (options.debug) job.out.push(JSON.stringify(await page.evaluate('window.__debug || null')));
  return results;
}

// The dark copy: the same layout, the dark tokens.
const UNTHEMED_ROOT = /^<svg ([^>]*?)class="graphally"(?! data-theme)/;
const darkCopy = svg => svg.replace(UNTHEMED_ROOT, '<svg $1class="graphally" data-theme="dark"');

// The page goes dark too, so a figure with no background of its own (background="none") is shown
// on the dark ground it was drawn for.
async function captureDark(page, selector, file, box, fast) {
  await page.evaluate(`${selector}.setAttribute('data-theme', 'dark'); document.documentElement.dataset.theme = 'dark'`);
  fs.writeFileSync(file, await page.screenshot(box, { fast }));
  await page.evaluate(`${selector}.removeAttribute('data-theme'); delete document.documentElement.dataset.theme`);
}

// The expression for where the element the selector finds sits on the page, scrolling included.
const pageBoxExpression = selector => `(() => { const b = ${selector}.getBoundingClientRect();`
  + ' return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()';

// Previews are encoded for speed; --png2x is for publishing, encoded small. A later diagram of the
// file sits below the first: the window grows to hold it, so the capture stays inside the window.
async function writePngs(page, job, { scale, dark }, result, index, name) {
  const fast = scale <= 1, selector = `document.querySelectorAll('.out svg')[${index}]`;
  const width = Math.max(800, result.width), height = Math.max(600, result.height);
  await page.viewport(width, height, scale);
  const box = await page.evaluate(pageBoxExpression(selector));
  if (box.y + box.height > height) await page.viewport(width, box.y + box.height, scale);
  const png = path.join(job.outDir, `${name}.png`);
  fs.writeFileSync(png, await page.screenshot(box, { fast }));
  if (dark) await captureDark(page, selector, path.join(job.outDir, `${name}-dark.png`), box, fast);
  return png;
}

// --themes: the dark copy beside it (<name>-dark.svg).
async function writeDiagram(page, job, context, result, index, name) {
  const svg = path.join(job.outDir, `${name}.svg`), darkSvg = path.join(job.outDir, `${name}-dark.svg`);
  const { dark, options } = context;
  fs.writeFileSync(svg, `${result.svg}\n`);
  if (dark) fs.writeFileSync(darkSvg, `${darkCopy(result.svg)}\n`);
  const wantsPng = options.png || options.png1x || options.png2x;
  const png = wantsPng ? await writePngs(page, job, context, result, index, name) : null;
  const { id, width, height, problems, stats } = result;
  return { id, svg, ...(dark ? { darkSvg } : {}), ...(png ? { png } : {}), width, height, problems, stats };
}

// The k-th diagram with an id gets the k-th previous layout with it (as run.js does).
function previousFor(job, id, taken) {
  const k = taken.get(id) || 0;
  taken.set(id, k + 1);
  return job.previous.filter(layout => (layout.id || '') === id)[k];
}

export async function renderFile(page, job, context) {
  const results = await compileFile(page, job, context), taken = new Map();
  for (const [index, result] of results.entries()) {
    const previous = previousFor(job, result.id || '', taken);
    const name = results.length === 1 ? job.base : `${job.base}.${result.id || index + 1}`;
    const diagram = await writeDiagram(page, job, context, result, index, name);
    job.diagrams.push(diagram);
    reportDiagram(job, result, diagram.svg, previous, context.options);
  }
}
