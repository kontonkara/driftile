# Roadmap

Versions 0.1.0, 1.0.0 through 1.9.0, 1.9.1, and 1.10.0 through 1.29.0 are
released. The delivered milestones and release criteria below are a historical
record. Later direction is not a committed release schedule.

Stable 1.29.0 makes existing forward and reverse
window-height preset actions contextual for one eligible manually floating
window. Window-height reset remains tiled-only.

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
- Maintains independent layout state for every `(output, desktop)` context.
- Preserves a deterministic layout order across structural output changes.
- Invalidates stale restore baselines without reviving them when old geometry returns.
- Parks deterministic whole columns when a new multi-output capacity limit no longer fits, preferring non-active columns, then retries waiting windows.
- Focuses adjacent and edge columns, and reorders the active whole column left, right, first, or last with context-local shortcuts and transactional geometry rollback.
- Decreases, increases, or resets the active whole column width with grouped constraints and transactional rollback.
- Reuses width decrease/increase, preset forward/back, and reset to resize an
  eligible manually floating frame through the shared exact-acknowledgement
  transaction with zero tiled mutation.
- Cycles preset widths in both directions, adjusts width by 10%, toggles full width, expands into available space within shared constraints, and centers either the active column or all fully visible columns.
- Adjusts one tiled window's height by 10%, resets it to weighted automatic sizing, and cycles `1/3`, `1/2`, and `2/3` presets with transactional stack reflow. The same decrease and increase actions resize an active manually floating frame by the configured work-area height step.
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
  `desktopFileName` exclusions keep matching applications under KWin's existing
  decoration policy.
- Applies a global 0–64 logical-pixel tiled-window gap live without mutating layout order, sizing policies, focus, floating frames, or minimized frames.
- Configures a 10%–100% default width for newly admitted columns, fresh
  cross-context retiles, and contextual reset without changing existing widths.
- Configures up to 128 exact `desktopFileName` initial singleton widths, with a
  constant-time admission lookup, global-default fallback, and normal
  constraint clamping. Existing columns remain unchanged.
- Excludes up to 128 exact, case-sensitive `desktopFileName` values from layout
  ownership, with live release and fresh readmission when the policy changes.
- Configures up to 16 strictly increasing column-width presets for later tiled
  or manual-floating actions without changing existing widths; a blank
  configuration retains the built-in exact thirds.
- Optionally centers successful horizontal tiled focus navigation without
  changing vertical, floating, layer, or direct application focus.
- Configures a 1–50 percentage-point explicit column-width step without reflowing existing layouts.
- Configures a 1–50 percentage-point explicit window-height step without reflowing existing layouts.
- Treats exposed client minimum and maximum sizes as hard bounds, detects silent changes on visible tracked windows, does not model unexposed X11 increment and aspect hints, and leaves backend enforcement to KWin.
- Runs a deterministic 128-cycle add, focus, minimize, restore, and remove regression with synchronous geometry acknowledgements and bounded scheduler settlement.
- Keeps one shared trailing desktop empty and removes only redundant tails created by the current run.
- Registers compact default shortcuts with `H/J/K/L`, arrow, Home/End, and Page Up/Down aliases.
- Provides a reversible shortcut helper for the bundled defaults and explicit
  JSON v1 profiles; a UI without a Node.js dependency remains future work.
- Lets Home Manager write the sixteen typed settings or generate a portable
  shortcut profile without installing a second KWin package; shortcut claiming
  remains explicit.
- Leaves dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership, separate from manual floating.
- Translates client minimum and maximum sizes to decorated frame bounds for layout validation and column resizing.
- Reinserts an active tiled window before or after a visible same-context target
  on mouse release, and adopts a completed KWin-owned cross-output move into an
  exact visible tiled target. The cross-output path retains destination width,
  resets moved height to automatic, and falls back to ordinary singleton
  admission when the target is unavailable.
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
  gates pass. Exact feature SHA `b858c00` passes CI quality in 2:45, native X11
  in 3:13, and Wayland in 7:06.
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
one active relation-free manually floating window. The fixed `1/3`, `1/2`, and
`2/3` cycle wraps in both directions. Each raw proportional frame height is
`fraction * (workArea.height - gap) - gap`; the start at
`workArea.y + gap` and the end at `start + rawHeight` are snapped to the
assigned output's pixel grid before subtraction. Forward selects the first
resolved height more than one logical pixel above the current frame and wraps
to the first preset. Reverse selects the last resolved height more than one
logical pixel below the current frame and wraps to the last. Window-height
reset remains tiled-only.

The shared manual-floating size transaction applies live decorated constraints
and partial reachability, issues at most one frame request, and commits only
after exact acknowledgement. Width, focus, context, reinsertion anchor, and
every tiled layout remain unchanged; top-left changes only for the minimal
reachability clamp. Automatic, related, minimized, native-state, interactive,
pending, stale, or otherwise blocked active floating targets fail closed
without reaching the tiled path.

Release criteria (met):

- New focused runtime coverage verifies forward and reverse wrapping, all
  three proportional targets, gap-adjusted start/end pixel snapping, preserved
  width, focus, context, reinsertion anchor, unchanged tiled layouts, one
  immediate frame request, and related-window rejection.
- Existing shared manual-floating size coverage continues to verify
  decorated constraints, partial reachability, delayed exact acknowledgement,
  repeated-command serialization, cleanup, exact metadata commits, and stale
  result and pending-target rejection.
- Formatting, type, lint, focused unit, package, Nix evaluation, and Nix build
  gates pass.
- Existing shortcut registration and tiled height-preset coverage is reused
  without a new integration, application, backend, or VM matrix. The slice
  makes no VM validation claim.
- The slice adds no action, binding, setting, schema, persistence behavior,
  helper or overview behavior, KWin API, private API, backend, integration,
  application, or VM matrix.

No other feature belongs to 1.29.0.

## Post-v1

Add interaction and presentation features outside the frozen v1 scope without
taking over compositor mechanisms.

- Add optional visual transitions.
- Keep Plasma's built-in Overview as the compatible baseline.
- Add activity-aware layout ownership as a separate persisted-context milestone.

The optional overview must remain removable, preserve the authoritative layout state, and fall back cleanly to Plasma's Overview.
