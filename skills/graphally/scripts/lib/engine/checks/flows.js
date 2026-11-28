// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A BPMN step a sequence flow never reaches or never leaves: a flow left out of the list.

// Shapes that sit on a process's sequence flow, by their first word.
const STEPS = new Set(['task', 'activity', 'subprocess', 'sub-process', 'gateway', 'event', 'intermediate',
  'intermediate-event', 'start', 'start-event', 'end', 'end-event']);

// What a step needs: a start event, or a boundary event on a task's border, only a flow out; an
// end event only a flow in; the rest both.
function needsOf(element) {
  const word = (element.getAttribute('shape') || '').trim().split(/\s+/)[0];
  if (!STEPS.has(word)) return null;
  const onBorder = element.parentElement?.closest('[shape]');
  if (word.startsWith('start') || onBorder) return { into: false, out: true };
  return { into: true, out: !word.startsWith('end') };
}

// Every step with an id is checked once a sequence flow joins two steps; a step in a key (its
// sample) is left alone, and message flows do not count.
export function checkFlows(figure) {
  const into = new Set(), out = new Set();
  for (const { from, to, options } of figure.edges) {
    if (options.message) continue;
    out.add(from);
    into.add(to);
  }
  const steps = [...figure.root.querySelectorAll('[shape][id]')]
    .filter(element => !element.closest('.key')).map(element => [element, needsOf(element)])
    .filter(([, needs]) => needs);
  if (!steps.some(([element]) => into.has(element) || out.has(element))) return;
  for (const [element, needs] of steps) {
    const gap = (needs.into && !into.has(element) && 'no flow reaches it')
      || (needs.out && !out.has(element) && 'no flow leaves it');
    if (!gap) continue;
    figure.problems.push({
      rule: 'flow-missing', warn: true, step: element.id, gap,
      hint: 'add its sequence flow to the list, or make it a start or an end event',
    });
  }
}
