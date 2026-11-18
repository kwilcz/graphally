// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The values a utility class names: lengths on the spacing scale, arbitrary values, colours.
import { TOKENS } from '../shared/tokens.js';

const THEME_COLORS = new Set(TOKENS);
const NAMED_COLORS = { white: '#fff', black: '#000', current: 'currentColor', transparent: 'transparent' };

// An arbitrary value: [130px], with an underscore for a space, as in Tailwind.
export const isArbitrary = value => /^\[.+\]$/.test(value);
export const arbitrary = text => text.replace(/\\_/g, '\u0000').replace(/_/g, ' ').replace(/\u0000/g, '_');
export const unbracket = value => arbitrary(value.slice(1, -1));

// "6" is 24px, "1.5" 6px, "px" 1px, "1/2" 50% (where fractions are allowed), "[130px]" 130px.
export function lengthOf(value, { fraction = true } = {}) {
  if (value === undefined) return null;
  if (isArbitrary(value)) return unbracket(value);
  if (value === 'px') return '1px';
  if (/^\d+(\.(25|5|75))?$/.test(value)) return value === '0' ? '0' : `${Number(value) * 4}px`;
  if (!fraction || !/^\d+\/\d+$/.test(value)) return null;
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator ? `${+(numerator / denominator * 100).toFixed(4)}%` : null;
}

// A theme token as its variable, an arbitrary colour, or one of a few names.
export function colorOf(value) {
  if (THEME_COLORS.has(value)) return `var(--${value})`;
  if (isArbitrary(value)) return unbracket(value);
  return Object.hasOwn(NAMED_COLORS, value) ? NAMED_COLORS[value] : null;
}

// A negative value: -4px, or calc(-1 * …) for a calc() or a variable; 0 and auto stay as they are.
export function negated(value) {
  if (!value || value === '0' || value === 'auto') return value;
  return /^calc|^var/.test(value) ? `calc(-1 * ${value})` : `-${value}`;
}
