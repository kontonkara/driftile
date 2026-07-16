# Driftile 1.9.1-rc.1

Driftile 1.9.1-rc.1 is a prerelease candidate for 1.9.1 validation. It was not a stable release.

## Changes since 1.9.0

- Places a full-width active column between equal configured outer gaps and
  moves both adjacent columns entirely outside the viewport.
- Restores the exact prior column width and viewport when full width is toggled
  off, including after an extension reload. A failed geometry transaction
  retains the full-width state.
- Persists the restore viewport as an optional addition to full-width toggle
  metadata. The candidate accepts 1.9.0 documents that omit it.
- Downgrading to 1.9.0 remains safe: its strict decoder rejects documents
  containing the additive field atomically and starts through normal admission
  without restoring the newer toggle metadata.
- Adds no action, binding, setting, gesture, or overview behavior. Both package
  IDs, all ten settings, and the KWin 6.7 platform boundary remain unchanged.
- Versions the main script and optional overview package together.

## Candidate artifacts

The candidate uses tag
[`v1.9.1-rc.1`](https://github.com/kontonkara/driftile/releases/tag/v1.9.1-rc.1)
and these exact asset links:

- [`driftile-1.9.1-rc.1.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.9.1-rc.1/driftile-1.9.1-rc.1.kwinscript)
- [`driftile-overview-1.9.1-rc.1.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.9.1-rc.1/driftile-overview-1.9.1-rc.1.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.9.1-rc.1.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.9.1-rc.1/driftile-shortcuts-1.9.1-rc.1.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.9.1-rc.1/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.9.1-rc.1/LICENSE)

Verify downloaded assets against `SHA256SUMS` before installation. Follow the
tagged [migration guide](https://github.com/kontonkara/driftile/blob/v1.9.1-rc.1/docs/migration.md#upgrade-from-190-to-191-rc1)
for archive, NixOS, Home Manager, and rollback procedures.

## Compatibility and known limits

- KDE Plasma with KWin 6.7 or newer is required.
- Native Wayland and XWayland windows are supported. Native X11 support remains
  limited to single-output sessions.
- The optional overview retains its 1.9.0 behavior and remains disabled and
  unbound by default.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged [compatibility matrix](https://github.com/kontonkara/driftile/blob/v1.9.1-rc.1/docs/compatibility.md)
for the complete platform boundary.
