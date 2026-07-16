# Driftile 1.16.0

Driftile 1.16.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.16.0`](https://github.com/kontonkara/driftile/releases/tag/v1.16.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.16.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.16.0/driftile-1.16.0.kwinscript)
- [`driftile-overview-1.16.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.16.0/driftile-overview-1.16.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.16.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.16.0/driftile-shortcuts-1.16.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.16.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.16.0/LICENSE)

## Changes since 1.16.0-rc.1

- Toggling full-width mode off restores the prior column width while retaining
  the current viewport and horizontal anchor. The active column no longer moves
  back to its pre-toggle viewport position.
- Configuration, helper profiles, package IDs, actions, bindings, and persisted
  layouts remain compatible with RC.1. No reset or conversion is required.

## Changes since 1.15.1

- Adds coalesced same-context pointer feedback through KWin's public outline
  API. Valid targets show the exact before-or-after drop half; invalid, stale,
  or conflicting feedback clears without changing layout state. Cross-context
  moves remain finish-only.
- Adds the empty-default `ApplicationInitialFloating` setting and Home Manager
  `programs.driftile.settings.applicationInitialFloating` list. Exact matching
  affects only fresh admissions; existing and restored ownership, tiling
  exclusions, and automatic-floating roles retain priority.
- Restores only the prior column width when full-width mode is toggled off,
  retaining the current viewport and horizontal anchor.
- Expands a non-null Home Manager settings profile from eleven to twelve values.
  A blank or omitted application list preserves 1.15.1 admission behavior. The
  layout persistence schema, actions, bindings, helper profile, package IDs,
  and overview behavior are unchanged.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.15.1](https://github.com/kontonkara/driftile/blob/v1.16.0/docs/migration.md#upgrade-from-1151-to-1160)
or
[1.16.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.16.0/docs/migration.md#upgrade-from-1160-rc1).

## Validation

- Focused tests cover pointer feedback, initial floating admission, and current
  viewport retention after restoring a full-width column.
- Packaged native Wayland, XWayland, and single-output native X11 scenarios
  cover the supported transports.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, exact-SHA CI, and release gates pass.

## Compatibility and known limits

- Pointer feedback shares KWin's global outline with other scripts and effects;
  detected conflicts disable feedback for that drag without affecting the drop.
- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.16.0/docs/compatibility.md)
for the complete supported boundary.
