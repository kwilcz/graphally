// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The graphally canvas for the GitHub Copilot app: a diagram file in the app's side panel, where
// a person moves elements within their layout, edits their text and attributes, adds and removes
// them and their lines, and the agent reads and edits the same diagram. Every edit is a text patch
// of the diagram's source (the skill's edits), so the file stays as written.
import { existsSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { joinSession, createCanvas, CanvasError } from '@microsoft/copilot-sdk/extension';
import { openCanvas, canvasOf, closeCanvas } from './instances.mjs';
import { NOTHING, OPEN, EDITS, SELECTION } from './schemas.mjs';

function sessionOf(ctx) {
  const open = canvasOf(ctx.instanceId);
  if (!open) throw new CanvasError('canvas_not_open', `No open canvas instance '${ctx.instanceId}'.`);
  return open.session;
}

const ACTIONS = [
  {
    name: 'get_diagram',
    description: 'The diagram file: its path, its HTML source, its connections (each with its key), its '
      + 'elements as layers (each with its path), its CSS (styles.rules, each with its index) and what the '
      + 'person selected.',
    inputSchema: NOTHING,
    handler: async ctx => forAgent(sessionOf(ctx).state()),
  },
  {
    name: 'apply_edits',
    description: 'Edit the diagram file, as graphally edit does: change an element\'s text, attributes or '
      + 'CSS, move it in the layout, add, copy, group or remove elements, add, change or remove lines. Returns '
      + 'the edits applied and those that failed, with why.',
    inputSchema: EDITS,
    handler: async ctx => sessionOf(ctx).edit(ctx.input.edits, ctx.input.version),
  },
  {
    name: 'get_selection',
    description: 'The elements and lines the person selected on the canvas.',
    inputSchema: NOTHING,
    handler: async ctx => ({ selection: sessionOf(ctx).selection }),
  },
  {
    name: 'select',
    description: 'Select elements and lines on the canvas, to point the person at them.',
    inputSchema: SELECTION,
    handler: async ctx => {
      sessionOf(ctx).select(ctx.input.items);
      return { selection: ctx.input.items };
    },
  },
];

// What the agent reads: the state without what only the panels use (graphally's defaults, each
// utility's CSS, the theme's tokens), which would fill its context.
const forAgent = ({ styles, ...state }) => ({ ...state, styles: { rules: styles.rules } });

// A diagram file in the workspace: an .html file at or under the folder the app runs in.
function diagramPath(input) {
  const filePath = resolve(process.cwd(), input || 'diagram.html'), inside = relative(process.cwd(), filePath);
  if (inside.startsWith('..') || isAbsolute(inside)) {
    throw new CanvasError('outside_workspace', `${filePath} is outside the workspace.`);
  }
  if (!/\.html?$/i.test(filePath)) throw new CanvasError('not_a_diagram', `${filePath} is not an .html file.`);
  if (!existsSync(filePath)) throw new CanvasError('file_not_found', `No diagram at ${filePath}.`);
  return filePath;
}

async function open(ctx) {
  const filePath = diagramPath(ctx.input?.filePath);
  const { server } = await openCanvas(ctx.instanceId, filePath);
  return { title: `graphally: ${basename(filePath)}`, status: filePath, url: server.url };
}

await joinSession({
  canvases: {
    definitions: [
      createCanvas({
        id: 'graphally',
        displayName: 'graphally diagram',
        description: 'Show a graphally diagram (.html) to edit it by hand: move, retext, add or remove its '
          + 'elements and lines.',
        inputSchema: OPEN,
        actions: ACTIONS,
        open,
        onClose: ctx => closeCanvas(ctx.instanceId),
      }),
    ],
  },
});
