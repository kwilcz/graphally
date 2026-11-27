#!/usr/bin/env node
// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node tools/test.mjs [--keep]
// The suite. Renders every samples/*/diagram.html and docs/diagrams/*.html through the CLI,
// then small diagrams written here: the layout each SVG carries, connection sides, blocked,
// bad and dropped overrides, how far a layout moves when a box is added (a stable re-render
// against --recompute), shapes, script errors, routing, problems, connections as data, the
// viewer, utility classes, dates, sequences, dependencies, batches, icon packs on demand, brand
// fonts and icon sets, the skill's own examples, and the entry skills beside it.
// Works in a fresh folder under os.tmpdir(), removed at the end unless --keep, which prints
// its path. Exits 1 when a test fails. The tests live in tools/test/, one file per area; this
// file runs them in order: the samples and their layout first, then the rest a few at a time
// (TEST_JOBS), their lines printed in the order below.
import { finish, later, runQueue, test } from './test/harness.mjs';
import { layout, samples, stability } from './test/samples.mjs';
import { badSides, dropped, sides } from './test/sides.mjs';
import { pageShapes } from './test/page-shapes.mjs';
import { pageCssPaint, pageImages, pageUtilities } from './test/page-paint.mjs';
import { bundles, pageDrawingReach, pageRouting, pageScriptErrors } from './test/page-lines.mjs';
import { pageData, pageProblems } from './test/page-problems.mjs';
import { pageBeforeAndDates, pageDepend, pageMotion, pageSequence } from './test/page-time.mjs';
import { viewer } from './test/viewer.mjs';
import { batch, docExamples, iconPacks, packageAndApi, versionNumbers } from './test/package.mjs';
import { sourceEdits } from './test/source-edits.mjs';
import { canvas } from './test/canvas.mjs';
import { entrySkills } from './test/entry-skills.mjs';
import {
  pageBrandFonts, pageIconSets, pageInfographicMarks, pageOwnColours, pageTextOverlap,
} from './test/page-brand.mjs';

await test('samples', samples);
await test('layout', layout);

later('sides', sides);
later('bad-sides', badSides);
later('dropped', dropped);
later('stability', stability);
later('page-shapes', pageShapes);
later('page-drawing-reach', pageDrawingReach);
later('page-script-errors', pageScriptErrors);
later('page-routing', pageRouting);
later('bundles', bundles);
later('page-motion', pageMotion);
later('page-problems', pageProblems);
later('page-data', pageData);
later('source-edits', sourceEdits);
later('canvas', canvas);
later('page-css-paint', pageCssPaint);
later('page-images', pageImages);
later('page-brand-fonts', pageBrandFonts);
later('page-icon-sets', pageIconSets);
later('page-infographic-marks', pageInfographicMarks);
later('page-text-overlap', pageTextOverlap);
later('page-own-colours', pageOwnColours);
later('viewer', viewer);
later('page-utilities', pageUtilities);
later('page-before-and-dates', pageBeforeAndDates);
later('page-sequence', pageSequence);
later('page-depend', pageDepend);
later('package', packageAndApi);
later('version', versionNumbers);
later('batch', batch);
later('icon-packs', iconPacks);
later('doc-examples', docExamples);
later('entry-skills', entrySkills);

await runQueue();
finish();
