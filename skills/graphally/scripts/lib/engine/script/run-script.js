// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Runs an author's script with the given names in scope. An error becomes a problem that names
// the script's line, instead of a broken render.
export function runAuthorScript(code, scope, problems, details = {}) {
  try {
    new Function(...Object.keys(scope), code)(...Object.values(scope));
  } catch (error) {
    // Function() puts two lines of its own before the script's first.
    const line = String(error.stack || '').match(/<anonymous>:(\d+):\d+/);
    const where = line ? { line: Number(line[1]) - 2 } : {};
    problems.push({ rule: 'script-error', ...details, message: error.message, ...where });
  }
}
