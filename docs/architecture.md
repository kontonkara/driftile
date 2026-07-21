# Architecture

## Data flow

```text
QML bridge -> TypeScript runtime -> core -> reconcile -> KWin
KWin frame signal -> optional transition effect -> visual interpolation
stable layout snapshot -> overview projector -> guarded KWin effect -> KWin focus, selection, desktop reorder, or window membership
confirmed tab selection -> guarded callback -> passive Plasma OSD
```

Events travel from KWin through the bridge into the runtime. Commands and resulting geometry operations travel toward KWin.

## Layers

### QML bridge

- Loads the compiled runtime in the KWin script environment.
- Keeps the KPackage-required `contents/ui/main.qml` bootstrap byte-stable.
  Each instance loads a generated selector through a unique local-file query;
  the selector loads the complete QML and JavaScript runtime from its
  content-addressed directory.
- Passes the KWin workspace object to the runtime.
- Hosts QML-only shortcut handlers.
- Synchronizes KWin's public `Workspace.desktopGridHeight` property with the
  exact desktop count at startup and after desktop or layout changes, keeping
  the desktop grid in one vertical column without polling or a replacement
  switching effect.
- Sends bounded tab-selection text to Plasma's asynchronous OSD service when
  enabled; it creates no KWin-managed surface and does not intercept input.
- Keeps both optional touchpad gesture Loaders inactive by default. An accepted
  complete settings snapshot creates only enabled horizontal or vertical pairs
  and recreates them when their registered finger count or direction changes.
  Vertical completion resolves exactly one live output beneath the pointer
  before reusing the guarded desktop-selection transaction.
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

### Native shortcut editor

- Runs as an optional Qt 6/KDE Frameworks 6 application outside KWin and loads
  only registered Driftile actions from the active KWin KGlobalAccel component.
- Keeps edits in memory until Apply validates the complete pending assignment,
  global owners, and unchanged baselines. Conflicts cause no write.
- Clears, writes, and verifies only changed actions through public KGlobalAccel
  interfaces. Any failure attempts exact rollback of the captured baselines and
  reports a rollback failure explicitly.
- Stores no profile or layout state and does not replace the reversible helper.

### Nix integration

- Exposes disjoint main, overview, transition, and native shortcut-editor
  outputs. The default output remains the lightweight main KWin script and
  shortcut helper.
- Keeps metadata, configuration, and required KPackage entrypoints at stable
  paths while generated selectors choose content-addressed runtime paths.
- Installs each package through NixOS or Home Manager and rejects duplicate
  ownership of the same package ID while allowing independent scopes.
- Maps an optional complete Home Manager settings profile to KDE's native
  KConfig module. Settings and shortcut-profile generation remain available
  without a second package installation.
- Keeps `useInitialWindowWidth` disabled by default. NixOS-installed packages
  expose it through the same per-user KConfig page, while Home Manager can own
  the typed boolean in its complete settings profile.

### Overview companion

- Ships as a separate, disabled-by-default `KWin/Effect` package.
- Reads the opaque layout snapshot twice before accepting a changed current v2
  catalog. A one-entry cache can reuse only an exact synchronous raw-state hit
  with an equivalent canonical projection snapshot; it returns a fresh frozen
  top-level model view over a detached, deeply frozen graph. Raw-document
  preflight avoids building a live projection snapshot on a definite miss. A
  newly validated model is admitted before a guarded deep cache copy runs on a
  later event-loop turn.
- Projects snapshot zero for the current activity into a baseline-free,
  immutable view model after exact live output, desktop, activity, and window
  validation.
- Projects every tabbed member as an ordered entry, exposes only non-minimized
  members as targets, and uses only the selected non-minimized member as the
  large thumbnail.
- Uses only public KWin QML types to enrich live thumbnails and screen context.
- Treats current-activity, activity-set, output-list, and virtual-screen geometry
  changes as generation-bound context refreshes. An open scene remains visible
  while the controller samples and projects its exact replacement instead of
  letting delegates act on the prior context.
- Binds every live refresh to its attempt, active session, prior model, and
  topology generation. The controller publishes the replacement model before
  clearing the context barrier and defers the activation-cache copy; stale
  callbacks cannot replace the model or release the barrier.
- Keeps each rendered thumbnail's direct live window object in its QML delegate;
  the object does not enter projected or persisted state.
- Snapshots a public Desktop-window lifecycle identity synchronously while the
  add or remove signal still owns it. Exact output, desktop, and activity scopes
  from one event-loop burst are deduplicated into one bounded generation. Empty
  desktop or activity membership means all; incomplete, ambiguous, or
  over-budget identity becomes one global resident-surface refresh.
- Reloads only instantiated Desktop surfaces selected by that immutable
  generation. Each card captures its exact context generation, activity,
  desktop object and ID, screen object and name, and projected output ID before
  construction. The solid fallback remains visible until `Loader.Ready` for the
  newest matching reload token, then that exact surface fades in over 90 ms.
  Context loss and stale load callbacks reject presentation immediately.
- Commits one contiguous Desktop-surface residency range per exact session,
  output, activity, and desktop topology. The last exact range survives
  transient invalid scene geometry. Panning, animated camera movement, zoom,
  and live reflow union source and destination ranges when their combined span
  fits the bound, so destination surfaces load before source surfaces are
  released. A distant jump that exceeds the bound prioritizes its destination.
- Limits residency to 12 rows and permits the current-row pin only within that
  bound. Search- or drag-retained off-screen cards never instantiate a surface.
  Residency is transient and performs no layout or persistence write.
- Treats the configured zoom as a bounded fresh-session baseline. Interactive
  zoom mutates only controller-owned session state; a completed close discards
  it, while reopening during the same close transition preserves it.
- Plans every zoom preview from an immutable transaction origin, preserving the
  fractional workspace position at the pointer or pinch centroid. Keyboard and
  global touchpad input use the centered current-row anchor. Cancellation
  restores the exact origin rather than reversing accumulated deltas.
- Preserves horizontal cameras by desktop ID across scale and workspace
  reflow, then clamps each retained offset against its newly computed row
  bounds. Desktop surfaces outside the bounded source-to-destination residency
  range remain lazy while scale changes the visible range.
- Keeps search, keyboard-help state, settled session zoom, the vertical
  viewport, and per-desktop horizontal cameras across a context refresh. The
  barrier adopts the current visual camera and cancels transient window or
  column dragging, desktop reorder and hover, wheel and boundary navigation,
  panning, and zoom ownership. It blocks pointer and action or navigation keys
  until the replacement model exactly matches the current activity and live
  projected screen; `Escape` and controller-owned global close remain usable.
- After exact replacement, performs one nonanimated spatial refresh with
  viewport preservation, restarts Desktop-surface residency, restores zoom
  registration, and repairs keyboard selection. It does not reset the session
  wrapper or replay the opening transition.
- Normalizes `Ctrl` plus wheel against KWin's system-inversion flag so physical
  up zooms in and physical down zooms out. Pixel deltas preview continuously,
  angle deltas advance by bounded steps, and `Ctrl++`, `Ctrl+-`, and `Ctrl+0`
  share the same guarded session transaction.
- When touchpad gesture support is enabled, keeps one global pair of KWin pinch
  handlers for its configured `3`- to `5`-finger count and one output-local
  public Qt two-point `PinchHandler` for touchscreens. Touchpad ownership is
  enabled only when all exact output scenes publish an eligible state for the
  current session.
- Rejects or cancels zoom ownership when session, model, output, desktop order,
  topology, or scene geometry changes, and while window drag, desktop reorder,
  viewport pan, closing, topology refresh, or help owns interaction. Search
  remains compatible. A passive percentage HUD has no input handler or timer.
- Keeps current-card thumbnail focus direct. A non-current thumbnail first
  revalidates the exact active effect, model, live screen, projected output,
  desktop, window, and activity; off-desktop hidden state is allowed only at
  this stage.
- Captures one immutable exit handoff before desktop, minimized-state, or focus
  writes. Exact session, topology, output, desktop, window, and frame ownership
  promotes a public target-output `KWin.WindowThumbnail`; minimized, removed,
  stale, desktop-only, or topology-invalid targets retain geometry-free
  fallback state. Thumbnail construction is asynchronous; during the close its
  source row stays opaque while loading, `Loader.Ready` promotes the thumbnail,
  and a Loader error selects the monochrome fallback. If close completion wins
  the race, the effect leaves from the still-opaque source.
- Freezes the visible workspace index and cameras while that handoff owns the
  close, blocks scene input, and defers model replacement. Reopening cancels the
  promoted target before restoring the captured vertical and per-desktop
  horizontal cameras; session zoom remains controller-owned and unchanged.
- Accepts a workspace marker or empty-surface activation only after revalidating
  the active effect, exact live screen, projected output, and direct desktop
  object and ID. An exact current target closes without a desktop write; an
  exact non-current target requires confirmed selection.
- Starts a number-gutter drag only from an exact live desktop object. Pointer
  updates compute one insertion slot in constant time while cards stay fixed.
  The last shared desktop is never a source or crossed target.
- On release, revalidates the effect, model, screen, output, selected desktop,
  scene geometry, and complete ordered desktop object/ID snapshot. A valid
  change calls public `KWin.Workspace.moveDesktop` once; its synchronous
  `desktopsChanged` signal closes every scene. Cancellation and stale state are
  write-free.
- Renders one pass-through active-column badge per desktop card from the
  immutable presentation and width already in the projected model. It performs
  one direct column and delegate lookup, clips to the visible column span, and
  hides rather than truncating or guessing invalid state.
- Keeps the optional close controls visible only for eligible, sufficiently
  large previews and minimized placeholders. Their shared mouse, touchpad, and
  touchscreen target is modestly enlarged without changing delegate layout.
  Releasing outside cancels; the exact guarded close path consumes the gesture
  before window activation or drag.
- Uses public Qt Pointer Handlers for one-finger touchscreen panning across the
  visible canvas, outside controls and overlays, whenever at least one camera
  has range. A clear dominant axis latches once per gesture: vertical input
  moves the workspace-row camera, while horizontal input moves only the touched
  row and only when it has horizontal range. Ambiguous diagonal movement moves
  neither camera.
- Preserves short-tap activation and desktop selection, lets an eligible
  thumbnail long press take window-drag ownership, and leaves mouse, touchpad,
  and right-button handling unchanged. Every update retains its exact output
  and camera context; horizontal updates also retain the exact row and desktop
  context. A mismatch cancels without a layout or persistence write. The
  gesture adds no polling or private API.
- Settles ordinary opening immediately, keeps interactive presentation progress
  gesture-driven, and retains the animated close path. Discrete vertical wheel
  input normalizes KWin's system-inversion flag so physical down maps to the
  next workspace row and physical up maps to the previous row. Precise vertical,
  native horizontal, and `Shift`-remapped pixel input applies the same physical
  normalization while remaining continuous.
- Re-reads the public desktop order synchronously when KWin reports a changed
  desktop list, then coalesces the persisted-model refresh without exposing
  stale workspace order to later pointer or gesture input.
- Shows one compact `Type to search · F1 help` control only after the scene has
  settled and while search and help are both closed. Its hover state signals
  clickability, and click or touch opens the existing keyboard reference. The
  control is absent during opening, closing, search, and help; ordinary typing
  still enters search directly.
- Before dispatching `Enter` or `Return`, or `Space` outside search, the scene
  synchronously establishes the normal preferred selection if the asynchronous
  opening repair has not run. The selected target then enters the existing
  guarded activation path exactly once. This adds no persistence, layout write,
  private API, polling, or workspace scan.
- Selects a non-current card through public `KWin.SceneView.currentDesktop`, or
  the guarded single-output `KWin.Workspace.currentDesktop` fallback, and
  requires an exact confirmation. Selecting the exact current card instead
  closes without either desktop write. Thumbnail activation, including a short
  touchscreen tap, then revalidates the same window including visible state,
  requests the exact
  `KWin.Workspace.activeWindow`, and confirms focus.
- Writes only `KWin.Workspace.activeWindow`, one exact window `desktops` list,
  public
  `KWin.SceneView.currentDesktop`, or the guarded single-output
  `KWin.Workspace.currentDesktop` fallback, and invokes public
  `KWin.Workspace.moveDesktop` for one validated reorder. Rejection leaves the
  effect open. After confirmed selection, late invalidation or focus rejection
  keeps the selected desktop, closes the stale effect, and performs no rollback.
- Offers `Meta+O` for a fresh KGlobalAccel record through KWin's public
  shortcut handler and preserves existing assignments. It adds no schema,
  private API, geometry write, or screen-edge mechanism. It performs no window,
  stacking-order, or layout scan. KWin owns desktop switching, window
  membership, and focus.
- Keeps its configurable vertical touchpad gesture pair in an inactive Loader
  when disabled and recreates it with initial finger-count properties after a
  live configuration change. Up opens; down closes without a layout write.

### Transition companion

- Ships as a separate, disabled-by-default JavaScript `KWin/Effect` package.
- Observes public frame-geometry signals and animates only presentation through
  `Effect.Size`, `Effect.Position`, and `Effect.Translation`; it never writes
  window geometry. Absolute position retargeting is used only when both
  endpoints are non-negative; other moves use relative translation.
- Skips manual move or resize, hidden, minimized, fullscreen, special, and
  non-normal windows, plus public shell, OSD, outline, lock-screen, internal,
  and switcher-hidden categories. Geometry changes received while another
  fullscreen or workspace transition owns presentation are coalesced per window
  and replayed once when ownership ends. Temporary invisibility retains the
  first captured frame until a public signal permits replay; true ineligibility,
  configuration reload, or deletion discards pending work.
- Records the active window at workspace-effect completion as a handoff anchor,
  then leases the first different same-context focus target until that exact
  target is visible or animating. Activation of the visible exact target also
  settles its lease after any deferred motion is replayed, so later hidden
  geometry cannot inherit stale continuity. Duplicate anchor activation,
  transient null focus, and anchor deletion cannot consume the target lease.
- Retargets eligible size and one bounded absolute-position/translation pair
  with the configured Plasma-scaled duration, preserving KWin's interpolated
  value through rapid commands and negative-coordinate crossings. Every logical
  position change retargets both active components, even when one numeric target
  is unchanged, so their KWin timelines remain coupled. An ending ID that
  rejects retargeting is detached from its property while its pending end
  remains counted; the independently tracked replacement survives that end
  notification without clearing a live sibling or retaining a stale transform.
- Follows Plasma's global animation-speed factor and exposes independent
  movement and size switches, one bounded duration, and a bounded exact
  `windowClass` exclusion set.
- Scans the stacking order only once when loaded and tracks later windows by
  signal. It has no timer, persistence, shortcut, layout state, or private API.

### TypeScript runtime

- Models eligible windows in `(output, desktop, activity)` contexts and applies
  geometry only for the current activity.
- Retains inactive single-activity contexts without writing their geometry.
  With multiple activities, all-activity and multi-activity windows fail closed
  to KWin ownership; absent or single-activity APIs use the compatible fallback.
- Resolves exact application presentation rules through one constant-time
  lookup whenever a fresh column is formed, then falls back to the configured
  global presentation.
- Normalizes QML/KWin objects into stable IDs and plain data.
- Batches event bursts, marks dirty contexts, and reconciles only visible desktops.
- Holds initial admission through a one-second signal grace, then plans existing windows as one batch.
- Defers external output and desktop transfers, then re-owns each window in its destination context.
- Suspends geometry writes while KWin owns a window-state transition and resumes after its restored frame stabilizes.
- Captures tiled move intent once, coalesces live same-context target previews,
  and plans the committed drop from the final cursor position only after
  geometry authority stabilizes. An exact-window target keeps stack insertion;
  an empty horizontal gutter before, between, or after visible columns selects
  a column boundary.
- After a completed KWin-owned move to another visible output, resolves the
  final destination without live feedback: one exact tiled window has priority,
  then one empty horizontal gutter. An exact target retains destination width;
  a gutter creates a source-width singleton with automatic height and current
  initial presentation. Stale or absent targets use ordinary destination
  admission.
- Reuses that finish-only transaction after KWin selects another desktop on the
  same output and changes the window membership, with the same exact-first
  window-or-gutter resolution. It probes only a pending visible destination,
  leaves the hidden source geometry untouched, and falls back to singleton
  admission when the target is unavailable or invalidated.
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
- Reorders a dragged singleton as one complete column at a selected boundary.
  A dragged stack member becomes an automatic-height singleton with the source
  width while passive source order, heights, presentation, and selection remain
  intact.
- Consumes the immediate right column's top member or expels the active column's bottom member through rollback-safe stack edits while retaining focus in the active column.
- Resolves directional output neighbors from logical output geometry and transfers the active column atomically between contexts; secondary actions transfer one tiled window.
- Applies desktop and output mechanisms member-by-member with the active member last, keeps it visible through cross-desktop output moves, commits both core contexts together, and compensates every owned field and frame on failure.
- Maintains one shared trailing empty desktop, optionally maintains a separate
  leading empty desktop, and performs guarded one-step global reorder requests
  through a KWin lifecycle adapter.
- Resolves numbered desktop targets against KWin's global list, clamps to the shared empty tail, and reuses either the transactional whole-column or single-window transfer path.
- Focuses adjacent desktops on the active output, with a global fallback and no wrapping.
- Accepts a desktop reorder only when KWin produces the exact expected same-ID permutation. The operation leaves selections and window memberships unchanged, and the shared empty tail remains pinned.
- Sends one tiled window, one complete tiled column, or one relation-free
  manually floating window to an adjacent or numbered desktop without changing
  the selected source desktop. The destination model commits without hidden
  frame writes and reflows when that desktop becomes visible; only the visible
  source layout may be applied during the transaction.
- Releases explicitly floating windows from continuous geometry ownership.
  Toggle-back restores a surviving anchored slot; guarded direct insertion
  attaches to the selected target stack.
- Translates or work-area-centers one active manually floating frame through a shared guarded command without a window or layout scan, preserving its reinsertion anchor and every tiled context.
- Routes existing width decrease/increase, width-preset, width-reset,
  window-height decrease/increase, and window-height preset forward/reverse
  actions to an eligible manually floating frame through a dedicated per-window
  transaction without reading or mutating a tiled context.
- Routes the existing unbound direct-insertion actions to one guarded attach
  preview for an eligible manually floating frame without adding a KWin or
  private API.
- Transfers one active relation-free floating window between desktops through a dedicated KWin transaction without changing tiled state or frame geometry.
- Remembers the last non-minimized tiled and floating focus per context, switches layers, and resolves floating navigation from live frame geometry without changing frames during floating navigation.
- Keeps the ordinary activation pair separate from a two-entry non-null pair
  used by close recovery, so an interim null cannot erase a provisional
  same-context handoff. Updating this history schedules no work.
- Skips minimized tiled slots, fully minimized columns, and minimized floating candidates during focus resolution without taking ownership of KWin's minimize mechanism.
- Extracts a regular stack member transactionally before requesting native fullscreen through KWin; application-driven fullscreen commits for the active window use the same persistent singleton model without writing the fullscreen frame.
- Extracts a regular stack member transactionally before requesting native maximize-to-edges through KWin; rejected requests restore the exact model, frames, focus, and runtime ownership.
- Keeps dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership in state separate from manual floating.
- Releases a managed window that gains an automatic-floating role without restoring its old frame, then readmits it when the role clears and it remains eligible.
- Optionally claims borderless state for application windows independently of
  layout ownership, reasserts owned state after policy changes, and restores
  only decoration state that it owns.
- Resolves one exact, case-sensitive application-rule ID: a nonempty
  `desktopFileName` when available, otherwise a nonempty `resourceClass`. The
  resolver never reads the fallback after a usable desktop-file ID and performs
  no partial, role, caption, or resource-name matching.
- Consults the separate exact application-ID exclusion set before each
  borderless claim. The policy covers every otherwise eligible tiled, floating,
  dialog, transient, and utility window.
- Reconciles borderless exclusions and resolved application-ID changes live without
  geometry writes, focus changes, or logical-layout or layout-persistence
  changes. Global disable dominates the set, and disable or unload restores only
  owned decoration state.
- Delivers an atomic settings change in ownership-safe order: disable the
  global policy before replacing exclusions, or install the new exclusions
  before enabling the global policy.
- Defers live gap changes across structural transactions, then reflows dirty visible contexts and retries capacity admissions under one settled value.
- Keeps the gap in logical pixels through solving, including fractional values,
  then snaps window edges to the output pixel grid. Where the scale cannot
  represent every requested edge exactly, adjacent physical gaps may differ by
  one pixel without changing logical layout state.
- Treats enabled single-column centering as the highest-priority viewport
  geometry invariant: exactly one tiled column, including a stack, is centered
  on every solve. Enabling it dirties visible singleton contexts; disabling it
  performs no forced reflow. Floating windows and contexts with multiple
  columns bypass the invariant.
- Applies default-width changes before admission without changing existing
  column policies or floating frames. A positive fixed logical-pixel value wins;
  zero selects the percentage fallback. Newly admitted columns, ordinary fresh
  cross-context retiles, and later contextual resets read that current policy
  through the normal constraint and output-pixel snapping path. A pointer gutter
  extraction instead preserves its source width.
- Optionally captures a newly admitted singleton member's live frame width as a
  fixed logical policy when no exact application-width rule matches. The exact map
  remains authoritative; capture passes through decorated minimum and maximum
  bounds plus output-pixel snapping. Existing columns and reset paths never
  read the option.
- Parses at most 128 application-width entries into an exact application-ID
  lookup. A newly created or freshly admitted singleton resolves the KWin ID,
  reads that map in constant time, falls back to the global default, and remains
  subject to the normal window-constraint clamp. Existing columns do not read
  the map again.
- Parses at most 128 initial-floating application IDs into an exact
  case-sensitive resolved-ID set. A fresh eligible admission performs one
  constant-time lookup and routes a match through existing manual-floating
  ownership while preserving its KWin frame. Existing or hydrated ownership is
  not reclassified; tiling exclusions and automatic floating roles take
  priority.
- Captures one optional global initial destination beside the bounded exact
  application map when a fresh normal window is first tracked. One constant-time
  exact lookup wins; otherwise the captured default reuses the same guarded
  desktop/output transaction. Existing and already tracked windows do not read
  a later setting change.
- Captures one global initial-focus default with both bounded exact application
  sets. Resolution performs one application-ID lookup per fresh admission:
  exact unfocused wins, then exact focused, then the global default. Existing
  and already tracked windows do not reread the policy.
- Parses at most 128 application tiling exclusions into an exact case-sensitive
  resolved-ID set. Admission uses one constant-time lookup; a live policy
  replacement scans the observed window set once and schedules only windows
  whose membership changed.
- Reuses the same exact-ID decoder for application borderless exclusions: at
  most 65,664 document characters, 512 raw characters per line, 128 unique
  nonblank entries, and 255 UTF-8 bytes per trimmed ID. Blank lines are ignored;
  duplicates, controls, invalid UTF-16, and oversized input fail the complete
  settings snapshot. Valid entries are held in canonical sorted order with
  constant-time membership lookup.
- Replaces at most 16 mixed proportional or fixed logical-pixel column-width
  presets atomically without layout work; existing columns and floating frames
  retain their widths, and later contextual preset actions read the new cycle.
- Replaces at most 16 mixed proportional or fixed logical-pixel window-height
  presets atomically without geometry or layout work. Stable bounded state
  indices keep an existing selection meaningful after live profile changes. A
  blank cycle retains the exact `1/3`, `1/2`, and `2/3` proportions.
- Optionally centers the destination of successful horizontal tiled focus
  navigation inside the existing focus transaction. A separate overflow mode
  centers only when the destination and its nearest directional neighbor do not
  both fit the solved work area. Other focus paths retain minimal reveal and a
  failed center preview falls back without rejecting focus.
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
  alwaysCenterSingleColumn: boolean
  centerFocusedColumn: boolean
  centerFocusedColumnOnOverflow: boolean
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
  pendingManualFloatingWidthChanges: Map<WindowId, { targetFrame, guards, signal }>
  automaticFloatingWindows: Set<WindowId>
  lastTiledFocus: Map<ContextKey, WindowId>
  lastFloatingFocus: Map<ContextKey, WindowId>
  windowBorderRestore: Map<WindowId, { noBorder, clientFrame, frame }>
  requestedSuspensions: Map<WindowId, Set<StateReason>>
  suspendedWindows: Set<WindowId>
  toggleGeometryTransitions: Map<WindowId, { contextKey, expectedFrame, settlementArmed }>
  desktopLifecycle: { ownedDesktopIds, pendingMutation }
  topologyBarrier: { revision, affectedOutputs, stableSample }
  pointerMoveIntent: { contextKey, layoutSnapshot, participants, previewGeometry, finalCursor, sourceOutput, sourceDesktop, externalDrop }
  pointerResizeIntent: { contextKey, layoutSnapshot, participants, initialFrame, acceptedFrame, activeColumnId }
  pointerResizeSettlement: { contextKey, targets, rollbackFrames, phase, attempts, stableSamples }
```

`LayoutContext` owns columns, each column's stacked or tabbed presentation and
selected window ID, per-window automatic weights or fixed/preset heights,
viewport offset, and the last applied geometry fingerprint. A managed window
belongs to one output, desktop, and activity context and owns an optional
decoration-independent client restore baseline plus the exact frame observed at
capture time. A manually floating window remains observed
but has no layout or geometry owner; its detached placement records stable
anchors for reinsertion. An automatically floating window has no layout slot,
floating anchor, waiting entry, suspension, or retry state. Role-based and
configured application exclusions share this ownership path; the bounded
configured lookup is constant time. A minimized tiled window remains suspended
in its exact logical slot, while a minimized manually floating window keeps its
exact detached frame. Reconcile excludes suspended windows until KWin releases
geometry authority. Waiting windows have no layout owner. KWin objects never
enter core state.

## Persistence boundary

The persistence foundation is a bounded, versioned JSON codec in core. The v2
catalog keeps at most four most-recent output-topology snapshots under one
4 MiB limit. Each snapshot records the complete output descriptor set,
including outputs without owned windows, plus a validated canonical v4 logical
state. The current snapshot may keep context-guarded restore baselines; every
historical snapshot is baseline-free. Bare and catalog-nested v1 and v3 logical
state remain valid startup input and migrate to v4 on the next successful
publication. The catalog version stays v2. Runtimes without v4 state support
reject that nested state and keep the store write-locked.

Logical state stores activity-qualified contexts and floating placements,
output and window descriptors, column and stack order, column presentation, the
selected member by bounded index, width and height policies, viewport offsets,
full-width restore widths and viewport positions, manual-floating reinsertion
anchors, and context-guarded tiled restore baselines. Restore rejects missing
or removed activity identities. The catalog and nested state codecs reject
unknown fields, invalid references, ambiguous output identities, impossible
layout policies, oversized input, and unsupported versions without mutating
live state.

After topology settlement, an additive output return may select a matching
historical snapshot. Restoration is output-atomic and tiled-only: every eligible
historical window must already be on the returned output, geometry must pass a
second live preflight, and any mismatch falls back to normal topology recovery.
Matched outputs retain ownership, column order, widths, active column, and
focus; their viewport may clamp only after departed columns are removed.
Historical floating state and restore baselines are never applied during this
path.

Transient runtime state is never durable: expected layout frames, decoration ownership, focus caches, waiting and suspension state, schedulers, probes, and transaction tokens are excluded. A context fingerprint is stored only with original client and frame restore baselines; a mismatch discards those baselines without rejecting the logical layout. A window `liveId` is an exact same-session reload hint only. The pure matcher gives that identity precedence, then accepts public KWin session descriptors only when both sides are globally unique; missing, duplicate, or overlapping matches remain unmatched. Output matching prefers a unique display serial tuple and otherwise requires the available connector metadata exactly. Desktops require their exact KWin IDs.

Desktop send intent, its focus handoff, and its rollback ownership are transient.
The operation reuses canonical v4 layout state and adds no persistence field or
schema migration.

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
a reload made while the window is away. Its ordinary pointer move remains a
native KWin operation and never creates a tiled pointer intent, preview, or
implicit ownership transition. An explicit toggle or direct tiling action still
uses the saved anchor.

Directional movement and contextual centering share one guarded single-window
frame transaction. It performs no window, column, or layout enumeration, accepts
only an exact logical-frame acknowledgement, and commits floating metadata only
after that acknowledgement. A still-owned inexact result may receive one ordered
original-frame compensation request; stale ownership, context, or topology stops
further writes.

Contextual manual-floating size changes use a separate bounded per-window
transaction. Width steps start at
`originalWidth + direction * columnWidthStep * workArea.width`; height steps
start at `originalHeight + direction * windowHeightStep * workArea.height`.
Width presets and reset resolve their configured percentage as
`percentage / 100 * (workArea.width - gap) - gap`, matching singleton layout
resolution. A blank window-height preset cycle uses the exact `1/3`, `1/2`, and
`2/3` proportions; custom heights resolve as
`percentage / 100 * (workArea.height - gap) - gap`. Their canonical start at
`workArea.y + gap` and end at `start + rawHeight` snap to the assigned output's
pixel grid before subtraction. Preset and reset width targets and preset-height
targets additionally require a relation-free manual-floating window. The
requested dimension snaps to the physical-pixel grid using the assigned
output's device-pixel ratio and clamps to its live decorated minimum and maximum
plus a positive client extent. Fixed width presets resolve directly in logical
pixels; fixed height presets store client height and add the current decoration
extent. The other dimension and top-left remain unchanged unless the
partial-visibility bounds require a minimal origin clamp.

The per-window `frameGeometryChanged` handler is connected before exactly one
forward frame request. An exact synchronous X11 or XWayland result settles
inline; an unchanged native Wayland frame remains pending until the exact
target is observed by a signal or delayed sample, or 20 unchanged delayed
samples expire the request. Only the exact current target under unchanged
ownership, context, topology, constraints, and decorations commits floating
metadata. Any other sample rejects the operation. Because the public KWin API
exposes no configure serial, this path never issues a compensating frame
request. One pending operation serializes size, movement, and centering
commands for that window, and is disconnected on acceptance, rejection,
expiry, window removal, or runtime shutdown. No tiled model, tiled frame,
viewport, or persistence state changes.

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
- Apply a context only when its desktop is visible on its output and its
  activity is current.
- Keep focus commands inside the active window's context, select one live target, skip minimized slots and fully minimized columns without wrapping, and reveal its column with the smallest required scroll.
- Treat minimization as the only skippable focus suspension; commands that encounter another suspension blocker remain no-ops.
- Commit tiled focus and viewport changes only after KWin accepts the same live target; rejection or a synchronous authority change restores the prior focus, model, and frames.
- Keep adjacent and direct-edge column reorders inside the active context and roll back the exact model order if geometry application cannot complete.
- Apply active-column width changes transactionally, preserving focus, grouping, and the prior width on failure.
- Pin the active full-width frame between equal configured outer gaps, place adjacent frames at least one physically aligned configured gap beyond the corresponding viewport edge, add no clearance when the gap is zero, and restore its prior width without moving the current viewport or horizontal anchor. Keep a full-width successor at its natural strip position when a normal predecessor is active, so the successor can remain partially visible. Apply width restoration transactionally and retain the compatible persistence format without adding state, schema, or bindings.
- Place the immediate normal successor of an inactive full-width column at the left work-area gap while keeping the predecessor beyond the left viewport edge.
- Expand only a fully visible active column up to its shared window constraints, keep every other fully visible column on screen, and commit its width and viewport change atomically.
- Center a fully visible column group with a viewport-only transaction; permit signed viewport offsets when exact centering requires them.
- Preserve signed viewport positions across width and structural changes while the active column remains visible; reveal it only after it leaves the work area.
- Give every non-minimized member of a tabbed column one identical frame using
  the existing column width and normal outer gaps. Select and raise one member
  without scanning another column or the workspace.
- Keep tabbed focus and reorder within the active column without wrapping.
  Height commands are no-ops while tabbed; their stored policies remain
  dormant until stacked presentation returns.
- Let the target presentation win when a member enters another column. A fresh
  singleton uses its application's configured presentation and retains it
  while depleted; preserve a whole moved column's presentation, and select a
  departing member's successor or, at the end, its predecessor.
- Keep at most one fixed or preset height in a stack. When another member is changed, preserve the remaining members' visible proportions as automatic weights and distribute the remaining work-area height among them.
- Apply active-window height changes transactionally across the affected stack, preserving focus, order, width, and every prior height state on failure.
- Apply stack edits with compare-and-swap model rollback and exact compensating frame writes after partial failure. Pin every writable ID to its captured KWin object so a same-ID replacement never receives stale writes. Rebase rollback across authoritative participant removal or context departure only when every surviving column, member, width, and height state still matches the applied edit.
- Reset a consumed or expelled member to automatic height, preserve surviving member order and height state, and keep the active column selected.
- Resolve direct stack insertion inside the active context, skipping singleton columns without wrapping and preserving every intermediate column. Skipped columns are nonparticipants.
- Permit a visible active member to insert past settled minimized passive peers in the participating source and target columns, including a fully minimized target stack. Preserve passive logical order, height state, minimized state, and externally changed hidden frames without geometry writes.
- Reject direct insertion when either participating column contains a fullscreen, maximized, native-tiled, restore- or toggle-settling, or other non-minimize blocker. Cancel and roll back if a participant completes a state round trip during reflow.
- Resolve contextual floating direct insertion from the active frame's
  horizontal center against solved centers for every column in its current
  output and desktop strip. Include off-screen columns, skip singleton columns,
  do not wrap, and inspect only the nearest structural multi-window stack. An
  unsafe nearest target or context fails closed without routing farther or
  reaching tiled insertion.
- Keep the floating owner, reinsertion state, and original tiled layout
  unchanged while guarded geometry writes stage the attach preview. On commit,
  append and select the active window with automatic height while the target
  width and stacked or tabbed presentation win and focus remains active.
- After KWin completes physical output and desktop movement, resolve one exact
  visible window first and otherwise one empty horizontal gutter. Exact targets
  retain midpoint insertion and destination width. A gutter inserts a fresh
  singleton at the captured boundary with source width, automatic height, and
  current application or global initial presentation. Commit both contexts
  through the same immutable transfer preview. If the target is unavailable,
  stale, ambiguous, or changes during the transaction, leave KWin's move intact
  and use ordinary destination singleton admission.
- After KWin selects a different visible desktop on the same output and moves
  the active window there, use the same exact-window-first target resolution.
  Probe a pending destination only a bounded number of times, apply no
  hidden-source geometry, and isolate every unrelated context. If destination
  writes partially apply, compensate them exactly before singleton admission.
- Keep empty-gutter targeting on the public KWin scripting boundary: reuse the
  existing interactive-move lifecycle, cursor and frame data, and public
  outline feedback in the source context. Cross-context targeting begins only
  at finish and adds no preview, input grab, compositor hook, or private API.
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
- Transfer either the active column or one secondary window between adjacent or numbered desktops through an immutable two-context preview, then commit only after KWin accepts every desktop mechanism, focus, and destination geometry.
- Send either the active column or one active window to an adjacent or numbered
  desktop through a two-context preview without selecting the destination.
  Preserve minimized passive source peers and focus an eligible source window.
  Commit hidden destination ownership without frame writes, apply only the
  visible source geometry, and reflow the destination when it becomes visible.
  Same-target and unsafe commands are no-ops; rollback requires exact captured
  mechanism, model, focus, and frame ownership.
- Transfer either the active tiled column or one secondary tiled window between outputs through the same preview, then commit only after KWin accepts every output and desktop mechanism plus both visible layouts. Route an active floating layer through a separate single-window mechanism transaction that never mutates layout or frame geometry.
- Preserve whole-column member order and width, apply the active member last, and restore all owned mechanisms and frames if any batch step fails.
- Apply floating transitions from immutable previews, commit ownership only after every geometry request succeeds, and defer later context writes until asynchronous frames settle.
- Switch focus between tiled and floating layers by resolving one deterministic target in each layer. Minimized slots are skipped, but a selected target with any other suspension or geometry-authority blocker fails closed instead of falling through. A tiled target in another column is revealed transactionally before KWin receives focus; ordinary rejection restores the exact model and geometry, while topology supersession uses normal deferred recovery.
- Treat an exact, case-sensitive KRunner or Plasma Shell identity in any public
  `desktopFileName`, `resourceClass`, or `resourceName` field as a terminal veto
  for pending close-focus recovery. The active surface must be neither the
  removed client nor a desktop window; all other surfaces retain the existing
  candidate and bounded-recovery rules.
- Resolve floating `H/J/K/L` by the smallest strictly positive center delta on the requested axis and `Home/End` by frame-x extremes, scanning only live, non-minimized same-context floating windows.
- Resolve the existing center-column action contextually: a manual-floating target uses the assigned output and desktop work area, exact logical midpoints, and work-area origins for oversized dimensions; a non-floating target keeps the tiled centering path. A blocked manual-floating target never falls through to tiled behavior.
- Resolve the existing width decrease and increase actions contextually: a
  manual-floating target uses one constraint-clamped frame request with a
  physically aligned width and never falls through to tiled resizing while
  blocked or pending; a tiled target keeps the whole-column path.
- Resolve the existing window-height decrease and increase actions
  contextually: a manual-floating target uses the corresponding work-area
  height step and one constraint-clamped, physically aligned frame request; a
  tiled target keeps the stack-reflow path.
- Resolve the existing forward and reverse window-height preset actions
  contextually: an eligible manual-floating target cycles the configured frame
  heights with wrapping. A blank cycle uses exact `1/3`, `1/2`, and `2/3`
  proportions; a custom cycle contains 1–16 strictly increasing integer
  percentages from 10 through 100. Resolve custom percentages against the
  gap-adjusted work-area height, snap the canonical start and end to the
  assigned-output pixel grid, then reuse the guarded one-request exact-ack size
  transaction with decorated constraints and partial reachability. Reset
  remains tiled-only.
- Leave dialogs, modal or transient windows, non-resizable normal windows, and fixed-size normal windows outside layout ownership. Commands that require layout ownership are no-ops when one is active; desktop or output transfer may move one relation-free floating window.
- If a managed window gains an automatic-floating role, remove its slot without
  writing a stale restore frame or disturbing unrelated order, widths, or
  viewport state. Re-admit ordinary automatic-floating windows through normal
  admission after their role clears. Once an exact live window is confirmed as
  picture-in-picture, retain KWin ownership through role churn and interactive
  movement for that window's lifetime; removal clears the identity.
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
- Never move a configured boundary desktop or allow another desktop to cross it.
- Create a desktop only after two matching occupancy snapshots show a required
  boundary is occupied.
- Remove only redundant, current-run-owned boundary desktops after two matching
  snapshots show they are empty and no output selects them.

## Engineering constraints

- No periodic workspace or stacking-order rescan. Lifecycle is signal-driven, with an initial snapshot and one additive discovery at the end of the bounded startup grace, bounded per-window state and floating-transition probes, and a two-second client-area plus hard-constraint fingerprint check limited to visible tracked windows and contexts because KWin exposes no complete change signal for either surface.
- Desktop lifecycle snapshots scan observed windows only after relevant signals; they never run on a timer.
- Structural output recovery performs one bounded workspace resynchronization after the topology settles.
- Coalesce each event burst into at most one reconcile pass per dirty context.
- Reflow affected visible contexts only; defer hidden desktops until they become visible.
- Treat a gap change as layout policy, not a model or topology mutation; preserve logical state and defer it until structural and capacity transactions settle.
- Commit proportional and fixed default-width changes only at the same safe
  runtime boundary and leave existing managed width policies unchanged. A
  positive fixed value wins while zero preserves the percentage fallback.
  Retrying a waiting admission may add a constrained, pixel-snapped column and
  update that viewport and its frames.
- Treat initial-frame width capture as future singleton-admission policy only.
  Reconfiguration performs no geometry write, and the captured fixed width uses
  the existing model and persistence field without changing schemas, actions,
  or bindings.
- Replace the bounded application-width lookup atomically on reconfiguration.
  Do not revisit existing columns; schedule only contexts with waiting windows
  that may create a fresh singleton.
- Replace the bounded initial-floating lookup atomically without revisiting
  admitted or hydrated windows. A window snapshots the policy when first
  tracked, so only windows first seen after the replacement use it.
- Replace the bounded `ApplicationBorderlessExclusions` set atomically.
  Reconfiguration and application-identity signals reconcile decoration
  ownership without geometry writes, focus changes, or model or
  layout-persistence changes; interactive resize and settlement retain priority.
- Replace the bounded column-width preset cycle without changing model values,
  frames, viewport state, or focus.
- Replace the bounded window-height preset cycle without changing model values,
  frames, viewport state, or focus.
- Replace the bounded application focus-centering set atomically without
  moving the current layout. Horizontal focus checks the selected target in
  constant time; rejected focus restores the prior viewport.
- Replace overflow-centering policy without immediate layout work. A later
  horizontal focus reuses one solved minimal-reveal view, compares actual
  target and directional-neighbor frames against the sampled work area, and
  solves a centered view only when needed.
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
- Keep contextual manual-floating size settlement bounded: constant per-target
  math, one per-window signal connection, at most one forward frame write, at
  most 20 delayed probes, no compensation, and no managed-window, column, or
  layout scan.
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
- Verify contextual manual-floating width and height decrease and increase,
  width-preset cycling and reset, configured gap-free steps, exact singleton
  percentage resolution, decorated live constraints, positive client extents,
  physical-pixel snapping, preservation of the other dimension, partial
  visibility, synchronous and delayed exact settlement, bounded unchanged-request
  expiry, pending-command serialization and cleanup, exact metadata commits,
  nonexact and stale rejection without compensation, fail-closed related and
  automatic targets, one forward write, and zero tiled mutation.
- Verify vertical focus, member reorder, contextual merge and extraction, suspended members, and structural rollback.
- Verify direct insertion past settled minimized source and target peers, fully minimized target stacks, skipped-singleton nonparticipation, zero hidden-frame writes, authoritative external frame changes, state-round-trip cancellation, exact rollback, and fail-closed blockers.
- Verify contextual floating direct insertion in both directions with
  singleton skipping, target width and presentation adoption, automatic
  height, retained focus, ownership transfer, related-window rejection,
  state-round-trip compensation, and no-target rejection without tiled
  fallback.
- Verify destination-only gutter planning before, between, and after columns,
  strict geometry rejection, and atomic cross-context insertion of one active
  stack member into a fresh source-width, automatic-height singleton.
- Verify cross-output pointer adoption before and after a visible target or at
  an empty gutter, destination or source width as appropriate, configured
  presentation, automatic height, both signal orders, exact compensation, and
  ordinary singleton fallback for unavailable, stale, ambiguous, or raced
  targets without output or desktop mechanism writes.
- Verify same-output cross-desktop adoption across the output-local and global
  desktop resolvers and both membership-before-finish and
  finish-before-membership event orders. Cover exact-window and empty-gutter
  success, bounded pending settlement, initially unavailable or invalidated
  singleton fallback, exact compensation before fallback, zero hidden-source
  writes, and unrelated-context isolation.
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
- Verify numbered desktop selection plus whole-column and single-window transfer, retained source state, tail clamping, same-target no-ops, and shared-tail renewal.
- Verify manual and automatic floating desktop transfer, exact frame preservation, related-window guards, tiled-state isolation, and compensation.
- Verify manual and automatic floating output transfer, deterministic routing,
  destination-desktop adoption, KWin-owned frames, related-window guards,
  bounded mechanism compensation, and zero tiled-layout or frame writes.
- Verify bounded application-borderless exclusion decoding, canonical sorting,
  exact case-sensitive resolved-ID lookup, desktop-file precedence,
  resource-class fallback, missing and empty identities, all eligible window
  roles, global-disable dominance, policy reassertion, live settings and
  identity changes without geometry writes, focus changes, or layout-state or
  layout-persistence changes, plus ownership-safe global-disable and unload
  restoration.
- Verify live gap reflow, bounds, no-op coalescing, hidden-context deferral, capacity retry, and zero writes to minimized, floating, or excluded windows.
- Verify default-width bounds, coalescing, structural deferral, existing-layout preservation, constrained waiting admission, newly admitted-column policy, and transactional reset.
- Verify bounded one-entry-per-line application-width decoding, exact
  application-ID lookup, duplicate rejection, global-default fallback,
  constant-time admission lookup, existing-column preservation, and live
  constraint clamps for new singleton columns.
- Verify bounded application-exclusion decoding, exact case-sensitive lookup,
  startup ownership, live release and fresh readmission, native-state blockers,
  persistence omission, and zero writes to excluded frames.
- Verify width-step bounds, no-write live changes, exact percentage-point actions, hard-bound clamps, and rollback.
- Verify height-step bounds, no-write live changes, exact stack redistribution, decorated constraints, physical-pixel clamps, and rollback.
- Verify window-height preset bounds, canonical ordering, exact blank defaults,
  custom proportional targets, pixel-grid snapping, and no-write live changes.
- Verify one-step desktop reordering in both directions, all four default shortcut handlers, boundary and tail no-ops, unavailable or rejected mechanisms, wrong permutations, and the pinned tail. Unit and multi-output integration coverage preserve every output selection; integration and visible-VM coverage preserve live IDs, memberships, focus, and frames.
- Verify shared trailing and optional leading desktop creation, guarded
  removal, exact insertion confirmation, silent mutation rejection, and
  preservation of external desktops.
- Exercise live output reconfiguration against an isolated real KWin session.
- Run integration smoke tests in an isolated KWin session or NixOS VM.
