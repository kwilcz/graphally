// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The skill as something shipped and used: its Node API and npm package, its version, batch
// renders, the cloud icon packs fetched on demand, and the examples its documents give.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from '../../skills/graphally/scripts/lib/browser/launch.mjs';
import { openPage } from '../../skills/graphally/scripts/lib/browser/page.mjs';
import { serve } from '../../skills/graphally/scripts/lib/browser/serve.mjs';
import { findPack } from '../../skills/graphally/scripts/lib/iconpack.mjs';
import {
  check, checkSucceeded, folder, pageDiagram, render, root, run, skillDir, summaries, tail, trouble, work, write,
} from './helpers.mjs';

const LINKED = '<div class="flex gap-24"><div class=card id=a>A</div><div class=card id=b>B</div></div>' +
  '<script type="application/json">[["a", "b"]]</script>';

function apiRenderPassed(result) {
  const diagram = result.files[0]?.diagrams[0];
  return result.exitCode === 0 && diagram && fs.existsSync(diagram.svg) && fs.existsSync(diagram.png) &&
    Array.isArray(diagram.problems) && diagram.stats.edges === 1 && result.lines.some(line => / ok$/.test(line));
}

// The Node API is what the CLI runs: the same render, its result as data.
async function checkNodeApi() {
  const { render: renderApi } = await import(pathToFileURL(path.join(skillDir, 'scripts/lib/api.mjs')).href);
  const dir = folder('api');
  const file = write(dir, pageDiagram(LINKED, '', 'width=400'));
  const result = await renderApi([file], { out: path.join(dir, 'out'), png: true, recompute: true });
  check(apiRenderPassed(result), `render() returned ${JSON.stringify(result).slice(0, 300)}`);
  const missing = await renderApi([path.join(dir, 'nope.html')]).then(() => null, error => error);
  check(missing?.exitCode === 2 && /no such file/.test(missing.message),
    `a missing file did not throw with exitCode 2: ${missing}`);
}

// What npm pack --dry-run prints as JSON, or '' when it cannot run (it works offline).
function npmPackListing(dir) {
  return new Promise(resolve => {
    const child = spawn('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: dir });
    let text = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.on('close', () => resolve(text));
    child.on('error', () => resolve(''));
  });
}

// The paths npm would publish.
async function packedFiles(dir) {
  const listing = JSON.parse((await npmPackListing(dir)) || '[{}]');
  return new Set((listing[0].files || []).map(entry => entry.path));
}

// The npm package is the skill folder: what it would publish.
async function checkPublished() {
  const manifest = JSON.parse(fs.readFileSync(path.join(skillDir, 'package.json'), 'utf8'));
  const names = await packedFiles(skillDir);
  const wanted = [
    manifest.bin.graphally, ...Object.values(manifest.exports),
    'scripts/lib/harness.html', 'assets/icon-sources/azure.txt', 'SKILL.md',
  ].map(name => name.replace(/^\.\//, ''));
  const lost = wanted.filter(name => !names.has(name));
  check(names.size && !lost.length, `the package would not publish ${lost.join(', ') || '(npm pack gave no list)'}`);
  check(![...names].some(name => name.startsWith('assets/icons/')),
    'the package would publish the downloaded icon packs');
  const skillVersion = /^  version: "([^"]+)"$/m.exec(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'))[1];
  check(manifest.version === skillVersion, `package.json ${manifest.version} differs from SKILL.md`);
}

export async function packageAndApi() {
  await checkNodeApi();
  await checkPublished();
}

// tools/version.mjs with args: its exit code and its output, trimmed.
async function runVersion(...args) {
  const result = await run(process.execPath, [path.join(root, 'tools/version.mjs'), ...args]);
  return { code: result.code, text: result.text.trim() };
}

function versionParts(text) {
  const [major, minor, build] = text.split('.').map(Number);
  return { major, minor, build };
}

// The next build, minor and major versions each step up from the last release.
function steppedUp(build, minor, major) {
  const minorStep = minor.major === build.major && minor.minor === build.minor + 1 && minor.build === 0;
  const majorStep = major.major === minor.major + 1 && major.minor === 0 && major.build === 0;
  return minorStep && build.build > 0 && majorStep;
}

async function checkNextVersions() {
  const build = await runVersion('--next', 'build');
  const minor = await runVersion('--next', 'minor');
  const major = await runVersion('--next', 'major');
  const ran = [build, minor, major].every(result => result.code === 0);
  check(ran && steppedUp(versionParts(build.text), versionParts(minor.text), versionParts(major.text)),
    `--next gave ${build.text} (build), ${minor.text} (minor) and ${major.text} (major)`);
}

// The version is the same in SKILL.md and both manifests. The next one steps up from the
// last release: the build number, the minor one or the major one.
export async function versionNumbers() {
  const now = await runVersion('--check');
  const skillVersion = /^  version: "(.+)"$/m.exec(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'))?.[1];
  check(now.code === 0 && now.text === skillVersion, `the versions differ: ${now.text}`);
  await checkNextVersions();
  // A pull request's labels choose the kind: major, else minor, else build.
  const labelSets = [[], ['docs'], ['minor'], ['docs minor'], ['minor', 'major']];
  const kinds = (await Promise.all(labelSets.map(labels => runVersion('--kind', ...labels)))).map(kind => kind.text);
  check(kinds.join() === 'build,build,minor,minor,major', `--kind gave ${kinds.join(', ')}`);
}

// Several files in one call print in the order given, whichever finishes first.
async function checkBatchOrder(files, dirs) {
  const result = await render(files, null, ['--jobs', '2']);
  checkSucceeded(result);
  const svgs = summaries(result.text).map(line => line.svg);
  const given = dirs.map(dir => path.join(dir, 'diagram.svg'));
  check(svgs.join() === given.join(), `files out of order: ${svgs.join(', ')}`);
}

// A file comes out of a batch as it does alone.
async function checkSameAlone(batched, batchedDir) {
  const solo = folder('batch-solo');
  fs.copyFileSync(batched, path.join(solo, 'diagram.html'));
  checkSucceeded(await render(path.join(solo, 'diagram.html'), null));
  const svg = dir => fs.readFileSync(path.join(dir, 'diagram.svg'), 'utf8');
  check(svg(batchedDir) === svg(solo), 'a file rendered in a batch differs from the same file rendered alone');
}

export async function batch() {
  const first = folder('batch-a');
  const second = folder('batch-b');
  const firstBody = '<div class=card id=x>X</div><div class="card mt-10" id=y>Y</div>';
  const firstFile = write(first, pageDiagram(firstBody, "arrow('x', 'y')"));
  const secondFile = write(second, pageDiagram('<div class=card id=z>Z</div>'));
  await checkBatchOrder([firstFile, secondFile], [first, second]);
  await checkSameAlone(firstFile, first);
  // Two sources of one name would overwrite each other's files in --out.
  const clash = await render([firstFile, secondFile], path.join(work, 'batch-out'));
  check(clash.code === 2 && /share a name/.test(clash.text), `expected a name clash: ${tail(clash.text)}`);
}

// Counted in the page: the icon packs it fetched.
const PACK_FETCHES = "performance.getEntriesByType('resource')" +
  ".filter(entry => /\\/icons\\/\\w+\\.json$/.test(entry.name)).length";
const GENERIC_ICON = '<div class=node id=a><icon name=user></icon>User</div>';
const CLOUD_ICON = '<div class=node id=a><icon name="app service"></icon>Web</div>';

// Opens one diagram in the harness page and counts the icon packs it fetched.
async function packsFetched(tab, server, name) {
  const query = new URLSearchParams({ src: `${server.origin}/src/${name}`, prev: '' });
  await tab.goto(`${server.origin}/scripts/lib/harness.html?${query}`);
  await tab.ready();
  return tab.evaluate(PACK_FETCHES);
}

// The cloud icon packs (3 MB) are fetched only for a diagram that may name a cloud icon.
export async function iconPacks() {
  const found = ['azure', 'aws'].map(vendor => [`/icons/${vendor}.json`, findPack(skillDir, vendor)]);
  const packs = Object.fromEntries(found.filter(([, file]) => file));
  check(Object.keys(packs).length, 'the icon packs are not downloaded');
  const dir = folder('icon-packs');
  fs.writeFileSync(path.join(dir, 'plain.html'), pageDiagram(GENERIC_ICON));
  fs.writeFileSync(path.join(dir, 'cloud.html'), pageDiagram(CLOUD_ICON));
  const server = await serve(skillDir, dir, packs);
  const browser = await launch();
  try {
    const tab = await openPage(browser);
    check(await packsFetched(tab, server, 'plain.html') === 0,
      'the packs were fetched for a diagram with generic icons only');
    check(await packsFetched(tab, server, 'cloud.html') === Object.keys(packs).length,
      'the packs were not fetched for a diagram with an Azure icon');
  } finally {
    await browser.close();
    server.close();
  }
}

// SKILL.md, then the references in name order.
function skillDocuments() {
  const references = path.join(skillDir, 'references');
  const names = fs.readdirSync(references).filter(name => name.endsWith('.md')).sort();
  return [path.join(skillDir, 'SKILL.md'), ...names.map(name => path.join(references, name))];
}

// Each complete example in a document, written into a folder of its own.
function writeExamples(document) {
  const blocks = fs.readFileSync(document, 'utf8').matchAll(/```html\n(<diagram[\s\S]*?<\/diagram>)\n```/g);
  return [...blocks].map((match, i) => ({
    name: `${path.basename(document)} example ${i + 1}`,
    file: write(folder(`doc-${path.basename(document, '.md')}-${i}`), match[1] + '\n'),
  }));
}

// The example a problem line is about, found by its folder.
function exampleNamed(examples, line) {
  return examples.find(example => line.includes(path.dirname(example.file) + path.sep))?.name || '?';
}

// The skill's own examples: every complete <diagram> in SKILL.md and the references renders
// with no problem, so what an agent copies works.
export async function docExamples() {
  const examples = skillDocuments().flatMap(writeExamples);
  check(examples.length >= 8, `only ${examples.length} examples found`);
  // One render for all of them.
  const result = await render(examples.map(example => example.file), null, ['--no-viewer']);
  const bad = trouble(result.text).map(line => `${exampleNamed(examples, line)}: ${line}`);
  check(result.code === 0 && !bad.length, bad.join('; ') || `exit ${result.code}: ${tail(result.text)}`);
}
