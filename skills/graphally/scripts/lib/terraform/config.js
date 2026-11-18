// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A Terraform configuration as read from its files: the root module and its local modules, each
// resource with its address, and the resources each one references.
import fs from 'node:fs';
import path from 'node:path';
import { parseHcl } from './hcl.js';
import { literal, collection } from './values.js';

const REFERENCE = /\b(data\.)?([a-z][a-z0-9]*_[a-z0-9_]+)\.([A-Za-z_][\w-]*)(?:\[\s*"([^"]*)"\s*\])?/g;

// What a module's locals, variable and output blocks add to its scope.
const SCOPE_BLOCKS = {
  locals: (scope, block) => Object.assign(scope.locals, block.attrs),
  variable: (scope, block) => { scope.vars[block.labels[0]] = block.attrs; },
  output: (scope, block) => { scope.outputs[block.labels[0]] = block.attrs.value || ''; },
};

// The blocks of a module's .tf files, in file order: its scope filled in, its resources and data
// sources, and the modules it calls.
function readModule(dir, scope) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(file => file.endsWith('.tf')).sort() : [];
  const blocks = files.flatMap(file => parseHcl(fs.readFileSync(path.join(dir, file), 'utf8')).blocks.map(block => [block, file]));
  for (const [block] of blocks) if (Object.hasOwn(SCOPE_BLOCKS, block.type)) SCOPE_BLOCKS[block.type](scope, block);
  return {
    resources: blocks.filter(([block]) => block.type === 'resource' || block.type === 'data'),
    calls: blocks.filter(([block]) => block.type === 'module').map(([block]) => block),
  };
}

const isLocalSource = source => source && (source.startsWith('./') || source.startsWith('../'));

// resources: address to resource, in the order they are written. expanded: the address of a
// for_each over a literal map or set to its instances' addresses ("snet-aks", "snet-db"…).
class Config {
  constructor() {
    this.resources = new Map();
    this.expanded = new Map();
    this.modules = [];
  }

  load(dir, prefix, args, parent, name) {
    const scope = { prefix, args, parent, locals: {}, outputs: {}, vars: {}, dir, name };
    this.modules.push(scope);
    const { resources, calls } = readModule(dir, scope);
    for (const [block, file] of resources) this.addResource(block, path.join(dir, file), scope);
    for (const call of calls) this.addCall(call, dir, scope);
  }

  addResource(block, file, scope) {
    const [type, name] = block.labels, data = block.type === 'data';
    const address = `${scope.prefix}${data ? 'data.' : ''}${type}.${name}`;
    const resource = { addr: address, type, name, data, body: block, scope, file };
    const keys = block.attrs.for_each ? collection(block.attrs.for_each, scope) : null;
    if (!keys?.length) {
      this.resources.set(address, resource);
      return;
    }
    const instance = key => `${address}["${key.key}"]`;
    this.expanded.set(address, keys.map(instance));
    for (const key of keys) this.resources.set(instance(key), { ...resource, addr: instance(key), name: `${name}_${key.key}`, each: key });
  }

  // A local module is read as part of the configuration; a remote one is one resource.
  addCall(call, dir, scope) {
    const source = literal(call.attrs.source), [name] = call.labels, address = `${scope.prefix}module.${name}`;
    if (isLocalSource(source)) this.load(path.resolve(dir, source), `${address}.`, call.attrs, scope, name);
    else this.resources.set(address, { addr: address, type: 'module', name, remote: source, body: call, scope, file: '' });
  }
}

export function loadConfig(root) {
  const config = new Config();
  config.load(path.resolve(root), '', {}, null, '');
  return { resources: config.resources, expanded: config.expanded, modules: config.modules };
}

// The resources an expression names directly; a for_each resource is its instances, or the one
// it picks by key.
function directReferences({ resources, expanded }, raw, scope) {
  return [...raw.matchAll(REFERENCE)].flatMap(([, data, type, name, key]) => {
    const address = `${scope.prefix}${data || ''}${type}.${name}`, instances = expanded.get(address);
    const own = resources.has(address) ? [address] : [];
    if (!instances) return own;
    const one = `${address}["${key}"]`;
    return [...own, ...(key !== undefined && resources.has(one) ? [one] : instances)];
  });
}

// Every resource an expression points at, following var., local. and module outputs.
function referencesIn(config, raw, scope, seen = new Set()) {
  const found = new Set(), key = `${scope.prefix}|${raw}`;
  if (!raw || seen.size > 40 || seen.has(key)) return found;
  seen.add(key);
  const add = addresses => addresses.forEach(address => found.add(address));
  const follow = (expression, inScope) => add(referencesIn(config, expression, inScope, seen));
  add(directReferences(config, raw, scope));
  for (const [, name] of raw.matchAll(/\bvar\.([\w-]+)/g)) if (scope.args[name] !== undefined && scope.parent) follow(scope.args[name], scope.parent);
  for (const [, name] of raw.matchAll(/\blocal\.([\w-]+)/g)) if (scope.locals[name] !== undefined) follow(scope.locals[name], scope);
  for (const [, module, output] of raw.matchAll(/\bmodule\.([\w-]+)\.([\w-]+)/g)) {
    const child = config.modules.find(each => each.prefix === `${scope.prefix}module.${module}.`);
    if (child && child.outputs[output] !== undefined) follow(child.outputs[output], child);
    else if (config.resources.has(`${scope.prefix}module.${module}`)) add([`${scope.prefix}module.${module}`]);
  }
  return found;
}

// Every attribute of a block, nested blocks flattened to dotted keys.
function attributesOf(body, prefix = '') {
  const own = Object.entries(body.attrs).map(([key, value]) => [prefix + key, value]);
  return [...own, ...body.blocks.flatMap(block => attributesOf(block, `${prefix}${block.type}.`))];
}

// A resource's references: { key, to, raw } for every attribute that points at another.
function referencesOf(config, resource) {
  if (resource.type === 'module') return [];
  return attributesOf(resource.body).flatMap(([key, value]) => [...referencesIn(config, value, resource.scope)]
    .filter(address => address !== resource.addr)
    .map(address => ({ key, to: address, raw: value })));
}

export function addReferences(config) {
  for (const resource of config.resources.values()) resource.refs = referencesOf(config, resource);
}
