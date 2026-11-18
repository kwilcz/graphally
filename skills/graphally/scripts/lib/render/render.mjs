// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// render(files, options): every file compiled in a shared browser, a few pages at once, each
// file's lines printed in order once it and every file before it are done.
import os from 'node:os';
import path from 'node:path';
import { launch } from '../browser/launch.mjs';
import { openPage } from '../browser/page.mjs';
import { serve } from '../browser/serve.mjs';
import { PACKS, fetchPacks, findPack } from '../iconpack.mjs';
import { bundle } from '../bundle.mjs';
import { SKILL_ROOT } from '../skill-root.mjs';
import { checkFiles, createJob } from './jobs.mjs';
import { renderFile } from './render-file.mjs';

// First run: download the cloud icon packs. Without a network the diagram still renders, and
// icons it names are reported with the command to fetch them later.
async function downloadMissingPacks(log) {
  for (const name of PACKS.filter(each => !findPack(SKILL_ROOT, each))) {
    if (process.env.GRAPHALLY_OFFLINE) return;
    log(`graphally: downloading the ${name} icon pack (first run only)`);
    try {
      await fetchPacks(SKILL_ROOT, [name]);
    } catch (error) {
      log(`note: ${name} icons not downloaded (${error.message.split('\n')[0]}); run node ${path.join(SKILL_ROOT, 'scripts/fetch-icons.mjs')} when online`);
    }
  }
}

// What the server serves besides the files: the icon packs, the earlier layouts, and the
// browser side as one module.
function servedFiles(jobs, options) {
  const packs = PACKS.map(name => [`/icons/${name}.json`, findPack(SKILL_ROOT, name)]).filter(([, file]) => file);
  const previous = options.recompute ? [] : jobs.map(job => [`/previous/${job.index}.json`, { body: JSON.stringify(job.previous) }]);
  const run = { body: bundle(path.join(SKILL_ROOT, 'scripts/lib'), 'run.js'), type: 'text/javascript' };
  return Object.fromEntries([...packs, ...previous, ['/scripts/lib/run.js', run]]);
}

// A few pages at once: as many as asked, else one fewer than the processors, up to 4.
function pageCount(jobs, asked) {
  const wanted = Number(asked) || Math.min(4, Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1));
  return Math.max(1, Math.min(jobs, wanted));
}

async function renderSafely(page, job, context, many) {
  try {
    await renderFile(page, job, context);
  } catch (error) {
    job.out.push(`error: ${many ? `${job.file}: ` : ''}${error.message}`);
    job.exit = 1;
  }
  job.done = true;
}

async function renderAll(pages, jobs, context, log) {
  let printed = 0, next = 0;
  const flush = () => {
    for (; printed < jobs.length && jobs[printed].done; printed++) jobs[printed].out.forEach(line => log(line));
  };
  await Promise.all(pages.map(async page => {
    while (next < jobs.length) {
      await renderSafely(page, jobs[next++], context, jobs.length > 1);
      flush();
    }
  }));
}

// --png is the agent's preview at half size: an image costs tokens by its pixels, and in a blind
// test labels read as well at 0.5x as at 1x (geometry is the checks' job, not the picture's).
// --png1x is the full-size look; --png2x is sharp enough to publish.
const pngScale = options => (options.png2x ? 2 : options.png1x ? 1 : 0.5);

async function runJobs(jobs, options, log) {
  let browser, server;
  try {
    server = await serve(SKILL_ROOT, jobs.map(job => path.dirname(path.resolve(job.file))), servedFiles(jobs, options));
    browser = await launch();
    const pages = await Promise.all(Array.from({ length: pageCount(jobs.length, options.jobs) }, () => openPage(browser)));
    const context = { options, server, scale: pngScale(options), dark: options.themes && !options.dark };
    await renderAll(pages, jobs, context, log);
    return Math.max(...jobs.map(job => job.exit));
  } catch (error) {
    log(`error: ${error.message}`);
    return 1;
  } finally {
    await browser?.close();
    server?.close();
  }
}

export async function render(files, options = {}) {
  const lines = [], log = line => {
    lines.push(line);
    options.log?.(line);
  };
  const list = [].concat(files);
  checkFiles(list, options);
  const jobs = list.map((file, index) => createJob(file, index, options));
  await downloadMissingPacks(log);
  const exitCode = await runJobs(jobs, options, log);
  return { exitCode, lines, files: jobs.map(job => ({ file: job.file, exit: job.exit, lines: job.out, diagrams: job.diagrams })) };
}
