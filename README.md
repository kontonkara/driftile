# Driftile

[![CI](https://github.com/kontonkara/driftile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kontonkara/driftile/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/kontonkara/driftile?display_name=tag)](https://github.com/kontonkara/driftile/releases/latest)

Driftile is a KWin extension that adds scrollable tiling and dynamic workspaces
to KDE Plasma. KWin remains responsible for compositing, windows, outputs, and
virtual desktops; Driftile provides the layout and interaction policy.

## Highlights

- Horizontal scrollable columns with stacked and tabbed window layouts.
- Independent retained layouts for each output, virtual desktop, and activity,
  with one shared trailing empty desktop.
- Keyboard and pointer control for focus, movement, reordering, resizing,
  drag-and-drop, centering, and transfers between outputs or desktops.
- Full-width columns, manual floating, native fullscreen and maximize support,
  and stable minimized-window slots.
- Configurable gaps, width and height presets, application rules, focus
  centering, and optional borderless windows.
- Layout restoration plus optional overview and reversible shortcut companions.

## Installation

Driftile requires KDE Plasma with KWin 6.7 or newer.

### Any compatible Linux distribution

Download the `.kwinscript` archive and `SHA256SUMS` from the
[latest release](https://github.com/kontonkara/driftile/releases/latest), verify
the download, and install it as your desktop user:

```bash
sha256sum --check --ignore-missing SHA256SUMS
kpackagetool6 --type=KWin/Script --install ./driftile-*.kwinscript
```

Enable **Driftile** in **System Settings > Window Management > KWin Scripts**.
The [installation guide](docs/installation.md) covers upgrades, removal, the
optional overview, and the shortcut helper.

### NixOS

Pin a release tag as a flake input, import `driftile.nixosModules.default`, and
set `programs.driftile.enable = true`. See the
[NixOS instructions](docs/installation.md#nixos-and-home-manager) for the
complete module example.

### Home Manager

Import `driftile.homeManagerModules.default` and set
`programs.driftile.enable = true`. The same module can manage settings and a
shortcut profile without installing a second copy of the package. See the
[Home Manager instructions](docs/installation.md#nixos-and-home-manager).

## Configuration

Open Driftile's entry under **System Settings > Window Management > KWin
Scripts** for layout and application settings. Manage key bindings under
**System Settings > Keyboard > Shortcuts** by searching for **Driftile**.

Nix users can declare the same settings through
`programs.driftile.settings`. See [Configuration](docs/configuration.md) and
[Shortcuts](docs/shortcuts.md).

## Compatibility

- Native Wayland is the primary target; Wayland and XWayland windows share the
  same layout model.
- Native X11 is supported on a single output. Multi-output native X11 remains
  unverified.
- Touchpad navigation is available only on native Wayland.
- With multiple activities, Driftile manages windows assigned to exactly one
  activity. Windows shared across activities remain under KWin ownership.
- Release archives are standard KWin KPackages and are not tied to NixOS.

See [Compatibility](docs/compatibility.md) for current platform and hardware
limits.

## Project status

Driftile is under active development. Use the
[latest stable release](https://github.com/kontonkara/driftile/releases/latest)
for regular installation; `main` may include unreleased behavior.

## Documentation

- [Installation](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Shortcuts](docs/shortcuts.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Optional overview](docs/overview.md)
- [Documentation index](docs/README.md)

## Development

Development requires Node.js 22 or newer and the tools listed in
[Testing](docs/testing.md).

```bash
npm ci
npm run check
npm run package:check
```

`nix develop` provides the source toolchain, and `nix build` builds the KWin
package. See [Architecture](docs/architecture.md) for the extension boundary.

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the
[niri compositor](https://github.com/YaLTeR/niri).
