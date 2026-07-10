#!/usr/bin/env bash

set -euo pipefail

if [[ "${DRIFTILE_SMOKE_TRACE:-0}" == "1" ]]; then
  set -x
fi

readonly plugin_id="io.github.kontonkara.driftile"
readonly automatic_floating_probe_plugin_id="io.github.kontonkara.driftile.integration-automatic-floating-probe"
readonly automatic_floating_probe_arm_shortcut="Driftile Integration Automatic Floating Arm"
readonly automatic_floating_probe_armed_shortcut_prefix="Driftile Integration Automatic Floating Armed"
readonly automatic_floating_probe_capture_shortcut="Driftile Integration Automatic Floating Capture"
readonly automatic_floating_probe_captured_shortcut_prefix="Driftile Integration Automatic Floating Captured"
readonly automatic_floating_probe_closed_shortcut_prefix="Driftile Integration Automatic Floating Closed"
readonly automatic_floating_probe_reset_shortcut="Driftile Integration Automatic Floating Reset"
readonly automatic_floating_probe_reset_shortcut_prefix="Driftile Integration Automatic Floating Reset Complete"
readonly automatic_floating_probe_verified_shortcut_prefix="Driftile Integration Automatic Floating Verified"
readonly automatic_floating_probe_verify_shortcut="Driftile Integration Automatic Floating Verify"
readonly desktop_state_probe_plugin_id="io.github.kontonkara.driftile.integration-desktop-state-probe"
readonly desktop_state_verified_shortcut_prefix="Driftile Integration Desktop State Verified"
readonly native_tile_toggle_plugin_id="io.github.kontonkara.driftile.integration-native-tile-toggle"
readonly output_router_plugin_id="io.github.kontonkara.driftile.integration-output-router"
readonly output_transfer_state_probe_plugin_id="io.github.kontonkara.driftile.integration-output-transfer-state-probe"
readonly output_transfer_state_verified_shortcut_prefix="Driftile Integration Output Transfer State Verified"
readonly stable_sample_count=2
readonly wait_attempts=200

client_pids=()
primary_desktop_id=""
qml_options=(--software)
secondary_desktop_id=""
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

stop_client() {
  local pid
  local target_pid=$1
  local -a remaining_pids=()

  kill "$target_pid" >/dev/null 2>&1 || true
  wait "$target_pid" >/dev/null 2>&1 || true

  for pid in "${client_pids[@]}"; do
    if [[ "$pid" != "$target_pid" ]]; then
      remaining_pids+=("$pid")
    fi
  done

  client_pids=("${remaining_pids[@]}")
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
    s "$automatic_floating_probe_plugin_id" \
    >/dev/null 2>&1 || true
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$desktop_state_probe_plugin_id" \
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

  if [[ -n "$primary_desktop_id" ]]; then
    set_current_desktop "$primary_desktop_id" >/dev/null 2>&1 || true
  fi

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
      [
        .data[0][]
        | select(.[1] == $title or .[1] == ($title + " [active]"))
      ] as $matches
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
      [
        .data[0][]
        | select(.[1] == $title or .[1] == ($title + " [active]"))
      ] as $matches
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

wait_for_shortcut_absent() {
  local shortcut_name=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if ! shortcut_is_registered "$shortcut_name"; then
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

claim_shortcut_profile() {
  node "$DRIFTILE_SMOKE_SHORTCUT_TOOL" claim || \
    fail "Driftile could not claim the physical shortcut profile"
  node "$DRIFTILE_SMOKE_SHORTCUT_TOOL" check || \
    fail "Driftile does not own every physical shortcut after claiming"
}

release_shortcut_profile() {
  node "$DRIFTILE_SMOKE_SHORTCUT_TOOL" release || \
    fail "Driftile could not restore the previous shortcut assignments"

  busctl --user --json=short call \
    org.kde.kglobalaccel \
    /kglobalaccel \
    org.kde.KGlobalAccel \
    globalShortcutsByKey \
    '(ai)(i)' \
    4 285212690 0 0 0 \
    0 \
    | jq --exit-status \
      '.data[0] | any(.[0] == "Window Quick Tile Left" and .[2] == "kwin")' \
      >/dev/null \
    || fail "Driftile did not restore the Meta+Left KWin assignment"
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

window_is_active() {
  local window_title=$1

  busctl --user --json=short call \
    org.kde.KWin \
    /WindowsRunner \
    org.kde.krunner1 \
    Match \
    s "$window_title" 2>/dev/null \
    | jq --exit-status --arg active_title "$window_title [active]" \
      '[.data[0][] | select(.[1] == $active_title)] | length == 1' \
      >/dev/null
}

wait_for_active() {
  local window_title=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if window_is_active "$window_title"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
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

window_frame_respects_fixed_client() {
  local window_title=$1
  local client_width=$2
  local client_height=$3
  local id

  id=$(window_id "$window_title") || return 1

  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" 2>/dev/null | jq --exit-status \
      --argjson clientWidth "$client_width" \
      --argjson clientHeight "$client_height" '
        .data[0] as $window
        | ($window.type.data == 0)
          and ($window.width.data >= $clientWidth)
          and ($window.height.data >= $clientHeight)
          and (
            ($window.noBorder.data == true)
            or ($window.width.data > $clientWidth)
            or ($window.height.data > $clientHeight)
          )
      ' >/dev/null
}

window_border_state() {
  local id

  id=$(window_id "$1") || return 1
  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" 2>/dev/null | jq --exit-status --raw-output '
      .data[0].noBorder.data
      | select(type == "boolean")
      | tostring
    '
}

wait_for_window_border_state() {
  local attempt
  local expected=$2
  local title=$1

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if [[ "$(window_border_state "$title" 2>/dev/null || true)" == "$expected" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
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

virtual_desktop_ids() {
  busctl --user --json=short get-property \
    org.kde.KWin \
    /VirtualDesktopManager \
    org.kde.KWin.VirtualDesktopManager \
    desktops 2>/dev/null | jq --exit-status --raw-output '
      .data
      | sort_by(.[0])
      | .[][1]
    '
}

wait_for_desktop_sequence() {
  local attempt
  local index
  local stable_samples=0
  local -a actual_desktops=()
  local -a expected_desktops=("$@")

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    mapfile -t actual_desktops < <(virtual_desktop_ids)

    if ((${#actual_desktops[@]} == ${#expected_desktops[@]})); then
      for index in "${!expected_desktops[@]}"; do
        if [[ "${actual_desktops[index]}" != "${expected_desktops[index]}" ]]; then
          break
        fi
      done

      if ((index == ${#expected_desktops[@]} - 1)) &&
        [[ "${actual_desktops[index]}" == "${expected_desktops[index]}" ]]; then
        stable_samples=$((stable_samples + 1))

        if ((stable_samples >= stable_sample_count)); then
          return 0
        fi
      else
        stable_samples=0
      fi
    else
      stable_samples=0
    fi

    sleep 0.05
  done

  return 1
}

wait_for_appended_desktop() {
  local result_variable=$1
  shift
  local attempt
  local candidate=""
  local index
  local stable_candidate=""
  local stable_samples=0
  local -a actual_desktops=()
  local -a prefix_desktops=("$@")

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    mapfile -t actual_desktops < <(virtual_desktop_ids)
    candidate=""

    if ((${#actual_desktops[@]} == ${#prefix_desktops[@]} + 1)); then
      candidate=${actual_desktops[${#prefix_desktops[@]}]}

      for index in "${!prefix_desktops[@]}"; do
        if [[ "${actual_desktops[index]}" != "${prefix_desktops[index]}" ]]; then
          candidate=""
          break
        fi
      done
    fi

    if [[ -n "$candidate" && "$candidate" == "$stable_candidate" ]]; then
      stable_samples=$((stable_samples + 1))
    elif [[ -n "$candidate" ]]; then
      stable_candidate=$candidate
      stable_samples=1
    else
      stable_candidate=""
      stable_samples=0
    fi

    if ((stable_samples >= stable_sample_count)); then
      printf -v "$result_variable" '%s' "$stable_candidate"
      return 0
    fi

    sleep 0.05
  done

  return 1
}

current_desktop_id() {
  busctl --user --json=short get-property \
    org.kde.KWin \
    /VirtualDesktopManager \
    org.kde.KWin.VirtualDesktopManager \
    current 2>/dev/null | jq --exit-status --raw-output '.data'
}

wait_for_current_desktop() {
  local expected=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if [[ "$(current_desktop_id 2>/dev/null || true)" == "$expected" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

set_current_desktop() {
  local desktop=$1

  busctl --user set-property \
    org.kde.KWin \
    /VirtualDesktopManager \
    org.kde.KWin.VirtualDesktopManager \
    current \
    s "$desktop" \
    >/dev/null || return 1

  wait_for_current_desktop "$desktop"
}

prepare_test_desktops() {
  local attempt
  local -a desktop_ids=()

  mapfile -t desktop_ids < <(virtual_desktop_ids)

  if ((${#desktop_ids[@]} != 1)); then
    return 1
  fi

  primary_desktop_id=${desktop_ids[0]}
  busctl --user call \
    org.kde.KWin \
    /VirtualDesktopManager \
    org.kde.KWin.VirtualDesktopManager \
    createDesktop \
    us 1 "Driftile Test Desktop" \
    >/dev/null || return 1

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    mapfile -t desktop_ids < <(virtual_desktop_ids)

    if ((${#desktop_ids[@]} == 2)); then
      secondary_desktop_id=${desktop_ids[1]}
      break
    fi

    sleep 0.05
  done

  [[ -n "$secondary_desktop_id" ]] || return 1
  set_current_desktop "$primary_desktop_id"
}

window_is_on_desktop() {
  local window_title=$1
  local expected=$2
  local id

  id=$(window_id "$window_title") || return 1
  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" 2>/dev/null | jq --exit-status \
      --arg expected "$expected" '
        .data[0].desktops.data == [$expected]
      ' \
      >/dev/null
}

wait_for_window_desktop() {
  local window_title=$1
  local expected=$2
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if window_is_on_desktop "$window_title" "$expected"; then
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

load_automatic_floating_probe() {
  local load_result
  local script_id
  local state

  state=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    isScriptLoaded \
    s "$automatic_floating_probe_plugin_id" 2>/dev/null || true)

  if [[ "$state" == "b true" ]]; then
    wait_for_shortcut "$automatic_floating_probe_arm_shortcut" && \
      wait_for_shortcut "$automatic_floating_probe_capture_shortcut" && \
      wait_for_shortcut "$automatic_floating_probe_reset_shortcut" && \
      wait_for_shortcut "$automatic_floating_probe_verify_shortcut"
    return
  fi

  wait_for_shortcut_absent "$automatic_floating_probe_arm_shortcut" || return 1
  wait_for_shortcut_absent "$automatic_floating_probe_capture_shortcut" || return 1
  wait_for_shortcut_absent "$automatic_floating_probe_reset_shortcut" || return 1
  wait_for_shortcut_absent "$automatic_floating_probe_verify_shortcut" || return 1

  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss \
    "$DRIFTILE_SMOKE_AUTOMATIC_FLOATING_PROBE" \
    "$automatic_floating_probe_plugin_id") || return 1
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

  wait_for_named_script_state "$automatic_floating_probe_plugin_id" true && \
    wait_for_shortcut "$automatic_floating_probe_arm_shortcut" && \
    wait_for_shortcut "$automatic_floating_probe_capture_shortcut" && \
    wait_for_shortcut "$automatic_floating_probe_reset_shortcut" && \
    wait_for_shortcut "$automatic_floating_probe_verify_shortcut"
}

unload_automatic_floating_probe() {
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$automatic_floating_probe_plugin_id" \
    >/dev/null || return 1

  wait_for_named_script_state "$automatic_floating_probe_plugin_id" false
}

arm_automatic_floating_dialog() {
  local dialog_title=$1
  local armed_shortcut="$automatic_floating_probe_armed_shortcut_prefix $dialog_title"

  wait_for_shortcut_absent "$armed_shortcut" || return 1
  invoke_shortcut "$automatic_floating_probe_arm_shortcut" || return 1
  wait_for_shortcut "$armed_shortcut"
}

capture_automatic_floating_dialog() {
  local dialog_title=$1
  local captured_shortcut="$automatic_floating_probe_captured_shortcut_prefix $dialog_title"
  local attempt

  wait_for_shortcut_absent "$captured_shortcut" || return 1

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    invoke_shortcut "$automatic_floating_probe_capture_shortcut" || return 1

    if shortcut_is_registered "$captured_shortcut"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

verify_automatic_floating_dialog() {
  local dialog_title=$1
  local verification_index=$2
  local verified_shortcut="$automatic_floating_probe_verified_shortcut_prefix $dialog_title $verification_index"

  wait_for_shortcut_absent "$verified_shortcut" || return 1
  invoke_shortcut "$automatic_floating_probe_verify_shortcut" || return 1
  wait_for_shortcut "$verified_shortcut"
}

wait_for_automatic_floating_dialog_closed() {
  wait_for_shortcut \
    "$automatic_floating_probe_closed_shortcut_prefix $1"
}

reset_automatic_floating_probe() {
  local dialog_title=$1
  local reset_shortcut="$automatic_floating_probe_reset_shortcut_prefix $dialog_title"

  wait_for_shortcut_absent "$reset_shortcut" || return 1
  invoke_shortcut "$automatic_floating_probe_reset_shortcut" || return 1
  wait_for_shortcut "$reset_shortcut"
}

toggle_native_tile() {
  run_one_shot_script \
    "$DRIFTILE_SMOKE_NATIVE_TILE_TOGGLE" \
    "$native_tile_toggle_plugin_id"
}

verify_multi_output_desktop_state() {
  local desktop_label=$2
  local load_result
  local script_id
  local verified=false
  local verified_shortcut="$desktop_state_verified_shortcut_prefix $1 $desktop_label"

  wait_for_shortcut_absent "$verified_shortcut" || return 1
  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss "$DRIFTILE_SMOKE_DESKTOP_STATE_PROBE" "$desktop_state_probe_plugin_id") || return 1
  script_id=${load_result#i }

  if [[ "$script_id" =~ ^[0-9]+$ ]]; then
    if busctl --user call \
      org.kde.KWin \
      "/Scripting/Script${script_id}" \
      org.kde.kwin.Script \
      run \
      >/dev/null && \
      wait_for_shortcut "$verified_shortcut"; then
      verified=true
    fi
  fi

  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$desktop_state_probe_plugin_id" \
    >/dev/null 2>&1 || true

  wait_for_named_script_state "$desktop_state_probe_plugin_id" false || verified=false
  [[ "$verified" == true ]]
}

verify_multi_output_output_transfer_state() {
  local state_label=$2
  local load_result
  local script_id
  local verified=false
  local verified_shortcut="$output_transfer_state_verified_shortcut_prefix $1 $state_label"

  wait_for_shortcut_absent "$verified_shortcut" || return 1
  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss "$DRIFTILE_SMOKE_OUTPUT_TRANSFER_STATE_PROBE" "$output_transfer_state_probe_plugin_id") || return 1
  script_id=${load_result#i }

  if [[ "$script_id" =~ ^[0-9]+$ ]]; then
    if busctl --user call \
      org.kde.KWin \
      "/Scripting/Script${script_id}" \
      org.kde.kwin.Script \
      run \
      >/dev/null && \
      wait_for_shortcut "$verified_shortcut"; then
      verified=true
    fi
  fi

  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$output_transfer_state_probe_plugin_id" \
    >/dev/null 2>&1 || true

  wait_for_named_script_state "$output_transfer_state_probe_plugin_id" false || verified=false
  [[ "$verified" == true ]]
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

set_borderless_windows() {
  kwriteconfig6 \
    --file "$XDG_CONFIG_HOME/kwinrc" \
    --group "Script-${plugin_id}" \
    --key BorderlessWindows \
    --type bool \
    "$1"

  busctl --user call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    reconfigure \
    >/dev/null
}

start_qml_client() {
  local protocol=$1
  local client=$2

  shift 2

  case "$protocol" in
    wayland)
      QT_QPA_PLATFORM=wayland qml \
        "${qml_options[@]}" \
        "$client" \
        -- "$@" &
      ;;
    x11 | xwayland)
      QT_QPA_PLATFORM=xcb qml \
        "${qml_options[@]}" \
        "$client" \
        -- "$@" &
      ;;
    *)
      fail "unsupported client protocol: $protocol"
      ;;
  esac

  client_pids+=("$!")
}

start_client() {
  local protocol=$1
  local window_title=$2
  local mark_active=${3:-false}
  local -a client_arguments=("$window_title")

  if [[ "$mark_active" == true ]]; then
    client_arguments=(--mark-active "$window_title")
  fi

  start_qml_client \
    "$protocol" \
    "$DRIFTILE_SMOKE_CLIENT" \
    "${client_arguments[@]}"
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
    "$DRIFTILE_SMOKE_CLIENT" \
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

verify_desktop_transfer() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local first_baseline_variable=$5
  local second_baseline_variable=$6
  local destination_title="driftile-desktop-destination-${protocol}"
  local destination_pid
  local first_trailing_desktop_id=""
  local first_transfer_baseline
  local second_trailing_desktop_id=""
  local transferred_baseline

  wait_for_shortcut "driftile_focus_previous_desktop" || \
    fail "KGlobalAccel did not register the focus-previous-desktop shortcut"
  wait_for_shortcut "driftile_focus_next_desktop" || \
    fail "KGlobalAccel did not register the focus-next-desktop shortcut"
  wait_for_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel did not register the previous-desktop shortcut"
  wait_for_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel did not register the next-desktop shortcut"
  wait_for_shortcut "driftile_move_column_to_previous_desktop" || \
    fail "KGlobalAccel did not register the default previous-desktop shortcut"
  wait_for_shortcut "driftile_move_column_to_next_desktop" || \
    fail "KGlobalAccel did not register the default next-desktop shortcut"

  set_current_desktop "$secondary_desktop_id" || \
    fail "KWin could not select the destination desktop for $protocol transfer coverage"
  start_client "$protocol" "$destination_title" true
  destination_pid=${client_pids[${#client_pids[@]}-1]}
  wait_for_geometries \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile did not seed the $protocol destination desktop: $(describe_layout "$destination_title")"
  wait_for_active "$destination_title" || \
    fail "KWin did not focus the $protocol destination seed window"
  wait_for_window_desktop "$destination_title" "$secondary_desktop_id" || \
    fail "KWin placed the $protocol destination seed on the wrong desktop"
  wait_for_appended_desktop \
    first_trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" || \
    fail "Driftile did not append an empty desktop after the occupied $protocol destination"

  set_current_desktop "$primary_desktop_id" || \
    fail "KWin could not restore the source desktop before $protocol transfer coverage"
  activate_window "$second_title" || \
    fail "KWin could not focus the lower $protocol stack member before desktop transfer"
  wait_for_active "$second_title" || \
    fail "KWin did not focus the lower $protocol stack member before desktop transfer"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol source stack before desktop transfer: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_focus_next_desktop" || \
    fail "KGlobalAccel could not focus the next $protocol desktop"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not focus the next $protocol desktop"
  invoke_shortcut "driftile_focus_previous_desktop" || \
    fail "KGlobalAccel could not focus the previous $protocol desktop"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not focus the previous $protocol desktop"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "desktop focus changed the $protocol desktop lifecycle"
  activate_window "$second_title" || \
    fail "KWin could not restore $protocol focus after desktop navigation"
  wait_for_active "$second_title" || \
    fail "KWin did not restore $protocol focus after desktop navigation"

  invoke_shortcut "driftile_move_column_to_next_desktop" || \
    fail "KGlobalAccel could not invoke the default $protocol column transfer"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the stacked $protocol column"
  wait_for_geometries \
    "$destination_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" || \
    fail "Driftile did not preserve the stacked $protocol column during its default transfer: $(describe_layout "$destination_title" "$first_title" "$second_title")"
  wait_for_window_desktop "$first_title" "$secondary_desktop_id" || \
    fail "KWin did not transfer the upper $protocol stack member"
  wait_for_window_desktop "$second_title" "$secondary_desktop_id" || \
    fail "KWin did not transfer the lower $protocol stack member"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus during the whole-column transfer"
  first_transfer_baseline=$(capture_stable_geometry "$first_title") || \
    fail "the transferred upper $protocol stack baseline did not stabilize"

  invoke_shortcut "driftile_move_column_to_previous_desktop" || \
    fail "KGlobalAccel could not return the stacked $protocol column"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the returning stacked $protocol column"
  wait_for_geometries \
    "$third_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" || \
    fail "Driftile did not preserve the returning stacked $protocol column: $(describe_layout "$third_title" "$first_title" "$second_title")"
  invoke_shortcut "driftile_move_column_left" || \
    fail "KGlobalAccel could not restore the source $protocol column order"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol column order after the round trip: $(describe_layout "$first_title" "$second_title" "$third_title")"
  printf -v "$first_baseline_variable" '%s' "$first_transfer_baseline"

  invoke_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel could not invoke the previous-desktop boundary shortcut"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile wrapped the $protocol transfer before the first desktop"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol layout at the previous-desktop boundary: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus at the previous-desktop boundary"

  invoke_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel could not transfer the $protocol stack member to the next desktop"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the $protocol window to the next desktop"
  wait_for_geometries \
    "$destination_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" || \
    fail "Driftile did not append the transferred $protocol window after the destination active column: $(describe_layout "$destination_title" "$second_title")"
  wait_for_active "$second_title" || \
    fail "Driftile did not preserve $protocol focus after the next-desktop transfer"
  wait_for_window_desktop "$second_title" "$secondary_desktop_id" || \
    fail "KWin did not move the $protocol window to the next desktop"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated $protocol source stack member"
  wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated $protocol source column"

  invoke_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel could not transfer the $protocol window to the trailing desktop"
  wait_for_current_desktop "$first_trailing_desktop_id" || \
    fail "Driftile did not follow the $protocol window to the trailing desktop"
  wait_for_window_desktop "$second_title" "$first_trailing_desktop_id" || \
    fail "KWin did not move the $protocol window to the trailing desktop"
  wait_for_geometries \
    "$second_title" "16,16,616,688" || \
    fail "Driftile did not seed the first dynamic $protocol desktop: $(describe_layout "$second_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus on the trailing desktop"
  wait_for_appended_desktop \
    second_trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not replenish the trailing desktop for $protocol"
  [[ "$second_trailing_desktop_id" != "$first_trailing_desktop_id" ]] || \
    fail "Driftile reused an occupied $protocol desktop as the empty tail"

  invoke_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel could not return the $protocol window from the dynamic desktop"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the $protocol window back to the destination desktop"
  wait_for_window_desktop "$second_title" "$secondary_desktop_id" || \
    fail "KWin did not return the $protocol window from the dynamic desktop"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not remove the redundant $protocol trailing desktop"
  wait_for_geometries \
    "$destination_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol destination layout after dynamic cleanup: $(describe_layout "$destination_title" "$second_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus during dynamic cleanup"

  invoke_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel could not return the $protocol window to the source desktop"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the returning $protocol window"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" \
    "$third_title" "1280,16,616,688" || \
    fail "Driftile did not insert the returning $protocol window after the source active column: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile did not preserve $protocol focus after the previous-desktop transfer"
  wait_for_window_desktop "$second_title" "$primary_desktop_id" || \
    fail "KWin did not return the $protocol window to the source desktop"
  transferred_baseline=$(capture_stable_geometry "$second_title") || \
    fail "the returned $protocol window restore baseline did not stabilize"
  printf -v "$second_baseline_variable" '%s' "$transferred_baseline"

  invoke_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel could not recheck the previous-desktop boundary"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile wrapped the returned $protocol window before the first desktop"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" \
    "$third_title" "1280,16,616,688" || \
    fail "Driftile changed the returned $protocol layout at the desktop boundary: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the $protocol source stack after desktop transfer"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol source layout after desktop transfer: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus while restoring the source stack"

  stop_client "$destination_pid"
  wait_for_window_gone "$destination_title" || \
    fail "the $protocol destination seed window did not close"
  wait_for_desktop_sequence "$primary_desktop_id" "$secondary_desktop_id" || \
    fail "Driftile did not restore the external $protocol desktop baseline"
}

verify_multi_output_desktop_transfer() {
  local protocol=$1
  local left_first_title=$2
  local left_second_title=$3
  local right_first_title=$4
  local right_second_title=$5
  local left_destination_title="driftile-multi-output-${protocol}-left-desktop-destination"
  local right_destination_title="driftile-multi-output-${protocol}-right-desktop-destination"
  local left_destination_pid
  local right_destination_pid

  wait_for_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel did not register the multi-output previous-desktop shortcut"
  wait_for_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel did not register the multi-output next-desktop shortcut"

  activate_window "$left_first_title" || \
    fail "KWin could not activate the left $protocol source before destination seeding"
  set_current_desktop "$secondary_desktop_id" || \
    fail "KWin could not select the left $protocol destination desktop"
  start_client "$protocol" "$left_destination_title" true
  left_destination_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$left_destination_title" >/dev/null || \
    fail "the left multi-output $protocol destination seed did not stabilize"
  activate_window "$right_first_title" || \
    fail "KWin could not activate the right $protocol source before destination seeding"
  set_current_desktop "$secondary_desktop_id" || \
    fail "KWin could not select the right $protocol destination desktop"
  start_client "$protocol" "$right_destination_title" true
  right_destination_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$right_destination_title" >/dev/null || \
    fail "the right multi-output $protocol destination seed did not stabilize"
  activate_window "$left_destination_title" || \
    fail "KWin could not activate the left multi-output $protocol destination seed"
  wait_for_geometries \
    "$left_destination_title" "16,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile did not seed isolated multi-output $protocol destination contexts: $(describe_layout "$left_destination_title" "$right_destination_title")"
  window_is_on_output_side "$left_destination_title" left || \
    fail "the output router placed the left $protocol destination seed incorrectly"
  window_is_on_output_side "$right_destination_title" right || \
    fail "the output router placed the right $protocol destination seed incorrectly"

  activate_window "$left_destination_title" || \
    fail "KWin could not activate the left $protocol destination before source restoration"
  set_current_desktop "$primary_desktop_id" || \
    fail "KWin could not restore the left $protocol source desktop"
  activate_window "$right_destination_title" || \
    fail "KWin could not activate the right $protocol destination before source restoration"
  set_current_desktop "$primary_desktop_id" || \
    fail "KWin could not restore the right $protocol source desktop"
  activate_window "$left_second_title" || \
    fail "KWin could not focus the left $protocol stack member before desktop transfer"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the multi-output $protocol source contexts before desktop transfer: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"

  invoke_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel could not transfer the left $protocol stack member to the next desktop"
  wait_for_geometries \
    "$left_destination_title" "16,16,616,688" \
    "$left_second_title" "648,16,616,688" \
    "$right_destination_title" "1296,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not isolate the multi-output $protocol desktop transfer: $(describe_layout "$left_destination_title" "$left_second_title" "$right_destination_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus during the multi-output desktop transfer"
  window_is_on_output_side "$left_second_title" left || \
    fail "Driftile moved the $protocol window to another output during desktop transfer"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "KWin did not move the left $protocol window to the next desktop"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated right-output $protocol window"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated right-output $protocol window"
  verify_multi_output_desktop_state "$left_second_title" secondary || \
    fail "KWin did not expose the expected per-output $protocol desktop state"

  invoke_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel could not return the left $protocol window to the source desktop"
  wait_for_geometries \
    "$left_first_title" "16,16,616,688" \
    "$left_second_title" "648,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore isolated multi-output $protocol source contexts: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while returning from the destination desktop"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "KWin did not return the left $protocol window to the source desktop"
  verify_multi_output_desktop_state "$left_second_title" primary || \
    fail "KWin did not restore the expected per-output $protocol desktop state"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the left $protocol stack after desktop transfer"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the multi-output $protocol source stack: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"

  stop_client "$left_destination_pid"
  stop_client "$right_destination_pid"
  wait_for_window_gone "$left_destination_title" || \
    fail "the left multi-output $protocol destination seed did not close"
  wait_for_window_gone "$right_destination_title" || \
    fail "the right multi-output $protocol destination seed did not close"
  wait_for_desktop_sequence "$primary_desktop_id" "$secondary_desktop_id" || \
    fail "Driftile did not restore the multi-output $protocol desktop baseline"
}

verify_multi_output_output_transfer() {
  local protocol=$1
  local left_first_title=$2
  local left_second_title=$3
  local right_first_title=$4
  local right_second_title=$5
  local destination_title="driftile-multi-output-${protocol}-right-output-destination"
  local destination_pid

  wait_for_shortcut "driftile_move_window_to_output_left" || \
    fail "KGlobalAccel did not register the multi-output move-to-output-left shortcut"
  wait_for_shortcut "driftile_move_window_to_output_right" || \
    fail "KGlobalAccel did not register the multi-output move-to-output-right shortcut"
  wait_for_shortcut "driftile_move_window_to_output_up" || \
    fail "KGlobalAccel did not register the multi-output move-to-output-up shortcut"
  wait_for_shortcut "driftile_move_window_to_output_down" || \
    fail "KGlobalAccel did not register the multi-output move-to-output-down shortcut"
  wait_for_shortcut "driftile_move_column_to_output_left" || \
    fail "KGlobalAccel did not register the default move-to-output-left shortcut"
  wait_for_shortcut "driftile_move_column_to_output_right" || \
    fail "KGlobalAccel did not register the default move-to-output-right shortcut"
  wait_for_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel did not register the multi-output decrease-width shortcut"
  wait_for_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel did not register the multi-output reset-width shortcut"

  activate_window "$left_second_title" || \
    fail "KWin could not focus the left $protocol stack member before output transfer"
  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not prepare a distinct $protocol transfer width"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not prepare the distinct $protocol transfer width: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"

  activate_window "$right_first_title" || \
    fail "KWin could not select the right $protocol output before destination setup"
  set_current_desktop "$secondary_desktop_id" || \
    fail "KWin could not select the right $protocol destination desktop"
  start_client "$protocol" "$destination_title" true
  destination_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$destination_title" >/dev/null || \
    fail "the right output-transfer $protocol destination did not stabilize"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile did not isolate the output-transfer destination desktop: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_window_desktop "$destination_title" "$secondary_desktop_id" || \
    fail "the output router did not place the $protocol destination on the visible desktop"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop"

  activate_window "$left_second_title" || \
    fail "KWin could not focus the left $protocol stack member before output transfer"
  wait_for_active "$left_second_title" || \
    fail "KWin did not focus the left $protocol stack member before output transfer"

  invoke_shortcut "driftile_move_column_to_output_right" || \
    fail "KGlobalAccel could not invoke the default $protocol output transfer"
  wait_for_geometries \
    "$destination_title" "1296,16,616,688" \
    "$left_first_title" "1928,16,490,336" \
    "$left_second_title" "1928,368,490,336" || \
    fail "Driftile did not preserve the stacked $protocol column through the default output transfer: $(describe_layout "$destination_title" "$left_first_title" "$left_second_title")"
  wait_for_window_desktop "$left_first_title" "$secondary_desktop_id" || \
    fail "Driftile did not adopt the target desktop for the upper $protocol stack member"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "Driftile did not adopt the target desktop for the lower $protocol stack member"
  window_is_on_output_side "$left_first_title" right || \
    fail "KWin did not move the upper $protocol stack member to the right output"
  window_is_on_output_side "$left_second_title" right || \
    fail "KWin did not move the lower $protocol stack member to the right output"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus during the whole-column output transfer"

  invoke_shortcut "driftile_move_column_to_output_left" || \
    fail "KGlobalAccel could not return the default $protocol column transfer"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile did not preserve the returning stacked $protocol column: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_window_desktop "$left_first_title" "$primary_desktop_id" || \
    fail "Driftile did not restore the upper $protocol stack member desktop"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "Driftile did not restore the lower $protocol stack member desktop"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while returning the whole column"

  invoke_shortcut "driftile_move_window_to_output_left" || \
    fail "KGlobalAccel could not invoke the left-output boundary shortcut"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the $protocol layout at the left-output boundary: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus at the left-output boundary"

  invoke_shortcut "driftile_move_window_to_output_up" || \
    fail "KGlobalAccel could not invoke the unavailable upper-output shortcut"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the $protocol layout without an upper output neighbor: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus without an upper output neighbor"

  invoke_shortcut "driftile_move_window_to_output_down" || \
    fail "KGlobalAccel could not invoke the unavailable lower-output shortcut"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the $protocol layout without a lower output neighbor: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus without a lower output neighbor"

  invoke_shortcut "driftile_move_window_to_output_right" || \
    fail "KGlobalAccel could not transfer the $protocol window to the right output"
  wait_for_geometries \
    "$left_first_title" "16,16,490,688" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,16,490,688" || \
    fail "Driftile did not preserve source order, target order, and width during the right-output transfer: $(describe_layout "$left_first_title" "$destination_title" "$left_second_title")"
  window_is_on_output_side "$left_first_title" left || \
    fail "Driftile moved an unrelated left-output $protocol window"
  window_is_on_output_side "$left_second_title" right || \
    fail "KWin did not move the $protocol window to the right output"
  window_is_on_output_side "$destination_title" right || \
    fail "Driftile moved the $protocol destination off the right output"
  window_is_on_output_side "$right_first_title" right || \
    fail "Driftile moved an unrelated right-output $protocol window"
  window_is_on_output_side "$right_second_title" right || \
    fail "Driftile moved an unrelated right-output $protocol window"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "Driftile did not adopt the right output's visible $protocol desktop"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop"
  verify_multi_output_output_transfer_state "$left_second_title" right-secondary || \
    fail "KWin changed focus or an output desktop during the right-output $protocol transfer"
  activate_window "$left_second_title" || \
    fail "KWin could not restore $protocol focus after the right-output state probe"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore $protocol focus after the right-output state probe"

  invoke_shortcut "driftile_move_window_to_output_right" || \
    fail "KGlobalAccel could not invoke the right-output boundary shortcut"
  wait_for_geometries \
    "$left_first_title" "16,16,490,688" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,16,490,688" || \
    fail "Driftile changed the $protocol layout at the right-output boundary: $(describe_layout "$left_first_title" "$destination_title" "$left_second_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus at the right-output boundary"

  invoke_shortcut "driftile_move_window_to_output_left" || \
    fail "KGlobalAccel could not return the $protocol window to the left output"
  wait_for_geometries \
    "$left_first_title" "16,16,490,688" \
    "$left_second_title" "522,16,489,688" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile did not preserve source order, target order, and logical width during the left-output transfer: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  window_is_on_output_side "$left_first_title" left || \
    fail "Driftile moved an unrelated left-output $protocol window while returning"
  window_is_on_output_side "$left_second_title" left || \
    fail "KWin did not return the $protocol window to the left output"
  window_is_on_output_side "$right_first_title" right || \
    fail "Driftile moved an unrelated right-output $protocol window while returning"
  window_is_on_output_side "$right_second_title" right || \
    fail "Driftile moved an unrelated right-output $protocol window while returning"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "Driftile moved the returning $protocol window off the target output's visible desktop"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop while returning"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop while returning"
  verify_multi_output_output_transfer_state "$left_second_title" left-primary || \
    fail "KWin changed focus or an output desktop during the left-output $protocol transfer"
  activate_window "$left_second_title" || \
    fail "KWin could not restore $protocol focus after the left-output state probe"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore $protocol focus after the left-output state probe"

  invoke_shortcut "driftile_move_window_to_output_left" || \
    fail "KGlobalAccel could not recheck the left-output boundary"
  wait_for_geometries \
    "$left_first_title" "16,16,490,688" \
    "$left_second_title" "522,16,489,688" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the returned $protocol layout at the left-output boundary: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed returned $protocol focus at the left-output boundary"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the left $protocol stack after output transfer"
  wait_for_geometries \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile did not restore the narrowed left $protocol stack after output transfer: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  invoke_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel could not restore the left $protocol stack width"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile did not restore the left $protocol stack width: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"

  activate_window "$destination_title" || \
    fail "KWin could not select the right $protocol output for cleanup"
  set_current_desktop "$primary_desktop_id" || \
    fail "KWin could not restore the right $protocol source desktop"
  stop_client "$destination_pid"
  wait_for_window_gone "$destination_title" || \
    fail "the right output-transfer $protocol destination did not close"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the two $protocol output contexts after output transfer: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_desktop_sequence "$primary_desktop_id" "$secondary_desktop_id" || \
    fail "Driftile did not restore the output-transfer $protocol desktop baseline"
}

verify_automatic_floating_shortcut_no_op() {
  local protocol=$1
  local active_title=$2
  local shortcut=$3
  local index
  local -a geometry_pairs
  local -a window_titles=()

  shift 3
  geometry_pairs=("$@")

  for ((index = 0; index < ${#geometry_pairs[@]}; index += 2)); do
    window_titles+=("${geometry_pairs[index]}")
  done

  invoke_shortcut "$shortcut" || \
    fail "KGlobalAccel could not invoke $shortcut for the automatic-floating $protocol window"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol automatic-floating layout after $shortcut: $(describe_layout "${window_titles[@]}")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus after $shortcut on an automatic-floating window"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile changed the desktop after $shortcut on an automatic-floating $protocol window"
  wait_for_window_desktop "$active_title" "$primary_desktop_id" || \
    fail "Driftile moved the automatic-floating $protocol window after $shortcut"
}

verify_dialog_shortcut_no_op() {
  local protocol=$1
  local dialog_title=$2
  local shortcut=$3
  local verification_index=$4
  local index
  local -a geometry_pairs
  local -a window_titles=()

  shift 4
  geometry_pairs=("$@")

  for ((index = 0; index < ${#geometry_pairs[@]}; index += 2)); do
    window_titles+=("${geometry_pairs[index]}")
  done

  invoke_shortcut "$shortcut" || \
    fail "KGlobalAccel could not invoke $shortcut for the modal $protocol dialog"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol dialog parent layout after $shortcut: $(describe_layout "${window_titles[@]}")"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile changed the desktop after $shortcut on the modal $protocol dialog"
  verify_automatic_floating_dialog "$dialog_title" "$verification_index" || \
    fail "Driftile changed the active $protocol dialog after $shortcut"
}

verify_automatic_floating() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local dialog_title="driftile-dialog-${protocol}"
  local fixed_title="driftile-fixed-${protocol}"
  local parent_title="driftile-dialog-parent-${protocol}"
  local first_frame
  local second_frame
  local third_frame
  local dialog_first_frame
  local dialog_second_frame
  local dialog_third_frame
  local dialog_parent_frame
  local fixed_frame
  local parent_pid
  local fixed_pid
  local shortcut
  local verification_index=0
  local -a no_op_shortcuts=(
    "driftile_focus_column_left"
    "driftile_move_window_left"
    "driftile_toggle_floating"
    "driftile_move_column_to_next_desktop"
    "driftile_move_column_to_output_right"
  )

  for shortcut in "${no_op_shortcuts[@]}"; do
    wait_for_shortcut "$shortcut" || \
      fail "KGlobalAccel did not register $shortcut for automatic-floating acceptance"
  done

  first_frame=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol window did not stabilize before automatic-floating acceptance"
  second_frame=$(capture_stable_geometry "$second_title") || \
    fail "the second $protocol window did not stabilize before automatic-floating acceptance"
  third_frame=$(capture_stable_geometry "$third_title") || \
    fail "the third $protocol window did not stabilize before automatic-floating acceptance"
  wait_for_geometries \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" || \
    fail "the $protocol layout did not settle before automatic-floating acceptance"

  load_automatic_floating_probe || \
    fail "KWin could not load the $protocol automatic-floating probe"
  start_qml_client \
    "$protocol" \
    "$DRIFTILE_SMOKE_DIALOG_CLIENT" \
    "$parent_title" \
    "$dialog_title"
  parent_pid=${client_pids[${#client_pids[@]}-1]}

  capture_stable_geometry "$parent_title" >/dev/null || \
    fail "the $protocol dialog parent did not appear"
  activate_window "$parent_title" || \
    fail "KWin could not activate the $protocol dialog parent"
  wait_for_active "$parent_title" || \
    fail "KWin did not focus the $protocol dialog parent"

  dialog_first_frame=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol window did not settle with the dialog parent"
  dialog_second_frame=$(capture_stable_geometry "$second_title") || \
    fail "the second $protocol window did not settle with the dialog parent"
  dialog_third_frame=$(capture_stable_geometry "$third_title") || \
    fail "the third $protocol window did not settle with the dialog parent"
  dialog_parent_frame=$(capture_stable_geometry "$parent_title") || \
    fail "the $protocol dialog parent did not settle"
  wait_for_geometries \
    "$first_title" "$dialog_first_frame" \
    "$second_title" "$dialog_second_frame" \
    "$third_title" "$dialog_third_frame" \
    "$parent_title" "$dialog_parent_frame" || \
    fail "the $protocol parent layout did not settle before the dialog opened"
  arm_automatic_floating_dialog "$dialog_title" || \
    fail "KWin could not arm the $protocol dialog before it opened"

  capture_automatic_floating_dialog "$dialog_title" || \
    fail "KWin did not expose a stable active modal transient $protocol dialog"
  wait_for_geometries \
    "$first_title" "$dialog_first_frame" \
    "$second_title" "$dialog_second_frame" \
    "$third_title" "$dialog_third_frame" \
    "$parent_title" "$dialog_parent_frame" || \
    fail "Driftile changed the $protocol parent layout when the dialog opened"

  for shortcut in "${no_op_shortcuts[@]}"; do
    verification_index=$((verification_index + 1))
    verify_dialog_shortcut_no_op \
      "$protocol" \
      "$dialog_title" \
      "$shortcut" \
      "$verification_index" \
      "$first_title" "$dialog_first_frame" \
      "$second_title" "$dialog_second_frame" \
      "$third_title" "$dialog_third_frame" \
      "$parent_title" "$dialog_parent_frame"
  done

  stop_client "$parent_pid"
  wait_for_automatic_floating_dialog_closed "$dialog_title" || \
    fail "the modal transient $protocol dialog did not close"
  wait_for_window_gone "$parent_title" || \
    fail "the $protocol dialog parent did not close"
  reset_automatic_floating_probe "$dialog_title" || \
    fail "KWin could not reset the $protocol automatic-floating probe"
  activate_window "$second_title" || \
    fail "KWin could not restore $protocol focus after dialog cleanup"
  wait_for_geometries \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" || \
    fail "Driftile did not restore the $protocol layout after dialog cleanup"
  wait_for_active "$second_title" || \
    fail "KWin did not restore $protocol focus after dialog cleanup"

  start_qml_client \
    "$protocol" \
    "$DRIFTILE_SMOKE_FIXED_SIZE_CLIENT" \
    "$fixed_title"
  fixed_pid=${client_pids[${#client_pids[@]}-1]}

  capture_stable_geometry "$fixed_title" >/dev/null || \
    fail "the fixed-size normal $protocol window did not appear"
  activate_window "$fixed_title" || \
    fail "KWin could not activate the fixed-size normal $protocol window"
  wait_for_active "$fixed_title" || \
    fail "KWin did not focus the fixed-size normal $protocol window"
  fixed_frame=$(capture_stable_geometry "$fixed_title") || \
    fail "the fixed-size normal $protocol window did not stabilize"
  wait_for_window_border_state "$fixed_title" true || \
    fail "Driftile did not remove the fixed-size normal $protocol decoration"
  window_frame_respects_fixed_client "$fixed_title" 360 240 || \
    fail "KWin did not preserve the fixed client bounds and frame extents for $protocol"
  wait_for_geometries \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" \
    "$fixed_title" "$fixed_frame" || \
    fail "Driftile changed the $protocol layout for a fixed-size normal window"

  for shortcut in "${no_op_shortcuts[@]}"; do
    verify_automatic_floating_shortcut_no_op \
      "$protocol" \
      "$fixed_title" \
      "$shortcut" \
      "$first_title" "$first_frame" \
      "$second_title" "$second_frame" \
      "$third_title" "$third_frame" \
      "$fixed_title" "$fixed_frame"
  done

  stop_client "$fixed_pid"
  wait_for_window_gone "$fixed_title" || \
    fail "the fixed-size normal $protocol window did not close"
  activate_window "$second_title" || \
    fail "KWin could not restore $protocol focus after fixed-size cleanup"
  wait_for_geometries \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" || \
    fail "Driftile changed the $protocol layout after fixed-size cleanup"
  wait_for_active "$second_title" || \
    fail "KWin did not restore $protocol focus after fixed-size cleanup"
}

run_scenario() {
  local protocol=$1
  local first_title="driftile-smoke-${protocol}-a"
  local second_title="driftile-state-target-${protocol}"
  local third_title="driftile-smoke-${protocol}-c"
  local fourth_title="driftile-direct-stack-${protocol}-d"
  local first_baseline
  local second_baseline
  local second_floating_baseline
  local third_baseline
  local fourth_pid
  local state_window_id
  local title
  local reserved_frame="16,16,616,688"
  local state_frame="648,16,616,688"
  local full_output_frame="0,0,1280,720"
  local native_tile_frame="4,4,314,712"

  start_client "$protocol" "$first_title" true
  capture_stable_geometry "$first_title" >/dev/null || fail "the first $protocol test window did not stabilize"
  start_client "$protocol" "$second_title" true
  capture_stable_geometry "$second_title" >/dev/null || fail "the second $protocol test window did not stabilize"
  start_client "$protocol" "$third_title" true

  first_baseline=$(capture_stable_geometry "$first_title") || fail "the first $protocol test window did not stabilize"
  second_baseline=$(capture_stable_geometry "$second_title") || fail "the second $protocol test window did not stabilize"
  third_baseline=$(capture_stable_geometry "$third_title") || fail "the third $protocol test window did not stabilize"
  wait_for_geometries \
    "$first_title" "$first_baseline" \
    "$second_title" "$second_baseline" \
    "$third_title" "$third_baseline" || \
    fail "the pre-tiling $protocol baselines did not stabilize together: $(describe_layout "$first_title" "$second_title" "$third_title")"

  activate_window "$third_title" || fail "KWin could not activate the third $protocol window"

  set_plugin_state true
  wait_for_script_state true || fail "KWin did not report Driftile as loaded"
  claim_shortcut_profile
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reveal the third $protocol window: $(describe_layout "$first_title" "$second_title" "$third_title")"

  for title in "$first_title" "$second_title" "$third_title"; do
    wait_for_window_border_state "$title" true || \
      fail "Driftile did not remove the managed $protocol window decoration"
  done

  set_borderless_windows false || \
    fail "KWin could not disable borderless $protocol windows"

  for title in "$first_title" "$second_title" "$third_title"; do
    wait_for_window_border_state "$title" false || \
      fail "Driftile did not restore the managed $protocol window decoration"
  done

  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile changed the $protocol layout while restoring decorations: $(describe_layout "$first_title" "$second_title" "$third_title")"

  set_borderless_windows true || \
    fail "KWin could not enable borderless $protocol windows"

  for title in "$first_title" "$second_title" "$third_title"; do
    wait_for_window_border_state "$title" true || \
      fail "Driftile did not reapply the managed $protocol borderless setting"
  done

  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile changed the $protocol layout while removing decorations: $(describe_layout "$first_title" "$second_title" "$third_title")"

  wait_for_shortcut "driftile_focus_column_first" || \
    fail "KGlobalAccel did not register the focus-first shortcut"
  wait_for_shortcut "driftile_focus_column_last" || \
    fail "KGlobalAccel did not register the focus-last shortcut"
  wait_for_shortcut "driftile_move_column_to_first" || \
    fail "KGlobalAccel did not register the move-to-first shortcut"
  wait_for_shortcut "driftile_move_column_to_last" || \
    fail "KGlobalAccel did not register the move-to-last shortcut"

  invoke_shortcut "driftile_focus_column_first" || \
    fail "KGlobalAccel could not invoke the focus-first shortcut"
  wait_for_active "$first_title" || \
    fail "Driftile did not focus the first $protocol column"
  wait_for_layout \
    "$first_title" "0,16,616,688" \
    "$second_title" "632,16,616,688" \
    "$third_title" "1264,16,616,688" || \
    fail "Driftile did not reveal the first $protocol column: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_focus_column_last" || \
    fail "KGlobalAccel could not invoke the focus-last shortcut"
  wait_for_active "$third_title" || \
    fail "Driftile did not focus the last $protocol column"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reveal the last $protocol column: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_column_to_first" || \
    fail "KGlobalAccel could not invoke the move-to-first shortcut"
  wait_for_active "$third_title" || \
    fail "Driftile changed focus while moving the $protocol column first"
  wait_for_layout \
    "$first_title" "632,16,616,688" \
    "$second_title" "1264,16,616,688" \
    "$third_title" "0,16,616,688" || \
    fail "Driftile did not move the active $protocol column first: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_column_to_last" || \
    fail "KGlobalAccel could not invoke the move-to-last shortcut"
  wait_for_active "$third_title" || \
    fail "Driftile changed focus while moving the $protocol column last"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not move the active $protocol column last: $(describe_layout "$first_title" "$second_title" "$third_title")"

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

  wait_for_shortcut "driftile_move_column_left" || \
    fail "KGlobalAccel did not register the move-left shortcut"
  wait_for_shortcut "driftile_move_column_right" || \
    fail "KGlobalAccel did not register the move-right shortcut"
  invoke_shortcut "driftile_move_column_left" || \
    fail "KGlobalAccel could not invoke the move-left shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "664,16,616,688" \
    "$third_title" "32,16,616,688" || \
    fail "Driftile did not move the active $protocol column left: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_column_right" || \
    fail "KGlobalAccel could not invoke the move-right shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not move the active $protocol column right: $(describe_layout "$first_title" "$second_title" "$third_title")"

  activate_window "$second_title" || \
    fail "KWin could not activate the middle $protocol window for stack editing"
  wait_for_active "$second_title" || \
    fail "KWin did not focus the middle $protocol window before stack editing"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not preserve the middle $protocol column before stack editing: $(describe_layout "$first_title" "$second_title" "$third_title")"

  wait_for_shortcut "driftile_focus_window_up" || \
    fail "KGlobalAccel did not register the focus-up shortcut"
  wait_for_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel did not register the focus-down shortcut"
  wait_for_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel did not register the move-window-left shortcut"
  wait_for_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel did not register the move-window-right shortcut"
  wait_for_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel did not register the move-window-up shortcut"
  wait_for_shortcut "driftile_move_window_down" || \
    fail "KGlobalAccel did not register the move-window-down shortcut"
  wait_for_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel did not register the insert-into-stack-left shortcut"
  wait_for_shortcut "driftile_insert_window_into_stack_right" || \
    fail "KGlobalAccel did not register the insert-into-stack-right shortcut"
  wait_for_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel did not register the floating-toggle shortcut"

  verify_automatic_floating \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not invoke the move-window-left shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not merge the active $protocol window left: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after merging the middle window left"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not float the lower $protocol stack member"
  second_floating_baseline=$(capture_stable_geometry "$second_title") || \
    fail "the floating lower $protocol stack member did not stabilize"
  [[ "$second_floating_baseline" =~ ^[^,]+,[^,]+,360,240$ ]] || \
    fail "Driftile did not preserve the lower $protocol client size while floating: $second_floating_baseline"
  wait_for_layout \
    "$first_title" "16,16,616,688" \
    "$second_title" "$second_floating_baseline" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not float the lower $protocol stack member: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after floating the lower stack member"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the lower $protocol stack member"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the lower $protocol stack member: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after restoring the lower stack member"

  verify_desktop_transfer \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title" \
    first_baseline \
    second_baseline

  activate_window "$third_title" || \
    fail "KWin could not activate the singleton before direct $protocol stack insertion"
  wait_for_active "$third_title" || \
    fail "KWin did not focus the singleton before direct $protocol stack insertion"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack before direct insertion: $(describe_layout "$first_title" "$second_title" "$third_title")"

  start_client "$protocol" "$fourth_title" true
  fourth_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$fourth_title" >/dev/null || \
    fail "the direct $protocol stack insertion window did not stabilize"
  activate_window "$fourth_title" || \
    fail "KWin could not activate the direct $protocol stack insertion window"
  wait_for_active "$fourth_title" || \
    fail "KWin did not focus the direct $protocol stack insertion window"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,688" \
    "$fourth_title" "664,16,616,688" || \
    fail "Driftile did not prepare the direct $protocol stack insertion: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"

  invoke_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel could not invoke the insert-into-stack-left shortcut"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "648,16,616,688" \
    "$fourth_title" "16,485,616,219" || \
    fail "Driftile did not skip the singleton and append the active $protocol window to the left stack: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus after direct stack insertion"

  invoke_shortcut "driftile_insert_window_into_stack_right" || \
    fail "KGlobalAccel could not invoke the insert-into-stack-right shortcut"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "648,16,616,688" \
    "$fourth_title" "16,485,616,219" || \
    fail "Driftile wrapped the direct $protocol stack search past the right boundary: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus after the bounded stack search"

  stop_client "$fourth_pid"
  wait_for_window_gone "$fourth_title" || \
    fail "the direct $protocol stack insertion window did not close"
  activate_window "$second_title" || \
    fail "KWin could not restore focus after direct $protocol stack insertion"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol stack after direct insertion: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "KWin did not restore the lower $protocol stack member focus"

  invoke_shortcut "driftile_focus_window_up" || \
    fail "KGlobalAccel could not invoke the focus-up shortcut"
  wait_for_active "$first_title" || \
    fail "Driftile did not focus the upper $protocol stack member"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack while focusing up: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not invoke the focus-down shortcut"
  wait_for_active "$second_title" || \
    fail "Driftile did not focus the lower $protocol stack member"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack while focusing down: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not invoke the move-window-up shortcut"
  wait_for_layout \
    "$first_title" "16,368,616,336" \
    "$second_title" "16,16,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not move the active $protocol stack member up: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after moving the stack member up"

  invoke_shortcut "driftile_move_window_down" || \
    fail "KGlobalAccel could not invoke the move-window-down shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not move the active $protocol stack member down: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after moving the stack member down"

  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not invoke the focus-right shortcut from the stack"
  wait_for_active "$third_title" || \
    fail "Driftile did not focus the right $protocol column from the stack"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack while focusing right: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not merge the right $protocol window left"
  wait_for_layout \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "16,485,616,219" || \
    fail "Driftile did not form the three-window $protocol stack: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$third_title" || \
    fail "Driftile changed $protocol focus after forming the three-window stack"

  invoke_shortcut "driftile_focus_window_up" || \
    fail "KGlobalAccel could not focus up in the three-window $protocol stack"
  wait_for_active "$second_title" || \
    fail "Driftile did not focus the middle member of the three-window $protocol stack"
  wait_for_layout \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "16,485,616,219" || \
    fail "Driftile changed the three-window $protocol stack while focusing up: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus down in the three-window $protocol stack"
  wait_for_active "$third_title" || \
    fail "Driftile did not restore focus to the lower three-window $protocol stack member"
  wait_for_layout \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "16,485,616,219" || \
    fail "Driftile changed the three-window $protocol stack while focusing down: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not extract the lower $protocol stack member right"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not extract the lower $protocol stack member right: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$third_title" || \
    fail "Driftile changed $protocol focus after extracting the lower stack member"

  invoke_shortcut "driftile_focus_column_left" || \
    fail "KGlobalAccel could not invoke the focus-left shortcut from the extracted window"
  wait_for_active "$first_title" || \
    fail "Driftile did not focus the first member of the left $protocol stack"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack while focusing left: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus the lower member of the left $protocol stack"
  wait_for_active "$second_title" || \
    fail "Driftile did not focus the lower member of the left $protocol stack"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol stack before extracting its lower member: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not extract the active $protocol stack member right"
  wait_for_layout \
    "$first_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" \
    "$third_title" "1280,16,616,688" || \
    fail "Driftile did not extract the active $protocol stack member right: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after extracting the middle window"

  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not merge the active $protocol window right"
  wait_for_layout \
    "$first_title" "16,16,616,688" \
    "$second_title" "648,368,616,336" \
    "$third_title" "648,16,616,336" || \
    fail "Driftile did not merge the active $protocol window right: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after merging the middle window right"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not extract the active $protocol stack member left"
  wait_for_layout \
    "$first_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" \
    "$third_title" "1280,16,616,688" || \
    fail "Driftile did not extract the active $protocol stack member left: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after extracting the middle window left"

  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus the right $protocol column"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reveal the right $protocol column after stack editing: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$third_title" || \
    fail "Driftile did not focus the right $protocol column after stack editing"

  invoke_shortcut "driftile_focus_column_left" || \
    fail "KGlobalAccel could not restore focus to the middle $protocol column"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile changed the restored three-column $protocol layout: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile did not restore focus to the middle $protocol column"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not float the middle $protocol window"
  wait_for_layout \
    "$first_title" "16,16,616,688" \
    "$second_title" "$second_baseline" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not reflow around the floating middle $protocol window: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after floating the middle window"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the middle $protocol window"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not restore the middle $protocol window to its original slot: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after retiling the middle window"

  wait_for_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel did not register the decrease-width shortcut"
  wait_for_shortcut "driftile_increase_column_width" || \
    fail "KGlobalAccel did not register the increase-width shortcut"
  wait_for_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel did not register the reset-width shortcut"
  wait_for_shortcut "driftile_switch_preset_column_width" || \
    fail "KGlobalAccel did not register the preset-width shortcut"
  wait_for_shortcut "driftile_switch_preset_column_width_back" || \
    fail "KGlobalAccel did not register the reverse preset-width shortcut"
  wait_for_shortcut "driftile_maximize_column" || \
    fail "KGlobalAccel did not register the maximize-column shortcut"
  wait_for_shortcut "driftile_center_column" || \
    fail "KGlobalAccel did not register the center-column shortcut"

  invoke_shortcut "driftile_increase_column_width" || \
    fail "KGlobalAccel could not invoke the increase-width shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,742,688" \
    "$third_title" "790,16,616,688" || \
    fail "Driftile did not increase the active $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after increasing column width"

  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not invoke the decrease-width shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not restore the active $protocol column width after decreasing: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after restoring column width"

  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not invoke the decrease-width shortcut"
  wait_for_layout \
    "$first_title" "-490,16,616,688" \
    "$second_title" "142,16,490,688" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not decrease the active $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after decreasing column width"

  invoke_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel could not invoke the reset-width shortcut"
  wait_for_layout \
    "$first_title" "-490,16,616,688" \
    "$second_title" "142,16,616,688" \
    "$third_title" "774,16,616,688" || \
    fail "Driftile did not reset the active $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after resetting column width"

  invoke_shortcut "driftile_switch_preset_column_width" || \
    fail "KGlobalAccel could not invoke the preset-width shortcut"
  wait_for_layout \
    "$first_title" "-490,16,616,688" \
    "$second_title" "142,16,827,688" \
    "$third_title" "985,16,616,688" || \
    fail "Driftile did not select the next $protocol preset width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after selecting a preset width"

  invoke_shortcut "driftile_switch_preset_column_width_back" || \
    fail "KGlobalAccel could not invoke the reverse preset-width shortcut"
  wait_for_layout \
    "$first_title" "-490,16,616,688" \
    "$second_title" "142,16,616,688" \
    "$third_title" "774,16,616,688" || \
    fail "Driftile did not restore the previous $protocol preset width: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_maximize_column" || \
    fail "KGlobalAccel could not invoke the maximize-column shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,1248,688" \
    "$third_title" "1296,16,616,688" || \
    fail "Driftile did not maximize the active $protocol column: $(describe_layout "$first_title" "$second_title" "$third_title")"
  invoke_shortcut "driftile_maximize_column" || \
    fail "KGlobalAccel could not restore the maximized column"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not restore the maximized $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_center_column" || \
    fail "KGlobalAccel could not invoke the center-column shortcut"
  wait_for_layout \
    "$first_title" "-300,16,616,688" \
    "$second_title" "332,16,616,688" \
    "$third_title" "964,16,616,688" || \
    fail "Driftile did not center the active $protocol column: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after centering the column"

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile"
  wait_for_layout \
    "$first_title" "$first_baseline" \
    "$second_title" "$second_baseline" \
    "$third_title" "$third_baseline" || \
    fail "Driftile did not restore the $protocol windows: expected $first_title=$first_baseline $second_title=$second_baseline $third_title=$third_baseline; actual $(describe_layout "$first_title" "$second_title" "$third_title")"

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
  local temporary_left_pid
  local -a baselines=("" "" "" "" "" "")
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

  for index in 0 1 3 4; do
    start_client "$protocol" "${titles[index]}" true

    if ! baseline=$(capture_stable_geometry "${titles[index]}"); then
      fail "the multi-output $protocol window ${titles[index]} did not stabilize"
    fi

    baselines[index]=$baseline

    if ((index < 3)); then
      side=left
    else
      side=right
    fi

    window_is_on_output_side "${titles[index]}" "$side" || \
      fail "the output router did not place ${titles[index]} on the $side output"
  done

  for index in 0 1 3 4; do
    baselines[index]=$(capture_stable_geometry "${titles[index]}") || \
      fail "the initial multi-output $protocol baseline for ${titles[index]} did not stabilize"
  done
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "${baselines[1]}" \
    "${titles[3]}" "${baselines[3]}" \
    "${titles[4]}" "${baselines[4]}" || \
    fail "the initial multi-output $protocol baselines did not stabilize together"

  activate_window "${titles[4]}" || \
    fail "KWin could not activate the final initial multi-output $protocol window"

  set_plugin_state true
  wait_for_script_state true || fail "KWin did not report Driftile as loaded"
  claim_shortcut_profile
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not create two isolated $protocol output contexts: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"

  wait_for_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel did not register the multi-output insert-into-stack-left shortcut"
  wait_for_shortcut "driftile_insert_window_into_stack_right" || \
    fail "KGlobalAccel did not register the multi-output insert-into-stack-right shortcut"
  activate_window "${titles[1]}" || \
    fail "KWin could not activate the left $protocol window for direct stack insertion"
  wait_for_active "${titles[1]}" || \
    fail "KWin did not focus the left $protocol window before preparing the stack"
  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not prepare the left multi-output $protocol stack"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,336" \
    "${titles[1]}" "16,368,616,336" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not prepare the isolated left $protocol stack: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"

  verify_multi_output_desktop_transfer \
    "$protocol" \
    "${titles[0]}" \
    "${titles[1]}" \
    "${titles[3]}" \
    "${titles[4]}"

  verify_multi_output_output_transfer \
    "$protocol" \
    "${titles[0]}" \
    "${titles[1]}" \
    "${titles[3]}" \
    "${titles[4]}"

  # A transferred window adopts KWin's returned mechanism frame as its safe baseline.
  baselines[0]="648,16,490,336"

  start_client "$protocol" "${titles[2]}" true
  temporary_left_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "${titles[2]}" >/dev/null || \
    fail "the direct multi-output $protocol insertion window did not stabilize"
  window_is_on_output_side "${titles[2]}" left || \
    fail "the output router did not place the direct $protocol insertion window on the left output"
  activate_window "${titles[2]}" || \
    fail "KWin could not activate the direct multi-output $protocol insertion window"
  wait_for_active "${titles[2]}" || \
    fail "KWin did not focus the direct multi-output $protocol insertion window"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,336" \
    "${titles[1]}" "16,368,616,336" \
    "${titles[2]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not admit the direct multi-output $protocol insertion window: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[2]}" "${titles[3]}" "${titles[4]}")"

  invoke_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel could not invoke the multi-output insert-into-stack-left shortcut"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,219" \
    "${titles[1]}" "16,251,616,218" \
    "${titles[2]}" "16,485,616,219" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not isolate the direct multi-output $protocol stack insertion: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[2]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[2]}" || \
    fail "Driftile changed $protocol focus after the isolated stack insertion"

  invoke_shortcut "driftile_insert_window_into_stack_right" || \
    fail "KGlobalAccel could not invoke the bounded multi-output stack search"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,219" \
    "${titles[1]}" "16,251,616,218" \
    "${titles[2]}" "16,485,616,219" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile crossed an output boundary during the $protocol stack search: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[2]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[2]}" || \
    fail "Driftile changed $protocol focus after the bounded multi-output stack search"

  stop_client "$temporary_left_pid"
  wait_for_window_gone "${titles[2]}" || \
    fail "the temporary multi-output $protocol insertion window did not close"
  activate_window "${titles[1]}" || \
    fail "KWin could not activate the lower left $protocol stack member"
  wait_for_active "${titles[1]}" || \
    fail "KWin did not focus the lower left $protocol stack member"
  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not restore the left multi-output $protocol columns"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not restore the two $protocol output contexts after direct insertion: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"

  wait_for_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel did not register the multi-output floating shortcut"
  activate_window "${titles[0]}" || \
    fail "KWin could not activate the left $protocol window for floating"
  wait_for_active "${titles[0]}" || \
    fail "KWin did not focus the left $protocol window before floating"
  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not float the left $protocol window"
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not isolate the multi-output $protocol floating reflow: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[0]}" || \
    fail "Driftile changed $protocol focus after the multi-output floating toggle"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the left $protocol window"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not restore the multi-output $protocol floating window: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[0]}" || \
    fail "Driftile changed $protocol focus after the multi-output retile"

  for index in 2 5; do
    start_client "$protocol" "${titles[index]}" true

    if ! baseline=$(capture_stable_geometry "${titles[index]}"); then
      fail "the multi-output $protocol window ${titles[index]} did not stabilize"
    fi

    baselines[index]=$baseline

    if ((index < 3)); then
      side=left
    else
      side=right
    fi

    window_is_on_output_side "${titles[index]}" "$side" || \
      fail "the output router did not place ${titles[index]} on the $side output"
  done

  activate_window "${titles[5]}" || \
    fail "KWin could not activate the final multi-output $protocol window"
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
prepare_test_desktops || fail "KWin could not create the second integration virtual desktop"

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

    unload_automatic_floating_probe || \
      fail "KWin could not unload the automatic-floating integration probe"
    ;;
  *)
    fail "unsupported smoke-test scenario: $DRIFTILE_SMOKE_SCENARIO"
    ;;
esac

release_shortcut_profile
touch "$DRIFTILE_SMOKE_RESULT"
