# Driftile 1.39.0

Driftile 1.39.0 is a stable release.

## Highlights

- Exact application rules can assign a fresh normal window to a one-based
  virtual desktop, a named output, or both before layout admission.
- Exact application rules can request native maximize-to-work-area-edges after
  normal tiled or floating admission and before an optional fullscreen request.

Destination assignment does not select a desktop or change focus. Rejected or
unavailable destinations fall back safely without repeated requests. Startup,
restored, related, transferred, re-admitted, and already tracked windows remain
unchanged. No shortcut or logical persistence migration is required.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.39.0`](https://github.com/kontonkara/driftile/releases/tag/v1.39.0) and
verify them with `SHA256SUMS`:

- `driftile-1.39.0.kwinscript`
- `driftile-overview-1.39.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.39.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.39.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.39.0 artifact, then re-enable them. Nix users should pin the input
to `v1.39.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.39.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.39.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.39.0/docs/configuration.md).
