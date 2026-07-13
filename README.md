# Driftile

A KWin extension for KDE Plasma that provides scrollable tiling and dynamic
workspaces.

Driftile keeps independent layouts for each output and virtual desktop while
leaving window, output, and desktop mechanisms to KWin.

## Features

- Horizontal scrollable columns with optional vertical window stacks.
- Keyboard-driven focus, movement, reordering, resizing, centering, and
  transfers between desktops and outputs.
- Finish-only pointer reinsertion and horizontal column-resize adoption, plus
  exact visible-target adoption after a KWin-owned output or desktop move.
- One shared trailing empty virtual desktop with conservative creation and
  cleanup.
- Manual floating, automatic layout exclusions, minimized-slot retention, and
  native fullscreen and maximize integration.
- Settled recovery for output, scale, work-area, and window-constraint changes.
- Configurable gaps, application tiling exclusions, global and
  application-specific initial column widths, column-width presets, resize
  steps, horizontal focus centering, and optional borderless presentation.
- Optional five-finger horizontal touchpad navigation on native Wayland.
- Exact extension-reload restoration, conservative cross-session restoration,
  and fail-closed restoration when a known output returns.
- An optional overview companion that presents the authoritative layout; the
  1.7.0 release adds guarded current-card focus, while 1.8.0 adds guarded
  non-current desktop selection from number gutters. The 1.9 development branch
  also activates an exact non-current thumbnail after guarded desktop
  selection.
- An optional reversible shortcut helper with custom JSON profiles.

## Status

The latest stable release is [1.8.0](docs/release-notes-1.8.0.md).

The `main` branch tracks `1.9.0-dev.0` and is not a stable release.

Driftile requires KDE Plasma with KWin 6.7 or newer. It targets native Wayland
and XWayland windows, plus single-output native X11 sessions.

Known limits:

- Cross-session restoration waits up to five seconds for every strongly and
  uniquely identifiable persisted window. Ambiguous or incomplete snapshots
  are skipped without partial ownership.
- A returned output is restored only when its complete topology and tiled
  window set match safely; otherwise normal topology recovery is used.
- Physical connector hot-plugging has not been verified.
- Native X11 multi-output layouts remain unverified.

See [Product scope](docs/product-scope.md) for the complete behavior boundary.

## Installation

Install the versioned `.kwinscript`, enable Driftile in **System Settings >
Window Management > KWin Scripts**, then assign shortcuts manually or with the
optional reversible helper. See [Installation](docs/installation.md) for
artifact verification, custom shortcut profiles, NixOS and Home Manager
modules, upgrades, and safe removal. See [Migration](docs/migration.md) before
changing release generations.

The release artifacts also provide the separate overview effect. It is
disabled and unbound by default; see [Overview companion](docs/overview.md).

## Development

Requirements: Node.js 22 or newer, npm, `zip`, `unzip`, ShellCheck, REUSE,
`busctl`, `flock`, `kwriteconfig6`, and KDE Frameworks 6 KPackage tools.

```bash
npm ci
npm run check
npm run package:check
```

Use the lifecycle commands from a running Plasma session:

```bash
npm run install:dev
npm run upgrade:dev
npm run uninstall:dev
```

They release an owned shortcut profile and unload Driftile before changing the
installed package. Install and upgrade leave the extension disabled; follow
their printed steps to enable Driftile and optionally claim the default profile.

`nix develop` provides the source toolchain, and `nix build` builds the KWin
package. See [Testing](docs/testing.md) for unit, integration, and visible VM
checks.

## Documentation

- [Installation](docs/installation.md)
- [Migration](docs/migration.md)
- [Compatibility](docs/compatibility.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Configuration](docs/configuration.md)
- [Overview companion](docs/overview.md)
- [Shortcuts](docs/shortcuts.md)
- [Interaction model](docs/interaction-model.md)
- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Performance](docs/performance.md)
- [Roadmap](docs/roadmap.md)
- [1.8.0 release notes](docs/release-notes-1.8.0.md)
- [1.8.0-rc.1 release notes](docs/release-notes-1.8.0-rc.1.md)
- [1.7.0 release notes](docs/release-notes-1.7.0.md)
- [1.7.0-rc.1 release notes](docs/release-notes-1.7.0-rc.1.md)
- [1.6.0 release notes](docs/release-notes-1.6.0.md)
- [1.6.0-rc.1 release notes](docs/release-notes-1.6.0-rc.1.md)
- [1.5.0 release notes](docs/release-notes-1.5.0.md)
- [1.5.0-rc.1 release notes](docs/release-notes-1.5.0-rc.1.md)
- [1.4.0 release notes](docs/release-notes-1.4.0.md)
- [1.4.0-rc.1 release notes](docs/release-notes-1.4.0-rc.1.md)
- [1.3.0 release notes](docs/release-notes-1.3.0.md)
- [1.3.0-rc.1 release notes](docs/release-notes-1.3.0-rc.1.md)
- [1.2.0 release notes](docs/release-notes-1.2.0.md)
- [1.2.0-rc.1 release notes](docs/release-notes-1.2.0-rc.1.md)
- [1.1.0 release notes](docs/release-notes-1.1.0.md)
- [1.1.0-rc.1 release notes](docs/release-notes-1.1.0-rc.1.md)
- [1.0.0 release notes](docs/release-notes-1.0.0.md)
- [1.0.0-rc.1 release notes](docs/release-notes-1.0.0-rc.1.md)
- [0.1.0 release notes](docs/release-notes-0.1.0.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the [niri compositor](https://github.com/YaLTeR/niri).
