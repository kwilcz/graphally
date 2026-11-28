// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Shape defaults, at zero specificity: any rule of the author wins. Every shape is a box with an
// outline and centred content; events and gateways have their BPMN sizes, and each shape's
// padding keeps its text inside its outline. An activity with a marker at its bottom
// (subprocess, loop, multi-instance) keeps its label clear of it, and so does a task with its
// type's marker in its top-left corner (user, service, send).

// Any element with one of these words in its shape.
const any = names => names.map(name => `[shape~="${name}"]`).join(', ');
// The shape's name only, not a marker: `task loop` is a task, not the `loop` badge.
const first = names => names.map(name => `[shape="${name}"], [shape^="${name} "]`).join(', ');
const shaped = selector => `:where(.graphally-page :is(${selector}))`;

const EVENTS = any([
  'start', 'start-event', 'event', 'intermediate', 'intermediate-event', 'end', 'end-event',
]);
const TASKS = any(['task', 'activity']);
const SUBPROCESSES = any(['subprocess', 'sub-process']);
const DATA_OBJECTS = any(['note', 'data-object', 'folded']);
const BOTTOM_MARKED = any(['loop', 'multi', 'sequential', 'ad-hoc', 'compensation']);
const TYPE_MARKED = any(['user', 'service', 'send', 'receive', 'manual', 'script', 'business-rule']);

export const SHAPE_CSS = `
:where(.graphally-page [shape]) {
  border: 1.5px solid var(--ink);
  background: var(--card);
  display: grid;
  place-items: center;
  text-align: center;
  padding: 8px 12px;
}
${shaped(EVENTS)} { width: 36px; height: 36px; padding: 0; }
${shaped(any(['end', 'end-event']))} { border-width: 3px; }
${shaped(any(['gateway']))} { width: 44px; height: 44px; padding: 0; }
${shaped(first(['cycle', 'repeat', 'refresh', 'loop']))} { width: 28px; height: 28px; padding: 0; }
${shaped(first(['annotation']))} {
  background: none;
  place-items: center start;
  text-align: left;
  padding: 6px 10px 6px 14px;
}
${shaped(first(['group']))} { background: none; place-items: stretch; padding: 14px; }
${shaped(any(['task', 'activity', 'subprocess', 'sub-process']))} { padding: 10px 14px; min-height: 52px; }
${shaped(`${SUBPROCESSES}, :is(${TASKS}):is(${BOTTOM_MARKED})`)} {
  padding-bottom: 22px;
}
${shaped(`:is(${TASKS}):is(${TYPE_MARKED})`)} { padding-left: 26px; }
${shaped(any(['diamond', 'decision', 'rhombus']))} { padding: 22px 30px; min-height: 64px; }
${shaped(any(['circle']))} { aspect-ratio: 1; padding: 10px; }
${shaped(any(['ellipse', 'oval']))} { padding: 12px 26px; }
${shaped(any(['cylinder', 'database', 'db', 'data-store']))} { padding: 22px 12px 14px; }
${shaped(any(['cylinder-h', 'queue']))} { padding: 8px 26px 8px 16px; }
${shaped(any(['document', 'documents', 'multi-document']))} { padding: 8px 12px 18px; }
${shaped(any(['documents', 'multi-document']))} { padding: 16px 20px 22px 12px; }
${shaped(DATA_OBJECTS)} { padding: 8px 22px 8px 12px; }
${shaped(`${DATA_OBJECTS}):is(${any(['input', 'output'])}`)} { padding-top: 22px; }
${shaped(`${DATA_OBJECTS}):is(${any(['collection'])}`)} { padding-bottom: 22px; }
${shaped(any(['callout']))} { padding: 8px 12px 22px; }
${shaped(any(['cloud']))} { padding: 22px 30px 18px; }
${shaped(any(['chevron', 'chevron-start', 'step']))} { padding: 8px 30px; }
${shaped(any(['hexagon', 'parallelogram', 'io', 'data', 'trapezoid']))} { padding: 8px 28px; }
${shaped(any(['triangle']))} { padding: 30% 20% 8px; }
${shaped(any(['predefined', 'subroutine']))} { padding: 8px 22px; }
${shaped(any(['delay']))} { padding: 8px 26px 8px 12px; }
${shaped(any(['manual-input']))} { padding: 18px 12px 8px; }
${shaped(any(['off-page']))} { padding: 8px 12px 18px; }
${shaped(any(['stadium', 'pill', 'terminator']))} { padding: 8px 20px; }
${shaped(any(['arrow', 'arrow-right', 'arrow-left']))} { padding: 8px 34px 8px 14px; }
${shaped(any(['arrow-left']))} { padding: 8px 14px 8px 34px; }
${shaped(any(['arrow-up', 'arrow-down']))} { padding: 12px 24px 38px; }
${shaped(any(['arrow-up']))} { padding: 38px 24px 12px; }
`;
