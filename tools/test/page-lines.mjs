// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Lines on a page: how far a drawing reaches, script errors, routing and bundled lines.
import path from 'node:path';
import { readLayout } from '../../skills/graphally/scripts/lib/snapshot.mjs';
import {
  CARD_A, check, checkReported, checkSucceeded, countOf, edgePath, folder, nodeRect, pageDiagram, pointsOf, render,
  renderedSvg, svgOf, twoGroups, write,
} from './helpers.mjs';

// The figure's width and height, from its viewBox.
function figureSize(out) {
  return svgOf(out).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
}

// The figure grows to hold what the script draws below the page. Returns the box drawn from.
async function checkDrawingBelow(dir, out) {
  const script = "draw.moveTo(el('a').bottom).lineTo(el('a').bottom.down(300)).style({ width: 2 })";
  checkSucceeded(await render(write(dir, pageDiagram(CARD_A, script)), out));
  const box = nodeRect(path.join(out, 'diagram.svg'), 'a');
  check(figureSize(out)[1] >= box[1] + box[3] + 300,
    `the figure (${figureSize(out).join('x')}) cuts off the drawing below`);
  return box;
}

// Beside the page too, and a drawing wider than the page is reported like wide content.
async function checkDrawingBeside(dir, out, box) {
  const wide = await render(write(dir, pageDiagram(CARD_A, "arrow(el('a').right, el('a').right.right(900))")), out);
  checkReported(wide, /page-overflow/, 'page-overflow');
  check(figureSize(out)[0] >= box[0] + box[2] + 900,
    `the figure (${figureSize(out).join('x')}) cuts off the drawing beside it`);
}

// Underline and line-through are drawn, from the text's element or one around it.
async function checkTextDecoration(dir, out) {
  const body = '<p class="line-through" id=a>gone <b>too</b></p><p class=underline>kept</p>';
  const svg = await renderedSvg(dir, out, pageDiagram(body));
  check(countOf(svg, /text-decoration: line-through/g) === 2 && /text-decoration: underline/.test(svg),
    'text decoration is not drawn');
}

export async function pageDrawingReach() {
  const dir = folder('page-drawing-reach');
  const out = path.join(dir, 'out');
  const box = await checkDrawingBelow(dir, out);
  await checkDrawingBeside(dir, out, box);
  await checkTextDecoration(dir, out);
}

export async function pageScriptErrors() {
  const dir = folder('page-script');
  const out = path.join(dir, 'out');
  const body = '<div class=card id=a>A</div><div class=card id=b>B</div>';
  const missing = await render(write(dir, pageDiagram(body, "arrow('a', 'b')\narrow('nope', 'b')")), out);
  checkReported(missing, /script-error: message=no element "nope" line=3/, 'a script error for "nope" on line 3');
  const notPoint = await render(write(dir, pageDiagram(body, "arrow({ x: 3 }, 'b')")), out);
  checkReported(notPoint, /is not an element or a point line=2/, 'a script error for a non-point on line 2');
}

// How many bends a routed line makes: each is drawn as a Q curve.
function corners(pathData) {
  return countOf(pathData, /Q/g);
}

const LANE_BACKGROUND = [
  '<style>.l { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 60px } ' +
    '.bg { grid-column: 1 / -1; grid-row: 1; background: var(--wash) } .t { grid-row: 1; margin: 30px 0 }</style>',
  '<div class=l><div class=bg></div><div class="card t" id=a style="grid-column: 1">A</div>' +
    '<div class="card t" id=b style="grid-column: 3">B</div></div>',
].join('\n');
const POOL = [
  '<style>.pool { display: grid; grid-template-columns: 90px 1fr 1fr; border: 1px solid var(--line) } ' +
    '.lane { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; ' +
    'padding: 36px 0; border-bottom: 1px solid var(--line) } .lane > h4 { grid-column: 1 } ' +
    '.t { margin-right: 16px }</style>',
  '<div class=pool><div class=lane><h4>One</h4><div class="card t" id=a style="grid-column: 3">A</div></div>' +
    '<div class=lane><h4>Two</h4><div class="card t" id=m style="grid-column: 2">M</div></div>' +
    '<div class=lane><h4>Three</h4><div class="card t" id=b style="grid-column: 3">B</div></div></div>',
].join('\n');
// Three boxes in a column on the left, and a tall one on the right beside all three.
const THREE_AND_TALL = [
  '<style>.g { display: grid; grid-template-columns: 160px 1fr 160px; gap: 30px 120px } ' +
    '.tall { grid-column: 3; grid-row: 1 / span 3 }</style>',
  '<div class=g><div class=card id=a style="grid-row: 1">A</div><div class=card id=b style="grid-row: 2">B</div>' +
    '<div class=card id=c style="grid-row: 3">C</div><div class="card tall" id=t>T</div></div>',
].join('\n');
const APART = '<style>.r { display: flex; gap: 200px; padding-bottom: 120px }</style>' +
  '<div class=r><div class=card id=a>A</div><div class=card id=b>B</div></div>';

// A lane's background, laid in the same grid cells, does not wall in the tasks on it.
async function checkLaneBackground(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(LANE_BACKGROUND, "connect('a', 'b')"));
  check(corners(edgePath(svg, 'a->b')) === 0, 'the line from a to b bends round the lane background');
}

// A line between two lanes runs straight over the lane between them, not round the pool.
async function checkAcrossLanes() {
  const lanes = folder('page-lanes');
  const svg = await renderedSvg(lanes, path.join(lanes, 'out'), pageDiagram(POOL, "connect('a', 'b')"));
  check(corners(edgePath(svg, 'a->b')) === 0, 'the line from lane One to lane Three goes round lane Two');
}

// Lines that share a side and face their other ends across it meet it straight across from
// them: three lines into t's left side, each at its box's middle, with no bend.
async function checkSharedSide(dir, out) {
  const script = "connect('a', 't'); connect('b', 't'); connect('c', 't')";
  const svg = await renderedSvg(dir, out, pageDiagram(THREE_AND_TALL, script));
  const file = path.join(out, 'diagram.svg');
  const ends = ['a', 'b', 'c'].map(from => pointsOf(edgePath(svg, `${from}->t`)).at(-1).y);
  const want = ['a', 'b', 'c'].map(from => { const box = nodeRect(file, from); return box[1] + box[3] / 2; });
  const bent = ['a', 'b', 'c'].filter(from => corners(edgePath(svg, `${from}->t`)) > 0);
  check(ends.every((y, i) => Math.abs(y - want[i]) < 1.5) && !bent.length, `lines into t at ` +
    `${ends.map(Math.round)}, not straight across from a, b and c (${want.map(Math.round)})`);
}

// Lines whose other ends do not lie across from the side split it evenly: two lines from
// boxes below t into its left side at a third and two thirds of its height, in order.
async function checkSpreadSide(dir, out) {
  const page = '<style>.g { display: grid; grid-template-columns: 160px 160px 160px; gap: 80px 60px } ' +
    '.t { grid-column: 3; grid-row: 1; height: 120px }</style><div class=g><div class="card t" id=t>T</div>' +
    '<div class=card id=a style="grid-row: 2; grid-column: 1">A</div>' +
    '<div class=card id=b style="grid-row: 2; grid-column: 2">B</div></div>';
  const script = "connect('a', 't', { in: 'left' }); connect('b', 't', { in: 'left' })";
  const svg = await renderedSvg(dir, out, pageDiagram(page, script));
  const tall = nodeRect(path.join(out, 'diagram.svg'), 't');
  const ends = ['a', 'b'].map(from => pointsOf(edgePath(svg, `${from}->t`)).at(-1).y).sort((x, y) => x - y);
  const want = [1, 2].map(third => tall[1] + tall[3] * third / 3);
  check(ends.every((y, i) => Math.abs(y - want[i]) < 1.5), `lines into t at ${ends.map(Math.round)}, ` +
    `not at a third and two thirds (${want.map(Math.round)})`);
}

// A via line passes through its waypoint, far below the straight path.
async function checkVia(dir, out) {
  const script = "connect('a', 'b', { via: [mid(el('a').bottom, el('b').bottom).down(80)] })";
  const svg = await renderedSvg(dir, out, pageDiagram(APART, script));
  const lowest = Math.max(...pointsOf(edgePath(svg, 'a->b')).map(point => point.y));
  const box = readLayout(svg).nodes.a;
  check(Math.abs(lowest - (box[1] + box[3] + 80)) <= 1.5,
    `the via line's lowest point is ${lowest}, expected ${box[1] + box[3] + 80}`);
}

const CROSSING = '<style>.g { display: grid; grid-template-columns: 140px 140px; gap: 26px 110px }</style>' +
  '<div class=g><div class=card id=y style="grid-column: 2; grid-row: 1">Y</div>' +
  '<div class=card id=one style="grid-column: 1; grid-row: 2">One</div>' +
  '<div class=card id=two style="grid-column: 2; grid-row: 2">Two</div>' +
  '<div class=card id=x style="grid-column: 1; grid-row: 3">X</div></div>';

// Two lines that cross: one of them jumps the other, with one arc.
async function checkHop(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(CROSSING, "connect('one', 'two'); connect('x', 'y')"));
  const arcs = ['one->two', 'x->y'].map(key => (edgePath(svg, key).match(/ A/g) || []).length);
  check(arcs[0] + arcs[1] === 1, `expected one hop at the crossing, got ${arcs.join(' and ')}`);
}

const TALL_GAP = '<style>.c { display: grid; justify-items: start; row-gap: 420px }</style>' +
  '<div class=c><div class=card id=a>A</div><div class=card id=b>B</div></div>';

// The y of the line label whose text is given.
const labelY = (svg, text) => Number(svg.match(new RegExp(`<text[^>]*class="g-edge"[^>]*y="([\\d.]+)"[^>]*>${text}<`))[1]);

// A label near one end of a long line sits by that end, not at the line's middle; a bad end is reported.
async function checkLabelNear(dir, out) {
  const svg = await renderedSvg(dir, out, pageDiagram(TALL_GAP,
    "connect('a', 'b', { label: 'by the end', near: 'to' }); connect('a', 'b', { label: 'by the start', near: 'from' })"));
  const file = path.join(out, 'diagram.svg'), top = nodeRect(file, 'a'), bottom = nodeRect(file, 'b');
  const [start, end] = [labelY(svg, 'by the start'), labelY(svg, 'by the end')];
  check(start < top[1] + top[3] + 60 && end > bottom[1] - 60,
    `labels near their ends at y=${start} and y=${end}, between ${top[1] + top[3]} and ${bottom[1]}`);
  const bad = await render(write(dir, pageDiagram(TALL_GAP, "connect('a', 'b', { label: 'x', near: 'middle' })")), out);
  checkReported(bad, /bad-option: option=near value=middle/, 'bad-option for near');
}

export async function pageRouting() {
  const dir = folder('page-routing');
  const out = path.join(dir, 'out');
  await checkLaneBackground(dir, out);
  await checkAcrossLanes();
  await checkSharedSide(dir, out);
  await checkSpreadSide(dir, out);
  await checkLabelNear(dir, out);
  await checkVia(dir, out);
  await checkHop(dir, out);
}

// The lines given end on one shared stretch, at least 30 px long, under one "copy" label: at one
// point, each arriving the same way, so the shortest last segment is the stretch they share.
function checkMerged(svg, keys) {
  const lasts = keys.map(key => pointsOf(edgePath(svg, key)).slice(-2));
  const described = lasts.map(pair => pair.map(point => `${point.x},${point.y}`).join(' '));
  const ends = new Set(lasts.map(([, end]) => `${end.x},${end.y}`));
  const ways = new Set(lasts.map(([start, end]) => `${Math.sign(end.x - start.x)},${Math.sign(end.y - start.y)}`));
  check(ends.size === 1 && ways.size === 1, `the lines end apart: ${described.join(' | ')}`);
  const shared = Math.min(...lasts.map(([start, end]) => Math.hypot(end.x - start.x, end.y - start.y)));
  check(shared >= 30, `the shared end is ${shared} px long`);
  const pieces = svg.split('>copy</text>').length;
  check(pieces === 2, `${pieces - 1} copy labels`);
}

// Lines into one box with the same label merge into one trunk, written in one statement or
// not, and end on one long straight stretch with one label; unlabelled ones stay apart.
export async function bundles() {
  const dataDir = folder('bundles-data');
  const source = twoGroups({ line: '["a1", "b1", "copy"], ["a2", "b1", "copy"]' });
  checkMerged(await renderedSvg(dataDir, path.join(dataDir, 'out'), source, ['--recompute']), ['a1->b1', 'a2->b1']);
  const pageDir = folder('bundles-page');
  const script = "for (const k of ['a', 'b', 'c']) connect(k, 't', { label: 'copy' })";
  const svg = await renderedSvg(pageDir, path.join(pageDir, 'out'), pageDiagram(THREE_AND_TALL, script));
  checkMerged(svg, ['a->t', 'b->t', 'c->t']);
}
