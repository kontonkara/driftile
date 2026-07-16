# Driftile 1.15.1

Driftile 1.15.1 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.15.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.15.1/driftile-1.15.1.kwinscript)
- [`driftile-overview-1.15.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.15.1/driftile-overview-1.15.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.15.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.15.1/driftile-shortcuts-1.15.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.15.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.15.1/LICENSE)

## Changes since 1.15.0

- Keeps a focus-revealed column inside the configured outer gaps instead of
  aligning it directly with the work-area edge.
- Derives edge clearance from the assigned output's current work area, gap, and
  device-pixel ratio; no display dimensions are fixed in the layout policy.
- Parks an inactive full-width frame wholly beyond the opposite viewport edge
  when a newly active column is revealed, preventing a clipped frame from
  touching that edge.
- Adds no state, action, binding, setting, configuration or persistence schema,
  helper profile, application policy, or overview behavior. Existing
  configuration, layout state, and shortcut assignments remain compatible; no
  reset or migration is required.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged
[1.15.1 migration path](https://github.com/kontonkara/driftile/blob/v1.15.1/docs/migration.md#upgrade-from-1150-to-1151).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.15.1/docs/compatibility.md)
for the complete supported boundary.
