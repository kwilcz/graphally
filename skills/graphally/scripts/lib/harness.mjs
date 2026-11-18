// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The page the CLI renders in: harness.html, with a modulepreload link for every module run.js
// imports, directly or not, so the browser fetches them all at once instead of one level of
// imports at a time. The list is read from the imports each time the page is served.
import fs from 'node:fs';
import path from 'node:path';

const RELATIVE_IMPORT = /^(?:import|export)\b[^;]*?\bfrom\s*'(\.{1,2}\/[^']+\.js)'/gms;
const PLACEHOLDER = '<!-- module preloads -->';

// Every module an entry module imports, directly or not, as paths relative to the folder.
export function modulesImportedBy(folder, entry) {
  const found = new Set();
  const visit = file => {
    if (found.has(file)) return;
    found.add(file);
    const source = fs.readFileSync(path.join(folder, file), 'utf8');
    for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    }
  };
  visit(entry);
  return [...found];
}

export function harnessPage(libFolder) {
  const template = fs.readFileSync(path.join(libFolder, 'harness.html'), 'utf8');
  const preloads = modulesImportedBy(libFolder, 'run.js')
    .map(file => `<link rel="modulepreload" href="${file}">`);
  return template.replace(PLACEHOLDER, preloads.join('\n'));
}
