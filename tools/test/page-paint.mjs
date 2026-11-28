// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// How a page's CSS is painted: gradients, shadows and outlines, images, and the utility
// classes that place them.
import fs from 'node:fs';
import path from 'node:path';
import {
  check, checkSucceeded, folder, longPattern, nodeRect, pageDiagram, render, renderedSvg, tail, write,
} from './helpers.mjs';

const PAINT_CSS = [
  '<style>',
  '    .g { width: 80px; height: 30px; background: linear-gradient(90deg, #ff0000, #0000ff); }',
  '    .s { width: 80px; height: 30px; background: #fff; ' +
    'box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 0 3px #00ff00; border-radius: 6px; }',
  '    .o { width: 80px; height: 30px; outline: 2px solid #ff00ff; outline-offset: 2px; }',
  '    .p::before { content: ""; display: block; width: 10px; height: 10px; background: #00ffff; }',
  '    .n::before { content: "#" attr(data-n); }',
  '    .t { width: 60px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
  '    .r { width: 10px; height: 10px; background: #123456; transform: rotate(45deg); }',
  '  </style>',
].join('\n');
const PAINTED = '<div class="flex gap-6 items-center"><div class=g></div><div class=s></div><div class=o></div>' +
  '<div class=p>x</div><div class=t>a long name that does not fit</div>' +
  '<div class=r></div><div class=n data-n=7></div></div>';
const GRADIENT = longPattern(
  String.raw`<linearGradient id="[^"]+" gradientUnits="userSpaceOnUse"[^>]*>`,
  String.raw`<stop offset="0" stop-color="rgb\(255, 0, 0\)"><\/stop><stop offset="1" stop-color="rgb\(0, 0, 255\)">`,
);
const UPRIGHT_LABEL = '<div class="flex"><div style="width: 20px; position: relative">' +
  '<span style="position: absolute; left: -60px; top: 60px; width: 140px; rotate: -90deg">Systems lane</span></div>' +
  '<div id=w style="flex: 1; height: 140px"></div></div>';

function checkPainted(svg) {
  check(GRADIENT.test(svg) && /fill: url\(#/.test(svg), 'the gradient is not drawn');
  const blurred = /<feGaussianBlur stdDeviation="4">/.test(svg) &&
    /fill: rgb\(0, 0, 0\)" fill-opacity="0.2" filter="url\(#/.test(svg);
  check(blurred && /fill: rgb\(0, 255, 0\)"><\/rect>/.test(svg), 'the shadows are not drawn');
  check(/rx="0" style="fill: none; stroke: rgb\(255, 0, 255\)" stroke-width="2"/.test(svg), 'the outline is not drawn');
  check(/width="10" height="10"[^>]*style="fill: rgb\(0, 255, 255\)"/.test(svg), 'the ::before box is not drawn');
  check(/<clipPath id=/.test(svg) && /clip-path="url\(#/.test(svg) && />a long[^<]*…<\/text>/.test(svg),
    'the clipped text has no ellipsis');
  check(/<g transform="matrix\(0.7071 0.7071 -0.7071 0.7071 /.test(svg), 'the rotated box is not turned');
  check(/>#7<\/text>/.test(svg), 'content: attr() is not read');
}

// Component styling: gradients, shadows, outlines, ::before/::after, clipping with an ellipsis,
// and turns are drawn, not dropped.
export async function pageCssPaint() {
  const dir = folder('page-css-paint');
  const out = path.join(dir, 'out');
  checkPainted(await renderedSvg(dir, out, pageDiagram(`${PAINT_CSS}${PAINTED}`, '', 'width=500')));
  // A plain rule drawn edge to edge, and a label turned upright in a narrow column, stay inside the page.
  const rule = "draw.moveTo(el('w').left).lineTo(el('w').right).style({ dashed: true });";
  checkSucceeded(await render(write(dir, pageDiagram(UPRIGHT_LABEL, rule, 'width=300')), out));
}

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10">' +
  '<rect width="30" height="10" fill="#123"/></svg>';
const HEADER = '<div class="flex items-center gap-8"><img src="logo.svg" style="height: 20px">' +
  '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>' +
  '<b>Title</b></div>';

// A logo in a header: an <img> goes into the SVG as a data: URL, an inline <svg> as it is.
export async function pageImages() {
  const dir = folder('page-images');
  const out = path.join(dir, 'out');
  fs.writeFileSync(path.join(dir, 'logo.svg'), LOGO);
  const svg = await renderedSvg(dir, out, pageDiagram(HEADER, '', 'width=300'));
  check(/<image href="data:image\/svg\+xml;base64,[^"]+" x="[\d.]+" y="[\d.]+" width="60" height="20"/.test(svg),
    `the logo is not embedded at its size: ${(svg.match(/<image[^>]{0,80}/) || ['none'])[0]}`);
  check(/<svg x="[\d.]+" y="[\d.]+" width="16" height="16"[^>]*viewBox="0 0 16 16"[^>]*><circle/.test(svg),
    'the inline svg is not drawn');
  const noImage = pageDiagram('<img src="nothing.png" style="width: 20px">', '', 'width=300');
  const missing = await render(write(dir, noImage), out);
  check(/image-missing: src=nothing\.png/.test(missing.text), `a missing image is not reported: ${tail(missing.text)}`);
}

const UTILITIES = [
  '<style>.wobble { color: red }</style>',
  '<div class="flex justify-center gap-6 p-4"><div class=card id=a>A</div><div class=card id=b>B</div>' +
    '<div class=card id=c>C</div></div>',
  '<div class="grid grid-cols-[100px_1fr_100px] gap-x-[20px] mt-10"><div class="card col-start-3" id=r>R</div>' +
    '<div class="card col-span-full mx-auto w-40" id=w>W</div></div>',
  '<p class="wobble text-muted">note</p>',
].join('\n');

function checkPlaced(svgFile) {
  const [first, second, third] = ['a', 'b', 'c'].map(nodeId => nodeRect(svgFile, nodeId));
  // The content box is 700px wide and starts 24px in, so its middle is at 374.
  const middle = (first[0] + third[0] + third[2]) / 2;
  check(Math.abs(middle - 374) < 1, `justify-center: the row's middle is at ${middle}, not 374`);
  check(Math.abs(second[0] - first[0] - first[2] - 24) < 0.5,
    `gap-6: ${second[0] - first[0] - first[2]}px between the boxes, not 24`);
  const right = nodeRect(svgFile, 'r');
  const wide = nodeRect(svgFile, 'w');
  check(Math.abs(right[0] - (724 - 100)) < 1 && Math.abs(right[2] - 100) < 1, `col-start-3 in a 100px track: ${right}`);
  check(Math.abs(wide[2] - 160) < 0.5 && Math.abs(wide[0] + wide[2] / 2 - 374) < 1, `w-40 mx-auto: ${wide}`);
  check(right[1] - (first[1] + first[3]) > 40 + 16 - 1,
    `mt-10 and p-4: ${right[1] - (first[1] + first[3])}px below the row`);
}

export async function pageUtilities() {
  const dir = folder('page-utilities');
  const out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(UTILITIES, '')), out));
  checkPlaced(path.join(out, 'diagram.svg'));
  // A class that reads like a utility and means nothing is reported; the author's own is not.
  const unknown = pageDiagram('<div class="flex bg-blue-500 md:flex jusitfy-center wobble">x</div>', '');
  const bad = await render(write(dir, unknown), out);
  check(bad.code === 1 && /unknown-utility: class=bg-blue-500/.test(bad.text) && /class=md:flex/.test(bad.text),
    `expected unknown-utility: ${tail(bad.text)}`);
  check(!/wobble/.test(bad.text), 'an author class was reported as a utility');
}

// Text set on its side (a BPMN pool's name) is one <text> turned a quarter round about its box's
// centre, upward for sideways-lr; the diagram's title takes the family the page sets on :root.
export async function pageText() {
  const dir = folder('page-text');
  const out = path.join(dir, 'out');
  const body = '<style>:root { font-family: Georgia, serif } .pool { writing-mode: sideways-lr; height: 160px; }' +
    ' .down { writing-mode: vertical-rl; height: 120px; }</style>' +
    '<div class="flex gap-10"><div class=pool>Northwind Insurance</div><div class=down>Down the side</div></div>';
  const svg = await renderedSvg(dir, out, pageDiagram(body, '', 'width=500 title="Claims process"'));
  const pool = svg.match(/<text [^>]*>Northwind Insurance<\/text>/)?.[0] || '';
  const down = svg.match(/<text [^>]*>Down the side<\/text>/)?.[0] || '';
  check(/text-anchor="middle"/.test(pool) && /transform="rotate\(-90 [\d.]+ [\d.]+\)"/.test(pool),
    `sideways-lr text is not one upward text: ${pool}`);
  check(/transform="rotate\(90 /.test(down), `vertical-rl text is not one downward text: ${down}`);
  check(/<text [^>]*font-family: Georgia, serif[^>]*>Claims process</.test(svg),
    'the title did not take the page\'s font family');
}
