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
  type ColumnStackEditPreview,
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
import {
  DesktopLifecycle,
  type DesktopReorderDirection,
} from "./platform/kwin/desktop-lifecycle";
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

const DEFAULT_COLUMN_WIDTH_PERCENT = 50;
const DEFAULT_COLUMN_WIDTH_STEP_PERCENT = 10;
const DEFAULT_WINDOW_HEIGHT_STEP_PERCENT = 10;
const MAX_DEFAULT_COLUMN_WIDTH_PERCENT = 100;
const MAX_RESIZE_STEP_PERCENT = 50;
const MIN_DEFAULT_COLUMN_WIDTH_PERCENT = 10;
const MIN_RESIZE_STEP_PERCENT = 1;
const DEFAULT_COLUMN_WIDTH: ColumnWidth = {
  kind: "proportion",
  value: DEFAULT_COLUMN_WIDTH_PERCENT / 100,
};
const DEFAULT_COLUMN_WIDTH_PRESETS: readonly ColumnWidth[] = [
  { kind: "proportion", value: 1 / 3 },
  { kind: "proportion", value: 0.5 },
  { kind: "proportion", value: 2 / 3 },
];
const DEFAULT_GAP = 16;
const MAX_GAP = 64;
const MIN_GAP = 0;
const FIXED_SIZE_CONSTRAINTS = 1;
const FLEXIBLE_SIZE_CONSTRAINTS = 0;
const MALFORMED_SIZE_CONSTRAINTS = -1;
const MAX_CAPACITY_PARK_ATTEMPTS = 20;
const MAX_BORDERLESS_SETTLEMENT_PROBES = 20;
const MAX_EXTERNAL_FULLSCREEN_EXTRACTION_ATTEMPTS = 20;
const MAX_FULLSCREEN_REQUEST_PROBES = 20;
const MAX_STACK_EDIT_FOCUS_PROBES = 20;
const MAX_TOPOLOGY_SAMPLE_ATTEMPTS = 20;
const MAX_TRANSIENT_RESUME_PROBES = 20;
const MINIMUM_COLUMN_WIDTH = 64;
const REQUIRED_CAPACITY_PARK_SAMPLES = 2;
const WINDOW_HEIGHT_PRESET_CYCLE_TOLERANCE = 1;

type ColumnResizeAction =
  "decrease" | "increase" | "preset-next" | "preset-previous" | "reset";
type WindowHeightResizeAction = ColumnResizeAction;
type DesktopTransferDirection = -1 | 1;
type DesktopTransferTarget =
  | {
      readonly direction: DesktopTransferDirection;
      readonly kind: "adjacent";
    }
  | {
      readonly index: number;
      readonly kind: "index";
    };
type FloatingFocusDestination =
  HorizontalDirection | HorizontalEdge | VerticalDirection;
type StackedNativeState = "fullscreen" | "maximize";
type WindowLayer = "floating" | "tiling";

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
  memberStateInvalidated?: boolean;
  readonly kind:
    "desktop" | "floating-desktop" | "output" | "stack-native-state";
  readonly movingIds: ReadonlySet<WindowId>;
  readonly sourceContextKey: string;
  readonly stateGuardIds: ReadonlySet<WindowId>;
  readonly targetContextKey: string;
}

interface StackedNativeStateRuntimeSnapshot {
  readonly contextDirty: boolean;
  readonly fullscreenRequestProbe: FullscreenRequestProbe | null;
  readonly lastTiledFocus: WindowId | undefined;
  readonly originalActiveWindow: KWinWindow | null;
  readonly pendingAdmission: boolean;
  readonly pendingFullscreenTarget: boolean | undefined;
  readonly pendingWindowSync: boolean;
  readonly requestedSuspensions: ReadonlySet<WindowSuspensionRequest> | null;
  readonly resumeSample: ResumeSample | null;
  readonly suspended: boolean;
  readonly transientResumeProbe: TransientResumeProbe | null;
}

interface StackedNativeStatePreparation {
  readonly activeId: WindowId;
  readonly activeWindow: KWinWindow;
  readonly before: LayoutContextSnapshot;
  readonly command: ActiveColumnCommand;
  readonly external: boolean;
  readonly newColumnId: ColumnId;
  readonly runtime: StackedNativeStateRuntimeSnapshot;
  readonly sourceColumnId: ColumnId;
  readonly sourceFullWidthRestore: ColumnWidth | undefined;
  readonly state: StackedNativeState;
  readonly topologyRevision: number;
  readonly transfer: WindowTransferOperation;
}

interface StackedNativeStateOperation extends StackedNativeStatePreparation {
  readonly after: LayoutContextSnapshot;
  readonly edit: StackEditResult;
}

interface ColumnTransferMember {
  readonly id: WindowId;
  readonly minimized: boolean;
  readonly window: KWinWindow;
}

interface RetainedTransferMember extends ColumnTransferMember {
  readonly frame: Rect;
}

interface TransferSelection {
  readonly geometryPassiveIds: ReadonlySet<WindowId>;
  readonly memberIds: ReadonlySet<WindowId>;
  readonly members: readonly ColumnTransferMember[];
  readonly retainedSourceIds: ReadonlySet<WindowId>;
  readonly retainedSourceMembers: readonly RetainedTransferMember[];
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

interface FloatingDesktopTransferCommand {
  readonly activeId: WindowId;
  readonly activeWindow: KWinWindow;
  readonly classification:
    | { readonly floating: FloatingWindow; readonly kind: "manual" }
    | { readonly kind: "automatic" };
  readonly frame: Rect;
  readonly output: KWinOutput;
  readonly sourceContext: ManagedContext;
  readonly sourceContextKey: string;
  readonly sourceDesktop: KWinVirtualDesktop;
  readonly sourceLayout: LayoutContextSnapshot;
  readonly targetContext: ManagedContext;
  readonly targetContextKey: string;
  readonly targetDesktop: KWinVirtualDesktop;
  readonly targetLayout: LayoutContextSnapshot;
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

interface StackTransferAcceptance {
  readonly accept: (expectedActive: KWinWindow) => boolean;
  readonly activeWindow: KWinWindow;
  readonly participants: readonly StackTransferParticipant[];
}

interface StackTransferParticipant {
  readonly id: WindowId;
  readonly minimized: boolean;
  readonly stateRevision: number;
  readonly window: KWinWindow;
}

interface PendingExpelFocusHandoff {
  attempts: number;
  readonly acceptance: StackTransferAcceptance;
  readonly command: ActiveColumnCommand;
  continuationPending: boolean;
  readonly generation: number;
  probePending: boolean;
  requestInProgress: boolean;
  readonly targetId: WindowId;
  readonly targetWindow: KWinWindow;
  readonly token: object;
  readonly topologyRevision: number;
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

interface FullscreenRequestProbe {
  completedAttempts: number;
  pending: boolean;
  readonly target: boolean;
}

interface UnconfirmedFullscreenRetention {
  readonly generation: number;
  readonly source: KWinWindow;
}

interface PendingExternalFullscreenExtraction {
  attempts: number;
  readonly generation: number;
  readonly source: KWinWindow;
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
  private columnWidthStep = DEFAULT_COLUMN_WIDTH_STEP_PERCENT / 100;
  private readonly columnWidthPresets: readonly ColumnWidth[];
  private readonly contexts = new Map<string, RuntimeContext>();
  private readonly createRect: KWinRectFactory;
  private readonly dirtyContexts = new Set<string>();
  private readonly desktopLifecycle: DesktopLifecycle;
  private pendingExpelFocusHandoff: PendingExpelFocusHandoff | null = null;
  private stackEditOperation: object | null = null;
  private windowTransferOperation: WindowTransferOperation | null = null;
  private stackedNativeStateOperation: StackedNativeStateOperation | null =
    null;
  private readonly pendingExternalFullscreenExtractions = new Map<
    WindowId,
    PendingExternalFullscreenExtraction
  >();
  private readonly floatingWindows = new Map<WindowId, FloatingWindow>();
  private readonly fullscreenRequestProbes = new Map<
    WindowId,
    FullscreenRequestProbe
  >();
  private readonly geometry: KWinGeometryAdapter;
  private gap: number;
  private initializing = false;
  private readonly lastFloatingFocus = new Map<string, WindowId>();
  private readonly lastTiledFocus = new Map<string, WindowId>();
  private ownershipFollowUpRequired = false;
  private ownershipRefreshInProgress = false;
  private readonly knownOutputInstances = new Map<string, number>();
  private lastOutputCount = 0;
  private lastWrites = 0;
  private layout = new LayoutEngine();
  private readonly managedWindows = new Map<WindowId, ManagedWindow>();
  private readonly pendingFullscreenTargets = new Map<WindowId, boolean>();
  private readonly observer: WindowObserver;
  private readonly pendingAdmissionContexts = new Set<string>();
  private pendingDefaultColumnWidth: ColumnWidth | null = null;
  private pendingGap: number | null = null;
  private readonly pendingWindowSyncs = new Set<WindowId>();
  private readonly resumeSamples = new Map<WindowId, ResumeSample>();
  private readonly schedule: (callback: () => void) => void;
  private readonly scheduleResume: (callback: () => void) => void;
  private runGeneration = 0;
  private readonly startupStabilizationProbes: number;
  private startupStabilizationRemaining = 0;
  private startupStabilizationToken: object | null = null;
  private started = false;
  private defaultColumnWidth: ColumnWidth;
  private windowHeightStep = DEFAULT_WINDOW_HEIGHT_STEP_PERCENT / 100;
  private readonly windowHeightPresets: readonly ColumnWidth[];
  private readonly requestedSuspensions = new Map<
    WindowId,
    Set<WindowSuspensionRequest>
  >();
  private readonly suspendedWindows = new Set<WindowId>();
  private readonly unconfirmedFullscreenRetentions = new Map<
    WindowId,
    UnconfirmedFullscreenRetention
  >();
  private readonly unconfirmedFullscreenTargets = new Map<WindowId, boolean>();
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
  private readonly windowStateRevisions = new Map<WindowId, number>();
  private workScheduled = false;
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, options: RuntimeControllerOptions) {
    this.borderlessSettlementEnabled = options.scheduleResume !== undefined;
    this.borderlessWindows = options.borderlessWindows ?? false;
    this.gap = normalizeGap(options.gap ?? DEFAULT_GAP) ?? DEFAULT_GAP;
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
    this.defaultColumnWidth = {
      ...(options.columnWidth ?? DEFAULT_COLUMN_WIDTH),
    };
    this.columnWidthPresets = (
      options.columnWidthPresets ?? DEFAULT_COLUMN_WIDTH_PRESETS
    ).map((width) => ({ ...width }));
    this.windowHeightPresets = (
      options.windowHeightPresets ?? DEFAULT_WINDOW_HEIGHT_PRESETS
    ).map((height) => ({ ...height }));
    this.createRect =
      options.createRect ??
      ((x, y, width, height) => ({ height, width, x, y }));
    this.workspace = workspace;
    this.desktopLifecycle = new DesktopLifecycle(workspace, {
      changed: () => {
        this.scheduleWork();
      },
    });
    this.observer = new WindowObserver(workspace, {
      added: this.handleWindowAdded,
      changed: this.handleWindowChanged,
      fullScreenChanged: this.handleFullScreenChanged,
      maximizedAboutToChange: this.handleMaximizedAboutToChange,
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
      this.createRect,
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

  setDefaultColumnWidthPercent(value: number): boolean {
    const percent = normalizeDefaultColumnWidthPercent(value);

    if (percent === null) {
      return false;
    }

    const width: ColumnWidth = {
      kind: "proportion",
      value: percent / 100,
    };

    if (
      sameColumnWidth(
        this.pendingDefaultColumnWidth ?? this.defaultColumnWidth,
        width,
      )
    ) {
      return false;
    }

    if (sameColumnWidth(this.defaultColumnWidth, width)) {
      this.pendingDefaultColumnWidth = null;
      return true;
    }

    if (!this.started) {
      this.defaultColumnWidth = width;
      return true;
    }

    this.pendingDefaultColumnWidth = width;
    this.scheduleDeferredRuntimeWork();
    return true;
  }

  setColumnWidthStepPercent(value: number): boolean {
    const percent = normalizeResizeStepPercent(value);

    if (percent === null) {
      return false;
    }

    const step = percent / 100;

    if (step === this.columnWidthStep) {
      return false;
    }

    this.columnWidthStep = step;
    return true;
  }

  setWindowHeightStepPercent(value: number): boolean {
    const percent = normalizeResizeStepPercent(value);

    if (percent === null) {
      return false;
    }

    const step = percent / 100;

    if (step === this.windowHeightStep) {
      return false;
    }

    this.windowHeightStep = step;
    return true;
  }

  setGap(value: number): boolean {
    const gap = normalizeGap(value);

    if (gap === null || gap === (this.pendingGap ?? this.gap)) {
      return false;
    }

    if (gap === this.gap) {
      this.pendingGap = null;
      return true;
    }

    if (!this.started) {
      this.gap = gap;
      return true;
    }

    this.pendingGap = gap;
    this.scheduleDeferredRuntimeWork();
    return true;
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
    return this.focusDesktopTarget({ direction: -1, kind: "adjacent" });
  }

  focusNextDesktop(): boolean {
    return this.focusDesktopTarget({ direction: 1, kind: "adjacent" });
  }

  focusDesktop(index: number): boolean {
    if (!validDesktopIndex(index)) {
      return false;
    }

    return this.focusDesktopTarget({ index, kind: "index" });
  }

  moveDesktopDown(): boolean {
    return this.moveSelectedDesktop(1);
  }

  moveDesktopUp(): boolean {
    return this.moveSelectedDesktop(-1);
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

  consumeWindowIntoColumn(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasStructuralCapacityState(command.context.key)) {
      return false;
    }

    const activeIndex = command.before.columns.findIndex(
      (column) => column.id === command.activeColumn.id,
    );
    const source = command.before.columns[activeIndex + 1];
    const movedWindowId = source?.windowIds[0];

    if (activeIndex < 0 || !source || !movedWindowId) {
      return false;
    }

    const acceptance = this.prepareStackTransferAcceptance(
      [command.activeColumn, source],
      command.context,
      command.activeId,
      command.activeId,
      movedWindowId,
    );

    if (!acceptance) {
      return false;
    }

    const preview = this.layout.previewConsumeWindowIntoColumn(
      command.activeId,
    );

    if (!preview) {
      return false;
    }

    if (preview.movedWindowId !== movedWindowId) {
      this.layout.discardColumnStackEdit(preview);
      return false;
    }

    const consumed = this.applyColumnStackEdit(
      command,
      preview,
      command.activeId,
      undefined,
      acceptance.accept,
    );

    if (!consumed) {
      this.recoverRejectedStackEditExternalFocus(
        command.context,
        acceptance.activeWindow,
      );
    }

    return consumed;
  }

  expelWindowFromColumn(): boolean {
    const command = this.prepareActiveColumnCommand();

    if (
      !command ||
      command.activeColumn.windowIds.length < 2 ||
      this.hasStructuralCapacityState(command.context.key)
    ) {
      return false;
    }

    const movedWindowId =
      command.activeColumn.windowIds[command.activeColumn.windowIds.length - 1];

    if (!movedWindowId) {
      return false;
    }

    const remainingWindowId =
      movedWindowId === command.activeId
        ? command.activeColumn.windowIds[
            command.activeColumn.windowIds.length - 2
          ]
        : command.activeId;

    if (!remainingWindowId) {
      return false;
    }

    const acceptance = this.prepareStackTransferAcceptance(
      [command.activeColumn],
      command.context,
      command.activeId,
      movedWindowId,
      remainingWindowId,
    );

    if (!acceptance) {
      return false;
    }

    if (movedWindowId === command.activeId) {
      return this.beginExpelFocusHandoff(
        command,
        remainingWindowId,
        acceptance,
      );
    }

    const newColumnId = this.availableColumnId(
      command.before,
      movedWindowId,
      "expel",
    );
    const preview = this.layout.previewExpelWindowFromColumn(
      command.activeId,
      newColumnId,
    );

    if (!preview) {
      return false;
    }

    if (preview.movedWindowId !== movedWindowId) {
      this.layout.discardColumnStackEdit(preview);
      return false;
    }

    const expelled = this.applyColumnStackEdit(
      command,
      preview,
      remainingWindowId,
      newColumnId,
      acceptance.accept,
    );

    if (!expelled) {
      this.recoverRejectedStackEditExternalFocus(
        command.context,
        acceptance.activeWindow,
      );
    }

    return expelled;
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

  switchFocusBetweenFloatingAndTiling(): boolean {
    return this.focusWindowLayer();
  }

  focusFloating(): boolean {
    return this.focusWindowLayer("floating");
  }

  focusTiling(): boolean {
    return this.focusWindowLayer("tiling");
  }

  toggleFullscreen(): boolean {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      this.stackEditOperation ||
      !activeWindow ||
      activeWindow.deleted ||
      !activeWindow.managed
    ) {
      return false;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (this.pendingFullscreenTargets.has(activeId)) {
      return false;
    }

    const fullScreen = !activeWindow.fullScreen;

    if (fullScreen && activeWindow.fullScreenable === false) {
      return false;
    }

    if (fullScreen) {
      const owner = this.managedWindows.get(activeId);

      if (owner) {
        const context = this.contexts.get(owner.contextKey);
        const activeColumn = context
          ? this.layout
              .snapshot(context.outputId, context.desktopId)
              .columns.find((column) => column.windowIds.includes(activeId))
          : undefined;

        if (!context || !activeColumn) {
          return false;
        }

        if (activeColumn.windowIds.length > 1) {
          return this.fullscreenStackedActiveWindow(activeWindow);
        }
      }
    }

    return this.requestFullscreenState(activeId, activeWindow, fullScreen);
  }

  maximizeWindowToEdges(): boolean {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      this.stackEditOperation ||
      !activeWindow ||
      activeWindow.deleted ||
      !activeWindow.managed ||
      !activeWindow.setMaximize
    ) {
      return false;
    }

    const maximized = activeWindow.maximizeMode === 3;

    if (!maximized && activeWindow.maximizable === false) {
      return false;
    }

    if (!maximized) {
      const activeId = windowId(String(activeWindow.internalId));
      const owner = this.managedWindows.get(activeId);

      if (owner) {
        const context = this.contexts.get(owner.contextKey);
        const activeColumn = context
          ? this.layout
              .snapshot(context.outputId, context.desktopId)
              .columns.find((column) => column.windowIds.includes(activeId))
          : undefined;

        if (!context || !activeColumn) {
          return false;
        }

        if (activeColumn.windowIds.length > 1) {
          return this.maximizeStackedActiveWindow(activeWindow);
        }
      }
    }

    try {
      activeWindow.setMaximize(!maximized, !maximized);
    } catch {
      return false;
    }

    return true;
  }

  moveWindowToPreviousDesktop(): boolean {
    return this.moveActiveWindowToDesktop({
      direction: -1,
      kind: "adjacent",
    });
  }

  moveWindowToNextDesktop(): boolean {
    return this.moveActiveWindowToDesktop({ direction: 1, kind: "adjacent" });
  }

  moveColumnToPreviousDesktop(): boolean {
    return this.moveActiveWindowToDesktop(
      { direction: -1, kind: "adjacent" },
      true,
    );
  }

  moveColumnToNextDesktop(): boolean {
    return this.moveActiveWindowToDesktop(
      { direction: 1, kind: "adjacent" },
      true,
    );
  }

  moveColumnToDesktop(index: number): boolean {
    if (!validDesktopIndex(index)) {
      return false;
    }

    return this.moveActiveWindowToDesktop({ index, kind: "index" }, true);
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
    if (!this.started) {
      return;
    }

    const runGeneration = this.runGeneration;
    this.settleUnconfirmedFullscreenTargets();

    if (
      this.runGeneration !== runGeneration ||
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
    this.observer.probeVisibleConstraintChanges();
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
    this.pendingExpelFocusHandoff = null;
    this.stackEditOperation = null;

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
      this.pendingExpelFocusHandoff = null;
      this.stackEditOperation = null;
      this.windowTransferOperation = null;
      this.stackedNativeStateOperation = null;
      this.pendingExternalFullscreenExtractions.clear();
      this.fullscreenRequestProbes.clear();
      this.pendingFullscreenTargets.clear();
      this.unconfirmedFullscreenRetentions.clear();
      this.unconfirmedFullscreenTargets.clear();
      this.dirtyContexts.clear();
      this.automaticFloatingWindows.clear();
      this.borderlessSettlementTokens.clear();
      this.floatingWindows.clear();
      this.lastFloatingFocus.clear();
      this.lastTiledFocus.clear();
      this.managedWindows.clear();
      this.pendingAdmissionContexts.clear();
      this.pendingDefaultColumnWidth = null;
      this.pendingGap = null;
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
      this.windowStateRevisions.clear();
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
      this.stackEditOperation ||
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
      try {
        writeCount += this.reconcileContext(context, sampledGeometries);
      } catch (error) {
        this.dirtyContexts.add(context.key);
        console.warn(
          `[driftile] context reconcile deferred context=${context.key} error=${String(error)}`,
        );
      }
    }

    if (this.refreshAutomaticFloatingAdmissionQueue()) {
      this.ownershipFollowUpRequired = true;
    }

    this.lastWrites = writeCount;
    this.retryPendingExternalFullscreenExtractions();

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

    const pendingHandoff = this.pendingExpelFocusHandoff;

    if (pendingHandoff) {
      this.cancelPendingExpelFocusHandoff(pendingHandoff, false);
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
      this.stackEditOperation ||
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

    if (source) {
      this.settleFullscreenRequest(changedId, source.fullScreen);
      this.retainsFullscreenRequestGeometry(source);
    }

    this.synchronizeWindowBorder(changedId, source);
    this.refreshRememberedLayerFocus(changedId, source);
    this.cancelInvalidPendingExpelFocusHandoff();

    if (this.windowTransferOperation) {
      const retainedGuardChanged =
        this.windowTransferOperation.stateGuardIds.has(changedId) &&
        !this.windowTransferOperation.movingIds.has(changedId);

      if (retainedGuardChanged) {
        this.windowTransferOperation.memberStateInvalidated = true;
      }

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
    this.windowStateRevisions.set(
      changedId,
      (this.windowStateRevisions.get(changedId) ?? 0) + 1,
    );

    if (source) {
      this.settleFullscreenRequest(changedId, source.fullScreen);
      this.retainsFullscreenRequestGeometry(source);
    }

    this.synchronizeWindowBorder(changedId, source);
    this.refreshRememberedLayerFocus(changedId, source);
    this.cancelInvalidPendingExpelFocusHandoff();

    if (this.windowTransferOperation) {
      const guardedContextTransferMember =
        (this.windowTransferOperation.kind === "desktop" ||
          this.windowTransferOperation.kind === "output") &&
        this.windowTransferOperation.stateGuardIds.has(changedId);

      if (guardedContextTransferMember) {
        this.windowTransferOperation.memberStateInvalidated = true;
      }

      if (
        guardedContextTransferMember ||
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
    this.cancelInvalidPendingExpelFocusHandoff();
    this.pendingWindowSyncs.add(suspendedId);
    this.scheduleWork();
  };

  private readonly handleFullScreenChanged = (
    id: string,
    fullScreen: boolean,
  ): void => {
    const activeId = windowId(id);
    const source = this.observer.source(id);

    if (!fullScreen) {
      this.pendingExternalFullscreenExtractions.delete(activeId);
    }

    this.settleFullscreenRequest(activeId, fullScreen, true);

    if (!source) {
      this.cancelInvalidPendingExpelFocusHandoff();
      return;
    }

    this.cancelInvalidPendingExpelFocusHandoff();

    const automaticFloating =
      this.automaticFloatingWindows.has(activeId) ||
      this.automaticallyFloats(source);

    if (!automaticFloating) {
      if (fullScreen) {
        this.suspendGeometryLease(activeId);
      }

      this.pendingWindowSyncs.add(activeId);
    }

    if (!fullScreen) {
      return;
    }

    if (automaticFloating) {
      this.pendingExternalFullscreenExtractions.delete(activeId);
      return;
    }

    if (this.queueExternalFullscreenExtraction(activeId, source)) {
      this.tryPendingExternalFullscreenExtraction(activeId);
    }
  };

  private readonly handleMaximizedAboutToChange = (
    id: string,
    mode: number,
  ): void => {
    if (mode !== 3) {
      return;
    }

    const activeId = windowId(id);
    const operation = this.stackedNativeStateOperation;

    if (operation) {
      return;
    }

    const source = this.observer.source(id);

    if (
      !source ||
      String(this.workspace.activeWindow?.internalId) !== String(activeId)
    ) {
      return;
    }

    try {
      this.extractStackedWindowForExternalMaximize(source);
    } catch (error) {
      console.warn(
        `[driftile] external stacked maximize interception failed window=${String(activeId)} error=${String(error)}`,
      );
    }
  };

  private readonly handleWindowRemoved = (id: string): void => {
    const managedId = windowId(id);
    this.cancelInvalidPendingExpelFocusHandoff();
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
    this.pendingExternalFullscreenExtractions.delete(managedId);
    this.fullscreenRequestProbes.delete(managedId);
    this.pendingFullscreenTargets.delete(managedId);
    this.deleteUnconfirmedFullscreenTarget(managedId);
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
    this.windowStateRevisions.delete(managedId);
    this.forgetRememberedLayerFocus(managedId);
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
    const pendingHandoff = this.pendingExpelFocusHandoff;

    if (pendingHandoff) {
      if (
        window !== null &&
        window !== pendingHandoff.acceptance.activeWindow &&
        window !== pendingHandoff.targetWindow
      ) {
        this.cancelPendingExpelFocusHandoff(pendingHandoff, false);
      } else if (
        window === pendingHandoff.targetWindow &&
        !pendingHandoff.requestInProgress
      ) {
        this.schedulePendingExpelFocusHandoff(pendingHandoff);
      }
    }

    if (!window) {
      return;
    }

    const id = windowId(String(window.internalId));

    if (
      window.fullScreen &&
      this.queueExternalFullscreenExtraction(id, window)
    ) {
      this.tryPendingExternalFullscreenExtraction(id);
    }

    if (
      this.windowTransferOperation ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return;
    }

    const activeLayer = this.rememberLayerFocus(id, window);

    if (
      activeLayer !== "tiling" ||
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

  private focusWindowLayer(requestedLayer?: WindowLayer): boolean {
    const active = this.workspace.activeWindow;

    if (
      !this.started ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !active
    ) {
      return false;
    }

    const activeId = windowId(String(active.internalId));
    const context = layerFocusContext(active);

    if (!context) {
      return false;
    }

    const key = contextKey(context);
    const activeLayer = this.focusAvailableWindowLayer(activeId, active, key);

    if (!activeLayer) {
      return false;
    }

    if (activeLayer === "floating") {
      this.lastFloatingFocus.set(key, activeId);
    } else {
      this.lastTiledFocus.set(key, activeId);
    }

    const targetLayer =
      requestedLayer ?? (activeLayer === "floating" ? "tiling" : "floating");

    if (targetLayer === activeLayer) {
      return false;
    }

    const rememberedTiledFocus = this.lastTiledFocus.get(key);
    const floating = this.floatingFocusTarget(key);
    const tiled = this.tiledFocusTarget(context, key);

    if (!floating || !tiled) {
      return false;
    }

    const target = targetLayer === "floating" ? floating : tiled;
    const targetId = windowId(String(target.internalId));

    if (
      target === active ||
      this.focusAvailableWindowLayer(targetId, target, key) !== targetLayer
    ) {
      return false;
    }

    this.lastWrites = 0;

    if (
      targetLayer === "tiling" &&
      !this.focusTiledLayerTarget(
        targetId,
        target,
        context,
        key,
        active,
        rememberedTiledFocus,
      )
    ) {
      return false;
    }

    if (targetLayer === "tiling") {
      this.rememberLayerFocus(targetId, target);
      return true;
    }

    return this.focusFloatingTarget(targetId, target, key, active);
  }

  private focusTiledLayerTarget(
    targetId: WindowId,
    target: KWinWindow,
    context: ManagedContext,
    key: string,
    originalActive: KWinWindow,
    rememberedTiledFocus: WindowId | undefined,
  ): boolean {
    const rememberedFloatingFocus = this.lastFloatingFocus.get(key);
    const snapshot = this.layout.snapshot(context.outputId, context.desktopId);
    const targetColumn = snapshot.columns.find((column) =>
      column.windowIds.includes(targetId),
    );

    if (!targetColumn) {
      return false;
    }

    if (targetColumn.id === snapshot.activeColumnId) {
      let focusRequestFailed = false;

      try {
        this.workspace.activeWindow = target;
      } catch {
        focusRequestFailed = true;
      }

      if (
        !focusRequestFailed &&
        !this.hasTopologyBarrier() &&
        this.workspace.activeWindow === target &&
        this.observer.source(targetId) === target &&
        this.focusAvailableWindowLayer(targetId, target, key) === "tiling"
      ) {
        return true;
      }

      this.recoverRejectedFocus(
        originalActive,
        key,
        rememberedFloatingFocus,
        rememberedTiledFocus,
      );

      return false;
    }

    const command = this.prepareTiledLayerFocusCommand(context, key, targetId);

    if (
      !command ||
      this.workspace.activeWindow !== originalActive ||
      this.observer.source(targetId) !== target ||
      this.focusAvailableWindowLayer(targetId, target, key) !== "tiling"
    ) {
      return false;
    }

    let focusRequestFailed = false;
    const focused = this.applyActiveColumnMutation(
      command,
      "layer column focus",
      () => this.layout.activateWindow(targetId),
      () => this.layout.activateWindow(command.activeId),
      () => {
        if (
          this.workspace.activeWindow !== originalActive ||
          this.hasTopologyBarrier() ||
          this.observer.source(targetId) !== target ||
          this.focusAvailableWindowLayer(targetId, target, key) !== "tiling"
        ) {
          return false;
        }

        try {
          this.workspace.activeWindow = target;
        } catch {
          focusRequestFailed = true;
        }

        return (
          !focusRequestFailed &&
          !this.hasTopologyBarrier() &&
          this.workspace.activeWindow === target &&
          this.observer.source(targetId) === target &&
          this.focusAvailableWindowLayer(targetId, target, key) === "tiling"
        );
      },
    );

    if (focused) {
      return true;
    }

    this.recoverRejectedFocus(
      originalActive,
      key,
      rememberedFloatingFocus,
      rememberedTiledFocus,
    );

    return false;
  }

  private prepareTiledLayerFocusCommand(
    context: ManagedContext,
    key: string,
    targetId: WindowId,
  ): ActiveColumnCommand | null {
    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries || !this.synchronizePendingWindows()) {
      return null;
    }

    if (this.hasTopologyBarrier()) {
      return null;
    }

    const runtimeContext = this.contexts.get(key);

    if (
      !runtimeContext ||
      runtimeContext.outputId !== context.outputId ||
      runtimeContext.desktopId !== context.desktopId ||
      this.refreshContextAutomaticFloatingOwnership(runtimeContext) ||
      this.toggleTransitionPending(key)
    ) {
      return null;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumn = before.columns.find(
      (column) => column.id === before.activeColumnId,
    );
    const targetColumn = before.columns.find((column) =>
      column.windowIds.includes(targetId),
    );
    const rollbackId = activeColumn?.windowIds[0];
    const contextGeometry = sampledGeometries.get(key);

    if (
      !activeColumn ||
      !targetColumn ||
      targetColumn.id === activeColumn.id ||
      !rollbackId ||
      !contextGeometry ||
      !this.columnMembersBelongToContext(activeColumn, runtimeContext) ||
      !this.columnMembersBelongToContext(targetColumn, runtimeContext)
    ) {
      return null;
    }

    return {
      activeColumn,
      activeId: rollbackId,
      before,
      context: runtimeContext,
      contextGeometry,
      sampledGeometries,
    };
  }

  private floatingFocusTarget(key: string): KWinWindow | null {
    const rememberedId = this.lastFloatingFocus.get(key);

    if (rememberedId) {
      const remembered = this.observer.source(rememberedId);

      if (
        remembered &&
        this.windowLayer(rememberedId, remembered, key) === "floating"
      ) {
        return remembered;
      }
    }

    for (
      let index = this.workspace.stackingOrder.length - 1;
      index >= 0;
      index -= 1
    ) {
      const candidate = this.workspace.stackingOrder[index];

      if (!candidate) {
        continue;
      }

      const id = windowId(String(candidate.internalId));

      if (this.windowLayer(id, candidate, key) === "floating") {
        return candidate;
      }
    }

    return null;
  }

  private tiledFocusTarget(
    context: ManagedContext,
    key: string,
  ): KWinWindow | null {
    const runtimeContext = this.contexts.get(key);

    if (!runtimeContext) {
      return null;
    }

    const snapshot = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumnIndex = snapshot.columns.findIndex(
      (column) => column.id === snapshot.activeColumnId,
    );
    const activeColumn = snapshot.columns[activeColumnIndex];

    if (!activeColumn) {
      return null;
    }

    const rememberedId = this.lastTiledFocus.get(key);

    if (rememberedId && activeColumn.windowIds.includes(rememberedId)) {
      const remembered = this.observer.source(rememberedId);

      if (
        remembered &&
        this.windowLayer(rememberedId, remembered, key) === "tiling"
      ) {
        return this.tiledLayerCandidate(rememberedId, key);
      }
    }

    const activeCandidateId = this.firstNonMinimizedColumnMember(activeColumn);

    if (activeCandidateId) {
      return this.tiledLayerCandidate(activeCandidateId, key);
    }

    for (let distance = 1; distance < snapshot.columns.length; distance += 1) {
      const right = snapshot.columns[activeColumnIndex + distance];

      if (right) {
        const rightCandidateId = this.firstNonMinimizedColumnMember(right);

        if (rightCandidateId) {
          return this.tiledLayerCandidate(rightCandidateId, key);
        }
      }

      const left = snapshot.columns[activeColumnIndex - distance];

      if (left) {
        const leftCandidateId = this.firstNonMinimizedColumnMember(left);

        if (leftCandidateId) {
          return this.tiledLayerCandidate(leftCandidateId, key);
        }
      }
    }

    return null;
  }

  private tiledLayerCandidate(id: WindowId, key: string): KWinWindow | null {
    const candidate = this.observer.source(id);

    if (
      !candidate ||
      this.focusAvailableWindowLayer(id, candidate, key) !== "tiling"
    ) {
      return null;
    }

    return candidate;
  }

  private focusAvailableWindowLayer(
    id: WindowId,
    source: KWinWindow,
    key: string,
  ): WindowLayer | null {
    if (this.observer.source(id) !== source) {
      return null;
    }

    const layer = this.windowLayer(id, source, key);

    if (
      !layer ||
      !this.toggleGeometrySettled(id) ||
      this.suspendedWindows.has(id) ||
      this.requestedSuspensions.has(id)
    ) {
      return null;
    }

    if (
      layer === "floating" &&
      this.automaticFloatingOwnershipApplies(id, source)
    ) {
      return hasGeometryAuthorityBlocker(source) ? null : layer;
    }

    return isGeometryWritable(source) ? layer : null;
  }

  private focusFloatingTarget(
    targetId: WindowId,
    target: KWinWindow,
    key: string,
    originalActive: KWinWindow,
  ): boolean {
    const rememberedFloatingFocus = this.lastFloatingFocus.get(key);
    const rememberedTiledFocus = this.lastTiledFocus.get(key);

    if (this.requestWindowFocus(targetId, target, key, "floating")) {
      this.rememberLayerFocus(targetId, target);
      return true;
    }

    this.recoverRejectedFocus(
      originalActive,
      key,
      rememberedFloatingFocus,
      rememberedTiledFocus,
    );
    return false;
  }

  private requestWindowFocus(
    targetId: WindowId,
    target: KWinWindow,
    key: string,
    layer: WindowLayer,
  ): boolean {
    let focusRequestFailed = false;

    try {
      this.workspace.activeWindow = target;
    } catch {
      focusRequestFailed = true;
    }

    return (
      !focusRequestFailed &&
      this.started &&
      !this.windowTransferOperation &&
      this.startupStabilizationToken === null &&
      !this.hasTopologyBarrier() &&
      this.workspace.activeWindow === target &&
      this.observer.source(targetId) === target &&
      this.focusAvailableWindowLayer(targetId, target, key) === layer
    );
  }

  private recoverRejectedFocus(
    originalActive: KWinWindow,
    key: string,
    rememberedFloatingFocus: WindowId | undefined,
    rememberedTiledFocus: WindowId | undefined,
  ): void {
    const originalId = windowId(String(originalActive.internalId));

    if (
      this.workspace.activeWindow !== originalActive &&
      this.observer.source(originalId) === originalActive &&
      this.focusAvailableWindowLayer(originalId, originalActive, key)
    ) {
      try {
        this.workspace.activeWindow = originalActive;
      } catch {
        // KWin focus recovery is best effort after a rejected focus request.
      }
    }

    this.restoreRememberedLayerFocus(
      key,
      rememberedFloatingFocus,
      rememberedTiledFocus,
    );
  }

  private restoreRememberedLayerFocus(
    key: string,
    floatingId: WindowId | undefined,
    tiledId: WindowId | undefined,
  ): void {
    const floating = floatingId ? this.observer.source(floatingId) : undefined;

    if (
      floatingId &&
      floating &&
      this.windowLayer(floatingId, floating, key) === "floating"
    ) {
      this.lastFloatingFocus.set(key, floatingId);
    } else {
      this.lastFloatingFocus.delete(key);
    }

    const tiled = tiledId ? this.observer.source(tiledId) : undefined;

    if (
      tiledId &&
      tiled &&
      this.windowLayer(tiledId, tiled, key) === "tiling"
    ) {
      this.lastTiledFocus.set(key, tiledId);
    } else {
      this.lastTiledFocus.delete(key);
    }
  }

  private windowLayer(
    id: WindowId,
    source: KWinWindow,
    key: string,
  ): WindowLayer | null {
    const context = layerFocusContext(source);

    if (!context || contextKey(context) !== key || source.minimized) {
      return null;
    }

    if (
      this.floatingWindows.has(id) ||
      this.automaticFloatingOwnershipApplies(id, source)
    ) {
      return "floating";
    }

    const owner = this.managedWindows.get(id);
    const runtimeContext = this.contexts.get(key);

    if (
      owner?.contextKey !== key ||
      !runtimeContext?.windowIds.has(id) ||
      this.floatingWindows.has(id) ||
      this.automaticFloatingWindows.has(id) ||
      this.automaticallyFloats(source)
    ) {
      return null;
    }

    return "tiling";
  }

  private rememberLayerFocus(
    id: WindowId,
    source: KWinWindow,
  ): WindowLayer | null {
    const context = layerFocusContext(source);

    if (!context) {
      return null;
    }

    const key = contextKey(context);
    const layer = this.windowLayer(id, source, key);

    if (layer === "floating") {
      this.lastFloatingFocus.set(key, id);
    } else if (layer === "tiling") {
      this.lastTiledFocus.set(key, id);
    }

    return layer;
  }

  private refreshRememberedLayerFocus(
    id: WindowId,
    source: KWinWindow | undefined,
  ): void {
    for (const [key, rememberedId] of this.lastFloatingFocus) {
      if (
        rememberedId === id &&
        (!source || this.windowLayer(id, source, key) !== "floating")
      ) {
        this.lastFloatingFocus.delete(key);
      }
    }

    for (const [key, rememberedId] of this.lastTiledFocus) {
      if (
        rememberedId === id &&
        (!source || this.windowLayer(id, source, key) !== "tiling")
      ) {
        this.lastTiledFocus.delete(key);
      }
    }

    if (
      source &&
      String(this.workspace.activeWindow?.internalId) === String(id)
    ) {
      this.rememberLayerFocus(id, source);
    }
  }

  private forgetRememberedLayerFocus(id: WindowId): void {
    for (const [key, rememberedId] of this.lastFloatingFocus) {
      if (rememberedId === id) {
        this.lastFloatingFocus.delete(key);
      }
    }

    for (const [key, rememberedId] of this.lastTiledFocus) {
      if (rememberedId === id) {
        this.lastTiledFocus.delete(key);
      }
    }
  }

  private focusDesktopTarget(target: DesktopTransferTarget): boolean {
    if (
      !this.started ||
      this.stackEditOperation ||
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
    const targetIndex = this.desktopTargetIndex(currentIndex, target);
    const targetDesktop = this.workspace.desktops[targetIndex];

    if (
      currentIndex < 0 ||
      !targetDesktop ||
      targetDesktop.id === current?.id
    ) {
      return false;
    }

    this.switchDesktop(targetDesktop, output);
    return true;
  }

  private moveSelectedDesktop(direction: DesktopReorderDirection): boolean {
    if (
      !this.desktopLifecycleCanMutate() ||
      this.stackEditOperation ||
      this.stackedNativeStateOperation ||
      this.startupStabilizationToken !== null
    ) {
      return false;
    }

    const output = this.workspace.activeScreen;

    if (!output || !this.workspace.screens.includes(output)) {
      return false;
    }

    this.lastWrites = 0;
    return this.desktopLifecycle.moveSelectedDesktop(output, direction);
  }

  private desktopTargetIndex(
    currentIndex: number,
    target: DesktopTransferTarget,
  ): number {
    if (currentIndex < 0) {
      return -1;
    }

    if (target.kind === "adjacent") {
      return currentIndex + target.direction;
    }

    if (!validDesktopIndex(target.index)) {
      return -1;
    }

    return Math.min(target.index - 1, this.workspace.desktops.length - 1);
  }

  private focusFloatingWindow(
    destination: FloatingFocusDestination,
  ): boolean | null {
    const active = this.workspace.activeWindow;

    if (!active) {
      return null;
    }

    const activeId = windowId(String(active.internalId));
    const context = layerFocusContext(active);

    if (!context || this.observer.source(activeId) !== active) {
      return null;
    }

    const key = contextKey(context);
    const activeLayer = this.windowLayer(activeId, active, key);

    if (activeLayer !== "floating") {
      return null;
    }

    if (this.focusAvailableWindowLayer(activeId, active, key) !== "floating") {
      return false;
    }

    if (
      !this.started ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier()
    ) {
      return false;
    }

    const target = this.floatingNavigationTarget(
      active,
      activeId,
      key,
      destination,
    );

    if (!target || target === active) {
      return false;
    }

    const targetId = windowId(String(target.internalId));

    if (this.focusAvailableWindowLayer(targetId, target, key) !== "floating") {
      return false;
    }

    this.lastWrites = 0;

    return this.focusFloatingTarget(targetId, target, key, active);
  }

  private floatingNavigationTarget(
    active: KWinWindow,
    activeId: WindowId,
    key: string,
    destination: FloatingFocusDestination,
  ): KWinWindow | null {
    const activeFrame = active.frameGeometry;
    const activeCenterX = activeFrame.x + activeFrame.width / 2;
    const activeCenterY = activeFrame.y + activeFrame.height / 2;
    let target: KWinWindow | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (
      let index = this.workspace.stackingOrder.length - 1;
      index >= 0;
      index -= 1
    ) {
      const candidate = this.workspace.stackingOrder[index];

      if (!candidate) {
        continue;
      }

      const candidateId = windowId(String(candidate.internalId));

      if (
        this.observer.source(candidateId) !== candidate ||
        this.windowLayer(candidateId, candidate, key) !== "floating"
      ) {
        continue;
      }

      const frame = candidate.frameGeometry;

      if (destination === "first") {
        if (!target || frame.x < best) {
          target = candidate;
          best = frame.x;
        }
        continue;
      }

      if (destination === "last") {
        if (!target || frame.x >= best) {
          target = candidate;
          best = frame.x;
        }
        continue;
      }

      if (candidateId === activeId) {
        continue;
      }

      const candidateCenterX = frame.x + frame.width / 2;
      const candidateCenterY = frame.y + frame.height / 2;
      const distance =
        destination === "left"
          ? activeCenterX - candidateCenterX
          : destination === "right"
            ? candidateCenterX - activeCenterX
            : destination === "up"
              ? activeCenterY - candidateCenterY
              : candidateCenterY - activeCenterY;

      if (distance > 0 && distance < best) {
        target = candidate;
        best = distance;
      }
    }

    return target;
  }

  private focusHorizontal(
    destination: HorizontalDirection | HorizontalEdge,
  ): boolean {
    const floatingResult = this.focusFloatingWindow(destination);

    if (floatingResult !== null) {
      return floatingResult;
    }

    const command = this.prepareActiveColumnCommand();

    if (!command) {
      return false;
    }

    const targetId = this.horizontalFocusTarget(command, destination);

    if (!targetId) {
      return false;
    }

    const targetOwner = this.managedWindows.get(targetId);
    const target = this.observer.source(targetId);
    const originalActive = this.observer.source(command.activeId);
    const key = command.context.key;

    if (
      targetOwner?.contextKey !== command.context.key ||
      !target ||
      !originalActive ||
      this.workspace.activeWindow !== originalActive ||
      this.focusAvailableWindowLayer(targetId, target, key) !== "tiling"
    ) {
      return false;
    }

    const rememberedFloatingFocus = this.lastFloatingFocus.get(key);
    const rememberedTiledFocus = this.lastTiledFocus.get(key);
    const focused = this.applyActiveColumnMutation(
      command,
      "column focus",
      () => this.layout.activateWindow(targetId),
      () => this.layout.activateWindow(command.activeId),
      () =>
        this.workspace.activeWindow === originalActive &&
        this.observer.source(targetId) === target &&
        this.focusAvailableWindowLayer(targetId, target, key) === "tiling" &&
        this.requestWindowFocus(targetId, target, key, "tiling"),
    );

    if (!focused) {
      this.recoverRejectedFocus(
        originalActive,
        key,
        rememberedFloatingFocus,
        rememberedTiledFocus,
      );
      return false;
    }

    this.rememberLayerFocus(targetId, target);
    return true;
  }

  private focusWithinActiveColumn(direction: VerticalDirection): boolean {
    const floatingResult = this.focusFloatingWindow(direction);

    if (floatingResult !== null) {
      return floatingResult;
    }

    const command = this.prepareActiveColumnCommand();

    if (!command) {
      return false;
    }

    const activeIndex = command.activeColumn.windowIds.indexOf(
      command.activeId,
    );
    const step = direction === "up" ? -1 : 1;
    let targetId: WindowId | null = null;

    for (
      let index = activeIndex + step;
      index >= 0 && index < command.activeColumn.windowIds.length;
      index += step
    ) {
      const candidateId = command.activeColumn.windowIds[index];

      if (!candidateId) {
        break;
      }

      const candidate = this.observer.source(candidateId);

      if (candidate?.minimized) {
        continue;
      }

      targetId = candidateId;
      break;
    }

    if (!targetId) {
      return false;
    }

    const targetOwner = this.managedWindows.get(targetId);
    const target = this.observer.source(targetId);
    const originalActive = this.observer.source(command.activeId);
    const key = command.context.key;

    if (
      targetOwner?.contextKey !== command.context.key ||
      !target ||
      !originalActive ||
      this.workspace.activeWindow !== originalActive ||
      this.focusAvailableWindowLayer(targetId, target, key) !== "tiling"
    ) {
      return false;
    }

    const rememberedFloatingFocus = this.lastFloatingFocus.get(key);
    const rememberedTiledFocus = this.lastTiledFocus.get(key);
    this.lastWrites = 0;

    if (this.requestWindowFocus(targetId, target, key, "tiling")) {
      this.rememberLayerFocus(targetId, target);
      return true;
    }

    this.recoverRejectedFocus(
      originalActive,
      key,
      rememberedFloatingFocus,
      rememberedTiledFocus,
    );
    return false;
  }

  private horizontalFocusTarget(
    command: ActiveColumnCommand,
    destination: HorizontalDirection | HorizontalEdge,
  ): WindowId | null {
    const activeColumnIndex = command.before.columns.findIndex(
      (column) => column.id === command.activeColumn.id,
    );

    if (activeColumnIndex < 0) {
      return null;
    }

    if (destination === "first" || destination === "last") {
      const start =
        destination === "first" ? 0 : command.before.columns.length - 1;
      const step = destination === "first" ? 1 : -1;

      for (
        let index = start;
        index >= 0 && index < command.before.columns.length;
        index += step
      ) {
        const column = command.before.columns[index];

        if (!column) {
          break;
        }

        const candidateId = this.firstNonMinimizedColumnMember(column);

        if (candidateId) {
          return column.id === command.activeColumn.id ? null : candidateId;
        }
      }

      return null;
    }

    const step = destination === "left" ? -1 : 1;

    for (
      let index = activeColumnIndex + step;
      index >= 0 && index < command.before.columns.length;
      index += step
    ) {
      const column = command.before.columns[index];

      if (!column) {
        break;
      }

      const candidateId = this.firstNonMinimizedColumnMember(column);

      if (candidateId) {
        return candidateId;
      }
    }

    return null;
  }

  private firstNonMinimizedColumnMember(
    column: LayoutColumnSnapshot,
  ): WindowId | null {
    for (const id of column.windowIds) {
      if (!this.observer.source(id)?.minimized) {
        return id;
      }
    }

    return null;
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

    const extractionRemainsEligible =
      command.activeColumn.windowIds.length === 1
        ? undefined
        : (): boolean =>
            this.columnMembersAreStackTransferEligible(
              command.activeColumn,
              command.context,
              command.activeId,
            );

    if (extractionRemainsEligible && !extractionRemainsEligible()) {
      return false;
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
      extractionRemainsEligible,
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

    if (
      !command ||
      this.hasCapacityMutationInFlight(command.context.key) ||
      !this.columnMembersAreStackTransferEligible(
        command.activeColumn,
        command.context,
        command.activeId,
      )
    ) {
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
      () =>
        this.columnMembersAreStackTransferEligible(
          command.activeColumn,
          command.context,
          command.activeId,
        ),
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

    const acceptance = this.prepareStackTransferAcceptance(
      [command.activeColumn, target],
      command.context,
      command.activeId,
      command.activeId,
    );

    if (!acceptance) {
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
      () => acceptance.accept(acceptance.activeWindow),
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

  private beginExpelFocusHandoff(
    command: ActiveColumnCommand,
    targetId: WindowId,
    acceptance: StackTransferAcceptance,
  ): boolean {
    const targetWindow = this.observer.source(targetId);

    if (
      this.stackEditOperation ||
      this.pendingExpelFocusHandoff ||
      !targetWindow ||
      this.workspace.activeWindow !== acceptance.activeWindow ||
      this.observer.source(command.activeId) !== acceptance.activeWindow
    ) {
      return false;
    }

    const operation: PendingExpelFocusHandoff = {
      acceptance,
      attempts: 0,
      command,
      continuationPending: false,
      generation: this.runGeneration,
      probePending: false,
      requestInProgress: true,
      targetId,
      targetWindow,
      token: {},
      topologyRevision: this.topologyRevision,
    };
    this.pendingExpelFocusHandoff = operation;
    this.stackEditOperation = operation.token;
    let focusRequestFailed = false;

    try {
      this.workspace.activeWindow = targetWindow;
    } catch {
      focusRequestFailed = true;
    } finally {
      operation.requestInProgress = false;
    }

    if (this.pendingExpelFocusHandoff !== operation) {
      return false;
    }

    if (focusRequestFailed) {
      this.cancelPendingExpelFocusHandoff(operation, true);
      return false;
    }

    if (this.workspace.activeWindow === targetWindow) {
      return this.completePendingExpelFocusHandoff(operation);
    }

    if (this.workspace.activeWindow !== acceptance.activeWindow) {
      this.cancelPendingExpelFocusHandoff(operation, false);
      return false;
    }

    this.schedulePendingExpelFocusHandoff(operation);
    return this.pendingExpelFocusHandoff === operation;
  }

  private schedulePendingExpelFocusHandoff(
    operation: PendingExpelFocusHandoff,
  ): void {
    if (
      operation.continuationPending ||
      this.pendingExpelFocusHandoff !== operation
    ) {
      return;
    }

    operation.continuationPending = true;

    try {
      this.schedule(() => {
        if (this.pendingExpelFocusHandoff !== operation) {
          return;
        }

        operation.continuationPending = false;

        if (this.settlePendingExpelFocusHandoff(operation)) {
          return;
        }

        this.schedulePendingExpelFocusProbe(operation);
      });
    } catch (error) {
      operation.continuationPending = false;
      this.failPendingExpelFocusScheduling(operation, "continuation", error);
    }
  }

  private schedulePendingExpelFocusProbe(
    operation: PendingExpelFocusHandoff,
  ): void {
    if (operation.probePending || this.pendingExpelFocusHandoff !== operation) {
      return;
    }

    operation.probePending = true;

    try {
      this.scheduleResume(() => {
        if (this.pendingExpelFocusHandoff !== operation) {
          return;
        }

        operation.probePending = false;
        operation.attempts += 1;

        if (this.settlePendingExpelFocusHandoff(operation)) {
          return;
        }

        if (operation.attempts >= MAX_STACK_EDIT_FOCUS_PROBES) {
          this.cancelPendingExpelFocusHandoff(operation, false);
          return;
        }

        this.schedulePendingExpelFocusProbe(operation);
      });
    } catch (error) {
      operation.probePending = false;
      this.failPendingExpelFocusScheduling(operation, "probe", error);
    }
  }

  private failPendingExpelFocusScheduling(
    operation: PendingExpelFocusHandoff,
    phase: "continuation" | "probe",
    error: unknown,
  ): void {
    try {
      this.cancelPendingExpelFocusHandoff(
        operation,
        this.workspace.activeWindow === operation.targetWindow,
      );
    } catch (cleanupError) {
      if (this.pendingExpelFocusHandoff === operation) {
        this.pendingExpelFocusHandoff = null;
      }

      if (this.stackEditOperation === operation.token) {
        this.stackEditOperation = null;
      }

      console.warn(
        `[driftile] expel focus scheduling cleanup failed phase=${phase} error=${String(cleanupError)}`,
      );
    }

    console.warn(
      `[driftile] expel focus ${phase} could not be scheduled error=${String(error)}`,
    );
    this.scheduleDeferredRuntimeWork();
  }

  private settlePendingExpelFocusHandoff(
    operation: PendingExpelFocusHandoff,
  ): boolean {
    if (this.pendingExpelFocusHandoff !== operation) {
      return true;
    }

    const activeWindow = this.workspace.activeWindow;

    if (activeWindow === operation.targetWindow) {
      this.completePendingExpelFocusHandoff(operation);
      return true;
    }

    if (
      activeWindow !== null &&
      activeWindow !== operation.acceptance.activeWindow
    ) {
      this.cancelPendingExpelFocusHandoff(operation, false);
      return true;
    }

    if (!this.pendingExpelFocusHandoffRemainsValid(operation, activeWindow)) {
      this.cancelPendingExpelFocusHandoff(operation, false);
      return true;
    }

    return false;
  }

  private completePendingExpelFocusHandoff(
    operation: PendingExpelFocusHandoff,
  ): boolean {
    if (
      !this.pendingExpelFocusHandoffRemainsValid(
        operation,
        operation.targetWindow,
      )
    ) {
      this.cancelPendingExpelFocusHandoff(operation, true);
      return false;
    }

    const command = this.prepareActiveColumnCommand(operation.token);
    const sourceWindowIds = command?.activeColumn.windowIds;
    const movedWindowId = sourceWindowIds?.[sourceWindowIds.length - 1];
    const predecessorId = sourceWindowIds?.[sourceWindowIds.length - 2];

    if (
      this.pendingExpelFocusHandoff !== operation ||
      !command ||
      command.activeId !== operation.targetId ||
      command.context !== operation.command.context ||
      command.activeColumn.id !== operation.command.activeColumn.id ||
      !layoutContextSnapshotsEqual(command.before, operation.command.before) ||
      movedWindowId !== operation.command.activeId ||
      predecessorId !== operation.targetId ||
      !operation.acceptance.accept(operation.targetWindow)
    ) {
      this.cancelPendingExpelFocusHandoff(operation, true);
      return false;
    }

    const newColumnId = this.availableColumnId(
      command.before,
      movedWindowId,
      "expel",
    );
    const preview = this.layout.previewExpelWindowFromColumn(
      command.activeId,
      newColumnId,
    );

    if (!preview || preview.movedWindowId !== movedWindowId) {
      if (preview) {
        this.layout.discardColumnStackEdit(preview);
      }

      this.cancelPendingExpelFocusHandoff(operation, true);
      return false;
    }

    this.pendingExpelFocusHandoff = null;
    const expelled = this.applyColumnStackEdit(
      command,
      preview,
      operation.targetId,
      newColumnId,
      operation.acceptance.accept,
      operation.token,
    );

    if (this.stackEditOperation === operation.token) {
      this.finishStackEditOperation(operation.token);
    }

    if (!expelled) {
      if (this.workspace.activeWindow === operation.targetWindow) {
        this.restorePendingExpelOriginalFocus(operation);
      } else {
        this.recoverRejectedStackEditExternalFocus(
          command.context,
          operation.acceptance.activeWindow,
        );
      }
    }

    return expelled;
  }

  private pendingExpelFocusHandoffRemainsValid(
    operation: PendingExpelFocusHandoff,
    activeWindow: KWinWindow | null,
  ): boolean {
    const { command } = operation;
    const snapshot = this.layout.snapshot(
      command.context.outputId,
      command.context.desktopId,
    );
    const sourceColumn = snapshot.columns.find(
      (column) => column.id === command.activeColumn.id,
    );
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === command.context.outputId,
    );

    if (
      !this.started ||
      this.pendingExpelFocusHandoff !== operation ||
      this.stackEditOperation !== operation.token ||
      this.runGeneration !== operation.generation ||
      this.topologyRevision !== operation.topologyRevision ||
      this.windowTransferOperation !== null ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      this.contexts.get(command.context.key) !== command.context ||
      !output ||
      currentDesktopForOutput(this.workspace, output)?.id !==
        command.context.desktopId ||
      this.observer.source(command.activeId) !==
        operation.acceptance.activeWindow ||
      this.observer.source(operation.targetId) !== operation.targetWindow ||
      !layoutContextSnapshotsEqual(snapshot, command.before) ||
      !sourceColumn ||
      sourceColumn.windowIds[sourceColumn.windowIds.length - 1] !==
        command.activeId ||
      sourceColumn.windowIds[sourceColumn.windowIds.length - 2] !==
        operation.targetId ||
      this.hasStructuralCapacityState(command.context.key) ||
      (activeWindow !== null &&
        activeWindow !== operation.acceptance.activeWindow &&
        activeWindow !== operation.targetWindow)
    ) {
      return false;
    }

    for (const participant of operation.acceptance.participants) {
      if (
        this.observer.source(participant.id) !== participant.window ||
        participant.window.minimized !== participant.minimized
      ) {
        return false;
      }
    }

    if (activeWindow !== null) {
      return operation.acceptance.accept(activeWindow);
    }

    return this.columnMembersAreStackTransferEligible(
      command.activeColumn,
      command.context,
      command.activeId,
      operation.targetId,
    );
  }

  private cancelInvalidPendingExpelFocusHandoff(): void {
    const operation = this.pendingExpelFocusHandoff;

    if (!operation) {
      return;
    }

    const activeWindow = this.workspace.activeWindow;

    if (
      activeWindow !== null &&
      activeWindow !== operation.acceptance.activeWindow &&
      activeWindow !== operation.targetWindow
    ) {
      this.cancelPendingExpelFocusHandoff(operation, false);
      return;
    }

    if (!this.pendingExpelFocusHandoffRemainsValid(operation, activeWindow)) {
      this.cancelPendingExpelFocusHandoff(
        operation,
        activeWindow === operation.targetWindow,
      );
    }
  }

  private cancelPendingExpelFocusHandoff(
    operation: PendingExpelFocusHandoff,
    restoreOriginalFocus: boolean,
  ): void {
    if (this.pendingExpelFocusHandoff !== operation) {
      return;
    }

    this.pendingExpelFocusHandoff = null;

    if (this.stackEditOperation === operation.token) {
      this.stackEditOperation = null;
    }

    if (restoreOriginalFocus) {
      this.restorePendingExpelOriginalFocus(operation);
    }

    this.scheduleDeferredRuntimeWork();
  }

  private restorePendingExpelOriginalFocus(
    operation: PendingExpelFocusHandoff,
  ): void {
    const originalWindow = operation.acceptance.activeWindow;

    if (
      this.workspace.activeWindow !== operation.targetWindow ||
      this.observer.source(operation.command.activeId) !== originalWindow ||
      this.focusAvailableWindowLayer(
        operation.command.activeId,
        originalWindow,
        operation.command.context.key,
      ) !== "tiling"
    ) {
      return;
    }

    try {
      this.workspace.activeWindow = originalWindow;
    } catch {
      // KWin focus recovery is best effort after a rejected focus handoff.
    }
  }

  private applyColumnStackEdit(
    command: ActiveColumnCommand,
    preview: ColumnStackEditPreview,
    focusWindowId: WindowId,
    createdColumnId?: ColumnId,
    accept?: (expectedActive: KWinWindow) => boolean,
    existingOperation?: object,
  ): boolean {
    const activeWindow = this.observer.source(command.activeId);
    const focusWindow = this.observer.source(focusWindowId);
    const focusOwner = this.managedWindows.get(focusWindowId);
    const observedFocus = focusWindow ? normalizeWindow(focusWindow) : null;
    const focusContext = observedFocus ? managedContext(observedFocus) : null;

    if (
      (this.stackEditOperation !== null &&
        this.stackEditOperation !== existingOperation) ||
      !activeWindow ||
      this.workspace.activeWindow !== activeWindow ||
      !focusWindow ||
      focusOwner?.contextKey !== command.context.key ||
      !focusContext ||
      contextKey(focusContext) !== command.context.key ||
      this.floatingWindows.has(focusWindowId) ||
      this.automaticFloatingWindows.has(focusWindowId) ||
      this.automaticallyFloats(focusWindow) ||
      this.suspendedWindows.has(focusWindowId) ||
      this.requestedSuspensions.has(focusWindowId) ||
      !this.toggleGeometrySettled(focusWindowId) ||
      !isGeometryWritable(focusWindow)
    ) {
      this.layout.discardColumnStackEdit(preview);
      return false;
    }

    const operation = existingOperation ?? {};
    this.stackEditOperation = operation;

    try {
      const fullWidthRestore =
        preview.kind === "expel"
          ? this.columnFullWidthRestoreWidth(
              command.context.key,
              command.activeColumn.id,
            )
          : undefined;
      const editState: { value: StackEditResult | null } = { value: null };
      const focusRequest = { attempted: false };
      const acceptEdit = (): boolean => {
        if (
          this.workspace.activeWindow !== activeWindow ||
          (accept && !accept(activeWindow))
        ) {
          return false;
        }

        if (focusWindowId === command.activeId) {
          return true;
        }

        focusRequest.attempted = true;

        if (
          !this.requestWindowFocus(
            focusWindowId,
            focusWindow,
            command.context.key,
            "tiling",
          )
        ) {
          return false;
        }

        return !accept || accept(focusWindow);
      };
      const applied = this.applyActiveColumnMutation(
        command,
        `${preview.kind} window`,
        () => {
          editState.value = this.layout.applyColumnStackEdit(preview);
          return editState.value !== null;
        },
        () =>
          editState.value !== null &&
          this.layout.rollbackStackEdit(editState.value.rollback),
        acceptEdit,
      );
      const edit = editState.value;

      if (!applied || !edit) {
        this.layout.discardColumnStackEdit(preview);

        if (
          focusRequest.attempted &&
          this.workspace.activeWindow === focusWindow &&
          this.observer.source(command.activeId) === activeWindow &&
          this.focusAvailableWindowLayer(
            command.activeId,
            activeWindow,
            command.context.key,
          ) === "tiling"
        ) {
          try {
            this.workspace.activeWindow = activeWindow;
          } catch {
            // KWin focus recovery is best effort after a rejected stack edit.
          }
        }

        return false;
      }

      this.layout.discardStackEditRollback(edit.rollback);

      this.reconcileColumnFullWidthRestore(
        command.context.key,
        command.before,
        preview.layout,
      );

      if (createdColumnId && fullWidthRestore) {
        this.setColumnFullWidthRestore(
          command.context.key,
          createdColumnId,
          fullWidthRestore,
        );
      }

      this.capacityParkBackoffs.delete(command.context.key);

      if (
        preview.kind === "consume" &&
        preview.layout.columns.length < command.before.columns.length &&
        this.waitingWindowIds.get(command.context.key)?.size
      ) {
        this.pendingAdmissionContexts.add(command.context.key);
        this.scheduleWork();
      }

      return true;
    } finally {
      this.finishStackEditOperation(operation);
    }
  }

  private finishStackEditOperation(operation: object): void {
    if (this.stackEditOperation !== operation) {
      return;
    }

    this.stackEditOperation = null;
    this.scheduleDeferredRuntimeWork();
  }

  private scheduleDeferredRuntimeWork(): void {
    if (
      this.pendingDefaultColumnWidth !== null ||
      this.pendingGap !== null ||
      this.pendingWindowSyncs.size > 0 ||
      this.pendingAdmissionContexts.size > 0 ||
      this.desktopLifecycle.pendingWork ||
      this.topologyRecoveryPending ||
      this.ownershipFollowUpRequired ||
      [...this.dirtyContexts].some((key) => {
        const context = this.contexts.get(key);
        return Boolean(context && this.isContextVisible(context));
      })
    ) {
      this.scheduleWork();
    }

    if (this.pendingExternalFullscreenExtractions.size > 0) {
      this.retryPendingExternalFullscreenExtractions();
    }
  }

  private recoverRejectedStackEditExternalFocus(
    context: RuntimeContext,
    originalActive: KWinWindow,
  ): void {
    const active = this.workspace.activeWindow;

    if (!active || active === originalActive) {
      return;
    }

    const activeId = windowId(String(active.internalId));
    const owner = this.managedWindows.get(activeId);
    const snapshot = this.layout.snapshot(context.outputId, context.desktopId);

    if (
      owner?.contextKey !== context.key ||
      this.focusAvailableWindowLayer(activeId, active, context.key) !==
        "tiling" ||
      !snapshot.columns.some((column) => column.windowIds.includes(activeId))
    ) {
      return;
    }

    this.layout.activateWindow(activeId);
    this.markContextDirty(context);
    this.scheduleWork();
  }

  private moveActiveFloatingWindowToDesktop(
    target: DesktopTransferTarget,
  ): boolean | null {
    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));
    const sourceContext = layerFocusContext(activeWindow);
    const sourceContextKey = sourceContext ? contextKey(sourceContext) : null;
    const manualFloating = this.floatingWindows.get(activeId);
    const automaticFloating =
      this.automaticFloatingWindows.has(activeId) &&
      this.automaticFloatingOwnershipApplies(activeId, activeWindow);

    if (!manualFloating && !automaticFloating) {
      return null;
    }

    if (
      !sourceContext ||
      !sourceContextKey ||
      !this.started ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      this.observer.source(activeId) !== activeWindow ||
      (manualFloating !== undefined &&
        this.automaticallyFloats(activeWindow)) ||
      this.windowLayer(activeId, activeWindow, sourceContextKey) !==
        "floating" ||
      this.floatingDesktopTransferHasRelations(activeWindow) ||
      this.pendingWindowSyncs.has(activeId) ||
      this.suspendedWindows.has(activeId) ||
      this.requestedSuspensions.has(activeId) ||
      !this.floatingDesktopFrameStateIsSafe(
        activeWindow,
        activeWindow.frameGeometry,
        sourceContext,
      )
    ) {
      return false;
    }

    const sourceDesktopIndex = this.workspace.desktops.findIndex(
      (desktop) => desktop.id === sourceContext.desktopId,
    );
    const targetDesktopIndex = this.desktopTargetIndex(
      sourceDesktopIndex,
      target,
    );
    const sourceDesktop = this.workspace.desktops[sourceDesktopIndex];
    const targetDesktop = this.workspace.desktops[targetDesktopIndex];
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === sourceContext.outputId,
    );

    if (
      sourceDesktopIndex < 0 ||
      !sourceDesktop ||
      !targetDesktop ||
      sourceDesktop.id === targetDesktop.id ||
      !output ||
      activeWindow.output?.name !== output.name ||
      currentDesktopForOutput(this.workspace, output)?.id !== sourceDesktop.id
    ) {
      return false;
    }

    const targetContext: ManagedContext = {
      desktopId: desktopId(targetDesktop.id),
      outputId: sourceContext.outputId,
    };
    const targetContextKey = contextKey(targetContext);

    if (
      this.hasPendingCapacityState(sourceContextKey) ||
      this.hasPendingCapacityState(targetContextKey) ||
      this.waitingWindowIds.has(sourceContextKey) ||
      this.waitingWindowIds.has(targetContextKey) ||
      this.toggleTransitionPending(sourceContextKey) ||
      this.toggleTransitionPending(targetContextKey)
    ) {
      return false;
    }

    const command: FloatingDesktopTransferCommand = {
      activeId,
      activeWindow,
      classification: manualFloating
        ? { floating: manualFloating, kind: "manual" }
        : { kind: "automatic" },
      frame: { ...activeWindow.frameGeometry },
      output,
      sourceContext,
      sourceContextKey,
      sourceDesktop,
      sourceLayout: this.layout.snapshot(
        sourceContext.outputId,
        sourceContext.desktopId,
      ),
      targetContext,
      targetContextKey,
      targetDesktop,
      targetLayout: this.layout.snapshot(
        targetContext.outputId,
        targetContext.desktopId,
      ),
    };
    const movingIds = new Set([activeId]);
    const operation: WindowTransferOperation = {
      activeId,
      desktopChangeSuppressed: false,
      kind: "floating-desktop",
      movingIds,
      sourceContextKey,
      stateGuardIds: movingIds,
      targetContextKey,
    };
    this.windowTransferOperation = operation;
    let transferred: boolean;

    try {
      transferred = this.applyFloatingDesktopTransfer(command, operation);
    } finally {
      if (this.windowTransferOperation === operation) {
        this.windowTransferOperation = null;
      }

      this.handleWindowActivated(this.workspace.activeWindow);

      if (
        [...this.dirtyContexts].some((key) => {
          const context = this.contexts.get(key);
          return Boolean(context && this.isContextVisible(context));
        }) ||
        this.pendingWindowSyncs.size > 0 ||
        this.pendingAdmissionContexts.size > 0 ||
        this.pendingDefaultColumnWidth !== null ||
        this.pendingGap !== null ||
        this.desktopLifecycle.pendingWork
      ) {
        this.scheduleWork();
      }
    }

    return transferred;
  }

  private applyFloatingDesktopTransfer(
    command: FloatingDesktopTransferCommand,
    operation: WindowTransferOperation,
  ): boolean {
    const topologyRevision = this.topologyRevision;
    const originalActiveWindow = this.workspace.activeWindow;
    const sourceRemembered = this.lastFloatingFocus.get(
      command.sourceContextKey,
    );
    const targetRemembered = this.lastFloatingFocus.get(
      command.targetContextKey,
    );
    let mechanismFrame = { ...command.activeWindow.frameGeometry };
    let frameWrites = 0;
    let failure: string;

    try {
      if (
        !this.floatingDesktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
          command.sourceDesktop,
          command.sourceDesktop,
        )
      ) {
        throw new Error("floating desktop transfer context changed");
      }

      try {
        command.activeWindow.desktops = [command.targetDesktop];
      } finally {
        mechanismFrame = { ...command.activeWindow.frameGeometry };
      }

      if (
        !this.floatingDesktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
          command.targetDesktop,
          command.sourceDesktop,
        )
      ) {
        throw new Error("floating desktop assignment was rejected");
      }

      this.switchDesktop(command.targetDesktop, command.output);

      if (
        !this.floatingDesktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
          command.targetDesktop,
          command.targetDesktop,
        )
      ) {
        throw new Error("floating desktop switch was rejected");
      }

      const writeResult = this.writeFloatingDesktopFrame(
        command.activeWindow,
        command.frame,
        command.targetContext,
      );

      if (writeResult === null) {
        throw new Error("floating frame preservation was rejected");
      }

      frameWrites += writeResult;

      if (this.workspace.activeWindow !== command.activeWindow) {
        this.workspace.activeWindow = command.activeWindow;
      }

      if (
        this.workspace.activeWindow !== command.activeWindow ||
        !rectsEqual(command.activeWindow.frameGeometry, command.frame) ||
        !this.floatingDesktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
          command.targetDesktop,
          command.targetDesktop,
        )
      ) {
        throw new Error("floating desktop transfer was not accepted");
      }

      if (
        this.lastFloatingFocus.get(command.sourceContextKey) ===
        command.activeId
      ) {
        this.lastFloatingFocus.delete(command.sourceContextKey);
      }

      this.lastFloatingFocus.set(command.targetContextKey, command.activeId);
      this.lastWrites = frameWrites;
      return true;
    } catch (error) {
      failure = String(error);
    }

    frameWrites += this.rollbackFloatingDesktopTransfer(
      command,
      operation,
      topologyRevision,
      originalActiveWindow,
      mechanismFrame,
      sourceRemembered,
      targetRemembered,
    );
    this.lastWrites = frameWrites;
    console.warn(
      `[driftile] floating desktop transfer rolled back window=${String(command.activeId)} error=${failure}`,
    );
    return false;
  }

  private rollbackFloatingDesktopTransfer(
    command: FloatingDesktopTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
    originalActiveWindow: KWinWindow | null,
    mechanismFrame: Rect,
    sourceRemembered: WindowId | undefined,
    targetRemembered: WindowId | undefined,
  ): number {
    let frameWrites = 0;

    const compensationSafe =
      this.windowTransferOperation === operation &&
      this.topologyRevision === topologyRevision &&
      this.observer.source(command.activeId) === command.activeWindow &&
      this.workspace.screens.includes(command.output) &&
      command.activeWindow.output?.name === command.output.name &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.sourceDesktop.id,
      ) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.targetDesktop.id,
      ) &&
      this.floatingDesktopClassificationIsCurrent(command) &&
      !this.floatingDesktopTransferHasRelations(command.activeWindow) &&
      this.floatingDesktopLayoutsAreCurrent(command);

    if (compensationSafe) {
      let restoreMechanismFrame = { ...command.activeWindow.frameGeometry };

      if (windowIsOnDesktop(command.activeWindow, command.targetDesktop)) {
        try {
          command.activeWindow.desktops = [command.sourceDesktop];
        } catch (error) {
          console.warn(
            `[driftile] floating desktop restore failed window=${String(command.activeId)} error=${String(error)}`,
          );
        } finally {
          restoreMechanismFrame = { ...command.activeWindow.frameGeometry };
        }
      }

      const desktopRestored = windowIsOnDesktop(
        command.activeWindow,
        command.sourceDesktop,
      );

      if (
        desktopRestored &&
        currentDesktopForOutput(this.workspace, command.output)?.id ===
          command.targetDesktop.id &&
        this.workspace.screens.includes(command.output)
      ) {
        try {
          this.switchDesktop(command.sourceDesktop, command.output);
        } catch (error) {
          console.warn(
            `[driftile] floating desktop selection restore failed output=${command.output.name} error=${String(error)}`,
          );
        }
      }

      const liveFrame = command.activeWindow.frameGeometry;
      const frameOwned = [
        command.frame,
        mechanismFrame,
        restoreMechanismFrame,
      ].some((frame) => rectsEqual(liveFrame, frame));

      if (
        frameOwned &&
        windowIsOnDesktop(command.activeWindow, command.sourceDesktop)
      ) {
        frameWrites +=
          this.writeFloatingDesktopFrame(
            command.activeWindow,
            command.frame,
            command.sourceContext,
          ) ?? 0;
      }

      if (
        this.workspace.activeWindow === command.activeWindow ||
        this.workspace.activeWindow === null
      ) {
        try {
          this.workspace.activeWindow = originalActiveWindow;
        } catch (error) {
          console.warn(
            `[driftile] floating focus restore failed window=${String(command.activeId)} error=${String(error)}`,
          );
        }
      }
    }

    restoreRememberedFocus(
      this.lastFloatingFocus,
      command.sourceContextKey,
      sourceRemembered,
    );
    restoreRememberedFocus(
      this.lastFloatingFocus,
      command.targetContextKey,
      targetRemembered,
    );

    if (
      !windowIsOnDesktop(command.activeWindow, command.sourceDesktop) ||
      !rectsEqual(command.activeWindow.frameGeometry, command.frame) ||
      !this.floatingDesktopLayoutsAreCurrent(command)
    ) {
      this.pendingWindowSyncs.add(command.activeId);
    } else {
      this.pendingWindowSyncs.delete(command.activeId);
    }

    return frameWrites;
  }

  private floatingDesktopTransferOperationIsCurrent(
    command: FloatingDesktopTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
    windowDesktop: KWinVirtualDesktop,
    selectedDesktop: KWinVirtualDesktop,
  ): boolean {
    const liveContext = layerFocusContext(command.activeWindow);

    return (
      this.windowTransferOperation === operation &&
      operation.kind === "floating-desktop" &&
      operation.movingIds.size === 1 &&
      operation.movingIds.has(command.activeId) &&
      this.topologyRevision === topologyRevision &&
      !this.hasTopologyBarrier() &&
      this.observer.source(command.activeId) === command.activeWindow &&
      this.workspace.screens.includes(command.output) &&
      command.activeWindow.output?.name === command.output.name &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.sourceDesktop.id,
      ) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === command.targetDesktop.id,
      ) &&
      windowIsOnDesktop(command.activeWindow, windowDesktop) &&
      currentDesktopForOutput(this.workspace, command.output)?.id ===
        selectedDesktop.id &&
      liveContext !== null &&
      contextKey(liveContext) ===
        contextKey({
          desktopId: desktopId(windowDesktop.id),
          outputId: command.sourceContext.outputId,
        }) &&
      this.floatingDesktopClassificationIsCurrent(command) &&
      !this.floatingDesktopTransferHasRelations(command.activeWindow) &&
      this.floatingDesktopFrameStateIsSafe(
        command.activeWindow,
        command.frame,
        {
          desktopId: desktopId(windowDesktop.id),
          outputId: command.sourceContext.outputId,
        },
      ) &&
      this.floatingDesktopLayoutsAreCurrent(command)
    );
  }

  private floatingDesktopClassificationIsCurrent(
    command: FloatingDesktopTransferCommand,
  ): boolean {
    if (command.classification.kind === "manual") {
      return (
        this.floatingWindows.get(command.activeId) ===
          command.classification.floating &&
        !this.automaticFloatingWindows.has(command.activeId) &&
        !this.automaticallyFloats(command.activeWindow)
      );
    }

    return (
      !this.floatingWindows.has(command.activeId) &&
      this.automaticFloatingWindows.has(command.activeId) &&
      this.automaticFloatingOwnershipApplies(
        command.activeId,
        command.activeWindow,
      )
    );
  }

  private floatingDesktopLayoutsAreCurrent(
    command: FloatingDesktopTransferCommand,
  ): boolean {
    return (
      layoutContextSnapshotsEqual(
        this.layout.snapshot(
          command.sourceContext.outputId,
          command.sourceContext.desktopId,
        ),
        command.sourceLayout,
      ) &&
      layoutContextSnapshotsEqual(
        this.layout.snapshot(
          command.targetContext.outputId,
          command.targetContext.desktopId,
        ),
        command.targetLayout,
      )
    );
  }

  private floatingDesktopTransferHasRelations(active: KWinWindow): boolean {
    if (active.modal || active.transient || active.transientFor) {
      return true;
    }

    for (const candidate of this.workspace.stackingOrder) {
      if (
        candidate === active ||
        this.observer.source(String(candidate.internalId)) !== candidate
      ) {
        continue;
      }

      const visited = new Set<KWinWindow>();
      let ancestor = candidate.transientFor;

      while (ancestor && !visited.has(ancestor)) {
        if (ancestor === active) {
          return true;
        }

        visited.add(ancestor);
        ancestor = ancestor.transientFor;
      }
    }

    return false;
  }

  private floatingDesktopFrameStateIsSafe(
    window: KWinWindow,
    frame: Rect,
    context: ManagedContext,
  ): boolean {
    return (
      window.managed &&
      !window.deleted &&
      (window.normalWindow || window.dialog) &&
      !window.specialWindow &&
      !window.onAllDesktops &&
      window.output?.name === context.outputId &&
      window.desktops.length === 1 &&
      window.desktops[0]?.id === context.desktopId &&
      !hasGeometryAuthorityBlocker(window) &&
      Number.isFinite(frame.x) &&
      Number.isFinite(frame.y) &&
      Number.isFinite(frame.width) &&
      frame.width > 0 &&
      Number.isFinite(frame.height) &&
      frame.height > 0 &&
      (rectsEqual(window.frameGeometry, frame) ||
        respectsSizeConstraints(frame, window))
    );
  }

  private writeFloatingDesktopFrame(
    window: KWinWindow,
    frame: Rect,
    context: ManagedContext,
  ): number | null {
    if (!this.floatingDesktopFrameStateIsSafe(window, frame, context)) {
      return null;
    }

    if (rectsEqual(window.frameGeometry, frame)) {
      return 0;
    }

    if (
      !window.moveable ||
      (!window.resizeable &&
        (!nearlyEqual(window.frameGeometry.width, frame.width) ||
          !nearlyEqual(window.frameGeometry.height, frame.height)))
    ) {
      return null;
    }

    try {
      window.frameGeometry = this.createRect(
        frame.x,
        frame.y,
        frame.width,
        frame.height,
      );
    } catch (error) {
      console.warn(
        `[driftile] floating frame restore failed window=${String(window.internalId)} error=${String(error)}`,
      );
      return null;
    }

    return rectsEqual(window.frameGeometry, frame) ? 1 : null;
  }

  private moveActiveWindowToDesktop(
    target: DesktopTransferTarget,
    wholeColumn = false,
  ): boolean {
    if (this.stackEditOperation) {
      return false;
    }

    const floatingResult = this.moveActiveFloatingWindowToDesktop(target);

    if (floatingResult !== null) {
      return floatingResult;
    }

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
    const targetDesktopIndex = this.desktopTargetIndex(
      sourceDesktopIndex,
      target,
    );
    const targetDesktop = this.workspace.desktops[targetDesktopIndex];
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
        active.contextKey,
        active.contextKey,
        undefined,
        selection.retainedSourceIds,
      ) ||
      !this.transferLayoutIsSafe(
        targetLayout,
        targetContext,
        targetContextKey,
        selection.memberIds,
        active.contextKey,
        active.contextKey,
        undefined,
        selection.geometryPassiveIds,
      )
    ) {
      this.discardContextTransferPreview(preview);
      return false;
    }

    const operation: WindowTransferOperation = {
      activeId: active.activeId,
      desktopChangeSuppressed: false,
      memberStateInvalidated: false,
      kind: "desktop",
      movingIds: selection.memberIds,
      sourceContextKey: active.contextKey,
      stateGuardIds: new Set([
        ...selection.memberIds,
        ...selection.retainedSourceIds,
      ]),
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
      this.queueChangedTransferMembers(command);

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
        this.pendingDefaultColumnWidth !== null ||
        this.pendingGap !== null ||
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
    geometryPassiveIds?: ReadonlySet<WindowId>,
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

      if (
        !source ||
        owner?.contextKey !== expectedOwner ||
        !liveContext ||
        contextKey(liveContext) !== expectedLiveContext ||
        this.floatingWindows.has(window.windowId) ||
        this.waitingWindowContexts.has(window.windowId) ||
        this.requestedSuspensions.has(window.windowId) ||
        this.automaticFloatingWindows.has(window.windowId) ||
        this.automaticallyFloats(source) ||
        (transition &&
          (transition.contextKey !== allowedTransitionContextKey ||
            !rectsEqual(transition.expectedFrame, window.frame))) ||
        !respectsSizeConstraints(window.frame, source)
      ) {
        return false;
      }

      if (geometryPassiveIds?.has(window.windowId) === true) {
        return this.transferMemberIsSettledMinimized(window.windowId, source);
      }

      return (
        !this.suspendedWindows.has(window.windowId) &&
        isGeometryWritable(source) &&
        (expectedLiveContext !== contextKey(context) ||
          this.geometry.canApplyFrame(window.windowId, window.frame, context))
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

  private transferMemberIsSettledMinimized(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    return (
      this.suspendedWindows.has(id) &&
      !this.requestedSuspensions.has(id) &&
      !this.floatingWindows.has(id) &&
      !this.waitingWindowContexts.has(id) &&
      !this.automaticFloatingWindows.has(id) &&
      !this.automaticallyFloats(source) &&
      this.toggleGeometrySettled(id) &&
      source.managed &&
      !source.deleted &&
      source.minimized &&
      !source.fullScreen &&
      source.maximizeMode === 0 &&
      !source.move &&
      source.moveable &&
      !source.resize &&
      source.resizeable &&
      source.tile === null
    );
  }

  private transferMemberStatesAreCurrent(
    command: DesktopTransferCommand | OutputTransferCommand,
    operation: WindowTransferOperation,
  ): boolean {
    return (
      operation.memberStateInvalidated !== true &&
      command.members.every((member) =>
        this.transferMemberStateIsCurrent(member),
      ) &&
      command.retainedSourceMembers.every(
        (member) =>
          operation.stateGuardIds.has(member.id) &&
          !operation.movingIds.has(member.id) &&
          this.retainedTransferMemberIsCurrent(member, command),
      )
    );
  }

  private transferMemberStateIsCurrent(member: ColumnTransferMember): boolean {
    if (
      this.observer.source(member.id) !== member.window ||
      member.window.minimized !== member.minimized
    ) {
      return false;
    }

    if (member.minimized) {
      return this.transferMemberIsSettledMinimized(member.id, member.window);
    }

    return (
      !this.suspendedWindows.has(member.id) &&
      !this.requestedSuspensions.has(member.id) &&
      !this.floatingWindows.has(member.id) &&
      !this.waitingWindowContexts.has(member.id) &&
      !this.automaticFloatingWindows.has(member.id) &&
      !this.automaticallyFloats(member.window) &&
      isGeometryWritable(member.window)
    );
  }

  private retainedTransferMemberIsCurrent(
    member: RetainedTransferMember,
    command: DesktopTransferCommand | OutputTransferCommand,
  ): boolean {
    const observed = normalizeWindow(member.window);
    const liveContext = observed ? managedContext(observed) : null;

    return (
      this.observer.source(member.id) === member.window &&
      this.managedWindows.get(member.id)?.contextKey === command.contextKey &&
      command.sourceRuntimeContext.windowIds.has(member.id) &&
      liveContext !== null &&
      contextKey(liveContext) === command.contextKey &&
      this.transferMemberStateIsCurrent(member) &&
      rectsEqual(member.window.frameGeometry, member.frame)
    );
  }

  private queueChangedTransferMembers(
    command: DesktopTransferCommand | OutputTransferCommand,
  ): void {
    for (const member of command.members) {
      const source = this.observer.source(member.id);

      if (source && source.minimized !== member.minimized) {
        this.pendingWindowSyncs.add(member.id);
      }
    }

    for (const member of command.retainedSourceMembers) {
      if (!this.retainedTransferMemberIsCurrent(member, command)) {
        this.pendingWindowSyncs.add(member.id);
      }
    }
  }

  private transferPassiveFramesMatch(
    command: DesktopTransferCommand | OutputTransferCommand,
    destinationBaselines: ReadonlyMap<WindowId, RestoreBaseline>,
  ): boolean {
    return (
      command.members.every((member) => {
        if (!command.geometryPassiveIds.has(member.id)) {
          return true;
        }

        const baseline = destinationBaselines.get(member.id);
        return Boolean(
          baseline &&
          this.observer.source(member.id) === member.window &&
          rectsEqual(member.window.frameGeometry, baseline.frame),
        );
      }) &&
      command.retainedSourceMembers.every(
        (member) =>
          this.observer.source(member.id) === member.window &&
          rectsEqual(member.window.frameGeometry, member.frame),
      )
    );
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
      if (
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
        throw new Error("desktop transfer ownership changed");
      }

      for (const member of this.transferMembersActiveLast(command)) {
        if (
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.transferMemberStatesAreCurrent(command, operation)
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
          !this.transferMemberStatesAreCurrent(command, operation) ||
          !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
        ) {
          throw new Error("window desktop assignment was rejected");
        }
      }

      this.switchDesktop(command.targetDesktop, command.output);

      if (
        currentDesktopForOutput(this.workspace, command.output)?.id !==
          command.targetDesktop.id ||
        !this.transferOperationIdentityIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
        throw new Error("desktop switch was rejected");
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        this.workspace.activeWindow = command.activeWindow;
      }

      if (
        this.workspace.activeWindow !== command.activeWindow ||
        !this.transferMemberStatesAreCurrent(command, operation)
      ) {
        throw new Error("window focus was rejected");
      }

      if (
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
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

      const targetGeometryLayout = targetLayout.windows.filter(
        (window) => !command.geometryPassiveIds.has(window.windowId),
      );
      const windowIds = targetGeometryLayout.map((window) => window.windowId);
      const observedBefore = this.geometry.observedFrames(
        windowIds,
        command.targetContext,
      );

      if (
        observedBefore.size !== windowIds.length ||
        targetGeometryLayout.some(
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
        targetGeometryLayout,
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
        !this.transferUnchangedFramesMatch(
          targetLayout,
          changedWindowIds,
          command.geometryPassiveIds,
        ) ||
        !this.transferPassiveFramesMatch(command, destinationBaselines) ||
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
      this.transferMemberStatesAreCurrent(command, operation) &&
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
        command.contextKey,
        command.contextKey,
        undefined,
        command.retainedSourceIds,
      ) &&
      this.transferLayoutIsSafe(
        targetLayout,
        command.targetContext,
        command.targetContextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.targetContextKey,
        command.geometryPassiveIds,
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
    const membersById = new Map(
      command.members.map((member) => [member.id, member]),
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
        const member = membersById.get(target.windowId);
        const source = this.observer.source(target.windowId);
        const forwardFrame = forwardFrames.get(target.windowId);

        if (
          (member && !this.transferMemberStateIsCurrent(member)) ||
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
            (!member || this.transferMemberStateIsCurrent(member)) &&
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
      const memberStateCurrent = this.transferMemberStateIsCurrent(member);

      if (
        !command.geometryPassiveIds.has(member.id) &&
        memberStateCurrent &&
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
        !memberStateCurrent ||
        (command.geometryPassiveIds.has(member.id) &&
          (!sourceFrame ||
            !rectsEqual(member.window.frameGeometry, sourceFrame)))
      ) {
        sourceRestored = false;
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
        active.contextKey,
        active.contextKey,
        undefined,
        selection.retainedSourceIds,
      ) ||
      !this.transferLayoutIsSafe(
        targetLayout,
        targetContext,
        targetContextKey,
        selection.memberIds,
        active.contextKey,
        active.contextKey,
        undefined,
        selection.geometryPassiveIds,
      )
    ) {
      this.discardContextTransferPreview(preview);
      return false;
    }

    const operation: WindowTransferOperation = {
      activeId: active.activeId,
      desktopChangeSuppressed: false,
      kind: "output",
      memberStateInvalidated: false,
      movingIds: selection.memberIds,
      sourceContextKey: active.contextKey,
      stateGuardIds: new Set([
        ...selection.memberIds,
        ...selection.retainedSourceIds,
      ]),
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
      this.queueChangedTransferMembers(command);

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
        this.pendingDefaultColumnWidth !== null ||
        this.pendingGap !== null ||
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
      if (
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
        throw new Error("output transfer ownership changed");
      }

      for (const member of this.transferMembersActiveLast(command)) {
        if (
          !this.transferOperationIdentityIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.transferMemberStatesAreCurrent(command, operation)
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
            ) ||
            !this.transferMemberStatesAreCurrent(command, operation)
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
          !this.transferMemberStatesAreCurrent(command, operation) ||
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
            ) ||
            !this.transferMemberStatesAreCurrent(command, operation)
          ) {
            throw new Error("window desktop assignment was rejected");
          }
        }
      }

      if (this.workspace.activeWindow !== command.activeWindow) {
        this.workspace.activeWindow = command.activeWindow;
      }

      if (
        this.workspace.activeWindow !== command.activeWindow ||
        !this.transferMemberStatesAreCurrent(command, operation)
      ) {
        throw new Error("window focus was rejected");
      }

      if (
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout)
      ) {
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
          geometryPassiveIds: command.retainedSourceIds,
          layout: sourceLayout,
        },
        {
          context: command.targetContext,
          contextKey: command.targetContextKey,
          geometryPassiveIds: command.geometryPassiveIds,
          layout: targetLayout,
        },
      ] as const;
      const changes: TransferGeometryChange[] = [];

      for (const plan of plans) {
        const geometryLayout = plan.layout.windows.filter(
          (window) => !plan.geometryPassiveIds.has(window.windowId),
        );
        const windowIds = geometryLayout.map((window) => window.windowId);
        const observedBefore = this.geometry.observedFrames(
          windowIds,
          plan.context,
        );

        if (
          observedBefore.size !== windowIds.length ||
          geometryLayout.some(
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
          geometryLayout,
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
        !this.transferPassiveFramesMatch(command, destinationBaselines) ||
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
      this.transferMemberStatesAreCurrent(command, operation) &&
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
      this.transferUnchangedFramesMatch(
        sourceLayout,
        changedWindowIds,
        command.retainedSourceIds,
      ) &&
      this.transferUnchangedFramesMatch(
        targetLayout,
        changedWindowIds,
        command.geometryPassiveIds,
      ) &&
      this.transferLayoutIsSafe(
        sourceLayout,
        command.context,
        command.contextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.contextKey,
        command.retainedSourceIds,
      ) &&
      this.transferLayoutIsSafe(
        targetLayout,
        command.targetContext,
        command.targetContextKey,
        command.memberIds,
        command.contextKey,
        command.targetContextKey,
        command.targetContextKey,
        command.geometryPassiveIds,
      )
    );
  }

  private transferUnchangedFramesMatch(
    layout: ReturnType<typeof solveStripGeometry>,
    changedWindowIds: ReadonlySet<WindowId>,
    geometryPassiveIds?: ReadonlySet<WindowId>,
  ): boolean {
    return layout.windows.every((window) => {
      if (
        changedWindowIds.has(window.windowId) ||
        geometryPassiveIds?.has(window.windowId) === true
      ) {
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
    const membersById = new Map(
      command.members.map((member) => [member.id, member]),
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
        const member = membersById.get(target.windowId);
        const source = this.observer.source(target.windowId);
        const forwardFrame = forwardFrames.get(target.windowId);
        let restored = false;

        if (
          (!member || this.transferMemberStateIsCurrent(member)) &&
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
              (!member || this.transferMemberStateIsCurrent(member)) &&
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
      const memberStateCurrent = this.transferMemberStateIsCurrent(member);

      if (
        !command.geometryPassiveIds.has(member.id) &&
        memberStateCurrent &&
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
        !memberStateCurrent ||
        (command.geometryPassiveIds.has(member.id) &&
          (!sourceFrame ||
            !rectsEqual(member.window.frameGeometry, sourceFrame)))
      ) {
        sourceRestored = false;
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
        this.lastFloatingFocus.set(command.contextKey, command.activeId);
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

    if (!placement) {
      return false;
    }

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
        this.lastTiledFocus.set(command.contextKey, command.activeId);
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
          direction * this.windowHeightStep * denominator;
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
        const movesInOppositeDirection =
          direction > 0
            ? targetFrameHeight < currentActiveFrame.height - tolerance
            : targetFrameHeight > currentActiveFrame.height + tolerance;

        if (
          movesInOppositeDirection ||
          (!movesInRequestedDirection && currentActiveHeight.kind !== "auto")
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
        candidate = { ...this.defaultColumnWidth };
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
            this.columnWidthStep,
            direction,
          ),
        };
      }
    }

    if (!candidate) {
      return null;
    }

    const currentPixels = this.resolvedColumnWidth(current, denominator);
    let candidatePixels =
      candidate.kind === "fixed"
        ? candidate.value
        : candidate.value * denominator - this.gap;

    if (currentPixels === null || !Number.isFinite(candidatePixels)) {
      return null;
    }

    if (
      candidatePixels <=
      minimum + floatingPointTolerance(candidatePixels, minimum)
    ) {
      candidate = { kind: "fixed", value: minimum };
      candidatePixels = minimum;
    } else if (
      Number.isFinite(maximum) &&
      candidatePixels >=
        maximum - floatingPointTolerance(candidatePixels, maximum)
    ) {
      candidate = { kind: "fixed", value: maximum };
      candidatePixels = maximum;
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
    const origin =
      this.defaultColumnWidth.kind === "proportion"
        ? this.defaultColumnWidth.value
        : 0;
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
    return this.availableColumnId(command.before, command.activeId, "split");
  }

  private availableColumnId(
    snapshot: LayoutContextSnapshot,
    id: WindowId,
    namespace: string,
  ): ColumnId {
    const columnIds = new Set(snapshot.columns.map((column) => column.id));
    const canonical = columnId(`column:${String(id)}`);

    if (!columnIds.has(canonical)) {
      return canonical;
    }

    const base = `column:${namespace}:${String(id)}`;

    for (let index = 0; index <= snapshot.columns.length; index += 1) {
      const candidate = columnId(
        index === 0 ? base : `${base}:${String(index)}`,
      );

      if (!columnIds.has(candidate)) {
        return candidate;
      }
    }

    throw new Error("could not allocate a column ID");
  }

  private freshDetachedWindowPlacement(
    command: ActiveWindowCommand,
    context: LayoutContextSnapshot,
  ): DetachedWindowPlacement | null {
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
    const width = this.constrainedDefaultColumnWidth(
      [command.activeWindow],
      command.contextGeometry,
    );

    if (!width) {
      return null;
    }

    return {
      columnId: detachedColumnId,
      columnIndex,
      columnWidth: width,
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

  private columnMembersAreStackTransferEligible(
    column: LayoutColumnSnapshot,
    context: RuntimeContext,
    requiredMemberId?: WindowId,
    additionalRequiredMemberId?: WindowId,
  ): boolean {
    if (!this.columnMembersBelongToContext(column, context)) {
      return false;
    }

    return column.windowIds.every((id) => {
      const source = this.observer.source(id);
      return Boolean(
        source &&
        this.stackTransferMemberIsEligible(
          id,
          source,
          context,
          requiredMemberId !== undefined &&
            id !== requiredMemberId &&
            id !== additionalRequiredMemberId,
        ),
      );
    });
  }

  private prepareStackTransferAcceptance(
    columns: readonly LayoutColumnSnapshot[],
    context: RuntimeContext,
    activeId: WindowId,
    requiredMemberId: WindowId,
    additionalRequiredMemberId?: WindowId,
  ): StackTransferAcceptance | null {
    const activeWindow = this.observer.source(activeId);

    if (!activeWindow || this.workspace.activeWindow !== activeWindow) {
      return null;
    }

    const participants: StackTransferParticipant[] = [];

    for (const column of columns) {
      for (const id of column.windowIds) {
        const window = this.observer.source(id);

        if (!window) {
          return null;
        }

        participants.push({
          id,
          minimized: window.minimized,
          stateRevision: this.windowStateRevisions.get(id) ?? 0,
          window,
        });
      }
    }

    if (
      !participants.some(({ id }) => id === requiredMemberId) ||
      (additionalRequiredMemberId !== undefined &&
        !participants.some(({ id }) => id === additionalRequiredMemberId))
    ) {
      return null;
    }

    const accept = (expectedActive: KWinWindow): boolean => {
      if (
        this.workspace.activeWindow !== expectedActive ||
        this.observer.source(activeId) !== activeWindow
      ) {
        return false;
      }

      for (const participant of participants) {
        if (
          this.observer.source(participant.id) !== participant.window ||
          participant.window.minimized !== participant.minimized ||
          (this.windowStateRevisions.get(participant.id) ?? 0) !==
            participant.stateRevision
        ) {
          return false;
        }
      }

      return columns.every((column) =>
        this.columnMembersAreStackTransferEligible(
          column,
          context,
          requiredMemberId,
          additionalRequiredMemberId,
        ),
      );
    };

    return accept(activeWindow) ? { accept, activeWindow, participants } : null;
  }

  private stackTransferMemberIsEligible(
    id: WindowId,
    source: KWinWindow,
    context: RuntimeContext,
    allowSettledMinimized: boolean,
  ): boolean {
    if (
      !context.windowIds.has(id) ||
      this.floatingWindows.has(id) ||
      this.waitingWindowContexts.has(id) ||
      this.requestedSuspensions.has(id) ||
      this.automaticFloatingWindows.has(id) ||
      this.automaticallyFloats(source) ||
      !this.toggleGeometrySettled(id)
    ) {
      return false;
    }

    if (!this.suspendedWindows.has(id)) {
      return isGeometryWritable(source);
    }

    return (
      allowSettledMinimized &&
      source.managed &&
      !source.deleted &&
      source.minimized &&
      !source.fullScreen &&
      source.maximizeMode === 0 &&
      !source.move &&
      source.moveable &&
      !source.resize &&
      source.resizeable &&
      source.tile === null
    );
  }

  private columnMembersAreExternalFullscreenTransferEligible(
    column: LayoutColumnSnapshot,
    context: RuntimeContext,
    activeId: WindowId,
    activeWindow: KWinWindow,
  ): boolean {
    if (!this.columnMembersBelongToContext(column, context)) {
      return false;
    }

    return column.windowIds.every((id) => {
      const source = this.observer.source(id);

      if (
        !source ||
        !context.windowIds.has(id) ||
        this.floatingWindows.has(id) ||
        this.waitingWindowContexts.has(id) ||
        this.requestedSuspensions.has(id) ||
        this.automaticFloatingWindows.has(id) ||
        this.automaticallyFloats(source) ||
        !this.toggleGeometrySettled(id)
      ) {
        return false;
      }

      if (id === activeId) {
        return (
          source === activeWindow &&
          source.fullScreen &&
          this.suspendedWindows.has(id)
        );
      }

      return this.stackTransferMemberIsEligible(id, source, context, true);
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
    const geometryPassiveIds = new Set<WindowId>();
    const members: ColumnTransferMember[] = [];
    const retainedSourceIds = new Set<WindowId>();
    const retainedSourceMembers: RetainedTransferMember[] = [];

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
        this.requestedSuspensions.has(id) ||
        this.automaticFloatingWindows.has(id) ||
        this.automaticallyFloats(source) ||
        !this.toggleGeometrySettled(id)
      ) {
        return null;
      }

      if (this.suspendedWindows.has(id)) {
        if (
          !wholeColumn ||
          id === active.activeId ||
          !this.transferMemberIsSettledMinimized(id, source)
        ) {
          return null;
        }

        geometryPassiveIds.add(id);
      } else if (!isGeometryWritable(source)) {
        return null;
      }

      members.push({ id, minimized: source.minimized, window: source });
    }

    if (!wholeColumn) {
      for (const id of sourceColumn.windowIds) {
        if (id === active.activeId || !this.suspendedWindows.has(id)) {
          continue;
        }

        const owner = this.managedWindows.get(id);
        const source = this.observer.source(id);
        const observed = source ? normalizeWindow(source) : null;
        const liveContext = observed ? managedContext(observed) : null;

        if (
          !source ||
          owner?.contextKey !== context.key ||
          !liveContext ||
          contextKey(liveContext) !== context.key ||
          !this.transferMemberIsSettledMinimized(id, source)
        ) {
          return null;
        }

        retainedSourceIds.add(id);
        retainedSourceMembers.push({
          frame: { ...source.frameGeometry },
          id,
          minimized: true,
          window: source,
        });
      }
    }

    if (
      members.length === 0 ||
      members.find((member) => member.id === active.activeId)?.window !==
        active.activeWindow
    ) {
      return null;
    }

    return {
      geometryPassiveIds,
      memberIds: new Set(selectedIds),
      members,
      retainedSourceIds,
      retainedSourceMembers,
      sourceColumn,
      wholeColumn,
    };
  }

  private prepareActiveWindowCommand(): ActiveWindowCommand | null {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      this.stackEditOperation ||
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

  private prepareActiveColumnCommand(
    existingOperation?: object,
  ): ActiveColumnCommand | null {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      (this.stackEditOperation !== null &&
        this.stackEditOperation !== existingOperation) ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !activeWindow ||
      this.automaticallyFloats(activeWindow)
    ) {
      return null;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (
      !sampledGeometries ||
      (existingOperation === undefined && !this.synchronizePendingWindows())
    ) {
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

  private fullscreenStackedActiveWindow(activeWindow: KWinWindow): boolean {
    const preparation = this.prepareStackedNativeState(
      activeWindow,
      "fullscreen",
      false,
    );

    if (!preparation) {
      return false;
    }

    const operation = this.extractStackedNativeStateWindow(
      preparation,
      (candidate) =>
        this.stackedNativeStateOperationIsCurrent(candidate) &&
        this.requestFullscreenState(
          candidate.activeId,
          candidate.activeWindow,
          true,
        ),
    );

    if (!operation) {
      this.restoreStackedNativeStateRuntime(preparation);
      this.finishStackedNativeStateOperation(preparation.transfer);
      this.scheduleDeferredRuntimeWork();
      return false;
    }

    return this.commitStackedNativeStateOperation(operation);
  }

  private requestFullscreenState(
    id: WindowId,
    source: KWinWindow,
    target: boolean,
  ): boolean {
    if (
      !this.started ||
      this.observer.source(id) !== source ||
      this.pendingFullscreenTargets.has(id)
    ) {
      return false;
    }

    const committedBefore = source.fullScreen;
    const moveableBefore = source.moveable;
    const resizeableBefore = source.resizeable;
    const readRequestedGeometryState = (): readonly [boolean, boolean] => [
      source.moveable,
      source.resizeable,
    ];
    let requestFailure: string | null = null;
    this.pendingFullscreenTargets.set(id, target);

    try {
      source.fullScreen = target;
    } catch (error) {
      requestFailure = String(error);
    }

    const sourceIsLive = this.fullscreenRequestSourceIsLive(id, source);
    const committed = source.fullScreen === target;
    const [moveableAfter, resizeableAfter] = readRequestedGeometryState();
    const requestedStateChanged = target
      ? moveableBefore && resizeableBefore && !moveableAfter && !resizeableAfter
      : !moveableBefore &&
        !resizeableBefore &&
        moveableAfter &&
        resizeableAfter;
    const accepted =
      sourceIsLive &&
      committedBefore !== target &&
      (committed ||
        (requestedStateChanged &&
          this.pendingFullscreenTargets.get(id) === target));

    if (!accepted) {
      if (this.pendingFullscreenTargets.get(id) === target) {
        this.pendingFullscreenTargets.delete(id);
      }

      this.fullscreenRequestProbes.delete(id);
      this.retainsFullscreenRequestGeometry(source);

      if (requestFailure !== null) {
        console.warn(
          `[driftile] fullscreen request failed window=${String(id)} error=${requestFailure}`,
        );
      }

      return false;
    }

    if (target) {
      this.suspendGeometryLease(id);
    }

    if (committed) {
      this.pendingWindowSyncs.add(id);
      this.settleFullscreenRequest(id, target, true);
    } else if (this.pendingFullscreenTargets.get(id) === target) {
      this.scheduleFullscreenRequestProbe(id, target);
    }

    if (requestFailure !== null) {
      console.warn(
        `[driftile] fullscreen request reported an error after acceptance window=${String(id)} error=${requestFailure}`,
      );
    }

    if (!this.windowTransferOperation) {
      this.scheduleWork();
    }

    return true;
  }

  private fullscreenRequestSourceIsLive(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    return (
      this.started && !source.deleted && this.observer.source(id) === source
    );
  }

  private settleFullscreenRequest(
    id: WindowId,
    committed: boolean,
    authoritative = false,
  ): void {
    const pendingTarget = this.pendingFullscreenTargets.get(id);

    if (authoritative) {
      const retainedTarget = this.unconfirmedFullscreenTargets.get(id);
      const requestedTarget = pendingTarget ?? retainedTarget;
      this.deleteUnconfirmedFullscreenTarget(id);

      if (requestedTarget !== undefined && requestedTarget !== committed) {
        const source = this.observer.source(id);

        if (
          source &&
          !this.fullscreenRequestGeometryReverted(source, requestedTarget)
        ) {
          this.retainUnconfirmedFullscreenTarget(id, requestedTarget, source);
        }
      }
    }

    if (pendingTarget === undefined) {
      this.fullscreenRequestProbes.delete(id);
      return;
    }

    if (pendingTarget !== committed && !authoritative) {
      return;
    }

    this.pendingFullscreenTargets.delete(id);
    this.fullscreenRequestProbes.delete(id);
  }

  private retainUnconfirmedFullscreenTarget(
    id: WindowId,
    target: boolean,
    source: KWinWindow,
  ): void {
    this.unconfirmedFullscreenTargets.set(id, target);
    this.unconfirmedFullscreenRetentions.set(id, {
      generation: this.runGeneration,
      source,
    });
  }

  private deleteUnconfirmedFullscreenTarget(id: WindowId): void {
    this.unconfirmedFullscreenTargets.delete(id);
    this.unconfirmedFullscreenRetentions.delete(id);
  }

  private scheduleFullscreenRequestProbe(id: WindowId, target: boolean): void {
    if (!this.started || this.pendingFullscreenTargets.get(id) !== target) {
      return;
    }

    let probe = this.fullscreenRequestProbes.get(id);

    if (!probe || probe.target !== target) {
      probe = { completedAttempts: 0, pending: false, target };
      this.fullscreenRequestProbes.set(id, probe);
    }

    if (
      probe.pending ||
      probe.completedAttempts >= MAX_FULLSCREEN_REQUEST_PROBES
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
        this.fullscreenRequestProbes.get(id) !== probe ||
        this.pendingFullscreenTargets.get(id) !== target
      ) {
        return;
      }

      const synchronous = !schedulerReturned;

      if (!synchronous) {
        probe.pending = false;
      }

      const source = this.observer.source(id);

      if (!source) {
        this.pendingFullscreenTargets.delete(id);
        this.fullscreenRequestProbes.delete(id);
        this.deleteUnconfirmedFullscreenTarget(id);
        return;
      }

      if (source.fullScreen === target) {
        this.settleFullscreenRequest(id, target, true);
        this.pendingWindowSyncs.add(id);
        this.scheduleWork();
        return;
      }

      if (this.fullscreenRequestGeometryReverted(source, target)) {
        this.pendingFullscreenTargets.delete(id);
        this.fullscreenRequestProbes.delete(id);

        if (this.unconfirmedFullscreenTargets.get(id) === target) {
          this.deleteUnconfirmedFullscreenTarget(id);
        }

        this.queueFullscreenRequestGeometrySync(id);
        return;
      }

      probe.completedAttempts += 1;

      if (probe.completedAttempts >= MAX_FULLSCREEN_REQUEST_PROBES) {
        this.retainUnconfirmedFullscreenTarget(id, target, source);
        this.pendingFullscreenTargets.delete(id);
        this.fullscreenRequestProbes.delete(id);
        return;
      }

      if (synchronous && this.fullscreenRequestProbes.get(id) === probe) {
        probe.pending = false;
      }

      this.scheduleFullscreenRequestProbe(id, target);
    });
    schedulerReturned = true;
  }

  private queueExternalFullscreenExtraction(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    const existing = this.pendingExternalFullscreenExtractions.get(id);

    if (!this.externalFullscreenExtractionRequired(id, source)) {
      if (
        existing?.source === source &&
        existing.generation === this.runGeneration
      ) {
        this.pendingExternalFullscreenExtractions.delete(id);
      }

      return false;
    }

    if (
      existing?.source === source &&
      existing.generation === this.runGeneration
    ) {
      return true;
    }

    this.pendingExternalFullscreenExtractions.set(id, {
      attempts: 0,
      generation: this.runGeneration,
      source,
    });
    return true;
  }

  private externalFullscreenExtractionRequired(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    if (
      !this.started ||
      source.deleted ||
      !source.fullScreen ||
      this.observer.source(id) !== source ||
      this.floatingWindows.has(id) ||
      this.automaticFloatingWindows.has(id) ||
      this.automaticallyFloats(source)
    ) {
      return false;
    }

    const nativeStateOperation = this.stackedNativeStateOperation;

    if (
      nativeStateOperation?.activeId === id &&
      nativeStateOperation.activeWindow === source &&
      nativeStateOperation.command.activeColumn.windowIds.length > 1
    ) {
      return true;
    }

    const owner = this.managedWindows.get(id);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;

    if (!owner || !context || !context.windowIds.has(id)) {
      return Boolean(
        this.windowTransferOperation ||
        this.startupStabilizationToken !== null ||
        this.hasTopologyBarrier() ||
        this.pendingWindowSyncs.has(id),
      );
    }

    const observed = normalizeWindow(source);
    const liveContext = observed ? managedContext(observed) : null;

    if (!liveContext || contextKey(liveContext) !== owner.contextKey) {
      return Boolean(
        this.windowTransferOperation ||
        this.startupStabilizationToken !== null ||
        this.hasTopologyBarrier() ||
        this.pendingWindowSyncs.has(id),
      );
    }

    const column = this.layout
      .snapshot(context.outputId, context.desktopId)
      .columns.find((candidate) => candidate.windowIds.includes(id));

    if (column) {
      return column.windowIds.length > 1;
    }

    return Boolean(
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      this.pendingWindowSyncs.has(id),
    );
  }

  private tryPendingExternalFullscreenExtraction(id: WindowId): void {
    const pending = this.pendingExternalFullscreenExtractions.get(id);

    if (!pending) {
      return;
    }

    if (
      pending.generation !== this.runGeneration ||
      this.observer.source(id) !== pending.source ||
      !this.externalFullscreenExtractionRequired(id, pending.source)
    ) {
      this.deletePendingExternalFullscreenExtraction(id, pending);
      return;
    }

    if (
      this.workspace.activeWindow !== pending.source ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.stackedNativeStateOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier()
    ) {
      return;
    }

    if (!this.externalFullscreenManagedStackIsReady(id, pending.source)) {
      return;
    }

    this.activateExternalFullscreenWindow(id, pending.source);
    this.suspendGeometryLease(id);
    const command = this.prepareExternalFullscreenColumnCommand(pending.source);

    if (!command) {
      return;
    }

    if (
      this.runGeneration !== pending.generation ||
      this.pendingExternalFullscreenExtractions.get(id) !== pending
    ) {
      return;
    }

    let extracted = false;

    try {
      extracted = this.extractStackedWindowForExternalFullscreen(
        pending.source,
        command,
      );
    } catch (error) {
      console.warn(
        `[driftile] external stacked fullscreen interception failed window=${String(id)} error=${String(error)}`,
      );
    }

    if (
      this.runGeneration !== pending.generation ||
      this.pendingExternalFullscreenExtractions.get(id) !== pending
    ) {
      return;
    }

    if (
      extracted ||
      !this.externalFullscreenExtractionRequired(id, pending.source)
    ) {
      this.deletePendingExternalFullscreenExtraction(id, pending);
      return;
    }

    pending.attempts += 1;

    if (pending.attempts >= MAX_EXTERNAL_FULLSCREEN_EXTRACTION_ATTEMPTS) {
      this.deletePendingExternalFullscreenExtraction(id, pending);
    }
  }

  private deletePendingExternalFullscreenExtraction(
    id: WindowId,
    pending: PendingExternalFullscreenExtraction,
  ): void {
    if (this.pendingExternalFullscreenExtractions.get(id) === pending) {
      this.pendingExternalFullscreenExtractions.delete(id);
    }
  }

  private externalFullscreenManagedStackIsReady(
    id: WindowId,
    source: KWinWindow,
  ): boolean {
    const owner = this.managedWindows.get(id);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observed = normalizeWindow(source);
    const liveContext = observed ? managedContext(observed) : null;

    if (
      !owner ||
      !context ||
      !context.windowIds.has(id) ||
      !liveContext ||
      contextKey(liveContext) !== owner.contextKey
    ) {
      return false;
    }

    const column = this.layout
      .snapshot(context.outputId, context.desktopId)
      .columns.find((candidate) => candidate.windowIds.includes(id));
    return Boolean(column && column.windowIds.length > 1);
  }

  private activateExternalFullscreenWindow(
    id: WindowId,
    source: KWinWindow,
  ): void {
    const owner = this.managedWindows.get(id);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observed = normalizeWindow(source);
    const liveContext = observed ? managedContext(observed) : null;

    if (
      !owner ||
      !context ||
      !liveContext ||
      contextKey(liveContext) !== owner.contextKey
    ) {
      return;
    }

    this.rememberLayerFocus(id, source);

    if (this.layout.activateWindow(id)) {
      this.markContextDirty(context);
    }
  }

  private retryPendingExternalFullscreenExtractions(): void {
    for (const id of [...this.pendingExternalFullscreenExtractions.keys()]) {
      this.tryPendingExternalFullscreenExtraction(id);
    }
  }

  private extractStackedWindowForExternalFullscreen(
    activeWindow: KWinWindow,
    command: ActiveColumnCommand,
  ): boolean {
    const preparation = this.prepareStackedNativeState(
      activeWindow,
      "fullscreen",
      true,
      command,
    );

    if (!preparation) {
      return false;
    }

    const operation = this.extractStackedNativeStateWindow(
      preparation,
      (candidate) => this.stackedNativeStateOperationIsCurrent(candidate),
    );

    if (!operation) {
      this.restoreStackedNativeStateRuntime(preparation);
      this.finishStackedNativeStateOperation(preparation.transfer);
      this.scheduleDeferredRuntimeWork();
      return false;
    }

    const committed = this.commitStackedNativeStateOperation(operation);

    if (!committed) {
      console.warn(
        `[driftile] external stacked fullscreen extraction could not commit window=${String(operation.activeId)}`,
      );
    }

    return committed;
  }

  private prepareExternalFullscreenColumnCommand(
    activeWindow: KWinWindow,
  ): ActiveColumnCommand | null {
    if (
      !this.started ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.stackedNativeStateOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !activeWindow.fullScreen ||
      this.automaticallyFloats(activeWindow)
    ) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));

    if (
      this.workspace.activeWindow !== activeWindow ||
      this.observer.source(activeId) !== activeWindow ||
      !this.suspendedWindows.has(activeId) ||
      this.requestedSuspensions.has(activeId) ||
      !this.toggleGeometrySettled(activeId)
    ) {
      return null;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();

    if (!sampledGeometries || this.hasTopologyBarrier()) {
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
      this.hasPendingCapacityState(context.key) ||
      this.pendingAdmissionContexts.has(context.key) ||
      this.waitingWindowIds.has(context.key) ||
      this.refreshContextAutomaticFloatingOwnership(context) ||
      this.toggleTransitionPending(context.key)
    ) {
      return null;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumn = before.columns.find((column) =>
      column.windowIds.includes(activeId),
    );
    const contextGeometry = sampledGeometries.get(context.key);

    if (
      !activeColumn ||
      before.activeColumnId !== activeColumn.id ||
      activeColumn.windowIds.length < 2 ||
      !contextGeometry ||
      !this.columnMembersAreExternalFullscreenTransferEligible(
        activeColumn,
        context,
        activeId,
        activeWindow,
      )
    ) {
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

  private maximizeStackedActiveWindow(activeWindow: KWinWindow): boolean {
    const signal = activeWindow.maximizedAboutToChange;

    if (!signal) {
      return false;
    }

    const preparation = this.prepareStackedNativeState(
      activeWindow,
      "maximize",
      false,
    );

    if (!preparation) {
      return false;
    }

    const observedModes: number[] = [];
    const handleRequest = (mode: number): void => {
      observedModes.push(mode);
    };
    const operation = this.extractStackedNativeStateWindow(
      preparation,
      (candidate) => {
        if (!this.stackedNativeStateOperationIsCurrent(candidate)) {
          return false;
        }

        signal.connect(handleRequest);

        try {
          activeWindow.setMaximize?.(true, true);
        } catch (error) {
          if (observedModes.length === 0) {
            console.warn(
              `[driftile] stacked maximize request failed window=${String(candidate.activeId)} error=${String(error)}`,
            );
          }
        } finally {
          signal.disconnect(handleRequest);
        }

        return observedModes.length === 1 && observedModes[0] === 3;
      },
    );

    if (!operation) {
      if (observedModes.length === 0) {
        this.restoreStackedNativeStateRuntime(preparation);
      }

      this.finishStackedNativeStateOperation(preparation.transfer);
      this.scheduleDeferredRuntimeWork();
      return false;
    }

    return this.commitStackedNativeStateOperation(operation);
  }

  private extractStackedWindowForExternalMaximize(
    activeWindow: KWinWindow,
  ): void {
    const preparation = this.prepareStackedNativeState(
      activeWindow,
      "maximize",
      true,
    );

    if (!preparation) {
      return;
    }

    const operation = this.extractStackedNativeStateWindow(
      preparation,
      (candidate) => this.stackedNativeStateOperationIsCurrent(candidate),
    );

    if (!operation) {
      this.restoreStackedNativeStateRuntime(preparation);
      this.finishStackedNativeStateOperation(preparation.transfer);
      this.scheduleDeferredRuntimeWork();
      return;
    }

    if (!this.commitStackedNativeStateOperation(operation)) {
      console.warn(
        `[driftile] external stacked maximize extraction could not commit window=${String(operation.activeId)}`,
      );
    }
  }

  private prepareStackedNativeState(
    activeWindow: KWinWindow,
    state: StackedNativeState,
    external: boolean,
    suppliedCommand?: ActiveColumnCommand,
  ): StackedNativeStatePreparation | null {
    const command = suppliedCommand ?? this.prepareActiveColumnCommand();
    const membersAreEligible = Boolean(
      command &&
      (state === "fullscreen" && external
        ? this.columnMembersAreExternalFullscreenTransferEligible(
            command.activeColumn,
            command.context,
            command.activeId,
            activeWindow,
          )
        : this.columnMembersAreStackTransferEligible(
            command.activeColumn,
            command.context,
            command.activeId,
          )),
    );

    if (
      !command ||
      this.observer.source(command.activeId) !== activeWindow ||
      command.activeColumn.windowIds.length < 2 ||
      this.hasPendingCapacityState(command.context.key) ||
      this.pendingAdmissionContexts.has(command.context.key) ||
      this.waitingWindowIds.has(command.context.key) ||
      !membersAreEligible
    ) {
      return null;
    }

    let newColumnId: ColumnId;

    try {
      newColumnId = this.extractedColumnId(command);
    } catch {
      return null;
    }

    const requests = this.requestedSuspensions.get(command.activeId);
    const fullscreenRequestProbe = this.fullscreenRequestProbes.get(
      command.activeId,
    );
    const resumeSample = this.resumeSamples.get(command.activeId);
    const transientProbe = this.transientResumeProbes.get(command.activeId);
    const movingIds = new Set([command.activeId]);
    const transfer: WindowTransferOperation = {
      activeId: command.activeId,
      desktopChangeSuppressed: false,
      kind: "stack-native-state",
      movingIds,
      sourceContextKey: command.context.key,
      stateGuardIds: movingIds,
      targetContextKey: command.context.key,
    };

    return {
      activeId: command.activeId,
      activeWindow,
      before: command.before,
      command,
      external,
      newColumnId,
      runtime: {
        contextDirty: this.dirtyContexts.has(command.context.key),
        fullscreenRequestProbe: fullscreenRequestProbe
          ? { ...fullscreenRequestProbe }
          : null,
        lastTiledFocus: this.lastTiledFocus.get(command.context.key),
        originalActiveWindow: this.workspace.activeWindow,
        pendingAdmission: this.pendingAdmissionContexts.has(
          command.context.key,
        ),
        pendingFullscreenTarget: this.pendingFullscreenTargets.get(
          command.activeId,
        ),
        pendingWindowSync: this.pendingWindowSyncs.has(command.activeId),
        requestedSuspensions: requests ? new Set(requests) : null,
        resumeSample: resumeSample
          ? {
              contextKey: resumeSample.contextKey,
              frame: { ...resumeSample.frame },
            }
          : null,
        suspended: this.suspendedWindows.has(command.activeId),
        transientResumeProbe: transientProbe ? { ...transientProbe } : null,
      },
      sourceColumnId: command.activeColumn.id,
      sourceFullWidthRestore: this.columnFullWidthRestoreWidth(
        command.context.key,
        command.activeColumn.id,
      ),
      state,
      topologyRevision: this.topologyRevision,
      transfer,
    };
  }

  private extractStackedNativeStateWindow(
    preparation: StackedNativeStatePreparation,
    accept: (operation: StackedNativeStateOperation) => boolean,
  ): StackedNativeStateOperation | null {
    if (this.windowTransferOperation || this.stackedNativeStateOperation) {
      return null;
    }

    this.windowTransferOperation = preparation.transfer;
    const editState: { value: StackEditResult | null } = { value: null };
    let operation: StackedNativeStateOperation | null = null;
    let applied = false;

    try {
      applied = this.applyActiveColumnMutation(
        preparation.command,
        `stacked ${preparation.state} extraction`,
        () => {
          const candidate = this.layout.moveActiveWindow(
            preparation.activeId,
            "right",
            preparation.newColumnId,
          );

          if (!candidate) {
            return false;
          }

          if (candidate.kind !== "extract") {
            this.layout.rollbackStackEdit(candidate.rollback);
            return false;
          }

          editState.value = candidate;
          return true;
        },
        () =>
          Boolean(
            editState.value &&
            this.layout.rollbackStackEdit(editState.value.rollback),
          ),
        () => {
          const edit = editState.value;

          if (!edit) {
            return false;
          }

          const candidateOperation: StackedNativeStateOperation = {
            ...preparation,
            after: this.layout.snapshot(
              preparation.command.context.outputId,
              preparation.command.context.desktopId,
            ),
            edit,
          };
          operation = candidateOperation;
          this.stackedNativeStateOperation = candidateOperation;
          return accept(candidateOperation);
        },
      );
    } catch (error) {
      if (editState.value) {
        this.layout.rollbackStackEdit(editState.value.rollback);
      }

      console.warn(
        `[driftile] stacked ${preparation.state} extraction failed window=${String(preparation.activeId)} error=${String(error)}`,
      );
    }

    if (!applied) {
      if (editState.value) {
        this.layout.discardStackEditRollback(editState.value.rollback);
      }

      this.stackedNativeStateOperation = null;
      return null;
    }

    return operation;
  }

  private stackedNativeStateOperationIsCurrent(
    operation: StackedNativeStateOperation,
  ): boolean {
    const owner = this.managedWindows.get(operation.activeId);
    const source = this.observer.source(operation.activeId);
    const observed = source ? normalizeWindow(source) : null;
    const liveContext = observed ? managedContext(observed) : null;
    const snapshot = this.layout.snapshot(
      operation.command.context.outputId,
      operation.command.context.desktopId,
    );
    const sourceColumn = snapshot.columns.find(
      (column) => column.id === operation.sourceColumnId,
    );
    const extractedColumn = snapshot.columns.find(
      (column) => column.id === operation.newColumnId,
    );
    const activeStateIsCurrent =
      operation.state === "fullscreen" && operation.external
        ? operation.activeWindow.fullScreen &&
          !operation.activeWindow.minimized &&
          operation.activeWindow.maximizeMode === 0 &&
          !operation.activeWindow.move &&
          !operation.activeWindow.resize &&
          operation.activeWindow.tile === null &&
          this.suspendedWindows.has(operation.activeId) &&
          !this.requestedSuspensions.has(operation.activeId) &&
          !this.automaticFloatingWindows.has(operation.activeId) &&
          !this.automaticallyFloats(operation.activeWindow)
        : this.stackTransferMemberIsEligible(
            operation.activeId,
            operation.activeWindow,
            operation.command.context,
            false,
          );

    return (
      this.started &&
      this.windowTransferOperation === operation.transfer &&
      this.stackedNativeStateOperation === operation &&
      this.topologyRevision === operation.topologyRevision &&
      !this.hasTopologyBarrier() &&
      source === operation.activeWindow &&
      owner?.contextKey === operation.command.context.key &&
      liveContext !== null &&
      contextKey(liveContext) === operation.command.context.key &&
      String(this.workspace.activeWindow?.internalId) ===
        String(operation.activeId) &&
      activeStateIsCurrent &&
      layoutContextSnapshotsEqual(snapshot, operation.after) &&
      snapshot.activeColumnId === operation.newColumnId &&
      Boolean(
        sourceColumn &&
        sourceColumn.windowIds.length ===
          operation.command.activeColumn.windowIds.length - 1 &&
        !sourceColumn.windowIds.includes(operation.activeId) &&
        this.columnMembersAreStackTransferEligible(
          sourceColumn,
          operation.command.context,
          operation.activeId,
        ),
      ) &&
      Boolean(
        extractedColumn &&
        extractedColumn.windowIds.length === 1 &&
        extractedColumn.windowIds[0] === operation.activeId &&
        sameColumnWidth(
          extractedColumn.width,
          operation.command.activeColumn.width,
        ),
      )
    );
  }

  private commitStackedNativeStateOperation(
    operation: StackedNativeStateOperation,
  ): boolean {
    let committed = false;

    try {
      const owner = this.managedWindows.get(operation.activeId);
      const source = this.observer.source(operation.activeId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;
      const after = this.layout.snapshot(
        operation.command.context.outputId,
        operation.command.context.desktopId,
      );
      const extracted = after.columns.find(
        (column) => column.id === operation.newColumnId,
      );

      if (
        !this.started ||
        this.stackedNativeStateOperation !== operation ||
        this.windowTransferOperation !== operation.transfer ||
        this.topologyRevision !== operation.topologyRevision ||
        this.hasTopologyBarrier() ||
        source !== operation.activeWindow ||
        owner?.contextKey !== operation.command.context.key ||
        !liveContext ||
        contextKey(liveContext) !== operation.command.context.key ||
        String(this.workspace.activeWindow?.internalId) !==
          String(operation.activeId) ||
        !layoutContextSnapshotsEqual(after, operation.after) ||
        after.activeColumnId !== operation.newColumnId ||
        extracted?.windowIds.length !== 1 ||
        extracted.windowIds[0] !== operation.activeId
      ) {
        return false;
      }

      this.layout.discardStackEditRollback(operation.edit.rollback);
      this.reconcileColumnFullWidthRestore(
        operation.command.context.key,
        operation.before,
        after,
      );

      if (operation.sourceFullWidthRestore) {
        this.setColumnFullWidthRestore(
          operation.command.context.key,
          operation.newColumnId,
          operation.sourceFullWidthRestore,
        );
      }

      this.capacityParkBackoffs.delete(operation.command.context.key);
      committed = true;
      return true;
    } finally {
      if (!committed) {
        this.layout.discardStackEditRollback(operation.edit.rollback);
        this.markContextDirty(operation.command.context);

        if (this.observer.source(operation.activeId)) {
          this.pendingWindowSyncs.add(operation.activeId);
        }
      }

      this.finishStackedNativeStateOperation(operation.transfer);
      this.handleWindowActivated(this.workspace.activeWindow);
      this.scheduleDeferredRuntimeWork();
    }
  }

  private restoreStackedNativeStateRuntime(
    preparation: StackedNativeStatePreparation,
  ): void {
    const { activeId, command, runtime } = preparation;
    const activeWindowIsLive =
      this.observer.source(activeId) === preparation.activeWindow;

    if (activeWindowIsLive) {
      restoreRememberedFocus(
        this.lastTiledFocus,
        command.context.key,
        runtime.lastTiledFocus,
      );
    }
    restoreSetMembership(
      this.dirtyContexts,
      command.context.key,
      runtime.contextDirty,
    );
    restoreSetMembership(
      this.pendingAdmissionContexts,
      command.context.key,
      runtime.pendingAdmission,
    );
    restoreSetMembership(
      this.pendingWindowSyncs,
      activeId,
      runtime.pendingWindowSync,
    );
    restoreSetMembership(this.suspendedWindows, activeId, runtime.suspended);

    if (runtime.pendingFullscreenTarget === undefined) {
      this.pendingFullscreenTargets.delete(activeId);
    } else {
      this.pendingFullscreenTargets.set(
        activeId,
        runtime.pendingFullscreenTarget,
      );
    }

    if (runtime.fullscreenRequestProbe) {
      this.fullscreenRequestProbes.set(activeId, {
        ...runtime.fullscreenRequestProbe,
      });
    } else {
      this.fullscreenRequestProbes.delete(activeId);
    }

    if (runtime.requestedSuspensions) {
      this.requestedSuspensions.set(
        activeId,
        new Set(runtime.requestedSuspensions),
      );
    } else {
      this.requestedSuspensions.delete(activeId);
    }

    if (runtime.resumeSample) {
      this.resumeSamples.set(activeId, {
        contextKey: runtime.resumeSample.contextKey,
        frame: { ...runtime.resumeSample.frame },
      });
    } else {
      this.resumeSamples.delete(activeId);
    }

    if (runtime.transientResumeProbe) {
      this.transientResumeProbes.set(activeId, {
        ...runtime.transientResumeProbe,
      });
    } else {
      this.transientResumeProbes.delete(activeId);
    }

    const originalActiveWindow = runtime.originalActiveWindow;
    const originalActiveIsLive = Boolean(
      originalActiveWindow &&
      this.observer.source(String(originalActiveWindow.internalId)) ===
        originalActiveWindow,
    );

    if (
      this.workspace.activeWindow !== originalActiveWindow &&
      (originalActiveWindow === null || originalActiveIsLive)
    ) {
      try {
        this.workspace.activeWindow = originalActiveWindow;
      } catch (error) {
        console.warn(
          `[driftile] stacked ${preparation.state} focus restore failed window=${String(activeId)} error=${String(error)}`,
        );
      }
    }
  }

  private finishStackedNativeStateOperation(
    transfer: WindowTransferOperation,
  ): void {
    if (this.stackedNativeStateOperation?.transfer === transfer) {
      this.stackedNativeStateOperation = null;
    }

    if (this.windowTransferOperation === transfer) {
      this.windowTransferOperation = null;
    }
  }

  private applyActiveColumnMutation(
    command: ActiveColumnCommand,
    label: string,
    mutate: () => boolean,
    rollback: () => boolean,
    accept?: () => boolean,
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
    const mutationSources = new Map<WindowId, KWinWindow>();

    for (const id of rollbackWindowIds) {
      const source = this.observer.source(id);

      if (!source) {
        restoreLayout();
        return false;
      }

      mutationSources.set(id, source);
    }

    const observedBefore = this.geometry.observedFrames(
      rollbackWindowIds,
      context,
    );
    const rollbackLayout: WindowGeometry[] = [];

    for (const window of writableLayout) {
      const frame = observedBefore.get(window.windowId);

      if (
        !frame ||
        this.observer.source(window.windowId) !==
          mutationSources.get(window.windowId)
      ) {
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
    let dirtyDuringAcceptance = false;
    let forwardWrites = 0;
    let forwardError: string | null = null;

    try {
      forwardWrites = this.reconcileContext(
        context,
        sampledGeometries,
        (id) =>
          !this.hasTopologyBarrier() &&
          this.observer.source(id) === mutationSources.get(id),
      );
    } catch (error) {
      forwardError = String(error);
    }

    if (
      forwardError === null &&
      !this.hasTopologyBarrier() &&
      !this.dirtyContexts.has(context.key)
    ) {
      try {
        const accepted = !accept || accept();
        dirtyDuringAcceptance = this.dirtyContexts.has(context.key);

        if (accepted) {
          this.lastWrites = forwardWrites;
          return true;
        }

        forwardError = `${label} acceptance was rejected`;
      } catch (error) {
        dirtyDuringAcceptance = this.dirtyContexts.has(context.key);
        forwardError = String(error);
      }
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
      const compensationTargets = rollbackTargets.filter(
        (window) =>
          this.observer.source(window.windowId) ===
            mutationSources.get(window.windowId) &&
          this.windowOwnershipClassificationIsCurrent(window.windowId),
      );
      this.dirtyContexts.delete(context.key);
      compensationWrites = this.geometry.apply(
        compensationTargets,
        context,
        (change) =>
          !this.hasTopologyBarrier() &&
          this.observer.source(change.windowId) ===
            mutationSources.get(change.windowId) &&
          this.windowOwnershipClassificationIsCurrent(change.windowId),
      );

      if (
        compensationWrites !== rollbackTargets.length ||
        dirtyDuringAcceptance ||
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

    try {
      this.schedule(() => {
        if (this.runGeneration !== runGeneration) {
          return;
        }

        this.workScheduled = false;

        if (this.started) {
          this.flushScheduledWork();
        }
      });
    } catch (error) {
      this.workScheduled = false;
      console.warn(
        `[driftile] runtime work could not be scheduled error=${String(error)}`,
      );
    }
  }

  private flushScheduledWork(): void {
    if (this.stackEditOperation) {
      return;
    }

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

    if (
      !this.windowTransferOperation &&
      !this.stackedNativeStateOperation &&
      this.capacityParkOperations.size === 0
    ) {
      this.applyPendingDefaultColumnWidth();
      this.applyPendingGap();
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
    this.retryPendingExternalFullscreenExtractions();

    if (this.ownershipFollowUpRequired) {
      this.ownershipFollowUpRequired = false;
      this.scheduleWork();
    }

    if (
      (this.pendingDefaultColumnWidth !== null || this.pendingGap !== null) &&
      !this.windowTransferOperation &&
      !this.stackedNativeStateOperation &&
      this.capacityParkOperations.size === 0
    ) {
      this.scheduleWork();
    }
  }

  private applyPendingDefaultColumnWidth(): void {
    const width = this.pendingDefaultColumnWidth;

    if (!width) {
      return;
    }

    this.pendingDefaultColumnWidth = null;

    if (sameColumnWidth(this.defaultColumnWidth, width)) {
      return;
    }

    this.defaultColumnWidth = width;

    for (const key of this.waitingWindowIds.keys()) {
      this.pendingAdmissionContexts.add(key);
    }
  }

  private applyPendingGap(): void {
    const gap = this.pendingGap;

    if (gap === null) {
      return;
    }

    this.pendingGap = null;

    if (gap === this.gap) {
      return;
    }

    this.gap = gap;
    this.capacityParkBackoffs.clear();

    for (const context of this.contexts.values()) {
      this.markContextDirty(context);
    }

    for (const key of new Set([
      ...this.waitingWindowIds.keys(),
      ...this.capacityLeasesByContext.keys(),
    ])) {
      this.pendingAdmissionContexts.add(key);
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
        const width = metadata?.column.width
          ? { ...metadata.column.width }
          : this.constrainedDefaultColumnWidth(
              [candidate.source],
              contextGeometry,
            );

        if (!width) {
          this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
          continue;
        }

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
            width,
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

      candidates.push({ id, source });
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
      for (const candidate of candidates) {
        this.deferWindow(candidate.id, key);
      }

      if (this.initializing) {
        throw error;
      }

      console.warn(
        `[driftile] window admission group skipped context=${key} error=${String(error)}`,
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

    let admittedCandidates = candidates.filter((candidate) => {
      const width = this.constrainedDefaultColumnWidth(
        [candidate.source],
        contextGeometry,
      );

      if (!width) {
        this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
        return false;
      }

      const added = this.layout.manageWindow({
        columnId: columnId(`column:${String(candidate.id)}`),
        desktopId: context.desktopId,
        outputId: context.outputId,
        width,
        windowId: candidate.id,
      });

      if (!added) {
        this.forgetWaitingWindow(candidate.id);
      }

      return added;
    });

    while (admittedCandidates.length > 0) {
      let layout: ReturnType<typeof solveStripGeometry>;

      try {
        layout = this.solveContextGeometry(
          this.layout.snapshot(context.outputId, context.desktopId),
          contextGeometry,
        );
      } catch (error) {
        const rolledBack = this.layout.unmanageWindows({
          desktopId: context.desktopId,
          outputId: context.outputId,
          windowIds: admittedCandidates.map((candidate) => candidate.id),
        });

        if (!rolledBack) {
          throw Object.assign(
            new Error(
              `window admission group rollback failed context=${key} error=${String(error)}`,
            ),
            { cause: error },
          );
        }

        for (const candidate of admittedCandidates) {
          this.deferWindow(candidate.id, key, contextGeometry.fingerprint);
        }

        console.warn(
          `[driftile] window admission group deferred context=${key} error=${String(error)}`,
        );
        return 0;
      }

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

      const rejectedWindowIds = rejected.map((candidate) => candidate.id);
      const removed = this.layout.unmanageWindows({
        desktopId: context.desktopId,
        outputId: context.outputId,
        windowIds: rejectedWindowIds,
      });

      if (!removed) {
        throw new Error(
          `window admission group rejection rollback failed context=${key}`,
        );
      }

      const rejectedIds = new Set(rejectedWindowIds);

      for (const candidate of rejected) {
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

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch (error) {
      if (this.initializing) {
        throw error;
      }

      this.deferWindow(id, key);
      console.warn(
        `[driftile] window admission skipped window=${String(id)} error=${String(error)}`,
      );
      return false;
    }

    if (!contextGeometry) {
      this.deferWindow(id, key);
      return false;
    }

    const width = this.constrainedDefaultColumnWidth([source], contextGeometry);

    if (!width) {
      this.deferWindow(id, key, contextGeometry.fingerprint);
      return false;
    }

    const added = this.layout.manageWindow({
      columnId: columnId(`column:${observed.id}`),
      desktopId: context.desktopId,
      outputId: context.outputId,
      width,
      windowId: id,
    });

    if (!added) {
      this.forgetWaitingWindow(id);
      return false;
    }

    let decision: AdmissionDecision;

    try {
      decision = this.layoutAdmissionDecision(context, id, contextGeometry);
    } catch (error) {
      if (!this.layout.unmanageWindow(id)) {
        throw Object.assign(
          new Error(
            `window admission rollback failed window=${String(id)} error=${String(error)}`,
          ),
          { cause: error },
        );
      }

      this.deferWindow(id, key, contextGeometry.fingerprint);
      console.warn(
        `[driftile] window admission deferred window=${String(id)} error=${String(error)}`,
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

    const id = windowId(String(source.internalId));

    if (
      (this.managedWindows.has(id) || this.floatingWindows.has(id)) &&
      this.retainsFullscreenRequestGeometry(source)
    ) {
      return false;
    }

    const geometryBlocked = hasGeometryAuthorityBlocker(source);
    let resizeable: boolean;

    try {
      resizeable = source.resizeable;
    } catch {
      return !geometryBlocked;
    }

    if (typeof resizeable !== "boolean" || !resizeable) {
      return !geometryBlocked;
    }

    let constraintState:
      | typeof FIXED_SIZE_CONSTRAINTS
      | typeof FLEXIBLE_SIZE_CONSTRAINTS
      | typeof MALFORMED_SIZE_CONSTRAINTS;

    try {
      constraintState = fixedFrameSizeConstraintState(source);
    } catch {
      constraintState = MALFORMED_SIZE_CONSTRAINTS;
    }

    if (constraintState === MALFORMED_SIZE_CONSTRAINTS) {
      return !geometryBlocked;
    }

    return constraintState === FIXED_SIZE_CONSTRAINTS && !geometryBlocked;
  }

  private retainsFullscreenRequestGeometry(source: KWinWindow): boolean {
    const id = windowId(String(source.internalId));
    const pendingTarget = this.pendingFullscreenTargets.get(id);

    if (pendingTarget !== undefined) {
      if (source.fullScreen === pendingTarget) {
        this.settleFullscreenRequest(id, pendingTarget, true);
        this.queueFullscreenRequestGeometrySync(id);
        return false;
      }

      if (this.fullscreenRequestGeometryReverted(source, pendingTarget)) {
        this.pendingFullscreenTargets.delete(id);
        this.fullscreenRequestProbes.delete(id);
        this.queueFullscreenRequestGeometrySync(id);
        return false;
      }

      return true;
    }

    const target = this.unconfirmedFullscreenTargets.get(id);

    if (target === undefined) {
      return false;
    }

    if (
      source.fullScreen === target ||
      this.fullscreenRequestGeometryReverted(source, target)
    ) {
      this.deleteUnconfirmedFullscreenTarget(id);
      this.queueFullscreenRequestGeometrySync(id);
      return false;
    }

    return true;
  }

  private settleUnconfirmedFullscreenTargets(): void {
    if (!this.started || this.unconfirmedFullscreenTargets.size === 0) {
      return;
    }

    const generation = this.runGeneration;

    for (const id of [...this.unconfirmedFullscreenTargets.keys()]) {
      if (this.runGeneration !== generation) {
        return;
      }

      const retention = this.unconfirmedFullscreenRetentions.get(id);
      const source = this.observer.source(id);

      if (
        !retention ||
        retention.generation !== generation ||
        !source ||
        source !== retention.source ||
        source.deleted
      ) {
        this.deleteUnconfirmedFullscreenTarget(id);
        continue;
      }

      this.retainsFullscreenRequestGeometry(source);
    }
  }

  private fullscreenRequestGeometryReverted(
    source: KWinWindow,
    target: boolean,
  ): boolean {
    let moveable: boolean;
    let resizeable: boolean;

    try {
      moveable = source.moveable;
      resizeable = source.resizeable;
    } catch {
      return false;
    }

    if (typeof moveable !== "boolean" || typeof resizeable !== "boolean") {
      return false;
    }

    return target ? moveable && resizeable : !moveable && !resizeable;
  }

  private queueFullscreenRequestGeometrySync(id: WindowId): void {
    this.pendingWindowSyncs.add(id);

    if (!this.windowTransferOperation) {
      this.scheduleWork();
    }
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
    canContinueWriting?: (id: WindowId) => boolean,
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
        (canContinueWriting?.(change.windowId) ?? true),
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
    contextGeometry: ContextGeometry,
  ): AdmissionDecision {
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

  private constrainedDefaultColumnWidth(
    sources: readonly KWinWindow[],
    contextGeometry: ContextGeometry,
  ): ColumnWidth | null {
    const devicePixelRatio = contextGeometry.devicePixelRatio;

    if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
      return null;
    }

    let minimum = MINIMUM_COLUMN_WIDTH;
    let maximum = Number.POSITIVE_INFINITY;

    for (const source of sources) {
      const bounds = frameSizeConstraintBounds(source);

      if (!bounds) {
        return null;
      }

      if (Number.isFinite(bounds.minimumWidth) && bounds.minimumWidth > 0) {
        minimum = Math.max(minimum, bounds.minimumWidth);
      }

      if (Number.isFinite(bounds.maximumWidth) && bounds.maximumWidth > 0) {
        maximum = Math.min(maximum, bounds.maximumWidth);
      }
    }

    minimum = ceilToPhysicalPixel(minimum, devicePixelRatio);

    if (Number.isFinite(maximum)) {
      maximum = floorToPhysicalPixel(maximum, devicePixelRatio);
    }

    if (maximum < minimum) {
      return null;
    }

    let requestedWidth: number;

    if (this.defaultColumnWidth.kind === "fixed") {
      requestedWidth = this.defaultColumnWidth.value;
    } else {
      const denominator = contextGeometry.workArea.width - this.gap;

      if (!Number.isFinite(denominator) || denominator <= 0) {
        return { kind: "fixed", value: minimum };
      }

      requestedWidth = this.defaultColumnWidth.value * denominator - this.gap;
    }

    if (!Number.isFinite(requestedWidth) || requestedWidth <= 0) {
      return { kind: "fixed", value: minimum };
    }

    if (
      requestedWidth <=
      minimum + floatingPointTolerance(requestedWidth, minimum)
    ) {
      return { kind: "fixed", value: minimum };
    }

    if (
      Number.isFinite(maximum) &&
      requestedWidth >=
        maximum - floatingPointTolerance(requestedWidth, maximum)
    ) {
      return { kind: "fixed", value: maximum };
    }

    return { ...this.defaultColumnWidth };
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

function layerFocusContext(window: KWinWindow): ManagedContext | null {
  const observed = normalizeWindow(window);
  const desktop = observed?.desktopIds[0];

  if (!observed || observed.desktopIds.length !== 1 || !desktop) {
    return null;
  }

  return {
    desktopId: desktopId(desktop),
    outputId: outputId(observed.outputId),
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

function restoreRememberedFocus(
  remembered: Map<string, WindowId>,
  key: string,
  id: WindowId | undefined,
): void {
  if (id === undefined) {
    remembered.delete(key);
  } else {
    remembered.set(key, id);
  }
}

function restoreSetMembership<T>(
  values: Set<T>,
  value: T,
  included: boolean,
): void {
  if (included) {
    values.add(value);
  } else {
    values.delete(value);
  }
}

function layoutContextSnapshotsEqual(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  if (
    left.activeColumnId !== right.activeColumnId ||
    left.desktopId !== right.desktopId ||
    left.outputId !== right.outputId ||
    left.viewportOffset !== right.viewportOffset ||
    left.columns.length !== right.columns.length
  ) {
    return false;
  }

  return left.columns.every((column, columnIndex) => {
    const candidate = right.columns[columnIndex];

    if (
      !candidate ||
      column.id !== candidate.id ||
      column.width.kind !== candidate.width.kind ||
      column.width.value !== candidate.width.value ||
      column.windowIds.length !== candidate.windowIds.length ||
      column.windowHeights?.length !== candidate.windowHeights?.length ||
      column.windowIds.some(
        (id, memberIndex) => id !== candidate.windowIds[memberIndex],
      )
    ) {
      return false;
    }

    return (column.windowHeights ?? []).every((height, memberIndex) => {
      const other = candidate.windowHeights?.[memberIndex];

      if (!other || height.kind !== other.kind) {
        return false;
      }

      switch (height.kind) {
        case "auto":
          return other.kind === "auto" && height.weight === other.weight;
        case "fixed":
          return (
            other.kind === "fixed" && height.clientHeight === other.clientHeight
          );
        case "preset":
          return other.kind === "preset" && height.index === other.index;
      }
    });
  });
}

function validDesktopIndex(index: number): boolean {
  return Number.isInteger(index) && index > 0;
}

function normalizeDefaultColumnWidthPercent(value: number): number | null {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_DEFAULT_COLUMN_WIDTH_PERCENT &&
    value <= MAX_DEFAULT_COLUMN_WIDTH_PERCENT
    ? value
    : null;
}

function normalizeResizeStepPercent(value: number): number | null {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_RESIZE_STEP_PERCENT &&
    value <= MAX_RESIZE_STEP_PERCENT
    ? value
    : null;
}

function normalizeGap(value: number): number | null {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_GAP &&
    value <= MAX_GAP
    ? value
    : null;
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
