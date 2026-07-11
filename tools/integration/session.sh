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
readonly desktop_reorder_capability_plugin_id="io.github.kontonkara.driftile.integration-desktop-reorder-capability"
readonly desktop_reorder_supported_shortcut="Driftile Integration Desktop Reorder Supported"
readonly desktop_reorder_unavailable_shortcut="Driftile Integration Desktop Reorder Unavailable"
readonly desktop_reorder_state_plugin_id="io.github.kontonkara.driftile.integration-desktop-reorder-state"
readonly desktop_reorder_state_verified_shortcut_prefix="Driftile Integration Desktop Reorder State Verified"
readonly floating_navigation_arranger_plugin_id="io.github.kontonkara.driftile.integration-floating-navigation-arranger"
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
desktop_reorder_supported=false
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
    s "$desktop_reorder_capability_plugin_id" \
    >/dev/null 2>&1 || true
  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$desktop_reorder_state_plugin_id" \
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
    while IFS= read -r candidate_title; do
      if [[ "$candidate_title" == "$window_title" ]]; then
        printf '%s' "$candidate"
        return 0
      fi
    done < <(
      xprop -id "$candidate" -notype _NET_WM_NAME WM_NAME 2>/dev/null |
        sed -n 's/^[^=]*= "\(.*\)"$/\1/p'
    )
  done

  return 1
}

x11_window_is_active() {
  local window_title=$1
  local active_id
  local target_id

  target_id=$(x11_window_id "$window_title") || return 1
  active_id=$(
    xprop -root -notype _NET_ACTIVE_WINDOW 2>/dev/null |
      sed -n 's/^_NET_ACTIVE_WINDOW[^#]*# \(0x[0-9a-fA-F]*\)$/\1/p'
  )

  [[ -n "$active_id" && "${active_id,,}" == "${target_id,,}" ]]
}

wait_for_x11_window_active() {
  local window_title=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if x11_window_is_active "$window_title"; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

x11_window_resize_policy() {
  local window_title=$1
  local id
  local hints
  local hint
  local increments=""
  local base_size=""

  id=$(x11_window_id "$window_title") || return 1
  hints=$(LC_ALL=C xprop -id "$id" WM_NORMAL_HINTS 2>/dev/null) || return 1

  while IFS= read -r hint; do
    if [[ "$hint" =~ program[[:space:]]specified[[:space:]]resize[[:space:]]increment:[[:space:]]([0-9]+)[[:space:]]by[[:space:]]([0-9]+) ]]; then
      increments="${BASH_REMATCH[1]},${BASH_REMATCH[2]}"
    elif [[ "$hint" =~ program[[:space:]]specified[[:space:]]base[[:space:]]size:[[:space:]]([0-9]+)[[:space:]]by[[:space:]]([0-9]+) ]]; then
      base_size="${BASH_REMATCH[1]},${BASH_REMATCH[2]}"
    fi
  done <<< "$hints"

  [[ "$increments" =~ ^[0-9]+,[0-9]+$ ]] || return 1
  [[ "$base_size" =~ ^[0-9]+,[0-9]+$ ]] || return 1
  printf '%s,%s' "$increments" "$base_size"
}

resize_policy_is_nontrivial() {
  local policy=$1
  local increment_width
  local increment_height
  local base_width
  local base_height

  [[ "$policy" =~ ^[0-9]+,[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
  IFS=, read -r \
    increment_width increment_height base_width base_height \
    <<< "$policy"

  ((
    increment_width > 1 &&
      increment_height > 1 &&
      base_width > 0 &&
      base_height > 0
  ))
}

frame_is_off_resize_lattice() {
  local frame=$1
  local policy=$2
  local width
  local height
  local increment_width
  local increment_height
  local base_width
  local base_height

  [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
  resize_policy_is_nontrivial "$policy" || return 1
  IFS=, read -r _ _ width height <<< "$frame"
  IFS=, read -r \
    increment_width increment_height base_width base_height \
    <<< "$policy"

  ((width > 0 && height > 0)) || return 1
  (((width - base_width) % increment_width != 0)) || \
    (((height - base_height) % increment_height != 0))
}

frame_is_on_resize_lattice() {
  local frame=$1
  local policy=$2
  local width
  local height
  local increment_width
  local increment_height
  local base_width
  local base_height

  [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
  resize_policy_is_nontrivial "$policy" || return 1
  IFS=, read -r _ _ width height <<< "$frame"
  IFS=, read -r \
    increment_width increment_height base_width base_height \
    <<< "$policy"

  ((width > 0 && height > 0)) || return 1
  (((width - base_width) % increment_width == 0)) && \
    (((height - base_height) % increment_height == 0))
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

wait_for_shortcut_focus() {
  local shortcut=$1
  local window_title=$2
  local attempt
  local sample

  for ((attempt = 0; attempt < wait_attempts / 5; attempt += 1)); do
    if window_is_active "$window_title"; then
      return 0
    fi

    invoke_shortcut "$shortcut" || return 1

    for ((sample = 0; sample < 5; sample += 1)); do
      sleep 0.05

      if window_is_active "$window_title"; then
        return 0
      fi
    done
  done

  return 1
}

geometries_match_once() {
  local current

  (($# > 0 && $# % 2 == 0)) || return 1

  while (($# > 0)); do
    current=$(window_frame_geometry "$1" 2>/dev/null || true)
    [[ "$current" == "$2" ]] || return 1
    shift 2
  done
}

wait_for_shortcut_geometries() {
  local shortcut=$1
  local attempt
  local sample
  local -a geometry_pairs

  shift
  geometry_pairs=("$@")

  for ((attempt = 0; attempt < wait_attempts / 5; attempt += 1)); do
    if geometries_match_once "${geometry_pairs[@]}"; then
      wait_for_geometries "${geometry_pairs[@]}"
      return
    fi

    invoke_shortcut "$shortcut" || return 1

    for ((sample = 0; sample < 5; sample += 1)); do
      sleep 0.05

      if geometries_match_once "${geometry_pairs[@]}"; then
        wait_for_geometries "${geometry_pairs[@]}"
        return
      fi
    done
  done

  return 1
}

describe_active_windows() {
  local title
  local active=()

  for title in "$@"; do
    if window_is_active "$title" 2>/dev/null; then
      active+=("$title")
    fi
  done

  if ((${#active[@]} == 0)); then
    printf '%s' none
  else
    local IFS=,
    printf '%s' "${active[*]}"
  fi
}

frames_match_leftward_reveal() {
  local before_first=$1
  local after_first=$2
  local before_second=$3
  local after_second=$4
  local before_target=$5
  local after_target=$6
  local output_width=$7
  local before_first_x before_first_y before_first_width before_first_height
  local after_first_x after_first_y after_first_width after_first_height
  local before_second_x before_second_y before_second_width before_second_height
  local after_second_x after_second_y after_second_width after_second_height
  local before_target_x before_target_y before_target_width before_target_height
  local after_target_x after_target_y after_target_width after_target_height
  local delta
  local frame

  for frame in \
    "$before_first" "$after_first" \
    "$before_second" "$after_second" \
    "$before_target" "$after_target"; do
    [[ "$frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
  done

  IFS=, read -r before_first_x before_first_y before_first_width before_first_height <<< "$before_first"
  IFS=, read -r after_first_x after_first_y after_first_width after_first_height <<< "$after_first"
  IFS=, read -r before_second_x before_second_y before_second_width before_second_height <<< "$before_second"
  IFS=, read -r after_second_x after_second_y after_second_width after_second_height <<< "$after_second"
  IFS=, read -r before_target_x before_target_y before_target_width before_target_height <<< "$before_target"
  IFS=, read -r after_target_x after_target_y after_target_width after_target_height <<< "$after_target"
  delta=$((after_first_x - before_first_x))

  ((
    delta < 0 &&
      after_second_x - before_second_x == delta &&
      after_target_x - before_target_x == delta &&
      before_first_y == after_first_y &&
      before_first_width == after_first_width &&
      before_first_height == after_first_height &&
      before_second_y == after_second_y &&
      before_second_width == after_second_width &&
      before_second_height == after_second_height &&
      before_target_y == after_target_y &&
      before_target_width == after_target_width &&
      before_target_height == after_target_height &&
      before_target_x + before_target_width > output_width &&
      after_target_x >= 0 &&
      after_target_x + after_target_width <= output_width
  ))
}

frames_share_horizontal_translation() {
  local before
  local after
  local before_x before_y before_width before_height
  local after_x after_y after_width after_height
  local delta=""

  (($# > 0 && $# % 2 == 0)) || return 1

  while (($# > 0)); do
    before=$1
    after=$2
    shift 2

    [[ "$before" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
    [[ "$after" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || return 1
    IFS=, read -r before_x before_y before_width before_height <<< "$before"
    IFS=, read -r after_x after_y after_width after_height <<< "$after"

    if [[ -z "$delta" ]]; then
      delta=$((after_x - before_x))
    fi

    ((
      after_x - before_x == delta &&
        before_y == after_y &&
        before_width == after_width &&
        before_height == after_height
    )) || return 1
  done
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

wait_for_window_state() {
  local id=$1
  local state=$2
  local expected=$3
  local attempt
  local stable_samples=0

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if window_state_matches "$id" "$state" "$expected" 2>/dev/null; then
      ((stable_samples += 1))

      if ((stable_samples >= stable_sample_count)); then
        return 0
      fi
    else
      stable_samples=0
    fi

    sleep 0.05
  done

  return 1
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

window_desktop_transfer_state() {
  local id

  id=$(window_id "$1") || return 1
  busctl --user --json=short call \
    org.kde.KWin \
    /KWin \
    org.kde.KWin \
    getWindowInfo \
    s "$id" 2>/dev/null | jq --compact-output '
      .data[0]
      | {
          desktops: .desktops.data,
          dialog: .dialog.data,
          modal: .modal.data,
          moveable: .moveable.data,
          normalWindow: .normalWindow.data,
          output: .output.data,
          resizeable: .resizeable.data,
          transient: .transient.data
        }
    '
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

single_output_work_area() {
  local protocol=$1

  if [[ "$protocol" == "x11" ]]; then
    xprop -root -notype _NET_WORKAREA 2>/dev/null |
      sed -n 's/^_NET_WORKAREA = //p' |
      cut -d, -f1-4 |
      tr -d ' '
    return
  fi

  kscreen-doctor -j 2>/dev/null | jq --exit-status --raw-output '
    [.outputs[] | select(.enabled)]
    | select(length == 1)
    | .[0]
    | [
        .pos.x,
        .pos.y,
        (.size.width / .scale),
        (.size.height / .scale)
      ]
    | map(tostring)
    | join(",")
  '
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

frame_horizontal_gap() {
  local left_frame=$1
  local right_frame=$2

  jq --null-input --raw-output \
    --arg left "$left_frame" \
    --arg right "$right_frame" '
      def rect($raw):
        ($raw | split(",") | map(tonumber)) as $values
        | {
            x: $values[0],
            width: $values[2]
          };
      (rect($left)) as $left_rect
      | (rect($right)) as $right_rect
      | $right_rect.x - ($left_rect.x + $left_rect.width)
    '
}

expanded_column_geometry_matches() {
  local work_area=$1
  local gap=$2
  local before_first=$3
  local before_active=$4
  local before_right=$5
  local after_first=$6
  local after_active=$7
  local after_right=$8

  jq --exit-status --null-input \
    --arg workArea "$work_area" \
    --argjson gap "$gap" \
    --arg beforeFirst "$before_first" \
    --arg beforeActive "$before_active" \
    --arg beforeRight "$before_right" \
    --arg afterFirst "$after_first" \
    --arg afterActive "$after_active" \
    --arg afterRight "$after_right" '
      def rect($raw):
        ($raw | split(",") | map(tonumber)) as $values
        | {
            x: $values[0],
            y: $values[1],
            width: $values[2],
            height: $values[3]
          };
      def magnitude: if . < 0 then -. else . end;
      def near($left; $right): (($left - $right) | magnitude) <= 1.01;
      (rect($workArea)) as $work
      | (rect($beforeFirst)) as $before_first
      | (rect($beforeActive)) as $before_active
      | (rect($beforeRight)) as $before_right
      | (rect($afterFirst)) as $after_first
      | (rect($afterActive)) as $after_active
      | (rect($afterRight)) as $after_right
      | ($work.x + $work.width) as $work_right
      | ($before_first.x < $before_active.x and $before_active.x < $before_right.x)
        and ($after_first.x < $after_active.x and $after_active.x < $after_right.x)
        and near($before_active.x - ($before_first.x + $before_first.width); $gap)
        and near($before_right.x - ($before_active.x + $before_active.width); $gap)
        and near($after_active.x - ($after_first.x + $after_first.width); $gap)
        and near($after_right.x - ($after_active.x + $after_active.width); $gap)
        and near($after_first.width; $before_first.width)
        and near($after_right.width; $before_right.width)
        and ($after_active.width > $before_active.width + 1.01)
        and near($after_first.y; $before_first.y)
        and near($after_active.y; $before_active.y)
        and near($after_right.y; $before_right.y)
        and near($after_first.height; $before_first.height)
        and near($after_active.height; $before_active.height)
        and near($after_right.height; $before_right.height)
        and near($after_active.x; $work.x + $gap)
        and near($after_right.x + $after_right.width; $work_right - $gap)
    ' >/dev/null
}

centered_visible_geometry_matches() {
  local work_area=$1
  local gap=$2
  local before_first=$3
  local before_active=$4
  local before_right=$5
  local after_first=$6
  local after_active=$7
  local after_right=$8

  jq --exit-status --null-input \
    --arg workArea "$work_area" \
    --argjson gap "$gap" \
    --arg beforeFirst "$before_first" \
    --arg beforeActive "$before_active" \
    --arg beforeRight "$before_right" \
    --arg afterFirst "$after_first" \
    --arg afterActive "$after_active" \
    --arg afterRight "$after_right" '
      def rect($raw):
        ($raw | split(",") | map(tonumber)) as $values
        | {
            x: $values[0],
            y: $values[1],
            width: $values[2],
            height: $values[3]
          };
      def magnitude: if . < 0 then -. else . end;
      def near($left; $right): (($left - $right) | magnitude) <= 1.01;
      (rect($workArea)) as $work
      | (rect($beforeFirst)) as $before_first
      | (rect($beforeActive)) as $before_active
      | (rect($beforeRight)) as $before_right
      | (rect($afterFirst)) as $after_first
      | (rect($afterActive)) as $after_active
      | (rect($afterRight)) as $after_right
      | ($work.x + $work.width) as $work_right
      | ($after_first.x - $before_first.x) as $translation
      | ($after_active.x - $before_active.x) as $active_translation
      | ($after_right.x - $before_right.x) as $right_translation
      | ($after_active.x - $work.x) as $left_margin
      | ($work_right - ($after_right.x + $after_right.width)) as $right_margin
      | (($translation | magnitude) > 1.01)
        and near($translation; $active_translation)
        and near($translation; $right_translation)
        and ($before_first.x < $before_active.x and $before_active.x < $before_right.x)
        and ($after_first.x < $after_active.x and $after_active.x < $after_right.x)
        and near($before_active.x - ($before_first.x + $before_first.width); $gap)
        and near($before_right.x - ($before_active.x + $before_active.width); $gap)
        and near($after_active.x - ($after_first.x + $after_first.width); $gap)
        and near($after_right.x - ($after_active.x + $after_active.width); $gap)
        and near($after_first.width; $before_first.width)
        and near($after_active.width; $before_active.width)
        and near($after_right.width; $before_right.width)
        and near($after_first.y; $before_first.y)
        and near($after_active.y; $before_active.y)
        and near($after_right.y; $before_right.y)
        and near($after_first.height; $before_first.height)
        and near($after_active.height; $before_active.height)
        and near($after_right.height; $before_right.height)
        and ($before_active.x >= $work.x + $gap - 1.01)
        and ($before_right.x + $before_right.width + $gap <= $work_right + 1.01)
        and ($before_first.x < $work.x + $gap - 1.01)
        and near($left_margin; $right_margin)
        and ($left_margin >= $gap - 1.01)
    ' >/dev/null
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

detect_desktop_reorder_capability() {
  local attempt
  local load_result
  local script_id
  local detected=""

  wait_for_shortcut_absent "$desktop_reorder_supported_shortcut" || return 1
  wait_for_shortcut_absent "$desktop_reorder_unavailable_shortcut" || return 1
  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss \
    "$DRIFTILE_SMOKE_DESKTOP_REORDER_CAPABILITY_PROBE" \
    "$desktop_reorder_capability_plugin_id") || return 1
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

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if shortcut_is_registered "$desktop_reorder_supported_shortcut"; then
      detected=supported
      break
    fi

    if shortcut_is_registered "$desktop_reorder_unavailable_shortcut"; then
      detected=unavailable
      break
    fi

    sleep 0.05
  done

  busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$desktop_reorder_capability_plugin_id" \
    >/dev/null || return 1
  wait_for_named_script_state "$desktop_reorder_capability_plugin_id" false \
    || return 1

  case "$detected" in
    supported)
      desktop_reorder_supported=true
      ;;
    unavailable)
      desktop_reorder_supported=false
      ;;
    *)
      return 1
      ;;
  esac
}

arrange_floating_navigation_windows() {
  run_one_shot_script \
    "$DRIFTILE_SMOKE_FLOATING_NAVIGATION_ARRANGER" \
    "$floating_navigation_arranger_plugin_id"
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

verify_multi_output_desktop_reorder_state() {
  local active_title=$1
  local order=$2
  local load_result
  local script_id
  local verified=false
  local verified_shortcut="$desktop_reorder_state_verified_shortcut_prefix $active_title $order"

  wait_for_shortcut_absent "$verified_shortcut" || return 1
  load_result=$(busctl --user call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadScript \
    ss \
    "$DRIFTILE_SMOKE_DESKTOP_REORDER_STATE_PROBE" \
    "$desktop_reorder_state_plugin_id") || return 1
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
    s "$desktop_reorder_state_plugin_id" \
    >/dev/null 2>&1 || true

  wait_for_named_script_state "$desktop_reorder_state_plugin_id" false \
    || verified=false
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

start_xterm_client() {
  local protocol=$1
  local window_title=$2
  local internal_border=2

  if [[ "$protocol" == x11 ]]; then
    # Keep native X11 sizes on xterm's character-cell lattice so KWin's
    # backend constraint enforcement cannot perturb the structural checks.
    internal_border=32
  fi

  xterm \
    -T "$window_title" \
    -b "$internal_border" \
    -class DriftileIntegrationXTerm \
    -fn fixed \
    -geometry 80x24 \
    -e sleep 300 \
    >/tmp/driftile-smoke-xterm.log 2>&1 &
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
  local trigger=${10:-window-action}

  if [[ "$trigger" == "shortcut" ]]; then
    activate_window "$target_title" || \
      fail "KWin could not focus the $protocol state window before $state"
    wait_for_active "$target_title" || \
      fail "KWin did not focus the $protocol state window before $state"
    invoke_shortcut "$action" || \
      fail "KGlobalAccel could not enter $state for the $protocol state window"
  else
    run_window_action "$target_title" "$action" || \
      fail "KWin could not enter $action for the $protocol state window"
  fi
  wait_for_state_and_geometries \
    "$id" "$state" true \
    "$reserved_title" "$reserved_frame" \
    "$target_title" "$active_frame" || \
    fail "Driftile fought the $protocol $action transition: $(describe_layout "$reserved_title" "$target_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_active "$target_title" || \
      fail "Driftile changed $protocol focus after entering $state"
    invoke_shortcut "$action" || \
      fail "KGlobalAccel could not leave $state for the $protocol state window"
  else
    run_window_action "$target_title" "$action" || \
      fail "KWin could not leave $action for the $protocol state window"
  fi
  wait_for_state_and_geometries \
    "$id" "$state" false \
    "$reserved_title" "$reserved_frame" \
    "$target_title" "$restored_frame" || \
    fail "Driftile did not restore the $protocol state window after $action: $(describe_layout "$reserved_title" "$target_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_active "$target_title" || \
      fail "Driftile changed $protocol focus after leaving $state"
  fi
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

numbered_desktop_shortcuts_are_registered() {
  local index

  for ((index = 1; index <= 9; index += 1)); do
    wait_for_shortcut "driftile_focus_desktop_${index}" || return 1
    wait_for_shortcut "driftile_move_column_to_desktop_${index}" || return 1
  done
}

verify_manual_floating_desktop_transfer() {
  local protocol=$1
  local first_title=$2
  local floating_title=$3
  local third_title=$4
  local destination_title=$5
  local first_trailing_desktop_id=$6
  local floating_frame
  local second_trailing_desktop_id=""

  activate_window "$floating_title" || \
    fail "KWin could not focus the $protocol window before floating transfer"
  wait_for_active "$floating_title" || \
    fail "KWin did not focus the $protocol window before floating transfer"
  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not prepare the manual $protocol floating transfer"
  floating_frame=$(capture_stable_geometry "$floating_title") || \
    fail "the manual $protocol floating frame did not stabilize"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile did not isolate the manual $protocol floating window before transfer: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus while preparing the floating transfer"

  invoke_shortcut "driftile_move_column_to_next_desktop" || \
    fail "KGlobalAccel could not move the manual $protocol floating window to the next desktop"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the manual $protocol floating window"
  wait_for_window_desktop "$floating_title" "$secondary_desktop_id" || \
    fail "KWin did not move the manual $protocol floating window to the next desktop"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "Driftile moved a tiled $protocol stack sibling with the floating window"
  wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated tiled $protocol column with the floating window"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile changed tiled $protocol geometry or the exact floating frame during transfer: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus during manual floating transfer"

  invoke_shortcut "driftile_focus_tiling" || \
    fail "KGlobalAccel could not verify the tiled layer after floating transfer"
  wait_for_active "$destination_title" || \
    fail "Driftile did not keep the transferred $protocol window in the floating layer"
  invoke_shortcut "driftile_focus_floating" || \
    fail "KGlobalAccel could not restore the transferred floating $protocol window"
  wait_for_active "$floating_title" || \
    fail "Driftile did not restore floating $protocol focus after transfer"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile changed $protocol geometry while verifying the transferred floating layer: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not directly return the manual $protocol floating window"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the directly returning manual $protocol floating window"
  wait_for_window_desktop "$floating_title" "$primary_desktop_id" || \
    fail "KWin did not directly return the manual $protocol floating window"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile changed the exact manual $protocol floating state during direct return: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus during the direct floating return"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not immediately retile the directly returned $protocol window"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$floating_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the directly returned $protocol window to its exact tiled stack: $(describe_layout "$first_title" "$floating_title" "$third_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus during immediate retile"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not prepare the manual $protocol floating tail transfer"
  floating_frame=$(capture_stable_geometry "$floating_title") || \
    fail "the manual $protocol floating tail-transfer frame did not stabilize"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile did not isolate the manual $protocol floating window before the tail transfer: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus while preparing the floating tail transfer"

  invoke_shortcut "driftile_move_column_to_desktop_9" || \
    fail "KGlobalAccel could not move the manual $protocol floating window to the shared tail"
  wait_for_current_desktop "$first_trailing_desktop_id" || \
    fail "Driftile did not clamp the manual $protocol floating transfer to the shared tail"
  wait_for_window_desktop "$floating_title" "$first_trailing_desktop_id" || \
    fail "KWin did not move the manual $protocol floating window to the shared tail"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "Driftile moved a tiled $protocol sibling to the shared tail"
  wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated tiled $protocol column to the shared tail"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile changed tiled $protocol geometry or the floating frame on the shared tail: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus on the floating shared-tail window"
  wait_for_appended_desktop \
    second_trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not replenish the tail after the manual $protocol floating transfer"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not return the manual $protocol floating window from the tail"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the manual $protocol floating window from the tail"
  wait_for_window_desktop "$floating_title" "$primary_desktop_id" || \
    fail "KWin did not return the manual $protocol floating window from the tail"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not remove its redundant manual-floating $protocol tail"
  wait_for_geometries \
    "$first_title" "16,16,616,688" \
    "$floating_title" "$floating_frame" \
    "$third_title" "648,16,616,688" \
    "$destination_title" "16,16,616,688" || \
    fail "Driftile changed the exact manual $protocol floating state after tail cleanup: $(describe_layout "$first_title" "$floating_title" "$third_title" "$destination_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus after manual-floating tail cleanup"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the transferred manual $protocol window"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$floating_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the manual $protocol window to its tiled stack: $(describe_layout "$first_title" "$floating_title" "$third_title")"
  wait_for_active "$floating_title" || \
    fail "Driftile changed $protocol focus while retiling after floating transfer"
}

verify_numbered_desktop_actions() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local destination_title=$5
  local first_trailing_desktop_id=$6
  local first_id
  local second_trailing_desktop_id=""

  numbered_desktop_shortcuts_are_registered || \
    fail "KGlobalAccel did not register all numbered desktop actions"

  invoke_shortcut "driftile_focus_desktop_1" || \
    fail "KGlobalAccel could not invoke the same-target numbered $protocol desktop action"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile changed the $protocol desktop for the same-target numbered action"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol layout for the same-target numbered action: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus for the same-target numbered action"

  invoke_shortcut "driftile_focus_desktop_2" || \
    fail "KGlobalAccel could not invoke the second numbered $protocol desktop action"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not resolve numbered $protocol desktop 2 as one-based"
  wait_for_active "$destination_title" || \
    fail "KWin did not restore target focus on numbered $protocol desktop 2"

  invoke_shortcut "driftile_focus_desktop_9" || \
    fail "KGlobalAccel could not invoke the high numbered $protocol desktop action"
  wait_for_current_desktop "$first_trailing_desktop_id" || \
    fail "Driftile did not clamp high numbered $protocol desktop focus to the shared tail"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "numbered $protocol desktop focus changed the shared trailing desktop"

  invoke_shortcut "driftile_focus_desktop_1" || \
    fail "KGlobalAccel could not restore numbered $protocol desktop 1"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not restore numbered $protocol desktop 1"
  activate_window "$second_title" || \
    fail "KWin could not restore $protocol stack focus before numbered transfer"
  wait_for_active "$second_title" || \
    fail "KWin did not restore $protocol stack focus before numbered transfer"
  first_id=$(window_id "$first_title") || \
    fail "KWin did not expose the passive $protocol stack member before numbered transfer"
  set_external_window_minimized "$first_title" true || \
    fail "KWin could not minimize the passive $protocol stack member before numbered transfer"
  wait_for_state_and_geometries \
    "$first_id" minimized true \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol source stack while settling its minimized transfer member: $(describe_layout "$first_title" "$second_title" "$third_title")"
  activate_window "$second_title" || \
    fail "KWin could not restore active $protocol stack focus before minimized numbered transfer"
  wait_for_active "$second_title" || \
    fail "KWin did not restore active $protocol stack focus before minimized numbered transfer"

  invoke_shortcut "driftile_move_column_to_desktop_2" || \
    fail "KGlobalAccel could not move the $protocol column to numbered desktop 2"
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the $protocol column to numbered desktop 2"
  wait_for_state_and_geometries \
    "$first_id" minimized true \
    "$destination_title" "16,16,616,688" \
    "$first_title" "16,16,616,336" \
    "$second_title" "648,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not transfer the $protocol column without writing its minimized member: $(describe_layout "$destination_title" "$first_title" "$second_title" "$third_title")"
  wait_for_window_desktop "$first_title" "$secondary_desktop_id" || \
    fail "KWin did not move the upper $protocol stack member to numbered desktop 2"
  wait_for_window_desktop "$second_title" "$secondary_desktop_id" || \
    fail "KWin did not move the lower $protocol stack member to numbered desktop 2"
  wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated $protocol column during numbered transfer"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus during numbered column transfer"

  set_external_window_minimized "$first_title" false || \
    fail "KWin could not restore the transferred passive $protocol stack member"
  wait_for_state_and_geometries \
    "$first_id" minimized false \
    "$destination_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the passive $protocol member in its transferred logical slot: $(describe_layout "$destination_title" "$first_title" "$second_title" "$third_title")"
  activate_window "$second_title" || \
    fail "KWin could not restore active $protocol focus after the minimized numbered transfer"
  wait_for_active "$second_title" || \
    fail "KWin did not restore active $protocol focus after the minimized numbered transfer"

  invoke_shortcut "driftile_move_column_to_desktop_2" || \
    fail "KGlobalAccel could not invoke the same-target numbered $protocol transfer"
  wait_for_geometries \
    "$destination_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol layout for the same-target numbered transfer: $(describe_layout "$destination_title" "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus for the same-target numbered transfer"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not return the $protocol column to numbered desktop 1"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the returning $protocol column to desktop 1"
  wait_for_geometries \
    "$third_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" || \
    fail "Driftile did not preserve the returning numbered $protocol column: $(describe_layout "$third_title" "$first_title" "$second_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus while returning to desktop 1"
  invoke_shortcut "driftile_move_column_left" || \
    fail "KGlobalAccel could not restore the $protocol order after numbered transfer"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol order after numbered transfer: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_move_column_to_desktop_9" || \
    fail "KGlobalAccel could not move the $protocol column to the shared tail"
  wait_for_current_desktop "$first_trailing_desktop_id" || \
    fail "Driftile did not clamp the high numbered $protocol transfer to the shared tail"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not preserve the $protocol column on the shared tail: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_window_desktop "$first_title" "$first_trailing_desktop_id" || \
    fail "KWin did not move the upper $protocol stack member to the shared tail"
  wait_for_window_desktop "$second_title" "$first_trailing_desktop_id" || \
    fail "KWin did not move the lower $protocol stack member to the shared tail"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus on the shared tail"
  wait_for_appended_desktop \
    second_trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not append exactly one empty tail after the numbered $protocol transfer"
  [[ "$second_trailing_desktop_id" != "$first_trailing_desktop_id" ]] || \
    fail "Driftile reused the occupied numbered $protocol desktop as its empty tail"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not return the $protocol column from the shared tail"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the $protocol column back from the shared tail"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "KWin did not return the upper $protocol stack member from the shared tail"
  wait_for_window_desktop "$second_title" "$primary_desktop_id" || \
    fail "KWin did not return the lower $protocol stack member from the shared tail"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$first_trailing_desktop_id" || \
    fail "Driftile did not remove the single redundant $protocol tail it created"
  wait_for_geometries \
    "$third_title" "16,16,616,688" \
    "$first_title" "648,16,616,336" \
    "$second_title" "648,368,616,336" || \
    fail "Driftile did not preserve the numbered $protocol column after leaving the tail: $(describe_layout "$third_title" "$first_title" "$second_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus while leaving the shared tail"
  invoke_shortcut "driftile_move_column_left" || \
    fail "KGlobalAccel could not restore the $protocol column after tail coverage"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the $protocol layout after numbered tail coverage: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after numbered tail coverage"
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
  local first_id
  local first_trailing_desktop_id=""
  local first_transfer_baseline
  local retained_source_frame
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

  local desktop_reorder_action
  local desktop_reorder_index
  local -a desktop_reorder_actions=(
    "driftile_move_desktop_down"
    "driftile_move_desktop_up_page_up"
    "driftile_move_desktop_down_page_down"
    "driftile_move_desktop_up"
  )
  local -a desktop_reorder_first_ids=(
    "$secondary_desktop_id"
    "$primary_desktop_id"
    "$secondary_desktop_id"
    "$primary_desktop_id"
  )
  local -a desktop_reorder_second_ids=(
    "$primary_desktop_id"
    "$secondary_desktop_id"
    "$primary_desktop_id"
    "$secondary_desktop_id"
  )

  if [[ "$desktop_reorder_supported" != true ]]; then
    desktop_reorder_first_ids=(
      "$primary_desktop_id"
      "$primary_desktop_id"
      "$primary_desktop_id"
      "$primary_desktop_id"
    )
    desktop_reorder_second_ids=(
      "$secondary_desktop_id"
      "$secondary_desktop_id"
      "$secondary_desktop_id"
      "$secondary_desktop_id"
    )
  fi

  for desktop_reorder_action in "${desktop_reorder_actions[@]}"; do
    wait_for_shortcut "$desktop_reorder_action" || \
      fail "KGlobalAccel did not register $desktop_reorder_action"
  done

  for desktop_reorder_index in "${!desktop_reorder_actions[@]}"; do
    desktop_reorder_action=${desktop_reorder_actions[desktop_reorder_index]}
    invoke_shortcut "$desktop_reorder_action" || \
      fail "KGlobalAccel could not invoke $desktop_reorder_action for $protocol desktop reordering"
    wait_for_desktop_sequence \
      "${desktop_reorder_first_ids[desktop_reorder_index]}" \
      "${desktop_reorder_second_ids[desktop_reorder_index]}" \
      "$first_trailing_desktop_id" || \
      fail "Driftile did not preserve the expected $protocol desktop order after $desktop_reorder_action"
    wait_for_current_desktop "$primary_desktop_id" || \
      fail "Driftile changed the current $protocol desktop after $desktop_reorder_action"
    wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
      fail "Driftile moved the upper $protocol stack member after $desktop_reorder_action"
    wait_for_window_desktop "$second_title" "$primary_desktop_id" || \
      fail "Driftile moved the lower $protocol stack member after $desktop_reorder_action"
    wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
      fail "Driftile moved the separate $protocol source column after $desktop_reorder_action"
    wait_for_window_desktop "$destination_title" "$secondary_desktop_id" || \
      fail "Driftile moved the $protocol destination seed after $desktop_reorder_action"
    wait_for_active "$second_title" || \
      fail "Driftile changed $protocol focus after $desktop_reorder_action"
    wait_for_geometries \
      "$first_title" "16,16,616,336" \
      "$second_title" "16,368,616,336" \
      "$third_title" "648,16,616,688" \
      "$destination_title" "16,16,616,688" || \
      fail "Driftile changed $protocol geometry after $desktop_reorder_action: $(describe_layout "$first_title" "$second_title" "$third_title" "$destination_title")"
  done

  verify_manual_floating_desktop_transfer \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title" \
    "$destination_title" \
    "$first_trailing_desktop_id"

  verify_numbered_desktop_actions \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title" \
    "$destination_title" \
    "$first_trailing_desktop_id"

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

  first_id=$(window_id "$first_title") || \
    fail "KWin did not expose the retained $protocol desktop-transfer peer"
  set_external_window_minimized "$first_title" true || \
    fail "KWin could not minimize the retained $protocol desktop-transfer peer"
  wait_for_state_and_geometries \
    "$first_id" minimized true \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol source stack while minimizing its retained desktop-transfer peer: $(describe_layout "$first_title" "$second_title" "$third_title")"
  retained_source_frame=$(capture_stable_geometry "$first_title") || \
    fail "the retained $protocol desktop-transfer peer frame did not stabilize"
  activate_window "$second_title" || \
    fail "KWin could not refocus the visible $protocol desktop-transfer member"
  wait_for_active "$second_title" || \
    fail "KWin did not refocus the visible $protocol desktop-transfer member"

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
    fail "Driftile moved the retained $protocol source stack member"
  wait_for_window_desktop "$third_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated $protocol source column"
  wait_for_state_and_geometries \
    "$first_id" minimized true \
    "$first_title" "$retained_source_frame" \
    "$destination_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" || \
    fail "Driftile wrote or moved the retained $protocol desktop-transfer peer: $(describe_layout "$first_title" "$destination_title" "$second_title")"

  set_current_desktop "$primary_desktop_id" || \
    fail "KWin could not reveal the retained $protocol desktop-transfer peer"
  set_external_window_minimized "$first_title" false || \
    fail "KWin could not restore the retained $protocol desktop-transfer peer"
  wait_for_state_and_geometries \
    "$first_id" minimized false \
    "$first_title" "16,16,616,688" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the retained $protocol peer in its source singleton: $(describe_layout "$first_title" "$third_title")"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "KWin restored the retained $protocol peer on the wrong desktop"
  activate_window "$first_title" || \
    fail "KWin could not make the retained $protocol source column active"
  wait_for_active "$first_title" || \
    fail "KWin did not make the retained $protocol source column active"
  set_current_desktop "$secondary_desktop_id" || \
    fail "KWin could not return to the transferred $protocol window"
  activate_window "$second_title" || \
    fail "KWin could not refocus the transferred $protocol window"
  wait_for_active "$second_title" || \
    fail "KWin did not refocus the transferred $protocol window"
  wait_for_geometries \
    "$destination_title" "16,16,616,688" \
    "$second_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol destination after restoring the retained source peer: $(describe_layout "$destination_title" "$second_title")"

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

verify_multi_output_desktop_reorder() {
  local protocol=$1
  local left_first_title=$2
  local left_second_title=$3
  local right_first_title=$4
  local right_second_title=$5
  local left_destination_title=$6
  local right_destination_title=$7
  local trailing_desktop_id=$8
  local first_order=up
  local first_sequence=(
    "$primary_desktop_id"
    "$secondary_desktop_id"
    "$trailing_desktop_id"
  )

  if [[ "$desktop_reorder_supported" == true ]]; then
    first_order=down
    first_sequence=(
      "$secondary_desktop_id"
      "$primary_desktop_id"
      "$trailing_desktop_id"
    )
  fi

  activate_window "$right_second_title" || \
    fail "KWin could not select the right $protocol output for desktop reorder coverage"
  invoke_shortcut "driftile_focus_desktop_2" || \
    fail "KGlobalAccel could not select the right $protocol destination before desktop reordering"
  wait_for_active "$right_destination_title" || \
    fail "KWin did not restore the right $protocol destination before desktop reordering"
  activate_window "$left_second_title" || \
    fail "KWin could not restore the active left $protocol output before desktop reordering"
  wait_for_active "$left_second_title" || \
    fail "KWin did not focus the left $protocol source before desktop reordering"

  invoke_shortcut "driftile_move_desktop_down" || \
    fail "KGlobalAccel could not invoke multi-output $protocol desktop reorder down"
  wait_for_desktop_sequence "${first_sequence[@]}" || \
    fail "Driftile did not produce the expected multi-output $protocol desktop order after reorder down"
  wait_for_window_desktop "$left_first_title" "$primary_desktop_id" || \
    fail "Driftile changed the first left $protocol membership during desktop reordering"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "Driftile changed the second left $protocol membership during desktop reordering"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile changed the first right $protocol membership during desktop reordering"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile changed the second right $protocol membership during desktop reordering"
  wait_for_window_desktop "$left_destination_title" "$secondary_desktop_id" || \
    fail "Driftile changed the left $protocol destination membership during desktop reordering"
  wait_for_window_desktop "$right_destination_title" "$secondary_desktop_id" || \
    fail "Driftile changed the right $protocol destination membership during desktop reordering"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile changed multi-output $protocol geometry during desktop reorder down: $(describe_layout "$left_first_title" "$left_second_title" "$left_destination_title" "$right_first_title" "$right_second_title" "$right_destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed left $protocol focus during desktop reorder down"
  verify_multi_output_desktop_reorder_state \
    "$left_second_title" \
    "$first_order" || \
    fail "KWin did not preserve both $protocol output selections after desktop reorder down"

  invoke_shortcut "driftile_move_desktop_up" || \
    fail "KGlobalAccel could not invoke multi-output $protocol desktop reorder up"
  wait_for_desktop_sequence \
    "$primary_desktop_id" \
    "$secondary_desktop_id" \
    "$trailing_desktop_id" || \
    fail "Driftile did not restore the multi-output $protocol desktop order"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile changed multi-output $protocol geometry during desktop reorder up: $(describe_layout "$left_first_title" "$left_second_title" "$left_destination_title" "$right_first_title" "$right_second_title" "$right_destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed left $protocol focus during desktop reorder up"
  verify_multi_output_desktop_reorder_state "$left_second_title" up || \
    fail "KWin did not preserve both $protocol output selections after desktop reorder up"

  activate_window "$right_destination_title" || \
    fail "KWin could not select the right $protocol destination after desktop reordering"
  invoke_shortcut "driftile_focus_desktop_1" || \
    fail "KGlobalAccel could not restore the right $protocol source after desktop reordering"
  wait_for_active "$right_second_title" || \
    fail "KWin did not restore right $protocol focus after desktop reordering"
  activate_window "$left_second_title" || \
    fail "KWin could not restore left $protocol focus after desktop reordering"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the multi-output $protocol source contexts after desktop reordering: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore left $protocol focus after desktop reorder cleanup"
}

verify_multi_output_desktop_transfer() {
  local protocol=$1
  local left_first_title=$2
  local left_second_title=$3
  local right_first_title=$4
  local right_second_title=$5
  local left_destination_title="driftile-multi-output-${protocol}-left-desktop-destination"
  local right_destination_title="driftile-multi-output-${protocol}-right-desktop-destination"
  local floating_frame
  local first_trailing_desktop_id=""
  local left_destination_pid
  local right_destination_pid

  wait_for_shortcut "driftile_move_window_to_previous_desktop" || \
    fail "KGlobalAccel did not register the multi-output previous-desktop shortcut"
  wait_for_shortcut "driftile_move_window_to_next_desktop" || \
    fail "KGlobalAccel did not register the multi-output next-desktop shortcut"
  numbered_desktop_shortcuts_are_registered || \
    fail "KGlobalAccel did not register all multi-output numbered desktop actions"

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
  wait_for_appended_desktop \
    first_trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" || \
    fail "Driftile did not append the multi-output $protocol empty tail"

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

  verify_multi_output_desktop_reorder \
    "$protocol" \
    "$left_first_title" \
    "$left_second_title" \
    "$right_first_title" \
    "$right_second_title" \
    "$left_destination_title" \
    "$right_destination_title" \
    "$first_trailing_desktop_id"

  invoke_shortcut "driftile_focus_desktop_2" || \
    fail "KGlobalAccel could not focus numbered desktop 2 on the left $protocol output"
  wait_for_active "$left_destination_title" || \
    fail "KWin did not restore left $protocol focus on numbered desktop 2"
  wait_for_geometries \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not isolate numbered $protocol desktop focus: $(describe_layout "$left_destination_title" "$right_first_title" "$right_second_title")"
  verify_multi_output_desktop_state "$left_destination_title" secondary || \
    fail "KWin did not expose isolated numbered $protocol desktop-2 focus"

  invoke_shortcut "driftile_focus_desktop_1" || \
    fail "KGlobalAccel could not restore numbered desktop 1 on the left $protocol output"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore left $protocol focus on numbered desktop 1"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore isolated numbered $protocol desktop focus: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"

  invoke_shortcut "driftile_move_column_to_desktop_2" || \
    fail "KGlobalAccel could not move the left $protocol stack to numbered desktop 2"
  wait_for_geometries \
    "$left_destination_title" "16,16,616,688" \
    "$left_first_title" "648,16,616,336" \
    "$left_second_title" "648,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not isolate the numbered multi-output $protocol column transfer: $(describe_layout "$left_destination_title" "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_window_desktop "$left_first_title" "$secondary_desktop_id" || \
    fail "KWin did not move the upper left $protocol member to numbered desktop 2"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "KWin did not move the lower left $protocol member to numbered desktop 2"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile moved an unrelated right-output $protocol window during numbered transfer"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile moved another right-output $protocol window during numbered transfer"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus during numbered multi-output transfer"
  window_is_on_output_side "$left_second_title" left || \
    fail "Driftile moved the numbered $protocol column away from its left output"
  activate_window "$left_first_title" || \
    fail "KWin could not prepare the unique numbered $protocol outbound state probe"
  wait_for_active "$left_first_title" || \
    fail "KWin did not focus the unique numbered $protocol outbound state probe"
  verify_multi_output_desktop_state "$left_first_title" secondary || \
    fail "KWin did not expose the numbered multi-output $protocol transfer state"
  activate_window "$left_second_title" || \
    fail "KWin could not restore $protocol focus after the numbered outbound state probe"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore $protocol focus after the numbered outbound state probe"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not return the left $protocol stack to numbered desktop 1"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the numbered multi-output $protocol column: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_window_desktop "$left_first_title" "$primary_desktop_id" || \
    fail "KWin did not return the upper left $protocol member to numbered desktop 1"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "KWin did not return the lower left $protocol member to numbered desktop 1"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while restoring numbered desktop 1"
  window_is_on_output_side "$left_second_title" left || \
    fail "Driftile returned the numbered $protocol column to the wrong output"
  activate_window "$left_first_title" || \
    fail "KWin could not prepare the unique numbered $protocol return state probe"
  wait_for_active "$left_first_title" || \
    fail "KWin did not focus the unique numbered $protocol return state probe"
  verify_multi_output_desktop_state "$left_first_title" primary || \
    fail "KWin did not restore the numbered multi-output $protocol source state"
  activate_window "$left_second_title" || \
    fail "KWin could not restore $protocol focus after the numbered return state probe"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore $protocol focus after the numbered return state probe"

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

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not prepare the isolated manual $protocol floating transfer"
  floating_frame=$(capture_stable_geometry "$left_second_title") || \
    fail "the isolated manual $protocol floating frame did not stabilize"
  wait_for_geometries \
    "$left_first_title" "16,16,616,688" \
    "$left_second_title" "$floating_frame" \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile did not isolate the manual multi-output $protocol floating baseline: $(describe_layout "$left_first_title" "$left_second_title" "$left_destination_title" "$right_first_title" "$right_second_title" "$right_destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while preparing the isolated floating transfer"

  invoke_shortcut "driftile_move_column_to_next_desktop" || \
    fail "KGlobalAccel could not move the isolated manual $protocol floating window"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "KWin did not move the isolated manual $protocol floating window"
  wait_for_window_desktop "$left_first_title" "$primary_desktop_id" || \
    fail "Driftile moved a tiled left-output $protocol sibling with the floating window"
  wait_for_window_desktop "$right_first_title" "$primary_desktop_id" || \
    fail "Driftile changed an unrelated right-output $protocol window desktop"
  wait_for_window_desktop "$right_second_title" "$primary_desktop_id" || \
    fail "Driftile changed another right-output $protocol window desktop"
  window_is_on_output_side "$left_second_title" left || \
    fail "Driftile moved the manual $protocol floating window to another output"
  wait_for_geometries \
    "$left_first_title" "16,16,616,688" \
    "$left_second_title" "$floating_frame" \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile disturbed another output or tiled geometry during manual $protocol floating transfer: $(describe_layout "$left_first_title" "$left_second_title" "$left_destination_title" "$right_first_title" "$right_second_title" "$right_destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus during isolated manual floating transfer"

  invoke_shortcut "driftile_move_column_to_previous_desktop" || \
    fail "KGlobalAccel could not return the isolated manual $protocol floating window"
  wait_for_window_desktop "$left_second_title" "$primary_desktop_id" || \
    fail "KWin did not return the isolated manual $protocol floating window"
  wait_for_geometries \
    "$left_first_title" "16,16,616,688" \
    "$left_second_title" "$floating_frame" \
    "$left_destination_title" "16,16,616,688" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" \
    "$right_destination_title" "1296,16,616,688" || \
    fail "Driftile changed isolated $protocol geometry while returning the floating window: $(describe_layout "$left_first_title" "$left_second_title" "$left_destination_title" "$right_first_title" "$right_second_title" "$right_destination_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while returning the isolated floating window"
  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the isolated transferred $protocol window"
  wait_for_geometries \
    "$left_first_title" "16,16,616,336" \
    "$left_second_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore isolated $protocol tiling after floating transfer: $(describe_layout "$left_first_title" "$left_second_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while restoring isolated tiling"

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
  local left_first_id
  local minimized_transfer_frame
  local retained_source_frame

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
  left_first_id=$(window_id "$left_first_title") || \
    fail "KWin did not expose the passive left $protocol stack member before output transfer"
  set_external_window_minimized "$left_first_title" true || \
    fail "KWin could not minimize the passive left $protocol stack member before output transfer"
  wait_for_state_and_geometries \
    "$left_first_id" minimized true \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the source layout while settling the minimized $protocol output-transfer member: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  activate_window "$left_second_title" || \
    fail "KWin could not restore active $protocol output-transfer focus after minimizing its passive member"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore active $protocol output-transfer focus after minimizing its passive member"

  invoke_shortcut "driftile_move_column_to_output_right" || \
    fail "KGlobalAccel could not invoke the default $protocol output transfer"
  wait_for_state_and_geometries \
    "$left_first_id" minimized true \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,368,490,336" || \
    fail "Driftile did not transfer the stacked $protocol column past its minimized member: $(describe_layout "$destination_title" "$left_first_title" "$left_second_title")"
  minimized_transfer_frame=$(capture_stable_geometry "$left_first_title") || \
    fail "the transferred minimized $protocol member did not keep a stable KWin frame"
  wait_for_geometries \
    "$left_first_title" "$minimized_transfer_frame" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,368,490,336" || \
    fail "Driftile wrote the hidden $protocol output-transfer member after the mechanism settled: $(describe_layout "$destination_title" "$left_first_title" "$left_second_title")"
  wait_for_window_desktop "$left_first_title" "$secondary_desktop_id" || \
    fail "Driftile did not adopt the target desktop for the upper $protocol stack member"
  wait_for_window_desktop "$left_second_title" "$secondary_desktop_id" || \
    fail "Driftile did not adopt the target desktop for the lower $protocol stack member"
  window_is_on_output_side "$left_second_title" right || \
    fail "KWin did not move the lower $protocol stack member to the right output"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus during the whole-column output transfer"

  set_external_window_minimized "$left_first_title" false || \
    fail "KWin could not restore the transferred passive $protocol output member"
  wait_for_state_and_geometries \
    "$left_first_id" minimized false \
    "$destination_title" "1296,16,616,688" \
    "$left_first_title" "1928,16,490,336" \
    "$left_second_title" "1928,368,490,336" || \
    fail "Driftile did not restore the passive $protocol member in its target-output logical slot: $(describe_layout "$destination_title" "$left_first_title" "$left_second_title")"
  window_is_on_output_side "$left_first_title" right || \
    fail "KWin did not retain the restored upper $protocol stack member on the right output"
  activate_window "$left_second_title" || \
    fail "KWin could not restore active $protocol focus after the minimized output transfer"
  wait_for_active "$left_second_title" || \
    fail "KWin did not restore active $protocol focus after the minimized output transfer"

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

  set_external_window_minimized "$left_first_title" true || \
    fail "KWin could not minimize the retained left $protocol output-transfer peer"
  wait_for_state_and_geometries \
    "$left_first_id" minimized true \
    "$left_first_title" "16,16,490,336" \
    "$left_second_title" "16,368,490,336" \
    "$destination_title" "1296,16,616,688" || \
    fail "Driftile changed the left $protocol stack while minimizing its retained output-transfer peer: $(describe_layout "$left_first_title" "$left_second_title" "$destination_title")"
  retained_source_frame=$(capture_stable_geometry "$left_first_title") || \
    fail "the retained left $protocol output-transfer peer frame did not stabilize"
  activate_window "$left_second_title" || \
    fail "KWin could not refocus the visible left $protocol output-transfer member"
  wait_for_active "$left_second_title" || \
    fail "KWin did not refocus the visible left $protocol output-transfer member"

  invoke_shortcut "driftile_move_window_to_output_right" || \
    fail "KGlobalAccel could not transfer the $protocol window to the right output"
  wait_for_geometries \
    "$left_first_title" "$retained_source_frame" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,16,490,688" || \
    fail "Driftile did not preserve source order, target order, and width during the right-output transfer: $(describe_layout "$left_first_title" "$destination_title" "$left_second_title")"
  window_is_on_output_side "$left_first_title" left || \
    fail "Driftile moved the retained left-output $protocol peer"
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
  wait_for_window_desktop "$left_first_title" "$primary_desktop_id" || \
    fail "Driftile moved the retained left-output $protocol peer off its desktop"
  wait_for_state_and_geometries \
    "$left_first_id" minimized true \
    "$left_first_title" "$retained_source_frame" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,16,490,688" || \
    fail "Driftile wrote the retained left-output $protocol peer: $(describe_layout "$left_first_title" "$destination_title" "$left_second_title")"
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

  set_external_window_minimized "$left_first_title" false || \
    fail "KWin could not restore the retained left $protocol output-transfer peer"
  wait_for_state_and_geometries \
    "$left_first_id" minimized false \
    "$left_first_title" "16,16,490,688" \
    "$destination_title" "1296,16,616,688" \
    "$left_second_title" "1928,16,490,688" || \
    fail "Driftile did not restore the retained left $protocol peer in its source singleton: $(describe_layout "$left_first_title" "$destination_title" "$left_second_title")"
  wait_for_active "$left_second_title" || \
    fail "Driftile changed $protocol focus while restoring the retained source peer"

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

verify_relation_free_automatic_desktop_transfer() {
  local protocol=$1
  local active_title=$2
  local active_frame=$3
  local before_state
  local trailing_desktop_id=""
  local index
  local -a geometry_pairs
  local -a window_titles=()

  shift 3
  geometry_pairs=("$@")

  for ((index = 0; index < ${#geometry_pairs[@]}; index += 2)); do
    window_titles+=("${geometry_pairs[index]}")
  done

  before_state=$(window_desktop_transfer_state "$active_title") || \
    fail "KWin did not expose the relation-free $protocol transfer state"

  invoke_shortcut "driftile_move_column_to_next_desktop" || \
    fail "KGlobalAccel could not transfer the relation-free $protocol window"
  if ! wait_for_window_desktop "$active_title" "$secondary_desktop_id"; then
    fail "KWin did not move the relation-free $protocol window to the next desktop: before=$before_state after=$(window_desktop_transfer_state "$active_title" 2>/dev/null || printf unavailable) current=$(current_desktop_id 2>/dev/null || printf unavailable)"
  fi
  wait_for_current_desktop "$secondary_desktop_id" || \
    fail "Driftile did not follow the relation-free $protocol window"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the tiled $protocol layout or automatic floating frame during transfer: $(describe_layout "${window_titles[@]}")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus during the relation-free transfer"
  wait_for_appended_desktop \
    trailing_desktop_id \
    "$primary_desktop_id" \
    "$secondary_desktop_id" || \
    fail "Driftile did not replenish the shared tail after the relation-free $protocol transfer"
  [[ "$trailing_desktop_id" != "$secondary_desktop_id" ]] || \
    fail "Driftile reused the occupied relation-free $protocol desktop as its tail"

  invoke_shortcut "driftile_move_column_to_desktop_1" || \
    fail "KGlobalAccel could not return the relation-free $protocol window"
  wait_for_current_desktop "$primary_desktop_id" || \
    fail "Driftile did not follow the returning relation-free $protocol window"
  wait_for_window_desktop "$active_title" "$primary_desktop_id" || \
    fail "KWin did not return the relation-free $protocol window to desktop 1"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the tiled $protocol layout or automatic floating frame while returning: $(describe_layout "${window_titles[@]}")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus while returning the relation-free window"
  wait_for_desktop_sequence "$primary_desktop_id" "$secondary_desktop_id" || \
    fail "Driftile did not remove the redundant relation-free $protocol tail"
  [[ "$(capture_stable_geometry "$active_title")" == "$active_frame" ]] || \
    fail "Driftile changed the exact relation-free $protocol floating frame"
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

verify_focus_layer_roundtrip() {
  local protocol=$1
  local floating_title=$2
  local tiled_title=$3
  local index
  local -a geometry_pairs
  local -a window_titles=()

  shift 3
  geometry_pairs=("$@")

  for ((index = 0; index < ${#geometry_pairs[@]}; index += 2)); do
    window_titles+=("${geometry_pairs[index]}")
  done

  activate_window "$tiled_title" || \
    fail "KWin could not focus the tiled $protocol window before the layer roundtrip"
  wait_for_active "$tiled_title" || \
    fail "KWin did not focus the tiled $protocol window before the layer roundtrip"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "the $protocol layout changed before the layer roundtrip: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_switch_focus_between_floating_and_tiling" || \
    fail "KGlobalAccel could not focus the floating $protocol layer"
  wait_for_active "$floating_title" || \
    fail "Driftile did not restore the last focused floating $protocol window"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout while focusing the floating layer: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_switch_focus_between_floating_and_tiling" || \
    fail "KGlobalAccel could not focus the tiled $protocol layer"
  wait_for_active "$tiled_title" || \
    fail "Driftile did not restore the last focused tiled $protocol window"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout while restoring tiled focus: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_focus_tiling" || \
    fail "KGlobalAccel could not recheck the active tiled $protocol layer"
  wait_for_active "$tiled_title" || \
    fail "Driftile changed focus while rechecking the active tiled $protocol layer"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout while rechecking tiled focus: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_focus_floating" || \
    fail "KGlobalAccel could not directly focus the floating $protocol layer"
  wait_for_active "$floating_title" || \
    fail "Driftile did not directly restore floating $protocol focus"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout during direct floating focus: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_focus_floating" || \
    fail "KGlobalAccel could not recheck the active floating $protocol layer"
  wait_for_active "$floating_title" || \
    fail "Driftile changed focus while rechecking the active floating $protocol layer"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout while rechecking floating focus: $(describe_layout "${window_titles[@]}")"

  invoke_shortcut "driftile_focus_tiling" || \
    fail "KGlobalAccel could not directly focus the tiled $protocol layer"
  wait_for_active "$tiled_title" || \
    fail "Driftile did not directly restore tiled $protocol focus"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed the $protocol layout during direct tiled focus: $(describe_layout "${window_titles[@]}")"
}

verify_floating_navigation_step() {
  local protocol=$1
  local shortcut=$2
  local expected_title=$3
  local index
  local -a geometry_pairs
  local -a window_titles=()

  shift 3
  geometry_pairs=("$@")

  for ((index = 0; index < ${#geometry_pairs[@]}; index += 2)); do
    window_titles+=("${geometry_pairs[index]}")
  done

  invoke_shortcut "$shortcut" || \
    fail "KGlobalAccel could not invoke $shortcut for floating $protocol navigation"
  wait_for_active "$expected_title" || \
    fail "Driftile did not focus $expected_title after $shortcut: active=$(describe_active_windows "${window_titles[@]}")"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "Driftile changed floating $protocol frames after $shortcut: $(describe_layout "${window_titles[@]}")"
}

verify_manual_floating_navigation() {
  local protocol=$1
  local first_tiled_title=$2
  local active_tiled_title=$3
  local right_tiled_title=$4
  local title
  local -a navigation_pids=()
  local -a navigation_titles=(
    "driftile-floating-navigation-${protocol}-a"
    "driftile-floating-navigation-${protocol}-b"
    "driftile-floating-navigation-${protocol}-c"
  )
  local -a geometry_pairs=(
    "${navigation_titles[0]}" "80,80,360,240"
    "${navigation_titles[1]}" "460,240,360,240"
    "${navigation_titles[2]}" "840,440,360,240"
  )
  local -a shortcuts=(
    "driftile_focus_column_left"
    "driftile_focus_column_right"
    "driftile_focus_window_up"
    "driftile_focus_window_down"
    "driftile_focus_column_first"
    "driftile_focus_column_last"
  )

  for title in "${shortcuts[@]}"; do
    wait_for_shortcut "$title" || \
      fail "KGlobalAccel did not register $title for floating navigation"
  done

  for title in "${navigation_titles[@]}"; do
    start_client "$protocol" "$title" true
    navigation_pids+=("${client_pids[${#client_pids[@]}-1]}")
    capture_stable_geometry "$title" >/dev/null || \
      fail "the floating-navigation $protocol window $title did not stabilize"
    activate_window "$title" || \
      fail "KWin could not focus $title before floating navigation setup"
    wait_for_active "$title" || \
      fail "KWin did not focus $title before floating navigation setup"
    invoke_shortcut "driftile_toggle_floating" || \
      fail "KGlobalAccel could not float $title for navigation acceptance"
    wait_for_active "$title" || \
      fail "Driftile changed focus while floating $title for navigation acceptance"
    capture_stable_geometry "$title" >/dev/null || \
      fail "the floating-navigation $protocol window $title did not settle after detaching"
  done

  activate_window "$active_tiled_title" || \
    fail "KWin could not focus a tiled $protocol window before floating-navigation readiness"
  wait_for_active "$active_tiled_title" || \
    fail "KWin did not focus a tiled $protocol window before floating-navigation readiness"
  wait_for_shortcut_focus \
    "driftile_focus_floating" "${navigation_titles[2]}" || \
    fail "the last floating-navigation $protocol window did not become focus-ready"

  arrange_floating_navigation_windows || \
    fail "KWin could not arrange the $protocol floating-navigation windows"
  wait_for_geometries "${geometry_pairs[@]}" || \
    fail "KWin did not place the $protocol floating-navigation windows: $(describe_layout "${navigation_titles[@]}")"
  activate_window "$active_tiled_title" || \
    fail "KWin could not recheck tiled focus after arranging floating $protocol windows"
  wait_for_active "$active_tiled_title" || \
    fail "KWin did not recheck tiled focus after arranging floating $protocol windows"
  wait_for_shortcut_focus \
    "driftile_focus_floating" "${navigation_titles[2]}" || \
    fail "the arranged floating-navigation $protocol windows did not become focus-ready"
  activate_window "${navigation_titles[1]}" || \
    fail "KWin could not focus the center $protocol floating window"
  wait_for_active "${navigation_titles[1]}" || \
    fail "KWin did not focus the center $protocol floating window"

  verify_floating_navigation_step \
    "$protocol" "driftile_focus_column_left" "${navigation_titles[0]}" \
    "${geometry_pairs[@]}"
  verify_floating_navigation_step \
    "$protocol" "driftile_focus_column_right" "${navigation_titles[1]}" \
    "${geometry_pairs[@]}"
  verify_floating_navigation_step \
    "$protocol" "driftile_focus_window_up" "${navigation_titles[0]}" \
    "${geometry_pairs[@]}"
  verify_floating_navigation_step \
    "$protocol" "driftile_focus_window_down" "${navigation_titles[1]}" \
    "${geometry_pairs[@]}"
  verify_floating_navigation_step \
    "$protocol" "driftile_focus_column_first" "${navigation_titles[0]}" \
    "${geometry_pairs[@]}"
  verify_floating_navigation_step \
    "$protocol" "driftile_focus_column_last" "${navigation_titles[2]}" \
    "${geometry_pairs[@]}"

  for title in "${navigation_pids[@]}"; do
    stop_client "$title"
  done

  for title in "${navigation_titles[@]}"; do
    wait_for_window_gone "$title" || \
      fail "the floating-navigation $protocol window $title did not close"
  done

  activate_window "$active_tiled_title" || \
    fail "KWin could not restore tiled $protocol focus after floating navigation"
  wait_for_active "$active_tiled_title" || \
    fail "KWin did not restore tiled $protocol focus after floating navigation"
  wait_for_geometries \
    "$first_tiled_title" "16,16,616,336" \
    "$active_tiled_title" "16,368,616,336" \
    "$right_tiled_title" "648,16,616,688" || \
    fail "Driftile changed the tiled $protocol layout during floating navigation: $(describe_layout "$first_tiled_title" "$active_tiled_title" "$right_tiled_title")"
}

verify_isolated_floating_navigation() {
  local protocol=$1
  local active_title=$2
  local shortcut
  local -a geometry_pairs

  shift 2
  geometry_pairs=("$@")

  for shortcut in \
    driftile_focus_column_left \
    driftile_focus_column_right \
    driftile_focus_window_up \
    driftile_focus_window_down \
    driftile_focus_column_first \
    driftile_focus_column_last; do
    wait_for_shortcut "$shortcut" || \
      fail "KGlobalAccel did not register $shortcut for isolated floating navigation"
    verify_floating_navigation_step \
      "$protocol" "$shortcut" "$active_title" "${geometry_pairs[@]}"
  done
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
  local -a automatic_no_op_shortcuts=(
    "driftile_focus_column_left"
    "driftile_focus_column_right"
    "driftile_focus_column_first"
    "driftile_focus_column_last"
    "driftile_focus_window_up"
    "driftile_focus_window_down"
    "driftile_move_window_left"
    "driftile_toggle_floating"
    "driftile_move_column_to_output_right"
    "driftile_expand_column_to_available_width"
    "driftile_center_visible_columns"
  )
  local -a dialog_no_op_shortcuts=(
    "${automatic_no_op_shortcuts[@]}"
    "driftile_move_column_to_next_desktop"
    "driftile_move_column_to_desktop_2"
    "driftile_move_column_to_desktop_9"
  )

  for shortcut in "${dialog_no_op_shortcuts[@]}"; do
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

  for shortcut in "${dialog_no_op_shortcuts[@]}"; do
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

  verify_relation_free_automatic_desktop_transfer \
    "$protocol" \
    "$fixed_title" \
    "$fixed_frame" \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" \
    "$fixed_title" "$fixed_frame"
  wait_for_window_border_state "$fixed_title" true || \
    fail "Driftile lost border ownership during relation-free $protocol transfer"
  window_frame_respects_fixed_client "$fixed_title" 360 240 || \
    fail "Driftile changed the fixed $protocol client bounds during desktop transfer"

  for shortcut in "${automatic_no_op_shortcuts[@]}"; do
    verify_automatic_floating_shortcut_no_op \
      "$protocol" \
      "$fixed_title" \
      "$shortcut" \
      "$first_title" "$first_frame" \
      "$second_title" "$second_frame" \
      "$third_title" "$third_frame" \
      "$fixed_title" "$fixed_frame"
  done

  verify_focus_layer_roundtrip \
    "$protocol" \
    "$fixed_title" \
    "$second_title" \
    "$first_title" "$first_frame" \
    "$second_title" "$second_frame" \
    "$third_title" "$third_frame" \
    "$fixed_title" "$fixed_frame"

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

verify_advanced_column_view() {
  local protocol=$1
  local first_title=$2
  local active_title=$3
  local right_title=$4
  local canonical_first
  local canonical_active
  local canonical_right
  local compact_first
  local compact_active
  local compact_right
  local expanded_first
  local expanded_active
  local expanded_right
  local center_before_first
  local center_before_active
  local center_before_right
  local centered_first
  local centered_active
  local centered_right
  local gap
  local work_area

  wait_for_active "$active_title" || \
    fail "KWin did not preserve $protocol focus before advanced column-view acceptance"
  canonical_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol column did not stabilize before advanced column-view acceptance"
  canonical_active=$(capture_stable_geometry "$active_title") || \
    fail "the active $protocol column did not stabilize before advanced column-view acceptance"
  canonical_right=$(capture_stable_geometry "$right_title") || \
    fail "the right $protocol column did not stabilize before advanced column-view acceptance"
  wait_for_geometries \
    "$first_title" "$canonical_first" \
    "$active_title" "$canonical_active" \
    "$right_title" "$canonical_right" || \
    fail "the canonical $protocol layout did not settle before advanced column-view acceptance"
  work_area=$(single_output_work_area "$protocol") || \
    fail "KWin did not expose the single-output $protocol work area"

  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not prepare the $protocol available-width layout"
  compact_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol column did not settle before available-width expansion"
  compact_active=$(capture_stable_geometry "$active_title") || \
    fail "the active $protocol column did not settle before available-width expansion"
  compact_right=$(capture_stable_geometry "$right_title") || \
    fail "the right $protocol column did not settle before available-width expansion"
  wait_for_geometries \
    "$first_title" "$compact_first" \
    "$active_title" "$compact_active" \
    "$right_title" "$compact_right" || \
    fail "the compact $protocol layout did not settle before available-width expansion"
  gap=$(frame_horizontal_gap "$compact_active" "$compact_right") || \
    fail "the $protocol column gap could not be measured"
  jq --exit-status --null-input --argjson gap "$gap" '$gap > 0' >/dev/null || \
    fail "the measured $protocol column gap is not positive: $gap"

  invoke_shortcut "driftile_expand_column_to_available_width" || \
    fail "KGlobalAccel could not invoke the $protocol available-width shortcut"
  expanded_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol column did not settle after available-width expansion"
  expanded_active=$(capture_stable_geometry "$active_title") || \
    fail "the active $protocol column did not settle after available-width expansion"
  expanded_right=$(capture_stable_geometry "$right_title") || \
    fail "the right $protocol column did not settle after available-width expansion"
  wait_for_geometries \
    "$first_title" "$expanded_first" \
    "$active_title" "$expanded_active" \
    "$right_title" "$expanded_right" || \
    fail "the expanded $protocol layout did not settle together"
  expanded_column_geometry_matches \
    "$work_area" "$gap" \
    "$compact_first" "$compact_active" "$compact_right" \
    "$expanded_first" "$expanded_active" "$expanded_right" || \
    fail "the $protocol available-width action did not preserve order, heights, sibling widths, and the usable span: $(describe_layout "$first_title" "$active_title" "$right_title")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus after available-width expansion"

  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not prepare the $protocol visible-column centering layout"
  center_before_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol column did not settle before visible-column centering"
  center_before_active=$(capture_stable_geometry "$active_title") || \
    fail "the active $protocol column did not settle before visible-column centering"
  center_before_right=$(capture_stable_geometry "$right_title") || \
    fail "the right $protocol column did not settle before visible-column centering"
  wait_for_geometries \
    "$first_title" "$center_before_first" \
    "$active_title" "$center_before_active" \
    "$right_title" "$center_before_right" || \
    fail "the uncentered $protocol column group did not settle"

  invoke_shortcut "driftile_center_visible_columns" || \
    fail "KGlobalAccel could not invoke the $protocol visible-columns shortcut"
  centered_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol column did not settle after visible-column centering"
  centered_active=$(capture_stable_geometry "$active_title") || \
    fail "the active $protocol column did not settle after visible-column centering"
  centered_right=$(capture_stable_geometry "$right_title") || \
    fail "the right $protocol column did not settle after visible-column centering"
  wait_for_geometries \
    "$first_title" "$centered_first" \
    "$active_title" "$centered_active" \
    "$right_title" "$centered_right" || \
    fail "the centered $protocol layout did not settle together"
  centered_visible_geometry_matches \
    "$work_area" "$gap" \
    "$center_before_first" "$center_before_active" "$center_before_right" \
    "$centered_first" "$centered_active" "$centered_right" || \
    fail "the $protocol visible-columns action was not a common viewport translation with equal outer margins: $(describe_layout "$first_title" "$active_title" "$right_title")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus after visible-column centering"

  invoke_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel could not restore the canonical $protocol column width"
  capture_stable_geometry "$active_title" >/dev/null || \
    fail "the active $protocol column did not settle while restoring its canonical width"
  activate_window "$right_title" || \
    fail "KWin could not reveal the right $protocol column during canonical restoration"
  capture_stable_geometry "$right_title" >/dev/null || \
    fail "the right $protocol column did not settle during canonical restoration"
  activate_window "$active_title" || \
    fail "KWin could not restore canonical $protocol focus"
  wait_for_active "$active_title" || \
    fail "KWin did not restore canonical $protocol focus"
  wait_for_geometries \
    "$first_title" "$canonical_first" \
    "$active_title" "$canonical_active" \
    "$right_title" "$canonical_right" || \
    fail "Driftile did not restore the canonical $protocol layout after advanced column-view acceptance: $(describe_layout "$first_title" "$active_title" "$right_title")"
}

verify_consume_and_expel_window() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local fourth_title=$5

  wait_for_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel did not register the consume-window-into-column shortcut"
  wait_for_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel did not register the expel-window-from-column shortcut"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not prepare the right $protocol source stack"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,336" \
    "$fourth_title" "32,368,616,336" || \
    fail "Driftile did not prepare the right $protocol source stack: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus while preparing the right source stack"

  activate_window "$second_title" || \
    fail "KWin could not focus the target $protocol column before consuming"
  wait_for_active "$second_title" || \
    fail "KWin did not focus the target $protocol column before consuming"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,336" \
    "$fourth_title" "648,368,616,336" || \
    fail "Driftile did not reveal the target $protocol column before consuming: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"

  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not consume the top $protocol source member"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "16,485,616,219" \
    "$fourth_title" "648,16,616,688" || \
    fail "Driftile did not consume the top $protocol source member at the bottom of the target: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after consuming the top source member"

  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not consume the remaining $protocol source member"
  wait_for_geometries \
    "$first_title" "16,16,616,160" \
    "$second_title" "16,192,616,160" \
    "$third_title" "16,368,616,160" \
    "$fourth_title" "16,544,616,160" || \
    fail "Driftile did not append the remaining $protocol source member in order: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after consuming the remaining source member"

  invoke_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel could not expel the bottom $protocol member"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "16,485,616,219" \
    "$fourth_title" "648,16,616,688" || \
    fail "Driftile did not expel the bottom $protocol member to the right: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after expelling the bottom member"

  invoke_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel could not expel the next bottom $protocol member"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" \
    "$fourth_title" "1280,16,616,688" || \
    fail "Driftile did not preserve $protocol order while expelling the next bottom member: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after restoring the original columns"

  activate_window "$fourth_title" || \
    fail "KWin could not focus the last $protocol column for bounded edits"
  wait_for_active "$fourth_title" || \
    fail "KWin did not focus the last $protocol column for bounded edits"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,688" \
    "$fourth_title" "664,16,616,688" || \
    fail "Driftile did not reveal the last $protocol column before bounded edits: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"

  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not invoke the bounded $protocol consume action"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,688" \
    "$fourth_title" "664,16,616,688" || \
    fail "Driftile changed the $protocol layout while consuming at the right boundary: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus while consuming at the right boundary"

  invoke_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel could not invoke the bounded $protocol expel action"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,688" \
    "$fourth_title" "664,16,616,688" || \
    fail "Driftile changed the $protocol layout while expelling from a singleton: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus while expelling from a singleton"
}

set_external_window_minimized() {
  local title=$1
  local expected=$2
  local id

  id=$(window_id "$title") || return 1

  if ! window_state_matches "$id" minimized "$expected" 2>/dev/null; then
    run_window_action "$title" minimize || return 1
  fi

  wait_for_window_state "$id" minimized "$expected"
}

verify_minimized_slot_navigation() {
  local protocol=$1
  local first_title=$2
  local middle_title=$3
  local last_title=$4
  local middle_column_title=$5
  local edge_title="driftile-minimized-edge-${protocol}"
  local edge_pid
  local baseline_edge
  local baseline_first
  local baseline_last
  local baseline_middle
  local baseline_middle_column
  local boundary_edge
  local boundary_first
  local boundary_last
  local boundary_middle
  local boundary_middle_column
  local before_end_edge
  local before_end_first
  local before_end_last
  local before_end_middle
  local before_end_middle_column
  local restored_edge
  local restored_first
  local restored_last
  local restored_middle
  local restored_middle_column

  start_client "$protocol" "$edge_title" true
  edge_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$edge_title" >/dev/null || \
    fail "the minimized-slot $protocol edge window did not stabilize"
  activate_window "$first_title" || \
    fail "KWin could not focus the first $protocol stack member before minimized-slot navigation"
  wait_for_active "$first_title" || \
    fail "KWin did not focus the first $protocol stack member before minimized-slot navigation"

  baseline_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol minimized-slot baseline did not stabilize"
  baseline_middle=$(capture_stable_geometry "$middle_title") || \
    fail "the middle $protocol minimized-slot baseline did not stabilize"
  baseline_last=$(capture_stable_geometry "$last_title") || \
    fail "the last $protocol minimized-slot baseline did not stabilize"
  baseline_middle_column=$(capture_stable_geometry "$middle_column_title") || \
    fail "the middle-column $protocol minimized-slot baseline did not stabilize"
  baseline_edge=$(capture_stable_geometry "$edge_title") || \
    fail "the edge $protocol minimized-slot baseline did not stabilize"
  wait_for_geometries \
    "$first_title" "$baseline_first" \
    "$middle_title" "$baseline_middle" \
    "$last_title" "$baseline_last" \
    "$middle_column_title" "$baseline_middle_column" \
    "$edge_title" "$baseline_edge" || \
    fail "the $protocol minimized-slot fixture did not stabilize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$middle_column_title" "$edge_title")"

  set_external_window_minimized "$middle_title" true || \
    fail "KWin could not externally minimize the middle $protocol stack member"
  wait_for_geometries \
    "$first_title" "$baseline_first" \
    "$middle_title" "$baseline_middle" \
    "$last_title" "$baseline_last" \
    "$middle_column_title" "$baseline_middle_column" \
    "$edge_title" "$baseline_edge" || \
    fail "Driftile changed the $protocol fixture while minimizing its middle stack member: $(describe_layout "$first_title" "$middle_title" "$last_title" "$middle_column_title" "$edge_title")"
  set_external_window_minimized "$middle_column_title" true || \
    fail "KWin could not externally minimize the middle $protocol singleton column"
  wait_for_geometries \
    "$first_title" "$baseline_first" \
    "$middle_title" "$baseline_middle" \
    "$last_title" "$baseline_last" \
    "$middle_column_title" "$baseline_middle_column" \
    "$edge_title" "$baseline_edge" || \
    fail "Driftile changed the $protocol fixture while minimizing its middle singleton column: $(describe_layout "$first_title" "$middle_title" "$last_title" "$middle_column_title" "$edge_title")"
  activate_window "$first_title" || \
    fail "KWin could not restore $protocol focus before skipping minimized slots"
  wait_for_active "$first_title" || \
    fail "KWin did not restore $protocol focus before skipping minimized slots"

  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus down across the minimized $protocol stack member"
  wait_for_active "$last_title" || \
    fail "Driftile did not skip the minimized middle $protocol stack member"
  boundary_first=$(capture_stable_geometry "$first_title")
  boundary_middle=$(capture_stable_geometry "$middle_title")
  boundary_last=$(capture_stable_geometry "$last_title")
  boundary_middle_column=$(capture_stable_geometry "$middle_column_title")
  boundary_edge=$(capture_stable_geometry "$edge_title")
  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not recheck the lower $protocol focus boundary"
  wait_for_active "$last_title" || \
    fail "Driftile wrapped vertical $protocol focus past the last visible stack member"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the minimized vertical boundary"

  invoke_shortcut "driftile_focus_window_up" || \
    fail "KGlobalAccel could not focus up across the minimized $protocol stack member"
  wait_for_active "$first_title" || \
    fail "Driftile did not skip the minimized middle $protocol stack member while focusing up"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout while focusing up across a minimized slot"
  invoke_shortcut "driftile_focus_window_up" || \
    fail "KGlobalAccel could not recheck the upper $protocol focus boundary"
  wait_for_active "$first_title" || \
    fail "Driftile wrapped vertical $protocol focus past the first visible stack member"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the upper minimized boundary"
  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not restore the lower visible $protocol stack member"
  wait_for_active "$last_title" || \
    fail "Driftile did not restore the lower visible $protocol stack member"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout while restoring lower focus"

  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus right across the minimized $protocol singleton column"
  wait_for_active "$edge_title" || \
    fail "Driftile did not skip the fully minimized middle $protocol column"
  boundary_first=$(capture_stable_geometry "$first_title")
  boundary_middle=$(capture_stable_geometry "$middle_title")
  boundary_last=$(capture_stable_geometry "$last_title")
  boundary_middle_column=$(capture_stable_geometry "$middle_column_title")
  boundary_edge=$(capture_stable_geometry "$edge_title")
  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not recheck the right $protocol focus boundary"
  wait_for_active "$edge_title" || \
    fail "Driftile wrapped horizontal $protocol focus past the last visible column"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the minimized horizontal boundary"

  invoke_shortcut "driftile_focus_column_left" || \
    fail "KGlobalAccel could not focus left across the minimized $protocol singleton column"
  wait_for_active "$first_title" || \
    fail "Driftile did not enter the $protocol stack at its first visible member across the minimized column"
  boundary_first=$(capture_stable_geometry "$first_title")
  boundary_middle=$(capture_stable_geometry "$middle_title")
  boundary_last=$(capture_stable_geometry "$last_title")
  boundary_middle_column=$(capture_stable_geometry "$middle_column_title")
  boundary_edge=$(capture_stable_geometry "$edge_title")
  invoke_shortcut "driftile_focus_column_left" || \
    fail "KGlobalAccel could not recheck the left $protocol focus boundary"
  wait_for_active "$first_title" || \
    fail "Driftile wrapped horizontal $protocol focus past the first visible column"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the left minimized boundary"
  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus down after entering the $protocol stack"
  wait_for_active "$last_title" || \
    fail "Driftile did not skip the minimized middle $protocol stack member after horizontal entry"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout while confirming stack order after horizontal entry"

  set_external_window_minimized "$middle_column_title" false || \
    fail "KWin could not restore the middle $protocol singleton column"
  set_external_window_minimized "$edge_title" true || \
    fail "KWin could not externally minimize the last $protocol singleton column"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$edge_title" "$boundary_edge" || \
    fail "the $protocol fixture did not settle before the minimized End check"
  capture_stable_geometry "$middle_column_title" >/dev/null || \
    fail "the restored middle $protocol column did not settle before the minimized End check"
  activate_window "$last_title" || \
    fail "KWin could not check the restored $protocol column before the minimized End check"
  wait_for_active "$last_title" || \
    fail "KWin did not check the restored $protocol column before the minimized End check"
  wait_for_shortcut_focus \
    "driftile_focus_column_right" "$middle_column_title" || \
    fail "the restored middle $protocol column did not become focus-ready"
  activate_window "$last_title" || \
    fail "KWin could not focus the $protocol stack before the minimized End check"
  wait_for_active "$last_title" || \
    fail "KWin did not focus the $protocol stack before the minimized End check"
  capture_stable_geometry "$last_title" >/dev/null || \
    fail "the $protocol stack did not settle before the minimized End check"
  before_end_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol stack frame did not settle before the minimized End check"
  before_end_middle=$(capture_stable_geometry "$middle_title") || \
    fail "the minimized middle $protocol stack frame did not settle before the minimized End check"
  before_end_last=$(capture_stable_geometry "$last_title") || \
    fail "the last $protocol stack frame did not settle before the minimized End check"
  before_end_middle_column=$(capture_stable_geometry "$middle_column_title") || \
    fail "the target $protocol column frame did not settle before the minimized End check"
  before_end_edge=$(capture_stable_geometry "$edge_title") || \
    fail "the minimized edge $protocol frame did not settle before the minimized End check"
  invoke_shortcut "driftile_focus_column_last" || \
    fail "KGlobalAccel could not focus the last visible $protocol column"
  wait_for_active "$middle_column_title" || \
    fail "Driftile did not skip the minimized last $protocol column for End"
  boundary_first=$(capture_stable_geometry "$first_title")
  boundary_middle=$(capture_stable_geometry "$middle_title")
  boundary_last=$(capture_stable_geometry "$last_title")
  boundary_middle_column=$(capture_stable_geometry "$middle_column_title")
  boundary_edge=$(capture_stable_geometry "$edge_title")
  frames_match_leftward_reveal \
    "$before_end_first" "$boundary_first" \
    "$before_end_last" "$boundary_last" \
    "$before_end_middle_column" "$boundary_middle_column" \
    1280 || \
    fail "Driftile did not reveal the off-screen $protocol End target with one common viewport translation"
  [[ "$boundary_middle" == "$before_end_middle" ]] || \
    fail "Driftile wrote the minimized middle $protocol stack frame during End reveal"
  [[ "$boundary_edge" == "$before_end_edge" ]] || \
    fail "Driftile wrote the minimized edge $protocol frame during End reveal"
  activate_window "$middle_column_title" || \
    fail "KWin could not refocus the effective $protocol End boundary"
  wait_for_active "$middle_column_title" || \
    fail "KWin did not refocus the effective $protocol End boundary"
  invoke_shortcut "driftile_focus_column_last" || \
    fail "KGlobalAccel could not recheck the effective $protocol End boundary"
  wait_for_active "$middle_column_title" || \
    fail "Driftile wrapped End past the last visible $protocol column"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the effective End boundary"

  set_external_window_minimized "$first_title" true || \
    fail "KWin could not minimize the first $protocol stack member"
  set_external_window_minimized "$last_title" true || \
    fail "KWin could not minimize the last $protocol stack member"
  set_external_window_minimized "$edge_title" false || \
    fail "KWin could not restore the last $protocol singleton column"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" || \
    fail "the $protocol fixture did not preserve existing frames before the minimized Home check: $(describe_layout "$first_title" "$middle_title" "$last_title" "$middle_column_title" "$edge_title")"
  capture_stable_geometry "$edge_title" >/dev/null || \
    fail "the restored $protocol edge did not settle before the minimized Home check"
  activate_window "$middle_column_title" || \
    fail "KWin could not check the restored $protocol edge before the minimized Home check"
  wait_for_active "$middle_column_title" || \
    fail "KWin did not check the restored $protocol edge before the minimized Home check"
  wait_for_shortcut_focus "driftile_focus_column_left" "$edge_title" || \
    fail "the restored $protocol edge did not become focus-ready"
  activate_window "$middle_column_title" || \
    fail "KWin could not focus the last $protocol column before the minimized Home check"
  wait_for_active "$middle_column_title" || \
    fail "KWin did not focus the last $protocol column before the minimized Home check"
  capture_stable_geometry "$middle_column_title" >/dev/null || \
    fail "the last $protocol column did not settle before the minimized Home check"
  invoke_shortcut "driftile_focus_column_first" || \
    fail "KGlobalAccel could not focus the first visible $protocol column"
  wait_for_active "$edge_title" || \
    fail "Driftile did not skip the fully minimized first $protocol stack for Home"
  boundary_first=$(capture_stable_geometry "$first_title")
  boundary_middle=$(capture_stable_geometry "$middle_title")
  boundary_last=$(capture_stable_geometry "$last_title")
  boundary_middle_column=$(capture_stable_geometry "$middle_column_title")
  boundary_edge=$(capture_stable_geometry "$edge_title")
  activate_window "$edge_title" || \
    fail "KWin could not refocus the effective $protocol Home boundary"
  wait_for_active "$edge_title" || \
    fail "KWin did not refocus the effective $protocol Home boundary"
  invoke_shortcut "driftile_focus_column_first" || \
    fail "KGlobalAccel could not recheck the effective $protocol Home boundary"
  wait_for_active "$edge_title" || \
    fail "Driftile wrapped Home past the first visible $protocol column: active=$(describe_active_windows "$first_title" "$middle_title" "$last_title" "$middle_column_title" "$edge_title")"
  wait_for_geometries \
    "$first_title" "$boundary_first" \
    "$middle_title" "$boundary_middle" \
    "$last_title" "$boundary_last" \
    "$middle_column_title" "$boundary_middle_column" \
    "$edge_title" "$boundary_edge" || \
    fail "Driftile changed the $protocol layout at the effective Home boundary"

  set_external_window_minimized "$first_title" false || \
    fail "KWin could not restore the first $protocol stack member"
  set_external_window_minimized "$middle_title" false || \
    fail "KWin could not restore the middle $protocol stack member"
  set_external_window_minimized "$last_title" false || \
    fail "KWin could not restore the last $protocol stack member"
  capture_stable_geometry "$first_title" >/dev/null || \
    fail "the restored first $protocol stack member did not settle"
  capture_stable_geometry "$middle_title" >/dev/null || \
    fail "the restored middle $protocol stack member did not settle"
  capture_stable_geometry "$last_title" >/dev/null || \
    fail "the restored last $protocol stack member did not settle"
  activate_window "$first_title" || \
    fail "KWin could not focus the restored first $protocol stack member"
  wait_for_active "$first_title" || \
    fail "KWin did not focus the restored first $protocol stack member"
  restored_first=$(capture_stable_geometry "$first_title") || \
    fail "the restored first $protocol frame did not stabilize"
  restored_middle=$(capture_stable_geometry "$middle_title") || \
    fail "the restored middle $protocol frame did not stabilize"
  restored_last=$(capture_stable_geometry "$last_title") || \
    fail "the restored last $protocol frame did not stabilize"
  restored_middle_column=$(capture_stable_geometry "$middle_column_title") || \
    fail "the restored middle-column $protocol frame did not stabilize"
  restored_edge=$(capture_stable_geometry "$edge_title") || \
    fail "the restored edge $protocol frame did not stabilize"
  frames_share_horizontal_translation \
    "$baseline_first" "$restored_first" \
    "$baseline_middle" "$restored_middle" \
    "$baseline_last" "$restored_last" \
    "$baseline_middle_column" "$restored_middle_column" \
    "$baseline_edge" "$restored_edge" || \
    fail "Driftile did not restore the exact $protocol minimized-slot sizes and relative positions"

  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus the restored middle $protocol stack member"
  wait_for_active "$middle_title" || \
    fail "Driftile did not restore the middle $protocol stack order"
  invoke_shortcut "driftile_focus_window_down" || \
    fail "KGlobalAccel could not focus the restored last $protocol stack member"
  wait_for_active "$last_title" || \
    fail "Driftile did not restore the last $protocol stack order"
  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus the restored edge $protocol column"
  wait_for_active "$edge_title" || \
    fail "Driftile did not restore the edge $protocol singleton slot"
  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus the restored middle $protocol column"
  wait_for_active "$middle_column_title" || \
    fail "Driftile did not restore the middle $protocol singleton slot"
  invoke_shortcut "driftile_focus_column_first" || \
    fail "KGlobalAccel could not return to the restored first $protocol column"
  wait_for_active "$first_title" || \
    fail "Driftile did not return to the restored first $protocol stack member"
  wait_for_geometries \
    "$first_title" "$restored_first" \
    "$middle_title" "$restored_middle" \
    "$last_title" "$restored_last" \
    "$middle_column_title" "$restored_middle_column" \
    "$edge_title" "$restored_edge" || \
    fail "Driftile changed the restored $protocol minimized-slot order"

  stop_client "$edge_pid"
  wait_for_window_gone "$edge_title" || \
    fail "the minimized-slot $protocol edge window did not close"
  activate_window "$last_title" || \
    fail "KWin could not restore $protocol focus after minimized-slot navigation"
  wait_for_active "$last_title" || \
    fail "KWin did not restore $protocol focus after minimized-slot navigation"
  wait_for_shortcut_geometries \
    "driftile_center_column" \
    "$first_title" "332,16,616,219" \
    "$middle_title" "332,251,616,218" \
    "$last_title" "332,485,616,219" \
    "$middle_column_title" "964,16,616,688" || \
    fail "Driftile could not center the active $protocol column during minimized-slot cleanup"
  wait_for_shortcut_focus \
    "driftile_focus_column_right" "$middle_column_title" || \
    fail "Driftile could not restore the canonical $protocol viewport after minimized-slot navigation"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$middle_column_title" "648,16,616,688" || \
    fail "Driftile did not restore the exact $protocol fixture after minimized-slot navigation: $(describe_layout "$first_title" "$middle_title" "$last_title" "$middle_column_title")"
  activate_window "$last_title" || \
    fail "KWin could not restore final $protocol stack focus after minimized-slot navigation"
  wait_for_active "$last_title" || \
    fail "KWin did not restore final $protocol stack focus after minimized-slot navigation"
}

verify_vertical_reorder_past_minimized_peer() {
  local protocol=$1
  local first_title=$2
  local middle_title=$3
  local last_title=$4
  local unrelated_title=$5
  local middle_id

  middle_id=$(window_id "$middle_title") || \
    fail "KWin did not expose the passive $protocol stack member before minimized-peer reorder"
  activate_window "$first_title" || \
    fail "KWin could not focus the first $protocol stack member before minimized-peer reorder"
  wait_for_active "$first_title" || \
    fail "KWin did not focus the first $protocol stack member before minimized-peer reorder"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the $protocol stack before minimized-peer reorder: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"

  set_external_window_minimized "$middle_title" true || \
    fail "KWin could not externally minimize the passive $protocol stack member before reorder"
  wait_for_state_and_geometries \
    "$middle_id" minimized true \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol fixture while settling the minimized reorder peer: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  activate_window "$first_title" || \
    fail "KWin could not restore active $protocol stack focus before minimized-peer reorder"
  wait_for_active "$first_title" || \
    fail "KWin did not restore active $protocol stack focus before minimized-peer reorder"

  invoke_shortcut "driftile_move_window_down" || \
    fail "KGlobalAccel could not move the active $protocol window past its minimized peer"
  wait_for_geometries \
    "$first_title" "16,251,616,218" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not reflow the active $protocol window past its minimized peer: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_window_state "$middle_id" minimized true || \
    fail "Driftile restored the passive $protocol stack member during reorder"
  [[ "$(window_frame_geometry "$middle_title")" == "16,251,616,218" ]] || \
    fail "Driftile wrote the minimized passive $protocol stack frame during reorder"
  wait_for_active "$first_title" || \
    fail "Driftile changed $protocol focus during minimized-peer reorder"

  set_external_window_minimized "$middle_title" false || \
    fail "KWin could not restore the passive $protocol stack member after reorder"
  wait_for_state_and_geometries \
    "$middle_id" minimized false \
    "$first_title" "16,251,616,218" \
    "$middle_title" "16,16,616,219" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not restore the passive $protocol window in its reordered stack slot: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  activate_window "$first_title" || \
    fail "KWin could not restore active $protocol stack focus before fixture reconstruction"
  wait_for_active "$first_title" || \
    fail "KWin did not restore active $protocol stack focus before fixture reconstruction"

  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not reconstruct the $protocol stack after minimized-peer reorder"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not reconstruct the exact $protocol stack after minimized-peer reorder: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$first_title" || \
    fail "Driftile changed $protocol focus while reconstructing the minimized-peer reorder fixture"
}

verify_horizontal_extraction_past_minimized_peer() {
  local protocol=$1
  local first_title=$2
  local active_title=$3
  local minimized_title=$4
  local unrelated_title=$5
  local minimized_id

  minimized_id=$(window_id "$minimized_title") || \
    fail "KWin did not expose the passive $protocol stack member before horizontal extraction"
  activate_window "$active_title" || \
    fail "KWin could not focus the active $protocol stack member before horizontal extraction"
  wait_for_active "$active_title" || \
    fail "KWin did not focus the active $protocol stack member before horizontal extraction"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$minimized_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the $protocol stack before minimized-peer horizontal extraction: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"

  set_external_window_minimized "$minimized_title" true || \
    fail "KWin could not externally minimize the passive $protocol stack member before horizontal extraction"
  wait_for_state_and_geometries \
    "$minimized_id" minimized true \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$minimized_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol fixture while settling the horizontal extraction peer: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"
  activate_window "$active_title" || \
    fail "KWin could not restore active $protocol stack focus before horizontal extraction"
  wait_for_active "$active_title" || \
    fail "KWin did not restore active $protocol stack focus before horizontal extraction"

  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not extract the active $protocol window past its minimized peer"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$active_title" "648,16,616,688" \
    "$minimized_title" "16,485,616,219" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not place the extracted $protocol window in the immediate-right singleton: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"
  wait_for_window_state "$minimized_id" minimized true || \
    fail "Driftile restored the passive $protocol stack member during horizontal extraction"
  [[ "$(window_frame_geometry "$minimized_title")" == "16,485,616,219" ]] || \
    fail "Driftile wrote the minimized passive $protocol stack frame during horizontal extraction"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus during minimized-peer horizontal extraction"

  set_external_window_minimized "$minimized_title" false || \
    fail "KWin could not restore the passive $protocol stack member after horizontal extraction"
  wait_for_state_and_geometries \
    "$minimized_id" minimized false \
    "$first_title" "16,16,616,336" \
    "$active_title" "648,16,616,688" \
    "$minimized_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not safely restore the passive $protocol stack member after horizontal extraction: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"
  activate_window "$active_title" || \
    fail "KWin could not restore extracted $protocol singleton focus before fixture reconstruction"
  wait_for_active "$active_title" || \
    fail "KWin did not restore extracted $protocol singleton focus before fixture reconstruction"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not return the extracted $protocol singleton to its source stack"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,485,616,219" \
    "$minimized_title" "16,251,616,218" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not append the extracted $protocol singleton while reconstructing the fixture: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not reconstruct the $protocol stack after horizontal extraction"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$minimized_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not reconstruct the exact $protocol stack after horizontal extraction: $(describe_layout "$first_title" "$active_title" "$minimized_title" "$unrelated_title")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus while reconstructing the horizontal-extraction fixture"
}

verify_consume_past_minimized_peers() {
  local protocol=$1
  local first_title=$2
  local active_title=$3
  local minimized_source_title=$4
  local moved_title=$5
  local first_id
  local minimized_source_id

  first_id=$(window_id "$first_title") || \
    fail "KWin did not expose the passive target $protocol window before minimized-peer consume"
  minimized_source_id=$(window_id "$minimized_source_title") || \
    fail "KWin did not expose the passive source $protocol window before minimized-peer consume"

  activate_window "$minimized_source_title" || \
    fail "KWin could not focus the passive source $protocol window while preparing minimized-peer consume"
  wait_for_active "$minimized_source_title" || \
    fail "KWin did not focus the passive source $protocol window while preparing minimized-peer consume"
  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not extract the passive source $protocol window while preparing minimized-peer consume"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$active_title" "16,368,616,336" \
    "$moved_title" "1280,16,616,688" \
    "$minimized_source_title" "648,16,616,688" || \
    fail "Driftile did not settle the extracted $protocol source member while preparing minimized-peer consume: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  wait_for_active "$minimized_source_title" || \
    fail "Driftile changed $protocol focus after extracting the passive consume source member"
  activate_window "$moved_title" || \
    fail "KWin could not focus the moved $protocol window while preparing minimized-peer consume"
  wait_for_active "$moved_title" || \
    fail "KWin did not focus the moved $protocol window while preparing minimized-peer consume"
  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not prepare the $protocol consume source stack"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$active_title" "-600,368,616,336" \
    "$moved_title" "32,368,616,336" \
    "$minimized_source_title" "32,16,616,336" || \
    fail "Driftile did not settle the $protocol source stack before minimized-peer consume: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  wait_for_active "$moved_title" || \
    fail "Driftile changed $protocol focus while forming the minimized-peer consume source stack"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not move the visible $protocol source member above its passive peer"
  wait_for_geometries \
    "$first_title" "-600,16,616,336" \
    "$active_title" "-600,368,616,336" \
    "$moved_title" "32,16,616,336" \
    "$minimized_source_title" "32,368,616,336" || \
    fail "Driftile did not settle the reordered $protocol source stack before minimized-peer consume: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  wait_for_active "$moved_title" || \
    fail "Driftile changed $protocol focus while reordering the minimized-peer consume source stack"
  activate_window "$active_title" || \
    fail "KWin could not focus the target $protocol window before minimized-peer consume"
  wait_for_active "$active_title" || \
    fail "KWin did not focus the target $protocol window before minimized-peer consume"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$active_title" "16,368,616,336" \
    "$moved_title" "648,16,616,336" \
    "$minimized_source_title" "648,368,616,336" || \
    fail "Driftile did not prepare the exact $protocol minimized-peer consume fixture: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"

  set_external_window_minimized "$first_title" true || \
    fail "KWin could not minimize the passive target $protocol window before consume"
  set_external_window_minimized "$minimized_source_title" true || \
    fail "KWin could not minimize the passive source $protocol window before consume"
  wait_for_state_and_geometries \
    "$first_id" minimized true \
    "$first_title" "16,16,616,336" \
    "$active_title" "16,368,616,336" \
    "$moved_title" "648,16,616,336" \
    "$minimized_source_title" "648,368,616,336" || \
    fail "Driftile changed the $protocol fixture while settling the passive target before consume"
  wait_for_window_state "$minimized_source_id" minimized true || \
    fail "KWin did not settle the passive $protocol source member before consume"
  activate_window "$active_title" || \
    fail "KWin could not restore target $protocol focus before minimized-peer consume"
  wait_for_active "$active_title" || \
    fail "KWin did not restore target $protocol focus before minimized-peer consume"

  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not consume past settled minimized $protocol peers"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$active_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$minimized_source_title" "648,368,616,336" || \
    fail "Driftile did not append the visible $protocol source member past minimized peers: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  wait_for_window_state "$first_id" minimized true || \
    fail "Driftile restored the passive target $protocol window during consume"
  wait_for_window_state "$minimized_source_id" minimized true || \
    fail "Driftile restored the passive source $protocol window during consume"
  [[ "$(window_frame_geometry "$first_title")" == "16,16,616,336" ]] || \
    fail "Driftile wrote the minimized passive target $protocol frame during consume"
  [[ "$(window_frame_geometry "$minimized_source_title")" == "648,368,616,336" ]] || \
    fail "Driftile wrote the minimized passive source $protocol frame during consume"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus during minimized-peer consume"

  set_external_window_minimized "$first_title" false || \
    fail "KWin could not restore the passive target $protocol window after consume"
  set_external_window_minimized "$minimized_source_title" false || \
    fail "KWin could not restore the passive source $protocol window after consume"
  wait_for_state_and_geometries \
    "$first_id" minimized false \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$minimized_source_title" "648,16,616,688" || \
    fail "Driftile did not restore the passive $protocol windows after minimized-peer consume: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  wait_for_window_state "$minimized_source_id" minimized false || \
    fail "KWin did not restore the passive $protocol source member after consume"

  activate_window "$moved_title" || \
    fail "KWin could not focus the consumed $protocol window for fixture reconstruction"
  wait_for_active "$moved_title" || \
    fail "KWin did not focus the consumed $protocol window for fixture reconstruction"
  invoke_shortcut "driftile_move_window_right" || \
    fail "KGlobalAccel could not extract the consumed $protocol window during fixture reconstruction"
  wait_for_geometries \
    "$first_title" "16,16,616,336" \
    "$active_title" "16,368,616,336" \
    "$moved_title" "648,16,616,688" \
    "$minimized_source_title" "1280,16,616,688" || \
    fail "Driftile did not isolate the consumed $protocol window during fixture reconstruction: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  activate_window "$minimized_source_title" || \
    fail "KWin could not focus the restored source $protocol window during fixture reconstruction"
  wait_for_active "$minimized_source_title" || \
    fail "KWin did not focus the restored source $protocol window during fixture reconstruction"
  invoke_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel could not restore the passive $protocol window to its original stack"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$moved_title" "648,16,616,688" \
    "$minimized_source_title" "16,485,616,219" || \
    fail "Driftile did not reconstruct the exact $protocol fixture after minimized-peer consume: $(describe_layout "$first_title" "$active_title" "$moved_title" "$minimized_source_title")"
  activate_window "$active_title" || \
    fail "KWin could not restore $protocol focus after minimized-peer consume"
  wait_for_active "$active_title" || \
    fail "KWin did not restore $protocol focus after minimized-peer consume"
}

verify_expel_past_minimized_peer() {
  local protocol=$1
  local minimized_title=$2
  local focus_title=$3
  local moved_title=$4
  local unrelated_title=$5
  local minimized_id

  minimized_id=$(window_id "$minimized_title") || \
    fail "KWin did not expose the passive $protocol window before minimized-peer expel"
  activate_window "$focus_title" || \
    fail "KWin could not focus the middle $protocol stack member before minimized-peer expel"
  wait_for_active "$focus_title" || \
    fail "KWin did not focus the middle $protocol stack member before minimized-peer expel"
  wait_for_geometries \
    "$minimized_title" "16,16,616,219" \
    "$focus_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the canonical $protocol fixture before minimized-peer expel: $(describe_layout "$minimized_title" "$focus_title" "$moved_title" "$unrelated_title")"

  set_external_window_minimized "$minimized_title" true || \
    fail "KWin could not minimize the passive $protocol window before expel"
  wait_for_state_and_geometries \
    "$minimized_id" minimized true \
    "$minimized_title" "16,16,616,219" \
    "$focus_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile changed the $protocol fixture while settling the passive expel peer"
  activate_window "$moved_title" || \
    fail "KWin could not focus the bottom $protocol stack member before minimized-peer expel"
  wait_for_active "$moved_title" || \
    fail "KWin did not focus the bottom $protocol stack member before minimized-peer expel"

  invoke_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel could not expel past the settled minimized $protocol peer"
  wait_for_geometries \
    "$minimized_title" "16,16,616,219" \
    "$focus_title" "16,368,616,336" \
    "$moved_title" "648,16,616,688" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not expel the visible bottom $protocol member past its minimized peer: $(describe_layout "$minimized_title" "$focus_title" "$moved_title" "$unrelated_title")"
  wait_for_window_state "$minimized_id" minimized true || \
    fail "Driftile restored the passive $protocol window during expel"
  [[ "$(window_frame_geometry "$minimized_title")" == "16,16,616,219" ]] || \
    fail "Driftile wrote the minimized passive $protocol frame during expel"
  wait_for_active "$focus_title" || \
    fail "Driftile did not preserve the $protocol bottom-member focus handoff during minimized-peer expel"

  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not reconstruct the $protocol stack after minimized-peer expel"
  wait_for_geometries \
    "$minimized_title" "16,16,616,219" \
    "$focus_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not reconstruct the hidden-member $protocol fixture after expel: $(describe_layout "$minimized_title" "$focus_title" "$moved_title" "$unrelated_title")"
  wait_for_window_state "$minimized_id" minimized true || \
    fail "Driftile restored the passive $protocol window during expel cleanup"
  [[ "$(window_frame_geometry "$minimized_title")" == "16,16,616,219" ]] || \
    fail "Driftile wrote the minimized passive $protocol frame during expel cleanup"
  wait_for_active "$focus_title" || \
    fail "Driftile changed $protocol focus during minimized-peer expel cleanup"

  set_external_window_minimized "$minimized_title" false || \
    fail "KWin could not restore the passive $protocol window after expel cleanup"
  wait_for_state_and_geometries \
    "$minimized_id" minimized false \
    "$minimized_title" "16,16,616,219" \
    "$focus_title" "16,251,616,218" \
    "$moved_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not restore the exact $protocol fixture after minimized-peer expel: $(describe_layout "$minimized_title" "$focus_title" "$moved_title" "$unrelated_title")"
  wait_for_active "$focus_title" || \
    fail "KWin did not preserve $protocol focus after minimized-peer expel"
}

verify_stacked_maximize_extraction() {
  local protocol=$1
  local trigger=$2
  local first_title=$3
  local middle_title=$4
  local last_title=$5
  local unrelated_title=$6
  local middle_id

  middle_id=$(window_id "$middle_title") || \
    fail "KWin did not expose the middle $protocol stack member"
  activate_window "$middle_title" || \
    fail "KWin could not activate the middle $protocol stack member before $trigger maximize"
  wait_for_active "$middle_title" || \
    fail "KWin did not focus the middle $protocol stack member before $trigger maximize"
  window_state_matches "$middle_id" maximized false || \
    fail "the middle $protocol stack member was already maximized"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the three-window $protocol stack before $trigger maximize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel did not register the stacked maximize shortcut"
    invoke_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel could not maximize the middle $protocol stack member"
  else
    run_window_action "$middle_title" maximize || \
      fail "KWin could not externally maximize the middle $protocol stack member"
  fi

  wait_for_state_and_geometries \
    "$middle_id" maximized true \
    "$first_title" "16,16,616,336" \
    "$middle_title" "0,0,1280,720" \
    "$last_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not extract the middle $protocol stack member before $trigger maximize ownership: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus during $trigger stacked maximize"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "Driftile moved the first $protocol stack member during maximize extraction"
  wait_for_window_desktop "$middle_title" "$primary_desktop_id" || \
    fail "Driftile moved the maximized $protocol stack member to another desktop"
  wait_for_window_desktop "$last_title" "$primary_desktop_id" || \
    fail "Driftile moved the last $protocol stack member during maximize extraction"
  wait_for_window_desktop "$unrelated_title" "$primary_desktop_id" || \
    fail "Driftile moved the unrelated $protocol column during maximize extraction"

  if [[ "$trigger" == "shortcut" ]]; then
    invoke_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel could not unmaximize the extracted $protocol stack member"
  else
    run_window_action "$middle_title" maximize || \
      fail "KWin could not externally unmaximize the extracted $protocol stack member"
  fi

  wait_for_state_and_geometries \
    "$middle_id" maximized false \
    "$first_title" "16,16,616,336" \
    "$middle_title" "648,16,616,688" \
    "$last_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not keep the unmaximized $protocol window in its exact singleton column: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while leaving $trigger stacked maximize"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the extracted $protocol window to its source stack"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,485,616,219" \
    "$last_title" "16,251,616,218" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not append the extracted $protocol window while restoring the fixture: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not restore the middle $protocol stack order"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not restore the exact three-window $protocol stack after $trigger maximize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while restoring the stacked-maximize fixture"
}

verify_stacked_fullscreen_extraction() {
  local protocol=$1
  local trigger=$2
  local first_title=$3
  local middle_title=$4
  local last_title=$5
  local unrelated_title=$6
  local middle_id

  middle_id=$(window_id "$middle_title") || \
    fail "KWin did not expose the middle $protocol stack member for fullscreen"
  activate_window "$middle_title" || \
    fail "KWin could not activate the middle $protocol stack member before $trigger fullscreen"
  wait_for_active "$middle_title" || \
    fail "KWin did not focus the middle $protocol stack member before $trigger fullscreen"
  window_state_matches "$middle_id" fullscreen false || \
    fail "the middle $protocol stack member was already fullscreen"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the three-window $protocol stack before $trigger fullscreen: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel did not register the stacked fullscreen shortcut"
    invoke_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel could not fullscreen the middle $protocol stack member"
  else
    run_window_action "$middle_title" fullscreen || \
      fail "KWin could not externally fullscreen the middle $protocol stack member"
  fi

  wait_for_state_and_geometries \
    "$middle_id" fullscreen true \
    "$first_title" "16,16,616,336" \
    "$middle_title" "0,0,1280,720" \
    "$last_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not extract the middle $protocol stack member during $trigger fullscreen: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus during $trigger stacked fullscreen"
  wait_for_window_desktop "$first_title" "$primary_desktop_id" || \
    fail "Driftile moved the first $protocol stack member during fullscreen extraction"
  wait_for_window_desktop "$middle_title" "$primary_desktop_id" || \
    fail "Driftile moved the fullscreen $protocol stack member to another desktop"
  wait_for_window_desktop "$last_title" "$primary_desktop_id" || \
    fail "Driftile moved the last $protocol stack member during fullscreen extraction"
  wait_for_window_desktop "$unrelated_title" "$primary_desktop_id" || \
    fail "Driftile moved the unrelated $protocol column during fullscreen extraction"

  if [[ "$trigger" == "shortcut" ]]; then
    invoke_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel could not leave fullscreen for the extracted $protocol stack member"
  else
    run_window_action "$middle_title" fullscreen || \
      fail "KWin could not externally leave fullscreen for the extracted $protocol stack member"
  fi

  wait_for_state_and_geometries \
    "$middle_id" fullscreen false \
    "$first_title" "16,16,616,336" \
    "$middle_title" "648,16,616,688" \
    "$last_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not keep the former fullscreen $protocol window in its exact singleton column: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while leaving $trigger stacked fullscreen"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the fullscreen-extracted $protocol window to its source stack"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,485,616,219" \
    "$last_title" "16,251,616,218" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not append the fullscreen-extracted $protocol window while restoring the fixture: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not restore the middle $protocol stack order after fullscreen"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not restore the exact three-window $protocol stack after $trigger fullscreen: $(describe_layout "$first_title" "$middle_title" "$last_title" "$unrelated_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while restoring the stacked-fullscreen fixture"
}

verify_stacked_native_state_extraction_past_minimized_peer() {
  local protocol=$1
  local state=$2
  local minimized_position=$3
  local first_title=$4
  local active_title=$5
  local last_title=$6
  local unrelated_title=$7
  local active_id
  local minimized_id
  local minimized_title
  local minimized_frame
  local shortcut
  local transition
  local extracted_first_frame
  local extracted_last_frame

  case "$state" in
    fullscreen)
      shortcut="driftile_toggle_fullscreen"
      transition="fullscreen"
      ;;
    maximized)
      shortcut="driftile_maximize_window_to_edges"
      transition="maximize"
      ;;
    *)
      fail "unsupported minimized-peer native state: $state"
      ;;
  esac

  case "$minimized_position" in
    first)
      minimized_title=$first_title
      minimized_frame="16,16,616,219"
      extracted_first_frame=$minimized_frame
      extracted_last_frame="16,368,616,336"
      ;;
    last)
      minimized_title=$last_title
      minimized_frame="16,485,616,219"
      extracted_first_frame="16,16,616,336"
      extracted_last_frame=$minimized_frame
      ;;
    *)
      fail "unsupported minimized-peer stack position: $minimized_position"
      ;;
  esac

  active_id=$(window_id "$active_title") || \
    fail "KWin did not expose the active $protocol stack member before minimized-peer $transition"
  minimized_id=$(window_id "$minimized_title") || \
    fail "KWin did not expose the passive $protocol stack member before minimized-peer $transition"
  wait_for_shortcut "$shortcut" || \
    fail "KGlobalAccel did not register the minimized-peer $transition shortcut"
  activate_window "$active_title" || \
    fail "KWin could not activate the middle $protocol stack member before minimized-peer $transition"
  wait_for_active "$active_title" || \
    fail "KWin did not focus the middle $protocol stack member before minimized-peer $transition"
  window_state_matches "$active_id" "$state" false || \
    fail "the middle $protocol stack member already owned native $transition state"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not preserve the $protocol stack before minimized-peer $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"

  set_external_window_minimized "$minimized_title" true || \
    fail "KWin could not externally minimize the passive $protocol stack member before $transition"
  wait_for_state_and_geometries \
    "$minimized_id" minimized true \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile wrote the passive $protocol stack slot before minimized-peer $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  if ! window_state_matches "$minimized_id" fullscreen false \
    || ! window_state_matches "$minimized_id" maximized false; then
    fail "the minimized passive $protocol stack member gained native state before $transition"
  fi
  activate_window "$active_title" || \
    fail "KWin could not restore active $protocol stack focus before minimized-peer $transition"
  wait_for_active "$active_title" || \
    fail "KWin did not restore active $protocol stack focus before minimized-peer $transition"

  invoke_shortcut "$shortcut" || \
    fail "KGlobalAccel could not enter minimized-peer $protocol $transition"
  wait_for_state_and_geometries \
    "$active_id" "$state" true \
    "$first_title" "$extracted_first_frame" \
    "$active_title" "0,0,1280,720" \
    "$last_title" "$extracted_last_frame" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not extract the active $protocol stack member past its minimized peer for $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  wait_for_window_state "$minimized_id" minimized true || \
    fail "Driftile restored the passive $protocol stack member during $transition extraction"
  if ! window_state_matches "$minimized_id" fullscreen false \
    || ! window_state_matches "$minimized_id" maximized false; then
    fail "the minimized passive $protocol stack member gained native state during $transition extraction"
  fi
  [[ "$(window_frame_geometry "$minimized_title")" == "$minimized_frame" ]] || \
    fail "Driftile changed the minimized passive $protocol stack frame during $transition extraction"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus during minimized-peer $transition"

  invoke_shortcut "$shortcut" || \
    fail "KGlobalAccel could not leave minimized-peer $protocol $transition"
  wait_for_state_and_geometries \
    "$active_id" "$state" false \
    "$first_title" "$extracted_first_frame" \
    "$active_title" "648,16,616,688" \
    "$last_title" "$extracted_last_frame" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not retain immediate-right singleton semantics after minimized-peer $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  wait_for_window_state "$minimized_id" minimized true || \
    fail "Driftile restored the passive $protocol stack member while leaving $transition"
  if ! window_state_matches "$minimized_id" fullscreen false \
    || ! window_state_matches "$minimized_id" maximized false; then
    fail "the minimized passive $protocol stack member retained native state after leaving $transition"
  fi
  [[ "$(window_frame_geometry "$minimized_title")" == "$minimized_frame" ]] || \
    fail "Driftile changed the minimized passive $protocol stack frame while leaving $transition"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus while leaving minimized-peer $transition"

  set_external_window_minimized "$minimized_title" false || \
    fail "KWin could not restore the passive $protocol stack member after $transition"
  wait_for_state_and_geometries \
    "$minimized_id" minimized false \
    "$first_title" "16,16,616,336" \
    "$active_title" "648,16,616,688" \
    "$last_title" "16,368,616,336" \
    "$unrelated_title" "1280,16,616,688" || \
    fail "Driftile did not safely restore the passive $protocol stack member after $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  activate_window "$active_title" || \
    fail "KWin could not restore active $protocol singleton focus after minimized-peer $transition"
  wait_for_active "$active_title" || \
    fail "KWin did not restore active $protocol singleton focus after minimized-peer $transition"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not return the $protocol $transition singleton to its source stack"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,485,616,219" \
    "$last_title" "16,251,616,218" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not append the $protocol $transition singleton while restoring the fixture: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not restore the active $protocol stack order after minimized-peer $transition"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$active_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$unrelated_title" "648,16,616,688" || \
    fail "Driftile did not restore the exact $protocol stack after minimized-peer $transition: $(describe_layout "$first_title" "$active_title" "$last_title" "$unrelated_title")"
  wait_for_active "$active_title" || \
    fail "Driftile changed $protocol focus while restoring the minimized-peer $transition fixture"
}

verify_xterm_resize_increment_policy() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local xterm_title="driftile-resize-increment-${protocol}-xterm"
  local original_first
  local original_second
  local original_third
  local policy=""
  local candidate_policy
  local attempt
  local xterm_hints
  local xterm_id
  local xterm_pid
  local tiled_first="-1232,16,616,688"
  local tiled_second="-600,16,616,688"
  local tiled_third="32,16,616,688"
  local tiled_xterm="664,16,616,688"
  local narrower_xterm="664,16,490,688"

  original_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol window did not stabilize before xterm resize-increment acceptance"
  original_second=$(capture_stable_geometry "$second_title") || \
    fail "the second $protocol window did not stabilize before xterm resize-increment acceptance"
  original_third=$(capture_stable_geometry "$third_title") || \
    fail "the third $protocol window did not stabilize before xterm resize-increment acceptance"
  wait_for_geometries \
    "$first_title" "$original_first" \
    "$second_title" "$original_second" \
    "$third_title" "$original_third" || \
    fail "the $protocol layout did not settle before xterm resize-increment acceptance"
  wait_for_active "$third_title" || \
    fail "KWin did not preserve $protocol focus before xterm resize-increment acceptance"
  wait_for_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel did not register the decrease-width shortcut for $protocol xterm acceptance"
  wait_for_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel did not register the reset-width shortcut for $protocol xterm acceptance"

  start_xterm_client "$protocol" "$xterm_title"
  xterm_pid=${client_pids[${#client_pids[@]}-1]}
  capture_stable_geometry "$xterm_title" >/dev/null || \
    fail "the real $protocol xterm window did not stabilize"
  activate_window "$third_title" || \
    fail "KWin could not select the adjacent $protocol column before xterm acceptance"
  wait_for_active "$third_title" || \
    fail "KWin did not focus the adjacent $protocol column before xterm acceptance"
  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus the real $protocol xterm column"
  wait_for_x11_window_active "$xterm_title" || \
    fail "KWin did not focus the real $protocol xterm window"
  wait_for_window_border_state "$xterm_title" true || \
    fail "Driftile did not remove the real $protocol xterm decoration"
  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" \
    "$xterm_title" "$tiled_xterm" || \
    fail "Driftile did not own the exact real $protocol xterm tiled geometry: $(describe_layout "$first_title" "$second_title" "$third_title" "$xterm_title")"

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    candidate_policy=$(x11_window_resize_policy "$xterm_title" 2>/dev/null || true)

    if resize_policy_is_nontrivial "$candidate_policy"; then
      policy=$candidate_policy
      break
    fi

    sleep 0.05
  done

  if [[ -z "$policy" ]]; then
    xterm_id=$(x11_window_id "$xterm_title" 2>/dev/null || true)
    xterm_hints=$(
      LC_ALL=C xprop -id "$xterm_id" WM_NORMAL_HINTS 2>/dev/null \
        | tr '\n' ';' \
        || true
    )
    fail "the real $protocol xterm did not advertise nontrivial resize increments and base size: $xterm_hints"
  fi
  if [[ "$protocol" == xwayland ]]; then
    frame_is_off_resize_lattice "$tiled_xterm" "$policy" || \
      fail "Driftile snapped the exact real $protocol xterm frame to its advertised resize lattice: frame=$tiled_xterm policy=$policy"
    frame_is_off_resize_lattice "$narrower_xterm" "$policy" || \
      fail "the real $protocol xterm resize fixture unexpectedly aligns with its advertised resize lattice: frame=$narrower_xterm policy=$policy"
  else
    frame_is_on_resize_lattice "$tiled_xterm" "$policy" || \
      fail "the real $protocol xterm fixture does not align with its advertised resize lattice: frame=$tiled_xterm policy=$policy"
    frame_is_on_resize_lattice "$narrower_xterm" "$policy" || \
      fail "the real $protocol xterm resize fixture does not align with its advertised resize lattice: frame=$narrower_xterm policy=$policy"
  fi

  invoke_shortcut "driftile_decrease_column_width" || \
    fail "KGlobalAccel could not decrease the real $protocol xterm column width"
  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" \
    "$xterm_title" "$narrower_xterm" || \
    fail "Driftile did not decrease the exact real $protocol xterm width without layout churn: $(describe_layout "$first_title" "$second_title" "$third_title" "$xterm_title")"
  wait_for_window_border_state "$xterm_title" true || \
    fail "Driftile restored the real $protocol xterm decoration after decreasing its width"

  invoke_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel could not reset the real $protocol xterm column width"
  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" \
    "$xterm_title" "$tiled_xterm" || \
    fail "Driftile did not reset the exact real $protocol xterm geometry without layout churn: $(describe_layout "$first_title" "$second_title" "$third_title" "$xterm_title")"

  stop_client "$xterm_pid"
  wait_for_window_gone "$xterm_title" || \
    fail "the real $protocol xterm window did not close"
  activate_window "$first_title" || \
    fail "KWin could not reveal the first $protocol window after xterm acceptance"
  wait_for_active "$first_title" || \
    fail "KWin did not focus the first $protocol window after xterm acceptance"
  activate_window "$third_title" || \
    fail "KWin could not restore $protocol focus after xterm acceptance"
  wait_for_active "$third_title" || \
    fail "KWin did not restore $protocol focus after xterm acceptance"
  wait_for_geometries \
    "$first_title" "$original_first" \
    "$second_title" "$original_second" \
    "$third_title" "$original_third" || \
    fail "Driftile did not restore the exact $protocol layout after xterm acceptance: $(describe_layout "$first_title" "$second_title" "$third_title")"
}

verify_live_hard_constraint_recovery() {
  local protocol=$1
  local first_title=$2
  local second_title=$3
  local third_title=$4
  local base_title="driftile-live-constraint-${protocol}"
  local initial_title="$base_title initial"
  local constrained_title="$base_title constrained"
  local relaxed_title="$base_title relaxed"
  local original_first
  local original_second
  local original_third
  local constrained_frame
  local constrained_width
  local client_pid
  local attempt
  local tiled_first="-1232,16,616,688"
  local tiled_second="-600,16,616,688"
  local tiled_third="32,16,616,688"
  local tiled_client="664,16,616,688"

  original_first=$(capture_stable_geometry "$first_title") || \
    fail "the first $protocol window did not stabilize before live hard-constraint acceptance"
  original_second=$(capture_stable_geometry "$second_title") || \
    fail "the second $protocol window did not stabilize before live hard-constraint acceptance"
  original_third=$(capture_stable_geometry "$third_title") || \
    fail "the third $protocol window did not stabilize before live hard-constraint acceptance"
  wait_for_active "$third_title" || \
    fail "KWin did not preserve $protocol focus before live hard-constraint acceptance"

  start_qml_client \
    "$protocol" \
    "$DRIFTILE_SMOKE_LIVE_CONSTRAINT_CLIENT" \
    "$base_title"
  client_pid=${client_pids[${#client_pids[@]}-1]}

  capture_stable_geometry "$initial_title" >/dev/null || \
    fail "the initial live-constraint $protocol window did not stabilize"
  activate_window "$initial_title" || \
    fail "KWin could not activate the initial live-constraint $protocol window"
  wait_for_active "$initial_title" || \
    fail "KWin did not focus the initial live-constraint $protocol window"
  wait_for_window_border_state "$initial_title" true || \
    fail "Driftile did not remove the live-constraint $protocol decoration"
  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" \
    "$initial_title" "$tiled_client" || \
    fail "Driftile did not own the initial live-constraint $protocol layout: $(describe_layout "$first_title" "$second_title" "$third_title" "$initial_title")"
  activate_window "$third_title" || \
    fail "KWin could not trigger the tightened live $protocol constraint"
  wait_for_active "$third_title" || \
    fail "KWin did not focus the adjacent $protocol window while tightening constraints"

  constrained_frame=""
  constrained_width=0

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    constrained_frame=$(
      window_frame_geometry "$constrained_title" 2>/dev/null || true
    )

    if [[ "$constrained_frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]]; then
      IFS=, read -r _ _ constrained_width _ <<< "$constrained_frame"

      if ((constrained_width >= 700)); then
        constrained_frame=$(capture_stable_geometry "$constrained_title") || \
          constrained_frame=""
        break
      fi
    fi

    sleep 0.05
  done

  [[ "$constrained_frame" =~ ^-?[0-9]+,-?[0-9]+,[0-9]+,[0-9]+$ ]] || \
    fail "the tightened live-constraint $protocol window did not stabilize"
  IFS=, read -r _ _ constrained_width _ <<< "$constrained_frame"
  ((constrained_width >= 700)) || \
    fail "KWin did not apply the tightened live $protocol minimum width: $constrained_frame"
  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" || \
    fail "Driftile changed sibling frames after the live $protocol minimum became incompatible: $(describe_layout "$first_title" "$second_title" "$third_title" "$constrained_title")"
  wait_for_active "$third_title" || \
    fail "Driftile changed focus after the live $protocol minimum became incompatible"
  activate_window "$constrained_title" || \
    fail "KWin could not refocus the constrained $protocol window"
  wait_for_active "$constrained_title" || \
    fail "KWin did not refocus the constrained $protocol window"
  activate_window "$third_title" || \
    fail "KWin could not trigger relaxed live $protocol constraints"
  wait_for_active "$third_title" || \
    fail "KWin did not focus the adjacent $protocol window while relaxing constraints"

  wait_for_geometries \
    "$first_title" "$tiled_first" \
    "$second_title" "$tiled_second" \
    "$third_title" "$tiled_third" \
    "$relaxed_title" "$tiled_client" || \
    fail "Driftile did not recover the exact $protocol layout after hard constraints relaxed: $(describe_layout "$first_title" "$second_title" "$third_title" "$relaxed_title")"
  invoke_shortcut "driftile_focus_column_right" || \
    fail "KGlobalAccel could not focus the recovered $protocol window"
  wait_for_active "$relaxed_title" || \
    fail "Driftile could not focus the recovered $protocol window"

  stop_client "$client_pid"
  wait_for_window_gone "$relaxed_title" || \
    fail "the live-constraint $protocol window did not close"
  activate_window "$first_title" || \
    fail "KWin could not reveal the first $protocol window after live-constraint acceptance"
  wait_for_active "$first_title" || \
    fail "KWin did not focus the first $protocol window after live-constraint acceptance"
  activate_window "$third_title" || \
    fail "KWin could not restore $protocol focus after live-constraint acceptance"
  wait_for_active "$third_title" || \
    fail "KWin did not restore $protocol focus after live-constraint acceptance"
  wait_for_geometries \
    "$first_title" "$original_first" \
    "$second_title" "$original_second" \
    "$third_title" "$original_third" || \
    fail "Driftile did not restore the exact $protocol layout after live-constraint acceptance: $(describe_layout "$first_title" "$second_title" "$third_title")"
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
  local direct_passive_frame
  local direct_passive_id
  local direct_second_passive_frame
  local direct_second_passive_id
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

  if [[ "$protocol" == xwayland || "$protocol" == x11 ]]; then
    verify_xterm_resize_increment_policy \
      "$protocol" \
      "$first_title" \
      "$second_title" \
      "$third_title"
  fi

  verify_live_hard_constraint_recovery \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title"

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
  wait_for_shortcut "driftile_switch_focus_between_floating_and_tiling" || \
    fail "KGlobalAccel did not register the focus-layer shortcut"
  wait_for_shortcut "driftile_focus_floating" || \
    fail "KGlobalAccel did not register the direct floating-focus action"
  wait_for_shortcut "driftile_focus_tiling" || \
    fail "KGlobalAccel did not register the direct tiled-focus action"
  wait_for_shortcut "driftile_decrease_window_height" || \
    fail "KGlobalAccel did not register the decrease-height shortcut"
  wait_for_shortcut "driftile_increase_window_height" || \
    fail "KGlobalAccel did not register the increase-height shortcut"
  wait_for_shortcut "driftile_reset_window_height" || \
    fail "KGlobalAccel did not register the reset-height shortcut"
  wait_for_shortcut "driftile_switch_preset_window_height" || \
    fail "KGlobalAccel did not register the preset-height shortcut"
  wait_for_shortcut "driftile_switch_preset_window_height_back" || \
    fail "KGlobalAccel did not register the reverse preset-height shortcut"

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

  invoke_shortcut "driftile_increase_window_height" || \
    fail "KGlobalAccel could not invoke the increase-height shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,266" \
    "$second_title" "16,298,616,406" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not increase the active $protocol window height: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_decrease_window_height" || \
    fail "KGlobalAccel could not restore the active window height"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not restore the active $protocol window height: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_decrease_window_height" || \
    fail "KGlobalAccel could not invoke the decrease-height shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,406" \
    "$second_title" "16,438,616,266" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not decrease the active $protocol window height: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_reset_window_height" || \
    fail "KGlobalAccel could not invoke the reset-height shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not reset the active $protocol window height: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_switch_preset_window_height" || \
    fail "KGlobalAccel could not invoke the preset-height shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,453" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not select the next $protocol window-height preset: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_reset_window_height" || \
    fail "KGlobalAccel could not reset the forward height preset"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not reset the forward $protocol height preset: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_switch_preset_window_height_back" || \
    fail "KGlobalAccel could not invoke the reverse preset-height shortcut"
  wait_for_layout \
    "$first_title" "16,16,616,453" \
    "$second_title" "16,485,616,219" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not select the previous $protocol window-height preset: $(describe_layout "$first_title" "$second_title" "$third_title")"

  invoke_shortcut "driftile_reset_window_height" || \
    fail "KGlobalAccel could not reset the reverse height preset"
  wait_for_layout \
    "$first_title" "16,16,616,336" \
    "$second_title" "16,368,616,336" \
    "$third_title" "648,16,616,688" || \
    fail "Driftile did not reset the reverse $protocol height preset: $(describe_layout "$first_title" "$second_title" "$third_title")"

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

  verify_manual_floating_navigation \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title"

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

  verify_consume_and_expel_window \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$third_title" \
    "$fourth_title"

  direct_passive_id=$(window_id "$first_title") || \
    fail "KWin did not expose the passive direct-insertion $protocol peer"
  direct_second_passive_id=$(window_id "$second_title") || \
    fail "KWin did not expose the second passive direct-insertion $protocol peer"
  set_external_window_minimized "$first_title" true || \
    fail "KWin could not minimize the passive direct-insertion $protocol peer"
  set_external_window_minimized "$second_title" true || \
    fail "KWin could not minimize the second passive direct-insertion $protocol peer"
  wait_for_state_and_geometries \
    "$direct_passive_id" minimized true \
    "$first_title" "-600,16,616,336" \
    "$second_title" "-600,368,616,336" \
    "$third_title" "32,16,616,688" \
    "$fourth_title" "664,16,616,688" || \
    fail "Driftile changed the $protocol fixture while settling the direct-insertion peer: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_window_state "$direct_second_passive_id" minimized true || \
    fail "Driftile restored the second passive direct-insertion $protocol peer"
  direct_passive_frame=$(capture_stable_geometry "$first_title") || \
    fail "the passive direct-insertion $protocol peer frame did not stabilize"
  direct_second_passive_frame=$(capture_stable_geometry "$second_title") || \
    fail "the second passive direct-insertion $protocol peer frame did not stabilize"
  activate_window "$fourth_title" || \
    fail "KWin could not refocus the active direct-insertion $protocol window"
  wait_for_active "$fourth_title" || \
    fail "KWin did not refocus the active direct-insertion $protocol window"

  invoke_shortcut "driftile_insert_window_into_stack_left" || \
    fail "KGlobalAccel could not invoke the insert-into-stack-left shortcut"
  wait_for_state_and_geometries \
    "$direct_passive_id" minimized true \
    "$first_title" "$direct_passive_frame" \
    "$second_title" "$direct_second_passive_frame" \
    "$third_title" "648,16,616,688" \
    "$fourth_title" "16,485,616,219" || \
    fail "Driftile did not skip the singleton and append the active $protocol window to the left stack: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_window_state "$direct_second_passive_id" minimized true || \
    fail "Driftile restored the second passive $protocol peer during direct insertion"
  wait_for_active "$fourth_title" || \
    fail "Driftile changed $protocol focus after direct stack insertion"

  set_external_window_minimized "$first_title" false || \
    fail "KWin could not restore the passive direct-insertion $protocol peer"
  set_external_window_minimized "$second_title" false || \
    fail "KWin could not restore the second passive direct-insertion $protocol peer"
  wait_for_state_and_geometries \
    "$direct_passive_id" minimized false \
    "$first_title" "16,16,616,219" \
    "$second_title" "16,251,616,218" \
    "$third_title" "648,16,616,688" \
    "$fourth_title" "16,485,616,219" || \
    fail "Driftile did not restore the passive direct-insertion $protocol peer: $(describe_layout "$first_title" "$second_title" "$third_title" "$fourth_title")"
  wait_for_window_state "$direct_second_passive_id" minimized false || \
    fail "Driftile did not restore the second passive direct-insertion $protocol peer"
  activate_window "$fourth_title" || \
    fail "KWin could not refocus the inserted $protocol window after peer restoration"
  wait_for_active "$fourth_title" || \
    fail "KWin did not refocus the inserted $protocol window after peer restoration"

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

  verify_minimized_slot_navigation \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  verify_vertical_reorder_past_minimized_peer \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  verify_horizontal_extraction_past_minimized_peer \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  verify_consume_past_minimized_peers \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  verify_expel_past_minimized_peer \
    "$protocol" \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  verify_stacked_native_state_extraction_past_minimized_peer \
    "$protocol" \
    maximized \
    last \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"
  verify_stacked_native_state_extraction_past_minimized_peer \
    "$protocol" \
    fullscreen \
    first \
    "$first_title" \
    "$second_title" \
    "$fourth_title" \
    "$third_title"

  if [[ "$protocol" == "x11" ]]; then
    verify_stacked_maximize_extraction \
      "$protocol" \
      shortcut \
      "$first_title" \
      "$second_title" \
      "$fourth_title" \
      "$third_title"
    verify_stacked_fullscreen_extraction \
      "$protocol" \
      shortcut \
      "$first_title" \
      "$second_title" \
      "$fourth_title" \
      "$third_title"
  fi

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
    "$first_title" "-600,16,616,688" \
    "$second_title" "$second_baseline" \
    "$third_title" "32,16,616,688" || \
    fail "Driftile did not preserve the tiled view while floating the middle $protocol window: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after floating the middle window"

  verify_focus_layer_roundtrip \
    "$protocol" \
    "$second_title" \
    "$third_title" \
    "$first_title" "-600,16,616,688" \
    "$second_title" "$second_baseline" \
    "$third_title" "32,16,616,688"

  activate_window "$second_title" || \
    fail "KWin could not restore floating $protocol focus before retiling"
  wait_for_active "$second_title" || \
    fail "KWin did not restore floating $protocol focus before retiling"

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
  wait_for_shortcut "driftile_expand_column_to_available_width" || \
    fail "KGlobalAccel did not register the available-width shortcut"
  wait_for_shortcut "driftile_center_visible_columns" || \
    fail "KGlobalAccel did not register the visible-columns shortcut"

  verify_advanced_column_view \
    "$protocol" "$first_title" "$second_title" "$third_title"

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
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,490,688" \
    "$third_title" "538,16,616,688" || \
    fail "Driftile did not decrease the active $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after decreasing column width"

  invoke_shortcut "driftile_reset_column_width" || \
    fail "KGlobalAccel could not invoke the reset-width shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
    fail "Driftile did not reset the active $protocol column width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after resetting column width"

  invoke_shortcut "driftile_switch_preset_column_width" || \
    fail "KGlobalAccel could not invoke the preset-width shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,827,688" \
    "$third_title" "875,16,616,688" || \
    fail "Driftile did not select the next $protocol preset width: $(describe_layout "$first_title" "$second_title" "$third_title")"
  wait_for_active "$second_title" || \
    fail "Driftile changed $protocol focus after selecting a preset width"

  invoke_shortcut "driftile_switch_preset_column_width_back" || \
    fail "KGlobalAccel could not invoke the reverse preset-width shortcut"
  wait_for_layout \
    "$first_title" "-600,16,616,688" \
    "$second_title" "32,16,616,688" \
    "$third_title" "664,16,616,688" || \
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
  wait_for_shortcut "driftile_toggle_fullscreen" || \
    fail "KGlobalAccel did not register the fullscreen shortcut"
  wait_for_shortcut "driftile_maximize_window_to_edges" || \
    fail "KGlobalAccel did not register the maximize-to-edges shortcut"
  wait_for_geometries \
    "$first_title" "$reserved_frame" \
    "$second_title" "$state_frame" || \
    fail "Driftile did not reserve the $protocol state layout: $(describe_layout "$first_title" "$second_title")"

  state_window_id=$(window_id "$second_title") || fail "KWin did not expose the $protocol state window id"

  verify_window_action_transition \
    "$protocol" driftile_toggle_fullscreen fullscreen "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$full_output_frame" "$state_frame" shortcut
  verify_window_action_transition \
    "$protocol" minimize minimized "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$state_frame" "$state_frame"
  verify_window_action_transition \
    "$protocol" driftile_maximize_window_to_edges maximized "$state_window_id" \
    "$first_title" "$second_title" \
    "$reserved_frame" "$full_output_frame" "$state_frame" shortcut

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

verify_multi_output_stacked_maximize_extraction() {
  local protocol=$1
  local trigger=$2
  local first_title=$3
  local middle_title=$4
  local last_title=$5
  local right_first_title=$6
  local right_second_title=$7
  local middle_id

  middle_id=$(window_id "$middle_title") || \
    fail "KWin did not expose the middle multi-output $protocol stack member"
  activate_window "$middle_title" || \
    fail "KWin could not activate the middle multi-output $protocol stack member"
  wait_for_active "$middle_title" || \
    fail "KWin did not focus the middle multi-output $protocol stack member"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not preserve the isolated left $protocol stack before maximize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel did not register the multi-output stacked maximize shortcut"
    invoke_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel could not maximize the middle multi-output $protocol stack member"
  else
    run_window_action "$middle_title" maximize || \
      fail "KWin could not externally maximize the middle multi-output $protocol stack member"
  fi
  wait_for_state_and_geometries \
    "$middle_id" maximized true \
    "$first_title" "16,16,616,336" \
    "$middle_title" "0,0,1280,720" \
    "$last_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile crossed output contexts during stacked $protocol maximize extraction: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus during multi-output stacked maximize"
  window_is_on_output_side "$first_title" left || \
    fail "Driftile moved the first $protocol source member to another output"
  window_is_on_output_side "$middle_title" left || \
    fail "Driftile maximized the extracted $protocol window on another output"
  window_is_on_output_side "$last_title" left || \
    fail "Driftile moved the last $protocol source member to another output"
  window_is_on_output_side "$right_first_title" right || \
    fail "Driftile moved the first unrelated right-output $protocol window"
  window_is_on_output_side "$right_second_title" right || \
    fail "Driftile moved the second unrelated right-output $protocol window"

  if [[ "$trigger" == "shortcut" ]]; then
    invoke_shortcut "driftile_maximize_window_to_edges" || \
      fail "KGlobalAccel could not unmaximize the extracted multi-output $protocol window"
  else
    run_window_action "$middle_title" maximize || \
      fail "KWin could not externally unmaximize the extracted multi-output $protocol window"
  fi
  wait_for_state_and_geometries \
    "$middle_id" maximized false \
    "$first_title" "16,16,616,336" \
    "$middle_title" "648,16,616,688" \
    "$last_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not preserve the isolated singleton after multi-output $protocol unmaximize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while leaving multi-output stacked maximize"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the multi-output $protocol maximize fixture"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,485,616,219" \
    "$last_title" "16,251,616,218" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not append the extracted multi-output $protocol window during fixture restore: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not restore the middle multi-output $protocol stack order"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the exact isolated $protocol stack after maximize: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while restoring the multi-output maximize fixture"
}

verify_multi_output_stacked_fullscreen_extraction() {
  local protocol=$1
  local trigger=$2
  local first_title=$3
  local middle_title=$4
  local last_title=$5
  local right_first_title=$6
  local right_second_title=$7
  local middle_id

  middle_id=$(window_id "$middle_title") || \
    fail "KWin did not expose the middle multi-output $protocol stack member for fullscreen"
  activate_window "$middle_title" || \
    fail "KWin could not activate the middle multi-output $protocol stack member before fullscreen"
  wait_for_active "$middle_title" || \
    fail "KWin did not focus the middle multi-output $protocol stack member before fullscreen"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not preserve the isolated left $protocol stack before fullscreen: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"

  if [[ "$trigger" == "shortcut" ]]; then
    wait_for_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel did not register the multi-output stacked fullscreen shortcut"
    invoke_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel could not fullscreen the middle multi-output $protocol stack member"
  else
    run_window_action "$middle_title" fullscreen || \
      fail "KWin could not externally fullscreen the middle multi-output $protocol stack member"
  fi
  wait_for_state_and_geometries \
    "$middle_id" fullscreen true \
    "$first_title" "16,16,616,336" \
    "$middle_title" "0,0,1280,720" \
    "$last_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile crossed output contexts during stacked $protocol fullscreen extraction: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus during multi-output stacked fullscreen"
  window_is_on_output_side "$first_title" left || \
    fail "Driftile moved the first $protocol fullscreen source member to another output"
  window_is_on_output_side "$middle_title" left || \
    fail "Driftile fullscreened the extracted $protocol window on another output"
  window_is_on_output_side "$last_title" left || \
    fail "Driftile moved the last $protocol fullscreen source member to another output"
  window_is_on_output_side "$right_first_title" right || \
    fail "Driftile moved the first unrelated right-output $protocol window during fullscreen"
  window_is_on_output_side "$right_second_title" right || \
    fail "Driftile moved the second unrelated right-output $protocol window during fullscreen"

  if [[ "$trigger" == "shortcut" ]]; then
    invoke_shortcut "driftile_toggle_fullscreen" || \
      fail "KGlobalAccel could not leave fullscreen for the extracted multi-output $protocol window"
  else
    run_window_action "$middle_title" fullscreen || \
      fail "KWin could not externally leave fullscreen for the extracted multi-output $protocol window"
  fi
  wait_for_state_and_geometries \
    "$middle_id" fullscreen false \
    "$first_title" "16,16,616,336" \
    "$middle_title" "648,16,616,688" \
    "$last_title" "16,368,616,336" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not preserve the isolated singleton after multi-output $protocol fullscreen exit: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while leaving multi-output stacked fullscreen"

  invoke_shortcut "driftile_move_window_left" || \
    fail "KGlobalAccel could not restore the multi-output $protocol fullscreen fixture"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,485,616,219" \
    "$last_title" "16,251,616,218" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not append the fullscreen-extracted multi-output $protocol window during fixture restore: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  invoke_shortcut "driftile_move_window_up" || \
    fail "KGlobalAccel could not restore the middle multi-output $protocol stack order after fullscreen"
  wait_for_geometries \
    "$first_title" "16,16,616,219" \
    "$middle_title" "16,251,616,218" \
    "$last_title" "16,485,616,219" \
    "$right_first_title" "1296,16,616,688" \
    "$right_second_title" "1928,16,616,688" || \
    fail "Driftile did not restore the exact isolated $protocol stack after fullscreen: $(describe_layout "$first_title" "$middle_title" "$last_title" "$right_first_title" "$right_second_title")"
  wait_for_active "$middle_title" || \
    fail "Driftile changed $protocol focus while restoring the multi-output fullscreen fixture"
}

run_multi_output_scenario() {
  local protocol=$1
  local baseline
  local index
  local scaled_left_first="16,16,402.666667,448"
  local scaled_left_second="434.666667,16,402.666667,448"
  local right_floating_frame
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

  if [[ "$protocol" == "wayland" ]]; then
    verify_multi_output_stacked_maximize_extraction \
      "$protocol" \
      window-action \
      "${titles[0]}" \
      "${titles[1]}" \
      "${titles[2]}" \
      "${titles[3]}" \
      "${titles[4]}"
  else
    verify_multi_output_stacked_maximize_extraction \
      "$protocol" \
      shortcut \
      "${titles[0]}" \
      "${titles[1]}" \
      "${titles[2]}" \
      "${titles[3]}" \
      "${titles[4]}"
  fi

  verify_multi_output_stacked_fullscreen_extraction \
    "$protocol" \
    window-action \
    "${titles[0]}" \
    "${titles[1]}" \
    "${titles[2]}" \
    "${titles[3]}" \
    "${titles[4]}"

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

  wait_for_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel did not register the multi-output consume-window shortcut"
  wait_for_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel did not register the multi-output expel-window shortcut"
  activate_window "${titles[0]}" || \
    fail "KWin could not focus the left $protocol consume target"
  wait_for_active "${titles[0]}" || \
    fail "KWin did not focus the left $protocol consume target"
  invoke_shortcut "driftile_consume_window_into_column" || \
    fail "KGlobalAccel could not invoke the isolated multi-output consume action"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,336" \
    "${titles[1]}" "16,368,616,336" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not isolate the multi-output $protocol consume action: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[0]}" || \
    fail "Driftile changed $protocol focus after the isolated consume action"

  invoke_shortcut "driftile_expel_window_from_column" || \
    fail "KGlobalAccel could not invoke the isolated multi-output expel action"
  wait_for_geometries \
    "${titles[0]}" "16,16,616,688" \
    "${titles[1]}" "648,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not isolate the multi-output $protocol expel action: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[0]}" || \
    fail "Driftile changed $protocol focus after the isolated expel action"

  wait_for_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel did not register the multi-output floating shortcut"
  wait_for_shortcut "driftile_switch_focus_between_floating_and_tiling" || \
    fail "KGlobalAccel did not register the multi-output focus-layer shortcut"
  wait_for_shortcut "driftile_focus_floating" || \
    fail "KGlobalAccel did not register the multi-output floating-focus action"
  wait_for_shortcut "driftile_focus_tiling" || \
    fail "KGlobalAccel did not register the multi-output tiled-focus action"
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

  activate_window "${titles[4]}" || \
    fail "KWin could not focus the right $protocol context during floating isolation"
  wait_for_active "${titles[4]}" || \
    fail "KWin did not focus the right $protocol context during floating isolation"
  invoke_shortcut "driftile_switch_focus_between_floating_and_tiling" || \
    fail "KGlobalAccel could not check the empty right floating layer"
  wait_for_active "${titles[4]}" || \
    fail "Driftile crossed output contexts while the right floating layer was empty"
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile changed the multi-output $protocol layout during the empty-layer check: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"

  verify_focus_layer_roundtrip \
    "$protocol" \
    "${titles[0]}" \
    "${titles[1]}" \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688"

  activate_window "${titles[3]}" || \
    fail "KWin could not focus the right $protocol window for floating-navigation isolation"
  wait_for_active "${titles[3]}" || \
    fail "KWin did not focus the right $protocol window for floating-navigation isolation"
  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not float the right $protocol isolation window"
  wait_for_active "${titles[3]}" || \
    fail "Driftile changed focus while floating the right $protocol isolation window"
  right_floating_frame=$(capture_stable_geometry "${titles[3]}") || \
    fail "the right $protocol isolation window did not stabilize while floating"
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "$right_floating_frame" \
    "${titles[4]}" "1296,16,616,688" || \
    fail "Driftile did not isolate floating windows across $protocol outputs: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"

  activate_window "${titles[0]}" || \
    fail "KWin could not focus the left $protocol floating isolation window"
  wait_for_active "${titles[0]}" || \
    fail "KWin did not focus the left $protocol floating isolation window"
  verify_isolated_floating_navigation \
    "$protocol" \
    "${titles[0]}" \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "$right_floating_frame" \
    "${titles[4]}" "1296,16,616,688"

  activate_window "${titles[3]}" || \
    fail "KWin could not focus the right $protocol floating isolation window"
  wait_for_active "${titles[3]}" || \
    fail "KWin did not focus the right $protocol floating isolation window"
  verify_isolated_floating_navigation \
    "$protocol" \
    "${titles[3]}" \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "$right_floating_frame" \
    "${titles[4]}" "1296,16,616,688"

  invoke_shortcut "driftile_toggle_floating" || \
    fail "KGlobalAccel could not retile the right $protocol isolation window"
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "16,16,616,688" \
    "${titles[3]}" "1296,16,616,688" \
    "${titles[4]}" "1928,16,616,688" || \
    fail "Driftile did not restore the right $protocol isolation window: $(describe_layout "${titles[0]}" "${titles[1]}" "${titles[3]}" "${titles[4]}")"
  wait_for_active "${titles[3]}" || \
    fail "Driftile changed focus after restoring the right $protocol isolation window"

  activate_window "${titles[0]}" || \
    fail "KWin could not restore floating $protocol focus before the multi-output retile"
  wait_for_active "${titles[0]}" || \
    fail "KWin did not restore floating $protocol focus before the multi-output retile"

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
detect_desktop_reorder_capability || \
  fail "KWin desktop reorder capability could not be detected"
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
