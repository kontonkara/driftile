# Driftile 1.9.0

Driftile 1.9.0 is the latest stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.9.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.9.0/driftile-1.9.0.kwinscript)
- [`driftile-overview-1.9.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.9.0/driftile-overview-1.9.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.9.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.9.0/driftile-shortcuts-1.9.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.9.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.9.0/LICENSE)

## Changes since 1.9.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.8.0

- Adds guarded left-click activation to valid thumbnails in non-current desktop
  cards. Current-card focus is unchanged.
- Before selection, revalidates the exact effect, model, live screen, projected
  output, desktop object and ID, window object and ID, current activity,
  memberships, deletion and minimization state, and input eligibility while
  accepting the expected off-desktop hidden state.
- Selects and confirms the desktop through public
  `KWin.SceneView.currentDesktop` on Wayland. If that property is unavailable,
  `KWin.Workspace.currentDesktop` is allowed only with one live screen. After
  confirmation, it repeats the exact effect, model, screen, output, desktop,
  window, activity, membership, state, and input checks, now requiring the
  window to be visible, before requesting and confirming exact
  `KWin.Workspace.activeWindow` focus.
- Leaves the effect open without a focus write when validation or selection
  fails before confirmation. A later failure keeps the confirmed desktop,
  closes the stale effect, and performs no rollback.
- Adds no action, binding, setting, schema, drag or rearrangement behavior,
  private API, timer, window move, geometry write, membership write, or window,
  stacking-order, or layout scan.
- Changes no main-script runtime, shortcut action ID, binding, gesture, or
  persistence format. Both package IDs, all ten settings, shortcut action IDs
  and bindings, gesture behavior, and stored layouts remain compatible with
  1.8.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged migration paths for
[1.8.0](https://github.com/kontonkara/driftile/blob/v1.9.0/docs/migration.md#upgrade-from-180-to-190)
or
[1.9.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.9.0/docs/migration.md#upgrade-from-190-rc1).

## Known limits

- Cross-desktop overview activation requires an exact live desktop, output,
  activity, and window match. Ordinary KWin activation may raise the target,
  and existing Driftile focus handling may reveal its tiled column.
- The two-output Wayland physical-click scenario verifies exact target focus
  against a distinct last-active decoy in native Wayland and XWayland
  application passes.
- Native X11 retains only static coverage of the guarded single-output
  activation fallback; end-to-end cross-desktop activation is not claimed.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.9.0/docs/compatibility.md)
for the complete supported boundary.
