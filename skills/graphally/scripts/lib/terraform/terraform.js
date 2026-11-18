// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Terraform to graphally: read a Terraform configuration (root module plus local modules) and
// write a draft diagram of what it deploys. Resource groups become boxes, VNets and subnets nest
// inside them, resources sit in the subnet they are deployed into, and references between
// resources become links. Plumbing resources (associations, peerings, role assignments,
// diagnostic settings, child objects) fold into the links and labels they stand for, so the
// draft shows the architecture, not the HCL.
//
// Only what can be read without running Terraform is used: literal names, references, module
// inputs and outputs. for_each and count show as one node marked "×N" or "each".
import path from 'node:path';
import { loadConfig, addReferences } from './config.js';
import { createDraft } from './draft.js';
import { addItems, foldChildren, foldPublicIps } from './items.js';
import { placeItems } from './containment.js';
import { foldPlumbing, linkReferences } from './links.js';
import { pageLines, escapeHtml } from './page.js';

// Links with the same target, label and kind become one entry with a list of sources: drawn as
// a bundle with one label.
function connections(draft) {
  const merged = new Map();
  for (const link of draft.links) {
    const key = `${link.to}|${link.label}|${link.op}`;
    if (!merged.has(key)) merged.set(key, { ...link, froms: [] });
    merged.get(key).froms.push(link.from);
  }
  return [...merged.values()].map(link => {
    const from = link.froms.map(address => draft.item(address).id);
    return `  ${JSON.stringify({
      from: from.length > 1 ? from : from[0], to: draft.item(link.to).id,
      ...(link.label ? { label: link.label } : {}),
      ...(link.op === '<->' ? { both: true } : {}),
      ...(link.op === '~>' ? { dashed: true } : {}),
    })}`;
  });
}

// The data sources not drawn, but for the ones every configuration reads.
const skippedDataSources = config => [...config.resources.values()]
  .filter(resource => resource.data && !/client_config|subscription|tenant|role_definition/.test(resource.type))
  .map(resource => resource.addr);

function draftHtml(draft, lines, title, subtitle) {
  return `<diagram width=1600 title="${escapeHtml(title)}" subtitle="${escapeHtml(subtitle)}">\n${lines.join('\n')}\n`
    + `<script type="application/json">\n[\n${connections(draft).join(',\n')}\n]\n</script>\n</diagram>\n`;
}

function buildDraft(root) {
  const config = loadConfig(root);
  addReferences(config);
  const draft = createDraft(config);
  for (const stage of [addItems, foldChildren, foldPublicIps, placeItems, foldPlumbing, linkReferences]) stage(draft);
  return draft;
}

// A resource the configuration deploys: not a data source, not a module call.
const isPlainResource = resource => !resource.data && resource.type !== 'module';

// icons(name): whether an icon name is known, so the draft names only icons that draw.
export function terraformToDiagram(root, { title, icons } = {}) {
  const draft = buildDraft(root), { config } = draft, lines = pageLines(draft, icons);
  const resources = [...config.resources.values()].filter(isPlainResource).length;
  const modules = config.modules.length - 1;
  const subtitle = `From Terraform: ${resources} resources${modules ? ` in ${modules + 1} modules` : ''}`;
  const html = draftHtml(draft, lines, title || path.basename(path.resolve(root)), subtitle);
  draft.notes.skipped.push(...skippedDataSources(config));
  const boxes = [...draft.items.values()].filter(item => draft.boxes.has(item.resource.addr)).length;
  const summary = { groups: boxes, nodes: draft.items.size - boxes, links: draft.links.length, resources, modules };
  return { html, summary: { ...summary, folded: draft.notes.folded, skipped: draft.notes.skipped } };
}
