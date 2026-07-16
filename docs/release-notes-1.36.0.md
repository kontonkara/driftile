# Driftile 1.36.0

Driftile 1.36.0 is a stable release.

## Highlights

- Deferred window motion resumes after a workspace or fullscreen transition,
  including the case where the destination window becomes visible only when it
  is activated.
- The optional transition effect adds selectable easing and a configurable
  threshold for snapping small resizes while movement continues to animate.
- Column-width and window-height resize actions can use fixed logical-pixel
  steps. A zero fixed step keeps the existing percentage behavior.
- Exact application rules can assign a proportional or fixed initial tiled
  client height to fresh singleton windows and fresh retiles.

No shortcut ID or default binding changes. Logical layout persistence remains
v4.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.36.0`](https://github.com/kontonkara/driftile/releases/tag/v1.36.0) and
verify them with `SHA256SUMS`:

- `driftile-1.36.0.kwinscript`
- `driftile-overview-1.36.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.36.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.36.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.36.0 artifact, then re-enable them. Nix users should pin the input to
`v1.36.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.36.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.36.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.36.0/docs/configuration.md).
