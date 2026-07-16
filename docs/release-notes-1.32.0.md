# Driftile 1.32.0

Driftile 1.32.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.32.0`](https://github.com/kontonkara/driftile/releases/tag/v1.32.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.32.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/driftile-1.32.0.kwinscript)
- [`driftile-overview-1.32.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/driftile-overview-1.32.0.kwineffect), if using the optional overview
- [`driftile-transitions-1.32.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/driftile-transitions-1.32.0.kwineffect), if using optional geometry transitions
- [`driftile-shortcuts-1.32.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/driftile-shortcuts-1.32.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.32.0/LICENSE)

## Changes since 1.31.0

### Navigation and window control

- Adds independently configurable horizontal column and vertical desktop
  touchpad navigation with `3`–`5` fingers. Natural direction is configurable,
  and native X11 safely ignores the Wayland-only gestures.
- Adds unbound actions for crossing desktop and output boundaries, cycling
  outputs, wrapping focus, selecting indexed columns or members, and moving a
  column to an indexed position.
- Adds session-only last-used desktop and previous-window focus, adjacent
  window swaps, and explicit tiled, floating, stacked, and tabbed actions.
- Aligns fresh preset shortcuts: reverse width cycling uses `Meta+Shift+R` and
  forward height cycling uses `Meta+Ctrl+Shift+R`. Existing assignments remain
  unchanged.

### Optional overview

- Adds a configurable vertical touchpad gesture for opening and closing the
  companion.
- Adds bounded title and application search, spatial and sequential keyboard
  navigation, mouse-wheel selection, matching-result feedback, and guarded
  window closing with `Delete` or middle click.
- Lets a visible thumbnail or tab move its window to another desktop card on
  the same output. Desktop gutters are also available to keyboard navigation.
- Defers to Plasma's built-in Overview and cancels safely if that effect owns
  presentation during activation.

### Optional transitions

- Stabilizes consecutive geometry transitions and excludes launchers, popups,
  frameless shell overlays, and other non-movable windows.
- Coalesces window changes while a fullscreen or workspace effect owns
  presentation, then replays one transition from the original frame to the
  final frame. Changing a window during a desktop switch no longer disables
  later animations.

### Configuration and packaging

- Adds Plasma settings and typed Home Manager options for main-script touchpad
  navigation, the overview gesture, and transition duration.
- Keeps the main script, overview, and transition effect independently
  installable through standard KWin packages or the Nix flake.

## Upgrade

Release any helper-owned 1.31.0 shortcut profile before replacing artifacts.
Disable the main script and optional effects, install matching 1.32.0 files,
then re-enable only the components you use. Reclaim the helper profile if used;
existing manual KGlobalAccel assignments remain unchanged.

Configuration and logical layout state remain compatible with 1.31.0. No
layout-state migration is required. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.32.0/docs/migration.md)
for the complete upgrade procedure.

## Compatibility and known limits

- Touchpad navigation and the overview gesture require native Wayland; enabled
  gesture settings are safe no-ops on native X11.
- Cross-desktop overview selection and activation remain unverified on native
  X11.
- An unsupported scripted-effect backend leaves the main extension functional
  without optional geometry transitions.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.32.0/docs/compatibility.md)
for the complete supported boundary.
