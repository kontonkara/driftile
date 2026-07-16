# Driftile 1.3.0-rc.1

Driftile 1.3.0-rc.1 is a prerelease candidate for 1.3.0 validation. It was not a stable release.

## Changes since 1.2.0

- Adds an optional, separate KWin effect that presents the authoritative
  output, desktop, column, stack, viewport, and floating-window model.
- Keeps the companion read-only. It cannot open unless two matching snapshot
  reads agree with KWin's current outputs, desktops, and referenced windows.
- Leaves the effect disabled and unbound by default, without a screen edge.
  Plasma's built-in Overview remains installed and unchanged.
- Exposes the effect as a separate Nix package and an explicit NixOS or Home
  Manager opt-in.
- Keeps the main script behavior, package ID, nine settings, shortcut action
  IDs, and persisted-layout format compatible with 1.2.0.

## Candidate artifacts

The candidate uses tag
[`v1.3.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.3.0-rc.1)
and these exact asset links:

- [`driftile-1.3.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.3.0-rc.1/driftile-1.3.0-rc.1.kwinscript)
- [`driftile-overview-1.3.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.3.0-rc.1/driftile-overview-1.3.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.3.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.3.0-rc.1/driftile-shortcuts-1.3.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.3.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.3.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.3.0-rc.1/docs/migration.md#upgrade-from-120-to-130-rc1)
for upgrade and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions; multi-output X11 is unverified.
- The overview requires a valid current v2 layout snapshot. Missing, changing,
  legacy, corrupt, future, oversized, or stale state keeps it closed.
- Physical connector hot-plugging and the wider real-GPU hardware matrix remain
  unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.3.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
