# Driftile

A KWin extension for KDE Plasma aiming to provide scrollable tiling and dynamic workspaces.

> Driftile is in early development and has no usable release yet.

The current prototype models eligible normal windows in independent `(output, desktop)` contexts. It supports scrollable columns, vertical stacks, focus and reorder commands, manual floating, preset and incremental column sizing, centering, and single-window transfers between desktops and outputs. Structural commands preserve focus, transfers do not wrap, and horizontal focus reveals its target with the smallest required scroll. Default transfer shortcuts leave stacked columns intact until atomic whole-column transfer is complete.

Driftile keeps one shared trailing virtual desktop empty. It appends a desktop when the tail becomes occupied and removes only a redundant, unselected tail created by the current run. KDE owns the global desktop list; current-desktop selection remains output-local where KWin supports it.

The default controls use compact `Meta` combinations with `H/J/K/L` and arrow aliases. Plasma reserves some of them, so Driftile provides a reversible shortcut-claim command. See [Shortcuts](docs/shortcuts.md).

Dialogs, modal or transient windows, non-resizable normal windows, and normal windows fixed on both axes remain fully KWin-owned. Driftile does not admit them to a layout or write their geometry, desktop, output, or focus; layout commands are no-ops while one is active. This automatic state is separate from manual floating. A managed window that becomes transient leaves its layout without restoring an old frame and can be admitted again after the transient role clears. Client size limits for other windows are translated to decorated frame limits before layout writes and column resizing.

Live output-list, geometry, scale, and work-area changes recover after two delayed topology snapshots agree. Output and dock signals trigger normal recovery; a two-second watchdog checks visible contexts for client-area changes that KWin does not signal. Reconfigured contexts discard stale original-frame restore baselines for the rest of the run. If a multi-output context no longer fits, Driftile parks whole columns with a reachable anchor inside the work area, preferring non-active columns, and retries them when capacity returns.

Layout and workspace persistence are not implemented yet.

## Goals

- Independent scrollable window strips for every output and virtual desktop.
- Horizontal columns with optional vertical window stacks.
- Keyboard-first navigation and window management.
- Dynamic workspace lifecycle with output-local selection where supported.
- Portable installation through the standard KWin package format.

## Development

Requirements: Node.js 22 or newer, npm, ShellCheck, `busctl`, `flock`, and KDE Frameworks 6 KPackage tools.

```bash
npm ci
npm run check
npm run package
```

For a development install, enable the script in System Settings and claim its
shortcut profile:

```bash
npm run install:dev
npm run shortcuts:claim
```

On systems with Nix, `nix develop` provides the source toolchain, and `nix build` builds the KWin package. Use `nix develop .#integration` for the isolated KWin tests.

The generated KWin package is written to `dist/driftile.kwinscript`.

Run `npm run test:integration` for isolated KWin lifecycle tests. A visible NixOS Plasma VM is also available. See [Testing](docs/testing.md) for coverage and commands.

## Documentation

- [Product scope](docs/product-scope.md)
- [Interaction model](docs/interaction-model.md)
- [Shortcuts](docs/shortcuts.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Testing](docs/testing.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the [niri compositor](https://github.com/YaLTeR/niri).
