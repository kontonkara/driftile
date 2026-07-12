# Driftile

A KWin extension for KDE Plasma aiming to provide scrollable tiling and dynamic workspaces.

> Driftile is in early development and has no usable release yet.

The current prototype models eligible normal windows in independent `(output, desktop)` contexts. It supports scrollable columns, vertical stacks, focus and reorder commands, manual floating, layer switching and geometric floating-window focus, stack-aware native fullscreen and maximize, preset and incremental column sizing, available-width expansion, active and visible-group centering, per-window height adjustment with automatic reset and `1/3`, `1/2`, and `2/3` presets, and atomic whole-column transfers between desktops and outputs. Secondary single-window transfers remain available without default keys. Structural commands preserve focus, transfers do not wrap, and horizontal focus reveals its target with the smallest required scroll.

Driftile keeps one shared trailing virtual desktop empty. It appends a desktop when the tail becomes occupied and removes only a redundant, unselected tail created by the current run. Where KWin exposes desktop reordering, the currently selected desktop can move one position in the global list without wrapping; IDs, output selections, and window memberships stay unchanged, and the empty tail stays pinned. Current-desktop selection remains output-local where KWin supports it.

The default controls use compact `Meta` combinations with `H/J/K/L` and arrow aliases. Plasma reserves some of them, so Driftile provides a reversible shortcut-claim command. See [Shortcuts](docs/shortcuts.md).

Dialogs, modal or transient windows, non-resizable normal windows, and normal windows fixed on both axes remain outside layout ownership. Driftile does not admit them to a layout or write their geometry, desktop, or output; layout-mutating commands are no-ops while one is active, while focus-only floating and layer commands may select an available window. This automatic state is separate from manual floating. A managed window that becomes transient leaves its layout without restoring an old frame and can be admitted again after the transient role clears. Client size limits for other windows are translated to decorated frame limits before layout writes and column resizing.

KWin owns minimization; Driftile provides no minimize action or default shortcut. A minimized tiled window keeps its exact logical slot, while a minimized manually floating window keeps its exact floating frame. Focus navigation and layer switching skip minimized windows and fully minimized columns without wrapping. A visible stack member can move across settled minimized slots or extract horizontally past them. Direct insertion may cross settled minimized peers in its participating source and target columns, including a fully minimized target stack; skipped singleton columns do not participate. Those peers retain their logical order, height state, minimized state, and externally changed frames without geometry writes. Fullscreen, maximized, native-tiled, restore- or toggle-settling, and other blockers in either participating column make insertion fail closed; state round trips during reflow cancel and roll back the edit. Consume can pull the visible top member of the immediate-right column past settled minimized passive peers in either column. Expel can move a visible bottom member past minimized passive peers when its retained focus target is also visible; an active bottom member moves only after KWin confirms the focus handoff. These operations do not write hidden frames. Native fullscreen and maximize may extract a visible member past minimized peers. Whole-column desktop and output transfers may carry settled minimized passive members without layout geometry writes. A secondary single-window transfer may extract the visible active member while settled minimized passive members in the same source column remain untouched. Those retained members keep their logical slots, height state, minimized state, and frames, and receive no desktop, output, or geometry writes. Minimized windows elsewhere in the source or target context and other hidden-member operations stay fail-closed unless documented otherwise.

KWin-decorated application windows are borderless by default, including tiled, floating, dialog, transient, and utility windows. The setting is optional, never claims windows that were already borderless, and restores owned decorations when disabled or unloaded. Tiled window gaps are configurable live from 0 to 64 logical pixels and default to 16. Newly admitted columns use a configurable 50% proportional width, while incremental column-width and window-height changes each use a configurable 10-percentage-point step. See [Configuration](docs/configuration.md).

Live output-list, geometry, scale, and work-area changes recover after two delayed topology snapshots agree. Output and dock signals trigger normal recovery; a two-second watchdog checks visible contexts and windows for client-area or hard size-constraint changes that KWin does not signal. Reconfigured contexts discard stale original-frame restore baselines for the rest of the run. If a multi-output context no longer fits, Driftile parks whole columns with a reachable anchor inside the work area, preferring non-active columns, and retries them when capacity returns.

Persistence is not enabled yet. A versioned state codec, conservative matchers,
and a tested KWin-local state store are complete; safe runtime hydration and
store integration remain v1 work.

## Goals

- Independent scrollable window strips for every output and virtual desktop.
- Horizontal columns with optional vertical window stacks.
- Keyboard-first navigation and window management.
- Dynamic workspace lifecycle with output-local selection where supported.
- Portable installation through the standard KWin package format.

## Installation

Driftile requires Plasma with KWin 6.7 or newer. Install the versioned
`.kwinscript`, enable it in System Settings, then configure shortcuts manually
or with the optional reversible helper. See [Installation](docs/installation.md)
for checksums, upgrades, Nix packaging, and safe removal.

## Development

Requirements: Node.js 22 or newer, npm, `zip`, ShellCheck, `busctl`, `flock`, and KDE Frameworks 6 KPackage tools.

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

The generated KWin package, optional shortcut helper, license, and checksum
manifest are written to `dist/`.

Run `npm run test:integration` for isolated KWin lifecycle tests. A visible NixOS Plasma VM is also available. See [Testing](docs/testing.md) for coverage and commands.

## Documentation

- [Installation](docs/installation.md)
- [Product scope](docs/product-scope.md)
- [Interaction model](docs/interaction-model.md)
- [Shortcuts](docs/shortcuts.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Testing](docs/testing.md)

## License

Driftile is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).

## Acknowledgements

The window-management model was inspired by the [niri compositor](https://github.com/YaLTeR/niri).
