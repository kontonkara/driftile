# Driftile 1.12.0

Driftile 1.12.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.12.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.12.0/driftile-1.12.0.kwinscript)
- [`driftile-overview-1.12.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.12.0/driftile-overview-1.12.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.12.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.12.0/driftile-shortcuts-1.12.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.12.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.12.0/LICENSE)

## Changes since 1.12.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture,
helper profile, or overview behavior changes since RC.1. The validated candidate
was promoted with the final version metadata and release documentation.

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
  windows under KWin geometry ownership. This release adds no action, binding,
  setting, configuration schema, persistence format, helper profile, or
  overview behavior. Both package IDs remain unchanged.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.11.0](https://github.com/kontonkara/driftile/blob/v1.12.0/docs/migration.md#upgrade-from-1110-to-1120)
or
[1.12.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.12.0/docs/migration.md#upgrade-from-1120-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.12.0/docs/compatibility.md)
for the complete supported boundary.
