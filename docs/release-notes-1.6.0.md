# Driftile 1.6.0

Driftile 1.6.0 was published as a stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.6.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.6.0/driftile-1.6.0.kwinscript)
- [`driftile-overview-1.6.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.6.0/driftile-overview-1.6.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.6.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.6.0/driftile-shortcuts-1.6.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.6.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.6.0/LICENSE)

## Changes since 1.6.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.5.0

- Adds finish-only horizontal pointer-resize adoption for the active normal
  tiled window while KWin retains interactive-resize ownership.
- Accepts only an unambiguous width-only left- or right-edge finish in the same
  settled, visible, unchanged output and desktop.
- Stages every writable same-context target while the prior logical layout
  remains unchanged. Two exact target samples commit the accepted width as the
  active column's fixed-width policy with one layout publication.
- Retains or restores the prior width policy and frames after participant,
  state, context, topology, constraint, geometry, or late-configure races.
  Recovery is bounded and never competes with lost native-state ownership.
- Changes no settings, shortcut action IDs, bindings, gestures, persistence
  schema, or overview behavior. Existing package IDs and stored layouts remain
  compatible with 1.5.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.6.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Pointer-resize adoption requires KWin to finish an eligible horizontal
  resize. Driftile does not initiate or take ownership of the interactive
  resize.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging remains unverified.
- Native X11 is verified on one output with grid-aligned resize widths;
  multi-output X11 remains unverified.
- Real GPU combinations and the wider hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.6.0/docs/compatibility.md)
for the complete supported boundary.
