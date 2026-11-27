// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A file a diagram names by a path relative to its own file, which may lead out of its folder: a
// brand folder beside the docs (../brand/fonts/Acme-Bold.ttf, ../brand/icons). The render's server
// reads it from disk at /near; an address with a scheme (https:, data:) is used as it is.
export const nearUrl = (base, written) => (/^[a-z][a-z0-9+.-]+:/i.test(written)
  ? new URL(written)
  : new URL(`/near?from=${encodeURIComponent(base.pathname)}&path=${encodeURIComponent(written)}`, location.href));
