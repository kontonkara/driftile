#!/usr/bin/env bash

set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
readonly project_root
readonly plugin_id="io.github.kontonkara.driftile"
readonly wait_attempts=200

require_command() {
  local command_name=$1

  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing smoke-test dependency: %s\n' "$command_name" >&2
    return 1
  fi
}

fail() {
  local message=$1

  printf '%s\n' "$message" >&2

  if [[ -s "$log_file" ]]; then
    printf '%s\n' 'KWin log:' >&2
    sed 's/^/  /' "$log_file" >&2
  fi

  if [[ -n "${xvfb_log:-}" && -s "$xvfb_log" ]]; then
    printf '%s\n' 'Xvfb log:' >&2
    sed 's/^/  /' "$xvfb_log" >&2
  fi

  exit 1
}

wait_for_file() {
  local path=$1
  local attempt

  for ((attempt = 0; attempt < wait_attempts; attempt += 1)); do
    if [[ -s "$path" ]]; then
      return 0
    fi

    sleep 0.05
  done

  return 1
}

run_backend() (
  local backend=$1
  local candidate
  local sandbox
  local log_file
  local layer_shell_qml_import="${DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT:-}"
  local kglobalacceld="${DRIFTILE_SMOKE_KGLOBALACCELD:-}"
  local result_file
  local display_number
  local qml_binary
  local qml_import_path=""
  local qml_prefix
  local xvfb_log=""
  local xvfb_pid=""
  local package_installed=0
  local output_count
  local protocols
  local scenario
  local socket_name

  sandbox=$(mktemp -d "${TMPDIR:-/tmp}/driftile-${backend}-smoke.XXXXXX")
  log_file="$sandbox/kwin.log"
  result_file="$sandbox/passed"

  # shellcheck disable=SC2329
  cleanup() {
    if [[ "$package_installed" == "1" ]]; then
      kpackagetool6 \
        --type=KWin/Script \
        --remove "$plugin_id" \
        >/dev/null 2>&1 || true
    fi

    if [[ -n "$xvfb_pid" ]]; then
      kill "$xvfb_pid" >/dev/null 2>&1 || true
      wait "$xvfb_pid" >/dev/null 2>&1 || true
    fi

    if [[ "${DRIFTILE_KEEP_SMOKE_SANDBOX:-0}" == "1" ]]; then
      printf '%s smoke-test sandbox: %s\n' "$backend" "$sandbox"
      return
    fi

    rm -rf "$sandbox"
  }

  trap cleanup EXIT

  for command_name in \
    busctl \
    dbus-run-session \
    jq \
    kpackagetool6 \
    kwriteconfig6 \
    qml \
    timeout; do
    require_command "$command_name" || exit 1
  done

  qml_binary=$(readlink -f "$(command -v qml)")
  qml_prefix=$(dirname "$(dirname "$qml_binary")")

  for candidate in \
    "$qml_prefix/lib/qt-6/qml" \
    "$qml_prefix/lib/qt6/qml" \
    "$qml_prefix/lib/qml"; do
    if [[ -d "$candidate/QtQuick" ]]; then
      qml_import_path=$candidate
      break
    fi
  done

  mkdir -p \
    "$sandbox/cache" \
    "$sandbox/config" \
    "$sandbox/data" \
    "$sandbox/home" \
    "$sandbox/runtime" \
    "$sandbox/state" \
    "$sandbox/system-data"
  chmod 0700 "$sandbox/runtime"

  export DRIFTILE_SMOKE_CLIENT="$project_root/tools/integration/client.qml"
  export DRIFTILE_SMOKE_AUTOMATIC_FLOATING_PROBE="$project_root/tools/integration/automatic-floating-probe.js"
  export DRIFTILE_SMOKE_DIALOG_CLIENT="$project_root/tools/integration/dialog-client.qml"
  export DRIFTILE_SMOKE_DESKTOP_STATE_PROBE="$project_root/tools/integration/desktop-state-probe.js"
  export DRIFTILE_SMOKE_FIXED_SIZE_CLIENT="$project_root/tools/integration/fixed-size-client.qml"
  export DRIFTILE_SMOKE_FLOATING_NAVIGATION_ARRANGER="$project_root/tools/integration/floating-navigation-arranger.js"
  export DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT="$layer_shell_qml_import"
  export DRIFTILE_SMOKE_NATIVE_TILE_TOGGLE="$project_root/tools/integration/native-tile-toggle.js"
  export DRIFTILE_SMOKE_OUTPUT_ROUTER="$project_root/tools/integration/output-router.js"
  export DRIFTILE_SMOKE_OUTPUT_TRANSFER_STATE_PROBE="$project_root/tools/integration/output-transfer-state-probe.js"
  export DRIFTILE_SMOKE_QML_IMPORT="$qml_import_path"
  export DRIFTILE_SMOKE_RESULT="$result_file"
  export DRIFTILE_SMOKE_SHORTCUT_TOOL="$project_root/dist/bin/driftile-shortcuts.mjs"
  export DRIFTILE_SMOKE_WORK_AREA_PANEL="$project_root/tools/integration/work-area-panel.qml"
  export HOME="$sandbox/home"
  export LC_ALL=C.UTF-8
  export QT_FORCE_STDERR_LOGGING=1
  export XDG_CACHE_HOME="$sandbox/cache"
  export XDG_CONFIG_HOME="$sandbox/config"
  export XDG_DATA_HOME="$sandbox/data"
  export XDG_DATA_DIRS="$sandbox/system-data"
  export XDG_RUNTIME_DIR="$sandbox/runtime"
  export XDG_STATE_HOME="$sandbox/state"

  unset \
    DBUS_SESSION_BUS_ADDRESS \
    DISPLAY \
    JOURNAL_STREAM \
    KDE_APPLICATIONS_AS_SCOPE \
    KDE_FULL_SESSION \
    KDE_SESSION_UID \
    KDE_SESSION_VERSION \
    KWIN_COMPOSE \
    WAYLAND_DISPLAY \
    XDG_CURRENT_DESKTOP \
    XDG_SESSION_DESKTOP

  if [[ "$backend" == "wayland-multi-output" ]]; then
    kwriteconfig6 \
      --file "$XDG_CONFIG_HOME/kwinrc" \
      --group Windows \
      --key PerOutputVirtualDesktops \
      --type bool \
      true
  fi

  if ! kpackagetool6 \
    --type=KWin/Script \
    --install "$project_root/dist/kwin-script" \
    >/dev/null; then
    fail "KPackage could not install Driftile in the $backend sandbox."
  fi
  package_installed=1

  case "$backend" in
    wayland | wayland-multi-output)
      require_command kwin_wayland || exit 1
      require_command Xwayland || exit 1
      protocols="${DRIFTILE_SMOKE_PROTOCOLS:-xwayland wayland}"

      case "$protocols" in
        wayland | xwayland | "wayland xwayland" | "xwayland wayland") ;;
        *) fail "DRIFTILE_SMOKE_PROTOCOLS must contain wayland, xwayland, or both." ;;
      esac

      export DRIFTILE_SMOKE_PROTOCOLS="$protocols"
      export KWIN_COMPOSE=Q
      export XDG_SESSION_TYPE=wayland

      if [[ "$backend" == "wayland-multi-output" ]]; then
        require_command kscreen-doctor || exit 1

        if [[
          -n "$layer_shell_qml_import" &&
            ! -d "$layer_shell_qml_import/org/kde/layershell"
        ]]; then
          fail "The exact LayerShellQt QML import is unavailable in the integration shell."
        fi

        output_count=2
        scenario=multi-output
        socket_name=driftile-multi-output-smoke-0
      else
        output_count=1
        scenario=single-output
        socket_name=driftile-smoke-0
      fi

      export DRIFTILE_SMOKE_SCENARIO="$scenario"

      if ! timeout --kill-after=5s 90s dbus-run-session -- \
        kwin_wayland \
        --virtual \
        --width 1280 \
        --height 720 \
        --output-count "$output_count" \
        --scale 1 \
        --xwayland \
        --socket "$socket_name" \
        --no-kactivities \
        --no-lockscreen \
        --exit-with-session "$project_root/tools/integration/session.sh" \
        >"$log_file" 2>&1; then
        fail "The isolated KWin Wayland session did not finish successfully."
      fi
      ;;
    x11)
      require_command kwin_x11 || exit 1
      require_command Xvfb || exit 1
      require_command xprop || exit 1
      require_command xrandr || exit 1

      if [[ -z "$kglobalacceld" || ! -x "$kglobalacceld" ]]; then
        fail "Set DRIFTILE_SMOKE_KGLOBALACCELD to an executable kglobalacceld path for X11."
      fi

      export DRIFTILE_SMOKE_KGLOBALACCELD="$kglobalacceld"
      export DRIFTILE_SMOKE_PROTOCOLS=x11
      export DRIFTILE_SMOKE_SCENARIO=single-output
      export XDG_SESSION_TYPE=x11
      xvfb_log="$sandbox/xvfb.log"

      Xvfb \
        -displayfd 3 \
        -screen 0 1280x720x24 \
        -fakescreenfps 60 \
        -nolisten tcp \
        -noreset \
        -ac \
        >"$xvfb_log" 2>&1 \
        3>"$sandbox/display" &
      xvfb_pid=$!

      wait_for_file "$sandbox/display" || fail "Xvfb did not publish a display number."
      display_number=$(<"$sandbox/display")
      export DISPLAY=":$display_number"

      if ! timeout --kill-after=5s 90s dbus-run-session -- \
        "$project_root/tools/integration/x11-session.sh" \
        >"$log_file" 2>&1; then
        fail "The isolated KWin X11 session did not finish successfully."
      fi
      ;;
    *)
      fail "Unsupported KWin backend: $backend"
      ;;
  esac

  if [[ ! -f "$result_file" ]]; then
    fail "The $backend session did not complete every smoke-test assertion."
  fi

  if grep -Fq "Component failed to load" "$log_file"; then
    fail "KWin reported a declarative component load failure."
  fi

  if ! kpackagetool6 \
    --type=KWin/Script \
    --remove "$plugin_id" \
    >/dev/null; then
    fail "KPackage could not remove Driftile from the $backend sandbox."
  fi
  package_installed=0

  if [[ -e "$XDG_DATA_HOME/kwin/scripts/$plugin_id" ]]; then
    fail "KPackage left Driftile installed after the $backend test."
  fi

  printf '%s\n' "$backend integration smoke test passed."
)

selection=${1:-all}

case "$selection" in
  all | wayland | wayland-multi-output | x11) ;;
  *)
    printf 'Expected one of: all, wayland, wayland-multi-output, x11\n' >&2
    exit 2
    ;;
esac

require_command npm
npm --prefix "$project_root" run build >/dev/null

if [[ "$selection" == "all" || "$selection" == "wayland" ]]; then
  run_backend wayland
fi

if [[
  "$selection" == "all" ||
    "$selection" == "wayland" ||
    "$selection" == "wayland-multi-output"
]]; then
  run_backend wayland-multi-output
fi

if [[ "$selection" == "all" || "$selection" == "x11" ]]; then
  run_backend x11
fi
