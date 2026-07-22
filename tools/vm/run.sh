#!/usr/bin/env bash

set -euo pipefail

vm_mode=full
vm_mode_set=false
vm_visibility=visible
vm_visibility_set=false

usage() {
  printf 'Usage: %s [full|two-head|lifecycle] [--hidden]\n' "$0" >&2
}

for argument in "$@"; do
  case "$argument" in
    full | two-head | lifecycle)
      if [[ "$vm_mode_set" == true ]]; then
        usage
        exit 2
      fi

      vm_mode=$argument
      vm_mode_set=true
      ;;
    --hidden)
      if [[ "$vm_visibility_set" == true ]]; then
        usage
        exit 2
      fi

      vm_visibility=hidden
      vm_visibility_set=true
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

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
    usage
    exit 2
    ;;
esac

root_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
temporary_directory=$(mktemp -d -t driftile-vm.XXXXXXXXXX)
host_script_loaded=false
readonly host_script_name="io.github.kontonkara.driftile.vm-window"
readonly qmp_socket="$temporary_directory/qmp.sock"
qemu_options="-qmp unix:$qmp_socket,server=on,wait=off"

if [[ "$vm_visibility" == hidden ]]; then
  qemu_options+=" -display none"
fi

readonly qemu_options
readonly two_head_desktop_height=768
readonly two_head_desktop_width=1376
readonly two_head_desktop_x=0
readonly two_head_desktop_y=0
owned_qemu_exit_status=0
owned_qemu_pid=""
owned_qemu_process_active=false
owned_qemu_start_time=""
overview_zoom_node_executable=""
overview_zoom_socat_executable=""
status_monitor_pid=""

# shellcheck disable=SC2329
cleanup() {
  trap '' INT TERM

  if [[ "$owned_qemu_process_active" == true ]]; then
    shutdown_owned_qemu_process >/dev/null 2>&1 || true
  elif [[ -S "$qmp_socket" ]]; then
    set_physical_pointer_drag_state false >/dev/null 2>&1 || true
  fi

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

resolve_overview_zoom_node_executable() {
  local executable

  executable=$(nix develop -c bash -c 'command -v node') || return 1
  [[ "$executable" == /* \
    && "$executable" != *$'\n'* \
    && -x "$executable" ]] || return 1
  printf '%s' "$executable"
}

resolve_overview_zoom_socat_executable() {
  local executable

  executable=$(nix develop .#integration -c bash -c 'command -v socat') \
    || return 1
  [[ "$executable" == /* \
    && "$executable" != *$'\n'* \
    && -x "$executable" ]] || return 1
  printf '%s' "$executable"
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
  local desktop_pointer_hold_ready_file="$temporary_directory/xchg/driftile-cross-desktop-pointer-hold-ready"
  local desktop_pointer_held_file="$temporary_directory/xchg/driftile-cross-desktop-pointer-held"
  local desktop_pointer_release_ready_file="$temporary_directory/xchg/driftile-cross-desktop-pointer-release-ready"
  local desktop_pointer_released_file="$temporary_directory/xchg/driftile-cross-desktop-pointer-released"
  local desktop_pointer_held=false
  local desktop_pointer_released=false
  local diagnostics_file="$temporary_directory/xchg/driftile-focus-diagnostics"
  local failed=false
  local focus_file="$temporary_directory/xchg/driftile-focus-verified"
  local key_name
  local key_ready_file
  local key_sent_file
  local loaded_file="$temporary_directory/xchg/driftile-loaded"
  local pointer_drag_name
  local pointer_ready_file
  local pointer_resize_ready_file
  local pointer_resize_sent=false
  local pointer_resize_sent_file
  local pointer_sent_file
  local overview_desktop_drag_ready_file="$temporary_directory/xchg/driftile-overview-desktop-drag-ready"
  local overview_desktop_drag_sent=false
  local overview_desktop_drag_sent_file="$temporary_directory/xchg/driftile-overview-desktop-drag-sent"
  local overview_tab_drag_ready_file="$temporary_directory/xchg/driftile-overview-tab-drag-ready"
  local overview_tab_drag_sent=false
  local overview_tab_drag_sent_file="$temporary_directory/xchg/driftile-overview-tab-drag-sent"
  local overview_tab_restore_ready_file="$temporary_directory/xchg/driftile-overview-tab-restore-ready"
  local overview_tab_restore_sent=false
  local overview_tab_restore_sent_file="$temporary_directory/xchg/driftile-overview-tab-restore-sent"
  local overview_wheel_controls_ready_file="$temporary_directory/xchg/driftile-overview-wheel-controls-ready"
  local overview_wheel_controls_sent=false
  local overview_wheel_controls_sent_file="$temporary_directory/xchg/driftile-overview-wheel-controls-sent"
  local overview_window_drop_ready_file="$temporary_directory/xchg/driftile-overview-window-drop-ready"
  local overview_window_drop_sent=false
  local overview_window_drop_sent_file="$temporary_directory/xchg/driftile-overview-window-drop-sent"
  local overview_workspace_create_ready_file="$temporary_directory/xchg/driftile-overview-workspace-create-ready"
  local overview_workspace_create_sent=false
  local overview_workspace_create_sent_file="$temporary_directory/xchg/driftile-overview-workspace-create-sent"
  local wheel_control_ready_file="$temporary_directory/xchg/driftile-wheel-control-ready"
  local wheel_control_sent=false
  local wheel_control_sent_file="$temporary_directory/xchg/driftile-wheel-control-sent"
  local -A keys_sent=(
    [bracket-right]=false
    [close-window]=false
    [comma]=false
    [ctrl-c]=false
    [ctrl-end]=false
    [ctrl-f]=false
    [ctrl-home]=false
    [ctrl-j]=false
    [ctrl-k]=false
    [ctrl-r]=false
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
    [floating-center]=false
    [floating-desktop-next]=false
    [floating-end]=false
    [floating-home]=false
    [floating-left]=false
    [floating-move-down]=false
    [floating-move-left]=false
    [floating-move-right]=false
    [floating-move-up]=false
    [floating-right]=false
    [floating-up]=false
    [floating-width-equal]=false
    [floating-width-minus]=false
    [height-preset-next]=false
    [home]=false
    [m-enter]=false
    [m-exit]=false
    [minus]=false
    [minimized-consume]=false
    [minimized-expel]=false
    [overview-enter-initial]=false
    [overview-enter-target]=false
    [overview-escape]=false
    [overview-reorder-escape]=false
    [overview-tab-drag-escape]=false
    [overview-window-drop-escape]=false
    [overview-workspace-begin-rename]=false
    [overview-workspace-close]=false
    [overview-workspace-remove]=false
    [overview-workspace-select-created]=false
    [overview-workspace-submit-rename]=false
    [overview-open]=false
    [overview-search-close]=false
    [overview-search-edit]=false
    [overview-search-query]=false
    [overview-up]=false
    [period]=false
    [preset-back]=false
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
    [tabbed-enter]=false
    [tabbed-exit]=false
  )
  local -A pointer_drags_sent=(
    [cross-column]=false
    [manual-floating]=false
    [same-stack]=false
  )

  for ((attempt = 0; attempt < 4500; attempt += 1)); do
    for key_name in \
      bracket-right \
      close-window \
      home \
      end \
      ctrl-home \
      ctrl-end \
      comma \
      period \
      preset-next \
      preset-next-wrap \
      preset-back \
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
      overview-open \
      overview-search-query \
      overview-search-edit \
      overview-search-close \
      overview-enter-initial \
      overview-up \
      overview-enter-target \
      overview-escape \
      overview-reorder-escape \
      overview-tab-drag-escape \
      overview-window-drop-escape \
      overview-workspace-select-created \
      overview-workspace-begin-rename \
      overview-workspace-submit-rename \
      overview-workspace-remove \
      overview-workspace-close \
      equal \
      shift-minus \
      shift-equal \
      height-preset-next \
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
      floating-width-minus \
      floating-width-equal \
      floating-center \
      floating-move-left \
      floating-move-up \
      floating-move-right \
      floating-move-down \
      floating-desktop-next \
      stacked-m-enter \
      stacked-m-exit \
      stacked-shift-f-enter \
      stacked-shift-f-exit \
      tabbed-enter \
      tabbed-exit \
      shift-f-enter \
      shift-f-exit \
      m-enter \
      m-exit; do
      key_ready_file="$temporary_directory/xchg/driftile-key-test-$key_name-ready"
      key_sent_file="$temporary_directory/xchg/driftile-key-test-$key_name-sent"

      if [[ "${keys_sent[$key_name]}" == false && -f "$key_ready_file" ]]; then
        if ! send_physical_shortcut "$key_name"; then
          printf 'Could not send the physical shortcut: %s.\n' "$key_name" >&2
          finish_full_vm_monitor || true
          return 1
        fi

        printf 'The VM received the physical shortcut: %s.\n' "$key_name"
        : > "$key_sent_file"
        keys_sent[$key_name]=true
      fi
    done

    if [[ "$wheel_control_sent" == false \
      && -f "$wheel_control_ready_file" ]]; then
      if ! send_physical_wheel_control "$wheel_control_ready_file"; then
        printf 'Could not send the physical wheel control checkpoint.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical wheel control checkpoint.\n'
      : > "$wheel_control_sent_file"
      wheel_control_sent=true
    fi

    for pointer_drag_name in manual-floating cross-column same-stack; do
      pointer_ready_file="$temporary_directory/xchg/driftile-pointer-drag-$pointer_drag_name-ready"
      pointer_sent_file="$temporary_directory/xchg/driftile-pointer-drag-$pointer_drag_name-sent"

      if [[ "${pointer_drags_sent[$pointer_drag_name]}" == false \
        && -f "$pointer_ready_file" ]]; then
        if ! send_physical_pointer_drag "$pointer_ready_file"; then
          printf 'Could not send the physical pointer drag: %s.\n' \
            "$pointer_drag_name" >&2
          finish_full_vm_monitor || true
          return 1
        fi

        printf 'The VM received the physical pointer drag: %s.\n' \
          "$pointer_drag_name"
        : > "$pointer_sent_file"
        pointer_drags_sent[$pointer_drag_name]=true
      fi
    done

    if [[ "$overview_desktop_drag_sent" == false \
      && -f "$overview_desktop_drag_ready_file" ]]; then
      if ! send_plain_pointer_drag "$overview_desktop_drag_ready_file"; then
        printf 'Could not send the physical overview desktop drag.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical overview desktop drag.\n'
      : > "$overview_desktop_drag_sent_file"
      overview_desktop_drag_sent=true
    fi

    if [[ "$overview_window_drop_sent" == false \
      && -f "$overview_window_drop_ready_file" ]]; then
      if ! send_plain_pointer_drag "$overview_window_drop_ready_file"; then
        printf 'Could not send the physical overview window drop.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical overview window drop.\n'
      : > "$overview_window_drop_sent_file"
      overview_window_drop_sent=true
    fi

    if [[ "$overview_tab_drag_sent" == false \
      && -f "$overview_tab_drag_ready_file" ]]; then
      if ! send_plain_pointer_drag "$overview_tab_drag_ready_file"; then
        printf 'Could not drag the physical Overview tab control.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical Overview tab drag.\n'
      : > "$overview_tab_drag_sent_file"
      overview_tab_drag_sent=true
    fi

    if [[ "$overview_tab_restore_sent" == false \
      && -f "$overview_tab_restore_ready_file" ]]; then
      if ! send_plain_pointer_click "$overview_tab_restore_ready_file"; then
        printf 'Could not click the physical Overview minimized-tab control.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical Overview minimized-tab click.\n'
      : > "$overview_tab_restore_sent_file"
      overview_tab_restore_sent=true
    fi

    if [[ "$overview_workspace_create_sent" == false \
      && -f "$overview_workspace_create_ready_file" ]]; then
      if ! send_plain_pointer_click "$overview_workspace_create_ready_file"; then
        printf 'Could not click the physical Overview workspace create control.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical Overview workspace create click.\n'
      : > "$overview_workspace_create_sent_file"
      overview_workspace_create_sent=true
    fi

    if [[ "$overview_wheel_controls_sent" == false \
      && -f "$overview_wheel_controls_ready_file" ]]; then
      if ! send_physical_overview_wheel_controls \
        "$overview_wheel_controls_ready_file"; then
        printf 'Could not verify the physical overview zoom, vertical, and horizontal controls.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical overview zoom, vertical, and horizontal controls.\n'
      : > "$overview_wheel_controls_sent_file"
      overview_wheel_controls_sent=true
    fi

    pointer_resize_ready_file="$temporary_directory/xchg/driftile-pointer-resize-horizontal-ready"
    pointer_resize_sent_file="$temporary_directory/xchg/driftile-pointer-resize-horizontal-sent"

    if [[ "$pointer_resize_sent" == false \
      && -f "$pointer_resize_ready_file" ]]; then
      if ! send_physical_pointer_resize "$pointer_resize_ready_file"; then
        printf 'Could not send the physical pointer resize: horizontal.\n' >&2
        finish_full_vm_monitor || true
        return 1
      fi

      printf 'The VM received the physical pointer resize: horizontal.\n'
      : > "$pointer_resize_sent_file"
      pointer_resize_sent=true
    fi

    if [[ "$desktop_pointer_held" == false \
      && "$desktop_pointer_released" == false \
      && -f "$desktop_pointer_hold_ready_file" ]]; then
      if ! send_cross_desktop_pointer_hold \
        "$desktop_pointer_hold_ready_file"; then
        set_physical_pointer_drag_state false >/dev/null 2>&1 || true
        printf 'Could not hold the physical cross-desktop pointer drag at the edge.\n' \
          >&2 || true
        finish_full_vm_monitor || true
        return 1
      fi

      desktop_pointer_held=true

      if ! : > "$desktop_pointer_held_file"; then
        set_physical_pointer_drag_state false >/dev/null 2>&1 || true
        printf 'Could not acknowledge the physical cross-desktop pointer hold.\n' \
          >&2 || true
        finish_full_vm_monitor || true
        return 1
      fi
      rm -f -- "$desktop_pointer_hold_ready_file" || true

      printf 'The VM is holding the physical cross-desktop pointer drag at the edge.\n' \
        || true
    fi

    if [[ "$desktop_pointer_held" == true \
      && "$desktop_pointer_released" == false \
      && -f "$desktop_pointer_release_ready_file" ]]; then
      if ! send_cross_desktop_pointer_release \
        "$desktop_pointer_release_ready_file"; then
        set_physical_pointer_drag_state false >/dev/null 2>&1 || true
        printf 'Could not release the physical cross-desktop pointer drag at the target.\n' \
          >&2 || true
        finish_full_vm_monitor || true
        return 1
      fi

      desktop_pointer_held=false
      desktop_pointer_released=true

      if ! : > "$desktop_pointer_released_file"; then
        set_physical_pointer_drag_state false >/dev/null 2>&1 || true
        printf 'Could not acknowledge the physical cross-desktop pointer release.\n' \
          >&2 || true
        finish_full_vm_monitor || true
        return 1
      fi
      rm -f -- "$desktop_pointer_release_ready_file" || true

      printf 'The VM released the physical cross-desktop pointer drag at the target.\n' \
        || true
    fi

    if [[ -f "$loaded_file" && -f "$focus_file" ]]; then
      if [[ "$(<"$loaded_file")" == true ]]; then
        printf 'The VM reports that Driftile loaded successfully.\n'
      else
        printf 'The VM reports that Driftile failed to load.\n' >&2
        failed=true
      fi

      if [[ "$(<"$focus_file")" == true ]]; then
        printf 'The VM verified physical shortcut and pointer routing, global wheel controls, physical Meta+Q close-window handling, desktop switching and reordering, same-output cross-desktop pointer adoption, minimized-slot navigation, column reordering, horizontal extraction, consume and expel past minimized peers, native fullscreen and maximize, stacked fullscreen and maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, manual-floating pointer retention, output transfers, floating-layer navigation, focus, stack editing, pointer reinsertion and horizontal pointer-resize adoption, live touchpad-navigation settings, physical overview keyboard, minimized-tab restoration and visible-tab spatial drag, session zoom, and vertical- and horizontal-wheel navigation, advanced column view, column and window sizing, scrolling, mixed Konsole, Firefox, KDE Calculator, XWayland xterm, and fixed-size XWayland fixtures, plus repeated real-application lifecycles.\n'
      else
        printf 'The VM failed to verify physical shortcut or pointer routing, global wheel controls, physical Meta+Q close-window handling, desktop switching or reordering, same-output cross-desktop pointer adoption, minimized-slot navigation, column reordering, horizontal extraction, consume or expel past minimized peers, native fullscreen or maximize, stacked fullscreen or maximize extraction past minimized peers, borderless ownership, numbered dynamic desktops, whole-column desktop transfer past a minimized member, floating desktop transfers, manual-floating pointer retention, output transfers, floating-layer navigation, focus, stack editing, pointer reinsertion or horizontal pointer-resize adoption, live touchpad-navigation settings, physical overview keyboard, minimized-tab restoration or visible-tab spatial drag, session zoom, or vertical- and horizontal-wheel navigation, advanced column view, column or window sizing, scrolling, mixed primary application fixtures, or the repeated real-application lifecycle pool.\n' >&2
        failed=true

        if [[ -f "$diagnostics_file" ]]; then
          sed 's/^/  /' "$diagnostics_file" >&2
        fi
      fi

      if [[ "$failed" == true ]]; then
        set_physical_pointer_drag_state false >/dev/null 2>&1 || true
        finish_full_vm_monitor || true
        return 1
      fi

      set_physical_pointer_drag_state false >/dev/null 2>&1 || true
      finish_full_vm_monitor || return 1
      return 0
    fi

    sleep 0.2
  done

  printf 'The VM did not report Driftile status within 900 seconds.\n' >&2
  set_physical_pointer_drag_state false >/dev/null 2>&1 || true
  finish_full_vm_monitor || true
  return 1
}

monitor_two_head_guest() {
  local attempt
  local diagnostics_file="$temporary_directory/xchg/driftile-two-head-diagnostics"
  local drag_name
  local plain_drag
  local probe_name
  local ready_file
  local result_file="$temporary_directory/xchg/driftile-two-head-verified"
  local sent_file
  local -A drags_sent=(
    [fallback]=false
    [insert]=false
    [overview-insert]=false
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

    for drag_name in insert fallback overview-insert; do
      ready_file="$temporary_directory/xchg/driftile-two-head-pointer-drag-$drag_name-ready"
      sent_file="$temporary_directory/xchg/driftile-two-head-pointer-drag-$drag_name-sent"

      if [[ "${drags_sent[$drag_name]}" == false && -f "$ready_file" ]]; then
        plain_drag=false
        [[ "$drag_name" == overview-insert ]] && plain_drag=true
        if ! send_two_head_pointer_drag \
          "$ready_file" \
          "$plain_drag"; then
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
        printf 'The two-output VM verified targeted insertion, empty-output fallback, and exact Overview insertion.\n'
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

read_qmp_command_return() {
  local attempt
  local file_descriptor=$1
  local line

  for ((attempt = 0; attempt < 20; attempt += 1)); do
    IFS= read -r -t 2 -u "$file_descriptor" line || return 1
    if [[ "$line" == *'"error"'* ]]; then
      printf 'QMP rejected an Overview transition command: %s\n' \
        "$line" >&2
      return 1
    fi
    [[ "$line" == *'"return"'* ]] && return 0
  done

  return 1
}

absolute_pointer_available() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local current_then_absolute='[{][^{}]*"current"[[:space:]]*:[[:space:]]*true[^{}]*"absolute"[[:space:]]*:[[:space:]]*true[^{}]*[}]'
  local query='{"execute":"query-mice"}'
  local response
  local absolute_then_current='[{][^{}]*"absolute"[[:space:]]*:[[:space:]]*true[^{}]*"current"[[:space:]]*:[[:space:]]*true[^{}]*[}]'

  response=$(qmp_command_response "$capabilities" "$query") || return 1
  validate_qmp_response 2 "$response" || return 1
  [[ "$response" =~ $current_then_absolute \
    || "$response" =~ $absolute_then_current ]]
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

capture_qmp_screendump() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local output_file=$1
  local screendump

  [[ "$output_file" == "$temporary_directory"/* \
    && "$output_file" =~ ^[-./_[:alnum:]]+$ ]] || return 1
  rm -f -- "$output_file"
  screendump="{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"$output_file\"}}"
  send_qmp_commands "$capabilities" "$screendump" || return 1
  [[ -s "$output_file" ]]
}

capture_interrupted_overview_close() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local close_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  local close_render_delay_seconds=0.14
  local image_file=$1
  local qmp_pid
  local qmp_read_descriptor
  local qmp_write_descriptor
  local result=0
  local screendump

  [[ "$image_file" == "$temporary_directory"/* \
    && "$image_file" =~ ^[-./_[:alnum:]]+$ \
    && -x "$overview_zoom_socat_executable" ]] || return 1
  rm -f -- "$image_file"
  screendump="{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"$image_file\"}}"

  if ! coproc OVERVIEW_ZOOM_QMP {
    "$overview_zoom_socat_executable" \
      -t 2 \
      - \
      "UNIX-CONNECT:$qmp_socket"
  }; then
    return 1
  fi
  qmp_pid=$OVERVIEW_ZOOM_QMP_PID
  qmp_read_descriptor=${OVERVIEW_ZOOM_QMP[0]}
  qmp_write_descriptor=${OVERVIEW_ZOOM_QMP[1]}

  IFS= read -r -t 2 -u "$qmp_read_descriptor" _ || result=1
  if ((result == 0)); then
    printf '%s\n' "$capabilities" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    printf '%s\n' "$close_input" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    sleep "$close_render_delay_seconds"
    printf '%s\n' "$screendump" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    printf '%s\n' "$close_input" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi

  exec {qmp_write_descriptor}>&- || true
  exec {qmp_read_descriptor}<&- || true
  wait "$qmp_pid" || result=1
  ((result == 0)) && [[ -s "$image_file" ]]
}

capture_overview_window_exit_burst() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local enter_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ret"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ret"}}}]}}'
  local frame_delay_seconds=0.02
  local frame_index
  local image_file
  local qmp_pid
  local qmp_read_descriptor
  local qmp_write_descriptor
  local result=0
  local screendump
  local terminal_settle_delay_seconds=0.08
  local -a exit_frame_images=("$@")

  [[ ${#exit_frame_images[@]} -eq 16 \
    && -x "$overview_zoom_socat_executable" ]] || return 1
  for image_file in "${exit_frame_images[@]}"; do
    [[ "$image_file" == "$temporary_directory"/* \
      && "$image_file" =~ ^[-./_[:alnum:]]+$ ]] || return 1
    rm -f -- "$image_file"
  done

  if ! coproc OVERVIEW_EXIT_QMP {
    "$overview_zoom_socat_executable" \
      -t 2 \
      - \
      "UNIX-CONNECT:$qmp_socket"
  }; then
    return 1
  fi
  qmp_pid=$OVERVIEW_EXIT_QMP_PID
  qmp_read_descriptor=${OVERVIEW_EXIT_QMP[0]}
  qmp_write_descriptor=${OVERVIEW_EXIT_QMP[1]}

  IFS= read -r -t 2 -u "$qmp_read_descriptor" _ || result=1
  if ((result == 0)); then
    printf '%s\n' "$capabilities" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    printf '%s\n' "$enter_input" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  for frame_index in "${!exit_frame_images[@]}"; do
    ((result == 0)) || break
    image_file=${exit_frame_images[$frame_index]}
    screendump="{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"$image_file\"}}"
    printf '%s\n' "$screendump" >&"$qmp_write_descriptor" \
      || result=1
    if ((result == 0)); then
      read_qmp_command_return "$qmp_read_descriptor" || result=1
    fi
    if ((result == 0 && frame_index + 1 < ${#exit_frame_images[@]})); then
      if ((frame_index + 2 == ${#exit_frame_images[@]})); then
        sleep "$terminal_settle_delay_seconds"
      else
        sleep "$frame_delay_seconds"
      fi
    fi
  done

  exec {qmp_write_descriptor}>&- || true
  exec {qmp_read_descriptor}<&- || true
  wait "$qmp_pid" || result=1
  ((result == 0)) || return 1
  for image_file in "${exit_frame_images[@]}"; do
    [[ -s "$image_file" ]] || return 1
  done
}

capture_overview_entry_burst() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local candidate_image
  local entry_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  local frame_attempt
  local frame_count=0
  local frame_file
  local frame_manifest=$3
  local frame_suffix
  local last_frame=""
  local marker_prefix
  local maximum_frame_attempts=192
  local maximum_unique_frames=64
  local observed_file
  local qmp_pid
  local qmp_read_descriptor
  local qmp_write_descriptor
  local result=0
  local screendump
  local sent_file
  local terminal_duplicate_image=$2
  local terminal_image=$1
  local verified_file

  [[ "$terminal_image" == "$temporary_directory"/* \
    && "$terminal_image" =~ ^[-./_[:alnum:]]+$ \
    && "$terminal_duplicate_image" == "$temporary_directory"/* \
    && "$terminal_duplicate_image" =~ ^[-./_[:alnum:]]+$ \
    && "$frame_manifest" == "$temporary_directory"/* \
    && "$frame_manifest" =~ ^[-./_[:alnum:]]+$ \
    && -x "$overview_zoom_socat_executable" ]] || return 1

  marker_prefix="$(dirname -- "$terminal_image")/driftile-overview-zoom"
  sent_file="$marker_prefix-fresh-open-sent"
  verified_file="$marker_prefix-fresh-open-verified"
  observed_file="$marker_prefix-fresh-open-observed"
  candidate_image="$(dirname -- "$terminal_image")/driftile-overview-entry-candidate.ppm"
  rm -f -- \
    "$candidate_image" \
    "$frame_manifest" \
    "$observed_file" \
    "$sent_file" \
    "$terminal_duplicate_image" \
    "$terminal_image" \
    "$verified_file"

  if ! coproc OVERVIEW_ENTRY_QMP {
    "$overview_zoom_socat_executable" \
      -t 2 \
      - \
      "UNIX-CONNECT:$qmp_socket"
  }; then
    return 1
  fi
  qmp_pid=$OVERVIEW_ENTRY_QMP_PID
  qmp_read_descriptor=${OVERVIEW_ENTRY_QMP[0]}
  qmp_write_descriptor=${OVERVIEW_ENTRY_QMP[1]}

  IFS= read -r -t 2 -u "$qmp_read_descriptor" _ || result=1
  if ((result == 0)); then
    printf '%s\n' "$capabilities" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    printf '%s\n' "$entry_input" >&"$qmp_write_descriptor" \
      || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    : > "$sent_file" || result=1
  fi

  for ((frame_attempt = 1; \
        result == 0 && frame_attempt <= maximum_frame_attempts; \
        frame_attempt += 1)); do
    rm -f -- "$candidate_image"
    screendump="{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"$candidate_image\"}}"
    printf '%s\n' "$screendump" >&"$qmp_write_descriptor" \
      || result=1
    if ((result == 0)); then
      read_qmp_command_return "$qmp_read_descriptor" || result=1
    fi
    if ((result == 0)) && [[ ! -s "$candidate_image" ]]; then
      result=1
    fi
    if ((result == 0)) && { [[ -z "$last_frame" ]] \
      || ! cmp -s -- "$last_frame" "$candidate_image"; }; then
      frame_count=$((frame_count + 1))
      if ((frame_count > maximum_unique_frames)); then
        printf 'Overview entry produced more than %d distinct captured frames.\n' \
          "$maximum_unique_frames" >&2
        result=1
      else
        printf -v frame_suffix '%03d' "$frame_count"
        frame_file="$(dirname -- "$terminal_image")/driftile-overview-entry-frame-$frame_suffix.ppm"
        mv -- "$candidate_image" "$frame_file" || result=1
        if ((result == 0)); then
          printf '%s\n' "$frame_file" >> "$frame_manifest" || result=1
          last_frame=$frame_file
        fi
      fi
    fi
    if ((result == 0)) && [[ -f "$verified_file" ]]; then
      break
    fi
  done

  if ((result == 0)) && [[ ! -f "$verified_file" ]]; then
    if [[ -f "$observed_file" ]]; then
      printf 'The guest rejected the physical Overview entry probe: %s\n' \
        "$(<"$observed_file")" >&2
    else
      printf 'The guest did not verify the physical Overview entry probe.\n' >&2
    fi
    result=1
  fi
  if ((result == 0 && frame_count < 2)); then
    printf 'Overview entry did not expose enough distinct captured frames.\n' >&2
    result=1
  fi

  for frame_file in "$terminal_image" "$terminal_duplicate_image"; do
    ((result == 0)) || break
    rm -f -- "$frame_file"
    screendump="{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"$frame_file\"}}"
    printf '%s\n' "$screendump" >&"$qmp_write_descriptor" \
      || result=1
    if ((result == 0)); then
      read_qmp_command_return "$qmp_read_descriptor" || result=1
    fi
    if ((result == 0)) && [[ ! -s "$frame_file" ]]; then
      result=1
    fi
  done

  rm -f -- "$candidate_image"
  exec {qmp_write_descriptor}>&- || true
  exec {qmp_read_descriptor}<&- || true
  wait "$qmp_pid" || result=1
  ((result == 0)) && [[ -s "$frame_manifest" ]]
}

wait_for_guest_exchange_file() {
  local attempt
  local path=$1

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    [[ -f "$path" ]] && return 0
    sleep 0.1
  done

  return 1
}

send_physical_wheel_control_phase() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local modifiers_down
  local modifiers_up
  local wheel_input

  case "$1" in
    desktop-next)
      modifiers_down='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-down"}},{"type":"btn","data":{"down":false,"button":"wheel-down"}}]}}'
      modifiers_up='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    desktop-previous)
      modifiers_down='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-up"}},{"type":"btn","data":{"down":false,"button":"wheel-up"}}]}}'
      modifiers_up='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    focus-right)
      modifiers_down='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}}]}}'
      wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-down"}},{"type":"btn","data":{"down":false,"button":"wheel-down"}}]}}'
      modifiers_up='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    focus-left)
      modifiers_down='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}}]}}'
      wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-up"}},{"type":"btn","data":{"down":false,"button":"wheel-up"}}]}}'
      modifiers_up='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    *)
      return 1
      ;;
  esac

  send_qmp_commands "$capabilities" "$modifiers_down" || return 1
  sleep 0.05
  if ! send_qmp_commands "$capabilities" "$wheel_input"; then
    send_qmp_commands "$capabilities" "$modifiers_up" >/dev/null 2>&1 || true
    return 1
  fi
  sleep 0.05
  if ! send_qmp_commands "$capabilities" "$modifiers_up"; then
    sleep 0.05
    send_qmp_commands "$capabilities" "$modifiers_up" >/dev/null 2>&1 || true
    return 1
  fi
}

send_physical_wheel_control() {
  local absolute_x
  local absolute_y
  local exchange_directory
  local extra
  local marker_prefix
  local output_height
  local output_width
  local output_x
  local output_y
  local phase
  local ready_file=$1
  local x
  local y

  [[ -f "$ready_file" ]] || return 1
  IFS=' ' read -r \
    x \
    y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$ready_file" || return 1
  [[ -z "${extra:-}" ]] || return 1
  absolute_x=$(absolute_pointer_coordinate \
    "$x" "$output_x" "$output_width") || return 1
  absolute_y=$(absolute_pointer_coordinate \
    "$y" "$output_y" "$output_height") || return 1

  absolute_pointer_available || return 1
  send_absolute_pointer_position "$absolute_x" "$absolute_y" || return 1
  sleep 0.1

  exchange_directory=$(dirname -- "$ready_file") || return 1
  marker_prefix="$exchange_directory/driftile-wheel-control"

  for phase in \
    desktop-next \
    desktop-previous \
    focus-right \
    focus-left; do
    if ! send_physical_wheel_control_phase "$phase"; then
      printf 'QMP could not send the physical wheel phase: %s.\n' \
        "$phase" >&2
      return 1
    fi
    : > "$marker_prefix-$phase-sent"
    if ! wait_for_guest_exchange_file "$marker_prefix-$phase-verified"; then
      printf 'The guest did not verify the physical wheel phase: %s.\n' \
        "$phase" >&2
      return 1
    fi
    sleep 0.2
  done
}

send_physical_overview_wheel_controls() {
  local absolute_x
  local absolute_y
  local anchor_baseline_duplicate_image
  local anchor_baseline_image
  local anchor_wheel_in_image
  local anchor_wheel_reset_image
  local baseline_image
  local baseline_duplicate_image
  local capabilities='{"execute":"qmp_capabilities"}'
  local configured_reset_image
  local continuity_closing_image
  local continuity_image
  local continuity_seed_image
  local coordinate_file=$1
  local desktop_surface_image
  local entry_probe_report
  local exchange_directory
  local exit_frame_index
  local exit_frame_suffix
  local extra
  local horizontal_wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-right"}},{"type":"btn","data":{"down":false,"button":"wheel-right"}}]}}'
  local key_in_image
  local key_reset_image
  local marker_prefix
  local overview_entry_frame_manifest
  local off_center_absolute_y
  local off_center_y
  local output_height
  local output_width
  local output_x
  local output_y
  local probe_report
  local shift_down_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}}]}}'
  local shift_up_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}}]}}'
  local shifted_wheel_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-down"}},{"type":"btn","data":{"down":false,"button":"wheel-down"}}]}}'
  local settle_seconds=0.05
  local fresh_close_image
  local fresh_open_duplicate_image
  local fresh_open_image
  local fresh_seed_image
  local vertical_wheel_down_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-down"}},{"type":"btn","data":{"down":false,"button":"wheel-down"}}]}}'
  local vertical_wheel_up_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"wheel-up"}},{"type":"btn","data":{"down":false,"button":"wheel-up"}}]}}'
  local wheel_in_image
  local wheel_in_duplicate_image
  local wheel_reset_image
  local x
  local y
  local -a exit_frame_images=()

  IFS=' ' read -r \
    x \
    y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file" || return 1
  [[ -z "${extra:-}" ]] || return 1
  absolute_x=$(absolute_pointer_coordinate \
    "$x" "$output_x" "$output_width") || return 1
  absolute_y=$(absolute_pointer_coordinate \
    "$y" "$output_y" "$output_height") || return 1

  absolute_pointer_available || return 1
  send_absolute_pointer_position "$absolute_x" "$absolute_y" || return 1
  sleep 0.1

  exchange_directory=$(dirname -- "$coordinate_file") || return 1
  baseline_image="$exchange_directory/driftile-overview-zoom-baseline.ppm"
  baseline_duplicate_image="$exchange_directory/driftile-overview-zoom-baseline-duplicate.ppm"
  wheel_in_image="$exchange_directory/driftile-overview-zoom-wheel-in.ppm"
  wheel_in_duplicate_image="$exchange_directory/driftile-overview-zoom-wheel-in-duplicate.ppm"
  wheel_reset_image="$exchange_directory/driftile-overview-zoom-wheel-reset.ppm"
  anchor_baseline_image="$exchange_directory/driftile-overview-zoom-anchor-baseline.ppm"
  anchor_baseline_duplicate_image="$exchange_directory/driftile-overview-zoom-anchor-baseline-duplicate.ppm"
  anchor_wheel_in_image="$exchange_directory/driftile-overview-zoom-anchor-wheel-in.ppm"
  anchor_wheel_reset_image="$exchange_directory/driftile-overview-zoom-anchor-wheel-reset.ppm"
  key_in_image="$exchange_directory/driftile-overview-zoom-key-in.ppm"
  key_reset_image="$exchange_directory/driftile-overview-zoom-key-reset.ppm"
  continuity_seed_image="$exchange_directory/driftile-overview-zoom-continuity-seed.ppm"
  continuity_closing_image="$exchange_directory/driftile-overview-zoom-continuity-closing.ppm"
  continuity_image="$exchange_directory/driftile-overview-zoom-continuity.ppm"
  configured_reset_image="$exchange_directory/driftile-overview-zoom-configured-reset.ppm"
  fresh_seed_image="$exchange_directory/driftile-overview-zoom-fresh-seed.ppm"
  fresh_close_image="$exchange_directory/driftile-overview-zoom-fresh-close.ppm"
  fresh_open_image="$exchange_directory/driftile-overview-zoom-fresh-open.ppm"
  fresh_open_duplicate_image="$exchange_directory/driftile-overview-entry-terminal-duplicate.ppm"
  overview_entry_frame_manifest="$exchange_directory/driftile-overview-entry-frames.list"
  desktop_surface_image="$exchange_directory/driftile-overview-desktop-surface.ppm"
  for ((exit_frame_index = 1; exit_frame_index <= 16; exit_frame_index += 1)); do
    printf -v exit_frame_suffix '%02d' "$exit_frame_index"
    exit_frame_images+=(
      "$exchange_directory/driftile-overview-exit-frame-$exit_frame_suffix.ppm"
    )
  done

  capture_qmp_screendump "$baseline_image" || return 1
  capture_qmp_screendump "$baseline_duplicate_image" || return 1
  send_physical_overview_zoom_phase wheel-in "$wheel_in_image" || return 1
  capture_qmp_screendump "$wheel_in_duplicate_image" || return 1
  send_physical_overview_zoom_phase wheel-reset "$wheel_reset_image" || return 1

  off_center_y=$((output_y + 3 * output_height / 4))
  off_center_absolute_y=$(absolute_pointer_coordinate \
    "$off_center_y" "$output_y" "$output_height") || return 1
  send_absolute_pointer_position "$absolute_x" "$off_center_absolute_y" \
    || return 1
  sleep 0.1
  capture_qmp_screendump "$anchor_baseline_image" || return 1
  capture_qmp_screendump "$anchor_baseline_duplicate_image" || return 1
  send_physical_overview_zoom_phase \
    anchor-wheel-in \
    "$anchor_wheel_in_image" || return 1
  send_physical_overview_zoom_phase \
    anchor-wheel-reset \
    "$anchor_wheel_reset_image" || return 1

  send_absolute_pointer_position "$absolute_x" "$absolute_y" || return 1
  sleep 0.1
  send_physical_overview_zoom_phase key-in "$key_in_image" || return 1
  send_physical_overview_zoom_phase key-reset "$key_reset_image" || return 1
  send_physical_overview_zoom_phase \
    continuity-seed \
    "$continuity_seed_image" || return 1
  send_physical_overview_zoom_continuity_phase \
    "$continuity_closing_image" \
    "$continuity_image" || return 1
  send_physical_overview_zoom_phase \
    configured-reset \
    "$configured_reset_image" || return 1
  send_physical_overview_zoom_phase fresh-seed "$fresh_seed_image" || return 1
  capture_overview_window_exit_burst "${exit_frame_images[@]}" || return 1
  verify_physical_overview_zoom_phase \
    fresh-close \
    "$fresh_close_image" || return 1
  capture_overview_entry_burst \
    "$fresh_open_image" \
    "$fresh_open_duplicate_image" \
    "$overview_entry_frame_manifest" || return 1

  [[ -x "$overview_zoom_node_executable" ]] || return 1
  if ! entry_probe_report=$("$overview_zoom_node_executable" \
    "$root_directory/tools/vm/overview-entry-visual-probe.mjs" \
    "$fresh_close_image" \
    "$fresh_open_image" \
    "$fresh_open_duplicate_image" \
    "$overview_entry_frame_manifest"); then
    printf 'Overview entry visual probe metrics: %s\n' \
      "${entry_probe_report:-unavailable}" >&2
    return 1
  fi
  printf 'Overview entry visual probe: %s\n' "$entry_probe_report"

  marker_prefix="$exchange_directory/driftile-overview-vertical-wheel"

  send_qmp_commands "$capabilities" "$vertical_wheel_down_input" || return 1
  : > "$marker_prefix-down-sent"
  if ! wait_for_guest_exchange_file "$marker_prefix-down-verified"; then
    if [[ -f "$marker_prefix-down-observed" ]]; then
      printf 'The guest rejected physical overview wheel-down: %s\n' \
        "$(<"$marker_prefix-down-observed")" >&2
    else
      printf 'The guest did not observe physical overview wheel-down.\n' >&2
    fi
    return 1
  fi
  sleep 0.2
  capture_qmp_screendump "$desktop_surface_image" || return 1

  send_qmp_commands "$capabilities" "$vertical_wheel_up_input" || return 1
  : > "$marker_prefix-up-sent"
  if ! wait_for_guest_exchange_file "$marker_prefix-up-verified"; then
    if [[ -f "$marker_prefix-up-observed" ]]; then
      printf 'The guest rejected physical overview wheel-up: %s\n' \
        "$(<"$marker_prefix-up-observed")" >&2
    else
      printf 'The guest did not observe physical overview wheel-up.\n' >&2
    fi
    return 1
  fi
  sleep 0.2

  send_qmp_commands "$capabilities" "$horizontal_wheel_input" || return 1
  sleep "$settle_seconds"

  if ! send_qmp_commands "$capabilities" "$shift_down_input"; then
    send_qmp_commands "$capabilities" "$shift_up_input" >/dev/null 2>&1 || true
    return 1
  fi
  if ! sleep "$settle_seconds"; then
    send_qmp_commands "$capabilities" "$shift_up_input" >/dev/null 2>&1 || true
    return 1
  fi
  if ! send_qmp_commands "$capabilities" "$shifted_wheel_input"; then
    send_qmp_commands "$capabilities" "$shift_up_input" >/dev/null 2>&1 || true
    return 1
  fi
  if ! sleep "$settle_seconds"; then
    send_qmp_commands "$capabilities" "$shift_up_input" >/dev/null 2>&1 || true
    return 1
  fi
  if ! send_qmp_commands "$capabilities" "$shift_up_input"; then
    send_qmp_commands "$capabilities" "$shift_up_input" >/dev/null 2>&1 || true
    return 1
  fi

  [[ -x "$overview_zoom_node_executable" ]] || return 1
  if ! probe_report=$("$overview_zoom_node_executable" \
    "$root_directory/tools/vm/overview-zoom-visual-probe.mjs" \
    "$baseline_image" \
    "$baseline_duplicate_image" \
    "$wheel_in_image" \
    "$wheel_in_duplicate_image" \
    "$wheel_reset_image" \
    "$anchor_baseline_image" \
    "$anchor_baseline_duplicate_image" \
    "$anchor_wheel_in_image" \
    "$anchor_wheel_reset_image" \
    "$key_in_image" \
    "$key_reset_image" \
    "$continuity_seed_image" \
    "$continuity_closing_image" \
    "$continuity_image" \
    "$configured_reset_image" \
    "$fresh_seed_image" \
    "$fresh_open_image" \
    "$fresh_close_image" \
    "$desktop_surface_image" \
    "${exit_frame_images[@]}"); then
    printf 'Overview zoom visual probe metrics: %s\n' \
      "${probe_report:-unavailable}" >&2
    return 1
  fi
  printf 'Overview zoom visual probe: %s\n' "$probe_report"
}

send_physical_overview_zoom_phase() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local image_file=$2
  local input
  local phase=$1

  case "$phase" in
    wheel-in|anchor-wheel-in)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"btn","data":{"down":true,"button":"wheel-up"}},{"type":"btn","data":{"down":false,"button":"wheel-up"}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}}]}}'
      ;;
    wheel-reset|anchor-wheel-reset)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"btn","data":{"down":true,"button":"wheel-down"}},{"type":"btn","data":{"down":false,"button":"wheel-down"}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}}]}}'
      ;;
    key-in|continuity-seed|fresh-seed)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}}]}}'
      ;;
    key-reset)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}}]}}'
      ;;
    configured-reset)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"0"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"0"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}}]}}'
      ;;
    fresh-open)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    *)
      return 1
      ;;
  esac

  send_qmp_commands "$capabilities" "$input" || return 1
  verify_physical_overview_zoom_phase "$phase" "$image_file"
}

verify_physical_overview_zoom_phase() {
  local image_file=$2
  local marker_prefix
  local phase=$1

  if [[ -z "$image_file" ]]; then
    marker_prefix="$temporary_directory/xchg/driftile-overview-zoom"
  else
    marker_prefix="$(dirname -- "$image_file")/driftile-overview-zoom"
  fi
  : > "$marker_prefix-$phase-sent"
  if ! wait_for_guest_exchange_file "$marker_prefix-$phase-verified"; then
    if [[ -f "$marker_prefix-$phase-observed" ]]; then
      printf 'The guest rejected physical Overview zoom phase %s: %s\n' \
        "$phase" \
        "$(<"$marker_prefix-$phase-observed")" >&2
    else
      printf 'The guest did not verify physical Overview zoom phase: %s.\n' \
        "$phase" >&2
    fi
    return 1
  fi
  if [[ "$phase" == fresh-close ]]; then
    sleep 0.2
  fi
  if [[ -n "$image_file" ]]; then
    capture_qmp_screendump "$image_file" || return 1
  fi
}

send_physical_overview_zoom_continuity_phase() {
  local closing_image=$1
  local final_image=$2
  local marker_prefix

  capture_interrupted_overview_close "$closing_image" || return 1
  marker_prefix="$(dirname -- "$final_image")/driftile-overview-zoom"
  : > "$marker_prefix-continuity-sent"
  if ! wait_for_guest_exchange_file "$marker_prefix-continuity-verified"; then
    if [[ -f "$marker_prefix-continuity-observed" ]]; then
      printf 'The guest rejected physical Overview zoom phase continuity: %s\n' \
        "$(<"$marker_prefix-continuity-observed")" >&2
    else
      printf 'The guest did not verify physical Overview zoom phase: continuity.\n' \
        >&2
    fi
    return 1
  fi
  capture_qmp_screendump "$final_image"
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
  local plain=${2:-false}

  [[ "$plain" == true || "$plain" == false ]] || return 1

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
  set_pointer_drag_button_state false "$plain" || return 1
  send_absolute_pointer_position \
    "$source_absolute_x" "$source_absolute_y" \
    || result=1
  sleep 0.1

  if ((result == 0)); then
    set_pointer_drag_button_state true "$plain" || result=1
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

  set_pointer_drag_button_state false "$plain" || result=1
  return "$result"
}

send_cross_desktop_pointer_hold() {
  local armed_file
  local attempt
  local coordinate_file=$1
  local edge_ready_file="${coordinate_file%-hold-ready}-edge-ready"
  local edge_rejected_file="${coordinate_file%-hold-ready}-edge-rejected"
  local edge_absolute_x=""
  local edge_absolute_y=""
  local edge_x=""
  local edge_y=""
  local extra=""
  local intermediate_absolute_x=""
  local intermediate_absolute_y=""
  local intermediate_x=""
  local intermediate_y=""
  local moving_file="${coordinate_file%-hold-ready}-moving"
  local output_height=""
  local output_width=""
  local output_x=""
  local output_y=""
  local positioned_file
  local result=0
  local semantic_rejected=false
  local source_absolute_x=""
  local source_absolute_y=""
  local source_x=""
  local source_y=""

  armed_file="${coordinate_file%-hold-ready}-armed"
  positioned_file="${coordinate_file%-hold-ready}-positioned"

  if ! IFS=' ' read -r \
    source_x \
    source_y \
    edge_x \
    edge_y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file"; then
    result=1
  fi

  if ((result == 0)) && [[ -n "$extra" ]]; then
    result=1
  fi
  if ((result == 0)); then
    source_absolute_x=$(absolute_pointer_coordinate \
      "$source_x" "$output_x" "$output_width") || result=1
    source_absolute_y=$(absolute_pointer_coordinate \
      "$source_y" "$output_y" "$output_height") || result=1
    edge_absolute_x=$(absolute_pointer_coordinate \
      "$edge_x" "$output_x" "$output_width") || result=1
    edge_absolute_y=$(absolute_pointer_coordinate \
      "$edge_y" "$output_y" "$output_height") || result=1
    intermediate_x=$(((3 * source_x + edge_x) / 4))
    intermediate_y=$(((3 * source_y + edge_y) / 4))
    intermediate_absolute_x=$(absolute_pointer_coordinate \
      "$intermediate_x" "$output_x" "$output_width") || result=1
    intermediate_absolute_y=$(absolute_pointer_coordinate \
      "$intermediate_y" "$output_y" "$output_height") || result=1
  fi
  if ((result == 0)) && ! absolute_pointer_available; then
    result=1
  fi

  set_physical_pointer_drag_state false || result=1
  rm -f -- \
    "$armed_file" \
    "$edge_ready_file" \
    "$edge_rejected_file" \
    "$moving_file" \
    "$positioned_file"
  if ((result == 0)) \
    && ! send_absolute_pointer_position \
      "$source_absolute_x" "$source_absolute_y"; then
    result=1
  fi
  sleep 0.2
  if ((result == 0)); then
    : > "$positioned_file" || result=1
  fi
  if ((result == 0)); then
    for ((attempt = 0; attempt < 200; attempt += 1)); do
      if [[ -f "$armed_file" ]]; then
        break
      fi
      if [[ -f "$edge_rejected_file" ]]; then
        semantic_rejected=true
        break
      fi
      sleep 0.1
    done

    if [[ ! -f "$armed_file" && "$semantic_rejected" == false ]]; then
      result=1
    fi
  fi
  if ((result == 0)) \
    && [[ "$semantic_rejected" == false ]] \
    && ! set_physical_meta_key_state true; then
    result=1
  fi
  sleep 0.2
  if ((result == 0)) \
    && [[ "$semantic_rejected" == false ]] \
    && ! set_physical_left_button_state true; then
    result=1
  fi
  sleep 0.2
  if ((result == 0)) \
    && [[ "$semantic_rejected" == false ]] \
    && ! send_absolute_pointer_position \
      "$intermediate_absolute_x" "$intermediate_absolute_y"; then
    result=1
  fi
  sleep 0.2
  if ((result == 0)) && [[ "$semantic_rejected" == false ]]; then
    : > "$moving_file" || result=1
  fi
  if ((result == 0)) && [[ "$semantic_rejected" == false ]]; then
    for ((attempt = 0; attempt < 200; attempt += 1)); do
      if [[ -f "$edge_ready_file" ]]; then
        break
      fi
      if [[ -f "$edge_rejected_file" ]]; then
        semantic_rejected=true
        break
      fi
      sleep 0.1
    done

    if ((result == 0)) \
      && [[ ! -f "$edge_ready_file" ]] \
      && [[ "$semantic_rejected" == false ]]; then
      result=1
    fi
  fi
  if ((result == 0)) \
    && [[ "$semantic_rejected" == false ]] \
    && ! send_absolute_pointer_position "$edge_absolute_x" "$edge_absolute_y"; then
    result=1
  fi
  if ((result == 0)) && [[ "$semantic_rejected" == true ]]; then
    set_physical_pointer_drag_state false || result=1
  fi

  if ((result != 0)); then
    set_physical_pointer_drag_state false >/dev/null 2>&1 || true
  fi

  return "$result"
}

send_cross_desktop_pointer_release() {
  local coordinate_file=$1
  local extra=""
  local output_height=""
  local output_width=""
  local output_x=""
  local output_y=""
  local result=0
  local target_absolute_x=""
  local target_absolute_y=""
  local target_x=""
  local target_y=""

  if ! IFS=' ' read -r \
    target_x \
    target_y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file"; then
    result=1
  fi

  if ((result == 0)) && [[ -n "$extra" ]]; then
    result=1
  fi
  if ((result == 0)); then
    target_absolute_x=$(absolute_pointer_coordinate \
      "$target_x" "$output_x" "$output_width") || result=1
    target_absolute_y=$(absolute_pointer_coordinate \
      "$target_y" "$output_y" "$output_height") || result=1
  fi
  if ((result == 0)) && ! absolute_pointer_available; then
    result=1
  fi
  if ((result == 0)); then
    send_absolute_pointer_position \
      "$target_absolute_x" "$target_absolute_y" \
      || result=1
  fi
  sleep 0.1
  if ((result == 0)); then
    set_physical_pointer_drag_state false || result=1
  fi

  if ((result != 0)); then
    set_physical_pointer_drag_state false >/dev/null 2>&1 || true
  fi
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
    input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}},{"type":"btn","data":{"down":false,"button":"right"}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  fi

  send_qmp_commands "$capabilities" "$input"
}

set_physical_left_button_state() {
  local down=$1
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  [[ "$down" == true || "$down" == false ]] || return 1
  input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"btn\",\"data\":{\"down\":$down,\"button\":\"left\"}}]}}"
  send_qmp_commands "$capabilities" "$input"
}

send_physical_left_button_click() {
  local capabilities='{"execute":"qmp_capabilities"}'
  local down_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"left"}}]}}'
  local qmp_pid
  local qmp_read_descriptor
  local qmp_write_descriptor
  local release_required=false
  local result=0
  local up_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}}]}}'

  [[ -S "$qmp_socket" && -x "$overview_zoom_socat_executable" ]] || return 1
  if ! coproc POINTER_CLICK_QMP {
    "$overview_zoom_socat_executable" \
      -t 2 \
      - \
      "UNIX-CONNECT:$qmp_socket"
  }; then
    return 1
  fi
  qmp_pid=$POINTER_CLICK_QMP_PID
  qmp_read_descriptor=${POINTER_CLICK_QMP[0]}
  qmp_write_descriptor=${POINTER_CLICK_QMP[1]}

  IFS= read -r -t 2 -u "$qmp_read_descriptor" _ || result=1
  if ((result == 0)); then
    printf '%s\n' "$capabilities" >&"$qmp_write_descriptor" || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  fi
  if ((result == 0)); then
    printf '%s\n' "$down_input" >&"$qmp_write_descriptor" || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
    release_required=true
  fi
  if ((result == 0)); then
    sleep 0.075
    if printf '%s\n' "$up_input" >&"$qmp_write_descriptor"; then
      release_required=false
    else
      result=1
    fi
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
  elif [[ "$release_required" == true ]]; then
    printf '%s\n' "$up_input" >&"$qmp_write_descriptor" || true
    read_qmp_command_return "$qmp_read_descriptor" >/dev/null 2>&1 || true
  fi

  exec {qmp_write_descriptor}>&- || true
  exec {qmp_read_descriptor}<&- || true
  wait "$qmp_pid" || result=1
  ((result == 0))
}

set_pointer_drag_button_state() {
  local down=$1
  local plain=$2

  if [[ "$plain" == true ]]; then
    set_physical_left_button_state "$down"
  else
    set_physical_pointer_drag_state "$down"
  fi
}

set_physical_meta_key_state() {
  local down=$1
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  [[ "$down" == true || "$down" == false ]] || return 1

  if [[ "$down" == true ]]; then
    input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  else
    input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
  fi

  send_qmp_commands "$capabilities" "$input"
}

set_physical_right_button_state() {
  local down=$1
  local capabilities='{"execute":"qmp_capabilities"}'
  local input

  [[ "$down" == true || "$down" == false ]] || return 1
  input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"btn\",\"data\":{\"down\":$down,\"button\":\"right\"}}]}}"
  send_qmp_commands "$capabilities" "$input"
}

send_physical_pointer_drag() {
  local coordinate_file=$1
  local plain=${2:-false}
  local capabilities='{"execute":"qmp_capabilities"}'
  local destination_x
  local destination_y
  local down_input
  local end_absolute_x
  local end_absolute_y
  local end_input
  local extra
  local first_absolute_x
  local first_absolute_y
  local first_input
  local first_x
  local first_y
  local initial_release_input
  local input
  local output_height
  local output_width
  local output_x
  local output_y
  local qmp_pid
  local qmp_read_descriptor
  local qmp_write_descriptor
  local release_required=false
  local result=0
  local second_absolute_x
  local second_absolute_y
  local second_input
  local second_x
  local second_y
  local start_absolute_x
  local start_absolute_y
  local start_input
  local start_x
  local start_y
  local up_input

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
  first_x=$(((2 * start_x + destination_x) / 3))
  first_y=$(((2 * start_y + destination_y) / 3))
  second_x=$(((start_x + 2 * destination_x) / 3))
  second_y=$(((start_y + 2 * destination_y) / 3))
  first_absolute_x=$(absolute_pointer_coordinate \
    "$first_x" "$output_x" "$output_width") || return 1
  first_absolute_y=$(absolute_pointer_coordinate \
    "$first_y" "$output_y" "$output_height") || return 1
  second_absolute_x=$(absolute_pointer_coordinate \
    "$second_x" "$output_x" "$output_width") || return 1
  second_absolute_y=$(absolute_pointer_coordinate \
    "$second_y" "$output_y" "$output_height") || return 1

  absolute_pointer_available || return 1
  [[ -S "$qmp_socket" && -x "$overview_zoom_socat_executable" ]] || return 1

  start_input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$start_absolute_x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$start_absolute_y}}]}}"
  first_input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$first_absolute_x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$first_absolute_y}}]}}"
  second_input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$second_absolute_x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$second_absolute_y}}]}}"
  end_input="{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$end_absolute_x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$end_absolute_y}}]}}"
  if [[ "$plain" == true ]]; then
    initial_release_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}}]}}'
    down_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"left"}}]}}'
    up_input=$initial_release_input
  else
    initial_release_input='{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}},{"type":"btn","data":{"down":false,"button":"right"}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
    down_input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"btn","data":{"down":true,"button":"left"}}]}}'
    up_input=$initial_release_input
  fi

  if ! coproc POINTER_DRAG_QMP {
    "$overview_zoom_socat_executable" \
      -t 2 \
      - \
      "UNIX-CONNECT:$qmp_socket"
  }; then
    return 1
  fi
  qmp_pid=$POINTER_DRAG_QMP_PID
  qmp_read_descriptor=${POINTER_DRAG_QMP[0]}
  qmp_write_descriptor=${POINTER_DRAG_QMP[1]}

  IFS= read -r -t 2 -u "$qmp_read_descriptor" _ || result=1
  for input in \
    "$capabilities" \
    "$initial_release_input" \
    "$start_input"; do
    if ((result == 0)); then
      printf '%s\n' "$input" >&"$qmp_write_descriptor" || result=1
    fi
    if ((result == 0)); then
      read_qmp_command_return "$qmp_read_descriptor" || result=1
    fi
  done

  sleep 0.1
  if ((result == 0)); then
    printf '%s\n' "$down_input" >&"$qmp_write_descriptor" || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
    release_required=true
  fi

  for input in "$first_input" "$second_input" "$end_input"; do
    sleep 0.1
    if ((result == 0)); then
      printf '%s\n' "$input" >&"$qmp_write_descriptor" || result=1
    fi
    if ((result == 0)); then
      read_qmp_command_return "$qmp_read_descriptor" || result=1
    fi
  done

  sleep 0.1
  if ((result == 0)); then
    printf '%s\n' "$up_input" >&"$qmp_write_descriptor" || result=1
  fi
  if ((result == 0)); then
    read_qmp_command_return "$qmp_read_descriptor" || result=1
    release_required=false
  elif [[ "$release_required" == true ]]; then
    printf '%s\n' "$up_input" >&"$qmp_write_descriptor" || true
    read_qmp_command_return "$qmp_read_descriptor" >/dev/null 2>&1 || true
  fi

  exec {qmp_write_descriptor}>&- || true
  exec {qmp_read_descriptor}<&- || true
  wait "$qmp_pid" || result=1
  if ((result != 0)) && [[ "$release_required" == true ]]; then
    set_pointer_drag_button_state false "$plain" >/dev/null 2>&1 || true
  fi
  ((result == 0))
}

send_plain_pointer_drag() {
  set_physical_meta_key_state false || return 1
  send_physical_pointer_drag "$1" true
}

send_plain_pointer_click() {
  local absolute_x
  local absolute_y
  local coordinate_file=$1
  local extra
  local output_height
  local output_width
  local output_x
  local output_y
  local result=0
  local x
  local y

  IFS=' ' read -r \
    x \
    y \
    output_x \
    output_y \
    output_width \
    output_height \
    extra < "$coordinate_file" || return 1
  [[ -z "${extra:-}" ]] || return 1

  absolute_x=$(absolute_pointer_coordinate \
    "$x" "$output_x" "$output_width") || return 1
  absolute_y=$(absolute_pointer_coordinate \
    "$y" "$output_y" "$output_height") || return 1

  absolute_pointer_available || return 1
  set_physical_pointer_drag_state false || return 1
  send_absolute_pointer_position "$absolute_x" "$absolute_y" || result=1
  sleep 0.1

  if ((result == 0)) && ! send_physical_left_button_click; then
    result=1
  fi
  sleep 0.1
  return "$result"
}

send_physical_pointer_resize() {
  local armed_file
  local attempt
  local coordinate_file=$1
  local destination_absolute_x
  local destination_absolute_y
  local destination_x
  local destination_y
  local extra
  local first_absolute_x
  local first_absolute_y
  local first_x
  local first_y
  local held_file
  local middle_absolute_x
  local middle_absolute_y
  local middle_x
  local middle_y
  local output_height
  local output_width
  local output_x
  local output_y
  local positioned_file
  local release_ready_file
  local result=0
  local start_absolute_x
  local start_absolute_y
  local start_x
  local start_y
  local third_absolute_x
  local third_absolute_y
  local third_x
  local third_y

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
  ((start_x != destination_x \
    && start_y == destination_y \
    && start_x >= output_x \
    && start_x < output_x + output_width \
    && start_y >= output_y \
    && start_y < output_y + output_height \
    && destination_x >= output_x \
    && destination_x < output_x + output_width)) || return 1

  start_absolute_x=$(absolute_pointer_coordinate \
    "$start_x" "$output_x" "$output_width") || return 1
  start_absolute_y=$(absolute_pointer_coordinate \
    "$start_y" "$output_y" "$output_height") || return 1
  destination_absolute_x=$(absolute_pointer_coordinate \
    "$destination_x" "$output_x" "$output_width") || return 1
  destination_absolute_y=$(absolute_pointer_coordinate \
    "$destination_y" "$output_y" "$output_height") || return 1
  first_x=$(((3 * start_x + destination_x) / 4))
  first_y=$start_y
  middle_x=$(((start_x + destination_x) / 2))
  middle_y=$start_y
  third_x=$(((start_x + 3 * destination_x) / 4))
  third_y=$start_y
  first_absolute_x=$(absolute_pointer_coordinate \
    "$first_x" "$output_x" "$output_width") || return 1
  first_absolute_y=$(absolute_pointer_coordinate \
    "$first_y" "$output_y" "$output_height") || return 1
  middle_absolute_x=$(absolute_pointer_coordinate \
    "$middle_x" "$output_x" "$output_width") || return 1
  middle_absolute_y=$(absolute_pointer_coordinate \
    "$middle_y" "$output_y" "$output_height") || return 1
  third_absolute_x=$(absolute_pointer_coordinate \
    "$third_x" "$output_x" "$output_width") || return 1
  third_absolute_y=$(absolute_pointer_coordinate \
    "$third_y" "$output_y" "$output_height") || return 1
  positioned_file="${coordinate_file%-ready}-positioned"
  armed_file="${coordinate_file%-ready}-armed"
  held_file="${coordinate_file%-ready}-held"
  release_ready_file="${coordinate_file%-ready}-release-ready"

  absolute_pointer_available || return 1
  set_physical_pointer_drag_state false || return 1
  rm -f -- \
    "$positioned_file" \
    "$armed_file" \
    "$held_file" \
    "$release_ready_file"

  if ! send_absolute_pointer_position "$start_absolute_x" "$start_absolute_y"; then
    result=1
  fi
  sleep 0.2

  if ((result == 0)); then
    : > "$positioned_file" || result=1
  fi

  if ((result == 0)); then
    for ((attempt = 0; attempt < 150; attempt += 1)); do
      [[ -f "$armed_file" ]] && break
      sleep 0.1
    done

    [[ -f "$armed_file" ]] || result=1
  fi

  if ((result == 0)) && ! set_physical_meta_key_state true; then
    result=1
  fi
  sleep 0.2

  if ((result == 0)) && ! set_physical_right_button_state true; then
    result=1
  fi
  sleep 0.2

  if ((result == 0)) \
    && ! send_absolute_pointer_position \
      "$first_absolute_x" "$first_absolute_y"; then
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
    && ! send_absolute_pointer_position \
      "$third_absolute_x" "$third_absolute_y"; then
    result=1
  fi
  sleep 0.1

  if ((result == 0)) \
    && ! send_absolute_pointer_position \
      "$destination_absolute_x" "$destination_absolute_y"; then
    result=1
  fi
  sleep 0.2

  if ((result == 0)); then
    : > "$held_file" || result=1
  fi

  if ((result == 0)); then
    for ((attempt = 0; attempt < 400; attempt += 1)); do
      [[ -f "$release_ready_file" ]] && break
      sleep 0.1
    done

    [[ -f "$release_ready_file" ]] || result=1
  fi

  set_physical_right_button_state false || result=1
  sleep 0.1
  set_physical_meta_key_state false || result=1
  set_physical_pointer_drag_state false || result=1
  rm -f -- \
    "$positioned_file" \
    "$armed_file" \
    "$held_file" \
    "$release_ready_file"
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
    close-window)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"q"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"q"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    overview-open)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"o"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    overview-search-query)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"f"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"i"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"i"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"e"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"e"}}}]}}'
      ;;
    overview-search-edit)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"backspace"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"backspace"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"x"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"x"}}}]}}'
      ;;
    overview-search-close)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"esc"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"esc"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"esc"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"esc"}}}]}}'
      ;;
    overview-enter-initial|overview-enter-target)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ret"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ret"}}}]}}'
      ;;
    overview-up)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"up"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"up"}}}]}}'
      ;;
    overview-escape|overview-reorder-escape|overview-tab-drag-escape|overview-window-drop-escape)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"esc"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"esc"}}}]}}'
      ;;
    overview-workspace-select-created)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"down"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"down"}}}]}}'
      ;;
    overview-workspace-begin-rename)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"f2"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"f2"}}}]}}'
      ;;
    overview-workspace-submit-rename)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"n"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"n"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"a"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"g"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"g"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"e"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"e"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"d"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"d"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"v"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"v"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"m"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ret"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ret"}}}]}}'
      ;;
    overview-workspace-remove)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"delete"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"delete"}}}]}}'
      ;;
    overview-workspace-close)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"esc"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"esc"}}}]}}'
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
    preset-back)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    height-preset-next)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"r"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    tabbed-enter|tabbed-exit)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"w"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"w"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
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
    floating-center)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"c"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"c"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-move-left)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"h"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"h"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-move-right)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"l"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"l"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    floating-desktop-next)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"u"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    minus|floating-width-minus)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    equal|floating-width-equal)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-minus)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"minus"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    shift-equal)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"equal"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"shift"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
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
    ctrl-j|floating-move-down)
      input='{"execute":"input-send-event","arguments":{"events":[{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"meta_l"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":true,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"j"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"ctrl"}}},{"type":"key","data":{"down":false,"key":{"type":"qcode","data":"meta_l"}}}]}}'
      ;;
    ctrl-k|floating-move-up)
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

qemu_process_snapshot() {
  local -a process_fields=()
  local process_stat
  local process_stat_tail
  local pid=$1

  [[ -r "/proc/$pid/stat" ]] || return 1
  process_stat=$(<"/proc/$pid/stat") || return 1
  process_stat_tail=${process_stat##*) }
  read -r -a process_fields <<< "$process_stat_tail"
  (( ${#process_fields[@]} > 19 )) || return 1
  printf '%s %s' "${process_fields[0]}" "${process_fields[19]}"
}

owned_qemu_process_identity_matches() {
  local process_snapshot
  local process_start_time

  [[ "$owned_qemu_process_active" == true ]] || return 1
  process_snapshot=$(qemu_process_snapshot "$owned_qemu_pid") || return 1
  read -r _ process_start_time <<< "$process_snapshot"
  [[ "$process_start_time" == "$owned_qemu_start_time" ]]
}

owned_qemu_process_exited() {
  local process_snapshot
  local process_start_time
  local process_state

  [[ "$owned_qemu_process_active" == true ]] || return 0
  process_snapshot=$(qemu_process_snapshot "$owned_qemu_pid") || return 0
  read -r process_state process_start_time <<< "$process_snapshot"

  if [[ "$process_start_time" != "$owned_qemu_start_time" ]]; then
    return 0
  fi

  [[ "$process_state" == Z || "$process_state" == X ]]
}

reap_owned_qemu_process() {
  local process_status=0

  [[ "$owned_qemu_process_active" == true ]] || return 0

  if wait "$owned_qemu_pid"; then
    process_status=0
  else
    process_status=$?
  fi

  owned_qemu_exit_status=$process_status
  owned_qemu_pid=""
  owned_qemu_process_active=false
  owned_qemu_start_time=""
}

wait_for_owned_qemu_process_exit() {
  local attempt
  local attempts=$1

  [[ "$attempts" =~ ^[1-9][0-9]*$ ]] || return 1

  for ((attempt = 0; attempt < attempts; attempt += 1)); do
    if owned_qemu_process_exited; then
      reap_owned_qemu_process
      return 0
    fi

    sleep 0.1
  done

  return 1
}

terminate_owned_qemu_process() {
  [[ "$owned_qemu_process_active" == true ]] || return 0

  if owned_qemu_process_exited; then
    reap_owned_qemu_process
    return 0
  fi

  if owned_qemu_process_identity_matches; then
    kill -TERM "$owned_qemu_pid" >/dev/null 2>&1 || true
  fi

  if wait_for_owned_qemu_process_exit 50; then
    return 0
  fi

  if owned_qemu_process_identity_matches; then
    kill -KILL "$owned_qemu_pid" >/dev/null 2>&1 || true
  fi
  reap_owned_qemu_process
}

shutdown_owned_qemu_process() {
  local input_release_accepted=false

  [[ "$owned_qemu_process_active" == true ]] || return 0

  if set_physical_pointer_drag_state false >/dev/null 2>&1; then
    input_release_accepted=true
  fi

  if stop_vm >/dev/null 2>&1; then
    wait_for_owned_qemu_process_exit 50 \
      || terminate_owned_qemu_process
  else
    terminate_owned_qemu_process
  fi

  [[ "$input_release_accepted" == true \
    || "$owned_qemu_process_active" == false ]]
}

finish_full_vm_monitor() {
  local process_status

  shutdown_owned_qemu_process || return 1
  process_status=$owned_qemu_exit_status
  ((process_status == 0))
}

# shellcheck disable=SC2329
full_vm_monitor_signal_handler() {
  local exit_status=$1

  trap '' INT TERM
  exit "$exit_status"
}

start_owned_full_vm() {
  local process_snapshot
  local process_state

  trap '' INT TERM

  (
    trap - INT TERM
    export QEMU_OPTS="$qemu_options"
    export TMPDIR="$temporary_directory"
    export USE_TMPDIR=1
    exec "./result/bin/$vm_runner"
  ) &
  owned_qemu_pid=$!
  owned_qemu_process_active=true
  if ! process_snapshot=$(qemu_process_snapshot "$owned_qemu_pid"); then
    reap_owned_qemu_process
    return 1
  fi
  read -r process_state owned_qemu_start_time <<< "$process_snapshot"

  if [[ "$process_state" == Z || "$process_state" == X ]]; then
    reap_owned_qemu_process
    return 1
  fi

  trap 'full_vm_monitor_signal_handler 130' INT
  trap 'full_vm_monitor_signal_handler 143' TERM
}

trap cleanup EXIT

if [[ "$vm_visibility" == visible \
  && -z "${DISPLAY:-}" \
  && -z "${WAYLAND_DISPLAY:-}" ]]; then
  printf 'A graphical session is required to show the VM window.\n' >&2
  exit 1
fi

cd -- "$root_directory"
if [[ "$vm_mode" == full ]]; then
  overview_zoom_node_executable=$(resolve_overview_zoom_node_executable) || {
    printf 'Could not resolve the Overview zoom visual-probe Node executable.\n' \
      >&2
    exit 1
  }
  overview_zoom_socat_executable=$(resolve_overview_zoom_socat_executable) || {
    printf 'Could not resolve the Overview zoom transition-probe socat executable.\n' \
      >&2
    exit 1
  }
fi
readonly overview_zoom_node_executable
readonly overview_zoom_socat_executable
nixos-rebuild build-vm --flake ".#$flake_configuration"

if [[ "$vm_visibility" == visible ]] && ! prepare_host_window; then
  printf 'Could not request the initial VM window size from host KWin.\n' >&2
fi

if [[ "$vm_mode" == full ]]; then
  start_owned_full_vm
  monitor_guest
  exit 0
fi

case "$vm_mode" in
  lifecycle) monitor_lifecycle_guest & ;;
  two-head) monitor_two_head_guest & ;;
esac
status_monitor_pid=$!

vm_status=0

set +e
if [[ "$vm_mode" == two-head ]]; then
  QEMU_OPTS="$qemu_options" \
    SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS=0 \
    USE_TMPDIR=1 TMPDIR="$temporary_directory" \
    "./result/bin/$vm_runner"
else
  QEMU_OPTS="$qemu_options" \
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
