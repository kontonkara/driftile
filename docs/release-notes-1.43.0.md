# Driftile 1.43.0

Driftile 1.43.0 is a stable bug-fix release.

## Highlights

- Closing the active window keeps one event-driven recovery intent alive for a
  delayed KWin activation while accepting a legitimate replacement.
- An initially rejected borderless request receives one bounded retry when
  KWin reports decoration-policy settlement.
- The optional transition effect tracks only active participants, retires
  completed state, and discards deferred movement that returns to its origin.
- The Plasma launcher stays outside geometry interpolation.

The release adds no setting, shortcut, default binding, or persistence change.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.43.0`](https://github.com/kontonkara/driftile/releases/tag/v1.43.0) and
verify them with `SHA256SUMS`:

- `driftile-1.43.0.kwinscript`
- `driftile-overview-1.43.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.43.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.43.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.43.0 artifact, then re-enable them. Nix users should pin the input to
`v1.43.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.43.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.43.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.43.0/docs/configuration.md).
