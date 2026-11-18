// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The links: plumbing resources (associations, peerings, role assignments, diagnostic settings)
// fold into the links and labels they stand for, and every other reference between items becomes
// a link, except those the containment already shows.
import { literal } from './values.js';
import { KIND, USE, isAzure, azureType } from './azure.js';

// A link between two items, once: a later label replaces a missing or weak one. op is -> for a
// use, <-> for both ways, -- for no direction, ~> for a dashed one.
function addLink(draft, from, to, label, op = '->') {
  if (!from || !to || from === to || !draft.item(from) || !draft.item(to)) return;
  const same = draft.links.find(link => (link.from === from && link.to === to)
    || (op === '<->' && link.from === to && link.to === from));
  if (!same) {
    draft.links.push({ from, to, label, op });
  } else if (label && (!same.label || same.weak)) {
    same.label = label;
    same.weak = false;
  }
}

const linkBetween = (draft, from, to, label, op) => addLink(draft, from?.addr, to?.addr, label, op);

// An NSG association shows as "NSG" on its subnet; the NSG itself may then need no box.
function foldNsgAssociation(draft, resource, usedNsgs) {
  const [subnet] = draft.refsOf(resource, /^subnet_id$/), [nsg] = draft.refsOf(resource, /^network_security_group_id$/);
  if (subnet && draft.item(subnet.addr)) draft.item(subnet.addr).details.push('NSG');
  if (nsg) usedNsgs.add(nsg.addr);
  draft.fold('NSG associations');
}

// A route table association draws the route itself: subnet to the next hop, if the route table
// names one (the table then needs no box); else subnet to the table.
function foldRouteTableAssociation(draft, resource) {
  const [subnet] = draft.refsOf(resource, /^subnet_id$/), [table] = draft.refsOf(resource, /^route_table_id$/);
  draft.fold('route table associations');
  if (!subnet || !table) return;
  const hop = table.refs.find(ref => /next_hop/.test(ref.key));
  if (!hop || !draft.item(hop.to)) {
    linkBetween(draft, subnet, table, 'routes');
    return;
  }
  const prefix = literal(table.body.blocks.find(block => block.type === 'route')?.attrs.address_prefix);
  addLink(draft, subnet.addr, hop.to, `UDR ${prefix || ''}`.trim());
  draft.items.delete(table.addr);
}

// A plumbing resource that is one link between two of the resources it references.
const linkFolder = (fromKey, toKey, label, op, folded) => (draft, resource) => {
  const [from] = draft.refsOf(resource, fromKey), [to] = draft.refsOf(resource, toKey);
  if (from && to) linkBetween(draft, from, to, typeof label === 'function' ? label(resource, to) : label, op);
  draft.fold(folded);
};

// "Key Vault Secrets User" on a link into a Key Vault reads "Secrets User".
function roleOf(resource, scope) {
  const kind = KIND[azureType(scope || resource)]?.[0] || '';
  return literal(resource.body.attrs.role_definition_name, resource.scope)
    .replace(/^Azure\s+/, '')
    .replace(new RegExp(`^${kind.replace(/^Azure /, '')} +`, 'i'), '');
}

// A role assignment's link reads its role, or just "role".
const roleLabel = (resource, scope) => roleOf(resource, scope) || 'role';

const FOLDERS = {
  subnet_network_security_group_association: foldNsgAssociation,
  subnet_route_table_association: foldRouteTableAssociation,
  virtual_network_peering: linkFolder(
    /^virtual_network_name$/, /^remote_virtual_network_id$/, 'peering', '<->', 'peerings',
  ),
  private_dns_zone_virtual_network_link: linkFolder(
    /^private_dns_zone_name$/, /^virtual_network_id$/, 'VNet link', '--', 'DNS zone links',
  ),
  role_assignment: linkFolder(/^principal_id$/, /^scope$/, roleLabel, '->', 'role assignments'),
  monitor_diagnostic_setting: linkFolder(
    /^target_resource_id$/, /^log_analytics_workspace_id$|^storage_account_id$|^eventhub_authorization_rule_id$/,
    'diagnostics', '~>', 'diagnostic settings',
  ),
};
const SWIFT = linkFolder(/^app_service_id$/, /^subnet_id$/, 'VNet integration', '->', 'VNet integrations');

function folderOf(type) {
  if (Object.hasOwn(FOLDERS, type)) return FOLDERS[type];
  return /_swift_connection$/.test(type) ? SWIFT : null;
}

const refersTo = (item, address) => item.resource.refs.some(ref => ref.to === address);

// An NSG shown as "NSG" on its subnets needs no box of its own.
function dropUnusedNsgs(draft, usedNsgs) {
  const referenced = address => [...draft.items.values()].some(other => refersTo(other, address));
  for (const address of [...usedNsgs].filter(each => !referenced(each))) draft.items.delete(address);
}

export function foldPlumbing(draft) {
  const usedNsgs = new Set();
  for (const resource of draft.resources.values()) {
    const fold = isAzure(resource) && !resource.data ? folderOf(azureType(resource)) : null;
    if (fold) fold(draft, resource, usedNsgs);
  }
  dropUnusedNsgs(draft, usedNsgs);
}

// References the containment already shows, or that say nothing (a location, a name).
const CONTAINED = new RegExp(`(^|\\.)(${[
  'resource_group_name', 'location', 'virtual_network_name', 'service_plan_id', 'app_service_plan_id', 'tenant_id',
  'subnet_id', 'vnet_subnet_id', 'infrastructure_subnet_id', 'delegated_subnet_id', 'app_service_id', 'server_id',
  'private_dns_zone_ids', 'public_ip_address_id', 'network_interface_ids', 'name',
].join('|')})$`);

// A reference as a link: some keys say what they are; else the target's use, or the key's own
// words, which are a weak label a later one replaces.
function linkReference(draft, from, ref) {
  const link = label => addLink(draft, from, ref.to, label);
  if (/(^|\.)virtual_network_subnet_id$/.test(ref.key)) return link('VNet integration');
  if (/private_connection_resource_id$/.test(ref.key)) return link('private link');
  if (/^ingress_application_gateway\.gateway_id$/.test(ref.key)) return addLink(draft, ref.to, from, 'ingress');
  if (CONTAINED.test(ref.key)) return undefined;
  if (/next_hop/.test(ref.key)) return link('next hop');
  if (/^workspace_id$/.test(ref.key)) return link('workspace');
  const target = draft.resources.get(ref.to), use = USE[target ? azureType(target) : ''];
  link(use || ref.key.split('.').pop().replace(/_(id|name|ids|uri|url)$/, '').replace(/_/g, ' '));
  const last = draft.links.at(-1);
  if (last && !use) last.weak = true;
  return undefined;
}

// A reference to an item that is not the box it sits in.
const isDrawnReference = (draft, resource, ref) => draft.items.has(ref.to)
  && draft.parentOf.get(resource.addr) !== ref.to;

export function linkReferences(draft) {
  for (const { resource } of [...draft.items.values()]) {
    const drawn = resource.refs.filter(each => isDrawnReference(draft, resource, each));
    for (const ref of drawn) linkReference(draft, resource.addr, ref);
  }
}
