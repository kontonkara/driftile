# Architecture

## Data flow

```text
QML bridge -> TypeScript runtime -> core -> reconcile -> KWin
stable layout snapshot -> overview projector -> guarded KWin effect -> KWin focus or desktop selection
```

Events travel from KWin through the bridge into the runtime. Commands and resulting geometry operations travel toward KWin.

## Layers

### QML bridge

- Loads the compiled runtime in the KWin script environment.
- Passes the KWin workspace object to the runtime.
- Hosts QML-only shortcut handlers.
- Keeps the optional touchpad gesture Loader inactive by default; only an
  accepted complete settings snapshot may create or destroy its two handlers.
- Provides event-loop and minimum-delay schedulers for batched work and transition stabilization.
- Runs a two-second watchdog for visible-context geometry and non-minimized tracked-window hard constraints.
- Contains no layout policy; its state store handles only opaque canonical strings.

### Shortcut helper

- Runs outside the KWin runtime and treats KGlobalAccel, including edits made
  through System Settings, as the live shortcut authority.
- Claims either the bundled defaults or a strict JSON v1 profile. Custom
  profiles replace listed action shortcut arrays exactly; omitted actions
  participate only when they must release a requested chord.
- Parses and normalizes a profile before contacting KGlobalAccel, then builds a
  dependency-ordered replacement plan before applying that plan. Cyclic
  reassignment is rejected before the claim writes shortcuts.
- Saves the required before and after topology under `$XDG_STATE_HOME`, verifies
  every write, and rolls an incomplete claim back.
- Releases mutations in reverse order, restores only assignments still matching
  the claim, and preserves later external edits unless forced.
- Does not watch JSON files. A Home Manager profile is portable input to an
  explicit `claim --profile`, not a second live source of shortcut state.

### Nix integration

- Exposes disjoint main and overview outputs from one build. The default output
  remains the main KWin script and shortcut helper.
- Installs either package through NixOS or Home Manager and rejects duplicate
  ownership of the same package ID while allowing independent scopes.
- Maps an optional complete Home Manager settings profile to KDE's native
  KConfig module. Settings and shortcut-profile generation remain available
  without a second package installation.

### Overview companion

- Ships as a separate, disabled-by-default `KWin/Effect` package.
- Reads the opaque layout snapshot twice on activation and accepts only one
  unchanged, current v2 catalog.
- Projects snapshot zero into a baseline-free, immutable view model after exact
  live output, desktop, and window validation.
- Uses only public KWin QML types to enrich live thumbnails and screen context.
- Keeps each rendered thumbnail's direct live window object in its QML delegate;
  the object does not enter projected or persisted state.
- Keeps current-card thumbnail focus direct. A non-current thumbnail first
  revalidates the exact active effect, model, live screen, projected output,
  desktop, window, and activity; off-desktop hidden state is allowed only at
  this stage.
- Accepts a non-current number-gutter click only after revalidating the active
  effect, exact live screen, projected output, and direct desktop object and ID.
- Selects a non-current card through public `KWin.SceneView.currentDesktop`, or
  the guarded single-output `KWin.Workspace.currentDesktop` fallback, and
  requires an exact confirmation. Thumbnail activation then revalidates the
  same window including visible state, requests the exact
  `KWin.Workspace.activeWindow`, and confirms focus.
- Writes only `KWin.Workspace.activeWindow`, public
  `KWin.SceneView.currentDesktop`, or the guarded single-output
  `KWin.Workspace.currentDesktop` fallback. Pre-selection rejection leaves the
  effect open. After confirmed selection, late invalidation or focus rejection
  keeps the selected desktop, closes the stale effect, and performs no rollback.
- Adds no action, binding, setting, schema, private API, timer, move, geometry
  write, membership write, or screen-edge mechanism. It performs no window,
  stacking-order, or layout scan. KWin owns desktop switching and focus.

### TypeScript runtime

- Models eligible windows from every existing output and desktop context.
- Normalizes QML/KWin objects into stable IDs and plain data.
- Batches event bursts, marks dirty contexts, and reconciles only visible desktops.
- Holds initial admission through a one-second signal grace, then plans existing windows as one batch.
- Defers external output and desktop transfers, then re-owns each window in its destination context.
- Suspends geometry writes while KWin owns a window-state transition and resumes after its restored frame stabilizes.
- Captures tiled move intent once, plans a drop from the final cursor position,
  and commits the shared layout transaction only after geometry authority
  stabilizes. A completed KWin-owned move to another visible output may be
  adopted into one exact tiled target; stale or absent targets use ordinary
  destination admission.
- Reuses that finish-only transaction after KWin selects another desktop on the
  same output and changes the window membership. It probes only a pending
  visible destination, leaves the hidden source geometry untouched, and falls
  back to singleton admission when the target is unavailable or invalidated.
- Adds no visual layer, setting, shortcut action, binding, or persistence field
  for cross-desktop adoption.
- Observes a KWin-owned interactive resize under a zero-write lease, captures
  the active column and visible context once, and classifies the accepted final
  frame only after resize ownership settles.
- Adopts only an unambiguous width-only left- or right-edge finish when
  every captured column member remains visible, writable, unsuspended,
  unchanged, and in the same output and desktop. It stages every writable
  same-context target while the captured logical layout remains unchanged, and
  requires two successive exact target samples; target mismatches time out
  after 20 delayed probes.
- Holds one mutation barrier throughout settlement. Success then commits the
  existing fixed-column policy and publishes once. Rejection restores the
  captured model, supersedes attempted target requests with exact rollback
  frames, and releases an exact rollback after 20 matching samples. A rollback
  not confirmed within 40 probes falls back to ordinary deferred recovery.
- Observes output list, geometry, scale, and dock invalidations, then holds writes until two delayed topology snapshots match.
- Detects otherwise silent client-area and hard-constraint changes with visibility-limited fingerprints.
- Replays structural output changes in a stable layout order independent of KWin window-signal order.
- Invalidates stale restore ownership and revalidates multi-output capacity after topology changes.
- Focuses the first or last non-minimized column directly with transactional reveal.
- Reorders the active whole column left, right, first, or last inside one settled context while keeping focus unchanged.
- Resizes the active whole column within grouped window constraints, cycles presets, toggles full width, uses available visible space up to those constraints, centers one or all fully visible columns, and retries waiting capacity after a successful shrink.
- Adjusts one tiled window's height, resets it to weighted automatic sizing, and cycles height presets while reflowing its stack atomically.
- Focuses vertical stack members; reorders, merges, and extracts them while preserving KWin focus.
- Consumes the immediate right column's top member or expels the active column's bottom member through rollback-safe stack edits while retaining focus in the active column.
- Resolves directional output neighbors from logical output geometry and transfers the active column atomically between contexts; secondary actions transfer one tiled window.
- Applies desktop and output mechanisms member-by-member with the active member last, keeps it visible through cross-desktop output moves, commits both core contexts together, and compensates every owned field and frame on failure.
- Maintains one shared trailing empty desktop and performs guarded one-step global reorder requests through a KWin lifecycle adapter.
- Resolves numbered desktop targets against KWin's global list, clamps to the shared empty tail, and reuses the transactional whole-column transfer path.
- Focuses adjacent desktops on the active output, with a global fallback and no wrapping.
- Accepts a desktop reorder only when KWin produces the exact expected same-ID permutation. The operation leaves selections and window memberships unchanged, and the shared empty tail remains pinned.
- Releases explicitly floating windows from continuous geometry ownership and restores their anchored layout slots on return.
- Translates or work-area-centers one active manually floating frame through a shared guarded command without a window or layout scan, preserving its reinsertion anchor and every tiled context.
- Transfers one active relation-free floating window between desktops through a dedicated KWin transaction without changing tiled state or frame geometry.
- Remembers the last non-minimized tiled and floating focus per context, switches layers, and resolves floating navigation from live frame geometry without changing frames during floating navigation.
- Skips minimized tiled slots, fully minimized columns, and minimized floating candidates during focus resolution without taking ownership of KWin's minimize mechanism.
- Extracts a regular stack member transactionally before requesting native fullscreen through KWin; application-driven fullscreen commits for the active window use the same persistent singleton model without writing the fullscreen frame.
- Extracts a regular stack member transactionally before requesting native maximize-to-edges through KWin; rejected requests restore the exact model, frames, focus, and runtime ownership.
- Keeps dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership in state separate from manual floating.
- Releases a managed window that gains an automatic-floating role without restoring its old frame, then readmits it when the role clears and it remains eligible.
- Optionally claims borderless state for application windows independently of
  layout ownership, reasserts owned state after policy changes, and restores
  only decoration state that it owns.
- Consults a separate exact, case-sensitive `desktopFileName` exclusion set
  before each borderless claim. Missing and empty IDs remain eligible, and no
  resource, role, or other identity fallback is used. The policy covers every
  otherwise eligible tiled, floating, dialog, transient, and utility window.
- Reconciles borderless exclusions and `desktopFileName` changes live without
  geometry writes, focus changes, or logical-layout or layout-persistence
  changes. Global disable dominates the set, and disable or unload restores only
  owned decoration state.
- Delivers an atomic settings change in ownership-safe order: disable the
  global policy before replacing exclusions, or install the new exclusions
  before enabling the global policy.
- Defers live gap changes across structural transactions, then reflows dirty visible contexts and retries capacity admissions under one settled value.
- Applies default-width changes before admission without changing existing column width policies; newly admitted columns, fresh cross-context retiles, and explicit reset read the current policy.
- Parses at most 128 application-width entries into an exact
  `desktopFileName` lookup. A newly created or freshly admitted singleton reads
  that map in constant time, falls back to the global default, and remains
  subject to the normal window-constraint clamp. Existing columns do not read
  the map again.
- Parses at most 128 application tiling exclusions into an exact case-sensitive
  `desktopFileName` set. Admission uses one constant-time lookup; a live policy
  replacement scans the observed window set once and schedules only windows
  whose membership changed.
- Reuses the same exact-ID decoder for application borderless exclusions: at
  most 65,664 document characters, 512 raw characters per line, 128 unique
  nonblank entries, and 255 UTF-8 bytes per trimmed ID. Blank lines are ignored;
  duplicates, controls, invalid UTF-16, and oversized input fail the complete
  settings snapshot. Valid entries are held in canonical sorted order with
  constant-time membership lookup.
- Replaces at most 16 column-width presets atomically without layout work;
  existing columns retain their concrete widths and later preset actions read
  the new cycle.
- Optionally centers the destination of successful horizontal tiled focus
  navigation inside the existing focus transaction. Other focus paths retain
  minimal reveal and a failed center preview falls back without rejecting focus.
- Applies width- and height-step changes in constant time without scheduling layout work; only later matching decrease and increase actions read each value.
- Rolls back speculative startup admission as one batch when settled work-area geometry cannot produce valid frames, then keeps fingerprinted waiting ownership for a later topology recovery.
- Isolates failed context solves at public and scheduled reconcile boundaries, keeps each blocked context dirty without immediate retry, and continues reconciling healthy contexts.
- Owns startup, reconfiguration, and shutdown sequencing.

### Core

- Contains the platform-independent layout and workspace policies.
- Stores windows by ID and layouts by `(outputId, desktopId)`.
- Produces deterministic desired state from events and commands.
- Has no QML or KWin dependencies.

### Reconcile

- Compares desired state with the latest observed KWin state.
- Emits the smallest valid set of geometry operations.
- Reflows dirty, visible contexts only.
- Is idempotent: the same observed and desired state produces no further work.

### KWin

- Remains the source of truth for live windows, outputs, desktop order and selection, focus, and window state.
- Owns the virtual-desktop reordering mechanism.
- Owns interactive pointer move and resize sessions.
- Applies geometry and validates window constraints.
- Reports external changes back through signals.

## State model

```text
RuntimeState
  windows: Map<WindowId, ManagedWindow>
  contexts: Map<ContextKey, LayoutContext>
  dirtyContexts: Set<ContextKey>
  gap: number
  centerFocusedColumn: boolean
  columnWidthStep: number
  windowHeightStep: number
  defaultColumnWidth: ColumnWidth
  applicationColumnWidths: Map<desktopFileName, percent>
  applicationTilingExclusions: Set<desktopFileName>
  applicationBorderlessExclusions: Set<desktopFileName>
  pendingDefaultColumnWidth: ColumnWidth | null
  pendingGap: number | null
  pendingWindowSyncs: Set<WindowId>
  waitingWindowIds: Map<ContextKey, Set<WindowId>>
  floatingWindows: Map<WindowId, { placement, sourceContextKey }>
  automaticFloatingWindows: Set<WindowId>
  lastTiledFocus: Map<ContextKey, WindowId>
  lastFloatingFocus: Map<ContextKey, WindowId>
  windowBorderRestore: Map<WindowId, { noBorder, clientFrame, frame }>
  requestedSuspensions: Map<WindowId, Set<StateReason>>
  suspendedWindows: Set<WindowId>
  toggleGeometryTransitions: Map<WindowId, { contextKey, expectedFrame, settlementArmed }>
  desktopLifecycle: { ownedDesktopIds, pendingMutation }
  topologyBarrier: { revision, affectedOutputs, stableSample }
  pointerMoveIntent: { contextKey, layoutSnapshot, participants, finalCursor, sourceOutput, sourceDesktop, externalDrop }
  pointerResizeIntent: { contextKey, layoutSnapshot, participants, initialFrame, acceptedFrame, activeColumnId }
  pointerResizeSettlement: { contextKey, targets, rollbackFrames, phase, attempts, stableSamples }
```

`LayoutContext` owns columns, per-window automatic weights or fixed/preset heights, viewport offset, and the last applied geometry fingerprint. A managed window owns an optional decoration-independent client restore baseline plus the exact frame observed at capture time. A manually floating window remains observed but has no layout or geometry owner; its detached placement records stable anchors for reinsertion. An automatically floating window has no layout slot, floating anchor, waiting entry, suspension, or retry state. Role-based and configured application exclusions share this ownership path; the bounded configured lookup is constant time. A minimized tiled window remains suspended in its exact logical slot, while a minimized manually floating window keeps its exact detached frame. Reconcile excludes suspended windows until KWin releases geometry authority. Waiting windows have no layout owner. KWin objects never enter core state.

## Persistence boundary

The persistence foundation is a bounded, versioned JSON codec in core. A v2
document keeps at most four most-recent output-topology snapshots under one
4 MiB limit. Each snapshot records the complete output descriptor set, including
outputs without owned windows, plus a validated v1 logical state. The current
snapshot may keep context-guarded restore baselines; every historical snapshot
is baseline-free. Bare v1 documents remain valid startup input and migrate on
the next successful publication. Older runtimes see v2 as unsupported and keep
it write-locked.

Logical state stores output and window descriptors, column and stack order,
width and height policies, viewport offsets, full-width restore widths and
viewport positions,
manual-floating reinsertion anchors, and context-guarded tiled restore
baselines. The catalog and nested state codecs reject unknown fields, invalid
references, ambiguous output identities, impossible layout policies, oversized
input, and unsupported versions without mutating live state.

After topology settlement, an additive output return may select a matching
historical snapshot. Restoration is output-atomic and tiled-only: every eligible
historical window must already be on the returned output, geometry must pass a
second live preflight, and any mismatch falls back to normal topology recovery.
Matched outputs retain ownership, column order, widths, active column, and
focus; their viewport may clamp only after departed columns are removed.
Historical floating state and restore baselines are never applied during this
path.

Transient runtime state is never durable: expected layout frames, decoration ownership, focus caches, waiting and suspension state, schedulers, probes, and transaction tokens are excluded. A context fingerprint is stored only with original client and frame restore baselines; a mismatch discards those baselines without rejecting the logical layout. A window `liveId` is an exact same-session reload hint only. The pure matcher gives that identity precedence, then accepts public KWin session descriptors only when both sides are globally unique; missing, duplicate, or overlapping matches remain unmatched. Output matching prefers a unique display serial tuple and otherwise requires the available connector metadata exactly. Desktops require their exact KWin IDs.

The horizontal-resize intent is also transient. It adds no persistence
schema field, setting, action, binding, feedback surface, or compositor
mechanism.

Canonical capture records bounded public KWin window identity and output
manufacturer, model, and serial metadata when available. Empty, oversized, or
control-bearing optional values are omitted before they reach the codec.

A matching restore baseline is accepted only when its client frame, frame, and
border-adjusted restore frame remain inside the current work area and the final
frame satisfies the live size constraints. An unsafe baseline is discarded
without rejecting the logical layout.

A manually floating window tracks its live context separately from its original
reinsertion anchor. When it is captured in another context, persistence derives
a deterministic local fallback without mutating the runtime anchor. The
historical cross-context anchor remains runtime-only and is not recovered across
a reload made while the window is away.

Directional movement and contextual centering share one guarded single-window
frame transaction. It performs no window, column, or layout enumeration, accepts
only an exact logical-frame acknowledgement, and commits floating metadata only
after that acknowledgement. A still-owned inexact result may receive one ordered
original-frame compensation request; stale ownership, context, or topology stops
further writes.

At a stable runtime boundary, Driftile can now capture the complete durable
model as one canonical codec document without changing layout or KWin state.
Invalid ownership, stale live references, and in-flight structural work fail
closed. Stale floating neighbors are reduced to safe surviving anchors and the
index fallback.

The runtime publishes after stable work changes logical state or settles a new
complete output topology; identical state and topology are suppressed. Teardown
consumes one already-queued runtime pass through normal reconciliation before
the final capture; remaining blockers preserve the previous document. The QML
package queues snapshots in an opaque `QtCore.Settings` store with an explicit
file location, one-shot write debounce, duplicate suppression, and synchronous
final flush before runtime teardown. An isolated real-KWin probe imports the
store and verifies an escaped Unicode JSON document with its trailing newline
across immediate declarative-script unload and reload on Wayland and X11.

The hydration planner first resolves every persisted window and output by exact
live identity. If an identity is missing, it attempts one complete descriptor
match. A window fallback requires at least one globally unique pair formed from
a stable application namespace and a tag or window role; incidental resource
names cannot make a duplicated pair safe. Output fallback requires the unique
serial tuple when one exists, otherwise the exact connector and available
metadata. Ambiguous, weak, partial, or conflicting matches reject the whole
document. Restore baselines belonging to replaced window objects are discarded,
while exact-ID baselines remain eligible.
After bounded startup stabilization, the runtime waits up to five seconds for
missing strongly identifiable windows. Admissions, geometry, decorations,
capture, and publication remain blocked while exactly one retry is pending. A
complete candidate must remain identical for two resume-timer samples; unrelated
extra windows are excluded from that quiet fingerprint. Timeout or a terminal
mismatch releases normal admission without publishing over the loaded state.
The runtime builds the accepted plan and a fresh layout model off-side. It
revalidates live window identity, ownership,
constraints, context geometry, and topology immediately before an atomic
in-memory commit; KWin geometry writes begin only through normal reconciliation
after the commit. Extra live windows then use normal admission. Minimized or
otherwise suspended windows and hidden contexts retain logical ownership
without startup frame writes. A suspended tiled window acquires a new per-run
restore baseline only when no context-compatible durable baseline exists. The
fallback requires two stable writable resume samples and runs before the first
layout write. A corrupt, stale, or incompatible document cannot leak partial
ownership or replace its stored source during automatic startup work.
Unsupported future versions remain write-locked for the run. Oversized
documents use the same conservative lock because their version cannot be
inspected safely within the codec bound.

## Reconciliation rules

- Read usable geometry from KWin work areas; never infer panel bounds.
- Apply a context only when its desktop is visible on its output.
- Keep focus commands inside the active window's context, select one live target, skip minimized slots and fully minimized columns without wrapping, and reveal its column with the smallest required scroll.
- Treat minimization as the only skippable focus suspension; commands that encounter another suspension blocker remain no-ops.
- Commit tiled focus and viewport changes only after KWin accepts the same live target; rejection or a synchronous authority change restores the prior focus, model, and frames.
- Keep adjacent and direct-edge column reorders inside the active context and roll back the exact model order if geometry application cannot complete.
- Apply active-column width changes transactionally, preserving focus, grouping, and the prior width on failure.
- Pin a full-width active column between equal outer gaps, keep adjacent columns outside the work area, and restore its prior width and viewport in one transaction.
- Expand only a fully visible active column up to its shared window constraints, keep every other fully visible column on screen, and commit its width and viewport change atomically.
- Center a fully visible column group with a viewport-only transaction; permit signed viewport offsets when exact centering requires them.
- Preserve signed viewport positions across width and structural changes while the active column remains visible; reveal it only after it leaves the work area.
- Keep at most one fixed or preset height in a stack. When another member is changed, preserve the remaining members' visible proportions as automatic weights and distribute the remaining work-area height among them.
- Apply active-window height changes transactionally across the affected stack, preserving focus, order, width, and every prior height state on failure.
- Apply stack edits with compare-and-swap model rollback and exact compensating frame writes after partial failure. Pin every writable ID to its captured KWin object so a same-ID replacement never receives stale writes. Rebase rollback across authoritative participant removal or context departure only when every surviving column, member, width, and height state still matches the applied edit.
- Reset a consumed or expelled member to automatic height, preserve surviving member order and height state, and keep the active column selected.
- Resolve direct stack insertion inside the active context, skipping singleton columns without wrapping and preserving every intermediate column. Skipped columns are nonparticipants.
- Permit a visible active member to insert past settled minimized passive peers in the participating source and target columns, including a fully minimized target stack. Preserve passive logical order, height state, minimized state, and externally changed hidden frames without geometry writes.
- Reject direct insertion when either participating column contains a fullscreen, maximized, native-tiled, restore- or toggle-settling, or other non-minimize blocker. Cancel and roll back if a participant completes a state round trip during reflow.
- After KWin completes physical output and desktop movement, adopt one active
  normal tiled window into the exact visible target under the cursor. Use the
  target midpoint for before-or-after insertion, retain the destination width,
  reset the moved height to automatic, and commit both contexts together. If
  the target is empty, stale, ambiguous, or changes during the transaction,
  leave KWin's move intact and use ordinary destination singleton admission.
- After KWin selects a different visible desktop on the same output and moves
  the active window there, use the same midpoint, destination-width, automatic-
  height, and singleton-fallback semantics. Probe a pending destination only a
  bounded number of times, apply no hidden-source geometry, and isolate every
  unrelated context. If destination writes partially apply, compensate them
  exactly before singleton admission.
- For finish-only horizontal resize adoption, compare the initial and accepted
  final frames only after KWin finishes. Accept exactly one changed horizontal
  edge with unchanged vertical edges, and require the same settled visible
  context plus an unchanged, fully writable active column.
- Keep the captured logical layout unchanged while staging every writable
  same-context target. Require two successive exact target samples, time out a
  target mismatch after 20 delayed probes, and reject competing layout
  mutations until settlement ends.
- Commit the accepted width as the existing fixed-column policy only after
  target settlement, preserve order, height policies, focus, and unrelated
  contexts, and publish once. On rejection, supersede attempted target requests
  with captured rollback frames, release after 20 exact rollback samples, and
  defer ordinary recovery when rollback is not confirmed within 40 probes.
- Transfer either the active column or one secondary window between existing desktops through an immutable two-context preview, then commit only after KWin accepts every desktop mechanism, focus, and destination geometry.
- Transfer either the active column or one secondary window between outputs through the same preview, then commit only after KWin accepts every output and desktop mechanism plus both visible layouts.
- Preserve whole-column member order and width, apply the active member last, and restore all owned mechanisms and frames if any batch step fails.
- Apply floating transitions from immutable previews, commit ownership only after every geometry request succeeds, and defer later context writes until asynchronous frames settle.
- Switch focus between tiled and floating layers by resolving one deterministic target in each layer. Minimized slots are skipped, but a selected target with any other suspension or geometry-authority blocker fails closed instead of falling through. A tiled target in another column is revealed transactionally before KWin receives focus; ordinary rejection restores the exact model and geometry, while topology supersession uses normal deferred recovery.
- Resolve floating `H/J/K/L` by the smallest strictly positive center delta on the requested axis and `Home/End` by frame-x extremes, scanning only live, non-minimized same-context floating windows.
- Resolve the existing center-column action contextually: a manual-floating target uses the assigned output and desktop work area, exact logical midpoints, and work-area origins for oversized dimensions; a non-floating target keeps the tiled centering path. A blocked manual-floating target never falls through to tiled behavior.
- Leave dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership. Commands that require layout ownership are no-ops when one is active; desktop transfer may move one relation-free floating window.
- If a managed window gains an automatic-floating role, remove its slot without writing a stale restore frame or disturbing unrelated order, widths, or viewport state. Re-admit it through normal admission after the role clears.
- Allow horizontal overflow and viewport scrolling when KWin reports one output.
- Queue a candidate window unmanaged if it would introduce overflow with multiple outputs, then retry it when that context gains capacity.
- When a topology change invalidates existing multi-output capacity, park whole writable columns with a reachable anchor inside the work area and release them to the waiting queue. Preserve the active column when possible; choose the farthest non-active column first and the rightmost on a tie.
- Release externally transferred windows from their old context before admitting them to the destination context.
- Translate client minimum and maximum sizes to frame bounds by adding current nonnegative decoration extents before emitting geometry or resizing a column. Treat malformed bounds conservatively.
- Preserve a tiled window's exact logical slot and a manually floating window's exact detached frame while KWin minimizes and restores it.
- Allow a visible active member to reorder vertically across settled minimized slots without writing hidden frames; reject every other passive suspension blocker.
- Allow horizontal extraction of a visible active member past settled minimized source peers without writing hidden frames; retain the existing constraint-validated singleton merge policy.
- Allow explicit consume to pull a visible immediate-right top member past settled minimized passive members in the source or target column without hidden frame writes. Reject the transaction if focus leaves the active member or if either required visible member or any participant changes identity, context, or minimized state during reflow. Preserve the external focus or lifecycle transition while rolling back only the command's structural edit.
- Allow explicit expel to move a visible bottom member past settled minimized passive peers without hidden frame writes. Keep a non-bottom active member focused; if the bottom member is active, require its visible immediate predecessor without searching for a fallback. Confirm that focus before creating or applying the structural edit, then revalidate the exact snapshot, KWin objects, and minimized states. Bound asynchronous confirmation and reject reentrant commands until it finishes.
- Permit stacked native-state extraction past settled minimized peers while retaining their slots without hidden frame writes.
- Permit whole-column desktop and output transfers with settled minimized passive members while keeping those members in the logical transaction and excluding them from layout geometry writes.
- Permit a secondary single-window desktop or output transfer to extract the visible active member past settled minimized passive members in the same source column. Keep each retained member as a non-moving transaction guard, preserve its logical slot, height state, minimized state, and frame, and issue no desktop, output, or geometry write for it. Revalidate its identity, context, state, and frame before commit or compensation. Reject minimized windows elsewhere in the source or target context and other undocumented hidden-member edits.
- A native fullscreen command extracts a member of a regular stack into an immediate right singleton before calling KWin. The new column copies the source width, and leaving fullscreen does not merge it back.
- A native maximize command extracts a member of a regular stack into an immediate right singleton before calling KWin. The new column copies the source width, and unmaximize does not merge it back.
- Require a stable restored frame before resuming writes or rebasing a transferred window.
- Freeze admission, focus commands, and affected-context geometry writes until two successive delayed topology snapshots match.
- Treat output-list, output-geometry, output-scale, and dock changes as topology invalidations.
- Permanently clear a context's original-frame restore baselines for the current run when its geometry fingerprint changes or its output object is replaced. Returning to the old geometry does not revive them.
- Treat external focus and window output or desktop changes as authoritative events.
- Reorder only the desktop selected on the active output, by one global position without wrapping, and reject unavailable, failed, or unexpected KWin results.
- Never move the shared trailing empty desktop or allow another desktop to cross it.
- Create a desktop only after two matching occupancy snapshots show the shared tail is occupied.
- Remove only a current-run-owned tail after two matching snapshots show it and its predecessor are empty and no output selects it.

## Engineering constraints

- No periodic workspace or stacking-order rescan. Lifecycle is signal-driven, with an initial snapshot and one additive discovery at the end of the bounded startup grace, bounded per-window state and floating-transition probes, and a two-second client-area plus hard-constraint fingerprint check limited to visible tracked windows and contexts because KWin exposes no complete change signal for either surface.
- Desktop lifecycle snapshots scan observed windows only after relevant signals; they never run on a timer.
- Structural output recovery performs one bounded workspace resynchronization after the topology settles.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Reflow affected visible contexts only; defer hidden desktops until they become visible.
- Treat a gap change as layout policy, not a model or topology mutation; preserve logical state and defer it until structural and capacity transactions settle.
- Commit a default-width change only at the same safe runtime boundary and leave existing managed width policies unchanged. Retrying a waiting admission may add a constrained column and update that viewport and its frames.
- Replace the bounded application-width lookup atomically on reconfiguration.
  Do not revisit existing columns; schedule only contexts with waiting windows
  that may create a fresh singleton.
- Replace the bounded `ApplicationBorderlessExclusions` set atomically.
  Reconfiguration and application-identity signals reconcile decoration
  ownership without geometry writes, focus changes, or model or
  layout-persistence changes; interactive resize and settlement retain priority.
- Replace the bounded column-width preset cycle without changing model values,
  frames, viewport state, or focus.
- Treat horizontal-focus centering as future command policy. Reconfiguration
  performs no layout work, and rejected focus restores the prior viewport.
- Treat resize-step changes as future command policy: preserve every current model value, frame, viewport, and focus target.
- Never leave partial layout ownership after a failed startup solve, and never immediately reschedule an unchanged unusable work area.
- Keep a managed context unchanged and dirty when its settled work area cannot produce valid frames; a failure in one context must not block another.
- Do not write unchanged properties.
- Keep default core operations linear in the affected context, not the whole
  workspace. Automatic-height allocation indexes member bounds once before
  distributing the affected stack.
- Keep horizontal-resize capture, finish validation, reflow, and compensation
  `O(V)` in the visible context, with no workspace scan or persistent growth.
- Bound horizontal-resize target-mismatch detection to 20 delayed probes and
  rollback recovery to 40 probes, including a 20-sample exact rollback quiet
  period.
- Gate critical runtime and geometry paths with the deterministic operation
  counts documented in [Performance](performance.md).

## Current constraint limits

- KWin does not expose a complete change signal for minimum, maximum, and resizeability metadata. Signaled changes are reclassified immediately; a cached visible-window probe catches silent changes, and every geometry write still rereads the live bounds.
- KWin reports application-driven fullscreen only after saving restore geometry. Leaving it can briefly expose the former stack frame before Driftile settles the extracted singleton.
- On Wayland, KWin captures restore geometry before notifying scripts about an application-driven maximize. Unmaximize can briefly expose the former stack frame before Driftile settles the extracted singleton.
- The Plasma 6.7 workspace `KWin::Window` API used by Driftile does not expose X11 base size, resize increments, aspect bounds, the per-window strict-geometry rule, or a constraint oracle. Driftile therefore does not quantize its layout model to these hints. KWin can still constrain an applied frame according to backend policy, including native X11 character-cell sizing.
- For Driftile to model strict tiled compliance with unexposed X11 hints, KWin must provide a future public API. Driftile does not infer them from application identity or observed sizes.
- KWin 6.7 exposes no public wheel-axis event API to declarative scripts, so
  global wheel input remains deferred.

## Verification

- Verify strict shortcut-profile decoding, semantic identities, exact listed
  replacements and unbinds, omitted-action handling, dependency ordering,
  cycle rejection, rollback, release, and CLI option boundaries.
- Evaluate Home Manager's settings-only and shortcut-profile modes, including
  exact KConfig values and generated JSON, without adding the package to the
  user's environment.
- Unit-test core policies with plain fixtures.
- Test reconcile output for minimality and idempotence.
- Replay window lifecycle and output or desktop transfer sequences.
- Verify window-state ownership, cancellation races, stable resumption, and slot reservation.
- Verify minimized tiled-slot and manual-floating-frame retention, horizontal and vertical focus skipping, vertical reorder, horizontal extraction, and explicit consume across minimized passive slots, layer switching, no-wrap boundaries, fail-closed non-minimize suspension blockers, reentrant rollback, and all-member transaction guards.
- Verify shortcut and application-driven stacked fullscreen extraction past settled minimized peers, KWin-owned geometry, persistent singleton restoration, deferred Wayland commits, and exact rejection rollback.
- Verify shortcut and application-driven stacked maximize extraction past settled minimized peers, KWin-owned geometry, persistent singleton restoration, and exact rejection rollback.
- Verify adjacent and direct-edge active-column reorder, width adjustments, width presets, full width, available-width expansion, single-column and visible-group centering, signed viewport offsets, constraint bounds, and transactional rollback.
- Verify per-window 10% height changes, automatic reset, forward and reverse height presets, weighted stack redistribution, singleton sizing, and exact rollback.
- Verify decorated client-to-frame constraint translation and conservative handling of malformed bounds.
- Verify cached visible-window detection for silent hard-bound changes, exact recovery after relaxation, and no duplicate work for unchanged fingerprints.
- Verify with unit fixtures that unexposed X11 metadata does not quantize the layout model or weaken hard minimum and maximum checks, with XWayland that an exact off-lattice frame remains accepted, and with native X11 that grid-aligned frames survive a real resize and reset cycle.
- Verify automatic KWin ownership, command no-ops, late role changes, manual-floating separation, and safe readmission.
- Verify context-local tiled/floating focus memory for manual and automatic floating windows without geometry writes.
- Verify directional and edge floating focus, stacking tie-breaks, no-wrap boundaries, and exact frame immutability.
- Verify vertical focus, member reorder, contextual merge and extraction, suspended members, and structural rollback.
- Verify direct insertion past settled minimized source and target peers, fully minimized target stacks, skipped-singleton nonparticipation, zero hidden-frame writes, authoritative external frame changes, state-round-trip cancellation, exact rollback, and fail-closed blockers.
- Verify cross-output pointer adoption before and after a visible target,
  destination width and automatic height, both signal orders, exact
  compensation, and ordinary singleton fallback for empty, stale, ambiguous,
  or raced targets without output or desktop mechanism writes.
- Verify same-output cross-desktop adoption across the output-local and global
  desktop resolvers and both membership-before-finish and
  finish-before-membership event orders. Cover bounded pending settlement,
  initially unavailable or invalidated singleton fallback, exact compensation
  before fallback, zero hidden-source writes, and unrelated-context isolation.
- Focused observer cases cover direct and fallback start/finish delivery,
  duplicate suppression, and cloned frame capture. Pure planner and runtime
  cases cover exact horizontal-edge classification, the zero-write interactive
  lease, all same-context targets, delayed configure acceptance, the settlement
  mutation barrier, fixed-width adoption, fail-closed races, one publication,
  late-configure rollback, focus replay, native-state lease protection, `O(V)`
  context-local work, restoration, and partial-write compensation.
- Verify explicit top-member consume and bottom-member expel, minimized passive-member policy, synchronous and deferred focus handoff, reentrant command rejection, width rules, height-state reset, boundaries, and rollback.
- Verify the settled topology barrier, output replacement and removal, dock and silent work-area invalidations, sticky restore invalidation, and deterministic capacity recovery.
- Verify independent contexts with native Wayland and XWayland windows on two virtual outputs and native X11 windows on the X11 backend.
- Verify whole-column and secondary directional transfers, retained minimized source peers with zero desktop, output, and geometry writes, fail-closed minimized windows outside that source column, no-wrap boundaries, per-output desktop selection, focus preservation, cancellation races, and exact two-context compensation.
- Verify numbered desktop selection and whole-column transfer, tail clamping, same-target no-ops, and shared-tail renewal.
- Verify manual and automatic floating desktop transfer, exact frame preservation, related-window guards, tiled-state isolation, and compensation.
- Verify bounded application-borderless exclusion decoding, canonical sorting,
  exact case-sensitive lookup without fallbacks, missing and empty identities,
  all eligible window roles, global-disable dominance, policy reassertion, live
  settings and identity changes without geometry writes, focus changes, or
  layout-state or layout-persistence changes, plus ownership-safe global-disable
  and unload restoration.
- Verify live gap reflow, bounds, no-op coalescing, hidden-context deferral, capacity retry, and zero writes to minimized, floating, or excluded windows.
- Verify default-width bounds, coalescing, structural deferral, existing-layout preservation, constrained waiting admission, newly admitted-column policy, and transactional reset.
- Verify bounded one-entry-per-line application-width decoding, exact
  `desktopFileName` lookup, duplicate rejection, global-default fallback,
  constant-time admission lookup, existing-column preservation, and live
  constraint clamps for new singleton columns.
- Verify bounded application-exclusion decoding, exact case-sensitive lookup,
  startup ownership, live release and fresh readmission, native-state blockers,
  persistence omission, and zero writes to excluded frames.
- Verify width-step bounds, no-write live changes, exact percentage-point actions, hard-bound clamps, and rollback.
- Verify height-step bounds, no-write live changes, exact stack redistribution, decorated constraints, physical-pixel clamps, and rollback.
- Verify one-step desktop reordering in both directions, all four default shortcut handlers, boundary and tail no-ops, unavailable or rejected mechanisms, wrong permutations, and the pinned tail. Unit and multi-output integration coverage preserve every output selection; integration and visible-VM coverage preserve live IDs, memberships, focus, and frames.
- Verify shared trailing-desktop creation, guarded removal, silent mutation rejection, and preservation of external desktops.
- Exercise live output reconfiguration against an isolated real KWin session.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
