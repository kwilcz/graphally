// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// graphally canvas for the GitHub Copilot app: shows a diagram file (an HTML file with a
// <diagram>) live in the side panel. Drag a box to move it, Alt-drag from one box to another
// to connect them, drag a line to reroute it, double-click a line to label it. Every change
// is written into the file (nudge="dx,dy" on the element, the JSON connections), so the file
// stays the diagram and the agent's own edits show up in the panel as they land.
import path from 'node:path';
import { joinSession, createCanvas } from '@github/copilot-sdk/extension';
import { startServer } from './server.mjs';

let session = null;
const log = (message, level) => session?.log(message, level ? { level } : undefined);   // stdout is the JSON-RPC channel
const server = await startServer({ log });
const fileOf = ctx => path.resolve(ctx.session?.workingDirectory || process.cwd(), String(ctx.input?.file || ''));

const EDITS = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      description: 'Edits, applied in order. { "op": "move", "id": "db", "dx": 40, "dy": 0 } moves an element; '
        + '{ "op": "connect", "from": "api", "to": "db", "label": "writes" } adds a connection (any option of connect: dashed, message, via …); '
        + '{ "op": "line", "key": "api->db", "set": { "label": "reads", "via": [[420, 160]] } } changes one (null removes an option); '
        + '{ "op": "unline", "key": "api->db" } removes one. Keys are listed by get_diagram.',
      items: { type: 'object', properties: { op: { enum: ['move', 'nudge', 'connect', 'line', 'unline'] } }, required: ['op'] },
    },
  },
  required: ['edits'],
};

session = await joinSession({
  canvases: [createCanvas({
    id: 'graphally',
    displayName: 'graphally',
    description: 'Shows a graphally diagram file live; the user moves boxes and draws connections on it, and every change is written into the file.',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'The diagram HTML file, relative to the working directory' } }, required: ['file'] },
    open: ctx => {
      const file = fileOf(ctx);
      return { url: server.open(ctx.instanceId, file), title: path.basename(file), status: 'live' };
    },
    onClose: ctx => server.close(ctx.instanceId),
    actions: [
      {
        name: 'get_diagram',
        description: 'The diagram as the canvas shows it: a picture, the problems of the last render, the element boxes, the connections with their keys, and what the user has selected.',
        handler: ctx => {
          const { png, ...state } = server.state(ctx.instanceId);
          return { textResultForLlm: JSON.stringify(state, null, 1), resultType: 'success',
            ...(png ? { binaryResultsForLlm: [{ type: 'image', mimeType: 'image/png', data: png.replace(/^data:image\/png;base64,/, ''), description: 'the rendered diagram' }] } : {}) };
        },
      },
      {
        name: 'apply_edits',
        description: 'Move elements and add, change or remove connections; the edits are written into the diagram file and the canvas re-renders. Returns the new render\'s problems. For other changes (new boxes, text, styles), edit the file itself: the canvas follows the file.',
        inputSchema: EDITS,
        handler: ctx => server.edit(ctx.instanceId, ctx.input?.edits || []),
      },
    ],
  })],
});
