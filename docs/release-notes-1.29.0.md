# Driftile 1.29.0

Driftile 1.29.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.29.0`](https://github.com/kontonkara/driftile/releases/tag/v1.29.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.29.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.29.0/driftile-1.29.0.kwinscript)
- [`driftile-overview-1.29.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.29.0/driftile-overview-1.29.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.29.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.29.0/driftile-shortcuts-1.29.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.29.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.29.0/LICENSE)

## Changes since 1.28.0

- Makes the existing forward and reverse window-height preset actions
  contextual for one eligible relation-free manually floating window.
- Adds `WindowHeightPresets` for later tiled and eligible manual-floating
  actions. Blank keeps the exact `1/3`, `1/2`, and `2/3` cycle; custom input
  accepts 1–16 strictly increasing integer percentages from 10 through 100.
- Keeps persisted tiled selections stable through semantic preset codes. A
  setting change does not reinterpret existing selections or immediately write
  layouts, frames, viewports, focus, or persistence.
- Assigns fresh forward width and height shortcuts to `Meta+R` and
  `Meta+Shift+R`. Both reverse actions are unbound; action IDs and existing
  KGlobalAccel assignments are preserved.
- Extends the Home Manager module to seventeen typed settings.

Window-height reset remains tiled-only.

## Upgrade

Release a helper-owned 1.28.0 shortcut profile before replacing the artifacts.
Install matching 1.29.0 main, overview, and helper files, then claim the new
default helper profile if wanted. Existing direct KGlobalAccel assignments are
preserved, and no layout-state conversion is required. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.29.0/docs/migration.md#upgrade-from-1280-to-1290).

## Validation

- The combined feature batch at `b858c00` and `9093c12` passes the grouped local
  formatting, type, lint, unit, package, Nix evaluation, and Nix build gates.
- Exact SHA `9093c121a33b3ec72fce6602267cf29b88423192` passes
  [CI run 29419108286](https://github.com/kontonkara/driftile/actions/runs/29419108286).
- One hidden full Wayland VM checkpoint at the same SHA passes with the existing
  mixed application pool and physical `Meta+Shift+R` input. No visible VM was
  run for this release slice.

## Compatibility and known limits

- Automatic, related, minimized, native-state, interactive, pending, stale, or
  otherwise unsafe active floating windows fail closed.
- Both reverse preset actions remain unbound by default. Window-height reset
  keeps its existing shortcut and applies only to tiled windows.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.29.0/docs/compatibility.md)
for the complete supported boundary.
