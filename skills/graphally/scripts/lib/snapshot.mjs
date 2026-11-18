// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The layout of a compiled SVG, read back from its elements: every group and node wrapper
// carries data-box="x,y,w,h", every edge line data-sides="out,in", and overrides appear as
// data-nudge, data-out and data-in. The next render keeps the layout stable with it.
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrsOf = tag => Object.fromEntries([...tag.matchAll(/\s([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, unesc(v)]));
const nums = v => v.split(',').map(Number);

// What each kind of group adds to the layout. A group or a node is a layout found.
function readGroup(attributes, layout) {
  if (!attributes['data-group'] || !attributes['data-box']) return false;
  layout.groups[attributes['data-group']] = nums(attributes['data-box']);
  return true;
}

function readNode(attributes, layout) {
  const id = attributes['data-id'];
  if (!id || !attributes['data-box']) return false;
  layout.nodes[id] = nums(attributes['data-box']);
  if (attributes['data-nudge']) layout.overrides.nodes[id] = { nudge: nums(attributes['data-nudge']) };
  return true;
}

// An edge's sides and the sides fixed by the author; edges alone are no layout.
function readEdge(attributes, layout) {
  const key = attributes['data-edge'];
  if (!key || !attributes['data-sides']) return;
  const [out, inn] = attributes['data-sides'].split(',');
  layout.edges[key] = { out, in: inn };
  const fixed = Object.fromEntries(['out', 'in'].filter(end => attributes[`data-${end}`]).map(end => [end, attributes[`data-${end}`]]));
  if (Object.keys(fixed).length) layout.overrides.edges[key] = fixed;
}

// readLayout(svgText) -> { id, source, nodes, groups, edges, overrides: { nodes, edges } },
// or null when the SVG carries no layout (not a graphally render, or an older one).
export function readLayout(svg) {
  const root = attrsOf((svg.match(/<svg\b[^>]*>/) || [''])[0]);
  const layout = { id: root['data-diagram'] || '', source: root['data-source'] || '', nodes: {}, groups: {}, edges: {}, overrides: { nodes: {}, edges: {} } };
  let found = false;
  for (const [tag] of svg.matchAll(/<g\b[^>]*\sdata-(?:id|group|edge)="[^>]*>/g)) {
    const attributes = attrsOf(tag);
    if (readGroup(attributes, layout) || readNode(attributes, layout)) found = true;
    else readEdge(attributes, layout);
  }
  return found ? layout : null;
}
