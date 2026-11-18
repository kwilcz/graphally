// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The draft as the diagram's page: boxes and figures nested as the containment says. Inside a
// box, what uses comes before what is used (apps, then Key Vault and App Insights, then Log
// Analytics), so links run one way down the stack.
import { listAt } from '../engine/shared/maps.js';
import { azureType } from './azure.js';
import { cidrOf } from './values.js';

export const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const NETWORK_RANK = { resource_group: 0, virtual_network: 1, subnet: 2 };
const HUB_LABEL = /GatewaySubnet|AzureFirewallSubnet|AzureBastionSubnet/;
const HUB_TYPE = /firewall$|virtual_network_gateway$|bastion_host$/;

// For each sibling, the siblings that link to it (or to what is inside it).
function predecessorsOf(draft, list, within) {
  const descendants = new Map(list.map(child => [child.resource.addr, within(child.resource.addr)]));
  const sibling = address => list.find(child => descendants.get(child.resource.addr).has(address))?.resource.addr;
  const before = new Map(list.map(child => [child.resource.addr, new Set()]));
  for (const link of draft.links.filter(each => each.op !== '<->')) {
    const from = sibling(link.from), to = sibling(link.to);
    if (from && to && from !== to) before.get(to).add(from);
  }
  return before;
}

// How many steps of links lead to each sibling; a loop counts as none.
function rankSiblings(list, before, ranks) {
  const memo = new Map(), busy = new Set();
  const rank = address => {
    if (memo.has(address)) return memo.get(address);
    if (busy.has(address)) return 0;
    busy.add(address);
    const value = Math.max(0, ...[...before.get(address)].map(other => rank(other) + 1));
    busy.delete(address);
    memo.set(address, value);
    return value;
  };
  for (const child of list) ranks.set(child.resource.addr, rank(child.resource.addr));
}

// Each item's place in the flow among its siblings.
function flowRanks(draft, children, within) {
  const ranks = new Map();
  for (const list of children.values()) rankSiblings(list, predecessorsOf(draft, list, within), ranks);
  return ranks;
}

// The sort key of an item among its siblings. Network boxes keep source order (subnets in
// address order, as written); the rest follow the flow.
function siblingOrder(items, ranks) {
  const position = new Map([...items.keys()].map((address, index) => [address, index]));
  return item => {
    const rank = NETWORK_RANK[azureType(item.resource)];
    return (rank ?? 3) * 1e6
      + (rank !== undefined ? 0 : (ranks.get(item.resource.addr) || 0) * 1e3)
      + position.get(item.resource.addr);
  };
}

function createLayout(draft, icons) {
  const { items, boxes } = draft, children = new Map();
  for (const item of items.values()) {
    const parent = draft.parentOf.get(item.resource.addr);
    listAt(children, parent && items.has(parent) ? parent : '__root').push(item);
  }
  const within = address => {
    const found = new Set([address]);
    for (const child of children.get(address) || []) within(child.resource.addr).forEach(each => found.add(each));
    return found;
  };
  const ranks = flowRanks(draft, children, within), orderOf = siblingOrder(items, ranks);
  return {
    draft, ranks, within, lines: [],
    isBox: item => boxes.has(item.resource.addr),
    childrenOf: address => [...(children.get(address) || [])].sort((a, b) => orderOf(a) - orderOf(b)),
    iconTag: name => (name && (!icons || icons(name)) ? `<icon name="${escapeHtml(name)}"></icon>` : ''),
  };
}

const joined = parts => parts.filter(Boolean).join(' · ');

// A box's heading detail: a VNet's address space, a subnet's prefixes, another box's kind.
function boxDetail(item, type, detail) {
  const { body } = item.resource;
  if (type === 'virtual_network') return joined([cidrOf(body.attrs.address_space, item.resource), detail]);
  if (type === 'subnet') {
    const prefixes = body.attrs.address_prefixes || body.attrs.address_prefix;
    return joined([cidrOf(prefixes, item.resource), ...item.details]);
  }
  return type === 'resource_group' ? detail : joined([item.kind, detail]);
}

function writeBox(layout, item, depth, children, detail) {
  const { lines, isBox, iconTag } = layout, pad = '  '.repeat(depth), type = azureType(item.resource);
  const kind = { virtual_network: 'group vnet', subnet: 'group subnet' }[type] || 'group';
  const heading = boxDetail(item, type, detail), icon = type === 'subnet' ? '' : item.icon;
  const vnets = children.filter(child => azureType(child.resource) === 'virtual_network');
  const loose = children.filter(child => !isBox(child));
  // A resource group with VNets: the VNets side by side, then its other resources in a column
  // to their right, next to what they connect to.
  const group = type === 'resource_group', column = group && vnets.length && loose.length > 1;
  let wrap = '';
  if (vnets.length > 1 || (group && vnets.length && children.length > 1)) wrap = 'flex items-start gap-16';
  else if (children.length > 5 && group) wrap = 'grid grid-cols-2 gap-x-16 gap-y-[18px]';
  const small = heading ? ` <small>${escapeHtml(heading)}</small>` : '';
  lines.push(`${pad}<div class="${kind}" id=${item.id}><h4>${iconTag(icon)}${escapeHtml(item.label)}${small}</h4>`);
  const inner = wrap ? depth + 2 : depth + 1, columnPad = `${pad}${wrap ? '    ' : '  '}`;
  if (wrap) lines.push(`${pad}  <div class="${wrap}">`);
  children.filter(child => !column || !loose.includes(child)).forEach(child => writeItem(layout, child, inner));
  if (column) {
    lines.push(`${columnPad}<div class="group plain" id=${item.id}_services>`);
    loose.forEach(child => writeItem(layout, child, inner + 1));
    lines.push(`${columnPad}</div>`);
  }
  if (wrap) lines.push(`${pad}  </div>`);
  lines.push(`${pad}</div>`);
}

// A figure's kind, with how many there are: ×N for a for_each, ×3 for a count of 3.
function countedKind({ kind, count }) {
  if (count === 'each' || count === 'N') return `${kind} ×N`;
  return Number.isFinite(count) ? `${kind} ×${count}` : kind;
}

function writeFigure(layout, item, depth, detail) {
  const kind = countedKind(item);
  const small = joined([kind, detail]), external = item.resource.type === 'module' ? ' external' : '';
  const smallTag = small ? `<small>${escapeHtml(small)}</small>` : '';
  const label = `${layout.iconTag(item.icon)}${escapeHtml(item.label)}${smallTag}`;
  layout.lines.push(`${'  '.repeat(depth)}<div class="figure${external}" id=${item.id}>${label}</div>`);
}

function writeItem(layout, item, depth) {
  const detail = joined([item.sku, ...item.details]);
  if (layout.isBox(item)) writeBox(layout, item, depth, layout.childrenOf(item.resource.addr), detail);
  else writeFigure(layout, item, depth, detail);
}

// A hub: a gateway, firewall or bastion inside.
function isHub(layout, item) {
  return [...layout.within(item.resource.addr)].some(address => {
    const inside = layout.draft.items.get(address);
    return HUB_LABEL.test(inside?.label || '') || HUB_TYPE.test(inside?.resource.type || '');
  });
}

// The page's lines. Top-level boxes: the first in the flow on the left, the boxes it reaches
// stacked on the right, so links from it to each are short (app | network / app | data). Two
// resource groups: one above the other, the hub (gateways, firewall) on top, so peering runs
// straight down instead of across the other group's services.
export function pageLines(draft, icons) {
  const layout = createLayout(draft, icons), { lines } = layout;
  const top = layout.childrenOf('__root'), allBoxes = top.every(item => layout.isBox(item));
  const firsts = top.filter(item => (layout.ranks.get(item.resource.addr) || 0) === 0);
  let outer = 'flex flex-wrap items-start gap-20', lead = null;
  if (top.length >= 3 && top.length <= 5 && firsts.length === 1 && allBoxes) {
    outer = 'flex items-start gap-20';
    [lead] = firsts;
  } else if (top.length === 2 && allBoxes) {
    if (isHub(layout, top[1]) && !isHub(layout, top[0])) top.reverse();
    outer = 'flex flex-col items-start gap-14';
  }
  lines.push(`<div class="${outer}">`);
  if (lead) {
    writeItem(layout, lead, 1);
    lines.push('  <div class="flex flex-col items-start gap-14">');
    top.filter(item => item !== lead).forEach(item => writeItem(layout, item, 2));
    lines.push('  </div>');
  } else {
    for (const item of top) writeItem(layout, item, 1);
  }
  lines.push('</div>');
  return lines;
}
