// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The browser graphally lays out and measures in: whatever Chrome, Chromium or Edge is installed,
// headless, in a fresh profile, driven over the DevTools protocol through a pipe (no npm
// packages).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrowser, BROWSER_HINT } from './find-browser.mjs';
import { DevtoolsPipe } from './devtools-pipe.mjs';

const ARGS = [
  '--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-background-networking', '--disable-sync',
  '--disable-component-update', '--password-store=basic', '--use-mock-keychain',
  // Several pages render at once, and Chrome would throttle all but the one in front: their
  // timers slow down and a screenshot waits for a frame that comes seconds late, or never.
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
];

// Chrome keeps Unix sockets in its profile and its temporary folder, and socket paths stop at
// about 108 characters: a long TMPDIR (deep in a project) makes it exit at start. Use /tmp then.
const tempBase = () => (process.platform !== 'win32' && os.tmpdir().length > 60 && fs.existsSync('/tmp') ? '/tmp' : os.tmpdir());

function argsFor(profile) {
  const args = [...ARGS.slice(0, 2), `--user-data-dir=${profile}`, ...ARGS.slice(2), 'about:blank'];
  // Chrome refuses to run as root otherwise.
  return process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox', ...args] : args;
}

// The browser's last lines on stderr, for an error that says why it stopped.
function lastErrors(stream) {
  let text = '';
  stream.on('data', data => { text = (text + data).slice(-2000); });
  return () => (text ? `\n${text.trim().split('\n').slice(-3).join('\n')}` : '');
}

class Browser {
  constructor(process, pipe, profile) {
    Object.assign(this, { process, pipe, profile, spare: null });
  }

  send(method, params, sessionId) { return this.pipe.send(method, params, sessionId); }

  on(listener) { this.pipe.on(listener); }

  // The tab Chrome opened at start (about:blank): the first page uses it instead of a new one.
  takeSpare() {
    const spare = this.spare;
    this.spare = null;
    return spare;
  }

  // Every page is done by now and its files written, so the browser is stopped outright rather
  // than asked to shut down, which takes it about 100 ms; its child processes go with it. Then
  // its profile is removed.
  async close() {
    const child = this.process;
    child.removeAllListeners('exit');
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000).unref())]);
    for (const stream of [child.stdio[3], child.stdio[4], child.stdio[2]]) stream.destroy();
    child.unref();
    try {
      fs.rmSync(this.profile, { recursive: true, force: true });
    } catch {}
  }
}

export async function launch() {
  const executable = findBrowser();
  if (!executable) throw new Error(BROWSER_HINT);
  const base = tempBase(), profile = fs.mkdtempSync(path.join(base, 'graphally-'));
  const env = base !== os.tmpdir() ? { env: { ...process.env, TMPDIR: base } } : {};
  const child = spawn(executable, argsFor(profile), { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], ...env });
  const errors = lastErrors(child.stdio[2]), pipe = new DevtoolsPipe(child.stdio[3], child.stdio[4]);
  // The install hint helps only when the browser could not be started; an exit is the browser's own error.
  child.on('error', error => pipe.fail(new Error(`could not start ${executable}: ${error.message}${errors()}\n${BROWSER_HINT}`)));
  child.on('exit', code => pipe.fail(new Error(`the browser (${executable}) exited (code ${code})${errors()}`)));
  await pipe.send('Browser.getVersion');
  const browser = new Browser(child, pipe, profile);
  const { targetInfos = [] } = await pipe.send('Target.getTargets').catch(() => ({}));
  browser.spare = targetInfos.find(target => target.type === 'page')?.targetId || null;
  return browser;
}
