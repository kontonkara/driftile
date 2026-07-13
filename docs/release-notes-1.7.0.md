# Driftile 1.7.0

Driftile 1.7.0 is the latest stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.7.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.7.0/driftile-1.7.0.kwinscript)
- [`driftile-overview-1.7.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.7.0/driftile-overview-1.7.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.7.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.7.0/driftile-shortcuts-1.7.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.7.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.7.0/LICENSE)

## Changes since 1.7.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.6.0

- Adds guarded left-click focus to valid thumbnails in the optional overview's
  current desktop card.
- Revalidates the live window, exact ID, input eligibility, state, output,
  desktop, and current activity before requesting focus.
- Writes only `KWin.Workspace.activeWindow` and closes the effect only after
  KWin confirms the selected window active. Invalid, stale, or rejected requests
  leave the effect open.
- Does not switch desktops or activities; move windows; write memberships,
  outputs, geometry, or settings; or add actions, bindings, gestures, drag,
  keyboard navigation, schema, IPC, private APIs, timers, or workspace scans.
- Changes no main-script runtime, settings, shortcut action IDs, bindings,
  gestures, or persistence format. Existing package IDs and stored layouts
  remain compatible with 1.6.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.7.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Overview focus accepts only a valid thumbnail in the current desktop card.
  Ordinary KWin activation may raise the window, and existing Driftile focus
  handling may reveal its tiled column.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging remains unverified.
- Native X11 is verified on one output; multi-output X11 remains unverified.
- Real GPU combinations and the wider hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.7.0/docs/compatibility.md)
for the complete supported boundary.
