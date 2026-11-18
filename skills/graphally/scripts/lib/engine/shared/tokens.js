// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The theme's colour tokens: the CSS variables of theme.css, which follow the dark theme.

export const TOKENS = [
  'ink', 'muted', 'line', 'woad', 'rust', 'teal', 'green', 'purple', 'amber', 'wash', 'card', 'bg',
  'icon-soft', 'vnet', 'note', 'lane-a', 'lane-b', 'lane-c', 'lane-d',
];

const TONE_ALIASES = { blue: 'woad', red: 'rust' };

// A colour an option names ('teal', 'blue') as its token's variable; any other value as given.
export function toneOf(value) {
  const token = TONE_ALIASES[value] || value;
  return value && TOKENS.includes(token) ? `var(--${token})` : value;
}
