// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas's web server, on 127.0.0.1 only: the page and its scripts, the graphally engine from
// the skill, the diagram's state as it changes (server-sent events), and the edits and
// selections the page sends back.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const APP = new URL('./app/', import.meta.url);
const ENGINE = new URL('../../../skills/graphally/viewer/graphally.min.js', import.meta.url);
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
};
const LARGEST_BODY = 1 << 20;

function sendFile(response, url) {
  const type = TYPES[url.pathname.split('.').pop()];
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  response.end(readFileSync(url));
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
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
  'POST /api/edits': async (session, request, response) => {
    sendJson(response, 200, session.edit((await readJson(request)).edits || []));
  },
  'POST /api/selection': async (session, request, response) => {
    session.select((await readJson(request)).items || []);
    sendJson(response, 200, { selection: session.selection });
  },
};

async function handle(session, request, response) {
  const { pathname } = new URL(request.url || '/', 'http://127.0.0.1');
  const route = ROUTES[`${request.method} ${pathname}`], file = request.method === 'GET' && appFile(pathname);
  try {
    if (route) await route(session, request, response);
    else if (file) sendFile(response, file);
    else sendJson(response, 404, { error: `no ${request.method} ${pathname}` });
  } catch (error) {
    if (!response.headersSent) sendJson(response, 400, { error: error.message });
  }
}

// Serves one session on a free port; close() ends its pages and stops the server.
export async function startCanvasServer(session) {
  const server = createServer((request, response) => handle(session, request, response));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const close = () => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
  return { url: `http://127.0.0.1:${server.address().port}/`, close };
}
