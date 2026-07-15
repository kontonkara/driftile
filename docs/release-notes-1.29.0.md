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
  contextual for one active relation-free manually floating window.
- Cycles the fixed `1/3`, `1/2`, and `2/3` height presets in both directions,
  with directional selection and wraparound from an arbitrary current height.
- Resolves each proportional frame height from the gap-adjusted assigned work
  area, snapping the canonical start and end to that output's pixel grid.
- Applies live decorated constraints and partial-reachability bounds while
  retaining width, focus, context, reinsertion placement, and every tiled
  layout.
- Commits floating metadata only after exact acknowledgement of a single frame
  request. Automatic floating windows are no-ops; related, pending, stale, and
  otherwise blocked manual-floating targets fail closed without reaching tiled
  behavior.

Window-height reset remains tiled-only. The release adds no action, default
binding, setting, schema, persistence field, helper or overview behavior, KWin
API, or private API.

## Migration

Install matching 1.29.0 main, overview, and helper artifacts. No data
conversion, Plasma session restart, KConfig edit, new action, default binding,
setting, or persistence migration is required. Existing settings, layouts,
shortcut assignments, and the helper-owned default profile remain compatible.
See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.29.0/docs/migration.md#upgrade-from-1280-to-1290).

## Validation

- Focused runtime coverage verifies forward and reverse selection, wraparound,
  decorated fractional-scale targets, one-frame writes, retained focus,
  unchanged tiled state, and related-window rejection without tiled fallback.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- Exact feature SHA `b858c00` passes CI quality in 2:45, native X11 in 3:13,
  and Wayland in 7:06.
- Existing manual-floating size-transaction coverage is reused for delayed
  acknowledgement, constraints, repeated-command serialization, exact metadata
  commits, cleanup, and stale-state rejection. No new backend, integration,
  application, or VM matrix was added.
- This release makes no feature VM validation claim.

## Compatibility and known limits

- Window-height preset actions retain their existing bindings; reverse remains
  unbound by default. Window-height reset remains tiled-only.
- Automatic floating windows are no-ops. Related, pending, stale, and otherwise
  blocked manual-floating targets fail closed.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.29.0/docs/compatibility.md)
for the complete supported boundary.
