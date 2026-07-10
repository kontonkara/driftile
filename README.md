# Driftile

A KWin extension for KDE Plasma providing scrollable tiling and dynamic workspaces.

> Driftile is in early development and has no usable release yet.

The current prototype tiles eligible normal windows only in the output and desktop that are active when the script starts. On single-output setups, `Meta+Ctrl+H` and `Meta+Ctrl+L` reveal and focus adjacent columns with the smallest required scroll. With multiple outputs, windows that would overflow remain unmanaged until output-local clipping is available. Original frames are restored when the script stops if the output topology is unchanged. Movement, state transitions, topology recovery, and persistence are not implemented yet.

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
