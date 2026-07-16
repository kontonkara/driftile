# Driftile 1.12.0-rc.1

Driftile 1.12.0-rc.1 is a prerelease candidate for 1.12.0 validation. It was not a stable release.

## Changes since 1.11.0

- Reuses the existing center-column action and `Meta+C` default to center the
  active manually floating frame in its assigned output and desktop work area.
  Tiled column centering is unchanged.
- Centers each non-oversized frame dimension at the exact logical midpoint. An
  oversized dimension starts at the work-area origin, and fractional targets
  are not rounded.
- Preserves frame size, focus, output, desktop, reinsertion placement, and every
  tiled layout. An already centered or blocked target is a zero-write no-op and
  never falls through to tiled behavior.
- Accepts only an exact frame acknowledgement and commits floating metadata only
  after success. A still-owned inexact result may receive one guarded
  original-frame compensation request.
- Leaves automatic-floating, configured layout-excluded, and native-state
  windows under KWin geometry ownership. This candidate adds no action, binding,
  setting, configuration or persistence schema, helper profile, or overview
  behavior. Both package IDs remain unchanged.

## Candidate artifacts

The candidate uses tag
[`v1.12.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.12.0-rc.1)
and these exact asset links:

- [`driftile-1.12.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.12.0-rc.1/driftile-1.12.0-rc.1.kwinscript)
- [`driftile-overview-1.12.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.12.0-rc.1/driftile-overview-1.12.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.12.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.12.0-rc.1/driftile-shortcuts-1.12.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.12.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.12.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.12.0-rc.1/docs/migration.md#upgrade-from-1110-to-1120-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The optional overview retains its 1.11.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.12.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
