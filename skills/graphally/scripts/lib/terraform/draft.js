// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The draft as it is built: the configuration, and what each stage adds. items: address to the
// item drawn for it, { resource, id, label, kind, icon, sku, details, count }; parentOf: the item
// it sits in; boxes: the items drawn as boxes; links: { from, to, label, op }.

export function createDraft(config) {
  const { resources } = config;
  const draft = {
    config, resources,
    items: new Map(), ids: new Set(), parentOf: new Map(), boxes: new Set(), links: [],
    notes: { folded: {}, skipped: [] },
    item: address => draft.items.get(address),
    // The resources a resource references by attributes whose key matches.
    refsOf: (resource, key) => resource.refs.filter(ref => key.test(ref.key)).map(ref => resources.get(ref.to)),
    // What was folded into links and labels, counted for the summary.
    fold: what => { draft.notes.folded[what] = (draft.notes.folded[what] || 0) + 1; },
  };
  return draft;
}
