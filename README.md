# Driftile

[![CI](https://github.com/kontonkara/driftile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kontonkara/driftile/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/kontonkara/driftile?display_name=tag)](https://github.com/kontonkara/driftile/releases/latest)

Driftile is a KWin extension that adds scrollable tiling and dynamic workspaces
to KDE Plasma while KWin remains the compositor and window manager.

## Features

- Scrollable columns with stacked or tabbed windows.
- Retained layouts per output, virtual desktop, and activity.
- Keyboard and pointer control for focus, movement, resizing, drag-and-drop,
  and transfers between outputs and desktops.
- Optional native wheel control for column focus, column movement, and desktop
  navigation without replacing KWin.
- Full-width columns, floating windows, native fullscreen and maximize, and
  stable minimized-window slots.
- An optional spatial Overview with continuous workspace rows, projected
  window geometry, two-axis navigation, guarded drag-and-drop, and workspace
  creation between rows.
- Configurable gaps, sizing presets, application rules, borders, overview,
  transitions, shortcuts, and layout restoration. An optional native KDE
  shortcut editor is available separately.

## Installation

Driftile requires KDE Plasma with KWin 6.7 or newer. Use the installation path
for your system:

- **Any compatible distribution:** [install the release KPackage](docs/installation.md#install-a-release).
- **NixOS:** [import the NixOS flake module](docs/installation.md#nixos).
- **Home Manager:** [import the per-user flake module](docs/installation.md#home-manager).

For a standard installation, download the `.kwinscript` archive and
`SHA256SUMS` from the
[latest release](https://github.com/kontonkara/driftile/releases/latest), then
run as your desktop user:

```bash
sha256sum --check --ignore-missing SHA256SUMS
kpackagetool6 --type=KWin/Script --install ./driftile-*.kwinscript
```

Enable **Driftile** in **System Settings > Window Management > KWin Scripts**.
The [installation guide](docs/installation.md) also covers upgrades, removal,
shortcuts, and the optional Overview, transition, and wheel effects.

## Configuration

Open Driftile's entry under **System Settings > Window Management > KWin
Scripts** for layout and application settings. Manage key bindings under
**System Settings > Keyboard > Shortcuts** by searching for **Driftile**, or
use the optional [native shortcut editor](docs/installation.md#optional-native-shortcut-editor).

Nix users can declare the same settings through `programs.driftile.settings`.
See [Configuration](docs/configuration.md), [Shortcuts](docs/shortcuts.md), and
[Using Driftile](docs/interaction-model.md).

## Compatibility

- Wayland is the primary target; native Wayland and XWayland windows share one
  layout model.
- Native X11 is supported on one output; multi-output native X11 is unverified.
- Touchpad navigation is available only on native Wayland.
- Release archives are standard, distribution-neutral KWin KPackages.

See [Compatibility](docs/compatibility.md) for current platform and hardware
limits.

## Project status

Driftile is under active development. Use the
[latest stable release](https://github.com/kontonkara/driftile/releases/latest)
for normal installation; `main` can contain unreleased behavior. Start with the
[documentation](docs/README.md) or [troubleshooting](docs/troubleshooting.md), then
[open an issue](https://github.com/kontonkara/driftile/issues/new/choose) if the
problem remains.

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the
[niri compositor](https://github.com/niri-wm/niri).
