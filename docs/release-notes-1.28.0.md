# Driftile 1.28.0

Driftile 1.28.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download matching files from tag
[`v1.28.0`](https://github.com/kontonkara/driftile/releases/tag/v1.28.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.28.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.28.0/driftile-1.28.0.kwinscript)
- [`driftile-overview-1.28.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.28.0/driftile-overview-1.28.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.28.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.28.0/driftile-shortcuts-1.28.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.28.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.28.0/LICENSE)

## Changes since 1.27.0

- Makes the existing unbound insert-left and insert-right actions contextual
  for one active relation-free manually floating window.
- Chooses the nearest directional multi-window stack by solved column center.
  Off-screen columns participate; singleton columns are skipped; selection
  does not wrap or route past an unsafe nearest target.
- Appends and selects the window while retaining focus, adopting the target
  width and stacked or tabbed presentation, and using automatic height.
- Stages guarded geometry writes before transferring layout ownership. Failed
  transitions compensate frames that retain captured write ownership or enter
  normal dirty-context recovery.
- Fails closed without tiled fallback for automatic, related, minimized,
  native-state, pending, stale, or unsafe active windows and for unsafe target
  or context state.

The release adds no action, default binding, setting, schema, persistence
field, helper or overview behavior, KWin API, or private API.

## Migration

Install matching 1.28.0 main, overview, and helper artifacts. No data
conversion, Plasma session restart, KConfig edit, new action, default binding,
setting, or persistence migration is required. Existing settings, layouts,
shortcut assignments, and the helper-owned default profile remain compatible.
See the tagged
[migration guide](https://github.com/kontonkara/driftile/blob/v1.28.0/docs/migration.md#upgrade-from-1270-to-1280).

## Validation

- Focused runtime coverage verifies both directions, singleton skipping, target
  width and presentation adoption, automatic height, retained focus, ownership
  transfer, related-window rejection, state-round-trip compensation, and
  no-target rejection without tiled fallback.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- Exact feature SHA `9a5d0ab` passes CI quality in 2:41, native X11 in 3:02,
  and Wayland in 7:12.
- Existing shortcut registration and tiled direct-insertion coverage is reused.
  No new integration, application, backend, or VM matrix was added.
- This release makes no VM validation claim.

## Compatibility and known limits

- The insert-left and insert-right actions remain unbound by default.
- Automatic, related, minimized, native-state, pending, stale, and otherwise
  unsafe active floating windows fail closed.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.28.0/docs/compatibility.md)
for the complete supported boundary.
