# Driftile 1.19.0-rc.1

Driftile 1.19.0-rc.1 is a prerelease candidate for 1.19.0 validation. It is not
a stable release; 1.18.0 remains the latest stable version.

## Changes since 1.18.0

- Adds tabbed column presentation. `Meta+W` is the only new default binding and
  toggles the active tiled column between stacked and tabbed presentation.
  Every non-minimized tabbed member shares the existing column frame and normal
  outer gaps; the selected member owns focus and stacking intent.
- Keeps the existing vertical grammar: focus down or up selects the next or
  previous member without wrapping, while move down or up reorders the selected
  member. Height commands are no-ops while tabbed and restore the dormant
  height policies when returning to stacked presentation.
- Makes the target column's presentation authoritative when a member enters.
  Splits and extractions create stacked singletons, while whole-column moves
  preserve presentation and selection.
- Advances canonical logical state from v1 to v3 for presentation and
  selection. Bare and catalog-nested v1 state migrate to v3 while the bounded
  catalog remains v2. A rollback to 1.18.0 rejects v3 state and keeps the store
  write-locked; follow the migration guide before changing versions.
- Projects only the selected tabbed member's thumbnail in the optional
  overview.
- Anchors an immediate normal-width successor after an inactive full-width
  predecessor to the current work area's left configured gap, independent of
  display resolution, while keeping the predecessor beyond the left viewport
  edge.
- Adds a KWin refresh step to the source install and upgrade instructions. KWin
  can still retain a same-path QML component in memory; stable 1.19.0 replaces
  this candidate mechanism with cache-isolated runtime loading.

## Candidate artifacts

The candidate uses tag
[`v1.19.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.19.0-rc.1)
and these exact asset links:

- [`driftile-1.19.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.19.0-rc.1/driftile-1.19.0-rc.1.kwinscript)
- [`driftile-overview-1.19.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.19.0-rc.1/driftile-overview-1.19.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.19.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.19.0-rc.1/driftile-shortcuts-1.19.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.19.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.19.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.19.0-rc.1/docs/migration.md#upgrade-from-1180-to-1190-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Candidate gates

- Focused model, geometry, persistence, overview, shortcut, and operation-bound
  coverage must pass without expanding the application or VM pools.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  backend integration, hidden full and lifecycle VMs, version, and exact-SHA CI
  must pass on the unchanged candidate commit.
- The tag release workflow must pass before publishing candidate assets.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- Tabbed presentation adds no persistent tab strip, pointer tab navigation,
  animation, setting, settings UI, private API, or compositor-owned surface.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.19.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
