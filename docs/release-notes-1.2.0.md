# Driftile 1.2.0

Driftile 1.2.0 is the latest stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- `driftile-1.2.0.kwinscript`
- `driftile-shortcuts-1.2.0.mjs`, if using the optional shortcut helper
- `SHA256SUMS`
- `LICENSE`

## Changes since 1.2.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.1.0

- Adds up to 128 exact, case-sensitive KWin `desktopFileName` exclusions.
  Matching normal application windows remain outside layout ownership.
- Applies exclusions live. Adding a rule releases matching tiled, waiting, or
  manually floating windows without a frame write; removing one performs fresh
  admission after KWin-owned native-state blockers clear.
- Extends the atomic KConfig and Home Manager configuration from eight typed
  settings to nine. A blank exclusion list preserves 1.1 behavior.
- Keeps the package ID, shortcut actions, and persisted layout format
  compatible with 1.1.0.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile before
upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.2.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Exclusions require the exact `desktopFileName` reported by KWin. Missing or
  unusable identifiers do not match.
- Physical connector hot-plugging remains unverified.
- Native X11 is verified on one output; multi-output X11 remains unverified.
- Real GPU combinations and the wider hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.2.0/docs/compatibility.md)
for the complete supported boundary.
