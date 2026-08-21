#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CANONICAL_MANIFEST="$ROOT/docs/last-ship-checksums.txt"
CHECKSUM_FILE="$CANONICAL_MANIFEST"
DRY_RUN=false
EXPECTED_CONTENT=""
PROBE_PATH="/"
PREVIEW_PORT="${PREVIEW_PORT:-4173}"
PREVIEW_HOST="${PREVIEW_HOST:-vps8-core}"
LIVE_URL="${LIVE_URL:-https://jazzcanon.com}"
PREVIEW_PID=""
PREVIEW_LOG=""
DEPLOY_LOG=""
TMP_FILES=()

DATA_FILES=(
  app/public/data/albums.json
  app/public/data/details.json
  app/public/data/graph.json
  app/public/data/places.json
  app/public/data/people-activity.json
)

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh [--dry-run] [--expect TEXT] [--probe-path /PATH]
                         [--checksum-file FILE]

Attended code-lane deploy for jazzcanon.com.
  --dry-run              verify, type-check, build, and prove preview; never deploy
  --expect TEXT          literal changed content required on the deployed release
  --probe-path /PATH     release path containing the change (default: /)
  --checksum-file FILE   alternate manifest; accepted only with --dry-run for testing
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --expect)
      [[ $# -ge 2 ]] || { echo "--expect requires text" >&2; exit 2; }
      EXPECTED_CONTENT=$2; shift 2 ;;
    --probe-path)
      [[ $# -ge 2 && "$2" == /* ]] || { echo "--probe-path requires a path beginning with /" >&2; exit 2; }
      PROBE_PATH=$2; shift 2 ;;
    --checksum-file)
      [[ $# -ge 2 ]] || { echo "--checksum-file requires a path" >&2; exit 2; }
      CHECKSUM_FILE=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ "$CHECKSUM_FILE" != "$CANONICAL_MANIFEST" ]] && ! $DRY_RUN; then
  echo "Alternate checksum manifests are test-only and require --dry-run." >&2
  exit 2
fi

cleanup() {
  if [[ -n "$PREVIEW_PID" ]]; then
    kill -TERM -- "-$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
  if [[ ${#TMP_FILES[@]} -gt 0 ]]; then
    rm -f -- "${TMP_FILES[@]}"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

validate_manifest_paths() {
  python3 - "$CHECKSUM_FILE" "${DATA_FILES[@]}" <<'PY'
from pathlib import Path
import re, sys
manifest=Path(sys.argv[1])
expected=sys.argv[2:]
if not manifest.is_file():
    raise SystemExit(f"missing checksum record: {manifest}")
actual=[]
for line in manifest.read_text().splitlines():
    parts=line.split()
    if len(parts) != 2 or not re.fullmatch(r'[0-9a-fA-F]{64}', parts[0]):
        raise SystemExit(f"invalid checksum line: {line!r}")
    actual.append(parts[1].lstrip('*'))
if actual != expected:
    raise SystemExit(f"manifest paths must be exactly: {', '.join(expected)}")
PY
}

relative_manifest=$(realpath --relative-to="$ROOT" "$CHECKSUM_FILE" 2>/dev/null || printf '%s' "$CHECKSUM_FILE")
echo "[1/6] Verifying exact five-file data manifest: $relative_manifest"
if ! validate_manifest_paths || ! (cd "$ROOT" && sha256sum --check "$CHECKSUM_FILE"); then
  echo "data drifted since last ship; DM mccoy or ask John." >&2
  exit 1
fi

if ! python3 - "$PREVIEW_PORT" <<'PY'
import socket,sys
s=socket.socket()
try:
    s.bind(('0.0.0.0',int(sys.argv[1])))
except OSError:
    raise SystemExit(1)
finally:
    s.close()
PY
then
  echo "Preview port $PREVIEW_PORT is already occupied; refusing to validate another server." >&2
  exit 1
fi

echo "[2/6] Running Svelte and TypeScript checks"
npm --prefix "$ROOT/app" run check

echo "[3/6] Building app/dist"
npm --prefix "$ROOT/app" run build

PREVIEW_LOG=$(mktemp "${TMPDIR:-/tmp}/jazz-canon-preview.XXXXXX.log")
TMP_FILES+=("$PREVIEW_LOG")
echo "[4/6] Starting attended preview"
setsid npm --prefix "$ROOT/app" run preview -- --host 0.0.0.0 --port "$PREVIEW_PORT" --strictPort >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 30); do
  if ! kill -0 "$PREVIEW_PID" 2>/dev/null; then
    echo "Preview exited early; log follows:" >&2
    python3 - "$PREVIEW_LOG" <<'PY' >&2
from pathlib import Path
import sys
print('\n'.join(Path(sys.argv[1]).read_text(errors='replace').splitlines()[:120]))
PY
    exit 1
  fi
  if curl --fail --silent "http://127.0.0.1:${PREVIEW_PORT}/" >/dev/null; then
    break
  fi
  sleep 1
done
kill -0 "$PREVIEW_PID" 2>/dev/null || { echo "Preview process died before readiness confirmation." >&2; exit 1; }
curl --fail --silent --show-error "http://127.0.0.1:${PREVIEW_PORT}/" >/dev/null
echo "Preview ready for John: http://${PREVIEW_HOST}:${PREVIEW_PORT}/"
echo "Working tree included in this build:"
git -C "$ROOT" status --short

if $DRY_RUN; then
  echo "DRY RUN: manifest, checks, build, and preview passed; deploy not attempted."
  exit 0
fi

[[ -n "$EXPECTED_CONTENT" ]] || {
  echo "A real deploy requires --expect TEXT naming changed content." >&2
  exit 2
}

printf "After reviewing the preview and working tree, type go for this deploy: "
IFS= read -r approval
[[ "$approval" == "go" ]] || {
  echo "Deploy cancelled; explicit go not received."
  exit 1
}

cleanup
PREVIEW_PID=""
TMP_FILES=()

DEPLOY_LOG=$(mktemp "${TMPDIR:-/tmp}/jazz-canon-wrangler.XXXXXX.log")
TMP_FILES+=("$DEPLOY_LOG")
echo "[5/6] Deploying app/dist with lockfile-pinned Wrangler"
(cd "$ROOT/app" && npx --no-install wrangler pages deploy) | tee "$DEPLOY_LOG"
DEPLOY_URL=$(python3 - "$DEPLOY_LOG" <<'PY'
import re,sys
text=open(sys.argv[1],errors='replace').read()
urls=re.findall(r'https://[A-Za-z0-9.-]+\.pages\.dev',text)
print(urls[-1] if urls else '')
PY
)
[[ -n "$DEPLOY_URL" ]] || {
  echo "Wrangler succeeded but no deployment URL was found in its output." >&2
  exit 1
}

mapfile -t LOCAL_ASSETS < <(python3 - "$ROOT/app/dist/index.html" <<'PY'
import re,sys
text=open(sys.argv[1],errors='replace').read()
assets=re.findall(r'<script[^>]+src="([^"]+)"',text)
assets+=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',text)
for asset in assets: print(asset)
PY
)
[[ ${#LOCAL_ASSETS[@]} -gt 0 ]] || { echo "No release assets found in app/dist/index.html." >&2; exit 1; }

fetch_retry() {
  local url=$1 out=$2 attempts=${3:-12}
  for _ in $(seq 1 "$attempts"); do
    if curl --location --fail --silent --show-error "$url" >"$out"; then return 0; fi
    sleep 5
  done
  return 1
}

content_present() {
  local base=$1 path=$2 expected=$3 body asset asset_url
  body=$(mktemp "${TMPDIR:-/tmp}/jazz-canon-probe.XXXXXX")
  TMP_FILES+=("$body")
  fetch_retry "${base%/}${path}" "$body" || return 1
  grep --fixed-strings --quiet -- "$expected" "$body" && return 0
  while IFS= read -r asset; do
    [[ -n "$asset" ]] || continue
    case "$asset" in
      http://*|https://*) asset_url="$asset" ;;
      /*) asset_url="${base%/}$asset" ;;
      *) asset_url="${base%/}/$asset" ;;
    esac
    if fetch_retry "$asset_url" "$body" 3 && grep --fixed-strings --quiet -- "$expected" "$body"; then
      return 0
    fi
  done < <(python3 - "$body" <<'PY'
import re,sys
text=open(sys.argv[1],errors='replace').read()
assets=re.findall(r'<script[^>]+src="([^"]+)"',text)
assets+=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',text)
for asset in assets: print(asset)
PY
)
  return 1
}

all_release_assets_present() {
  local html=$1 asset
  for asset in "${LOCAL_ASSETS[@]}"; do
    grep --fixed-strings --quiet -- "$asset" "$html" || return 1
  done
}

ASSET_LIST=$(IFS=,; echo "${LOCAL_ASSETS[*]}")
echo "[6/6] Verifying exact deployment, then custom domain"
DEPLOY_HTML=$(mktemp "${TMPDIR:-/tmp}/jazz-canon-deploy.XXXXXX.html")
LIVE_HTML=$(mktemp "${TMPDIR:-/tmp}/jazz-canon-live.XXXXXX.html")
TMP_FILES+=("$DEPLOY_HTML" "$LIVE_HTML")
fetch_retry "${DEPLOY_URL}/" "$DEPLOY_HTML"
all_release_assets_present "$DEPLOY_HTML" || {
  echo "Deployment URL does not reference every local release asset: $ASSET_LIST." >&2
  exit 1
}
content_present "$DEPLOY_URL" "$PROBE_PATH" "$EXPECTED_CONTENT" || {
  echo "Expected changed content was not found on deployment URL at $PROBE_PATH." >&2
  exit 1
}

for _ in $(seq 1 12); do
  if fetch_retry "${LIVE_URL%/}/" "$LIVE_HTML" 1 \
     && all_release_assets_present "$LIVE_HTML"; then
    break
  fi
  sleep 5
done
all_release_assets_present "$LIVE_HTML" || {
  echo "Custom domain did not advance to every release asset: $ASSET_LIST." >&2
  exit 1
}
content_present "$LIVE_URL" "$PROBE_PATH" "$EXPECTED_CONTENT" || {
  echo "Expected changed content was not found on custom domain at $PROBE_PATH." >&2
  exit 1
}
echo "LIVE VERIFIED: deployment URL and custom domain carry all release assets ($ASSET_LIST) and expected content."
