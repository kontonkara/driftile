#!/usr/bin/env bash

set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/driftile-smoke.XXXXXX")
log_file="$sandbox/kwin.log"
result_file="$sandbox/passed"
package_installed=0

cleanup() {
  if [[ "$package_installed" == "1" ]]; then
    kpackagetool6 \
      --type=KWin/Script \
      --remove io.github.kontonkara.driftile \
      >/dev/null 2>&1 || true
  fi

  if [[ "${DRIFTILE_KEEP_SMOKE_SANDBOX:-0}" == "1" ]]; then
    printf 'Smoke-test sandbox: %s\n' "$sandbox"
    return
  fi

  rm -rf "$sandbox"
}

fail() {
  local message=$1

  printf '%s\n' "$message" >&2

  if [[ -s "$log_file" ]]; then
    printf '%s\n' 'KWin log:' >&2
    sed 's/^/  /' "$log_file" >&2
  fi

  exit 1
}

require_command() {
  local command_name=$1

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "Missing smoke-test dependency: $command_name"
  fi
}

trap cleanup EXIT

for command_name in \
  busctl \
  dbus-run-session \
  kpackagetool6 \
  kwin_wayland \
  kwriteconfig6 \
  npm \
  timeout \
  Xwayland \
  xterm \
  xwininfo \
  xprop; do
  require_command "$command_name"
done

npm --prefix "$project_root" run build >/dev/null

mkdir -p \
  "$sandbox/cache" \
  "$sandbox/config" \
  "$sandbox/data" \
  "$sandbox/home" \
  "$sandbox/runtime" \
  "$sandbox/state" \
  "$sandbox/system-data"
chmod 0700 "$sandbox/runtime"

export DRIFTILE_SMOKE_RESULT="$result_file"
export HOME="$sandbox/home"
export KWIN_COMPOSE=Q
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
  WAYLAND_DISPLAY \
  XDG_CURRENT_DESKTOP \
  XDG_SESSION_DESKTOP

if ! kpackagetool6 \
  --type=KWin/Script \
  --install "$project_root/dist/kwin-script" \
  >/dev/null; then
  fail "KPackage could not install Driftile in the smoke-test sandbox."
fi
package_installed=1

if ! timeout --kill-after=5s 60s dbus-run-session -- \
  kwin_wayland \
  --virtual \
  --width 1280 \
  --height 720 \
  --output-count 1 \
  --scale 1 \
  --xwayland \
  --socket driftile-smoke-0 \
  --no-global-shortcuts \
  --no-kactivities \
  --no-lockscreen \
  --exit-with-session "$project_root/tools/integration/session.sh" \
  >"$log_file" 2>&1; then
  fail "The isolated KWin session did not finish successfully."
fi

if [[ ! -f "$result_file" ]]; then
  fail "The isolated KWin session did not complete every smoke-test assertion."
fi

if grep -Fq "Component failed to load" "$log_file"; then
  fail "KWin reported a declarative component load failure."
fi

if ! grep -Fq "[driftile] managed=2 writes=2" "$log_file"; then
  fail "Driftile did not report the expected initial reconciliation."
fi

if ! kpackagetool6 \
  --type=KWin/Script \
  --remove io.github.kontonkara.driftile \
  >/dev/null; then
  fail "KPackage could not remove Driftile from the smoke-test sandbox."
fi
package_installed=0

if [[ -e "$XDG_DATA_HOME/kwin/scripts/io.github.kontonkara.driftile" ]]; then
  fail "KPackage left the Driftile package installed after removal."
fi

printf '%s\n' 'Integration smoke test passed.'
