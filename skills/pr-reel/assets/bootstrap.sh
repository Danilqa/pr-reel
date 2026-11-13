#!/usr/bin/env bash
# Installs the pr-reel runtime for the current repository in a sibling folder (<repo>--pr-reel),
# so nothing lands in the repository itself, then checks the tools it needs.
# Run from anywhere inside the repository: bash <skill-dir>/assets/bootstrap.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/runtime" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO" ]; then
  echo "run this from inside the git repository to record" >&2
  exit 1
fi
DEST="${PR_REEL_HOME:-$(dirname "$REPO")/$(basename "$REPO")--pr-reel}"

mkdir -p "$DEST/scenarios" "$DEST/out"
rsync -a --delete "$SRC/lib/" "$DEST/lib/"
cp "$SRC/package.json" "$SRC/tsconfig.json" "$SRC/playwright.config.ts" "$SRC/run.sh" "$SRC/base-server.sh" "$DEST/"
chmod +x "$DEST/run.sh" "$DEST/base-server.sh"
for example in "$SRC"/scenarios/*.reel.ts; do
  [ -e "$example" ] && [ ! -e "$DEST/scenarios/$(basename "$example")" ] && cp "$example" "$DEST/scenarios/"
done

# The install command for the base worktree follows the lockfile
detect_setup() {
  if [ -f "$REPO/pnpm-lock.yaml" ]; then
    echo 'pnpm install --frozen-lockfile --prefer-offline'
  elif [ -f "$REPO/bun.lock" ] || [ -f "$REPO/bun.lockb" ]; then
    echo 'bun install --frozen-lockfile'
  elif [ -f "$REPO/yarn.lock" ] && [ -f "$REPO/.yarnrc.yml" ]; then
    echo 'yarn install --immutable'
  elif [ -f "$REPO/yarn.lock" ]; then
    echo 'yarn install --frozen-lockfile --prefer-offline'
  elif [ -f "$REPO/package-lock.json" ]; then
    echo 'npm ci --prefer-offline --no-audit --no-fund'
  fi
}

is_new_config=0
if [ ! -f "$DEST/config.sh" ]; then
  setup="$(detect_setup)"
  sed -e "s|__REPO__|$REPO|" -e "s|__SETUP__|$setup|" "$SRC/config.sh" >"$DEST/config.sh"
  is_new_config=1
fi

status=0
command -v node >/dev/null || { echo "✗ node missing — install Node.js 20 or newer"; status=1; }
command -v ffmpeg >/dev/null || { echo "✗ ffmpeg missing — brew install ffmpeg (or your package manager)"; status=1; }
command -v gh >/dev/null || echo "· gh is not installed; attach the files to the PR by hand"
if [ $status -eq 0 ]; then
  stamp="$(cksum <"$DEST/package.json")"
  if [ ! -d "$DEST/node_modules" ] || [ "$(cat "$DEST/node_modules/.pr-reel-stamp" 2>/dev/null)" != "$stamp" ]; then
    echo "→ installing Playwright and tsx into $DEST"
    (cd "$DEST" && npm install --no-audit --no-fund --loglevel=error)
    echo "$stamp" >"$DEST/node_modules/.pr-reel-stamp"
  fi
  (cd "$DEST" && npx playwright install chromium)
fi

echo "pr-reel runtime ready at $DEST"
if [ $is_new_config -eq 1 ]; then
  echo "→ new config: set REEL_START (and check REEL_SETUP) in $DEST/config.sh"
fi
exit $status
