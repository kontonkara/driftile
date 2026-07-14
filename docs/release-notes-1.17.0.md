# Driftile 1.17.0

Driftile 1.17.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland sessions with Wayland and XWayland applications, or a
  single-output native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from tag
[`v1.17.0`](https://github.com/kontonkara/driftile/releases/tag/v1.17.0) and
verify them with `SHA256SUMS`:

- [`driftile-1.17.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.17.0/driftile-1.17.0.kwinscript)
- [`driftile-overview-1.17.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.17.0/driftile-overview-1.17.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.17.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.17.0/driftile-shortcuts-1.17.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.17.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.17.0/LICENSE)

## Changes since 1.16.0

- Groups the existing KWin settings into two tabs. **General** contains the
  eight global and layout controls; **Applications** contains the four
  application policy controls.
- Keeps every KConfig key, twelve-setting snapshot rule, and live runtime
  behavior unchanged. The release adds no setting, action, binding,
  persistence field, overview behavior, or helper behavior.

Stable 1.17.0 adds no behavior or data change after 1.17.0-rc.1.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.16.0](https://github.com/kontonkara/driftile/blob/v1.17.0/docs/migration.md#upgrade-from-1160-to-1170)
or
[1.17.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.17.0/docs/migration.md#upgrade-from-1170-rc1).

## Validation

- One structural test verifies both tab labels, the eight/four control split,
  and the unchanged twelve-key set.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI cover the unchanged
  release commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

## Compatibility and known limits

- The optional overview retains its 1.16.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.17.0/docs/compatibility.md)
for the complete supported boundary.
