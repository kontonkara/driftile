# Driftile 1.10.0

Driftile 1.10.0 is the latest stable release.

## Requirements and assets

- KDE Plasma with KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the optional
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- [`driftile-1.10.0.kwinscript`](https://github.com/kontonkara/driftile/releases/download/v1.10.0/driftile-1.10.0.kwinscript)
- [`driftile-overview-1.10.0.kwineffect`](https://github.com/kontonkara/driftile/releases/download/v1.10.0/driftile-overview-1.10.0.kwineffect), if using the optional overview
- [`driftile-shortcuts-1.10.0.mjs`](https://github.com/kontonkara/driftile/releases/download/v1.10.0/driftile-shortcuts-1.10.0.mjs), if using the optional shortcut helper
- [`SHA256SUMS`](https://github.com/kontonkara/driftile/releases/download/v1.10.0/SHA256SUMS)
- [`LICENSE`](https://github.com/kontonkara/driftile/releases/download/v1.10.0/LICENSE)

## Changes since 1.10.0-rc.1

There are no runtime, configuration, persistence, action, binding, gesture, or
overview behavior changes since RC.1. The validated candidate was promoted
with the final version metadata and release documentation.

## Changes since 1.9.1

- Adds exact, case-sensitive per-application exclusions to optional borderless
  presentation. A blank list preserves the existing global behavior.
- Excluded tiled, floating, dialog, transient, and utility windows keep their
  existing KWin decoration state. Missing or empty application IDs do not
  match.
- Applies exclusion and application-identity changes live without geometry,
  focus, layout-state, or layout-persistence changes. Driftile restores only
  decoration state it owns.
- Exposes `ApplicationBorderlessExclusions` in System Settings and through the
  complete eleven-setting Home Manager profile.
- Rejects the complete settings update when the bounded exclusion document is
  invalid. See the tagged
  [application borderless exclusions documentation](https://github.com/kontonkara/driftile/blob/v1.10.0/docs/configuration.md#application-borderless-exclusions)
  for the accepted format and limits.
- Adds no action, binding, gesture, persistence-format, or overview behavior.
  The main script and optional overview retain their package IDs and are
  versioned together.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile, then disable Driftile and the optional overview before
upgrading. Follow the tagged migration path from
[1.9.1](https://github.com/kontonkara/driftile/blob/v1.10.0/docs/migration.md#upgrade-from-191-to-1100)
or
[1.10.0-rc.1](https://github.com/kontonkara/driftile/blob/v1.10.0/docs/migration.md#upgrade-from-1100-rc1).

## Known limits

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging, native X11 multi-output layouts, and the
  wider real-GPU hardware matrix remain unverified.

See the tagged
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.10.0/docs/compatibility.md)
for the complete supported boundary.
