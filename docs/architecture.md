# Architecture

## Data flow

```text
QML bridge -> TypeScript runtime -> core -> reconcile -> KWin
```

Events travel from KWin through the bridge into the runtime. Commands and resulting geometry operations travel toward KWin.

## Layers

### QML bridge

- Loads the compiled runtime in the KWin script environment.
- Passes the KWin workspace object to the runtime.
- Hosts QML-only shortcut handlers.
- Ships a separate setup helper that transactionally claims KGlobalAccel keys
  and restores displaced assignments; it is not part of the KWin runtime.
- Provides event-loop and minimum-delay schedulers for batched work and transition stabilization.
- Runs a two-second topology watchdog for visible contexts.
- Contains no layout policy or durable state.

### TypeScript runtime

- Models eligible windows from every existing output and desktop context.
- Normalizes QML/KWin objects into stable IDs and plain data.
- Batches event bursts, marks dirty contexts, and reconciles only visible desktops.
- Holds initial admission through a one-second signal grace, then plans existing windows as one batch.
- Defers external output and desktop transfers, then re-owns each window in its destination context.
- Suspends geometry writes while KWin owns a window-state transition and resumes after its restored frame stabilizes.
- Observes output list, geometry, scale, and dock invalidations, then holds writes until two delayed topology snapshots match.
- Detects otherwise silent client-area changes by fingerprinting visible contexts only.
- Replays structural output changes in a stable layout order independent of KWin window-signal order.
- Invalidates stale restore ownership and revalidates multi-output capacity after topology changes.
- Focuses the first or last column directly with transactional reveal.
- Reorders the active whole column left, right, first, or last inside one settled context while keeping focus unchanged.
- Resizes the active whole column within grouped window constraints, cycles presets, toggles full width, uses available visible space up to those constraints, centers one or all fully visible columns, and retries waiting capacity after a successful shrink.
- Adjusts one tiled window's height, resets it to weighted automatic sizing, and cycles height presets while reflowing its stack atomically.
- Focuses vertical stack members; reorders, merges, and extracts them while preserving KWin focus.
- Resolves directional output neighbors from logical output geometry and transfers the active column atomically between contexts; secondary actions transfer one tiled window.
- Applies desktop and output mechanisms member-by-member with the active member last, keeps it visible through cross-desktop output moves, commits both core contexts together, and compensates every owned field and frame on failure.
- Maintains one shared trailing empty desktop through a guarded KWin lifecycle adapter.
- Focuses adjacent desktops on the active output, with a global fallback and no wrapping.
- Releases explicitly floating windows from geometry ownership and restores their anchored layout slots on return.
- Remembers the last tiled and floating focus per context and switches layers without changing layout state.
- Requests native fullscreen only through KWin; suspension retains the layout slot and resumes ownership after the restored frame settles.
- Requests native maximize-to-edges only through KWin and uses the same suspension and stable-restore path.
- Keeps dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership in state separate from manual floating.
- Releases a managed window that gains an automatic-floating role without restoring its old frame, then readmits it when the role clears and it remains eligible.
- Optionally claims borderless state for application windows independently of layout ownership, reasserts owned state after policy changes, and restores only decoration state that it owns.
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

- Remains the source of truth for live windows, outputs, desktops, focus, and window state.
- Applies geometry and validates window constraints.
- Reports external changes back through signals.

## State model

```text
RuntimeState
  windows: Map<WindowId, ManagedWindow>
  contexts: Map<ContextKey, LayoutContext>
  dirtyContexts: Set<ContextKey>
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
```

`LayoutContext` owns columns, per-window automatic weights or fixed/preset heights, viewport offset, and the last applied geometry fingerprint. A managed window owns an optional decoration-independent client restore baseline plus the exact frame observed at capture time. A manually floating window remains observed but has no layout or geometry owner; its detached placement records stable anchors for reinsertion. An automatically floating window has no layout slot, floating anchor, waiting entry, suspension, or retry state. A suspended window keeps its layout slot, but reconcile excludes it until KWin releases geometry authority. Waiting windows have no layout owner. KWin objects never enter core state.

## Reconciliation rules

- Read usable geometry from KWin work areas; never infer panel bounds.
- Apply a context only when its desktop is visible on its output.
- Keep focus commands inside the active window's context.
- Keep adjacent and direct-edge column reorders inside the active context and roll back the exact model order if geometry application cannot complete.
- Apply active-column width changes transactionally, preserving focus, grouping, and the prior width on failure.
- Expand only a fully visible active column up to its shared window constraints, keep every other fully visible column on screen, and commit its width and viewport change atomically.
- Center a fully visible column group with a viewport-only transaction; permit signed viewport offsets when exact centering requires them.
- Preserve signed viewport positions across width and structural changes while the active column remains visible; reveal it only after it leaves the work area.
- Keep at most one fixed or preset height in a stack. When another member is changed, preserve the remaining members' visible proportions as automatic weights and distribute the remaining work-area height among them.
- Apply active-window height changes transactionally across the affected stack, preserving focus, order, width, and every prior height state on failure.
- Apply stack edits with compare-and-swap model rollback and exact compensating frame writes after partial failure.
- Resolve direct stack insertion inside the active context, skipping singleton columns without wrapping and preserving every intermediate column.
- Transfer either the active column or one secondary window between existing desktops through an immutable two-context preview, then commit only after KWin accepts every desktop mechanism, focus, and destination geometry.
- Transfer either the active column or one secondary window between outputs through the same preview, then commit only after KWin accepts every output and desktop mechanism plus both visible layouts.
- Preserve whole-column member order and width, apply the active member last, and restore all owned mechanisms and frames if any batch step fails.
- Apply floating transitions from immutable previews, commit ownership only after every geometry request succeeds, and defer later context writes until asynchronous frames settle.
- Switch focus between tiled and floating layers only when both have a live member in the active context; validate remembered targets lazily and leave layout state untouched.
- Leave dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership. Driftile layout commands are no-ops when one is active.
- If a managed window gains an automatic-floating role, remove its slot without writing a stale restore frame or disturbing unrelated order, widths, or viewport state. Re-admit it through normal admission after the role clears.
- Allow horizontal overflow and viewport scrolling when KWin reports one output.
- Queue a candidate window unmanaged if it would introduce overflow with multiple outputs, then retry it when that context gains capacity.
- When a topology change invalidates existing multi-output capacity, park whole writable columns with a reachable anchor inside the work area and release them to the waiting queue. Preserve the active column when possible; choose the farthest non-active column first and the rightmost on a tie.
- Release externally transferred windows from their old context before admitting them to the destination context.
- Translate client minimum and maximum sizes to frame bounds by adding current nonnegative decoration extents before emitting geometry or resizing a column. Treat malformed bounds conservatively.
- Preserve a window's slot through fullscreen, minimize, maximize, native tiling, and interactive move or resize transitions.
- A fullscreen command changes only KWin's native state; entering and leaving it does not directly mutate layout geometry, order, widths, heights, or viewport state.
- A native maximize command calls KWin's maximize mechanism without directly changing Driftile layout state.
- Require a stable restored frame before resuming writes or rebasing a transferred window.
- Freeze admission, focus commands, and affected-context geometry writes until two successive delayed topology snapshots match.
- Treat output-list, output-geometry, output-scale, and dock changes as topology invalidations.
- Permanently clear a context's original-frame restore baselines for the current run when its geometry fingerprint changes or its output object is replaced. Returning to the old geometry does not revive them.
- Treat external focus and window output or desktop changes as authoritative events.
- Create a desktop only after two matching occupancy snapshots show the shared tail is occupied.
- Remove only a current-run-owned tail after two matching snapshots show it and its predecessor are empty and no output selects it.

## Engineering constraints

- No workspace-wide polling. Lifecycle is signal-driven, with one bounded startup grace, bounded per-window state and floating-transition probes, and a two-second client-area fingerprint check limited to visible tracked contexts because KWin exposes no complete client-area change signal.
- Desktop lifecycle snapshots scan observed windows only after relevant signals; they never run on a timer.
- Structural output recovery performs one bounded workspace resynchronization after the topology settles.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Reflow affected visible contexts only; defer hidden desktops until they become visible.
- Do not write unchanged properties.
- Keep core operations linear in the affected context, not the whole workspace.

## Current constraint limits

- KWin does not expose a complete change signal for all minimum, maximum, and resizeability metadata. Signaled changes are reclassified immediately; silent changes are rechecked before reconciliation and geometry writes.
- Size increments and aspect-ratio policies are not modeled yet.

## Verification

- Unit-test core policies with plain fixtures.
- Test reconcile output for minimality and idempotence.
- Replay window lifecycle and output or desktop transfer sequences.
- Verify window-state ownership, cancellation races, stable resumption, and slot reservation.
- Verify native fullscreen shortcut entry, KWin-owned geometry, and exact layout restoration.
- Verify native maximize shortcut entry, KWin-owned geometry, and exact layout restoration.
- Verify adjacent and direct-edge active-column reorder, width adjustments, width presets, full width, available-width expansion, single-column and visible-group centering, signed viewport offsets, constraint bounds, and transactional rollback.
- Verify per-window 10% height changes, automatic reset, forward and reverse height presets, weighted stack redistribution, singleton sizing, and exact rollback.
- Verify decorated client-to-frame constraint translation and conservative handling of malformed bounds.
- Verify automatic KWin ownership, command no-ops, late role changes, manual-floating separation, and safe readmission.
- Verify context-local tiled/floating focus memory for manual and automatic floating windows without geometry writes.
- Verify vertical focus, member reorder, contextual merge and extraction, suspended members, and structural rollback.
- Verify the settled topology barrier, output replacement and removal, dock and silent work-area invalidations, sticky restore invalidation, and deterministic capacity recovery.
- Verify independent contexts with native Wayland and XWayland windows on two virtual outputs and native X11 windows on the X11 backend.
- Verify whole-column and secondary directional transfers, no-wrap boundaries, per-output desktop selection, focus preservation, and exact two-context compensation.
- Verify optional borderless ownership across tiled and floating windows, policy reassertion, live reconfigure handling, and unload restoration.
- Verify shared trailing-desktop creation, guarded removal, silent mutation rejection, and preservation of external desktops.
- Exercise live output reconfiguration against an isolated real KWin session.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
