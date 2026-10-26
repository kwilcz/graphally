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
# Sources that take the same flags render in one call: one browser, several pages at a time.
# A PNG next to a source is kept, drawn at 2x so it can be published; so is a dark copy
# (<name>-dark.svg), for pages that show the reader's theme.
both=(); png=(); dark=(); plain=()
for src in samples/*/diagram.html docs/diagrams/*.html; do
  p=0; d=0
  [ -f "${src%.html}.png" ] && p=1
  [ -f "${src%.html}-dark.svg" ] && d=1
  case "$p$d" in 11) both+=("$src") ;; 10) png+=("$src") ;; 01) dark+=("$src") ;; *) plain+=("$src") ;; esac
done
batch() {
  local flags=$1; shift
  [ "$#" -gt 0 ] || return 0
  # shellcheck disable=SC2086 # the flags are words
  out=$(node skills/graphally/scripts/graphally.mjs render "$@" $flags 2>&1)
  code=$?
  printf '%s\n' "$out"
  # A render that cannot start (no browser, unreadable source) prints "error:" and exits 1.
  if [ "$code" -ge 2 ] || grep -q -e '^error:' -e 'not downloaded' <<< "$out"; then
    status=2
  fi
}
batch "--png2x --themes" ${both[@]+"${both[@]}"}
batch "--png2x" ${png[@]+"${png[@]}"}
batch "--themes" ${dark[@]+"${dark[@]}"}
batch "" ${plain[@]+"${plain[@]}"}
exit "$status"
