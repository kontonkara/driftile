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
- Focuses adjacent and edge columns, and reorders the active whole column left, right, first, or last with context-local shortcuts and transactional geometry rollback.
- Decreases, increases, or resets the active whole column width with grouped constraints and transactional rollback.
- Cycles preset widths in both directions, adjusts width by 10%, toggles full width, expands into available space within shared constraints, and centers either the active column or all fully visible columns.
- Adjusts one window's height by 10%, resets it to weighted automatic sizing, and cycles `1/3`, `1/2`, and `2/3` presets with transactional stack reflow.
- Focuses and reorders vertical stack members, contextually merges or extracts the active window, consumes or expels edge members, and inserts directly into the nearest stack across singleton columns.
- Toggles the active normal window between tiled and floating states with anchored reinsertion and safe geometry ownership.
- Switches focus between tiled and floating layers inside one output and desktop, remembers each layer, and navigates floating windows geometrically without changing frames.
- Leaves minimization to KWin, preserves exact logical tiled slots and manually floating frames across restoration, skips minimized focus candidates, and moves visible stack members across or out of settled minimized slots without frame writes.
- Consumes a visible immediate-right top member past settled minimized passive peers in either participating column without writing hidden frames.
- Expels a visible bottom member past settled minimized passive peers only after an exact focus handoff inside the surviving column is confirmed.
- Extracts a regular stack member into an immediate right singleton before native fullscreen, preserves settled minimized peers without frame writes, and keeps the window separate after leaving fullscreen.
- Extracts a regular stack member into an immediate right singleton before native maximize-to-edges, preserves settled minimized peers without frame writes, and keeps the window separate after unmaximize.
- Moves the whole active column between adjacent existing desktops with follow-focus, atomic two-context ownership, exact rollback, and no hidden-frame writes for settled minimized passive members; single-window transfer remains secondary.
- Focuses desktops 1 through 9 directly and moves the whole active column there, clamping out-of-range targets to the shared empty tail.
- Moves one relation-free floating window between adjacent or numbered desktops without changing its frame or either tiled layout.
- Moves the whole active column to an adjacent output with deterministic spatial routing and atomic visible-context reflow; single-window transfer remains secondary.
- Optionally removes application-window decorations independently of layout ownership while preserving pre-existing borderless state, reasserting owned policy, and restoring owned state on disable.
- Keeps one shared trailing desktop empty and removes only redundant tails created by the current run.
- Registers compact default shortcuts with `H/J/K/L`, arrow, Home/End, and Page Up/Down aliases.
- Provides a reversible development helper for claiming shortcuts already used
  by Plasma; a release UI without a Node.js dependency remains future work.
- Leaves dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership, separate from manual floating.
- Translates client minimum and maximum sizes to decorated frame bounds for layout validation and column resizing.

The automatic-floating base is complete. Size increments, aspect ratios, live constraint changes across more toolkits, physical connector hot-plug, and a wider rotation matrix remain MVP hardening work.

## MVP

Complete the daily keyboard-driven workflow.

- Manage every output and desktop independently.
- Define structural command behavior for columns and stacks containing minimized members.
- Add virtual-desktop reordering within KDE's global desktop model.
- Define size-increment and aspect-ratio behavior, and expand live constraint-change coverage across toolkits.
- Harden the existing topology recovery for rotation, rapid physical hot-plug sequences, and more hardware configurations.
- Add the remaining essential layout settings.

Exit criteria:

- Commands affect only their target context.
- Default transfer shortcuts preserve every member and the width of the active column.
- Opening, closing, moving, and resizing windows preserves unrelated layout state.
- Fullscreen windows retain their extracted singleton position.
- Structural commands involving minimized members have an explicit, tested policy.
- Hot-plug recovery leaves every window reachable.
- Dynamic workspace changes never remove an occupied or visible desktop.
- A sustained lifecycle test produces no exceptions or geometry feedback loop.

## v1

Harden recovery and finish user-facing integration.

- Persist logical order, widths, viewport offsets, and floating overrides.
- Restore layouts across script reloads, sessions, and known output topologies.
- Add mouse-driven reinsertion and rearrangement.
- Add tabbed column presentation and matching pointer navigation.
- Add Driftile-specific application overrides and a complete settings UI.
- Add optional visual transitions and concise diagnostics.
- Publish compatibility, migration, troubleshooting, and performance guidance.

Exit criteria:

- Reload and session restoration converge without scrambling visible layouts.
- Reconnecting a known output restores its contexts without disturbing active outputs.
- Keyboard and mouse operations produce the same layout model.
- Performance budgets pass on the documented reference scenario.
- Installation, upgrade, disable, and uninstall paths leave Plasma usable.
