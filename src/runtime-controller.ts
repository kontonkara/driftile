import {
  solveStripGeometry,
  type Rect,
  type WindowGeometry,
} from "./core/geometry";
import {
  columnId,
  desktopId,
  outputId,
  windowId,
  type ColumnId,
  type DesktopId,
  type OutputId,
  type WindowId,
} from "./core/ids";
import {
  LayoutEngine,
  previewColumnRestoration,
  type ColumnWidth,
  type DetachedWindowPlacement,
  type HorizontalDirection,
  type LayoutColumnPlacement,
  type LayoutColumnSnapshot,
  type LayoutContextSnapshot,
  type StackEditResult,
  type VerticalDirection,
} from "./core/layout-engine";
import { diffWindowGeometries } from "./core/reconcile";
import type {
  KWinOutput,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "./platform/kwin/api";
import {
  KWinGeometryAdapter,
  hasGeometryAuthorityBlocker,
  isGeometryWritable,
  respectsSizeConstraints,
  type ContextGeometry,
  type KWinRectFactory,
} from "./platform/kwin/geometry-adapter";
import {
  normalizeWindow,
  WindowObserver,
  type ObservedWindow,
  type WindowSuspensionRequest,
} from "./platform/kwin/window-observer";
import { TopologyObserver } from "./platform/kwin/topology-observer";

const DEFAULT_COLUMN_WIDTH: ColumnWidth = {
  kind: "proportion",
  value: 0.5,
};
const DEFAULT_GAP = 16;
const FIXED_COLUMN_WIDTH_STEP = 64;
const MAX_CAPACITY_PARK_ATTEMPTS = 20;
const MAX_TOPOLOGY_SAMPLE_ATTEMPTS = 20;
const MAX_TRANSIENT_RESUME_PROBES = 20;
const MINIMUM_COLUMN_WIDTH = 64;
const PROPORTIONAL_COLUMN_WIDTH_STEP = 1 / 16;
const REQUIRED_CAPACITY_PARK_SAMPLES = 2;

type ColumnResizeAction = "decrease" | "increase" | "reset";

interface ManagedContext {
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

interface RuntimeContext extends ManagedContext {
  geometryFingerprint: string;
  readonly key: string;
  readonly windowIds: Set<WindowId>;
}

interface ManagedWindow {
  readonly contextKey: string;
  restoreBaseline: RestoreBaseline | null;
}

interface RestoreBaseline {
  readonly fingerprint: string;
  readonly frame: KWinWindow["frameGeometry"];
}

interface FloatingWindow {
  readonly placement: DetachedWindowPlacement;
  readonly sourceContextKey: string;
}

interface ToggleGeometryTransition {
  readonly contextKey: string;
  readonly expectedFrame: Rect;
  settlementArmed: boolean;
}

interface ToggleTransitionProbe {
  completedAttempts: number;
  pending: boolean;
}

interface AdmissionCandidate {
  readonly id: WindowId;
  readonly source: KWinWindow;
}

interface ActiveColumnCommand {
  readonly activeColumn: LayoutColumnSnapshot;
  readonly activeId: WindowId;
  readonly before: LayoutContextSnapshot;
  readonly context: RuntimeContext;
  readonly contextGeometry: ContextGeometry;
  readonly sampledGeometries: ReadonlyMap<string, ContextGeometry>;
}

interface ActiveWindowCommand {
  readonly activeId: WindowId;
  readonly activeWindow: KWinWindow;
  readonly context: ManagedContext;
  readonly contextGeometry: ContextGeometry;
  readonly contextKey: string;
}

interface ResumeSample {
  readonly contextKey: string | null;
  readonly frame: KWinWindow["frameGeometry"];
}

interface TransientResumeProbe {
  completedAttempts: number;
  pending: boolean;
}

interface TopologySample {
  readonly revision: number;
  readonly signature: string;
}

interface TopologyColumnMetadata {
  readonly column: LayoutColumnSnapshot;
  readonly sourceContextKey: string;
}

interface CapacityRecoveryPlan {
  readonly activeColumnId: ColumnId | null;
  readonly columns: readonly CapacityParkColumn[];
  readonly contextFingerprint: string;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly outputInstanceId: number | undefined;
  readonly viewportOffset: number;
  readonly windows: readonly CapacityParkWindow[];
}

interface CapacityParkColumn extends Omit<LayoutColumnPlacement, "index"> {
  index: number;
}

interface CapacityParkWindow {
  readonly columnId: ColumnId;
  restoreBaseline: RestoreBaseline | null;
  readonly rollbackFrame: Rect;
  readonly targetFrame: Rect;
  readonly windowId: WindowId;
}

interface CapacityParkOperation extends CapacityRecoveryPlan {
  attempts: number;
  readonly contextKey: string;
  readonly generation: number;
  probePending: boolean;
  stableSamples: number;
  readonly token: object;
  readonly topologyRevision: number;
}

interface CapacityParkingLease {
  readonly activeColumnId: ColumnId | null;
  readonly column: CapacityParkColumn;
  readonly contextFingerprint: string;
  readonly contextKey: string;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly outputInstanceId: number | undefined;
  readonly viewportOffset: number;
  readonly windows: readonly CapacityParkWindow[];
}

type AdmissionDecision =
  | { readonly fingerprint: string; readonly kind: "accepted" }
  | { readonly fingerprint?: string; readonly kind: "deferred" }
  | { readonly kind: "rejected" };

export interface RuntimeControllerOptions {
  readonly clientAreaOption: number;
  readonly columnWidth?: ColumnWidth;
  readonly createRect?: KWinRectFactory;
  readonly gap?: number;
  readonly schedule?: (callback: () => void) => void;
  readonly scheduleResume?: (callback: () => void) => void;
  readonly startupStabilizationProbes?: number;
}

export class RuntimeController {
  private readonly capacityCanceledParks = new Map<
    string,
    CapacityParkOperation
  >();
  private readonly capacitySupersededParkWindows = new Set<WindowId>();
  private readonly capacityLeasesByContext = new Map<
    string,
    Set<CapacityParkingLease>
  >();
  private readonly capacityLeaseByWindow = new Map<
    WindowId,
    CapacityParkingLease
  >();
  private readonly capacityParkOperations = new Map<
    string,
    CapacityParkOperation
  >();
  private readonly capacityParkBackoffs = new Set<string>();
  private readonly committedOutputRanks = new Map<OutputId, number>();
  private readonly contexts = new Map<string, RuntimeContext>();
  private readonly dirtyContexts = new Set<string>();
  private readonly floatingWindows = new Map<WindowId, FloatingWindow>();
  private readonly geometry: KWinGeometryAdapter;
  private readonly gap: number;
  private initializing = false;
  private readonly knownOutputInstances = new Map<string, number>();
  private lastOutputCount = 0;
  private lastWrites = 0;
  private layout = new LayoutEngine();
  private readonly managedWindows = new Map<WindowId, ManagedWindow>();
  private readonly observer: WindowObserver;
  private readonly pendingAdmissionContexts = new Set<string>();
  private readonly pendingWindowSyncs = new Set<WindowId>();
  private readonly resumeSamples = new Map<WindowId, ResumeSample>();
  private readonly schedule: (callback: () => void) => void;
  private readonly scheduleResume: (callback: () => void) => void;
  private runGeneration = 0;
  private readonly startupStabilizationProbes: number;
  private startupStabilizationRemaining = 0;
  private startupStabilizationToken: object | null = null;
  private started = false;
  private readonly width: ColumnWidth;
  private readonly requestedSuspensions = new Map<
    WindowId,
    Set<WindowSuspensionRequest>
  >();
  private readonly suspendedWindows = new Set<WindowId>();
  private topologyAllOutputs = false;
  private topologyAllowsOverflowAdmissions = false;
  private readonly topologyColumnByWindow = new Map<
    WindowId,
    TopologyColumnMetadata
  >();
  private topologyInvalidateAllBaselines = false;
  private readonly topologyInvalidatedOutputs = new Set<OutputId>();
  private readonly topologyOutputs = new Set<OutputId>();
  private topologyRecoveryPending = false;
  private topologyRevision = 0;
  private topologySample: TopologySample | null = null;
  private topologySampleAttempts = 0;
  private topologySampleToken: object | null = null;
  private topologyRetryPending = false;
  private topologyStabilizing = false;
  private topologyWindowOrder: ReadonlyMap<WindowId, number> | null = null;
  private readonly topologyObserver: TopologyObserver;
  private readonly toggleGeometryTransitions = new Map<
    WindowId,
    ToggleGeometryTransition
  >();
  private readonly toggleTransitionProbes = new Map<
    string,
    ToggleTransitionProbe
  >();
  private readonly transientResumeProbes = new Map<
    WindowId,
    TransientResumeProbe
  >();
  private readonly waitingWindowContexts = new Map<WindowId, string>();
  private readonly waitingContextFingerprints = new Map<string, string>();
  private readonly waitingWindowIds = new Map<string, Set<WindowId>>();
  private workScheduled = false;
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, options: RuntimeControllerOptions) {
    this.gap = options.gap ?? DEFAULT_GAP;
    this.schedule =
      options.schedule ??
      ((callback) => {
        callback();
      });
    this.scheduleResume = options.scheduleResume ?? this.schedule;
    this.startupStabilizationProbes = Math.max(
      0,
      Math.trunc(options.startupStabilizationProbes ?? 0),
    );
    this.width = { ...(options.columnWidth ?? DEFAULT_COLUMN_WIDTH) };
    this.workspace = workspace;
    this.observer = new WindowObserver(workspace, {
      added: this.handleWindowAdded,
      changed: this.handleWindowChanged,
      removed: this.handleWindowRemoved,
      stateChanged: this.handleWindowStateChanged,
      suspensionSettled: this.handleWindowSuspensionSettled,
      suspending: this.handleWindowSuspending,
    });
    this.geometry = new KWinGeometryAdapter(
      workspace,
      this.observer,
      options.clientAreaOption,
      options.createRect,
    );
    this.topologyObserver = new TopologyObserver(workspace, {
      changed: this.handleTopologyChanged,
    });
  }

  get lastWriteCount(): number {
    return this.lastWrites;
  }

  get floatingCount(): number {
    return this.floatingWindows.size;
  }

  get managedCount(): number {
    return this.managedWindows.size;
  }

  focusLeft(): boolean {
    return this.focusAdjacent("left");
  }

  focusRight(): boolean {
    return this.focusAdjacent("right");
  }

  focusUp(): boolean {
    return this.focusWithinActiveColumn("up");
  }

  focusDown(): boolean {
    return this.focusWithinActiveColumn("down");
  }

  moveColumnLeft(): boolean {
    return this.moveActiveColumn("left");
  }

  moveColumnRight(): boolean {
    return this.moveActiveColumn("right");
  }

  moveWindowLeft(): boolean {
    return this.moveActiveWindowHorizontally("left");
  }

  moveWindowRight(): boolean {
    return this.moveActiveWindowHorizontally("right");
  }

  moveWindowUp(): boolean {
    return this.moveActiveWindowVertically("up");
  }

  moveWindowDown(): boolean {
    return this.moveActiveWindowVertically("down");
  }

  insertWindowIntoStackLeft(): boolean {
    return this.insertActiveWindowIntoStack("left");
  }

  insertWindowIntoStackRight(): boolean {
    return this.insertActiveWindowIntoStack("right");
  }

  toggleFloating(): boolean {
    const command = this.prepareActiveWindowCommand();

    if (!command) {
      return false;
    }

    const floating = this.floatingWindows.get(command.activeId);

    if (floating) {
      return this.tileActiveWindow(command, floating);
    }

    return this.floatActiveWindow(command);
  }

  decreaseColumnWidth(): boolean {
    return this.resizeActiveColumn("decrease");
  }

  increaseColumnWidth(): boolean {
    return this.resizeActiveColumn("increase");
  }

  resetColumnWidth(): boolean {
    return this.resizeActiveColumn("reset");
  }

  probeTopology(): void {
    if (!this.started || this.topologyStabilizing) {
      return;
    }

    if (this.topologyRetryPending) {
      this.topologyRetryPending = false;
      this.topologyRevision += 1;
      this.topologySample = null;
      this.topologySampleAttempts = 0;
      this.topologyStabilizing = true;
      this.scheduleTopologySample();
      return;
    }

    this.probeToggleTransitions();
    this.sampleSettledVisibleContextGeometries();
  }

  start(): boolean {
    if (this.started) {
      return true;
    }

    if (
      this.workspace.screens.length === 0 ||
      this.workspace.desktops.length === 0
    ) {
      return false;
    }

    try {
      this.runGeneration += 1;
      this.started = true;
      this.lastOutputCount = this.workspace.screens.length;
      this.knownOutputInstances.clear();
      this.workspace.currentDesktopChanged.connect(
        this.handleCurrentDesktopChanged,
      );
      this.workspace.windowActivated.connect(this.handleWindowActivated);
      this.initializing = true;

      try {
        this.observer.start();
        this.topologyObserver.start();
        this.refreshCommittedOutputRanks();

        for (const [
          name,
          instanceId,
        ] of this.topologyObserver.outputInstances()) {
          this.knownOutputInstances.set(name, instanceId);
        }

        if (this.startupStabilizationProbes > 0) {
          this.startupStabilizationRemaining = this.startupStabilizationProbes;
          this.scheduleStartupStabilization();
        } else {
          this.synchronizePendingWindows();
          this.handleWindowActivated(this.workspace.activeWindow);
        }
      } finally {
        this.initializing = false;
      }

      this.reconcile();
      return true;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.workScheduled = false;
    this.runGeneration += 1;

    try {
      try {
        this.synchronizePendingWindows();
      } catch (error) {
        console.warn(
          `[driftile] pending window synchronization skipped during stop error=${String(error)}`,
        );
      }

      try {
        this.restoreCapacityParkingFrames();
        this.restoreOriginalFrames();
      } catch (error) {
        console.warn(
          `[driftile] original geometry restore stopped error=${String(error)}`,
        );
      }
    } finally {
      this.workspace.currentDesktopChanged.disconnect(
        this.handleCurrentDesktopChanged,
      );
      this.workspace.windowActivated.disconnect(this.handleWindowActivated);
      this.topologyObserver.stop();
      this.observer.stop();
      this.layout = new LayoutEngine();
      this.knownOutputInstances.clear();
      this.contexts.clear();
      this.dirtyContexts.clear();
      this.floatingWindows.clear();
      this.managedWindows.clear();
      this.pendingAdmissionContexts.clear();
      this.pendingWindowSyncs.clear();
      this.requestedSuspensions.clear();
      this.resumeSamples.clear();
      this.suspendedWindows.clear();
      this.startupStabilizationRemaining = 0;
      this.startupStabilizationToken = null;
      this.topologyAllOutputs = false;
      this.topologyInvalidateAllBaselines = false;
      this.topologyInvalidatedOutputs.clear();
      this.topologyOutputs.clear();
      this.topologyRecoveryPending = false;
      this.topologyRevision = 0;
      this.topologySample = null;
      this.topologySampleAttempts = 0;
      this.topologySampleToken = null;
      this.topologyRetryPending = false;
      this.topologyStabilizing = false;
      this.transientResumeProbes.clear();
      this.capacityCanceledParks.clear();
      this.capacitySupersededParkWindows.clear();
      this.capacityLeasesByContext.clear();
      this.capacityLeaseByWindow.clear();
      this.capacityParkBackoffs.clear();
      this.capacityParkOperations.clear();
      this.committedOutputRanks.clear();
      this.waitingWindowContexts.clear();
      this.waitingContextFingerprints.clear();
      this.waitingWindowIds.clear();
      this.topologyAllowsOverflowAdmissions = false;
      this.topologyColumnByWindow.clear();
      this.topologyWindowOrder = null;
      this.toggleGeometryTransitions.clear();
      this.toggleTransitionProbes.clear();
      this.workScheduled = false;
      this.lastWrites = 0;
    }
  }

  reconcile(): number {
    if (
      !this.started ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return 0;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries) {
      return 0;
    }

    this.synchronizePendingWindows();
    this.retryPendingAdmissions();
    this.dirtyContexts.clear();

    let writeCount = 0;

    for (const context of this.contexts.values()) {
      writeCount += this.reconcileContext(context, sampledGeometries);
    }

    this.lastWrites = writeCount;
    return writeCount;
  }

  private readonly handleCurrentDesktopChanged = (
    _previous: KWinVirtualDesktop | null,
    current?: KWinVirtualDesktop | null,
    output?: KWinOutput,
  ): void => {
    const globalDesktop =
      typeof this.workspace.currentDesktopForScreen !== "function";
    const liveCurrent = globalDesktop ? this.workspace.currentDesktop : current;
    let dirtied = false;

    if (liveCurrent) {
      const outputNames = globalDesktop
        ? this.workspace.screens.map((candidate) => candidate.name)
        : output
          ? [output.name]
          : [];

      for (const name of outputNames) {
        const key = contextKey({
          desktopId: desktopId(liveCurrent.id),
          outputId: outputId(name),
        });
        const context = this.contexts.get(key);

        if (context) {
          this.markContextDirty(context);
          dirtied = true;
        }

        if (this.waitingWindowIds.has(key)) {
          this.pendingAdmissionContexts.add(key);
          dirtied = true;
        }
      }
    }

    if (dirtied) {
      this.scheduleWork();
    }
  };

  private readonly handleWindowAdded = (window: ObservedWindow): void => {
    const addedId = windowId(window.id);
    const source = this.observer.source(window.id);
    const addedContext = managedContext(window);

    if (addedContext) {
      this.capacityParkBackoffs.delete(contextKey(addedContext));
    }

    if (
      this.initializing ||
      this.startupStabilizationToken !== null ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      this.pendingWindowSyncs.add(addedId);
      return;
    }

    if (source && this.tryAdmitWindow(source)) {
      this.scheduleWork();
    }
  };

  private readonly handleWindowChanged = (id: string): void => {
    const changedId = windowId(id);
    const transition = this.toggleGeometryTransitions.get(changedId);

    if (transition) {
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (!liveContext || contextKey(liveContext) !== transition.contextKey) {
        this.toggleGeometryTransitions.delete(changedId);
        this.finishCanceledToggleTransition(transition.contextKey);
      }
    }

    this.clearCapacityParkBackoffForWindow(changedId);
    this.pendingWindowSyncs.add(changedId);
    this.scheduleWork();
  };

  private readonly handleWindowStateChanged = (id: string): void => {
    const changedId = windowId(id);
    const source = this.observer.source(id);
    this.clearCapacityParkBackoffForWindow(changedId);

    if (source && hasGeometryAuthorityBlocker(source)) {
      const transition = this.toggleGeometryTransitions.get(changedId);

      if (transition) {
        this.toggleGeometryTransitions.delete(changedId);
        this.finishCanceledToggleTransition(transition.contextKey);
      }

      this.suspendGeometryLease(changedId);
    }

    this.pendingWindowSyncs.add(changedId);
    this.scheduleWork();
  };

  private readonly handleWindowSuspensionSettled = (
    id: string,
    request: WindowSuspensionRequest,
  ): void => {
    const settledId = windowId(id);
    this.clearCapacityParkBackoffForWindow(settledId);

    if (
      request.endsWith("-settling") &&
      this.requestedSuspensions.get(settledId)?.has(request)
    ) {
      this.transientResumeProbes.delete(settledId);
    }

    this.clearSuspensionRequest(settledId, request);
  };

  private readonly handleWindowSuspending = (
    id: string,
    request: WindowSuspensionRequest,
  ): void => {
    const suspendedId = windowId(id);
    this.clearCapacityParkBackoffForWindow(suspendedId);
    let requests = this.requestedSuspensions.get(suspendedId);

    if (!requests) {
      requests = new Set<WindowSuspensionRequest>();
      this.requestedSuspensions.set(suspendedId, requests);
    }

    requests.add(request);
    const transition = this.toggleGeometryTransitions.get(suspendedId);

    if (transition) {
      this.toggleGeometryTransitions.delete(suspendedId);
      this.finishCanceledToggleTransition(transition.contextKey);
    }

    if (request.endsWith("-settling")) {
      this.transientResumeProbes.delete(suspendedId);
    }

    this.suspendGeometryLease(suspendedId);
    this.pendingWindowSyncs.add(suspendedId);
    this.scheduleWork();
  };

  private readonly handleWindowRemoved = (id: string): void => {
    const managedId = windowId(id);
    const affectedContextKeys = new Set<string>();
    const floating = this.floatingWindows.get(managedId);
    const transition = this.toggleGeometryTransitions.get(managedId);

    if (floating) {
      affectedContextKeys.add(floating.sourceContextKey);
    }

    if (transition) {
      affectedContextKeys.add(transition.contextKey);
    }

    this.clearCapacityParkBackoffForWindow(managedId);
    this.cancelCapacityParkForWindow(managedId, false);
    this.invalidateCapacityLeaseForWindow(managedId);
    this.pendingWindowSyncs.delete(managedId);
    this.forgetWaitingWindow(managedId);
    this.requestedSuspensions.delete(managedId);
    this.resumeSamples.delete(managedId);
    this.suspendedWindows.delete(managedId);
    this.transientResumeProbes.delete(managedId);
    this.floatingWindows.delete(managedId);
    this.toggleGeometryTransitions.delete(managedId);
    const releasedContextKey = this.releaseWindow(managedId);

    if (releasedContextKey) {
      affectedContextKeys.add(releasedContextKey);
    }

    for (const key of affectedContextKeys) {
      this.finishCanceledToggleTransition(key);
    }
  };

  private readonly handleWindowActivated = (
    window: KWinWindow | null,
    allowSuspended = false,
  ): void => {
    if (!window || this.topologyStabilizing || this.topologyRetryPending) {
      return;
    }

    const id = windowId(String(window.internalId));

    if (
      !allowSuspended &&
      (this.suspendedWindows.has(id) || !isGeometryWritable(window))
    ) {
      return;
    }

    const owner = this.managedWindows.get(id);
    const observed = normalizeWindow(window);
    const liveContext = observed ? managedContext(observed) : null;

    if (
      !owner ||
      !liveContext ||
      contextKey(liveContext) !== owner.contextKey
    ) {
      return;
    }

    const changed = this.layout.activateWindow(id);
    const context = this.contexts.get(owner.contextKey);

    if (changed && context) {
      this.markContextDirty(context);

      if (!this.initializing) {
        this.scheduleWork();
      }
    }
  };

  private focusAdjacent(direction: HorizontalDirection): boolean {
    if (
      !this.started ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return false;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries) {
      return false;
    }

    this.synchronizePendingWindows();

    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return false;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (
      !this.toggleGeometrySettled(activeId) ||
      this.suspendedWindows.has(activeId) ||
      this.requestedSuspensions.has(activeId) ||
      !isGeometryWritable(activeWindow)
    ) {
      return false;
    }

    const owner = this.managedWindows.get(activeId);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observedActive = normalizeWindow(activeWindow);
    const activeContext = observedActive
      ? managedContext(observedActive)
      : null;

    if (
      !owner ||
      !context ||
      !activeContext ||
      contextKey(activeContext) !== owner.contextKey ||
      this.toggleTransitionPending(context.key)
    ) {
      return false;
    }

    const targetId = this.layout.adjacentWindow(activeId, direction);

    if (!targetId) {
      return false;
    }

    const targetOwner = this.managedWindows.get(targetId);
    const target = this.observer.source(targetId);
    const observedTarget = target ? normalizeWindow(target) : null;
    const targetContext = observedTarget
      ? managedContext(observedTarget)
      : null;

    if (
      !targetOwner ||
      targetOwner.contextKey !== owner.contextKey ||
      !target ||
      !this.toggleGeometrySettled(targetId) ||
      this.suspendedWindows.has(targetId) ||
      this.requestedSuspensions.has(targetId) ||
      !isGeometryWritable(target) ||
      !targetContext ||
      contextKey(targetContext) !== owner.contextKey
    ) {
      return false;
    }

    this.layout.activateWindow(targetId);
    this.dirtyContexts.delete(context.key);

    try {
      this.lastWrites = this.reconcileContext(context, sampledGeometries);
    } catch (error) {
      this.layout.activateWindow(activeId);
      this.markContextDirty(context);
      this.scheduleWork();
      console.warn(
        `[driftile] focus deferred context=${context.key} error=${String(error)}`,
      );
      return false;
    }

    this.workspace.activeWindow = target;
    return true;
  }

  private focusWithinActiveColumn(direction: VerticalDirection): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command) {
      return false;
    }

    const targetId = this.layout.adjacentWindowInColumn(
      command.activeId,
      direction,
    );

    if (!targetId) {
      return false;
    }

    const targetOwner = this.managedWindows.get(targetId);
    const target = this.observer.source(targetId);
    const observedTarget = target ? normalizeWindow(target) : null;
    const targetContext = observedTarget
      ? managedContext(observedTarget)
      : null;

    if (
      targetOwner?.contextKey !== command.context.key ||
      !target ||
      this.suspendedWindows.has(targetId) ||
      this.requestedSuspensions.has(targetId) ||
      !isGeometryWritable(target) ||
      !targetContext ||
      contextKey(targetContext) !== command.context.key
    ) {
      return false;
    }

    this.lastWrites = 0;
    this.workspace.activeWindow = target;
    return true;
  }

  private moveActiveColumn(direction: HorizontalDirection): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasPendingCapacityState(command.context.key)) {
      return false;
    }

    const oppositeDirection: HorizontalDirection =
      direction === "left" ? "right" : "left";
    return this.applyActiveColumnMutation(
      command,
      "column move",
      () => this.layout.moveActiveColumn(command.activeId, direction),
      () => this.layout.moveActiveColumn(command.activeId, oppositeDirection),
    );
  }

  private moveActiveWindowHorizontally(
    direction: HorizontalDirection,
  ): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasStructuralCapacityState(command.context.key)) {
      return false;
    }

    if (command.activeColumn.windowIds.length === 1) {
      const sourceIndex = command.before.columns.findIndex(
        (column) => column.id === command.activeColumn.id,
      );
      const targetIndex =
        direction === "left" ? sourceIndex - 1 : sourceIndex + 1;
      const target = command.before.columns[targetIndex];

      if (
        sourceIndex < 0 ||
        !target ||
        !this.columnMembersBelongToContext(target, command.context)
      ) {
        return false;
      }
    }

    const newColumnId = this.extractedColumnId(command);
    const editState: { value: StackEditResult | null } = { value: null };
    const moved = this.applyActiveColumnMutation(
      command,
      "window move",
      () => {
        editState.value = this.layout.moveActiveWindow(
          command.activeId,
          direction,
          newColumnId,
        );
        return editState.value !== null;
      },
      () =>
        editState.value !== null &&
        this.layout.rollbackStackEdit(editState.value.rollback),
    );
    const edit = editState.value;

    if (!moved || !edit) {
      return false;
    }

    this.capacityParkBackoffs.delete(command.context.key);

    if (
      edit.kind === "merge" &&
      this.waitingWindowIds.get(command.context.key)?.size
    ) {
      this.pendingAdmissionContexts.add(command.context.key);
      this.scheduleWork();
    }

    return true;
  }

  private moveActiveWindowVertically(direction: VerticalDirection): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    let edit: StackEditResult | null = null;
    return this.applyActiveColumnMutation(
      command,
      "stack reorder",
      () => {
        edit = this.layout.moveActiveWindowInColumn(
          command.activeId,
          direction,
        );
        return edit !== null;
      },
      () => edit !== null && this.layout.rollbackStackEdit(edit.rollback),
    );
  }

  private insertActiveWindowIntoStack(direction: HorizontalDirection): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasStructuralCapacityState(command.context.key)) {
      return false;
    }

    const sourceIndex = command.before.columns.findIndex(
      (column) => column.id === command.activeColumn.id,
    );

    if (sourceIndex < 0) {
      return false;
    }

    const step = direction === "left" ? -1 : 1;
    let target: LayoutColumnSnapshot | undefined;

    for (
      let index = sourceIndex + step;
      index >= 0 && index < command.before.columns.length;
      index += step
    ) {
      const candidate = command.before.columns[index];

      if (candidate && candidate.windowIds.length >= 2) {
        target = candidate;
        break;
      }
    }

    if (
      !target ||
      !this.columnMembersBelongToContext(target, command.context)
    ) {
      return false;
    }

    const editState: { value: StackEditResult | null } = { value: null };
    const inserted = this.applyActiveColumnMutation(
      command,
      "stack insertion",
      () => {
        editState.value = this.layout.insertActiveWindowIntoColumn(
          command.activeId,
          target.id,
        );
        return editState.value !== null;
      },
      () =>
        editState.value !== null &&
        this.layout.rollbackStackEdit(editState.value.rollback),
    );
    const edit = editState.value;

    if (!inserted || !edit) {
      return false;
    }

    this.capacityParkBackoffs.delete(command.context.key);

    if (
      edit.kind === "merge" &&
      this.waitingWindowIds.get(command.context.key)?.size
    ) {
      this.pendingAdmissionContexts.add(command.context.key);
      this.scheduleWork();
    }

    return true;
  }

  private floatActiveWindow(command: ActiveWindowCommand): boolean {
    const owner = this.managedWindows.get(command.activeId);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;

    if (
      !owner ||
      !context ||
      owner.contextKey !== command.contextKey ||
      this.hasStructuralCapacityState(command.contextKey)
    ) {
      return false;
    }

    const before = this.layout.snapshot(
      command.context.outputId,
      command.context.desktopId,
    );
    const preview = this.layout.previewWindowDetach(command.activeId);

    if (!preview || before.activeColumnId !== preview.placement.columnId) {
      return false;
    }

    const sourceColumn = before.columns.find(
      (column) => column.id === preview.placement.columnId,
    );

    if (
      !sourceColumn ||
      !this.columnMembersBelongToContext(sourceColumn, context)
    ) {
      return false;
    }

    const safeBaseline =
      owner.restoreBaseline?.fingerprint ===
        command.contextGeometry.fingerprint &&
      this.geometry.canApplyFrame(
        command.activeId,
        owner.restoreBaseline.frame,
        command.context,
      )
        ? owner.restoreBaseline.frame
        : command.activeWindow.frameGeometry;
    const floatingTarget: WindowGeometry = {
      columnId: preview.placement.columnId,
      frame: { ...safeBaseline },
      windowId: command.activeId,
    };

    return this.applyWindowOwnershipTransition(
      command,
      preview.layout,
      [floatingTarget],
      command.activeId,
      () => this.layout.commitWindowDetach(preview),
      () => {
        this.managedWindows.delete(command.activeId);
        context.windowIds.delete(command.activeId);
        this.floatingWindows.set(command.activeId, {
          placement: preview.placement,
          sourceContextKey: command.contextKey,
        });
        this.capacityParkBackoffs.delete(command.contextKey);

        if (context.windowIds.size === 0) {
          this.contexts.delete(command.contextKey);
          this.dirtyContexts.delete(command.contextKey);
        }

        if (this.waitingWindowIds.get(command.contextKey)?.size) {
          this.pendingAdmissionContexts.add(command.contextKey);
        }
      },
      "floating toggle",
    );
  }

  private tileActiveWindow(
    command: ActiveWindowCommand,
    floating: FloatingWindow,
  ): boolean {
    if (
      this.managedWindows.has(command.activeId) ||
      this.hasStructuralCapacityState(command.contextKey)
    ) {
      return false;
    }

    const before = this.layout.snapshot(
      command.context.outputId,
      command.context.desktopId,
    );
    const placement =
      floating.sourceContextKey === command.contextKey
        ? floating.placement
        : this.freshDetachedWindowPlacement(command, before);
    const preview = this.layout.previewWindowAttach(placement);

    if (!preview) {
      return false;
    }

    const restoreBaseline: RestoreBaseline = {
      fingerprint: command.contextGeometry.fingerprint,
      frame: { ...command.activeWindow.frameGeometry },
    };
    const existingContext = this.contexts.get(command.contextKey);
    const runtimeContext: RuntimeContext = existingContext ?? {
      ...command.context,
      geometryFingerprint: command.contextGeometry.fingerprint,
      key: command.contextKey,
      windowIds: new Set<WindowId>(),
    };

    return this.applyWindowOwnershipTransition(
      command,
      preview.layout,
      [],
      command.activeId,
      (viewportOffset) => {
        if (!this.layout.commitWindowAttach(preview)) {
          return false;
        }

        this.layout.setViewportOffset(
          command.context.outputId,
          command.context.desktopId,
          viewportOffset,
        );
        return true;
      },
      () => {
        if (!existingContext) {
          this.contexts.set(command.contextKey, runtimeContext);
        }

        runtimeContext.windowIds.add(command.activeId);
        runtimeContext.geometryFingerprint =
          command.contextGeometry.fingerprint;
        this.managedWindows.set(command.activeId, {
          contextKey: command.contextKey,
          restoreBaseline,
        });
        this.floatingWindows.delete(command.activeId);
        this.capacityParkBackoffs.delete(command.contextKey);
        this.forgetWaitingWindow(command.activeId);
      },
      "tiling toggle",
    );
  }

  private resizeActiveColumn(action: ColumnResizeAction): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    const width = this.resizedColumnWidth(command, action);

    if (!width) {
      return false;
    }

    let previousWidth: ColumnWidth | null = null;
    const resized = this.applyActiveColumnMutation(
      command,
      "column resize",
      () => {
        previousWidth = this.layout.setActiveColumnWidth(
          command.activeId,
          width,
        );
        return previousWidth !== null;
      },
      () =>
        previousWidth !== null &&
        this.layout.setActiveColumnWidth(command.activeId, previousWidth) !==
          null,
    );

    if (!resized) {
      return false;
    }

    this.capacityParkBackoffs.delete(command.context.key);

    if (
      this.capacityLeasesByContext.get(command.context.key)?.size ||
      this.waitingWindowIds.get(command.context.key)?.size
    ) {
      this.pendingAdmissionContexts.add(command.context.key);
      this.scheduleWork();
    }

    return true;
  }

  private resizedColumnWidth(
    command: ActiveColumnCommand,
    action: ColumnResizeAction,
  ): ColumnWidth | null {
    let minimum = MINIMUM_COLUMN_WIDTH;
    let maximum = Number.POSITIVE_INFINITY;

    for (const id of command.activeColumn.windowIds) {
      const source = this.observer.source(id);

      if (!source) {
        return null;
      }

      const minimumWidth = source.minSize.width;
      const maximumWidth = source.maxSize.width;

      if (Number.isFinite(minimumWidth) && minimumWidth > 0) {
        minimum = Math.max(minimum, minimumWidth);
      }

      if (Number.isFinite(maximumWidth) && maximumWidth > 0) {
        maximum = Math.min(maximum, maximumWidth);
      }
    }

    const devicePixelRatio = command.contextGeometry.devicePixelRatio;

    if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
      return null;
    }

    minimum = ceilToPhysicalPixel(minimum, devicePixelRatio);

    if (Number.isFinite(maximum)) {
      maximum = floorToPhysicalPixel(maximum, devicePixelRatio);
    }

    if (maximum < minimum) {
      return null;
    }

    const current = command.activeColumn.width;
    let candidate: ColumnWidth;

    if (action === "reset") {
      candidate = { ...this.width };
    } else {
      const step =
        current.kind === "fixed"
          ? FIXED_COLUMN_WIDTH_STEP
          : PROPORTIONAL_COLUMN_WIDTH_STEP;
      const direction = action === "increase" ? 1 : -1;
      candidate = {
        kind: current.kind,
        value: this.steppedWidthValue(current, step, direction),
      };
    }

    if (candidate.kind === "fixed") {
      candidate = {
        kind: "fixed",
        value: clamp(candidate.value, minimum, maximum),
      };
    } else {
      const denominator = command.contextGeometry.workArea.width - this.gap;

      if (!Number.isFinite(denominator) || denominator <= 0) {
        return null;
      }

      const minimumProportion = (minimum + this.gap) / denominator;
      const maximumProportion = (maximum + this.gap) / denominator;
      candidate = {
        kind: "proportion",
        value: clamp(candidate.value, minimumProportion, maximumProportion),
      };
    }

    if (
      (action === "increase" && candidate.value <= current.value) ||
      (action === "decrease" && candidate.value >= current.value)
    ) {
      return null;
    }

    return current.kind === candidate.kind && current.value === candidate.value
      ? null
      : candidate;
  }

  private steppedWidthValue(
    current: ColumnWidth,
    step: number,
    direction: -1 | 1,
  ): number {
    if (current.kind !== this.width.kind) {
      return current.value + direction * step;
    }

    const latticeOffset = (current.value - this.width.value) / step;
    const latticeIndex = Math.round(latticeOffset);
    const latticeValue = this.width.value + latticeIndex * step;

    if (
      Math.abs(current.value - latticeValue) <=
      floatingPointTolerance(current.value, this.width.value, latticeValue)
    ) {
      return this.width.value + (latticeIndex + direction) * step;
    }

    return current.value + direction * step;
  }

  private extractedColumnId(command: ActiveColumnCommand): ColumnId {
    const columnIds = new Set(
      command.before.columns.map((column) => column.id),
    );
    const canonical = columnId(`column:${String(command.activeId)}`);

    if (!columnIds.has(canonical)) {
      return canonical;
    }

    const base = `column:split:${String(command.activeId)}`;

    for (let index = 0; index <= command.before.columns.length; index += 1) {
      const candidate = columnId(
        index === 0 ? base : `${base}:${String(index)}`,
      );

      if (!columnIds.has(candidate)) {
        return candidate;
      }
    }

    throw new Error("could not allocate an extracted column ID");
  }

  private freshDetachedWindowPlacement(
    command: ActiveWindowCommand,
    context: LayoutContextSnapshot,
  ): DetachedWindowPlacement {
    const columnIds = new Set(context.columns.map((column) => column.id));
    const canonical = columnId(`column:${String(command.activeId)}`);
    let detachedColumnId = canonical;

    if (columnIds.has(detachedColumnId)) {
      const base = `column:floating:${String(command.activeId)}`;

      for (let index = 0; index <= context.columns.length; index += 1) {
        const candidate = columnId(
          index === 0 ? base : `${base}:${String(index)}`,
        );

        if (!columnIds.has(candidate)) {
          detachedColumnId = candidate;
          break;
        }
      }
    }

    if (columnIds.has(detachedColumnId)) {
      throw new Error("could not allocate a floating column ID");
    }

    const activeIndex = context.columns.findIndex(
      (column) => column.id === context.activeColumnId,
    );
    const columnIndex =
      activeIndex < 0 ? context.columns.length : activeIndex + 1;

    return {
      columnId: detachedColumnId,
      columnIndex,
      columnWidth: { ...this.width },
      desktopId: command.context.desktopId,
      memberIndex: 0,
      nextColumnId: context.columns[columnIndex]?.id ?? null,
      nextWindowId: null,
      outputId: command.context.outputId,
      previousColumnId: context.columns[columnIndex - 1]?.id ?? null,
      previousWindowId: null,
      windowId: command.activeId,
    };
  }

  private columnMembersBelongToContext(
    column: LayoutColumnSnapshot,
    context: RuntimeContext,
  ): boolean {
    return column.windowIds.every((id) => {
      const owner = this.managedWindows.get(id);
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const memberContext = observed ? managedContext(observed) : null;
      return (
        owner?.contextKey === context.key &&
        source !== undefined &&
        memberContext !== null &&
        contextKey(memberContext) === context.key
      );
    });
  }

  private prepareActiveWindowCommand(): ActiveWindowCommand | null {
    if (
      !this.started ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !this.sampleSettledVisibleContextGeometries() ||
      !this.synchronizePendingWindows() ||
      this.hasTopologyBarrier()
    ) {
      return null;
    }

    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (
      !this.toggleGeometrySettled(activeId) ||
      this.suspendedWindows.has(activeId) ||
      this.requestedSuspensions.has(activeId) ||
      !isGeometryWritable(activeWindow)
    ) {
      return null;
    }

    const observed = normalizeWindow(activeWindow);
    const context = observed ? managedContext(observed) : null;

    if (!context) {
      return null;
    }

    const key = contextKey(context);
    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch {
      return null;
    }

    if (!contextGeometry) {
      return null;
    }

    const runtimeContext = this.contexts.get(key);

    if (
      runtimeContext &&
      runtimeContext.geometryFingerprint !== contextGeometry.fingerprint
    ) {
      this.handleTopologyChanged(String(context.outputId));
      return null;
    }

    if (this.toggleTransitionPending(key)) {
      return null;
    }

    return {
      activeId,
      activeWindow,
      context,
      contextGeometry,
      contextKey: key,
    };
  }

  private toggleGeometrySettled(id: WindowId): boolean {
    const transition = this.toggleGeometryTransitions.get(id);

    if (!transition) {
      return true;
    }

    const source = this.observer.source(id);

    if (!source) {
      this.toggleGeometryTransitions.delete(id);
      return true;
    }

    if (!transition.settlementArmed) {
      return false;
    }

    if (!rectsEqual(source.frameGeometry, transition.expectedFrame)) {
      return false;
    }

    this.toggleGeometryTransitions.delete(id);
    return true;
  }

  private hasUnsettledToggleTransition(key: string): boolean {
    for (const [id, transition] of this.toggleGeometryTransitions) {
      if (transition.contextKey === key && !this.toggleGeometrySettled(id)) {
        return true;
      }
    }

    return false;
  }

  private toggleTransitionPending(key: string): boolean {
    if (this.hasUnsettledToggleTransition(key)) {
      return true;
    }

    if (!this.toggleTransitionProbes.delete(key)) {
      return false;
    }

    if (this.dirtyContexts.has(key) || this.pendingAdmissionContexts.has(key)) {
      this.scheduleWork();
    }

    return false;
  }

  private armToggleTransitionSettlement(key: string): void {
    for (const transition of this.toggleGeometryTransitions.values()) {
      if (transition.contextKey === key) {
        transition.settlementArmed = true;
      }
    }
  }

  private finishCanceledToggleTransition(key: string): void {
    if (this.waitingWindowIds.get(key)?.size) {
      this.pendingAdmissionContexts.add(key);
    }

    const hasRemainingTransition = [
      ...this.toggleGeometryTransitions.values(),
    ].some((transition) => transition.contextKey === key);

    if (hasRemainingTransition) {
      const probe = this.toggleTransitionProbes.get(key);

      if (probe && probe.completedAttempts >= MAX_TRANSIENT_RESUME_PROBES) {
        probe.completedAttempts = MAX_TRANSIENT_RESUME_PROBES - 1;
      }

      this.scheduleToggleTransitionProbe(key);
      return;
    }

    this.toggleTransitionProbes.delete(key);

    if (this.dirtyContexts.has(key) || this.pendingAdmissionContexts.has(key)) {
      this.scheduleWork();
    }
  }

  private scheduleToggleTransitionProbe(key: string): void {
    if (!this.started) {
      return;
    }

    let probe = this.toggleTransitionProbes.get(key);

    if (!probe) {
      probe = { completedAttempts: 0, pending: false };
      this.toggleTransitionProbes.set(key, probe);
    }

    if (
      probe.pending ||
      probe.completedAttempts >= MAX_TRANSIENT_RESUME_PROBES
    ) {
      return;
    }

    probe.pending = true;
    const runGeneration = this.runGeneration;
    let schedulerReturned = false;

    this.scheduleResume(() => {
      if (
        !this.started ||
        this.runGeneration !== runGeneration ||
        this.toggleTransitionProbes.get(key) !== probe
      ) {
        return;
      }

      const synchronous = !schedulerReturned;

      if (!synchronous) {
        probe.pending = false;
      }

      probe.completedAttempts += 1;
      const unsettled = this.hasUnsettledToggleTransition(key);
      this.armToggleTransitionSettlement(key);

      if (!unsettled) {
        this.toggleTransitionProbes.delete(key);

        if (
          this.dirtyContexts.has(key) ||
          this.pendingAdmissionContexts.has(key)
        ) {
          this.scheduleWork();
        }
      }

      if (synchronous && this.toggleTransitionProbes.get(key) === probe) {
        probe.pending = false;
      }

      if (unsettled) {
        this.scheduleToggleTransitionProbe(key);
      }
    });
    schedulerReturned = true;
  }

  private probeToggleTransitions(): void {
    const keys = new Set(
      [...this.toggleGeometryTransitions.values()].map(
        (transition) => transition.contextKey,
      ),
    );

    for (const key of keys) {
      const probe = this.toggleTransitionProbes.get(key);

      if (probe && probe.completedAttempts >= MAX_TRANSIENT_RESUME_PROBES) {
        probe.completedAttempts = MAX_TRANSIENT_RESUME_PROBES - 1;
      }

      this.scheduleToggleTransitionProbe(key);
    }
  }

  private prepareActiveColumnCommand(): ActiveColumnCommand | null {
    if (
      !this.started ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier()
    ) {
      return null;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries || !this.synchronizePendingWindows()) {
      return null;
    }

    if (this.hasTopologyBarrier()) {
      return null;
    }

    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (
      !this.toggleGeometrySettled(activeId) ||
      this.suspendedWindows.has(activeId) ||
      this.requestedSuspensions.has(activeId) ||
      !isGeometryWritable(activeWindow)
    ) {
      return null;
    }

    const owner = this.managedWindows.get(activeId);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observedActive = normalizeWindow(activeWindow);
    const activeContext = observedActive
      ? managedContext(observedActive)
      : null;

    if (
      !owner ||
      !context ||
      !activeContext ||
      contextKey(activeContext) !== owner.contextKey ||
      this.toggleTransitionPending(context.key)
    ) {
      return null;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumn = before.columns.find((column) =>
      column.windowIds.includes(activeId),
    );

    if (
      !activeColumn ||
      before.activeColumnId !== activeColumn.id ||
      !this.columnMembersBelongToContext(activeColumn, context)
    ) {
      return null;
    }

    const contextGeometry = sampledGeometries.get(context.key);

    if (!contextGeometry) {
      return null;
    }

    return {
      activeColumn,
      activeId,
      before,
      context,
      contextGeometry,
      sampledGeometries,
    };
  }

  private applyActiveColumnMutation(
    command: ActiveColumnCommand,
    label: string,
    mutate: () => boolean,
    rollback: () => boolean,
  ): boolean {
    if (!mutate()) {
      return false;
    }

    const { before, context, contextGeometry, sampledGeometries } = command;
    const restoreLayout = (): boolean => {
      if (!rollback()) {
        return false;
      }

      this.layout.setViewportOffset(
        context.outputId,
        context.desktopId,
        before.viewportOffset,
      );
      return true;
    };
    let nextLayout: ReturnType<typeof solveStripGeometry>;

    try {
      nextLayout = solveStripGeometry({
        context: this.layout.snapshot(context.outputId, context.desktopId),
        devicePixelRatio: contextGeometry.devicePixelRatio,
        gap: this.gap,
        pixelGridOrigin: contextGeometry.pixelGridOrigin,
        workArea: contextGeometry.workArea,
      });
    } catch (error) {
      restoreLayout();
      console.warn(
        `[driftile] ${label} rejected context=${context.key} error=${String(error)}`,
      );
      return false;
    }

    const writableLayout = nextLayout.windows.filter(
      (window) => !this.suspendedWindows.has(window.windowId),
    );

    if (
      !this.canApplyLayout(nextLayout.maxViewportOffset) ||
      nextLayout.windows.some((window) => {
        const source = this.observer.source(window.windowId);
        return !source || !respectsSizeConstraints(window.frame, source);
      }) ||
      writableLayout.some(
        (window) =>
          !this.geometry.canApplyFrame(window.windowId, window.frame, context),
      )
    ) {
      restoreLayout();
      return false;
    }

    const rollbackWindowIds = writableLayout.map((window) => window.windowId);
    const observedBefore = this.geometry.observedFrames(
      rollbackWindowIds,
      context,
    );
    const rollbackLayout: WindowGeometry[] = [];

    for (const window of writableLayout) {
      const frame = observedBefore.get(window.windowId);

      if (!frame) {
        restoreLayout();
        return false;
      }

      rollbackLayout.push({ ...window, frame });
    }

    const forwardWindowIds = new Set(
      diffWindowGeometries(writableLayout, observedBefore).map(
        (change) => change.windowId,
      ),
    );
    const rollbackTargets = rollbackLayout.filter((window) =>
      forwardWindowIds.has(window.windowId),
    );
    const wasDirty = this.dirtyContexts.has(context.key);
    this.dirtyContexts.delete(context.key);
    let forwardWrites = 0;
    let forwardError: string | null = null;

    try {
      forwardWrites = this.reconcileContext(
        context,
        sampledGeometries,
        () => !this.hasTopologyBarrier(),
      );
    } catch (error) {
      forwardError = String(error);
    }

    if (
      forwardError === null &&
      !this.hasTopologyBarrier() &&
      !this.dirtyContexts.has(context.key)
    ) {
      this.lastWrites = forwardWrites;
      return true;
    }

    const restored = restoreLayout();

    if (restored && this.topologyWindowOrder !== null) {
      this.captureTopologyWindowOrder();
    }

    let compensationWrites = 0;

    if (restored && !this.hasTopologyBarrier()) {
      this.dirtyContexts.delete(context.key);
      compensationWrites = this.geometry.apply(
        rollbackTargets,
        context,
        () => !this.hasTopologyBarrier(),
      );

      if (compensationWrites !== rollbackTargets.length || wasDirty) {
        this.markContextDirty(context);
      }
    } else {
      this.markContextDirty(context);
    }

    this.lastWrites = forwardWrites + compensationWrites;

    if (this.dirtyContexts.has(context.key)) {
      this.scheduleWork();
    }

    if (forwardError !== null) {
      console.warn(
        `[driftile] ${label} rolled back context=${context.key} error=${forwardError}`,
      );
    }

    return false;
  }

  private applyWindowOwnershipTransition(
    command: ActiveWindowCommand,
    nextContext: LayoutContextSnapshot,
    additionalWindows: readonly WindowGeometry[],
    transitionWindowId: WindowId,
    commit: (viewportOffset: number) => boolean,
    afterCommit: () => void,
    label: string,
  ): boolean {
    let nextLayout: ReturnType<typeof solveStripGeometry>;

    try {
      nextLayout = solveStripGeometry({
        context: nextContext,
        devicePixelRatio: command.contextGeometry.devicePixelRatio,
        gap: this.gap,
        pixelGridOrigin: command.contextGeometry.pixelGridOrigin,
        workArea: command.contextGeometry.workArea,
      });
    } catch (error) {
      console.warn(
        `[driftile] ${label} rejected context=${command.contextKey} error=${String(error)}`,
      );
      return false;
    }

    const writableLayout = nextLayout.windows.filter(
      (window) =>
        !this.suspendedWindows.has(window.windowId) &&
        !this.requestedSuspensions.has(window.windowId),
    );
    const desiredIds = new Set(writableLayout.map((window) => window.windowId));

    if (
      additionalWindows.some((window) => {
        if (desiredIds.has(window.windowId)) {
          return true;
        }

        desiredIds.add(window.windowId);
        return false;
      }) ||
      !this.canApplyLayout(nextLayout.maxViewportOffset) ||
      nextLayout.windows.some((window) => {
        const source = this.observer.source(window.windowId);
        return !source || !respectsSizeConstraints(window.frame, source);
      })
    ) {
      return false;
    }

    const desired = [...writableLayout, ...additionalWindows];
    const transitionTarget = desired.find(
      (window) => window.windowId === transitionWindowId,
    );

    if (
      !transitionTarget ||
      desired.some(
        (window) =>
          !this.geometry.canApplyFrame(
            window.windowId,
            window.frame,
            command.context,
          ),
      )
    ) {
      return false;
    }

    const windowIds = desired.map((window) => window.windowId);
    const observedBefore = this.geometry.observedFrames(
      windowIds,
      command.context,
    );

    if (observedBefore.size !== windowIds.length) {
      return false;
    }

    const changes = diffWindowGeometries(desired, observedBefore);
    const changedIds = new Set(changes.map((change) => change.windowId));
    const rollbackTargets: WindowGeometry[] = [];

    for (const window of desired) {
      if (!changedIds.has(window.windowId)) {
        continue;
      }

      const frame = observedBefore.get(window.windowId);

      if (!frame) {
        return false;
      }

      rollbackTargets.push({ ...window, frame });
    }

    const trackedTransitions = desired.filter((window) =>
      changedIds.has(window.windowId),
    );

    for (const window of trackedTransitions) {
      this.toggleGeometryTransitions.set(window.windowId, {
        contextKey: command.contextKey,
        expectedFrame: { ...window.frame },
        settlementArmed: true,
      });
    }

    const wasDirty = this.dirtyContexts.has(command.contextKey);
    this.dirtyContexts.delete(command.contextKey);
    let forwardWrites = 0;
    let forwardError: string | null = null;

    try {
      forwardWrites = this.geometry.apply(
        changes,
        command.context,
        () => !this.hasTopologyBarrier(),
      );
    } catch (error) {
      forwardError = String(error);
    }

    const forwardComplete =
      forwardError === null &&
      forwardWrites === changes.length &&
      !this.hasTopologyBarrier() &&
      !this.dirtyContexts.has(command.contextKey);

    if (forwardComplete && commit(nextLayout.viewportOffset)) {
      this.lastWrites = forwardWrites;
      afterCommit();
      const unsettled =
        trackedTransitions.length > 0 &&
        this.toggleTransitionPending(command.contextKey);

      if (unsettled) {
        this.scheduleToggleTransitionProbe(command.contextKey);
      } else if (this.pendingAdmissionContexts.has(command.contextKey)) {
        this.scheduleWork();
      }

      return true;
    }

    for (const window of trackedTransitions) {
      this.toggleGeometryTransitions.delete(window.windowId);
    }

    let compensationWrites = 0;
    const runtimeContext = this.contexts.get(command.contextKey);
    const floatingRollbackTargets = rollbackTargets.filter((window) =>
      this.floatingWindows.has(window.windowId),
    );
    const compensationTargets = this.hasTopologyBarrier()
      ? floatingRollbackTargets
      : rollbackTargets;

    for (const window of compensationTargets) {
      this.toggleGeometryTransitions.set(window.windowId, {
        contextKey: command.contextKey,
        expectedFrame: { ...window.frame },
        settlementArmed: false,
      });
    }

    if (!this.hasTopologyBarrier()) {
      this.dirtyContexts.delete(command.contextKey);
      compensationWrites = this.geometry.apply(
        rollbackTargets,
        command.context,
        () => !this.hasTopologyBarrier(),
      );
    } else if (floatingRollbackTargets.length > 0) {
      compensationWrites = this.geometry.apply(
        floatingRollbackTargets,
        command.context,
      );
    }

    if (
      compensationTargets.length > 0 &&
      this.toggleTransitionPending(command.contextKey)
    ) {
      this.scheduleToggleTransitionProbe(command.contextKey);
    }

    if (
      runtimeContext &&
      (this.hasTopologyBarrier() ||
        compensationWrites !== rollbackTargets.length ||
        wasDirty)
    ) {
      this.markContextDirty(runtimeContext);
      this.scheduleWork();
    }

    this.lastWrites = forwardWrites + compensationWrites;

    if (forwardError !== null) {
      console.warn(
        `[driftile] ${label} rolled back context=${command.contextKey} error=${forwardError}`,
      );
    }

    return false;
  }

  private hasPendingCapacityState(key: string): boolean {
    return Boolean(
      this.hasCapacityMutationInFlight(key) ||
      this.capacityLeasesByContext.get(key)?.size ||
      this.capacityParkBackoffs.has(key),
    );
  }

  private hasCapacityMutationInFlight(key: string): boolean {
    return (
      this.capacityParkOperations.has(key) ||
      this.capacityCanceledParks.has(key)
    );
  }

  private hasStructuralCapacityState(key: string): boolean {
    return Boolean(
      this.hasCapacityMutationInFlight(key) ||
      this.capacityLeasesByContext.get(key)?.size,
    );
  }

  private hasTopologyBarrier(): boolean {
    return (
      this.topologyStabilizing ||
      this.topologyRetryPending ||
      this.topologyWindowOrder !== null
    );
  }

  private scheduleStartupStabilization(): void {
    if (!this.started || this.startupStabilizationRemaining <= 0) {
      return;
    }

    if (!this.startupStabilizationToken) {
      this.startupStabilizationToken = {};
    }

    const runGeneration = this.runGeneration;
    const token = this.startupStabilizationToken;

    this.scheduleResume(() => {
      if (
        !this.started ||
        this.runGeneration !== runGeneration ||
        this.startupStabilizationToken !== token
      ) {
        return;
      }

      this.startupStabilizationRemaining -= 1;

      if (this.startupStabilizationRemaining > 0) {
        this.scheduleStartupStabilization();
        return;
      }

      this.startupStabilizationToken = null;

      try {
        this.initializing = true;
        const topologyBatchPending = this.topologyWindowOrder !== null;
        const topologyBatchConsumed = this.synchronizePendingWindows(
          topologyBatchPending && this.topologyAllowsOverflowAdmissions,
        );

        if (topologyBatchPending && topologyBatchConsumed) {
          this.topologyColumnByWindow.clear();
          this.topologyAllowsOverflowAdmissions = false;
          this.topologyWindowOrder = null;
        }

        this.handleWindowActivated(
          this.workspace.activeWindow,
          topologyBatchPending && topologyBatchConsumed,
        );
        this.initializing = false;
        this.flushScheduledWork();
      } catch (error) {
        console.warn(
          `[driftile] delayed startup failed error=${String(error)}`,
        );
        this.initializing = false;
        this.stop();
      } finally {
        this.initializing = false;
      }
    });
  }

  private refreshCommittedOutputRanks(): void {
    const outputs = [...this.workspace.screens].sort(
      (left, right) =>
        left.geometry.x - right.geometry.x ||
        left.geometry.y - right.geometry.y ||
        left.name.localeCompare(right.name),
    );
    this.committedOutputRanks.clear();

    for (const [rank, output] of outputs.entries()) {
      this.committedOutputRanks.set(outputId(output.name), rank);
    }
  }

  private captureTopologyWindowOrder(): void {
    const keys = new Set<string>([
      ...this.contexts.keys(),
      ...this.waitingWindowIds.keys(),
    ]);
    const orderedKeys = [...keys].sort((left, right) => {
      const leftContext = managedContextFromKey(left);
      const rightContext = managedContextFromKey(right);
      const leftRank = leftContext
        ? (this.committedOutputRanks.get(leftContext.outputId) ??
          Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
      const rightRank = rightContext
        ? (this.committedOutputRanks.get(rightContext.outputId) ??
          Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank || left.localeCompare(right);
    });
    const order = new Map<WindowId, number>();
    this.topologyColumnByWindow.clear();
    let rank = 0;
    const append = (id: WindowId): void => {
      if (!order.has(id)) {
        order.set(id, rank);
        rank += 1;
      }
    };

    for (const key of orderedKeys) {
      const context = this.contexts.get(key);
      const parsed = context ?? managedContextFromKey(key);

      if (!parsed) {
        continue;
      }

      const snapshot = this.layout.snapshot(parsed.outputId, parsed.desktopId);
      const leases = [...(this.capacityLeasesByContext.get(key) ?? [])];
      const logical =
        leases.length === 0
          ? snapshot
          : previewColumnRestoration(
              snapshot,
              leases.map((lease) => lease.column),
            );

      for (const column of (logical ?? snapshot).columns) {
        const metadata: TopologyColumnMetadata = {
          column: {
            id: column.id,
            width: { ...column.width },
            windowIds: [...column.windowIds],
          },
          sourceContextKey: key,
        };

        for (const id of column.windowIds) {
          append(id);
          this.topologyColumnByWindow.set(id, metadata);
        }
      }

      for (const id of this.waitingWindowIds.get(key) ?? []) {
        append(id);
      }
    }

    for (const source of this.workspace.stackingOrder) {
      append(windowId(String(source.internalId)));
    }

    this.topologyWindowOrder = order;
  }

  private readonly handleTopologyChanged = (outputName?: string): void => {
    if (!this.started) {
      return;
    }

    const canceledTransitionKeys = new Set<string>();

    for (const [id, transition] of this.toggleGeometryTransitions) {
      const context = managedContextFromKey(transition.contextKey);

      if (!outputName || String(context?.outputId) === outputName) {
        this.toggleGeometryTransitions.delete(id);
        canceledTransitionKeys.add(transition.contextKey);
      }
    }

    const remainingTransitionKeys = new Set(
      [...this.toggleGeometryTransitions.values()].map(
        (transition) => transition.contextKey,
      ),
    );

    for (const key of canceledTransitionKeys) {
      if (!remainingTransitionKeys.has(key)) {
        this.toggleTransitionProbes.delete(key);
      }
    }

    if (!outputName && this.topologyWindowOrder === null) {
      this.captureTopologyWindowOrder();
      this.topologyAllowsOverflowAdmissions = false;
    }

    this.recordCapacityTopologyBaselineInvalidation(outputName);
    this.clearCapacityParkBackoffsForTopology(outputName);

    if (outputName) {
      const changedOutputId = outputId(outputName);
      this.topologyOutputs.add(changedOutputId);
      this.recordTopologyBaselineInvalidation(changedOutputId);
    } else {
      this.topologyAllOutputs = true;
      this.topologyInvalidateAllBaselines = true;
    }

    this.topologyRevision += 1;
    this.topologyRecoveryPending = false;
    this.topologySample = null;
    this.topologySampleAttempts = 0;
    this.topologyRetryPending = false;
    this.topologyStabilizing = true;
    this.cancelCapacityParkOperations(false);
    this.scheduleTopologySample();
  };

  private clearCapacityParkBackoffForWindow(id: WindowId): void {
    const owner = this.managedWindows.get(id);
    const lease = this.capacityLeaseByWindow.get(id);
    const waitingContext = this.waitingWindowContexts.get(id);

    if (owner) {
      this.capacityParkBackoffs.delete(owner.contextKey);
    }

    if (lease) {
      this.capacityParkBackoffs.delete(lease.contextKey);
    }

    if (waitingContext) {
      this.capacityParkBackoffs.delete(waitingContext);
    }
  }

  private clearCapacityParkBackoffsForTopology(outputName?: string): void {
    if (!outputName) {
      const currentInstances = this.topologyObserver.outputInstances();

      for (const key of [...this.capacityParkBackoffs]) {
        const context = managedContextFromKey(key);

        if (
          !context ||
          this.knownOutputInstances.get(String(context.outputId)) ===
            currentInstances.get(String(context.outputId))
        ) {
          continue;
        }

        this.capacityParkBackoffs.delete(key);
        const runtime = this.contexts.get(key);

        if (runtime) {
          this.markContextDirty(runtime);
        }
      }

      return;
    }

    for (const key of [...this.capacityParkBackoffs]) {
      if (key.slice(0, key.indexOf("\u0000")) === outputName) {
        this.capacityParkBackoffs.delete(key);
        const context = this.contexts.get(key);

        if (context) {
          this.markContextDirty(context);
        }
      }
    }
  }

  private recordCapacityTopologyBaselineInvalidation(
    outputName?: string,
  ): void {
    const invalidate = (
      output: OutputId,
      desktop: DesktopId,
      fingerprint: string,
      outputInstanceId: number | undefined,
      windows: readonly CapacityParkWindow[],
    ): void => {
      if (outputName && String(output) !== outputName) {
        return;
      }

      let changed: boolean;
      const currentInstance = this.topologyObserver
        .outputInstances()
        .get(String(output));

      if (currentInstance !== outputInstanceId) {
        changed = true;
      } else {
        try {
          changed =
            this.geometry.contextGeometry(output, desktop)?.fingerprint !==
            fingerprint;
        } catch {
          changed = true;
        }
      }

      if (changed) {
        for (const window of windows) {
          window.restoreBaseline = null;
        }
      }
    };
    const operations = new Set<CapacityParkOperation>([
      ...this.capacityParkOperations.values(),
      ...this.capacityCanceledParks.values(),
    ]);

    for (const operation of operations) {
      invalidate(
        operation.outputId,
        operation.desktopId,
        operation.contextFingerprint,
        operation.outputInstanceId,
        operation.windows,
      );
    }

    for (const leases of this.capacityLeasesByContext.values()) {
      for (const lease of leases) {
        invalidate(
          lease.outputId,
          lease.desktopId,
          lease.contextFingerprint,
          lease.outputInstanceId,
          lease.windows,
        );
      }
    }
  }

  private recordTopologyBaselineInvalidation(changedOutputId: OutputId): void {
    const currentInstance = this.topologyObserver
      .outputInstances()
      .get(String(changedOutputId));

    if (
      this.knownOutputInstances.get(String(changedOutputId)) !== currentInstance
    ) {
      this.topologyInvalidatedOutputs.add(changedOutputId);
      return;
    }

    for (const context of this.contexts.values()) {
      if (context.outputId !== changedOutputId) {
        continue;
      }

      try {
        const current = this.geometry.contextGeometry(
          context.outputId,
          context.desktopId,
        );

        if (!current || current.fingerprint !== context.geometryFingerprint) {
          this.topologyInvalidatedOutputs.add(changedOutputId);
          return;
        }
      } catch {
        this.topologyInvalidatedOutputs.add(changedOutputId);
        return;
      }
    }

    for (const [key, fingerprint] of this.waitingContextFingerprints) {
      if (this.contexts.has(key)) {
        continue;
      }

      const context = managedContextFromKey(key);

      if (!context || context.outputId !== changedOutputId) {
        continue;
      }

      try {
        const current = this.geometry.contextGeometry(
          context.outputId,
          context.desktopId,
        );

        if (!current || current.fingerprint !== fingerprint) {
          this.topologyInvalidatedOutputs.add(changedOutputId);
          return;
        }
      } catch {
        this.topologyInvalidatedOutputs.add(changedOutputId);
        return;
      }
    }
  }

  private sampleSettledVisibleContextGeometries(): ReadonlyMap<
    string,
    ContextGeometry
  > | null {
    const geometries = new Map<string, ContextGeometry>();
    const outputNames = new Set<string>();
    const keys = new Set<string>([
      ...this.contexts.keys(),
      ...this.waitingWindowIds.keys(),
    ]);

    for (const key of keys) {
      const runtimeContext = this.contexts.get(key);
      const context = runtimeContext ?? managedContextFromKey(key);

      if (!context) {
        continue;
      }

      if (!this.isContextVisible(context)) {
        continue;
      }

      let current: ContextGeometry | null;

      try {
        current = this.geometry.contextGeometry(
          context.outputId,
          context.desktopId,
        );
      } catch (error) {
        console.warn(
          `[driftile] topology probe deferred context=${key} error=${String(error)}`,
        );
        outputNames.add(String(context.outputId));
        continue;
      }

      const fingerprint =
        runtimeContext?.geometryFingerprint ??
        this.waitingContextFingerprints.get(key);

      if (!current) {
        outputNames.add(String(context.outputId));
      } else if (fingerprint === undefined) {
        this.waitingContextFingerprints.set(key, current.fingerprint);
        outputNames.add(String(context.outputId));
      } else if (current.fingerprint !== fingerprint) {
        outputNames.add(String(context.outputId));
      } else {
        geometries.set(key, current);
      }
    }

    for (const outputName of outputNames) {
      this.handleTopologyChanged(outputName);
    }

    return outputNames.size > 0 ? null : geometries;
  }

  private scheduleTopologySample(): void {
    if (!this.started || this.topologySampleToken) {
      return;
    }

    const token = {};
    const runGeneration = this.runGeneration;
    this.topologySampleToken = token;

    this.scheduleResume(() => {
      if (
        !this.started ||
        this.runGeneration !== runGeneration ||
        this.topologySampleToken !== token
      ) {
        return;
      }

      this.topologySampleToken = null;
      this.topologySampleAttempts += 1;

      for (const changedOutputId of this.topologyOutputs) {
        this.recordTopologyBaselineInvalidation(changedOutputId);
      }

      const signature = this.createTopologySignature();

      if (signature === null) {
        if (this.topologySampleAttempts >= MAX_TOPOLOGY_SAMPLE_ATTEMPTS) {
          this.deferTopologyRecovery();
          return;
        }

        this.scheduleTopologySample();
        return;
      }

      const sample: TopologySample = {
        revision: this.topologyRevision,
        signature,
      };

      if (
        !this.topologySample ||
        this.topologySample.revision !== sample.revision ||
        this.topologySample.signature !== sample.signature
      ) {
        this.topologySample = sample;

        if (this.topologySampleAttempts >= MAX_TOPOLOGY_SAMPLE_ATTEMPTS) {
          this.deferTopologyRecovery();
          return;
        }

        this.scheduleTopologySample();
        return;
      }

      this.topologySample = sample;
      this.topologyRecoveryPending = true;
      this.scheduleWork();
    });
  }

  private deferTopologyRecovery(): void {
    console.warn("[driftile] topology stabilization deferred");
    this.topologyRecoveryPending = false;
    this.topologyRetryPending = true;
    this.topologySample = null;
    this.topologySampleAttempts = 0;
    this.topologySampleToken = null;
    this.topologyStabilizing = false;
  }

  private createTopologySignature(): string | null {
    try {
      const outputInstances = this.topologyObserver.outputInstances();
      const outputMembership = this.workspace.screens
        .map((output) => [
          output.name,
          outputInstances.get(output.name) ?? null,
        ])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
      const outputDetails = this.workspace.screens
        .filter(
          (output) =>
            this.topologyAllOutputs ||
            this.topologyOutputs.has(outputId(output.name)),
        )
        .map((output) => [
          output.name,
          output.geometry.x,
          output.geometry.y,
          output.geometry.width,
          output.geometry.height,
          output.devicePixelRatio,
        ])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
      const contextKeys = new Set<string>([
        ...this.contexts.keys(),
        ...this.waitingWindowIds.keys(),
      ]);
      const contexts: unknown[][] = [];

      for (const key of contextKeys) {
        const context = this.contexts.get(key) ?? managedContextFromKey(key);

        if (
          !context ||
          (!this.topologyAllOutputs &&
            !this.topologyOutputs.has(context.outputId))
        ) {
          continue;
        }

        contexts.push([
          key,
          this.geometry.contextGeometry(context.outputId, context.desktopId)
            ?.fingerprint ?? null,
        ]);
      }

      contexts.sort((left, right) =>
        String(left[0]).localeCompare(String(right[0])),
      );
      const windows: unknown[][] = [];

      for (const source of this.workspace.stackingOrder) {
        const id = windowId(String(source.internalId));
        const observed = normalizeWindow(source);
        const liveOutputId = source.output
          ? outputId(source.output.name)
          : observed
            ? outputId(observed.outputId)
            : null;
        const ownerKey =
          this.managedWindows.get(id)?.contextKey ??
          this.waitingWindowContexts.get(id);
        const ownerOutputId = ownerKey
          ? managedContextFromKey(ownerKey)?.outputId
          : undefined;
        const affected =
          this.topologyAllOutputs ||
          (liveOutputId !== null && this.topologyOutputs.has(liveOutputId)) ||
          (ownerOutputId !== undefined &&
            this.topologyOutputs.has(ownerOutputId));

        if (!affected) {
          continue;
        }

        windows.push([
          String(id),
          source.output?.name ?? null,
          source.desktops.map((desktop) => desktop.id).join("\u0001"),
          source.onAllDesktops,
          source.frameGeometry.x,
          source.frameGeometry.y,
          source.frameGeometry.width,
          source.frameGeometry.height,
        ]);
      }

      windows.sort((left, right) =>
        String(left[0]).localeCompare(String(right[0])),
      );

      return JSON.stringify({
        contexts,
        outputDetails,
        outputMembership,
        windows,
      });
    } catch (error) {
      if (this.topologySampleAttempts === 1) {
        console.warn(
          `[driftile] topology sample unavailable error=${String(error)}`,
        );
      }

      return null;
    }
  }

  private synchronizeTopologyRecovery(): boolean {
    const committingRevision = this.topologyRevision;
    const settledSample = this.topologySample;
    this.topologySampleAttempts += 1;

    for (const changedOutputId of this.topologyOutputs) {
      this.recordTopologyBaselineInvalidation(changedOutputId);
    }

    const liveSignature = this.createTopologySignature();

    if (
      !settledSample ||
      settledSample.revision !== this.topologyRevision ||
      liveSignature !== settledSample.signature
    ) {
      this.topologyRecoveryPending = false;

      if (this.topologySampleAttempts >= MAX_TOPOLOGY_SAMPLE_ATTEMPTS) {
        this.deferTopologyRecovery();
        return false;
      }

      this.topologySample =
        liveSignature === null
          ? null
          : { revision: this.topologyRevision, signature: liveSignature };
      this.scheduleTopologySample();
      return false;
    }

    const currentOutputInstances = this.topologyObserver.outputInstances();
    const outputCountChanged =
      this.lastOutputCount !== this.workspace.screens.length;
    const outputMembershipChanged =
      currentOutputInstances.size !== this.knownOutputInstances.size ||
      [...currentOutputInstances.keys()].some(
        (name) => !this.knownOutputInstances.has(name),
      );
    const replacedOutputs = new Set<OutputId>();

    for (const [name, instanceId] of this.knownOutputInstances) {
      if (currentOutputInstances.get(name) !== instanceId) {
        replacedOutputs.add(outputId(name));
      }
    }

    for (const [name, instanceId] of currentOutputInstances) {
      if (this.knownOutputInstances.get(name) !== instanceId) {
        replacedOutputs.add(outputId(name));
      }
    }

    const fullResync =
      this.topologyAllOutputs || outputCountChanged || outputMembershipChanged;
    const affectedContexts = new Map<
      string,
      {
        readonly context: ManagedContext;
        readonly current: ContextGeometry | null;
        readonly runtime: RuntimeContext | undefined;
      }
    >();

    for (const key of new Set<string>([
      ...this.contexts.keys(),
      ...this.waitingWindowIds.keys(),
    ])) {
      const runtime = this.contexts.get(key);
      const context = runtime ?? managedContextFromKey(key);

      if (
        !context ||
        (!fullResync &&
          !this.topologyOutputs.has(context.outputId) &&
          !replacedOutputs.has(context.outputId))
      ) {
        continue;
      }

      let current: ContextGeometry | null = null;

      try {
        current = this.geometry.contextGeometry(
          context.outputId,
          context.desktopId,
        );
      } catch (error) {
        console.warn(
          `[driftile] topology context deferred context=${key} error=${String(error)}`,
        );
      }

      affectedContexts.set(key, { context, current, runtime });
    }

    if (this.topologyRevision !== committingRevision) {
      return false;
    }

    for (const leases of [...this.capacityLeasesByContext.values()]) {
      for (const lease of [...leases]) {
        if (!replacedOutputs.has(lease.outputId)) {
          continue;
        }

        for (const window of lease.windows) {
          this.pendingWindowSyncs.add(window.windowId);
        }
      }
    }

    if (fullResync) {
      for (const id of this.managedWindows.keys()) {
        this.pendingWindowSyncs.add(id);
      }

      for (const source of this.workspace.stackingOrder) {
        const observed = normalizeWindow(source);

        if (observed) {
          this.pendingWindowSyncs.add(windowId(observed.id));
        }
      }

      for (const id of this.waitingWindowContexts.keys()) {
        this.pendingWindowSyncs.add(id);
      }
    }

    for (const [key, { context, current, runtime }] of affectedContexts) {
      if (!runtime) {
        if (current) {
          this.waitingContextFingerprints.set(key, current.fingerprint);
        }

        continue;
      }

      const geometryChanged =
        !current ||
        current.fingerprint !== runtime.geometryFingerprint ||
        replacedOutputs.has(context.outputId);
      const restoreInvalidated =
        geometryChanged ||
        this.topologyInvalidatedOutputs.has(context.outputId);

      if (restoreInvalidated) {
        this.invalidateRestoreBaselines(runtime);
      }

      if (geometryChanged || outputMembershipChanged) {
        this.markContextDirty(runtime);
      }

      if (current) {
        runtime.geometryFingerprint = current.fingerprint;
      }
    }

    if (!fullResync) {
      for (const [id, key] of this.waitingWindowContexts) {
        const ownerOutput = key.slice(0, key.indexOf("\u0000"));

        if (this.topologyOutputs.has(outputId(ownerOutput))) {
          this.pendingWindowSyncs.add(id);
        }
      }
    }

    this.orderPendingWindowSyncs();

    this.knownOutputInstances.clear();

    for (const [name, instanceId] of currentOutputInstances) {
      this.knownOutputInstances.set(name, instanceId);
    }

    this.lastOutputCount = this.workspace.screens.length;
    this.refreshCommittedOutputRanks();
    this.topologyAllowsOverflowAdmissions ||=
      outputMembershipChanged || replacedOutputs.size > 0;
    this.topologyRecoveryPending = false;
    this.topologyRetryPending = false;
    this.topologyStabilizing = false;
    this.topologySample = null;
    this.topologySampleAttempts = 0;
    this.topologySampleToken = null;
    this.topologyAllOutputs = false;
    this.topologyInvalidateAllBaselines = false;
    this.topologyInvalidatedOutputs.clear();
    this.topologyOutputs.clear();
    return true;
  }

  private orderPendingWindowSyncs(): void {
    if (this.pendingWindowSyncs.size < 2) {
      return;
    }

    const liveOrder = new Map<WindowId, number>();

    for (const [index, source] of this.workspace.stackingOrder.entries()) {
      liveOrder.set(windowId(String(source.internalId)), index);
    }

    const ordered = [...this.pendingWindowSyncs].sort((left, right) => {
      const leftTopologyRank =
        this.topologyWindowOrder?.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightTopologyRank =
        this.topologyWindowOrder?.get(right) ?? Number.MAX_SAFE_INTEGER;
      const leftLiveRank = liveOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightLiveRank = liveOrder.get(right) ?? Number.MAX_SAFE_INTEGER;

      return (
        leftTopologyRank - rightTopologyRank ||
        leftLiveRank - rightLiveRank ||
        String(left).localeCompare(String(right))
      );
    });
    this.pendingWindowSyncs.clear();

    for (const id of ordered) {
      this.pendingWindowSyncs.add(id);
    }
  }

  private invalidateRestoreBaselines(context: RuntimeContext): void {
    for (const id of context.windowIds) {
      const owner = this.managedWindows.get(id);

      if (owner?.contextKey === context.key) {
        owner.restoreBaseline = null;
      }
    }

    const operation = this.capacityParkOperations.get(context.key);

    for (const window of operation?.windows ?? []) {
      window.restoreBaseline = null;
    }

    for (const lease of this.capacityLeasesByContext.get(context.key) ?? []) {
      for (const window of lease.windows) {
        window.restoreBaseline = null;
      }
    }
  }

  private scheduleWork(): void {
    if (!this.started || this.initializing || this.workScheduled) {
      return;
    }

    this.workScheduled = true;
    const runGeneration = this.runGeneration;
    this.schedule(() => {
      if (this.runGeneration !== runGeneration) {
        return;
      }

      this.workScheduled = false;

      if (this.started) {
        this.flushScheduledWork();
      }
    });
  }

  private flushScheduledWork(): void {
    let topologyRecovered = false;

    if (this.topologyRecoveryPending) {
      topologyRecovered = this.synchronizeTopologyRecovery();
    }

    if (this.topologyStabilizing || this.topologyRetryPending) {
      return;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries) {
      return;
    }

    const topologyBatchPending = this.topologyWindowOrder !== null;
    const topologyBatchConsumed = this.synchronizePendingWindows(
      topologyBatchPending && this.topologyAllowsOverflowAdmissions,
    );

    if (topologyBatchPending && topologyBatchConsumed) {
      this.topologyColumnByWindow.clear();
      this.topologyAllowsOverflowAdmissions = false;
      this.topologyWindowOrder = null;
    }

    this.retryPendingAdmissions();

    if (topologyRecovered || (topologyBatchPending && topologyBatchConsumed)) {
      this.initializing = true;

      try {
        this.handleWindowActivated(this.workspace.activeWindow, true);
      } finally {
        this.initializing = false;
      }
    }

    const dirtyContextKeys = [...this.dirtyContexts];
    this.dirtyContexts.clear();
    let writeCount = 0;

    for (const key of dirtyContextKeys) {
      const context = this.contexts.get(key);

      if (context) {
        try {
          writeCount += this.reconcileContext(context, sampledGeometries);
        } catch (error) {
          this.dirtyContexts.add(key);
          console.warn(
            `[driftile] context reconcile deferred context=${key} error=${String(error)}`,
          );
        }
      }
    }

    this.lastWrites = writeCount;
  }

  private synchronizePendingWindows(allowOverflowAdmissions = false): boolean {
    if (
      this.startupStabilizationToken !== null ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return false;
    }

    if (this.pendingWindowSyncs.size === 0) {
      return true;
    }

    const pendingIds = [...this.pendingWindowSyncs];
    const admissionCandidates: KWinWindow[] = [];
    const preservedRestoreBaselines = new Map<
      WindowId,
      RestoreBaseline | null
    >();
    const releasedContextKeys = new Set<string>();
    this.pendingWindowSyncs.clear();

    if (allowOverflowAdmissions) {
      this.prepareTopologyCapacityLeases(pendingIds, preservedRestoreBaselines);
      this.releaseTopologyManagedWindows(
        pendingIds,
        preservedRestoreBaselines,
        releasedContextKeys,
      );
    }

    for (const id of pendingIds) {
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const nextContext = observed ? managedContext(observed) : null;
      const owner = this.managedWindows.get(id);
      let capacityLease = this.capacityLeaseByWindow.get(id);

      if (
        capacityLease &&
        (!nextContext || contextKey(nextContext) !== capacityLease.contextKey)
      ) {
        this.invalidateCapacityLeaseForWindow(id);
        capacityLease = undefined;
      }

      if (allowOverflowAdmissions && capacityLease) {
        this.invalidateCapacityLeaseForWindow(id);
        capacityLease = undefined;
      }

      if (!capacityLease) {
        this.forgetWaitingWindow(id);
      }

      let resumed = false;

      const requests = this.requestedSuspensions.get(id);
      const changedContext = Boolean(
        owner && (!nextContext || contextKey(nextContext) !== owner.contextKey),
      );
      const geometryBlocked = Boolean(
        this.suspendedWindows.has(id) ||
        requests ||
        (source && hasGeometryAuthorityBlocker(source)),
      );

      if (allowOverflowAdmissions && source && nextContext) {
        if (geometryBlocked) {
          this.suspendGeometryLease(id);
        }

        admissionCandidates.push(source);
        continue;
      }

      const maximizeSettling = Boolean(
        source?.maximizeMode === 0 && requests?.has("maximized-settling"),
      );
      const nativeTileSettling = Boolean(
        source?.tile === null && requests?.has("native-tile-settling"),
      );

      if (maximizeSettling || nativeTileSettling) {
        this.suspendGeometryLease(id);
        const probe = this.transientResumeProbes.get(id);

        if (!probe || probe.completedAttempts < MAX_TRANSIENT_RESUME_PROBES) {
          this.scheduleTransientResumeProbe(id);
          continue;
        }

        this.transientResumeProbes.delete(id);

        if (maximizeSettling) {
          this.clearSuspensionRequest(id, "maximized-settling");
        }

        if (nativeTileSettling) {
          this.clearSuspensionRequest(id, "native-tile-settling");
        }
      }

      if (this.requestedSuspensions.has(id)) {
        this.suspendGeometryLease(id);
        continue;
      }

      if (source && hasGeometryAuthorityBlocker(source)) {
        this.suspendGeometryLease(id);
        continue;
      }

      if (this.suspendedWindows.has(id)) {
        if (!source) {
          continue;
        }

        if (!isGeometryWritable(source)) {
          this.suspendGeometryLease(id);
          this.scheduleTransientResumeProbe(id);
          continue;
        }

        if (!this.resumeGeometryLease(id, source, nextContext)) {
          continue;
        }

        resumed = true;
      }

      if (!source) {
        continue;
      }

      if (this.floatingWindows.has(id)) {
        this.forgetWaitingWindow(id);

        if (capacityLease) {
          this.invalidateCapacityLeaseForWindow(id);
        }

        continue;
      }

      if (capacityLease && nextContext) {
        this.pendingAdmissionContexts.add(capacityLease.contextKey);
        continue;
      }

      if (changedContext) {
        const releasedContextKey = this.releaseWindow(id);

        if (releasedContextKey) {
          releasedContextKeys.add(releasedContextKey);
        }
      }

      if (nextContext && (!owner || changedContext)) {
        admissionCandidates.push(source);
      } else if (owner && nextContext && isGeometryWritable(source)) {
        const context = this.contexts.get(owner.contextKey);

        if (context) {
          if (
            resumed &&
            String(this.workspace.activeWindow?.internalId) === String(id)
          ) {
            this.layout.activateWindow(id);
          }

          this.markContextDirty(context);
        }
      }
    }

    this.admitWindows(
      admissionCandidates,
      allowOverflowAdmissions,
      preservedRestoreBaselines,
    );

    this.retryWaitingWindows(releasedContextKeys);
    return true;
  }

  private prepareTopologyCapacityLeases(
    pendingIds: readonly WindowId[],
    preservedRestoreBaselines: Map<WindowId, RestoreBaseline | null>,
  ): void {
    const leases = new Set<CapacityParkingLease>();

    for (const id of pendingIds) {
      const lease = this.capacityLeaseByWindow.get(id);

      if (lease) {
        leases.add(lease);
      }
    }

    for (const lease of leases) {
      for (const window of lease.windows) {
        const source = this.observer.source(window.windowId);
        const observed = source ? normalizeWindow(source) : null;
        const context = observed ? managedContext(observed) : null;

        if (context && contextKey(context) === lease.contextKey) {
          preservedRestoreBaselines.set(
            window.windowId,
            cloneRestoreBaseline(window.restoreBaseline),
          );
        }
      }
    }

    this.invalidateCapacityLeases(leases);
  }

  private releaseTopologyManagedWindows(
    pendingIds: readonly WindowId[],
    preservedRestoreBaselines: Map<WindowId, RestoreBaseline | null>,
    releasedContextKeys: Set<string>,
  ): void {
    const releases = new Map<
      string,
      { readonly context: RuntimeContext; readonly ids: WindowId[] }
    >();

    for (const id of pendingIds) {
      const owner = this.managedWindows.get(id);
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const nextContext = observed ? managedContext(observed) : null;

      if (!owner || !source || !nextContext) {
        continue;
      }

      if (owner.contextKey === contextKey(nextContext)) {
        preservedRestoreBaselines.set(
          id,
          cloneRestoreBaseline(owner.restoreBaseline),
        );
      }

      const runtimeContext = this.contexts.get(owner.contextKey);

      if (!runtimeContext) {
        continue;
      }

      const release = releases.get(owner.contextKey);

      if (release) {
        release.ids.push(id);
      } else {
        releases.set(owner.contextKey, {
          context: runtimeContext,
          ids: [id],
        });
      }
    }

    for (const [key, release] of releases) {
      const removed = this.layout.unmanageWindows({
        desktopId: release.context.desktopId,
        outputId: release.context.outputId,
        windowIds: release.ids,
      });

      if (!removed) {
        console.warn(
          `[driftile] topology batch release fell back context=${key}`,
        );

        for (const id of release.ids) {
          if (this.releaseWindow(id)) {
            releasedContextKeys.add(key);
          }
        }

        continue;
      }

      for (const id of release.ids) {
        this.managedWindows.delete(id);
        release.context.windowIds.delete(id);
      }

      this.capacityParkBackoffs.delete(key);
      releasedContextKeys.add(key);

      if (release.context.windowIds.size === 0) {
        this.contexts.delete(key);
        this.dirtyContexts.delete(key);
      } else {
        this.markContextDirty(release.context);
      }
    }
  }

  private admitWindows(
    sources: readonly KWinWindow[],
    allowOverflow = false,
    preservedRestoreBaselines: ReadonlyMap<
      WindowId,
      RestoreBaseline | null
    > = new Map(),
  ): number {
    if (allowOverflow) {
      return this.admitTopologyWindowGroups(sources, preservedRestoreBaselines);
    }

    if (
      !this.initializing ||
      sources.length < 2 ||
      this.workspace.screens.length !== 1
    ) {
      let admitted = 0;

      for (const source of sources) {
        admitted += this.tryAdmitWindow(source) ? 1 : 0;
      }

      return admitted;
    }

    const groups = new Map<
      string,
      { context: ManagedContext; sources: KWinWindow[] }
    >();

    for (const source of sources) {
      const id = windowId(String(source.internalId));
      const observed = normalizeWindow(source);
      const context = observed ? managedContext(observed) : null;

      if (!observed || !context || this.managedWindows.has(id)) {
        this.forgetWaitingWindow(id);
        continue;
      }

      if (!isGeometryWritable(source)) {
        this.suspendGeometryLease(id);
        this.scheduleTransientResumeProbe(id);
        continue;
      }

      const key = contextKey(context);
      const group = groups.get(key);

      if (group) {
        group.sources.push(source);
      } else {
        groups.set(key, { context, sources: [source] });
      }
    }

    let admitted = 0;

    for (const group of groups.values()) {
      admitted += this.admitWindowGroup(group.context, group.sources);
    }

    return admitted;
  }

  private admitTopologyWindowGroups(
    sources: readonly KWinWindow[],
    preservedRestoreBaselines: ReadonlyMap<WindowId, RestoreBaseline | null>,
  ): number {
    const groups = new Map<
      string,
      { readonly context: ManagedContext; readonly sources: KWinWindow[] }
    >();

    for (const source of sources) {
      const id = windowId(String(source.internalId));
      const observed = normalizeWindow(source);
      const context = observed ? managedContext(observed) : null;

      if (!context || this.managedWindows.has(id)) {
        continue;
      }

      const key = contextKey(context);
      const group = groups.get(key);

      if (group) {
        group.sources.push(source);
      } else {
        groups.set(key, { context, sources: [source] });
      }
    }

    let admitted = 0;

    for (const group of groups.values()) {
      admitted += this.admitTopologyWindowGroup(
        group.context,
        group.sources,
        preservedRestoreBaselines,
      );
    }

    return admitted;
  }

  private admitTopologyWindowGroup(
    context: ManagedContext,
    sources: readonly KWinWindow[],
    preservedRestoreBaselines: ReadonlyMap<WindowId, RestoreBaseline | null>,
  ): number {
    const key = contextKey(context);
    const candidates: Array<
      AdmissionCandidate & { readonly suspended: boolean }
    > = [];

    for (const source of sources) {
      const id = windowId(String(source.internalId));

      if (this.floatingWindows.has(id)) {
        this.forgetWaitingWindow(id);
        continue;
      }

      const suspended =
        this.suspendedWindows.has(id) ||
        this.requestedSuspensions.has(id) ||
        hasGeometryAuthorityBlocker(source);
      candidates.push({ id, source, suspended });
    }

    if (candidates.length === 0) {
      return 0;
    }

    if (this.toggleTransitionPending(key)) {
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key);
      }

      this.pendingAdmissionContexts.add(key);
      return 0;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch (error) {
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key);
      }

      console.warn(
        `[driftile] topology admission deferred context=${key} error=${String(error)}`,
      );
      return 0;
    }

    if (!contextGeometry) {
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key);
      }

      return 0;
    }

    const existingContext = this.contexts.get(key);

    if (
      existingContext &&
      existingContext.geometryFingerprint !== contextGeometry.fingerprint
    ) {
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
      }

      this.handleTopologyChanged(String(context.outputId));
      return 0;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const usedColumnIds = new Set(before.columns.map((column) => column.id));
    const plannedByKey = new Map<
      string,
      {
        readonly candidates: Array<
          AdmissionCandidate & { readonly suspended: boolean }
        >;
        readonly column: {
          id: ColumnId;
          width: ColumnWidth;
          windowIds: WindowId[];
        };
      }
    >();

    for (const candidate of candidates) {
      const metadata = this.topologyColumnByWindow.get(candidate.id);
      const columnKey = metadata
        ? `${metadata.sourceContextKey}\u0001${String(metadata.column.id)}`
        : String(candidate.id);
      let planned = plannedByKey.get(columnKey);

      if (!planned) {
        let plannedColumnId =
          metadata?.column.id ?? columnId(`column:${String(candidate.id)}`);

        if (usedColumnIds.has(plannedColumnId)) {
          plannedColumnId = columnId(`column:${String(candidate.id)}`);
        }

        usedColumnIds.add(plannedColumnId);
        planned = {
          candidates: [],
          column: {
            id: plannedColumnId,
            width: { ...(metadata?.column.width ?? this.width) },
            windowIds: [],
          },
        };
        plannedByKey.set(columnKey, planned);
      }

      planned.candidates.push(candidate);
      planned.column.windowIds.push(candidate.id);
    }

    let plannedColumns = [...plannedByKey.values()];
    const preview = (columns: typeof plannedColumns) => {
      const placements = columns.map((planned, index) => ({
        column: planned.column,
        index: before.columns.length + index,
      }));
      const snapshot = previewColumnRestoration(before, placements);

      if (!snapshot) {
        return null;
      }

      return {
        layout: solveStripGeometry({
          context: snapshot,
          devicePixelRatio: contextGeometry.devicePixelRatio,
          gap: this.gap,
          pixelGridOrigin: contextGeometry.pixelGridOrigin,
          workArea: contextGeometry.workArea,
        }),
        placements,
      };
    };
    let plannedPreview = preview(plannedColumns);

    if (!plannedPreview) {
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
      }

      return 0;
    }

    const frames = new Map(
      plannedPreview.layout.windows.map((window) => [
        window.windowId,
        window.frame,
      ]),
    );
    const rejectedColumns = new Set(
      plannedColumns
        .filter((planned) =>
          planned.candidates.some((candidate) => {
            if (candidate.suspended) {
              return false;
            }

            const frame = frames.get(candidate.id);
            return !(
              frame && this.geometry.canApplyFrame(candidate.id, frame, context)
            );
          }),
        )
        .map((planned) => planned.column.id),
    );

    if (rejectedColumns.size > 0) {
      for (const planned of plannedColumns) {
        if (!rejectedColumns.has(planned.column.id)) {
          continue;
        }

        for (const candidate of planned.candidates) {
          this.forgetWaitingWindow(candidate.id);
        }
      }

      plannedColumns = plannedColumns.filter(
        (planned) => !rejectedColumns.has(planned.column.id),
      );
      plannedPreview = preview(plannedColumns);
    }

    if (plannedColumns.length === 0) {
      return 0;
    }

    if (
      !plannedPreview ||
      !this.layout.restoreColumns({
        columns: plannedPreview.placements,
        desktopId: context.desktopId,
        outputId: context.outputId,
      })
    ) {
      for (const planned of plannedColumns) {
        for (const candidate of planned.candidates) {
          this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
        }
      }

      return 0;
    }

    const admittedCandidates = plannedColumns.reduce<
      Array<AdmissionCandidate & { readonly suspended: boolean }>
    >((admitted, planned) => {
      admitted.push(...planned.candidates);
      return admitted;
    }, []);

    let runtimeContext = existingContext;

    if (!runtimeContext) {
      runtimeContext = {
        ...context,
        geometryFingerprint: contextGeometry.fingerprint,
        key,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    for (const candidate of admittedCandidates) {
      const preserved = preservedRestoreBaselines.has(candidate.id)
        ? cloneRestoreBaseline(
            preservedRestoreBaselines.get(candidate.id) ?? null,
          )
        : undefined;
      const restoreBaseline =
        preserved !== undefined
          ? preserved
          : candidate.suspended
            ? null
            : {
                fingerprint: contextGeometry.fingerprint,
                frame: { ...candidate.source.frameGeometry },
              };

      runtimeContext.windowIds.add(candidate.id);
      this.managedWindows.set(candidate.id, {
        contextKey: key,
        restoreBaseline,
      });
      this.forgetWaitingWindow(candidate.id);

      if (candidate.suspended) {
        this.suspendGeometryLease(candidate.id);
      } else {
        this.resumeSamples.delete(candidate.id);
        this.suspendedWindows.delete(candidate.id);
        this.transientResumeProbes.delete(candidate.id);
      }

      this.layout.activateWindow(candidate.id);
    }

    this.capacityParkBackoffs.delete(key);
    this.markContextDirty(runtimeContext);
    return admittedCandidates.length;
  }

  private admitWindowGroup(
    context: ManagedContext,
    sources: readonly KWinWindow[],
  ): number {
    const key = contextKey(context);
    const candidates: AdmissionCandidate[] = [];

    for (const source of sources) {
      const id = windowId(String(source.internalId));

      if (this.floatingWindows.has(id)) {
        this.forgetWaitingWindow(id);
        continue;
      }

      const added = this.layout.manageWindow({
        columnId: columnId(`column:${String(id)}`),
        desktopId: context.desktopId,
        outputId: context.outputId,
        width: this.width,
        windowId: id,
      });

      if (added) {
        candidates.push({ id, source });
      } else {
        this.forgetWaitingWindow(id);
      }
    }

    if (candidates.length === 0) {
      return 0;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch (error) {
      this.rollbackAdmissionGroup(candidates, key);

      if (this.initializing) {
        throw error;
      }

      console.warn(
        `[driftile] window admission group skipped context=${key} error=${String(error)}`,
      );
      return 0;
    }

    if (!contextGeometry) {
      this.rollbackAdmissionGroup(candidates, key);
      return 0;
    }

    const existingContext = this.contexts.get(key);

    if (
      existingContext &&
      existingContext.geometryFingerprint !== contextGeometry.fingerprint
    ) {
      this.rollbackAdmissionGroup(candidates, key);
      this.handleTopologyChanged(String(context.outputId));
      return 0;
    }

    let admittedCandidates = candidates;

    while (admittedCandidates.length > 0) {
      const layout = solveStripGeometry({
        context: this.layout.snapshot(context.outputId, context.desktopId),
        devicePixelRatio: contextGeometry.devicePixelRatio,
        gap: this.gap,
        pixelGridOrigin: contextGeometry.pixelGridOrigin,
        workArea: contextGeometry.workArea,
      });
      const frames = new Map(
        layout.windows.map((window) => [window.windowId, window.frame]),
      );
      const rejected = admittedCandidates.filter((candidate) => {
        const frame = frames.get(candidate.id);
        return !(
          this.canApplyLayout(layout.maxViewportOffset) &&
          frame &&
          this.geometry.canApplyFrame(candidate.id, frame, context)
        );
      });

      if (rejected.length === 0) {
        break;
      }

      const rejectedIds = new Set(rejected.map((candidate) => candidate.id));

      for (const candidate of rejected) {
        this.layout.unmanageWindow(candidate.id);
        this.forgetWaitingWindow(candidate.id);
      }

      admittedCandidates = admittedCandidates.filter(
        (candidate) => !rejectedIds.has(candidate.id),
      );
    }

    if (admittedCandidates.length === 0) {
      return 0;
    }

    let runtimeContext = this.contexts.get(key);

    if (!runtimeContext) {
      runtimeContext = {
        ...context,
        geometryFingerprint: contextGeometry.fingerprint,
        key,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    for (const candidate of admittedCandidates) {
      runtimeContext.windowIds.add(candidate.id);
      this.managedWindows.set(candidate.id, {
        contextKey: key,
        restoreBaseline: {
          fingerprint: contextGeometry.fingerprint,
          frame: { ...candidate.source.frameGeometry },
        },
      });
      this.forgetWaitingWindow(candidate.id);

      if (
        !this.initializing &&
        String(this.workspace.activeWindow?.internalId) === String(candidate.id)
      ) {
        this.layout.activateWindow(candidate.id);
      }
    }

    this.capacityParkBackoffs.delete(key);
    this.markContextDirty(runtimeContext);
    return admittedCandidates.length;
  }

  private rollbackAdmissionGroup(
    candidates: readonly AdmissionCandidate[],
    contextKey: string,
  ): void {
    for (const candidate of candidates) {
      this.layout.unmanageWindow(candidate.id);
      this.deferWindow(candidate.id, contextKey);
    }
  }

  private tryAdmitWindow(source: KWinWindow): boolean {
    const id = windowId(String(source.internalId));
    const observed = normalizeWindow(source);
    const capacityLease = this.capacityLeaseByWindow.get(id);

    if (this.floatingWindows.has(id)) {
      if (capacityLease) {
        this.invalidateCapacityLeaseForWindow(id);
      }

      this.forgetWaitingWindow(id);
      return false;
    }

    if (!observed) {
      if (capacityLease) {
        this.invalidateCapacityLeaseForWindow(id);
      }

      this.forgetWaitingWindow(id);
      return false;
    }

    const context = managedContext(observed);

    if (!context) {
      if (capacityLease) {
        this.invalidateCapacityLeaseForWindow(id);
      }

      this.forgetWaitingWindow(id);
      return false;
    }

    const key = contextKey(context);

    if (this.toggleTransitionPending(key)) {
      this.deferWindow(id, key);
      this.pendingAdmissionContexts.add(key);
      return false;
    }

    if (capacityLease) {
      if (capacityLease.contextKey === key) {
        this.pendingAdmissionContexts.add(key);
        return false;
      }

      this.invalidateCapacityLeaseForWindow(id);
      this.forgetWaitingWindow(id);
    }

    if (!isGeometryWritable(source)) {
      this.forgetWaitingWindow(id);
      this.suspendGeometryLease(id);
      this.scheduleTransientResumeProbe(id);

      return false;
    }

    if (this.managedWindows.has(id)) {
      this.forgetWaitingWindow(id);
      return false;
    }

    const added = this.layout.manageWindow({
      columnId: columnId(`column:${observed.id}`),
      desktopId: context.desktopId,
      outputId: context.outputId,
      width: this.width,
      windowId: id,
    });

    if (!added) {
      this.forgetWaitingWindow(id);
      return false;
    }

    let decision: AdmissionDecision;

    try {
      decision = this.layoutAdmissionDecision(context, id);
    } catch (error) {
      this.layout.unmanageWindow(id);

      if (this.initializing) {
        throw error;
      }

      this.deferWindow(id, key);
      console.warn(
        `[driftile] window admission skipped window=${String(id)} error=${String(error)}`,
      );
      return false;
    }

    if (decision.kind !== "accepted") {
      this.layout.unmanageWindow(id);

      if (decision.kind === "deferred") {
        this.deferWindow(id, key, decision.fingerprint);
      } else {
        this.forgetWaitingWindow(id);
      }

      return false;
    }

    let runtimeContext = this.contexts.get(key);

    if (
      runtimeContext &&
      runtimeContext.geometryFingerprint !== decision.fingerprint
    ) {
      this.layout.unmanageWindow(id);
      this.deferWindow(id, key, decision.fingerprint);
      this.handleTopologyChanged(String(context.outputId));
      return false;
    }

    this.forgetWaitingWindow(id);

    if (!runtimeContext) {
      runtimeContext = {
        ...context,
        geometryFingerprint: decision.fingerprint,
        key,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    runtimeContext.windowIds.add(id);
    this.managedWindows.set(id, {
      contextKey: key,
      restoreBaseline: {
        fingerprint: decision.fingerprint,
        frame: { ...source.frameGeometry },
      },
    });
    this.resumeSamples.delete(id);
    this.suspendedWindows.delete(id);
    this.transientResumeProbes.delete(id);

    if (
      !this.initializing &&
      String(this.workspace.activeWindow?.internalId) === observed.id
    ) {
      this.layout.activateWindow(id);
    }

    this.capacityParkBackoffs.delete(key);
    this.markContextDirty(runtimeContext);
    return true;
  }

  private releaseWindow(id: WindowId): string | null {
    this.cancelCapacityParkForWindow(id, true);
    this.invalidateCapacityLeaseForWindow(id);
    const owner = this.managedWindows.get(id);

    if (!owner) {
      return null;
    }

    const ownedContext = this.contexts.get(owner.contextKey);
    const before = ownedContext
      ? this.layout.snapshot(ownedContext.outputId, ownedContext.desktopId)
      : null;
    const removedColumn = before?.columns.find((column) =>
      column.windowIds.includes(id),
    );
    const removedColumnIndex =
      ownedContext && before && removedColumn
        ? this.capacityLogicalColumnIndices(owner.contextKey, before).get(
            removedColumn.id,
          )
        : undefined;
    this.managedWindows.delete(id);
    this.layout.unmanageWindow(id);

    if (ownedContext && removedColumn && removedColumnIndex !== undefined) {
      const after = this.layout.snapshot(
        ownedContext.outputId,
        ownedContext.desktopId,
      );

      if (!after.columns.some((column) => column.id === removedColumn.id)) {
        this.rebaseCapacityLeasesAfterColumnRemoval(
          owner.contextKey,
          removedColumnIndex,
        );
      }
    }

    this.capacityParkBackoffs.delete(owner.contextKey);

    const context = ownedContext;

    if (!context) {
      return owner.contextKey;
    }

    context.windowIds.delete(id);

    if (context.windowIds.size === 0) {
      this.contexts.delete(context.key);
      this.dirtyContexts.delete(context.key);
    } else {
      this.markContextDirty(context);
    }

    return owner.contextKey;
  }

  private deferWindow(
    id: WindowId,
    contextKey: string,
    fingerprint?: string,
  ): void {
    const previousContextKey = this.waitingWindowContexts.get(id);

    if (previousContextKey === contextKey) {
      if (fingerprint !== undefined) {
        this.waitingContextFingerprints.set(contextKey, fingerprint);
      }

      return;
    }

    this.forgetWaitingWindow(id);
    this.waitingWindowContexts.set(id, contextKey);

    let windowIds = this.waitingWindowIds.get(contextKey);

    if (!windowIds) {
      windowIds = new Set<WindowId>();
      this.waitingWindowIds.set(contextKey, windowIds);
    }

    windowIds.add(id);

    if (fingerprint !== undefined) {
      this.waitingContextFingerprints.set(contextKey, fingerprint);
    }
  }

  private forgetWaitingWindow(id: WindowId): void {
    const key = this.waitingWindowContexts.get(id);

    if (!key) {
      return;
    }

    this.waitingWindowContexts.delete(id);
    const windowIds = this.waitingWindowIds.get(key);

    if (!windowIds) {
      return;
    }

    windowIds.delete(id);

    if (windowIds.size === 0) {
      this.waitingWindowIds.delete(key);
      this.waitingContextFingerprints.delete(key);
      this.pendingAdmissionContexts.delete(key);
    }
  }

  private retryPendingAdmissions(): void {
    if (this.pendingAdmissionContexts.size === 0) {
      return;
    }

    const contextKeys = new Set(this.pendingAdmissionContexts);
    this.pendingAdmissionContexts.clear();
    this.retryWaitingWindows(contextKeys);
  }

  private retryWaitingWindows(contextKeys: ReadonlySet<string>): boolean {
    let admitted = false;

    for (const key of contextKeys) {
      if (this.toggleTransitionPending(key)) {
        this.pendingAdmissionContexts.add(key);
        continue;
      }

      admitted = this.restoreCapacityLeases(key) || admitted;
      const windowIds = [...(this.waitingWindowIds.get(key) ?? [])];

      for (const id of windowIds) {
        if (this.capacityLeaseByWindow.has(id)) {
          continue;
        }

        const source = this.observer.source(id);

        if (!source) {
          this.forgetWaitingWindow(id);
          continue;
        }

        admitted = this.tryAdmitWindow(source) || admitted;
      }
    }

    return admitted;
  }

  private clearSuspensionRequest(
    id: WindowId,
    request: WindowSuspensionRequest,
  ): void {
    const requests = this.requestedSuspensions.get(id);

    requests?.delete(request);

    if (requests?.size === 0) {
      this.requestedSuspensions.delete(id);
    }
  }

  private suspendGeometryLease(id: WindowId): void {
    this.cancelCapacityParkForWindow(id, true);
    const wasSuspended = this.suspendedWindows.has(id);

    this.suspendedWindows.add(id);
    this.resumeSamples.delete(id);

    if (!wasSuspended) {
      this.transientResumeProbes.delete(id);
    }
  }

  private resumeGeometryLease(
    id: WindowId,
    source: KWinWindow,
    context: ManagedContext | null,
  ): boolean {
    if (!this.started) {
      return false;
    }

    const sample: ResumeSample = {
      contextKey: context ? contextKey(context) : null,
      frame: { ...source.frameGeometry },
    };
    const previous = this.resumeSamples.get(id);

    if (!previous || !sameResumeSample(previous, sample)) {
      this.resumeSamples.set(id, sample);
      this.transientResumeProbes.delete(id);
      const runGeneration = this.runGeneration;

      this.scheduleResume(() => {
        if (
          !this.started ||
          this.runGeneration !== runGeneration ||
          this.resumeSamples.get(id) !== sample
        ) {
          return;
        }

        this.pendingWindowSyncs.add(id);
        this.scheduleWork();
      });
      return false;
    }

    this.resumeSamples.delete(id);
    this.suspendedWindows.delete(id);
    this.transientResumeProbes.delete(id);
    return true;
  }

  private scheduleTransientResumeProbe(id: WindowId): void {
    if (!this.started) {
      return;
    }

    let probe = this.transientResumeProbes.get(id);

    if (!probe) {
      probe = { completedAttempts: 0, pending: false };
      this.transientResumeProbes.set(id, probe);
    }

    if (
      probe.pending ||
      probe.completedAttempts >= MAX_TRANSIENT_RESUME_PROBES
    ) {
      return;
    }

    probe.pending = true;
    const runGeneration = this.runGeneration;
    let schedulerReturned = false;

    this.scheduleResume(() => {
      if (
        !this.started ||
        this.runGeneration !== runGeneration ||
        this.transientResumeProbes.get(id) !== probe ||
        !this.suspendedWindows.has(id)
      ) {
        return;
      }

      const synchronous = !schedulerReturned;

      if (!synchronous) {
        probe.pending = false;
      }

      probe.completedAttempts += 1;
      this.pendingWindowSyncs.add(id);
      this.scheduleWork();

      if (synchronous && this.transientResumeProbes.get(id) === probe) {
        probe.pending = false;
      }
    });
    schedulerReturned = true;
  }

  private markContextDirty(context: RuntimeContext): void {
    this.dirtyContexts.add(context.key);
  }

  private forgetCanceledCapacityPark(key: string): void {
    const operation = this.capacityCanceledParks.get(key);

    if (!operation) {
      return;
    }

    this.capacityCanceledParks.delete(key);

    for (const window of operation.windows) {
      this.capacitySupersededParkWindows.delete(window.windowId);
    }
  }

  private supersedeCanceledCapacityPark(
    context: RuntimeContext,
    layout: readonly WindowGeometry[],
  ): number {
    const desired = new Map(
      layout.map((window) => [window.windowId, window.frame]),
    );
    let writeCount = 0;

    for (const [key, canceled] of [...this.capacityCanceledParks]) {
      const changes: Array<{ frame: Rect; windowId: WindowId }> = [];

      for (const window of canceled.windows) {
        if (this.capacitySupersededParkWindows.has(window.windowId)) {
          continue;
        }

        const owner = this.managedWindows.get(window.windowId);
        const source = this.observer.source(window.windowId);
        const observed = source ? normalizeWindow(source) : null;
        const liveContext = observed ? managedContext(observed) : null;

        if (
          owner?.contextKey !== context.key ||
          !source ||
          !liveContext ||
          contextKey(liveContext) !== context.key
        ) {
          continue;
        }

        const frame = desired.get(window.windowId);

        if (
          !frame ||
          this.suspendedWindows.has(window.windowId) ||
          !this.geometry.canApplyFrame(window.windowId, frame, context)
        ) {
          continue;
        }

        changes.push({ frame, windowId: window.windowId });
      }

      const applied = this.geometry.apply(changes, context);
      writeCount += applied;

      if (applied === changes.length) {
        for (const change of changes) {
          this.capacitySupersededParkWindows.add(change.windowId);
        }
      }

      if (
        canceled.windows.every(
          (window) =>
            this.capacitySupersededParkWindows.has(window.windowId) ||
            !this.observer.source(window.windowId),
        )
      ) {
        this.forgetCanceledCapacityPark(key);
      }
    }

    return writeCount;
  }

  private reconcileContext(
    context: RuntimeContext,
    sampledGeometries?: ReadonlyMap<string, ContextGeometry>,
    canContinueWriting?: () => boolean,
  ): number {
    if (!this.isContextVisible(context)) {
      return 0;
    }

    if (this.toggleTransitionPending(context.key)) {
      this.markContextDirty(context);
      return 0;
    }

    const contextGeometry =
      sampledGeometries?.get(context.key) ??
      this.geometry.contextGeometry(context.outputId, context.desktopId);

    if (!contextGeometry) {
      return 0;
    }

    if (contextGeometry.fingerprint !== context.geometryFingerprint) {
      this.handleTopologyChanged(String(context.outputId));
      return 0;
    }

    const layout = solveStripGeometry({
      context: this.layout.snapshot(context.outputId, context.desktopId),
      devicePixelRatio: contextGeometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: contextGeometry.pixelGridOrigin,
      workArea: contextGeometry.workArea,
    });
    let writeCount = 0;

    if (!this.canApplyLayout(layout.maxViewportOffset)) {
      if (
        this.capacityParkOperations.has(context.key) ||
        this.capacityParkBackoffs.has(context.key)
      ) {
        return 0;
      }

      const plan = this.planCapacityRecovery(context, contextGeometry);

      if (!plan) {
        return 0;
      }

      writeCount += this.beginCapacityPark(context, plan);
      return writeCount;
    }

    const writableLayout = layout.windows.filter(
      (window) => !this.suspendedWindows.has(window.windowId),
    );

    if (
      writableLayout.some(
        (window) =>
          !this.geometry.canApplyFrame(window.windowId, window.frame, context),
      )
    ) {
      this.markContextDirty(context);
      return writeCount;
    }

    writeCount += this.supersedeCanceledCapacityPark(context, writableLayout);

    this.layout.setViewportOffset(
      context.outputId,
      context.desktopId,
      layout.viewportOffset,
    );
    const windowIds = writableLayout.map((window) => window.windowId);
    const observed = this.geometry.observedFrames(windowIds, context);

    if (observed.size !== windowIds.length) {
      this.markContextDirty(context);
      return writeCount;
    }

    const changes = diffWindowGeometries(writableLayout, observed);
    const applied = this.geometry.apply(changes, context, canContinueWriting);
    writeCount += applied;

    if (applied === changes.length) {
      context.geometryFingerprint = contextGeometry.fingerprint;
    } else {
      this.markContextDirty(context);
    }

    return writeCount;
  }

  private planCapacityRecovery(
    context: RuntimeContext,
    contextGeometry: ContextGeometry,
  ): CapacityRecoveryPlan | null {
    const snapshot = this.layout.snapshot(context.outputId, context.desktopId);
    const logicalColumnIndices = this.capacityLogicalColumnIndices(
      context.key,
      snapshot,
    );
    const activeIndex = snapshot.columns.findIndex(
      (column) => column.id === snapshot.activeColumnId,
    );
    const nonActiveCandidates = snapshot.columns
      .map((column, index) => {
        if (column.id === snapshot.activeColumnId) {
          return null;
        }

        const windows = this.planColumnParking(
          column,
          context,
          contextGeometry.workArea,
        );
        return windows
          ? {
              column,
              index: logicalColumnIndices.get(column.id) ?? index,
              layoutIndex: index,
              windows,
            }
          : null;
      })
      .filter(
        (
          candidate,
        ): candidate is {
          column: LayoutColumnSnapshot;
          index: number;
          layoutIndex: number;
          windows: readonly CapacityParkWindow[];
        } => candidate !== null,
      )
      .sort((left, right) => {
        const leftDistance =
          activeIndex < 0
            ? left.layoutIndex
            : Math.abs(left.layoutIndex - activeIndex);
        const rightDistance =
          activeIndex < 0
            ? right.layoutIndex
            : Math.abs(right.layoutIndex - activeIndex);

        return (
          rightDistance - leftDistance || right.layoutIndex - left.layoutIndex
        );
      });
    const activeColumn =
      activeIndex < 0 ? undefined : snapshot.columns[activeIndex];
    const activeWindows = activeColumn
      ? this.planColumnParking(activeColumn, context, contextGeometry.workArea)
      : null;
    const candidates =
      activeColumn && activeWindows
        ? [
            ...nonActiveCandidates,
            {
              column: activeColumn,
              index: logicalColumnIndices.get(activeColumn.id) ?? activeIndex,
              layoutIndex: activeIndex,
              windows: activeWindows,
            },
          ]
        : nonActiveCandidates;

    if (candidates.length === 0) {
      return null;
    }

    const layoutAfterEvictions = (count: number) => {
      const removed = new Set(
        candidates.slice(0, count).map((candidate) => candidate.column.id),
      );
      const simulated: LayoutContextSnapshot = {
        ...snapshot,
        columns: snapshot.columns.filter((column) => !removed.has(column.id)),
      };

      return solveStripGeometry({
        context: simulated,
        devicePixelRatio: contextGeometry.devicePixelRatio,
        gap: this.gap,
        pixelGridOrigin: contextGeometry.pixelGridOrigin,
        workArea: contextGeometry.workArea,
      });
    };
    let lower = 1;
    let required = -1;
    let upper = candidates.length;

    while (lower <= upper) {
      const midpoint = Math.trunc((lower + upper) / 2);

      if (
        this.canApplyLayout(layoutAfterEvictions(midpoint).maxViewportOffset)
      ) {
        required = midpoint;
        upper = midpoint - 1;
      } else {
        lower = midpoint + 1;
      }
    }

    if (required < 0) {
      return null;
    }

    const selected = candidates.slice(0, required);
    const retainedLayout = layoutAfterEvictions(required);

    if (
      retainedLayout.windows
        .filter((window) => !this.suspendedWindows.has(window.windowId))
        .some(
          (window) =>
            !this.geometry.canApplyFrame(
              window.windowId,
              window.frame,
              context,
            ),
        )
    ) {
      return null;
    }

    const windows: CapacityParkWindow[] = [];

    for (const candidate of selected) {
      windows.push(...candidate.windows);
    }

    return {
      activeColumnId: snapshot.activeColumnId,
      columns: selected.map((candidate) => ({
        column: candidate.column,
        index: candidate.index,
      })),
      contextFingerprint: contextGeometry.fingerprint,
      desktopId: context.desktopId,
      outputId: context.outputId,
      outputInstanceId: this.topologyObserver
        .outputInstances()
        .get(String(context.outputId)),
      viewportOffset: snapshot.viewportOffset,
      windows,
    };
  }

  private capacityLogicalColumnIndices(
    key: string,
    snapshot: LayoutContextSnapshot,
  ): ReadonlyMap<ColumnId, number> {
    const leases = [...(this.capacityLeasesByContext.get(key) ?? [])];
    const logical =
      leases.length === 0
        ? snapshot
        : previewColumnRestoration(
            snapshot,
            leases.map((lease) => lease.column),
          );
    const indices = new Map<ColumnId, number>();

    for (const [index, column] of (logical ?? snapshot).columns.entries()) {
      indices.set(column.id, index);
    }

    return indices;
  }

  private planColumnParking(
    column: LayoutColumnSnapshot,
    context: RuntimeContext,
    workArea: Rect,
  ): readonly CapacityParkWindow[] | null {
    const windows: CapacityParkWindow[] = [];

    for (const id of column.windowIds) {
      const owner = this.managedWindows.get(id);
      const source = this.observer.source(id);

      if (
        !owner ||
        owner.contextKey !== context.key ||
        !source ||
        this.suspendedWindows.has(id)
      ) {
        return null;
      }

      const targetFrame = clampFrameToWorkArea(source.frameGeometry, workArea);

      if (!this.geometry.canApplyFrame(id, targetFrame, context)) {
        return null;
      }

      windows.push({
        columnId: column.id,
        restoreBaseline: cloneRestoreBaseline(owner.restoreBaseline),
        rollbackFrame: { ...source.frameGeometry },
        targetFrame,
        windowId: id,
      });
    }

    return windows;
  }

  private beginCapacityPark(
    context: RuntimeContext,
    plan: CapacityRecoveryPlan,
  ): number {
    this.forgetCanceledCapacityPark(context.key);
    const operation: CapacityParkOperation = {
      ...plan,
      attempts: 0,
      contextKey: context.key,
      generation: this.runGeneration,
      probePending: false,
      stableSamples: 0,
      token: {},
      topologyRevision: this.topologyRevision,
    };
    this.capacityParkOperations.set(context.key, operation);
    const windowIds = plan.windows.map((window) => window.windowId);
    const observed = this.geometry.observedFrames(windowIds, context);

    if (observed.size !== windowIds.length) {
      this.capacityParkOperations.delete(context.key);
      this.markContextDirty(context);
      return 0;
    }

    const changes = diffWindowGeometries(
      capacityParkTargets(plan.windows),
      observed,
    );
    const writes = this.geometry.apply(changes, context);

    if (this.capacityParkOperations.get(context.key) === operation) {
      this.scheduleCapacityParkProbe(operation);
    }

    return writes;
  }

  private scheduleCapacityParkProbe(operation: CapacityParkOperation): void {
    if (
      operation.probePending ||
      this.capacityParkOperations.get(operation.contextKey) !== operation
    ) {
      return;
    }

    operation.probePending = true;
    const token = operation.token;
    this.scheduleResume(() => {
      if (
        this.capacityParkOperations.get(operation.contextKey) !== operation ||
        operation.token !== token
      ) {
        return;
      }

      operation.probePending = false;

      if (
        !this.started ||
        this.runGeneration !== operation.generation ||
        this.topologyRevision !== operation.topologyRevision ||
        this.topologyStabilizing ||
        this.topologyRetryPending
      ) {
        this.cancelCapacityPark(operation, false);
        return;
      }

      const context = this.contexts.get(operation.contextKey);

      if (
        !context ||
        !this.capacityParkSourcesRemainValid(operation, context)
      ) {
        this.cancelCapacityPark(operation, true);
        return;
      }

      const windowIds = operation.windows.map((window) => window.windowId);
      const observed = this.geometry.observedFrames(windowIds, context);

      if (observed.size !== windowIds.length) {
        this.cancelCapacityPark(operation, true);
        return;
      }

      operation.attempts += 1;
      const targets = capacityParkTargets(operation.windows);
      const pendingChanges = diffWindowGeometries(targets, observed);

      if (pendingChanges.length === 0) {
        operation.stableSamples += 1;

        if (operation.stableSamples >= REQUIRED_CAPACITY_PARK_SAMPLES) {
          this.commitCapacityPark(operation, context);
          return;
        }
      } else {
        operation.stableSamples = 0;
        this.geometry.apply(pendingChanges, context);
      }

      if (operation.attempts >= MAX_CAPACITY_PARK_ATTEMPTS) {
        this.capacityParkBackoffs.add(operation.contextKey);
        this.cancelCapacityPark(operation, true);
        return;
      }

      this.scheduleCapacityParkProbe(operation);
    });
  }

  private capacityParkSourcesRemainValid(
    operation: CapacityParkOperation,
    context: RuntimeContext,
  ): boolean {
    if (
      context.geometryFingerprint !== operation.contextFingerprint ||
      this.topologyObserver.outputInstances().get(String(context.outputId)) !==
        operation.outputInstanceId
    ) {
      return false;
    }

    for (const window of operation.windows) {
      const owner = this.managedWindows.get(window.windowId);
      const source = this.observer.source(window.windowId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        !owner ||
        owner.contextKey !== operation.contextKey ||
        !source ||
        !liveContext ||
        contextKey(liveContext) !== operation.contextKey ||
        this.suspendedWindows.has(window.windowId) ||
        !this.geometry.canApplyFrame(
          window.windowId,
          window.targetFrame,
          context,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private commitCapacityPark(
    operation: CapacityParkOperation,
    context: RuntimeContext,
  ): void {
    if (
      this.capacityParkOperations.get(operation.contextKey) !== operation ||
      !this.capacityParkSourcesRemainValid(operation, context)
    ) {
      this.cancelCapacityPark(operation, true);
      return;
    }

    const windowsByColumn = new Map<ColumnId, CapacityParkWindow[]>();

    for (const window of operation.windows) {
      let windows = windowsByColumn.get(window.columnId);

      if (!windows) {
        windows = [];
        windowsByColumn.set(window.columnId, windows);
      }

      windows.push(window);
    }

    const leases = operation.columns.map((column) => ({
      activeColumnId: operation.activeColumnId,
      column,
      contextFingerprint: operation.contextFingerprint,
      contextKey: operation.contextKey,
      desktopId: context.desktopId,
      outputId: context.outputId,
      outputInstanceId: operation.outputInstanceId,
      viewportOffset: operation.viewportOffset,
      windows: windowsByColumn.get(column.column.id) ?? [],
    }));
    const removed = this.layout.removeColumns({
      columnIds: operation.columns.map((column) => column.column.id),
      desktopId: context.desktopId,
      outputId: context.outputId,
    });

    if (!removed) {
      this.cancelCapacityPark(operation, true);
      return;
    }

    this.capacityParkOperations.delete(operation.contextKey);
    this.capacityParkBackoffs.delete(operation.contextKey);

    for (const lease of leases) {
      this.registerCapacityLease(lease);

      for (const window of lease.windows) {
        this.managedWindows.delete(window.windowId);
        context.windowIds.delete(window.windowId);
        this.deferWindow(
          window.windowId,
          context.key,
          operation.contextFingerprint,
        );
      }
    }

    if (context.windowIds.size === 0) {
      this.contexts.delete(context.key);
      this.dirtyContexts.delete(context.key);
    } else {
      this.markContextDirty(context);
    }

    this.scheduleWork();
  }

  private cancelCapacityPark(
    operation: CapacityParkOperation,
    restoreFrames: boolean,
  ): void {
    if (this.capacityParkOperations.get(operation.contextKey) !== operation) {
      return;
    }

    this.capacityParkOperations.delete(operation.contextKey);
    operation.probePending = false;

    if (restoreFrames) {
      this.forgetCanceledCapacityPark(operation.contextKey);
      this.forceRestorePendingCapacityPark(operation);
    } else {
      this.forgetCanceledCapacityPark(operation.contextKey);
      this.capacityCanceledParks.set(operation.contextKey, operation);
    }

    const context = this.contexts.get(operation.contextKey);

    if (context) {
      this.markContextDirty(context);
    }

    for (const window of operation.windows) {
      this.pendingWindowSyncs.add(window.windowId);
    }

    this.scheduleWork();
  }

  private cancelCapacityParkForWindow(
    id: WindowId,
    restoreFrames: boolean,
  ): void {
    for (const operation of this.capacityParkOperations.values()) {
      if (operation.windows.some((window) => window.windowId === id)) {
        this.cancelCapacityPark(operation, restoreFrames);
        return;
      }
    }
  }

  private cancelCapacityParkOperations(restoreFrames: boolean): void {
    for (const operation of [...this.capacityParkOperations.values()]) {
      this.cancelCapacityPark(operation, restoreFrames);
    }
  }

  private forceRestorePendingCapacityPark(
    operation: CapacityParkOperation,
  ): void {
    const context: ManagedContext = {
      desktopId: operation.desktopId,
      outputId: operation.outputId,
    };

    let currentGeometry: ContextGeometry | null;

    try {
      currentGeometry = this.geometry.contextGeometry(
        operation.outputId,
        operation.desktopId,
      );
    } catch {
      currentGeometry = null;
    }

    const restoreGeometry =
      !this.topologyAllOutputs &&
      !this.topologyInvalidateAllBaselines &&
      !this.topologyOutputs.has(operation.outputId) &&
      !this.topologyInvalidatedOutputs.has(operation.outputId) &&
      currentGeometry &&
      this.topologyObserver
        .outputInstances()
        .get(String(operation.outputId)) === operation.outputInstanceId
        ? currentGeometry
        : null;

    const changes: Array<{ frame: Rect; windowId: WindowId }> = [];

    for (const window of operation.windows) {
      const owner = this.managedWindows.get(window.windowId);
      const source = this.observer.source(window.windowId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        owner?.contextKey !== operation.contextKey ||
        !source ||
        !liveContext ||
        contextKey(liveContext) !== operation.contextKey ||
        !isGeometryWritable(source)
      ) {
        continue;
      }

      changes.push({
        frame: restoreGeometry
          ? window.restoreBaseline?.fingerprint === restoreGeometry.fingerprint
            ? window.restoreBaseline.frame
            : clampFrameToWorkArea(
                window.rollbackFrame,
                restoreGeometry.workArea,
              )
          : { ...source.frameGeometry },
        windowId: window.windowId,
      });
    }

    this.geometry.apply(changes, context);
  }

  private registerCapacityLease(lease: CapacityParkingLease): void {
    let leases = this.capacityLeasesByContext.get(lease.contextKey);

    if (!leases) {
      leases = new Set<CapacityParkingLease>();
      this.capacityLeasesByContext.set(lease.contextKey, leases);
    }

    leases.add(lease);

    for (const window of lease.windows) {
      this.capacityLeaseByWindow.set(window.windowId, lease);
    }
  }

  private invalidateCapacityLease(
    lease: CapacityParkingLease,
    columnRemoved = true,
  ): void {
    const leases = this.capacityLeasesByContext.get(lease.contextKey);
    leases?.delete(lease);

    if (leases?.size === 0) {
      this.capacityLeasesByContext.delete(lease.contextKey);
    }

    for (const window of lease.windows) {
      if (this.capacityLeaseByWindow.get(window.windowId) === lease) {
        this.capacityLeaseByWindow.delete(window.windowId);
      }
    }

    if (columnRemoved) {
      this.rebaseCapacityLeasesAfterColumnRemoval(
        lease.contextKey,
        lease.column.index,
      );
      this.capacityParkBackoffs.delete(lease.contextKey);
    }
  }

  private invalidateCapacityLeases(
    leases: ReadonlySet<CapacityParkingLease>,
  ): void {
    const leasesByContext = new Map<string, CapacityParkingLease[]>();

    for (const lease of leases) {
      const contextLeases = leasesByContext.get(lease.contextKey);

      if (contextLeases) {
        contextLeases.push(lease);
      } else {
        leasesByContext.set(lease.contextKey, [lease]);
      }
    }

    for (const [key, invalidated] of leasesByContext) {
      const registered = this.capacityLeasesByContext.get(key);
      const removedIndices = new Set<number>();

      for (const lease of invalidated) {
        if (registered?.delete(lease)) {
          removedIndices.add(lease.column.index);
        }

        for (const window of lease.windows) {
          if (this.capacityLeaseByWindow.get(window.windowId) === lease) {
            this.capacityLeaseByWindow.delete(window.windowId);
          }
        }
      }

      if (!registered || registered.size === 0) {
        this.capacityLeasesByContext.delete(key);
      } else if (removedIndices.size > 0) {
        const indices = [...removedIndices].sort((left, right) => left - right);
        const survivors = [...registered].sort(
          (left, right) => left.column.index - right.column.index,
        );
        let removedBefore = 0;

        for (const lease of survivors) {
          const originalIndex = lease.column.index;

          while (
            removedBefore < indices.length &&
            (indices[removedBefore] ?? Number.MAX_SAFE_INTEGER) < originalIndex
          ) {
            removedBefore += 1;
          }

          lease.column.index = originalIndex - removedBefore;
        }
      }

      this.capacityParkBackoffs.delete(key);
    }
  }

  private rebaseCapacityLeasesAfterColumnRemoval(
    key: string,
    removedIndex: number,
  ): void {
    for (const lease of this.capacityLeasesByContext.get(key) ?? []) {
      if (lease.column.index > removedIndex) {
        lease.column.index -= 1;
      }
    }
  }

  private invalidateCapacityLeaseForWindow(id: WindowId): void {
    const lease = this.capacityLeaseByWindow.get(id);

    if (!lease) {
      return;
    }

    this.invalidateCapacityLease(lease);

    for (const window of lease.windows) {
      if (window.windowId !== id) {
        this.pendingWindowSyncs.add(window.windowId);
      }
    }

    this.scheduleWork();
  }

  private restoreCapacityLeases(key: string): boolean {
    const leases = [...(this.capacityLeasesByContext.get(key) ?? [])];

    if (leases.length === 0) {
      return false;
    }

    const firstLease = leases[0];

    if (!firstLease) {
      return false;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        firstLease.outputId,
        firstLease.desktopId,
      );
    } catch {
      return false;
    }

    if (!contextGeometry) {
      return false;
    }

    const outputInstanceId = this.topologyObserver
      .outputInstances()
      .get(String(firstLease.outputId));
    const placements: CapacityParkColumn[] = [];

    for (const lease of leases) {
      if (
        lease.outputId !== firstLease.outputId ||
        lease.desktopId !== firstLease.desktopId ||
        lease.outputInstanceId !== outputInstanceId
      ) {
        this.invalidateCapacityLease(lease);

        for (const window of lease.windows) {
          this.pendingWindowSyncs.add(window.windowId);
        }

        return false;
      }

      placements.push(lease.column);

      for (const window of lease.windows) {
        const source = this.observer.source(window.windowId);
        const observed = source ? normalizeWindow(source) : null;
        const liveContext = observed ? managedContext(observed) : null;

        if (
          this.waitingWindowContexts.get(window.windowId) !== key ||
          this.capacityLeaseByWindow.get(window.windowId) !== lease ||
          !source ||
          !liveContext ||
          contextKey(liveContext) !== key ||
          this.suspendedWindows.has(window.windowId) ||
          !isGeometryWritable(source)
        ) {
          return false;
        }
      }
    }

    const snapshot = this.layout.snapshot(
      firstLease.outputId,
      firstLease.desktopId,
    );
    const activeWindowId = this.workspace.activeWindow
      ? windowId(String(this.workspace.activeWindow.internalId))
      : null;
    const activeLease = activeWindowId
      ? this.capacityLeaseByWindow.get(activeWindowId)
      : undefined;
    const activeColumnId =
      activeLease?.column.column.id ?? snapshot.activeColumnId;
    const preview = previewColumnRestoration(snapshot, placements, {
      activeColumnId,
      viewportOffset: firstLease.viewportOffset,
    });

    if (!preview) {
      return false;
    }

    const layout = solveStripGeometry({
      context: preview,
      devicePixelRatio: contextGeometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: contextGeometry.pixelGridOrigin,
      workArea: contextGeometry.workArea,
    });

    if (!this.canApplyLayout(layout.maxViewportOffset)) {
      return false;
    }

    const restoredIds = new Set(
      leases.reduce<WindowId[]>((ids, lease) => {
        for (const window of lease.windows) {
          ids.push(window.windowId);
        }

        return ids;
      }, []),
    );

    if (
      layout.windows
        .filter((window) => restoredIds.has(window.windowId))
        .some(
          (window) =>
            !this.geometry.canApplyFrame(
              window.windowId,
              window.frame,
              firstLease,
            ),
        )
    ) {
      return false;
    }

    if (
      !this.layout.restoreColumns({
        activeColumnId,
        columns: placements,
        desktopId: firstLease.desktopId,
        outputId: firstLease.outputId,
        viewportOffset: firstLease.viewportOffset,
      })
    ) {
      return false;
    }

    let runtimeContext = this.contexts.get(key);

    if (!runtimeContext) {
      runtimeContext = {
        desktopId: firstLease.desktopId,
        geometryFingerprint: contextGeometry.fingerprint,
        key,
        outputId: firstLease.outputId,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    for (const lease of leases) {
      for (const window of lease.windows) {
        const source = this.observer.source(window.windowId);

        if (!source) {
          throw new Error("capacity lease source disappeared after preflight");
        }

        const parkUntouched = rectsEqual(
          source.frameGeometry,
          window.targetFrame,
        );
        const priorBaselineSafe =
          parkUntouched &&
          lease.contextFingerprint === contextGeometry.fingerprint &&
          window.restoreBaseline?.fingerprint === contextGeometry.fingerprint;
        const restoreBaseline = priorBaselineSafe
          ? cloneRestoreBaseline(window.restoreBaseline)
          : parkUntouched
            ? null
            : {
                fingerprint: contextGeometry.fingerprint,
                frame: { ...source.frameGeometry },
              };
        this.managedWindows.set(window.windowId, {
          contextKey: key,
          restoreBaseline,
        });
        runtimeContext.windowIds.add(window.windowId);
        this.forgetWaitingWindow(window.windowId);
      }

      this.invalidateCapacityLease(lease, false);
    }

    if (activeWindowId && restoredIds.has(activeWindowId)) {
      this.layout.activateWindow(activeWindowId);
    }

    this.capacityParkBackoffs.delete(key);
    this.markContextDirty(runtimeContext);
    return true;
  }

  private restoreCapacityParkingFrames(): void {
    for (const operation of [...this.capacityParkOperations.values()]) {
      this.forceRestorePendingCapacityPark(operation);
      this.capacityParkOperations.delete(operation.contextKey);
    }

    for (const operation of this.capacityCanceledParks.values()) {
      this.forceRestorePendingCapacityPark(operation);
      this.forceSupersedeTransferredCapacityPark(operation);
    }

    for (const leases of this.capacityLeasesByContext.values()) {
      for (const lease of leases) {
        this.restoreCommittedCapacityLease(lease);
      }
    }
  }

  private forceSupersedeTransferredCapacityPark(
    operation: CapacityParkOperation,
  ): void {
    const groups = new Map<
      string,
      {
        readonly changes: Array<{ frame: Rect; windowId: WindowId }>;
        readonly context: ManagedContext;
      }
    >();

    for (const window of operation.windows) {
      const owner = this.managedWindows.get(window.windowId);
      const source = this.observer.source(window.windowId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        !owner ||
        owner.contextKey === operation.contextKey ||
        !source ||
        !liveContext ||
        contextKey(liveContext) !== owner.contextKey ||
        !isGeometryWritable(source)
      ) {
        continue;
      }

      let group = groups.get(owner.contextKey);

      if (!group) {
        group = { changes: [], context: liveContext };
        groups.set(owner.contextKey, group);
      }

      group.changes.push({
        frame: { ...source.frameGeometry },
        windowId: window.windowId,
      });
    }

    for (const group of groups.values()) {
      this.geometry.apply(group.changes, group.context);
    }
  }

  private restoreCommittedCapacityLease(lease: CapacityParkingLease): void {
    if (
      this.topologyAllOutputs ||
      this.topologyInvalidateAllBaselines ||
      this.topologyOutputs.has(lease.outputId) ||
      this.topologyInvalidatedOutputs.has(lease.outputId)
    ) {
      return;
    }

    let currentGeometry: ContextGeometry | null;

    try {
      currentGeometry = this.geometry.contextGeometry(
        lease.outputId,
        lease.desktopId,
      );
    } catch {
      return;
    }

    if (
      !currentGeometry ||
      currentGeometry.fingerprint !== lease.contextFingerprint ||
      this.topologyObserver.outputInstances().get(String(lease.outputId)) !==
        lease.outputInstanceId
    ) {
      return;
    }

    const changes = lease.windows
      .filter((window) => {
        const source = this.observer.source(window.windowId);
        const observed = source ? normalizeWindow(source) : null;
        const liveContext = observed ? managedContext(observed) : null;
        return Boolean(
          source &&
          liveContext &&
          contextKey(liveContext) === lease.contextKey &&
          isGeometryWritable(source) &&
          rectsEqual(source.frameGeometry, window.targetFrame),
        );
      })
      .map((window) => ({
        frame:
          window.restoreBaseline?.fingerprint === currentGeometry.fingerprint
            ? window.restoreBaseline.frame
            : clampFrameToWorkArea(
                window.rollbackFrame,
                currentGeometry.workArea,
              ),
        windowId: window.windowId,
      }));

    this.geometry.apply(changes, lease);
  }

  private layoutAdmissionDecision(
    context: ManagedContext,
    candidateId: WindowId,
  ): AdmissionDecision {
    const contextGeometry = this.geometry.contextGeometry(
      context.outputId,
      context.desktopId,
    );

    if (!contextGeometry) {
      return { kind: "deferred" };
    }

    const layout = solveStripGeometry({
      context: this.layout.snapshot(context.outputId, context.desktopId),
      devicePixelRatio: contextGeometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: contextGeometry.pixelGridOrigin,
      workArea: contextGeometry.workArea,
    });
    const candidate = layout.windows.find(
      (window) => window.windowId === candidateId,
    );
    if (!this.canApplyLayout(layout.maxViewportOffset)) {
      return { fingerprint: contextGeometry.fingerprint, kind: "deferred" };
    }

    if (
      !candidate ||
      !this.geometry.canApplyFrame(candidateId, candidate.frame, context)
    ) {
      return { kind: "rejected" };
    }

    return { fingerprint: contextGeometry.fingerprint, kind: "accepted" };
  }

  private canApplyLayout(maxViewportOffset: number): boolean {
    return maxViewportOffset <= 1e-6 || this.workspace.screens.length === 1;
  }

  private isContextVisible(context: ManagedContext): boolean {
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === context.outputId,
    );

    if (!output) {
      return false;
    }

    return (
      currentDesktopForOutput(this.workspace, output)?.id === context.desktopId
    );
  }

  private restoreOriginalFrames(): void {
    const outputInstances = this.topologyObserver.outputInstances();

    for (const context of this.contexts.values()) {
      if (
        this.topologyAllOutputs ||
        this.topologyInvalidateAllBaselines ||
        this.topologyOutputs.has(context.outputId) ||
        this.topologyInvalidatedOutputs.has(context.outputId) ||
        this.knownOutputInstances.get(String(context.outputId)) !==
          outputInstances.get(String(context.outputId))
      ) {
        continue;
      }

      let currentContext: ContextGeometry | null;

      try {
        currentContext = this.geometry.contextGeometry(
          context.outputId,
          context.desktopId,
        );
      } catch (error) {
        console.warn(
          `[driftile] original geometry restore skipped context=${context.key} error=${String(error)}`,
        );
        continue;
      }

      if (!currentContext) {
        continue;
      }

      const desired: WindowGeometry[] = [];

      for (const id of context.windowIds) {
        if (this.suspendedWindows.has(id)) {
          continue;
        }

        const baseline = this.managedWindows.get(id)?.restoreBaseline;

        if (!baseline || baseline.fingerprint !== currentContext.fingerprint) {
          continue;
        }

        desired.push({
          columnId: columnId(`column:${String(id)}`),
          frame: baseline.frame,
          windowId: id,
        });
      }

      if (desired.length === 0) {
        continue;
      }

      const observed = this.geometry.observedFrames(
        desired.map((window) => window.windowId),
        context,
      );
      const changes = [...diffWindowGeometries(desired, observed)];
      const changedIds = new Set(changes.map((change) => change.windowId));

      for (const window of desired) {
        if (
          this.toggleGeometryTransitions.has(window.windowId) &&
          !changedIds.has(window.windowId)
        ) {
          changes.push({ frame: window.frame, windowId: window.windowId });
        }
      }

      this.geometry.apply(changes, context);
    }
  }
}

function managedContext(window: ObservedWindow): ManagedContext | null {
  const desktop = window.desktopIds[0];

  if (window.kind !== "normal" || window.desktopIds.length !== 1 || !desktop) {
    return null;
  }

  return {
    desktopId: desktopId(desktop),
    outputId: outputId(window.outputId),
  };
}

function managedContextFromKey(key: string): ManagedContext | null {
  const separator = key.indexOf("\u0000");

  if (separator <= 0 || separator >= key.length - 1) {
    return null;
  }

  return {
    desktopId: desktopId(key.slice(separator + 1)),
    outputId: outputId(key.slice(0, separator)),
  };
}

function sameResumeSample(left: ResumeSample, right: ResumeSample): boolean {
  return (
    left.contextKey === right.contextKey &&
    Math.abs(left.frame.x - right.frame.x) <= 1e-6 &&
    Math.abs(left.frame.y - right.frame.y) <= 1e-6 &&
    Math.abs(left.frame.width - right.frame.width) <= 1e-6 &&
    Math.abs(left.frame.height - right.frame.height) <= 1e-6
  );
}

function capacityParkTargets(
  windows: readonly CapacityParkWindow[],
): readonly WindowGeometry[] {
  return windows.map((window) => ({
    columnId: window.columnId,
    frame: window.targetFrame,
    windowId: window.windowId,
  }));
}

function cloneRestoreBaseline(
  baseline: RestoreBaseline | null,
): RestoreBaseline | null {
  return baseline
    ? { fingerprint: baseline.fingerprint, frame: { ...baseline.frame } }
    : null;
}

function rectsEqual(left: Rect, right: Rect): boolean {
  return (
    Math.abs(left.x - right.x) <= 1e-6 &&
    Math.abs(left.y - right.y) <= 1e-6 &&
    Math.abs(left.width - right.width) <= 1e-6 &&
    Math.abs(left.height - right.height) <= 1e-6
  );
}

function contextKey(context: ManagedContext): string {
  return `${context.outputId}\u0000${context.desktopId}`;
}

function currentDesktopForOutput(workspace: KWinWorkspace, output: KWinOutput) {
  return typeof workspace.currentDesktopForScreen === "function"
    ? workspace.currentDesktopForScreen(output)
    : workspace.currentDesktop;
}

function clampFrameToWorkArea(frame: Rect, workArea: Rect): Rect {
  const maximumX = Math.max(
    workArea.x,
    workArea.x + workArea.width - frame.width,
  );
  const maximumY = Math.max(
    workArea.y,
    workArea.y + workArea.height - frame.height,
  );

  return {
    height: frame.height,
    width: frame.width,
    x: clamp(frame.x, workArea.x, maximumX),
    y: clamp(frame.y, workArea.y, maximumY),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function ceilToPhysicalPixel(value: number, devicePixelRatio: number): number {
  const physicalValue = value * devicePixelRatio;
  return (
    Math.ceil(physicalValue - floatingPointTolerance(physicalValue)) /
    devicePixelRatio
  );
}

function floorToPhysicalPixel(value: number, devicePixelRatio: number): number {
  const physicalValue = value * devicePixelRatio;
  return (
    Math.floor(physicalValue + floatingPointTolerance(physicalValue)) /
    devicePixelRatio
  );
}

function floatingPointTolerance(...values: readonly number[]): number {
  let magnitude = 1;

  for (const value of values) {
    magnitude = Math.max(magnitude, Math.abs(value));
  }

  return magnitude * Number.EPSILON * 16;
}
