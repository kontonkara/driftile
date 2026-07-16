# Driftile 1.18.0

Driftile 1.18.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.18.0`](https://github.com/kontonkara/driftile/releases/tag/v1.18.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.18.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.18.0/driftile-1.18.0.kwinscript)
- [`driftile-overview-1.18.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.18.0/driftile-overview-1.18.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.18.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.18.0/driftile-shortcuts-1.18.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.18.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.18.0/LICENSE)

## Changes since 1.17.0

- Adds `ApplicationFocusCentering`, an empty-by-default list of up to 128 exact,
  case-sensitive KWin `desktopFileName` values. The fifth **Applications**
  control edits it, while Home Manager writes a sorted list. A successful left,
  right, first, or last tiled-focus action centers a matching selected
  destination when a center preview can be prepared.
- Keeps unmatched destinations and failed center previews on normal minimal
  reveal. A stacked destination checks only its selected member, while the
  existing global option still centers every destination.
- Replaces the bounded list without an immediate layout, viewport, focus,
  geometry, or persistence write. The release adds no action, binding,
  layout-state field, overview behavior, or helper behavior.

Stable 1.18.0 adds no behavior or data change after 1.18.0-rc.1.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.17.0](https://github.com/kontonkara/driftile/blob/v1.18.0/docs/migration.md#upgrade-from-1170-to-1180)
or
[1.18.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.18.0/docs/migration.md#upgrade-from-1180-rc1).

## Validation

- Existing behavior coverage verifies selected-member matching, unmatched
  minimal reveal, global fallback, and write-free reconfiguration.
- Existing settings, KConfig, KCM, Home Manager, and package checks cover all
  thirteen fields.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI cover the unchanged
  release commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

## Compatibility and known limits

- The optional overview retains its 1.17.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.18.0/docs/compatibility.md)
for the complete supported boundary.
