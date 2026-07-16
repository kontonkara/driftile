# Driftile 1.22.0

Driftile 1.22.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.22.0`](https://github.com/kontonkara/driftile/releases/tag/v1.22.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.22.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.22.0/driftile-1.22.0.kwinscript)
- [`driftile-overview-1.22.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.22.0/driftile-overview-1.22.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.22.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.22.0/driftile-shortcuts-1.22.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.22.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.22.0/LICENSE)

## Changes since 1.21.0

- Adds vertical desktop-card reordering to the optional overview through a
  plain left drag from a card's number gutter.
- Keeps cards fixed during the drag while tinting the source and showing one
  insertion line. A normal click retains desktop selection.
- Protects the shared trailing empty desktop from use as a source, target, or
  crossed boundary.
- Revalidates the exact effect, model, output, selected desktop, scene geometry,
  and complete desktop object and ID order before one public KWin reorder call.
- Leaves cancellation, no-op, stale, out-of-bounds, and unsupported paths
  write-free and open.

The release changes only pointer interaction in the optional overview. It adds
no setting, shortcut, persistence field, private API, timer, window move, or
workspace window scan. The main script remains the layout owner.

## Migration

Do not combine files from different releases. Release any helper-owned
shortcut profile, disable Driftile and the optional overview, then install
their matching 1.22.0 artifacts. No data conversion, Plasma session restart,
KConfig edit, shortcut change, or persistence migration is required. See the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.22.0/docs/migration.md#upgrade-from-1210-to-1220).

## Validation

- Focused planner and QML checks cover every insertion slot, the protected
  tail, cancellation, no-op and stale paths, exact revalidation, one public
  reorder call, and constant-time pointer updates.
- The stable commit passed exact-SHA CI. One hidden full Wayland VM checkpoint
  used a physical plain left gutter drag with Konsole, Firefox, XWayland xterm,
  and Calculator, then verified exact desktop order, state, and restoration.

## Compatibility and known limits

- Desktop-card reordering depends on the public KWin desktop-reorder method. A
  missing method leaves the drag write-free and the overview open.
- End-to-end desktop-card dragging is verified on Wayland. Native X11 retains
  package, lifecycle, and static fallback coverage without an equivalent
  physical drag claim.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.22.0/docs/compatibility.md)
for the complete supported boundary.
