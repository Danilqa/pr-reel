# shellcheck shell=bash
# pr-reel settings for one repository; run.sh and base-server.sh source this file.
# A variable already set in the environment wins, so any value can be overridden for a single run.
# Keep commands in single quotes: $PORT is expanded when the command runs, not here.

# The repository this runtime records
REEL_REPO="${REEL_REPO:-__REPO__}"
# Starts the app on $PORT, run from the repository root (or from the base worktree for "before")
[ -n "${REEL_START:-}" ] || REEL_START=''
# Installs dependencies in the base worktree before it starts
[ -n "${REEL_SETUP:-}" ] || REEL_SETUP='__SETUP__'
# Ports of the working tree ("after") and of the merge base ("before")
REEL_PORT="${REEL_PORT:-4310}"
REEL_BASE_PORT="${REEL_BASE_PORT:-4311}"
# A path that answers once the app is up
REEL_READY_PATH="${REEL_READY_PATH:-/}"
# CSS selectors of dev-only widgets to hide, e.g. '#debug-toolbar, .devtools-toggle'
[ -n "${REEL_HIDE:-}" ] || REEL_HIDE=''
# Fixed timezone so dates render the same in both recordings
export TZ="${TZ:-UTC}"
