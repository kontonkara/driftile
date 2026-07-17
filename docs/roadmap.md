# Roadmap

Versions 0.1.0, 1.0.0 through 1.9.0, 1.9.1, and 1.10.0 through 1.68.0 are
released. The delivered milestones and release criteria below are a historical
record. Later direction is not a committed release schedule.

Stable 1.68.0 keeps corrected moving-column centers synchronized and restores
same-context focus when KWin clears a provisional close handoff. Logical
persistence remains v4.

## Foundation (delivered)

- Build and package a declarative KWin script with a TypeScript runtime.
- Observe eligible windows without changing their state.
- Establish the initial layout model, tests, and development environment.

Exit criteria:

- Format, type, lint, unit, build, and package checks pass.
- The generated KPackage contains the QML bridge and runtime bundle.
- Enabling or disabling the script does not move windows.

## Walking skeleton (delivered)

This milestone connected one complete path through every layer.

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
- The runtime performs no periodic workspace or stacking-order rescans.

## Current baseline

The current runtime already:

- Settles output and work-area event bursts behind two matching delayed snapshots.
- Coalesces width-height rotation bursts and rapid unplug, relocation, and same-name replug sequences before applying geometry.
- Focus-reveals every real client after a virtual output is removed, then restores edge reachability and both viewport anchors after re-enabling it.
- Keeps singleton and grouped startup windows waiting when a settled work area cannot produce a valid tile, then retries after topology recovery without stopping the runtime.
- Keeps managed contexts unchanged and dirty when settled work-area geometry cannot produce valid frames, while healthy contexts continue reconciling.
- Observes output-list, geometry, scale, and dock invalidations.
- Checks visible client areas and non-minimized tracked-window hard constraints every two seconds to cover missing complete KWin signals.
- Maintains independent layout state for every `(output, desktop, activity)`
  context.
- Preserves a deterministic layout order across structural output changes.
- Invalidates stale restore baselines without reviving them when old geometry returns.
- Parks deterministic whole columns when a new multi-output capacity limit no longer fits, preferring non-active columns, then retries waiting windows.
- Focuses adjacent and edge columns, and reorders the active whole column left, right, first, or last with context-local shortcuts and transactional geometry rollback.
- Decreases, increases, or resets the active whole column width with grouped constraints and transactional rollback.
- Reuses width decrease/increase, preset forward/back, and reset to resize an
  eligible manually floating frame through the shared exact-acknowledgement
  transaction with zero tiled mutation.
- Cycles preset widths in both directions, adjusts width by 10%, toggles full width, expands into available space within shared constraints, and centers either the active column or all fully visible columns.
- Adjusts one tiled window's height by 10%, resets it to weighted automatic
  sizing, and cycles configured height presets with transactional stack reflow.
  A blank cycle keeps the exact `1/3`, `1/2`, and `2/3` proportions. The same
  decrease, increase, and preset actions operate contextually on an eligible
  manually floating frame.
- Focuses and reorders vertical stack members, contextually merges or extracts the active window, consumes or expels edge members, and inserts directly into the nearest stack across nonparticipating singleton columns.
- Inserts a visible active member past settled minimized passive peers in the participating source and target columns, including a fully minimized target stack, without changing passive order, height state, minimized state, or hidden frames. Other state blockers fail closed, and state round trips cancel with exact rollback.
- Toggles the active normal window between tiled and floating states with anchored reinsertion and safe geometry ownership.
- Switches focus between tiled and floating layers inside one output and desktop, remembers each layer, and navigates floating windows geometrically without changing frames.
- Leaves minimization to KWin, preserves exact logical tiled slots and manually floating frames across restoration, skips minimized focus candidates, and moves visible stack members across or out of settled minimized slots without frame writes.
- Consumes a visible immediate-right top member past settled minimized passive peers in either participating column without writing hidden frames.
- Expels a visible bottom member past settled minimized passive peers only after an exact focus handoff inside the surviving column is confirmed.
- Extracts a regular stack member into an immediate right singleton before native fullscreen, preserves settled minimized peers without frame writes, and keeps the window separate after leaving fullscreen.
- Extracts a regular stack member into an immediate right singleton before native maximize-to-edges, preserves settled minimized peers without frame writes, and keeps the window separate after unmaximize.
- Moves the whole active column between adjacent existing desktops with follow-focus, atomic two-context ownership, exact rollback, and no hidden-frame writes for settled minimized passive members. A secondary single-window transfer may extract the visible active member while settled minimized peers in the same source column keep their logical slots, height state, minimized state, and frames without desktop or geometry writes.
- Focuses desktops 1 through 9 directly and moves the whole active column there, clamping out-of-range targets to the shared empty tail.
- Reorders the currently selected desktop one position when the KWin scripting backend supports it, without wrapping or changing desktop IDs, output selections, window memberships, or the pinned empty tail.
- Moves one relation-free floating window between adjacent or numbered desktops without changing its frame or either tiled layout.
- Moves the whole active column to an adjacent output with deterministic spatial routing, atomic visible-context reflow, and no layout geometry writes for settled minimized passive members. A secondary single-window transfer uses the same retained-source policy without output, desktop, or geometry writes to settled minimized peers.
- Keeps default whole-column and secondary single-window transfer paths fail-closed when a minimized window is outside the active member's source column or is already in the target context.
- Optionally removes application-window decorations independently of layout
  ownership while preserving pre-existing borderless state, reasserting owned
  policy, and restoring owned state on disable. Up to 128 exact
  application-ID exclusions keep matching applications under KWin's existing
  decoration policy.
- Applies a global fractional 0–64 logical-pixel tiled-window gap live without
  mutating layout order, sizing policies, focus, floating frames, or minimized
  frames.
- Configures a 10%–100% default-width fallback and an optional fixed
  `1px`–`16384px` logical width for newly admitted columns, fresh cross-context
  retiles, and contextual reset without changing existing widths.
- Optionally derives a newly admitted singleton member's fixed logical width
  from its live frame when no exact application-width rule matches. The policy defaults
  off, remains constrained and pixel-snapped, and never rewrites existing
  columns.
- Configures up to 128 exact application-ID proportional or fixed
  logical-pixel initial singleton widths, with a constant-time admission
  lookup, global-default fallback, live constraints, and output-pixel snapping.
  Existing columns remain unchanged.
- Excludes up to 128 exact, case-sensitive application IDs from layout
  ownership, with live release and fresh readmission when the policy changes.
- Configures up to 16 mixed proportional or fixed logical-pixel column-width
  presets for later tiled or manual-floating actions without changing existing
  widths; a blank configuration retains the built-in exact thirds.
- Configures up to 16 mixed proportional or fixed logical-pixel window-height
  presets for later explicit tiled or eligible manual-floating actions without
  changing layouts, frames, viewports, focus, persistence, or the semantic
  selection of an existing tiled preset. A blank configuration retains the
  exact `1/3`, `1/2`, and `2/3` proportions.
- Optionally centers successful horizontal tiled focus navigation without
  changing vertical, floating, layer, or direct application focus.
- Configures a 1–50 percentage-point explicit column-width step without reflowing existing layouts.
- Configures a 1–50 percentage-point explicit window-height step without reflowing existing layouts.
- Treats exposed client minimum and maximum sizes as hard bounds, detects silent changes on visible tracked windows, does not model unexposed X11 increment and aspect hints, and leaves backend enforcement to KWin.
- Runs a deterministic 128-cycle add, focus, minimize, restore, and remove regression with synchronous geometry acknowledgements and bounded scheduler settlement.
- Keeps one shared trailing desktop empty and removes only redundant tails created by the current run.
- Registers compact default shortcuts with `H/J/K/L`, arrow, Home/End, and Page
  Up/Down aliases. Fresh records use `Meta+R` and `Meta+Shift+R` for forward
  and reverse width presets, plus `Meta+Ctrl+Shift+R` for forward height
  presets. Reverse height remains unbound; existing action IDs and KGlobalAccel
  assignments remain unchanged.
- Provides a reversible shortcut helper for the bundled defaults and explicit
  JSON v1 profiles.
- Provides an optional native Qt/KDE shortcut editor for active registered
  actions. Edits remain pending until one conflict-checked, rollback-capable
  Apply transaction; the main package remains unchanged.
- Lets Home Manager write typed settings or generate a portable
  shortcut profile without installing a second KWin package; shortcut claiming
  remains explicit.
- Leaves dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership, separate from manual floating.
- Translates client minimum and maximum sizes to decorated frame bounds for layout validation and column resizing.
- Projects fullscreen, full-maximize, and tracked-floating state into the
  optional Overview as one bounded static badge on a sufficiently large
  selected ordinary thumbnail, while every true state remains available to
  all-term search.
- Reinserts an active tiled window before or after a visible same-context target
  or empty horizontal gutter on mouse release. After a completed KWin-owned
  output or desktop move, resolves one exact destination window first and then
  one empty gutter. The exact path retains destination width; the gutter path
  creates a source-width singleton with automatic height and current initial
  presentation. An unavailable target falls back to ordinary singleton
  admission.
- Gates startup scale, ownership classification, lifecycle settlement, multi-context batching, and automatic-height allocation with deterministic operation-count budgets.

The automatic-floating base and the script-visible hard-constraint policy are
part of the current baseline. More toolkit coverage, a future KWin oracle for
strict X11 geometry hints, physical connector hot-plug, and a wider hardware
matrix remain deferred.

## 0.1.0 (released)

Version 0.1.0 shipped the frozen keyboard-driven workflow and five layout
settings. Later work does not change that published release scope.

Release criteria:

- Commands affect only their target context.
- Default transfer shortcuts preserve every member and the width of the active column.
- Opening, closing, moving, and resizing windows preserves unrelated layout state.
- Fullscreen and maximized windows retain their extracted singleton position.
- Structural commands involving minimized members have tested behavior or an explicit fail-closed policy.
- Virtual output disable and re-enable recovery leaves every window reachable.
- Dynamic workspace changes never remove an occupied or visible desktop.
- A sustained lifecycle test produces no exceptions or geometry feedback loop.

These criteria have direct automated coverage in the 0.1.0 source. See the
[0.1.0 release notes](release-notes-0.1.0.md) for shipped artifacts,
compatibility, and known limits.

## 1.0.0 (released)

Version 1.0.0 delivered persistence and recovery hardening, supported pointer
insertion, and release lifecycle validation without adding new navigation or
presentation modes. It extends the published 0.1.0 scope.

Persistence foundation complete: core has a strict logical-state codec, a bounded four-entry v2 topology catalog, fail-closed window and output matching, side-effect-free canonical runtime capture, and all-or-nothing hydration. Stable changed snapshots reach the debounced opaque `QtCore.Settings` store; bare v1 state migrates without changing the storage key. Runtime startup reselects a complete settled topology, applies exact reload state or a complete strong-descriptor cross-session match atomically, waits boundedly for late windows behind a no-admission barrier, and requires a quiet candidate before commit. An additive known-output return restores an exact tiled layout per output without repatriating windows or rebuilding unchanged contexts; unsafe plans use normal topology recovery. Replaced window objects receive fresh restore baselines. Isolated Wayland and X11 sessions verify idempotent script reloads.

The current pointer baseline covers same-context reinsertion, cross-output
adoption, and same-output cross-desktop adoption for one active normal tiled
window and one exact visible tiled target. A focused two-head VM verifies the
KWin-owned cross-output path, while the full VM verifies same-output
cross-desktop adoption with native Wayland and XWayland applications. Packaged
native X11 covers the global-desktop fallback.

Compatibility, migration, and troubleshooting guidance is published. A
separate visible lifecycle VM verifies a clean published 0.1.0 install and
load, upgrade into the 1.0 release line, real Konsole and KDE Calculator
lifecycles, disable, removal, and post-removal KWin usability.

Recovery validation is complete for reload, session restoration, late windows,
and known-output return. Version `1.0.0-rc.1` validated the final runtime before
stable promotion without behavior changes.

Release criteria (met):

- Reload and session restoration converge without scrambling visible layouts.
- Reconnecting a known output restores its contexts without disturbing active outputs.
- Supported pointer operations and equivalent keyboard actions converge on the
  same layout model.
- Performance budgets pass on the documented reference scenario.
- Installation, upgrade, disable, and uninstall paths leave Plasma usable.

## 1.1.0 (released)

Version 1.1.0 adds application-specific initial column widths, a
configurable column-width preset cycle, and optional horizontal focus centering.
Each 10%–100% rule occupies one line and matches the exact KWin
`desktopFileName`; at most 128 rules are accepted. Newly created and fresh
singleton columns use an O(1) lookup, fall back to the global default when no
rule matches, and remain subject to live window constraints. Existing columns
are never resized by a rule change.

A preset profile contains at most 16 strictly increasing integer percentages
from 10 to 100. Reconfiguration preserves every existing width, frame,
viewport, focus target, and persisted layout; later preset actions use the new
cycle. A blank profile retains the built-in exact thirds.

Centering is disabled by default. When enabled, successful left, right, first,
and last tiled focus actions center the destination with the same viewport
policy as the explicit center action, in the same transaction. Unsafe center
previews retain minimal reveal; other focus paths and live setting changes do
not move the layout.

Global wheel input remains deferred because KWin 6.7 has no public script axis
API. This milestone does not add a private input path.

Version `1.1.0-rc.1` validated the final runtime before stable promotion
without behavior changes.

Release criteria (met):

- All eight settings validate and apply atomically through KConfig and Home
  Manager with backward-compatible defaults.
- Application-width and preset changes preserve existing layouts until a
  later admission or explicit preset action.
- Focus centering remains disabled by default and falls back safely to minimal
  reveal when a centered transaction cannot be prepared.
- Wayland, XWayland, single-output X11, packaging, Nix, and visible VM release
  checks pass for the release.

## 1.2.0 (released)

Version 1.2.0 adds the bounded application tiling-exclusion slice. Up to 128
case-sensitive KWin `desktopFileName` values may be configured through KConfig
or Home Manager. Matching windows use the existing automatic-exclusion
ownership path, including live release and fresh readmission, without a new
layout state or persistence format.

Version `1.2.0-rc.1` validated the final runtime before stable promotion
without behavior changes.

Release criteria (met):

- All nine settings validate and apply atomically with a blank exclusion list
  preserving 1.1 behavior.
- Startup and live policy changes never write an excluded window's frame and
  reflow only affected tiled contexts.
- Removing a rule waits for KWin-owned native-state blockers, then performs
  fresh singleton admission without restoring an old slot or floating anchor.
- Unit, Home Manager, and NixOS module checks cover the policy. Packaged
  integration covers Wayland, XWayland, and native X11, and the visible
  real-application checkpoint exercises live policy changes.

## 1.3.0 (released)

The bounded 1.3.0 release adds a separate read-only overview companion. It
projects the authoritative persisted layout into desktop, column, stack,
viewport, and floating-window views without adding layout ownership or changing
the main KWin script package.

Version `1.3.0-rc.1` validated the final packages before stable promotion
without behavior changes.

Release criteria (met):

- The effect is separately installable, disabled by default, and has no default
  shortcut or screen edge.
- NixOS and Home Manager expose the separate effect only through an explicit
  opt-in.
- Only an unchanged current v2 snapshot with exact live output, desktop, and
  window references can open.
- Projection is linear in the persisted model, immutable, and strips restore
  baselines and matching fingerprints.
- The effect uses public KWin QML types and performs no settings, focus,
  desktop, window, or geometry writes.
- Removing it leaves the main extension and Plasma's built-in Overview
  unchanged.

## 1.4.0 (released)

The bounded 1.4.0 release adds optional five-finger horizontal touchpad
column focus through KWin's public `SwipeGestureHandler` API. One boolean
setting controls the complete feature and remains disabled by default. A
completed left swipe focuses the next column to the right; a completed right
swipe focuses the previous column to the left.

Version `1.4.0-rc.1` validated the final packages before stable promotion
without behavior changes.

This release adds no vertical or configurable-finger gestures, shortcut
actions, default bindings, progress-driven behavior, animation, overview
interaction, or persistence-format changes. It targets native Wayland.
Enabling it in a native X11 session is a safe no-op.

Release criteria (met):

- The default configuration creates no touchpad gesture handlers and preserves
  all 1.3.0 behavior.
- Enabling the setting creates exactly two five-finger touchpad swipe handlers;
  each completed direction calls its existing column-focus command exactly
  once.
- Partial and cancelled gestures perform no command, focus, viewport, window,
  overview, or persistence write.
- Live enable, disable, and re-enable replace gesture registrations without a
  KWin restart or duplicate activation.
- No shortcut action, default binding, overview package file, layout model, or
  persistence schema changes.
- Focused unit and packaged checks cover configuration, handler lifecycle, and
  direction mapping. Packaged native Wayland confirms handler construction;
  native X11 confirms the no-op contract.

## 1.5.0 (released)

The bounded 1.5.0 release extends finish-only pointer adoption to a window that
KWin moves between virtual desktops on the same output. Once the move settles
on a visible destination desktop, releasing over exactly one eligible tiled
target inserts the window before or after it by vertical midpoint. Empty,
ambiguous, stale, blocked, or raced targets retain KWin's completed move and
use normal singleton admission.

Version `1.5.0-rc.1` validated the final packages before stable promotion
without behavior changes.

Driftile does not initiate desktop switching or membership changes. The
release adds no visual feedback, settings, shortcut actions, bindings,
gestures, persistence-format changes, overview interaction, or compositor
ownership. The hidden source desktop receives no geometry writes.

Release criteria (met):

- Membership-before-finish and finish-before-membership event orders produce
  the same exact transfer, including the native X11 global-desktop fallback.
- A successful insertion preserves the destination column width, assigns
  automatic height, retains focus, and publishes once without desktop or
  output mechanism calls.
- Unavailable or invalidated targets fall back to singleton admission without
  reversing the KWin-owned move.
- Partial destination writes compensate exactly before fallback; the hidden
  source and unrelated contexts receive no writes.
- Settlement uses bounded probes and `O(S + T)` transient work for source and
  target contexts only, with no workspace-wide scan or persistent growth.
- Focused unit and packaged coverage exercise native Wayland, XWayland, and
  single-output native X11; backend-specific geometry rejection falls back
  safely.

## 1.6.0 (released)

The bounded 1.6.0 release adopts only a completed horizontal pointer resize
of the active normal tiled window. KWin remains the interactive-resize owner.
After a width-only left- or right-edge finish in the same settled, visible,
unchanged output and desktop, Driftile stores KWin's accepted width as the
active column's existing fixed-width policy and reflows that context.

Version `1.6.0-rc.1` validated the final packages before stable promotion
without behavior changes.

Every active-column member must remain visible, writable, unsuspended, and
unchanged. Corner or vertical resizing, an ambiguous edge, any participant,
state, context, topology, or constraint race, and any rejected write cancel the
adoption. After release, every writable same-context target is staged while the
prior logical layout remains unchanged. Two exact target samples are required
before commit, target mismatches time out after 20 delayed probes, and competing
layout mutations stay blocked throughout settlement. Rejection supersedes
attempted target requests with captured rollback frames and releases after 20
exact samples. An unconfirmed rollback falls back to deferred recovery after 40
probes; lost native-state geometry authority receives no competing write.

The release adds no setting, action, binding, visual feedback,
persistence-schema field, or compositor ownership. It performs no geometry
write while KWin owns the resize and no workspace-wide scan.

Release criteria (met):

- Observer and runtime paths distinguish exact left- and right-edge width-only
  finishes from moves, corners, vertical resizes, and ambiguous geometry.
- A successful adoption changes only the active fixed column width, preserves
  order, heights, focus, and unrelated contexts, and publishes once.
- Every invalidation retains or restores the prior policy and frames through
  bounded target settlement, late-configure rollback, or deferred recovery.
- Planning and validation use `O(V)` work in the visible context, with no
  persistent growth or workspace scan.
- Focused tests cover the observer, pure planner, and runtime behavior. Packaged
  native Wayland, XWayland, and single-output native X11 gesture scenarios
  exercise the same finish-only adoption and reset path. Runtime coverage also
  includes delayed configure delivery, all same-context targets, late forward
  configure after rollback begins, focus replay, the mutation barrier,
  native-state lease protection, and one publication.

The visible full VM checkpoint passed on 2026-07-13 with native Wayland Firefox
and XWayland xterm. A physical `Meta` plus right-button resize proved KWin's
held interactive state before release, adopted the accepted XWayland width, and
restored the exact stacked frames on reset.

## 1.7.0 (released)

The bounded 1.7.0 release adds only current-context click-to-focus to the
optional overview. Each rendered thumbnail in a `SceneView` current-desktop
card keeps its direct `model.window` object. A left click revalidates that the
effect is active and the candidate still exists, is not deleted, hidden, or
minimized, wants input, has the exact `internalId`, remains on the same output,
belongs to that output's current desktop, and matches the current activity
through its live memberships. A valid click assigns public
`Workspace.activeWindow` only when needed and closes the effect only after KWin
confirms that window active. An invalid, stale, or rejected focus request fails
closed and leaves the effect active.

Ordinary KWin activation may raise the window, and existing Driftile focus
handling may reveal its tiled column. The effect's focus path writes only
`Workspace.activeWindow`. It does not switch desktops or activities; move
windows; write memberships, outputs, geometry, or settings; or add actions,
default bindings, gestures, drag, keyboard navigation, schema, IPC, private
APIs, timers, or workspace scans. The direct validation path is bounded by the
candidate's desktop and activity memberships.

Version `1.7.0-rc.1` validated the final packages before stable promotion
without behavior changes.

Release criteria (met):

- Static QML contract tests pin the direct window reference, every live guard,
  accepted-focus confirmation, the fail-closed path, and the sole permitted
  public focus write.
- One packaged multi-output, compositor-routed physical left-click scenario
  covers native Wayland and XWayland protocol passes and preserves exact
  frames, memberships, selected desktops, settings, and built-in Overview
  state around the intentional focus change.

## 1.8.0 (released)

The bounded 1.8.0 release adds only desktop selection to the optional overview.
A left click on the number gutter of a non-current desktop card requests that
desktop for the `SceneView` output. The current-desktop gutter remains inert.

On Wayland, the effect writes public `SceneView.currentDesktop`, preserving
KWin's per-output or global desktop semantics. When that property is
unavailable, the effect may write global `Workspace.currentDesktop` only in a
single-output session. Before either write, it revalidates the active effect,
the exact live output, the desktop's direct object and ID, and that the desktop
is still non-current. It closes only after an exact post-write read confirms
the selected desktop. Every stale, invalid, raced, or rejected request fails
closed and leaves the effect active.

The slice adds no actions, default bindings, settings, schema, drag or
rearrangement behavior, private APIs, timers, or window, stacking-order, or
layout scans. Selection performs `O(D + O)` validation for live desktops and
outputs, where KWin bounds `D` at 25, and retains no persistent work.

Version `1.8.0-rc.1` validated the final packages before stable promotion
without behavior outside the boundary above.

Release criteria (met):

- Static QML contract coverage pins the non-current number-gutter click target,
  exact live guards, public Wayland write, guarded single-output fallback,
  post-write confirmation, and fail-closed behavior.
- The existing packaged multi-output physical-click scenario covers per-output
  Wayland selection with native Wayland and XWayland applications while
  preserving the other output, window frames and memberships, settings, layout
  projection, and Plasma's built-in Overview.
- Native X11 coverage pins the global fallback statically and retains the
  existing packaged single-output global-desktop checks. The current X11
  harness does not claim end-to-end overview-effect click activation.
- These checks extend the existing static, multi-output, and X11 fallback test
  pool without adding a new scenario family.

## 1.9.0 (released)

The bounded 1.9.0 release extends only thumbnail activation in the optional
overview. A left click on a valid thumbnail in the current desktop card retains
the existing direct-focus behavior. A click in a non-current card first
requests that card's desktop through the existing public desktop-selection
path, then focuses the exact clicked window. Wayland uses the per-output
`SceneView` property; the guarded global fallback remains limited to a
single-output session. Confirmed focus closes the effect.

Before changing the desktop, the effect validates the active effect and model,
exact live screen and projected output, direct desktop object and ID, and the
clicked window's identity, output, desktop and activity memberships, input
eligibility, deletion, and minimization state. It does not reject the expected
off-desktop hidden state. After confirmed desktop selection, it repeats the
effect, model, screen, desktop, activity, and window validation, now including
hidden state, before requesting focus. A rejected desktop request performs no
focus write and leaves the effect open. Any failure after confirmed selection
keeps the selected desktop, closes the potentially stale effect, and performs
no compensating rollback against compositor state that may already have
changed.

The slice adds no action, default binding, setting, schema, drag or
rearrangement behavior, geometry or membership write, private API, timer, or
window, stacking-order, or layout scan. A non-current click performs
`O(S + O + D + M)` validation across live screens, projected outputs, desktops,
and the candidate's observed desktop and activity membership entries `M`,
retains no work, and issues at most one desktop write, one active-window write,
and one deactivation.

Version `1.9.0-rc.1` validated the final packages before stable promotion
without behavior changes.

Release criteria (met):

- Static QML contract coverage pins the shared thumbnail click path, a
  current-card path that bypasses only desktop selection, ordered pre-write and
  post-selection guards, public desktop and focus writes, exact confirmations,
  and every fail-closed path.
- The existing packaged multi-output physical-click scenario uses distinct
  target and last-active windows on desktop 2. Its number-gutter click must
  restore the last-active window, while its thumbnail click must focus only the
  exact target in native Wayland and XWayland passes.
- The physical scenario preserves the other output, window frames and
  memberships, settings, layout projection, desktop sequence, and Plasma's
  built-in Overview, then restores its byte-identical baseline.
- Native X11 retains static coverage of the guarded single-output fallback; the
  current harness does not claim end-to-end overview-effect click activation.
- These checks extend the existing static and multi-output test pool without a
  new scenario family, binding, or client type.

## 1.9.1 (released)

The bounded 1.9.1 release corrects full-width column positioning and exact
toggle restoration without adding actions, bindings, settings, gestures, or
overview behavior. Its optional persisted restore viewport retains exact
toggle-back behavior across reloads while accepting older documents that omit
it. Version 1.9.0 rejects documents containing the additive field atomically,
so a downgrade starts safely without restoring the newer toggle metadata.

Version `1.9.1-rc.1` validated the patch before stable promotion without
runtime or persistence behavior changes.

Release criteria (met):

- A full-width active column retains equal configured outer gaps and moves
  adjacent columns entirely outside the viewport.
- Toggling back restores the prior width and viewport exactly, including after
  extension reload, while failed geometry writes keep the maximized state.
- Persistence accepts 1.9.0 documents without a restore viewport and fails
  closed on downgrade instead of partially applying newer metadata.
- Existing unit, packaged Wayland and X11 integration, hidden full-VM, package,
  and Nix module checks remain green.

## 1.10.0 (released)

Version `1.10.0` delivers a bounded slice adding exact per-application
exclusions to optional borderless presentation. `ApplicationBorderlessExclusions`
is an empty-default KConfig `String` with one exact, case-sensitive KWin
`desktopFileName` per line; Home Manager exposes
`programs.driftile.settings.applicationBorderlessExclusions` as a list and
writes canonical sorted entries.

The shared deterministic decoder accepts at most 128 unique nonblank entries,
255 UTF-8 bytes per trimmed ID, 512 raw characters per line, and 65,664
characters per document. Blank lines are ignored. Duplicates, control
characters, invalid UTF-16, and oversized input reject the complete eleven-field
snapshot. Valid entries are stored in sorted canonical form with `O(1)`
membership checks. Matching has no identity fallback; a missing or empty
`desktopFileName` is not excluded.

When `BorderlessWindows` is false, the global setting dominates and Driftile
does not apply borderless policy. Live application-identity and settings
reconciliation issues no geometry writes and preserves focus while acquiring,
reasserting, or releasing only decoration state owned by Driftile. It does not
change layout state or layout persistence. The behavior covers otherwise
eligible tiled, floating, dialog, transient, and utility windows on native
Wayland, XWayland, and native X11.

This slice adds no action, binding, persistence-format, or overview change.
KWin's shared outline has no ownership mechanism, so it cannot safely provide
a production drag preview; that presentation work remains deferred.

Version `1.10.0-rc.1` validated the final behavior before stable promotion;
1.10.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- A blank exclusion list preserves the current borderless behavior.
- Exact matches retain their existing decoration state while non-matches obey
  the enabled global policy; disabling that policy or unloading restores only
  owned state.
- Identity and settings changes reconcile live without geometry writes, focus
  changes, or layout-state or layout-persistence changes and without taking
  ownership of pre-existing borderless state.
- Parser, runtime, Home Manager, Wayland, XWayland, and native X11 checks pass.

## 1.11.0 (released)

Version `1.11.0` delivers a bounded slice that reuses the existing column-left,
column-right, window-up, and window-down actions to move the active manually
floating window by 50 logical pixels. The target is constrained only enough to
keep a size-dependent 10–75 pixel strip visible on each axis; dimensions below
10 pixels remain fully visible. Each successful command preserves the frame
size, focus, output, desktop, floating anchor, and every tiled layout.
An inexact result is rejected without updating floating metadata. A still-owned
constrained or delayed result receives an ordered request to restore the
original frame; native-state, ownership, context changes, or an unacknowledged
request stop further writes and leave geometry with KWin. Tiled state is never
committed by this path.

Automatic-floating and layout-excluded windows remain outside Driftile's
geometry ownership and receive no frame writes. This slice adds no actions,
bindings, settings, or configuration schema, does not change persistence or
overview behavior, and preserves directional move behavior for tiled windows.

Version `1.11.0-rc.1` validated the final behavior before stable promotion;
1.11.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- The four existing directional move paths translate only an active manually
  floating frame by 50 logical pixels before enforcing its partial-visibility
  bounds, without resizing it.
- Blocked or stale preflight operations perform no write. A still-owned
  constrained or delayed result requests original-frame compensation, while
  every failure preserves all tiled layout state and floating metadata.
- Unit and packaged integration checks cover the bounded behavior on supported
  window-system paths without expanding the application matrix.

## 1.12.0 (released)

Version `1.12.0` delivers a bounded slice that reuses the existing center-column
action and `Meta+C` default to center an active manually floating frame in its
assigned output and desktop work area. Each non-oversized dimension uses the
exact logical midpoint; an oversized dimension starts at the work-area origin.
Fractional logical targets are not rounded. A non-floating target keeps the
existing tiled behavior.

The command shares the guarded single-window frame transaction used by
directional floating movement. It accepts only the exact target, commits
floating metadata only after acknowledgement, and requests compensation only
while ownership, context, and topology remain current. An already centered or
blocked manual-floating target performs no write and never falls through to
tiled centering. Automatic exclusions and native-state windows remain under
KWin geometry ownership.

This slice adds no action, binding, setting, configuration schema, persistence,
helper, or overview behavior and does not expand the application matrix.

Version `1.12.0-rc.1` validated the final behavior before stable promotion;
1.12.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- Ordinary and nonzero-origin work areas, fractional targets, and oversized
  frame dimensions produce the exact per-axis target without resizing or
  changing focus, context, anchor, or tiled state.
- Preflight and already-centered no-ops perform zero writes; an inexact result
  performs at most one forward and one guarded compensation write without a
  metadata commit.
- Unit, packaged Wayland, XWayland, native X11, and hidden full-VM checks reuse
  existing windows and applications.

## 1.13.0 (released)

Version `1.13.0` delivers one bounded runtime slice: the existing width decrease
and increase actions resize an active manually floating frame, while tiled
targets keep the existing whole-column behavior. Other width actions remain
tiled-only. A blocked or pending floating target never falls through to tiled
resizing.

The target is
`originalWidth + direction * columnWidthStep * workArea.width`, snapped to the
physical-pixel grid and clamped to live decorated minimum and maximum widths, a
positive client width, and the established partial-visibility bounds. The
calculation uses constant per-target math and performs no managed-window,
column, or layout scan.

The per-window geometry signal is connected before one forward frame request.
An exact synchronous X11 or XWayland result settles immediately; an unchanged
native Wayland frame remains pending until the exact target is observed by a
geometry signal or delayed sample. Twenty unchanged delayed samples expire an
unacknowledged request. Floating metadata commits only for the exact current
target under unchanged ownership, context, topology, constraints, and
decorations. Nonexact and stale results are rejected without compensation
because the public KWin API exposes no configure serial. Pending width,
movement, and centering commands are serialized for that window, and
acceptance, rejection, expiry, removal, and shutdown release the pending signal
and ownership.

This slice changes no tiled model, tiled frame, viewport, focus, reinsertion
anchor, setting, action, binding, configuration schema, persistence, helper,
overview, or application matrix.

Version `1.13.0-rc.1` validated the final behavior before stable promotion;
1.13.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- Unit coverage proves the configured work-area math, decorated live bounds,
  positive client width, physical-pixel snapping, partial visibility, immediate
  and delayed exact settlement, bounded unchanged-request expiry, pending
  serialization and cleanup, exact-only metadata commits, nonexact and stale
  rejection, one forward write, no compensation, and zero tiled mutation.
- Packaged native Wayland, XWayland, and native X11 checks reuse the existing
  applications and prove exact width round trips without changing focus,
  context, or tiled state.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, exact-SHA CI, and release gates pass
  without widening this slice.

## 1.14.0 (released)

Version `1.14.0` delivers one bounded runtime slice: the existing window-height
decrease and increase actions resize an active manually floating frame, while a
tiled target keeps the existing stack-reflow behavior. Reset and preset-height
actions remain tiled-only. A blocked or pending floating target never falls
through to a tiled mutation.

The floating target is
`originalHeight + direction * windowHeightStep * workArea.height`; the gap is
excluded. It snaps to the physical-pixel grid using the assigned output's
device-pixel ratio, then clamps to live decorated minimum and maximum heights
plus a positive client height. Width and top-left remain unchanged unless the
established partial-visibility bounds require a minimal origin clamp.

Height shares the bounded per-window size transaction introduced for contextual
width. The signal is connected before at most one forward frame write, exact
synchronous or delayed acknowledgement alone commits floating metadata, and 20
unchanged delayed samples expire the request. Nonexact and stale results receive
no compensation. Pending size, movement, and centering commands are serialized
for that window.

This slice changes no tiled height semantics, reset or preset behavior, action,
binding, setting, configuration or persistence schema, helper, overview,
application policy, focus, context, reinsertion anchor, or unrelated layout.

Version `1.14.0-rc.1` validated the final behavior before stable promotion;
1.14.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- Unit coverage proves the configured gap-free work-area height step, decorated
  live bounds, positive client height, device-pixel-ratio snapping, preserved
  width, minimally clamped origin, partial visibility, exact settlement,
  bounded expiry, pending serialization, no compensation, and zero tiled
  mutation.
- Packaged native Wayland, XWayland, and native X11 checks reuse the existing
  applications and prove an exact floating-height round trip without changing
  focus, context, or tiled state. The hidden full VM reuses its real
  manual-floating application and physical shortcuts.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, exact-SHA CI, and release gates pass
  without widening this slice.

## 1.15.0 (released)

Version `1.15.0` delivers one bounded geometry slice: the active full-width
frame remains inside equal configured outer gaps. Adjacent frames stay at least
one physically aligned configured gap beyond the corresponding viewport edge;
a zero gap adds no clearance. It changes no state, configuration schema,
action, or binding.

Version `1.15.0-rc.1` validated the final behavior before stable promotion;
1.15.0 has no runtime or configuration changes from that candidate.

Release criteria (met):

- Unit coverage proves equal outer gaps, aligned neighbor clearance across
  fractional device-pixel ratios, zero-gap behavior, exact restoration, and
  transaction rollback without state, schema, or binding changes.
- Packaged native Wayland, XWayland, and native X11 checks reuse the existing
  scenario and prove exact neighbor coordinates and restoration. The hidden
  full VM reuses its real Konsole windows, existing action, and checkpoint.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, exact-SHA CI, and release gates pass
  without widening this slice.

## 1.15.1 (released)

Version `1.15.1` fixes viewport-edge handling when focus reveals a newly opened
column beside an inactive full-width column. Edge reveals retain the configured
outer gap for the assigned work area and device-pixel ratio, while an inactive
full-width frame is parked wholly beyond the opposite edge. It changes no
state, configuration schema, action, or binding.

Release criteria (met):

- Focused geometry coverage proves dynamic outer-gap preservation and complete
  inactive full-width parking across work-area sizes and fractional scale.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  full and lifecycle VMs, version, exact-SHA CI, and release gates pass without
  widening this patch.

## 1.16.0 (released)

Version `1.16.0` delivers three bounded changes:

- Same-context pointer drops preview the exact valid target half through KWin's
  public outline API. Updates are coalesced and write no layout or persistence
  state. Cross-context feedback remains finish-only.
- Exact application rules start only newly tracked matching normal windows as
  manually floating. Existing or restored ownership wins, and the persistence
  schema is unchanged.
- Toggling full-width mode off restores only the prior column width. The current
  viewport and horizontal anchor remain in place, and existing persisted layout
  documents stay compatible.

Release criteria (met):

- Focused tests cover all three behaviors; packaged Wayland, XWayland, and
  native X11 cover transport.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, exact-SHA CI, and release gates pass
  without widening the slice.

## 1.17.0 (released)

Version `1.17.0` delivers one behavior-preserving UI change: the existing
twelve-setting generic KWin configuration page is grouped into two tabs.
General contains the existing eight global and layout controls; Applications
contains the existing four application policy controls. Every KConfig key,
twelve-setting snapshot rule, and live runtime behavior remains unchanged. The
release adds no setting, action, binding, persistence field, overview
behavior, or helper behavior.

The 1.17.0-rc.1 candidate froze this exact scope; stable 1.17.0 adds no further
behavior or data change.

Release criteria (met):

- One structural test verifies both tab labels, the eight/four control split,
  and the unchanged twelve-key set.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI pass on the unchanged
  release commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

No other feature belongs to 1.17.0. Further application policies remain
post-v1 work.

## 1.18.0 (released)

Version `1.18.0` delivers one application-specific horizontal focus policy.
An empty `ApplicationFocusCentering` list preserves 1.17.0 behavior. Each
exact, case-sensitive KWin `desktopFileName` match centers the destination
selected by a successful left, right, first, or last tiled-focus action. The
existing global option still centers every destination, and the two policies
are combined.

A stacked destination checks only its selected member. Unmatched targets and
failed center previews retain the normal minimal reveal. Replacing the bounded
set performs no immediate layout, viewport, focus, geometry, or persistence
write. The release adds no action, binding, layout-state field, overview
behavior, helper behavior, or compositor mechanism.

The 1.18.0-rc.1 candidate froze this exact scope; stable 1.18.0 adds no further
behavior or data change.

Release criteria (met):

- Existing behavior coverage verifies selected-member matching, unmatched
  minimal reveal, global fallback, and write-free reconfiguration.
- Existing settings, KConfig, KCM, Home Manager, and package checks expand from
  twelve to thirteen fields without a parallel test suite.
- Format, type, lint, unit, deterministic build and package, all-system flake,
  hidden full and lifecycle VMs, version, and exact-SHA CI pass on the unchanged
  release commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

No other feature belongs to 1.18.0.

## 1.19.0 (released)

Version `1.19.0` delivers one column presentation mode. `Meta+W` toggles the
active tiled column between stacked and tabbed presentation. Every
non-minimized tabbed member receives the same frame with the existing width and
normal outer gaps. The selected member owns focus and stacking intent.

The existing vertical grammar remains authoritative: focus down or up selects
the next or previous member without wrapping, and move down or up reorders the
selected member. Height commands are no-ops while tabbed and preserve dormant
height policies for restoration. An existing target column keeps its mode when
a member enters; a split or extraction creates a stacked singleton. A whole
column transfer preserves its mode and selection. A departing selection chooses
its successor, then its predecessor at the end.

Canonical logical state advances from v1 to v3 for presentation and selection.
Bare and nested v1 state migrate on publication, while the bounded topology
catalog remains v2. The optional overview projects only the selected tabbed
member's thumbnail.

The release adds no persistent tab strip or indicator, pointer tab navigation,
animation, setting, settings UI, private API, or compositor-owned surface.

The 1.19.0-rc.1 candidate froze this layout and persistence scope. Stable
1.19.0 adds one action and default binding: `Meta+Q` delegates closing the
active window to KWin. `Meta+C` remains the contextual centering action. The
addition changes no layout, configuration, persistence, or overview behavior.

Release criteria (met):

- Focused model and geometry tests cover toggling, selection, reorder, normal
  outer gaps, dormant heights, target-wins merges, stacked splits, transfers,
  and successor/predecessor fallback.
- Persistence tests cover v1-to-v3 migration inside the unchanged v2 catalog;
  overview tests require one selected thumbnail per tabbed column.
- The shortcut transaction covers the `Meta+W` and `Meta+Q` claims and restores
  their unchanged prior assignments on release.
- Small and large column fixtures enforce constant-time selection and
  column-local structural work. No unrelated application or VM pool is added.
- Standard quality, package, Nix, backend integration, hidden full and
  lifecycle VMs, version, and exact-SHA CI pass on the final stable release
  commit.
- The release workflow publishes assets only after all prerequisite jobs and
  release gates pass.

No other feature belongs to 1.19.0.

## 1.20.0 (released)

Version `1.20.0` completes one bounded tab-workflow slice. The optional
overview keeps one selected thumbnail, exposes every non-minimized live tabbed
member in a compact ordered strip, retains disabled tabs for minimized members,
and offers `Meta+O` for a fresh shortcut record when enabled while preserving
existing assignments. Selection reuses
the existing guarded public KWin focus path and fails closed for stale,
deleted, minimized, hidden, or non-input windows.

`DefaultColumnPresentation` selects `stacked` or `tabbed` for unmatched fresh
columns. `ApplicationColumnPresentations` overrides it by exact
`desktopFileName`. A tabbed singleton is now valid durable state, so later
insertion immediately uses the requested presentation. Splits, expels, fresh
single-window transfers, and initially floating reinsertion read the moved
application's current policy; existing target columns still win merges.
Existing and restored columns are unchanged by live reconfiguration.

Confirmed activation in a multi-window tabbed column and a successful
transition into tabbed presentation can show Plasma's passive OSD.
`ShowTabIndicator` enables it by default and can disable it without a layout
write. The surface adds no managed window, input interception, polling,
private API, compositor replacement, or persistence field.

Release criteria (met):

- Overview projection preserves every tab member and selected index in linear
  time; tab and thumbnail hit regions do not overlap.
- Initial-presentation lookup is constant-time, singleton tabbed state survives
  every supported lifecycle, application rules override the global default,
  and target-wins merging remains unchanged.
- The indicator is emitted only after confirmed multi-tab activation or entry
  and remains silent when disabled or while an overview effect is active.
- Targeted checks, one hidden VM checkpoint, packaging, exact-SHA CI, and
  release gates pass without adding an application matrix.

No other feature belongs to 1.20.0.

## 1.21.0 (released)

Version `1.21.0` adds keyboard navigation to the optional overview. Opening the
effect selects the active actionable window when available, otherwise the
first actionable target on the current desktop, then the first actionable
target in visual order. Arrow keys move spatially without wrapping.

`Enter`, `Return`, and `Space` use the selected target's existing guarded public
KWin activation path. `Escape` closes the effect. A selected tabbed member
appears once as its large thumbnail; other actionable members appear as tab
targets. Minimized, invalid, and fully clipped items are excluded; partially
clipped targets use their visible intersection.

The slice adds no layout or persistent state, KConfig value, shortcut, schema,
private API, drag, or rearrangement.

Release criteria (met):

- Focused core and QML tests cover initial selection, directional movement,
  tab target identity, exclusions, activation, and closing.
- Build, package, and exact-SHA CI pass. One hidden full Wayland VM checkpoint
  exercises the packaged overview through physical keyboard input.
- No unrelated application or test matrix is added.

No other feature belongs to 1.21.0.

## 1.22.0 (released)

Version `1.22.0` adds vertical desktop-card reordering to the optional overview.
A plain left drag begins only in a card's number gutter. Cards stay fixed while
the source tint and one insertion line provide feedback. A normal click keeps
the existing selection behavior.

The last shared empty desktop is never a source or crossed target. Release
requires the exact effect, model, output, selected desktop, scene geometry, and
complete ordered desktop object/ID snapshot captured at grab. A valid request
uses public `KWin.Workspace.moveDesktop` once; cancellation, no-op, stale, or
unsupported paths are write-free. The main script remains the layout owner.

Release criteria (met):

- A focused pure matrix covers every insertion slot, protected-tail case, no-op,
  and invalid numeric input.
- QML contract checks cover normal release versus cancellation, exact stale-state
  guards, one public reorder call, constant-time pointer updates, and no window
  or stacking-order scan.
- One hidden Wayland checkpoint uses the existing application pool and physical
  pointer transport; package, exact-SHA CI, and release gates pass without a new
  backend or application matrix.

No other feature belongs to 1.22.0.

## 1.23.0 (released)

Version `1.23.0` adds one passive active-column badge to each desktop card in
the optional overview. It reports `stacked` or `tabbed` and the logical width as
a percentage or logical pixels. The badge stays inside the visible column span
and is hidden rather than clipped when the complete label does not fit.

The implementation reads only the projected active-column index, that column,
and its existing rendered delegate. It adds no input handler, animation,
setting, shortcut, persistence field, layout mutation, window scan, or KWin
write.

Release criteria (met):

- One focused QML contract check covers the label grammar, fail-closed
  visibility, bottom placement, and constant-time delegate lookup.
- Formatting, the focused overview check, QML lint, packaging, a hidden
  lifecycle VM, and exact-SHA CI pass. The presentation-only slice adds no full
  feature VM or application matrix.

No other feature belongs to 1.23.0.

## 1.24.0 (released)

Version `1.24.0` requests one best-effort passive Plasma OSD only after the
current overview activation attempt is rejected. The user-facing message is
generic; the exact technical reason remains in the KWin journal. Cancellation,
a stale callback, successful activation, and normal close remain silent.

The added feedback handler is constant time and adds no setting, shortcut,
input handler, KWin or layout write, persistence field, or scan beyond the
existing activation snapshot.

Release criteria (met):

- One focused QML contract check covers current-attempt identity, rejection-only
  ordering, one OSD request, and silent cancellation, stale, success, and normal
  close paths.
- Formatting, the focused overview check, QML lint, and the package check pass.
- The hidden lifecycle VM upgrades public 1.23.0 packages to matching 1.24.0
  packages. It validates packaging lifecycle, not OSD behavior.
- Exact-SHA CI passes before the release tag. This slice makes no full
  feature VM claim.

No other feature belongs to 1.24.0.

## 1.25.0 (released)

The existing directional output-transfer actions move one active manual or
automatic floating window when the floating layer is active. The command uses
the existing deterministic adjacent-output routing, adopts the destination
output's selected desktop, and never switches a desktop.

KWin owns the accepted destination frame. Driftile writes no floating frame or
tiled layout during success or bounded compensation. Modal, transient,
native-state, minimized, interactive, settling, stale, or otherwise unsafe
targets fail closed without entering the tiled transfer path.

Release criteria (met):

- Focused runtime coverage confirms manual and automatic ownership, target
  desktop adoption, unchanged tiled contexts, zero frame writes, relationship
  guards, missing-API rejection, and bounded compensation.
- Package checks, Nix evaluation, and Nix build gates pass.
- A headless real-KWin Wayland multi-output run covers the contextual transfer
  and reverse path. A hidden two-head VM confirms the packaged multi-output
  baseline.
- A hidden lifecycle VM upgrades public 1.24.0 packages to matching 1.25.0
  packages and verifies clean removal.
- Exact feature SHA `918eeb0` passes CI quality, native X11, and Wayland jobs.

No other feature belongs to 1.25.0.

## 1.26.0 (released)

Nine new unbound actions move only the active window directly to desktop
positions 1 through 9. A tiled member becomes a target singleton with the
source column width while retained source members preserve order, height state,
desktop membership, and frames. Floating targets reuse the existing
relation-free contextual path.

Numbered targets remain one-based, same-target commands are no-ops, and an
out-of-range target clamps to the shared empty tail. The slice adds no default
binding, setting, persistence field, schema, private API, or compositor
mechanism.

Release criteria (met):

- One focused runtime case covers extraction, retained state, width inheritance,
  tail clamping, focus, and same-target no-op behavior.
- Existing shortcut and QML contracts cover all nine action IDs while the
  helper-owned 88-action default profile remains unchanged.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- A hidden lifecycle VM upgrades public 1.25.0 packages to matching 1.26.0
  packages, exercises real applications, and verifies clean removal.
- Exact feature SHA `aa17fe3` passes CI quality, native X11, and Wayland jobs.
- Existing packaged desktop-transfer coverage is reused without a new
  integration, application, backend, or feature-VM matrix.

No other feature belongs to 1.26.0.

## 1.27.0 (released)

Existing width-preset forward/back actions and the unbound width-reset action
are contextual for one relation-free manually floating window. Presets read
the configured cycle; reset reads the global default. Targets use the exact
gap-adjusted singleton resolution, assigned-output pixel grid, live decorated
constraints, and established partial-reachability bounds.

The shared manual-floating size transaction issues at most one frame request
and commits only after exact acknowledgement. Automatic, related, pending, or
otherwise blocked floating targets fail closed without reaching the tiled path.

Release criteria (met):

- Focused runtime coverage verifies forward/back cycling, reset, configured
  percentages, singleton resolution, constraints, reachability, exact
  acknowledgement, unchanged tiled state, and fail-closed targets.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- Exact feature SHA `4bac7ea` passes CI quality in 2:36, native X11 in 3:07,
  and Wayland in 6:31.
- Existing packaged width settlement and tiled preset/reset coverage is reused
  without a new backend, integration, application, or VM matrix.
- This release makes no VM validation claim.
- The slice adds no action, default binding, setting, schema, persistence
  behavior, helper or overview behavior, or KWin API.

No other feature belongs to 1.27.0.

## 1.28.0 (released)

Existing unbound insert-left and insert-right actions contextually retile one
active relation-free manually floating window. Direction compares its frame's
horizontal center with solved column centers in the current output and desktop
strip. Off-screen columns participate, singleton columns are skipped, and
selection does not wrap. The nearest structural multi-window stack is the only
candidate; an unsafe nearest stack fails closed instead of routing farther.

Success appends and selects the active window, retains focus, adopts the target
width and stacked or tabbed presentation, and uses automatic height. Floating
ownership and the tiled layout remain unchanged while guarded geometry writes
are staged. Failed transitions compensate frames that retain captured write
ownership and otherwise enter dirty-context recovery. Automatic, related,
minimized, native-state, pending, stale, or unsafe active windows, plus unsafe
target and context states, fail closed without tiled fallback.

Release criteria (met):

- Focused runtime coverage verifies both directions, singleton skipping, target
  width and presentation adoption, automatic height, retained focus, ownership
  transfer, related-window rejection, state-round-trip compensation, and
  no-target rejection without tiled fallback.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass. Exact feature SHA `9a5d0ab` passes CI quality in 2:41, native X11
  in 3:02, and Wayland in 7:12.
- Existing shortcut registration and tiled direct-insertion coverage is reused
  without a new integration, application, backend, or VM matrix. The slice
  makes no VM validation claim.
- The slice adds no action, default binding, setting, schema, persistence field,
  helper or overview behavior, KWin API, or private API.

No other feature belongs to 1.28.0.

## 1.29.0 (released)

Existing forward and reverse window-height preset actions are contextual for
one active relation-free manually floating window. Blank
`WindowHeightPresets` keeps the exact `1/3`, `1/2`, and `2/3` cycle; custom
input accepts 1–16 strictly increasing integer percentages from 10 through 100.
Both cycles wrap in either direction. A custom raw frame height is
`percentage / 100 * (workArea.height - gap) - gap`; the start at
`workArea.y + gap` and the end at `start + rawHeight` are snapped to the
assigned output's pixel grid before subtraction. Forward selects the first
resolved height more than one logical pixel above the current frame and wraps
to the first preset. Reverse selects the last resolved height more than one
logical pixel below the current frame and wraps to the last. Window-height
reset remains tiled-only.

Changing the cycle performs no immediate geometry, layout, frame, viewport,
focus, or persistence write. Stable semantic preset codes keep an existing
tiled selection unchanged rather than reinterpreting it; only a later explicit
tiled or eligible manual-floating preset action reads the replacement cycle.

Fresh shortcut records assign forward width cycling to `Meta+R` and forward
height cycling to `Meta+Shift+R`; both reverse actions are unbound. Action IDs
and existing KGlobalAccel assignments remain unchanged. The helper's bundled
default profile follows the new mapping, so release migration must account for
an older helper-owned profile before the replacement profile is claimed.

The shared manual-floating size transaction applies live decorated constraints
and partial reachability, issues at most one frame request, and commits only
after exact acknowledgement. Width, focus, context, reinsertion anchor, and
every tiled layout remain unchanged; top-left changes only for the minimal
reachability clamp. Automatic, related, minimized, native-state, interactive,
pending, stale, or otherwise blocked active floating targets fail closed
without reaching the tiled path.

Version `1.29.0` was promoted directly to stable after the complete feature
batch passed its release gates; no release candidate was published.

Release criteria (met):

- Focused setting and runtime coverage verifies bounded canonical custom
  input, the blank exact-thirds fallback, live no-write replacement, stable
  existing tiled selection, later tiled selection from the replacement cycle,
  and forward or reverse wrapping for an eligible manual-floating target.
- Manual-floating cases retain gap-adjusted start/end pixel snapping,
  width, focus, context, reinsertion anchor, unchanged tiled layouts, one
  immediate frame request, and related or pending fail-closed targets.
- Existing shared manual-floating size coverage verifies
  decorated constraints, partial reachability, delayed exact acknowledgement,
  repeated-command serialization, cleanup, exact metadata commits, and stale
  result rejection.
- Shortcut contracts verify `Meta+R` for forward width, `Meta+Shift+R` for
  forward height, unbound reverse actions, stable action IDs, preserved existing
  assignments, and the changed helper default profile. The migration guide
  covers replacement of the previous helper-owned profile.
- The combined feature batch at `b858c00` and `9093c12` passes the grouped local
  formatting, type, lint, unit, package, Nix evaluation, and Nix build gates.
  Exact SHA `9093c121a33b3ec72fce6602267cf29b88423192` passes CI run
  `29419108286`.
- One hidden full Wayland VM checkpoint at the same exact SHA retains the mixed
  application pool, invokes reverse width cycling directly by action ID, and
  routes physical `Meta+Shift+R` through forward height cycling. No visible VM
  was run for this slice.
- The slice adds no action ID, layout-persistence field, overview behavior,
  KWin API, private API, backend, or application matrix.

No other feature belongs to 1.29.0.

## 1.30.0 (released)

Stable 1.30.0 adds same-context column-boundary targets to tiled pointer
dragging. Releasing in an empty horizontal gutter before, between, or after
visible columns keeps the dragged window separate. A singleton moves as one
complete column with its width, presentation, selected member, height state,
and active identity intact. A stack member becomes a new singleton with source
width, automatic height, and configured application or global initial
presentation while passive source state is preserved. The viewport follows the
existing active-column reveal rules.

Exact-window drops retain their existing stack insertion or reorder semantics.
Empty-gutter targets do not cross outputs or desktops; existing cross-context
adoption still requires one exact visible tiled window after KWin completes the
move. The slice stays on public interactive-move, cursor, frame, and outline
APIs and adds no input grab, private API, action, binding, setting, or
persistence field.

Release criteria (met):

- Pure planning covers before, between, and after gutters, preview clipping,
  strict geometry validation, and ineffective singleton boundaries.
- Atomic layout coverage preserves whole-column metadata and passive stack
  state, rejects missing or colliding targets, and rolls back exactly.
- Runtime wiring revalidates the captured same-context intent before one
  commit while leaving exact-window and cross-context behavior unchanged.
- Exact feature SHA `3985dd9562493b4808c3086159a6b191a6506ee1` passes the grouped
  local check across 36 files and 1,558 tests, the reproducible package check,
  all-system Nix evaluation, and the native Nix build.
- The same SHA passes CI run `29424914946`, including quality, native X11, and
  Wayland jobs.
- One hidden full Wayland VM checkpoint at the exact SHA passes the existing
  mixed Konsole, Firefox, KCalc, and XWayland pool plus the physical pointer and
  shortcut baseline. It did not physically exercise the new gutter target; no
  visible VM was run.
- The release adds no setting, action, helper profile, persistence, schema,
  overview, KWin API, or private API change.

No other feature belongs to 1.30.0.

## 1.31.0 (released)

The stable package combines related interaction and activity-ownership
changes. Cross-context gutter drops create a separate automatic-height
singleton after KWin moves a tiled window to another visible output or selected
desktop. A manually floating window can be dragged onto an exact tiled window
half or an empty gutter in its current context; the exact window wins and live
feedback shows the target.
Completed top or bottom resizes adopt the active stacked window's height while
the existing left or right path retains column-width adoption.

Normal active columns keep a right full-width successor at its natural strip
position, closing the active window selects a suitable surviving window, and a
missing default-width setting now creates 33% columns. Explicit user settings
and existing columns remain unchanged. These interaction paths stay finish-only
and use public KWin APIs; they add no binding, compositor fork, or private API.

Layout context identity now includes output, virtual desktop, and activity.
Windows assigned to exactly one activity retain independent layouts across
switches, while only the current activity receives geometry and focus writes.
When multiple activities exist, all-activity and multi-activity windows remain
under KWin ownership; absent or single-activity APIs retain compatible fallback
behavior.

Logical persistence advances to v4 and migrates valid v1 and v3 state without
changing the bounded v2 topology catalog. Missing activity identities fail
closed. The optional overview projects only the current activity and closes
when the current activity or available activity set changes.

An independently installable scripted effect adds optional smooth position and
size transitions for automatic geometry changes. It is disabled by default,
uses only public effect APIs, follows Plasma's animation-speed setting, and
never writes layout geometry. Manual move or resize, fullscreen, and active
fullscreen effects remain compositor-owned.

Release criteria (met):

- Exact-window, gutter, attach, and resize paths reject stale geometry and
  preserve passive state, unrelated contexts, saved placement, and explicit
  width configuration.
- Equal output and desktop IDs remain isolated between activities; inactive
  layouts receive no geometry writes and ambiguous activity ownership fails
  closed.
- Valid v1 and v3 state migrates to v4, while the overview projects only the
  current activity and closes across activity-topology changes.
- The optional transition effect preserves final frames and focus and installs
  independently through a release archive, NixOS, or Home Manager.

No other feature belongs to 1.31.0.

## 1.32.0 (released)

The release adds four unbound alternatives to vertical focus and window
movement. They navigate or reorder within the active column, then use the
previous or next desktop only at the corresponding boundary. Existing default
vertical bindings remain unchanged; users may assign the alternatives in
System Settings or replace the four ordinary actions through a custom JSON v1
shortcut profile.

Focus skips minimized peers when detecting a visible edge. Reordering treats
minimized peers as structural members, so it moves across them before reaching
the true first or last slot. Manual floating focus and movement stay local.
Blocked, stale, or otherwise failed operations never fall through to a desktop
change.

The unbound **Focus last-used desktop** action toggles between the current and
most recently selected distinct desktop on the active output. Selection history
stays isolated per output where KWin exposes per-output desktops; the global
fallback updates every output together. Removed or stale targets and stopped or
blocked operations are no-ops. History is session-only and is not persisted.
Users may assign `Meta+Tab` manually or add
`driftile_focus_last_used_desktop` to a custom JSON v1 profile without changing
the bundled defaults.

Touchpad navigation remains disabled by default and native-Wayland-only.
Horizontal column focus and vertical adjacent-desktop selection can be enabled
independently. Their shared live configuration accepts `3`–`5` fingers and
defaults to `5`. Natural direction preserves content-following mappings;
disabling it reverses every enabled direction. KWin receives the finger count
as an initial gesture property, so changing it recreates only enabled handlers
instead of mutating an already registered gesture. The three added typed
settings do not change layout persistence.

The optional transition effect excludes launchers, popups, transient dialogs,
and other non-movable windows. Repeated KWin geometry notifications retarget
independent position and size animations from their current visual values
instead of cancelling and restarting them. Home Manager can optionally own the
bounded transition duration without taking package-installation ownership.

The optional overview registers a configurable `3`–`5`-finger vertical swipe
pair, defaulting to four fingers. Up opens the effect and down closes an active
or pending activation. The pair is recreated from initial KWin gesture
properties when its enable state or finger count changes. Home Manager may own
the complete pair independently of package installation.

The companion also preserves Plasma's built-in Overview as the baseline. It
silently yields when that effect is already active and cancels a loading
attempt if it becomes active before the companion model is committed, without
activating, deactivating, or configuring the Plasma effect.

Fresh shortcut records align the complete preset-width pair: `Meta+R` cycles
forward and `Meta+Shift+R` cycles backward. Forward window-height cycling moves
to `Meta+Ctrl+Shift+R`; reverse height stays unbound. Action IDs and existing
KGlobalAccel assignments remain unchanged, while the optional helper follows
the new default profile.

Eight unbound boundary alternatives combine local focus or movement with the
adjacent output. Horizontal actions operate on columns and left/right outputs;
vertical actions operate on windows and above/below outputs. Focus uses visible
boundaries, movement uses structural boundaries, and manual floating behavior
stays local. Failed or blocked local work never falls through to another
output, and existing default bindings remain unchanged.

The optional transition effect also excludes frameless keep-above or
switcher-skipping shell overlays. Rapid geometry updates continue retargeting
the active animation instead of restarting it. Geometry changes received while
another fullscreen or workspace transition owns presentation are coalesced per
window and replayed once when ownership ends, even when the desktop transition
temporarily hides that window. True ineligibility, configuration reload, or
deletion discards pending work; replay adds no timer, geometry or persistence
write, or private API.

Ten unbound focus-traversal alternatives add first/last column wrapping,
vertical-edge continuation into an adjacent column, and direct or wrapping
top/bottom selection. Minimized peers are skipped during focus. Floating
traversal uses frame geometry and remains in its own layer. A blocked or
rejected local target never activates the fallback, and existing default
bindings remain unchanged.

Nine unbound direct selectors focus a one-based visible member of the active
tiled column. Minimized members do not consume an index, an oversized index
clamps to the last visible member, and tabbed selection rolls back when KWin
rejects focus. Floating and already-selected targets remain no-ops.

Nine unbound direct column selectors use the same one-based, clamped model.
Columns without a visible focus target do not consume an index. Selection can
enter the tiled layer from a floating source without exposing intermediate
focus, while rejection restores the previous layer and tab selection.

Nine unbound direct move actions reorder the active tiled column to a one-based
structural position, clamping past the final column. Members, width,
presentation, and focus move together. Floating focus and rejected geometry
leave the layout unchanged.

Five unbound interaction actions add adjacent-window swap, explicit stacked or
tabbed selection, and previous-window focus. Swap preserves the active window
and exchanges it with the adjacent selected member; two singleton columns move
whole. Previous-window history is session-only, includes tiled and manually
floating windows across contexts, and skips minimized windows and automatic
popups.

Six unbound output-cycle actions add previous/next focus plus single-window and
whole-column transfers. The cycle orders outputs top-to-bottom and then
left-to-right, wraps at both ends, and rejects missing or invalid targets.
Transfers reuse the atomic tiled and floating paths; bundled bindings remain
unchanged.

Seven explicit state actions remain unbound: direct floating or tiling
placement, active-window centering, forward or reverse active-window width
presets, and one-way overview open or close. Layer placement is idempotent and
reuses the existing guarded ownership transactions. Tiled window-width actions
follow the one-width-per-column model, while the overview actions preserve the
existing `Meta+O` toggle and optional package boundary.

The optional overview accepts a pointer drag from a visible thumbnail or
non-minimized tab to another desktop card on the same output. A bounded planner
proves unique source ownership in the immutable model before one public KWin
desktop-membership assignment. The empty tail is valid; same-card,
cross-output, all-desktop, related, stale, rejected, or unconfirmed drops leave
the effect open and perform no layout write.

Keyboard typing in the optional overview applies a bounded, case-insensitive
window-title and application search. Every query term must match; Backspace
edits one Unicode code point, Escape clears before closing, and spatial
selection repairs within the remaining visible targets. Search remains
session-only and read-only toward KWin and layout state. Plain-text feedback
shows the unique matching-window count or an explicit no-match message.

Keyboard navigation also includes the number gutter of every non-current live
desktop, including the shared empty tail. Enter reuses the guarded desktop
selection path, while the current gutter remains inert and all gutter targets
stay outside an active window search.

The same target set supports bounded sequential keyboard traversal. Tab and
Shift+Tab wrap in deterministic visual order, Home and End select its
boundaries, and a selected desktop gutter receives an explicit focus outline.

An unmodified vertical mouse wheel cycles that same actionable target set in
visual order. Search limits it to matching windows; without a query,
non-current desktop gutters also participate. High-resolution deltas use a
bounded remainder and bounded per-event step count, changing only overview
selection with no KWin or layout write.

Delete requests closure only for the exact selected live window. Desktop
targets, stale state, and non-closeable windows are no-ops; the effect remains
open until KWin reports actual removal and performs no layout write. A separate
middle-click handler exposes the same guarded close path for visible thumbnails
and non-minimized tabs without changing left-click or drag behavior.

Release criteria (met):

- New navigation and movement actions are unbound, fail closed on stale state,
  and preserve the existing default action set except for fresh preset-width
  shortcut records.
- Gesture, overview, and transition behavior stays optional, uses public KWin
  APIs, and does not take ownership of layout persistence.
- Release archives, native Nix packages, and the grouped X11 and Wayland
  checks pass on the exact release commit before publication.

No other feature belongs to 1.32.0.

## 1.33.0 (released)

The current interaction slice restores optional geometry transitions for
off-screen columns and outputs with negative global coordinates. Non-negative
absolute endpoints retain position retargeting; other moves use relative
translation. Deferred replay after a workspace effect uses the same rule.

Completed vertical touchpad desktop gestures now target the single output under
the pointer. Output gaps, overlaps, and invalid pointer geometry are no-ops;
keyboard desktop actions keep targeting the active output and the existing
global-desktop fallback remains unchanged.

The optional overview accepts an exact desktop-card drop on another output.
The effect confirms the public output move and desktop membership independently,
compensates a partial result only while the captured source remains exact, and
otherwise closes stale state without another write. Same-output transfer keeps
its existing path.

No setting, shortcut, persistence field, compositor fork, or private API is
added by this slice.

Release criteria (met):

- Focused transition, gesture, and overview-transfer checks pass.
- The grouped unit, package, Nix, Wayland, multi-output Wayland, and X11 gates
  pass before promotion.
- Exact feature SHA CI passes before the release commit is tagged.

No other feature belongs to 1.33.0.

## 1.34.0 (released)

The optional transition effect retains an earliest deferred frame while a
workspace handoff still leaves the window temporarily hidden. Public window,
desktop, activity, and later geometry signals provide bounded replay
opportunities without a timer.

Public shell categories now exclude switcher-hidden windows, OSDs, outlines,
lock-screen surfaces, and internal windows before animation. Users may also
disable movement or size interpolation independently and maintain a bounded,
exact `windowClass` exclusion list through the effect settings or Home Manager.
Malformed exclusion input fails closed until a valid reload.

Rapid moves through negative global coordinates retain prior relative
translations in a bounded additive chain, avoiding a visual restart while
absolute non-negative position and size animations keep their existing
retarget paths.

Horizontal focus can optionally center a destination only when it and the
nearest column toward the prior focus do not both fit the sampled work area.
The policy uses solved frames for adjacent and direct-edge navigation, remains
write-free when changed live, and yields to always-center and exact application
rules.

This slice adds no shortcut, layout-persistence field, geometry write, private
API, or compositor mechanism.

Release criteria (met):

- Focused transition, settings, and horizontal-focus checks pass.
- The grouped unit, package, Nix, Wayland, multi-output Wayland, X11, and
  hidden full-VM gates pass before promotion.
- Exact release SHA CI passes before the release commit is tagged.

No other feature belongs to 1.34.0.

## 1.35.0 (released)

- Add opt-in centering for a context containing exactly one tiled column or
  stack, with live enable and no forced movement when disabled.
- Accept fractional `0`–`64` logical-pixel gaps through KConfig and Home
  Manager; the UI uses a `0.5` step without rejecting other in-range values.
- Add an opt-in empty virtual desktop before the first occupied desktop while
  preserving the shared trailing empty desktop, safe ownership, and pinned
  reorder boundaries.
- Accept mixed proportional and fixed logical-pixel column-width and
  window-height preset cycles through KConfig, NixOS, and Home Manager.
- Extend exact application initial-width rules from legacy bare percentages to
  explicit percentages and fixed `1px`–`16384px` logical widths. Tiled
  admission, retiling, and context transfer use the same constrained and
  output-pixel-snapped path.
- Add an opt-in fixed global default column width. `0` retains the existing
  percentage fallback; positive logical-pixel values affect later admissions,
  fresh retiles, and explicit resets without rewriting existing columns.
- Keep the geometry behaviors inside the existing solver and physical-pixel
  snapping boundary. Floating windows, multi-column contexts, and logical
  persistence remain unchanged.

Release criteria (met):

- Singleton centering and fractional gaps update live while preserving the
  existing physical-pixel snapping boundary.
- Leading and trailing empty desktops keep distinct ownership, and overview
  reordering cannot cross their protected boundaries.
- Fixed and proportional presets, application rules, and the default width use
  existing constraints across admission, retiling, transfer, and reset paths.
- No shortcut, private KWin API, or layout-structure version is added.

No other feature belongs to 1.35.0.

## 1.36.0 (released)

- Add optional fixed logical-pixel deltas for explicit column-width and
  window-height decrease or increase actions. A value of `0` retains the
  existing percentage-point step for the corresponding action pair.
- Add exact per-application initial tiled client heights in proportional or
  fixed logical-pixel form. Fresh singleton admission and fresh retiling use
  the existing constrained, output-pixel-snapped path without rewriting
  existing geometry when a rule changes.
- Let the optional transition effect select one of six bounded easing curves,
  retaining `out-cubic` as the default.
- Skip size interpolation for resize deltas at or below a configurable
  logical-pixel threshold while allowing simultaneous movement to animate.
- Replay deferred motion when activation makes a window visible after a
  workspace or fullscreen presentation handoff.

Release criteria (met):

- Fixed and proportional sizing paths retain live constraints and physical
  pixel-grid snapping on Wayland, XWayland, and native X11.
- Transition replay remains bounded per window, uses public effect signals,
  and writes no geometry or persistence.
- Settings are available through KConfig, NixOS, and Home Manager without a
  shortcut, default binding, private KWin API, or persistence-schema change.

No other feature belongs to 1.36.0.

## 1.37.0 (released)

- Add a global automatic, proportional, or fixed logical-pixel initial tiled
  client height beneath exact application rules.
- Apply the global height only to fresh singleton admission and fresh retiling,
  preserving existing, restored, and transferred geometry.
- Add opt-in output-local back-and-forth when a numbered direct desktop action
  resolves and clamps to the already current desktop.
- Preserve deferred movement when an active current-context window receives a
  focus or geometry command before desktop-transition visibility settles.

Release criteria (met):

- Initial heights retain live solver constraints and physical-pixel snapping
  without changing logical persistence.
- Numbered back-and-forth rejects missing, stale, cross-output, and unconfirmed
  history without altering adjacent or explicit last-used actions.
- Transition replay remains bounded per window and uses only public effect
  context signals and properties.

No other feature belongs to 1.37.0.

## Post-v1

Add interaction and presentation features outside the frozen v1 scope without
taking over compositor mechanisms.

- Keep Plasma's built-in Overview as the compatible baseline.
- The optional overview must remain removable, preserve the authoritative
  layout state, and fall back cleanly to Plasma's Overview.

### 1.38.0 (released)

- Add fresh-only exact application rules for initial full-width columns and
  native fullscreen requests.
- Add an exact first-manual-floating position rule with eight work-area anchors,
  signed logical-pixel offsets, output-pixel snapping, and bounded clamping.
- Keep rapid transition retargeting continuous across workspace visibility
  races and outputs with negative global coordinates.
- Preserve the configured normal width beneath full width and the admitted
  tiled or floating state beneath fullscreen.
- Keep startup, restored, transferred, re-admitted, and already tracked windows
  unchanged without a shortcut, persistence field, private API, or compositor
  mechanism.

Release criteria (met):

- Initial-state rules preserve their normal tiled or floating underlay and use
  exact bounded application IDs.
- Floating placement uses eight work-area anchors, signed logical-pixel
  offsets, output-pixel snapping, and guarded first-manual ownership.
- Rapid movement retargets one bounded position/translation pair without
  restarting or accumulating transitions.
- KConfig, NixOS, and Home Manager expose safe empty defaults without changing
  logical persistence or shortcut assignments.

No other feature belongs to 1.38.0.

### 1.39.0 (released)

- Add exact fresh-window rules for an initial one-based virtual desktop, named
  output, or both.
- Apply a confirmed destination before initial floating, tiled sizing,
  presentation, full-width, and fullscreen policies.
- Add an exact fresh-window native maximize-to-edges rule after underlay
  admission and before an optional initial fullscreen request.
- Keep startup, restored, related, and already admitted windows unchanged;
  never select a desktop or change focus as part of assignment.
- Expose the bounded rule map through KConfig, NixOS, and Home Manager without
  a shortcut or persistence-schema change.

Release criteria (met):

- Cross-output desktop assignment uses only public Plasma 6.7+ APIs and
  confirms each synchronous membership and output transition.
- Rejected or unavailable destinations restore only transaction-owned
  intermediate state, fall back safely, and are not retried.
- Destination-relative initial floating placement and ordinary tiled admission
  use the confirmed target work area and layout context.
- Native maximize remains under KWin ownership and preserves the admitted
  tiled or floating state beneath it without retrying unsupported requests.

No other feature belongs to 1.39.0.

### 1.40.0 (released)

- Add an exact fresh-window application rule that requests focus once after
  tiled or floating admission when the destination context is already visible.
- Add the complementary exact rule that restores the previous live visible
  window when a fresh match receives KWin's initial focus, with negative
  precedence when both rules match.
- Apply confirmed destination and underlay rules before focus, then request
  native maximize and fullscreen states afterward.
- Keep startup-existing, restored, transferred, re-admitted, and already
  tracked windows unchanged; never select a desktop or output to reveal a
  match.
- Expose the bounded exact application list through KConfig, NixOS, and Home
  Manager without a shortcut or persistence-schema change.

Release criteria (met):

- Unlisted applications retain KWin's ordinary focus behavior.
- A matching unfocused window that never becomes active causes no focus write.
- Unavailable and rejected focus requests are consumed without retry.
- Live settings affect only windows first tracked afterward.
- The implementation remains within public Plasma 6.7+ APIs.

No other feature belongs to 1.40.0.

### 1.41.0 (released)

- Allow a fresh-window destination to select a virtual desktop by its exact,
  case-sensitive name instead of its current numeric position.
- Require one unique live name match and leave the window in its accepted
  context when the name is missing or ambiguous.
- Expose the same bounded rule through KConfig, NixOS, and Home Manager without
  changing shortcuts or persisted layout state.
- Add an optional global first-manual-floating position beneath exact
  application rules, reusing the same anchor, clamp, and pixel-snap behavior.
- Bound rapid transition retarget latency and skip unchanged synchronized
  targets without restarting active animations.
- Restore the most recently focused eligible window after KWin briefly selects
  an ineligible interim surface while closing the active window.
- Resolve exact application rules from `desktopFileName`, falling back to
  `resourceClass` only when the desktop-file ID is unavailable.

Release criteria (met):

- Named destinations fail closed unless exactly one current virtual desktop
  matches, and never select a desktop or change focus.
- Default floating placement remains opt-in, fresh-only, clamped, and snapped
  to the destination output's physical-pixel grid.
- A usable `desktopFileName` always wins; `resourceClass` is read only when the
  desktop-file ID is unavailable, without changing the settings schema.
- Close-focus recovery ignores ineligible interim surfaces but never overrides
  a live replacement selected by KWin.
- Initial transition duration remains configurable while rapid retargets use a
  bounded, animation-scale-aware interval and skip unchanged targets.

No other feature belongs to 1.41.0.

### 1.42.0 (released)

- Add an optional global initial virtual desktop and output destination for
  genuinely new normal windows beneath exact application rules.
- Reuse numeric or exact named desktop selection, output-only routing,
  one-shot rollback, and the existing initial-admission order.
- Expose the setting through KConfig, NixOS, and Home Manager without adding a
  shortcut or persistence field.
- Add a global `default`, `focused`, or `unfocused` fresh-window focus policy
  beneath exact application focus rules.
- Recover close focus after delayed KWin removal settlement without accepting
  an active window from another output, desktop, or activity as the result.
- Preserve transition continuity when focus changes before a workspace
  transition's visibility flags settle.

Release criteria (met):

- Exact application destinations always take precedence over the global
  default.
- Startup-existing, restored, related, and already tracked windows remain
  unchanged; live edits affect only windows first tracked afterward.
- Destination resolution never selects a desktop or changes focus and remains
  within public Plasma 6.7+ APIs.
- Exact unfocused rules win over exact focused rules, exact rules win over the
  global focus policy, and `default` preserves ordinary KWin behavior.
- A live same-context replacement remains focused after close; otherwise one
  bounded follow-up probe restores the latest eligible same-context window.
- Rapid desktop handoffs retain only one-shot, context-guarded visibility and
  active-animation leases, with no timer or private API.

No other feature belongs to 1.42.0.

### 1.43.0 (released)

- Keep close-focus recovery alive for one delayed activation settlement while
  accepting any legitimate replacement without stealing focus back.
- Retry an initially rejected borderless claim after KWin reports decoration
  policy settlement.
- Retire completed transition state, restrict workspace-effect cancellation to
  active participants, and discard net-zero deferred movement.
- Keep the Plasma shell launcher outside geometry interpolation.

Release criteria (met):

- Focused close, decoration, and transition checks pass.
- One grouped unit, package, Nix, X11, and Wayland gate passes on the batch
  head before publication.

No unrelated feature belongs to 1.43.0.

### 1.44.0 (released)

- Add optional pointer screen-edge activation to the overview across all eight
  edges and corners, with `none` as the no-reservation default.
- Add a configurable alpha backdrop while retaining the existing color by
  default.
- Select a non-current desktop by clicking empty card content without changing
  window, tab, gutter, reorder, search, or drag behavior.
- Let Home Manager manage the edge and strict `#AARRGGBB` backdrop independently
  of package installation.

Release criteria (met):

- Live edge changes release the previous public KWin reservation, malformed
  external values fail safely, and edge activation never closes the overview.
- Empty-card selection reuses the guarded desktop path and never duplicates a
  window or tab action.
- One grouped unit, package, Nix, X11, and Wayland gate passes on the batch
  head before publication.

No unrelated feature belongs to 1.44.0.

### 1.45.0 (released)

- Let existing numbered focus, whole-column transfer, and single-window
  transfer actions target exact virtual desktop names.
- Preserve one-based position and shared-tail clamping for every unconfigured
  slot.
- Resolve live names per command and reject missing or ambiguous configured
  names without positional fallback.
- Expose the bounded mapping through KConfig and Home Manager without adding an
  action, default binding, or persistence field.
- Add nine unbound actions that move the selected desktop directly to a
  one-based movable position while preserving protected empty boundaries.
- Recover the most recent eligible same-context focus when the active window
  closes while an unrelated geometry transition is still settling.
- Retain immediate focus motion after a workspace presentation handoff instead
  of dropping the first hidden geometry update.

Release criteria (met):

- Named focus and both transfer paths share one resolver, while numbered
  back-and-forth compares the resolved desktop identity.
- Live edits and desktop renames apply without restarting KWin or caching stale
  names.
- Direct reorder clamps oversized positions, treats the current position as a
  no-op, and retains the existing exact one-call verification.
- Close-focus recovery remains bounded and accepts a legitimate replacement,
  while post-workspace transition replay retains the earliest frame.
- One grouped unit, package, Nix, X11, and Wayland gate passes on the batch
  head before publication.

No unrelated feature belongs to 1.45.0.

### 1.46.0 (released)

- Recover the most recent eligible same-context focus after an active dialog,
  transient, or application-excluded automatic-floating window closes.
- Preserve a legitimate replacement selected by KWin and cancel recovery when
  the removed window's context is no longer visible.
- Retarget an active large size animation when KWin follows it with a small
  settling correction instead of snapping to the final size.
- Keep threshold suppression for isolated small resizes and retire empty
  transition state after a failed or unnecessary retarget.
- Present the selected tiled column before the other geometry participants so
  full-width focus handoffs do not expose an incoherent intermediate frame.
- Cache unchanged transition window-class classification and evaluate dynamic
  eligibility once per geometry signal.
- Share a bounded session backoff after two rejected borderless requests for
  the same exact non-normal helper role while retaining explicit policy retry.

Release criteria (met):

- Automatic-floating close recovery reuses the bounded existing focus
  settlement path without taking layout ownership of the removed window.
- Manual-floating and tiled close recovery, replacement acceptance, and layer
  fallback order remain unchanged.
- Small settling corrections retain the active visual interpolation and capped
  retarget duration without restarting position motion.
- Focus transactions preserve rollback semantics while writing the selected
  target first, and ordinary layout mutations retain strip-order writes.
- Transition eligibility avoids duplicate hot-path work, and repeated helper
  decoration rejection remains bounded without suppressing normal windows.
- Focused runtime and transition checks pass before one grouped package gate.

No unrelated feature belongs to 1.46.0.

### 1.47.0 (released)

- Preview settled cross-output and same-output cross-desktop pointer targets
  before release.
- Prefer an exact destination window half, then an empty horizontal gutter,
  through one shared single-pass planner for preview and commit.
- Reuse an immutable destination snapshot while the pointer remains inside the
  same target, then revalidate ownership, layout identity, participants, and
  the final target before commit.
- Scope presentation callbacks to the current drag owner so stale cleanup
  cannot hide a newer preview.

The batch adds no action, binding, setting, persistence field, compositor fork,
or private API.

### 1.48.0 (released)

- Minimally reveal an ordinary column immediately after a full-width column at
  the right edge, retaining a partial view of its predecessor while keeping
  later columns outside the viewport.
- Keep rapid alternating horizontal focus retargets to one optional transition
  transform per attribute, coalesce duplicate or stale frame reports including
  XWayland-style bursts, and replace an ended transition ID cleanly when an
  in-place retarget fails.
- Preview the predicted singleton frame on a selected empty cross-output or
  cross-desktop destination without making the preview authoritative before
  normal post-drop admission.

The batch changes no setting, action, schema, default binding, or private API.

### 1.49.0 (released)

- Include the most recently focused eligible tiled, manually floating,
  automatically floating, and application-excluded window in close-focus
  recovery while preserving existing same-context and visibility guards.
- Permit recovery focus while an unrelated geometry transaction settles,
  without taking geometry ownership or writing a window frame.
- Retain the first immediate focus transition after a workspace effect releases
  control until an explicit activation or visibility opportunity can present
  it.

The batch changes no setting, action, schema, binding, or private API.

### 1.50.0 (released)

- Add `useInitialWindowWidth`, disabled by default, for newly admitted singleton
  tiled columns without an exact application-width rule.
- Capture the live frame width as a fixed logical policy, then apply the existing
  decorated minimum, maximum, and physical-pixel constraints.
- Preserve the public `33%` default and leave existing columns, reset behavior,
  persistence schemas, actions, and bindings unchanged.
- Expose the option through KConfig and the typed Home Manager settings profile;
  NixOS-installed packages use the same per-user KConfig control.
- Add a separately packaged native Qt/KDE shortcut editor for the active
  extension's primary and alternate KGlobalAccel assignments.
- Keep edits pending until Apply validates internal and global conflicts plus
  unchanged baselines, then verify each write and roll back the batch on
  failure.
- Expose `driftile-shortcut-editor` through the flake and the opt-in NixOS and
  Home Manager `programs.driftile.shortcutEditor.enable` option without adding
  GUI dependencies to the main package.

Release criteria:

- Exact application-width rules remain higher priority than frame capture.
- Enabling or disabling the option schedules no geometry write and affects only
  future singleton admissions.
- Focused settings, runtime, KConfig, NixOS-module, and Home Manager checks pass
  before the batch-wide release gate.
- The editor requires an active extension, writes nothing before Apply, and
  leaves conflicting assignments unchanged.
- Ordinary CMake installation and both declarative module scopes install the
  editor independently of the main KWin package.

### 1.51.0 (released)

- Show every active action's registered KGlobalAccel defaults alongside its
  current primary and alternate assignments.
- Restore the selected action or all actions to their registered defaults as a
  pending edit, preserving full multi-assignment lists.
- Keep default restoration inside the existing stale-baseline, conflict,
  verified-write, and rollback transaction.
- Mark pending rows, include defaults in search and tooltips, and support the
  platform's standard Find, Save, Refresh, and Close shortcuts plus Enter for
  editing.
- Provide `--help` and `--version`, a searchable desktop launcher, and valid
  AppStream metadata for ordinary distribution packaging.

Release criteria (met):

- Restoring defaults writes nothing before Apply and a rejected batch leaves
  every active assignment unchanged.
- Empty and duplicate registered defaults display and restore deterministically.
- The standalone CMake and Nix packages install the binary, launcher, and
  metadata without adding GUI dependencies to the main KWin package.

The batch changes no KWin action, default binding, setting, layout schema, or
private API.

### 1.52.0 (released)

- Add `DefaultInitialLayout` with a behavior-preserving `tiled` default and an
  optional `floating` policy for genuinely new normal windows.
- Add bounded exact `ApplicationInitialLayouts` rules with `tiled` and
  `floating` values.
- Resolve an exact map entry before the legacy initial-floating list and the
  global default, while keeping automatic floating and application tiling
  exclusions authoritative.
- Expose both settings through KConfig and typed Home Manager options. Live
  changes affect future windows without moving existing ones.

Release criteria (met):

- The default configuration keeps current tiled admission behavior.
- Exact matching remains case-sensitive and malformed, duplicate, control, or
  oversized maps fail atomically.
- Focused settings and admission checks cover precedence and fresh-only
  behavior without changing actions or layout persistence.

The batch changes no action, binding, layout persistence schema, or private
API.

### 1.53.0 (released)

- Project public KWin attention requests into the optional Overview as static,
  non-animated per-window or tab accents.
- Mark each affected desktop card in its number gutter and let search terms
  `urgent` or `attention` match requesting windows.
- Keep the projection event-driven and read-only, with no focus, layout,
  setting, action, or persistence change.

Release criteria (met):

- A requesting window has one cue in its visible thumbnail or tab, and its
  owning desktop card has the matching gutter marker.
- Public attention changes update cues without polling, animation, or KWin
  writes.
- Attention terms compose with the existing all-term search while ordinary
  title and application matching remains unchanged.

The batch changes no setting, action, binding, focus path, layout state,
persistence schema, or private API.

### 1.54.0 (released)

- Make minimized members of tabbed columns pointer, keyboard, and search targets
  through their existing tabs.
- Restore an activated minimized tab through its exact public KWin state, then
  focus the same window only after restoration is confirmed.
- Let `Delete` and middle click close an exact closeable minimized tab without
  restoring it.
- Add `minimized` to the existing all-term title, application, and attention
  search while keeping the selected ordinary tab inert.
- Keep minimized stacked and floating windows outside this slice and leave drag
  and drop disabled for minimized tabs.

Release criteria (met):

- Click, `Enter`, and keyboard navigation reach the exact minimized member and
  close the Overview only after confirmed restore and focus.
- `Delete` and middle click revalidate the same closeable minimized window;
  stale or mismatched state performs no action.
- `minimized` composes with title, application, `urgent`, and `attention` terms
  without changing ordinary search results.

The batch uses only public KWin state and keeps the Overview read-only with
respect to layout ownership. It adds no setting, action, binding, persistence
field, layout write, or private API.

### 1.55.0 (released)

- Give eligible minimized stacked tiled members and tracked floating windows
  without a tab one compact caption placeholder inside the visible intersection
  of their projected slot or frame.
- Include each placeholder in pointer, keyboard, close, title, application,
  attention, and `minimized` search paths while retaining its attention cue.
- Restore and then focus the exact window on click, `Enter`, `Return`, or
  `Space` through the existing guarded public KWin path.
- Close an exact closeable placeholder with `Delete` or middle click without
  restoring it.
- Keep existing minimized tab behavior unchanged and exclude every minimized
  target from drag and drop.

Release criteria (met):

- Malformed, tiny, fully clipped, offscreen, stale, or ineligible projections
  fail closed without exposing an actionable placeholder.
- Each eligible minimized window has at most one target inside its visible
  projected slot or frame.
- Activation and closure revalidate the same exact live window and reuse the
  existing public restore, focus, and close paths.

The batch adds no geometry, layout, setting, action, binding, persistence field,
or private API write.

### 1.56.0 (released)

- Add a static bounded plain-text footer to ordinary large window thumbnails.
- Use the normalized caption as the primary line, with the exact application
  identity as its fallback or a distinct secondary line.
- Reuse the same normalized caption and application fallback for tab and
  minimized-placeholder text.
- Hide the complete footer on small frames instead of clipping it into an
  unreadable or input-obscuring surface.
- Keep every existing thumbnail, tab, placeholder, search, and close target
  unchanged.

Release criteria (met):

- Control characters, repeated whitespace, overlong text, malformed identity,
  and inaccessible fields are bounded or fail closed before reaching QML.
- Ordinary large thumbnails show the caption and distinct application identity,
  while small thumbnails retain their existing presentation without a footer.
- Labels remain static and read-only with no new pointer or keyboard input,
  timer, animation, layout or settings write, action, binding, persistence field,
  or private API.

### 1.57.0 (released)

- Add a live `ShowWindowLabels` preference with the existing labeled
  presentation as its default.
- Hide only the ordinary large-thumbnail footer when disabled; keep tab and
  minimized-placeholder labels and targets intact.
- Add a live `ShowApplicationIdentity` preference that retains captions while
  suppressing application fallback and secondary text.
- Avoid reading application identity fields when that presentation is disabled.
- Expose both nullable per-user preferences through Home Manager without
  changing system package ownership or the NixOS option surface.

Release criteria (met):

- Malformed external values fall back to the existing enabled presentation.
- Both preferences update through KConfig without restarting KWin and preserve
  search, pointer, keyboard, close, layout, and persistence behavior.
- Caption-only planning remains bounded and does not access hidden identity
  fields.
- One grouped package, Nix, Wayland, X11, and hidden VM gate passes before
  publication.

The batch adds no action, binding, input handler, geometry or layout write,
persistence field, animation, timer, private API, or KWin fork.

### 1.58.0 (released)

- Show one compact close button on an eligible thumbnail, tab, or minimized
  placeholder while that exact surface is hovered or keyboard-selected.
- Route a left click through the existing exact guarded close request without
  focusing, activating, restoring, or dragging the window first.
- Hide the complete button on small surfaces and keep attention cues and label
  text unobstructed.
- Keep the button's pointer grab exclusive and independently reject its bounds
  in the parent activation handler.
- Add a default-enabled live KConfig preference and a nullable per-user Home
  Manager option without changing the NixOS option surface.
- Include the new QML component in deterministic package-content validation.

Release criteria (met):

- Ordinary, tabbed, and minimized previews expose at most one close button for
  a live closeable window, and stale or ineligible windows expose none.
- Button clicks cannot also activate, restore, focus, or start a drag; existing
  `Delete` and middle-click close behavior remains unchanged.
- Disabled, malformed, or geometry-constrained presentation fails safely and
  does not change window targets.
- One grouped package, Nix, Wayland, X11, and hidden VM gate passes before
  publication.

The batch adds no KWin action, binding, layout or persistence write, timer,
animation, private API, or compositor fork.

### 1.59.0 (released)

- Show one static `Fullscreen`, `Maximized`, or `Floating` badge on a
  sufficiently large selected ordinary thumbnail.
- Treat only full two-axis maximize as `Maximized`; partial maximize states
  alone remain unbadged.
- Prefer the fullscreen badge over maximized, and maximized over floating,
  while retaining every true lowercase state term in all-term search.
- Keep tabs and minimized placeholders free of state badges.
- Add a default-enabled live KConfig setting and nullable per-user Home Manager
  option. Malformed values retain the enabled presentation.

Release criteria (met):

- Badge visibility changes no window target, state, input path, layout, or
  persistence data.
- Disabling badges hides only their presentation; state search remains
  available and composes with existing title, application, attention, and
  minimized terms.
- Missing, stale, malformed, small, unselected, or non-normal targets expose no
  badge.

No other feature belongs to 1.59.0.

### 1.60.0 (released)

- Show each normalized virtual-desktop name beside the fixed number gutter on
  sufficiently large Overview cards.
- Keep small and narrow cards on the existing compact numbered gutter, without
  clipping or shrinking their projected window content.
- Include the owning desktop name in all-term window search whether or not its
  label is visible.
- Add default-enabled live `ShowDesktopNames` KConfig and a nullable Home
  Manager option. Malformed values retain the enabled presentation, and `null`
  leaves KConfig unmanaged.
- Keep the NixOS option surface unchanged; system installations use the same
  per-user effect setting.
- Treat desktop names as a bounded, normalized, read-only projection of public
  KWin state. Missing or hostile names fail closed.

Release criteria (met):

- Desktop names expand only eligible large cards and leave compact cards on
  the fixed numbered gutter.
- Search includes each window's owning desktop name independently of label
  visibility.
- KConfig changes apply live, Home Manager can leave the value unmanaged, and
  the NixOS option surface remains unchanged.

The batch adds no pointer or keyboard input, action, binding, timer, animation,
desktop selection, focus, geometry, layout or persistence write, private API,
or KWin fork.

### 1.61.0 (released)

- Show the public KWin application icon on sufficiently large ordinary label
  footers, tabs, and minimized placeholders.
- Load Kirigami icon presentation lazily only after a surface is eligible.
  Missing icons fail closed, while disabled and ineligible surfaces do not
  instantiate the Loader payload or its Kirigami icon and do not read the
  window property.
- Add default-enabled live `ShowApplicationIcons` KConfig and a nullable Home
  Manager option. Malformed values retain enabled presentation, and `null`
  leaves KConfig unmanaged.
- Keep the NixOS option surface unchanged; system installations use the same
  per-user effect setting.

Release criteria (met):

- Icons reserve label space only when a valid icon is available.
- Disabling icons restores the existing text-only presentation without reading
  an icon.
- Icons add no input, search, focus, timer, animation, geometry, layout or
  persistence behavior.

The batch uses public `Window.icon` and Kirigami presentation and adds no
private API or KWin fork.

### 1.62.0 (released)

- Show one bounded normalized output name on sufficiently large multi-output
  Overview scenes.
- Hide the passive label on small scenes, during search, when disabled, and in
  single-output sessions without changing desktop-card geometry.
- Include the owning output name in all-term window search independently of
  label visibility.
- Read and normalize the public output name once per scene only when
  presentation or search needs it; malformed or hostile values fail closed.
- Add default-enabled live `ShowOutputNames` KConfig and a nullable Home
  Manager option. Keep the NixOS option surface unchanged.

Release criteria (met):

- Multi-output labels remain passive, bounded, adaptive, and outside every
  pointer, keyboard, focus, layout, and persistence path.
- Output terms compose with existing caption, application, desktop, attention,
  minimized, and state terms whether or not the label is visible.
- Disabled, single-output, geometry-constrained, malformed, and hostile paths
  expose no label and avoid unnecessary output-name reads.

The batch uses only public Plasma 6.7+ output state and adds no action, binding,
timer, animation, geometry or layout write, persistence field, private API, or
KWin fork.

### 1.63.0 (released)

- Derive the unique global search total, exact per-desktop counts, and
  unique-window ordinals from one bounded navigation-target summary.
- Show the selected unique window as `ordinal/total` while retaining total-only
  and no-match feedback when no exact window selection is available.
- Give every target for the same multi-desktop window one shared ordinal while
  counting that window once globally and once on each owning desktop.
- Show a passive match-count badge on desktops with results and statically
  deemphasize zero-result cards during non-whitespace search.
- Preserve whitespace-only global feedback and every existing card geometry,
  ordering, and input path.

Release criteria (met):

- Duplicate targets cannot inflate the global total, per-desktop count, or
  unique-window ordinal sequence.
- Multi-desktop targets share one ordinal and contribute one result to every
  exact owning desktop.
- Exact selection shows a valid ordinal and total; missing, stale, or malformed
  summary data falls back safely to total-only or no-match feedback.
- Search badges and deemphasis never hide, move, resize, or add input to a
  desktop card and remain inactive for whitespace-only queries.

The batch adds no timer, animation, KWin request, geometry or layout write,
persistence field, private API, or KWin fork.

### 1.64.0 (released)

- Preserve case-insensitive whitespace-separated AND terms for unscoped
  Overview search.
- Add double-quoted phrases and leading `-` exclusions.
- Add `title:`, `app:`, `desktop:`, `output:`, and `state:` scopes, including
  quoted scoped values.
- Keep unknown prefixes as ordinary search text.
- Reject malformed recognized scopes and quoted phrases without exposing
  partial results, and report the invalid query in the Overview.

Release criteria (met):

- Existing unscoped queries retain their matching behavior.
- Structured search remains session-only and read-only toward KWin, layout,
  and persistence state.
- The slice uses public Plasma 6.7+ state and adds no action, binding, setting,
  timer, animation, geometry write, persistence field, private API, or KWin
  fork.

### 1.65.0 (released)

- Let one standalone unquoted `|` separate AND-connected search clauses into
  up to four alternative groups; a window matches when any complete group
  matches.
- Keep quoted and attached pipes literal, including `title:"release | notes"`
  and `title:foo|bar`.
- Reject leading, trailing, consecutive, and fifth alternative groups through
  the existing invalid-query feedback without exposing partial results.
- Cap the total query at 128 Unicode code points and share one eight-clause
  budget across all alternatives.
- Let `Ctrl+Backspace` remove the complete trailing Overview search clause,
  including bare, scoped, excluded, and quoted forms.
- Treat an unfinished trailing quoted clause as one removable unit so the
  shortcut can repair an invalid query without closing the Overview.
- Let `Ctrl+U` clear a non-empty query while keeping the Overview open.
- Preserve the existing unmodified `Backspace` and `Escape` behavior.

Release criteria (met):

- Existing queries retain their case-insensitive AND behavior, while each
  valid alternative independently composes scopes, phrases, and exclusions.
- Malformed alternative syntax fails closed, and literal pipes cannot create
  an unintended group.
- Four groups, the 128-code-point query cap, and the shared clause and field
  limits bound parsing and matching work.
- Clause deletion stays bounded and follows the same structured-search syntax
  used for matching.
- Empty-query shortcuts are safe no-ops and never close the Overview.
- Search editing remains session-only and adds no global binding, setting,
  KWin request, layout or persistence write, private API, or KWin fork.

### 1.66.0 (released)

- Retarget active movement and size interpolation with the configured
  Plasma-scaled duration instead of a separate short interval.
- Keep rapid positive- and negative-coordinate motion on one bounded absolute
  position and translation pair while preserving the current interpolated
  position.
- Retain the first different same-context focus target after workspace-effect
  ownership ends, despite duplicate anchor activation, transient null focus,
  or anchor deletion.
- Detach an already-ending animation ID while its pending end remains counted,
  then track the replacement independently so that end notification cannot
  clear a live sibling or successor or leave a stale transform.
- Preserve close-focus recovery through a transient same-context KWin handoff:
  keep a surviving replacement focused, or restore the captured handoff or MRU
  target if KWin clears it during settlement.

Release criteria (met):

- Rapid alternating focus commands remain bounded and continue from KWin's
  interpolated position under the configured Plasma animation scale.
- Immediate focus after a workspace switch can animate before delayed
  visibility state settles, without leasing an unrelated window.
- Close recovery performs at most the existing bounded settlement and final
  retry and cannot steal focus across outputs, desktops, or activities.
- Settings, shortcuts, logical persistence v4, package identities, and public
  Plasma 6.7+ API use remain unchanged.

### 1.67.0 (released)

- Retarget the coupled KWin Position and Translation components together on
  every rapid logical position change across negative global coordinates, even
  when one component target is unchanged.
- Preserve a provisional same-context close-focus handoff through an interim
  null activation with a separate two-entry non-null activation chain.
- Add 22 unbound actions that send one active window or one complete active
  column to the previous, next, or a numbered desktop without following it.
- Keep source-desktop selection and eligible source focus. Preserve tiled
  single-window extraction, whole-column state, relation-free manual-floating
  frames, and settled minimized passive peers.
- Commit hidden destination ownership without frame writes and reflow it only
  after that desktop becomes visible. Write only the visible source geometry
  during the send transaction.

Release criteria (met):

- Coupled position timelines cannot diverge, jerk adjacent columns apart, or
  briefly expose wallpaper between them during rapid navigation.
- Same-target and unsafe commands perform no mutation, and partial failure
  rolls back only while exact captured ownership remains valid.
- Existing move/follow behavior, default 88 bindings, settings, logical
  persistence v4, and schemas remain unchanged.
- The implementation uses public Plasma 6.7+ APIs and introduces no KWin fork.

### 1.68.0 (released)

- Retarget both active position components when a corrective resize changes a
  moving window's center without changing its frame origin.
- Keep rapid three-column reversals aligned when a partially off-screen window
  receives small application-driven geometry corrections.
- Recover a same-context focus handoff when KWin selects a provisional
  replacement, clears it, and reports the removed window afterward.
- Retain the last visible automatic-floating context through removal so the
  recovery target remains confined to the correct desktop, output, activity,
  and layer.

Release criteria (met):

- A corrective resize cannot leave one column on an older position target or
  expose a persistent wallpaper slot between otherwise adjacent columns.
- Close recovery accepts tiled, manually floating, automatically floating,
  and application-excluded replacements and falls back from an ineligible
  minimized target.
- Recovery remains bounded by the existing settlement and retry path and does
  not poll, cross contexts, or add a timer.
- Settings, shortcuts, schemas, logical persistence v4, and public Plasma 6.7+
  API use remain unchanged.

### 1.69.0 (in development)

- Exclude individual windows from optional geometry transitions by exact,
  case-sensitive KWin caption or window role without excluding their complete
  application class.
- Reclassify a window when its live caption or role changes, while avoiding
  those property reads when the corresponding exclusion set is empty.
- Expose both bounded lists through the transition KCM and nullable Home
  Manager options. Keep system-wide NixOS package installation independent of
  per-user effect settings.

Release criteria:

- Class, caption, and role exclusions share the existing 128-entry,
  255-UTF-8-byte validation and fail closed as one transition policy.
- Configuration reload clears active visual transforms and applies the new
  policy without restarting KWin.
- The batch adds no action, binding, geometry write, layout or persistence
  field, private API, or KWin fork.
