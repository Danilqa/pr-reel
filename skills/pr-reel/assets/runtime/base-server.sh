#!/usr/bin/env bash
# Serves the branch's merge base from a sibling worktree so 'before' screenshots can be recorded.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/config.sh"
REPO="$REEL_REPO"
WORKTREE="${REEL_BASE_DIR:-$(dirname "$REPO")/$(basename "$REPO")--pr-reel-base}"
PORT="$REEL_BASE_PORT"
PID_FILE="$WORKTREE/.pr-reel-server.pid"
LOG_FILE="$WORKTREE/.pr-reel-server.log"

default_branch() {
  local ref
  if ref="$(git -C "$REPO" symbolic-ref --quiet --short refs/remotes/origin/HEAD)"; then
    echo "$ref"
    return
  fi
  for ref in origin/main origin/master main master; do
    if git -C "$REPO" rev-parse --verify --quiet "$ref" >/dev/null; then
      echo "$ref"
      return
    fi
  done
  echo "no default branch found; set REEL_BASE_REF" >&2
  exit 1
}

resolve_ref() {
  if [ -n "${REEL_BASE_REF:-}" ]; then
    echo "$REEL_BASE_REF"
  else
    git -C "$REPO" merge-base "$(default_branch)" HEAD
  fi
}

stop_server() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  # The start command usually forks (package manager → dev server), so free the port as well
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
}

start_server() {
  local ref sha
  if [ -z "$REEL_START" ]; then
    echo "REEL_START is empty: set it in $HERE/config.sh" >&2
    exit 1
  fi
  ref="$(resolve_ref)"
  sha="$(git -C "$REPO" rev-parse --short "$ref")"
  if [ -e "$WORKTREE/.git" ]; then
    git -C "$WORKTREE" checkout --quiet --detach "$ref"
  else
    git -C "$REPO" worktree add --quiet --detach "$WORKTREE" "$ref"
  fi
  stop_server
  if [ -n "$REEL_SETUP" ]; then
    echo "→ $REEL_SETUP"
    (cd "$WORKTREE" && bash -c "$REEL_SETUP")
  fi
  (
    cd "$WORKTREE"
    PORT="$PORT" nohup bash -c "$REEL_START" >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
  for _ in $(seq 1 90); do
    if curl -s -o /dev/null "http://localhost:$PORT$REEL_READY_PATH"; then
      echo "base server ready: http://localhost:$PORT (base $sha, worktree $WORKTREE)"
      return 0
    fi
    sleep 2
  done
  echo "base server did not start, see $LOG_FILE" >&2
  exit 1
}

case "${1:-status}" in
  start) start_server ;;
  stop) stop_server; echo "base server stopped" ;;
  remove)
    stop_server
    if [ -e "$WORKTREE/.git" ]; then
      git -C "$REPO" worktree remove --force "$WORKTREE"
      echo "removed $WORKTREE"
    fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "running on http://localhost:$PORT ($WORKTREE)"
    else
      echo "not running"
    fi
    ;;
  *) echo "usage: base-server.sh start|stop|remove|status" >&2; exit 1 ;;
esac
