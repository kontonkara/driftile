#!/usr/bin/env bash

set -euo pipefail

: "${DRIFTILE_SMOKE_XWAYLAND:?}"
printf 'Starting exact Xwayland: %s\n' "$DRIFTILE_SMOKE_XWAYLAND" >&2
exec "$DRIFTILE_SMOKE_XWAYLAND" "$@"
