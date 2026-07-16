# Driftile 1.23.0

Driftile 1.23.0 was published as a stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.23.0`](https://github.com/kontonkara/driftile/releases/tag/v1.23.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.23.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.23.0/driftile-1.23.0.kwinscript)
- [`driftile-overview-1.23.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.23.0/driftile-overview-1.23.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.23.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.23.0/driftile-shortcuts-1.23.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.23.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.23.0/LICENSE)

## Changes since 1.22.0

- Adds one passive active-column layout badge to each optional overview desktop
  card.
- Reports the validated `stacked` or `tabbed` presentation and logical width as
  a percentage or logical pixels.
- Keeps the badge inside the visible column span and hides it when the complete
  label cannot fit or its source state is invalid.
- Reads only the projected active-column index, that column, and its existing
  rendered delegate in constant time.

The badge accepts no input and adds no animation, setting, shortcut,
persistence field, layout mutation, window scan, or KWin write.

## Migration

Do not combine files from different releases. Release any helper-owned
shortcut profile, disable Driftile and the optional overview, then install
their matching 1.23.0 artifacts. No data conversion, Plasma session restart,
KConfig edit, shortcut change, or persistence migration is required. See the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.23.0/docs/migration.md#upgrade-from-1220-to-1230).

## Validation

- A focused overview contract check and QML lint cover label grammar,
  placement, fail-closed visibility, clipping, pass-through input, and bounded
  lookup.
- A hidden lifecycle VM verifies installation of the published 1.22.0 packages
  and upgrade to matching 1.23.0 packages.
- Packaging and exact-SHA CI cover the stable artifacts. This
  presentation-only slice does not claim a full feature VM.

## Compatibility and known limits

- The badge reports logical layout state, not measured client geometry.
- A fully clipped active column or a card without room for the complete label
  intentionally shows no badge.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.23.0/docs/compatibility.md)
for the complete supported boundary.
