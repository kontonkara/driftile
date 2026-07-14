# Driftile 1.11.0-rc.1

Driftile 1.11.0-rc.1 is a prerelease candidate for 1.11.0 validation. It is not
a stable release; 1.10.0 remains the latest stable version.

## Changes since 1.10.0

- Reuses the existing column-left, column-right, window-up, and window-down
  actions to move the active manually floating window by 50 logical pixels.
  The existing `Meta+Ctrl+H/J/K/L` defaults and arrow aliases use this behavior.
- Allows a floating frame partly outside the work area while keeping a
  size-dependent 10–75 pixel strip visible on each axis. A dimension smaller
  than 10 pixels remains fully visible on that axis.
- Preserves frame size, focus, output, desktop, reinsertion anchor, and every
  tiled layout. A later tile-to-float round trip restores the accepted moved
  frame.
- Rejects blocked, stale, or inexact results without committing floating
  metadata. Original-frame compensation is requested only while the same
  window, context, and ownership remain current.
- Leaves automatic-floating and configured layout-excluded windows under KWin
  geometry ownership. Directional move behavior for tiled windows is unchanged.
- Adds no action, binding, setting, configuration or persistence schema, helper
  profile, or overview behavior. Both package IDs remain unchanged and are
  versioned together.

## Candidate artifacts

The candidate uses tag
[`v1.11.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.11.0-rc.1)
and these exact asset links:

- [`driftile-1.11.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.11.0-rc.1/driftile-1.11.0-rc.1.kwinscript)
- [`driftile-overview-1.11.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.11.0-rc.1/driftile-overview-1.11.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.11.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.11.0-rc.1/driftile-shortcuts-1.11.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.11.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.11.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.11.0-rc.1/docs/migration.md#upgrade-from-1100-to-1110-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The optional overview retains its 1.10.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.11.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
