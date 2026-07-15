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
- Live same-context pointer-drop feedback with finish-only reinsertion, plus
  adoption at one exact visible tiled target after KWin moves the active tiled
  window to a selected desktop or another visible output.
- Finish-only horizontal pointer-resize adoption for the active tiled column.
- Vertical window stacks and tabbed presentation within columns.
- One selected member per column; tabbed members share one frame while the
  selected member owns focus and stacking intent.
- Per-window height adjustment, weighted automatic stack distribution, and height presets.
- Managed, manually floating, automatically layout-excluded, and ignored window states.
- Optional borderless presentation for application windows with exact
  decoration ownership.
- Up to 128 exact, case-sensitive KWin `desktopFileName` exclusions that keep
  matching tiled, floating, dialog, transient, and utility windows under their
  existing decoration policy.
- Live global tiled-window gap from 0 to 64 logical pixels without changing layout state.
- Configurable 10%–100% default width for newly admitted columns, fresh cross-context retiles, and explicit reset.
- Up to 128 application-specific 10%–100% initial singleton widths, matched by
  exact KWin `desktopFileName` with global-default fallback and live constraint
  clamping.
- Up to 128 exact, case-sensitive KWin `desktopFileName` values whose freshly
  admitted normal windows start under ordinary manual-floating ownership while
  retaining their KWin frames. Existing and hydrated ownership is not
  reclassified.
- Up to 128 exact KWin `desktopFileName` exclusions that keep matching
  application windows outside tiling and apply live without taking geometry
  ownership.
- Up to 16 configurable, strictly increasing 10%–100% column-width presets;
  an empty configuration retains the built-in exact thirds.
- Optional best-effort centering for successful left, right, first, and last
  tiled focus navigation, globally or for up to 128 exact, case-sensitive KWin
  `desktopFileName` targets, without changing other focus paths.
- Configurable 1–50 percentage-point step for contextual width decrease and
  increase actions: the active whole column when tiled, or the active manually
  floating window when detached.
- Configurable 1–50 percentage-point step for contextual height decrease and
  increase actions: the active stack member when tiled, or the active manually
  floating window when detached.
- One settings page groups sixteen controls into ten General and six
  Applications controls.
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

## 1.6 core slice

- A finish-only pointer resize adopts KWin's accepted width only for the
  active normal tiled window after an unambiguous width-only left- or right-edge
  resize finishes in the same settled, visible, unchanged output and desktop.
- Every member of the active column must remain visible, writable, unsuspended,
  and unchanged. Driftile writes nothing while KWin owns the
  interactive-resize lease.
- After release, Driftile stages every writable same-context target while the
  prior logical layout remains unchanged. Every target must match exactly for
  two successive samples, target mismatches time out after 20 delayed probes,
  and competing layout mutations remain blocked during settlement.
- Success then stores the accepted width in the existing fixed-column policy,
  preserves order, heights, focus, and unrelated contexts, and publishes once.
- A corner or vertical resize, ambiguous edge, changed or minimized participant,
  suspension, state, context, topology, or constraint race, or rejected write
  restores the prior policy and tiled frames. Rollback supersedes attempted
  target requests and releases after 20 exact samples. An unconfirmed rollback
  falls back after 40 probes; native-state ownership receives no competing
  frame write.
- The slice adds no setting, action, binding, feedback, persistence field, or
  compositor mechanism. It uses `O(V)` work in the visible context and no
  workspace-wide scan.

## 1.7 optional overview slice

- Only thumbnails in each `SceneView` current-desktop card accept left clicks.
- A click keeps the direct live window object and revalidates the active effect,
  exact internal ID, input eligibility, live window state, output, desktop, and
  current activity.
- A valid candidate retains or requests `KWin.Workspace.activeWindow`. The
  effect closes only after KWin confirms focus. An invalid or stale candidate
  is not written, and rejected focus leaves the effect open.
- Ordinary KWin activation may raise the window, and existing Driftile focus
  handling may reveal its tiled column.
- The effect does not switch desktops or activities, move windows, write
  memberships, outputs, geometry, or settings, or add actions, default bindings,
  gestures, drag, keyboard navigation, schema, IPC, private APIs, timers, or
  workspace scans. Direct target resolution is constant time; live validation
  is bounded by the candidate's desktop and activity memberships.

## 1.8 optional overview slice

- A left click on a non-current desktop card's number gutter requests that
  desktop for the card's exact live screen. The current gutter remains inert.
- The effect revalidates the active effect and model, exact live screen and
  projected output, the desktop's direct object and ID, and its non-current
  state immediately before writing.
- Wayland uses public `KWin.SceneView.currentDesktop`. If that property is
  unavailable, `KWin.Workspace.currentDesktop` is permitted only in an exact
  single-output session. Only a confirmed selection closes the effect.
- Invalid, stale, ambiguous, raced, or rejected requests perform no further
  work and leave the effect open.
- The slice adds no action, default binding, setting, schema, drag,
  rearrangement, private API, timer, window scan, or layout scan. Validation is
  `O(D + O)` over KWin's bounded desktop and output lists.

## 1.9 optional overview slice

- Current-card thumbnail focus remains the direct, guarded 1.7 path.
- A non-current thumbnail first revalidates the exact active effect, model, live
  screen, projected output, desktop, window, and current activity. The window
  may still be hidden because its desktop is not selected.
- The existing public per-output desktop selection, or guarded exact
  single-output global fallback, must confirm the requested desktop. The effect
  then revalidates the same candidate including visible state, requests the
  exact active window, and confirms focus.
- Rejection before selection leaves the effect open. After confirmed selection,
  late invalidation or focus failure keeps the selected desktop, closes the
  stale effect, and performs no rollback.
- The slice adds no action, binding, setting, schema, private API, timer, move,
  geometry write, or membership write. It performs no window, stacking-order,
  or layout scan.
- Validation is `O(S + O + D + M)` over observed screens, projected outputs,
  desktops, and the window's observed desktop and activity membership entries
  `M`, retains no work, and issues at most one desktop write, one focus write,
  and one deactivation.

## 1.13 core slice

- The existing width decrease and increase actions resize an active manually
  floating window. Other width actions retain their tiled-only behavior, and a
  blocked or pending floating target never falls through to a tiled mutation.
- Each target adds or subtracts the configured column-width step multiplied by
  the assigned work-area width, snaps to the physical-pixel grid, clamps to live
  decorated minimum and maximum widths with a positive client width, and keeps
  the required partial-visibility strip reachable.
- The command makes at most one forward frame request. Exact synchronous
  X11/XWayland acceptance or an exact later native Wayland geometry signal may
  commit floating metadata only while the target and all ownership guards
  remain current.
- A nonexact or stale result commits no metadata and receives no compensating
  write because the public KWin API provides no configure serial. While a
  request is pending, further width, movement, and centering commands for that
  window are rejected; 20 unchanged delayed samples, removal, or shutdown clear
  the pending ownership.
- Target calculation uses constant per-target math and performs no managed-window,
  column, or layout scan. The operation changes no tiled model, tiled frame,
  viewport, focus, reinsertion anchor, setting, binding, action, schema,
  persistence, helper, or overview behavior.

## 1.14 core slice

- The existing window-height decrease and increase actions resize an active
  manually floating frame. Tiled stack semantics remain unchanged, while reset
  and preset-height actions remain tiled-only.
- Each floating target adds or subtracts `WindowHeightStepPercent` multiplied
  by the assigned work-area height; the gap is excluded. It snaps to the
  physical-pixel grid using the assigned output's device-pixel ratio, respects
  live decorated height constraints, and keeps the required partial-visibility
  strip reachable.
- Width and top-left remain unchanged unless the minimal partial-visibility
  clamp must adjust the origin. Focus, context, reinsertion placement, and all
  tiled state remain unchanged.
- A blocked or pending floating target never falls through to a tiled stack
  mutation. The slice adds no action, binding, setting, schema, persistence,
  helper, overview behavior, or application policy.

## 1.19 core slice

- `Meta+W` toggles the active tiled column between stacked and tabbed
  presentation without changing membership, order, width, focus, or viewport.
- Every non-minimized member of a tabbed column receives the same frame. That
  frame uses the existing column width and the normal configured outer gaps;
  the selected member is focused and raised through public KWin APIs.
- Focus down or up selects the next or previous member without wrapping. Move
  down or up reorders the selected member and keeps it selected.
- Height decrease, increase, reset, and preset commands are no-ops while the
  active column is tabbed. Existing height policies remain dormant and are
  restored when the column returns to stacked presentation.
- A member entering an existing column adopts the target column's
  presentation. Cross-column merges use the same target-wins rule. Any split
  or extraction that creates a singleton creates it in stacked presentation.
- When the selected member leaves, the member now at its index is selected;
  if no successor remains, the immediate predecessor is selected. A whole
  column move preserves its presentation and selected member.
- Canonical logical state advances from v1 to v3 and persists presentation
  plus selection. Bare and catalog-nested v1 state migrate on successful
  publication. The bounded topology catalog remains v2.
- The optional overview renders only the selected member's thumbnail for a
  tabbed column. It remains read-only and separately installable.
- Stable 1.19.0 adds one action and default binding after RC.1: `Meta+Q`
  delegates closing the active window to KWin. `Meta+C` remains the contextual
  centering action. This addition changes no layout behavior, configuration,
  persistence, or overview behavior.
- The slice adds no persistent tab strip, pointer tab navigation, animation,
  setting, settings UI, private API, or compositor-owned surface. Tests cover
  only the new behavior and include proportional operation-count guards.

## 1.20 core slice

- The optional overview exposes every non-minimized live tabbed member as a
  pointer target, keeps a disabled tab for each minimized member, and retains
  one selected thumbnail plus the guarded focus path.
- `DefaultColumnPresentation` selects `stacked` or `tabbed` for unmatched fresh
  columns without rewriting existing or restored state.
- `ApplicationColumnPresentations` assigns `stacked` or `tabbed` to fresh
  columns by exact `desktopFileName`. Singleton tabbed state is valid and
  persists until explicitly changed; an existing target column still wins a
  merge.
- Confirmed multi-tab activation or entry shows an optional passive Plasma OSD.
  It adds no window, input grab, polling loop, or private KWin API.
- The optional overview offers `Meta+O` for a fresh shortcut record when
  enabled, preserves existing assignments, and remains separately installable
  and disabled by default.

## 1.21 optional overview slice

- On opening, keyboard selection prefers the active actionable window, then an
  actionable target on the current desktop, then the first actionable target
  in visual order.
- Arrow keys move spatially without wrapping. `Enter`, `Return`, and `Space`
  use the selected target's existing guarded activation path; `Escape` closes
  the effect.
- A selected tabbed member contributes its thumbnail as one target. Other live
  members contribute their tabs, while minimized, invalid, and fully clipped
  items are excluded. Partially clipped targets use their visible intersection;
  desktop gutters remain pointer-only.
- The slice adds no layout behavior, setting, persistence field, private API,
  global shortcut, drag, or rearrangement.

## 1.22 optional overview slice

- A plain left drag from a desktop card's number gutter previews one vertical
  insertion point without moving the rendered cards. An ordinary click keeps
  the existing desktop-selection path.
- The final shared empty desktop cannot be a source, target, or crossed boundary.
  Release revalidates the complete live object/ID order, effect, model, output,
  selected desktop, and scene geometry before one public KWin reorder call.
- Cancellation, no-op targets, stale order, missing API, and invalid geometry
  perform no write. Pointer updates are `O(1)`; grab and release validation are
  bounded by the desktop and output lists.
- The slice adds no setting, shortcut, persistence field, window move, private
  API, timer, or workspace window scan.

## 1.23 optional overview slice

- Each desktop card exposes one passive badge for its active column. It reports
  the validated `stacked` or `tabbed` presentation and a compact logical width,
  rounded to one decimal percentage point or one logical pixel.
- The badge reads only the active column and its existing rendered delegate. It
  is hidden for invalid state, a fully clipped column, a short card, or a visible
  span that cannot contain the complete label.
- The slice adds no input handler, animation, setting, shortcut, persistence
  field, layout mutation, window scan, or KWin write.

## 1.24 optional overview slice

- A rejected current activation attempt requests exactly one best-effort
  passive Plasma OSD with a generic message. The exact technical reason remains
  in the KWin journal.
- Cancellation, a stale callback, successful activation, and normal close are
  silent.
- The added feedback handler is `O(1)` and adds no setting, shortcut, input
  handler, KWin or layout write, persistence field, or scan beyond the existing
  activation snapshot.
- No other behavior belongs to the frozen 1.24.0 scope.

## Beyond v1

- Optional visual transitions.
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
- The built-in Overview, Pager, Task Switcher, desktop OSD, and session
  restoration. The optional companion requests focus or desktop selection only
  through public KWin properties; KWin retains focus, stacking, and desktop
  switching ownership.

## Invariants

- A managed window has exactly one layout context and one geometry owner.
- A command cannot mutate an unrelated context.
- Entering fullscreen for a member of a regular stack extracts it into an immediate right singleton before calling KWin; leaving fullscreen keeps it separate.
- Maximizing a member of a regular stack extracts it into an immediate right singleton before calling KWin; unmaximizing leaves it separate.
- No layout write occurs while a topology snapshot is unsettled.
- A temporarily unusable settled work area leaves eligible startup windows waiting and managed layouts unchanged without writes or retry loops; a later settled geometry change recovers them normally.
- Focusing a non-minimized managed window makes it fully visible. Horizontal
  tiled navigation uses the smallest required scroll unless optional centering
  successfully places the destination closer to the work-area center.
- A current-card overview click may focus only a valid live window. Only
  confirmed focus closes the effect; an invalid, stale, or rejected request
  leaves it open.
- A non-current overview thumbnail may focus only its exact projected live
  window after confirmed desktop selection. Pre-selection rejection leaves the
  effect open; any later failure keeps the selected desktop, closes the stale
  effect, and performs no rollback.
- An overview gutter click may select only an exact live non-current desktop for
  its screen. Only confirmed selection closes the effect; a current, invalid,
  stale, raced, or rejected request leaves it open.
- Overview keyboard navigation selects only actionable targets with a visible
  intersection and never wraps. Keyboard activation uses the same guarded path
  as pointer activation.
- Reordering moves one whole active column left, right, first, or last inside its context without changing focus or widths.
- Column-width resizing changes one whole active column, translates client limits to decorated frame bounds, respects every member's width constraints, and preserves focus and grouping.
- A newly admitted or explicitly resized width that reaches a hard minimum or maximum is stored at that fixed logical-pixel boundary, so work-area changes cannot scale it past the same constraint.
- Exposed client minimum and maximum sizes are hard bounds and are revalidated immediately before writes. Unexposed X11 increment and aspect hints never change Driftile's modeled admission, grouping, shared widths, or height partitioning; KWin may still constrain the applied frame on a backend that enforces them.
- Available-width expansion grows only a fully visible active column up to its shared window constraints, preserves every other fully visible column, and changes width and viewport atomically.
- Visible-column centering changes only the viewport offset and preserves focus, order, widths, and grouping.
- Tiled window-height resizing makes the active member the sole fixed or preset member; automatic siblings preserve their relative weights while sharing the remaining height.
- A height action never moves opposite its requested direction after constraints change. An automatic member may become fixed without a frame write when it already touches the requested hard boundary.
- Resetting a window height returns that member to automatic sizing. A failed stack reflow restores every prior height state and frame.
- Horizontal window movement merges a singleton into its neighbor or extracts a stacked member into a new adjacent singleton column.
- Merge preserves the destination width; extraction copies the source width; both preserve focus and member order.
- A same-context tiled pointer drop targets one visible window. Its vertical midpoint selects before or after; cross-column insertion adopts automatic height and the destination width, while same-stack reorder retains height policy. Invalidated or ambiguous intent restores the original slot.
- After KWin moves an active normal tiled window to another visible output, Driftile may adopt that move by inserting it before or after the tiled window under the cursor. The target midpoint selects the position, the destination column width is retained, and the moved window adopts automatic height. KWin remains the sole owner of physical output and desktop movement. An empty, invalidated, ambiguous, or raced target falls back to ordinary destination admission as a singleton instead of reversing KWin's move.
- After KWin selects another visible desktop on the same output and moves the active normal tiled window there, Driftile may adopt it on release over exactly one tiled target in that selected desktop. The target midpoint selects before or after, the destination width is retained, and the moved window adopts automatic height. A pending destination receives bounded settlement probes; an unavailable, invalidated, ambiguous, stale, or raced target keeps KWin's move and uses singleton admission. The hidden source receives no geometry writes.
- Cross-desktop pointer adoption adds no visual feedback, setting, shortcut action, binding, or persistence-schema field.
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
- A manually floating window remains outside continuous layout geometry ownership and returns only through the explicit toggle. Its directional move and work-area centering shortcuts each perform one guarded frame transaction.
- Retiling a manually floating window restores a surviving anchored slot when possible and captures the latest floating frame as the next safe restore baseline.
- Layer focus remains inside the active `(output, desktop)` context and restores the last non-minimized tiled or floating window. Minimized slots are skipped, while any other blocker on the selected remembered or ordered target fails closed without fallback. Selecting a tiled target in another column reveals it with the normal minimal scroll; ownership never changes.
- Directional floating focus chooses the nearest positive center distance on the requested axis; first and last choose frame-x extremes. Minimized windows are excluded, and no action wraps or writes geometry.
- Directional floating movement requests a 50-logical-pixel translation and keeps only the minimum visible strip required by the frame size. It preserves size, focus, context, reinsertion placement, and every tiled layout.
- Contextual centering places each manually floating frame dimension at the exact logical midpoint of its assigned work area, or at the work-area origin when that dimension is oversized. It performs no window, column, or layout enumeration and preserves the same ownership and state boundaries as directional movement.
- Contextual width decrease and increase resize only an active manually floating
  frame by the configured fraction of its assigned work-area width. The result
  has a physically aligned width, respects live decorated constraints and
  partial visibility, and commits only after exact current acknowledgement. A
  blocked, pending, nonexact, or stale operation changes no tiled state and
  never falls through to whole-column resizing.
- Contextual height decrease and increase resize only an active manually
  floating frame by the configured fraction of its assigned work-area height,
  excluding the gap. The result uses the assigned output's device-pixel ratio
  to align its constrained height, preserves width and top-left except for the
  minimal partial-visibility clamp, and changes no tiled state. Reset and
  preset-height actions remain tiled-only.
- KWin alone owns minimization. Driftile registers no minimize action or default shortcut, keeps a minimized tiled window in its exact logical slot, and preserves a minimized manually floating window's exact detached frame for restoration.
- An automatically layout-excluded window has no layout slot, manual-floating anchor, waiting entry, suspension, or retry state. Commands requiring layout ownership are no-ops; relation-free desktop transfer remains available.
- A configured application exclusion uses the same automatic-exclusion state,
  matches the exact case-sensitive `desktopFileName`, takes priority over an
  initial-width rule, and never writes the excluded window's frame. Removing
  the rule performs fresh admission rather than restoring a former slot or
  floating anchor.
- A managed window that becomes modal or transient leaves its layout without a geometry write or stale baseline restore. It may be admitted again after the role clears.
- Unrelated window order, widths, and viewport offsets remain stable.
- A changed context never restores an original frame captured under stale output geometry.
- Capacity eviction keeps windows reachable and preserves the active column when a writable alternative exists.
- Occupied or visible virtual desktops are never removed.
- Special and all-desktop windows are never tiled.
- Borderless mode covers tiled, floating, dialog, transient, and utility
  windows, changes only decoration state claimed by Driftile, and restores it
  when disabled or unloaded.
- A borderless exclusion matches only the exact, case-sensitive
  `desktopFileName`. There is no identity fallback, and a missing or empty ID is
  not excluded. A blank list therefore retains the prior global behavior.
- `BorderlessWindows=false` dominates every exclusion. Live list or identity
  changes acquire or restore only owned decoration state, issue no geometry
  writes, and do not change focus, layout state, or layout persistence. Global
  disable and unload remain ownership-safe.
- A live gap change reflows visible tiled contexts only. It preserves logical order, widths, height policies, focus, floating frames, excluded windows, and minimized frames; hidden contexts adopt it when shown.
- A default-width change leaves existing column width policies unchanged. Newly admitted columns, fresh cross-context retiles, and explicit reset use the new proportion subject to live window constraints. Retrying a waiting admission may add a column and update the affected viewport and frames; otherwise the policy change performs no frame writes.
- Application-width rules use one exact, case-sensitive `desktopFileName` entry
  per line and allow 10%–100%; more than 128 entries reject the complete
  setting. Only newly created or freshly admitted singleton columns consult the
  bounded lookup; existing columns keep their width, missing matches use the
  global default, and normal constraints may clamp the result.
- Initial-floating rules use the same bounded exact-ID policy and apply only at
  fresh admission. Existing or hydrated ownership wins; tiling exclusions and
  automatic floating roles take priority. Toggling the resulting ordinary
  manual-floating window into tiling uses its application initial width and the
  existing persistence schema.
- A column-width preset change performs no layout, frame, viewport, focus, or
  persistence write. Existing columns keep their concrete width; later preset
  actions use the replacement cycle and retain normal constraint clamping.
- Horizontal-focus centering runs inside the successful tiled focus transaction
  and uses the existing physical-pixel viewport calculation. The global flag
  and bounded exact application set are combined, and a stacked destination
  consults only the selected member. A failed center preview or unmatched
  target keeps the normal minimal reveal; changing either policy performs no
  layout or persistence write.
- A width-step change performs no layout, frame, viewport, or focus write. It affects only later explicit decrease and increase actions; reset, presets, full width, and available-width expansion remain independent.
- A height-step change performs no layout, frame, viewport, or focus write. It affects only later explicit decrease and increase actions; reset and height presets remain independent.
