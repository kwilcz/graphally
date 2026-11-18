// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Runs the tests and counts them: test() runs one now, later() queues one for runQueue(), and
// finish() prints the stability table and the summary, tidies up and sets the exit code.
import fs from 'node:fs';
import os from 'node:os';
import { keep, work } from './helpers.mjs';

// The stability test's rows, one per sample, printed under the results.
export const table = [];
const counts = { total: 0, failed: 0 };
const queue = [];

// Runs a test's body and returns its line: "ok  <name>", or "FAIL <name>: <why>".
async function outcome(name, body) {
  counts.total++;
  try {
    await body();
    return `ok  ${name}`;
  } catch (error) {
    counts.failed++;
    return `FAIL ${name}: ${error.message}`;
  }
}

export async function test(name, body) {
  console.log(await outcome(name, body));
}

export function later(name, body) {
  queue.push({ name, body });
}

// TEST_JOBS, by default one fewer than the processors, at most three.
function jobCount() {
  const fromEnv = Number(process.env.TEST_JOBS);
  if (fromEnv) return fromEnv;
  const processors = os.availableParallelism?.() ?? os.cpus().length;
  return Math.max(1, Math.min(3, processors - 1));
}

// The tests after the samples and their layout run a few at a time; their lines print in the
// order they are written, each as soon as every one before it is done.
export async function runQueue() {
  const lines = [];
  let next = 0;
  let printed = 0;
  const printReady = () => {
    while (printed < queue.length && lines[printed]) {
      console.log(lines[printed]);
      printed++;
    }
  };
  const worker = async () => {
    while (next < queue.length) {
      const i = next;
      next++;
      lines[i] = await outcome(queue[i].name, queue[i].body);
      printReady();
    }
  };
  await Promise.all(Array.from({ length: jobCount() }, worker));
}

function printTable() {
  const rows = [['sample', 'stable: nodes', 'in group', 'sides', 'recompute: nodes', 'in group', 'sides'], ...table];
  const widths = rows[0].map((heading, i) => Math.max(...rows.map(row => String(row[i]).length)));
  for (const row of rows) {
    const cells = row.map((cell, i) => String(cell).padEnd(widths[i]));
    console.log(`  ${cells.join('  ')}`.trimEnd());
  }
}

export function finish() {
  if (table.length) printTable();
  console.log(`${counts.total - counts.failed} passed, ${counts.failed} failed`);
  if (keep) console.log(`kept: ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
  process.exitCode = counts.failed ? 1 : 0;
}
