// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where each item sits: a subnet in its VNet, a resource in the subnet it is deployed into, an
// app in its plan, a slot in its app, anything else in its resource group. What holds items is a
// box; so are VNets, subnets and resource groups, even empty.
import { literal } from './values.js';
import { azureType } from './azure.js';
import { idOf } from './items.js';

const SUBNET_KEY = /(^|\.)(subnet_id|vnet_subnet_id|infrastructure_subnet_id|delegated_subnet_id)$/;
const PLAN_KEY = /^service_plan_id$|^app_service_plan_id$/;
const ofAzureType = type => ref => ref && azureType(ref) === type;

function parentOf(draft, resource, type) {
  const { refsOf } = draft;
  let parent = null;
  if (type === 'subnet') parent = refsOf(resource, /^virtual_network_name$|^virtual_network_id$/)[0];
  if (!parent) parent = refsOf(resource, SUBNET_KEY).filter(ofAzureType('subnet'))[0];
  if (!parent && /web_app|function_app/.test(type)) parent = refsOf(resource, PLAN_KEY)[0];
  if (!parent && /_slot$/.test(type)) parent = refsOf(resource, /^app_service_id$/)[0];
  if (!parent) parent = refsOf(resource, /^resource_group_name$/).find(ofAzureType('resource_group'));
  return parent;
}

// A resource group named only as a literal: a box of its own, made once.
function literalGroup(draft, resource) {
  const name = literal(resource.body.attrs.resource_group_name, resource.scope);
  if (!name) return null;
  const key = `rg:${name}`;
  if (!draft.items.has(key)) {
    const group = { addr: key, type: 'azurerm_resource_group', refs: [], body: { attrs: {} }, scope: resource.scope };
    const id = idOf(draft, { type: 'azurerm_resource_group', name, scope: resource.scope });
    draft.items.set(key, { resource: group, id, label: name, kind: 'Resource group', icon: 'rg', details: [] });
  }
  return key;
}

// The box a resource is drawn in: its parent, when that is drawn; with no parent, a resource group
// named as a literal. A resource group itself has none.
function holderOf(draft, resource, type, parent) {
  if (parent) return draft.items.has(parent.addr) ? parent.addr : null;
  return type !== 'resource_group' ? literalGroup(draft, resource) : null;
}

function placeItem(draft, { resource }) {
  const type = azureType(resource), parent = parentOf(draft, resource, type);
  const holder = holderOf(draft, resource, type, parent);
  if (!holder) return;
  draft.parentOf.set(resource.addr, holder);
  draft.boxes.add(holder);
}

const ALWAYS_BOXES = ['subnet', 'virtual_network', 'resource_group'];
const isAlwaysBox = item => ALWAYS_BOXES.includes(azureType(item.resource));

export function placeItems(draft) {
  // A literal resource group added here is visited too: it has no parent.
  for (const item of draft.items.values()) placeItem(draft, item);
  for (const item of draft.items.values()) if (isAlwaysBox(item)) draft.boxes.add(item.resource.addr);
}
