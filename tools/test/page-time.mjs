// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Pages that move or lay out time: flow, steps and animation, dates and schedules written by a
// before script, sequence diagrams, and dependency lines between dated bars.
import fs from 'node:fs';
import path from 'node:path';
import { readLayout } from '../../skills/graphally/scripts/lib/snapshot.mjs';
import {
  check, checkReported, checkSucceeded, countOf, folder, longPattern, nodeRect, pageDiagram, pointsOf, render, svgOf,
  write,
} from './helpers.mjs';

// Writes source into dir and renders it, with a PNG, into dir/out.
async function renderWithPng(dir, source) {
  checkSucceeded(await render(write(dir, source), path.join(dir, 'out'), ['--png', '--recompute']));
}

function checkSamePng(moving, still, message) {
  const png = dir => fs.readFileSync(path.join(dir, 'out', 'diagram.png'));
  check(png(moving).equals(png(still)), message);
}

// Two boxes and a line; with flow, the boxes are steps 1 and 2 and the line carries flow marks.
function stepsBody(flow) {
  const step = number => (flow ? ` data-step=${number}` : '');
  const line = flow ? '{ "from": "a", "to": "b", "label": "sends", "flow": true }' : '["a", "b", "sends"]';
  return `<div class="flex gap-24"><div class=card id=a${step(1)}>A</div><div class=card id=b${step(2)}>B</div></div>` +
    `<script type="application/json">[${line}]</script>`;
}

const FLOW_DOT = longPattern(
  String.raw`<circle class="g-dot"[^>]* visibility="hidden"[^>]*>`,
  String.raw`<animateMotion dur="[\d.]+s" begin="0\.8s" repeatCount="indefinite" path="M`,
);

function checkSteps(svg) {
  check(/<g data-step="1">\s*<g data-id="a"/.test(svg) && /<g data-step="2">\s*<g data-id="b"/.test(svg),
    'the stepped boxes are not wrapped in their steps');
  check(/<g data-edge="a-&gt;b"[^>]* data-step="2">/.test(svg) && /<text data-step="2"[^>]*>sends</.test(svg),
    'the line and its label do not appear with the later of their ends');
  check(/<path class="g-flow" d="[^"]+" visibility="hidden"/.test(svg) && FLOW_DOT.test(svg),
    'the flow marks are missing, visible by default, or start before their line');
  const guarded = /@media \(prefers-reduced-motion: no-preference\)/.test(svg);
  check(guarded && /\[data-step="2"\] \{ animation-delay: 0\.8s; \}/.test(svg),
    'the motion is not limited to readers who allow it, or a step has no delay');
}

// Flow and steps: the marks on a line and the order boxes appear in, drawn on top of the
// still figure, which is what a PNG shows.
async function checkFlowAndSteps() {
  const dir = folder('page-motion');
  const still = folder('page-motion-still');
  await renderWithPng(dir, pageDiagram(stepsBody(true), '', 'width=500'));
  await renderWithPng(still, pageDiagram(stepsBody(false), '', 'width=500'));
  checkSteps(svgOf(path.join(dir, 'out')));
  checkSamePng(dir, still, 'the PNG of a figure with motion is not the still figure');
  const bad = await render(write(dir, pageDiagram('<div class=card data-step=first>A</div>')), path.join(dir, 'out'));
  checkReported(bad, /bad-attribute: attr=data-step value=first/, 'bad-attribute for data-step');
}

const ANIMATED = '<div class="flex gap-24"><div class=card id=a>A</div><div class=card id=b>B</div></div>';
const MARK = "const m = draw.moveTo(el('b').bottom.down(8)).lineTo(el('b').bottom.down(20));\n" +
  "text(el('a').bottom.down(16), 'label', { halo: true });";
const ANIMATIONS = "animate('a', [{ rotate: 0 }, { rotate: 6 }, { rotate: 0 }], " +
  "{ duration: 1200, iterations: Infinity, origin: 'left top' });\n" +
  `${MARK}\nanimate(m, [{ translate: 0 }, { translate: [30, 0] }], { duration: 800 });`;
const TURN_RULE = longPattern(
  String.raw`\[data-anim="0"\] \{ transform-box: view-box; transform-origin: ([\d.]+)px ([\d.]+)px; `,
  String.raw`animation: pg-a0 1200ms linear 0ms infinite normal none; \}`,
);
const TURN_KEYFRAMES = longPattern(
  String.raw`@keyframes pg-a0 \{\s*0% \{ rotate: 0deg; \}\s*50% \{ rotate: 6deg; \}\s*100% \{ rotate: 0deg; \}`,
);
const SLIDE_KEYFRAMES = /@keyframes pg-a1 \{\s*0% \{ translate: 0px; \}\s*100% \{ translate: 30px 0px; \}/;
const HALO = longPattern(
  String.raw`fill: var\(--ink\); paint-order: stroke; stroke: [^;]+; stroke-width: 4px; stroke-linejoin: round">label<`,
);

function checkAnimation(svg) {
  const box = readLayout(svg).nodes.a;
  const media = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/.exec(svg)?.[1] || '';
  check(/<g data-anim="0">\s*<g data-id="a"/.test(svg) && /<g data-anim="1">\s*<path /.test(svg),
    'the animated element or mark is not wrapped in its own group');
  const origin = TURN_RULE.exec(media);
  const aboutTopLeft = origin && Math.abs(origin[1] - box[0]) < 1 && Math.abs(origin[2] - box[1]) < 1;
  check(aboutTopLeft && /\[data-anim="1"\][^}]*animation: pg-a1 800ms linear 0ms 1 normal none/.test(media),
    'the animation rules are missing, outside the reduced-motion guard, or turn about the wrong point: ' +
    `${media.slice(0, 300)}`);
  check(TURN_KEYFRAMES.test(svg) && SLIDE_KEYFRAMES.test(svg), 'the keyframes are not as given');
  check(HALO.test(svg), 'the text halo is missing');
}

// animate(): an element and a drawn mark move when the figure is shown, about the origin
// given (here the element's top left), and only where the reader allows motion; the still,
// and the PNG, are where they rest.
async function checkAnimate() {
  const dir = folder('page-animate');
  const still = folder('page-animate-still');
  await renderWithPng(dir, pageDiagram(ANIMATED, ANIMATIONS, 'width=400'));
  await renderWithPng(still, pageDiagram(ANIMATED, MARK, 'width=400'));
  checkAnimation(svgOf(path.join(dir, 'out')));
  checkSamePng(dir, still, 'the PNG of an animated figure is not the still figure');
  const unknownKey = pageDiagram(ANIMATED, "animate('a', [{ width: 3 }, { rotate: 4 }])");
  const badKey = await render(write(dir, unknownKey), path.join(dir, 'out'));
  checkReported(badKey, /bad-option: option=animate value=width/, 'bad-option for a keyframe property');
}

export async function pageMotion() {
  await checkFlowAndSteps();
  await checkAnimate();
}

const PLAN = `<div id=plan class="grid gap-y-2">
<div class=card id=t1 data-start=2026-03-02 data-duration=2w>One</div>
<div class=card id=t2 data-after=t1 data-duration=10d>Two</div>
<div class=card id=t3 data-after="t1 t2" data-end=2026-04-30>Three</div>
<div class=card id=t4 data-end=2026-04-30 data-duration=3w>Four</div>
</div>`;
const MONTHS = [
  '<script type="graphally" before>',
  'schedule();',
  "const t = timeline('#plan');",
  "for (const m of t.months) root.querySelector('#plan').append(make('div', " +
    "{ id: 'm' + m.month, style: 'grid-row: 5; grid-column: ' + m.column }, m.label));",
  '</script>',
].join('\n');
const LOOP = '<div id=p><div id=x data-after=y data-duration=1d></div>' +
  '<div id=y data-after=x data-duration=1d></div></div>';

function checkSchedule(svgFile) {
  const [first, second, third] = ['t1', 't2', 't3'].map(nodeId => nodeRect(svgFile, nodeId));
  // Two weeks then ten days: t2 starts where t1 ends, t3 where t2 ends; day widths agree.
  const chained = Math.abs(second[0] - (first[0] + first[2])) < 1 && Math.abs(third[0] - (second[0] + second[2])) < 1;
  check(chained, `dependencies: ${first} ${second} ${third}`);
  const day = first[2] / 14;
  check(Math.abs(second[2] / day - 10) < 0.1, `10d is ${second[2] / day} days wide`);
  // An end date is a boundary: 2026-03-26 to 2026-04-30 is 35 days.
  check(Math.abs(third[2] / day - 35) < 0.2, `t3 from 2026-03-26 to 2026-04-30 is ${third[2] / day} days wide`);
  // An end and a duration count back: t4 is three weeks wide and ends where t3 ends.
  const fourth = nodeRect(svgFile, 't4');
  check(Math.abs(fourth[2] / day - 21) < 0.2 && Math.abs(fourth[0] + fourth[2] - (third[0] + third[2])) < 1,
    `t4 (end and duration) is ${fourth[2] / day} days wide at ${fourth[0]}`);
  const march = nodeRect(svgFile, 'm2026-03');
  const april = nodeRect(svgFile, 'm2026-04');
  check(Math.abs(march[0] - (first[0] - day)) < 1 && Math.abs(april[0] - (march[0] + 31 * day)) < 1,
    `month headers off the day grid: ${march} ${april}`);
}

export async function pageBeforeAndDates() {
  const dir = folder('page-dates');
  const out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(PLAN + MONTHS, '')), out));
  checkSchedule(path.join(out, 'diagram.svg'));
  const loop = pageDiagram(LOOP, '')
    .replace('</diagram>', '<script type="graphally" before>schedule()</script></diagram>');
  checkReported(await render(write(dir, loop), out), /schedule-loop/, 'schedule-loop');
}

const SEQUENCE = [
  '<div class=seq id=seq>',
  '<div class=node id=a data-who>A</div><div class=node id=b data-who>B</div><div class=node id=c data-who>C</div>',
  '<p class=msg id=m1 data-from=a data-to=c>call</p>',
  '<div class=frag data-kind=alt data-guard=ok><p class=msg id=m2 data-from=c data-to=b>ask</p><div class=else></div>' +
    '<p class="msg reply" id=m3 data-from=b data-to=c>told</p></div>',
  '<p class="msg reply" id=m4 data-from=c data-to=a>done</p>',
  `</div><script type="graphally" before>sequence('#seq')</script>`,
].join('\n');

function checkSequenceLayout(svgFile) {
  const [first, second, third] = ['a', 'b', 'c'].map(nodeId => nodeRect(svgFile, nodeId));
  const [call, ask, told, done] = ['m1', 'm2', 'm3', 'm4'].map(nodeId => nodeRect(svgFile, nodeId));
  check(first[0] < second[0] && second[0] < third[0] && first[1] === third[1],
    `participants not in one row, in order: ${first} ${second} ${third}`);
  check(call[1] >= first[1] + first[3] && ask[1] > call[1] && told[1] > ask[1] && done[1] > told[1],
    'messages not one per row, in order');
  // A message spans from its leftmost participant to its rightmost, either way round.
  check(call[0] <= first[0] + 1 && call[0] + call[2] >= third[0] + third[2] - 1 && done[2] === call[2],
    `message spans: ${call} ${done}`);
}

export async function pageSequence() {
  const dir = folder('page-sequence');
  const out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(SEQUENCE, '', 'width=900')), out));
  checkSequenceLayout(path.join(out, 'diagram.svg'));
  const svg = svgOf(out);
  const numbers = countOf(svg, />[1-4]<\/text>/g);
  check(numbers === 4, `expected four numbers, found ${numbers}`);
  check(/alt/.test(svg) && /\[ok\]/.test(svg), 'fragment tab missing');
}

// a ends where c starts two rows down; b sits between them across that date, so the
// dependency must go around b, never through it.
const BARS = [
  '<style>.r { display: grid; grid-template-columns: subgrid; grid-column: 1 / -1; height: 40px; ' +
    'align-items: center } .r > i { height: 20px; background: var(--lane-a) }</style>',
  '<div id=p class=grid>',
  '<div class=r><i id=a data-start=2026-03-02 data-duration=2w></i></div>',
  '<div class=r><i id=b data-start=2026-03-09 data-duration=3w></i></div>',
  '<div class=r><i id=c data-after=a data-duration=1w></i></div>',
  `</div><script type="graphally" before>schedule(); timeline('#p', { lead: '0px' })</script>`,
].join('\n');

// It leaves a by its end or its underside, and arrives at c's start or its top near it.
function leavesByEnd(point, [x, y, w, h]) {
  return Math.abs(point.x - (x + w)) < 1 || (Math.abs(point.y - (y + h)) < 1 && point.x > x && point.x <= x + w);
}

function arrivesAtStart(point, [x, y]) {
  return Math.abs(point.x - x) < 1 || (Math.abs(point.y - y) < 1 && point.x >= x && point.x <= x + 40);
}

function strictlyInside([left, top, width, height], x, y) {
  return x > left && x < left + width && y > top && y < top + height;
}

// Samples the segment from its start in steps of 5 % and checks each point is outside the box.
function checkSegmentOutside(start, end, box, message) {
  for (let fraction = 0; fraction <= 1; fraction += 0.05) {
    const x = start.x + (end.x - start.x) * fraction;
    const y = start.y + (end.y - start.y) * fraction;
    check(!strictlyInside(box, x, y), message);
  }
}

export async function pageDepend() {
  const dir = folder('page-depend');
  const out = path.join(dir, 'out');
  checkSucceeded(await render(write(dir, pageDiagram(BARS, "depend('a', 'c')")), out));
  const svg = svgOf(out);
  const [before, between, after] = ['a', 'b', 'c'].map(nodeId => nodeRect(path.join(out, 'diagram.svg'), nodeId));
  const line = svg.match(/<path d="(M[^"]+)"[^>]*marker-end/);
  check(line, 'no dependency drawn');
  const points = pointsOf(line[1]);
  check(leavesByEnd(points[0], before) && arrivesAtStart(points.at(-1), after),
    `the line does not run from the end of a to the start of c: ${line[1]}`);
  // No corner or crossing point inside b: every segment stays outside its box.
  for (let i = 1; i < points.length; i++) {
    checkSegmentOutside(points[i - 1], points[i], between, `the dependency crosses b: ${line[1]}`);
  }
}
