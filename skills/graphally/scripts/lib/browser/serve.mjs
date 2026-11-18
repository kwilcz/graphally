// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The pages' server, on 127.0.0.1, so sandboxed browsers (a snap, for example) can read them: the
// skill directory at /, the diagram's directory at /src/ (several directories at /src/0/, /src/1/
// … when srcDir is a list), and single files at the paths given in `files`: a path on disk (the
// icon packs, wherever they were downloaded to), or { body, type }.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
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

function handler(skillRoot, srcDir, files) {
  return (request, response) => {
    const url = decodeURIComponent(new URL(request.url, 'http://x').pathname), given = files[url];
    if (given && typeof given === 'object') {
      response.writeHead(200, { 'content-type': `${given.type || 'application/json'}; charset=utf-8` });
      response.end(given.body);
      return;
    }
    const [root, relative] = rootOf(url, skillRoot, srcDir), file = given || path.resolve(root, relative);
    const outside = !given && (!root || !file.startsWith(path.resolve(root) + path.sep));
    if (outside || !isServable(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    // The skill's own files (the engine, the theme, the icon packs) do not change while the
    // server runs, and each run has a fresh browser profile: every page after the first reads
    // them from the cache instead of fetching and compiling each module again.
    response.writeHead(200, { 'content-type': contentType(file), ...(root === skillRoot ? { 'cache-control': 'max-age=3600' } : {}) });
    fs.createReadStream(file).pipe(response);
  };
}

export function serve(skillRoot, srcDir, files = {}) {
  const server = http.createServer(handler(skillRoot, srcDir, files));
  const close = () => {
    server.closeAllConnections?.();
    server.close();
  };
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close })));
}
