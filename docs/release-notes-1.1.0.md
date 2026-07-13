# Driftile 1.1.0

Driftile 1.1.0 is the current stable release.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the portable
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- `driftile-1.1.0.kwinscript`
- `driftile-shortcuts-1.1.0.mjs`, if using the portable helper
- `SHA256SUMS`
- `LICENSE`

## Changes since 1.1.0-rc.1

There are no runtime or persistence behavior changes since RC.1. The validated
candidate was promoted with the final version and release documentation.

## Changes since 1.0.0

- Adds up to 128 exact, case-sensitive `desktopFileName` initial-width rules.
  Matching new singleton columns use the configured 10%–100% width; existing
  columns remain unchanged.
- Adds a configurable cycle of up to 16 strictly increasing 10%–100% column
  widths. A blank profile preserves the built-in exact thirds, and changes
  affect only later preset actions.
- Optionally centers successful left, right, first, and last tiled focus
  navigation in the same transaction. The option is disabled by default and
  falls back to minimal reveal when centering is unsafe.
- Extends the atomic settings snapshot from five to eight values, including
  typed Home Manager options with backward-compatible defaults.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile before
upgrading. The package ID, shortcut action IDs, and stored-layout format remain
compatible. Follow the
[migration guide](https://github.com/kontonkara/driftile/blob/v1.1.0/docs/migration.md)
for the complete archive, NixOS, Home Manager, and rollback paths.

## Known limits

- Application-width rules require an exact, case-sensitive KWin
  `desktopFileName`; windows without a matching usable ID use the global
  default.
- Physical connector hot-plugging remains unverified; automated coverage uses
  virtual output removal and re-enablement.
- Native X11 is verified on one output. Native X11 multi-output remains
  unverified.
- Real GPU combinations and a wider hardware matrix remain unverified.
- Live constraint changes are verified with Qt Quick and GTK 3 clients;
  broader toolkit coverage remains unverified.
- Cross-session restoration requires the exact output topology and a strong,
  unique match for every stored window; additional live windows are admitted
  normally. An ambiguous or incomplete stored match set is rejected atomically
  without partial ownership.

See the
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.1.0/docs/compatibility.md)
for the complete supported boundary.
