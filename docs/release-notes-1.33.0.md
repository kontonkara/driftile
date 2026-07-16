# Driftile 1.33.0

Driftile 1.33.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.

Download matching files from tag
[`v1.33.0`](https://github.com/kontonkara/driftile/releases/tag/v1.33.0) and
verify them with `SHA256SUMS`:

- `driftile-1.33.0.kwinscript`
- `driftile-overview-1.33.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.33.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.33.0.mjs`, if using the optional shortcut helper
- `SHA256SUMS`
- `LICENSE`

## Changes since 1.32.0

- Restores optional geometry animations for off-screen columns and outputs
  with negative global coordinates. Eligible non-negative moves retain smooth
  position retargeting; other moves use relative translation.
- Makes vertical touchpad desktop navigation target the single output under
  the pointer. Output gaps, overlaps, and invalid pointer geometry are safe
  no-ops; keyboard desktop navigation is unchanged.
- Lets an exact overview thumbnail or tab move to a desktop card on another
  output. Output and desktop results are confirmed separately, with bounded
  compensation for a partial write.

## Upgrade

Disable the main script and optional effects, install matching 1.33.0 files,
then re-enable only the components you use. NixOS and Home Manager users can
pin the flake input to `v1.33.0` and rebuild.

Configuration, shortcut assignments, and logical layout state remain
compatible with 1.32.0. No migration or new setting is required.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.33.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.33.0/docs/migration.md),
and [compatibility guide](https://github.com/kontonkara/driftile/blob/v1.33.0/docs/compatibility.md).
