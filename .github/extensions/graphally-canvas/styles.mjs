// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The CSS a diagram can style its elements with, for the page to find what styles the selection:
// the rules of the diagram's own <style> (each with its index, to edit it by), the declarations
// of each utility class it uses, graphally's defaults for its building blocks, and the theme's
// colour tokens, to offer as values.
import { diagramSpan } from '../../../skills/graphally/scripts/lib/edits/markup.mjs';
import { styleRules, sheetRules } from '../../../skills/graphally/scripts/lib/edits/css-rules.mjs';
import { utility } from '../../../skills/graphally/scripts/lib/engine/css/utilities.js';
import { PAGE_CSS } from '../../../skills/graphally/scripts/lib/engine/page/page-css.js';
import { TOKENS } from '../../../skills/graphally/scripts/lib/engine/shared/tokens.js';
import { partsOf } from './app/selectors.js';

const plain = ({ property, value, important }) => ({ property, value, important });

// A default's selector as an author would write it: :where(.graphally-page .node > h4) is
// .node > h4, and the page itself is the diagram.
function unwrapped(selector) {
  const inner = selector.startsWith(':where(') && selector.endsWith(')') ? selector.slice(7, -1) : selector;
  return partsOf(inner, ',').map(part => part.replace(/^\.graphally-page\b\s*/, '') || 'diagram').join(', ');
}

const DEFAULTS = sheetRules(PAGE_CSS).filter(rule => !rule.nested && !rule.media).map(rule => ({
  selector: unwrapped(rule.selector), declarations: rule.declarations.map(plain),
}));

function classesIn(text) {
  const values = [...text.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)];
  return [...new Set(values.flatMap(match => (match[1] ?? match[2] ?? match[3]).split(/\s+/)).filter(Boolean))];
}

// Each utility class the diagram uses, with its CSS; one that nests (space-y-2) says for what.
function utilitiesIn(text) {
  const found = classesIn(text).map(name => [name, utility(name)]).filter(([, css]) => css != null);
  return Object.fromEntries(found.map(([name, css]) => [name, typeof css === 'string' ? { css } : css]));
}

export function stylesOf(source) {
  let text;
  try {
    ({ text } = diagramSpan(source, 0));
  } catch {
    return { rules: [], utilities: {}, defaults: DEFAULTS, tokens: TOKENS };
  }
  const rules = styleRules(text).map(({ index, selector, media, nested, declarations }) => ({
    index, selector, media, nested, declarations: declarations.map(plain),
  }));
  return { rules, utilities: utilitiesIn(text), defaults: DEFAULTS, tokens: TOKENS };
}
