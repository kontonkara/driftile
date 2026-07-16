# Driftile 1.21.0

Driftile 1.21.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.21.0`](https://github.com/kontonkara/driftile/releases/tag/v1.21.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.21.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.21.0/driftile-1.21.0.kwinscript)
- [`driftile-overview-1.21.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.21.0/driftile-overview-1.21.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.21.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.21.0/driftile-shortcuts-1.21.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.21.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.21.0/LICENSE)

## Changes since 1.20.0

- Selects the active window's actionable overview target on opening, with a
  deterministic current-desktop and visual-order fallback.
- Moves between actionable targets with non-wrapping spatial arrow-key
  navigation.
- Uses the existing guarded public KWin activation path for `Enter`, `Return`,
  and `Space`; `Escape` closes without acting.
- Represents the selected member of a tabbed column only by its large
  thumbnail and the other actionable members by their tabs. Minimized,
  invalid, and fully clipped items are excluded; partially clipped targets use
  their visible intersection.

The release changes only keyboard interaction in the optional overview. It
adds no layout or persistent state, KConfig value, shortcut, schema, private
API, drag, or rearrangement.

## Migration

Do not combine files from different releases. Release any helper-owned
shortcut profile, disable Driftile and the optional overview, then install
their matching 1.21.0 artifacts. No data conversion, Plasma session restart,
KConfig edit, shortcut change, or persistence migration is required. See the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.21.0/docs/migration.md#upgrade-from-1200-to-1210).

## Validation

- Focused core and QML checks cover selection, spatial movement, exclusions,
  guarded activation, and closing.
- The stable commit passed exact-SHA CI. One hidden full Wayland VM
  checkpoint used physical `Meta+O`, `Enter`, `Up`, and `Escape` input with
  packaged artifacts and real XWayland xterm and Firefox windows.

## Compatibility and known limits

- Keyboard activation reuses the overview's existing public KWin paths and
  does not write layout state or settings.
- The physical keyboard checkpoint covers Wayland; end-to-end native X11
  overview activation remains unverified.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.21.0/docs/compatibility.md)
for the complete supported boundary.
