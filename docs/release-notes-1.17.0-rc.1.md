# Driftile 1.17.0-rc.1

Driftile 1.17.0-rc.1 is a prerelease candidate for 1.17.0 validation. It was not a stable release.

## Changes since 1.16.0

- Groups the existing KWin settings into two tabs. **General** contains the
  eight global and layout controls; **Applications** contains the four
  application policy controls.
- Keeps every KConfig key, twelve-setting snapshot rule, and live runtime
  behavior unchanged. The candidate adds no setting, action, binding,
  persistence field, overview behavior, or helper behavior.

## Candidate artifacts

The candidate uses tag
[`v1.17.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.17.0-rc.1)
and these exact asset links:

- [`driftile-1.17.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.17.0-rc.1/driftile-1.17.0-rc.1.kwinscript)
- [`driftile-overview-1.17.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.17.0-rc.1/driftile-overview-1.17.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.17.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.17.0-rc.1/driftile-shortcuts-1.17.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.17.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.17.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.17.0-rc.1/docs/migration.md#upgrade-from-1160-to-1170-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Candidate gates

- One structural test verifies both tab labels, the eight/four control split,
  and the unchanged twelve-key set.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI must pass on the
  unchanged candidate commit.
- The tag release workflow must pass before publishing the candidate assets.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The optional overview retains its 1.16.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.17.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
