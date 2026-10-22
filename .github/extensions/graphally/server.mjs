// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// The canvas's loopback server. It serves the canvas page and graphally's engine to the
// panel's iframe, which renders the diagram itself, and it is the one place that writes the
// diagram: edits from the iframe (drags, new connections) and from the agent's actions go
// through graphally's edit module into the source file, and each render's SVG is saved next
// to it, as the render command would. A change to the file on disk re-renders the panel.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// graphally's skill folder: GRAPHALLY_SKILL_DIR, else the usual install places, nearest first.
export function findSkill(starts = [process.cwd(), here]) {
  const rels = ['skills/graphally', '.github/skills/graphally', '.copilot/skills/graphally', '.claude/skills/graphally', '.agents/skills/graphally'];
  const found = [process.env.GRAPHALLY_SKILL_DIR].filter(Boolean);
  for (const s of starts) for (let d = path.resolve(s); ; d = path.dirname(d)) {
    found.push(...rels.map(r => path.join(d, r)));
    if (path.dirname(d) === d) break;
  }
  found.push(...rels.slice(2).map(r => path.join(os.homedir(), r)));
  return found.find(d => fs.existsSync(path.join(d, 'SKILL.md')) && fs.existsSync(path.join(d, 'scripts/lib/index.js'))) || null;
}

export async function startServer({ log = () => {} } = {}) {
  const skill = findSkill();
  if (!skill) throw new Error('graphally skill not found: install it, or set GRAPHALLY_SKILL_DIR');
  const lib = name => import(pathToFileURL(path.join(skill, 'scripts/lib', name)).href);
  const { applyEdits, readLines } = await lib('edits.mjs');
  const { readLayout } = await lib('snapshot.mjs');
  const { findPack } = await lib('iconpack.mjs');

  // One instance per open panel: its file, its live clients, the last render it reported.
  const instances = new Map();
  const instance = id => { const it = instances.get(id); if (!it) throw new Error(`no canvas "${id}"`); return it; };
  const svgOf = file => file.replace(/\.html?$/i, '') + '.svg';

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const file = (res, f, type) => (f && fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), type) : send(res, 404, 'not found', 'text/plain'));
  const body = req => new Promise((ok, fail) => { let s = ''; req.on('data', c => { s += c; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } }); });
  const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

  // Apply edits to an instance's file; resolves with the next render's problems when the panel
  // is open (it re-renders on the file change), or at once when it is not.
  function edit(id, edits) {
    const it = instance(id), src = fs.readFileSync(it.file, 'utf8');
    const r = applyEdits(src, edits);
    if (!r.applied.length) return Promise.resolve({ applied: 0, errors: r.errors });
    const rendered = new Promise(ok => { it.waiting.push(ok); setTimeout(() => ok(null), 4000); });
    fs.writeFileSync(it.file, r.source);
    return rendered.then(next => ({ applied: r.applied.length, errors: r.errors, ...(next ? { problems: next.problems } : { note: 'the canvas did not render: is it open?' }) }));
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), p = url.pathname, id = url.searchParams.get('i');
      if (p === '/' || p === '/canvas.html') return file(res, path.join(here, 'canvas.html'), TYPES['.html']);
      if (p === '/canvas.js') return file(res, path.join(here, 'canvas.js'), TYPES['.js']);
      // The engine, read-only: its modules, its theme and the icon packs.
      if (/^\/engine\/lib\/[\w/-]+\.m?js$/.test(p) && !p.includes('..')) return file(res, path.join(skill, 'scripts/lib', p.slice('/engine/lib/'.length)), TYPES['.js']);
      if (p === '/engine/theme.css') return file(res, path.join(skill, 'assets/theme.css'), TYPES['.css']);
      const pack = p.match(/^\/engine\/icons\/(azure|aws)\.json$/);
      if (pack) return file(res, findPack(skill, pack[1]), TYPES['.json']);

      const it = instance(id);
      if (p === '/api/source') {
        const svg = svgOf(it.file);
        return send(res, 200, { name: path.basename(it.file), source: fs.readFileSync(it.file, 'utf8'), previous: fs.existsSync(svg) ? readLayout(fs.readFileSync(svg, 'utf8')) : null });
      }
      if (p === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write(': open\n\n');
        it.clients.add(res);
        req.on('close', () => it.clients.delete(res));
        return;
      }
      if (req.method === 'POST' && p === '/api/edits') return send(res, 200, await edit(id, (await body(req)).edits || []));
      if (req.method === 'POST' && p === '/api/select') { it.selection = (await body(req)).selection || null; return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && p === '/api/rendered') {
        // The panel's render: save the SVG as the render command would, keep the state for the agent.
        const r = await body(req), svg = svgOf(it.file);
        if (r.svg && (!fs.existsSync(svg) || fs.readFileSync(svg, 'utf8') !== r.svg)) fs.writeFileSync(svg, r.svg);
        it.rendered = { problems: r.problems || [], stats: r.stats || {}, png: r.png || null, svg: r.svg || '', at: Date.now() };
        for (const ok of it.waiting.splice(0)) ok(it.rendered);
        return send(res, 200, { ok: true });
      }
      send(res, 404, 'not found', 'text/plain');
    } catch (e) { send(res, 400, { error: e.message }); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  log(`graphally canvas on 127.0.0.1:${port}, engine from ${skill}`);

  return {
    port, skill,
    // Opens (or re-focuses) an instance on a file; returns the iframe's URL.
    open(id, filePath) {
      const f = path.resolve(filePath);
      if (!fs.existsSync(f)) throw new Error(`no such file: ${filePath}`);
      let it = instances.get(id);
      if (!it || it.file !== f) {
        it?.watcher?.close();
        it = { file: f, clients: new Set(), waiting: [], rendered: null, selection: null };
        // The file changed on disk (an agent's edit, a save, our own edit): tell the panel.
        let timer = null;
        it.watcher = fs.watch(f, () => { clearTimeout(timer); timer = setTimeout(() => { for (const c of it.clients) c.write('data: change\n\n'); }, 60); });
        instances.set(id, it);
      }
      return `http://127.0.0.1:${port}/?i=${encodeURIComponent(id)}`;
    },
    close(id) { const it = instances.get(id); it?.watcher?.close(); for (const c of it?.clients || []) c.end(); instances.delete(id); },
    edit,
    // What the agent sees: the file, its connections with keys, the boxes, problems, selection.
    state(id) {
      const it = instance(id), src = fs.readFileSync(it.file, 'utf8'), layout = it.rendered?.svg ? readLayout(it.rendered.svg) : null;
      let connections = [];
      try { connections = readLines(src); } catch {}
      return { file: it.file, svg: svgOf(it.file), selection: it.selection, problems: it.rendered?.problems || [], stats: it.rendered?.stats || {},
        elements: layout?.nodes || {}, connections, png: it.rendered?.png || null };
    },
    stop() { for (const id of [...instances.keys()]) this.close(id); server.close(); },
  };
}
