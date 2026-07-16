# Driftile 1.34.0

Driftile 1.34.0 is the latest stable release.

## Highlights

- Optional transitions retain deferred motion across workspace handoffs and
  temporary invisibility, while rapid off-output moves no longer restart the
  visible translation.
- Transition settings can independently disable movement or size animation and
  exclude up to 128 exact KWin `windowClass` values. Public shell, OSD,
  lock-screen, outline, internal, and switcher-hidden surfaces are excluded
  automatically.
- Horizontal focus can optionally center a destination only when it and the
  nearest directional neighbor do not both fit the current work area. Existing
  always-center and application rules retain priority.

No shortcut ID or default binding changes. Logical layout persistence remains
v4.

## Install

Download matching files from
[`v1.34.0`](https://github.com/kontonkara/driftile/releases/tag/v1.34.0) and
verify them with `SHA256SUMS`:

- `driftile-1.34.0.kwinscript`
- `driftile-overview-1.34.0.kwineffect`, if using the optional overview
- `driftile-transitions-1.34.0.kwineffect`, if using optional transitions
- `driftile-shortcuts-1.34.0.mjs`, if using the optional shortcut helper

Disable installed Driftile packages, replace every package you use with the
matching 1.34.0 artifact, then re-enable them. Nix users should pin the input to
`v1.34.0` and rebuild.

See the tagged [installation guide](https://github.com/kontonkara/driftile/blob/v1.34.0/docs/installation.md),
[migration guide](https://github.com/kontonkara/driftile/blob/v1.34.0/docs/migration.md),
and [compatibility guide](https://github.com/kontonkara/driftile/blob/v1.34.0/docs/compatibility.md).
