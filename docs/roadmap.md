# Roadmap

## Foundation

- Build and package a declarative KWin script with a TypeScript runtime.
- Observe eligible windows without changing their state.
- Establish the initial layout model, tests, and development environment.

Exit criteria:

- Format, type, lint, unit, build, and package checks pass.
- The generated KPackage contains the QML bridge and runtime bundle.
- Enabling or disabling the script does not move windows.

## Walking skeleton

Build one complete path through every layer.

- Package and load the QML bridge and compiled TypeScript runtime.
- Snapshot outputs, desktops, and eligible windows.
- Model one `(output, desktop)` context with stable per-column widths.
- Handle add, remove, activate, focus-left, and focus-right events.
- Produce minimal geometry updates through reconcile.
- Add core and reconcile tests plus structured diagnostics.

Exit criteria:

- Three normal windows tile and scroll inside the active work area.
- Directional focus reveals the target window.
- Repeating reconcile without a state change performs no writes.
- Other outputs and desktops remain untouched.
- The runtime performs no workspace-wide periodic scans.

## MVP

Complete the daily keyboard-driven workflow.

- Manage every output and desktop independently.
- Add vertical stacks, movement, column resizing, and floating toggles.
- Support explicit transfers between outputs and desktops.
- Integrate dialogs, floating windows, remaining size constraints, and work-area changes.
- Recover safely from output connection, removal, scaling, and rotation.
- Maintain a trailing empty desktop with guarded removal.
- Register configurable shortcuts and essential layout settings.

Exit criteria:

- Commands affect only their target context.
- Opening, closing, moving, and resizing windows preserves unrelated layout state.
- Fullscreen and minimized windows return to their previous layout position.
- Hot-plug recovery leaves every window reachable.
- Dynamic workspace changes never remove an occupied or visible desktop.
- A sustained lifecycle test produces no exceptions or geometry feedback loop.

## v1

Harden recovery and finish user-facing integration.

- Persist logical order, widths, viewport offsets, and floating overrides.
- Restore layouts across script reloads, sessions, and known output topologies.
- Add mouse-driven reinsertion and rearrangement.
- Add Driftile-specific application overrides and a complete settings UI.
- Add optional visual transitions and concise diagnostics.
- Publish compatibility, migration, troubleshooting, and performance guidance.

Exit criteria:

- Reload and session restoration converge without scrambling visible layouts.
- Reconnecting a known output restores its contexts without disturbing active outputs.
- Keyboard and mouse operations produce the same layout model.
- Performance budgets pass on the documented reference scenario.
- Installation, upgrade, disable, and uninstall paths leave Plasma usable.
