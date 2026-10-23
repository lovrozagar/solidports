#!/usr/bin/env bash
# Runs one Base UI vitest script on Linux WebKit in Playwright's Docker image, with a JSON report.
# Playwright's WebKit lacks system libraries on a non-Ubuntu host ("Host system is missing
# dependencies"); the image ships them. The image tag is the installed playwright-core version.
#
# The tree is the read-only lower layer of an overlay mounted at its own path, so the report's file
# names match the host's and every write of the run (vite's caches, temp files) lands in the
# overlay's upper layer beside the report, never in the tree. The tree needs its own install: one
# that resolves packages from another checkout links outside the container.
#
# `test:base-ui:all --changed` runs the scoped parity-webkit suite through it, and
# `browser-parity.mjs` its confirm reruns (PARITY_RUNNER).
#
# Usage (from packages/base-ui): bash scripts/webkit-docker.sh <script> <report.json> [filters...]
set -u
script=$1
report=$2
shift 2

tree=$(git rev-parse --show-toplevel) || exit 1
if [ ! -d "$tree/node_modules/.bin" ]; then
  echo "webkit-docker: $tree has no install of its own; run bun install there" >&2
  exit 1
fi
mkdir -p "$(dirname "$report")"
reportDir=$(cd "$(dirname "$report")" && pwd)
report="$reportDir/$(basename "$report")"
# The overlay's mount options split on commas and its lower layers on colons, and the --mount value
# quotes them in double quotes, so a path with any of these would mount the wrong layers.
for path in "$tree" "$reportDir"; do
  case "$path" in
    *[,:\"]*)
      echo "webkit-docker: the overlay cannot mount $path (a comma, colon or double quote)" >&2
      exit 2
      ;;
  esac
done
version=$(node -p "require('playwright-core/package.json').version") || exit 1
bun=$(readlink -f "$(command -v bun)") || exit 1
out=$(mktemp -d "$reportDir/webkit-docker.XXXXXX") || exit 1
name=$(basename "$out")
image="mcr.microsoft.com/playwright:v$version-noble"
# Runs on every exit, an interrupted run included (the gate's timeout, Ctrl-C): the container, its
# overlay volume and `$out` go; the report, outside `$out`, stays. A mounted overlay leaves
# root-owned entries in `work`, so the image removes the layers as root. It is still there: this
# host's docker-auto-prune waits for 2 s without a container exit and for no running `docker run`.
cleanup() {
  docker rm -f -v "$name" > /dev/null 2>&1
  docker run --rm --pull never -v "$out:/out" "$image" rm -rf /out/upper /out/work > /dev/null 2>&1
  rm -rf -- "${out:?}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -p "$out/upper" "$out/work" "$out/home" "$out/tmp"

# The overlay is the container's anonymous volume, created with it and removed with it: a named
# volume would sit unused between `docker volume create` and `docker run`, and this host's
# docker-auto-prune (`volume prune -af` every minute) could take it there.
docker run --rm --init --ipc=host --name "$name" \
  --user "$(id -u):$(id -g)" \
  -e HOME="$out/home" -e TMPDIR="$out/tmp" -e TZ=UTC -e CI=1 \
  --mount "type=volume,dst=$tree,volume-driver=local,volume-opt=type=overlay,volume-opt=device=overlay,\"volume-opt=o=lowerdir=$tree,upperdir=$out/upper,workdir=$out/work\"" \
  -v "$reportDir:$reportDir" \
  -v "$bun:/usr/local/bin/bun:ro" \
  -w "$tree/packages/base-ui" \
  "$image" \
  sh -c 'script=$1; report=$2; shift 2; bun run "$script" --run --maxWorkers=2 --reporter=json --outputFile="$report" "$@"' \
  sh "$script" "$report" "$@"
