# Driftile 1.47.0

Driftile 1.47.0 adds live destination previews when dragging tiled windows
between visible outputs or virtual desktops.

## Highlights

- Preview the exact destination window half or an empty horizontal gutter
  before releasing a cross-output or cross-desktop drag.
- Resolve an exact window under the pointer before evaluating an empty gutter.
- Use the same destination planning for preview and commit, then revalidate the
  final pointer target before changing layout state.
- Keep newer feedback visible when delayed cleanup from an earlier drag
  arrives.

Pointer transport remains owned by KWin, and no layout state changes until the
drop is committed. Logical persistence remains v4. Settings, shortcut IDs,
default bindings, and the optional overview are unchanged.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.47.0`](https://github.com/kontonkara/driftile/releases/tag/v1.47.0) and
verify them with `SHA256SUMS`:

- `driftile-1.47.0.kwinscript`
- `driftile-overview-1.47.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.47.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.47.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.47.0 artifact, then re-enable them. Nix users should pin the input to
`v1.47.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.47.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.47.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.47.0/docs/configuration.md).
