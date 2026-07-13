# Driftile 1.5.0-rc.1

Driftile 1.5.0-rc.1 is a prerelease candidate for 1.5.0 validation. It is not
a stable release; 1.4.0 remains the latest stable version.

## Changes since 1.4.0

- Adds finish-only pointer adoption after KWin selects another visible desktop
  on the same output and moves the active normal tiled window there.
- Inserts before or after one exact eligible tiled target under the release
  point while preserving the destination column width, assigning automatic
  height, and retaining focus.
- Leaves desktop selection and window membership to KWin. An empty, ambiguous,
  stale, blocked, or raced target retains KWin's completed move and uses normal
  singleton admission.
- Compensates a partial destination write before fallback and performs no
  geometry writes on the hidden source desktop or unrelated contexts.
- Changes no settings, shortcut action IDs, bindings, gestures, persistence
  schema, or overview behavior. Existing package IDs and stored layouts remain
  compatible with 1.4.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.5.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.5.0-rc.1)
and these exact asset links:

- [`driftile-1.5.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.5.0-rc.1/driftile-1.5.0-rc.1.kwinscript)
- [`driftile-overview-1.5.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.5.0-rc.1/driftile-overview-1.5.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.5.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.5.0-rc.1/driftile-shortcuts-1.5.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.5.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.5.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.5.0-rc.1/docs/migration.md#upgrade-from-140-to-150-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions and uses the global-desktop fallback;
  multi-output X11 is unverified.
- Cross-desktop adoption requires KWin to complete the desktop selection and
  window-membership move. Driftile does not initiate either mechanism.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.5.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
