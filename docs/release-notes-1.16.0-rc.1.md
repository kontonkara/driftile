# Driftile 1.16.0-rc.1

Driftile 1.16.0-rc.1 is a prerelease candidate for 1.16.0 validation. It is not
a stable release; 1.15.1 remains the latest stable version.

## Changes since 1.15.1

- Adds live feedback for same-context tiled pointer moves. Driftile outlines a
  valid target's exact before-or-after half through KWin's public outline API;
  cursor updates are coalesced, and invalid or stale targets clear the feedback
  without changing layout state.
- Keeps cross-context pointer moves finish-only. KWin exposes one shared outline
  without ownership tokens, so feedback is best-effort and fails closed for the
  current drag when a conflict is detected.
- Adds the empty-default `ApplicationInitialFloating` setting and Home Manager
  `programs.driftile.settings.applicationInitialFloating` list. Matching uses
  exact, case-sensitive KWin `desktopFileName` values under the documented
  bounded application-policy limits.
- Applies the new policy only to fresh admissions. Existing and restored
  ownership remains authoritative; tiling exclusions and automatic-floating
  roles take priority. A match becomes an ordinary manually floating window and
  can be tiled with the existing toggle action.
- Expands a non-null Home Manager settings profile from eleven to twelve values.
  A blank or omitted list preserves 1.15.1 behavior. The release adds no layout
  persistence field, action, binding, helper profile, package ID, or overview
  behavior.

## Candidate artifacts

The candidate uses tag
[`v1.16.0-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.16.0-rc.1)
and these exact asset links:

- [`driftile-1.16.0-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.16.0-rc.1/driftile-1.16.0-rc.1.kwinscript)
- [`driftile-overview-1.16.0-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.16.0-rc.1/driftile-overview-1.16.0-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.16.0-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.16.0-rc.1/driftile-shortcuts-1.16.0-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.16.0-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.16.0-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.16.0-rc.1/docs/migration.md#upgrade-from-1151-to-1160-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- Pointer feedback shares KWin's global outline with other scripts and effects;
  detected conflicts disable feedback for that drag without affecting the drop.
- The optional overview retains its 1.15.1 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.16.0-rc.1/docs/compatibility.md)
for the complete platform boundary.
