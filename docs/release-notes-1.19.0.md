# Driftile 1.19.0

Driftile 1.19.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.19.0`](https://github.com/kontonkara/driftile/releases/tag/v1.19.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.19.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.19.0/driftile-1.19.0.kwinscript)
- [`driftile-overview-1.19.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.19.0/driftile-overview-1.19.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.19.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.19.0/driftile-shortcuts-1.19.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.19.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.19.0/LICENSE)

## Changes since 1.18.0

- Adds tabbed column presentation. `Meta+W` toggles the active tiled column
  between stacked and tabbed modes. Every non-minimized tabbed member shares
  the existing column frame, and the selected member owns focus and stacking
  intent.
- Keeps the existing vertical commands: focus selects the next or previous
  member without wrapping, move reorders the selected member, and height
  commands preserve dormant height policies until stacked mode returns.
- Keeps the target column's presentation when a member enters. Splits and
  extractions create stacked singletons, while whole-column moves preserve
  presentation and selection.
- Advances canonical logical state from v1 to v3 for presentation and
  selection. Bare and catalog-nested v1 state migrate to v3 while the bounded
  topology catalog remains v2.
- Projects only the selected tabbed member's thumbnail in the optional
  overview.
- Anchors an immediate normal-width successor after an inactive full-width
  predecessor to the work area's left configured gap, independent of display
  resolution.
- Refreshes KWin during source install and upgrade activation so an in-place
  upgrade cannot reuse a cached QML bridge.
- Adds `Meta+Q` as the default close-active-window binding, delegated to KWin.
  `Meta+C` remains the contextual centering action.

Compared with 1.19.0-rc.1, stable 1.19.0 adds only the close-window action and
its `Meta+Q` default. It changes no layout behavior, configuration,
persistence, package ID, or overview behavior.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.18.0](https://github.com/kontonkara/driftile/blob/v1.19.0/docs/migration.md#upgrade-from-1180-to-1190)
or
[1.19.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.19.0/docs/migration.md#upgrade-from-1190-rc1).

## Validation

- Model, geometry, persistence, overview, shortcut, and operation-bound
  coverage verifies tabbed presentation and the full-width successor fix.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  backend integration, hidden full and lifecycle VMs, version, and exact-SHA CI
  cover the final stable release commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

## Compatibility and known limits

- Tabbed presentation adds no persistent tab strip, pointer tab navigation,
  animation, setting, settings UI, private API, or compositor-owned surface.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.19.0/docs/compatibility.md)
for the complete supported boundary.
