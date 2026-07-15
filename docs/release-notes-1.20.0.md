# Driftile 1.20.0

Driftile 1.20.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.20.0`](https://github.com/kontonkara/driftile/releases/tag/v1.20.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.20.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.20.0/driftile-1.20.0.kwinscript)
- [`driftile-overview-1.20.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.20.0/driftile-overview-1.20.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.20.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.20.0/driftile-shortcuts-1.20.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.20.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.20.0/LICENSE)

## Changes since 1.19.0

- Adds `DefaultColumnPresentation` for fresh unmatched columns and exact
  `ApplicationColumnPresentations` overrides. Both select `stacked` or
  `tabbed`; existing and restored columns remain unchanged.
- Keeps tabbed singleton columns as durable state through insertion, splitting,
  transfers, initially floating reinsertion, and persistence.
- Adds an ordered tab strip to the optional overview. Valid tabs use the
  existing guarded focus path; minimized members remain visible but disabled.
- Adds optional passive Plasma OSD feedback after confirmed multi-tab
  activation or entry into tabbed presentation. `ShowTabIndicator` enables it
  by default and can disable it without changing layout state.
- Offers `Meta+O` when the optional overview creates a fresh shortcut record.
  Existing KGlobalAccel assignments, including an unbound action, are
  preserved.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.20.0/docs/migration.md#upgrade-from-1190-to-1200).

## Validation

- Targeted model, settings, runtime, overview, package, Nix, and backend checks
  cover the bounded tab workflow.
- Hidden VM, exact-SHA CI, and release gates cover the final stable artifacts.

## Compatibility and known limits

- The indicator uses Plasma's passive OSD and adds no managed window, input
  interception, polling, private API, or compositor-owned surface.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.20.0/docs/compatibility.md)
for the complete supported boundary.
