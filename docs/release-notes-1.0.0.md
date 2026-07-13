# Driftile 1.0.0

Driftile 1.0.0 was the stable release before 1.1.0.

## Requirements and assets

- KDE Plasma and KWin 6.7 or newer.
- Native Wayland with Wayland and XWayland applications, or a single-output
  native X11 session.
- Node.js 22 or newer, `busctl`, and `flock` only when using the portable
  shortcut helper.

Download all required files from this release and verify them with
`SHA256SUMS`:

- `driftile-1.0.0.kwinscript`
- `driftile-shortcuts-1.0.0.mjs`, if using the portable helper
- `SHA256SUMS`
- `LICENSE`

## Changes since 1.0.0-rc.1

There are no runtime behavior or persistence-format changes since RC.1. The
validated candidate was promoted with final version and release documentation.

## Changes since 0.1.0

- Validates and applies the five layout settings as one snapshot. An invalid
  value rejects the complete update without changing the active settings.
- Accepts strict JSON v1 shortcut profiles with explicit action bindings and
  reversible conflict ownership.
- Provides NixOS and Home Manager modules for `x86_64-linux` and
  `aarch64-linux`, including typed Home Manager settings and portable shortcut
  profile generation.
- Persists canonical layouts across script reloads and restores complete
  strongly identified sessions atomically. Startup waits boundedly for late
  windows, while known-output return restores safe tiled contexts without
  disturbing active outputs.
- Reinserts an active tiled window at an exact visible target within one
  context or after KWin completes a physical move to another visible output.
- Enforces deterministic operation-count budgets for startup, ownership
  classification, lifecycle endurance, visible bursts, and automatic height
  allocation.
- Hardens deterministic release assets, the KPackage contract, Home Manager
  coexistence and evaluation, and the visible install, upgrade, disable, and
  removal lifecycle from 0.1.0.

## Migration

Do not combine packages or helpers from different releases. Release any owned
shortcut profile with the installed helper, then disable Driftile before
upgrading. Follow the
[migration guide](https://github.com/kontonkara/driftile/blob/v1.0.0/docs/migration.md)
for the complete archive, NixOS, and Home Manager paths.

## Known limits

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
[compatibility guide](https://github.com/kontonkara/driftile/blob/v1.0.0/docs/compatibility.md)
for the complete supported boundary.
