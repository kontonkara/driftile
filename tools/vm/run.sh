#!/usr/bin/env bash

set -euo pipefail

root_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
temporary_directory=$(mktemp -d -t driftile-vm.XXXXXXXXXX)
host_script_loaded=false
readonly host_script_name="io.github.kontonkara.driftile.vm-window"
readonly qmp_socket="$temporary_directory/qmp.sock"
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
        printf 'The VM verified physical shortcut and pointer routing, desktop switching and reordering, minimized-slot navigation, column reordering, horizontal extraction, consume and expel past minimized peers, native fullscreen and maximize, stacked fullscreen and maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, output transfers, floating-layer navigation, focus, stack editing and pointer reinsertion, advanced column view, column and window sizing, scrolling, mixed Konsole, Firefox, KDE Calculator, XWayland xterm, and fixed-size XWayland fixtures, plus repeated real-application lifecycles.\n'
      else
        printf 'The VM failed to verify physical shortcut or pointer routing, desktop switching or reordering, minimized-slot navigation, column reordering, horizontal extraction, consume or expel past minimized peers, native fullscreen or maximize, stacked fullscreen or maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, output transfers, floating-layer navigation, focus, stack editing or pointer reinsertion, advanced column view, column or window sizing, scrolling, mixed primary application fixtures, or the repeated real-application lifecycle pool.\n' >&2
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
nixos-rebuild build-vm --flake .#driftile-vm

if ! prepare_host_window; then
  printf 'Could not request the initial VM window size from host KWin.\n' >&2
fi

monitor_guest &
status_monitor_pid=$!

vm_status=0

set +e
QEMU_OPTS="-qmp unix:$qmp_socket,server=on,wait=off" \
  USE_TMPDIR=1 TMPDIR="$temporary_directory" \
  ./result/bin/run-driftile-vm-vm
vm_status=$?
wait "$status_monitor_pid"
monitor_status=$?
set -e

status_monitor_pid=""

if ((vm_status != 0)); then
  exit "$vm_status"
fi

exit "$monitor_status"
