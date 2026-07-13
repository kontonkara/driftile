# Driftile 1.8.0-rc.1

Driftile 1.8.0-rc.1 is a prerelease candidate for 1.8.0 validation. It is not
a stable release; 1.7.0 remains the latest stable version.

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
  persistence format. Existing package IDs, settings, and stored layouts remain
  compatible with 1.7.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.8.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.8.0-rc.1)
and these exact asset links:

- [`driftile-1.8.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.8.0-rc.1/driftile-1.8.0-rc.1.kwinscript)
- [`driftile-overview-1.8.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.8.0-rc.1/driftile-overview-1.8.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.8.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.8.0-rc.1/driftile-shortcuts-1.8.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.8.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.8.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.8.0-rc.1/docs/migration.md#upgrade-from-170-to-180-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- Per-output overview selection is physically verified in native Wayland and
  XWayland passes of the two-output Wayland scenario.
- Native X11 retains static coverage of the guarded single-output global
  fallback; end-to-end selection activation is not claimed there.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.8.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
