#!/usr/bin/env bash
#
# Builds the file production actually downloads.
#
#   js/prod/form1.src.js       ->  js/prod/form1.js
#   js/prod/staff-gate.src.js  ->  js/prod/staff-gate.js
#
# The Webflow embed on contoureducation.com.au/free-trial points at
# js/prod/form1.js and never changes, so this only ever rewrites the bytes
# behind that URL. Minifying cuts the download from ~207 KB gzip to ~64 KB.
#
# Usage:
#   scripts/build-prod.sh            build the artifact from the source copy
#   scripts/build-prod.sh --check    fail if the artifact is stale (CI uses this)
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Each entry is "<source>|<artifact>". Both production URLs are rebuilt
# together so a release cannot ship a form without its gate.
BUNDLES=(
  "js/prod/form1.src.js|js/prod/form1.js"
  "js/prod/staff-gate.src.js|js/prod/staff-gate.js"
)

# Pinned: the drift check below compares bytes, so the minifier version has to
# be the same everywhere or every CI run would report a false stale artifact.
ESBUILD="esbuild@0.23.0"

build() {
  npx --yes "$ESBUILD" "$1" \
    --minify \
    --target=es2017 \
    --banner:js="/* Minified build. Readable source: $3, same directory. Edit that, not this. */" \
    --outfile="$2"
}

stale=0
for bundle in "${BUNDLES[@]}"; do
  SRC="$REPO/${bundle%%|*}"
  OUT="$REPO/${bundle##*|}"
  # The repo-relative path, matching the banner this script has always
  # written. A basename here would rewrite js/prod/form1.js on the next run
  # for no reason other than a changed comment.
  NAME="${bundle%%|*}"

  if [ ! -f "$SRC" ]; then
    echo "No $SRC to build from." >&2
    exit 1
  fi

  if [ "${1:-}" = "--check" ]; then
    TMP="$(mktemp -d)"
    build "$SRC" "$TMP/out.js" "$NAME" >/dev/null
    if cmp -s "$TMP/out.js" "$OUT"; then
      echo "${bundle##*|} is the current build of ${bundle%%|*}."
    else
      echo "${bundle##*|} is stale — run scripts/build-prod.sh and commit the result." >&2
      stale=1
    fi
    rm -rf "$TMP"
    continue
  fi

  build "$SRC" "$OUT" "$NAME"
  echo "Built ${bundle##*|}: $(wc -c < "$OUT" | tr -d ' ') bytes, $(gzip -9 -c "$OUT" | wc -c | tr -d ' ') gzipped."
done

exit "$stale"
