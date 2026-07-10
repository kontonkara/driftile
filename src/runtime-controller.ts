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

interface OriginalFrame {
  readonly contextFingerprint: string;
  readonly frame: KWinWindow["frameGeometry"];
}

export interface RuntimeControllerOptions {
  readonly clientAreaOption: number;
  readonly columnWidth?: ColumnWidth;
  readonly createRect?: KWinRectFactory;
  readonly gap?: number;
  readonly schedule?: (callback: () => void) => void;
}

export class RuntimeController {
  private context: ManagedContext | null = null;
  private readonly geometry: KWinGeometryAdapter;
  private readonly gap: number;
  private initializing = false;
  private lastWrites = 0;
  private layout = new LayoutEngine();
  private readonly managedWindows = new Set<WindowId>();
  private readonly observer: WindowObserver;
  private readonly originalFrames = new Map<WindowId, OriginalFrame>();
  private reconcileScheduled = false;
  private readonly schedule: (callback: () => void) => void;
  private started = false;
  private readonly width: ColumnWidth;
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

    this.context = resolveActiveContext(this.workspace);

    if (!this.context) {
      return false;
    }

    try {
      this.started = true;
      this.workspace.windowActivated.connect(this.handleWindowActivated);
      this.initializing = true;

      try {
        this.observer.start();
      } finally {
        this.initializing = false;
      }

      this.handleWindowActivated(this.workspace.activeWindow);
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

    this.restoreOriginalFrames();
    this.started = false;
    this.reconcileScheduled = false;
    this.workspace.windowActivated.disconnect(this.handleWindowActivated);
    this.observer.stop();
    this.layout = new LayoutEngine();
    this.managedWindows.clear();
    this.originalFrames.clear();
    this.context = null;
    this.lastWrites = 0;
  }

  reconcile(): number {
    const context = this.context;

    if (!this.started || !context) {
      return 0;
    }

    const contextGeometry = this.geometry.contextGeometry(
      context.outputId,
      context.desktopId,
    );

    if (!contextGeometry) {
      this.lastWrites = 0;
      return 0;
    }

    const layout = solveStripGeometry({
      context: this.layout.snapshot(context.outputId, context.desktopId),
      devicePixelRatio: contextGeometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: contextGeometry.pixelGridOrigin,
      workArea: contextGeometry.workArea,
    });

    if (layout.maxViewportOffset > 1e-6) {
      this.lastWrites = 0;
      return 0;
    }

    const windowIds = layout.windows.map((window) => window.windowId);
    const observed = this.geometry.observedFrames(windowIds, context);
    const changes = diffWindowGeometries(layout.windows, observed);
    this.lastWrites = this.geometry.apply(changes, context);
    return this.lastWrites;
  }

  private readonly handleWindowAdded = (window: ObservedWindow): void => {
    const context = this.context;

    if (!context || !belongsToContext(window, context)) {
      return;
    }

    const source = this.observer.source(window.id);

    if (!source || !isGeometryWritable(source)) {
      return;
    }

    const id = windowId(window.id);
    const added = this.layout.manageWindow({
      columnId: columnId(`column:${window.id}`),
      desktopId: context.desktopId,
      outputId: context.outputId,
      width: this.width,
      windowId: id,
    });

    if (!added) {
      return;
    }

    const contextFingerprint = this.layoutContextFingerprint(context, id);

    if (!contextFingerprint) {
      this.layout.unmanageWindow(id);
      return;
    }

    this.originalFrames.set(id, {
      contextFingerprint,
      frame: { ...source.frameGeometry },
    });
    this.managedWindows.add(id);

    if (!this.initializing) {
      this.scheduleReconcile();
    }
  };

  private readonly handleWindowRemoved = (id: string): void => {
    const managedId = windowId(id);

    if (!this.managedWindows.delete(managedId)) {
      return;
    }

    this.originalFrames.delete(managedId);
    this.layout.unmanageWindow(managedId);

    if (!this.initializing) {
      this.scheduleReconcile();
    }
  };

  private readonly handleWindowActivated = (
    window: KWinWindow | null,
  ): void => {
    const context = this.context;

    if (!window || !context) {
      return;
    }

    const id = windowId(String(window.internalId));
    const observed = normalizeWindow(window);

    if (
      observed &&
      belongsToContext(observed, context) &&
      this.managedWindows.has(id)
    ) {
      this.layout.activateWindow(id);
    }
  };

  private focusAdjacent(direction: HorizontalDirection): boolean {
    const activeWindow = this.workspace.activeWindow;
    const context = this.context;

    if (!this.started || !context || !activeWindow) {
      return false;
    }

    const observedActive = normalizeWindow(activeWindow);

    if (!observedActive || !belongsToContext(observedActive, context)) {
      return false;
    }

    const targetId = this.layout.adjacentWindow(
      windowId(String(activeWindow.internalId)),
      direction,
    );

    if (!targetId) {
      return false;
    }

    const target = this.observer.source(targetId);
    const observedTarget = target ? normalizeWindow(target) : null;

    if (
      !target ||
      !observedTarget ||
      !belongsToContext(observedTarget, context) ||
      !this.managedWindows.has(targetId)
    ) {
      return false;
    }

    this.workspace.activeWindow = target;
    return true;
  }

  private scheduleReconcile(): void {
    if (this.reconcileScheduled) {
      return;
    }

    this.reconcileScheduled = true;
    this.schedule(() => {
      this.reconcileScheduled = false;

      if (this.started) {
        this.reconcile();
      }
    });
  }

  private layoutContextFingerprint(
    context: ManagedContext,
    candidateId: WindowId,
  ): string | null {
    const contextGeometry = this.geometry.contextGeometry(
      context.outputId,
      context.desktopId,
    );

    if (!contextGeometry) {
      return null;
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
    const fits = Boolean(
      layout.maxViewportOffset <= 1e-6 &&
      candidate &&
      this.geometry.canApplyFrame(candidateId, candidate.frame, context),
    );
    return fits ? contextGeometry.fingerprint : null;
  }

  private restoreOriginalFrames(): void {
    const context = this.context;

    if (!context || this.originalFrames.size === 0) {
      return;
    }

    let currentContext: ContextGeometry | null;

    try {
      currentContext = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch (error) {
      console.warn(
        `[driftile] original geometry restore skipped error=${String(error)}`,
      );
      return;
    }

    if (!currentContext) {
      return;
    }

    const desired = [...this.originalFrames]
      .filter(
        ([, original]) =>
          original.contextFingerprint === currentContext.fingerprint,
      )
      .map(([id, original]) => ({
        columnId: columnId(`column:${String(id)}`),
        frame: original.frame,
        windowId: id,
      }));

    if (desired.length === 0) {
      return;
    }

    const observed = this.geometry.observedFrames(
      desired.map((window) => window.windowId),
      context,
    );
    this.geometry.apply(diffWindowGeometries(desired, observed), context);
  }
}

function resolveActiveContext(workspace: KWinWorkspace): ManagedContext | null {
  const output = workspace.activeScreen;

  if (!output) {
    return null;
  }

  const desktop = currentDesktopForOutput(workspace, output);

  if (!desktop) {
    return null;
  }

  return {
    desktopId: desktopId(desktop.id),
    outputId: outputId(output.name),
  };
}

function currentDesktopForOutput(workspace: KWinWorkspace, output: KWinOutput) {
  return typeof workspace.currentDesktopForScreen === "function"
    ? workspace.currentDesktopForScreen(output)
    : workspace.currentDesktop;
}

function belongsToContext(
  window: ObservedWindow,
  context: ManagedContext,
): boolean {
  return (
    window.kind === "normal" &&
    window.outputId === context.outputId &&
    window.desktopIds.length === 1 &&
    window.desktopIds[0] === context.desktopId
  );
}
