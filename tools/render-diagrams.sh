#!/usr/bin/env bash
# Re-renders every diagram source in place, so the SVG and PNG files next to them match the
# current graphally. Run from anywhere in the repository. Exits 2 when a render fails outright;
# a render that only reports problems exits 1 and still writes its SVG, so it passes here.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

# The first render downloads the icon packs. If that download fails, the icons would be drawn
# missing and the files committed that way, so the packs are fetched here, where a failure stops.
node skills/graphally/scripts/fetch-icons.mjs || exit 2

# The viewer bundle carries the engine and the icon index; rebuild it from the same sources.
node tools/build-viewer.mjs || exit 2

status=0
for src in samples/*/diagram.html docs/diagrams/*.html; do
  args=(render "$src")
  # A PNG next to the source is kept, drawn at 2x so it can be published.
  [ -f "${src%.html}.png" ] && args+=(--png2x)
  echo "== $src"
  out=$(node skills/graphally/scripts/graphally.mjs "${args[@]}" 2>&1)
  code=$?
  printf '%s\n' "$out"
  # A render that cannot start (no browser, unreadable source) prints "error:" and exits 1.
  if [ "$code" -ge 2 ] || grep -q -e '^error:' -e 'not downloaded' <<< "$out"; then
    status=2
  fi
done
exit "$status"
