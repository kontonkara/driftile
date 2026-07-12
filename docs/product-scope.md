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
- Finish-only pointer reinsertion for active tiled windows within one context or
  into a visible tiled target on another output.
- Vertical window stacks within columns.
- Per-window height adjustment, weighted automatic stack distribution, and height presets.
- Managed, manually floating, automatically layout-excluded, and ignored window states.
- Optional borderless presentation for application windows with exact decoration ownership.
- Live global tiled-window gap from 0 to 64 logical pixels without changing layout state.
- Configurable 10%–100% default width for newly admitted columns, fresh cross-context retiles, and explicit reset.
- Up to 128 application-specific 10%–100% initial singleton widths, matched by
  exact KWin `desktopFileName` with global-default fallback and live constraint
  clamping.
- Up to 16 configurable, strictly increasing 10%–100% column-width presets;
  an empty configuration retains the built-in exact thirds.
- Configurable 1–50 percentage-point step for explicit column-width decrease and increase actions.
- Configurable 1–50 percentage-point step for explicit active-window height decrease and increase actions.
- Output-local commands unless a transfer is explicit.
- Work-area, size-constraint, fullscreen, minimized-window compatibility, dialog handling, and settled virtual-output recovery.
- Hard client minimum and maximum bounds with cached detection of silent visible-window changes; unexposed increment and aspect hints do not alter Driftile's tiled model, while applied frames remain subject to KWin.
- Native fullscreen control through KWin with stack-aware extraction.
- Native maximize-to-edges control through KWin with stack-aware extraction.
- Settled recovery for output-list, geometry, scale, and work-area changes.
- Deterministic multi-output capacity eviction with reachable waiting windows and automatic retry.
- One shared trailing empty virtual desktop, with output-local selection where supported and conservative creation and removal.
- Guarded one-step reordering of the currently selected desktop when the KWin scripting backend exposes it.
- Single-window floating desktop transfer with exact frame and tiled-layout preservation.
- Event-driven, incremental reconciliation; only visible context geometry and non-minimized tracked-window hard constraints are checked periodically, while a settled structural output change permits one bounded workspace resynchronization.

## Beyond v1

- Touchpad navigation remains exploratory; global wheel input is deferred
  because KWin 6.7 exposes no public script axis API.
- Cross-desktop pointer rearrangement and visual drop feedback.
- Tabbed columns and matching pointer navigation.
- Application-specific policies beyond initial column widths and an expanded
  settings UI.
- Optional visual transitions, layout indicators, and concise diagnostics.
- An optional Driftile layout overview that remains removable and preserves
  Plasma's built-in Overview as the compatible fallback.
- Activity-aware layouts.

## Compatibility

- Plasma 6.7 or newer is the primary target.
- Wayland and XWayland windows share the same layout model.
- The Plasma 6.7 X11 session uses a global-workspace fallback.
- KWin 6.7 has no public wheel-axis event API for declarative scripts; Driftile
  therefore does not capture global wheel input.
- Desktop reordering is fail-closed on KWin X11 builds that do not expose the reorder method. The documented native X11 checks cover one output; native X11 multi-output remains unverified.
- X11 and XWayland resize increments, base size, aspect bounds, and strict-geometry rules are not visible through the Plasma 6.7 workspace `KWin::Window` API used by Driftile. XWayland accepts the tested exact off-lattice frames; native X11 may quantize applied frames, so compatibility tests use grid-aligned geometry.

## KDE-owned

Driftile must integrate with, not duplicate:

- Window creation, destruction, geometry application, focus state, stacking, and constraints.
- Output discovery, scaling, work areas, configuration, and window transfer.
- Virtual-desktop objects, ordering, per-screen selection, names, grid settings, and switching.
- Window Rules and general application matching.
- Global shortcut registration plus explicit, reversible conflict resolution.
- Fullscreen, maximize, minimize, decoration mechanisms, and interactive move/resize behavior.
- Dialogs, modal or transient windows, non-resizable normal windows, and normal windows fixed on both axes.
- Overview, Pager, Task Switcher, desktop OSD, and session restoration.

## Invariants

- A managed window has exactly one layout context and one geometry owner.
- A command cannot mutate an unrelated context.
- Entering fullscreen for a member of a regular stack extracts it into an immediate right singleton before calling KWin; leaving fullscreen keeps it separate.
- Maximizing a member of a regular stack extracts it into an immediate right singleton before calling KWin; unmaximizing leaves it separate.
- No layout write occurs while a topology snapshot is unsettled.
- A temporarily unusable settled work area leaves eligible startup windows waiting and managed layouts unchanged without writes or retry loops; a later settled geometry change recovers them normally.
- Focusing a non-minimized managed window makes it fully visible with the smallest required scroll.
- Reordering moves one whole active column left, right, first, or last inside its context without changing focus or widths.
- Column-width resizing changes one whole active column, translates client limits to decorated frame bounds, respects every member's width constraints, and preserves focus and grouping.
- A newly admitted or explicitly resized width that reaches a hard minimum or maximum is stored at that fixed logical-pixel boundary, so work-area changes cannot scale it past the same constraint.
- Exposed client minimum and maximum sizes are hard bounds and are revalidated immediately before writes. Unexposed X11 increment and aspect hints never change Driftile's modeled admission, grouping, shared widths, or height partitioning; KWin may still constrain the applied frame on a backend that enforces them.
- Available-width expansion grows only a fully visible active column up to its shared window constraints, preserves every other fully visible column, and changes width and viewport atomically.
- Visible-column centering changes only the viewport offset and preserves focus, order, widths, and grouping.
- Window-height resizing makes the active member the sole fixed or preset member; automatic siblings preserve their relative weights while sharing the remaining height.
- A height action never moves opposite its requested direction after constraints change. An automatic member may become fixed without a frame write when it already touches the requested hard boundary.
- Resetting a window height returns that member to automatic sizing. A failed stack reflow restores every prior height state and frame.
- Horizontal window movement merges a singleton into its neighbor or extracts a stacked member into a new adjacent singleton column.
- Merge preserves the destination width; extraction copies the source width; both preserve focus and member order.
- A same-context tiled pointer drop targets one visible window. Its vertical midpoint selects before or after; cross-column insertion adopts automatic height and the destination width, while same-stack reorder retains height policy. Invalidated or ambiguous intent restores the original slot.
- After KWin moves an active normal tiled window to another visible output, Driftile may adopt that move by inserting it before or after the tiled window under the cursor. The target midpoint selects the position, the destination column width is retained, and the moved window adopts automatic height. KWin remains the sole owner of physical output and desktop movement. An empty, invalidated, ambiguous, or raced target falls back to ordinary destination admission as a singleton instead of reversing KWin's move.
- Direct insertion appends the active window to the nearest existing stack in its direction, skips singleton columns as nonparticipants without wrapping, and preserves the target width.
- Direct insertion may cross settled minimized passive peers in the participating source and target columns, including a fully minimized target stack. Those peers retain logical order, height state, minimized state, and externally changed frames without geometry writes. Fullscreen, maximized, native-tiled, restore- or toggle-settling, and other blockers in either participating column fail closed; a state round trip during reflow cancels and rolls back the edit.
- Explicit consume appends the immediate right column's visible top member to the active column; explicit expel moves the active column's visible bottom member into a new right column. Focus remains in the active column.
- Horizontal focus skips fully minimized columns; vertical focus skips minimized slots. Both stop at layout boundaries without wrapping.
- Focus traversal does not route around suspension reasons other than minimization; those blockers remain fail-closed.
- Tiled and floating focus commit only after KWin accepts the selected live target; rejected or synchronously invalidated requests restore the prior focus and layout.
- Vertical stack reorder may move a visible active member across settled minimized slots, changing logical order without writing hidden frames. Any other passive suspension blocker remains fail-closed.
- Horizontal extraction may split a visible active member from a stack with settled minimized peers without writing hidden frames. Other passive source blockers remain fail-closed; singleton merge semantics are unchanged.
- Explicit consume may cross settled minimized passive members in both participating columns without writing hidden frames. The active target must remain focused, visible, writable, and in-context, while the moved source top must remain visible, writable, and in-context through commit.
- Explicit expel may cross settled minimized passive members without writing hidden frames. The moved bottom member and retained focus target must remain visible, writable, and in-context. If the bottom member is active, only its visible immediate predecessor may receive focus; no fallback is selected. Driftile confirms that focus and revalidates the unchanged intent before applying the edit.
- Stacked native-state extraction may pass settled minimized peers, retaining their exact slots without frame writes.
- Whole-column desktop and output transfers may carry settled minimized passive members without layout geometry writes and must preserve their logical slots, height state, minimized state, and column width.
- A secondary single-window desktop or output transfer may extract the visible active member while settled minimized passive members in the same source column remain untouched. Those retained members keep their logical slots, height state, minimized state, and frames, and receive no desktop, output, or geometry writes. Minimized windows elsewhere in the source or target context and other undocumented hidden-member edits remain fail-closed.
- Default desktop transfer follows the active tiled column without wrapping, preserving its members, order, width, and active member. On the floating layer, it transfers only the active relation-free window. The secondary action transfers only one active window.
- Numbered desktop actions are one-based and clamp to the shared trailing empty desktop when their target exceeds the current global desktop count.
- Default output transfer selects a deterministic adjacent output without wrapping, preserves the whole active column, and adopts the destination output's visible desktop. The secondary action transfers only the active tiled window.
- Output transfer never changes an output's current desktop; moving members adopt the destination output's visible desktop when needed.
- A whole-column transfer commits only after every KWin mechanism and both context layouts succeed; partial work is compensated exactly.
- Desktop switching follows KWin's global or per-output virtual-desktop mode while layout ownership remains output-local.
- Desktop reordering asks KWin to move the currently selected desktop by exactly one global position without wrapping. Desktop IDs, every output's selection, and every window's desktop memberships remain unchanged.
- If the KWin scripting backend does not expose desktop reordering, the command is a no-op.
- The shared trailing empty desktop is pinned at the end; it cannot move or be crossed by another desktop.
- If the shared trailing desktop becomes occupied, Driftile appends another through KWin.
- Driftile removes only a redundant, empty, unselected tail created by its current run; externally created desktops are never removed.
- A manually floating window has no Driftile geometry owner and returns only through the explicit toggle.
- Retiling a manually floating window restores a surviving anchored slot when possible and captures the latest floating frame as the next safe restore baseline.
- Layer focus remains inside the active `(output, desktop)` context and restores the last non-minimized tiled or floating window. Minimized slots are skipped, while any other blocker on the selected remembered or ordered target fails closed without fallback. Selecting a tiled target in another column reveals it with the normal minimal scroll; ownership never changes.
- Directional floating focus chooses the nearest positive center distance on the requested axis; first and last choose frame-x extremes. Minimized windows are excluded, and no action wraps or writes geometry.
- KWin alone owns minimization. Driftile registers no minimize action or default shortcut, keeps a minimized tiled window in its exact logical slot, and preserves a minimized manually floating window's exact detached frame for restoration.
- An automatically layout-excluded window has no layout slot, manual-floating anchor, waiting entry, suspension, or retry state. Commands requiring layout ownership are no-ops; relation-free desktop transfer remains available.
- A managed window that becomes modal or transient leaves its layout without a geometry write or stale baseline restore. It may be admitted again after the role clears.
- Unrelated window order, widths, and viewport offsets remain stable.
- A changed context never restores an original frame captured under stale output geometry.
- Capacity eviction keeps windows reachable and preserves the active column when a writable alternative exists.
- Occupied or visible virtual desktops are never removed.
- Special and all-desktop windows are never tiled.
- Borderless mode covers tiled, floating, dialog, transient, and utility windows, changes only decoration state claimed by Driftile, and restores it when disabled or unloaded.
- A live gap change reflows visible tiled contexts only. It preserves logical order, widths, height policies, focus, floating frames, excluded windows, and minimized frames; hidden contexts adopt it when shown.
- A default-width change leaves existing column width policies unchanged. Newly admitted columns, fresh cross-context retiles, and explicit reset use the new proportion subject to live window constraints. Retrying a waiting admission may add a column and update the affected viewport and frames; otherwise the policy change performs no frame writes.
- Application-width rules use one exact, case-sensitive `desktopFileName` entry
  per line and allow 10%–100%; more than 128 entries reject the complete
  setting. Only newly created or freshly admitted singleton columns consult the
  bounded lookup; existing columns keep their width, missing matches use the
  global default, and normal constraints may clamp the result.
- A column-width preset change performs no layout, frame, viewport, focus, or
  persistence write. Existing columns keep their concrete width; later preset
  actions use the replacement cycle and retain normal constraint clamping.
- A width-step change performs no layout, frame, viewport, or focus write. It affects only later explicit decrease and increase actions; reset, presets, full width, and available-width expansion remain independent.
- A height-step change performs no layout, frame, viewport, or focus write. It affects only later explicit decrease and increase actions; reset and height presets remain independent.
