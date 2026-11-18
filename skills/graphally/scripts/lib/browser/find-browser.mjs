// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where Chrome, Chromium or Edge is installed: a path from the environment, the usual install
// places, the PATH, or a browser downloaded by Playwright, in that order.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BROWSER_HINT = 'graphally needs Chrome, Chromium or Edge. Install one, run `npx playwright install chromium`, or set CHROMIUM_PATH to a browser executable.';

const isFile = file => {
  try {
    return Boolean(file) && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

const fromEnvironment = () => ['CHROMIUM_PATH', 'CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH'].map(name => process.env[name]);

function fromInstallPlaces() {
  if (process.platform === 'darwin') {
    const app = name => `/Applications/${name}.app/Contents/MacOS/${name}`;
    return [app('Google Chrome'), app('Chromium'), app('Microsoft Edge'), path.join(os.homedir(), app('Google Chrome').slice(1))];
  }
  if (process.platform !== 'win32') return [];
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const inside = ['Google/Chrome/Application/chrome.exe', 'Chromium/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe'];
  return roots.flatMap(root => inside.map(file => path.join(root, file)));
}

// On the PATH, looked up here rather than by running `which` once per name.
function fromPath() {
  if (process.platform === 'win32') return [];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge', 'microsoft-edge-stable'];
  return names.flatMap(name => dirs.map(dir => path.join(dir, name)));
}

const PLAYWRIGHT_BINARIES = [
  'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe',
];

// The chromium-<build> folders of a Playwright cache, newest first.
function chromiumBuilds(dir) {
  try {
    return fs.readdirSync(dir).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => b.split('-')[1] - a.split('-')[1]);
  } catch {
    return [];
  }
}

// Browsers downloaded by Playwright (`npx playwright install chromium`), newest first.
function fromPlaywright() {
  const home = os.homedir();
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(home, '.cache/ms-playwright'),
    path.join(home, 'Library/Caches/ms-playwright'), path.join(home, 'AppData/Local/ms-playwright')].filter(Boolean);
  return caches.flatMap(dir => chromiumBuilds(dir).flatMap(build => PLAYWRIGHT_BINARIES.map(file => path.join(dir, build, file))));
}

export function findBrowser() {
  for (const candidates of [fromEnvironment, fromInstallPlaces, fromPath, fromPlaywright]) {
    const found = candidates().find(isFile);
    if (found) return found;
  }
  return null;
}
