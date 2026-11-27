// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A company's own look and the marks an infographic leans on: font files declared with
// @font-face (beside the docs, embedded or not), icon sets from a folder or a sprite, Phosphor's
// line icons, the warning for a class a building block also styles, a full circle drawn with
// draw.arc, and a gradient from transparent.
import fs from 'node:fs';
import path from 'node:path';
import { check, checkSucceeded, folder, pageDiagram, render, svgOf, tail, write } from './helpers.mjs';
import { iconSetPack, parseIconSets, spriteFiles } from '../../skills/graphally/scripts/lib/icon-sets.js';
import { registerPack, resolveIcon } from '../../skills/graphally/scripts/lib/engine/icons/icons.js';
import { typeOf } from '../../skills/graphally/scripts/lib/font-files.js';
import { facesFor } from '../../skills/graphally/scripts/lib/fonts.js';

// A font file to stand in for a licensed one: the first this machine has (CI installs Inter).
const FONT_FILES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
  '/System/Library/Fonts/Supplemental/Arial.ttf', 'C:\\Windows\\Fonts\\arial.ttf',
];

// A brand folder beside the docs folder, and the docs folder the diagram is written in.
function brandAndDocs(name) {
  const dir = folder(name), brand = path.join(dir, 'brand'), docs = path.join(dir, 'docs');
  fs.mkdirSync(path.join(brand, 'icons/more'), { recursive: true });
  fs.mkdirSync(docs, { recursive: true });
  return { dir, brand, docs, out: path.join(dir, 'out') };
}

const FACE_EMBEDDED = new RegExp("@font-face\\{font-family:'Brand Face';font-weight:700;font-style:normal;"
  + 'src:url\\(data:font/(ttf|otf);base64,');

// A face of the diagram's own, its file outside the diagram's folder: measured, embedded, or kept
// out with embed-fonts="no"; a file that is not there is a warning.
export async function pageBrandFonts() {
  const font = FONT_FILES.find(file => fs.existsSync(file));
  check(font, 'no font file on this machine to stand in for a brand font');
  const { brand, docs, out } = brandAndDocs('page-brand-fonts'), file = `Brand Face${path.extname(font)}`;
  fs.copyFileSync(font, path.join(brand, file));
  const css = `@font-face { font-family: 'Brand Face'; font-weight: 700; src: url("../brand/${file}"); }`
    + " .t { font-family: 'Brand Face'; font-weight: 700 }";
  const body = `<style>${css}</style><div class=t>Brand</div>`;
  checkSucceeded(await render(write(docs, pageDiagram(body, '', 'width=300')), out));
  check(FACE_EMBEDDED.test(svgOf(out)), 'the font file is not embedded in the SVG');
  checkSucceeded(await render(write(docs, pageDiagram(body, '', 'width=300 embed-fonts=no')), out));
  check(!/@font-face/.test(svgOf(out)), 'embed-fonts="no" still embeds the font');
  const lost = `<style>@font-face { font-family: 'Lost'; src: url(../brand/lost.woff2); }</style>${body}`;
  const missing = await render(write(docs, pageDiagram(lost, '', 'width=300')), out);
  check(/warning: font-missing: font=Lost 400 file=\.\.\/brand\/lost\.woff2/.test(missing.text),
    `a missing font file is not reported: ${tail(missing.text)}`);
}

const ONE_COLOUR = '<svg viewBox="0 0 24 24"><style>.a{fill:#1d1d1b}</style><path class="a" d="M2 2h20v20H2z"/></svg>';
const STROKED = '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M4 12h16"/></svg>';
const TWO_COLOURS = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#ff8a3d"/>'
  + '<path d="M2 8 5 2l3 6z" fill="#0d2137"/></svg>';
const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="pin" viewBox="0 0 24 24">'
  + '<path d="M12 2 4 22h16z"/></symbol></svg>';

// The sets as strings: names from file names, one colour to currentColor, several kept, a
// sprite's symbols, misspelt names suggested, an unknown set named.
function checkSetsAsStrings() {
  const sets = parseIconSets('acme: ../brand/icons; ph: x; Flags : f.svg');
  check(sets.length === 2 && sets[1].prefix === 'flags' && sets[1].path === 'f.svg',
    `sets misread: ${JSON.stringify(sets)}`);
  const pack = iconSetPack({ 'ShieldCheck.svg': ONE_COLOUR, 'line_arrow.svg': STROKED, 'logo.svg': TWO_COLOURS });
  check(Object.keys(pack).join() === 'shield-check,line-arrow,logo', `names misread: ${Object.keys(pack)}`);
  check(/currentColor/.test(pack['shield-check'].body) && !/1d1d1b/.test(pack['shield-check'].body),
    `a one-colour icon keeps its colour: ${pack['shield-check'].body}`);
  check(/<g fill="none" stroke="currentColor" stroke-width="2">/.test(pack['line-arrow'].body),
    `a stroked icon loses its root paint: ${pack['line-arrow'].body}`);
  check(/#ff8a3d/.test(pack.logo.body) && /#0d2137/.test(pack.logo.body), 'a two-colour icon loses its colours');
  check(/^<svg viewBox="0 0 24 24"><path/.test(spriteFiles(SPRITE).pin || ''), 'a sprite symbol is not read');
  registerPack('acme', pack);
  check(resolveIcon('acme:sheild-chek').suggestions?.[0] === 'acme:shield-check', 'a misspelt name is not suggested');
  check(/no icon set "nope"/.test(resolveIcon('nope:x').hint || ''), 'an unknown set is not named');
  check(typeOf('a/b.woff2?v=1')?.format === 'woff2' && !typeOf('x.eot'), 'font types misread');
  check(facesFor('Barlow:400,700', 'Zażółć').length === 4, 'a Polish text does not add the Latin Extended faces');
}

const ICONS = '<style>icon { width: 24px; height: 24px; color: #0b3d2e }</style><div class="flex gap-4">'
  + '<icon name="acme:shield-check"></icon><icon name="acme:line-arrow"></icon><icon name="acme:logo"></icon>'
  + '<icon name="flags:pin"></icon><icon name="ph:rocket-launch"></icon></div>';

// A folder (a subfolder included) and a sprite outside the diagram's folder, and a line icon.
export async function pageIconSets() {
  checkSetsAsStrings();
  const { brand, docs, out } = brandAndDocs('page-icon-sets');
  fs.writeFileSync(path.join(brand, 'icons/ShieldCheck.svg'), ONE_COLOUR);
  fs.writeFileSync(path.join(brand, 'icons/more/line_arrow.svg'), STROKED);
  fs.writeFileSync(path.join(brand, 'icons/logo.svg'), TWO_COLOURS);
  fs.writeFileSync(path.join(brand, 'flags.svg'), SPRITE);
  const sets = 'width=300 icon-sets="acme: ../brand/icons; flags: ../brand/flags.svg"';
  checkSucceeded(await render(write(docs, pageDiagram(ICONS, '', sets)), out));
  const svg = svgOf(out);
  for (const id of ['acme-shield-check', 'acme-line-arrow', 'acme-logo', 'flags-pin', 'ph-rocket-launch']) {
    check(new RegExp(`<symbol id="[\\w-]*${id}"[^>]*><g`).test(svg), `the icon ${id} is not drawn`);
  }
}

const TIGHT = '<style>.big { font-size: 56px; line-height: 58px } .lab { font-size: 13px; line-height: 16px }</style>'
  + '<div class=big>4,812</div><div class=lab>changes released</div>';
const COVERED = '<style>.k { position: relative; height: 120px } .big { font-size: 80px; line-height: 1.2 } '
  + '.lab { position: absolute; left: 60px; top: 50px }</style>'
  + '<div class=k><div class=big>62%</div><div class=lab>use AI coding assistants every day</div></div>';

// Display type set tight is not text on text; a label laid over a numeral is, named by its words.
export async function pageTextOverlap() {
  const dir = folder('page-text-overlap'), out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(TIGHT, '', 'width=400')), out));
  const covered = await render(write(dir, pageDiagram(COVERED, '', 'width=400')), out);
  check(/text-overlap: a=div\.big b=div\.lab texts="62%" \/ "use AI coding assistants ev…"/.test(covered.text),
    `a label over a numeral is not reported by its words: ${tail(covered.text)}`);
}

const OWN_COLOURS = '<style>:root { --brand: #ff0000 } .w { height: 20px; background: var(--brand) } '
  + '.s { --line-two: #00aa55 }</style><div class=w id=w></div><div class=s><div class=h-5></div></div>';

// Custom properties of the diagram's own: set on :root they reach its elements, and the drawing
// script's colours read them where they are set.
export async function pageOwnColours() {
  const dir = folder('page-own-colours'), out = path.join(dir, 'out');
  const rule = "draw.moveTo(el('w').left).lineTo(el('w').right).style({ color: 'var(--line-two)' });";
  checkSucceeded(await render(write(dir, pageDiagram(OWN_COLOURS, rule, 'width=300')), out));
  const svg = svgOf(out);
  check(/fill: rgb\(255, 0, 0\)/.test(svg), 'a custom property set on :root does not reach the page');
  check(/stroke: rgb\(0, 170, 85\)/.test(svg), 'a script colour does not read a custom property');
}

const LABELLED = '<style>:root { --line-label-font: 700 18px serif; --line-label-color: #ff0000 } '
  + '.r { display: flex; justify-content: space-between; padding: 30px }</style>'
  + '<div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>'
  + '<script type="application/json">[["a", "b", "writes"]]</script>';

// The lines' labels in a style of the author's own: drawn in it, and placed clear of the line by
// their own height.
export async function pageLineLabels() {
  const dir = folder('page-line-labels'), out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(LABELLED, '', 'width=500')), out));
  const label = /<text class="g-edge"[^>]*y="([\d.]+)" style="font: 700 18px serif; fill: #ff0000/.exec(svgOf(out));
  const line = /<g data-edge="[^"]*"[^>]*><path d="M[\d.]+,([\d.]+) L/.exec(svgOf(out));
  check(label, 'a label does not take --line-label-font and --line-label-color');
  check(label && line && Number(line[1]) - Number(label[1]) >= 6, 'a label in a larger font sits on its line');
}

const THICK = '<style>.r { display: flex; justify-content: space-between; padding: 40px }</style>'
  + '<div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>'
  + '<script type="application/json">[{ "from": "a", "to": "b", "width": 6 }]</script>';
const CURVE = "draw.moveTo(pt(60, 150)).bezierCurveTo(pt(120, 150), pt(200, 200), pt(260, 200))"
  + ".style({ width: 6, head: 'arrow' });";

// A thick line ends in a head as wide as it and a thin line's wings, stops just inside it, and a
// curve reaches its head straight. Connections drawn alike in different widths are a warning.
export async function pageThickLines() {
  const dir = folder('page-thick-lines'), out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(THICK, CURVE, 'width=400')), out));
  const svg = svgOf(out);
  check(/<marker [^>]*refX="4.81"[^>]*markerWidth="13.5" markerHeight="13.5"/.test(svg),
    'a thick line\'s head is not the line\'s width and its wings');
  const routed = /<g data-edge="a-&gt;b"[^>]*><path d="M[\d.]+,[\d.]+ L([\d.]+),/.exec(svg);
  const boxB = /<g data-id="b" data-box="([\d.]+),/.exec(svg);
  check(routed && boxB && Number(boxB[1]) - Number(routed[1]) >= 6,
    'a thick connection runs under its head to the tip');
  check(/ 24[0-9](\.\d)?,200 L253,200"/.test(svg), 'a thick drawn curve does not reach its head straight');
  const uneven = THICK.replace('"width": 6 }', '"width": 2.5 }, ["b", "a"]');
  const widths = await render(write(dir, pageDiagram(uneven, '', 'width=400')), out);
  check(/warning: line-widths: widths=(2\.5,1\.5|1\.5,2\.5)/.test(widths.text),
    `connections drawn alike in two widths are not reported: ${tail(widths.text)}`);
}

const HOUSE = '<style>:root { --line-label-font: 700 16px serif } '
  + '.panel { background: #00ff00; padding: 12px }</style>';
const STYLED = '<include src="../style/house.html"></include><div class="flex gap-24 p-4">'
  + '<div class=panel id=a>A</div><div class=panel id=b>B</div></div>'
  + '<script type="application/json">[["a", "b", "shared"]]</script>';

// A house style shared by diagrams in other folders: a part beside them, included by a path that
// leaves the diagram's folder. A part that is not there is reported.
export async function pageSharedStyle() {
  const { brand, docs, out } = brandAndDocs('page-shared-style');
  fs.mkdirSync(path.join(brand, '..', 'style'), { recursive: true });
  fs.writeFileSync(path.join(brand, '..', 'style', 'house.html'), HOUSE);
  checkSucceeded(await render(write(docs, pageDiagram(STYLED, '', 'width=400')), out));
  const svg = svgOf(out);
  check(/fill: rgb\(0, 255, 0\)/.test(svg) && /class="g-edge"[^>]*font: 700 16px serif/.test(svg),
    'a house style included from another folder does not apply');
  const lost = await render(write(docs, pageDiagram(STYLED.replace('house.html', 'gone.html'), '', 'width=400')), out);
  check(/part-missing: src=\.\.\/style\/gone\.html/.test(lost.text),
    `a missing part is not reported: ${tail(lost.text)}`);
}

// A class of the author's own that a building block also styles, a full circle, a fade from nothing.
export async function pageInfographicMarks() {
  const dir = folder('page-infographic-marks'), out = path.join(dir, 'out');
  const body = '<style>.num { color: #c00 } .fade { width: 80px; height: 20px; '
    + 'background: linear-gradient(90deg, transparent, #ff0000) }</style>'
    + '<div class="flex gap-4"><span class=num>1</span><div class=fade id=f></div>'
    + '<div id=c class="w-16 h-16"></div></div>';
  const circle = "draw.arc(el('c').center, 20, 0, 360);";
  const result = await render(write(dir, pageDiagram(body, circle, 'width=400')), out);
  check(/warning: class-taken: class=num keeps=/.test(result.text),
    `a taken class is not reported: ${tail(result.text)}`);
  const svg = svgOf(out);
  check(/d="M[^"]*A[^"]*A[^"]*"/.test(svg), 'a full circle from draw.arc is not drawn');
  check(/<stop offset="0" stop-color="rgb\(255, 0, 0\)" stop-opacity="0">/.test(svg),
    'a transparent stop is not given its neighbour\'s colour');
}
