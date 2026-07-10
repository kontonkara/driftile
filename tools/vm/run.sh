#!/usr/bin/env bash

set -euo pipefail

root_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
temporary_directory=$(mktemp -d -t driftile-vm.XXXXXXXXXX)
host_script_loaded=false
readonly host_script_name="io.github.kontonkara.driftile.vm-window"
status_monitor_pid=""

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
  local focus_file="$temporary_directory/xchg/driftile-focus-verified"
  local loaded_file="$temporary_directory/xchg/driftile-loaded"

  for ((attempt = 0; attempt < 300; attempt += 1)); do
    if [[ -f "$loaded_file" && -f "$focus_file" ]]; then
      if [[ "$(<"$loaded_file")" == true ]]; then
        printf 'The VM reports that Driftile loaded successfully.\n'
      else
        printf 'The VM reports that Driftile failed to load.\n' >&2
      fi

      if [[ "$(<"$focus_file")" == true ]]; then
        printf 'The VM verified left and right focus shortcuts.\n'
      else
        printf 'The VM failed to verify left and right focus shortcuts.\n' >&2

        if [[ -f "$diagnostics_file" ]]; then
          sed 's/^/  /' "$diagnostics_file" >&2
        fi
      fi

      return
    fi

    sleep 0.2
  done

  printf 'The VM did not report Driftile status within 60 seconds.\n' >&2
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

USE_TMPDIR=1 TMPDIR="$temporary_directory" \
  ./result/bin/run-driftile-vm-vm
