// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The items: the resources drawn, each with an id, a label, its kind and icon. Children fold into
// their parent's details ("Azure SQL · 2 databases"); a public IP into what uses it.
import { literal } from './values.js';
import { KIND, CHILD, CHILD_WORD, SKU_OF, IGNORE, PLUMBING, isAzure, azureType } from './azure.js';

// A short, unique id: the kind's prefix and the resource's name (kv_main); a name used twice
// takes its module's name before it.
export function idOf(draft, resource) {
  const type = azureType(resource);
  const short = KIND[type]?.[2] || type.split('_').map(word => word[0]).join('');
  let id = `${short}_${resource.name}`.replace(/[^\w-]/g, '_');
  if (draft.ids.has(id)) id = `${resource.scope.name || 'root'}_${id}`;
  while (draft.ids.has(id)) id += '_';
  draft.ids.add(id);
  return id;
}

export const labelOf = resource =>
  literal(resource.body.attrs.name, resource.scope, resource.each) || resource.name.replace(/_/g, '-');

// How many there are: a count, or each for a for_each.
function countOf({ body }) {
  if (body.attrs.count) return Number(body.attrs.count) || 'N';
  return body.attrs.for_each ? 'each' : null;
}

// A SKU only where it changes what the thing is, and only a short one.
function skuOf(resource, type) {
  const key = SKU_OF[type];
  if (!key) return '';
  const raw = key.includes('.') ? resource.body.blocks.find(block => block.type === 'sku')?.attrs.tier : resource.body.attrs[key];
  return literal(raw || '', resource.scope);
}

function itemOf(draft, resource) {
  if (resource.type === 'module') {
    const kind = `module ${resource.remote || ''}`.trim();
    return { resource, id: idOf(draft, resource), label: resource.name, kind, icon: 'repo', details: [] };
  }
  if (!isAzure(resource)) {
    return { resource, id: idOf(draft, resource), label: labelOf(resource), kind: resource.type.replace(/_/g, ' '), icon: '', details: [] };
  }
  const type = azureType(resource);
  if (IGNORE.test(type) || type in CHILD || PLUMBING.test(type)) return null;
  const kind = KIND[type], sku = skuOf(resource, type);
  return {
    resource, id: idOf(draft, resource), label: labelOf(resource),
    kind: kind ? kind[0] : type.replace(/_/g, ' '), icon: kind ? kind[1] : '',
    sku: sku.length <= 10 ? sku : '', details: [], count: countOf(resource),
  };
}

export function addItems(draft) {
  for (const resource of draft.resources.values()) {
    if (resource.data) continue;
    const item = itemOf(draft, resource);
    if (item) draft.items.set(resource.addr, item);
  }
}

// One child is named ("sqldb-orders", "work node pool"); several are counted ("2 databases").
const named = (name, word) => (name.toLowerCase().includes(word.split(' ')[0]) || /db|database/i.test(name) ? name : `${name} ${word}`);

export function foldChildren(draft) {
  const children = new Map();
  for (const resource of draft.resources.values()) {
    const type = azureType(resource);
    if (!(type in CHILD) || resource.data) continue;
    const key = CHILD[type];
    const parent = key ? draft.refsOf(resource, new RegExp(`^${key}$`))[0] : null;
    if (!parent || !draft.item(parent.addr)) continue;
    const word = CHILD_WORD[type] || type.replace(/_/g, ' ');
    const byWord = children.get(parent.addr) || new Map();
    byWord.set(word, [...(byWord.get(word) || []), labelOf(resource)]);
    children.set(parent.addr, byWord);
    draft.fold(`${word}s`);
  }
  for (const [address, byWord] of children) {
    for (const [word, names] of byWord) {
      draft.item(address).details.push(names.length === 1 ? named(names[0], word) : `${names.length} ${word}s`);
    }
  }
}

// A public IP folds into whatever uses it.
export function foldPublicIps(draft) {
  for (const item of [...draft.items.values()]) {
    if (azureType(item.resource) !== 'public_ip') continue;
    const address = item.resource.addr;
    const users = [...draft.items.values()].filter(other => other.resource.refs.some(ref => ref.to === address));
    if (!users.length) continue;
    users.forEach(user => user.details.push('public IP'));
    draft.items.delete(address);
    draft.fold('public IPs');
  }
}
