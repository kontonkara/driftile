# Driftile 1.14.0

Driftile 1.14.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.14.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.14.0/driftile-1.14.0.kwinscript)
- [`driftile-overview-1.14.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.14.0/driftile-overview-1.14.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.14.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.14.0/driftile-shortcuts-1.14.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.14.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.14.0/LICENSE)

## Changes since 1.14.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture,
helper profile, overview behavior, or application-policy changes since RC.1.
The validated candidate was promoted with the final version metadata and release
documentation.

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

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.13.0](https://github.com/kontonkara/driftile/blob/v1.14.0/docs/migration.md#upgrade-from-1130-to-1140)
or
[1.14.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.14.0/docs/migration.md#upgrade-from-1140-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.14.0/docs/compatibility.md)
for the complete supported boundary.
