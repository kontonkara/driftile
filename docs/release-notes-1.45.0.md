# Driftile 1.45.0

Driftile 1.45.0 expands direct virtual-desktop control and fixes two timing
paths around focus and optional transitions.

## Highlights

- Map numbered focus and transfer actions to exact virtual desktop names while
  retaining positional fallback for every unconfigured slot.
- Move the selected virtual desktop directly to positions 1 through 9 with new
  unbound actions.
- Restore the most recent eligible same-context window after closing the active
  window while layout geometry is still settling.
- Preserve the first focus-driven geometry transition immediately after a
  workspace presentation handoff.

The exact-name map is empty by default, the new reorder actions are unbound,
and logical layout state remains v4.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.45.0`](https://github.com/kontonkara/driftile/releases/tag/v1.45.0) and
verify them with `SHA256SUMS`:

- `driftile-1.45.0.kwinscript`
- `driftile-overview-1.45.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.45.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.45.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.45.0 artifact, then re-enable them. Nix users should pin the input to
`v1.45.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.45.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.45.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.45.0/docs/configuration.md).
