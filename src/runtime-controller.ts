import {
  DEFAULT_WINDOW_HEIGHT_PRESETS,
  solveStripGeometry,
  type Rect,
  type WindowHeightBounds,
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
  columnWindowHeights,
  previewColumnRestoration,
  type ColumnWidth,
  type DetachedWindowPlacement,
  type HorizontalDirection,
  type HorizontalEdge,
  type LayoutColumnPlacement,
  type LayoutColumnSnapshot,
  type LayoutContextSnapshot,
  type StackEditResult,
  type VerticalDirection,
  type WindowHeight,
  type WindowHeightEditRollback,
} from "./core/layout-engine";
import {
  findAdjacentOutput,
  type OutputDirection,
} from "./core/output-navigation";
import { diffWindowGeometries } from "./core/reconcile";
import type {
  KWinOutput,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "./platform/kwin/api";
import { DesktopLifecycle } from "./platform/kwin/desktop-lifecycle";
import {
  frameSizeConstraintBounds,
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
const DEFAULT_COLUMN_WIDTH_PRESETS: readonly ColumnWidth[] = [
  { kind: "proportion", value: 1 / 3 },
  { kind: "proportion", value: 0.5 },
  { kind: "proportion", value: 2 / 3 },
];
const DEFAULT_GAP = 16;
const FIXED_SIZE_CONSTRAINTS = 1;
const FLEXIBLE_SIZE_CONSTRAINTS = 0;
const MALFORMED_SIZE_CONSTRAINTS = -1;
const MAX_CAPACITY_PARK_ATTEMPTS = 20;
const MAX_BORDERLESS_SETTLEMENT_PROBES = 20;
const MAX_TOPOLOGY_SAMPLE_ATTEMPTS = 20;
const MAX_TRANSIENT_RESUME_PROBES = 20;
const MINIMUM_COLUMN_WIDTH = 64;
const PROPORTIONAL_COLUMN_WIDTH_STEP = 0.1;
const PROPORTIONAL_WINDOW_HEIGHT_STEP = 0.1;
const REQUIRED_CAPACITY_PARK_SAMPLES = 2;
const WINDOW_HEIGHT_PRESET_CYCLE_TOLERANCE = 1;

type ColumnResizeAction =
  "decrease" | "increase" | "preset-next" | "preset-previous" | "reset";
type WindowHeightResizeAction = ColumnResizeAction;
type DesktopTransferDirection = -1 | 1;

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
  readonly clientFrame: KWinWindow["clientGeometry"];
  readonly fingerprint: string;
  readonly frame: KWinWindow["frameGeometry"];
  readonly kind: "client" | "frame";
  readonly noBorder: boolean | undefined;
}

interface FloatingWindow {
  readonly expectedFrame: KWinWindow["frameGeometry"];
  readonly placement: DetachedWindowPlacement;
  readonly restoreBaseline: RestoreBaseline;
  readonly sourceContextKey: string;
}

interface WindowTransferOperation {
  readonly activeId: WindowId;
  desktopChangeSuppressed: boolean;
  readonly kind: "desktop" | "output";
  readonly movingIds: ReadonlySet<WindowId>;
  readonly sourceContextKey: string;
  readonly targetContextKey: string;
}

interface ColumnTransferMember {
  readonly id: WindowId;
  readonly window: KWinWindow;
}

interface TransferSelection {
  readonly memberIds: ReadonlySet<WindowId>;
  readonly members: readonly ColumnTransferMember[];
  readonly sourceColumn: LayoutColumnSnapshot;
  readonly wholeColumn: boolean;
}

interface DesktopTransferCommand
  extends ActiveWindowCommand, TransferSelection {
  readonly output: KWinOutput;
  readonly sourceDesktop: KWinVirtualDesktop;
  readonly sourceRuntimeContext: RuntimeContext;
  readonly targetContext: ManagedContext;
  readonly targetContextGeometry: ContextGeometry;
  readonly targetContextKey: string;
  readonly targetDesktop: KWinVirtualDesktop;
  readonly targetRuntimeContext: RuntimeContext | undefined;
}

interface OutputTransferCommand extends ActiveWindowCommand, TransferSelection {
  readonly sourceDesktop: KWinVirtualDesktop;
  readonly sourceOutput: KWinOutput;
  readonly sourceRuntimeContext: RuntimeContext;
  readonly targetContext: ManagedContext;
  readonly targetContextGeometry: ContextGeometry;
  readonly targetContextKey: string;
  readonly targetDesktop: KWinVirtualDesktop;
  readonly targetOutput: KWinOutput;
  readonly targetRuntimeContext: RuntimeContext | undefined;
}

interface TransferGeometryChange {
  readonly context: ManagedContext;
  readonly contextKey: string;
  readonly frame: Rect;
  readonly windowId: WindowId;
}

type WindowTransferPreview = NonNullable<
  ReturnType<LayoutEngine["previewWindowTransfer"]>
>;

type ColumnTransferPreview = NonNullable<
  ReturnType<LayoutEngine["previewColumnTransfer"]>
>;

type ContextTransferPreview =
  | { readonly kind: "column"; readonly value: ColumnTransferPreview }
  | { readonly kind: "window"; readonly value: WindowTransferPreview };

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

interface VisibleColumnGroup {
  readonly activeFrame: Rect;
  readonly layout: ReturnType<typeof solveStripGeometry>;
  readonly leftmostFrame: Rect;
  readonly nonActiveCount: number;
  readonly widthTaken: number;
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

interface WindowBorderRestore {
  admissionBaselinePending: boolean;
  readonly clientFrame: KWinWindow["clientGeometry"];
  readonly frame: KWinWindow["frameGeometry"];
  readonly noBorder: boolean;
}

type AdmissionDecision =
  | { readonly fingerprint: string; readonly kind: "accepted" }
  | { readonly fingerprint?: string; readonly kind: "deferred" }
  | { readonly kind: "rejected" };

export interface RuntimeControllerOptions {
  readonly borderlessWindows?: boolean;
  readonly clientAreaOption: number;
  readonly columnWidth?: ColumnWidth;
  readonly columnWidthPresets?: readonly ColumnWidth[];
  readonly createRect?: KWinRectFactory;
  readonly gap?: number;
  readonly schedule?: (callback: () => void) => void;
  readonly scheduleResume?: (callback: () => void) => void;
  readonly startupStabilizationProbes?: number;
  readonly windowHeightPresets?: readonly ColumnWidth[];
}

export class RuntimeController {
  private readonly automaticFloatingWindows = new Set<WindowId>();
  private readonly borderlessSettlementEnabled: boolean;
  private readonly borderlessSettlementTokens = new Map<WindowId, object>();
  private borderlessWindows: boolean;
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
  private readonly columnFullWidthRestore = new Map<
    string,
    Map<ColumnId, ColumnWidth>
  >();
  private readonly columnWidthPresets: readonly ColumnWidth[];
  private readonly contexts = new Map<string, RuntimeContext>();
  private readonly dirtyContexts = new Set<string>();
  private readonly desktopLifecycle: DesktopLifecycle;
  private windowTransferOperation: WindowTransferOperation | null = null;
  private readonly floatingWindows = new Map<WindowId, FloatingWindow>();
  private readonly geometry: KWinGeometryAdapter;
  private readonly gap: number;
  private initializing = false;
  private ownershipFollowUpRequired = false;
  private ownershipRefreshInProgress = false;
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
  private readonly windowHeightPresets: readonly ColumnWidth[];
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
  private readonly windowAdmissionHistory = new Set<WindowId>();
  private readonly windowBorderRestore = new Map<
    WindowId,
    WindowBorderRestore
  >();
  private workScheduled = false;
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, options: RuntimeControllerOptions) {
    this.borderlessSettlementEnabled = options.scheduleResume !== undefined;
    this.borderlessWindows = options.borderlessWindows ?? false;
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
    this.columnWidthPresets = (
      options.columnWidthPresets ?? DEFAULT_COLUMN_WIDTH_PRESETS
    ).map((width) => ({ ...width }));
    this.windowHeightPresets = (
      options.windowHeightPresets ?? DEFAULT_WINDOW_HEIGHT_PRESETS
    ).map((height) => ({ ...height }));
    this.workspace = workspace;
    this.desktopLifecycle = new DesktopLifecycle(workspace, {
      changed: () => {
        this.scheduleWork();
      },
    });
    this.observer = new WindowObserver(workspace, {
      added: this.handleWindowAdded,
      changed: this.handleWindowChanged,
      removed: this.handleWindowRemoved,
      stateChanged: this.handleWindowStateChanged,
      suspensionSettled: this.handleWindowSuspensionSettled,
      suspending: this.handleWindowSuspending,
      tracked: this.handleWindowTracked,
    });
    this.geometry = new KWinGeometryAdapter(
      workspace,
      this.observer,
      options.clientAreaOption,
      options.createRect,
      (id, source) =>
        !this.automaticFloatingWindows.has(id) &&
        !this.automaticallyFloats(source),
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

  get automaticFloatingCount(): number {
    return this.automaticFloatingWindows.size;
  }

  get managedCount(): number {
    return this.managedWindows.size;
  }

  setBorderlessWindows(enabled: boolean): void {
    if (this.borderlessWindows === enabled) {
      return;
    }

    this.borderlessWindows = enabled;

    if (!this.started) {
      return;
    }

    if (!enabled) {
      this.restoreWindowBorders();
      this.reconcileBorderAffectedContexts();
      return;
    }

    this.synchronizeWindowBorders();
    this.reconcileBorderAffectedContexts();
  }

  focusLeft(): boolean {
    return this.focusHorizontal("left");
  }

  focusRight(): boolean {
    return this.focusHorizontal("right");
  }

  focusFirstColumn(): boolean {
    return this.focusHorizontal("first");
  }

  focusLastColumn(): boolean {
    return this.focusHorizontal("last");
  }

  focusUp(): boolean {
    return this.focusWithinActiveColumn("up");
  }

  focusDown(): boolean {
    return this.focusWithinActiveColumn("down");
  }

  focusPreviousDesktop(): boolean {
    return this.focusDesktop(-1);
  }

  focusNextDesktop(): boolean {
    return this.focusDesktop(1);
  }

  moveColumnLeft(): boolean {
    return this.moveActiveColumn("left");
  }

  moveColumnRight(): boolean {
    return this.moveActiveColumn("right");
  }

  moveColumnToFirst(): boolean {
    return this.moveActiveColumnToEdge("first");
  }

  moveColumnToLast(): boolean {
    return this.moveActiveColumnToEdge("last");
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

  moveWindowToPreviousDesktop(): boolean {
    return this.moveActiveWindowToDesktop(-1);
  }

  moveWindowToNextDesktop(): boolean {
    return this.moveActiveWindowToDesktop(1);
  }

  moveColumnToPreviousDesktop(): boolean {
    return this.moveActiveWindowToDesktop(-1, true);
  }

  moveColumnToNextDesktop(): boolean {
    return this.moveActiveWindowToDesktop(1, true);
  }

  moveWindowToOutputLeft(): boolean {
    return this.moveActiveWindowToOutput("left");
  }

  moveWindowToOutputRight(): boolean {
    return this.moveActiveWindowToOutput("right");
  }

  moveWindowToOutputUp(): boolean {
    return this.moveActiveWindowToOutput("up");
  }

  moveWindowToOutputDown(): boolean {
    return this.moveActiveWindowToOutput("down");
  }

  moveColumnToOutputLeft(): boolean {
    return this.moveActiveWindowToOutput("left", true);
  }

  moveColumnToOutputRight(): boolean {
    return this.moveActiveWindowToOutput("right", true);
  }

  moveColumnToOutputUp(): boolean {
    return this.moveActiveWindowToOutput("up", true);
  }

  moveColumnToOutputDown(): boolean {
    return this.moveActiveWindowToOutput("down", true);
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

  switchPresetColumnWidth(): boolean {
    return this.resizeActiveColumn("preset-next");
  }

  switchPresetColumnWidthBack(): boolean {
    return this.resizeActiveColumn("preset-previous");
  }

  decreaseWindowHeight(): boolean {
    return this.resizeActiveWindowHeight("decrease");
  }

  increaseWindowHeight(): boolean {
    return this.resizeActiveWindowHeight("increase");
  }

  resetWindowHeight(): boolean {
    return this.resizeActiveWindowHeight("reset");
  }

  switchPresetWindowHeight(): boolean {
    return this.resizeActiveWindowHeight("preset-next");
  }

  switchPresetWindowHeightBack(): boolean {
    return this.resizeActiveWindowHeight("preset-previous");
  }

  maximizeColumn(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    const restore = this.columnFullWidthRestoreWidth(
      command.context.key,
      command.activeColumn.id,
    );
    const target = restore ?? { kind: "proportion", value: 1 };

    if (sameColumnWidth(command.activeColumn.width, target)) {
      if (restore) {
        this.deleteColumnFullWidthRestore(
          command.context.key,
          command.activeColumn.id,
        );
      } else {
        this.setColumnFullWidthRestore(
          command.context.key,
          command.activeColumn.id,
          command.activeColumn.width,
        );
      }

      return true;
    }

    const resized = this.applyColumnWidth(command, target, "column maximize");

    if (!resized) {
      return false;
    }

    if (restore) {
      this.deleteColumnFullWidthRestore(
        command.context.key,
        command.activeColumn.id,
      );
    } else {
      this.setColumnFullWidthRestore(
        command.context.key,
        command.activeColumn.id,
        command.activeColumn.width,
      );
    }

    this.finishColumnWidthChange(command.context.key);
    return true;
  }

  centerColumn(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    let currentLayout: ReturnType<typeof solveStripGeometry>;

    try {
      currentLayout = this.solveContextGeometry(
        command.before,
        command.contextGeometry,
      );
    } catch {
      return false;
    }

    const active = currentLayout.windows.find(
      (window) => window.windowId === command.activeId,
    );

    if (!active) {
      return false;
    }

    const workArea = command.contextGeometry.workArea;
    const requestedOffset = roundToPhysicalPixel(
      currentLayout.viewportOffset +
        active.frame.x +
        active.frame.width / 2 -
        (workArea.x + workArea.width / 2),
      command.contextGeometry.devicePixelRatio,
    );
    const preview = this.previewActiveColumnView(
      command,
      command.activeColumn.width,
      requestedOffset,
    );

    if (!preview) {
      return false;
    }

    const desiredOffset = preview.viewportOffset;

    if (
      Math.abs(desiredOffset - currentLayout.viewportOffset) <=
      floatingPointTolerance(
        desiredOffset,
        currentLayout.viewportOffset,
        workArea.width,
      )
    ) {
      return false;
    }

    return this.applyActiveColumnMutation(
      command,
      "column center",
      () =>
        this.layout.setViewportOffset(
          command.context.outputId,
          command.context.desktopId,
          desiredOffset,
        ),
      () =>
        this.layout.setViewportOffset(
          command.context.outputId,
          command.context.desktopId,
          command.before.viewportOffset,
        ),
    );
  }

  expandColumnToAvailableWidth(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    const visible = this.visibleColumnGroup(command);

    if (
      !visible ||
      this.columnFullWidthRestoreWidth(
        command.context.key,
        command.activeColumn.id,
      )
    ) {
      return false;
    }

    const availableWidth =
      command.contextGeometry.workArea.width - this.gap - visible.widthTaken;

    if (
      availableWidth <=
      floatingPointTolerance(
        availableWidth,
        command.contextGeometry.workArea.width,
      )
    ) {
      return false;
    }

    if (visible.nonActiveCount === 0) {
      return this.maximizeColumn();
    }

    const maximumWidth = this.activeColumnMaximumWidth(command);

    if (maximumWidth === null) {
      return false;
    }

    const targetWidth = floorToPhysicalPixel(
      Math.max(
        visible.activeFrame.width,
        Math.min(visible.activeFrame.width + availableWidth, maximumWidth),
      ),
      command.contextGeometry.devicePixelRatio,
    );

    const desiredOffset = roundToPhysicalPixel(
      visible.layout.viewportOffset +
        visible.leftmostFrame.x -
        (command.contextGeometry.workArea.x + this.gap),
      command.contextGeometry.devicePixelRatio,
    );
    const target: ColumnWidth = { kind: "fixed", value: targetWidth };
    const preview = this.previewActiveColumnView(
      command,
      target,
      desiredOffset,
    );

    if (!preview) {
      return false;
    }

    const widthChanges = !sameColumnWidth(command.activeColumn.width, target);
    const viewportChanges = !nearlyEqual(
      preview.viewportOffset,
      command.before.viewportOffset,
    );

    if (!widthChanges && !viewportChanges) {
      return false;
    }

    let previousWidth: ColumnWidth | null = null;
    const expanded = this.applyActiveColumnMutation(
      command,
      "column available-width expansion",
      () => {
        if (widthChanges) {
          previousWidth = this.layout.setActiveColumnWidth(
            command.activeId,
            target,
          );

          if (previousWidth === null) {
            return false;
          }
        }

        if (
          viewportChanges &&
          !this.layout.setViewportOffset(
            command.context.outputId,
            command.context.desktopId,
            preview.viewportOffset,
          )
        ) {
          if (previousWidth !== null) {
            this.layout.setActiveColumnWidth(command.activeId, previousWidth);
            previousWidth = null;
          }

          return false;
        }

        return true;
      },
      () => {
        let restored = true;

        if (previousWidth !== null) {
          restored =
            this.layout.setActiveColumnWidth(
              command.activeId,
              previousWidth,
            ) !== null;
        }

        if (viewportChanges) {
          restored =
            this.layout.setViewportOffset(
              command.context.outputId,
              command.context.desktopId,
              command.before.viewportOffset,
            ) && restored;
        }

        return restored;
      },
    );

    if (!expanded) {
      return false;
    }

    this.deleteColumnFullWidthRestore(
      command.context.key,
      command.activeColumn.id,
    );
    this.finishColumnWidthChange(command.context.key);
    return true;
  }

  centerVisibleColumns(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    const visible = this.visibleColumnGroup(command);

    if (!visible) {
      return false;
    }

    const freeSpace =
      command.contextGeometry.workArea.width - visible.widthTaken + this.gap;
    const desiredLeft =
      command.contextGeometry.workArea.x + Math.max(0, freeSpace) / 2;
    const desiredOffset = roundToPhysicalPixel(
      visible.layout.viewportOffset + visible.leftmostFrame.x - desiredLeft,
      command.contextGeometry.devicePixelRatio,
    );
    const preview = this.previewActiveColumnView(
      command,
      command.activeColumn.width,
      desiredOffset,
    );

    if (
      !preview ||
      Math.abs(preview.viewportOffset - visible.layout.viewportOffset) <=
        floatingPointTolerance(
          preview.viewportOffset,
          visible.layout.viewportOffset,
          command.contextGeometry.workArea.width,
        )
    ) {
      return false;
    }

    return this.applyActiveColumnMutation(
      command,
      "visible columns center",
      () =>
        this.layout.setViewportOffset(
          command.context.outputId,
          command.context.desktopId,
          preview.viewportOffset,
        ),
      () =>
        this.layout.setViewportOffset(
          command.context.outputId,
          command.context.desktopId,
          command.before.viewportOffset,
        ),
    );
  }

  probeTopology(): void {
    if (
      !this.started ||
      this.windowTransferOperation ||
      this.topologyStabilizing
    ) {
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
        this.synchronizeWindowBorders();
        this.topologyObserver.start();
        this.desktopLifecycle.start();
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

      this.desktopLifecycle.reconcile(this.desktopLifecycleCanMutate());
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
        this.restoreWindowBorders();
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
      this.desktopLifecycle.stop();
      this.topologyObserver.stop();
      this.observer.stop();
      this.layout = new LayoutEngine();
      this.knownOutputInstances.clear();
      this.contexts.clear();
      this.windowTransferOperation = null;
      this.dirtyContexts.clear();
      this.automaticFloatingWindows.clear();
      this.borderlessSettlementTokens.clear();
      this.floatingWindows.clear();
      this.managedWindows.clear();
      this.pendingAdmissionContexts.clear();
      this.pendingWindowSyncs.clear();
      this.ownershipFollowUpRequired = false;
      this.ownershipRefreshInProgress = false;
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
      this.columnFullWidthRestore.clear();
      this.committedOutputRanks.clear();
      this.waitingWindowContexts.clear();
      this.waitingContextFingerprints.clear();
      this.waitingWindowIds.clear();
      this.windowAdmissionHistory.clear();
      this.windowBorderRestore.clear();
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
      this.windowTransferOperation ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return 0;
    }

    const ownershipChanged = this.refreshLiveWindowOwnership();
    const admissionsPending =
      this.pendingWindowSyncs.size > 0 ||
      this.pendingAdmissionContexts.size > 0;
    const preliminaryGeometries = this.sampleSettledVisibleContextGeometries();

    if (!preliminaryGeometries) {
      return 0;
    }

    this.synchronizePendingWindows();
    this.retryPendingAdmissions();
    const sampledGeometries =
      ownershipChanged || admissionsPending
        ? this.sampleSettledVisibleContextGeometries()
        : preliminaryGeometries;

    if (!sampledGeometries) {
      return 0;
    }

    this.dirtyContexts.clear();

    let writeCount = 0;

    for (const context of this.contexts.values()) {
      writeCount += this.reconcileContext(context, sampledGeometries);
    }

    if (this.refreshAutomaticFloatingAdmissionQueue()) {
      this.ownershipFollowUpRequired = true;
    }

    this.lastWrites = writeCount;

    if (this.ownershipFollowUpRequired) {
      this.ownershipFollowUpRequired = false;
      this.scheduleWork();
    }

    return writeCount;
  }

  private readonly handleCurrentDesktopChanged = (
    _previous: KWinVirtualDesktop | null,
    current?: KWinVirtualDesktop | null,
    output?: KWinOutput,
  ): void => {
    if (this.windowTransferOperation) {
      if (this.windowTransferOperation.kind === "output") {
        this.windowTransferOperation.desktopChangeSuppressed = true;
      }

      return;
    }

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

    if (this.synchronizeAutomaticFloatingWindow(addedId, source)) {
      return;
    }

    const addedContext = managedContext(window);

    if (addedContext) {
      this.capacityParkBackoffs.delete(contextKey(addedContext));
    }

    if (
      this.initializing ||
      this.windowTransferOperation ||
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

  private readonly handleWindowTracked = (id: string): void => {
    this.synchronizeWindowBorder(windowId(id), this.observer.source(id));
  };

  private readonly handleWindowChanged = (id: string): void => {
    const changedId = windowId(id);
    const source = this.observer.source(id);

    this.synchronizeWindowBorder(changedId, source);

    if (this.windowTransferOperation) {
      if (
        !this.windowTransferOperation.movingIds.has(changedId) ||
        (source &&
          (this.automaticFloatingWindows.has(changedId) ||
            this.automaticallyFloats(source)))
      ) {
        this.pendingWindowSyncs.add(changedId);
      }

      return;
    }

    if (this.synchronizeAutomaticFloatingWindow(changedId, source)) {
      return;
    }

    const transition = this.toggleGeometryTransitions.get(changedId);

    if (transition) {
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

    this.synchronizeWindowBorder(changedId, source);

    if (this.windowTransferOperation) {
      if (
        !this.windowTransferOperation.movingIds.has(changedId) ||
        (source &&
          (this.automaticFloatingWindows.has(changedId) ||
            this.automaticallyFloats(source)))
      ) {
        this.pendingWindowSyncs.add(changedId);
      }

      return;
    }

    if (this.synchronizeAutomaticFloatingWindow(changedId, source)) {
      return;
    }

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

    if (
      this.synchronizeAutomaticFloatingWindow(
        settledId,
        this.observer.source(id),
      )
    ) {
      return;
    }

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

    if (
      this.synchronizeAutomaticFloatingWindow(
        suspendedId,
        this.observer.source(id),
      )
    ) {
      return;
    }

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
    this.dropCanceledCapacityParkForWindow(managedId);
    this.invalidateCapacityLeaseForWindow(managedId);
    this.capacitySupersededParkWindows.delete(managedId);
    this.pendingWindowSyncs.delete(managedId);
    this.forgetWaitingWindow(managedId);
    this.requestedSuspensions.delete(managedId);
    this.resumeSamples.delete(managedId);
    this.suspendedWindows.delete(managedId);
    this.transientResumeProbes.delete(managedId);
    this.automaticFloatingWindows.delete(managedId);
    this.floatingWindows.delete(managedId);
    this.toggleGeometryTransitions.delete(managedId);
    this.topologyColumnByWindow.delete(managedId);
    this.borderlessSettlementTokens.delete(managedId);
    this.windowAdmissionHistory.delete(managedId);
    this.windowBorderRestore.delete(managedId);
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
    if (
      !window ||
      this.windowTransferOperation ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return;
    }

    const id = windowId(String(window.internalId));

    if (
      this.automaticallyFloats(window) ||
      this.automaticFloatingWindows.has(id) ||
      (!allowSuspended &&
        (this.suspendedWindows.has(id) || !isGeometryWritable(window)))
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

  private focusDesktop(direction: DesktopTransferDirection): boolean {
    if (
      !this.started ||
      this.windowTransferOperation ||
      this.hasTopologyBarrier()
    ) {
      return false;
    }

    const output = this.workspace.activeScreen;

    if (!output || !this.workspace.screens.includes(output)) {
      return false;
    }

    const current = currentDesktopForOutput(this.workspace, output);
    const currentIndex = current
      ? this.workspace.desktops.findIndex(
          (desktop) => desktop.id === current.id,
        )
      : -1;
    const target = this.workspace.desktops[currentIndex + direction];

    if (currentIndex < 0 || !target) {
      return false;
    }

    this.switchDesktop(target, output);
    return true;
  }

  private focusHorizontal(
    destination: HorizontalDirection | HorizontalEdge,
  ): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command) {
      return false;
    }

    const targetId =
      destination === "left" || destination === "right"
        ? this.layout.adjacentWindow(command.activeId, destination)
        : this.layout.edgeWindow(command.activeId, destination);

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
      this.automaticallyFloats(target) ||
      this.automaticFloatingWindows.has(targetId) ||
      !this.toggleGeometrySettled(targetId) ||
      this.suspendedWindows.has(targetId) ||
      this.requestedSuspensions.has(targetId) ||
      !isGeometryWritable(target) ||
      !targetContext ||
      contextKey(targetContext) !== command.context.key
    ) {
      return false;
    }

    if (
      !this.applyActiveColumnMutation(
        command,
        "column focus",
        () => this.layout.activateWindow(targetId),
        () => this.layout.activateWindow(command.activeId),
      )
    ) {
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
      this.automaticallyFloats(target) ||
      this.automaticFloatingWindows.has(targetId) ||
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

  private moveActiveColumnToEdge(edge: HorizontalEdge): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasPendingCapacityState(command.context.key)) {
      return false;
    }

    const editState: { value: StackEditResult | null } = { value: null };
    const moved = this.applyActiveColumnMutation(
      command,
      "column edge move",
      () => {
        editState.value = this.layout.moveActiveColumnToEdge(
          command.activeId,
          edge,
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

    this.layout.discardStackEditRollback(edit.rollback);
    return true;
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

    this.layout.discardStackEditRollback(edit.rollback);
    this.reconcileColumnFullWidthRestore(
      command.context.key,
      command.before,
      this.layout.snapshot(command.context.outputId, command.context.desktopId),
    );
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

    const editState: { value: StackEditResult | null } = { value: null };
    const moved = this.applyActiveColumnMutation(
      command,
      "stack reorder",
      () => {
        editState.value = this.layout.moveActiveWindowInColumn(
          command.activeId,
          direction,
        );
        return editState.value !== null;
      },
      () =>
        editState.value !== null &&
        this.layout.rollbackStackEdit(editState.value.rollback),
    );
    const edit = editState.value;

    if (moved && edit) {
      this.layout.discardStackEditRollback(edit.rollback);
    }

    return moved;
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

    this.layout.discardStackEditRollback(edit.rollback);
    this.reconcileColumnFullWidthRestore(
      command.context.key,
      command.before,
      this.layout.snapshot(command.context.outputId, command.context.desktopId),
    );
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

  private moveActiveWindowToDesktop(
    direction: DesktopTransferDirection,
    wholeColumn = false,
  ): boolean {
    const active = this.prepareActiveWindowCommand();

    if (!active) {
      return false;
    }

    const owner = this.managedWindows.get(active.activeId);
    const sourceRuntimeContext = owner
      ? this.contexts.get(owner.contextKey)
      : undefined;

    if (
      !owner ||
      !sourceRuntimeContext ||
      owner.contextKey !== active.contextKey ||
      this.floatingWindows.has(active.activeId) ||
      this.waitingWindowContexts.has(active.activeId)
    ) {
      return false;
    }

    const sourceDesktopIndex = this.workspace.desktops.findIndex(
      (desktop) => desktop.id === active.context.desktopId,
    );
    const targetDesktop =
      this.workspace.desktops[sourceDesktopIndex + direction];
    const sourceDesktop = this.workspace.desktops[sourceDesktopIndex];
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === active.context.outputId,
    );

    if (
      sourceDesktopIndex < 0 ||
      !sourceDesktop ||
      !targetDesktop ||
      !output ||
      currentDesktopForOutput(this.workspace, output)?.id !== sourceDesktop.id
    ) {
      return false;
    }

    const targetContext: ManagedContext = {
      desktopId: desktopId(targetDesktop.id),
      outputId: active.context.outputId,
    };
    const targetContextKey = contextKey(targetContext);

    if (
      targetContextKey === active.contextKey ||
      this.hasPendingCapacityState(active.contextKey) ||
      this.hasPendingCapacityState(targetContextKey) ||
      this.waitingWindowIds.has(active.contextKey) ||
      this.waitingWindowIds.has(targetContextKey) ||
      this.toggleTransitionPending(active.contextKey) ||
      this.toggleTransitionPending(targetContextKey)
    ) {
      return false;
    }

    let targetContextGeometry: ContextGeometry | null;

    try {
      targetContextGeometry = this.geometry.contextGeometry(
        targetContext.outputId,
        targetContext.desktopId,
      );
    } catch {
      return false;
    }

    if (!targetContextGeometry) {
      return false;
    }

    const targetRuntimeContext = this.contexts.get(targetContextKey);

    if (
      sourceRuntimeContext.geometryFingerprint !==
        active.contextGeometry.fingerprint ||
      (targetRuntimeContext &&
        targetRuntimeContext.geometryFingerprint !==
          targetContextGeometry.fingerprint)
    ) {
      this.handleTopologyChanged(String(active.context.outputId));
      return false;
    }

    const sourceBefore = this.layout.snapshot(
      active.context.outputId,
      active.context.desktopId,
    );
    const targetBefore = this.layout.snapshot(
      targetContext.outputId,
      targetContext.desktopId,
    );
    const selection = this.prepareTransferSelection(
      active,
      sourceRuntimeContext,
      sourceBefore,
      wholeColumn,
    );

    if (!selection) {
      return false;
    }

    const targetColumnId = this.freshTransferColumnId(
      active.activeId,
      targetBefore,
      wholeColumn ? selection.sourceColumn.id : undefined,
    );
    const previewValue = wholeColumn
      ? this.layout.previewColumnTransfer(active.activeId, {
          columnId: targetColumnId,
          desktopId: targetContext.desktopId,
          outputId: targetContext.outputId,
        })
      : this.layout.previewWindowTransfer(active.activeId, {
          columnId: targetColumnId,
          desktopId: targetContext.desktopId,
          outputId: targetContext.outputId,
        });

    if (!previewValue) {
      return false;
    }

    const preview: ContextTransferPreview = wholeColumn
      ? { kind: "column", value: previewValue as ColumnTransferPreview }
      : { kind: "window", value: previewValue as WindowTransferPreview };

    let sourceLayout: ReturnType<typeof solveStripGeometry>;
    let targetLayout: ReturnType<typeof solveStripGeometry>;

    try {
      sourceLayout = this.solveContextGeometry(
        preview.value.sourceLayout,
        active.contextGeometry,
      );
      targetLayout = this.solveContextGeometry(
        preview.value.targetLayout,
        targetContextGeometry,
      );
    } catch (error) {
      this.discardContextTransferPreview(preview);
      console.warn(
        `[driftile] desktop transfer rejected window=${String(active.activeId)} error=${String(error)}`,
      );
      return false;
    }

    const command: DesktopTransferCommand = {
      ...active,
      ...selection,
      output,
      sourceDesktop,
      sourceRuntimeContext,
      targetContext,
      targetContextGeometry,
      targetContextKey,
      targetDesktop,
      targetRuntimeContext,
    };

    if (
      !this.transferLayoutIsSafe(
        sourceLayout,
        active.context,
        active.contextKey,
        selection.memberIds,
      ) ||
      !this.transferLayoutIsSafe(
        targetLayout,
        targetContext,
        targetContextKey,
        selection.memberIds,
        active.contextKey,
      )
    ) {
      this.discardContextTransferPreview(preview);
      return false;
    }

    const operation: WindowTransferOperation = {
      activeId: active.activeId,
      desktopChangeSuppressed: false,
      kind: "desktop",
      movingIds: selection.memberIds,
      sourceContextKey: active.contextKey,
      targetContextKey,
    };
    this.windowTransferOperation = operation;

    try {
      const transferred = this.applyDesktopTransfer(
        command,
        preview,
        sourceLayout,
        targetLayout,
        operation,
      );

      if (transferred) {
        this.reconcileTransferredColumnFullWidthRestore(
          active.activeId,
          active.contextKey,
          targetContextKey,
          sourceBefore,
          targetBefore,
          preview.value.sourceLayout,
          preview.value.targetLayout,
          wholeColumn,
        );
      }

      return transferred;
    } finally {
      this.discardContextTransferPreview(preview);

      if (this.windowTransferOperation === operation) {
        this.windowTransferOperation = null;
      }

      for (const key of [active.contextKey, targetContextKey]) {
        const context = this.contexts.get(key);

        if (context) {
          this.refreshContextAutomaticFloatingOwnership(context);
        }
      }

      this.refreshAutomaticFloatingAdmissionQueue();

      this.handleWindowActivated(this.workspace.activeWindow);

      if (
        [...this.dirtyContexts].some((key) => {
          const context = this.contexts.get(key);
          return Boolean(context && this.isContextVisible(context));
        }) ||
        this.pendingAdmissionContexts.size > 0 ||
        this.pendingWindowSyncs.size > 0 ||
        this.desktopLifecycle.pendingWork
      ) {
        this.scheduleWork();
      }
    }
  }

  private freshTransferColumnId(
    id: WindowId,
    target: LayoutContextSnapshot,
    preferred?: ColumnId,
  ): ColumnId {
    const used = new Set(target.columns.map((column) => column.id));
    const preferredId = preferred ?? columnId(`column:${String(id)}`);

    if (!used.has(preferredId)) {
      return preferredId;
    }

    const canonical = columnId(`column:${String(id)}`);

    if (canonical !== preferredId && !used.has(canonical)) {
      return canonical;
    }

    const base = `column:transfer:${String(id)}`;

    for (let index = 0; index <= target.columns.length; index += 1) {
      const candidate = columnId(
        index === 0 ? base : `${base}:${String(index)}`,
      );

      if (!used.has(candidate)) {
        return candidate;
      }
    }

    throw new Error("could not allocate a transfer column ID");
  }

  private commitContextTransferPreview(
    preview: ContextTransferPreview,
  ): boolean {
    return preview.kind === "column"
      ? this.layout.commitColumnTransfer(preview.value)
      : this.layout.commitWindowTransfer(preview.value);
  }

  private discardContextTransferPreview(
    preview: ContextTransferPreview,
  ): boolean {
    return preview.kind === "column"
      ? this.layout.discardColumnTransfer(preview.value)
      : this.layout.discardWindowTransfer(preview.value);
  }

  private transferLayoutIsSafe(
    layout: ReturnType<typeof solveStripGeometry>,
    context: ManagedContext,
    ownerContextKey: string,
    movingIds: ReadonlySet<WindowId>,
    movingOwnerContextKey = ownerContextKey,
    movingLiveContextKey = movingOwnerContextKey,
    allowedTransitionContextKey?: string,
  ): boolean {
    if (!this.canApplyLayout(layout.maxViewportOffset)) {
      return false;
    }

    return layout.windows.every((window) => {
      const source = this.observer.source(window.windowId);
      const owner = this.managedWindows.get(window.windowId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;
      const moving = movingIds.has(window.windowId);
      const expectedOwner = moving ? movingOwnerContextKey : ownerContextKey;
      const expectedLiveContext = moving
        ? movingLiveContextKey
        : ownerContextKey;
      const transition = this.toggleGeometryTransitions.get(window.windowId);

      return Boolean(
        source &&
        owner?.contextKey === expectedOwner &&
        liveContext &&
        contextKey(liveContext) === expectedLiveContext &&
        !this.floatingWindows.has(window.windowId) &&
        !this.waitingWindowContexts.has(window.windowId) &&
        !this.suspendedWindows.has(window.windowId) &&
        !this.requestedSuspensions.has(window.windowId) &&
        !this.automaticFloatingWindows.has(window.windowId) &&
        !this.automaticallyFloats(source) &&
        (!transition ||
          (transition.contextKey === allowedTransitionContextKey &&
            rectsEqual(transition.expectedFrame, window.frame))) &&
        isGeometryWritable(source) &&
        respectsSizeConstraints(window.frame, source) &&
        (expectedLiveContext !== contextKey(context) ||
          this.geometry.canApplyFrame(window.windowId, window.frame, context)),
      );
    });
  }

  private transferLayoutsOwnershipIsCurrent(
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
  ): boolean {
    return (
      this.transferLayoutOwnershipIsCurrent(sourceLayout) &&
      this.transferLayoutOwnershipIsCurrent(targetLayout)
    );
  }

  private transferLayoutOwnershipIsCurrent(
    layout: ReturnType<typeof solveStripGeometry>,
  ): boolean {
    for (const window of layout.windows) {
      if (!this.windowOwnershipClassificationIsCurrent(window.windowId)) {
        return false;
      }
    }

    return true;
  }

  private transferMembersActiveLast(
    command: ActiveWindowCommand & TransferSelection,
  ): readonly ColumnTransferMember[] {
    return [
      ...command.members.filter((member) => member.id !== command.activeId),
      ...command.members.filter((member) => member.id === command.activeId),
    ];
  }

  private transferOperationIdentityIsCurrent(
    command: DesktopTransferCommand | OutputTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    return (
      this.windowTransferOperation === operation &&
      this.topologyRevision === topologyRevision &&
      !this.hasTopologyBarrier() &&
      this.contexts.get(command.contextKey) === command.sourceRuntimeContext &&
      this.contexts.get(command.targetContextKey) ===
        command.targetRuntimeContext &&
      command.members.every(
        (member) =>
          operation.movingIds.has(member.id) &&
          this.observer.source(member.id) === member.window &&
          this.managedWindows.get(member.id)?.contextKey ===
            command.contextKey &&
          command.sourceRuntimeContext.windowIds.has(member.id) &&
          !member.window.deleted &&
          !this.automaticFloatingWindows.has(member.id) &&
          !this.automaticallyFloats(member.window),
      )
    );
  }

  private applyDesktopTransfer(
    command: DesktopTransferCommand,
    preview: ContextTransferPreview,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
    operation: WindowTransferOperation,
  ): boolean {
    const topologyRevision = this.topologyRevision;
    const sourceFrames = new Map(
      command.members.map((member) => [
        member.id,
        { ...member.window.frameGeometry },
      ]),
    );
    const originalActiveWindow = this.workspace.activeWindow;
    const targetWasDirty = this.dirtyContexts.has(command.targetContextKey);
    const trackedWindowIds: WindowId[] = [];
    const attemptedChanges: Array<{ frame: Rect; windowId: WindowId }> = [];
    const appliedChanges: Array<{ frame: Rect; windowId: WindowId }> = [];
    const rollbackTargets: Array<{ frame: Rect; windowId: WindowId }> = [];
    const destinationBaselines = new Map<WindowId, RestoreBaseline>();
    const mechanismFrames = new Map<WindowId, Rect>();
    let forwardWrites = 0;
    let failure: string;

    try {
      if (!this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)) {
        throw new Error("desktop transfer ownership changed");
      }

      for (const member of this.transferMembersActiveLast(command)) {
        if (
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          )
        ) {
          throw new Error("desktop transfer context changed");
        }

        try {
          member.window.desktops = [command.targetDesktop];
        } finally {
          mechanismFrames.set(member.id, { ...member.window.frameGeometry });
        }

        if (
          !windowIsOnDesktop(member.window, command.targetDesktop) ||
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
        ) {
          throw new Error("window desktop assignment was rejected");
        }
      }

      this.switchDesktop(command.targetDesktop, command.output);

      if (
        currentDesktopForOutput(this.workspace, command.output)?.id !==
          command.targetDesktop.id ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
        throw new Error("desktop switch was rejected");
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        this.workspace.activeWindow = command.activeWindow;
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        throw new Error("window focus was rejected");
      }

      if (!this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)) {
        throw new Error("desktop transfer ownership changed");
      }

      for (const member of command.members) {
        destinationBaselines.set(
          member.id,
          this.captureRestoreBaseline(
            member.window,
            command.targetContextGeometry.fingerprint,
          ),
        );
      }

      if (
        !this.desktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.desktopTransferFingerprintsMatch(command)
      ) {
        throw new Error("desktop transfer context changed");
      }

      const windowIds = targetLayout.windows.map((window) => window.windowId);
      const observedBefore = this.geometry.observedFrames(
        windowIds,
        command.targetContext,
      );

      if (
        observedBefore.size !== windowIds.length ||
        targetLayout.windows.some(
          (window) =>
            !this.geometry.canApplyFrame(
              window.windowId,
              window.frame,
              command.targetContext,
            ),
        )
      ) {
        throw new Error("destination geometry was rejected");
      }

      const changes = diffWindowGeometries(
        targetLayout.windows,
        observedBefore,
      );
      const changedWindowIds = new Set(
        changes.map((change) => change.windowId),
      );

      for (const change of changes) {
        const frame = observedBefore.get(change.windowId);

        if (!frame) {
          throw new Error("destination rollback frame is unavailable");
        }

        rollbackTargets.push({ ...change, frame });
        trackedWindowIds.push(change.windowId);
        this.toggleGeometryTransitions.set(change.windowId, {
          contextKey: command.targetContextKey,
          expectedFrame: { ...change.frame },
          settlementArmed: true,
        });
      }

      this.dirtyContexts.delete(command.targetContextKey);

      for (const change of changes) {
        if (
          !this.desktopTransferOperationIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.windowOwnershipClassificationIsCurrent(change.windowId)
        ) {
          break;
        }

        attemptedChanges.push(change);
        const applied = this.geometry.apply(
          [change],
          command.targetContext,
          (current) =>
            this.desktopTransferOperationIsCurrent(
              command,
              operation,
              topologyRevision,
            ) && this.windowOwnershipClassificationIsCurrent(current.windowId),
        );

        if (applied !== 1) {
          break;
        }

        appliedChanges.push(change);
        forwardWrites += 1;
      }

      if (
        destinationBaselines.size !== command.members.length ||
        appliedChanges.length !== changes.length ||
        !this.transferChangedFramesAreOwned(changes, rollbackTargets) ||
        !this.transferUnchangedFramesMatch(targetLayout, changedWindowIds) ||
        !this.desktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout) ||
        !this.desktopTransferFingerprintsMatch(command) ||
        !this.desktopTransferFinalStateIsSafe(
          command,
          sourceLayout,
          targetLayout,
        ) ||
        !this.commitContextTransferPreview(preview)
      ) {
        throw new Error("desktop transfer transaction was not accepted");
      }

      this.layout.setViewportOffset(
        command.targetContext.outputId,
        command.targetContext.desktopId,
        targetLayout.viewportOffset,
      );
      this.commitDesktopTransferRuntime(command, destinationBaselines);
      this.lastWrites = forwardWrites;
      const unsettled =
        trackedWindowIds.length > 0 &&
        this.toggleTransitionPending(command.targetContextKey);

      if (unsettled) {
        this.scheduleToggleTransitionProbe(command.targetContextKey);
      }

      this.markVisibleDesktopContextsDirty(command.targetContextKey);
      return true;
    } catch (error) {
      failure = String(error);
    }

    for (const id of trackedWindowIds) {
      this.toggleGeometryTransitions.delete(id);
    }

    const compensationWrites = this.rollbackDesktopTransfer(
      command,
      attemptedChanges,
      rollbackTargets,
      sourceFrames,
      destinationBaselines,
      mechanismFrames,
      originalActiveWindow,
      operation,
      topologyRevision,
      targetWasDirty,
    );
    this.lastWrites = forwardWrites + compensationWrites;

    console.warn(
      `[driftile] desktop transfer rolled back window=${String(command.activeId)} error=${failure}`,
    );

    return false;
  }

  private desktopTransferOperationIsCurrent(
    command: DesktopTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    return (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.desktopTransferMechanismAtTarget(command) &&
      this.workspace.activeWindow === command.activeWindow
    );
  }

  private desktopTransferMechanismAtTarget(
    command: DesktopTransferCommand,
  ): boolean {
    return (
      command.members.every(
        (member) =>
          this.observer.source(member.id) === member.window &&
          member.window.output?.name === command.output.name &&
          windowIsOnDesktop(member.window, command.targetDesktop),
      ) &&
      currentDesktopForOutput(this.workspace, command.output)?.id ===
        command.targetDesktop.id
    );
  }

  private desktopTransferFingerprintsMatch(
    command: DesktopTransferCommand,
  ): boolean {
    try {
      return (
        this.geometry.contextGeometry(
          command.context.outputId,
          command.context.desktopId,
        )?.fingerprint === command.contextGeometry.fingerprint &&
        this.geometry.contextGeometry(
          command.targetContext.outputId,
          command.targetContext.desktopId,
        )?.fingerprint === command.targetContextGeometry.fingerprint
      );
    } catch {
      return false;
    }
  }

  private desktopTransferFinalStateIsSafe(
    command: DesktopTransferCommand,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
  ): boolean {
    return (
      !this.hasPendingCapacityState(command.contextKey) &&
      !this.hasPendingCapacityState(command.targetContextKey) &&
      !this.waitingWindowIds.has(command.contextKey) &&
      !this.waitingWindowIds.has(command.targetContextKey) &&
      this.transferLayoutIsSafe(
        sourceLayout,
        command.context,
        command.contextKey,
        command.memberIds,
      ) &&
      this.transferLayoutIsSafe(
        targetLayout,
        command.targetContext,
        command.targetContextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.targetContextKey,
      )
    );
  }

  private switchDesktop(desktop: KWinVirtualDesktop, output: KWinOutput): void {
    if (typeof this.workspace.setCurrentDesktopForScreen === "function") {
      this.workspace.setCurrentDesktopForScreen(desktop, output);
      return;
    }

    this.workspace.currentDesktop = desktop;
  }

  private rollbackDesktopTransfer(
    command: DesktopTransferCommand,
    forwardChanges: readonly { frame: Rect; windowId: WindowId }[],
    rollbackTargets: readonly { frame: Rect; windowId: WindowId }[],
    sourceFrames: ReadonlyMap<WindowId, Rect>,
    destinationBaselines: ReadonlyMap<WindowId, RestoreBaseline>,
    mechanismFrames: ReadonlyMap<WindowId, Rect>,
    originalActiveWindow: KWinWindow | null,
    operation: WindowTransferOperation,
    topologyRevision: number,
    targetWasDirty: boolean,
  ): number {
    const appliedIds = new Set(forwardChanges.map((change) => change.windowId));
    const forwardFrames = new Map(
      forwardChanges.map((change) => [change.windowId, change.frame]),
    );
    const rollbackFrames = new Map(
      rollbackTargets.map((target) => [target.windowId, target.frame]),
    );
    const compensationTargets = rollbackTargets.filter((window) =>
      appliedIds.has(window.windowId),
    );
    let compensationWrites = 0;
    let destinationRestored = compensationTargets.length === 0;
    let sourceRestored = true;

    if (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.desktopTransferMechanismAtTarget(command) &&
      this.desktopTransferFingerprintsMatch(command)
    ) {
      destinationRestored = true;

      for (const target of compensationTargets) {
        const source = this.observer.source(target.windowId);
        const forwardFrame = forwardFrames.get(target.windowId);

        if (
          !source ||
          !forwardFrame ||
          this.automaticFloatingWindows.has(target.windowId) ||
          this.automaticallyFloats(source) ||
          (!rectsEqual(source.frameGeometry, forwardFrame) &&
            !rectsEqual(source.frameGeometry, target.frame))
        ) {
          destinationRestored = false;
          continue;
        }

        const applied = this.geometry.apply(
          [target],
          command.targetContext,
          () =>
            this.transferOperationIdentityIsCurrent(
              command,
              operation,
              topologyRevision,
            ) &&
            this.desktopTransferMechanismAtTarget(command) &&
            !this.automaticallyFloats(source),
        );

        if (applied !== 1) {
          destinationRestored = false;
          break;
        }

        compensationWrites += 1;

        this.toggleGeometryTransitions.set(target.windowId, {
          contextKey: command.targetContextKey,
          expectedFrame: { ...target.frame },
          settlementArmed: false,
        });
      }
    }

    const mechanismRestoreAllowed = this.canRestoreDesktopTransferMechanism(
      command,
      operation,
      topologyRevision,
    );

    if (mechanismRestoreAllowed) {
      this.restoreDesktopTransferMechanism(command, originalActiveWindow);
    } else {
      for (const member of command.members) {
        this.pendingWindowSyncs.add(member.id);
      }
    }

    for (const member of command.members) {
      const sourceFrame = sourceFrames.get(member.id);
      const destinationFrame = destinationBaselines.get(member.id)?.frame;
      const forwardFrame = forwardFrames.get(member.id);
      const rollbackFrame = rollbackFrames.get(member.id);
      const sourceLiveFrame = member.window.frameGeometry;
      const sourceFrameOwnedByTransaction = [
        sourceFrame,
        destinationFrame,
        mechanismFrames.get(member.id),
        forwardFrame,
        rollbackFrame,
      ].some((frame) => frame && rectsEqual(sourceLiveFrame, frame));
      const observed = normalizeWindow(member.window);
      const liveContext = observed ? managedContext(observed) : null;

      if (
        sourceFrame &&
        mechanismRestoreAllowed &&
        this.transferOperationIdentityIsCurrent(
          command,
          operation,
          topologyRevision,
        ) &&
        this.workspace.screens.includes(command.output) &&
        this.desktopTransferFingerprintsMatch(command) &&
        windowIsOnDesktop(member.window, command.sourceDesktop) &&
        currentDesktopForOutput(this.workspace, command.output)?.id ===
          command.sourceDesktop.id &&
        member.window.output?.name === command.output.name &&
        sourceFrameOwnedByTransaction &&
        this.geometry.canApplyFrame(member.id, sourceFrame, command.context)
      ) {
        const restored = this.geometry.apply(
          [{ frame: sourceFrame, windowId: member.id }],
          command.context,
        );
        compensationWrites += restored;

        if (restored === 1) {
          this.toggleGeometryTransitions.set(member.id, {
            contextKey: command.contextKey,
            expectedFrame: { ...sourceFrame },
            settlementArmed: false,
          });
        } else {
          sourceRestored = false;
        }
      } else if (
        (!sourceFrame || sourceFrameOwnedByTransaction) &&
        (!sourceFrame || !rectsEqual(member.window.frameGeometry, sourceFrame))
      ) {
        sourceRestored = false;
      }

      if (!liveContext || contextKey(liveContext) !== command.contextKey) {
        this.pendingWindowSyncs.add(member.id);
        sourceRestored = false;
      }
    }

    const sourceRuntime = this.contexts.get(command.contextKey);

    if (!sourceRestored && sourceRuntime) {
      this.markContextDirty(sourceRuntime);
    }

    if (targetWasDirty || !destinationRestored) {
      const targetRuntime = this.contexts.get(command.targetContextKey);

      if (targetRuntime) {
        this.markContextDirty(targetRuntime);
      }
    }

    this.markVisibleDesktopContextsDirty(command.contextKey);

    for (const key of [command.contextKey, command.targetContextKey]) {
      if (this.toggleTransitionPending(key)) {
        this.scheduleToggleTransitionProbe(key);
      }
    }

    return compensationWrites;
  }

  private canRestoreDesktopTransferMechanism(
    command: DesktopTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    return (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.workspace.screens.includes(command.output) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.sourceDesktop.id,
      ) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.targetDesktop.id,
      ) &&
      this.desktopTransferFingerprintsMatch(command)
    );
  }

  private restoreDesktopTransferMechanism(
    command: DesktopTransferCommand,
    originalActiveWindow: KWinWindow | null,
  ): void {
    for (const member of [...command.members].reverse()) {
      if (this.automaticallyFloats(member.window)) {
        continue;
      }

      if (windowIsOnDesktop(member.window, command.targetDesktop)) {
        try {
          member.window.desktops = [command.sourceDesktop];
        } catch (error) {
          console.warn(
            `[driftile] window desktop restore failed window=${String(member.id)} error=${String(error)}`,
          );
        }
      }
    }

    if (
      currentDesktopForOutput(this.workspace, command.output)?.id ===
      command.targetDesktop.id
    ) {
      try {
        this.switchDesktop(command.sourceDesktop, command.output);
      } catch (error) {
        console.warn(
          `[driftile] desktop restore failed output=${command.output.name} error=${String(error)}`,
        );
      }
    }

    if (
      this.workspace.activeWindow === command.activeWindow ||
      this.workspace.activeWindow === null
    ) {
      try {
        this.workspace.activeWindow = originalActiveWindow;
      } catch (error) {
        console.warn(
          `[driftile] focus restore failed window=${String(command.activeId)} error=${String(error)}`,
        );
      }
    }
  }

  private commitDesktopTransferRuntime(
    command: DesktopTransferCommand,
    destinationBaselines: ReadonlyMap<WindowId, RestoreBaseline>,
  ): void {
    const source = command.sourceRuntimeContext;

    for (const member of command.members) {
      source.windowIds.delete(member.id);
    }

    if (source.windowIds.size === 0) {
      this.contexts.delete(source.key);
      this.dirtyContexts.delete(source.key);
    } else {
      this.markContextDirty(source);
    }

    let target = command.targetRuntimeContext;

    if (!target) {
      target = {
        ...command.targetContext,
        geometryFingerprint: command.targetContextGeometry.fingerprint,
        key: command.targetContextKey,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(target.key, target);
    }

    target.geometryFingerprint = command.targetContextGeometry.fingerprint;

    for (const member of command.members) {
      const destinationBaseline = destinationBaselines.get(member.id);

      if (!destinationBaseline) {
        throw new Error("desktop transfer baseline is unavailable");
      }

      target.windowIds.add(member.id);
      this.managedWindows.set(member.id, {
        contextKey: command.targetContextKey,
        restoreBaseline: destinationBaseline,
      });
      this.forgetWaitingWindow(member.id);
    }

    this.dirtyContexts.delete(command.targetContextKey);
    this.capacityParkBackoffs.delete(command.contextKey);
    this.capacityParkBackoffs.delete(command.targetContextKey);
  }

  private moveActiveWindowToOutput(
    direction: OutputDirection,
    wholeColumn = false,
  ): boolean {
    const active = this.prepareActiveWindowCommand();

    if (!active || typeof this.workspace.sendClientToScreen !== "function") {
      return false;
    }

    const owner = this.managedWindows.get(active.activeId);
    const sourceRuntimeContext = owner
      ? this.contexts.get(owner.contextKey)
      : undefined;

    if (
      !owner ||
      !sourceRuntimeContext ||
      owner.contextKey !== active.contextKey ||
      this.floatingWindows.has(active.activeId) ||
      this.waitingWindowContexts.has(active.activeId)
    ) {
      return false;
    }

    const sourceOutput = this.workspace.screens.find(
      (candidate) => candidate.name === active.context.outputId,
    );
    const targetOutputId = sourceOutput
      ? findAdjacentOutput(
          active.context.outputId,
          this.workspace.screens.map((output) => ({
            id: outputId(output.name),
            rect: output.geometry,
          })),
          direction,
        )
      : null;
    const targetOutput = targetOutputId
      ? this.workspace.screens.find(
          (candidate) => candidate.name === targetOutputId,
        )
      : undefined;
    const sourceDesktop = sourceOutput
      ? currentDesktopForOutput(this.workspace, sourceOutput)
      : null;
    const targetDesktop = targetOutput
      ? currentDesktopForOutput(this.workspace, targetOutput)
      : null;

    if (
      !sourceOutput ||
      !targetOutput ||
      !sourceDesktop ||
      !targetDesktop ||
      sourceOutput.name === targetOutput.name ||
      sourceDesktop.id !== active.context.desktopId
    ) {
      return false;
    }

    const targetContext: ManagedContext = {
      desktopId: desktopId(targetDesktop.id),
      outputId: outputId(targetOutput.name),
    };
    const targetContextKey = contextKey(targetContext);

    if (
      targetContextKey === active.contextKey ||
      this.hasPendingCapacityState(active.contextKey) ||
      this.hasPendingCapacityState(targetContextKey) ||
      this.waitingWindowIds.has(active.contextKey) ||
      this.waitingWindowIds.has(targetContextKey) ||
      this.toggleTransitionPending(active.contextKey) ||
      this.toggleTransitionPending(targetContextKey)
    ) {
      return false;
    }

    let targetContextGeometry: ContextGeometry | null;

    try {
      targetContextGeometry = this.geometry.contextGeometry(
        targetContext.outputId,
        targetContext.desktopId,
      );
    } catch {
      return false;
    }

    if (!targetContextGeometry) {
      return false;
    }

    const targetRuntimeContext = this.contexts.get(targetContextKey);

    if (
      sourceRuntimeContext.geometryFingerprint !==
        active.contextGeometry.fingerprint ||
      (targetRuntimeContext &&
        targetRuntimeContext.geometryFingerprint !==
          targetContextGeometry.fingerprint)
    ) {
      this.handleTopologyChanged(String(targetContext.outputId));
      return false;
    }

    const sourceBefore = this.layout.snapshot(
      active.context.outputId,
      active.context.desktopId,
    );
    const targetBefore = this.layout.snapshot(
      targetContext.outputId,
      targetContext.desktopId,
    );
    const selection = this.prepareTransferSelection(
      active,
      sourceRuntimeContext,
      sourceBefore,
      wholeColumn,
    );

    if (!selection) {
      return false;
    }

    const targetColumnId = this.freshTransferColumnId(
      active.activeId,
      targetBefore,
      wholeColumn ? selection.sourceColumn.id : undefined,
    );
    const previewValue = wholeColumn
      ? this.layout.previewColumnTransfer(active.activeId, {
          columnId: targetColumnId,
          desktopId: targetContext.desktopId,
          outputId: targetContext.outputId,
        })
      : this.layout.previewWindowTransfer(active.activeId, {
          columnId: targetColumnId,
          desktopId: targetContext.desktopId,
          outputId: targetContext.outputId,
        });

    if (!previewValue) {
      return false;
    }

    const preview: ContextTransferPreview = wholeColumn
      ? { kind: "column", value: previewValue as ColumnTransferPreview }
      : { kind: "window", value: previewValue as WindowTransferPreview };

    let sourceLayout: ReturnType<typeof solveStripGeometry>;
    let targetLayout: ReturnType<typeof solveStripGeometry>;

    try {
      sourceLayout = this.solveContextGeometry(
        preview.value.sourceLayout,
        active.contextGeometry,
      );
      targetLayout = this.solveContextGeometry(
        preview.value.targetLayout,
        targetContextGeometry,
      );
    } catch (error) {
      this.discardContextTransferPreview(preview);
      console.warn(
        `[driftile] output transfer rejected window=${String(active.activeId)} error=${String(error)}`,
      );
      return false;
    }

    const command: OutputTransferCommand = {
      ...active,
      ...selection,
      sourceDesktop,
      sourceOutput,
      sourceRuntimeContext,
      targetContext,
      targetContextGeometry,
      targetContextKey,
      targetDesktop,
      targetOutput,
      targetRuntimeContext,
    };

    if (
      !this.transferLayoutIsSafe(
        sourceLayout,
        active.context,
        active.contextKey,
        selection.memberIds,
      ) ||
      !this.transferLayoutIsSafe(
        targetLayout,
        targetContext,
        targetContextKey,
        selection.memberIds,
        active.contextKey,
        active.contextKey,
      )
    ) {
      this.discardContextTransferPreview(preview);
      return false;
    }

    const operation: WindowTransferOperation = {
      activeId: active.activeId,
      desktopChangeSuppressed: false,
      kind: "output",
      movingIds: selection.memberIds,
      sourceContextKey: active.contextKey,
      targetContextKey,
    };
    this.windowTransferOperation = operation;

    try {
      const transferred = this.applyOutputTransfer(
        command,
        preview,
        sourceLayout,
        targetLayout,
        operation,
      );

      if (transferred) {
        this.reconcileTransferredColumnFullWidthRestore(
          active.activeId,
          active.contextKey,
          targetContextKey,
          sourceBefore,
          targetBefore,
          preview.value.sourceLayout,
          preview.value.targetLayout,
          wholeColumn,
        );
      }

      return transferred;
    } finally {
      this.discardContextTransferPreview(preview);

      if (this.windowTransferOperation === operation) {
        this.windowTransferOperation = null;
      }

      for (const key of [active.contextKey, targetContextKey]) {
        const context = this.contexts.get(key);

        if (context) {
          this.refreshContextAutomaticFloatingOwnership(context);
        }
      }

      this.refreshAutomaticFloatingAdmissionQueue();

      if (operation.desktopChangeSuppressed) {
        this.markVisibleDesktopContextsDirty();
      }

      this.handleWindowActivated(this.workspace.activeWindow);

      if (
        [...this.dirtyContexts].some((key) => {
          const context = this.contexts.get(key);
          return Boolean(context && this.isContextVisible(context));
        }) ||
        this.pendingAdmissionContexts.size > 0 ||
        this.pendingWindowSyncs.size > 0 ||
        this.desktopLifecycle.pendingWork
      ) {
        this.scheduleWork();
      }
    }
  }

  private applyOutputTransfer(
    command: OutputTransferCommand,
    preview: ContextTransferPreview,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
    operation: WindowTransferOperation,
  ): boolean {
    const topologyRevision = this.topologyRevision;
    const sourceFrames = new Map(
      command.members.map((member) => [
        member.id,
        { ...member.window.frameGeometry },
      ]),
    );
    const originalActiveWindow = this.workspace.activeWindow;
    const sourceWasDirty = this.dirtyContexts.has(command.contextKey);
    const targetWasDirty = this.dirtyContexts.has(command.targetContextKey);
    const trackedWindowIds = new Set<WindowId>();
    const attemptedChanges: TransferGeometryChange[] = [];
    const appliedChanges: TransferGeometryChange[] = [];
    const rollbackTargets: TransferGeometryChange[] = [];
    const destinationBaselines = new Map<WindowId, RestoreBaseline>();
    const mechanismFrames = new Map<WindowId, Rect>();
    let forwardWrites = 0;
    let failure: string;

    try {
      if (!this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)) {
        throw new Error("output transfer ownership changed");
      }

      for (const member of this.transferMembersActiveLast(command)) {
        if (
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          )
        ) {
          throw new Error("output transfer context changed");
        }

        const preserveActiveVisibility =
          member.id === command.activeId &&
          command.sourceDesktop.id !== command.targetDesktop.id;

        if (command.sourceDesktop.id !== command.targetDesktop.id) {
          try {
            member.window.desktops = preserveActiveVisibility
              ? [command.sourceDesktop, command.targetDesktop]
              : [command.targetDesktop];
          } finally {
            mechanismFrames.set(member.id, { ...member.window.frameGeometry });
          }

          if (
            (preserveActiveVisibility
              ? !windowIncludesDesktop(member.window, command.sourceDesktop) ||
                !windowIncludesDesktop(member.window, command.targetDesktop)
              : !windowIsOnDesktop(member.window, command.targetDesktop)) ||
            !this.transferOperationIdentityIsCurrent(
              command,
              operation,
              topologyRevision,
            )
          ) {
            throw new Error("window desktop assignment was rejected");
          }
        }

        try {
          this.workspace.sendClientToScreen?.(
            member.window,
            command.targetOutput,
          );
        } finally {
          mechanismFrames.set(member.id, { ...member.window.frameGeometry });
        }

        if (
          member.window.output?.name !== command.targetOutput.name ||
          (preserveActiveVisibility &&
            !windowIsOnDesktopPair(
              member.window,
              command.sourceDesktop,
              command.targetDesktop,
            )) ||
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
        ) {
          throw new Error("window output assignment was rejected");
        }

        if (preserveActiveVisibility) {
          try {
            member.window.desktops = [command.targetDesktop];
          } finally {
            mechanismFrames.set(member.id, { ...member.window.frameGeometry });
          }

          if (
            !windowIsOnDesktop(member.window, command.targetDesktop) ||
            !this.transferOperationIdentityIsCurrent(
              command,
              operation,
              topologyRevision,
            )
          ) {
            throw new Error("window desktop assignment was rejected");
          }
        }
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        this.workspace.activeWindow = command.activeWindow;
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        throw new Error("window focus was rejected");
      }

      if (!this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)) {
        throw new Error("output transfer ownership changed");
      }

      for (const member of command.members) {
        destinationBaselines.set(
          member.id,
          this.captureRestoreBaseline(
            member.window,
            command.targetContextGeometry.fingerprint,
          ),
        );
      }

      if (
        !this.outputTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.outputTransferFingerprintsMatch(command)
      ) {
        throw new Error("output transfer context changed");
      }

      const plans = [
        {
          context: command.context,
          contextKey: command.contextKey,
          layout: sourceLayout,
        },
        {
          context: command.targetContext,
          contextKey: command.targetContextKey,
          layout: targetLayout,
        },
      ] as const;
      const changes: TransferGeometryChange[] = [];

      for (const plan of plans) {
        const windowIds = plan.layout.windows.map((window) => window.windowId);
        const observedBefore = this.geometry.observedFrames(
          windowIds,
          plan.context,
        );

        if (
          observedBefore.size !== windowIds.length ||
          plan.layout.windows.some(
            (window) =>
              !this.geometry.canApplyFrame(
                window.windowId,
                window.frame,
                plan.context,
              ),
          )
        ) {
          throw new Error("transfer geometry was rejected");
        }

        for (const change of diffWindowGeometries(
          plan.layout.windows,
          observedBefore,
        )) {
          const frame = observedBefore.get(change.windowId);

          if (!frame) {
            throw new Error("transfer rollback frame is unavailable");
          }

          const forward: TransferGeometryChange = {
            ...change,
            context: plan.context,
            contextKey: plan.contextKey,
          };
          const rollback = { ...forward, frame };
          changes.push(forward);
          rollbackTargets.push(rollback);
          trackedWindowIds.add(change.windowId);
          this.toggleGeometryTransitions.set(change.windowId, {
            contextKey: plan.contextKey,
            expectedFrame: { ...change.frame },
            settlementArmed: true,
          });
        }
      }

      this.dirtyContexts.delete(command.contextKey);
      this.dirtyContexts.delete(command.targetContextKey);

      for (const change of changes) {
        if (
          !this.outputTransferOperationIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.windowOwnershipClassificationIsCurrent(change.windowId)
        ) {
          break;
        }

        attemptedChanges.push(change);
        const applied = this.geometry.apply(
          [change],
          change.context,
          (current) =>
            this.outputTransferOperationIsCurrent(
              command,
              operation,
              topologyRevision,
            ) && this.windowOwnershipClassificationIsCurrent(current.windowId),
        );

        if (applied !== 1) {
          break;
        }

        appliedChanges.push(change);
        forwardWrites += 1;
      }

      if (
        destinationBaselines.size !== command.members.length ||
        appliedChanges.length !== changes.length ||
        !this.transferChangedFramesAreOwned(changes, rollbackTargets) ||
        !this.outputTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout) ||
        !this.outputTransferFingerprintsMatch(command) ||
        !this.outputTransferFinalStateIsSafe(
          command,
          sourceLayout,
          targetLayout,
          trackedWindowIds,
        ) ||
        !this.commitContextTransferPreview(preview)
      ) {
        throw new Error("output transfer transaction was not accepted");
      }

      this.layout.setViewportOffset(
        command.context.outputId,
        command.context.desktopId,
        sourceLayout.viewportOffset,
      );
      this.layout.setViewportOffset(
        command.targetContext.outputId,
        command.targetContext.desktopId,
        targetLayout.viewportOffset,
      );
      this.commitOutputTransferRuntime(command, destinationBaselines);
      this.lastWrites = forwardWrites;

      for (const key of [command.contextKey, command.targetContextKey]) {
        if (this.toggleTransitionPending(key)) {
          this.scheduleToggleTransitionProbe(key);
        }
      }

      return true;
    } catch (error) {
      failure = String(error);
    }

    for (const id of trackedWindowIds) {
      this.toggleGeometryTransitions.delete(id);
    }

    const compensationWrites = this.rollbackOutputTransfer(
      command,
      attemptedChanges,
      rollbackTargets,
      sourceFrames,
      destinationBaselines,
      mechanismFrames,
      originalActiveWindow,
      operation,
      topologyRevision,
      sourceWasDirty,
      targetWasDirty,
    );
    this.lastWrites = forwardWrites + compensationWrites;

    console.warn(
      `[driftile] output transfer rolled back window=${String(command.activeId)} error=${failure}`,
    );
    return false;
  }

  private transferChangedFramesAreOwned(
    changes: readonly { readonly frame: Rect; readonly windowId: WindowId }[],
    rollbackTargets: readonly {
      readonly frame: Rect;
      readonly windowId: WindowId;
    }[],
  ): boolean {
    const rollbackFrames = new Map(
      rollbackTargets.map((target) => [target.windowId, target.frame]),
    );

    return changes.every((change) => {
      const source = this.observer.source(change.windowId);
      const rollbackFrame = rollbackFrames.get(change.windowId);
      return Boolean(
        source &&
        rollbackFrame &&
        (rectsEqual(source.frameGeometry, change.frame) ||
          rectsEqual(source.frameGeometry, rollbackFrame)),
      );
    });
  }

  private outputTransferOperationIsCurrent(
    command: OutputTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    return (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.outputTransferMechanismAtTarget(command) &&
      this.workspace.activeWindow === command.activeWindow
    );
  }

  private outputTransferMechanismAtTarget(
    command: OutputTransferCommand,
  ): boolean {
    return (
      command.members.every(
        (member) =>
          this.observer.source(member.id) === member.window &&
          member.window.output?.name === command.targetOutput.name &&
          windowIsOnDesktop(member.window, command.targetDesktop),
      ) &&
      currentDesktopForOutput(this.workspace, command.sourceOutput)?.id ===
        command.sourceDesktop.id &&
      currentDesktopForOutput(this.workspace, command.targetOutput)?.id ===
        command.targetDesktop.id
    );
  }

  private outputTransferFingerprintsMatch(
    command: OutputTransferCommand,
  ): boolean {
    try {
      return (
        this.geometry.contextGeometry(
          command.context.outputId,
          command.context.desktopId,
        )?.fingerprint === command.contextGeometry.fingerprint &&
        this.geometry.contextGeometry(
          command.targetContext.outputId,
          command.targetContext.desktopId,
        )?.fingerprint === command.targetContextGeometry.fingerprint
      );
    } catch {
      return false;
    }
  }

  private outputTransferFinalStateIsSafe(
    command: OutputTransferCommand,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
    changedWindowIds: ReadonlySet<WindowId>,
  ): boolean {
    return (
      !this.hasPendingCapacityState(command.contextKey) &&
      !this.hasPendingCapacityState(command.targetContextKey) &&
      !this.waitingWindowIds.has(command.contextKey) &&
      !this.waitingWindowIds.has(command.targetContextKey) &&
      this.transferUnchangedFramesMatch(sourceLayout, changedWindowIds) &&
      this.transferUnchangedFramesMatch(targetLayout, changedWindowIds) &&
      this.transferLayoutIsSafe(
        sourceLayout,
        command.context,
        command.contextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.contextKey,
      ) &&
      this.transferLayoutIsSafe(
        targetLayout,
        command.targetContext,
        command.targetContextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.targetContextKey,
      )
    );
  }

  private transferUnchangedFramesMatch(
    layout: ReturnType<typeof solveStripGeometry>,
    changedWindowIds: ReadonlySet<WindowId>,
  ): boolean {
    return layout.windows.every((window) => {
      if (changedWindowIds.has(window.windowId)) {
        return true;
      }

      const source = this.observer.source(window.windowId);
      return Boolean(source && rectsEqual(source.frameGeometry, window.frame));
    });
  }

  private rollbackOutputTransfer(
    command: OutputTransferCommand,
    forwardChanges: readonly TransferGeometryChange[],
    rollbackTargets: readonly TransferGeometryChange[],
    sourceFrames: ReadonlyMap<WindowId, Rect>,
    destinationBaselines: ReadonlyMap<WindowId, RestoreBaseline>,
    mechanismFrames: ReadonlyMap<WindowId, Rect>,
    originalActiveWindow: KWinWindow | null,
    operation: WindowTransferOperation,
    topologyRevision: number,
    sourceWasDirty: boolean,
    targetWasDirty: boolean,
  ): number {
    const attemptedIds = new Set(
      forwardChanges.map((change) => change.windowId),
    );
    const forwardFrames = new Map(
      forwardChanges.map((change) => [change.windowId, change.frame]),
    );
    const rollbackFrames = new Map(
      rollbackTargets.map((target) => [target.windowId, target.frame]),
    );
    const compensationTargets = rollbackTargets.filter((window) =>
      attemptedIds.has(window.windowId),
    );
    let compensationWrites = 0;
    let sourceRestored = true;
    let targetRestored = true;

    if (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.outputTransferMechanismAtTarget(command) &&
      this.outputTransferFingerprintsMatch(command)
    ) {
      for (const target of compensationTargets) {
        const source = this.observer.source(target.windowId);
        const forwardFrame = forwardFrames.get(target.windowId);
        let restored = false;

        if (
          source &&
          forwardFrame &&
          !this.automaticFloatingWindows.has(target.windowId) &&
          !this.automaticallyFloats(source) &&
          (rectsEqual(source.frameGeometry, forwardFrame) ||
            rectsEqual(source.frameGeometry, target.frame))
        ) {
          const applied = this.geometry.apply(
            [target],
            target.context,
            () =>
              this.transferOperationIdentityIsCurrent(
                command,
                operation,
                topologyRevision,
              ) &&
              this.outputTransferMechanismAtTarget(command) &&
              !this.automaticallyFloats(source),
          );
          compensationWrites += applied;
          restored = applied === 1;

          if (restored) {
            this.toggleGeometryTransitions.set(target.windowId, {
              contextKey: target.contextKey,
              expectedFrame: { ...target.frame },
              settlementArmed: false,
            });
          }
        }

        if (!restored) {
          if (target.contextKey === command.contextKey) {
            sourceRestored = false;
          } else {
            targetRestored = false;
          }
        }
      }
    } else if (compensationTargets.length > 0) {
      sourceRestored = !compensationTargets.some(
        (target) => target.contextKey === command.contextKey,
      );
      targetRestored = !compensationTargets.some(
        (target) => target.contextKey === command.targetContextKey,
      );
    }

    const sourceFramesOwnedBeforeMechanism = new Map(
      command.members.map((member) => {
        const ownedFrames = [
          sourceFrames.get(member.id),
          destinationBaselines.get(member.id)?.frame,
          mechanismFrames.get(member.id),
          forwardFrames.get(member.id),
          rollbackFrames.get(member.id),
        ];
        return [
          member.id,
          ownedFrames.some(
            (frame) => frame && rectsEqual(member.window.frameGeometry, frame),
          ),
        ];
      }),
    );

    const mechanismRestoreAllowed = this.canRestoreOutputTransferMechanism(
      command,
      operation,
      topologyRevision,
    );

    if (mechanismRestoreAllowed) {
      this.restoreOutputTransferMechanism(command, originalActiveWindow);
    } else {
      for (const member of command.members) {
        this.pendingWindowSyncs.add(member.id);
      }

      sourceRestored = false;
      targetRestored = false;
    }

    for (const member of command.members) {
      const sourceFrame = sourceFrames.get(member.id);
      const ownedFrames = [
        sourceFrame,
        destinationBaselines.get(member.id)?.frame,
        mechanismFrames.get(member.id),
        forwardFrames.get(member.id),
        rollbackFrames.get(member.id),
      ];
      const sourceFrameOwnedByTransaction =
        sourceFramesOwnedBeforeMechanism.get(member.id) === true ||
        ownedFrames.some(
          (frame) => frame && rectsEqual(member.window.frameGeometry, frame),
        );

      if (
        sourceFrame &&
        mechanismRestoreAllowed &&
        this.transferOperationIdentityIsCurrent(
          command,
          operation,
          topologyRevision,
        ) &&
        this.workspace.screens.includes(command.sourceOutput) &&
        this.workspace.screens.includes(command.targetOutput) &&
        this.outputTransferFingerprintsMatch(command) &&
        member.window.output?.name === command.sourceOutput.name &&
        windowIsOnDesktop(member.window, command.sourceDesktop) &&
        currentDesktopForOutput(this.workspace, command.sourceOutput)?.id ===
          command.sourceDesktop.id &&
        currentDesktopForOutput(this.workspace, command.targetOutput)?.id ===
          command.targetDesktop.id &&
        sourceFrameOwnedByTransaction &&
        this.geometry.canApplyFrame(member.id, sourceFrame, command.context)
      ) {
        const restored = this.geometry.apply(
          [{ frame: sourceFrame, windowId: member.id }],
          command.context,
        );
        compensationWrites += restored;

        if (restored === 1) {
          this.toggleGeometryTransitions.set(member.id, {
            contextKey: command.contextKey,
            expectedFrame: { ...sourceFrame },
            settlementArmed: false,
          });
        } else {
          sourceRestored = false;
        }
      } else if (
        !sourceFrame ||
        !rectsEqual(member.window.frameGeometry, sourceFrame)
      ) {
        sourceRestored = false;
      }

      const observed = normalizeWindow(member.window);
      const liveContext = observed ? managedContext(observed) : null;

      if (!liveContext || contextKey(liveContext) !== command.contextKey) {
        this.pendingWindowSyncs.add(member.id);
        sourceRestored = false;
      }
    }

    const sourceRuntime = this.contexts.get(command.contextKey);
    const targetRuntime = this.contexts.get(command.targetContextKey);

    if ((sourceWasDirty || !sourceRestored) && sourceRuntime) {
      this.markContextDirty(sourceRuntime);
    }

    if ((targetWasDirty || !targetRestored) && targetRuntime) {
      this.markContextDirty(targetRuntime);
    }

    for (const key of [command.contextKey, command.targetContextKey]) {
      if (this.toggleTransitionPending(key)) {
        this.scheduleToggleTransitionProbe(key);
      }
    }

    return compensationWrites;
  }

  private canRestoreOutputTransferMechanism(
    command: OutputTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    return (
      this.transferOperationIdentityIsCurrent(
        command,
        operation,
        topologyRevision,
      ) &&
      this.workspace.screens.includes(command.sourceOutput) &&
      this.workspace.screens.includes(command.targetOutput) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.sourceDesktop.id,
      ) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.targetDesktop.id,
      ) &&
      this.outputTransferFingerprintsMatch(command)
    );
  }

  private restoreOutputTransferMechanism(
    command: OutputTransferCommand,
    originalActiveWindow: KWinWindow | null,
  ): void {
    for (const member of [...command.members].reverse()) {
      if (this.automaticallyFloats(member.window)) {
        continue;
      }

      if (
        member.window.output?.name === command.targetOutput.name &&
        typeof this.workspace.sendClientToScreen === "function"
      ) {
        try {
          this.workspace.sendClientToScreen(
            member.window,
            command.sourceOutput,
          );
        } catch (error) {
          console.warn(
            `[driftile] window output restore failed window=${String(member.id)} error=${String(error)}`,
          );
        }
      }

      if (
        command.sourceDesktop.id !== command.targetDesktop.id &&
        (windowIsOnDesktop(member.window, command.targetDesktop) ||
          (member.id === command.activeId &&
            windowIsOnDesktopPair(
              member.window,
              command.sourceDesktop,
              command.targetDesktop,
            )))
      ) {
        try {
          member.window.desktops = [command.sourceDesktop];
        } catch (error) {
          console.warn(
            `[driftile] window desktop restore failed window=${String(member.id)} error=${String(error)}`,
          );
        }
      }
    }

    if (
      this.workspace.activeWindow === command.activeWindow ||
      this.workspace.activeWindow === null
    ) {
      try {
        this.workspace.activeWindow = originalActiveWindow;
      } catch (error) {
        console.warn(
          `[driftile] focus restore failed window=${String(command.activeId)} error=${String(error)}`,
        );
      }
    }
  }

  private commitOutputTransferRuntime(
    command: OutputTransferCommand,
    destinationBaselines: ReadonlyMap<WindowId, RestoreBaseline>,
  ): void {
    const source = command.sourceRuntimeContext;

    for (const member of command.members) {
      source.windowIds.delete(member.id);
    }

    if (source.windowIds.size === 0) {
      this.contexts.delete(source.key);
      this.dirtyContexts.delete(source.key);
    } else {
      source.geometryFingerprint = command.contextGeometry.fingerprint;
      this.dirtyContexts.delete(source.key);
    }

    let target = command.targetRuntimeContext;

    if (!target) {
      target = {
        ...command.targetContext,
        geometryFingerprint: command.targetContextGeometry.fingerprint,
        key: command.targetContextKey,
        windowIds: new Set<WindowId>(),
      };
      this.contexts.set(target.key, target);
    }

    target.geometryFingerprint = command.targetContextGeometry.fingerprint;

    for (const member of command.members) {
      const destinationBaseline = destinationBaselines.get(member.id);

      if (!destinationBaseline) {
        throw new Error("output transfer baseline is unavailable");
      }

      target.windowIds.add(member.id);
      this.managedWindows.set(member.id, {
        contextKey: command.targetContextKey,
        restoreBaseline: destinationBaseline,
      });
      this.forgetWaitingWindow(member.id);
    }

    this.dirtyContexts.delete(command.targetContextKey);
    this.capacityParkBackoffs.delete(command.contextKey);
    this.capacityParkBackoffs.delete(command.targetContextKey);
  }

  private markVisibleDesktopContextsDirty(excludedKey?: string): void {
    for (const context of this.contexts.values()) {
      if (context.key !== excludedKey && this.isContextVisible(context)) {
        this.markContextDirty(context);
      }
    }

    for (const key of this.waitingWindowIds.keys()) {
      const context = managedContextFromKey(key);

      if (key !== excludedKey && context && this.isContextVisible(context)) {
        this.pendingAdmissionContexts.add(key);
      }
    }
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

    const ownedBaseline = owner.restoreBaseline;
    const restoredFrame = ownedBaseline
      ? this.frameForRestoreBaseline(command.activeId, ownedBaseline)
      : null;
    const baselineSafe = Boolean(
      ownedBaseline?.fingerprint === command.contextGeometry.fingerprint &&
      restoredFrame &&
      this.geometry.canApplyFrame(
        command.activeId,
        restoredFrame,
        command.context,
      ),
    );
    const safeBaseline = baselineSafe
      ? (restoredFrame ?? command.activeWindow.frameGeometry)
      : command.activeWindow.frameGeometry;
    const floatingRestoreBaseline =
      baselineSafe && ownedBaseline
        ? cloneRestoreBaseline(ownedBaseline)
        : this.captureRestoreBaseline(
            command.activeWindow,
            command.contextGeometry.fingerprint,
            "client",
          );

    if (!floatingRestoreBaseline) {
      return false;
    }

    const floatingTarget: WindowGeometry = {
      columnId: preview.placement.columnId,
      frame: { ...safeBaseline },
      windowId: command.activeId,
    };
    const transitioned = this.applyWindowOwnershipTransition(
      command,
      preview.layout,
      [floatingTarget],
      command.activeId,
      () => this.layout.commitWindowDetach(preview),
      () => {
        this.reconcileColumnFullWidthRestore(
          command.contextKey,
          before,
          preview.layout,
        );
        this.managedWindows.delete(command.activeId);
        context.windowIds.delete(command.activeId);
        this.floatingWindows.set(command.activeId, {
          expectedFrame: { ...safeBaseline },
          placement: preview.placement,
          restoreBaseline: floatingRestoreBaseline,
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

    return transitioned;
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

    const preservedFloatingBaseline =
      floating.restoreBaseline.fingerprint ===
        command.contextGeometry.fingerprint &&
      rectsEqual(command.activeWindow.frameGeometry, floating.expectedFrame)
        ? cloneRestoreBaseline(floating.restoreBaseline)
        : null;
    const restoreBaseline =
      preservedFloatingBaseline ??
      this.captureRestoreBaseline(
        command.activeWindow,
        command.contextGeometry.fingerprint,
        "client",
      );
    const existingContext = this.contexts.get(command.contextKey);
    const runtimeContext: RuntimeContext = existingContext ?? {
      ...command.context,
      geometryFingerprint: command.contextGeometry.fingerprint,
      key: command.contextKey,
      windowIds: new Set<WindowId>(),
    };
    this.claimWindowBorder(command.activeId, command.activeWindow);

    const transitioned = this.applyWindowOwnershipTransition(
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
        this.reconcileColumnFullWidthRestore(
          command.contextKey,
          before,
          preview.layout,
        );

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

    return transitioned;
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

    const resized = this.applyColumnWidth(command, width, "column resize");

    if (!resized) {
      return false;
    }

    this.deleteColumnFullWidthRestore(
      command.context.key,
      command.activeColumn.id,
    );
    this.finishColumnWidthChange(command.context.key);

    return true;
  }

  private applyColumnWidth(
    command: ActiveColumnCommand,
    width: ColumnWidth,
    label: string,
  ): boolean {
    let previousWidth: ColumnWidth | null = null;

    return this.applyActiveColumnMutation(
      command,
      label,
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
  }

  private finishColumnWidthChange(contextKey: string): void {
    this.capacityParkBackoffs.delete(contextKey);

    if (
      this.capacityLeasesByContext.get(contextKey)?.size ||
      this.waitingWindowIds.get(contextKey)?.size
    ) {
      this.pendingAdmissionContexts.add(contextKey);
      this.scheduleWork();
    }
  }

  private resizeActiveWindowHeight(action: WindowHeightResizeAction): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    let currentLayout: ReturnType<typeof solveStripGeometry>;

    try {
      currentLayout = this.solveContextGeometry(
        command.before,
        command.contextGeometry,
      );
    } catch {
      return false;
    }

    const activeIndex = command.activeColumn.windowIds.indexOf(
      command.activeId,
    );

    if (activeIndex < 0) {
      return false;
    }

    const currentFrames = new Map(
      currentLayout.windows
        .filter((window) => window.columnId === command.activeColumn.id)
        .map((window) => [window.windowId, window.frame] as const),
    );

    if (currentFrames.size !== command.activeColumn.windowIds.length) {
      return false;
    }

    const currentHeights = columnWindowHeights(command.activeColumn);
    const currentActiveHeight = currentHeights[activeIndex];
    const currentActiveFrame = currentFrames.get(command.activeId);

    if (!currentActiveHeight || !currentActiveFrame) {
      return false;
    }

    let nextHeights: WindowHeight[];

    if (action === "reset") {
      if (
        currentActiveHeight.kind === "auto" &&
        currentActiveHeight.weight === 1
      ) {
        return false;
      }

      nextHeights = currentHeights.map((height) => ({ ...height }));
      nextHeights[activeIndex] = { kind: "auto", weight: 1 };
    } else {
      const metrics = this.activeWindowHeightMetrics(command, activeIndex);

      if (!metrics) {
        return false;
      }

      if (currentActiveHeight.kind === "auto") {
        const automaticHeights = this.normalizedAutomaticWindowHeights(
          command.activeColumn.windowIds,
          currentFrames,
        );

        if (!automaticHeights) {
          return false;
        }

        nextHeights = automaticHeights;
      } else {
        nextHeights = currentHeights.map((height) => ({ ...height }));
      }

      if (action === "preset-next" || action === "preset-previous") {
        const presetIndex = this.nextWindowHeightPresetIndex(
          currentActiveHeight,
          currentActiveFrame.height,
          command.contextGeometry,
          metrics.decorationHeight,
          metrics.minimumHeight,
          metrics.maximumHeight,
          action === "preset-next" ? 1 : -1,
        );

        if (presetIndex === null) {
          return false;
        }

        nextHeights[activeIndex] = { index: presetIndex, kind: "preset" };
      } else {
        const direction = action === "increase" ? 1 : -1;
        const denominator = command.contextGeometry.workArea.height - this.gap;

        if (!Number.isFinite(denominator) || denominator <= 0) {
          return false;
        }

        const requested =
          currentActiveFrame.height +
          direction * PROPORTIONAL_WINDOW_HEIGHT_STEP * denominator;
        const targetFrameHeight = clamp(
          roundToPhysicalPixel(
            requested,
            command.contextGeometry.devicePixelRatio,
          ),
          metrics.minimumHeight,
          metrics.maximumHeight,
        );
        const targetClientHeight = targetFrameHeight - metrics.decorationHeight;

        if (!Number.isFinite(targetClientHeight) || targetClientHeight <= 0) {
          return false;
        }

        const tolerance = floatingPointTolerance(
          currentActiveFrame.height,
          targetFrameHeight,
        );
        const movesInRequestedDirection =
          direction > 0
            ? targetFrameHeight > currentActiveFrame.height + tolerance
            : targetFrameHeight < currentActiveFrame.height - tolerance;

        if (
          !movesInRequestedDirection &&
          currentActiveHeight.kind === "fixed" &&
          nearlyEqual(currentActiveHeight.clientHeight, targetClientHeight)
        ) {
          return false;
        }

        nextHeights[activeIndex] = {
          clientHeight: targetClientHeight,
          kind: "fixed",
        };
      }
    }

    const rollbackState: { current?: WindowHeightEditRollback } = {};
    const applied = this.applyActiveColumnMutation(
      command,
      "window height resize",
      () => {
        const edit = this.layout.setActiveColumnWindowHeights(
          command.activeId,
          nextHeights,
        );

        if (edit) {
          rollbackState.current = edit.rollback;
        }

        return edit !== null;
      },
      () => {
        const rollback = rollbackState.current;
        return (
          rollback !== undefined &&
          this.layout.rollbackWindowHeightEdit(rollback)
        );
      },
    );
    const rollback = rollbackState.current;

    if (applied && rollback !== undefined) {
      this.layout.discardWindowHeightEditRollback(rollback);
    }

    return applied;
  }

  private activeWindowHeightMetrics(
    command: ActiveColumnCommand,
    activeIndex: number,
  ): {
    readonly decorationHeight: number;
    readonly maximumHeight: number;
    readonly minimumHeight: number;
  } | null {
    const devicePixelRatio = command.contextGeometry.devicePixelRatio;
    const usableHeight =
      command.contextGeometry.workArea.height -
      this.gap * (command.activeColumn.windowIds.length + 1);

    if (
      !Number.isFinite(devicePixelRatio) ||
      devicePixelRatio <= 0 ||
      !Number.isFinite(usableHeight) ||
      usableHeight <= 0
    ) {
      return null;
    }

    let activeDecorationHeight = 0;
    let activeMinimumHeight = 0;
    let activeMaximumHeight = Number.POSITIVE_INFINITY;
    let siblingMinimumHeight = 0;

    for (const [index, id] of command.activeColumn.windowIds.entries()) {
      const source = this.observer.source(id);

      if (!source || this.automaticallyFloats(source)) {
        return null;
      }

      const bounds = frameSizeConstraintBounds(source);
      const decorationHeight = validDecorationExtent(
        source.frameGeometry.height,
        source.clientGeometry.height,
      );

      if (!bounds || decorationHeight === null) {
        return null;
      }

      const effectiveMinimumHeight = Math.max(
        bounds.minimumHeight,
        decorationHeight + 1,
      );

      if (index === activeIndex) {
        activeDecorationHeight = decorationHeight;
        activeMinimumHeight = effectiveMinimumHeight;
        activeMaximumHeight = bounds.maximumHeight;
      } else {
        siblingMinimumHeight += ceilToPhysicalPixel(
          effectiveMinimumHeight,
          devicePixelRatio,
        );
      }
    }

    const minimumHeight = ceilToPhysicalPixel(
      activeMinimumHeight,
      devicePixelRatio,
    );
    const maximumHeight = floorToPhysicalPixel(
      Math.min(activeMaximumHeight, usableHeight - siblingMinimumHeight),
      devicePixelRatio,
    );

    if (
      !Number.isFinite(minimumHeight) ||
      !Number.isFinite(maximumHeight) ||
      maximumHeight < minimumHeight
    ) {
      return null;
    }

    return {
      decorationHeight: activeDecorationHeight,
      maximumHeight,
      minimumHeight,
    };
  }

  private normalizedAutomaticWindowHeights(
    windowIds: readonly WindowId[],
    frames: ReadonlyMap<WindowId, Rect>,
  ): WindowHeight[] | null {
    let maximumHeight = 0;

    for (const id of windowIds) {
      const height = frames.get(id)?.height ?? 0;

      if (!Number.isFinite(height) || height <= 0) {
        return null;
      }

      maximumHeight = Math.max(maximumHeight, height);
    }

    return windowIds.map((id) => ({
      kind: "auto",
      weight: (frames.get(id)?.height ?? maximumHeight) / maximumHeight,
    }));
  }

  private nextWindowHeightPresetIndex(
    current: WindowHeight,
    currentFrameHeight: number,
    contextGeometry: ContextGeometry,
    decorationHeight: number,
    minimumHeight: number,
    maximumHeight: number,
    direction: -1 | 1,
  ): number | null {
    const presets = this.windowHeightPresets;

    if (presets.length === 0) {
      return null;
    }

    if (
      current.kind === "preset" &&
      current.index >= 0 &&
      current.index < presets.length
    ) {
      const next =
        (current.index + (direction > 0 ? 1 : presets.length - 1)) %
        presets.length;
      return next === current.index ? null : next;
    }

    const resolved = presets.map((preset) => {
      const requested =
        preset.kind === "fixed"
          ? preset.value + decorationHeight
          : preset.value * (contextGeometry.workArea.height - this.gap) -
            this.gap;

      if (!Number.isFinite(requested) || requested <= 0) {
        return null;
      }

      return clamp(
        roundToPhysicalPixel(requested, contextGeometry.devicePixelRatio),
        minimumHeight,
        maximumHeight,
      );
    });
    let targetIndex = -1;

    if (direction > 0) {
      targetIndex = resolved.findIndex(
        (height) =>
          height !== null &&
          height > currentFrameHeight + WINDOW_HEIGHT_PRESET_CYCLE_TOLERANCE,
      );
      targetIndex = targetIndex < 0 ? 0 : targetIndex;
    } else {
      for (let index = resolved.length - 1; index >= 0; index -= 1) {
        const height = resolved[index];

        if (
          height !== undefined &&
          height !== null &&
          height < currentFrameHeight - WINDOW_HEIGHT_PRESET_CYCLE_TOLERANCE
        ) {
          targetIndex = index;
          break;
        }
      }

      targetIndex = targetIndex < 0 ? presets.length - 1 : targetIndex;
    }

    return resolved[targetIndex] === null ? null : targetIndex;
  }

  private resizedColumnWidth(
    command: ActiveColumnCommand,
    action: ColumnResizeAction,
  ): ColumnWidth | null {
    let minimum = MINIMUM_COLUMN_WIDTH;
    let maximum = Number.POSITIVE_INFINITY;

    for (const id of command.activeColumn.windowIds) {
      const source = this.observer.source(id);

      if (!source || this.automaticallyFloats(source)) {
        return null;
      }

      const bounds = frameSizeConstraintBounds(source);

      if (!bounds) {
        return null;
      }

      const minimumWidth = bounds.minimumWidth;
      const maximumWidth = bounds.maximumWidth;

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
    const denominator = command.contextGeometry.workArea.width - this.gap;

    if (!Number.isFinite(denominator) || denominator <= 0) {
      return null;
    }

    let candidate: ColumnWidth | null;

    switch (action) {
      case "reset":
        candidate = { ...this.width };
        break;
      case "preset-next":
        candidate = this.presetColumnWidth(command, 1);
        break;
      case "preset-previous":
        candidate = this.presetColumnWidth(command, -1);
        break;
      default: {
        const direction = action === "increase" ? 1 : -1;
        const currentProportion =
          current.kind === "proportion"
            ? current.value
            : (current.value + this.gap) / denominator;
        candidate = {
          kind: "proportion",
          value: this.steppedWidthValue(
            currentProportion,
            PROPORTIONAL_COLUMN_WIDTH_STEP,
            direction,
          ),
        };
      }
    }

    if (!candidate) {
      return null;
    }

    if (candidate.kind === "fixed") {
      candidate = {
        kind: "fixed",
        value: clamp(candidate.value, minimum, maximum),
      };
    } else {
      const minimumProportion = (minimum + this.gap) / denominator;
      const maximumProportion = (maximum + this.gap) / denominator;
      candidate = {
        kind: "proportion",
        value: clamp(candidate.value, minimumProportion, maximumProportion),
      };
    }

    const currentPixels = this.resolvedColumnWidth(current, denominator);
    const candidatePixels = this.resolvedColumnWidth(candidate, denominator);

    if (currentPixels === null || candidatePixels === null) {
      return null;
    }

    const tolerance = floatingPointTolerance(currentPixels, candidatePixels);

    if (
      (action === "increase" && candidatePixels <= currentPixels + tolerance) ||
      (action === "decrease" && candidatePixels >= currentPixels - tolerance)
    ) {
      return null;
    }

    return sameColumnWidth(current, candidate) ? null : candidate;
  }

  private steppedWidthValue(
    current: number,
    step: number,
    direction: -1 | 1,
  ): number {
    const origin = this.width.kind === "proportion" ? this.width.value : 0;
    const latticeOffset = (current - origin) / step;
    const latticeIndex = Math.round(latticeOffset);
    const latticeValue = origin + latticeIndex * step;

    if (
      Math.abs(current - latticeValue) <=
      floatingPointTolerance(current, origin, latticeValue)
    ) {
      return origin + (latticeIndex + direction) * step;
    }

    return current + direction * step;
  }

  private presetColumnWidth(
    command: ActiveColumnCommand,
    direction: -1 | 1,
  ): ColumnWidth | null {
    const presets = this.columnWidthPresets;

    if (presets.length === 0) {
      return null;
    }

    const current = command.activeColumn.width;
    const exactIndex = presets.findIndex((preset) =>
      sameColumnWidth(preset, current),
    );

    if (exactIndex >= 0) {
      const nextIndex =
        (exactIndex + (direction > 0 ? 1 : presets.length - 1)) %
        presets.length;
      const preset = presets[nextIndex];
      return preset ? { ...preset } : null;
    }

    const denominator = command.contextGeometry.workArea.width - this.gap;
    const currentPixels = this.resolvedColumnWidth(current, denominator);

    if (currentPixels === null) {
      return null;
    }

    const resolved = presets.map((preset) =>
      this.resolvedColumnWidth(preset, denominator),
    );
    const tolerance = floatingPointTolerance(
      currentPixels,
      ...resolved.filter((width): width is number => width !== null),
    );
    let targetIndex = -1;

    if (direction > 0) {
      targetIndex = resolved.findIndex(
        (width) => width !== null && width > currentPixels + tolerance,
      );
      targetIndex = targetIndex < 0 ? 0 : targetIndex;
    } else {
      for (let index = resolved.length - 1; index >= 0; index -= 1) {
        const width = resolved[index];

        if (
          width !== undefined &&
          width !== null &&
          width < currentPixels - tolerance
        ) {
          targetIndex = index;
          break;
        }
      }

      targetIndex = targetIndex < 0 ? presets.length - 1 : targetIndex;
    }

    const preset = presets[targetIndex];
    return preset ? { ...preset } : null;
  }

  private resolvedColumnWidth(
    width: ColumnWidth,
    denominator: number,
  ): number | null {
    const resolved =
      width.kind === "fixed"
        ? width.value
        : width.value * denominator - this.gap;

    return Number.isFinite(resolved) && resolved > 0 ? resolved : null;
  }

  private columnFullWidthRestoreWidth(
    contextKey: string,
    id: ColumnId,
  ): ColumnWidth | undefined {
    const width = this.columnFullWidthRestore.get(contextKey)?.get(id);
    return width ? { ...width } : undefined;
  }

  private setColumnFullWidthRestore(
    contextKey: string,
    id: ColumnId,
    width: ColumnWidth,
  ): void {
    let contextRestore = this.columnFullWidthRestore.get(contextKey);

    if (!contextRestore) {
      contextRestore = new Map<ColumnId, ColumnWidth>();
      this.columnFullWidthRestore.set(contextKey, contextRestore);
    }

    contextRestore.set(id, { ...width });
  }

  private deleteColumnFullWidthRestore(contextKey: string, id: ColumnId): void {
    const contextRestore = this.columnFullWidthRestore.get(contextKey);

    if (!contextRestore) {
      return;
    }

    contextRestore.delete(id);

    if (contextRestore.size === 0) {
      this.columnFullWidthRestore.delete(contextKey);
    }
  }

  private reconcileColumnFullWidthRestore(
    contextKey: string,
    before: LayoutContextSnapshot,
    after: LayoutContextSnapshot,
  ): void {
    const contextRestore = this.columnFullWidthRestore.get(contextKey);

    if (!contextRestore) {
      return;
    }

    const beforeIds = new Set(before.columns.map((column) => column.id));
    const afterIds = new Set(after.columns.map((column) => column.id));

    for (const id of contextRestore.keys()) {
      if (!beforeIds.has(id) || !afterIds.has(id)) {
        contextRestore.delete(id);
      }
    }

    if (contextRestore.size === 0) {
      this.columnFullWidthRestore.delete(contextKey);
    }
  }

  private reconcileTransferredColumnFullWidthRestore(
    activeId: WindowId,
    sourceContextKey: string,
    targetContextKey: string,
    sourceBefore: LayoutContextSnapshot,
    targetBefore: LayoutContextSnapshot,
    sourceAfter: LayoutContextSnapshot,
    targetAfter: LayoutContextSnapshot,
    wholeColumn = false,
  ): void {
    const sourceColumn = sourceBefore.columns.find((column) =>
      column.windowIds.includes(activeId),
    );
    const targetColumn = targetAfter.columns.find((column) =>
      column.windowIds.includes(activeId),
    );
    const restore =
      sourceColumn && (wholeColumn || sourceColumn.windowIds.length === 1)
        ? this.columnFullWidthRestoreWidth(sourceContextKey, sourceColumn.id)
        : undefined;

    this.reconcileColumnFullWidthRestore(
      sourceContextKey,
      sourceBefore,
      sourceAfter,
    );
    this.reconcileColumnFullWidthRestore(
      targetContextKey,
      targetBefore,
      targetAfter,
    );

    if (restore && targetColumn) {
      this.setColumnFullWidthRestore(
        targetContextKey,
        targetColumn.id,
        restore,
      );
    }
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
        !this.automaticallyFloats(source) &&
        !this.automaticFloatingWindows.has(id) &&
        memberContext !== null &&
        contextKey(memberContext) === context.key
      );
    });
  }

  private prepareTransferSelection(
    active: ActiveWindowCommand,
    context: RuntimeContext,
    snapshot: LayoutContextSnapshot,
    wholeColumn: boolean,
  ): TransferSelection | null {
    const sourceColumn = snapshot.columns.find((candidate) =>
      candidate.windowIds.includes(active.activeId),
    );

    if (!sourceColumn || sourceColumn.id !== snapshot.activeColumnId) {
      return null;
    }

    const selectedIds = wholeColumn
      ? sourceColumn.windowIds
      : [active.activeId];
    const members: ColumnTransferMember[] = [];

    for (const id of selectedIds) {
      const owner = this.managedWindows.get(id);
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        !source ||
        owner?.contextKey !== context.key ||
        !context.windowIds.has(id) ||
        !liveContext ||
        contextKey(liveContext) !== context.key ||
        this.floatingWindows.has(id) ||
        this.waitingWindowContexts.has(id) ||
        this.suspendedWindows.has(id) ||
        this.requestedSuspensions.has(id) ||
        this.automaticFloatingWindows.has(id) ||
        this.automaticallyFloats(source) ||
        !this.toggleGeometrySettled(id) ||
        !isGeometryWritable(source)
      ) {
        return null;
      }

      members.push({ id, window: source });
    }

    if (
      members.length === 0 ||
      members.find((member) => member.id === active.activeId)?.window !==
        active.activeWindow
    ) {
      return null;
    }

    return {
      memberIds: new Set(selectedIds),
      members,
      sourceColumn,
      wholeColumn,
    };
  }

  private prepareActiveWindowCommand(): ActiveWindowCommand | null {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !activeWindow ||
      this.automaticallyFloats(activeWindow) ||
      !this.sampleSettledVisibleContextGeometries() ||
      !this.synchronizePendingWindows() ||
      this.hasTopologyBarrier()
    ) {
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
      this.refreshContextAutomaticFloatingOwnership(runtimeContext)
    ) {
      return null;
    }

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

  private finishCanceledToggleTransition(
    key: string,
    scheduleFollowUp = true,
  ): void {
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

      if (scheduleFollowUp) {
        this.scheduleToggleTransitionProbe(key);
      }

      return;
    }

    this.toggleTransitionProbes.delete(key);

    if (
      scheduleFollowUp &&
      (this.dirtyContexts.has(key) || this.pendingAdmissionContexts.has(key))
    ) {
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

  private solveContextGeometry(
    context: LayoutContextSnapshot,
    geometry: ContextGeometry,
  ): ReturnType<typeof solveStripGeometry> {
    const input = {
      context,
      devicePixelRatio: geometry.devicePixelRatio,
      gap: this.gap,
      pixelGridOrigin: geometry.pixelGridOrigin,
      workArea: geometry.workArea,
    };

    if (!context.columns.some((column) => column.windowHeights !== undefined)) {
      return solveStripGeometry(input);
    }

    const windowHeightBounds = new Map<WindowId, WindowHeightBounds>();

    for (const column of context.columns) {
      if (!column.windowHeights) {
        continue;
      }

      for (const id of column.windowIds) {
        const source = this.observer.source(id);
        const bounds = source ? frameSizeConstraintBounds(source) : null;

        if (!source || !bounds) {
          throw new Error("window height bounds are unavailable");
        }

        const decorationHeight = validDecorationExtent(
          source.frameGeometry.height,
          source.clientGeometry.height,
        );

        if (decorationHeight === null) {
          throw new RangeError("window decoration height is invalid");
        }

        windowHeightBounds.set(id, {
          decorationHeight,
          maximumClientHeight: Number.isFinite(bounds.maximumHeight)
            ? bounds.maximumHeight - decorationHeight
            : Number.POSITIVE_INFINITY,
          minimumClientHeight: bounds.minimumHeight - decorationHeight,
        });
      }
    }

    return solveStripGeometry({
      ...input,
      windowHeightBounds,
      windowHeightPresets: this.windowHeightPresets,
    });
  }

  private visibleColumnGroup(
    command: ActiveColumnCommand,
  ): VisibleColumnGroup | null {
    let layout: ReturnType<typeof solveStripGeometry>;

    try {
      layout = this.solveContextGeometry(
        command.before,
        command.contextGeometry,
      );
    } catch {
      return null;
    }

    const frames = new Map<ColumnId, Rect>();

    for (const window of layout.windows) {
      if (!frames.has(window.columnId)) {
        frames.set(window.columnId, window.frame);
      }
    }

    const workArea = command.contextGeometry.workArea;
    const minimumLeft = workArea.x + this.gap;
    const maximumRight = workArea.x + workArea.width;
    const tolerance =
      floatingPointTolerance(minimumLeft, maximumRight, workArea.width) +
      0.5 / command.contextGeometry.devicePixelRatio;
    let activeFrame: Rect | null = null;
    let leftmostFrame: Rect | null = null;
    let nonActiveCount = 0;
    let widthTaken = 0;

    for (const column of command.before.columns) {
      const frame = frames.get(column.id);

      if (!frame) {
        return null;
      }

      if (frame.x < minimumLeft - tolerance) {
        continue;
      }

      if (frame.x + frame.width + this.gap > maximumRight + tolerance) {
        break;
      }

      leftmostFrame ??= frame;
      widthTaken += frame.width + this.gap;

      if (column.id === command.activeColumn.id) {
        activeFrame = frame;
      } else {
        nonActiveCount += 1;
      }
    }

    return activeFrame && leftmostFrame
      ? {
          activeFrame,
          layout,
          leftmostFrame,
          nonActiveCount,
          widthTaken,
        }
      : null;
  }

  private activeColumnMaximumWidth(
    command: ActiveColumnCommand,
  ): number | null {
    let maximum = Number.POSITIVE_INFINITY;

    for (const id of command.activeColumn.windowIds) {
      const source = this.observer.source(id);
      const bounds = source ? frameSizeConstraintBounds(source) : null;

      if (!source || this.automaticallyFloats(source) || !bounds) {
        return null;
      }

      maximum = Math.min(maximum, bounds.maximumWidth);
    }

    return Number.isFinite(maximum)
      ? floorToPhysicalPixel(maximum, command.contextGeometry.devicePixelRatio)
      : maximum;
  }

  private previewActiveColumnView(
    command: ActiveColumnCommand,
    width: ColumnWidth,
    viewportOffset: number,
  ): ReturnType<typeof solveStripGeometry> | null {
    const preview: LayoutContextSnapshot = {
      ...command.before,
      columns: command.before.columns.map((column) =>
        column.id === command.activeColumn.id
          ? { ...column, width: { ...width } }
          : column,
      ),
      viewportOffset,
    };

    try {
      return this.solveContextGeometry(preview, command.contextGeometry);
    } catch {
      return null;
    }
  }

  private prepareActiveColumnCommand(): ActiveColumnCommand | null {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !activeWindow ||
      this.automaticallyFloats(activeWindow)
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
      this.refreshContextAutomaticFloatingOwnership(context) ||
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
      const restored = rollback();
      this.pruneAutomaticFloatingLayoutSlots(before);

      if (!restored) {
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
      nextLayout = this.solveContextGeometry(
        this.layout.snapshot(context.outputId, context.desktopId),
        contextGeometry,
      );
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
    const ownershipChangedDuringMutation =
      this.snapshotContainsAutomaticFloatingWindow(before);

    if (restored && this.topologyWindowOrder !== null) {
      this.captureTopologyWindowOrder();
    }

    let compensationWrites = 0;
    const dirtyBeforeCompensation = this.dirtyContexts.has(context.key);

    if (restored && !this.hasTopologyBarrier()) {
      const compensationTargets = rollbackTargets.filter((window) =>
        this.windowOwnershipClassificationIsCurrent(window.windowId),
      );
      this.dirtyContexts.delete(context.key);
      compensationWrites = this.geometry.apply(
        compensationTargets,
        context,
        (change) =>
          !this.hasTopologyBarrier() &&
          this.windowOwnershipClassificationIsCurrent(change.windowId),
      );

      if (
        compensationWrites !== rollbackTargets.length ||
        (dirtyBeforeCompensation && ownershipChangedDuringMutation) ||
        wasDirty
      ) {
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

  private pruneAutomaticFloatingLayoutSlots(
    snapshot: LayoutContextSnapshot,
  ): void {
    for (const column of snapshot.columns) {
      for (const id of column.windowIds) {
        const source = this.observer.source(id);

        if (
          this.automaticFloatingWindows.has(id) ||
          (source && this.automaticallyFloats(source))
        ) {
          this.layout.unmanageWindow(id);
        }
      }
    }
  }

  private snapshotContainsAutomaticFloatingWindow(
    snapshot: LayoutContextSnapshot,
  ): boolean {
    for (const column of snapshot.columns) {
      for (const id of column.windowIds) {
        const source = this.observer.source(id);

        if (
          this.automaticFloatingWindows.has(id) ||
          (source && this.automaticallyFloats(source))
        ) {
          return true;
        }
      }
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
      nextLayout = this.solveContextGeometry(
        nextContext,
        command.contextGeometry,
      );
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
        (change) =>
          !this.hasTopologyBarrier() &&
          this.windowOwnershipClassificationIsCurrent(change.windowId),
      );
    } catch (error) {
      forwardError = String(error);
    }

    const ownershipChanged =
      this.refreshWindowTargetsAutomaticFloatingOwnership(desired);
    const desiredOwnershipCurrent = desired.every((window) =>
      this.windowOwnershipClassificationIsCurrent(window.windowId),
    );
    const forwardComplete =
      forwardError === null &&
      forwardWrites === changes.length &&
      !ownershipChanged &&
      desiredOwnershipCurrent &&
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
    const dirtyBeforeCompensation = this.dirtyContexts.has(command.contextKey);
    const floatingRollbackTargets = rollbackTargets.filter(
      (window) =>
        this.floatingWindows.has(window.windowId) &&
        this.windowOwnershipClassificationIsCurrent(window.windowId),
    );
    const compensationTargets = (
      this.hasTopologyBarrier() ? floatingRollbackTargets : rollbackTargets
    ).filter((window) =>
      this.windowOwnershipClassificationIsCurrent(window.windowId),
    );

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
        compensationTargets,
        command.context,
        (change) =>
          !this.hasTopologyBarrier() &&
          this.windowOwnershipClassificationIsCurrent(change.windowId),
      );
    } else if (floatingRollbackTargets.length > 0) {
      compensationWrites = this.geometry.apply(
        floatingRollbackTargets,
        command.context,
        (change) =>
          this.windowOwnershipClassificationIsCurrent(change.windowId),
      );
    }

    this.refreshWindowTargetsAutomaticFloatingOwnership(compensationTargets);
    const ownershipDirtyBeforeCompensation =
      dirtyBeforeCompensation && !desiredOwnershipCurrent;

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
        ownershipChanged ||
        ownershipDirtyBeforeCompensation ||
        this.dirtyContexts.has(command.contextKey) ||
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

  private desktopLifecycleCanMutate(): boolean {
    return (
      this.started &&
      !this.initializing &&
      !this.windowTransferOperation &&
      !this.hasTopologyBarrier()
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
            ...(column.windowHeights
              ? {
                  windowHeights: column.windowHeights.map((height) => ({
                    ...height,
                  })),
                }
              : {}),
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
    const ownershipChanged = this.refreshLiveWindowOwnership(
      !this.topologyRecoveryPending && this.topologyWindowOrder === null,
    );
    let topologyRecovered = false;

    if (this.topologyRecoveryPending) {
      topologyRecovered = this.synchronizeTopologyRecovery();
    }

    if (this.topologyStabilizing || this.topologyRetryPending) {
      return;
    }

    this.desktopLifecycle.reconcile(this.desktopLifecycleCanMutate());

    const admissionsPending =
      this.pendingWindowSyncs.size > 0 ||
      this.pendingAdmissionContexts.size > 0;
    const preliminaryGeometries = this.sampleSettledVisibleContextGeometries();

    if (!preliminaryGeometries) {
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
    const sampledGeometries =
      ownershipChanged ||
      admissionsPending ||
      topologyRecovered ||
      topologyBatchPending
        ? this.sampleSettledVisibleContextGeometries()
        : preliminaryGeometries;

    if (!sampledGeometries) {
      return;
    }

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

    if (this.refreshAutomaticFloatingAdmissionQueue()) {
      this.ownershipFollowUpRequired = true;
    }

    this.lastWrites = writeCount;

    if (this.ownershipFollowUpRequired) {
      this.ownershipFollowUpRequired = false;
      this.scheduleWork();
    }
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

    const pendingIds: WindowId[] = [];

    for (const id of this.pendingWindowSyncs) {
      const source = this.observer.source(id);

      if (!this.synchronizeAutomaticFloatingWindow(id, source)) {
        pendingIds.push(id);
      }
    }

    const admissionCandidates: KWinWindow[] = [];
    const preservedRestoreBaselines = new Map<
      WindowId,
      RestoreBaseline | null
    >();
    const releasedContextKeys = new Set<string>();
    this.pendingWindowSyncs.clear();

    if (pendingIds.length === 0) {
      return true;
    }

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

      if (
        !observed ||
        !context ||
        this.automaticallyFloats(source) ||
        this.automaticFloatingWindows.has(id) ||
        this.managedWindows.has(id)
      ) {
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

      if (
        !context ||
        this.automaticallyFloats(source) ||
        this.automaticFloatingWindows.has(id) ||
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

      if (
        this.floatingWindows.has(id) ||
        this.automaticFloatingWindows.has(id) ||
        this.automaticallyFloats(source)
      ) {
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
          windowHeights?: WindowHeight[];
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

      if (metadata?.column.windowHeights) {
        const sourceIndex = metadata.column.windowIds.indexOf(candidate.id);
        const height = metadata.column.windowHeights[sourceIndex];

        if (!height) {
          throw new Error("topology window height state is out of sync");
        }

        planned.column.windowHeights ??= [];
        planned.column.windowHeights.push({ ...height });
      }
    }

    let plannedColumns = [...plannedByKey.values()];

    for (const planned of plannedColumns) {
      const heights = planned.column.windowHeights;

      if (!heights) {
        continue;
      }

      if (heights.length !== planned.column.windowIds.length) {
        throw new Error("topology window height state is out of sync");
      }

      const singleton = heights.length === 1 ? heights[0] : undefined;

      if (singleton?.kind === "auto") {
        heights[0] = { kind: "auto", weight: 1 };
      }

      if (
        heights.every((height) => height.kind === "auto" && height.weight === 1)
      ) {
        delete planned.column.windowHeights;
      }
    }

    const preview = (columns: typeof plannedColumns) => {
      const placements = columns.map((planned, index) => ({
        column: planned.column,
        index: before.columns.length + index,
      }));
      const snapshot = previewColumnRestoration(before, placements);

      if (!snapshot) {
        return null;
      }

      try {
        return {
          layout: this.solveContextGeometry(snapshot, contextGeometry),
          placements,
        };
      } catch (error) {
        console.warn(
          `[driftile] topology admission geometry rejected context=${key} error=${String(error)}`,
        );
        return null;
      }
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
      this.claimWindowBorder(candidate.id, candidate.source);
      const admissionBaseline = this.restoreBaselineForAdmission(
        candidate.id,
        candidate.source,
        contextGeometry.fingerprint,
      );
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
            : admissionBaseline;

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

      if (
        this.floatingWindows.has(id) ||
        this.automaticFloatingWindows.has(id) ||
        this.automaticallyFloats(source)
      ) {
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
      const layout = this.solveContextGeometry(
        this.layout.snapshot(context.outputId, context.desktopId),
        contextGeometry,
      );
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
      this.claimWindowBorder(candidate.id, candidate.source);
      runtimeContext.windowIds.add(candidate.id);
      this.managedWindows.set(candidate.id, {
        contextKey: key,
        restoreBaseline: this.restoreBaselineForAdmission(
          candidate.id,
          candidate.source,
          contextGeometry.fingerprint,
        ),
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

    if (
      this.floatingWindows.has(id) ||
      this.automaticFloatingWindows.has(id) ||
      this.automaticallyFloats(source)
    ) {
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

    this.claimWindowBorder(id, source);
    runtimeContext.windowIds.add(id);
    this.managedWindows.set(id, {
      contextKey: key,
      restoreBaseline: this.restoreBaselineForAdmission(
        id,
        source,
        decision.fingerprint,
      ),
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

  private automaticallyFloats(source: KWinWindow): boolean {
    if (
      source.dialog ||
      source.modal ||
      source.transient ||
      Boolean(source.transientFor)
    ) {
      return true;
    }

    if (!source.normalWindow) {
      return false;
    }

    const geometryBlocked = hasGeometryAuthorityBlocker(source);

    if (!source.resizeable && !geometryBlocked) {
      return true;
    }

    const constraintState = fixedFrameSizeConstraintState(source);

    if (constraintState === MALFORMED_SIZE_CONSTRAINTS) {
      return !geometryBlocked;
    }

    return constraintState === FIXED_SIZE_CONSTRAINTS;
  }

  private refreshLiveWindowOwnership(relevantContextsOnly = false): boolean {
    if (this.ownershipRefreshInProgress) {
      return false;
    }

    this.ownershipRefreshInProgress = true;
    let changed = false;

    try {
      changed = this.refreshAutomaticFloatingAdmissions() || changed;

      for (const context of this.contexts.values()) {
        if (
          relevantContextsOnly &&
          !this.dirtyContexts.has(context.key) &&
          !this.isContextVisible(context)
        ) {
          continue;
        }

        changed =
          this.refreshContextAutomaticFloatingOwnershipUnsafe(context) ||
          changed;
      }
    } finally {
      this.ownershipRefreshInProgress = false;
    }

    return changed;
  }

  private refreshContextAutomaticFloatingOwnership(
    context: RuntimeContext,
  ): boolean {
    if (this.ownershipRefreshInProgress) {
      return false;
    }

    this.ownershipRefreshInProgress = true;

    try {
      return this.refreshContextAutomaticFloatingOwnershipUnsafe(context);
    } finally {
      this.ownershipRefreshInProgress = false;
    }
  }

  private refreshAutomaticFloatingAdmissionQueue(): boolean {
    if (this.ownershipRefreshInProgress) {
      return false;
    }

    this.ownershipRefreshInProgress = true;

    try {
      return this.refreshAutomaticFloatingAdmissions();
    } finally {
      this.ownershipRefreshInProgress = false;
    }
  }

  private refreshWindowTargetsAutomaticFloatingOwnership(
    windows: readonly { readonly windowId: WindowId }[],
  ): boolean {
    if (this.ownershipRefreshInProgress) {
      return false;
    }

    this.ownershipRefreshInProgress = true;
    let changed = false;

    try {
      for (const window of windows) {
        const source = this.observer.source(window.windowId);

        if (
          source &&
          this.automaticallyFloats(source) &&
          this.synchronizeAutomaticFloatingWindow(
            window.windowId,
            source,
            false,
          )
        ) {
          changed = true;
        }
      }
    } finally {
      this.ownershipRefreshInProgress = false;
    }

    return changed;
  }

  private refreshAutomaticFloatingAdmissions(): boolean {
    let changed = false;

    for (const id of this.automaticFloatingWindows) {
      const source = this.observer.source(id);

      if (!source) {
        this.automaticFloatingWindows.delete(id);
        changed = true;
        continue;
      }

      if (this.automaticFloatingOwnershipApplies(id, source)) {
        continue;
      }

      this.automaticFloatingWindows.delete(id);
      this.pendingWindowSyncs.add(id);
      changed = true;
    }

    return changed;
  }

  private refreshContextAutomaticFloatingOwnershipUnsafe(
    context: RuntimeContext,
  ): boolean {
    let changed = false;

    for (const id of context.windowIds) {
      const source = this.observer.source(id);

      if (
        source &&
        this.automaticallyFloats(source) &&
        this.synchronizeAutomaticFloatingWindow(id, source, false)
      ) {
        changed = true;
      }
    }

    return changed;
  }

  private windowOwnershipClassificationIsCurrent(id: WindowId): boolean {
    const source = this.observer.source(id);
    return Boolean(
      source &&
      !this.automaticFloatingWindows.has(id) &&
      !this.automaticallyFloats(source),
    );
  }

  private automaticFloatingOwnershipApplies(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    return (
      this.automaticallyFloats(source) ||
      (this.automaticFloatingWindows.has(id) &&
        hasGeometryAuthorityBlocker(source))
    );
  }

  private synchronizeAutomaticFloatingWindow(
    id: WindowId,
    source: KWinWindow | undefined,
    scheduleFollowUp = true,
  ): boolean {
    if (!source || !this.automaticFloatingOwnershipApplies(id, source)) {
      this.automaticFloatingWindows.delete(id);
      return false;
    }

    this.automaticFloatingWindows.add(id);
    const affectedContextKeys = new Set<string>();
    const floating = this.floatingWindows.get(id);
    const transition = this.toggleGeometryTransitions.get(id);

    if (floating) {
      affectedContextKeys.add(floating.sourceContextKey);
    }

    if (transition) {
      affectedContextKeys.add(transition.contextKey);
    }

    for (const operation of [...this.capacityParkOperations.values()]) {
      if (!operation.windows.some((window) => window.windowId === id)) {
        continue;
      }

      this.capacityParkOperations.delete(operation.contextKey);
      operation.probePending = false;
      this.forgetCanceledCapacityPark(operation.contextKey);
      affectedContextKeys.add(operation.contextKey);

      for (const window of operation.windows) {
        if (window.windowId !== id) {
          this.pendingWindowSyncs.add(window.windowId);
        }
      }
    }

    for (const [key, operation] of [...this.capacityCanceledParks]) {
      if (!operation.windows.some((window) => window.windowId === id)) {
        continue;
      }

      affectedContextKeys.add(key);

      for (const window of operation.windows) {
        if (window.windowId !== id) {
          this.pendingWindowSyncs.add(window.windowId);
        }
      }

      this.forgetCanceledCapacityPark(key);
    }

    const lease = this.capacityLeaseByWindow.get(id);

    if (lease) {
      affectedContextKeys.add(lease.contextKey);
      this.invalidateCapacityLease(lease);

      for (const window of lease.windows) {
        if (window.windowId !== id) {
          this.pendingWindowSyncs.add(window.windowId);
        }
      }
    }

    this.clearCapacityParkBackoffForWindow(id);
    this.capacitySupersededParkWindows.delete(id);
    this.pendingWindowSyncs.delete(id);
    this.forgetWaitingWindow(id);
    this.requestedSuspensions.delete(id);
    this.resumeSamples.delete(id);
    this.suspendedWindows.delete(id);
    this.transientResumeProbes.delete(id);
    this.floatingWindows.delete(id);
    this.toggleGeometryTransitions.delete(id);
    this.topologyColumnByWindow.delete(id);
    const releasedContextKey = this.releaseWindow(id);

    this.synchronizeWindowBorder(id, source);

    if (releasedContextKey) {
      affectedContextKeys.add(releasedContextKey);
    }

    for (const key of affectedContextKeys) {
      const context = this.contexts.get(key);

      if (context) {
        this.markContextDirty(context);
      }

      this.finishCanceledToggleTransition(key, scheduleFollowUp);
    }

    if (
      scheduleFollowUp &&
      (affectedContextKeys.size > 0 || this.pendingWindowSyncs.size > 0)
    ) {
      this.scheduleWork();
    }

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
    const after =
      ownedContext && removedColumn
        ? this.layout.snapshot(ownedContext.outputId, ownedContext.desktopId)
        : null;

    if (
      ownedContext &&
      removedColumn &&
      after &&
      !after.columns.some((column) => column.id === removedColumn.id)
    ) {
      this.deleteColumnFullWidthRestore(owner.contextKey, removedColumn.id);

      if (removedColumnIndex !== undefined) {
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

  private synchronizeWindowBorder(
    id: WindowId,
    source: KWinWindow | undefined,
  ): void {
    if (!source || !this.windowUsesBorderlessMode(source)) {
      this.restoreWindowBorder(id);
      return;
    }

    this.claimWindowBorder(id, source);
  }

  private synchronizeWindowBorders(): void {
    for (const source of this.workspace.stackingOrder) {
      this.synchronizeWindowBorder(windowId(String(source.internalId)), source);
    }
  }

  private scheduleBorderlessSettlement(id: WindowId): void {
    if (
      !this.borderlessSettlementEnabled ||
      this.borderlessSettlementTokens.has(id)
    ) {
      return;
    }

    const runGeneration = this.runGeneration;
    const token = {};
    let attempts = 0;
    this.borderlessSettlementTokens.set(id, token);

    const probe = (): void => {
      if (
        this.runGeneration !== runGeneration ||
        this.borderlessSettlementTokens.get(id) !== token
      ) {
        return;
      }

      const source = this.observer.source(id);

      if (!source || !this.windowUsesBorderlessMode(source)) {
        this.borderlessSettlementTokens.delete(id);
        return;
      }

      if (source.noBorder !== true) {
        this.claimWindowBorder(id, source);
      }

      attempts += 1;

      if (attempts >= MAX_BORDERLESS_SETTLEMENT_PROBES) {
        this.borderlessSettlementTokens.delete(id);
        return;
      }

      this.scheduleResume(probe);
    };

    this.scheduleResume(probe);
  }

  private captureRestoreBaseline(
    source: KWinWindow,
    fingerprint: string,
    kind: RestoreBaseline["kind"] = "frame",
  ): RestoreBaseline {
    return {
      clientFrame: { ...source.clientGeometry },
      fingerprint,
      frame: { ...source.frameGeometry },
      kind,
      noBorder: source.noBorder,
    };
  }

  private restoreBaselineForAdmission(
    id: WindowId,
    source: KWinWindow,
    fingerprint: string,
  ): RestoreBaseline {
    const borderRestore = this.windowBorderRestore.get(id);
    const firstAdmission = !this.windowAdmissionHistory.has(id);
    this.windowAdmissionHistory.add(id);

    if (borderRestore?.admissionBaselinePending) {
      borderRestore.admissionBaselinePending = false;
      return {
        clientFrame: { ...borderRestore.clientFrame },
        fingerprint,
        frame: { ...borderRestore.frame },
        kind: "client",
        noBorder: borderRestore.noBorder,
      };
    }

    return this.captureRestoreBaseline(
      source,
      fingerprint,
      firstAdmission ? "client" : "frame",
    );
  }

  private frameForRestoreBaseline(
    id: WindowId,
    baseline: RestoreBaseline,
  ): KWinWindow["frameGeometry"] {
    if (baseline.kind === "frame") {
      return { ...baseline.frame };
    }

    const source = this.observer.source(id);

    if (source?.noBorder === baseline.noBorder) {
      return { ...baseline.frame };
    }

    return source
      ? (frameForClientGeometry(baseline.clientFrame, source) ?? {
          ...baseline.frame,
        })
      : { ...baseline.frame };
  }

  private windowUsesBorderlessMode(source: KWinWindow): boolean {
    return (
      this.started &&
      this.borderlessWindows &&
      !source.deleted &&
      source.managed &&
      !source.desktopWindow &&
      !source.dock
    );
  }

  private claimWindowBorder(id: WindowId, source: KWinWindow): boolean {
    if (
      !this.windowUsesBorderlessMode(source) ||
      typeof source.noBorder !== "boolean" ||
      source.noBorder
    ) {
      return false;
    }

    const alreadyOwned = this.windowBorderRestore.has(id);
    const originalClientFrame = alreadyOwned
      ? null
      : { ...source.clientGeometry };
    const originalFrame = alreadyOwned ? null : { ...source.frameGeometry };
    let failure: string | undefined;

    try {
      source.noBorder = true;
    } catch (error) {
      failure =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "unknown error";
    }

    if (source.noBorder) {
      if (originalClientFrame && originalFrame) {
        this.windowBorderRestore.set(id, {
          admissionBaselinePending: !this.managedWindows.has(id),
          clientFrame: originalClientFrame,
          frame: originalFrame,
          noBorder: false,
        });
      }

      this.scheduleBorderlessSettlement(id);

      return true;
    }

    if (failure !== undefined) {
      console.warn(
        `[driftile] borderless window request failed window=${String(id)} error=${failure}`,
      );
    } else {
      console.warn(
        `[driftile] borderless window request was rejected window=${String(id)}`,
      );
    }

    this.scheduleBorderlessSettlement(id);

    return false;
  }

  private restoreWindowBorder(id: WindowId): boolean {
    const original = this.windowBorderRestore.get(id);

    if (original === undefined) {
      return false;
    }

    const source = this.observer.source(id);

    if (!source || source.deleted || source.noBorder !== true) {
      this.windowBorderRestore.delete(id);
      return false;
    }

    let failure: string | undefined;

    try {
      source.noBorder = original.noBorder;
    } catch (error) {
      failure =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "unknown error";
    }

    if (source.noBorder === original.noBorder) {
      this.windowBorderRestore.delete(id);
      return true;
    }

    if (failure !== undefined) {
      console.warn(
        `[driftile] window border restore failed window=${String(id)} error=${failure}`,
      );
    } else {
      console.warn(
        `[driftile] window border restore was rejected window=${String(id)}`,
      );
    }

    return false;
  }

  private restoreWindowBorders(): void {
    for (const id of [...this.windowBorderRestore.keys()]) {
      this.restoreWindowBorder(id);
    }
  }

  private reconcileBorderAffectedContexts(): void {
    if (this.contexts.size === 0) {
      return;
    }

    for (const context of this.contexts.values()) {
      this.markContextDirty(context);
    }

    this.scheduleWork();
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

  private dropCanceledCapacityParkForWindow(id: WindowId): void {
    for (const [key, operation] of [...this.capacityCanceledParks]) {
      if (!operation.windows.some((window) => window.windowId === id)) {
        continue;
      }

      this.forgetCanceledCapacityPark(key);

      for (const window of operation.windows) {
        if (window.windowId !== id) {
          this.pendingWindowSyncs.add(window.windowId);
        }
      }
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
    if (this.refreshContextAutomaticFloatingOwnership(context)) {
      this.ownershipFollowUpRequired = true;
      return 0;
    }

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

    const layout = this.solveContextGeometry(
      this.layout.snapshot(context.outputId, context.desktopId),
      contextGeometry,
    );
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
    const applied = this.geometry.apply(
      changes,
      context,
      (change) =>
        this.windowOwnershipClassificationIsCurrent(change.windowId) &&
        (canContinueWriting?.() ?? true),
    );
    writeCount += applied;

    const ownershipChanged =
      this.refreshContextAutomaticFloatingOwnership(context);

    if (ownershipChanged) {
      this.ownershipFollowUpRequired = true;
    }

    if (!ownershipChanged && applied === changes.length) {
      context.geometryFingerprint = contextGeometry.fingerprint;
    } else {
      const liveContext = this.contexts.get(context.key);

      if (liveContext) {
        this.markContextDirty(liveContext);
      }
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

      return this.solveContextGeometry(simulated, contextGeometry);
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
            ? this.frameForRestoreBaseline(
                window.windowId,
                window.restoreBaseline,
              )
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

    let layout: ReturnType<typeof solveStripGeometry>;

    try {
      layout = this.solveContextGeometry(preview, contextGeometry);
    } catch (error) {
      console.warn(
        `[driftile] capacity lease restoration rejected context=${key} error=${String(error)}`,
      );
      return false;
    }

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
            : this.captureRestoreBaseline(source, contextGeometry.fingerprint);
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
            ? this.frameForRestoreBaseline(
                window.windowId,
                window.restoreBaseline,
              )
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

    const layout = this.solveContextGeometry(
      this.layout.snapshot(context.outputId, context.desktopId),
      contextGeometry,
    );
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
          frame: this.frameForRestoreBaseline(id, baseline),
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
    ? {
        clientFrame: { ...baseline.clientFrame },
        fingerprint: baseline.fingerprint,
        frame: { ...baseline.frame },
        kind: baseline.kind,
        noBorder: baseline.noBorder,
      }
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

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}

function sameColumnWidth(left: ColumnWidth, right: ColumnWidth): boolean {
  return left.kind === right.kind && nearlyEqual(left.value, right.value);
}

function fixedFrameSizeConstraintState(
  window: KWinWindow,
):
  | typeof FIXED_SIZE_CONSTRAINTS
  | typeof FLEXIBLE_SIZE_CONSTRAINTS
  | typeof MALFORMED_SIZE_CONSTRAINTS {
  const frame = window.frameGeometry;
  const client = window.clientGeometry;
  const horizontalDecoration = validDecorationExtent(frame.width, client.width);
  const verticalDecoration = validDecorationExtent(frame.height, client.height);

  if (horizontalDecoration === null || verticalDecoration === null) {
    return MALFORMED_SIZE_CONSTRAINTS;
  }

  const minimumWidth = window.minSize.width;
  const minimumHeight = window.minSize.height;

  if (
    !Number.isFinite(minimumWidth) ||
    minimumWidth < 0 ||
    !Number.isFinite(minimumHeight) ||
    minimumHeight < 0 ||
    !Number.isFinite(minimumWidth + horizontalDecoration) ||
    !Number.isFinite(minimumHeight + verticalDecoration)
  ) {
    return MALFORMED_SIZE_CONSTRAINTS;
  }

  const maximumWidth = window.maxSize.width;
  const maximumHeight = window.maxSize.height;

  if (
    !Number.isFinite(maximumWidth) ||
    maximumWidth <= 0 ||
    !Number.isFinite(maximumHeight) ||
    maximumHeight <= 0 ||
    !Number.isFinite(maximumWidth + horizontalDecoration) ||
    !Number.isFinite(maximumHeight + verticalDecoration)
  ) {
    return FLEXIBLE_SIZE_CONSTRAINTS;
  }

  return nearlyEqual(
    minimumWidth + horizontalDecoration,
    maximumWidth + horizontalDecoration,
  ) &&
    nearlyEqual(
      minimumHeight + verticalDecoration,
      maximumHeight + verticalDecoration,
    )
    ? FIXED_SIZE_CONSTRAINTS
    : FLEXIBLE_SIZE_CONSTRAINTS;
}

function frameForClientGeometry(
  targetClient: KWinWindow["clientGeometry"],
  window: KWinWindow,
): KWinWindow["frameGeometry"] | null {
  const client = window.clientGeometry;
  const frame = window.frameGeometry;
  const left = validDecorationMargin(client.x - frame.x);
  const top = validDecorationMargin(client.y - frame.y);
  const right = validDecorationMargin(
    frame.x + frame.width - client.x - client.width,
  );
  const bottom = validDecorationMargin(
    frame.y + frame.height - client.y - client.height,
  );

  if (left === null || top === null || right === null || bottom === null) {
    return null;
  }

  const restored = {
    height: targetClient.height + top + bottom,
    width: targetClient.width + left + right,
    x: targetClient.x - left,
    y: targetClient.y - top,
  };

  return Object.values(restored).every(Number.isFinite) &&
    restored.height > 0 &&
    restored.width > 0
    ? restored
    : null;
}

function validDecorationMargin(value: number): number | null {
  if (!Number.isFinite(value) || value < -1e-6) {
    return null;
  }

  return value > 0 ? value : 0;
}

function validDecorationExtent(
  frameSize: number,
  clientSize: number,
): number | null {
  if (
    !Number.isFinite(frameSize) ||
    frameSize < 0 ||
    !Number.isFinite(clientSize) ||
    clientSize < 0
  ) {
    return null;
  }

  const extent = frameSize - clientSize;

  if (extent < -1e-6) {
    return null;
  }

  return extent > 0 ? extent : 0;
}

function contextKey(context: ManagedContext): string {
  return `${context.outputId}\u0000${context.desktopId}`;
}

function currentDesktopForOutput(workspace: KWinWorkspace, output: KWinOutput) {
  return typeof workspace.currentDesktopForScreen === "function"
    ? workspace.currentDesktopForScreen(output)
    : workspace.currentDesktop;
}

function windowIsOnDesktop(
  window: KWinWindow,
  desktop: KWinVirtualDesktop,
): boolean {
  return (
    !window.onAllDesktops &&
    window.desktops.length === 1 &&
    window.desktops[0]?.id === desktop.id
  );
}

function windowIncludesDesktop(
  window: KWinWindow,
  desktop: KWinVirtualDesktop,
): boolean {
  return (
    !window.onAllDesktops &&
    window.desktops.some((candidate) => candidate.id === desktop.id)
  );
}

function windowIsOnDesktopPair(
  window: KWinWindow,
  first: KWinVirtualDesktop,
  second: KWinVirtualDesktop,
): boolean {
  return (
    first.id !== second.id &&
    !window.onAllDesktops &&
    window.desktops.length === 2 &&
    windowIncludesDesktop(window, first) &&
    windowIncludesDesktop(window, second)
  );
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

function roundToPhysicalPixel(value: number, devicePixelRatio: number): number {
  const physicalValue = value * devicePixelRatio;
  const magnitude = Math.round(Math.abs(physicalValue));
  return (physicalValue < 0 ? -magnitude : magnitude) / devicePixelRatio;
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
