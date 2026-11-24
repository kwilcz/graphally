// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The open canvases, one per instance the app opens: each a session on a diagram file and the
// server its page comes from. Nothing here knows the app, so it runs and is tested on its own.
import { CanvasSession } from './session.mjs';
import { startCanvasServer } from './server.mjs';

const canvases = new Map();

// Opens an instance on a file, or keeps it when it already shows that file.
export async function openCanvas(instanceId, filePath) {
  const open = canvases.get(instanceId);
  if (open?.session.filePath === filePath) return open;
  if (open) await closeCanvas(instanceId);
  const session = new CanvasSession(filePath), server = await startCanvasServer(session);
  canvases.set(instanceId, { session, server });
  return { session, server };
}

export const canvasOf = instanceId => canvases.get(instanceId);

export async function closeCanvas(instanceId) {
  const open = canvases.get(instanceId);
  if (!open) return;
  canvases.delete(instanceId);
  open.session.close();
  await open.server.close();
}
