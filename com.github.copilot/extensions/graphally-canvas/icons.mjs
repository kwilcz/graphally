// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The icon names to suggest in the properties panel: the generic icons and everyday service names
// the engine knows, and every key of the Azure and AWS packs the skill ships. Read once, when the
// panel first asks.
import { readFileSync } from 'node:fs';
import { iconNames } from '../../../skills/graphally/scripts/lib/engine/icons/icons.js';

const PACKS = ['azure', 'aws']
  .map(vendor => new URL(`../../../skills/graphally/assets/icons/${vendor}.json`, import.meta.url));
let names = null;

export function allIconNames() {
  const keysOf = pack => Object.keys(JSON.parse(readFileSync(pack, 'utf8')));
  names ??= [...new Set([...iconNames(), ...PACKS.flatMap(keysOf)])].sort((one, other) => one.localeCompare(other));
  return names;
}
