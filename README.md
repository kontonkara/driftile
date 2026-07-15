# Driftile

A KWin extension for KDE Plasma that provides scrollable tiling and dynamic
workspaces.

Driftile keeps independent layouts for each output and virtual desktop while
leaving window, output, and desktop mechanisms to KWin.

## Features

- Horizontal scrollable columns with stacked or tabbed window presentation.
- Keyboard-driven focus, movement, reordering, resizing, centering, and
  transfers between desktops and outputs, including direct numbered
  single-window desktop targets and contextual transfers for the active
  floating layer.
- Live same-context drop-target feedback for exact windows and empty horizontal
  column gutters; finish-only exact-window-first reinsertion into a window or
  gutter after a KWin-owned output or desktop move; and finish-only horizontal
  resize adoption.
- One shared trailing empty virtual desktop with conservative creation and
  cleanup.
- Manual floating with directional nudging, work-area centering, contextual
  width adjustment, preset cycling, reset, height resizing, and direct stack
  insertion, automatic layout exclusions, minimized-slot retention, and native
  fullscreen and maximize integration.
- Settled recovery for output, scale, work-area, and window-constraint changes.
- Configurable gaps, application initial floating, tiling and borderless
  exclusions, global and application-specific initial column widths,
  global and application-specific initial stacked or tabbed presentation,
  column-width and window-height presets, resize steps, global and
  application-specific horizontal focus centering, and optional borderless
  presentation.
- Optional passive Plasma OSD feedback when a multi-window tabbed member is
  activated or its column enters tabbed presentation.
- Optional five-finger horizontal touchpad navigation on native Wayland.
- Exact extension-reload restoration, conservative cross-session restoration,
  and fail-closed restoration when a known output returns.
- An optional overview companion that presents the authoritative layout; the
  tab strip provides guarded pointer selection for every live member of a
  tabbed column, keeps minimized members visible but disabled, and supports
  non-wrapping spatial keyboard navigation between actionable targets. A
  guarded number-gutter drag reorders desktop cards while protecting the
  shared trailing empty desktop, and a passive badge reports each card's
  active-column presentation and logical width. A rejected current activation
  attempt requests one best-effort generic Plasma OSD.
- An optional reversible shortcut helper with custom JSON profiles.

## Status

The latest stable release is [1.30.0](docs/release-notes-1.30.0.md).
The feature list tracks the current `main` branch; release state is recorded in
the [roadmap](docs/roadmap.md).
Version 1.30.0 adds same-context empty horizontal gutter targets to tiled-window
dragging. A singleton moves as one complete column; a stack member is extracted
with the source width, automatic height, and its current application or global
initial presentation. Exact-window drops retain precedence and their existing
stack behavior. The viewport follows active-column reveal rules.

Version 1.31.0 is in development. After KWin moves the active tiled window to
another visible output or selected desktop, releasing in a destination gutter creates
a separate column with the source width, automatic height, and current initial
presentation. Exact-window targets still win. Cross-context targeting remains
finish-only without live feedback, and an invalid target keeps KWin's move and
uses ordinary singleton admission.

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
disabled by default and offers `Meta+O` for a fresh shortcut record when
enabled. Existing KGlobalAccel assignments are preserved; see [Overview
companion](docs/overview.md).

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
Upgrade requests a Plasma session restart only when the installed and next
fixed bootstraps differ.

`nix develop` provides the source toolchain, and `nix build` builds the KWin
package. See [Testing](docs/testing.md) for unit, integration, and VM checks.

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
- [1.30.0 release notes](docs/release-notes-1.30.0.md)
- [1.29.0 release notes](docs/release-notes-1.29.0.md)
- [1.28.0 release notes](docs/release-notes-1.28.0.md)
- [1.27.0 release notes](docs/release-notes-1.27.0.md)
- [1.26.0 release notes](docs/release-notes-1.26.0.md)
- [1.25.0 release notes](docs/release-notes-1.25.0.md)
- [1.24.0 release notes](docs/release-notes-1.24.0.md)
- [1.23.0 release notes](docs/release-notes-1.23.0.md)
- [1.22.0 release notes](docs/release-notes-1.22.0.md)
- [1.21.0 release notes](docs/release-notes-1.21.0.md)
- [1.20.0 release notes](docs/release-notes-1.20.0.md)
- [1.19.0 release notes](docs/release-notes-1.19.0.md)
- [1.19.0-rc.1 release notes](docs/release-notes-1.19.0-rc.1.md)
- [1.18.0 release notes](docs/release-notes-1.18.0.md)
- [1.18.0-rc.1 release notes](docs/release-notes-1.18.0-rc.1.md)
- [1.17.0 release notes](docs/release-notes-1.17.0.md)
- [1.17.0-rc.1 release notes](docs/release-notes-1.17.0-rc.1.md)
- [1.16.0 release notes](docs/release-notes-1.16.0.md)
- [1.16.0-rc.1 release notes](docs/release-notes-1.16.0-rc.1.md)
- [1.15.1 release notes](docs/release-notes-1.15.1.md)
- [1.15.0 release notes](docs/release-notes-1.15.0.md)
- [1.15.0-rc.1 release notes](docs/release-notes-1.15.0-rc.1.md)
- [1.14.0 release notes](docs/release-notes-1.14.0.md)
- [1.14.0-rc.1 release notes](docs/release-notes-1.14.0-rc.1.md)
- [1.13.0 release notes](docs/release-notes-1.13.0.md)
- [1.13.0-rc.1 release notes](docs/release-notes-1.13.0-rc.1.md)
- [1.12.0 release notes](docs/release-notes-1.12.0.md)
- [1.12.0-rc.1 release notes](docs/release-notes-1.12.0-rc.1.md)
- [1.11.0 release notes](docs/release-notes-1.11.0.md)
- [1.11.0-rc.1 release notes](docs/release-notes-1.11.0-rc.1.md)
- [1.10.0 release notes](docs/release-notes-1.10.0.md)
- [1.10.0-rc.1 release notes](docs/release-notes-1.10.0-rc.1.md)
- [1.9.1 release notes](docs/release-notes-1.9.1.md)
- [1.9.1-rc.1 release notes](docs/release-notes-1.9.1-rc.1.md)
- [1.9.0 release notes](docs/release-notes-1.9.0.md)
- [1.9.0-rc.1 release notes](docs/release-notes-1.9.0-rc.1.md)
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
