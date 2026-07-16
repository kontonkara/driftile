# Driftile 1.38.0

Driftile 1.38.0 is a stable release.

## Highlights

- Optional transitions keep moving during desktop handoffs and remain smooth
  across rapid commands and outputs with negative global coordinates.
- Exact application rules can open fresh windows as full-width columns or
  request native fullscreen while preserving the normal state underneath.
- Exact application rules can place the first manual-floating frame at one of
  eight work-area anchors with signed logical-pixel offsets.

Floating placement snaps to the output's physical-pixel grid, preserves size,
and remembers the accepted frame. Existing, restored, automatic, dialog, and
already manually floating windows are not repositioned. No shortcut or logical
persistence migration is required.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.38.0`](https://github.com/kontonkara/driftile/releases/tag/v1.38.0) and
verify them with `SHA256SUMS`:

- `driftile-1.38.0.kwinscript`
- `driftile-overview-1.38.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.38.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.38.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.38.0 artifact, then re-enable them. Nix users should pin the input
to `v1.38.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.38.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.38.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.38.0/docs/configuration.md).
