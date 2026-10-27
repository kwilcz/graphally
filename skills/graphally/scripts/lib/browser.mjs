// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The browser graphally lays out and measures in: whatever Chrome, Chromium or Edge is
// installed, driven over the DevTools protocol through a pipe (no npm packages). Pages
// are served from 127.0.0.1, so sandboxed browsers (a snap, for example) can read them.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HINT = 'graphally needs Chrome, Chromium or Edge. Install one, run `npx playwright install chromium`, or set CHROMIUM_PATH to a browser executable.';

export function findBrowser() {
  const exists = f => { try { return !!f && fs.statSync(f).isFile(); } catch { return false; } };
  for (const v of ['CHROMIUM_PATH', 'CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH']) if (exists(process.env[v])) return process.env[v];
  const home = os.homedir();
  const fixed = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')],
    win32: [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).flatMap(d =>
      [path.join(d, 'Google/Chrome/Application/chrome.exe'), path.join(d, 'Chromium/Application/chrome.exe'), path.join(d, 'Microsoft/Edge/Application/msedge.exe')]),
  }[process.platform] || [];
  for (const f of fixed) if (exists(f)) return f;
  // On the PATH, looked up here rather than by running `which` once per name.
  if (process.platform !== 'win32') {
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge', 'microsoft-edge-stable']) {
      for (const d of dirs) { const p = path.join(d, name); if (exists(p)) return p; }
    }
  }
  // Browsers downloaded by Playwright (`npx playwright install chromium`), newest first.
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(home, '.cache/ms-playwright'), path.join(home, 'Library/Caches/ms-playwright'), path.join(home, 'AppData/Local/ms-playwright')];
  const inside = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe'];
  for (const dir of caches.filter(Boolean)) {
    let names = [];
    try { names = fs.readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1]); } catch { continue; }
    for (const n of names) for (const rel of inside) if (exists(path.join(dir, n, rel))) return path.join(dir, n, rel);
  }
  return null;
}

// Serve the skill directory at /, the diagram's directory at /src/ (several directories at
// /src/0/, /src/1/ … when srcDir is a list), and single files at the paths given in `files`:
// a path on disk (the icon packs, wherever they were downloaded to), or { body, type }.
export function serve(skillRoot, srcDir, files = {}) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const hit = files[url];
    if (hit && typeof hit === 'object') { res.writeHead(200, { 'content-type': `${hit.type || 'application/json'}; charset=utf-8` }); res.end(hit.body); return; }
    const many = Array.isArray(srcDir) && /^\/src\/(\d+)\//.exec(url);
    const [root, rel] = many ? [srcDir[many[1]] || '', url.slice(many[0].length)] : url.startsWith('/src/') && !Array.isArray(srcDir) ? [srcDir, url.slice(5)] : [skillRoot, url.slice(1)];
    const file = hit || path.resolve(root, rel);
    if ((!hit && (!root || !file.startsWith(path.resolve(root) + path.sep))) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => { server.closeAllConnections?.(); server.close(); } })));
}

export async function launch() {
  const exe = findBrowser();
  if (!exe) throw new Error(HINT);
  // Chrome keeps Unix sockets in its profile and its temporary folder, and socket paths stop at
  // about 108 characters: a long TMPDIR (deep in a project) makes it exit at start. Use /tmp then.
  const base = process.platform !== 'win32' && os.tmpdir().length > 60 && fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(base, 'graphally-'));
  const args = ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--disable-component-update', '--password-store=basic', '--use-mock-keychain',
    // Several pages render at once, and Chrome would throttle all but the one in front: their
    // timers slow down and a screenshot waits for a frame that comes seconds late, or never.
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    'about:blank'];
  if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');   // Chrome refuses to run as root otherwise
  const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], ...(base !== os.tmpdir() ? { env: { ...process.env, TMPDIR: base } } : {}) });
  let stderr = '';
  proc.stdio[2].on('data', d => { stderr = (stderr + d).slice(-2000); });
  const out = proc.stdio[3], inp = proc.stdio[4];
  const pending = new Map(), listeners = [];
  const decoder = new StringDecoder('utf8');
  let buf = '', next = 0, dead = null;
  inp.on('data', chunk => {
    buf += decoder.write(chunk);
    for (let i; (i = buf.indexOf('\0')) >= 0;) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      const p = msg.id && pending.get(msg.id);
      if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
      else listeners.forEach(l => l(msg));
    }
  });
  // The install hint helps only when the browser could not be started; an exit is the browser's own error.
  const fail = (why, hint = '') => { dead = new Error(`${why}${stderr ? `\n${stderr.trim().split('\n').slice(-3).join('\n')}` : ''}${hint ? `\n${hint}` : ''}`); for (const p of pending.values()) p.reject(dead); pending.clear(); };
  proc.on('error', e => fail(`could not start ${exe}: ${e.message}`, HINT));
  proc.on('exit', code => fail(`the browser (${exe}) exited (code ${code})`));
  out.on('error', () => {});
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (dead) return reject(dead);
    const id = ++next;
    pending.set(id, { resolve, reject });
    out.write(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }) + '\0');
  });
  await send('Browser.getVersion');
  // The tab Chrome opened at start (about:blank): the first page uses it instead of a new one.
  const { targetInfos = [] } = await send('Target.getTargets').catch(() => ({}));
  let spare = targetInfos.find(t => t.type === 'page')?.targetId || null;
  return {
    send,
    on: l => listeners.push(l),
    takeSpare() { const t = spare; spare = null; return t; },
    // Every page is done by now and its files written, so the browser is stopped outright
    // rather than asked to shut down, which takes it about 100 ms; its child processes go
    // with it. Then its profile is removed.
    async close() {
      proc.removeAllListeners('exit');
      const exited = new Promise(r => proc.once('exit', r));
      proc.kill('SIGKILL');
      await Promise.race([exited, new Promise(r => setTimeout(r, 2000).unref())]);
      for (const stream of [out, inp, proc.stdio[2]]) stream.destroy();
      proc.unref();
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

export async function openPage(browser, { width = 1400, height = 900, scale = 1 } = {}) {
  // Each page beyond the first gets a window of its own, so none sits behind another.
  const targetId = browser.takeSpare?.() || (await browser.send('Target.createTarget', { url: 'about:blank', newWindow: true })).targetId;
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  // A call that gets no answer within a minute fails, so a stuck page ends the render with
  // an error instead of hanging it.
  const s = (method, params) => {
    let timer;
    const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`the browser did not answer ${method} within 60 s`)), 60000); timer.unref?.(); });
    return Promise.race([browser.send(method, params, sessionId), late]).finally(() => clearTimeout(timer));
  };
  const errors = [];
  // A page signals that it is done by calling graphallyReady(): the event arrives here, with no
  // polling. A navigation starts a new wait.
  let done, ready = new Promise(r => { done = r; });
  browser.on(m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    else if (m.method === 'Runtime.bindingCalled' && m.params.name === 'graphallyReady') done(m.params.payload);
  });
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Runtime.addBinding', { name: 'graphallyReady' });
  // The window holds the whole page it shows. Headless windows open at 780×580, of which the
  // browser's own frame takes a strip (166 to 192px of the height, varying), and a capture
  // reaching beyond what the window draws now and then repeated what was inside it: a PNG
  // with the figure drawn a second time from x = 780, or from partway down. So the window is
  // the page with room to spare for any frame.
  const { windowId } = await browser.send('Browser.getWindowForTarget', { targetId });
  const viewport = async (w, h, sc = scale) => {
    await browser.send('Browser.setWindowBounds', { windowId, bounds: { width: Math.ceil(w) + 64, height: Math.ceil(h) + 320 } });
    return s('Emulation.setDeviceMetricsOverride', { width: Math.ceil(w), height: Math.ceil(h), deviceScaleFactor: sc, mobile: false });
  };
  await viewport(width, height);
  const evaluate = async expression => {
    const r = await s('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return {
    errors, viewport, evaluate,
    goto: url => { errors.length = 0; ready = new Promise(r => { done = r; }); return s('Page.navigate', { url }); },
    // Resolves when the page calls graphallyReady() after the last goto.
    ready(timeout = 60000) {
      let timer;
      return Promise.race([ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out waiting for the page')), timeout); timer.unref?.(); })]).finally(() => clearTimeout(timer));
    },
    async waitFor(expression, timeout = 60000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if (await evaluate(expression).catch(() => false)) return; await new Promise(r => setTimeout(r, 50)); }
      throw new Error('timed out waiting for the page');
    },
    // fast: a quicker PNG encoding, about a third faster and a third larger, for previews.
    async screenshot(clip, { fast = false } = {}) {
      const { data } = await s('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true, ...(fast ? { optimizeForSpeed: true } : {}) });
      return Buffer.from(data, 'base64');
    },
  };
}
