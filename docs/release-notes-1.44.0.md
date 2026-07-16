# Driftile 1.44.0

Driftile 1.44.0 expands the optional overview's access and desktop controls.

## Highlights

- Reserve any pointer screen edge or corner to open the overview, with no
  reservation by default.
- Configure the overview backdrop color and opacity.
- Select a non-current desktop by clicking empty content in its card.
- Manage the screen edge and backdrop independently through Home Manager.

Window, tab, gutter, reorder, search, and drag targets keep their existing
priority. The release adds no shortcut, default binding, or persistence change.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.44.0`](https://github.com/kontonkara/driftile/releases/tag/v1.44.0) and
verify them with `SHA256SUMS`:

- `driftile-1.44.0.kwinscript`
- `driftile-overview-1.44.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.44.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.44.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.44.0 artifact, then re-enable them. Nix users should pin the input to
`v1.44.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.44.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.44.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.44.0/docs/configuration.md).
