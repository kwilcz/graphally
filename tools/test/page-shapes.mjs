// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// How the parts of a page are drawn: shapes, their BPMN markers and their colours.
import path from 'node:path';
import { check, checkReported, countOf, folder, pageDiagram, render, renderedSvg, write } from './helpers.mjs';

// The SVG of one part: from its data-id to the first closing </g> after it.
function partOf(svg, partId) {
  const after = svg.split(`data-id="${partId}"`)[1] || '';
  return after.split('</g>')[0];
}

// The d of every path in an SVG fragment, in order.
function pathsOf(fragment) {
  return [...fragment.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
}

const SHAPES = [
  'cylinder', 'document', 'note', 'cloud', 'hexagon', 'chevron', 'task loop', 'gateway parallel', 'event timer',
  'end message', 'start', 'semicircle',
];

// Returns the SVG, whose semicircle is checked at the end.
async function checkShapesDrawn(dir, out) {
  const body = SHAPES.map((shape, i) => `<div shape="${shape}" id=s${i}></div>`).join('\n');
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  check([...SHAPES.keys()].every(i => svg.includes(`data-id="s${i}"`)), 'a shape is missing from the SVG');
  return svg;
}

// A borderless figure stays borderless when external or accented: its text changes colour.
async function checkFigureTints(dir, out) {
  const body = '<div class="figure external" id=fx><icon name=user></icon>Outside</div>' +
    '<div class="figure accent" id=fa><icon name=user></icon>Main</div>';
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const framed = /data-id="f[xa]"[^>]*>\s*<(rect|path|polygon)/.test(svg);
  check(!framed && /fill: var\(--muted\)">Outside/.test(svg) && /fill: var\(--woad\)">Main/.test(svg),
    'an external or accented figure got a frame, or kept its colour');
}

// color-mix() and the newer colour spaces reach the SVG as rgb(), which every reader knows.
async function checkComputedColours(dir, out) {
  const style = 'background: color-mix(in srgb, var(--woad) 15%, transparent); ' +
    'border: 2px solid color-mix(in oklab, var(--woad), var(--rust)); color: oklch(0.5 0.1 30)';
  const svg = await renderedSvg(dir, out, pageDiagram(`<div id=m style="${style}">mixed</div>`));
  check(!/color\(|oklab\(|oklch\(|\blab\(/.test(svg) && /fill: rgba\(\d+, \d+, \d+, 0\.15\)/.test(svg),
    'a computed colour reached the SVG in a form SVG readers do not know');
}

// A script's mix of theme tokens stays as written (it follows the dark theme); it is never black.
async function checkScriptTokens(dir, out) {
  const script = "shape('circle', el('m').center, { size: 30, fill: 'color-mix(in srgb, var(--woad) 30%, white)' })";
  const svg = await renderedSvg(dir, out, pageDiagram('<div class=card id=m>A</div>', script));
  check(svg.includes('fill: color-mix(in srgb, var(--woad) 30%, white)') && !svg.includes('rgb(0, 0, 0)'),
    'a script fill mixed from theme tokens was lost');
}

const DISABLED = '<div class="flex gap-24"><div class=figure id=a><icon name="functions"></icon>On</div>' +
  '<div class="figure disabled" id=b><icon name="functions"></icon>Off</div></div>' +
  '<script type="application/json">[["a", "b", "polled"]]</script>';

// disabled: the part, icon included, is drawn grey and faded; a line into it is grey and dashed.
async function checkDisabled(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(DISABLED, '', 'width=500'));
  const aroundB = svg.slice(svg.indexOf('data-id="b"') - 80);
  const greyAndFaded = /<filter id="[^"]+-grey"/.test(svg) &&
    /<g opacity="0.5" filter="url\(#[^"]+-grey\)">\s*<g data-id="b"/.test(svg) &&
    !/filter="url[^>]*>\s*<g data-id="a"/.test(svg);
  check(greyAndFaded, `the disabled figure is not drawn grey and faded: ${aroundB.slice(0, 160)}`);
  check(/data-edge="a-&gt;b"[^>]*><path [^>]*stroke: var\(--muted\)"[^>]*stroke-dasharray="5 4"/.test(svg),
    'the line into the disabled figure is not grey and dashed');
}

const GATEWAYS = [
  'gateway event-based', 'gateway event-based start', 'gateway event-based parallel', 'gateway complex',
];

// The gateways BPMN 2.0 adds to these: event-based (a pentagon in a double circle; a single
// circle when it starts the process; an open cross for the parallel one) and complex (✱).
async function checkGateways(dir, out) {
  const body = GATEWAYS.map((gateway, i) => `<i shape="${gateway}" id=g${i}></i>`).join('\n');
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const marks = [...GATEWAYS.keys()].map(i => countOf(partOf(svg, `g${i}`), /<path /g));
  check(marks.join() === '4,3,3,2', `the gateway markers drew ${marks.join(', ')} paths, not 4, 3, 3, 2`);
}

const TASK_TYPES = ['user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule'];

// A task's type: a glyph in its top-left corner, drawn with a set number of paths.
async function checkTaskTypes(dir, out) {
  const body = TASK_TYPES.map((type, i) => `<div shape="task ${type}" id=t${i}>Task</div>`).join('\n');
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const drawn = [...TASK_TYPES.keys()].map(i => countOf(partOf(svg, `t${i}`), /<path /g));
  check(drawn.join() === '3,3,3,3,3,3,4', `the task types drew ${drawn.join(', ')} paths, not 3, 3, 3, 3, 3, 3, 4`);
}

const EVENTS = '<i shape="event escalation" id=e0></i><i shape="event escalation throw" id=e1></i>' +
  '<i shape="event timer non-interrupting" id=e2></i><i shape="start parallel-multiple" id=e3></i>';

// Events (BPMN 2.0.2, Table 10.93): a throwing marker is filled, a catching one open, and a
// non-interrupting event's rings are dashed.
async function checkEvents(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(EVENTS));
  const [catching, throwing, nonInterrupting, parallelMultiple] = [0, 1, 2, 3].map(i => partOf(svg, `e${i}`));
  const catchingOpen = /style="fill: none; stroke: [^"]+"[^>]*><\/path>\s*$/.test(catching.trim());
  check(catchingOpen && !/fill: none; stroke/.test(throwing.split('<path').pop()),
    'a throwing marker is not filled, or a catching one is');
  check(countOf(nonInterrupting, /stroke-dasharray/g) === 2,
    `a non-interrupting event's rings are not both dashed: ${nonInterrupting.slice(0, 200)}`);
  check(countOf(parallelMultiple, /<path /g) === 2, 'the parallel-multiple trigger is missing');
}

// Multi-instance: upright bars in parallel, flat ones in sequence.
async function checkMultiInstance(dir, out) {
  const body = '<div shape="task multi" id=m0>A</div><div shape="task sequential" id=m1>B</div>';
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const parallel = pathsOf(partOf(svg, 'm0')).at(-1) || '';
  const sequential = pathsOf(partOf(svg, 'm1')).at(-1) || '';
  const upright = countOf(parallel, / V/g) === 3 && !/ H/.test(parallel);
  check(upright && countOf(sequential, / H/g) === 3 && !/ V/.test(sequential),
    'the multi-instance bars point the wrong way');
}

// How far below its last line of text a part's box ends.
function clearance(part) {
  const [, y, , h] = (/data-box="([^"]+)"/.exec(part)?.[1] || '0,0,0,0').split(',').map(Number);
  const textTops = [...part.matchAll(/<text x="[^"]+" y="([\d.]+)"/g)].map(match => Number(match[1]));
  return y + h - Math.max(...textTops);
}

const WRAPPED = '<div class="flex gap-24 items-start">' +
  '<div shape="task multi" id=w0 style="width: 90px">Notify the reviewers</div>' +
  '<div shape="task loop" id=w1 style="width: 90px">Retry the call again</div></div>';

// A label clears the marker at the bottom of its activity, two lines long or not.
async function checkLabelClearance(dir) {
  const out = path.join(dir, 'out-wrap');
  const svg = await renderedSvg(dir, out, pageDiagram(WRAPPED, '', 'width=400'), ['--recompute']);
  const multi = partOf(svg, 'w0');
  const loop = partOf(svg, 'w1');
  check(clearance(multi) > 20 && clearance(loop) > 20,
    `a label runs into its activity's marker: ${clearance(multi)}, ${clearance(loop)} px below the text`);
}

const FLOWS = '<div class="flex gap-24"><div class=card id=a>A</div><div class=card id=b>B</div>' +
  '<div class=card id=c>C</div></div><script type="application/json">' +
  '[{ "from": "a", "to": "b", "default": true }, { "from": "b", "to": "c", "conditional": true }]</script>';

// A BPMN default flow starts with a slash, a conditional one with an open diamond.
async function checkFlowMarkers(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(FLOWS, '', 'width=500'));
  const slash = /<marker [^>]*><path d="M0\.8,8\.8 L6\.8,1\.2"/.test(svg);
  const diamond = /<marker [^>]*><path d="M0\.6,5 L5,1\.9/.test(svg);
  check(slash && diamond && countOf(svg, /marker-start=/g) === 2,
    'a default flow lacks its slash, or a conditional one its diamond');
}

const VARIANTS = '<div shape="subprocess transaction" id=v0>T</div><div shape="subprocess ad-hoc" id=v1>A</div>' +
  '<div shape="task compensation" id=v2>C</div>';

// A transaction has a double border; ad-hoc and compensation mark the bottom of an activity.
async function checkActivityVariants(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(VARIANTS));
  const [transaction, adHoc, compensation] = [0, 1, 2].map(i => pathsOf(partOf(svg, `v${i}`)));
  const doubleBorder = transaction.filter(pathData => countOf(pathData, /Q/g) === 4).length === 2;
  const tilde = adHoc.some(pathData => /C1\.5,9\.5|^M1\.5,9\.5 C/.test(pathData));
  const backArrows = compensation.some(pathData => /M1\.52,8 L7\.62,3\.81/.test(pathData));
  check(doubleBorder && tilde && backArrows,
    `activity variants: ${transaction.length}, ${adHoc.length}, ${compensation.length} paths`);
}

// Artifacts: an annotation is an open, unfilled bracket; a group is drawn dash-dot.
async function checkArtifacts(dir, out) {
  const body = '<div shape=annotation id=r0>A note</div><div shape=group id=r1><div class=card id=r2>X</div></div>';
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const openBracket = /<path d="M[^"Z]+" style="fill: none;/.test(partOf(svg, 'r0'));
  check(openBracket && /stroke-dasharray="9 3 1\.5 3"/.test(partOf(svg, 'r1')),
    'an annotation is not an open bracket, or a group is not dash-dot');
}

// Data objects: an input's arrow is open, an output's filled; a collection has three bars.
async function checkDataObjects(dir, out) {
  const body = '<div shape="data-object input" id=o0></div><div shape="data-object output" id=o1></div>' +
    '<div shape="data-object collection" id=o2></div>';
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  const openArrow = /d="M2,5\.5 H8\.5[^"]*"[^>]*style="fill: none/.test(partOf(svg, 'o0'));
  const filledArrow = /d="M2,5\.5 H8\.5[^"]*"[^>]*style="fill: (?!none)/.test(partOf(svg, 'o1'));
  check(openArrow && filledArrow && countOf(partOf(svg, 'o2'), / V/g) >= 3,
    'a data object lacks its arrow or its collection bars');
}

// A semicircle is one arc over a flat base.
function checkSemicircle(svg) {
  const half = svg.match(/data-id="s11"[^>]*>\s*<path d="([^"]+)"/);
  check(half && countOf(half[1], /A/g) === 1 && /Z$/.test(half[1].trim()), `semicircle drawn as ${half?.[1]}`);
}

async function checkUnknownShape(dir, out) {
  const result = await render(write(dir, pageDiagram('<div shape=cylindr>x</div>')), out);
  checkReported(result, /unknown-shape: shape=cylindr suggest=cylinder/, 'unknown-shape with a suggestion');
}

export async function pageShapes() {
  const dir = folder('page-shapes');
  const out = path.join(dir, 'out');
  const shapesSvg = await checkShapesDrawn(dir, out);
  await checkFigureTints(dir, out);
  await checkComputedColours(dir, out);
  await checkScriptTokens(dir, out);
  await checkDisabled(dir, out);
  await checkGateways(dir, out);
  await checkTaskTypes(dir, out);
  await checkEvents(dir, out);
  await checkMultiInstance(dir, out);
  await checkLabelClearance(dir);
  await checkFlowMarkers(dir, out);
  await checkActivityVariants(dir, out);
  await checkArtifacts(dir, out);
  await checkDataObjects(dir, out);
  checkSemicircle(shapesSvg);
  await checkUnknownShape(dir, out);
}
