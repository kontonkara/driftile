#!/usr/bin/env bash

set -euo pipefail

if [[ "${DRIFTILE_SMOKE_TRACE:-0}" == "1" ]]; then
  set -x
fi

readonly plugin_id="io.github.kontonkara.driftile"
readonly output_router_plugin_id="io.github.kontonkara.driftile.integration-output-router"
readonly stable_sample_count=2
readonly wait_attempts=200

client_pids=()
qml_options=(--software)

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

cleanup() {
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

run_scenario() {
  local protocol=$1
  local first_title="driftile-smoke-${protocol}-a"
  local second_title="driftile-smoke-${protocol}-b"
  local third_title="driftile-smoke-${protocol}-c"
  local first_baseline
  local second_baseline
  local third_baseline

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

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile"
  wait_for_layout \
    "$first_title" "$first_baseline" \
    "$second_title" "$second_baseline" \
    "$third_title" "$third_baseline" || \
    fail "Driftile did not restore the $protocol windows: $(describe_layout "$first_title" "$second_title" "$third_title")"

  stop_clients
  wait_for_window_gone "$first_title" || fail "the first $protocol test window did not close"
  wait_for_window_gone "$second_title" || fail "the second $protocol test window did not close"
  wait_for_window_gone "$third_title" || fail "the third $protocol test window did not close"
}

run_multi_output_scenario() {
  local protocol=$1
  local baseline
  local index
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

  set_plugin_state false
  wait_for_script_state false || fail "KWin did not unload Driftile"
  wait_for_geometries \
    "${titles[0]}" "${baselines[0]}" \
    "${titles[1]}" "${baselines[1]}" \
    "${titles[2]}" "${baselines[2]}" \
    "${titles[3]}" "${baselines[3]}" \
    "${titles[4]}" "${baselines[4]}" \
    "${titles[5]}" "${baselines[5]}" || \
    fail "Driftile did not restore the multi-output $protocol windows: $(describe_layout "${titles[@]}")"

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
