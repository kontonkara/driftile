# Driftile 1.11.0

Driftile 1.11.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.11.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.11.0/driftile-1.11.0.kwinscript)
- [`driftile-overview-1.11.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.11.0/driftile-overview-1.11.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.11.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.11.0/driftile-shortcuts-1.11.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.11.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.11.0/LICENSE)

## Changes since 1.11.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture, or
overview behavior changes since RC.1. The validated candidate was promoted
with the final version metadata and release documentation.

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

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.10.0](https://github.com/kontonkara/driftile/blob/v1.11.0/docs/migration.md#upgrade-from-1100-to-1110)
or
[1.11.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.11.0/docs/migration.md#upgrade-from-1110-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.11.0/docs/compatibility.md)
for the complete supported boundary.
