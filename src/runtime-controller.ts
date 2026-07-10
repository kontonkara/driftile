import { solveStripGeometry } from "./core/geometry";
import {
  columnId,
  desktopId,
  outputId,
  windowId,
  type DesktopId,
  type OutputId,
  type WindowId,
} from "./core/ids";
import {
  LayoutEngine,
  type ColumnWidth,
  type HorizontalDirection,
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
  type ContextGeometry,
  type KWinRectFactory,
} from "./platform/kwin/geometry-adapter";
import {
  normalizeWindow,
  WindowObserver,
  type ObservedWindow,
  type WindowSuspensionRequest,
} from "./platform/kwin/window-observer";

const DEFAULT_COLUMN_WIDTH: ColumnWidth = {
  kind: "proportion",
  value: 0.5,
};
const DEFAULT_GAP = 16;
const MAX_TRANSIENT_RESUME_PROBES = 20;

interface ManagedContext {
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

interface RuntimeContext extends ManagedContext {
  readonly key: string;
  readonly windowIds: Set<WindowId>;
}

interface ManagedWindow {
  readonly contextFingerprint: string;
  readonly contextKey: string;
  readonly originalFrame: KWinWindow["frameGeometry"];
}

interface AdmissionCandidate {
  readonly id: WindowId;
  readonly source: KWinWindow;
}

interface ResumeSample {
  readonly contextKey: string | null;
  readonly frame: KWinWindow["frameGeometry"];
}

interface TransientResumeProbe {
  completedAttempts: number;
  pending: boolean;
}

type AdmissionDecision =
  | { readonly fingerprint: string; readonly kind: "accepted" }
  | { readonly kind: "deferred" | "rejected" };

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
  private readonly contexts = new Map<string, RuntimeContext>();
  private readonly dirtyContexts = new Set<string>();
  private readonly geometry: KWinGeometryAdapter;
  private readonly gap: number;
  private initializing = false;
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
  private readonly transientResumeProbes = new Map<
    WindowId,
    TransientResumeProbe
  >();
  private readonly waitingWindowContexts = new Map<WindowId, string>();
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
  }

  get lastWriteCount(): number {
    return this.lastWrites;
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
      this.workspace.currentDesktopChanged.connect(
        this.handleCurrentDesktopChanged,
      );
      this.workspace.windowActivated.connect(this.handleWindowActivated);
      this.initializing = true;

      try {
        this.observer.start();

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
      this.observer.stop();
      this.layout = new LayoutEngine();
      this.contexts.clear();
      this.dirtyContexts.clear();
      this.managedWindows.clear();
      this.pendingAdmissionContexts.clear();
      this.pendingWindowSyncs.clear();
      this.requestedSuspensions.clear();
      this.resumeSamples.clear();
      this.suspendedWindows.clear();
      this.startupStabilizationRemaining = 0;
      this.startupStabilizationToken = null;
      this.transientResumeProbes.clear();
      this.waitingWindowContexts.clear();
      this.waitingWindowIds.clear();
      this.workScheduled = false;
      this.lastWrites = 0;
    }
  }

  reconcile(): number {
    if (!this.started) {
      return 0;
    }

    this.synchronizePendingWindows();
    this.retryPendingAdmissions();
    this.dirtyContexts.clear();

    let writeCount = 0;

    for (const context of this.contexts.values()) {
      writeCount += this.reconcileContext(context);
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

    if (this.initializing || this.startupStabilizationToken !== null) {
      this.pendingWindowSyncs.add(addedId);
      return;
    }

    if (source && this.tryAdmitWindow(source)) {
      this.scheduleWork();
    }
  };

  private readonly handleWindowChanged = (id: string): void => {
    this.pendingWindowSyncs.add(windowId(id));
    this.scheduleWork();
  };

  private readonly handleWindowStateChanged = (id: string): void => {
    const changedId = windowId(id);
    const source = this.observer.source(id);

    if (source && hasGeometryAuthorityBlocker(source)) {
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
    let requests = this.requestedSuspensions.get(suspendedId);

    if (!requests) {
      requests = new Set<WindowSuspensionRequest>();
      this.requestedSuspensions.set(suspendedId, requests);
    }

    requests.add(request);

    if (request.endsWith("-settling")) {
      this.transientResumeProbes.delete(suspendedId);
    }

    this.suspendGeometryLease(suspendedId);
    this.pendingWindowSyncs.add(suspendedId);
    this.scheduleWork();
  };

  private readonly handleWindowRemoved = (id: string): void => {
    const managedId = windowId(id);
    this.pendingWindowSyncs.delete(managedId);
    this.forgetWaitingWindow(managedId);
    this.requestedSuspensions.delete(managedId);
    this.resumeSamples.delete(managedId);
    this.suspendedWindows.delete(managedId);
    this.transientResumeProbes.delete(managedId);
    const releasedContextKey = this.releaseWindow(managedId);

    if (releasedContextKey) {
      this.pendingAdmissionContexts.add(releasedContextKey);
      this.scheduleWork();
    }
  };

  private readonly handleWindowActivated = (
    window: KWinWindow | null,
  ): void => {
    if (!window) {
      return;
    }

    const id = windowId(String(window.internalId));

    if (this.suspendedWindows.has(id) || !isGeometryWritable(window)) {
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
    if (!this.started) {
      return false;
    }

    this.synchronizePendingWindows();

    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return false;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (
      this.suspendedWindows.has(activeId) ||
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
      contextKey(activeContext) !== owner.contextKey
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
      this.suspendedWindows.has(targetId) ||
      !isGeometryWritable(target) ||
      !targetContext ||
      contextKey(targetContext) !== owner.contextKey
    ) {
      return false;
    }

    this.layout.activateWindow(targetId);
    this.dirtyContexts.delete(context.key);

    try {
      this.lastWrites = this.reconcileContext(context);
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
        this.synchronizePendingWindows();
        this.handleWindowActivated(this.workspace.activeWindow);
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
    this.synchronizePendingWindows();
    this.retryPendingAdmissions();

    const dirtyContextKeys = [...this.dirtyContexts];
    this.dirtyContexts.clear();
    let writeCount = 0;

    for (const key of dirtyContextKeys) {
      const context = this.contexts.get(key);

      if (context) {
        try {
          writeCount += this.reconcileContext(context);
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

  private synchronizePendingWindows(): void {
    if (
      this.startupStabilizationToken !== null ||
      this.pendingWindowSyncs.size === 0
    ) {
      return;
    }

    const pendingIds = [...this.pendingWindowSyncs];
    const admissionCandidates: KWinWindow[] = [];
    const releasedContextKeys = new Set<string>();
    this.pendingWindowSyncs.clear();

    for (const id of pendingIds) {
      this.forgetWaitingWindow(id);
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const nextContext = observed ? managedContext(observed) : null;
      const owner = this.managedWindows.get(id);
      let resumed = false;

      const requests = this.requestedSuspensions.get(id);
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

      const changedContext = Boolean(
        owner && (!nextContext || contextKey(nextContext) !== owner.contextKey),
      );

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

    this.admitWindows(admissionCandidates);

    this.retryWaitingWindows(releasedContextKeys);
  }

  private admitWindows(sources: readonly KWinWindow[]): number {
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

  private admitWindowGroup(
    context: ManagedContext,
    sources: readonly KWinWindow[],
  ): number {
    const key = contextKey(context);
    const candidates: AdmissionCandidate[] = [];

    for (const source of sources) {
      const id = windowId(String(source.internalId));
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
        key,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    for (const candidate of admittedCandidates) {
      runtimeContext.windowIds.add(candidate.id);
      this.managedWindows.set(candidate.id, {
        contextFingerprint: contextGeometry.fingerprint,
        contextKey: key,
        originalFrame: { ...candidate.source.frameGeometry },
      });
      this.forgetWaitingWindow(candidate.id);

      if (
        !this.initializing &&
        String(this.workspace.activeWindow?.internalId) === String(candidate.id)
      ) {
        this.layout.activateWindow(candidate.id);
      }
    }

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

    if (!observed) {
      this.forgetWaitingWindow(id);
      return false;
    }

    const context = managedContext(observed);

    if (!context) {
      this.forgetWaitingWindow(id);
      return false;
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

    const key = contextKey(context);
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
        this.deferWindow(id, key);
      } else {
        this.forgetWaitingWindow(id);
      }

      return false;
    }

    this.forgetWaitingWindow(id);
    let runtimeContext = this.contexts.get(key);

    if (!runtimeContext) {
      runtimeContext = {
        ...context,
        key,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(key, runtimeContext);
    }

    runtimeContext.windowIds.add(id);
    this.managedWindows.set(id, {
      contextFingerprint: decision.fingerprint,
      contextKey: key,
      originalFrame: { ...source.frameGeometry },
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

    this.markContextDirty(runtimeContext);
    return true;
  }

  private releaseWindow(id: WindowId): string | null {
    const owner = this.managedWindows.get(id);

    if (!owner) {
      return null;
    }

    this.managedWindows.delete(id);
    this.layout.unmanageWindow(id);

    const context = this.contexts.get(owner.contextKey);

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

  private deferWindow(id: WindowId, contextKey: string): void {
    const previousContextKey = this.waitingWindowContexts.get(id);

    if (previousContextKey === contextKey) {
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
      const windowIds = [...(this.waitingWindowIds.get(key) ?? [])];

      for (const id of windowIds) {
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

  private reconcileContext(context: RuntimeContext): number {
    if (!this.isContextVisible(context)) {
      return 0;
    }

    const contextGeometry = this.geometry.contextGeometry(
      context.outputId,
      context.desktopId,
    );

    if (!contextGeometry) {
      return 0;
    }

    const layout = solveStripGeometry({
      context: this.layout.snapshot(context.outputId, context.desktopId),
      devicePixelRatio: contextGeometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: contextGeometry.pixelGridOrigin,
      workArea: contextGeometry.workArea,
    });

    if (!this.canApplyLayout(layout.maxViewportOffset)) {
      return 0;
    }

    this.layout.setViewportOffset(
      context.outputId,
      context.desktopId,
      layout.viewportOffset,
    );
    const writableLayout = layout.windows.filter(
      (window) => !this.suspendedWindows.has(window.windowId),
    );
    const windowIds = writableLayout.map((window) => window.windowId);
    const observed = this.geometry.observedFrames(windowIds, context);
    const changes = diffWindowGeometries(writableLayout, observed);
    return this.geometry.apply(changes, context);
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
      return { kind: "deferred" };
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
    for (const context of this.contexts.values()) {
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

      const desired = [...context.windowIds]
        .filter((id) => !this.suspendedWindows.has(id))
        .map((id) => ({ id, owner: this.managedWindows.get(id) }))
        .filter((entry): entry is { id: WindowId; owner: ManagedWindow } =>
          Boolean(
            entry.owner &&
            entry.owner.contextFingerprint === currentContext.fingerprint,
          ),
        )
        .map(({ id, owner }) => ({
          columnId: columnId(`column:${String(id)}`),
          frame: owner.originalFrame,
          windowId: id,
        }));

      if (desired.length === 0) {
        continue;
      }

      const observed = this.geometry.observedFrames(
        desired.map((window) => window.windowId),
        context,
      );
      this.geometry.apply(diffWindowGeometries(desired, observed), context);
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

function sameResumeSample(left: ResumeSample, right: ResumeSample): boolean {
  return (
    left.contextKey === right.contextKey &&
    Math.abs(left.frame.x - right.frame.x) <= 1e-6 &&
    Math.abs(left.frame.y - right.frame.y) <= 1e-6 &&
    Math.abs(left.frame.width - right.frame.width) <= 1e-6 &&
    Math.abs(left.frame.height - right.frame.height) <= 1e-6
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
