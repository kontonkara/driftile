# Driftile

A KWin extension for KDE Plasma that provides scrollable tiling and dynamic
workspaces.

Driftile keeps independent layouts for each output and virtual desktop while
leaving window, output, and desktop mechanisms to KWin.

## Features

- Horizontal scrollable columns with optional vertical window stacks.
- Keyboard-driven focus, movement, reordering, resizing, centering, and
  transfers between desktops and outputs.
- One shared trailing empty virtual desktop with conservative creation and
  cleanup.
- Manual floating, automatic layout exclusions, minimized-slot retention, and
  native fullscreen and maximize integration.
- Settled recovery for output, scale, work-area, and window-constraint changes.
- Configurable gaps, default column width, resize steps, and optional
  borderless presentation.
- An optional helper that claims the default shortcut profile and restores
  displaced assignments.

## Status

The current version is 0.1.0 and requires KDE Plasma with KWin 6.7 or newer. It
targets native Wayland and XWayland windows, plus single-output native X11
sessions.

Known limits:

- Layout state is not restored across sessions or extension reloads.
- Physical connector hot-plugging has not been verified.
- Native X11 multi-output layouts remain unverified.

See [Product scope](docs/product-scope.md) for the complete behavior boundary.

## Installation

Install the versioned `.kwinscript`, enable Driftile in **System Settings >
Window Management > KWin Scripts**, then assign shortcuts manually or with the
optional reversible helper. See [Installation](docs/installation.md) for
artifact verification, upgrades, NixOS and Home Manager modules, and safe
removal.

## Development

Requirements: Node.js 22 or newer, npm, `zip`, ShellCheck, REUSE, `busctl`,
`flock`, `kwriteconfig6`, and KDE Frameworks 6 KPackage tools.

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
- [Configuration](docs/configuration.md)
- [Shortcuts](docs/shortcuts.md)
- [Interaction model](docs/interaction-model.md)
- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)
- [0.1.0 release notes](docs/release-notes-0.1.0.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the [niri compositor](https://github.com/YaLTeR/niri).
