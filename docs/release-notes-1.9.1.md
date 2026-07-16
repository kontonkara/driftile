# Driftile 1.9.1

Driftile 1.9.1 was published as a stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.9.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.9.1/driftile-1.9.1.kwinscript)
- [`driftile-overview-1.9.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.9.1/driftile-overview-1.9.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.9.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.9.1/driftile-shortcuts-1.9.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.9.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.9.1/LICENSE)

## Changes since 1.9.1-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.9.0

- Places a full-width active column between equal configured outer gaps and
  moves both adjacent columns entirely outside the viewport.
- Restores the exact prior column width and viewport when full width is toggled
  off, including after an extension reload. A failed geometry transaction
  retains the full-width state.
- Persists the restore viewport as an optional addition to full-width toggle
  metadata. Version 1.9.1 accepts 1.9.0 documents that omit it.
- Keeps downgrades safe: version 1.9.0 rejects documents containing the
  additive field atomically and starts through normal admission without
  restoring the newer toggle metadata.
- Adds no action, binding, setting, gesture, or overview behavior. Both package
  IDs, all ten settings, and the KWin 6.7 platform boundary remain unchanged.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged migration paths for
[1.9.0](https://github.com/kontonkara/driftile/blob/v1.9.1/docs/migration.md#upgrade-from-190-to-191)
or
[1.9.1-rc.1](https://github.com/kontonkara/driftile/blob/v1.9.1/docs/migration.md#upgrade-from-191-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging and native X11 multi-output layouts remain
  unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.9.1/docs/compatibility.md)
for the complete supported boundary.
