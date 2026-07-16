# Driftile 1.24.0

Driftile 1.24.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.24.0`](https://github.com/kontonkara/driftile/releases/tag/v1.24.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.24.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.24.0/driftile-1.24.0.kwinscript)
- [`driftile-overview-1.24.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.24.0/driftile-overview-1.24.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.24.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.24.0/driftile-shortcuts-1.24.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.24.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.24.0/LICENSE)

## Changes since 1.23.0

- Requests one best-effort passive Plasma OSD only after the current overview
  activation attempt is rejected.
- Keeps the user-facing message generic and writes the exact technical reason
  only to the KWin journal.
- Keeps cancellation, stale callbacks, successful activation, and normal close
  silent.
- Preserves exact attempt identity so an older callback cannot report against a
  newer activation.

The added handler is constant time and adds no setting, shortcut, input
handler, KWin or layout write, persistence field, or scan beyond the existing
activation snapshot.

## Migration

Do not combine files from different releases. Release any helper-owned
shortcut profile, disable Driftile and the optional overview, then install
their matching 1.24.0 artifacts. No data conversion, Plasma session restart,
KConfig edit, shortcut change, or persistence migration is required. See the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.24.0/docs/migration.md#upgrade-from-1230-to-1240).

## Validation

- A focused overview contract test covers exact attempt identity,
  rejection-only ordering, one OSD request, and silent non-rejection paths.
- QML lint and the package check cover the effect source and release archive.
- A hidden lifecycle VM installs public 1.23.0 packages and upgrades them to
  matching current packages. It validates packaging lifecycle, not OSD
  behavior.
- Exact-SHA CI must pass before the release tag. This slice makes no full
  feature VM claim.

## Compatibility and known limits

- Plasma OSD delivery is best-effort. A missing OSD service does not change
  effect behavior; the KWin journal retains the technical reason.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.24.0/docs/compatibility.md)
for the complete supported boundary.
