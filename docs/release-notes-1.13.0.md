# Driftile 1.13.0

Driftile 1.13.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.13.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.13.0/driftile-1.13.0.kwinscript)
- [`driftile-overview-1.13.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.13.0/driftile-overview-1.13.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.13.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.13.0/driftile-shortcuts-1.13.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.13.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.13.0/LICENSE)

## Changes since 1.13.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture,
helper profile, overview behavior, or application-matrix changes since RC.1.
The validated candidate was promoted with the final version metadata and release
documentation.

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
- Adds no action, binding, setting, configuration schema, persistence format,
  gesture, helper profile, or overview behavior and does not expand the
  application matrix. Both package IDs remain unchanged.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.12.0](https://github.com/kontonkara/driftile/blob/v1.13.0/docs/migration.md#upgrade-from-1120-to-1130)
or
[1.13.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.13.0/docs/migration.md#upgrade-from-1130-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.13.0/docs/compatibility.md)
for the complete supported boundary.
