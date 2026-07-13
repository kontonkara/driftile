# Driftile 1.7.0-rc.1

Driftile 1.7.0-rc.1 is a prerelease candidate for 1.7.0 validation. It is not
a stable release; 1.6.0 remains the latest stable version.

## Changes since 1.6.0

- Adds guarded left-click focus to valid thumbnails in the optional overview's
  current desktop card.
- Revalidates the live window, exact ID, input eligibility, state, output,
  desktop, and current activity before requesting focus.
- Writes only `KWin.Workspace.activeWindow` and closes the effect only after
  KWin confirms the selected window active. Invalid, stale, or rejected requests
  leave the effect open.
- Normal KWin activation may raise the selected window, and the main extension
  may reveal its tiled column through the existing focus path.
- Does not switch desktops or activities; move windows; write memberships,
  outputs, geometry, or settings; or add actions, bindings, gestures, drag,
  keyboard navigation, schema, IPC, private APIs, timers, or workspace scans.
- Changes no main-script runtime, settings, shortcut action IDs, bindings,
  gestures, or persistence format. Existing package IDs and stored layouts
  remain compatible with 1.6.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.7.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.7.0-rc.1)
and these exact asset links:

- [`driftile-1.7.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.7.0-rc.1/driftile-1.7.0-rc.1.kwinscript)
- [`driftile-overview-1.7.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.7.0-rc.1/driftile-overview-1.7.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.7.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.7.0-rc.1/driftile-shortcuts-1.7.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.7.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.7.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.7.0-rc.1/docs/migration.md#upgrade-from-160-to-170-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- Overview focus is verified for native Wayland and XWayland targets in the
  two-output Wayland scenario. Other supported backends retain the existing
  overview lifecycle checks.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.7.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
