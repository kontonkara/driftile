# Driftile 1.26.0

Driftile 1.26.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.26.0`](https://github.com/kontonkara/driftile/releases/tag/v1.26.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.26.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.26.0/driftile-1.26.0.kwinscript)
- [`driftile-overview-1.26.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.26.0/driftile-overview-1.26.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.26.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.26.0/driftile-shortcuts-1.26.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.26.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.26.0/LICENSE)

## Changes since 1.25.0

- Adds `driftile_move_window_to_desktop_1` through
  `driftile_move_window_to_desktop_9` as unbound actions for transferring only
  the active window to a numbered desktop.
- Extracts a tiled member into a target singleton with the source column width.
  Retained source members preserve order, height state, membership, and frames.
- Reuses the existing relation-free contextual path for an active floating
  target.
- Keeps targets one-based, makes same-target commands no-ops, and clamps an
  out-of-range target to the shared empty tail.

The release adds no default binding, setting, persistence field, schema,
private API, compositor mechanism, application, or backend. The helper-owned
88-action default profile and overview behavior remain unchanged.

## Migration

Install matching 1.26.0 main, overview, and helper artifacts. No data
conversion, Plasma session restart, KConfig edit, setting, default-binding, or
persistence migration is required. Existing settings, layouts, and assignments
remain compatible. See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.26.0/docs/migration.md#upgrade-from-1250-to-1260).

## Validation

- One focused runtime case covers tiled extraction, retained source state,
  source-width inheritance, tail clamping, focus, and same-target no-op
  behavior.
- Shortcut and QML contracts cover all nine action IDs while requiring the
  helper-owned 88-action default profile to remain byte-identical.
- Package and Nix evaluation and build gates pass.
- Exact feature SHA `aa17fe3` passes CI quality in 2:52, native X11 in 3:02,
  and Wayland in 6:59.
- A hidden lifecycle VM upgrades public 1.25.0 packages to matching 1.26.0
  packages, exercises Konsole and KDE Calculator, removes both packages, and
  confirms that KWin remains usable.
- The established packaged desktop-transfer coverage is reused without a new
  integration, application, backend, or feature-VM scenario.

## Compatibility and known limits

- Numbered actions must be assigned manually or through a custom shortcut
  profile.
- Related or otherwise blocked floating targets fail closed.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.26.0/docs/compatibility.md)
for the complete supported boundary.
