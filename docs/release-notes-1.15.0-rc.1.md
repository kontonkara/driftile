# Driftile 1.15.0-rc.1

Driftile 1.15.0-rc.1 is a prerelease candidate for 1.15.0 validation. It was not a stable release.

## Changes since 1.14.0

- Refines the existing full-width toggle, bound by default to `Meta+F`. The
  active frame remains inside equal configured outer gaps, while adjacent
  frames stay at least one physically aligned configured gap beyond the
  corresponding viewport edge.
- Snaps the additional neighbor clearance upward to the assigned output's
  physical-pixel grid. A zero configured gap adds no clearance.
- Preserves the active frame, focus, context, column grouping, and stored
  full-width restore. Toggling the mode again restores the exact prior column
  width and viewport position, and rejected geometry retains the existing
  transactional rollback.
- Adds no state, action, binding, setting, configuration or persistence schema,
  helper profile, application policy, or overview behavior. Both package IDs,
  the eleven-setting profile, stored layouts, and existing shortcuts remain
  compatible with 1.14.0.

## Candidate artifacts

The candidate uses tag
[`v1.15.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.15.0-rc.1)
and these exact asset links:

- [`driftile-1.15.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.15.0-rc.1/driftile-1.15.0-rc.1.kwinscript)
- [`driftile-overview-1.15.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.15.0-rc.1/driftile-overview-1.15.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.15.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.15.0-rc.1/driftile-shortcuts-1.15.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.15.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.15.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.15.0-rc.1/docs/migration.md#upgrade-from-1140-to-1150-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions. The refined full-width path is covered on
  all three backends.
- The optional overview retains its 1.14.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.15.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
