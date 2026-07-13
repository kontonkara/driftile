# Driftile 1.8.0

Driftile 1.8.0 is the latest stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.8.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.8.0/driftile-1.8.0.kwinscript)
- [`driftile-overview-1.8.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.8.0/driftile-overview-1.8.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.8.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.8.0/driftile-shortcuts-1.8.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.8.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.8.0/LICENSE)

## Changes since 1.8.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.7.0

- Adds guarded left-click desktop selection to non-current number gutters in
  the optional overview. The current gutter remains inert.
- Revalidates the active effect and model, exact live screen and projected
  output, direct desktop object and ID, and non-current state before writing.
- Uses public `KWin.SceneView.currentDesktop` on Wayland. When that property is
  unavailable, `KWin.Workspace.currentDesktop` is allowed only with one live
  screen.
- Closes the effect only after an exact read confirms the selected desktop.
  Invalid, stale, raced, or rejected requests leave it open.
- Adds no setting, action, default binding, schema, drag, rearrangement, private
  API, timer, window scan, or layout scan.
- Changes no main-script runtime, shortcut action ID, binding, gesture, or
  persistence format. Both package IDs, the ten settings, shortcuts, and stored
  layouts remain compatible with 1.7.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.8.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Overview desktop selection accepts only a non-current number gutter with an
  exact live desktop and output match. The current gutter remains inert.
- Per-output selection is physically verified in native Wayland and XWayland
  passes of the two-output Wayland scenario. Native X11 retains static coverage
  of the guarded single-output fallback; end-to-end selection is not claimed.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.8.0/docs/compatibility.md)
for the complete supported boundary.
