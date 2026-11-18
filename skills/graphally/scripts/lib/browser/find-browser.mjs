// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where Chrome, Chromium or Edge is installed, on Linux, macOS and Windows: a path from the
// environment, the platform's install places, the PATH and then the folders it may lack, or a
// browser downloaded by Playwright, in that order. Within each step the places searched first
// are those that come first by convention, so the PATH, which the user sets, wins over the
// folders added as fallbacks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BROWSER_HINT = 'graphally needs Chrome, Chromium or Edge.' +
  ' Install one, run `npx playwright install chromium`, or set CHROMIUM_PATH to a browser executable.';

const BROWSER_PATH_VARIABLES = ['CHROMIUM_PATH', 'CHROME_PATH', 'PUPPETEER_EXECUTABLE_PATH'];
const UNIX_NAMES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome',
  'microsoft-edge', 'microsoft-edge-stable', 'msedge',
];
const MAC_APPS = ['Google Chrome', 'Chromium', 'Microsoft Edge'];
const WINDOWS_FILES = [
  'Google/Chrome/Application/chrome.exe',
  'Chromium/Application/chrome.exe',
  'Microsoft/Edge/Application/msedge.exe',
];
const CHROME_FOR_TESTING = 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const unique = list => [...new Set(list.filter(Boolean))];

// Each platform: where its installers put a browser, the names it has on the PATH, the
// folders searched after the PATH because it may lack them (an editor or agent may start with
// a short one), and where Playwright keeps the browsers it downloads, with the executable
// inside each build. Linux packages put Chrome and Edge in /opt, behind a link on the PATH.
const PLATFORMS = {
  linux: {
    installed: () => [],
    names: UNIX_NAMES,
    standardDirs: ['/usr/bin', '/usr/local/bin', '/snap/bin', '/opt/google/chrome', '/opt/microsoft/msedge'],
    playwrightCaches: () => [process.env.XDG_CACHE_HOME, path.join(os.homedir(), '.cache')]
      .filter(Boolean).map(dir => path.join(dir, 'ms-playwright')),
    playwrightBinaries: ['chrome-linux64/chrome', 'chrome-linux/chrome'],
  },
  darwin: {
    installed: () => ['/Applications', path.join(os.homedir(), 'Applications')]
      .flatMap(root => MAC_APPS.map(app => path.join(root, `${app}.app/Contents/MacOS/${app}`))),
    names: UNIX_NAMES,
    standardDirs: ['/opt/homebrew/bin', '/usr/local/bin'],
    playwrightCaches: () => [path.join(os.homedir(), 'Library/Caches/ms-playwright')],
    playwrightBinaries: [
      `chrome-mac-arm64/${CHROME_FOR_TESTING}`, `chrome-mac-x64/${CHROME_FOR_TESTING}`,
      'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ],
  },
  win32: {
    installed: () => windowsProgramFolders().flatMap(root => WINDOWS_FILES.map(file => path.join(root, file))),
    names: ['chrome.exe', 'msedge.exe'],
    standardDirs: [],
    playwrightCaches: () => windowsAppData().map(dir => path.join(dir, 'ms-playwright')),
    playwrightBinaries: ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'],
  },
};

// Program Files, the user's own programs, and last ProgramW6432: the 64-bit Program Files
// when Node itself is 32-bit.
function windowsProgramFolders() {
  const { env } = process;
  return unique([env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA, env.ProgramW6432]);
}

const windowsAppData = () => unique([process.env.LOCALAPPDATA, path.join(os.homedir(), 'AppData/Local')]);

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

const inDirs = (dirs, names) => names.flatMap(name => dirs.map(dir => path.join(dir, name)));

// On the PATH, looked up here rather than by running `which` or `where` once per name; then in
// the platform's usual folders that the PATH lacks.
function fromPath() {
  const { names, standardDirs } = platform();
  const onPath = unique((process.env.PATH || '').split(path.delimiter).map(dir => dir.replace(/"/g, '')));
  const missing = standardDirs.filter(dir => !onPath.includes(dir));
  return [...inDirs(onPath, names), ...inDirs(missing, names)];
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
  const { playwrightCaches, playwrightBinaries } = platform();
  const ownPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const caches = unique([ownPath !== '0' && ownPath, ...playwrightCaches()]);
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
