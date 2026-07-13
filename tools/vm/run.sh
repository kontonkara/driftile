#!/usr/bin/env bash

set -euo pipefail

vm_mode=${1:-full}

if (($# > 1)); then
  printf 'Usage: %s [full|two-head|lifecycle]\n' "$0" >&2
  exit 2
fi

case "$vm_mode" in
  full)
    flake_configuration=driftile-vm
    vm_runner=run-driftile-vm-vm
    ;;
  two-head)
    flake_configuration=driftile-vm-two-head
    vm_runner=run-driftile-vm-two-head-vm
    ;;
  lifecycle)
    flake_configuration=driftile-vm-lifecycle
    vm_runner=run-driftile-vm-lifecycle-vm
    ;;
  *)
    printf 'Usage: %s [full|two-head|lifecycle]\n' "$0" >&2
    exit 2
    ;;
esac

root_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
temporary_directory=$(mktemp -d -t driftile-vm.XXXXXXXXXX)
host_script_loaded=false
readonly host_script_name="io.github.kontonkara.driftile.vm-window"
readonly qmp_socket="$temporary_directory/qmp.sock"
readonly two_head_desktop_height=768
readonly two_head_desktop_width=1376
readonly two_head_desktop_x=0
readonly two_head_desktop_y=0
status_monitor_pid=""

# shellcheck disable=SC2329
cleanup() {
  if [[ -n "$status_monitor_pid" ]]; then
    wait "$status_monitor_pid" >/dev/null 2>&1 || true
  fi

  if [[ "$host_script_loaded" == true ]]; then
    run_host_busctl call \
      org.kde.KWin \
      /Scripting \
      org.kde.kwin.Scripting \
      unloadScript \
      s "$host_script_name" \
      >/dev/null 2>&1 || true
  fi

  rm -rf -- "$temporary_directory"
}

run_host_busctl() {
  nix develop .#integration -c busctl --user "$@"
}

prepare_host_window() {
  local load_result
  local script_id

  run_host_busctl call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    unloadScript \
    s "$host_script_name" \
    >/dev/null 2>&1 || true

  load_result=$(run_host_busctl call \
    org.kde.KWin \
    /Scripting \
    org.kde.kwin.Scripting \
    loadDeclarativeScript \
    ss "$root_directory/tools/vm/host-window.qml" "$host_script_name" \
    2>/dev/null) || return 1

  if [[ ! "$load_result" =~ ^i\ ([0-9]+)$ ]]; then
    return 1
  fi

  script_id=${BASH_REMATCH[1]}
  host_script_loaded=true
  run_host_busctl call \
    org.kde.KWin \
    "/Scripting/Script$script_id" \
    org.kde.kwin.Script \
    run \
    >/dev/null 2>&1 || return 1

}

monitor_guest() {
  local attempt
  local diagnostics_file="$temporary_directory/xchg/driftile-focus-diagnostics"
  local failed=false
  local focus_file="$temporary_directory/xchg/driftile-focus-verified"
  local key_name
  local key_ready_file
  local key_sent_file
  local loaded_file="$temporary_directory/xchg/driftile-loaded"
  local pointer_drag_name
  local pointer_ready_file
  local pointer_sent_file
  local -A keys_sent=(
    [bracket-right]=false
    [comma]=false
    [ctrl-c]=false
    [ctrl-end]=false
    [ctrl-f]=false
    [ctrl-home]=false
    [ctrl-j]=false
    [ctrl-k]=false
    [ctrl-r]=false
    [ctrl-shift-r]=false
    [desktop-1]=false
    [desktop-9]=false
    [desktop-ctrl-2]=false
    [desktop-ctrl-9]=false
    [desktop-move-down]=false
    [desktop-move-down-page-down]=false
    [desktop-move-up]=false
    [desktop-move-up-page-up]=false
    [desktop-next-page-down]=false
    [end]=false
    [equal]=false
    [floating-down]=false
    [floating-desktop-next]=false
    [floating-end]=false
    [floating-home]=false
    [floating-left]=false
    [floating-right]=false
    [floating-up]=false
    [home]=false
    [m-enter]=false
    [m-exit]=false
    [minus]=false
    [minimized-consume]=false
    [minimized-expel]=false
    [period]=false
    [preset-back-wrap]=false
    [preset-next]=false
    [preset-next-wrap]=false
    [shift-equal]=false
    [shift-f-enter]=false
    [shift-f-exit]=false
    [shift-v-floating]=false
    [shift-v-tiling]=false
    [shift-minus]=false
    [stacked-m-enter]=false
    [stacked-m-exit]=false
    [stacked-shift-f-enter]=false
    [stacked-shift-f-exit]=false
  )
  local -A pointer_drags_sent=(
    [cross-column]=false
    [same-stack]=false
  )

  for ((attempt = 0; attempt < 1800; attempt += 1)); do
    for key_name in \
      bracket-right \
      home \
      end \
      ctrl-home \
      ctrl-end \
      comma \
      period \
      preset-next \
      preset-next-wrap \
      preset-back-wrap \
      desktop-1 \
      desktop-9 \
      desktop-ctrl-2 \
      desktop-ctrl-9 \
      desktop-move-down \
      desktop-move-up-page-up \
      desktop-move-down-page-down \
      desktop-move-up \
      desktop-next-page-down \
      minus \
      minimized-consume \
      minimized-expel \
      equal \
      shift-minus \
      shift-equal \
      ctrl-shift-r \
      ctrl-r \
      ctrl-f \
      ctrl-c \
      ctrl-j \
      ctrl-k \
      shift-v-floating \
      shift-v-tiling \
      floating-home \
      floating-end \
      floating-left \
      floating-right \
      floating-up \
      floating-down \
      floating-desktop-next \
      stacked-m-enter \
      stacked-m-exit \
      stacked-shift-f-enter \
      stacked-shift-f-exit \
      shift-f-enter \
      shift-f-exit \
      m-enter \
      m-exit; do
      key_ready_file="$temporary_directory/xchg/driftile-key-test-$key_name-ready"
      key_sent_file="$temporary_directory/xchg/driftile-key-test-$key_name-sent"

      if [[ "${keys_sent[$key_name]}" == false && -f "$key_ready_file" ]]; then
        if ! send_physical_shortcut "$key_name"; then
          printf 'Could not send the physical shortcut: %s.\n' "$key_name" >&2
          stop_vm || true
          return 1
        fi

        printf 'The VM received the physical shortcut: %s.\n' "$key_name"
        : > "$key_sent_file"
        keys_sent[$key_name]=true
      fi
    done

    for pointer_drag_name in cross-column same-stack; do
      pointer_ready_file="$temporary_directory/xchg/driftile-pointer-drag-$pointer_drag_name-ready"
      pointer_sent_file="$temporary_directory/xchg/driftile-pointer-drag-$pointer_drag_name-sent"

      if [[ "${pointer_drags_sent[$pointer_drag_name]}" == false \
        && -f "$pointer_ready_file" ]]; then
        if ! send_physical_pointer_drag "$pointer_ready_file"; then
          printf 'Could not send the physical pointer drag: %s.\n' \
            "$pointer_drag_name" >&2
          stop_vm || true
          return 1
        fi

        printf 'The VM received the physical pointer drag: %s.\n' \
          "$pointer_drag_name"
        : > "$pointer_sent_file"
        pointer_drags_sent[$pointer_drag_name]=true
      fi
    done

    if [[ -f "$loaded_file" && -f "$focus_file" ]]; then
      if [[ "$(<"$loaded_file")" == true ]]; then
        printf 'The VM reports that Driftile loaded successfully.\n'
      else
        printf 'The VM reports that Driftile failed to load.\n' >&2
        failed=true
      fi

      if [[ "$(<"$focus_file")" == true ]]; then
        printf 'The VM verified physical shortcut and pointer routing, desktop switching and reordering, minimized-slot navigation, column reordering, horizontal extraction, consume and expel past minimized peers, native fullscreen and maximize, stacked fullscreen and maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, output transfers, floating-layer navigation, focus, stack editing and pointer reinsertion, live touchpad-navigation settings, the visible read-only overview lifecycle, advanced column view, column and window sizing, scrolling, mixed Konsole, Firefox, KDE Calculator, XWayland xterm, and fixed-size XWayland fixtures, plus repeated real-application lifecycles.\n'
      else
        printf 'The VM failed to verify physical shortcut or pointer routing, desktop switching or reordering, minimized-slot navigation, column reordering, horizontal extraction, consume or expel past minimized peers, native fullscreen or maximize, stacked fullscreen or maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, output transfers, floating-layer navigation, focus, stack editing or pointer reinsertion, live touchpad-navigation settings, the visible read-only overview lifecycle, advanced column view, column or window sizing, scrolling, mixed primary application fixtures, or the repeated real-application lifecycle pool.\n' >&2
        failed=true

        if [[ -f "$diagnostics_file" ]]; then
          sed 's/^/  /' "$diagnostics_file" >&2
        fi
      fi

      if [[ "$failed" == true ]]; then
        stop_vm || true
        return 1
      fi

      stop_vm || true
      return 0
    fi

    sleep 0.2
  done

  printf 'The VM did not report Driftile status within 360 seconds.\n' >&2
  stop_vm || true
  return 1
}

monitor_two_head_guest() {
  local attempt
  local diagnostics_file="$temporary_directory/xchg/driftile-two-head-diagnostics"
  local drag_name
  local probe_name
  local ready_file
  local result_file="$temporary_directory/xchg/driftile-two-head-verified"
  local sent_file
  local -A drags_sent=(
    [fallback]=false
    [insert]=false
  )
  local -A probes_sent=(
    [left]=false
    [right]=false
  )

  for ((attempt = 0; attempt < 1800; attempt += 1)); do
    for probe_name in left right; do
      ready_file="$temporary_directory/xchg/driftile-two-head-pointer-probe-$probe_name-ready"
      sent_file="$temporary_directory/xchg/driftile-two-head-pointer-probe-$probe_name-sent"

      if [[ "${probes_sent[$probe_name]}" == false && -f "$ready_file" ]]; then
        if ! send_two_head_pointer_probe "$ready_file"; then
          printf 'Could not map the absolute pointer on the %s VM output.\n' \
            "$probe_name" >&2
          stop_vm || true
          return 1
        fi

        : > "$sent_file"
        probes_sent[$probe_name]=true
      fi
    done

    for drag_name in insert fallback; do
      ready_file="$temporary_directory/xchg/driftile-two-head-pointer-drag-$drag_name-ready"
      sent_file="$temporary_directory/xchg/driftile-two-head-pointer-drag-$drag_name-sent"

      if [[ "${drags_sent[$drag_name]}" == false && -f "$ready_file" ]]; then
        if ! send_two_head_pointer_drag "$ready_file"; then
          printf 'Could not send the two-output physical pointer drag: %s.\n' \
            "$drag_name" >&2
          stop_vm || true
          return 1
        fi

        : > "$sent_file"
        drags_sent[$drag_name]=true
      fi
    done

    if [[ -f "$result_file" ]]; then
      if [[ "$(<"$result_file")" == true ]]; then
        printf 'The two-output VM verified targeted insertion and empty-output fallback.\n'
        stop_vm || true
        return 0
      fi

      printf 'The two-output VM checkpoint failed.\n' >&2

      if [[ -f "$diagnostics_file" ]]; then
        sed 's/^/  /' "$diagnostics_file" >&2
      fi

      stop_vm || true
      return 1
    fi

    sleep 0.2
  done

  printf 'The two-output VM did not report status within 360 seconds.\n' >&2
  stop_vm || true
  return 1
}

report_lifecycle_progress() {
  local diagnostics_file=$1
  local first_line=$2
  local last_line=$3

  if ((last_line < first_line)); then
    return
  fi

  sed -n "${first_line},${last_line}p" "$diagnostics_file" \
    | sed 's/^/Lifecycle VM: /'
}

monitor_lifecycle_guest() {
  local attempt
  local current_lines
  local diagnostics_file="$temporary_directory/xchg/driftile-lifecycle-diagnostics"
  local reported_lines=0
  local result_file="$temporary_directory/xchg/driftile-lifecycle-verified"

  for ((attempt = 0; attempt < 1800; attempt += 1)); do
    if [[ -f "$diagnostics_file" ]]; then
      current_lines=$(wc -l < "$diagnostics_file")

      if ((current_lines > reported_lines)); then
        report_lifecycle_progress \
          "$diagnostics_file" \
          "$((reported_lines + 1))" \
          "$current_lines"
        reported_lines=$current_lines
      fi
    fi

    if [[ -f "$result_file" ]]; then
      if [[ -f "$diagnostics_file" ]]; then
        current_lines=$(wc -l < "$diagnostics_file")

        if ((current_lines > reported_lines)); then
          report_lifecycle_progress \
            "$diagnostics_file" \
            "$((reported_lines + 1))" \
            "$current_lines"
          reported_lines=$current_lines
        fi
      fi

      if [[ "$(<"$result_file")" == true ]]; then
        printf 'The release lifecycle VM checkpoint passed.\n'
        stop_vm || true
        return 0
      fi

      printf 'The release lifecycle VM checkpoint failed.\n' >&2
      stop_vm || true
      return 1
    fi

    sleep 0.2
  done

  printf 'The release lifecycle VM did not report status within 360 seconds.\n' >&2

  if [[ -f "$diagnostics_file" ]]; then
    report_lifecycle_progress \
      "$diagnostics_file" \
      "$((reported_lines + 1))" \
      "$(wc -l < "$diagnostics_file")" >&2
  fi

  stop_vm || true
  return 1
}

qmp_command_response() {
  [[ -S "$qmp_socket" ]] || return 1
  printf '%s\n' "$@" \
    | nix develop .#integration -c socat -t 2 - "UNIX-CONNECT:$qmp_socket"
}

validate_qmp_response() {
  local command
  local expected_returns=$1
  local response=$2
  local return_count=0

  while IFS= read -r command; do
    if [[ "$command" == *'"error"'* ]]; then
      printf 'QMP rejected an input command: %s\n' "$command" >&2
      return 1
    fi

    if [[ "$command" == *'"return"'* ]]; then
      return_count=$((return_count + 1))
    fi
  done <<< "$response"

  ((return_count == expected_returns))
}

send_qmp_commands() {
  local response

  response=$(qmp_command_response "$@") || return 1
  validate_qmp_response "$#" "$response"
}

absolute_pointer_available() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local query='{"execute":"query-mice"}'
  local response

  response=$(qmp_command_response "$capabilities" "$query") || return 1
  validate_qmp_response 2 "$response" || return 1
  [[ "$response" =~ \"absolute\"[[:space:]]*:[[:space:]]*true ]]
}

absolute_pointer_coordinate() {
  local coordinate=$1
  local extent=$3
  local origin=$2
  local relative

  [[ "$coordinate" =~ ^-?[0-9]+$ \
    && "$origin" =~ ^-?[0-9]+$ \
    && "$extent" =~ ^[1-9][0-9]*$ ]] || return 1
  ((extent > 1)) || return 1
  relative=$((coordinate - origin))
  ((relative >= 0 && relative < extent)) || return 1
  printf '%s' "$(((relative * 32767 + ((extent - 1) / 2)) / (extent - 1)))"
}

send_absolute_pointer_position() {
  local x=$1
  local y=$2
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  ((x >= 0 && x <= 32767 && y >= 0 && y <= 32767)) || return 1
  input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$y}}]}}"
  send_qmp_commands "$capabilities" "$input"
}

send_two_head_pointer_probe() {
  local absolute_x
  local absolute_y
  local coordinate_file=$1
  local extra
  local head
  local output_height
  local output_width
  local output_x
  local output_y
  local x
  local y

  IFS=' ' read -r \
    head \
    x \
    y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file" || return 1
  [[ -z "${extra:-}" ]] || return 1
  [[ "$head" =~ ^[01]$ ]] || return 1
  absolute_x=$(absolute_pointer_coordinate \
    "$x" "$two_head_desktop_x" "$two_head_desktop_width") || return 1
  absolute_y=$(absolute_pointer_coordinate \
    "$y" "$two_head_desktop_y" "$two_head_desktop_height") || return 1

  ((x >= output_x && x < output_x + output_width \
    && y >= output_y && y < output_y + output_height)) || return 1

  absolute_pointer_available \
    && send_absolute_pointer_position "$absolute_x" "$absolute_y"
}

send_two_head_pointer_drag() {
  local coordinate_file=$1
  local destination_absolute_x
  local destination_absolute_y
  local destination_head
  local destination_height
  local destination_width
  local destination_x
  local destination_y
  local destination_output_x
  local destination_output_y
  local edge_absolute_x
  local edge_absolute_y
  local edge_x
  local edge_y
  local extra
  local result=0
  local source_absolute_x
  local source_absolute_y
  local source_head
  local source_height
  local source_width
  local source_x
  local source_y
  local source_output_x
  local source_output_y

  IFS=' ' read -r \
    source_head \
    source_x \
    source_y \
    source_output_x \
    source_output_y \
    source_width \
    source_height \
    destination_head \
    destination_x \
    destination_y \
    destination_output_x \
    destination_output_y \
    destination_width \
    destination_height \
    extra < "$coordinate_file" || return 1
  [[ -z "${extra:-}" ]] || return 1
  [[ "$source_head" =~ ^[01]$ \
    && "$destination_head" =~ ^[01]$ ]] || return 1

  source_absolute_x=$(absolute_pointer_coordinate \
    "$source_x" "$two_head_desktop_x" "$two_head_desktop_width") || return 1
  source_absolute_y=$(absolute_pointer_coordinate \
    "$source_y" "$two_head_desktop_y" "$two_head_desktop_height") || return 1
  destination_absolute_x=$(absolute_pointer_coordinate \
    "$destination_x" "$two_head_desktop_x" "$two_head_desktop_width") \
    || return 1
  destination_absolute_y=$(absolute_pointer_coordinate \
    "$destination_y" "$two_head_desktop_y" "$two_head_desktop_height") \
    || return 1

  ((source_x >= source_output_x \
    && source_x < source_output_x + source_width \
    && source_y >= source_output_y \
    && source_y < source_output_y + source_height \
    && destination_x >= destination_output_x \
    && destination_x < destination_output_x + destination_width \
    && destination_y >= destination_output_y \
    && destination_y < destination_output_y + destination_height)) || return 1

  if ((destination_x > source_x)); then
    edge_x=$((source_output_x + source_width - 2))
  else
    edge_x=$((source_output_x + 1))
  fi

  edge_y=$source_y
  edge_absolute_x=$(absolute_pointer_coordinate \
    "$edge_x" "$two_head_desktop_x" "$two_head_desktop_width") || return 1
  edge_absolute_y=$(absolute_pointer_coordinate \
    "$edge_y" "$two_head_desktop_y" "$two_head_desktop_height") || return 1

  absolute_pointer_available || return 1
  set_physical_pointer_drag_state false || return 1
  send_absolute_pointer_position \
    "$source_absolute_x" "$source_absolute_y" \
    || result=1
  sleep 0.1

  if ((result == 0)); then
    set_physical_pointer_drag_state true || result=1
  fi
  sleep 0.1

  if ((result == 0)); then
    send_absolute_pointer_position \
      "$edge_absolute_x" "$edge_absolute_y" \
      || result=1
  fi
  sleep 0.1

  if ((result == 0)); then
    send_absolute_pointer_position \
      "$destination_absolute_x" "$destination_absolute_y" \
      || result=1
  fi
  sleep 0.1

  set_physical_pointer_drag_state false || result=1
  return "$result"
}

set_physical_pointer_drag_state() {
  local down=$1
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  [[ "$down" == true || "$down" == false ]] || return 1

  if [[ "$down" == true ]]; then
    input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"btn","data":{"down":true,"button":"left"}}]}}'
  else
    input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  fi

  send_qmp_commands "$capabilities" "$input"
}

send_physical_pointer_drag() {
  local coordinate_file=$1
  local destination_x
  local destination_y
  local end_absolute_x
  local end_absolute_y
  local extra
  local intermediate_x
  local intermediate_y
  local middle_absolute_x
  local middle_absolute_y
  local output_height
  local output_width
  local output_x
  local output_y
  local result=0
  local start_absolute_x
  local start_absolute_y
  local start_x
  local start_y

  IFS=' ' read -r \
    start_x \
    start_y \
    destination_x \
    destination_y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file" || return 1
  [[ -z "${extra:-}" ]] || return 1

  start_absolute_x=$(absolute_pointer_coordinate \
    "$start_x" "$output_x" "$output_width") || return 1
  start_absolute_y=$(absolute_pointer_coordinate \
    "$start_y" "$output_y" "$output_height") || return 1
  end_absolute_x=$(absolute_pointer_coordinate \
    "$destination_x" "$output_x" "$output_width") || return 1
  end_absolute_y=$(absolute_pointer_coordinate \
    "$destination_y" "$output_y" "$output_height") || return 1
  intermediate_x=$(((start_x + destination_x) / 2))
  intermediate_y=$(((start_y + destination_y) / 2))
  middle_absolute_x=$(absolute_pointer_coordinate \
    "$intermediate_x" "$output_x" "$output_width") || return 1
  middle_absolute_y=$(absolute_pointer_coordinate \
    "$intermediate_y" "$output_y" "$output_height") || return 1

  absolute_pointer_available || return 1
  set_physical_pointer_drag_state false || return 1

  if ! send_absolute_pointer_position "$start_absolute_x" "$start_absolute_y"; then
    result=1
  fi
  sleep 0.1

  if ((result == 0)) && ! set_physical_pointer_drag_state true; then
    result=1
  fi
  sleep 0.1

  if ((result == 0)) \
    && ! send_absolute_pointer_position \
      "$middle_absolute_x" "$middle_absolute_y"; then
    result=1
  fi
  sleep 0.1

  if ((result == 0)) \
    && ! send_absolute_pointer_position "$end_absolute_x" "$end_absolute_y"; then
    result=1
  fi
  sleep 0.1

  set_physical_pointer_drag_state false || result=1
  return "$result"
}

send_physical_shortcut() {
  local key_name=$1
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  case "$key_name" in
    bracket-right)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"bracket_right"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"bracket_right"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-1)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"1"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"1"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-9)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"9"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"9"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-ctrl-2)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"2"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"2"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-ctrl-9)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"9"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"9"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-next-page-down)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"pgdn"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"pgdn"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-move-down)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-move-down-page-down)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"pgdn"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"pgdn"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-move-up)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"i"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"i"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-move-up-page-up)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"pgup"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"pgup"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    home|floating-home)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"home"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"home"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    end|floating-end)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"end"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"end"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-home)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"home"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"home"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-end)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"end"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"end"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    comma|minimized-consume)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"comma"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"comma"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    period|minimized-expel)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"dot"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"dot"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    preset-next|preset-next-wrap)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    preset-back-wrap)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-left)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"h"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"h"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-right)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"l"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"l"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-up)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"k"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"k"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-down)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-desktop-next)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    minus)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    equal)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-minus)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-equal)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-shift-r)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-r)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-f)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-c)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"c"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"c"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-j)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-k)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"k"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"k"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-f-enter|shift-f-exit|stacked-shift-f-enter|stacked-shift-f-exit)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-v-floating|shift-v-tiling)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"v"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"v"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    m-enter|m-exit|stacked-m-enter|stacked-m-exit)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    *)
      return 1
      ;;
  esac

  send_qmp_commands "$capabilities" "$input"
}

stop_vm() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local quit='{"execute":"quit"}'

  [[ -S "$qmp_socket" ]] || return 1
  printf '%s\n%s\n' "$capabilities" "$quit" \
    | nix develop .#integration -c socat -t 2 - "UNIX-CONNECT:$qmp_socket" \
      >/dev/null 2>&1
}

trap cleanup EXIT

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  printf 'A graphical session is required to show the VM window.\n' >&2
  exit 1
fi

cd -- "$root_directory"
nixos-rebuild build-vm --flake ".#$flake_configuration"

if ! prepare_host_window; then
  printf 'Could not request the initial VM window size from host KWin.\n' >&2
fi

case "$vm_mode" in
  lifecycle) monitor_lifecycle_guest & ;;
  two-head) monitor_two_head_guest & ;;
  *) monitor_guest & ;;
esac
status_monitor_pid=$!

vm_status=0

set +e
if [[ "$vm_mode" == two-head ]]; then
  QEMU_OPTS="-qmp unix:$qmp_socket,server=on,wait=off" \
    SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS=0 \
    USE_TMPDIR=1 TMPDIR="$temporary_directory" \
    "./result/bin/$vm_runner"
else
  QEMU_OPTS="-qmp unix:$qmp_socket,server=on,wait=off" \
    USE_TMPDIR=1 TMPDIR="$temporary_directory" \
    "./result/bin/$vm_runner"
fi
vm_status=$?
wait "$status_monitor_pid"
monitor_status=$?
set -e

status_monitor_pid=""

if ((vm_status != 0)); then
  exit "$vm_status"
fi

exit "$monitor_status"
