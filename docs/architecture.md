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
- Contains no layout policy or durable state.

### TypeScript runtime

- Takes the initial workspace snapshot.
- Normalizes QML/KWin objects into stable IDs and plain data.
- Serializes events and commands, batches bursts, and marks dirty contexts.
- Owns startup, reconfiguration, recovery, and shutdown sequencing.

### Core

- Contains the platform-independent layout and workspace policies.
- Stores windows by ID and layouts by `(outputId, desktopId)`.
- Produces deterministic desired state from events and commands.
- Has no QML or KWin dependencies.

### Reconcile

- Compares desired state with the latest observed KWin state.
- Emits the smallest valid set of focus, geometry, transfer, and desktop operations.
- Reflows dirty contexts only and ignores self-generated geometry signals.
- Is idempotent: the same observed and desired state produces no further work.

### KWin

- Remains the source of truth for live windows, outputs, desktops, focus, and window state.
- Applies geometry and validates window constraints.
- Reports external changes back through signals.

## State model

```text
RuntimeState
  windows: Map<WindowId, WindowState>
  contexts: Map<ContextKey, LayoutContext>
  outputs: Map<OutputId, OutputState>
  desktops: ordered VirtualDesktopId[]
  workspacePolicy: DynamicWorkspaceState
```

`LayoutContext` owns columns and viewport offset. A column owns ordered window IDs and width. KWin objects never enter core state.

## Reconciliation rules

- Read usable geometry from KWin work areas; never infer panel bounds.
- Never move overflow columns into another output's global coordinate space.
- Respect minimum and maximum window sizes before emitting geometry.
- Never let native tiling and Driftile write geometry for the same window.
- Treat external focus, fullscreen, minimize, desktop, and output changes as authoritative events.
- Re-resolve outputs and windows after topology changes instead of retaining stale objects.
- Remove only a Driftile-owned, empty, trailing desktop that is not visible on any output.

## Engineering constraints

- No periodic scans; lifecycle is signal-driven.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Do not write unchanged properties.
- Keep core operations linear in the affected context, not the whole workspace.

## Verification

- Unit-test core policies with plain fixtures.
- Test reconcile output for minimality and idempotence.
- Replay event sequences for window lifecycle, desktop changes, and hot-plug recovery.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
