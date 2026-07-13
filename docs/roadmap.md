# Roadmap

Versions 0.1.0, 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, and
1.8.0 are released. The delivered milestones and release criteria below are a
historical record. The remaining post-v1 direction is not a committed release
schedule.

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
- Cycles preset widths in both directions, adjusts width by 10%, toggles full width, expands into available space within shared constraints, and centers either the active column or all fully visible columns.
- Adjusts one window's height by 10%, resets it to weighted automatic sizing, and cycles `1/3`, `1/2`, and `2/3` presets with transactional stack reflow.
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
- Optionally removes application-window decorations independently of layout ownership while preserving pre-existing borderless state, reasserting owned policy, and restoring owned state on disable.
- Applies a global 0–64 logical-pixel tiled-window gap live without mutating layout order, sizing policies, focus, floating frames, or minimized frames.
- Configures a 10%–100% default width for newly admitted columns, fresh cross-context retiles, and explicit reset without changing existing column width policies.
- Configures up to 128 exact `desktopFileName` initial singleton widths, with a
  constant-time admission lookup, global-default fallback, and normal
  constraint clamping. Existing columns remain unchanged.
- Excludes up to 128 exact, case-sensitive `desktopFileName` values from layout
  ownership, with live release and fresh readmission when the policy changes.
- Configures up to 16 strictly increasing column-width presets without changing
  existing widths; a blank configuration retains the built-in exact thirds.
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
- Lets Home Manager write the ten typed settings or generate a portable
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

## 1.9.0 (in development)

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

Release criteria:

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

## Post-v1

Add interaction and presentation features outside the frozen v1 scope without
taking over compositor mechanisms.

- Add visual drop feedback for pointer operations.
- Add tabbed column presentation and matching pointer navigation.
- Add application-specific policies beyond initial column widths and an
  expanded settings UI.
- Add optional visual transitions, layout indicators, and concise diagnostics.
- Keep Plasma's built-in Overview as the compatible baseline.
- Add pointer-driven overview rearrangement only through public KWin and Plasma
  extension APIs; it remains deferred beyond 1.9.0.

The optional overview must remain removable, preserve the authoritative layout state, and fall back cleanly to Plasma's Overview.
