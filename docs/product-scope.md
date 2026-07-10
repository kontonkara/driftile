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
- Managed, floating, and ignored window states.
- Output-local commands unless a transfer is explicit.
- Work-area, size-constraint, fullscreen, minimized, dialog, and hot-plug handling.
- One trailing empty workspace per output, with conservative creation and removal.
- Event-driven, incremental reconciliation with no workspace-wide scans.

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
- Global shortcut registration and editing.
- Fullscreen, maximize, minimize, decorations, and interactive move/resize behavior.
- Overview, Pager, Task Switcher, desktop OSD, and session restoration.

## Invariants

- A managed window has exactly one layout context and one geometry owner.
- A command cannot mutate an unrelated context.
- Focusing a managed window makes it fully visible with the smallest required scroll.
- Unrelated window order, widths, and viewport offsets remain stable.
- Occupied or visible virtual desktops are never removed.
- Special and all-desktop windows are never tiled.
