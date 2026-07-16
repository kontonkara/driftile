# Driftile 1.25.0

Driftile 1.25.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.25.0`](https://github.com/kontonkara/driftile/releases/tag/v1.25.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.25.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.25.0/driftile-1.25.0.kwinscript)
- [`driftile-overview-1.25.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.25.0/driftile-overview-1.25.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.25.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.25.0/driftile-shortcuts-1.25.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.25.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.25.0/LICENSE)

## Changes since 1.24.0

- Existing directional output-transfer actions now move one active manual or
  automatic floating window when it has no window relationships.
- The action uses the existing deterministic adjacent-output routing and
  adopts the destination output's selected desktop without switching it.
- KWin owns the output move and final frame placement. Driftile writes neither
  floating frame geometry nor tiled layouts during the transfer.
- Modal, transient, native-state, minimized, interactive, settling, stale, and
  otherwise unsafe targets fail closed without falling through to tiled
  transfer.
- A rejected transfer rolls back only transaction-owned output, desktop
  membership, and focus changes, preserving KWin's authoritative frame.

This release adds no action, binding, setting, persistence field, private API,
application, or backend.

## Migration

Install matching 1.25.0 main, overview, and helper artifacts. No data
conversion, Plasma session restart, KConfig edit, shortcut change, or
persistence migration is required. Existing settings, layouts, and bindings
remain compatible. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.25.0/docs/migration.md#upgrade-from-1240-to-1250).

## Validation

- Focused output-transfer tests cover manual and automatic floating ownership,
  adjacent routing, destination desktop adoption, zero frame and tiled-layout
  writes, blockers, missing API, and bounded rollback.
- Package checks, Nix evaluation, and Nix build gates pass.
- A headless real-KWin Wayland multi-output run verifies the contextual transfer
  and reverse path with unchanged tiled windows. A hidden two-head VM confirms
  the packaged multi-output baseline.
- A hidden lifecycle VM upgrades public 1.24.0 packages to matching 1.25.0
  packages, exercises Konsole and KDE Calculator, then removes both packages.
- Exact feature SHA `918eeb0` passes CI quality, native X11, and Wayland jobs.

## Compatibility and known limits

- A missing KWin output-transfer method or directional neighbor leaves the
  action write-free.
- Related floating windows remain intentionally blocked.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.25.0/docs/compatibility.md)
for the complete supported boundary.
