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

## Recovery base

The current runtime already:

- Settles output and work-area event bursts behind two matching delayed snapshots.
- Observes output-list, geometry, scale, and dock invalidations.
- Checks visible client areas every two seconds to cover the missing complete KWin signal.
- Preserves a deterministic layout order across structural output changes.
- Invalidates stale restore baselines without reviving them when old geometry returns.
- Parks deterministic whole columns when a new multi-output capacity limit no longer fits, preferring non-active columns, then retries waiting windows.
- Reorders the active whole column left or right with context-local shortcuts and transactional geometry rollback.
- Decreases, increases, or resets the active whole column width with grouped constraints and transactional rollback.
- Focuses and reorders vertical stack members, contextually merges or extracts the active window, and inserts it directly into the nearest stack across singleton columns.
- Toggles the active normal window between tiled and floating states with anchored reinsertion and safe geometry ownership.
- Moves the active tiled window between adjacent existing desktops with follow-focus and atomic two-context ownership.
- Moves the active tiled window to an adjacent output with deterministic spatial routing and atomic visible-context reflow.

Physical connector hot-plug and a wider rotation matrix remain MVP hardening work.

## MVP

Complete the daily keyboard-driven workflow.

- Manage every output and desktop independently.
- Integrate dialogs and remaining size-constraint behavior.
- Harden the existing topology recovery for rotation, rapid physical hot-plug sequences, and more hardware configurations.
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
