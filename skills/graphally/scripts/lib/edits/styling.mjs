// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Edits of a diagram's CSS, one declaration at a time, where the CSS is written:
//
//   { op: 'rule', rule | selector, set: { property: value | null }, rename?, remove? }
//       a rule of the diagram's <style>, by its index (as styleRules numbers them) or its
//       selector; a selector no rule has gets a new rule. null removes a declaration, rename
//       gives the rule another selector, and remove: true removes the whole rule.
//   { op: 'style', path | id, set: { property: value | null } }
//       the element's style attribute.
import { getAttribute, setAttribute } from './markup.mjs';
import { sourceTree, nodesOf } from './tree.mjs';
import { styleRules, inlineDeclarations } from './css-rules.mjs';
import { cutOf, spotOf, fitted } from './placing.mjs';
import { elementOf } from './structure.mjs';

const splice = (text, start, end, insert) => text.slice(0, start) + insert + text.slice(end);
const lineStart = (text, at) => text.lastIndexOf('\n', at - 1) + 1;
const indentAt = (text, at) => text.slice(lineStart(text, at), at).match(/^[ \t]*/)[0];
const ownsLine = (text, start, end) => /^[ \t]*$/.test(text.slice(lineStart(text, start), start))
  && /^[ \t]*(\n|$)/.test(text.slice(end));
const normal = selector => String(selector).replace(/\s+/g, ' ').trim();

function checked(property, value) {
  if (!/^(--)?[a-zA-Z][\w-]*$/.test(property)) throw new Error(`"${property}" is not a CSS property`);
  if (value !== null && /[{};]/.test(String(value).replace(/"[^"]*"|'[^']*'/g, ''))) {
    throw new Error(`"${value}" is not one CSS value`);
  }
}

function removed(text, { start, end }) {
  if (!ownsLine(text, start, end)) return splice(text, start, end + (text[end] === ' ' ? 1 : 0), '');
  const newline = text.indexOf('\n', end);
  return splice(text, lineStart(text, start), newline < 0 ? end : newline + 1, '');
}

// A declaration after the rule's last one: on a line of its own when the rule has lines.
function added(text, rule, property, value) {
  const last = rule.declarations.at(-1), multiline = text.slice(rule.open, rule.close).includes('\n');
  const after = last ? last.end : rule.open + 1, semicolon = last && text[last.end - 1] !== ';' ? ';' : '';
  const indent = last ? indentAt(text, last.start) : `${indentAt(text, rule.start)}  `;
  return splice(text, after, after, `${semicolon}${multiline ? `\n${indent}` : ' '}${property}: ${value};`);
}

// One property of one rule: its last declaration changed, every one removed, or one added.
function setInRule(text, rule, property, value) {
  const declarations = rule.declarations.filter(declaration => declaration.property === property);
  if (value === null) return declarations.reduceRight(removed, text);
  const last = declarations.at(-1);
  if (last) return splice(text, last.valueStart, last.valueEnd, String(value));
  return added(text, rule, property, value);
}

// A new, empty rule: last in the diagram's last <style>, or in a new <style> first in it.
function newRule(text, selector) {
  const tree = sourceTree(text), style = nodesOf(tree).filter(node => node.tag === 'style').at(-1);
  if (!style) {
    const spot = spotOf(text, tree, tree.children[0] ?? null);
    return splice(text, spot.at, spot.at, fitted(`<style>\n  ${selector} { }\n</style>`, '', spot));
  }
  const lastRule = styleRules(text, tree).at(-1), indent = lastRule ? indentAt(text, lastRule.start) : '  ';
  const at = style.openEnd + text.slice(style.openEnd, style.closeStart).trimEnd().length;
  return splice(text, at, at, `\n${indent}${selector} { }`);
}

function ruleFor(text, { rule, selector }) {
  const rules = styleRules(text).filter(found => !found.nested);
  if (rule != null) return rules.find(found => found.index === Number(rule)) ?? null;
  return rules.find(found => found.selector === normal(selector) && !found.media) ?? null;
}

// A rule removed with its lines or, sharing a line, with the spaces that set it apart.
function removedRule(text, rule) {
  const cut = cutOf(text, { start: rule.start, end: rule.close + 1 });
  if (cut.start !== rule.start) return splice(text, cut.start, cut.end, '');
  const after = text.slice(cut.end).match(/^[ \t]*/)[0].length;
  const before = /^[ \t]*(\n|<)/.test(text.slice(cut.end)) ? text.slice(0, cut.start).match(/[ \t]*$/)[0].length : 0;
  return splice(text, cut.start - before, cut.end + (before ? 0 : after), '');
}

function ruleEdit(text, edit) {
  if (edit.rule == null && !edit.selector) throw new Error('rule needs the rule\'s index or a selector');
  const found = ruleFor(text, edit);
  if (!found && edit.rule != null) throw new Error(`no rule ${edit.rule}`);
  if (edit.remove) return found ? removedRule(text, found) : text;
  let edited = found ? text : newRule(text, normal(edit.selector));
  // The rule is found again after each change, by its index: a new one is the last.
  const address = { rule: found ? found.index : styleRules(edited).length - 1 };
  for (const [property, value] of Object.entries(edit.set ?? {})) {
    checked(property, value);
    edited = setInRule(edited, ruleFor(edited, address), property.toLowerCase(), value);
  }
  return edit.rename ? renamed(edited, ruleFor(edited, address), edit.rename) : edited;
}

// The rule with another selector, the spaces before its { kept.
function renamed(text, rule, selector) {
  const next = normal(selector);
  if (!next || /[{};]/.test(next.replace(/"[^"]*"|'[^']*'/g, ''))) throw new Error(`"${selector}" is not a selector`);
  const end = rule.start + text.slice(rule.start, rule.open).trimEnd().length;
  return splice(text, rule.start, end, next);
}

const serialized = declarations => declarations
  .map(({ property, value, important }) => `${property}: ${value}${important ? ' !important' : ''}`).join('; ');

// The style attribute's declarations with one property set where it stands, added, or removed.
function withProperty(declarations, property, value) {
  const at = declarations.findIndex(found => found.property === property);
  const rest = declarations.filter(found => found.property !== property);
  if (value === null) return rest;
  const declaration = { property, value: String(value) };
  return at < 0 ? [...rest, declaration] : [...rest.slice(0, at), declaration, ...rest.slice(at)];
}

function styleEdit(text, edit) {
  const node = elementOf(text, sourceTree(text), edit), tag = text.slice(node.start, node.openEnd);
  let declarations = inlineDeclarations(getAttribute(tag, 'style') || '');
  for (const [property, value] of Object.entries(edit.set ?? {})) {
    checked(property, value);
    declarations = withProperty(declarations, property.toLowerCase(), value);
  }
  return splice(text, node.start, node.openEnd, setAttribute(tag, 'style', serialized(declarations) || null));
}

export const STYLE_EDITS = { rule: ruleEdit, style: styleEdit };
