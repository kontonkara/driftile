# Driftile 1.14.0-rc.1

Driftile 1.14.0-rc.1 is a prerelease candidate for 1.14.0 validation. It was not a stable release.

## Changes since 1.13.0

- Makes the existing decrease and increase window-height actions, bound by
  default to `Meta+Shift+-` and `Meta+Shift+=`, contextual for an active
  manually floating window. Tiled targets retain the existing stack-reflow
  behavior; reset and height-preset actions remain tiled-only.
- Changes the decorated floating frame height by
  `WindowHeightStepPercent` times the assigned work-area height. The gap is
  excluded. Targets snap to the assigned output's physical-pixel grid and
  respect live decorated minimum and maximum heights, a positive client height,
  and the established partial-visibility bounds. Width stays unchanged, and
  the top-left moves only for the minimal visibility clamp.
- Connects the per-window geometry signal before at most one forward frame
  write. An exact synchronous result settles immediately; native Wayland can
  settle through an exact later signal or delayed sample. Twenty unchanged
  delayed samples expire an unacknowledged request.
- Commits floating metadata only for the exact current target. Every other
  result is rejected without compensation, and a blocked or pending floating
  target never falls through to tiled resizing. Focus, output, desktop,
  reinsertion placement, and every tiled layout are preserved.
- Adds no action, binding, setting, configuration or persistence schema, helper
  profile, application policy, or overview behavior. Both package IDs, the
  eleven-setting profile, stored layouts, and existing shortcuts remain
  compatible with 1.13.0.

## Candidate artifacts

The candidate uses tag
[`v1.14.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.14.0-rc.1)
and these exact asset links:

- [`driftile-1.14.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.14.0-rc.1/driftile-1.14.0-rc.1.kwinscript)
- [`driftile-overview-1.14.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.14.0-rc.1/driftile-overview-1.14.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.14.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.14.0-rc.1/driftile-shortcuts-1.14.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.14.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.14.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.14.0-rc.1/docs/migration.md#upgrade-from-1130-to-1140-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions. The contextual floating-height path is
  covered on all three backends.
- The optional overview retains its 1.13.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.14.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
