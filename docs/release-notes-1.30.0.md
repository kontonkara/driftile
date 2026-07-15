# Driftile 1.30.0

Driftile 1.30.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.30.0`](https://github.com/kontonkara/driftile/releases/tag/v1.30.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.30.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.30.0/driftile-1.30.0.kwinscript)
- [`driftile-overview-1.30.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.30.0/driftile-overview-1.30.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.30.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.30.0/driftile-shortcuts-1.30.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.30.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.30.0/LICENSE)

## Changes since 1.29.0

- Adds empty horizontal gutter targets before, between, and after visible
  columns for same-context tiled-window dragging.
- Keeps exact-window targets higher priority and preserves their existing stack
  insertion and reorder behavior.
- Moves a singleton as one complete column, preserving its identity, width,
  presentation, selected member, and height state.
- Extracts a dragged stack member into a new singleton with the source width,
  automatic height, and current application or global initial presentation;
  passive stack state remains intact.
- Applies the existing active-column reveal rules to the resulting viewport.
- Excludes empty-gutter targeting across outputs or desktops. Existing
  cross-context adoption still requires one exact visible tiled window.

The release adds no setting, action, helper profile, persistence, schema,
overview, or API change.

## Upgrade

Release any helper-owned 1.29.0 shortcut profile before replacing artifacts.
Install matching 1.30.0 main, overview, and helper files, then reclaim the
unchanged helper profile if used. Existing configuration, shortcuts, and layout
state remain compatible; no layout conversion is required. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.30.0/docs/migration.md#upgrade-from-1290-to-1300).

## Validation

- Exact feature SHA `3985dd9562493b4808c3086159a6b191a6506ee1` passes the grouped
  local check across 36 files and 1,558 tests, the reproducible package check,
  all-system Nix evaluation, and the native Nix build.
- [CI run 29424914946](https://github.com/kontonkara/driftile/actions/runs/29424914946)
  passes quality, native X11, and Wayland.
- One hidden full Wayland VM checkpoint at the exact SHA passes the existing
  mixed Konsole, Firefox, KCalc, and XWayland pool plus the physical pointer and
  shortcut baseline. It did not physically exercise the new gutter target. No
  visible VM was run.

## Compatibility and known limits

- Empty-gutter targeting is same-context only; cross-output and cross-desktop
  adoption still requires one exact visible target.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.30.0/docs/compatibility.md)
for the complete supported boundary.
