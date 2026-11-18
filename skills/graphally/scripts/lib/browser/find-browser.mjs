// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where Chrome, Chromium or Edge is installed, on Linux, macOS and Windows: a path from the
// environment, the platform's install places, the PATH, or a browser downloaded by Playwright,
// in that order.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BROWSER_HINT = 'graphally needs Chrome, Chromium or Edge.' +
  ' Install one, run `npx playwright install chromium`, or set CHROMIUM_PATH to a browser executable.';

const BROWSER_PATH_VARIABLES = ['CHROMIUM_PATH', 'CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH'];
const UNIX_NAMES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome',
  'microsoft-edge', 'microsoft-edge-stable',
];
const MAC_APPS = ['Google Chrome', 'Chromium', 'Microsoft Edge'];
const WINDOWS_FILES = [
  'Google/Chrome/Application/chrome.exe',
  'Chromium/Application/chrome.exe',
  'Microsoft/Edge/Application/msedge.exe',
];
const CHROME_FOR_TESTING = 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const unique = list => [...new Set(list.filter(Boolean))];

// Each platform: where its packages install a browser, the names it has on the PATH, the
// folders searched when the PATH lacks them (an editor or agent may start with a short one),
// and where Playwright keeps the browsers it downloads, with the executable inside each build.
const PLATFORMS = {
  linux: {
    installed: () => ['/opt/google/chrome/chrome', '/opt/microsoft/msedge/msedge'],
    names: UNIX_NAMES,
    standardDirs: ['/usr/bin', '/usr/local/bin', '/snap/bin'],
    playwrightCache: () => path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'ms-playwright'),
    playwrightBinaries: ['chrome-linux64/chrome', 'chrome-linux/chrome'],
  },
  darwin: {
    installed: () => ['/Applications', path.join(os.homedir(), 'Applications')]
      .flatMap(root => MAC_APPS.map(app => path.join(root, `${app}.app/Contents/MacOS/${app}`))),
    names: UNIX_NAMES,
    standardDirs: ['/opt/homebrew/bin', '/usr/local/bin'],
    playwrightCache: () => path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    playwrightBinaries: [
      `chrome-mac-arm64/${CHROME_FOR_TESTING}`, `chrome-mac-x64/${CHROME_FOR_TESTING}`,
      'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ],
  },
  win32: {
    installed: () => windowsProgramFolders().flatMap(root => WINDOWS_FILES.map(file => path.join(root, file))),
    names: ['chrome.exe', 'msedge.exe'],
    standardDirs: [],
    playwrightCache: () => path.join(windowsAppData(), 'ms-playwright'),
    playwrightBinaries: ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'],
  },
};

// Program Files (ProgramW6432 is the 64-bit one when Node itself is 32-bit), then the user's own.
function windowsProgramFolders() {
  const { env } = process;
  return unique([env.PROGRAMFILES, env.ProgramW6432, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]);
}

const windowsAppData = () => process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local');

// Other Unix systems (FreeBSD and the like) are searched as Linux is.
const platform = () => PLATFORMS[process.platform] ?? PLATFORMS.linux;

const isFile = file => {
  try {
    return Boolean(file) && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

const fromEnvironment = () => BROWSER_PATH_VARIABLES.map(name => process.env[name]);

const fromInstallPlaces = () => platform().installed();

// On the PATH, looked up here rather than by running `which` or `where` once per name.
function fromPath() {
  const { names, standardDirs } = platform();
  const onPath = (process.env.PATH || '').split(path.delimiter).map(dir => dir.replace(/"/g, ''));
  const dirs = unique([...onPath, ...standardDirs]);
  return names.flatMap(name => dirs.map(dir => path.join(dir, name)));
}

// The chromium-<build> folders of a Playwright cache, newest first.
function chromiumBuilds(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => b.split('-')[1] - a.split('-')[1]);
  } catch {
    return [];
  }
}

// Browsers downloaded by Playwright (`npx playwright install chromium`), newest build first.
// PLAYWRIGHT_BROWSERS_PATH=0 keeps them inside node_modules, where there is no one place to look.
function fromPlaywright() {
  const { playwrightCache, playwrightBinaries } = platform();
  const ownPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const caches = unique([ownPath !== '0' && ownPath, playwrightCache()]);
  return caches.flatMap(dir => chromiumBuilds(dir)
    .flatMap(build => playwrightBinaries.map(file => path.join(dir, build, file))));
}

export function findBrowser() {
  for (const candidates of [fromEnvironment, fromInstallPlaces, fromPath, fromPlaywright]) {
    const found = candidates().find(isFile);
    if (found) return found;
  }
  return null;
}
