# Driftile 1.6.0-rc.1

Driftile 1.6.0-rc.1 is a prerelease candidate for 1.6.0 validation. It was not a stable release.

## Changes since 1.5.0

- Adds finish-only horizontal pointer-resize adoption for the active normal
  tiled window while KWin retains interactive-resize ownership.
- Accepts only an unambiguous width-only left- or right-edge finish in the same
  settled, visible, unchanged output and desktop.
- Stages every writable same-context target while the prior logical layout
  remains unchanged. Two exact target samples commit the accepted width as the
  active column's fixed-width policy with one layout publication.
- Retains or restores the prior width policy and frames after participant,
  state, context, topology, constraint, geometry, or late-configure races.
  Recovery is bounded and never competes with lost native-state ownership.
- Changes no settings, shortcut action IDs, bindings, gestures, persistence
  schema, or overview behavior. Existing package IDs and stored layouts remain
  compatible with 1.5.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.6.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.6.0-rc.1)
and these exact asset links:

- [`driftile-1.6.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.6.0-rc.1/driftile-1.6.0-rc.1.kwinscript)
- [`driftile-overview-1.6.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.6.0-rc.1/driftile-overview-1.6.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.6.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.6.0-rc.1/driftile-shortcuts-1.6.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.6.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.6.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.6.0-rc.1/docs/migration.md#upgrade-from-150-to-160-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions; its resize checks use grid-aligned widths
  because KWin may quantize frames.
- Pointer-resize adoption requires KWin to finish an eligible horizontal resize.
  Driftile does not initiate or take ownership of the interactive resize.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.6.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
