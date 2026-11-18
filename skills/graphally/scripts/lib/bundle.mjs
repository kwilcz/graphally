// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The browser side of the CLI as one module: run.js and every module it imports, directly or
// not, each in a scope of its own, in the order the browser would evaluate them. The page then
// loads one module instead of sixty, each of which would cost it a fetch and a link on every
// render. It is built each time the CLI serves it, so it is always the code on disk.
//
// The modules keep to the forms read here: import { a, b as c } from './x.js'; export function,
// class, or const with one name; export { a } from './x.js'; relative paths, no cycles. A name
// imported that its module does not export in these forms stops the bundle with an error.
import fs from 'node:fs';
import path from 'node:path';

const REQUEST = /^(?:import|export)\s*\{[^}]*\}\s*from\s*'(\.{1,2}\/[^']+\.js)';?/gm;
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'(\.{1,2}\/[^']+\.js)';?/gm;
const REEXPORT = /^export\s*\{([^}]*)\}\s*from\s*'(\.{1,2}\/[^']+\.js)';?/gm;
const DECLARATION = /^export\s+((?:async\s+)?(?:function\*?|const|class)\s+([A-Za-z_$][\w$]*))/gm;

const resolve = (from, specifier) => path.posix.join(path.posix.dirname(from), specifier);

// The names of an import or export list: { a, b as c } as [{ name: 'a', alias: 'a' }, …].
const namesOf = list => list.split(',').map(part => part.trim()).filter(Boolean).map(part => {
  const [name, alias = name] = part.split(/\s+as\s+/);
  return { name, alias };
});

// The modules in evaluation order: each after the modules it imports, in the order it imports them.
function modulesFrom(folder, entry) {
  const seen = new Set(), ordered = new Map();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(path.join(folder, file), 'utf8');
    for (const [, specifier] of source.matchAll(REQUEST)) visit(resolve(file, specifier));
    ordered.set(file, source);
  };
  visit(entry);
  return ordered;
}

// The bindings a module imports from another, checked against what that module exports.
function importedNames(file, list, from, exportsOf) {
  return namesOf(list).map(binding => {
    if (!exportsOf.get(from).includes(binding.name)) {
      throw new Error(`bundle: ${file} imports ${binding.name}, which ${from} does not export`);
    }
    return binding;
  });
}

// A module's code with its imports read from the modules before it, and what it exports: its
// names, and the properties of the object the bundle keeps for it. exportsOf holds the names of
// the modules before it.
function scoped(file, source, table, exportsOf) {
  const names = [], properties = [];
  const moduleOf = from => `${table}[${JSON.stringify(from)}]`;
  const importing = (list, specifier) => importedNames(file, list, resolve(file, specifier), exportsOf);
  const imports = (_, list, specifier) => {
    const bindings = importing(list, specifier).map(({ name, alias }) => (alias === name ? name : `${name}: ${alias}`));
    return `const { ${bindings.join(', ')} } = ${moduleOf(resolve(file, specifier))};`;
  };
  const reexports = (_, list, specifier) => {
    for (const { name, alias } of importing(list, specifier)) {
      names.push(alias);
      properties.push(`${alias}: ${moduleOf(resolve(file, specifier))}.${name}`);
    }
    return '';
  };
  const declarations = (_, declaration, name) => {
    names.push(name);
    properties.push(name);
    return declaration;
  };
  const code = source.replace(IMPORT, imports).replace(REEXPORT, reexports).replace(DECLARATION, declarations);
  return { code, names, properties };
}

// The entry stays at the top level of the bundle, where it may await.
export function bundle(folder, entry) {
  const table = 'graphallyModules', chunks = [`const ${table} = {};`], exportsOf = new Map();
  for (const [file, source] of modulesFrom(folder, entry)) {
    const { code, names, properties } = scoped(file, source, table, exportsOf);
    exportsOf.set(file, names);
    if (file === entry) chunks.push(code);
    else {
      const body = `${code}\nreturn { ${properties.join(', ')} };`;
      chunks.push(`// ${file}\n${table}[${JSON.stringify(file)}] = (() => {\n${body}\n})();`);
    }
  }
  return chunks.join('\n');
}
