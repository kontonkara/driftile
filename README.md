# Driftile

[![CI](https://github.com/kontonkara/driftile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kontonkara/driftile/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/kontonkara/driftile?display_name=tag)](https://github.com/kontonkara/driftile/releases/latest)

Driftile is a KWin extension that adds scrollable tiling and dynamic workspaces
to KDE Plasma while KWin remains the compositor and window manager.

## What it adds

- Scrollable columns with stacked or tabbed windows.
- Retained layouts per output, virtual desktop, and activity.
- Keyboard and pointer control for focus, movement, resizing, drag-and-drop,
  and transfers between outputs and desktops.
- Optional global wheel control for desktop navigation and column focus or
  movement.
- Full-width columns, floating windows, native fullscreen and maximize, and
  stable minimized-window slots.
- Configurable gaps, sizing presets, application rules, borders, shortcuts,
  transitions, and layout restoration.
- An optional spatial Overview preview with workspace rows, two-axis
  navigation, window search, and guarded drag-and-drop.

## Installation

Driftile requires KDE Plasma with KWin 6.7 or newer. Use the installation path
for your system:

- **Any compatible distribution:** [install the release KPackage](docs/installation.md#install-a-release).
- **NixOS:** [import the NixOS flake module](docs/installation.md#nixos).
- **Home Manager:** [import the per-user flake module](docs/installation.md#home-manager).

The [installation guide](docs/installation.md) includes verification, upgrade,
removal, shortcut, and optional companion instructions. After installation,
enable **Driftile** in **System Settings > Window Management > KWin Scripts**.

## Configuration

Open Driftile's entry under **System Settings > Window Management > KWin
Scripts** for layout and application settings. Manage key bindings under
**System Settings > Keyboard > Shortcuts** by searching for **Driftile**, or
use the optional [native shortcut editor](docs/installation.md#optional-native-shortcut-editor).

Nix users can declare the same settings through `programs.driftile.settings`.
See [Configuration](docs/configuration.md), [Shortcuts](docs/shortcuts.md), and
[Using Driftile](docs/interaction-model.md).

## Compatibility and status

- Wayland is the primary target; native Wayland and XWayland windows share one
  layout model.
- Native X11 is supported on one output; multi-output native X11 is unverified.
- Touchpad navigation is available only on native Wayland.
- Release archives are standard, distribution-neutral KWin KPackages.

Driftile is under active development, and the optional spatial Overview is
still evolving. Use the
[latest stable release](https://github.com/kontonkara/driftile/releases/latest)
for normal installation; `main` can contain unreleased behavior. See
[Compatibility](docs/compatibility.md) for current platform and hardware
limits.

## Documentation

- [Start here](docs/README.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Report a problem](https://github.com/kontonkara/driftile/issues/new/choose)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the
[niri compositor](https://github.com/niri-wm/niri).
