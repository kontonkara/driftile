# Driftile 1.2.0-rc.1

Driftile 1.2.0-rc.1 is a prerelease candidate for 1.2.0 validation. It is not
a stable release; 1.1.0 remains the latest stable version.

## Changes since 1.1.0

- Adds up to 128 exact, case-sensitive KWin `desktopFileName` exclusions.
  Matching application windows remain outside layout ownership.
- Applies exclusions live. Adding a rule releases matching tiled or waiting
  windows without a frame write; removing one performs fresh admission after
  KWin-owned native-state blockers clear.
- Extends the atomic KConfig and Home Manager configuration from eight typed
  settings to nine. A blank exclusion list preserves 1.1 behavior.
- Keeps the package ID, shortcut actions, and persisted layout format
  compatible with 1.1.0.

## Candidate artifacts

The candidate uses tag
[`v1.2.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.2.0-rc.1)
and these exact asset links:

- [`driftile-1.2.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.2.0-rc.1/driftile-1.2.0-rc.1.kwinscript)
- [`driftile-shortcuts-1.2.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.2.0-rc.1/driftile-shortcuts-1.2.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.2.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.2.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.2.0-rc.1/docs/migration.md#upgrade-from-110-to-120-rc1)
for the upgrade procedure.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions; multi-output X11 is unverified.
- Exclusions require the exact `desktopFileName` reported by KWin. Missing or
  unusable identifiers do not match.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.2.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
