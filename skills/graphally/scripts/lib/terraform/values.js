// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What an expression's value is, as far as it can be known without running Terraform.

// A map body cut at its top-level line ends and commas, outside strings and brackets.
function topLevelPieces(body) {
  const pieces = [];
  let depth = 0, current = '', inString = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && body[i - 1] !== '\\') inString = !inString;
    if (!inString) depth += '{[('.includes(c) ? 1 : '}])'.includes(c) ? -1 : 0;
    if (!inString && !depth && (c === '\n' || c === ',')) {
      pieces.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  return [...pieces, current];
}

// The top-level `key = value` entries of a map body, as [key, value] pairs.
export const mapEntries = body => topLevelPieces(body)
  .map(piece => /^\s*"?([\w.-]+)"?\s*[=:]\s*([\s\S]+?)\s*$/.exec(piece))
  .filter(Boolean)
  .map(([, key, value]) => [key, value]);

// A field of an object expression: field('{ cidr = "10.0.0.0/16" }', 'cidr').
export const field = (raw, name) =>
  (mapEntries((raw || '').trim().replace(/^\{|\}$/g, '')).find(([key]) => key === name) || [])[1] || '';

// var.name: the caller's argument for it, else its default.
function variableValue(name, scope, depth) {
  if (scope?.args?.[name] !== undefined && scope.parent) {
    return literal(scope.args[name], scope.parent, null, depth + 1);
  }
  if (scope?.vars?.[name]?.default !== undefined) return literal(scope.vars[name].default, scope, null, depth + 1);
  return '';
}

// A string: variables (the caller's argument or the default), locals and each.key or
// each.value are filled in; anything else shows as {name}: "kv-${var.env}" is "kv-prod", or
// "kv-{env}".
export function literal(raw, scope, each, depth = 0) {
  if (!raw || depth > 8) return '';
  const text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, inner) =>
      literal(inner, scope, each, depth + 1) || `{${(/([\w-]+)\s*$/.exec(inner) || [, '…'])[1]}}`);
  }
  if (text === 'each.key') return each?.key ?? '';
  if (text === 'each.value') return each ? literal(each.value, scope, null, depth + 1) : '';
  const eachField = /^each\.value\.([\w-]+)$/.exec(text);
  if (eachField) return each ? literal(field(each.value, eachField[1]), scope, null, depth + 1) : '';
  const variable = /^var\.([\w-]+)$/.exec(text);
  if (variable) return variableValue(variable[1], scope, depth);
  const local = /^local\.([\w-]+)$/.exec(text);
  if (local && scope?.locals?.[local[1]] !== undefined) return literal(scope.locals[local[1]], scope, each, depth + 1);
  return '';
}

// The strings of a literal list, each its own key.
const listEntries = text => [...text.matchAll(/"([^"]*)"/g)]
  .map(match => ({ key: match[1], value: `"${match[1]}"` }));

// The keys (and raw values) of a literal map or set, following locals and variables: what a
// for_each makes one resource per.
export function collection(raw, scope, depth = 0) {
  if (!raw || depth > 8) return null;
  let text = raw.trim();
  const reference = /^(var|local)\.([\w-]+)$/.exec(text);
  if (reference) {
    const [, kind, name] = reference;
    if (kind === 'local') return collection(scope.locals[name], scope, depth + 1);
    if (scope.args[name] !== undefined && scope.parent) return collection(scope.args[name], scope.parent, depth + 1);
    return collection(scope.vars[name]?.default, scope, depth + 1);
  }
  const converted = /^(?:toset|tomap)\(([\s\S]*)\)$/.exec(text);
  if (converted) text = converted[1].trim();
  if (text.startsWith('[')) return listEntries(text);
  if (!text.startsWith('{')) return null;
  return mapEntries(text.slice(1, -1)).map(([key, value]) => ({ key, value }));
}

const CIDR = /^\d+\.\d+\.\d+\.\d+\/\d+$/;

// The address ranges of an address_space or address_prefixes: [each.value], [var.cidr],
// local.ranges…, each element read as a literal.
export function cidrOf(raw, resource) {
  if (!raw) return '';
  const items = raw.trim().replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean);
  return items
    .map(item => (/^"/.test(item) ? item.slice(1, -1) : literal(item, resource.scope, resource.each)))
    .filter(value => CIDR.test(value))
    .join(', ');
}
