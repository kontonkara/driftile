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
- Contains no layout policy or durable state.

### TypeScript runtime

- Models eligible windows from every existing output and desktop context.
- Normalizes QML/KWin objects into stable IDs and plain data.
- Batches event bursts, marks dirty contexts, and reconciles only visible desktops.
- Holds initial admission through a one-second signal grace, then plans existing windows as one batch.
- Defers external output and desktop transfers, then re-owns each window in its destination context.
- Suspends geometry writes while KWin owns a window-state transition and resumes after its restored frame stabilizes.
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
  requestedSuspensions: Map<WindowId, Set<StateReason>>
  suspendedWindows: Set<WindowId>
```

`LayoutContext` owns columns and viewport offset. A column owns ordered window IDs and width. A suspended window keeps that ownership, but reconcile excludes it until KWin releases geometry authority. KWin objects never enter core state.

## Reconciliation rules

- Read usable geometry from KWin work areas; never infer panel bounds.
- Apply a context only when its desktop is visible on its output.
- Keep focus commands inside the active window's context.
- Allow horizontal overflow and viewport scrolling when KWin reports one output.
- Queue a candidate window unmanaged if it would introduce overflow with multiple outputs, then retry it when that context gains capacity.
- Release externally transferred windows from their old context before admitting them to the destination context.
- Respect minimum and maximum window sizes before emitting geometry.
- Preserve a window's slot through fullscreen, minimize, maximize, native tiling, and interactive move or resize transitions.
- Require a stable restored frame before resuming writes or rebasing a transferred window.
- Treat external focus and window output or desktop changes as authoritative events.

## Engineering constraints

- No workspace-wide polling; lifecycle is signal-driven, with one bounded startup grace and bounded per-window transition probes.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Do not write unchanged properties.
- Keep core operations linear in the affected context, not the whole workspace.

## Verification

- Unit-test core policies with plain fixtures.
- Test reconcile output for minimality and idempotence.
- Replay window lifecycle and output or desktop transfer sequences.
- Verify window-state ownership, cancellation races, stable resumption, and slot reservation.
- Verify independent contexts with native Wayland and Xwayland windows on two virtual outputs.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
