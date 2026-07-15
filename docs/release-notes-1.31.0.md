# Driftile 1.31.0

Driftile 1.31.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.31.0`](https://github.com/kontonkara/driftile/releases/tag/v1.31.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.31.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/driftile-1.31.0.kwinscript)
- [`driftile-overview-1.31.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/driftile-overview-1.31.0.kwineffect), if using the optional overview
- [`driftile-transitions-1.31.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/driftile-transitions-1.31.0.kwineffect), if using optional geometry transitions
- [`driftile-shortcuts-1.31.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/driftile-shortcuts-1.31.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.31.0/LICENSE)

## Changes since 1.30.0

### Window interaction

- Adds empty-gutter drops after KWin moves a tiled window to another visible
  output or selected desktop. The result is a separate automatic-height
  column, while an exact visible window remains the preferred target.
- Lets a manually floating window drop onto an exact tiled-window half or an
  empty gutter in its current context, with live target feedback.
- Adopts completed top and bottom pointer resizes as the active stacked
  window's height. Existing left and right adoption continues to set column
  width.
- Keeps a right-side full-width successor partially visible when a normal
  column is active, and selects a suitable surviving window after the active
  window closes.
- Uses 33% for fresh columns when no default-width setting exists. Explicit
  user settings and existing column widths remain unchanged.

### Activities and persistence

- Qualifies each layout by output, virtual desktop, and activity. Only the
  current activity receives geometry and focus writes.
- Keeps layouts independent for windows assigned to exactly one activity.
  Ambiguous all-activity or multi-activity windows remain under KWin ownership
  when multiple activities are present.
- Advances logical layout state to v4 and migrates valid v1 and v3 state after
  a successful restore. The bounded topology catalog remains v2.
- Limits the optional overview to the current activity and closes it when the
  activity topology changes.

### Optional transitions

- Adds a separately installable geometry-transition effect. It is disabled by
  default, follows Plasma's global animation speed, and never writes layout
  geometry.
- Keeps manual move and resize, fullscreen windows, and active fullscreen
  effects compositor-owned. A configured duration of `0` disables animation.

## Upgrade

Release any helper-owned 1.30.0 shortcut profile before replacing artifacts.
Disable the main script and optional effects, install matching 1.31.0 files,
then re-enable only the components you use. The shortcut profile and KConfig
settings remain compatible.

The first successful restore publishes logical state v4. Version 1.30.0 cannot
write that format, so a rollback requires moving the v4 state file aside or
restoring a saved v3 file. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.31.0/docs/migration.md#upgrade-from-1300-to-1310).

## Compatibility and known limits

- All-activity and multi-activity windows remain outside layout ownership when
  their activity cannot be identified unambiguously.
- The transition effect is optional; an unsupported effect backend leaves the
  main extension fully functional without animation.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.31.0/docs/compatibility.md)
for the complete supported boundary.
