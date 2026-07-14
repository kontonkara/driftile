# Driftile 1.18.0-rc.1

Driftile 1.18.0-rc.1 is a prerelease candidate for 1.18.0 validation. It is not
a stable release; 1.17.0 remains the latest stable version.

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
  geometry, or persistence write. The candidate adds no action, binding,
  layout-state field, overview behavior, or helper behavior.

## Candidate artifacts

The candidate uses tag
[`v1.18.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.18.0-rc.1)
and these exact asset links:

- [`driftile-1.18.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.18.0-rc.1/driftile-1.18.0-rc.1.kwinscript)
- [`driftile-overview-1.18.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.18.0-rc.1/driftile-overview-1.18.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.18.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.18.0-rc.1/driftile-shortcuts-1.18.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.18.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.18.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.18.0-rc.1/docs/migration.md#upgrade-from-1170-to-1180-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Candidate gates

- Existing behavior coverage verifies selected-member matching, unmatched
  minimal reveal, global fallback, and write-free reconfiguration.
- Existing settings, KConfig, KCM, Home Manager, and package checks cover all
  thirteen fields.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI must pass on the
  unchanged candidate commit.
- The tag release workflow must pass before publishing the candidate assets.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The optional overview retains its 1.17.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.18.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
