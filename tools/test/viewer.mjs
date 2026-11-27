// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer: a diagram file opened from disk renders itself as the CLI renders it, a page that
// embeds diagrams keeps its CSS and theirs apart, and the render keeps the viewer header current.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLayout } from '../../skills/graphally/scripts/lib/snapshot.mjs';
import { launch } from '../../skills/graphally/scripts/lib/browser/launch.mjs';
import { openPage } from '../../skills/graphally/scripts/lib/browser/page.mjs';
import { findPack } from '../../skills/graphally/scripts/lib/iconpack.mjs';
import { MAJOR, VIEWER } from '../../skills/graphally/scripts/lib/viewerheader.mjs';
import {
  check, checkReported, checkSucceeded, folder, pageDiagram, render, root, skillDir, tail, work, write,
} from './helpers.mjs';

const VIEW = "document.querySelector('.graphally-view').shadowRoot";
const ICON_SYMBOL = /<symbol id="[^"]+" viewBox="[^"]+"><(?:path|g|defs|rect|circle|ellipse|polygon)/;

function packIcons(vendor) {
  return Object.values(JSON.parse(fs.readFileSync(findPack(skillDir, vendor), 'utf8')));
}

function answerIcon(packs, served, request, response) {
  const [, vendor, ...rest] = decodeURIComponent(request.url).split('/');
  const file = rest.join('/');
  const icon = packs[vendor]?.find(entry => `${entry.folder}/${entry.file}` === file);
  response.writeHead(icon ? 200 : 404, { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' });
  if (icon) served.count++;
  response.end(icon ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}">${icon.body}</svg>` : '');
}

// A local server stands in for the icon CDNs, serving each icon back from the downloaded packs
// and counting them.
async function serveIcons() {
  const packs = Object.fromEntries(['azure', 'aws'].map(vendor => [vendor, packIcons(vendor)]));
  const served = { count: 0 };
  const server = http.createServer((request, response) => answerIcon(packs, served, request, response));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, served, server };
}

// A fixed diagram (tools/test/fixtures) as a file that loads the viewer, with its icons and font
// served from base.
function writeViewerFile(dir, base, name) {
  const source = fs.readFileSync(path.join(root, 'tools/test/fixtures', `${name}.html`), 'utf8')
    .replace(/<script src="[^"]*graphally\.js"><\/script>\n?/, '');
  const options = `graphallyOptions = { azure: '${base}/azure/', aws: '${base}/aws/', font: '${base}/font/' }`;
  const file = path.join(dir, `${name}.html`);
  const loader = `<script>${options}</script>\n<script src="graphally.min.js"></script>`;
  fs.writeFileSync(file, `<!doctype html>\n${loader}\n${source}`);
  return file;
}

async function openWhenReady(tab, file) {
  await tab.goto(pathToFileURL(file).href);
  await tab.waitFor('document.documentElement.dataset.graphally === "ready"', 30000);
}

function movedFrom(rendered, shown) {
  return !shown || rendered.some((value, i) => Math.abs(value - shown[i]) > 0.5);
}

async function checkSameAsRender(browser, dir, base, name) {
  const file = writeViewerFile(dir, base, name);
  const out = path.join(dir, `out-${name}`);
  checkSucceeded(await render(file, out, ['--recompute']));
  const rendered = readLayout(fs.readFileSync(path.join(out, `${name}.svg`), 'utf8'));
  const tab = await openPage(browser, { width: 2000, height: 1400 });
  await openWhenReady(tab, file);
  const svg = await tab.evaluate(`${VIEW}?.querySelector('svg')?.outerHTML || ''`);
  const shown = readLayout(svg);
  const problems = await tab.evaluate(`${VIEW}?.querySelector('.problems')?.textContent || ''`);
  check(shown, `${name}: the viewer drew no diagram (${problems})`);
  const moved = Object.keys(rendered.nodes).filter(nodeId => movedFrom(rendered.nodes[nodeId], shown.nodes[nodeId]));
  check(!moved.length, `${name}: the viewer placed ${moved.join(', ')} elsewhere than the render`);
  check(!problems, `${name}: the viewer reported ${problems}`);
  check(!tab.errors.length, `${name}: page errors: ${tab.errors.join(' | ')}`);
  // The phases sample has no icons.
  if (name !== 'phases') check(ICON_SYMBOL.test(svg), `${name}: icons drawn empty`);
}

const EMBEDDED = [
  '<!doctype html>',
  '<style>:root { --card: #ff00ff } .card { border: 4px solid green !important } body { letter-spacing: 3px } ' +
    '.graphally-view ~ .graphally-view { --rust: rgb(0, 128, 0) }</style>',
  '<script src="graphally.min.js"></script>',
  "<p class=lede>The page's own paragraph</p>",
  '<diagram width=500><style>.card { background: #fdd } .lede { color: red }</style>' +
    '<div class="flex gap-24"><div class=card id=a>A</div><div class=card id=b>B</div></div>' +
    '<script type="application/json">[["a", "b"]]</script></diagram>',
  '<p>Between</p>',
  '<diagram width=500><div class="flex gap-24"><div class=card id=a>A</div><div class=card id=b>B</div></div>' +
    '<script type="application/json">[{ "from": "a", "to": "b", "color": "rust", "message": true }]</script></diagram>',
  '',
].join('\n');

// Runs in the page, sent as its source: what the page and each of its two diagrams ended up with.
function readEmbeddedStyles() {
  const [one, two] = [...document.querySelectorAll('.graphally-view')].map(view => view.shadowRoot);
  const card = (shadow, partId) => shadow.querySelector('g[data-id="' + partId + '"] rect');
  return {
    lede: getComputedStyle(document.querySelector('p.lede')).color,
    oneFill: card(one, 'a').getAttribute('style'),
    oneStroke: card(one, 'a').getAttribute('stroke-width'),
    twoFill: getComputedStyle(card(two, 'a')).fill,
    twoLine: getComputedStyle(two.querySelector('[data-edge] path')).stroke,
    twoEnds: [...two.querySelectorAll('marker')].map(marker => marker.firstElementChild.tagName).join(' '),
    spacing: getComputedStyle(one.querySelector('text')).letterSpacing,
    page: document.documentElement.hasAttribute('data-graphally-page'),
  };
}

function checkKeptApart(got) {
  check(got.lede === 'rgb(0, 0, 0)', `a diagram's <style> reached the page around it: ${got.lede}`);
  check(/rgb\(255, 221, 221\)/.test(got.oneFill) && got.oneStroke === '1',
    `the page's CSS reached the diagram, or its own <style> did not: ${got.oneFill}, stroke ${got.oneStroke}`);
  check(got.twoFill === 'rgb(255, 255, 255)',
    `one diagram's <style> or the page's --card reached another diagram: ${got.twoFill}`);
  check(got.twoLine === 'rgb(0, 128, 0)', `a token set on .graphally-view did not reach the diagram: ${got.twoLine}`);
  check(got.twoEnds === 'path circle', `the second diagram's line ends are not its own: ${got.twoEnds}`);
  check(got.spacing === 'normal' && !got.page, "the page's letter-spacing reached the labels, " +
    `or an embedding page was taken for a diagram file: ${JSON.stringify(got)}`);
}

// Two diagrams in a page with CSS of its own: each keeps its <style> to itself, the page's
// rules and its own --card stay out, a token set on .graphally-view on purpose gets in, and
// each diagram's line ends are its own though both number them alike.
async function checkEmbedded(browser, dir) {
  const file = path.join(dir, 'embedded.html');
  fs.writeFileSync(file, EMBEDDED);
  const tab = await openPage(browser, { width: 900, height: 700 });
  await openWhenReady(tab, file);
  checkKeptApart(JSON.parse(await tab.evaluate(`JSON.stringify((${readEmbeddedStyles})())`)));
  check(!tab.errors.length, `embedded: page errors: ${tab.errors.join(' | ')}`);
}

// A header on an older major moves forward. Returns the file as moved.
async function checkOlderMajor(file, out, text) {
  fs.writeFileSync(file, text.replace(VIEWER, VIEWER.replace(`@${MAJOR}/`, `@${MAJOR - 1}/`)));
  const result = await render(file, out);
  const moved = fs.readFileSync(file, 'utf8');
  const forward = moved.includes(VIEWER) && moved.split('graphally.min.js').length === 2;
  check(result.code === 0 && /the viewer header now loads/.test(result.text) && forward,
    `an older major's header was not moved forward: ${tail(result.text)}`);
  return moved;
}

// A header pinned to a commit stays.
async function checkPinned(file, out, moved) {
  const pinned = VIEWER.replace(`@${MAJOR}/`, '@0ae0df1/');
  fs.writeFileSync(file, moved.replace(VIEWER, pinned));
  checkSucceeded(await render(file, out));
  check(fs.readFileSync(file, 'utf8').includes(pinned), 'a header pinned to a commit was changed');
}

// A header drawn before 2.11 loads graphally.js, which is gone: it moves to the .min.js.
async function checkRenamed(file, out, moved) {
  fs.writeFileSync(file, moved.replace(VIEWER, VIEWER.replace('graphally.min.js', 'graphally.js')));
  const result = await render(file, out);
  const forward = fs.readFileSync(file, 'utf8');
  check(result.code === 0 && forward.includes(VIEWER) && forward.split('/viewer/graphally').length === 2,
    `a header that loads graphally.js did not move to ${VIEWER}: ${forward.slice(0, 300)}`);
}

// The render adds the header once. It loads the skill's major version (@2 for 2.x).
async function checkHeader() {
  const file = write(folder('viewer-header'), pageDiagram('<div class=card id=a>A</div>', ''));
  const out = path.join(path.dirname(file), 'out');
  checkSucceeded(await render(file, out));
  checkSucceeded(await render(file, out));
  const text = fs.readFileSync(file, 'utf8');
  check(text.startsWith('<!doctype html>') && text.split('graphally.min.js').length === 2,
    `header: ${text.slice(0, 200)}`);
  check(VIEWER.includes(`/gh/kwilcz/graphally@${MAJOR}/`) && text.includes(VIEWER),
    `the header does not load @${MAJOR}: ${text.slice(0, 300)}`);
  const moved = await checkOlderMajor(file, out, text);
  await checkPinned(file, out, moved);
  await checkRenamed(file, out, moved);
}

// A plain drawing script, without type="graphally", is reported.
async function checkPlainScript() {
  const plain = pageDiagram('<div class=card id=a>A</div>', '').replace('<script type="graphally">', '<script>');
  const result = await render(write(folder('viewer-plain'), plain), path.join(work, 'viewer-plain', 'out'));
  checkReported(result, /plain-script/, 'plain-script');
}

export async function viewer() {
  const dir = folder('viewer');
  fs.copyFileSync(path.join(skillDir, 'viewer/graphally.min.js'), path.join(dir, 'graphally.min.js'));
  const icons = await serveIcons();
  const browser = await launch();
  try {
    for (const name of ['architecture', 'aws', 'phases']) {
      await checkSameAsRender(browser, dir, icons.base, name);
    }
    check(icons.served.count > 10, `the viewer fetched only ${icons.served.count} icons`);
    await checkEmbedded(browser, dir);
  } finally {
    await browser.close();
    icons.server.close();
  }
  await checkHeader();
  await checkPlainScript();
}
