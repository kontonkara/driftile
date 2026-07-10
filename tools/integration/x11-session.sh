#!/usr/bin/env bash

set -euo pipefail

kwin_pid=""

cleanup() {
  if [[ -n "$kwin_pid" ]]; then
    kill "$kwin_pid" >/dev/null 2>&1 || true
    wait "$kwin_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

QT_QPA_PLATFORM=xcb LIBGL_ALWAYS_SOFTWARE=1 kwin_x11 --no-kactivities &
kwin_pid=$!

"$(dirname "${BASH_SOURCE[0]}")/session.sh"
