# Driftile 1.35.0

Driftile 1.35.0 is the latest stable release.

## Highlights

- A singleton column or stack can optionally stay centered, and window gaps
  now accept fractional logical-pixel values.
- An optional empty virtual desktop can be kept before the first occupied
  desktop. Lifecycle and overview operations preserve both dynamic desktop
  boundaries safely.
- Column-width and window-height preset cycles can mix proportional values with
  fixed logical-pixel values.
- Exact application rules can assign either a proportional or fixed initial
  width to new singleton columns.
- A fixed global default width can optionally replace the proportional default
  for new columns and explicit width resets.

No shortcut ID or default binding changes. Logical layout persistence remains
v4.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.35.0`](https://github.com/kontonkara/driftile/releases/tag/v1.35.0) and
verify them with `SHA256SUMS`:

- `driftile-1.35.0.kwinscript`
- `driftile-overview-1.35.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.35.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.35.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.35.0 artifact, then re-enable them. Nix users should pin the input to
`v1.35.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.35.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.35.0/docs/migration.md),
and [compatibility guide](https://github.com/kontonkara/driftile/blob/v1.35.0/docs/compatibility.md).
