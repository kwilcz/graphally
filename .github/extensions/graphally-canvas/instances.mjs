// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The open canvases, one per instance the app opens: each a session on a diagram file and the
// server its page comes from. Nothing here knows the app, so it runs and is tested on its own.
import { CanvasSession } from './session.mjs';
import { startCanvasServer } from './server.mjs';

const canvases = new Map();
// Each instance's last opening or closing, so two calls for one instance run one after the other.
const turns = new Map();

function inTurn(instanceId, task) {
  const run = (turns.get(instanceId) ?? Promise.resolve()).then(task, task);
  turns.set(instanceId, run.catch(() => {}));
  return run;
}

async function close(instanceId) {
  const open = canvases.get(instanceId);
  if (!open) return;
  canvases.delete(instanceId);
  open.session.close();
  await open.server.close();
}

// Opens an instance on a file, or keeps it when it already shows that file.
export const openCanvas = (instanceId, filePath) => inTurn(instanceId, async () => {
  const open = canvases.get(instanceId);
  if (open && open.session.filePath === filePath) return open;
  await close(instanceId);
  const session = new CanvasSession(filePath), opened = { session, server: await startCanvasServer(session) };
  canvases.set(instanceId, opened);
  return opened;
});

export const canvasOf = instanceId => canvases.get(instanceId);

export const closeCanvas = instanceId => inTurn(instanceId, () => close(instanceId));
