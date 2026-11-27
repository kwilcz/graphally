// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The pages' server, on 127.0.0.1, so sandboxed browsers (a snap, for example) can read them: the
// skill directory at /, the diagram's directory at /src/ (several directories at /src/0/, /src/1/
// … when srcDir is a list), single files at the paths given in `files`: a path on disk (the
// icon packs, wherever they were downloaded to), or { body, type }, and at /near the fonts and
// SVG files a diagram names by a path relative to its file, wherever they are on disk.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

// The folder a URL is served from, and the path in it.
function rootOf(url, skillRoot, srcDir) {
  const numbered = Array.isArray(srcDir) && /^\/src\/(\d+)\//.exec(url);
  if (numbered) return [srcDir[numbered[1]] || '', url.slice(numbered[0].length)];
  if (url.startsWith('/src/') && !Array.isArray(srcDir)) return [srcDir, url.slice(5)];
  return [skillRoot, url.slice(1)];
}

const isServable = file => fs.existsSync(file) && fs.statSync(file).isFile();
const contentType = file => {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  return /^(text|application)\//.test(type) || type.endsWith('xml') ? `${type}; charset=utf-8` : type;
};

const sendBody = (response, { body, type = 'application/json' }) => {
  response.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
  response.end(body);
};
const notFound = response => {
  response.writeHead(404);
  response.end();
};
const sendFile = (response, file, headers = {}) => {
  response.writeHead(200, { 'content-type': contentType(file), ...headers });
  fs.createReadStream(file).pipe(response);
};

// /near?from=/src/0/diagram.html&path=../brand/Acme-Bold.ttf: the path, from the diagram's folder.
const NEAR = /\.(ttf|otf|woff2?|svg)$/i;
function nearPath(url, skillRoot, srcDir) {
  const [root, relative] = rootOf(url.searchParams.get('from') || '', skillRoot, srcDir);
  if (!root || root === skillRoot) return null;
  return path.resolve(path.dirname(path.resolve(root, relative)), url.searchParams.get('path') || '');
}

// The SVG files in a folder and the folders in it, by file name (the first of a name wins): an icon set.
function svgFiles(dir, found = {}, depth = 0) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && depth < 4) svgFiles(file, found, depth + 1);
    else if (/\.svg$/i.test(entry.name) && !Object.hasOwn(found, entry.name)) {
      found[entry.name] = fs.readFileSync(file, 'utf8');
    }
  }
  return found;
}

// A font or an SVG file is sent as it is; a folder as the SVG files in it.
function sendNear(response, file) {
  if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    return sendBody(response, { body: JSON.stringify(svgFiles(file)) });
  }
  return file && NEAR.test(file) && isServable(file) ? sendFile(response, file) : notFound(response);
}

function handler(skillRoot, srcDir, files) {
  return (request, response) => {
    const url = new URL(request.url, 'http://x'), pathname = decodeURIComponent(url.pathname), given = files[pathname];
    if (given && typeof given === 'object') return sendBody(response, given);
    if (pathname === '/near') return sendNear(response, nearPath(url, skillRoot, srcDir));
    const [root, relative] = rootOf(pathname, skillRoot, srcDir), file = given || path.resolve(root, relative);
    const outside = !given && (!root || !file.startsWith(path.resolve(root) + path.sep));
    if (outside || !isServable(file)) return notFound(response);
    // The skill's own files (the engine, the theme, the icon packs) do not change while the
    // server runs, and each run has a fresh browser profile: every page after the first reads
    // them from the cache instead of fetching and compiling each module again.
    return sendFile(response, file, root === skillRoot ? { 'cache-control': 'max-age=3600' } : {});
  };
}

export function serve(skillRoot, srcDir, files = {}) {
  const server = http.createServer(handler(skillRoot, srcDir, files));
  const close = () => {
    server.closeAllConnections?.();
    server.close();
  };
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    resolve({ origin: `http://127.0.0.1:${server.address().port}`, close });
  }));
}
