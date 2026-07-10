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
  isGeometryWritable,
  type ContextGeometry,
  type KWinRectFactory,
} from "./platform/kwin/geometry-adapter";
import {
  normalizeWindow,
  WindowObserver,
  type ObservedWindow,
} from "./platform/kwin/window-observer";

const DEFAULT_COLUMN_WIDTH: ColumnWidth = {
  kind: "proportion",
  value: 0.5,
};
const DEFAULT_GAP = 16;

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

type AdmissionDecision =
  | { readonly fingerprint: string; readonly kind: "accepted" }
  | { readonly kind: "deferred" | "rejected" };

export interface RuntimeControllerOptions {
  readonly clientAreaOption: number;
  readonly columnWidth?: ColumnWidth;
  readonly createRect?: KWinRectFactory;
  readonly gap?: number;
  readonly schedule?: (callback: () => void) => void;
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
  private readonly schedule: (callback: () => void) => void;
  private runGeneration = 0;
  private started = false;
  private readonly width: ColumnWidth;
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
    this.width = { ...(options.columnWidth ?? DEFAULT_COLUMN_WIDTH) };
    this.workspace = workspace;
    this.observer = new WindowObserver(workspace, {
      added: this.handleWindowAdded,
      changed: this.handleWindowChanged,
      removed: this.handleWindowRemoved,
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
        this.synchronizePendingWindows();
        this.handleWindowActivated(this.workspace.activeWindow);
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
      this.waitingWindowContexts.clear();
      this.waitingWindowIds.clear();
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
    if (this.initializing) {
      this.pendingWindowSyncs.add(windowId(window.id));
      return;
    }

    const source = this.observer.source(window.id);

    if (source && this.tryAdmitWindow(source)) {
      this.scheduleWork();
    }
  };

  private readonly handleWindowChanged = (id: string): void => {
    this.pendingWindowSyncs.add(windowId(id));
    this.scheduleWork();
  };

  private readonly handleWindowRemoved = (id: string): void => {
    const managedId = windowId(id);
    this.pendingWindowSyncs.delete(managedId);
    this.forgetWaitingWindow(managedId);
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

  private scheduleWork(): void {
    if (this.initializing || this.workScheduled) {
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
    if (this.pendingWindowSyncs.size === 0) {
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

      if (owner && source && (source.move || source.resize)) {
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

      if (source && nextContext && (!owner || changedContext)) {
        admissionCandidates.push(source);
      } else if (owner && source && nextContext && isGeometryWritable(source)) {
        const context = this.contexts.get(owner.contextKey);

        if (context) {
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

      if (
        !observed ||
        !context ||
        !isGeometryWritable(source) ||
        this.managedWindows.has(id)
      ) {
        this.forgetWaitingWindow(id);
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
      if (source.move || source.resize) {
        this.deferWindow(id, contextKey(context));
      } else {
        this.forgetWaitingWindow(id);
      }

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

    const key = contextKey(context);
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
    const windowIds = layout.windows.map((window) => window.windowId);
    const observed = this.geometry.observedFrames(windowIds, context);
    const changes = diffWindowGeometries(layout.windows, observed);
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

function contextKey(context: ManagedContext): string {
  return `${context.outputId}\u0000${context.desktopId}`;
}

function currentDesktopForOutput(workspace: KWinWorkspace, output: KWinOutput) {
  return typeof workspace.currentDesktopForScreen === "function"
    ? workspace.currentDesktopForScreen(output)
    : workspace.currentDesktop;
}
