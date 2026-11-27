// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The display fonts' files: downloaded once from Fontsource into the skill's assets/fonts/ (or a
// user cache when the skill folder is read-only), as the icon packs are, and served to the page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { facesFor, fontUrl } from './fonts.js';
import { download } from './icon-packs/download.mjs';

export function fontDirs(skillRoot) {
  const cache = process.env.XDG_CACHE_HOME
    || (process.platform === 'win32' ? process.env.LOCALAPPDATA : null)
    || path.join(os.homedir(), '.cache');
  return [path.join(skillRoot, 'assets/fonts'), path.join(cache, 'graphally/fonts')];
}

// A face is known when its file, or the note that Fontsource has none (a script the family lacks), is there.
const known = (skillRoot, face) => fontDirs(skillRoot)
  .some(dir => fs.existsSync(path.join(dir, face.file)) || fs.existsSync(path.join(dir, `${face.file}.none`)));

function writableDir(skillRoot) {
  for (const dir of fontDirs(skillRoot)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {}
  }
  throw new Error('no writable place for fonts (tried the skill folder and the user cache)');
}

// The faces the files name in <diagram fonts="…">, their scripts chosen from the files' text.
function facesIn(files) {
  const faces = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const values = [...source.matchAll(/<diagram\b[^>]*\sfonts\s*=\s*"([^"]*)"/gi)].map(match => match[1]);
    values.flatMap(value => facesFor(value, source)).forEach(face => faces.set(face.file, face));
  }
  return [...faces.values()];
}

// One face; a face Fontsource does not have is noted, so it is not asked for again.
async function fetchFace(dir, face) {
  const file = path.join(dir, face.file);
  try {
    await download([[fontUrl(face), file]]);
  } catch (error) {
    fs.rmSync(file, { force: true });
    if (/\b404\b|returned error/.test(error.message)) fs.writeFileSync(`${file}.none`, '');
    return false;
  }
  return true;
}

// Downloads the faces the files name that are not here yet. Offline, the text falls back to the
// theme's font and the render says so.
export async function ensureFonts(skillRoot, files, log) {
  const missing = facesIn(files).filter(face => !known(skillRoot, face));
  if (!missing.length || process.env.GRAPHALLY_OFFLINE) return;
  const dir = writableDir(skillRoot), families = [...new Set(missing.map(face => face.family))];
  log(`graphally: downloading the fonts ${families.join(', ')} (first use only)`);
  for (const face of missing) await fetchFace(dir, face);
}

// The faces here, as the server serves them: /fonts/<file>.
export function servedFonts(skillRoot) {
  const entries = fontDirs(skillRoot).filter(dir => fs.existsSync(dir)).flatMap(dir => fs.readdirSync(dir)
    .filter(file => file.endsWith('.woff2')).map(file => [`/fonts/${file}`, path.join(dir, file)]));
  return Object.fromEntries(entries.reverse());
}
