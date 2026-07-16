# Driftile 1.9.0-rc.1

Driftile 1.9.0-rc.1 is a prerelease candidate for 1.9.0 validation. It was not a stable release.

## Changes since 1.8.0

- Adds guarded left-click activation to valid thumbnails in non-current desktop
  cards. Current-card focus is unchanged.
- Before selection, revalidates the exact effect, model, screen, projected
  output, desktop, window, activity, memberships, state, and input eligibility
  while accepting the expected off-desktop hidden state.
- Selects and confirms the desktop through public
  `KWin.SceneView.currentDesktop` on Wayland. If that property is unavailable,
  `KWin.Workspace.currentDesktop` is allowed only with one live screen. It then
  revalidates the same window as visible before requesting and confirming exact
  `KWin.Workspace.activeWindow` focus.
- Leaves the effect open without a focus write when validation or selection
  fails before confirmation. A later failure keeps the confirmed desktop,
  closes the stale effect, and performs no rollback.
- Adds no action, binding, setting, schema, private API, timer, window move,
  geometry write, membership write, or window, stacking-order, or layout scan.
- Changes no main-script runtime, shortcut action ID, binding, gesture, or
  persistence format. Both package IDs, the ten settings, shortcuts, and stored
  layouts remain compatible with 1.8.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.9.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.9.0-rc.1)
and these exact asset links:

- [`driftile-1.9.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.9.0-rc.1/driftile-1.9.0-rc.1.kwinscript)
- [`driftile-overview-1.9.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.9.0-rc.1/driftile-overview-1.9.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.9.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.9.0-rc.1/driftile-shortcuts-1.9.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.9.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.9.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.9.0-rc.1/docs/migration.md#upgrade-from-180-to-190-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The two-output Wayland physical-click scenario verifies exact target focus
  against a distinct last-active decoy in native Wayland and XWayland
  application passes.
- Native X11 retains static coverage of the guarded single-output activation
  fallback; end-to-end cross-desktop activation is not claimed there.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.9.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
