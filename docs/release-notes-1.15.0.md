# Driftile 1.15.0

Driftile 1.15.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.15.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.15.0/driftile-1.15.0.kwinscript)
- [`driftile-overview-1.15.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.15.0/driftile-overview-1.15.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.15.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.15.0/driftile-shortcuts-1.15.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.15.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.15.0/LICENSE)

## Changes since 1.15.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture,
helper profile, overview behavior, or application-policy changes since RC.1.
The validated candidate was promoted with the final version metadata and release
documentation.

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

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.14.0](https://github.com/kontonkara/driftile/blob/v1.15.0/docs/migration.md#upgrade-from-1140-to-1150)
or
[1.15.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.15.0/docs/migration.md#upgrade-from-1150-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.15.0/docs/compatibility.md)
for the complete supported boundary.
