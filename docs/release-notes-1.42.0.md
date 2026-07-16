# Driftile 1.42.0

Driftile 1.42.0 is a stable release.

## Highlights

- A global optional initial desktop and output destination sits beneath exact
  per-application destination rules.
- A global `default`, `focused`, or `unfocused` policy controls genuinely new
  normal windows beneath exact focus rules.
- Closing the active window ignores replacements from another desktop, output,
  or activity and performs one bounded follow-up recovery after delayed KWin
  settlement.
- Rapid focus changes during a workspace transition retain one-shot,
  context-guarded visibility until the optional animation begins.

The new defaults preserve KWin behavior unless configured. Existing windows,
shortcut IDs, default bindings, and logical persistence schema remain
unchanged.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Wayland, XWayland, and
single-output native X11 use the existing compatibility baseline.

## Install

Download matching files from
[`v1.42.0`](https://github.com/kontonkara/driftile/releases/tag/v1.42.0) and
verify them with `SHA256SUMS`:

- `driftile-1.42.0.kwinscript`
- `driftile-overview-1.42.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.42.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.42.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.42.0 artifact, then re-enable them. Nix users should pin the input to
`v1.42.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.42.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.42.0/docs/migration.md),
and [configuration guide](https://github.com/kontonkara/driftile/blob/v1.42.0/docs/configuration.md).
