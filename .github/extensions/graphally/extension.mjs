// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// graphally canvas for the GitHub Copilot app: shows a diagram file (an HTML file with a
// <diagram>) live in the side panel. Drag a box to move it, Alt-drag from one box to another
// to connect them, drag a line to reroute it, double-click a line to label it. Every change
// is written into the file (nudge="dx,dy" on the element, the JSON connections), so the file
// stays the diagram and the agent's own edits show up in the panel as they land.
//
// The app marks an extension that exits as failed, so nothing here may end the process: the
// extension joins the session first, starts its server on first use, and reports a problem
// (no graphally skill, an app without canvases, an old Node) in the timeline and when the
// panel opens.
import path from 'node:path';
import * as sdk from '@github/copilot-sdk/extension';
import { startServer } from './server.mjs';

let session = null;
const log = (message, level) => { try { session?.log(message, level ? { level } : undefined)?.catch?.(() => {}); } catch {} };   // stdout is the JSON-RPC channel
process.on('uncaughtException', e => log(`graphally canvas: ${e?.message || e}`, 'error'));
process.on('unhandledRejection', e => log(`graphally canvas: ${e?.message || e}`, 'error'));

const fail = (code, message) => (sdk.CanvasError ? new sdk.CanvasError(code, message) : new Error(message));
let server = null;
async function ready(dir) {
  if (server) return server;
  try { return (server = await startServer({ log, starts: [dir] })); }
  catch (e) { throw fail('graphally_unavailable', e.message); }
}
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

const canvases = typeof sdk.createCanvas === 'function' ? [sdk.createCanvas({
  id: 'graphally',
  displayName: 'graphally',
  description: 'Shows a graphally diagram file live; the user moves boxes and draws connections on it, and every change is written into the file.',
  inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'The diagram HTML file, relative to the working directory' } }, required: ['file'] },
  open: async ctx => {
    const s = await ready(ctx.session?.workingDirectory), file = fileOf(ctx);
    try { return { url: s.open(ctx.instanceId, file), title: path.basename(file), status: 'live' }; }
    catch (e) { throw fail('graphally_open', e.message); }
  },
  onClose: ctx => server?.close(ctx.instanceId),
  actions: [
    {
      name: 'get_diagram',
      description: 'The diagram as the canvas shows it: a picture, the problems of the last render, the element boxes, the connections with their keys, and what the user has selected.',
      handler: async ctx => {
        const { png, ...state } = (await ready(ctx.session?.workingDirectory)).state(ctx.instanceId);
        return { textResultForLlm: JSON.stringify(state, null, 1), resultType: 'success',
          ...(png ? { binaryResultsForLlm: [{ type: 'image', mimeType: 'image/png', data: png.replace(/^data:image\/png;base64,/, ''), description: 'the rendered diagram' }] } : {}) };
      },
    },
    {
      name: 'apply_edits',
      description: 'Move elements and add, change or remove connections; the edits are written into the diagram file and the canvas re-renders. Returns the new render\'s problems. For other changes (new boxes, text, styles), edit the file itself: the canvas follows the file.',
      inputSchema: EDITS,
      handler: async ctx => (await ready(ctx.session?.workingDirectory)).edit(ctx.instanceId, ctx.input?.edits || []),
    },
  ],
})] : [];

session = await sdk.joinSession({ canvases });
if (!canvases.length) log('graphally canvas: this version of the Copilot app has no canvas API (createCanvas); update the app to use the canvas', 'error');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) log(`graphally canvas: Node.js ${process.versions.node} is older than the 20.19 the Copilot SDK needs`, 'warning');
// Look for the engine now, so a missing skill is reported at once rather than at the first open.
ready().catch(e => log(`graphally canvas: ${e.message}`, 'error'));
