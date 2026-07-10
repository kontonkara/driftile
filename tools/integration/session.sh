#!/usr/bin/env bash

set -euo pipefail

if [[ "${DRIFTILE_SMOKE_TRACE:-0}" == "1" ]]; then
  set -x
fi

readonly plugin_id="io.github.kontonkara.driftile"
readonly native_tile_toggle_plugin_id="io.github.kontonkara.driftile.integration-native-tile-toggle"
readonly output_router_plugin_id="io.github.kontonkara.driftile.integration-output-router"
readonly stable_sample_count=2
readonly wait_attempts=200

client_pids=()
qml_options=(--software)
work_area_panel_pid=""
x11_work_area_dock_pid=""

if [[ -n "${DRIFTILE_SMOKE_QML_IMPORT:-}" ]]; then
  qml_options+=(-I "$DRIFTILE_SMOKE_QML_IMPORT")
fi

stop_clients() {
  local pid

  for pid in "${client_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" >/dev/null 2>&1 || true
  done

  client_pids=()
}

stop_work_area_panel() {
  if [[ -z "$work_area_panel_pid" ]]; then
    return
  fi

  kill "$work_area_panel_pid" >/dev/null 2>&1 || true
  wait "$work_area_panel_pid" >/dev/null 2>&1 || true
  work_area_panel_pid=""
}

stop_x11_work_area_dock() {
  if [[ -z "$x11_work_area_dock_pid" ]]; then
    return
  fi

  kill "$x11_work_area_dock_pid" >/dev/null 2>&1 || true
  wait "$x11_work_area_dock_pid" >/dev/null 2>&1 || true
  x11_work_area_dock_pid=""
}

cleanup() {
  stop_work_area_panel
  stop_x11_work_area_dock
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$plugin_id" \
    >/dev/null 2>&1 || true
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$native_tile_toggle_plugin_id" \
    >/dev/null 2>&1 || true
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$output_router_plugin_id" \
    >/dev/null 2>&1 || true
  stop_clients
}

fail() {
  printf 'Smoke-test assertion failed: %s\n' "$1" >&2
  exit 1
}

window_match_id() {
  local window_title=$1

  busctl --user --json=short call \
    org.kde.KWin \
    /WindowsRunner \
    org.kde.krunner1 \
    Match \
    s "$window_title" | jq --exit-status --raw-output --arg title "$window_title" '
      [.data[0][] | select(.[1] == $title)] as $matches
      | select($matches | length == 1)
      | $matches[0][0]
    '
}

window_id() {
  local match_id

  match_id=$(window_match_id "$1") || return 1
  printf '%s' "${match_id#*_}"
}

x11_window_id() {
  local window_title=$1
  local candidate
  local candidate_title

  for candidate in $(
    xprop -root -notype _NET_CLIENT_LIST 2>/dev/null |
      sed -n 's/^_NET_CLIENT_LIST[^#]*# //p' |
      tr ',' '\n'
  ); do
    candidate_title=$(
      xprop -id "$candidate" -notype _NET_WM_NAME 2>/dev/null |
        sed -n 's/^_NET_WM_NAME = "\(.*\)"$/\1/p'
    )

    if [[ "$candidate_title" == "$window_title" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  return 1
}

window_action_match_id() {
  local window_title=$1
  local action=$2

  busctl --user --json=short call \
    org.kde.KWin \
    /WindowsRunner \
    org.kde.krunner1 \
    Match \
    s "$window_title $action" | jq --exit-status --raw-output --arg title "$window_title" '
      [.data[0][] | select(.[1] == $title)] as $matches
      | select($matches | length == 1)
      | $matches[0][0]
    '
}

run_window_action() {
  local match_id

  match_id=$(window_action_match_id "$1" "$2") || return 1

  busctl --user call \
    org.kde.KWin \
    /WindowsRunner \
    org.kde.krunner1 \
    Run \
    ss "$match_id" "" \
    >/dev/null
}

shortcut_is_registered() {
  local shortcut_name=$1

  busctl --user call \
    org.kde.kglobalaccel \
    /component/kwin \
    org.kde.kglobalaccel.Component \
    shortcutNames 2>/dev/null | grep -Fq "$shortcut_name"
}

wait_for_shortcut() {
  local shortcut_name=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if shortcut_is_registered "$shortcut_name"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

invoke_shortcut() {
  busctl --user call \
    org.kde.kglobalaccel \
    /component/kwin \
    org.kde.kglobalaccel.Component \
    invokeShortcut \
    s "$1" \
    >/dev/null
}

activate_window() {
  local match_id

  match_id=$(window_match_id "$1") || return 1

  busctl --user call \
    org.kde.KWin \
    /WindowsRunner \
    org.kde.krunner1 \
    Run \
    ss "$match_id" "" \
    >/dev/null
}

window_frame_geometry() {
  local window_title=$1
  local id

  id=$(window_id "$window_title") || return 1

  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" | jq --exit-status --raw-output '
      [
        .data[0].x.data,
        .data[0].y.data,
        .data[0].width.data,
        .data[0].height.data
      ]
      | select(all(.[]; type == "number"))
      | map((((. * 1000000) | round) / 1000000) | tostring)
      | join(",")
    '
}

window_state_matches() {
  local id=$1
  local state=$2
  local expected=$3

  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" | jq --exit-status \
      --arg state "$state" \
      --argjson expected "$expected" '
        if $state == "maximized" then
          if $expected then
            (.data[0].maximizeHorizontal.data != 0) and
            (.data[0].maximizeVertical.data != 0)
          else
            (.data[0].maximizeHorizontal.data == 0) and
            (.data[0].maximizeVertical.data == 0)
          end
        else
          (.data[0][$state].data == $expected)
        end
      ' >/dev/null
}

window_is_on_output_side() {
  local window_title=$1
  local side=$2
  local id

  id=$(window_id "$window_title") || return 1

  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" | jq --exit-status --arg side "$side" '
      (.data[0].x.data + (.data[0].width.data / 2)) as $center
      | if $side == "left" then
          $center >= 0 and $center < 1280
        else
          $center >= 1280 and $center < 2560
        end
    ' >/dev/null
}

wait_for_dbus() {
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if busctl --user introspect org.kde.KWin /Scripting >/dev/null 2>&1 &&
      busctl --user introspect org.kde.KWin /WindowsRunner >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

capture_stable_geometry() {
  local window_title=$1
  local attempt
  local current
  local previous=""

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    current=$(window_frame_geometry "$window_title" 2>/dev/null || true)

    if [[ -n "$current" && "$current" == "$previous" ]]; then
      printf '%s' "$current"
      return 0
    fi

    previous=$current
    sleep 0.05
  done

  return 1
}

wait_for_window_gone() {
  local window_title=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if ! window_id "$window_title" >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

x11_screen_size_matches() {
  local width=$1
  local height=$2

  xrandr --current 2>/dev/null |
    grep -F "current $width x $height," >/dev/null
}

wait_for_x11_screen_size() {
  local width=$1
  local height=$2
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if x11_screen_size_matches "$width" "$height"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

x11_work_area_matches() {
  local expected=$1
  local actual

  actual=$(
    xprop -root -notype _NET_WORKAREA 2>/dev/null |
      sed -n 's/^_NET_WORKAREA = //p' |
      cut -d, -f1-4 |
      tr -d ' '
  )

  [[ "$actual" == "$expected" ]]
}

wait_for_x11_work_area() {
  local expected=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if x11_work_area_matches "$expected"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_x11_window() {
  local window_title=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if x11_window_id "$window_title" >/dev/null 2>&1; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

output_enabled_matches() {
  local output_name=$1
  local expected=$2

  kscreen-doctor -j 2>/dev/null | jq --exit-status \
    --arg outputName "$output_name" \
    --argjson expected "$expected" '
      .outputs[]
      | select(.name == $outputName)
      | .enabled == $expected
    ' >/dev/null
}

output_configuration_matches() {
  local output_name=$1
  local x=$2
  local y=$3
  local width=$4
  local height=$5
  local scale=$6

  kscreen-doctor -j 2>/dev/null | jq --exit-status \
    --arg outputName "$output_name" \
    --argjson x "$x" \
    --argjson y "$y" \
    --argjson width "$width" \
    --argjson height "$height" \
    --argjson scale "$scale" '
      .outputs[]
      | select(.name == $outputName)
      | .enabled
      and .pos.x == $x
      and .pos.y == $y
      and .size.width == $width
      and .size.height == $height
      and .scale == $scale
    ' >/dev/null
}

wait_for_output_enabled() {
  local output_name=$1
  local expected=$2
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if output_enabled_matches "$output_name" "$expected"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_output_configuration() {
  local output_name=$1
  local x=$2
  local y=$3
  local width=$4
  local height=$5
  local scale=$6
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if output_configuration_matches "$output_name" "$x" "$y" "$width" "$height" "$scale"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_layout() {
  wait_for_geometries "$@"
}

wait_for_geometries() {
  local -a window_titles=()
  local attempt
  local current_frame
  local current_layout
  local expected_layout=""
  local index
  local matches=0
  local previous_layout=""

  if ((($# == 0) || ($# % 2 != 0))); then
    return 2
  fi

  while (($# > 0)); do
    window_titles+=("$1")
    expected_layout+="${expected_layout:+|}$2"
    shift 2
  done

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    current_layout=""

    for index in "${!window_titles[@]}"; do
      current_frame=$(window_frame_geometry "${window_titles[index]}" 2>/dev/null || true)
      current_layout+="${current_layout:+|}$current_frame"
    done

    if [[ "$current_layout" == "$expected_layout" && "$current_layout" == "$previous_layout" ]]; then
      ((matches += 1))
    elif [[ "$current_layout" == "$expected_layout" ]]; then
      matches=1
    else
      matches=0
    fi

    if ((matches >= stable_sample_count)); then
      return 0
    fi

    previous_layout=$current_layout
    sleep 0.05
  done

  return 1
}

wait_for_state_and_geometries() {
  local id=$1
  local state=$2
  local expected=$3
  local -a window_titles=()
  local attempt
  local current_frame
  local current_layout
  local expected_layout=""
  local index
  local matches=0
  local previous_layout=""
  local state_ready

  shift 3

  if ((($# == 0) || ($# % 2 != 0))); then
    return 2
  fi

  while (($# > 0)); do
    window_titles+=("$1")
    expected_layout+="${expected_layout:+|}$2"
    shift 2
  done

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    current_layout=""
    state_ready=0

    for index in "${!window_titles[@]}"; do
      current_frame=$(window_frame_geometry "${window_titles[index]}" 2>/dev/null || true)
      current_layout+="${current_layout:+|}$current_frame"
    done

    if window_state_matches "$id" "$state" "$expected" 2>/dev/null; then
      state_ready=1
    fi

    if ((state_ready == 1)) &&
      [[ "$current_layout" == "$expected_layout" && "$current_layout" == "$previous_layout" ]]; then
      ((matches += 1))
    elif ((state_ready == 1)) && [[ "$current_layout" == "$expected_layout" ]]; then
      matches=1
    else
      matches=0
    fi

    if ((matches >= stable_sample_count)); then
      return 0
    fi

    previous_layout=$current_layout
    sleep 0.05
  done

  return 1
}

describe_layout() {
  local window_title
  local window_frame

  for window_title in "$@"; do
    window_frame=$(window_frame_geometry "$window_title" 2>/dev/null || true)
    printf '%s=%s ' "$window_title" "${window_frame:-missing}"
  done
}

wait_for_script_state() {
  wait_for_named_script_state "$plugin_id" "$1"
}

wait_for_named_script_state() {
  local name=$1
  local expected=$2
  local attempt
  local state

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    state=$(busctl --user call \
      org.kde.KWin \
      /Scripting \
      org.kde.kwin.Scripting \
      isScriptLoaded \
      s "$name" 2>/dev/null || true)

    if [[ "$state" == "b $expected" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

run_one_shot_script() {
  local script_path=$1
  local name=$2
  local load_result
  local script_id
  local unload_result

  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss "$script_path" "$name") || return 1
  script_id=${load_result#i }

  if [[ ! "$script_id" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  busctl --user call \
    org.kde.KWin \
    "/Scripting/Script${script_id}" \
    org.kde.kwin.Script \
    run \
    >/dev/null || return 1

  unload_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$name") || return 1

  [[ "$unload_result" == "b true" ]] || return 1
  wait_for_named_script_state "$name" false
}

toggle_native_tile() {
  run_one_shot_script \
    "$DRIFTILE_SMOKE_NATIVE_TILE_TOGGLE" \
    "$native_tile_toggle_plugin_id"
}

load_output_router() {
  local load_result
  local script_id

  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss "$DRIFTILE_SMOKE_OUTPUT_ROUTER" "$output_router_plugin_id") || return 1
  script_id=${load_result#i }

  if [[ ! "$script_id" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  busctl --user call \
    org.kde.KWin \
    "/Scripting/Script${script_id}" \
    org.kde.kwin.Script \
    run \
    >/dev/null || return 1

  wait_for_named_script_state "$output_router_plugin_id" true
}

unload_output_router() {
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$output_router_plugin_id" \
    >/dev/null || return 1

  wait_for_named_script_state "$output_router_plugin_id" false
}

set_plugin_state() {
  local enabled=$1

  kwriteconfig6 \
    --file "$XDG_CONFIG_HOME/kwinrc" \
    --group Plugins \
    --key "${plugin_id}Enabled" \
    --type bool \
    "$enabled"

  busctl --user call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    reconfigure \
    >/dev/null
}

start_client() {
  local protocol=$1
  local window_title=$2

  case "$protocol" in
    wayland)
      QT_QPA_PLATFORM=wayland qml \
        "${qml_options[@]}" \
        -f "$DRIFTILE_SMOKE_CLIENT" \
        -- "$window_title" &
      ;;
    x11 | xwayland)
      QT_QPA_PLATFORM=xcb qml \
        "${qml_options[@]}" \
        -f "$DRIFTILE_SMOKE_CLIENT" \
        -- "$window_title" &
      ;;
    *)
      fail "unsupported client protocol: $protocol"
      ;;
  esac

  client_pids+=("$!")
}

start_work_area_panel() {
  local -a panel_qml_options=("${qml_options[@]}")

  if [[ -n "${DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT:-}" ]]; then
    panel_qml_options+=(
      -I "$DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT"
    )
  fi

  QT_QPA_PLATFORM=wayland qml \
    "${panel_qml_options[@]}" \
    -f "$DRIFTILE_SMOKE_WORK_AREA_PANEL" &
  work_area_panel_pid=$!
}

start_x11_work_area_dock() {
  local window_title=$1

  QT_QPA_PLATFORM=xcb qml \
    "${qml_options[@]}" \
    -f "$DRIFTILE_SMOKE_CLIENT" \
    -- "$window_title" &
  x11_work_area_dock_pid=$!
}

set_x11_work_area_strut() {
  local window=$1

  xprop \
    -id "$window" \
    -f _NET_WM_WINDOW_TYPE 32a \
    -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_DOCK \
    >/dev/null
  xprop \
    -id "$window" \
    -f _NET_WM_STRUT_PARTIAL 32c \
    -set _NET_WM_STRUT_PARTIAL '0, 0, 64, 0, 0, 0, 0, 0, 0, 1279, 0, 0' \
    >/dev/null
}

clear_x11_work_area_strut() {
  local window=$1

  xprop -id "$window" -remove _NET_WM_STRUT_PARTIAL >/dev/null
}

verify_window_action_transition() {
  local protocol=$1
  local action=$2
  local state=$3
  local id=$4
  local reserved_title=$5
  local target_title=$6
  local reserved_frame=$7
  local active_frame=$8
  local restored_frame=$9

  run_window_action "$target_title" "$action" || \
    fail "KWin could not enter $action for the $protocol state window"
  wait_for_state_and_geometries \
    "$id" "$state" true \
    "$reserved_title" "$reserved_frame" \
    "$target_title" "$active_frame" || \
    fail "Driftile fought the $protocol $action transition: $(describe_layout "$reserved_title" "$target_title")"

  run_window_action "$target_title" "$action" || \
    fail "KWin could not leave $action for the $protocol state window"
  wait_for_state_and_geometries \
    "$id" "$state" false \
    "$reserved_title" "$reserved_frame" \
    "$target_title" "$restored_frame" || \
    fail "Driftile did not restore the $protocol state window after $action: $(describe_layout "$reserved_title" "$target_title")"
}

verify_x11_topology_recovery() {
  local first_title=$1
  local second_title=$2
  local dock_title="driftile-x11-work-area-dock"
  local dock_window
  local normal_first="16,16,616,688"
  local normal_second="648,16,616,688"
  local reserved_first="16,80,616,624"
  local reserved_second="648,80,616,624"

  set_plugin_state true
  wait_for_script_state true || fail "KWin did not reload Driftile for X11 topology recovery"
  wait_for_geometries \
    "$first_title" "$normal_first" \
    "$second_title" "$normal_second" || \
    fail "Driftile did not establish the X11 topology layout: $(describe_layout "$first_title" "$second_title")"

  xrandr --output screen --mode 1024x600 >/dev/null || \
    fail "RandR could not apply the 1024x600 X11 mode"
  wait_for_x11_screen_size 1024 600 || \
    fail "RandR did not publish the 1024x600 X11 screen size"
  wait_for_geometries \
    "$first_title" "16,16,488,568" \
    "$second_title" "520,16,488,568" || \
    fail "Driftile did not recover the 1024x600 X11 layout: $(describe_layout "$first_title" "$second_title")"

  xrandr --output screen --mode 1280x720 >/dev/null || \
    fail "RandR could not restore the 1280x720 X11 mode"
  wait_for_x11_screen_size 1280 720 || \
    fail "RandR did not publish the restored 1280x720 X11 screen size"
  wait_for_geometries \
    "$first_title" "$normal_first" \
    "$second_title" "$normal_second" || \
    fail "Driftile did not recover the restored X11 mode: $(describe_layout "$first_title" "$second_title")"

  set_plugin_state false
  wait_for_script_state false || \
    fail "KWin did not unload Driftile before the X11 work-area test"

  start_x11_work_area_dock "$dock_title"
  wait_for_x11_window "$dock_title" || fail "the X11 work-area dock did not appear"
  dock_window=$(x11_window_id "$dock_title") || \
    fail "X11 did not expose the work-area dock id"
  set_x11_work_area_strut "$dock_window" || \
    fail "X11 could not configure the work-area dock strut"
  wait_for_x11_work_area "0,64,1280,656" || \
    fail "KWin did not reserve the X11 dock work area"

  set_plugin_state true
  wait_for_script_state true || \
    fail "KWin did not reload Driftile for the X11 work-area test"
  wait_for_geometries \
    "$first_title" "$reserved_first" \
    "$second_title" "$reserved_second" || \
    fail "Driftile did not use the X11 dock work area: $(describe_layout "$first_title" "$second_title")"

  clear_x11_work_area_strut "$dock_window" || \
    fail "X11 could not remove the work-area dock strut"
  wait_for_x11_work_area "0,0,1280,720" || \
    fail "KWin did not restore the X11 work area after strut removal"
  wait_for_geometries \
    "$first_title" "$normal_first" \
    "$second_title" "$normal_second" || \
    fail "Driftile did not recover after X11 strut removal: $(describe_layout "$first_title" "$second_title")"

  set_x11_work_area_strut "$dock_window" || \
    fail "X11 could not restore the work-area dock strut"
  wait_for_x11_work_area "0,64,1280,656" || \
    fail "KWin did not restore the X11 dock work area"
  wait_for_geometries \
    "$first_title" "$reserved_first" \
    "$second_title" "$reserved_second" || \
    fail "Driftile did not recover the restored X11 strut: $(describe_layout "$first_title" "$second_title")"

  stop_x11_work_area_dock
  wait_for_window_gone "$dock_title" || fail "the X11 work-area dock did not close"
  wait_for_x11_work_area "0,0,1280,720" || \
    fail "KWin did not restore the X11 work area after the dock closed"
  wait_for_geometries \
    "$first_title" "$normal_first" \
    "$second_title" "$normal_second" || \
    fail "Driftile did not recover after the X11 dock closed: $(describe_layout "$first_title" "$second_title")"

  set_plugin_state false
  wait_for_script_state false || \
    fail "KWin did not unload Driftile after X11 topology recovery"
}

run_scenario() {
  local protocol=$1
  local first_title="driftile-smoke-${protocol}-a"
  local second_title="driftile-state-target-${protocol}"
  local third_title="driftile-smoke-${protocol}-c"
  local first_baseline
  local second_baseline
  local third_baseline
  local state_window_id
  local reserved_frame="16,16,616,688"
  local state_frame="648,16,616,688"
  local full_output_frame="0,0,1280,720"
  local native_tile_frame="4,4,314,712"

  start_client "$protocol" "$first_title"
  capture_stable_geometry "$first_title" >/dev/null || fail "the first $protocol test window did not stabilize"
  start_client "$protocol" "$second_title"
  capture_stable_geometry "$second_title" >/dev/null || fail "the second $protocol test window did not stabilize"
  start_client "$protocol" "$third_title"

  first_baseline=$(capture_stable_geometry "$first_title") || fail "the first $protocol test window did not stabilize"
  second_baseline=$(capture_stable_geometry "$second_title") || fail "the second $protocol test window did not stabilize"
  third_baseline=$(capture_stable_geometry "$third_title") || fail "the third $protocol test window did not stabilize"

  activate_window "$third_title" || fail "KWin could not activate the third $protocol window"

  set_plugin_state true
  wait_for_script_state true || fail "KWin did not report Driftile as loaded"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reveal the third $protocol window: $(describe_layout "$first_title" "$second_title" "$third_title")"

  activate_window "$first_title" || fail "KWin could not activate the first $protocol window"
  wait_for_layout \
    "$first_title" "0,16,616,688" \
    "$second_title" "632,16,616,688" \
    "$third_title" "1264,16,616,688" || \
    fail "Driftile did not reveal the first $protocol window: $(describe_layout "$first_title" "$second_title" "$third_title")"

  activate_window "$third_title" || fail "KWin could not reactivate the third $protocol window"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reveal the third $protocol window again: $(describe_layout "$first_title" "$second_title" "$third_title")"

  wait_for_shortcut "Driftile Move Column Left" || \
    fail "KGlobalAccel did not register the move-left shortcut"
  wait_for_shortcut "Driftile Move Column Right" || \
    fail "KGlobalAccel did not register the move-right shortcut"
  invoke_shortcut "Driftile Move Column Left" || \
    fail "KGlobalAccel could not invoke the move-left shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "664,16,616,688" \
    "$third_title" "32,16,616,688" || \
    fail "Driftile did not move the active $protocol column left: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "Driftile Move Column Right" || \
    fail "KGlobalAccel could not invoke the move-right shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not move the active $protocol column right: $(describe_layout "$first_title" "$second_title" "$third_title")"

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile"
  wait_for_layout \
    "$first_title" "$first_baseline" \
    "$second_title" "$second_baseline" \
    "$third_title" "$third_baseline" || \
    fail "Driftile did not restore the $protocol windows: $(describe_layout "$first_title" "$second_title" "$third_title")"

  run_window_action "$third_title" close || fail "KWin could not close the third $protocol window"
  wait_for_window_gone "$third_title" || fail "the third $protocol test window did not close"

  activate_window "$second_title" || fail "KWin could not activate the $protocol state window"
  set_plugin_state true
  wait_for_script_state true || fail "KWin did not reload Driftile for $protocol state transitions"
  wait_for_geometries \
    "$first_title" "$reserved_frame" \
    "$second_title" "$state_frame" || \
    fail "Driftile did not reserve the $protocol state layout: $(describe_layout "$first_title" "$second_title")"

  state_window_id=$(window_id "$second_title") || fail "KWin did not expose the $protocol state window id"

  verify_window_action_transition \
    "$protocol" fullscreen fullscreen "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$full_output_frame" "$state_frame"
  verify_window_action_transition \
    "$protocol" minimize minimized "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$state_frame" "$state_frame"
  verify_window_action_transition \
    "$protocol" maximize maximized "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$full_output_frame" "$state_frame"

  # Standalone KWin X11 6.7 does not expose workspace.rootTile to scripts.
  if [[ "$protocol" != "x11" ]]; then
    toggle_native_tile || fail "KWin could not attach the $protocol state window to a native tile"
    wait_for_state_and_geometries \
      "$state_window_id" keepAbove true \
      "$first_title" "$reserved_frame" \
      "$second_title" "$native_tile_frame" || \
      fail "Driftile fought the $protocol native tile: $(describe_layout "$first_title" "$second_title")"

    toggle_native_tile || fail "KWin could not release the $protocol state window from its native tile"
    wait_for_state_and_geometries \
      "$state_window_id" keepAbove false \
      "$first_title" "$reserved_frame" \
      "$second_title" "$state_frame" || \
      fail "Driftile did not restore the $protocol state window after native tiling: $(describe_layout "$first_title" "$second_title")"
  fi

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile after $protocol state transitions"
  wait_for_geometries \
    "$first_title" "$first_baseline" \
    "$second_title" "$second_baseline" || \
    fail "Driftile did not restore the post-transition $protocol windows: $(describe_layout "$first_title" "$second_title")"

  if [[ "$protocol" == "x11" ]]; then
    verify_x11_topology_recovery "$first_title" "$second_title"
  fi

  stop_clients
  wait_for_window_gone "$first_title" || fail "the first $protocol test window did not close"
  wait_for_window_gone "$second_title" || fail "the second $protocol test window did not close"
  wait_for_window_gone "$third_title" || fail "the third $protocol test window did not close"
}

run_multi_output_scenario() {
  local protocol=$1
  local baseline
  local index
  local scaled_left_first="16,16,402.666667,448"
  local scaled_left_second="434.666667,16,402.666667,448"
  local side
  local -a baselines=()
  local -a titles=(
    "driftile-multi-output-${protocol}-left-a"
    "driftile-multi-output-${protocol}-left-b"
    "driftile-multi-output-${protocol}-left-c"
    "driftile-multi-output-${protocol}-right-a"
    "driftile-multi-output-${protocol}-right-b"
    "driftile-multi-output-${protocol}-right-c"
  )

  if [[ "$protocol" == "wayland" ]]; then
    scaled_left_first="16,16,403.333333,448"
    scaled_left_second="434.666667,16,403.333333,448"
  fi

  for index in "${!titles[@]}"; do
    start_client "$protocol" "${titles[index]}"

    if ! baseline=$(capture_stable_geometry "${titles[index]}"); then
      fail "the multi-output $protocol window ${titles[index]} did not stabilize"
    fi

    baselines+=("$baseline")

    if ((index < 3)); then
      side=left
    else
      side=right
    fi

    window_is_on_output_side "${titles[index]}" "$side" || \
      fail "the output router did not place ${titles[index]} on the $side output"
  done

  activate_window "${titles[5]}" || fail "KWin could not activate the final multi-output $protocol window"

  set_plugin_state true
  wait_for_script_state true || fail "KWin did not report Driftile as loaded"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[2]}" "${baselines[2]}" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" \
    "${titles[5]}" "${baselines[5]}" || \
    fail "Driftile did not preserve two isolated $protocol output contexts: $(describe_layout "${titles[@]}")"

  if [[ "$protocol" == "wayland" ]]; then
    activate_window "${titles[0]}" || \
      fail "KWin could not activate the left $protocol window for the work-area panel"
    start_work_area_panel
    wait_for_geometries \
      "${titles[0]}" "80,16,584,688" \
      "${titles[1]}" "680,16,584,688" \
      "${titles[3]}" "1296,16,616,688" \
      "${titles[4]}" "1928,16,616,688" || \
      fail "Driftile did not recover the $protocol work area after a layer-shell panel appeared: $(describe_layout "${titles[@]}")"

    stop_work_area_panel
    wait_for_geometries \
      "${titles[0]}" "16,16,616,688" \
      "${titles[1]}" "648,16,616,688" \
      "${titles[3]}" "1296,16,616,688" \
      "${titles[4]}" "1928,16,616,688" || \
      fail "Driftile did not recover the $protocol work area after the layer-shell panel disappeared: $(describe_layout "${titles[@]}")"

    activate_window "${titles[5]}" || \
      fail "KWin could not reactivate the final multi-output $protocol window"
  fi

  kscreen-doctor \
    output.Virtual-0.scale.1.5 \
    output.Virtual-0.position.0,0 \
    output.Virtual-1.position.854,0 \
    >/dev/null || fail "KScreen could not scale and reposition the virtual outputs"
  wait_for_output_configuration Virtual-0 0 0 1280 720 1.5 || \
    fail "KScreen did not apply the scaled Virtual-0 configuration"
  wait_for_output_configuration Virtual-1 854 0 1280 720 1 || \
    fail "KScreen did not reposition Virtual-1 after scaling Virtual-0"
  wait_for_geometries \
    "${titles[0]}" "$scaled_left_first" \
    "${titles[1]}" "$scaled_left_second" \
    "${titles[3]}" "870,16,616,688" \
    "${titles[4]}" "1502,16,616,688" || \
    fail "Driftile did not recover the scaled $protocol output contexts: $(describe_layout "${titles[@]}")"

  kscreen-doctor \
    output.Virtual-0.scale.1 \
    output.Virtual-0.position.0,0 \
    output.Virtual-1.position.1280,0 \
    >/dev/null || fail "KScreen could not restore the virtual output scale and positions"
  wait_for_output_configuration Virtual-0 0 0 1280 720 1 || \
    fail "KScreen did not restore the Virtual-0 configuration"
  wait_for_output_configuration Virtual-1 1280 0 1280 720 1 || \
    fail "KScreen did not restore the Virtual-1 position"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not recover the restored $protocol output scale: $(describe_layout "${titles[@]}")"

  kscreen-doctor output.Virtual-1.disable >/dev/null || \
    fail "KScreen could not disable Virtual-1"
  wait_for_output_enabled Virtual-1 false || \
    fail "KScreen did not disable Virtual-1"

  wait_for_geometries \
    "${titles[0]}" "-2496,16,616,688" \
    "${titles[1]}" "-1864,16,616,688" \
    "${titles[2]}" "-1232,16,616,688" \
    "${titles[3]}" "-600,16,616,688" \
    "${titles[4]}" "32,16,616,688" \
    "${titles[5]}" "664,16,616,688" || \
    fail "Driftile did not merge the $protocol windows onto the remaining output: $(describe_layout "${titles[@]}")"

  kscreen-doctor \
    output.Virtual-1.enable \
    output.Virtual-1.scale.1 \
    output.Virtual-1.position.1280,0 \
    >/dev/null || fail "KScreen could not re-enable Virtual-1"
  wait_for_output_configuration Virtual-1 1280 0 1280 720 1 || \
    fail "KScreen did not restore the Virtual-1 configuration"
  wait_for_geometries \
    "${titles[1]}" "16,16,616,688" \
    "${titles[2]}" "648,16,616,688" \
    "${titles[4]}" "1296,16,616,688" \
    "${titles[5]}" "1928,16,616,688" || \
    fail "Driftile did not recover after Virtual-1 was re-enabled: $(describe_layout "${titles[@]}")"

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile"

  for index in "${!titles[@]}"; do
    capture_stable_geometry "${titles[index]}" >/dev/null || \
      fail "the unloaded multi-output $protocol window ${titles[index]} did not stabilize"

    if ((index < 3)); then
      side=left
    else
      side=right
    fi

    window_is_on_output_side "${titles[index]}" "$side" || \
      fail "Driftile made a stale restore jump while unloading ${titles[index]} after $protocol topology recovery"
  done

  stop_clients

  for index in "${!titles[@]}"; do
    wait_for_window_gone "${titles[index]}" || \
      fail "the multi-output $protocol window ${titles[index]} did not close"
  done
}

trap cleanup EXIT

wait_for_dbus || fail "the required KWin D-Bus APIs did not appear"

case "${DRIFTILE_SMOKE_SCENARIO:-single-output}" in
  multi-output)
    load_output_router || fail "KWin could not load the integration output router"

    for protocol in $DRIFTILE_SMOKE_PROTOCOLS; do
      run_multi_output_scenario "$protocol"
    done

    unload_output_router || fail "KWin could not unload the integration output router"
    ;;
  single-output)
    for protocol in $DRIFTILE_SMOKE_PROTOCOLS; do
      run_scenario "$protocol"
    done
    ;;
  *)
    fail "unsupported smoke-test scenario: $DRIFTILE_SMOKE_SCENARIO"
    ;;
esac

touch "$DRIFTILE_SMOKE_RESULT"
