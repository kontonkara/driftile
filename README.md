# Driftile

A KWin extension for KDE Plasma aiming to provide scrollable tiling and dynamic workspaces.

> Driftile is in early development and has no usable release yet.

The current prototype models eligible normal windows in every existing `(output, desktop)` context and applies geometry only to the desktop visible on each output. Focus navigation stays within its context. `Meta+Ctrl+H/J/K/L` focuses adjacent windows, `Meta+Ctrl+Shift+H/L` moves a whole column, and `Meta+Ctrl+Shift+J/K` reorders a member inside its stack. `Meta+Ctrl+Alt+H/L` merges a single-window column with its neighbor or extracts a stacked window in that direction. `Meta+Ctrl+-/=/0` changes or resets the active column width. Structural commands keep focus unchanged, and horizontal focus reveals its target with the smallest required scroll.

Live output-list, geometry, scale, and work-area changes recover after two delayed topology snapshots agree. Output and dock signals trigger normal recovery; a two-second watchdog checks visible contexts for client-area changes that KWin does not signal. Reconfigured contexts discard stale original-frame restore baselines for the rest of the run. If a multi-output context no longer fits, Driftile parks whole columns with a reachable anchor inside the work area, preferring non-active columns, and retries them when capacity returns.

Floating toggles, dynamic workspace creation, and persistence are not implemented yet.

## Goals

- Independent scrollable window strips for every output and virtual desktop.
- Horizontal columns with optional vertical window stacks.
- Keyboard-first navigation and window management.
- Dynamic per-output workspaces built on KWin virtual desktops.
- Portable installation through the standard KWin package format.

## Development

Requirements: Node.js 22 or newer, npm, ShellCheck, and KDE Frameworks 6 KPackage tools.

```bash
npm ci
npm run check
npm run package
```

On systems with Nix, `nix develop` provides the source toolchain, and `nix build` builds the KWin package. Use `nix develop .#integration` for the isolated KWin tests.

The generated KWin package is written to `dist/driftile.kwinscript`.

Run `npm run test:integration` for isolated KWin lifecycle tests. A visible NixOS Plasma VM is also available. See [Testing](docs/testing.md) for coverage and commands.

## Documentation

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Testing](docs/testing.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the niri compositor.
