// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The lines printed for each diagram: its size and stats, what the author asked for that it no
// longer has, the icons drawn without a pack, and one line per problem.
import path from 'node:path';
import { readLayout } from '../snapshot.mjs';
import { SKILL_ROOT } from '../skill-root.mjs';

const has = (object, key) => Object.hasOwn(object || {}, key);

function droppedNudges(previous, next) {
  return Object.keys(previous.overrides?.nodes || {})
    .filter(id => !has(next.overrides?.nodes, id))
    .map(id => `  note: override dropped: nudge on ${id} (${has(next.nodes, id) ? 'attribute' : 'node'} removed)`);
}

function droppedSides(previous, next) {
  return Object.entries(previous.overrides?.edges || {}).flatMap(([key, was]) => {
    const now = next.overrides?.edges?.[key];
    if (!now) return [`  note: override dropped: sides of ${key} (${has(next.edges, key) ? 'attribute' : 'connection'} removed)`];
    return ['out', 'in'].filter(end => was[end] && !now[end]).map(end => `  note: override dropped: ${end} side of ${key} (attribute removed)`);
  });
}

// One line per override of the previous render that the next no longer has. A box or connection
// that is gone is "removed"; one that is still there lost its override ("attribute removed").
const droppedOverrides = (previous, next) => [...droppedNudges(previous, next), ...droppedSides(previous, next)];

const counted = count => `${count} warning${count > 1 ? 's' : ''}`;

function summaryLine(result, svg, problems, warnings) {
  const { nodes, edges, crossings } = result.stats;
  const verdict = problems.length ? `${problems.length} problem(s):` : warnings.length ? `ok, ${counted(warnings.length)}:` : 'ok';
  return `${svg}  ${result.width}×${result.height}  ${nodes} nodes, ${edges} edges, ${crossings} crossings  ${verdict}`;
}

function offlineNote(offline) {
  const icons = [...new Set(offline.map(problem => problem.icon))].slice(0, 6).join(', ');
  return `  note: drawn without ${offline.length} icon(s) (${icons}): the icon packs are not downloaded; `
    + `run node ${path.join(SKILL_ROOT, 'scripts/fetch-icons.mjs')} when online`;
}

function problemLine({ rule, hint, warn, ...fields }) {
  const values = Object.entries(fields).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('|') : value}`).join(' ');
  return `  ${warn ? 'warning: ' : ''}${rule}: ${values}${hint ? `  (${hint})` : ''}`;
}

// Icons from a pack that is not downloaded are one note, not a problem to fix. A warning (warn:
// true) is printed but passes: what it finds may be meant.
function sortProblems(all) {
  const offline = all.filter(problem => problem.rule === 'unknown-icon' && /not downloaded/.test(problem.hint || ''));
  const rest = all.filter(problem => !offline.includes(problem));
  return { offline, problems: rest.filter(problem => !problem.warn), warnings: rest.filter(problem => problem.warn) };
}

// With --json, the diagram's result as one line, whatever its problems.
export function reportDiagram(job, result, svg, previous, options) {
  if (options.json) {
    job.out.push(JSON.stringify({ ...result, svg }));
    return;
  }
  const { offline, problems, warnings } = sortProblems(result.problems);
  job.out.push(summaryLine(result, svg, problems, warnings));
  const now = result.snapshot || readLayout(result.svg);
  if (previous && now) job.out.push(...droppedOverrides(previous, now));
  if (offline.length) job.out.push(offlineNote(offline));
  job.out.push(...[...problems, ...warnings].map(problemLine));
  if (problems.length) job.exit = 1;
}
