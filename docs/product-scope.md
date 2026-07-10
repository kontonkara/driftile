# Product Scope

## Purpose

Driftile is a KWin extension for KDE Plasma. It provides scrollable tiling with independent layout state for every output and virtual desktop, plus a safe dynamic-workspace policy.

The ownership rule is strict:

- Driftile owns layout policy.
- KWin owns window, output, and virtual-desktop mechanisms.
- Plasma owns shell UX.

## Core

- One horizontal strip of columns per `(output, desktop)` context.
- Deterministic window insertion, ordering, focus, movement, resizing, and scrolling.
- Vertical window stacks within columns.
- Managed, manually floating, automatically layout-excluded, and ignored window states.
- Optional borderless presentation for application windows with exact decoration ownership.
- Output-local commands unless a transfer is explicit.
- Work-area, size-constraint, fullscreen, minimized, dialog, and hot-plug handling.
- Settled recovery for output-list, geometry, scale, and work-area changes.
- Deterministic multi-output capacity eviction with reachable waiting windows and automatic retry.
- One shared trailing empty virtual desktop, with output-local selection where supported and conservative creation and removal.
- Event-driven, incremental reconciliation; only visible context geometry is checked periodically, while a settled structural output change permits one bounded workspace resynchronization.

## Later

- Persistent layout and output-topology restoration.
- Touchpad navigation and tabbed columns.
- Mouse-driven insertion and rearrangement.
- Driftile-specific application overrides.
- Optional visual transitions and layout indicators.
- Activity-aware layouts.
- Polished configuration and diagnostics.

## Compatibility

- Plasma 6.7 or newer is the primary target.
- Wayland and XWayland windows share the same layout model.
- The Plasma 6.7 X11 session uses a global-workspace fallback.

## KDE-owned

Driftile must integrate with, not duplicate:

- Window creation, destruction, geometry application, focus state, stacking, and constraints.
- Output discovery, scaling, work areas, configuration, and window transfer.
- Virtual-desktop objects, per-screen selection, names, grid settings, and switching.
- Window Rules and general application matching.
- Global shortcut registration plus explicit, reversible conflict resolution.
- Fullscreen, maximize, minimize, decoration mechanisms, and interactive move/resize behavior.
- Dialogs, modal or transient windows, non-resizable normal windows, and normal windows fixed on both axes.
- Overview, Pager, Task Switcher, desktop OSD, and session restoration.

## Invariants

- A managed window has exactly one layout context and one geometry owner.
- A command cannot mutate an unrelated context.
- No layout write occurs while a topology snapshot is unsettled.
- Focusing a managed window makes it fully visible with the smallest required scroll.
- Reordering moves one whole active column inside its context without changing focus or widths.
- Resizing changes one whole active column, translates client limits to decorated frame bounds, respects every member's width constraints, and preserves focus and grouping.
- Horizontal window movement merges a singleton into its neighbor or extracts a stacked member into a new adjacent singleton column.
- Merge preserves the destination width; extraction copies the source width; both preserve focus and member order.
- Direct insertion appends the active window to the nearest existing stack in its direction, skips singleton columns without wrapping, and preserves the target width.
- Vertical focus and member reorder stop at stack boundaries without wrapping.
- Default desktop transfer follows the active column without wrapping, preserving its members, order, width, and active member. The secondary action transfers only the active tiled window.
- Default output transfer selects a deterministic adjacent output without wrapping, preserves the whole active column, and adopts the destination output's visible desktop. The secondary action transfers only the active tiled window.
- Output transfer never changes an output's current desktop; moving members adopt the destination output's visible desktop when needed.
- A whole-column transfer commits only after every KWin mechanism and both context layouts succeed; partial work is compensated exactly.
- Desktop switching follows KWin's global or per-output virtual-desktop mode while layout ownership remains output-local.
- If the shared trailing desktop becomes occupied, Driftile appends another through KWin.
- Driftile removes only a redundant, empty, unselected tail created by its current run; externally created desktops are never removed.
- A manually floating window has no Driftile geometry owner and returns only through the explicit toggle.
- Retiling a manually floating window restores a surviving anchored slot when possible and captures the latest floating frame as the next safe restore baseline.
- An automatically layout-excluded window has no layout slot, manual-floating anchor, waiting entry, suspension, or retry state. Driftile layout commands are no-ops while it is active.
- A managed window that becomes modal or transient leaves its layout without a geometry write or stale baseline restore. It may be admitted again after the role clears.
- Unrelated window order, widths, and viewport offsets remain stable.
- A changed context never restores an original frame captured under stale output geometry.
- Capacity eviction keeps windows reachable and preserves the active column when a writable alternative exists.
- Occupied or visible virtual desktops are never removed.
- Special and all-desktop windows are never tiled.
- Borderless mode covers tiled, floating, dialog, transient, and utility windows, changes only decoration state claimed by Driftile, and restores it when disabled or unloaded.
