# Driftile 1.41.0

Driftile 1.41.0 is a stable release.

## Highlights

- Fresh-window destination rules can select one uniquely named virtual desktop.
- A global optional first-floating position sits beneath exact per-application
  rules and uses the same anchors, clamping, and output-pixel snapping.
- Exact application rules use KWin `desktopFileName` when available and fall
  back to `resourceClass` when it is unavailable, improving XWayland coverage.
- Closing the active window restores recent focus through temporary ineligible
  KWin activations without overriding a live replacement.
- Rapid geometry updates use shorter scale-aware retargets and skip unchanged
  animation targets.

Existing numeric destinations and application-rule values remain compatible.
The release changes no shortcut ID, default binding, or logical persistence
schema.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.41.0`](https://github.com/kontonkara/driftile/releases/tag/v1.41.0) and
verify them with `SHA256SUMS`:

- `driftile-1.41.0.kwinscript`
- `driftile-overview-1.41.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.41.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.41.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.41.0 artifact, then re-enable them. Nix users should pin the input to
`v1.41.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.41.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.41.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.41.0/docs/configuration.md).
