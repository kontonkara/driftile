# Driftile 1.4.0

Driftile 1.4.0 is the latest stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- `driftile-1.4.0.kwinscript`
- `driftile-overview-1.4.0.kwineffect`, if using the optional overview
- `driftile-shortcuts-1.4.0.mjs`, if using the optional shortcut helper
- `SHA256SUMS`
- `LICENSE`

## Changes since 1.4.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.3.0

- Adds optional five-finger horizontal touchpad navigation, disabled by
  default. A completed left swipe focuses the next column to the right; a
  completed right swipe focuses the previous column to the left.
- Exposes the feature through the atomic KConfig snapshot and typed Home
  Manager settings. Existing configurations keep the feature disabled.
- Targets native Wayland. Enabling the setting on native X11 is a safe no-op.
- Adds no shortcut actions or default bindings. Existing package IDs, shortcut
  action IDs, overview behavior, and the persisted-layout format remain
  compatible with 1.3.0.
- Versions the main script and optional overview package together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile and the
optional overview before upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.4.0/docs/migration.md)
for archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Touchpad navigation requires native Wayland and a five-finger touchpad. It is
  inert on native X11.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging remains unverified.
- Native X11 is verified on one output; multi-output X11 remains unverified.
- Real GPU combinations and the wider touchpad hardware matrix remain
  unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.4.0/docs/compatibility.md)
for the complete supported boundary.
