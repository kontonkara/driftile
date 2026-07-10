# Driftile

A KWin extension for KDE Plasma providing scrollable tiling and dynamic workspaces.

> Driftile is in early development and has no usable release yet.

The current prototype tiles eligible normal windows only in the output and desktop that are active when the script starts. It restores their original frames when stopped if the output topology is unchanged. Overflow windows remain unmanaged until a safe clipping strategy is implemented. Navigation, state transitions, recovery, and persistence are not implemented yet. Test development builds in an isolated Plasma session.

## Goals

- Independent scrollable window strips for every output and virtual desktop.
- Horizontal columns with optional vertical window stacks.
- Keyboard-first navigation and window management.
- Dynamic per-output workspaces built on KWin virtual desktops.
- Portable installation through the standard KWin package format.

## Development

Requirements: Node.js 22 or newer, npm, and KDE Frameworks 6 KPackage tools.

```bash
npm ci
npm run check
npm run package
```

On systems with Nix, `nix develop` provides the complete development toolchain.

The generated KWin package is written to `dist/driftile.kwinscript`.

## Documentation

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the niri compositor.
