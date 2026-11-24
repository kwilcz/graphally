// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The diagram's elements as the layers panel lists them: each with its path in the source tree,
// its depth, tag, id, classes, nudge and the start of its own text.
import { diagramSpan, getAttribute } from '../../../skills/graphally/scripts/lib/edits/markup.mjs';
import { sourceTree, nodesOf } from '../../../skills/graphally/scripts/lib/edits/tree.mjs';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = text => text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, entity => ENTITIES[entity]);

function layerOf(text, node) {
  const tag = text.slice(node.start, node.openEnd), run = node.texts[0];
  return {
    path: node.path, depth: node.path.split('.').length - 1, tag: node.tag, virtual: Boolean(node.virtual),
    id: getAttribute(tag, 'id'), classes: getAttribute(tag, 'class') || '', nudge: getAttribute(tag, 'nudge'),
    text: run ? decode(text.slice(run.start, run.end)).replace(/\s+/g, ' ') : '',
  };
}

// The layers of a source, or none when it holds no diagram.
export function outlineOf(source) {
  try {
    const text = diagramSpan(source).text;
    return nodesOf(sourceTree(text)).map(node => layerOf(text, node));
  } catch {
    return [];
  }
}
