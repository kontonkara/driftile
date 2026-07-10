#!/usr/bin/env bash

set -euo pipefail

readonly plugin_id="io.github.kontonkara.driftile"
readonly first_window_title="driftile-smoke-window-a"
readonly second_window_title="driftile-smoke-window-b"
readonly expected_left_frame="16,16,616,688"
readonly expected_right_frame="648,16,616,688"

xterm_pids=()

cleanup() {
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$plugin_id" \
    >/dev/null 2>&1 || true

  local pid

  for pid in "${xterm_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" >/dev/null 2>&1 || true
  done
}

fail() {
  printf 'Smoke-test assertion failed: %s\n' "$1" >&2
  exit 1
}

window_geometry() {
  local window_title=$1

  xwininfo -name "$window_title" 2>/dev/null | awk '
    /Absolute upper-left X:/ { x = $NF }
    /Absolute upper-left Y:/ { y = $NF }
    /^[[:space:]]+Width:/ { width = $NF }
    /^[[:space:]]+Height:/ { height = $NF }
    END {
      if (x == "" || y == "" || width == "" || height == "") {
        exit 1
      }

      printf "%s,%s,%s,%s", x, y, width, height
    }
  '
}

window_frame_geometry() {
  local window_title=$1
  local client_geometry
  local frame_extents
  local client_x client_y client_width client_height
  local left right top bottom

  client_geometry=$(window_geometry "$window_title")
  frame_extents=$(xprop -name "$window_title" _NET_FRAME_EXTENTS 2>/dev/null | awk -F '= ' '
    NF == 2 {
      gsub(",", "", $2)
      print $2
    }
  ')

  [[ -n "$frame_extents" ]] || return 1

  IFS=, read -r client_x client_y client_width client_height <<<"$client_geometry"
  read -r left right top bottom <<<"$frame_extents"

  printf '%s,%s,%s,%s' \
    "$((client_x - left))" \
    "$((client_y - top))" \
    "$((client_width + left + right))" \
    "$((client_height + top + bottom))"
}

wait_for_dbus() {
  local attempt

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    if busctl --user introspect org.kde.KWin /Scripting >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_window() {
  local window_title=$1
  local attempt

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    if window_frame_geometry "$window_title" >/dev/null; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_tiled_layout() {
  local attempt
  local first_frame
  local second_frame

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    first_frame=$(window_frame_geometry "$first_window_title" || true)
    second_frame=$(window_frame_geometry "$second_window_title" || true)

    if [[ \
      "$first_frame" == "$expected_left_frame" && \
        "$second_frame" == "$expected_right_frame" || \
      "$first_frame" == "$expected_right_frame" && \
        "$second_frame" == "$expected_left_frame" \
    ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_geometry() {
  local window_title=$1
  local expected=$2
  local attempt
  local current

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    current=$(window_frame_geometry "$window_title" || true)

    if [[ "$current" == "$expected" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_script_state() {
  local expected=$1
  local attempt
  local state

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    state=$(busctl --user call \
      org.kde.KWin \
      /Scripting \
      org.kde.kwin.Scripting \
      isScriptLoaded \
      s "$plugin_id")

    if [[ "$state" == "b $expected" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

trap cleanup EXIT

wait_for_dbus || fail "KWin scripting D-Bus API did not appear"

xterm \
  -T "$first_window_title" \
  -geometry 60x15+160+120 \
  -e tail -f /dev/null \
  >/dev/null 2>&1 &
xterm_pids+=("$!")

xterm \
  -T "$second_window_title" \
  -geometry 72x18+520+280 \
  -e tail -f /dev/null \
  >/dev/null 2>&1 &
xterm_pids+=("$!")

wait_for_window "$first_window_title" || fail "the first Xwayland test window did not appear"
wait_for_window "$second_window_title" || fail "the second Xwayland test window did not appear"
first_baseline=$(window_frame_geometry "$first_window_title")
second_baseline=$(window_frame_geometry "$second_window_title")

kwriteconfig6 \
  --file "$XDG_CONFIG_HOME/kwinrc" \
  --group Plugins \
  --key "${plugin_id}Enabled" \
  --type bool \
  true

busctl --user call \
  org.kde.KWin \
  /KWin \
  org.kde.KWin \
  reconfigure \
  >/dev/null

wait_for_script_state true || fail "KWin did not report the script as loaded"
wait_for_tiled_layout || fail "Driftile did not produce the expected two-column layout"

kwriteconfig6 \
  --file "$XDG_CONFIG_HOME/kwinrc" \
  --group Plugins \
  --key "${plugin_id}Enabled" \
  --type bool \
  false

busctl --user call \
  org.kde.KWin \
  /KWin \
  org.kde.KWin \
  reconfigure \
  >/dev/null

wait_for_script_state false || fail "KWin did not unload the script"
wait_for_geometry "$first_window_title" "$first_baseline" || fail "Driftile did not restore the first window"
wait_for_geometry "$second_window_title" "$second_baseline" || fail "Driftile did not restore the second window"

touch "$DRIFTILE_SMOKE_RESULT"
