# Driftile 1.27.0

Driftile 1.27.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.27.0`](https://github.com/kontonkara/driftile/releases/tag/v1.27.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.27.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.27.0/driftile-1.27.0.kwinscript)
- [`driftile-overview-1.27.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.27.0/driftile-overview-1.27.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.27.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.27.0/driftile-shortcuts-1.27.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.27.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.27.0/LICENSE)

## Changes since 1.26.0

- Makes the existing width-preset forward/back actions contextual for one
  relation-free manually floating window.
- Extends the existing unbound width-reset action to the same target.
- Resolves configured percentages against the exact gap-adjusted singleton
  width, assigned-output pixel grid, live decorated constraints, and partial
  reachability bounds.
- Commits a manual-floating size change only after exact acknowledgement.
  Automatic, related, pending, and otherwise blocked floating targets fail
  closed without reaching the tiled path.

Presets continue to read `ColumnWidthPresets`; reset continues to read
`DefaultColumnWidthPercent`. The release adds no action, default binding,
setting, schema, persistence behavior, helper or overview behavior, or KWin API.

## Migration

Install matching 1.27.0 main, overview, and helper artifacts. No data
conversion, Plasma session restart, KConfig edit, new action, default binding,
setting, or persistence migration is required. Existing settings, layouts,
shortcut assignments, and the helper-owned default profile remain compatible.
See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.27.0/docs/migration.md#upgrade-from-1260-to-1270).

## Validation

- Focused runtime coverage verifies preset cycling, reset, configured
  percentages, singleton resolution, constraints, reachability, exact
  acknowledgement, unchanged tiled state, and fail-closed targets.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- Exact feature SHA `4bac7ea` passes CI quality in 2:36, native X11 in 3:07,
  and Wayland in 6:31.
- Existing packaged width settlement and tiled preset/reset coverage is reused.
  No new backend, integration, application, or VM matrix was added.
- This release makes no VM validation claim.

## Compatibility and known limits

- Related or otherwise blocked floating targets fail closed.
- The reset action remains unbound by default; the helper-owned default profile
  is unchanged.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.27.0/docs/compatibility.md)
for the complete supported boundary.
