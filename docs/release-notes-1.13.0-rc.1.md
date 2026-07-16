# Driftile 1.13.0-rc.1

Driftile 1.13.0-rc.1 is a prerelease candidate for 1.13.0 validation. It was not a stable release.

## Changes since 1.12.0

- Makes the existing decrease and increase width actions, bound by default to
  `Meta+-` and `Meta+=`, contextual for an active manually floating window.
  Tiled targets retain the existing whole-column behavior.
- Changes the decorated frame width by the configured column-width step times
  the assigned work-area width. The gap is excluded. Targets snap to the
  physical-pixel grid and respect live decorated minimum and maximum widths, a
  positive client width, and the established partial-visibility bounds. Height
  stays unchanged, and the top-left moves only for the minimal visibility clamp.
- Connects the per-window geometry signal before at most one forward frame
  write. An exact synchronous result settles immediately; native Wayland can
  settle through an exact later signal or delayed sample. Twenty unchanged
  delayed samples expire an unacknowledged request.
- Commits floating metadata only for the exact current target. Every other
  result is rejected without compensation, and a blocked or pending floating
  target never falls through to tiled resizing. Focus, output, desktop,
  reinsertion placement, and every tiled layout are preserved; the contextual
  path performs zero tiled mutation.
- Adds no action, binding, setting, configuration or persistence schema, helper
  profile, application matrix, or overview behavior. Both package IDs remain
  unchanged.

## Candidate artifacts

The candidate uses tag
[`v1.13.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.13.0-rc.1)
and these exact asset links:

- [`driftile-1.13.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.13.0-rc.1/driftile-1.13.0-rc.1.kwinscript)
- [`driftile-overview-1.13.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.13.0-rc.1/driftile-overview-1.13.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.13.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.13.0-rc.1/driftile-shortcuts-1.13.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.13.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.13.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.13.0-rc.1/docs/migration.md#upgrade-from-1120-to-1130-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions. The contextual width path is covered on
  all three backends.
- The optional overview retains its 1.12.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.13.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
