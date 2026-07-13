# Driftile 1.4.0-rc.1

Driftile 1.4.0-rc.1 is a prerelease candidate for 1.4.0 validation. It is not
a stable release; 1.3.0 remains the latest stable version.

## Changes since 1.3.0

- Adds optional five-finger horizontal touchpad navigation, disabled by
  default. A completed left swipe focuses the next column to the right; a
  completed right swipe focuses the previous column to the left.
- Exposes the feature through the atomic KConfig snapshot and typed Home
  Manager settings. Existing configurations keep the feature disabled.
- Targets native Wayland. Enabling the setting on native X11 is a safe no-op.
- Adds no shortcut actions or default bindings. Existing action IDs, overview
  behavior, and the persisted-layout format remain compatible with 1.3.0.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.4.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.4.0-rc.1)
and these exact asset links:

- [`driftile-1.4.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.4.0-rc.1/driftile-1.4.0-rc.1.kwinscript)
- [`driftile-overview-1.4.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.4.0-rc.1/driftile-overview-1.4.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.4.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.4.0-rc.1/driftile-shortcuts-1.4.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.4.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.4.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.4.0-rc.1/docs/migration.md#upgrade-from-130-to-140-rc1)
for upgrade and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions; multi-output X11 is unverified.
- Touchpad navigation requires native Wayland and a five-finger touchpad. It is
  inert on native X11.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU and touchpad hardware
  matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.4.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
