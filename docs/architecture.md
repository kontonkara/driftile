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
- Reorders the active whole column inside one settled context and keeps focus unchanged.
- Resizes the active whole column within grouped window constraints and retries waiting capacity after a successful shrink.
- Focuses vertical stack members; reorders, merges, and extracts them while preserving KWin focus.
- Releases explicitly floating windows from geometry ownership and restores their anchored layout slots on return.
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
  requestedSuspensions: Map<WindowId, Set<StateReason>>
  suspendedWindows: Set<WindowId>
  toggleGeometryTransitions: Map<WindowId, { contextKey, expectedFrame, settlementArmed }>
  topologyBarrier: { revision, affectedOutputs, stableSample }
```

`LayoutContext` owns columns, viewport offset, and the last applied geometry fingerprint. A managed window owns an optional original-frame restore baseline. A floating window remains observed but has no layout or geometry owner; its detached placement records stable anchors for reinsertion. A suspended window keeps its layout slot, but reconcile excludes it until KWin releases geometry authority. Waiting windows have no layout owner. KWin objects never enter core state.

## Reconciliation rules

- Read usable geometry from KWin work areas; never infer panel bounds.
- Apply a context only when its desktop is visible on its output.
- Keep focus commands inside the active window's context.
- Keep column-reorder commands inside the active context and roll back the model if geometry application cannot complete.
- Apply active-column width changes transactionally, preserving focus, grouping, and the prior width on failure.
- Apply stack edits with compare-and-swap model rollback and exact compensating frame writes after partial failure.
- Apply floating transitions from immutable previews, commit ownership only after every geometry request succeeds, and defer later context writes until asynchronous frames settle.
- Allow horizontal overflow and viewport scrolling when KWin reports one output.
- Queue a candidate window unmanaged if it would introduce overflow with multiple outputs, then retry it when that context gains capacity.
- When a topology change invalidates existing multi-output capacity, park whole writable columns with a reachable anchor inside the work area and release them to the waiting queue. Preserve the active column when possible; choose the farthest non-active column first and the rightmost on a tie.
- Release externally transferred windows from their old context before admitting them to the destination context.
- Respect minimum and maximum window sizes before emitting geometry.
- Preserve a window's slot through fullscreen, minimize, maximize, native tiling, and interactive move or resize transitions.
- Require a stable restored frame before resuming writes or rebasing a transferred window.
- Freeze admission, focus commands, and affected-context geometry writes until two successive delayed topology snapshots match.
- Treat output-list, output-geometry, output-scale, and dock changes as topology invalidations.
- Permanently clear a context's original-frame restore baselines for the current run when its geometry fingerprint changes or its output object is replaced. Returning to the old geometry does not revive them.
- Treat external focus and window output or desktop changes as authoritative events.

## Engineering constraints

- No workspace-wide polling. Lifecycle is signal-driven, with one bounded startup grace, bounded per-window state and floating-transition probes, and a two-second client-area fingerprint check limited to visible tracked contexts because KWin exposes no complete client-area change signal.
- Structural output recovery performs one bounded workspace resynchronization after the topology settles.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Reflow affected visible contexts only; defer hidden desktops until they become visible.
- Do not write unchanged properties.
- Keep core operations linear in the affected context, not the whole workspace.

## Verification

- Unit-test core policies with plain fixtures.
- Test reconcile output for minimality and idempotence.
- Replay window lifecycle and output or desktop transfer sequences.
- Verify window-state ownership, cancellation races, stable resumption, and slot reservation.
- Verify active-column reorder and resizing, including constraint bounds and transactional rollback.
- Verify vertical focus, member reorder, contextual merge and extraction, suspended members, and structural rollback.
- Verify the settled topology barrier, output replacement and removal, dock and silent work-area invalidations, sticky restore invalidation, and deterministic capacity recovery.
- Verify independent contexts with native Wayland and Xwayland windows on two virtual outputs.
- Exercise live output reconfiguration against an isolated real KWin session.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
