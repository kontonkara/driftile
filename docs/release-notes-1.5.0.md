# Driftile 1.5.0

Driftile 1.5.0 was published as a stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.5.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.5.0/driftile-1.5.0.kwinscript)
- [`driftile-overview-1.5.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.5.0/driftile-overview-1.5.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.5.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.5.0/driftile-shortcuts-1.5.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.5.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.5.0/LICENSE)

## Changes since 1.5.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.4.0

- Adds finish-only pointer adoption after KWin selects another visible desktop
  on the same output and moves the active normal tiled window there.
- Inserts before or after one exact eligible tiled target under the release
  point while preserving the destination column width, assigning automatic
  height, and retaining focus.
- Leaves desktop selection and window membership to KWin. An empty, ambiguous,
  stale, blocked, or raced target retains KWin's completed move and uses normal
  singleton admission.
- Compensates a partial destination write before fallback and performs no
  geometry writes on the hidden source desktop or unrelated contexts.
- Changes no settings, shortcut action IDs, bindings, gestures, persistence
  schema, or overview behavior. Existing package IDs and stored layouts remain
  compatible with 1.4.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.5.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Cross-desktop adoption requires KWin to complete the desktop selection and
  window-membership move. Driftile does not initiate either mechanism.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging remains unverified.
- Native X11 is verified on one output with the global-desktop fallback;
  multi-output X11 remains unverified.
- Real GPU combinations and the wider hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.5.0/docs/compatibility.md)
for the complete supported boundary.
