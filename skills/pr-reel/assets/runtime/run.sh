#!/usr/bin/env bash
# Entry point of the pr-reel runtime; bootstrap.sh installs it next to the repository it records.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/config.sh"
export REEL_REPO REEL_START REEL_PORT REEL_READY_PATH REEL_HIDE

usage() {
  cat <<USAGE
usage: run.sh <command> [args]

  fast <slug> [after|before]   run the scenario without video or pauses (validate it first)
  record <slug> [after|before] record the scenario; 'before' targets the base server (port $REEL_BASE_PORT)
  compose <slug> [options]     build the mp4 and the before/after page from the recordings (see compose --help)
  frames <video.mp4>           write a 4-frame contact sheet next to the video for a quick look
  base start|stop|remove|status
                               manage the merge-base server used for 'before' recordings

Scenarios live in $HERE/scenarios/<slug>.reel.ts, output in $HERE/out/<slug>/.
USAGE
}

playwright_run() {
  local slug="$1"
  shift
  (cd "$HERE" && REEL_SLUG="$slug" npx playwright test "scenarios/$slug.reel.ts" "$@")
}

# <slug> [after|before] [playwright args...]; 'before' points at the base server unless REEL_URL is set
run_variant() {
  local slug="$1"
  shift
  local variant=after
  case "${1:-}" in
    before | after) variant="$1"; shift ;;
  esac
  if [ "$variant" = before ]; then
    export REEL_URL="${REEL_URL:-http://localhost:$REEL_BASE_PORT}"
  fi
  REEL_VARIANT="$variant" playwright_run "$slug" "$@"
}

cmd="${1:-help}"
[ $# -gt 0 ] && shift

case "$cmd" in
  fast)
    REEL_FAST=1 run_variant "$@"
    ;;
  record)
    run_variant "$@"
    ;;
  compose)
    (cd "$HERE" && node --import tsx lib/compose.ts "$@")
    ;;
  frames)
    video="$1"
    duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")"
    out="${video%.mp4}.frames.png"
    inputs=()
    for fraction in 0.10 0.38 0.66 0.94; do
      inputs+=(-ss "$(awk -v d="$duration" -v f="$fraction" 'BEGIN { printf "%.2f", d * f }')" -i "$video")
    done
    ffmpeg -v error -y "${inputs[@]}" \
      -filter_complex "[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[2:v]scale=640:-2[c];[3:v]scale=640:-2[d];[a][b][c][d]hstack=inputs=4" \
      -frames:v 1 "$out"
    echo "$out (frames at 10%, 38%, 66% and 94%)"
    ;;
  base)
    "$HERE/base-server.sh" "$@"
    ;;
  *)
    usage
    ;;
esac
