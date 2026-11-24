// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas's web server, on 127.0.0.1 only and under a secret path: the page and its scripts,
// the graphally engine from the skill, the diagram's state as it changes (server-sent events),
// and the edits, previews and selections the page sends back.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { allIconNames } from './icons.mjs';

const APP = new URL('./app/', import.meta.url);
const ENGINE = new URL('../../../skills/graphally/viewer/graphally.min.js', import.meta.url);
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
};
const LARGEST_BODY = 1 << 20;

// Sent with every answer: no sniffing a type, and no address (with its secret) handed on to the
// sites the page fetches icons from.
const GUARDS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

function sendFile(response, url) {
  const type = TYPES[url.pathname.split('.').pop()];
  response.writeHead(200, { ...GUARDS, 'content-type': type, 'cache-control': 'no-cache' });
  response.end(readFileSync(url));
}

function sendJson(response, status, value) {
  response.writeHead(status, { ...GUARDS, 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > LARGEST_BODY) reject(new Error('request too large'));
    });
    request.on('end', () => resolve(JSON.parse(body || '{}')));
    request.on('error', reject);
  });
}

// The page's own files: index.html, and the scripts and stylesheet beside it.
function appFile(pathname) {
  if (pathname === '/') return new URL('index.html', APP);
  return /^\/[\w-]+\.(js|css)$/.test(pathname) ? new URL(pathname.slice(1), APP) : null;
}

const ROUTES = {
  'GET /events': (session, request, response) => session.addPage(response),
  'GET /api/state': (session, request, response) => sendJson(response, 200, session.state()),
  'GET /graphally.min.js': (session, request, response) => sendFile(response, ENGINE),
  'GET /api/icons': (session, request, response) => sendJson(response, 200, { names: allIconNames() }),
  'POST /api/edits': async (session, request, response) => {
    const { edits = [], version } = await readJson(request);
    sendJson(response, 200, session.edit(edits, version));
  },
  'POST /api/preview': async (session, request, response) => {
    const { edits = [], version } = await readJson(request);
    sendJson(response, 200, session.preview(edits, version));
  },
  'POST /api/undo': (session, request, response) => sendJson(response, 200, session.undo() ?? {}),
  'POST /api/redo': (session, request, response) => sendJson(response, 200, session.redo() ?? {}),
  'POST /api/selection': async (session, request, response) => {
    session.select((await readJson(request)).items || []);
    sendJson(response, 200, { selection: session.selection });
  },
};

// Whether a request comes from the canvas's own page. It must name this server as the page does
// (a site that has its name point at 127.0.0.1, DNS rebinding, is turned away), and a change must
// come as JSON from no other origin: a form or a plain request from another site cannot send JSON
// without asking first, and this server never says yes.
function allowed(request, own) {
  if (![own.host, own.host.replace('127.0.0.1', 'localhost')].includes(request.headers.host)) return false;
  if (request.method === 'GET') return true;
  const json = (request.headers['content-type'] || '').startsWith('application/json');
  return json && (!request.headers.origin || request.headers.origin === own.origin);
}

async function handle(session, request, response, { own, secret }) {
  const url = new URL(request.url || '/', own.origin), prefix = `/${secret}`;
  if (!allowed(request, own)) return sendJson(response, 403, { error: 'not from the canvas page' });
  if (!url.pathname.startsWith(`${prefix}/`)) return sendJson(response, 404, { error: 'no such page' });
  const pathname = url.pathname.slice(prefix.length);
  const route = ROUTES[`${request.method} ${pathname}`], file = request.method === 'GET' && appFile(pathname);
  try {
    if (route) await route(session, request, response);
    else if (file) sendFile(response, file);
    else sendJson(response, 404, { error: `no ${request.method} ${pathname}` });
  } catch (error) {
    if (!response.headersSent) sendJson(response, 400, { error: error.message });
  }
}

// Serves one session on a free port, under a secret path only its page is given; close() ends
// its pages and stops the server.
export async function startCanvasServer(session) {
  const guard = { own: null, secret: randomBytes(18).toString('base64url') };
  const server = createServer((request, response) => handle(session, request, response, guard));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  guard.own = new URL(`http://127.0.0.1:${server.address().port}`);
  const close = () => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
  return { url: `${guard.own.origin}/${guard.secret}/`, close };
}
