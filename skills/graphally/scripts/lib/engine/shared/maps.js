// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.

// The list a map keeps under a key, made empty the first time the key is used.
export const listAt = (map, key) => map.get(key) || map.set(key, []).get(key);
