// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The skill's folder: skills/graphally, wherever it is installed.
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
