import {
  EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  sameApplicationColumnWidthOverrides,
  type ApplicationColumnWidthOverrides,
} from "./application-overrides";
import {
  EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  sameApplicationBorderlessExclusions,
  type ApplicationBorderlessExclusions,
} from "./application-borderless-exclusions";
import {
  EMPTY_APPLICATION_TILING_EXCLUSIONS,
  sameApplicationTilingExclusions,
  type ApplicationTilingExclusions,
} from "./application-tiling-exclusions";
import { COLUMN_WIDTH_PRESET_LIMITS } from "./column-width-presets";
import {
  DEFAULT_WINDOW_HEIGHT_PRESETS,
  solveStripGeometry,
  type Point,
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
  planLayoutHydration,
  type LayoutPersistenceHydrationContext,
  type LayoutPersistenceHydrationInput,
  type LayoutPersistenceHydrationPlan,
  type LayoutPersistenceHydrationRestoreBaselineValue,
} from "./core/layout-persistence-hydration";
import type {
  LayoutPersistenceCatalogSnapshot,
  LayoutPersistenceTopologyV2,
} from "./core/layout-persistence-catalog";
import { planKnownOutputLayoutHydration } from "./core/layout-persistence-known-output";
import { matchPersistedOutputs } from "./core/layout-persistence-match";
import {
  captureLayoutPersistence,
  type LayoutPersistenceCaptureRestoreBaseline,
} from "./core/layout-persistence-capture";
import {
  decodeLayoutPersistence,
  type LayoutPersistenceV1,
} from "./core/layout-persistence";
import {
  findAdjacentOutput,
  type OutputDirection,
} from "./core/output-navigation";
import { diffWindowGeometries } from "./core/reconcile";
import {
  planPointerExternalWindowDrop,
  planPointerWindowDrop,
  type PointerWindowDropTarget,
} from "./core/pointer-reinsertion";
import {
  inferPointerHorizontalResize,
  type PointerHorizontalResizeEdge,
} from "./core/pointer-resize";
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
  type FrameSizeConstraintBounds,
  type KWinRectFactory,
} from "./platform/kwin/geometry-adapter";
import {
  layoutPersistenceOutputDescriptor,
  layoutPersistenceWindowDescriptor,
} from "./platform/kwin/persistence-descriptors";
import {
  normalizeWindow,
  WindowObserver,
  type ObservedWindowChangeCause,
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
const MAX_POINTER_EXTERNAL_CONTEXT_PROBES = 20;
const MAX_POINTER_RESIZE_COMPENSATION_PROBES = 40;
const MAX_POINTER_RESIZE_SETTLEMENT_PROBES = 20;
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
const MAX_MANUAL_FLOATING_WIDTH_SETTLEMENT_PROBES = 20;
const FIXED_SIZE_CONSTRAINTS = 1;
const FLEXIBLE_SIZE_CONSTRAINTS = 0;
const MALFORMED_SIZE_CONSTRAINTS = -1;
const FLOATING_WINDOW_MOVE_STEP = 50;
const MAXIMUM_FLOATING_WINDOW_VISIBLE_EXTENT = 75;
const MINIMUM_FLOATING_WINDOW_VISIBLE_EXTENT = 10;
const MAX_CAPACITY_PARK_ATTEMPTS = 20;
const MAX_BORDERLESS_SETTLEMENT_PROBES = 20;
const MAX_EXTERNAL_FULLSCREEN_EXTRACTION_ATTEMPTS = 20;
const MAX_FULLSCREEN_REQUEST_PROBES = 20;
const MAX_LAYOUT_HYDRATION_PROBES = 1_000;
const MAX_STACK_EDIT_FOCUS_PROBES = 20;
const MAX_TOPOLOGY_SAMPLE_ATTEMPTS = 20;
const MAX_TRANSIENT_RESUME_PROBES = 20;
const MINIMUM_COLUMN_WIDTH = 64;
const REQUIRED_CAPACITY_PARK_SAMPLES = 2;
const REQUIRED_POINTER_RESIZE_COMPENSATION_SAMPLES = 20;
const REQUIRED_POINTER_RESIZE_SETTLEMENT_SAMPLES = 2;
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
  readonly currentContextKey: string;
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

interface PointerMoveParticipant {
  readonly id: WindowId;
  readonly stateRevision: number;
  readonly window: KWinWindow;
}

interface PointerExternalDropIntent {
  completedAttempts: number;
  readonly context: ManagedContext;
  readonly contextKey: string;
  readonly desktop: KWinVirtualDesktop;
  insertion: PointerExternalInsertionIntent;
  readonly kind: "desktop" | "output";
  readonly output: KWinOutput;
  probePending: boolean;
}

type PointerExternalInsertionIntent =
  | { readonly state: "pending" }
  | { readonly state: "unavailable" }
  | PointerExternalReadyInsertionIntent;

interface PointerExternalReadyInsertionIntent {
  readonly contextFingerprint: string;
  readonly layout: LayoutContextSnapshot;
  readonly participants: readonly PointerMoveParticipant[];
  readonly runtimeContext: RuntimeContext;
  readonly state: "ready";
  readonly target: PointerWindowDropTarget;
}

interface PointerExternalSettledContext {
  readonly contextGeometry: ContextGeometry;
  readonly runtimeContext: RuntimeContext;
}

interface PointerMoveIntent {
  readonly before: LayoutContextSnapshot;
  readonly contextFingerprint: string;
  readonly contextKey: string;
  readonly initialFrame: Rect;
  readonly draggedWindowId: WindowId;
  readonly externalDrop: PointerExternalDropIntent | null;
  readonly finishedFrame: Rect | null;
  readonly finalCursor: Point | null;
  readonly gap: number;
  readonly generation: number;
  readonly participants: readonly PointerMoveParticipant[];
  readonly phase: "dragging" | "finished";
  readonly source: KWinWindow;
  readonly sourceDesktop: KWinVirtualDesktop;
  readonly sourceOutput: KWinOutput;
  readonly topologyRevision: number;
}

interface PointerResizeParticipant {
  readonly beforeFrame: Rect;
  readonly constraints: FrameSizeConstraintBounds;
  readonly id: WindowId;
  readonly stateRevision: number;
  readonly window: KWinWindow;
}

interface PointerResizeIntent {
  readonly acceptedFrame: Rect | null;
  readonly activeColumnId: ColumnId;
  readonly before: LayoutContextSnapshot;
  readonly beforeFrame: Rect;
  readonly contextFingerprint: string;
  readonly contextKey: string;
  readonly edge: PointerHorizontalResizeEdge | null;
  readonly gap: number;
  readonly generation: number;
  readonly participants: readonly PointerResizeParticipant[];
  readonly phase: "finished" | "resizing";
  readonly resizedWindowId: WindowId;
  readonly source: KWinWindow;
  readonly sourceDesktop: KWinVirtualDesktop;
  readonly sourceOutput: KWinOutput;
  readonly topologyRevision: number;
}

interface PointerResizeSettlementWindow {
  readonly columnId: ColumnId;
  readonly constraints: FrameSizeConstraintBounds;
  readonly id: WindowId;
  readonly rollbackFrame: Rect;
  readonly source: KWinWindow;
  readonly stateRevision: number;
  readonly targetFrame: Rect;
}

interface PointerResizeSettlement {
  attempts: number;
  readonly command: ActiveColumnCommand;
  compensationWrites: number;
  failure: string | null;
  readonly forwardAttemptedIds: Set<WindowId>;
  forwardWrites: number;
  readonly intent: PointerResizeIntent;
  pending: boolean;
  phase: "compensating" | "forward";
  stableSamples: number;
  readonly targetLayout: LayoutContextSnapshot;
  readonly targetWidth: ColumnWidth;
  readonly windowById: ReadonlyMap<WindowId, PointerResizeSettlementWindow>;
  readonly windows: readonly PointerResizeSettlementWindow[];
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

interface ManualFloatingFrameCommand extends ActiveWindowCommand {
  readonly desktop: KWinVirtualDesktop;
  readonly floating: FloatingWindow;
  readonly originalFrame: KWinWindow["frameGeometry"];
  readonly output: KWinOutput;
  readonly stateRevision: number;
  readonly topologyRevision: number;
}

interface PendingManualFloatingWidthChange {
  readonly command: ManualFloatingFrameCommand;
  readonly constraintBounds: FrameSizeConstraintBounds;
  readonly decorationWidth: number;
  readonly handleFrameGeometryChanged: (
    oldGeometry: KWinWindow["frameGeometry"],
  ) => void;
  readonly signal: NonNullable<KWinWindow["frameGeometryChanged"]>;
  settlementAttempts: number;
  status: "accepted" | "pending" | "rejected";
  readonly targetFrame: Rect;
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

interface KnownOutputTopologyRestoration {
  readonly outputId: OutputId;
  readonly plan: LayoutPersistenceHydrationPlan;
  readonly topologyRevision: number;
}

interface KnownOutputAdmissionCandidate extends AdmissionCandidate {
  readonly fingerprint: string;
  readonly restoreBaseline: RestoreBaseline | null;
  readonly suspended: boolean;
}

interface KnownOutputAdmissionContext {
  readonly candidates: readonly KnownOutputAdmissionCandidate[];
  readonly context: ManagedContext;
  readonly contextGeometry: ContextGeometry;
  readonly planned: LayoutPersistenceHydrationContext;
  readonly targetFrames: ReadonlyMap<WindowId, Rect>;
}

interface TopologyAdmissionGroup {
  readonly context: ManagedContext;
  readonly sources: KWinWindow[];
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

type InitialLayoutHydrationStatus = "failed" | "none" | "pending" | "succeeded";

interface LayoutHydrationWindowSnapshot {
  readonly contextKey: string;
  readonly fingerprint: string;
  readonly source: KWinWindow;
  readonly suspended: boolean;
  readonly targetFrame: Rect | null;
}

interface LayoutHydrationCandidate {
  readonly contextGeometryFingerprints: ReadonlyMap<string, string>;
  readonly contexts: ReadonlyMap<string, RuntimeContext>;
  readonly floatingWindows: ReadonlyMap<WindowId, FloatingWindow>;
  readonly fullWidthRestores: ReadonlyMap<
    string,
    ReadonlyMap<ColumnId, ColumnWidth>
  >;
  readonly fullWidthViewportRestores: ReadonlyMap<
    string,
    ReadonlyMap<ColumnId, number>
  >;
  readonly hydratedWindowIds: ReadonlySet<WindowId>;
  readonly layout: LayoutEngine;
  readonly managedWindows: ReadonlyMap<WindowId, ManagedWindow>;
  readonly restoreBaselinePendingWindowIds: ReadonlySet<WindowId>;
  readonly suspendedWindowIds: ReadonlySet<WindowId>;
  readonly topologyFingerprint: string;
  readonly windows: ReadonlyMap<WindowId, LayoutHydrationWindowSnapshot>;
}

export interface RuntimeControllerOptions {
  readonly applicationBorderlessExclusions?: ApplicationBorderlessExclusions;
  readonly applicationColumnWidths?: ApplicationColumnWidthOverrides;
  readonly applicationTilingExclusions?: ApplicationTilingExclusions;
  readonly borderlessWindows?: boolean;
  readonly centerFocusedColumn?: boolean;
  readonly clientAreaOption: number;
  readonly columnWidth?: ColumnWidth;
  readonly columnWidthPresets?: readonly ColumnWidth[];
  readonly createRect?: KWinRectFactory;
  readonly gap?: number;
  readonly layoutHydrationQuietSamples?: number;
  readonly layoutHydrationRetryProbes?: number;
  readonly layoutStateForCurrentTopology?: () => string;
  readonly knownLayoutSnapshots?: () => readonly LayoutPersistenceCatalogSnapshot[];
  readonly onLayoutStateChanged?: (canonicalState: string) => void;
  readonly schedule?: (callback: () => void) => void;
  readonly scheduleResume?: (callback: () => void) => void;
  readonly startupStabilizationProbes?: number;
  readonly windowHeightPresets?: readonly ColumnWidth[];
}

export class RuntimeController {
  private applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  private applicationColumnWidths: ApplicationColumnWidthOverrides;
  private applicationTilingExclusions: ApplicationTilingExclusions;
  private readonly automaticFloatingWindows = new Set<WindowId>();
  private readonly borderlessSettlementEnabled: boolean;
  private readonly borderlessSettlementTokens = new Map<WindowId, object>();
  private borderlessContextReconciliationPending = false;
  private borderlessReconciliationPending = false;
  private borderlessWindows: boolean;
  private readonly borderSynchronizationIds = new Set<WindowId>();
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
  private centerFocusedColumn: boolean;
  private readonly committedOutputRanks = new Map<OutputId, number>();
  private readonly columnFullWidthRestore = new Map<
    string,
    Map<ColumnId, ColumnWidth>
  >();
  private readonly columnFullWidthViewportRestore = new Map<
    string,
    Map<ColumnId, number>
  >();
  private columnWidthStep = DEFAULT_COLUMN_WIDTH_STEP_PERCENT / 100;
  private columnWidthPresets: readonly ColumnWidth[];
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
  private hydrationInProgress = false;
  private initialLayoutDecodedState: LayoutPersistenceV1 | null = null;
  private initialLayoutHydrationCandidateFingerprint: string | null = null;
  private readonly initialLayoutHydrationQuietSamples: number;
  private initialLayoutHydrationRetryRemaining = 0;
  private readonly initialLayoutHydrationRetryProbes: number;
  private initialLayoutHydrationRetryToken: object | null = null;
  private initialLayoutHydrationStableSamples = 0;
  private initialLayoutHydrationWaited = false;
  private initialLayoutHydrationStatus: InitialLayoutHydrationStatus = "none";
  private readonly layoutStateForCurrentTopology: (() => string) | undefined;
  private initialLayoutStateDocument: string | null = null;
  private initializing = false;
  private readonly lastFloatingFocus = new Map<string, WindowId>();
  private readonly lastTiledFocus = new Map<string, WindowId>();
  private ownershipFollowUpRequired = false;
  private ownershipRefreshInProgress = false;
  private readonly knownOutputInstances = new Map<string, number>();
  private readonly knownLayoutSnapshots:
    (() => readonly LayoutPersistenceCatalogSnapshot[]) | undefined;
  private lastSettledTopology: LayoutPersistenceTopologyV2 | null = null;
  private lastOutputCount = 0;
  private lastWrites = 0;
  private lastPublishedLayoutState: string | null = null;
  private layout = new LayoutEngine();
  private layoutStatePublicationLocked = false;
  private layoutStatePublicationPending = false;
  private layoutTopologyPublicationPending = false;
  private preserveLoadedLayoutState = false;
  private preservedFallbackLayoutState: string | null = null;
  private readonly managedWindows = new Map<WindowId, ManagedWindow>();
  private readonly pendingFullscreenTargets = new Map<WindowId, boolean>();
  private readonly pendingHydratedRestoreBaselines = new Set<WindowId>();
  private readonly pendingManualFloatingWidthChanges = new Map<
    WindowId,
    PendingManualFloatingWidthChange
  >();
  private readonly observer: WindowObserver;
  private readonly onLayoutStateChanged:
    ((canonicalState: string) => void) | undefined;
  private readonly pendingAdmissionContexts = new Set<string>();
  private interactiveResizeSource: KWinWindow | null = null;
  private pointerMoveIntent: PointerMoveIntent | null = null;
  private pointerResizeIntent: PointerResizeIntent | null = null;
  private pointerResizeSettlement: PointerResizeSettlement | null = null;
  private pendingDefaultColumnWidth: ColumnWidth | null = null;
  private pendingGap: number | null = null;
  private readonly pendingWindowSyncs = new Set<WindowId>();
  private readonly resumeSamples = new Map<WindowId, ResumeSample>();
  private readonly schedule: (callback: () => void) => void;
  private readonly scheduleResume: (callback: () => void) => void;
  private pendingMutationWrites = 0;
  private scheduledMutationWrites = 0;
  private workFlushDepth = 0;
  private runGeneration = 0;
  private readonly startupStabilizationProbes: number;
  private startupStabilizationRemaining = 0;
  private startupStabilizationToken: object | null = null;
  private started = false;
  private startupCompleted = false;
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
  private readonly topologyKnownOutputRestorations = new Map<
    OutputId,
    KnownOutputTopologyRestoration
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
  private readonly windowDesktopFileNames = new Map<WindowId, string | null>();
  private readonly windowStateRevisions = new Map<WindowId, number>();
  private workScheduled = false;
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, options: RuntimeControllerOptions) {
    this.applicationBorderlessExclusions =
      options.applicationBorderlessExclusions ??
      EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS;
    this.applicationColumnWidths =
      options.applicationColumnWidths ??
      EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES;
    this.applicationTilingExclusions =
      options.applicationTilingExclusions ??
      EMPTY_APPLICATION_TILING_EXCLUSIONS;
    this.borderlessSettlementEnabled = options.scheduleResume !== undefined;
    this.borderlessWindows = options.borderlessWindows ?? false;
    this.centerFocusedColumn =
      typeof options.centerFocusedColumn === "boolean"
        ? options.centerFocusedColumn
        : false;
    this.gap = normalizeGap(options.gap ?? DEFAULT_GAP) ?? DEFAULT_GAP;
    this.initialLayoutHydrationQuietSamples = normalizeProbeCount(
      options.layoutHydrationQuietSamples ?? 2,
      1,
    );
    this.initialLayoutHydrationRetryProbes = normalizeProbeCount(
      options.layoutHydrationRetryProbes ?? 0,
      0,
    );
    this.layoutStateForCurrentTopology = options.layoutStateForCurrentTopology;
    this.knownLayoutSnapshots = options.knownLayoutSnapshots;
    this.onLayoutStateChanged = options.onLayoutStateChanged;
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
      interactiveMoveFinished: this.handleInteractiveMoveFinished,
      interactiveMoveStarted: this.handleInteractiveMoveStarted,
      interactiveResizeFinished: this.handleInteractiveResizeFinished,
      interactiveResizeStarted: this.handleInteractiveResizeStarted,
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

  captureLayoutState(): string | null {
    if (!this.layoutCaptureReady()) {
      return null;
    }

    try {
      const contexts = [...this.contexts.values()].map((context) => ({
        key: context.key,
        layout: this.layout.snapshot(context.outputId, context.desktopId),
      }));
      const fullWidthRestores: Array<{
        readonly columnId: ColumnId;
        readonly contextKey: string;
        readonly viewportOffset?: number;
        readonly width: ColumnWidth;
      }> = [];

      for (const [contextKey, restores] of this.columnFullWidthRestore) {
        for (const [columnId, width] of restores) {
          const viewportOffset = this.columnFullWidthRestoreViewportOffset(
            contextKey,
            columnId,
          );
          fullWidthRestores.push({
            columnId,
            contextKey,
            ...(viewportOffset === undefined ? {} : { viewportOffset }),
            width,
          });
        }
      }

      const restoreBaselines: LayoutPersistenceCaptureRestoreBaseline[] = [];

      for (const [liveId, managed] of this.managedWindows) {
        const baseline = managed.restoreBaseline;
        const context = this.contexts.get(managed.contextKey);

        if (
          !baseline ||
          !context ||
          baseline.fingerprint !== context.geometryFingerprint
        ) {
          continue;
        }

        restoreBaselines.push({
          baseline: {
            clientFrame: snapshotRect(baseline.clientFrame),
            fingerprint: baseline.fingerprint,
            frame: snapshotRect(baseline.frame),
            kind: baseline.kind,
            noBorder: baseline.noBorder ?? null,
          },
          contextKey: managed.contextKey,
          liveId: String(liveId),
        });
      }

      const floatingWindows = [...this.floatingWindows].map(
        ([liveId, floating]) => ({
          liveId: String(liveId),
          placement: this.captureFloatingWindowPlacement(liveId, floating),
        }),
      );

      this.validateCapturedOwnership(contexts, floatingWindows);
      return captureLayoutPersistence({
        contexts,
        floatingWindows,
        fullWidthRestores,
        liveOutputs: this.workspace.screens.map(
          layoutPersistenceOutputDescriptor,
        ),
        liveWindows: this.observer
          .snapshot()
          .map((window) =>
            layoutPersistenceWindowDescriptor(
              window.id,
              this.observer.source(window.id),
            ),
          ),
        restoreBaselines,
      });
    } catch (error) {
      console.warn(
        `[driftile] layout persistence capture skipped error=${String(error)}`,
      );
      return null;
    }
  }

  private captureFloatingWindowPlacement(
    id: WindowId,
    floating: FloatingWindow,
  ): DetachedWindowPlacement {
    const anchorContextKey = contextKey({
      desktopId: floating.placement.desktopId,
      outputId: floating.placement.outputId,
    });

    if (floating.sourceContextKey !== anchorContextKey) {
      throw new Error(
        "Cannot capture layout persistence while a floating anchor is inconsistent",
      );
    }

    const source = this.observer.source(id);
    const observed = source ? normalizeWindow(source) : null;
    const liveContext = observed ? managedContext(observed) : null;
    const liveContextKey = liveContext ? contextKey(liveContext) : null;

    if (
      !source ||
      !liveContext ||
      floating.currentContextKey !== liveContextKey ||
      this.managedWindows.has(id) ||
      this.automaticFloatingWindows.has(id) ||
      this.waitingWindowContexts.has(id) ||
      this.automaticallyFloats(source)
    ) {
      const caption = (source as { readonly caption?: unknown } | undefined)
        ?.caption;
      throw new Error(
        `Cannot capture layout persistence with stale floating ownership window=${String(id)} caption=${JSON.stringify(typeof caption === "string" ? caption : null)} liveContext=${JSON.stringify(liveContextKey)} currentContext=${JSON.stringify(floating.currentContextKey)} anchorContext=${JSON.stringify(anchorContextKey)}`,
      );
    }

    if (floating.sourceContextKey === liveContextKey) {
      return floating.placement;
    }

    const contextGeometry = this.geometry.contextGeometry(
      liveContext.outputId,
      liveContext.desktopId,
    );

    if (!contextGeometry) {
      throw new Error(
        "Cannot capture layout persistence without floating context geometry",
      );
    }

    const placement = this.freshDetachedWindowPlacement(
      id,
      source,
      liveContext,
      contextGeometry,
      this.layout.snapshot(liveContext.outputId, liveContext.desktopId),
    );

    if (!placement) {
      throw new Error(
        "Cannot capture layout persistence without a safe floating placement",
      );
    }

    return placement;
  }

  requestLayoutStatePublication(): void {
    if (
      this.onLayoutStateChanged === undefined ||
      !this.started ||
      !this.startupCompleted ||
      this.layoutStatePublicationLocked
    ) {
      return;
    }

    this.preserveLoadedLayoutState = false;
    this.preservedFallbackLayoutState = null;
    this.layoutStatePublicationPending = true;
  }

  flushLayoutStatePublication(): boolean {
    if (
      this.layoutStatePublicationLocked ||
      !this.layoutStatePublicationPending ||
      this.onLayoutStateChanged === undefined
    ) {
      return false;
    }

    const canonicalState = this.captureLayoutState();

    if (canonicalState === null) {
      return false;
    }

    if (
      canonicalState === this.lastPublishedLayoutState &&
      !this.layoutTopologyPublicationPending
    ) {
      this.layoutStatePublicationPending = false;
      return false;
    }

    try {
      this.onLayoutStateChanged(canonicalState);
    } catch (error) {
      console.warn(
        `[driftile] layout state publication failed error=${String(error)}`,
      );
      return false;
    }

    this.lastPublishedLayoutState = canonicalState;
    this.layoutStatePublicationPending = false;
    this.layoutTopologyPublicationPending = false;
    return true;
  }

  finalizeLayoutStatePublication(): boolean {
    if (
      this.onLayoutStateChanged === undefined ||
      !this.started ||
      !this.startupCompleted ||
      this.layoutStatePublicationLocked
    ) {
      return false;
    }

    const previouslyPublishedState = this.lastPublishedLayoutState;

    try {
      if (this.workScheduled) {
        this.workScheduled = false;
        this.flushScheduledWork();
      }

      if (
        this.preserveLoadedLayoutState &&
        !this.layoutStatePublicationPending
      ) {
        return false;
      }

      this.requestLayoutStatePublication();
      this.flushLayoutStatePublication();
    } catch (error) {
      console.warn(
        `[driftile] layout state finalization failed error=${String(error)}`,
      );
      return false;
    }

    return this.lastPublishedLayoutState !== previouslyPublishedState;
  }

  setBorderlessWindows(enabled: boolean): void {
    if (this.borderlessWindows === enabled) {
      return;
    }

    this.borderlessWindows = enabled;

    if (!this.started) {
      return;
    }

    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeSettlement !== null
    ) {
      this.borderlessReconciliationPending = true;
      this.borderlessContextReconciliationPending = true;
      return;
    }

    this.applyBorderlessWindowSetting(true);
  }

  setApplicationBorderlessExclusions(
    exclusions: ApplicationBorderlessExclusions,
  ): boolean {
    if (
      sameApplicationBorderlessExclusions(
        this.applicationBorderlessExclusions,
        exclusions,
      )
    ) {
      return false;
    }

    this.applicationBorderlessExclusions = exclusions;

    if (!this.started || !this.borderlessWindows) {
      return true;
    }

    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeSettlement !== null
    ) {
      this.borderlessReconciliationPending = true;
      return true;
    }

    this.applyBorderlessWindowSetting(false);
    return true;
  }

  private applyBorderlessWindowSetting(reconcileContexts: boolean): void {
    const shouldReconcileContexts =
      reconcileContexts || this.borderlessContextReconciliationPending;
    this.borderlessReconciliationPending = false;
    this.borderlessContextReconciliationPending = false;

    if (!this.borderlessWindows) {
      this.restoreWindowBorders();

      if (shouldReconcileContexts) {
        this.reconcileBorderAffectedContexts();
      }

      return;
    }

    this.synchronizeWindowBorders();

    if (shouldReconcileContexts) {
      this.reconcileBorderAffectedContexts();
    }
  }

  private layoutCaptureReady(): boolean {
    return !(
      !this.started ||
      this.hydrationInProgress ||
      this.initializing ||
      this.startupStabilizationRemaining > 0 ||
      this.startupStabilizationToken !== null ||
      this.pendingExpelFocusHandoff !== null ||
      this.interactiveResizeSource !== null ||
      this.pointerMoveIntent !== null ||
      this.pointerResizeIntent !== null ||
      this.pointerResizeSettlement !== null ||
      this.stackEditOperation !== null ||
      this.windowTransferOperation !== null ||
      this.stackedNativeStateOperation !== null ||
      this.topologyRecoveryPending ||
      this.hasTopologyBarrier() ||
      this.capacityParkOperations.size > 0 ||
      this.capacityCanceledParks.size > 0 ||
      this.capacityLeasesByContext.size > 0 ||
      this.pendingWindowSyncs.size > 0 ||
      this.pendingExternalFullscreenExtractions.size > 0 ||
      this.pendingFullscreenTargets.size > 0 ||
      this.unconfirmedFullscreenRetentions.size > 0 ||
      this.unconfirmedFullscreenTargets.size > 0 ||
      this.fullscreenRequestProbes.size > 0 ||
      this.toggleGeometryTransitions.size > 0 ||
      this.ownershipRefreshInProgress ||
      this.ownershipFollowUpRequired ||
      this.workScheduled ||
      this.desktopLifecycle.unsettled
    );
  }

  private validateCapturedOwnership(
    contexts: readonly {
      readonly key: string;
      readonly layout: LayoutContextSnapshot;
    }[],
    floatingWindows: readonly {
      readonly liveId: string;
      readonly placement: DetachedWindowPlacement;
    }[],
  ): void {
    const capturedManagedIds = new Set<WindowId>();

    for (const captured of contexts) {
      const runtimeContext = this.contexts.get(captured.key);
      const layoutIds = new Set<WindowId>();

      if (!runtimeContext) {
        throw new Error(
          "Cannot capture layout persistence with a missing runtime context",
        );
      }

      if (
        contextKey({
          desktopId: captured.layout.desktopId,
          outputId: captured.layout.outputId,
        }) !== captured.key
      ) {
        throw new Error(
          "Cannot capture layout persistence with a mismatched context key",
        );
      }

      for (const column of captured.layout.columns) {
        for (const id of column.windowIds) {
          if (layoutIds.has(id) || capturedManagedIds.has(id)) {
            throw new Error(
              "Cannot capture layout persistence with duplicate tiled ownership",
            );
          }

          const owner = this.managedWindows.get(id);
          const source = this.observer.source(id);
          const observed = source ? normalizeWindow(source) : null;
          const liveContext = observed ? managedContext(observed) : null;

          if (
            owner?.contextKey !== captured.key ||
            this.floatingWindows.has(id) ||
            this.automaticFloatingWindows.has(id) ||
            this.waitingWindowContexts.has(id) ||
            !liveContext ||
            contextKey(liveContext) !== captured.key ||
            (source !== undefined && this.automaticallyFloats(source))
          ) {
            throw new Error(
              "Cannot capture layout persistence with stale tiled ownership",
            );
          }

          layoutIds.add(id);
          capturedManagedIds.add(id);
        }
      }

      if (
        layoutIds.size !== runtimeContext.windowIds.size ||
        [...runtimeContext.windowIds].some((id) => !layoutIds.has(id))
      ) {
        throw new Error(
          "Cannot capture layout persistence with mismatched context ownership",
        );
      }
    }

    if (
      capturedManagedIds.size !== this.managedWindows.size ||
      [...this.managedWindows.keys()].some((id) => !capturedManagedIds.has(id))
    ) {
      throw new Error(
        "Cannot capture layout persistence with uncaptured managed windows",
      );
    }

    for (const floating of floatingWindows) {
      const id = windowId(floating.liveId);
      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;
      const expectedContextKey = contextKey({
        desktopId: floating.placement.desktopId,
        outputId: floating.placement.outputId,
      });
      const caption = (source as { readonly caption?: unknown } | undefined)
        ?.caption;

      if (
        String(floating.placement.windowId) !== floating.liveId ||
        this.managedWindows.has(id) ||
        !liveContext ||
        contextKey(liveContext) !== expectedContextKey ||
        this.automaticFloatingWindows.has(id) ||
        this.waitingWindowContexts.has(id) ||
        (source !== undefined && this.automaticallyFloats(source))
      ) {
        throw new Error(
          `Cannot capture layout persistence with stale floating ownership window=${String(id)} caption=${JSON.stringify(typeof caption === "string" ? caption : null)} liveContext=${JSON.stringify(liveContext ? contextKey(liveContext) : null)} expectedContext=${JSON.stringify(expectedContextKey)} managed=${String(this.managedWindows.has(id))} automatic=${String(this.automaticFloatingWindows.has(id))} waiting=${String(this.waitingWindowContexts.has(id))}`,
        );
      }
    }
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

  setApplicationColumnWidths(
    overrides: ApplicationColumnWidthOverrides,
  ): boolean {
    if (
      sameApplicationColumnWidthOverrides(
        this.applicationColumnWidths,
        overrides,
      )
    ) {
      return false;
    }

    this.applicationColumnWidths = overrides;

    if (!this.started) {
      return true;
    }

    for (const key of this.waitingWindowIds.keys()) {
      this.pendingAdmissionContexts.add(key);
    }

    if (this.pendingAdmissionContexts.size > 0) {
      this.scheduleDeferredRuntimeWork();
    }

    return true;
  }

  setApplicationTilingExclusions(
    exclusions: ApplicationTilingExclusions,
  ): boolean {
    const previous = this.applicationTilingExclusions;

    if (sameApplicationTilingExclusions(previous, exclusions)) {
      return false;
    }

    this.applicationTilingExclusions = exclusions;

    if (!this.started) {
      return true;
    }

    let membershipChanged = false;

    for (const observed of this.observer.snapshot()) {
      const source = this.observer.source(observed.id);

      if (
        !source ||
        !this.applicationTilingExclusionMembershipChanged(
          source,
          previous,
          exclusions,
        )
      ) {
        continue;
      }

      const id = windowId(observed.id);
      this.cancelPointerMoveForWindowChange(id);
      this.cancelPointerResizeForWindowChange(id);
      this.pendingWindowSyncs.add(id);
      membershipChanged = true;

      if (
        this.windowTransferOperation?.stateGuardIds.has(id) &&
        !this.windowTransferOperation.movingIds.has(id)
      ) {
        this.windowTransferOperation.memberStateInvalidated = true;
      }
    }

    if (membershipChanged && !this.windowTransferOperation) {
      this.scheduleDeferredRuntimeWork();
    }

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

  setColumnWidthPresets(percentages: readonly number[]): boolean {
    const presets = columnWidthPresetsFromPercentages(percentages);

    if (!presets || sameColumnWidths(this.columnWidthPresets, presets)) {
      return false;
    }

    this.columnWidthPresets = presets;
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

  setCenterFocusedColumn(enabled: boolean): boolean {
    if (typeof enabled !== "boolean" || enabled === this.centerFocusedColumn) {
      return false;
    }

    this.centerFocusedColumn = enabled;
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
    const floatingResult = this.moveActiveManualFloatingWindow(
      -FLOATING_WINDOW_MOVE_STEP,
      0,
    );

    if (floatingResult !== null) {
      return floatingResult;
    }

    return this.moveActiveColumn("left");
  }

  moveColumnRight(): boolean {
    const floatingResult = this.moveActiveManualFloatingWindow(
      FLOATING_WINDOW_MOVE_STEP,
      0,
    );

    if (floatingResult !== null) {
      return floatingResult;
    }

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
    const floatingResult = this.moveActiveManualFloatingWindow(
      0,
      -FLOATING_WINDOW_MOVE_STEP,
    );

    if (floatingResult !== null) {
      return floatingResult;
    }

    return this.moveActiveWindowVertically("up");
  }

  moveWindowDown(): boolean {
    const floatingResult = this.moveActiveManualFloatingWindow(
      0,
      FLOATING_WINDOW_MOVE_STEP,
    );

    if (floatingResult !== null) {
      return floatingResult;
    }

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
    const floatingResult = this.resizeActiveManualFloatingWindowWidth(-1);

    if (floatingResult !== null) {
      return floatingResult;
    }

    return this.resizeActiveColumn("decrease");
  }

  increaseColumnWidth(): boolean {
    const floatingResult = this.resizeActiveManualFloatingWindowWidth(1);

    if (floatingResult !== null) {
      return floatingResult;
    }

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
    const restoreViewportOffset = restore
      ? this.columnFullWidthRestoreViewportOffset(
          command.context.key,
          command.activeColumn.id,
        )
      : undefined;
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
          command.before.viewportOffset,
        );
      }

      return true;
    }

    const resized =
      restoreViewportOffset === undefined
        ? this.applyColumnWidth(command, target, "column maximize")
        : this.applyColumnWidthAndViewport(
            command,
            target,
            restoreViewportOffset,
            "column maximize",
          );

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
        command.before.viewportOffset,
      );
    }

    this.finishColumnWidthChange(command.context.key);
    return true;
  }

  centerColumn(): boolean {
    const floatingResult = this.centerActiveManualFloatingWindow();

    if (floatingResult !== null) {
      return floatingResult;
    }

    const command = this.prepareActiveColumnCommand();

    if (!command || this.hasCapacityMutationInFlight(command.context.key)) {
      return false;
    }

    const centered = this.centeredColumnView(command, command.activeId);

    if (!centered) {
      return false;
    }

    const desiredOffset = centered.desiredViewportOffset;

    if (
      Math.abs(desiredOffset - centered.currentViewportOffset) <=
      floatingPointTolerance(
        desiredOffset,
        centered.currentViewportOffset,
        command.contextGeometry.workArea.width,
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

  start(loadedLayoutState = ""): boolean {
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
      const layoutSelectionPending =
        this.layoutStateForCurrentTopology !== undefined;
      this.initialLayoutStateDocument =
        loadedLayoutState.length === 0 ? null : loadedLayoutState;
      this.initialLayoutHydrationStatus =
        layoutSelectionPending || this.initialLayoutStateDocument !== null
          ? "pending"
          : "none";
      this.hydrationInProgress =
        this.initialLayoutHydrationStatus === "pending";
      this.initialLayoutDecodedState = null;
      this.initialLayoutHydrationCandidateFingerprint = null;
      this.initialLayoutHydrationRetryRemaining =
        this.initialLayoutHydrationStatus === "pending"
          ? this.initialLayoutHydrationRetryProbes
          : 0;
      this.initialLayoutHydrationRetryToken = null;
      this.initialLayoutHydrationStableSamples = 0;
      this.initialLayoutHydrationWaited = false;
      this.preserveLoadedLayoutState =
        this.initialLayoutHydrationStatus === "pending";
      this.lastPublishedLayoutState = null;
      this.layoutStatePublicationLocked = false;
      this.layoutStatePublicationPending = false;
      this.layoutTopologyPublicationPending = false;
      this.preservedFallbackLayoutState = null;
      this.borderlessContextReconciliationPending = false;
      this.borderlessReconciliationPending = false;
      this.interactiveResizeSource = null;
      this.pointerMoveIntent = null;
      this.pointerResizeIntent = null;
      this.pointerResizeSettlement = null;
      this.startupCompleted = false;
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
          this.initializeStartupWindows();
        }
      } finally {
        this.initializing = false;
      }

      this.desktopLifecycle.reconcile(this.desktopLifecycleCanMutate());
      this.reconcile();

      if (this.startupStabilizationProbes === 0) {
        this.completeStartup();
      }

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

    const hydrationWasPending = this.initialLayoutHydrationStatus === "pending";
    this.started = false;
    this.startupCompleted = false;
    this.hydrationInProgress = false;
    this.initialLayoutDecodedState = null;
    this.initialLayoutHydrationCandidateFingerprint = null;
    this.initialLayoutHydrationRetryRemaining = 0;
    this.initialLayoutHydrationRetryToken = null;
    this.initialLayoutHydrationStableSamples = 0;
    this.initialLayoutHydrationWaited = false;
    this.initialLayoutHydrationStatus = "none";
    this.initialLayoutStateDocument = null;
    this.layoutStatePublicationLocked = false;
    this.preserveLoadedLayoutState = false;
    this.preservedFallbackLayoutState = null;
    this.workScheduled = false;
    this.runGeneration += 1;
    this.pendingExpelFocusHandoff = null;
    this.borderlessContextReconciliationPending = false;
    this.borderlessReconciliationPending = false;
    this.interactiveResizeSource = null;
    this.pointerMoveIntent = null;
    this.pointerResizeIntent = null;
    this.pointerResizeSettlement = null;
    this.stackEditOperation = null;
    this.clearPendingManualFloatingWidthChanges();

    try {
      if (!hydrationWasPending) {
        try {
          this.synchronizePendingWindows();
        } catch (error) {
          console.warn(
            `[driftile] pending window synchronization skipped during stop error=${String(error)}`,
          );
        }
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
      this.lastSettledTopology = null;
      this.contexts.clear();
      this.pendingExpelFocusHandoff = null;
      this.interactiveResizeSource = null;
      this.pointerMoveIntent = null;
      this.pointerResizeIntent = null;
      this.pointerResizeSettlement = null;
      this.stackEditOperation = null;
      this.windowTransferOperation = null;
      this.stackedNativeStateOperation = null;
      this.pendingExternalFullscreenExtractions.clear();
      this.fullscreenRequestProbes.clear();
      this.pendingFullscreenTargets.clear();
      this.pendingHydratedRestoreBaselines.clear();
      this.unconfirmedFullscreenRetentions.clear();
      this.unconfirmedFullscreenTargets.clear();
      this.dirtyContexts.clear();
      this.automaticFloatingWindows.clear();
      this.borderSynchronizationIds.clear();
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
      this.pendingMutationWrites = 0;
      this.scheduledMutationWrites = 0;
      this.workFlushDepth = 0;
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
      this.columnFullWidthViewportRestore.clear();
      this.committedOutputRanks.clear();
      this.waitingWindowContexts.clear();
      this.waitingContextFingerprints.clear();
      this.waitingWindowIds.clear();
      this.windowAdmissionHistory.clear();
      this.windowBorderRestore.clear();
      this.windowDesktopFileNames.clear();
      this.windowStateRevisions.clear();
      this.topologyAllowsOverflowAdmissions = false;
      this.topologyColumnByWindow.clear();
      this.topologyKnownOutputRestorations.clear();
      this.topologyWindowOrder = null;
      this.toggleGeometryTransitions.clear();
      this.toggleTransitionProbes.clear();
      this.workScheduled = false;
      this.lastWrites = 0;
      this.lastPublishedLayoutState = null;
      this.layoutStatePublicationPending = false;
      this.layoutTopologyPublicationPending = false;
    }
  }

  reconcile(): number {
    if (
      !this.started ||
      this.hydrationInProgress ||
      this.stackEditOperation ||
      this.interactiveResizeSource !== null ||
      this.pointerResizeSettlement !== null ||
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

    if (this.pointerResizeIsSettling()) {
      return 0;
    }

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
    this.pointerResizeIntent = null;

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

    if (this.hydrationInProgress) {
      this.pendingWindowSyncs.add(addedId);
      return;
    }

    const source = this.observer.source(window.id);
    const addedContext = managedContext(window);

    if (addedContext) {
      this.capacityParkBackoffs.delete(contextKey(addedContext));

      if (
        (this.interactiveResizeSource !== null ||
          this.pointerResizeSettlement !== null) &&
        this.pointerResizeIntent?.contextKey === contextKey(addedContext)
      ) {
        this.pointerResizeIntent = null;
      }
    }

    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeSettlement !== null
    ) {
      this.pendingWindowSyncs.add(addedId);
      return;
    }

    if (this.synchronizeAutomaticFloatingWindow(addedId, source)) {
      return;
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
    const trackedId = windowId(id);
    const source = this.observer.source(id);

    this.synchronizeWindowBorder(trackedId, source);
  };

  private readonly handleInteractiveResizeStarted = (
    id: string,
    initialFrame: Rect,
  ): void => {
    const existing = this.pointerResizeIntent;
    const resizedWindowId = windowId(id);
    const source = this.observer.source(id);

    if (
      existing?.phase === "resizing" &&
      existing.resizedWindowId === resizedWindowId &&
      existing.source === source
    ) {
      return;
    }

    const resizeLeaseWasUnsettled =
      this.suspendedWindows.has(resizedWindowId) ||
      this.resumeSamples.has(resizedWindowId) ||
      this.pendingWindowSyncs.has(resizedWindowId);

    this.interactiveResizeSource = source ?? null;

    this.pointerMoveIntent = null;
    this.pointerResizeIntent = null;

    if (
      !this.started ||
      !this.startupCompleted ||
      this.initializing ||
      this.hydrationInProgress ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.stackedNativeStateOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !source ||
      this.workspace.activeWindow !== source ||
      !this.interactiveResizeSourceIsEligible(source) ||
      !rectsEqual(source.frameGeometry, initialFrame) ||
      this.automaticFloatingWindows.has(resizedWindowId) ||
      this.floatingWindows.has(resizedWindowId) ||
      this.waitingWindowContexts.has(resizedWindowId) ||
      resizeLeaseWasUnsettled ||
      this.requestedSuspensions.has(resizedWindowId) ||
      this.pendingHydratedRestoreBaselines.has(resizedWindowId) ||
      !this.toggleGeometrySettled(resizedWindowId)
    ) {
      return;
    }

    const owner = this.managedWindows.get(resizedWindowId);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observed = normalizeWindow(source);
    const liveContext = observed ? managedContext(observed) : null;
    const sourceOutput = context
      ? this.workspace.screens.find(
          (candidate) => candidate.name === String(context.outputId),
        )
      : undefined;
    const sourceDesktop = sourceOutput
      ? currentDesktopForOutput(this.workspace, sourceOutput)
      : null;

    if (
      !owner ||
      !context ||
      !liveContext ||
      !sourceOutput ||
      !sourceDesktop ||
      contextKey(liveContext) !== context.key ||
      sourceDesktop.id !== String(context.desktopId) ||
      !this.isContextVisible(context) ||
      this.dirtyContexts.has(context.key) ||
      this.pendingAdmissionContexts.has(context.key) ||
      this.hasStructuralCapacityState(context.key) ||
      this.toggleTransitionPending(context.key)
    ) {
      return;
    }

    const contextGeometry = this.sampleSettledContextGeometry(context);

    if (!contextGeometry) {
      return;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumn = before.columns.find((column) =>
      column.windowIds.includes(resizedWindowId),
    );

    if (
      !activeColumn ||
      before.activeColumnId !== activeColumn.id ||
      !this.columnMembersBelongToContext(activeColumn, context)
    ) {
      return;
    }

    let solved: ReturnType<typeof solveStripGeometry>;

    try {
      solved = this.solveContextGeometry(before, contextGeometry);
    } catch {
      return;
    }

    if (solved.windows.length !== context.windowIds.size) {
      return;
    }

    const solvedFrames = new Map(
      solved.windows.map((window) => [window.windowId, window.frame] as const),
    );
    const participants: PointerResizeParticipant[] = [];

    for (const participantId of activeColumn.windowIds) {
      const participant = this.observer.source(participantId);
      const beforeFrame = solvedFrames.get(participantId);
      const constraints = participant
        ? frameSizeConstraintBounds(participant)
        : null;

      if (
        !participant ||
        !beforeFrame ||
        !constraints ||
        this.pendingWindowSyncs.has(participantId) ||
        this.resumeSamples.has(participantId) ||
        !rectsEqual(participant.frameGeometry, beforeFrame) ||
        (participantId === resizedWindowId
          ? participant !== source ||
            !this.interactiveResizeSourceIsEligible(participant)
          : !this.stackTransferMemberIsEligible(
              participantId,
              participant,
              context,
              false,
            ))
      ) {
        return;
      }

      participants.push({
        beforeFrame: snapshotRect(beforeFrame),
        constraints: { ...constraints },
        id: participantId,
        stateRevision: this.windowStateRevisions.get(participantId) ?? 0,
        window: participant,
      });
    }

    if (
      participants.length !== activeColumn.windowIds.length ||
      participants.length === 0 ||
      !rectsEqual(
        initialFrame,
        solvedFrames.get(resizedWindowId) ?? initialFrame,
      )
    ) {
      return;
    }

    this.pointerResizeIntent = {
      acceptedFrame: null,
      activeColumnId: activeColumn.id,
      before,
      beforeFrame: snapshotRect(initialFrame),
      contextFingerprint: contextGeometry.fingerprint,
      contextKey: context.key,
      edge: null,
      gap: this.gap,
      generation: this.runGeneration,
      participants,
      phase: "resizing",
      resizedWindowId,
      source,
      sourceDesktop,
      sourceOutput,
      topologyRevision: this.topologyRevision,
    };
  };

  private readonly handleInteractiveResizeFinished = (
    id: string,
    acceptedFrame: Rect,
  ): void => {
    if (String(this.interactiveResizeSource?.internalId) === id) {
      this.suspendGeometryLease(windowId(id));
      this.interactiveResizeSource = null;
    }

    const intent = this.pointerResizeIntent;

    if (!intent || String(intent.resizedWindowId) !== id) {
      return;
    }

    const source = this.observer.source(id);
    const observed = source ? normalizeWindow(source) : null;
    const liveContext = observed ? managedContext(observed) : null;
    const inferred = inferPointerHorizontalResize(
      intent.beforeFrame,
      acceptedFrame,
    );

    if (
      intent.phase !== "resizing" ||
      !source ||
      source !== intent.source ||
      this.workspace.activeWindow !== source ||
      !this.settledPointerResizeSourceIsEligible(source) ||
      !rectsEqual(source.frameGeometry, acceptedFrame) ||
      !liveContext ||
      contextKey(liveContext) !== intent.contextKey ||
      source.output !== intent.sourceOutput ||
      currentDesktopForOutput(this.workspace, intent.sourceOutput)?.id !==
        intent.sourceDesktop.id ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      !inferred
    ) {
      this.pointerResizeIntent = null;
      return;
    }

    this.pointerResizeIntent = {
      ...intent,
      acceptedFrame: snapshotRect(acceptedFrame),
      edge: inferred.edge,
      phase: "finished",
    };
  };

  private readonly handleInteractiveMoveStarted = (id: string): void => {
    this.pointerMoveIntent = null;
    this.pointerResizeIntent = null;
    const draggedWindowId = windowId(id);
    const source = this.observer.source(id);

    if (
      !this.started ||
      !this.startupCompleted ||
      this.initializing ||
      this.hydrationInProgress ||
      this.stackEditOperation ||
      this.windowTransferOperation ||
      this.stackedNativeStateOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !source ||
      this.workspace.activeWindow !== source ||
      !this.interactiveMoveSourceIsEligible(source) ||
      this.automaticFloatingWindows.has(draggedWindowId) ||
      this.floatingWindows.has(draggedWindowId) ||
      this.waitingWindowContexts.has(draggedWindowId) ||
      this.requestedSuspensions.has(draggedWindowId) ||
      this.pendingHydratedRestoreBaselines.has(draggedWindowId) ||
      !this.toggleGeometrySettled(draggedWindowId)
    ) {
      return;
    }

    const owner = this.managedWindows.get(draggedWindowId);
    const context = owner ? this.contexts.get(owner.contextKey) : undefined;
    const observed = normalizeWindow(source);
    const liveContext = observed ? managedContext(observed) : null;
    const sourceOutput = context
      ? this.workspace.screens.find(
          (candidate) => candidate.name === String(context.outputId),
        )
      : undefined;
    const sourceDesktop = sourceOutput
      ? currentDesktopForOutput(this.workspace, sourceOutput)
      : null;

    if (
      !owner ||
      !context ||
      !liveContext ||
      !sourceOutput ||
      !sourceDesktop ||
      contextKey(liveContext) !== context.key ||
      sourceDesktop.id !== String(context.desktopId) ||
      !this.isContextVisible(context) ||
      this.dirtyContexts.has(context.key) ||
      this.pendingAdmissionContexts.has(context.key) ||
      this.hasStructuralCapacityState(context.key) ||
      this.toggleTransitionPending(context.key)
    ) {
      return;
    }

    const sampledGeometries = this.sampleSettledVisibleContextGeometries();
    const contextGeometry = sampledGeometries?.get(context.key);

    if (
      !sampledGeometries ||
      !contextGeometry ||
      contextGeometry.fingerprint !== context.geometryFingerprint
    ) {
      return;
    }

    const before = this.layout.snapshot(context.outputId, context.desktopId);
    const activeColumn = before.columns.find((column) =>
      column.windowIds.includes(draggedWindowId),
    );

    if (
      !activeColumn ||
      before.activeColumnId !== activeColumn.id ||
      !this.columnMembersBelongToContext(activeColumn, context)
    ) {
      return;
    }

    const participants: PointerMoveParticipant[] = [];

    for (const column of before.columns) {
      for (const participantId of column.windowIds) {
        const participant = this.observer.source(participantId);

        if (
          !participant ||
          (participantId !== draggedWindowId &&
            this.pendingWindowSyncs.has(participantId)) ||
          (participantId === draggedWindowId
            ? participant !== source ||
              !this.interactiveMoveSourceIsEligible(participant)
            : !this.stackTransferMemberIsEligible(
                participantId,
                participant,
                context,
                false,
              ))
        ) {
          return;
        }

        participants.push({
          id: participantId,
          stateRevision: this.windowStateRevisions.get(participantId) ?? 0,
          window: participant,
        });
      }
    }

    if (
      participants.length !== context.windowIds.size ||
      participants.length < 1
    ) {
      return;
    }

    let solved: ReturnType<typeof solveStripGeometry>;

    try {
      solved = this.solveContextGeometry(before, contextGeometry);
    } catch {
      return;
    }

    const dragged = solved.windows.find(
      (window) => window.windowId === draggedWindowId,
    );

    if (!dragged || solved.windows.length !== participants.length) {
      return;
    }

    this.pointerMoveIntent = {
      before,
      contextFingerprint: contextGeometry.fingerprint,
      contextKey: context.key,
      draggedWindowId,
      externalDrop: null,
      finalCursor: null,
      finishedFrame: null,
      gap: this.gap,
      generation: this.runGeneration,
      initialFrame: snapshotRect(source.frameGeometry),
      participants,
      phase: "dragging",
      source,
      sourceDesktop,
      sourceOutput,
      topologyRevision: this.topologyRevision,
    };
  };

  private readonly handleInteractiveMoveFinished = (id: string): void => {
    const intent = this.pointerMoveIntent;

    if (!intent || String(intent.draggedWindowId) !== id) {
      return;
    }

    const source = this.observer.source(id);
    const cursor = this.workspace.cursorPos;
    const observed = source ? normalizeWindow(source) : null;
    const liveContext = observed ? managedContext(observed) : null;
    const finalCursor =
      cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)
        ? { x: cursor.x, y: cursor.y }
        : null;

    if (
      intent.phase !== "dragging" ||
      !source ||
      source !== intent.source ||
      this.workspace.activeWindow !== source ||
      source.move ||
      !this.settledPointerMoveSourceIsEligible(source) ||
      !finalCursor
    ) {
      this.pointerMoveIntent = null;
      return;
    }

    const externalDrop = this.prepareExternalPointerDrop(intent, finalCursor);

    if (
      !externalDrop &&
      (!liveContext ||
        contextKey(liveContext) !== intent.contextKey ||
        rectsEqual(source.frameGeometry, intent.initialFrame))
    ) {
      this.pointerMoveIntent = null;
      return;
    }

    this.pointerMoveIntent = {
      ...intent,
      externalDrop,
      finalCursor,
      finishedFrame: snapshotRect(source.frameGeometry),
      phase: "finished",
    };
  };

  private prepareExternalPointerDrop(
    intent: PointerMoveIntent,
    cursor: Point,
  ): PointerExternalDropIntent | null {
    const outputs = this.workspace.screens.filter((output) =>
      rectContainsPoint(output.geometry, cursor),
    );
    const output = outputs[0];

    if (outputs.length !== 1 || !output) {
      return null;
    }

    const desktop = currentDesktopForOutput(this.workspace, output);

    if (!desktop) {
      return null;
    }

    const sameOutput =
      output === intent.sourceOutput ||
      output.name === String(intent.before.outputId);
    const kind = sameOutput ? "desktop" : "output";

    if (
      (kind === "desktop" && desktop.id === intent.sourceDesktop.id) ||
      (kind === "output" &&
        (output === intent.sourceOutput ||
          output.name === String(intent.before.outputId)))
    ) {
      return null;
    }

    const context: ManagedContext = {
      desktopId: desktopId(desktop.id),
      outputId: outputId(output.name),
    };
    const key = contextKey(context);
    const external: PointerExternalDropIntent = {
      completedAttempts: 0,
      context,
      contextKey: key,
      desktop,
      insertion: { state: "pending" },
      kind,
      output,
      probePending: false,
    };
    external.insertion = this.captureExternalPointerInsertion(
      intent,
      external,
      cursor,
    );
    return external;
  }

  private captureExternalPointerInsertion(
    intent: PointerMoveIntent,
    external: PointerExternalDropIntent,
    cursor: Point,
    settledContext?: PointerExternalSettledContext,
  ): PointerExternalInsertionIntent {
    const settled =
      settledContext ?? this.settledExternalPointerContext(external);

    if (settled === "pending" || settled === "unavailable") {
      return { state: settled };
    }

    const { contextGeometry, runtimeContext } = settled;
    const { context, contextKey: key } = external;

    const layout = this.layout.snapshot(context.outputId, context.desktopId);
    const participants: PointerMoveParticipant[] = [];

    for (const column of layout.columns) {
      for (const id of column.windowIds) {
        const window = this.observer.source(id);
        const owner = this.managedWindows.get(id);
        const observed = window ? normalizeWindow(window) : null;
        const liveContext = observed ? managedContext(observed) : null;

        if (
          !window ||
          owner?.contextKey !== key ||
          !liveContext ||
          contextKey(liveContext) !== key ||
          this.pendingWindowSyncs.has(id) ||
          !this.stackTransferMemberIsEligible(id, window, runtimeContext, false)
        ) {
          return { state: "unavailable" };
        }

        participants.push({
          id,
          stateRevision: this.windowStateRevisions.get(id) ?? 0,
          window,
        });
      }
    }

    if (
      participants.length === 0 ||
      participants.length !== runtimeContext.windowIds.size
    ) {
      return { state: "unavailable" };
    }

    let solved: ReturnType<typeof solveStripGeometry>;

    try {
      solved = this.solveContextGeometry(layout, contextGeometry);
    } catch {
      return { state: "unavailable" };
    }

    const target = planPointerExternalWindowDrop({
      context: layout,
      cursor,
      draggedWindowId: intent.draggedWindowId,
      visibleArea: contextGeometry.workArea,
      windows: solved.windows,
    });

    if (!target || solved.windows.length !== participants.length) {
      return { state: "unavailable" };
    }

    return {
      contextFingerprint: contextGeometry.fingerprint,
      layout,
      participants,
      runtimeContext,
      state: "ready",
      target,
    };
  }

  private settledExternalPointerContext(
    external: PointerExternalDropIntent,
  ): PointerExternalSettledContext | "pending" | "unavailable" {
    if (!this.pointerExternalDestinationIsSelected(external)) {
      return "unavailable";
    }

    const key = external.contextKey;

    if (
      this.dirtyContexts.has(key) ||
      this.pendingAdmissionContexts.has(key) ||
      this.hasStructuralCapacityState(key) ||
      this.waitingWindowIds.has(key) ||
      this.toggleTransitionPending(key)
    ) {
      return "pending";
    }

    const runtimeContext = this.contexts.get(key);

    if (!runtimeContext) {
      return "unavailable";
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        runtimeContext.outputId,
        runtimeContext.desktopId,
      );
    } catch {
      return "pending";
    }

    if (
      !contextGeometry ||
      contextGeometry.fingerprint !== runtimeContext.geometryFingerprint
    ) {
      return "pending";
    }

    return { contextGeometry, runtimeContext };
  }

  private pointerExternalDestinationIsSelected(
    external: PointerExternalDropIntent,
  ): boolean {
    return (
      currentDesktopForOutput(this.workspace, external.output)?.id ===
      external.desktop.id
    );
  }

  private pointerExternalDestinationIsCurrent(
    external: PointerExternalDropIntent,
  ): boolean {
    return (
      this.workspace.screens.includes(external.output) &&
      this.workspace.desktops.some(
        (desktop) => desktop.id === external.desktop.id,
      ) &&
      this.pointerExternalDestinationIsSelected(external) &&
      this.isContextVisible(external.context)
    );
  }

  private pointerExternalTransferMechanismIsCurrent(
    intent: PointerMoveIntent,
    external: PointerExternalDropIntent,
    source: KWinWindow,
  ): boolean {
    if (
      !this.workspace.screens.includes(intent.sourceOutput) ||
      !this.pointerExternalDestinationIsCurrent(external) ||
      !this.workspace.desktops.some(
        (desktop) => desktop.id === intent.sourceDesktop.id,
      ) ||
      source.output?.name !== external.output.name ||
      !windowIsOnDesktop(source, external.desktop)
    ) {
      return false;
    }

    if (external.kind === "desktop") {
      return (
        external.output === intent.sourceOutput &&
        external.output.name === String(intent.before.outputId) &&
        external.desktop.id !== intent.sourceDesktop.id
      );
    }

    return (
      external.output !== intent.sourceOutput &&
      external.output.name !== String(intent.before.outputId) &&
      currentDesktopForOutput(this.workspace, intent.sourceOutput)?.id ===
        intent.sourceDesktop.id
    );
  }

  private waitForExternalPointerContext(
    id: WindowId,
    source: KWinWindow,
    nextContext: ManagedContext | null,
  ): boolean {
    const intent = this.pointerMoveIntent;
    const external = intent?.externalDrop;

    if (
      !intent ||
      !external ||
      intent.phase !== "finished" ||
      intent.draggedWindowId !== id ||
      intent.source !== source
    ) {
      return false;
    }

    const nextKey = nextContext ? contextKey(nextContext) : null;

    const intermediateContext = Boolean(
      nextContext &&
      (nextContext.outputId === intent.before.outputId ||
        nextContext.outputId === external.context.outputId) &&
      (nextContext.desktopId === intent.before.desktopId ||
        nextContext.desktopId === external.context.desktopId),
    );

    if (nextKey !== null && !intermediateContext) {
      this.pointerMoveIntent = null;
      return false;
    }

    if (external.insertion.state === "pending") {
      const settled = this.settledExternalPointerContext(external);

      if (settled === "unavailable") {
        external.insertion = { state: "unavailable" };
      } else if (settled !== "pending" && intent.finalCursor) {
        external.insertion = this.captureExternalPointerInsertion(
          intent,
          external,
          intent.finalCursor,
          settled,
        );
      }
    } else if (
      external.insertion.state === "ready" &&
      typeof this.settledExternalPointerContext(external) === "string"
    ) {
      external.insertion = { state: "unavailable" };
    }

    if (
      nextKey === external.contextKey &&
      external.insertion.state !== "pending"
    ) {
      return false;
    }

    if (external.completedAttempts >= MAX_POINTER_EXTERNAL_CONTEXT_PROBES) {
      this.pointerMoveIntent = null;
      return false;
    }

    this.suspendGeometryLease(id);

    if (external.probePending) {
      return true;
    }

    external.probePending = true;
    const generation = this.runGeneration;

    try {
      this.scheduleResume(() => {
        if (
          !this.started ||
          this.runGeneration !== generation ||
          this.pointerMoveIntent !== intent ||
          intent.externalDrop !== external
        ) {
          return;
        }

        external.probePending = false;
        external.completedAttempts += 1;
        this.pendingWindowSyncs.add(id);
        this.scheduleWork();
      });
    } catch (error) {
      external.probePending = false;
      this.pointerMoveIntent = null;
      this.resumeSamples.delete(id);
      this.suspendedWindows.delete(id);
      console.warn(
        `[driftile] external pointer context probe scheduling failed window=${String(id)} error=${String(error)}`,
      );
      return false;
    }

    return true;
  }

  private interactiveMoveSourceIsEligible(source: KWinWindow): boolean {
    return source.move && this.pointerMoveSourceHasStableOwnership(source);
  }

  private settledPointerMoveSourceIsEligible(source: KWinWindow): boolean {
    return !source.move && this.pointerMoveSourceHasStableOwnership(source);
  }

  private pointerMoveSourceHasStableOwnership(source: KWinWindow): boolean {
    return (
      source.managed &&
      !source.deleted &&
      !source.fullScreen &&
      !source.minimized &&
      source.maximizeMode === 0 &&
      !source.resize &&
      source.moveable &&
      source.resizeable &&
      source.tile === null
    );
  }

  private interactiveResizeSourceIsEligible(source: KWinWindow): boolean {
    return (
      source.resize &&
      !source.move &&
      this.pointerResizeSourceHasStableOwnership(source)
    );
  }

  private settledPointerResizeSourceIsEligible(source: KWinWindow): boolean {
    return (
      !source.resize &&
      !source.move &&
      this.pointerResizeSourceHasStableOwnership(source)
    );
  }

  private pointerResizeSourceHasStableOwnership(source: KWinWindow): boolean {
    return (
      source.managed &&
      !source.deleted &&
      !source.fullScreen &&
      !source.minimized &&
      source.maximizeMode === 0 &&
      source.moveable &&
      source.resizeable &&
      source.tile === null
    );
  }

  private cancelPointerMoveForWindowChange(id: WindowId): void {
    if (
      this.pointerMoveIntent?.participants.some(
        (participant) => participant.id === id,
      )
    ) {
      this.pointerMoveIntent = null;
    }
  }

  private cancelPointerResizeForWindowChange(id: WindowId): void {
    if (
      this.pointerResizeIntent?.participants.some(
        (participant) => participant.id === id,
      )
    ) {
      this.pointerResizeIntent = null;
    }
  }

  private cancelPointerMoveForInvalidState(
    id: WindowId,
    source: KWinWindow | undefined,
  ): void {
    const intent = this.pointerMoveIntent;

    if (!intent) {
      return;
    }

    const participant = intent.participants.find(
      (candidate) => candidate.id === id,
    );

    if (!participant) {
      return;
    }

    if (
      id !== intent.draggedWindowId ||
      !source ||
      source !== intent.source ||
      !this.pointerMoveSourceHasStableOwnership(source)
    ) {
      this.pointerMoveIntent = null;
    }
  }

  private cancelPointerResizeForInvalidState(
    id: WindowId,
    source: KWinWindow | undefined,
  ): void {
    const intent = this.pointerResizeIntent;

    if (!intent) {
      return;
    }

    if (id === intent.resizedWindowId) {
      const expectedSourceState =
        source === intent.source &&
        (intent.phase === "resizing"
          ? this.interactiveResizeSourceIsEligible(source)
          : this.settledPointerResizeSourceIsEligible(source));

      if (!expectedSourceState) {
        this.pointerResizeIntent = null;
      }

      return;
    }

    if (intent.participants.some((participant) => participant.id === id)) {
      this.pointerResizeIntent = null;
    }
  }

  private readonly handleWindowChanged = (
    id: string,
    cause: ObservedWindowChangeCause,
  ): void => {
    const changedId = windowId(id);
    const source = this.observer.source(id);

    if (this.borderSynchronizationIds.has(changedId)) {
      return;
    }

    const desktopFileNameChange =
      cause === "classification" && source
        ? this.trackWindowDesktopFileNameChange(changedId, source)
        : null;

    if (
      source &&
      desktopFileNameChange &&
      !this.desktopFileNameChangeRequiresLayout(
        changedId,
        source,
        desktopFileNameChange.previous,
        desktopFileNameChange.current,
      )
    ) {
      this.synchronizeWindowBorder(changedId, source);
      return;
    }

    const pointerIntent = this.pointerMoveIntent;
    const pointerContextChangeContinues =
      cause === "context" &&
      pointerIntent?.draggedWindowId === changedId &&
      source !== undefined &&
      pointerIntent.source === source &&
      (source.move || pointerIntent.phase === "finished") &&
      this.pointerMoveSourceHasStableOwnership(source);

    if (!pointerContextChangeContinues) {
      this.cancelPointerMoveForWindowChange(changedId);
    }

    const resizeIntent = this.pointerResizeIntent;
    const resizeSettlement = this.pointerResizeSettlement;
    const pointerResizeConstraintChangeContinues =
      cause === "constraints" &&
      resizeIntent !== null &&
      source !== undefined &&
      (resizeIntent.phase === "resizing"
        ? resizeIntent.resizedWindowId === changedId &&
          resizeIntent.source === source &&
          this.interactiveResizeSourceIsEligible(source)
        : resizeSettlement?.intent === resizeIntent &&
          resizeSettlement.windows.some(
            (window) =>
              window.id === changedId &&
              window.source === source &&
              this.pointerResizeSourceHasStableOwnership(source),
          ));

    if (!pointerResizeConstraintChangeContinues) {
      this.cancelPointerResizeForWindowChange(changedId);
    }

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

    if (this.borderSynchronizationIds.has(changedId)) {
      return;
    }

    if (
      source === this.interactiveResizeSource &&
      !source.move &&
      !source.resize
    ) {
      this.suspendGeometryLease(changedId);
      this.interactiveResizeSource = null;
    }

    this.cancelPointerMoveForInvalidState(changedId, source);
    this.cancelPointerResizeForInvalidState(changedId, source);
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
    this.cancelPointerMoveForWindowChange(suspendedId);
    this.cancelPointerResizeForWindowChange(suspendedId);

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
    this.cancelPointerMoveForWindowChange(activeId);
    this.cancelPointerResizeForWindowChange(activeId);
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
    this.cancelPointerMoveForWindowChange(windowId(id));
    this.cancelPointerResizeForWindowChange(windowId(id));

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
    const endedInteractiveResize =
      String(this.interactiveResizeSource?.internalId) === id;

    if (endedInteractiveResize) {
      this.interactiveResizeSource = null;
    }

    this.cancelPointerMoveForWindowChange(managedId);
    this.cancelPointerResizeForWindowChange(managedId);
    this.cancelPendingManualFloatingWidthChange(managedId);
    this.cancelInvalidPendingExpelFocusHandoff();
    const affectedContextKeys = new Set<string>();
    const floating = this.floatingWindows.get(managedId);
    const transition = this.toggleGeometryTransitions.get(managedId);

    if (floating) {
      affectedContextKeys.add(floating.sourceContextKey);
      affectedContextKeys.add(floating.currentContextKey);
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
    this.pendingHydratedRestoreBaselines.delete(managedId);
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
    this.windowDesktopFileNames.delete(managedId);
    this.windowStateRevisions.delete(managedId);
    this.forgetRememberedLayerFocus(managedId);
    const releasedContextKey = this.releaseWindow(managedId);

    if (releasedContextKey) {
      affectedContextKeys.add(releasedContextKey);
    }

    for (const key of affectedContextKeys) {
      this.finishCanceledToggleTransition(key);
    }

    if (endedInteractiveResize && this.borderlessReconciliationPending) {
      this.applyBorderlessWindowSetting(false);
    }

    if (endedInteractiveResize) {
      this.scheduleWork();
    }

    this.requestLayoutStatePublication();
    this.flushLayoutStatePublication();
  };

  private readonly handleWindowActivated = (
    window: KWinWindow | null,
    allowSuspended = false,
  ): void => {
    if (this.pointerMoveIntent && window !== this.pointerMoveIntent.source) {
      this.pointerMoveIntent = null;
    }

    if (
      this.pointerResizeIntent &&
      window !== this.pointerResizeIntent.source
    ) {
      this.pointerResizeIntent = null;
    }

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

    if (this.stackEditOperation) {
      return;
    }

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

    const floating = this.floatingWindows.get(id);

    if (
      floating?.currentContextKey === key ||
      this.automaticFloatingOwnershipApplies(id, source)
    ) {
      return "floating";
    }

    if (floating) {
      return null;
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
    const centered =
      this.centerFocusedColumn &&
      !this.hasCapacityMutationInFlight(command.context.key)
        ? this.centeredColumnView(command, targetId)
        : null;
    const desiredViewportOffset = centered?.desiredViewportOffset ?? null;
    const focused = this.applyActiveColumnMutation(
      command,
      "column focus",
      () => {
        if (!this.layout.activateWindow(targetId)) {
          return false;
        }

        if (
          desiredViewportOffset === null ||
          nearlyEqual(desiredViewportOffset, command.before.viewportOffset)
        ) {
          return true;
        }

        if (
          this.layout.setViewportOffset(
            command.context.outputId,
            command.context.desktopId,
            desiredViewportOffset,
          )
        ) {
          return true;
        }

        this.layout.activateWindow(command.activeId);
        return false;
      },
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

  private centeredColumnView(
    command: ActiveColumnCommand,
    targetId: WindowId,
  ): {
    readonly currentViewportOffset: number;
    readonly desiredViewportOffset: number;
  } | null {
    const targetColumn = command.before.columns.find((column) =>
      column.windowIds.includes(targetId),
    );

    if (!targetColumn) {
      return null;
    }

    const targetContext: LayoutContextSnapshot = {
      ...command.before,
      activeColumnId: targetColumn.id,
    };
    let currentLayout: ReturnType<typeof solveStripGeometry>;

    try {
      currentLayout = this.solveContextGeometry(
        targetContext,
        command.contextGeometry,
      );
    } catch {
      return null;
    }

    const target = currentLayout.windows.find(
      (window) => window.windowId === targetId,
    );

    if (!target) {
      return null;
    }

    const workArea = command.contextGeometry.workArea;
    const requestedOffset = roundToPhysicalPixel(
      currentLayout.viewportOffset +
        target.frame.x +
        target.frame.width / 2 -
        (workArea.x + workArea.width / 2),
      command.contextGeometry.devicePixelRatio,
    );
    let centeredLayout: ReturnType<typeof solveStripGeometry>;

    try {
      centeredLayout = this.solveContextGeometry(
        { ...targetContext, viewportOffset: requestedOffset },
        command.contextGeometry,
      );
    } catch {
      return null;
    }

    return {
      currentViewportOffset: currentLayout.viewportOffset,
      desiredViewportOffset: centeredLayout.viewportOffset,
    };
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

  private resizeActiveManualFloatingWindowWidth(
    direction: -1 | 1,
  ): boolean | null {
    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));
    const floating = this.floatingWindows.get(activeId);

    if (!floating) {
      return null;
    }

    this.lastWrites = 0;

    const command = this.prepareManualFloatingFrameChange(
      activeId,
      activeWindow,
      floating,
    );

    if (!command) {
      return false;
    }

    const signal = activeWindow.frameGeometryChanged;
    let constraintBounds: FrameSizeConstraintBounds | null;
    let decorationWidth: number | null;

    try {
      constraintBounds = frameSizeConstraintBounds(activeWindow);
      decorationWidth = validDecorationExtent(
        command.originalFrame.width,
        activeWindow.clientGeometry.width,
      );
    } catch {
      return false;
    }

    if (!signal || !constraintBounds || decorationWidth === null) {
      return false;
    }

    const targetFrame = this.manualFloatingWidthTarget(
      command,
      constraintBounds,
      decorationWidth,
      direction,
    );

    if (
      !targetFrame ||
      rectsEqual(targetFrame, command.originalFrame) ||
      !this.manualFloatingFrameChangeIsCurrent(command) ||
      !this.geometry.canApplyFrame(
        command.activeId,
        targetFrame,
        command.context,
      )
    ) {
      return false;
    }

    const handleFrameGeometryChanged = (): void => {
      this.handlePendingManualFloatingWidthChange(operation);
    };
    const operation: PendingManualFloatingWidthChange = {
      command,
      constraintBounds,
      decorationWidth,
      handleFrameGeometryChanged,
      signal,
      settlementAttempts: 0,
      status: "pending",
      targetFrame,
    };
    this.pendingManualFloatingWidthChanges.set(activeId, operation);

    try {
      signal.connect(handleFrameGeometryChanged);
    } catch (error) {
      this.pendingManualFloatingWidthChanges.delete(activeId);
      operation.status = "rejected";
      console.warn(
        `[driftile] floating width resize signal connection failed window=${String(activeId)} error=${String(error)}`,
      );
      return false;
    }

    if (this.pendingManualFloatingWidthChanges.get(activeId) !== operation) {
      return false;
    }

    let forwardWrites = 0;
    let forwardError: string | null = null;

    try {
      forwardWrites = this.geometry.apply(
        [{ frame: targetFrame, windowId: activeId }],
        command.context,
        () =>
          this.pendingManualFloatingWidthChangeIsCurrent(operation) &&
          rectsEqual(activeWindow.frameGeometry, command.originalFrame),
      );
    } catch (error) {
      forwardError = String(error);
    }

    this.lastWrites = forwardWrites;

    if (forwardWrites !== 1) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");

      if (forwardError !== null) {
        console.warn(
          `[driftile] floating width resize request failed window=${String(activeId)} error=${forwardError}`,
        );
      }

      return false;
    }

    if (this.pendingManualFloatingWidthChanges.get(activeId) === operation) {
      let observedFrame: Rect;

      try {
        observedFrame = snapshotRect(activeWindow.frameGeometry);
      } catch {
        this.finishPendingManualFloatingWidthChange(operation, "rejected");
        return false;
      }

      if (rectsEqual(observedFrame, targetFrame)) {
        this.acceptPendingManualFloatingWidthChange(operation);
      } else if (
        !rectsEqual(observedFrame, command.originalFrame) ||
        !this.pendingManualFloatingWidthChangeIsCurrent(operation)
      ) {
        this.finishPendingManualFloatingWidthChange(operation, "rejected");
      }
    }

    if (this.pendingManualFloatingWidthChanges.get(activeId) === operation) {
      this.schedulePendingManualFloatingWidthChangeProbe(operation);
    }

    return operation.status !== "rejected";
  }

  private manualFloatingWidthTarget(
    command: ManualFloatingFrameCommand,
    constraintBounds: FrameSizeConstraintBounds,
    decorationWidth: number,
    direction: -1 | 1,
  ): Rect | null {
    const devicePixelRatio = command.contextGeometry.devicePixelRatio;
    const workArea = command.contextGeometry.workArea;

    if (
      !Number.isFinite(devicePixelRatio) ||
      devicePixelRatio <= 0 ||
      !Number.isFinite(workArea.width) ||
      workArea.width <= 0
    ) {
      return null;
    }

    const minimumWidth = ceilToPhysicalPixel(
      Math.max(constraintBounds.minimumWidth, decorationWidth + 1),
      devicePixelRatio,
    );
    const maximumWidth = Number.isFinite(constraintBounds.maximumWidth)
      ? floorToPhysicalPixel(constraintBounds.maximumWidth, devicePixelRatio)
      : Number.POSITIVE_INFINITY;

    if (
      !Number.isFinite(minimumWidth) ||
      minimumWidth <= decorationWidth ||
      maximumWidth < minimumWidth
    ) {
      return null;
    }

    const requestedWidth =
      command.originalFrame.width +
      direction * this.columnWidthStep * workArea.width;

    if (!Number.isFinite(requestedWidth)) {
      return null;
    }

    const width = clamp(
      roundToPhysicalPixel(requestedWidth, devicePixelRatio),
      minimumWidth,
      maximumWidth,
    );
    const progressTolerance = floatingPointTolerance(
      width,
      command.originalFrame.width,
    );

    if (
      (direction > 0 &&
        width <= command.originalFrame.width + progressTolerance) ||
      (direction < 0 &&
        width >= command.originalFrame.width - progressTolerance)
    ) {
      return null;
    }

    return moveFloatingFrame(
      { ...command.originalFrame, width },
      workArea,
      0,
      0,
    );
  }

  private handlePendingManualFloatingWidthChange(
    operation: PendingManualFloatingWidthChange,
  ): void {
    if (
      this.pendingManualFloatingWidthChanges.get(operation.command.activeId) !==
      operation
    ) {
      return;
    }

    let observedFrame: Rect;

    try {
      observedFrame = snapshotRect(
        operation.command.activeWindow.frameGeometry,
      );
    } catch {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      return;
    }

    if (!rectsEqual(observedFrame, operation.targetFrame)) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      return;
    }

    this.acceptPendingManualFloatingWidthChange(operation);
  }

  private schedulePendingManualFloatingWidthChangeProbe(
    operation: PendingManualFloatingWidthChange,
  ): void {
    if (
      this.pendingManualFloatingWidthChanges.get(operation.command.activeId) !==
        operation ||
      operation.status !== "pending"
    ) {
      return;
    }

    const runGeneration = this.runGeneration;

    try {
      this.scheduleResume(() => {
        if (
          !this.started ||
          this.runGeneration !== runGeneration ||
          this.pendingManualFloatingWidthChanges.get(
            operation.command.activeId,
          ) !== operation ||
          operation.status !== "pending"
        ) {
          return;
        }

        operation.settlementAttempts += 1;
        let observedFrame: Rect;

        try {
          observedFrame = snapshotRect(
            operation.command.activeWindow.frameGeometry,
          );
        } catch {
          this.finishPendingManualFloatingWidthChange(operation, "rejected");
          return;
        }

        if (rectsEqual(observedFrame, operation.targetFrame)) {
          this.acceptPendingManualFloatingWidthChange(operation);
          return;
        }

        if (
          !rectsEqual(observedFrame, operation.command.originalFrame) ||
          !this.pendingManualFloatingWidthChangeIsCurrent(operation) ||
          operation.settlementAttempts >=
            MAX_MANUAL_FLOATING_WIDTH_SETTLEMENT_PROBES
        ) {
          this.finishPendingManualFloatingWidthChange(operation, "rejected");
          return;
        }

        this.schedulePendingManualFloatingWidthChangeProbe(operation);
      });
    } catch (error) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      console.warn(
        `[driftile] floating width resize settlement scheduling failed window=${String(operation.command.activeId)} error=${String(error)}`,
      );
    }
  }

  private acceptPendingManualFloatingWidthChange(
    operation: PendingManualFloatingWidthChange,
  ): void {
    if (!this.pendingManualFloatingWidthChangeIsCurrent(operation)) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      return;
    }

    const command = operation.command;
    let acceptedFrame: Rect;
    let restoreBaseline: RestoreBaseline;

    try {
      acceptedFrame = snapshotRect(command.activeWindow.frameGeometry);
      restoreBaseline = this.captureRestoreBaseline(
        command.activeWindow,
        command.contextGeometry.fingerprint,
        "client",
      );
    } catch {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      return;
    }

    if (
      !rectsEqual(acceptedFrame, operation.targetFrame) ||
      !rectsEqual(restoreBaseline.frame, acceptedFrame) ||
      restoreBaseline.clientFrame.width <= 0 ||
      !this.pendingManualFloatingWidthChangeIsCurrent(operation)
    ) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
      return;
    }

    this.floatingWindows.set(command.activeId, {
      ...command.floating,
      expectedFrame: acceptedFrame,
      restoreBaseline,
    });
    this.finishPendingManualFloatingWidthChange(operation, "accepted");
  }

  private pendingManualFloatingWidthChangeIsCurrent(
    operation: PendingManualFloatingWidthChange,
  ): boolean {
    const command = operation.command;

    if (
      operation.status !== "pending" ||
      this.pendingManualFloatingWidthChanges.get(command.activeId) !==
        operation ||
      !this.manualFloatingFrameChangeIsCurrent(command, operation)
    ) {
      return false;
    }

    let constraintBounds: FrameSizeConstraintBounds | null;
    let decorationWidth: number | null;
    let clientWidth: number;

    try {
      constraintBounds = frameSizeConstraintBounds(command.activeWindow);
      decorationWidth = validDecorationExtent(
        command.activeWindow.frameGeometry.width,
        command.activeWindow.clientGeometry.width,
      );
      clientWidth = command.activeWindow.clientGeometry.width;
    } catch {
      return false;
    }

    return (
      constraintBounds !== null &&
      frameSizeConstraintBoundsEqual(
        constraintBounds,
        operation.constraintBounds,
      ) &&
      decorationWidth !== null &&
      nearlyEqual(decorationWidth, operation.decorationWidth) &&
      Number.isFinite(clientWidth) &&
      clientWidth > 0 &&
      this.geometry.canApplyFrame(
        command.activeId,
        operation.targetFrame,
        command.context,
      )
    );
  }

  private finishPendingManualFloatingWidthChange(
    operation: PendingManualFloatingWidthChange,
    status: "accepted" | "rejected",
  ): void {
    const id = operation.command.activeId;

    if (this.pendingManualFloatingWidthChanges.get(id) !== operation) {
      return;
    }

    this.pendingManualFloatingWidthChanges.delete(id);
    operation.status = status;

    try {
      operation.signal.disconnect(operation.handleFrameGeometryChanged);
    } catch (error) {
      console.warn(
        `[driftile] floating width resize signal disconnection failed window=${String(id)} error=${String(error)}`,
      );
    }
  }

  private cancelPendingManualFloatingWidthChange(id: WindowId): void {
    const operation = this.pendingManualFloatingWidthChanges.get(id);

    if (operation) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
    }
  }

  private clearPendingManualFloatingWidthChanges(): void {
    for (const operation of [
      ...this.pendingManualFloatingWidthChanges.values(),
    ]) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
    }
  }

  private moveActiveManualFloatingWindow(
    deltaX: number,
    deltaY: number,
  ): boolean | null {
    return this.changeActiveManualFloatingWindowFrame((frame, workArea) =>
      moveFloatingFrame(frame, workArea, deltaX, deltaY),
    );
  }

  private centerActiveManualFloatingWindow(): boolean | null {
    return this.changeActiveManualFloatingWindowFrame(centerFloatingFrame);
  }

  private changeActiveManualFloatingWindowFrame(
    resolveTargetFrame: (frame: Rect, workArea: Rect) => Rect,
  ): boolean | null {
    const activeWindow = this.workspace.activeWindow;

    if (!activeWindow) {
      return null;
    }

    const activeId = windowId(String(activeWindow.internalId));
    const floating = this.floatingWindows.get(activeId);

    if (!floating) {
      return null;
    }

    this.lastWrites = 0;
    const command = this.prepareManualFloatingFrameChange(
      activeId,
      activeWindow,
      floating,
    );

    if (!command) {
      return false;
    }

    const targetFrame = resolveTargetFrame(
      command.originalFrame,
      command.contextGeometry.workArea,
    );

    if (
      rectsEqual(targetFrame, command.originalFrame) ||
      !this.manualFloatingFrameChangeIsCurrent(command) ||
      !this.geometry.canApplyFrame(
        command.activeId,
        targetFrame,
        command.context,
      )
    ) {
      return false;
    }

    let forwardWrites = 0;
    let forwardError: string | null = null;

    try {
      forwardWrites = this.geometry.apply(
        [{ frame: targetFrame, windowId: command.activeId }],
        command.context,
        () =>
          this.manualFloatingFrameChangeIsCurrent(command) &&
          rectsEqual(command.activeWindow.frameGeometry, command.originalFrame),
      );
    } catch (error) {
      forwardError = String(error);
    }

    let acceptedFrame: Rect | null = null;
    let restoreBaseline: RestoreBaseline | null = null;

    try {
      if (
        forwardError === null &&
        forwardWrites === 1 &&
        rectsEqual(command.activeWindow.frameGeometry, targetFrame) &&
        this.manualFloatingFrameChangeIsCurrent(command)
      ) {
        acceptedFrame = snapshotRect(command.activeWindow.frameGeometry);
        restoreBaseline = this.captureRestoreBaseline(
          command.activeWindow,
          command.contextGeometry.fingerprint,
          "client",
        );
      }
    } catch (error) {
      forwardError = String(error);
    }

    if (
      acceptedFrame &&
      restoreBaseline &&
      rectsEqual(acceptedFrame, targetFrame) &&
      rectsEqual(restoreBaseline.frame, acceptedFrame) &&
      this.manualFloatingFrameChangeIsCurrent(command) &&
      rectsEqual(command.activeWindow.frameGeometry, acceptedFrame)
    ) {
      this.floatingWindows.set(command.activeId, {
        ...command.floating,
        expectedFrame: acceptedFrame,
        restoreBaseline,
      });
      this.lastWrites = 1;
      return true;
    }

    const compensationWrites = this.compensateManualFloatingFrameChange(
      command,
      targetFrame,
      forwardWrites,
    );
    this.lastWrites = forwardWrites + compensationWrites;

    if (forwardError !== null) {
      console.warn(
        `[driftile] floating frame change rolled back window=${String(command.activeId)} error=${forwardError}`,
      );
    }

    return false;
  }

  private prepareManualFloatingFrameChange(
    activeId: WindowId,
    activeWindow: KWinWindow,
    floating: FloatingWindow,
  ): ManualFloatingFrameCommand | null {
    if (this.pendingManualFloatingWidthChangeBlocksFrameChange(activeId)) {
      return null;
    }

    const context = layerFocusContext(activeWindow);

    if (!context) {
      return null;
    }

    const contextKeyValue = contextKey(context);
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === context.outputId,
    );
    const desktop = this.workspace.desktops.find(
      (candidate) => candidate.id === context.desktopId,
    );

    if (!output || !desktop) {
      return null;
    }

    const topologyRevision = this.topologyRevision;
    const stateRevision = this.windowStateRevisions.get(activeId) ?? 0;
    let contextGeometry: ContextGeometry | null;
    let originalFrame: Rect;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
      originalFrame = snapshotRect(activeWindow.frameGeometry);
    } catch {
      return null;
    }

    if (!contextGeometry) {
      return null;
    }

    const command: ManualFloatingFrameCommand = {
      activeId,
      activeWindow,
      context,
      contextGeometry,
      contextKey: contextKeyValue,
      desktop,
      floating,
      originalFrame,
      output,
      stateRevision,
      topologyRevision,
    };

    return this.manualFloatingFrameChangeIsCurrent(command) ? command : null;
  }

  private pendingManualFloatingWidthChangeBlocksFrameChange(
    id: WindowId,
  ): boolean {
    const operation = this.pendingManualFloatingWidthChanges.get(id);

    if (!operation) {
      return false;
    }

    if (!this.pendingManualFloatingWidthChangeIsCurrent(operation)) {
      this.finishPendingManualFloatingWidthChange(operation, "rejected");
    }

    return true;
  }

  private manualFloatingFrameChangeIsCurrent(
    command: ManualFloatingFrameCommand,
    allowedPendingWidthChange?: PendingManualFloatingWidthChange,
  ): boolean {
    const pendingWidthChange = this.pendingManualFloatingWidthChanges.get(
      command.activeId,
    );

    if (
      !this.started ||
      !this.startupCompleted ||
      this.initializing ||
      this.hydrationInProgress ||
      this.stackEditOperation !== null ||
      this.windowTransferOperation !== null ||
      this.stackedNativeStateOperation !== null ||
      this.startupStabilizationToken !== null ||
      this.hasUnsettledTopology() ||
      this.hasTopologyBarrier() ||
      this.ownershipRefreshInProgress ||
      this.interactiveResizeSource !== null ||
      this.pointerMoveIntent !== null ||
      this.pointerResizeIntent !== null ||
      this.pointerResizeSettlement !== null ||
      this.pendingExpelFocusHandoff !== null ||
      this.workspace.activeWindow !== command.activeWindow ||
      this.observer.source(command.activeId) !== command.activeWindow ||
      this.floatingWindows.get(command.activeId) !== command.floating ||
      command.floating.currentContextKey !== command.contextKey ||
      this.managedWindows.has(command.activeId) ||
      this.automaticFloatingWindows.has(command.activeId) ||
      this.pendingWindowSyncs.has(command.activeId) ||
      this.waitingWindowContexts.has(command.activeId) ||
      this.pendingHydratedRestoreBaselines.has(command.activeId) ||
      this.pendingFullscreenTargets.has(command.activeId) ||
      this.unconfirmedFullscreenTargets.has(command.activeId) ||
      this.unconfirmedFullscreenRetentions.has(command.activeId) ||
      this.pendingExternalFullscreenExtractions.has(command.activeId) ||
      this.fullscreenRequestProbes.has(command.activeId) ||
      (pendingWidthChange !== undefined &&
        pendingWidthChange !== allowedPendingWidthChange) ||
      this.suspendedWindows.has(command.activeId) ||
      this.requestedSuspensions.has(command.activeId) ||
      this.resumeSamples.has(command.activeId) ||
      this.transientResumeProbes.has(command.activeId) ||
      this.capacityLeaseByWindow.has(command.activeId) ||
      this.capacitySupersededParkWindows.has(command.activeId) ||
      this.toggleGeometryTransitions.has(command.activeId) ||
      this.borderSynchronizationIds.has(command.activeId) ||
      this.borderlessSettlementTokens.has(command.activeId) ||
      this.topologyRevision !== command.topologyRevision ||
      (this.windowStateRevisions.get(command.activeId) ?? 0) !==
        command.stateRevision ||
      !this.workspace.screens.includes(command.output) ||
      !this.workspace.desktops.includes(command.desktop) ||
      command.activeWindow.output !== command.output ||
      command.activeWindow.desktops.length !== 1 ||
      command.activeWindow.desktops[0] !== command.desktop ||
      currentDesktopForOutput(this.workspace, command.output) !==
        command.desktop ||
      !isGeometryWritable(command.activeWindow) ||
      this.applicationTilingExclusionApplies(command.activeWindow) ||
      this.automaticallyFloats(command.activeWindow)
    ) {
      return false;
    }

    const liveContext = layerFocusContext(command.activeWindow);

    if (!liveContext || contextKey(liveContext) !== command.contextKey) {
      return false;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        command.context.outputId,
        command.context.desktopId,
      );
    } catch {
      return false;
    }

    return (
      contextGeometry !== null &&
      contextGeometry.fingerprint === command.contextGeometry.fingerprint
    );
  }

  private compensateManualFloatingFrameChange(
    command: ManualFloatingFrameCommand,
    targetFrame: Rect,
    forwardWrites: number,
  ): number {
    let forwardFrame: Rect;

    try {
      forwardFrame = snapshotRect(command.activeWindow.frameGeometry);
    } catch {
      return 0;
    }

    if (
      forwardWrites !== 1 ||
      !this.manualFloatingFrameChangeIsCurrent(command) ||
      !floatingFrameChangeResultIsTransactionOwned(
        command.originalFrame,
        targetFrame,
        forwardFrame,
        command.contextGeometry.workArea,
      ) ||
      !this.geometry.canApplyFrame(
        command.activeId,
        command.originalFrame,
        command.context,
      )
    ) {
      return 0;
    }

    let compensationWrites = 0;

    try {
      compensationWrites = this.geometry.apply(
        [{ frame: command.originalFrame, windowId: command.activeId }],
        command.context,
        () =>
          this.manualFloatingFrameChangeIsCurrent(command) &&
          rectsEqual(command.activeWindow.frameGeometry, forwardFrame),
      );
    } catch (error) {
      console.warn(
        `[driftile] floating frame change compensation failed window=${String(command.activeId)} error=${String(error)}`,
      );
      return compensationWrites;
    }

    let restored: boolean;

    try {
      restored = rectsEqual(
        command.activeWindow.frameGeometry,
        command.originalFrame,
      );
    } catch {
      restored = false;
    }

    if (compensationWrites !== 1 || !restored) {
      console.warn(
        `[driftile] floating frame change compensation was not acknowledged window=${String(command.activeId)}`,
      );
    }

    return compensationWrites;
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
        (manualFloating.currentContextKey !== sourceContextKey ||
          this.automaticallyFloats(activeWindow))) ||
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

      if (command.classification.kind === "manual") {
        this.floatingWindows.set(command.activeId, {
          ...command.classification.floating,
          currentContextKey: command.targetContextKey,
        });
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
        this.pendingHydratedRestoreBaselines.delete(command.activeId);
        this.managedWindows.delete(command.activeId);
        context.windowIds.delete(command.activeId);
        this.floatingWindows.set(command.activeId, {
          currentContextKey: command.contextKey,
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
      floating.currentContextKey !== command.contextKey ||
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
        : this.freshDetachedWindowPlacement(
            command.activeId,
            command.activeWindow,
            command.context,
            command.contextGeometry,
            before,
          );

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
    accept?: () => boolean,
    rollbackFrames?: ReadonlyMap<WindowId, Rect>,
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
      accept,
      rollbackFrames,
    );
  }

  private applyColumnWidthAndViewport(
    command: ActiveColumnCommand,
    width: ColumnWidth,
    viewportOffset: number,
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

        if (previousWidth === null) {
          return false;
        }

        if (
          this.layout.setViewportOffset(
            command.context.outputId,
            command.context.desktopId,
            viewportOffset,
          )
        ) {
          return true;
        }

        this.layout.setActiveColumnWidth(command.activeId, previousWidth);
        previousWidth = null;
        return false;
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

  private columnFullWidthRestoreViewportOffset(
    contextKey: string,
    id: ColumnId,
  ): number | undefined {
    return this.columnFullWidthViewportRestore.get(contextKey)?.get(id);
  }

  private setColumnFullWidthRestore(
    contextKey: string,
    id: ColumnId,
    width: ColumnWidth,
    viewportOffset?: number,
  ): void {
    let contextRestore = this.columnFullWidthRestore.get(contextKey);

    if (!contextRestore) {
      contextRestore = new Map<ColumnId, ColumnWidth>();
      this.columnFullWidthRestore.set(contextKey, contextRestore);
    }

    contextRestore.set(id, { ...width });

    if (viewportOffset === undefined) {
      this.deleteColumnFullWidthViewportRestore(contextKey, id);
      return;
    }

    let viewportRestore = this.columnFullWidthViewportRestore.get(contextKey);

    if (!viewportRestore) {
      viewportRestore = new Map<ColumnId, number>();
      this.columnFullWidthViewportRestore.set(contextKey, viewportRestore);
    }

    viewportRestore.set(id, viewportOffset);
  }

  private deleteColumnFullWidthRestore(contextKey: string, id: ColumnId): void {
    this.deleteColumnFullWidthViewportRestore(contextKey, id);
    const contextRestore = this.columnFullWidthRestore.get(contextKey);

    if (!contextRestore) {
      return;
    }

    contextRestore.delete(id);

    if (contextRestore.size === 0) {
      this.columnFullWidthRestore.delete(contextKey);
    }
  }

  private deleteColumnFullWidthViewportRestore(
    contextKey: string,
    id: ColumnId,
  ): void {
    const viewportRestore = this.columnFullWidthViewportRestore.get(contextKey);

    if (!viewportRestore) {
      return;
    }

    viewportRestore.delete(id);

    if (viewportRestore.size === 0) {
      this.columnFullWidthViewportRestore.delete(contextKey);
    }
  }

  private pruneColumnFullWidthRestores(): void {
    for (const [key, restores] of this.columnFullWidthRestore) {
      const context = this.contexts.get(key);
      const parsed = context ?? managedContextFromKey(key);
      const leases = this.capacityLeasesByContext.get(key);

      if (!parsed && !leases) {
        this.columnFullWidthRestore.delete(key);
        this.columnFullWidthViewportRestore.delete(key);
        continue;
      }

      const liveColumnIds = new Set<ColumnId>();

      if (parsed) {
        for (const column of this.layout.snapshot(
          parsed.outputId,
          parsed.desktopId,
        ).columns) {
          liveColumnIds.add(column.id);
        }
      }

      for (const lease of leases ?? []) {
        liveColumnIds.add(lease.column.column.id);
      }

      for (const id of restores.keys()) {
        if (!liveColumnIds.has(id)) {
          restores.delete(id);
          this.deleteColumnFullWidthViewportRestore(key, id);
        }
      }

      if (restores.size === 0) {
        this.columnFullWidthRestore.delete(key);
        this.columnFullWidthViewportRestore.delete(key);
      }
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
        this.deleteColumnFullWidthViewportRestore(contextKey, id);
      }
    }

    if (contextRestore.size === 0) {
      this.columnFullWidthRestore.delete(contextKey);
      this.columnFullWidthViewportRestore.delete(contextKey);
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
    activeId: WindowId,
    activeWindow: KWinWindow,
    managedContext: ManagedContext,
    contextGeometry: ContextGeometry,
    context: LayoutContextSnapshot,
  ): DetachedWindowPlacement | null {
    const columnIds = new Set(context.columns.map((column) => column.id));
    const canonical = columnId(`column:${String(activeId)}`);
    let detachedColumnId = canonical;

    if (columnIds.has(detachedColumnId)) {
      const base = `column:floating:${String(activeId)}`;

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
      [activeWindow],
      contextGeometry,
    );

    if (!width) {
      return null;
    }

    return {
      columnId: detachedColumnId,
      columnIndex,
      columnWidth: width,
      desktopId: managedContext.desktopId,
      memberIndex: 0,
      nextColumnId: context.columns[columnIndex]?.id ?? null,
      nextWindowId: null,
      outputId: managedContext.outputId,
      previousColumnId: context.columns[columnIndex - 1]?.id ?? null,
      previousWindowId: null,
      windowId: activeId,
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

    try {
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
    } catch (error) {
      if (this.toggleTransitionProbes.get(key) === probe) {
        this.toggleTransitionProbes.delete(key);
      }

      for (const [id, transition] of this.toggleGeometryTransitions) {
        if (transition.contextKey === key) {
          this.toggleGeometryTransitions.delete(id);
        }
      }

      const context = this.contexts.get(key);

      if (context) {
        this.markContextDirty(context);
      }

      console.warn(
        `[driftile] geometry settlement scheduling failed context=${key} error=${String(error)}`,
      );
    }
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
    sampledContextGeometries?: ReadonlyMap<string, ContextGeometry>,
  ): ActiveColumnCommand | null {
    const activeWindow = this.workspace.activeWindow;

    if (
      !this.started ||
      (this.stackEditOperation !== null &&
        this.stackEditOperation !== existingOperation) ||
      this.interactiveResizeSource !== null ||
      (this.pointerResizeIntent !== null &&
        this.pointerResizeIntent !== existingOperation) ||
      this.windowTransferOperation ||
      this.startupStabilizationToken !== null ||
      this.hasTopologyBarrier() ||
      !activeWindow ||
      this.automaticallyFloats(activeWindow)
    ) {
      return null;
    }

    const sampledGeometries =
      sampledContextGeometries ?? this.sampleSettledVisibleContextGeometries();

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

  private commitFinishedExternalPointerMove(
    id: WindowId,
    source: KWinWindow,
    nextContext: ManagedContext,
    pendingIds: readonly WindowId[],
  ): boolean {
    const intent = this.pointerMoveIntent;
    const external = intent?.externalDrop;

    if (!intent || !external || intent.draggedWindowId !== id) {
      return false;
    }

    const reject = (): false => {
      if (this.pointerMoveIntent === intent) {
        this.pointerMoveIntent = null;
      }

      return false;
    };
    const insertion = external.insertion;

    if (insertion.state !== "ready") {
      return reject();
    }

    const sourceRuntimeContext = this.contexts.get(intent.contextKey);
    const targetRuntimeContext = this.contexts.get(external.contextKey);

    if (
      intent.phase !== "finished" ||
      !intent.finalCursor ||
      intent.source !== source ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      contextKey(nextContext) !== external.contextKey ||
      this.workspace.activeWindow !== source ||
      !this.settledPointerMoveSourceIsEligible(source) ||
      !sourceRuntimeContext ||
      sourceRuntimeContext.geometryFingerprint !== intent.contextFingerprint ||
      targetRuntimeContext !== insertion.runtimeContext ||
      targetRuntimeContext.geometryFingerprint !==
        insertion.contextFingerprint ||
      this.dirtyContexts.has(intent.contextKey) ||
      this.dirtyContexts.has(external.contextKey) ||
      this.pendingAdmissionContexts.has(intent.contextKey) ||
      this.pendingAdmissionContexts.has(external.contextKey) ||
      this.hasStructuralCapacityState(intent.contextKey) ||
      this.hasStructuralCapacityState(external.contextKey) ||
      this.waitingWindowIds.has(intent.contextKey) ||
      this.waitingWindowIds.has(external.contextKey) ||
      this.toggleTransitionPending(intent.contextKey) ||
      this.toggleTransitionPending(external.contextKey) ||
      !this.pointerExternalTransferMechanismIsCurrent(
        intent,
        external,
        source,
      ) ||
      !this.pointerExternalParticipantsAreCurrent(
        intent,
        sourceRuntimeContext,
        targetRuntimeContext,
      ) ||
      !this.pointerExternalBatchIsIsolated(
        id,
        pendingIds,
        intent.contextKey,
        external.contextKey,
      )
    ) {
      return reject();
    }

    let sourceContextGeometry: ContextGeometry | null;
    let targetContextGeometry: ContextGeometry | null;

    try {
      sourceContextGeometry = this.geometry.contextGeometry(
        sourceRuntimeContext.outputId,
        sourceRuntimeContext.desktopId,
      );
      targetContextGeometry = this.geometry.contextGeometry(
        targetRuntimeContext.outputId,
        targetRuntimeContext.desktopId,
      );
    } catch {
      return reject();
    }

    if (
      !sourceContextGeometry ||
      !targetContextGeometry ||
      sourceContextGeometry.fingerprint !== intent.contextFingerprint ||
      targetContextGeometry.fingerprint !== insertion.contextFingerprint ||
      !layoutContextSnapshotsEqual(
        this.layout.snapshot(
          sourceRuntimeContext.outputId,
          sourceRuntimeContext.desktopId,
        ),
        intent.before,
      ) ||
      !layoutContextSnapshotsEqual(
        this.layout.snapshot(
          targetRuntimeContext.outputId,
          targetRuntimeContext.desktopId,
        ),
        insertion.layout,
      )
    ) {
      return reject();
    }

    let targetBeforeGeometry: ReturnType<typeof solveStripGeometry>;

    try {
      targetBeforeGeometry = this.solveContextGeometry(
        insertion.layout,
        targetContextGeometry,
      );
    } catch {
      return reject();
    }

    const currentTarget = planPointerExternalWindowDrop({
      context: insertion.layout,
      cursor: intent.finalCursor,
      draggedWindowId: id,
      visibleArea: targetContextGeometry.workArea,
      windows: targetBeforeGeometry.windows,
    });

    if (
      !currentTarget ||
      currentTarget.position !== insertion.target.position ||
      currentTarget.targetWindowId !== insertion.target.targetWindowId
    ) {
      return reject();
    }

    const sourceColumn = intent.before.columns.find((column) =>
      column.windowIds.includes(id),
    );

    if (!sourceColumn || sourceColumn.id !== intent.before.activeColumnId) {
      return reject();
    }

    const previewValue = this.layout.previewWindowTransferToWindow(id, {
      desktopId: external.context.desktopId,
      outputId: external.context.outputId,
      ...insertion.target,
    });

    if (!previewValue) {
      return reject();
    }

    const preview: ContextTransferPreview = {
      kind: "window",
      value: previewValue,
    };
    let sourceLayout: ReturnType<typeof solveStripGeometry>;
    let targetLayout: ReturnType<typeof solveStripGeometry>;

    try {
      sourceLayout = this.solveContextGeometry(
        previewValue.sourceLayout,
        sourceContextGeometry,
      );
      targetLayout = this.solveContextGeometry(
        previewValue.targetLayout,
        targetContextGeometry,
      );
    } catch {
      this.discardContextTransferPreview(preview);
      return reject();
    }

    const memberIds = new Set([id]);
    const commonCommand = {
      activeId: id,
      activeWindow: source,
      context: {
        desktopId: sourceRuntimeContext.desktopId,
        outputId: sourceRuntimeContext.outputId,
      },
      contextGeometry: sourceContextGeometry,
      contextKey: intent.contextKey,
      geometryPassiveIds: new Set<WindowId>(),
      memberIds,
      members: [{ id, minimized: false, window: source }],
      retainedSourceIds: new Set<WindowId>(),
      retainedSourceMembers: [],
      sourceColumn,
      sourceDesktop: intent.sourceDesktop,
      sourceRuntimeContext,
      targetContext: external.context,
      targetContextGeometry,
      targetContextKey: external.contextKey,
      targetDesktop: external.desktop,
      targetRuntimeContext,
      wholeColumn: false,
    };
    const command: DesktopTransferCommand | OutputTransferCommand =
      external.kind === "desktop"
        ? {
            ...commonCommand,
            output: intent.sourceOutput,
          }
        : {
            ...commonCommand,
            sourceOutput: intent.sourceOutput,
            targetOutput: external.output,
          };

    if (
      !this.transferLayoutIsSafe(
        sourceLayout,
        command.context,
        intent.contextKey,
        memberIds,
        intent.contextKey,
        external.contextKey,
      ) ||
      !this.transferLayoutIsSafe(
        targetLayout,
        external.context,
        external.contextKey,
        memberIds,
        intent.contextKey,
        external.contextKey,
      )
    ) {
      this.discardContextTransferPreview(preview);
      return reject();
    }

    const operation: WindowTransferOperation = {
      activeId: id,
      desktopChangeSuppressed: false,
      kind: external.kind,
      memberStateInvalidated: false,
      movingIds: memberIds,
      sourceContextKey: intent.contextKey,
      stateGuardIds: new Set([
        ...intent.participants.map((participant) => participant.id),
        ...insertion.participants.map((participant) => participant.id),
      ]),
      targetContextKey: external.contextKey,
    };
    this.windowTransferOperation = operation;

    try {
      return this.applyAdoptedPointerTransfer(
        intent,
        command,
        preview,
        sourceLayout,
        targetLayout,
        operation,
      );
    } finally {
      this.discardContextTransferPreview(preview);

      if (this.windowTransferOperation === operation) {
        this.windowTransferOperation = null;
      }

      if (this.pointerMoveIntent === intent) {
        this.pointerMoveIntent = null;
      }

      for (const key of [intent.contextKey, external.contextKey]) {
        const context = this.contexts.get(key);

        if (context) {
          this.refreshContextAutomaticFloatingOwnership(context);
        }
      }

      this.refreshAutomaticFloatingAdmissionQueue();
      this.handleWindowActivated(this.workspace.activeWindow);

      if (
        this.pendingWindowSyncs.size > 0 ||
        this.pendingAdmissionContexts.size > 0 ||
        this.dirtyContexts.size > 0
      ) {
        this.scheduleWork();
      }
    }
  }

  private applyAdoptedPointerTransfer(
    intent: PointerMoveIntent,
    command: DesktopTransferCommand | OutputTransferCommand,
    preview: ContextTransferPreview,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
    operation: WindowTransferOperation,
  ): boolean {
    const external = intent.externalDrop;
    const insertion = external?.insertion;

    if (!external || !insertion || insertion.state !== "ready") {
      return false;
    }

    const desktopTransfer = this.isDesktopTransferCommand(command);
    const topologyRevision = this.topologyRevision;
    const sourceWasDirty = this.dirtyContexts.has(command.contextKey);
    const targetWasDirty = this.dirtyContexts.has(command.targetContextKey);
    const changes: TransferGeometryChange[] = [];
    const rollbackTargets: TransferGeometryChange[] = [];
    const attemptedChanges: TransferGeometryChange[] = [];
    const appliedChanges: TransferGeometryChange[] = [];
    const destinationBaselines = new Map<WindowId, RestoreBaseline>();
    let forwardWrites = 0;
    let committed = false;
    let failure: string | null = null;

    try {
      if (
        !this.transferMemberStatesAreCurrent(command, operation) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout) ||
        !this.adoptedPointerTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        this.pointerMoveIntent !== intent
      ) {
        throw new Error("adopted pointer transfer ownership changed");
      }

      destinationBaselines.set(
        command.activeId,
        this.captureRestoreBaseline(
          command.activeWindow,
          command.targetContextGeometry.fingerprint,
        ),
      );

      const geometryPlans: readonly {
        readonly context: ManagedContext;
        readonly contextKey: string;
        readonly layout: ReturnType<typeof solveStripGeometry>;
      }[] = desktopTransfer
        ? [
            {
              context: command.targetContext,
              contextKey: command.targetContextKey,
              layout: targetLayout,
            },
          ]
        : [
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
          ];

      for (const plan of geometryPlans) {
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
          throw new Error("adopted pointer transfer geometry was rejected");
        }

        for (const change of diffWindowGeometries(
          plan.layout.windows,
          observedBefore,
        )) {
          const frame = observedBefore.get(change.windowId);

          if (!frame) {
            throw new Error("adopted pointer rollback frame is unavailable");
          }

          changes.push({
            ...change,
            context: plan.context,
            contextKey: plan.contextKey,
          });
          rollbackTargets.push({
            context: plan.context,
            contextKey: plan.contextKey,
            frame,
            windowId: change.windowId,
          });
        }
      }

      const activeChangeIndex = changes.findIndex(
        (change) => change.windowId === command.activeId,
      );

      if (activeChangeIndex >= 0 && activeChangeIndex < changes.length - 1) {
        const [activeChange] = changes.splice(activeChangeIndex, 1);

        if (activeChange) {
          changes.push(activeChange);
        }
      }

      if (!desktopTransfer) {
        this.dirtyContexts.delete(command.contextKey);
      }

      this.dirtyContexts.delete(command.targetContextKey);

      for (const change of changes) {
        if (
          this.pointerMoveIntent !== intent ||
          !this.adoptedPointerTransferOperationIsCurrent(
            command,
            operation,
            topologyRevision,
          ) ||
          !this.transferMemberStatesAreCurrent(command, operation) ||
          !this.windowOwnershipClassificationIsCurrent(change.windowId)
        ) {
          break;
        }

        attemptedChanges.push(change);
        this.toggleGeometryTransitions.set(change.windowId, {
          contextKey: change.contextKey,
          expectedFrame: { ...change.frame },
          settlementArmed: true,
        });
        const applied = this.geometry.apply(
          [change],
          change.context,
          (current) =>
            this.pointerMoveIntent === intent &&
            this.adoptedPointerTransferOperationIsCurrent(
              command,
              operation,
              topologyRevision,
            ) &&
            this.windowOwnershipClassificationIsCurrent(current.windowId),
        );

        if (applied !== 1) {
          break;
        }

        appliedChanges.push(change);
        forwardWrites += 1;
      }

      const changedWindowIds = new Set(
        changes.map((change) => change.windowId),
      );

      if (
        appliedChanges.length !== changes.length ||
        // XWayland may publish an accepted frame after the setter returns.
        !this.transferChangedFramesAreOwned(changes, rollbackTargets) ||
        this.pointerMoveIntent !== intent ||
        !this.adoptedPointerTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        ) ||
        !this.transferLayoutsOwnershipIsCurrent(sourceLayout, targetLayout) ||
        !this.adoptedPointerTransferFingerprintsMatch(command) ||
        !this.adoptedPointerTransferFinalStateIsSafe(
          command,
          sourceLayout,
          targetLayout,
          changedWindowIds,
        )
      ) {
        throw new Error("adopted pointer transfer transaction failed");
      }

      if (!this.commitContextTransferPreview(preview)) {
        throw new Error("adopted pointer transfer commit was rejected");
      }

      committed = true;
      this.scheduledMutationWrites += forwardWrites;

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

      if (desktopTransfer) {
        this.commitDesktopTransferRuntime(command, destinationBaselines);
      } else {
        this.commitOutputTransferRuntime(command, destinationBaselines);
      }

      this.reconcileColumnFullWidthRestore(
        command.contextKey,
        intent.before,
        preview.value.sourceLayout,
      );
      this.reconcileColumnFullWidthRestore(
        command.targetContextKey,
        insertion.layout,
        preview.value.targetLayout,
      );
    } catch (error) {
      failure = String(error);
    }

    if (committed) {
      if (failure !== null) {
        for (const key of [command.contextKey, command.targetContextKey]) {
          const context = this.contexts.get(key);

          if (context) {
            this.markContextDirty(context);
          }
        }

        this.pendingWindowSyncs.add(command.activeId);
        console.warn(
          `[driftile] adopted pointer transfer follow-up failed window=${String(command.activeId)} error=${failure}`,
        );
      }

      for (const key of [command.contextKey, command.targetContextKey]) {
        if (!this.toggleTransitionPending(key)) {
          continue;
        }

        try {
          this.scheduleToggleTransitionProbe(key);
        } catch (error) {
          console.warn(
            `[driftile] adopted pointer settlement scheduling failed context=${key} error=${String(error)}`,
          );
        }
      }

      this.requestLayoutStatePublication();
      return true;
    }

    let compensationWrites = 0;
    const forwardFrames = new Map(
      attemptedChanges.map((change) => [change.windowId, change.frame]),
    );
    let desktopDestinationRestored = true;

    if (desktopTransfer) {
      for (const rollback of [...rollbackTargets].reverse()) {
        const forwardFrame = forwardFrames.get(rollback.windowId);
        const window = this.observer.source(rollback.windowId);

        if (!forwardFrame) {
          continue;
        }

        if (!window) {
          desktopDestinationRestored = false;
          continue;
        }

        if (rectsEqual(window.frameGeometry, rollback.frame)) {
          continue;
        }

        if (
          !rectsEqual(window.frameGeometry, forwardFrame) ||
          !this.adoptedPointerDesktopCompensationIsSafe(
            command,
            rollback.windowId,
            window,
          )
        ) {
          desktopDestinationRestored = false;
          continue;
        }

        const applied = this.geometry.apply(
          [rollback],
          rollback.context,
          (current) =>
            this.observer.source(current.windowId) === window &&
            rectsEqual(window.frameGeometry, forwardFrame) &&
            this.adoptedPointerDesktopCompensationIsSafe(
              command,
              current.windowId,
              window,
            ),
        );
        compensationWrites += applied;

        if (applied !== 1) {
          desktopDestinationRestored = false;
        }
      }
    } else {
      for (const rollback of [...rollbackTargets].reverse()) {
        const forwardFrame = forwardFrames.get(rollback.windowId);
        const window = this.observer.source(rollback.windowId);

        if (
          !forwardFrame ||
          !window ||
          !rectsEqual(window.frameGeometry, forwardFrame)
        ) {
          continue;
        }

        compensationWrites += this.geometry.apply(
          [rollback],
          rollback.context,
          (current) =>
            this.observer.source(current.windowId) === window &&
            rectsEqual(window.frameGeometry, forwardFrame) &&
            this.windowOwnershipClassificationIsCurrent(current.windowId),
        );
      }
    }

    for (const change of attemptedChanges) {
      const transition = this.toggleGeometryTransitions.get(change.windowId);

      if (
        transition?.contextKey === change.contextKey &&
        rectsEqual(transition.expectedFrame, change.frame)
      ) {
        this.toggleGeometryTransitions.delete(change.windowId);
      }
    }

    if (sourceWasDirty) {
      this.dirtyContexts.add(command.contextKey);
    }

    if (targetWasDirty || (desktopTransfer && !desktopDestinationRestored)) {
      const targetContext = this.contexts.get(command.targetContextKey);

      if (targetContext) {
        this.markContextDirty(targetContext);
      }
    }

    this.scheduledMutationWrites += forwardWrites + compensationWrites;
    console.warn(
      `[driftile] adopted pointer transfer rolled back window=${String(command.activeId)} error=${failure ?? "unknown failure"}`,
    );
    return false;
  }

  private adoptedPointerDesktopCompensationIsSafe(
    command: DesktopTransferCommand,
    id: WindowId,
    window: KWinWindow,
  ): boolean {
    const targetRuntimeContext = command.targetRuntimeContext;
    const owner = this.managedWindows.get(id);
    const observed = normalizeWindow(window);
    const liveContext = observed ? managedContext(observed) : null;
    const ownerIsCurrent =
      id === command.activeId
        ? owner?.contextKey === command.contextKey &&
          command.sourceRuntimeContext.windowIds.has(id)
        : owner?.contextKey === command.targetContextKey &&
          targetRuntimeContext?.windowIds.has(id) === true;

    if (
      this.observer.source(id) !== window ||
      !targetRuntimeContext ||
      this.contexts.get(command.targetContextKey) !== targetRuntimeContext ||
      targetRuntimeContext.geometryFingerprint !==
        command.targetContextGeometry.fingerprint ||
      !ownerIsCurrent ||
      !liveContext ||
      contextKey(liveContext) !== command.targetContextKey ||
      !this.workspace.screens.includes(command.output) ||
      currentDesktopForOutput(this.workspace, command.output)?.id !==
        command.targetDesktop.id ||
      window.output?.name !== command.output.name ||
      !windowIsOnDesktop(window, command.targetDesktop) ||
      !isGeometryWritable(window) ||
      !this.windowOwnershipClassificationIsCurrent(id)
    ) {
      return false;
    }

    try {
      return (
        this.geometry.contextGeometry(
          command.targetContext.outputId,
          command.targetContext.desktopId,
        )?.fingerprint === command.targetContextGeometry.fingerprint
      );
    } catch {
      return false;
    }
  }

  private isDesktopTransferCommand(
    command: DesktopTransferCommand | OutputTransferCommand,
  ): command is DesktopTransferCommand {
    return "output" in command;
  }

  private adoptedPointerTransferOperationIsCurrent(
    command: DesktopTransferCommand | OutputTransferCommand,
    operation: WindowTransferOperation,
    topologyRevision: number,
  ): boolean {
    if (this.isDesktopTransferCommand(command)) {
      return (
        operation.kind === "desktop" &&
        this.desktopTransferOperationIsCurrent(
          command,
          operation,
          topologyRevision,
        )
      );
    }

    return (
      operation.kind === "output" &&
      this.outputTransferOperationIsCurrent(
        command,
        operation,
        topologyRevision,
      )
    );
  }

  private adoptedPointerTransferFingerprintsMatch(
    command: DesktopTransferCommand | OutputTransferCommand,
  ): boolean {
    return this.isDesktopTransferCommand(command)
      ? this.desktopTransferFingerprintsMatch(command)
      : this.outputTransferFingerprintsMatch(command);
  }

  private adoptedPointerTransferFinalStateIsSafe(
    command: DesktopTransferCommand | OutputTransferCommand,
    sourceLayout: ReturnType<typeof solveStripGeometry>,
    targetLayout: ReturnType<typeof solveStripGeometry>,
    changedWindowIds: ReadonlySet<WindowId>,
  ): boolean {
    if (!this.isDesktopTransferCommand(command)) {
      return this.outputTransferFinalStateIsSafe(
        command,
        sourceLayout,
        targetLayout,
        changedWindowIds,
      );
    }

    return (
      this.transferUnchangedFramesMatch(
        targetLayout,
        changedWindowIds,
        command.geometryPassiveIds,
      ) &&
      this.desktopTransferFinalStateIsSafe(command, sourceLayout, targetLayout)
    );
  }

  private pointerExternalParticipantsAreCurrent(
    intent: PointerMoveIntent,
    sourceContext: RuntimeContext,
    targetContext: RuntimeContext,
  ): boolean {
    const external = intent.externalDrop;
    const insertion = external?.insertion;

    if (
      !external ||
      !insertion ||
      insertion.state !== "ready" ||
      intent.participants.length !== sourceContext.windowIds.size ||
      insertion.participants.length !== targetContext.windowIds.size
    ) {
      return false;
    }

    const participantsAreCurrent = (
      participants: readonly PointerMoveParticipant[],
      ownerContext: RuntimeContext,
      liveContextKey: (id: WindowId) => string,
      ignoreDraggedRevision: boolean,
    ): boolean =>
      participants.every((participant) => {
        const window = this.observer.source(participant.id);
        const owner = this.managedWindows.get(participant.id);
        const observed = window ? normalizeWindow(window) : null;
        const liveContext = observed ? managedContext(observed) : null;

        return Boolean(
          window === participant.window &&
          owner?.contextKey === ownerContext.key &&
          ownerContext.windowIds.has(participant.id) &&
          liveContext &&
          contextKey(liveContext) === liveContextKey(participant.id) &&
          (ignoreDraggedRevision && participant.id === intent.draggedWindowId
            ? true
            : (this.windowStateRevisions.get(participant.id) ?? 0) ===
              participant.stateRevision) &&
          this.stackTransferMemberIsEligible(
            participant.id,
            participant.window,
            ownerContext,
            false,
          ),
        );
      });

    return (
      participantsAreCurrent(
        intent.participants,
        sourceContext,
        (participantId) =>
          participantId === intent.draggedWindowId
            ? external.contextKey
            : intent.contextKey,
        true,
      ) &&
      participantsAreCurrent(
        insertion.participants,
        targetContext,
        () => external.contextKey,
        false,
      )
    );
  }

  private pointerExternalBatchIsIsolated(
    activeId: WindowId,
    pendingIds: readonly WindowId[],
    sourceContextKey: string,
    targetContextKey: string,
  ): boolean {
    for (const id of pendingIds) {
      if (id === activeId) {
        continue;
      }

      const ownerContextKey = this.managedWindows.get(id)?.contextKey;
      const waitingContextKey = this.waitingWindowContexts.get(id);
      const window = this.observer.source(id);
      const observed = window ? normalizeWindow(window) : null;
      const liveContext = observed ? managedContext(observed) : null;
      const liveContextKey = liveContext ? contextKey(liveContext) : null;

      if (
        ownerContextKey === sourceContextKey ||
        ownerContextKey === targetContextKey ||
        waitingContextKey === sourceContextKey ||
        waitingContextKey === targetContextKey ||
        liveContextKey === sourceContextKey ||
        liveContextKey === targetContextKey
      ) {
        return false;
      }
    }

    return true;
  }

  private commitFinishedPointerResize(
    id: WindowId,
    source: KWinWindow,
    context: RuntimeContext,
  ): boolean {
    const intent = this.pointerResizeIntent;

    if (!intent || intent.resizedWindowId !== id) {
      return false;
    }

    if (this.pointerResizeSettlement?.intent === intent) {
      return true;
    }

    const reject = (): false => {
      if (this.pointerResizeIntent === intent) {
        this.pointerResizeIntent = null;
      }

      return false;
    };
    const acceptedFrame = intent.acceptedFrame;
    const inferred = acceptedFrame
      ? inferPointerHorizontalResize(intent.beforeFrame, acceptedFrame)
      : null;

    if (
      intent.phase !== "finished" ||
      !acceptedFrame ||
      !inferred ||
      inferred.edge !== intent.edge ||
      intent.source !== source ||
      intent.contextKey !== context.key ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      intent.contextFingerprint !== context.geometryFingerprint ||
      this.workspace.activeWindow !== source ||
      !this.settledPointerResizeSourceIsEligible(source) ||
      !rectsEqual(source.frameGeometry, acceptedFrame) ||
      source.output !== intent.sourceOutput ||
      currentDesktopForOutput(this.workspace, intent.sourceOutput)?.id !==
        intent.sourceDesktop.id ||
      this.dirtyContexts.has(context.key) ||
      this.pendingAdmissionContexts.has(context.key) ||
      this.hasStructuralCapacityState(context.key) ||
      this.toggleTransitionPending(context.key) ||
      !this.pointerResizeParticipantsAreCurrent(intent, context, true)
    ) {
      return reject();
    }

    const contextGeometry = this.sampleSettledContextGeometry(context);

    if (!contextGeometry) {
      return reject();
    }

    const command = this.prepareActiveColumnCommand(
      intent,
      new Map([[context.key, contextGeometry]]),
    );

    if (
      !command ||
      command.activeId !== id ||
      command.activeColumn.id !== intent.activeColumnId ||
      command.context !== context ||
      command.contextGeometry.fingerprint !== intent.contextFingerprint ||
      !layoutContextSnapshotsEqual(command.before, intent.before)
    ) {
      return reject();
    }

    const target: ColumnWidth = {
      kind: "fixed",
      value: inferred.width,
    };

    if (!this.beginPointerResizeSettlement(intent, command, target)) {
      return reject();
    }

    return true;
  }

  private pointerResizeParticipantsAreCurrent(
    intent: PointerResizeIntent,
    context: RuntimeContext,
    requireCapturedFrames: boolean,
  ): boolean {
    const activeColumn = intent.before.columns.find(
      (column) => column.id === intent.activeColumnId,
    );

    if (
      !activeColumn ||
      activeColumn.windowIds.length !== intent.participants.length
    ) {
      return false;
    }

    for (const contextWindowId of context.windowIds) {
      if (this.pendingWindowSyncs.has(contextWindowId)) {
        return false;
      }
    }

    for (const waitingId of this.waitingWindowIds.get(context.key) ?? []) {
      if (this.pendingWindowSyncs.has(waitingId)) {
        return false;
      }
    }

    return intent.participants.every((participant, index) => {
      const source = this.observer.source(participant.id);
      const owner = this.managedWindows.get(participant.id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;
      const constraints = source ? frameSizeConstraintBounds(source) : null;
      const expectedId = activeColumn.windowIds[index];
      const expectedFrame =
        participant.id === intent.resizedWindowId
          ? intent.acceptedFrame
          : participant.beforeFrame;

      return Boolean(
        participant.id === expectedId &&
        source === participant.window &&
        owner?.contextKey === context.key &&
        context.windowIds.has(participant.id) &&
        liveContext &&
        contextKey(liveContext) === context.key &&
        !this.suspendedWindows.has(participant.id) &&
        !this.requestedSuspensions.has(participant.id) &&
        !this.floatingWindows.has(participant.id) &&
        !this.waitingWindowContexts.has(participant.id) &&
        !this.automaticFloatingWindows.has(participant.id) &&
        !this.automaticallyFloats(participant.window) &&
        this.toggleGeometrySettled(participant.id) &&
        isGeometryWritable(participant.window) &&
        constraints !== null &&
        frameSizeConstraintBoundsEqual(constraints, participant.constraints) &&
        (participant.id === intent.resizedWindowId ||
          (this.windowStateRevisions.get(participant.id) ?? 0) ===
            participant.stateRevision) &&
        (!requireCapturedFrames ||
          (expectedFrame !== null &&
            rectsEqual(participant.window.frameGeometry, expectedFrame))),
      );
    });
  }

  private beginPointerResizeSettlement(
    intent: PointerResizeIntent,
    command: ActiveColumnCommand,
    targetWidth: ColumnWidth,
  ): boolean {
    const targetGeometry = this.previewActiveColumnView(
      command,
      targetWidth,
      command.before.viewportOffset,
    );

    if (
      !targetGeometry ||
      !this.canApplyLayout(targetGeometry.maxViewportOffset)
    ) {
      return false;
    }

    const targetLayout: LayoutContextSnapshot = {
      ...command.before,
      columns: command.before.columns.map((column) =>
        column.id === intent.activeColumnId
          ? { ...column, width: { ...targetWidth } }
          : column,
      ),
      viewportOffset: targetGeometry.viewportOffset,
    };
    const writableTargets = targetGeometry.windows.filter(
      (window) => !this.suspendedWindows.has(window.windowId),
    );

    if (
      writableTargets.length === 0 ||
      targetGeometry.windows.some((window) => {
        const source = this.observer.source(window.windowId);
        return !source || !respectsSizeConstraints(window.frame, source);
      }) ||
      writableTargets.some(
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

    const targetIds = writableTargets.map((window) => window.windowId);
    const observedBefore = this.geometry.observedFrames(
      targetIds,
      command.context,
    );

    if (observedBefore.size !== targetIds.length) {
      return false;
    }

    const participants = new Map(
      intent.participants.map((participant) => [participant.id, participant]),
    );
    const windows: PointerResizeSettlementWindow[] = [];

    for (const target of writableTargets) {
      const source = this.observer.source(target.windowId);
      const observedFrame = observedBefore.get(target.windowId);
      const participant = participants.get(target.windowId);
      const rollbackFrame = participant?.beforeFrame ?? observedFrame;
      const constraints = source ? frameSizeConstraintBounds(source) : null;
      const owner = this.managedWindows.get(target.windowId);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        !source ||
        !observedFrame ||
        !rollbackFrame ||
        !constraints ||
        owner?.contextKey !== command.context.key ||
        !command.context.windowIds.has(target.windowId) ||
        !liveContext ||
        contextKey(liveContext) !== command.context.key ||
        this.requestedSuspensions.has(target.windowId) ||
        this.floatingWindows.has(target.windowId) ||
        this.waitingWindowContexts.has(target.windowId) ||
        this.automaticFloatingWindows.has(target.windowId) ||
        this.automaticallyFloats(source) ||
        this.toggleGeometryTransitions.has(target.windowId) ||
        !isGeometryWritable(source) ||
        !respectsSizeConstraints(rollbackFrame, source) ||
        !this.geometry.canApplyFrame(
          target.windowId,
          rollbackFrame,
          command.context,
        )
      ) {
        return false;
      }

      windows.push({
        columnId: target.columnId,
        constraints: { ...constraints },
        id: target.windowId,
        rollbackFrame: snapshotRect(rollbackFrame),
        source,
        stateRevision: this.windowStateRevisions.get(target.windowId) ?? 0,
        targetFrame: snapshotRect(target.frame),
      });
    }

    const windowById = new Map(windows.map((window) => [window.id, window]));

    if (
      intent.participants.some((participant) => !windowById.has(participant.id))
    ) {
      return false;
    }

    const changes = diffWindowGeometries(writableTargets, observedBefore);
    const operation: PointerResizeSettlement = {
      attempts: 0,
      command,
      compensationWrites: 0,
      failure: null,
      forwardAttemptedIds: new Set(),
      forwardWrites: 0,
      intent,
      pending: false,
      phase: "forward",
      stableSamples: 0,
      targetLayout,
      targetWidth: { ...targetWidth },
      windowById,
      windows,
    };
    this.pointerResizeSettlement = operation;
    this.stackEditOperation = operation;
    this.dirtyContexts.delete(command.context.key);

    try {
      for (const change of changes) {
        operation.forwardAttemptedIds.add(change.windowId);
        const applied = this.geometry.apply(
          [change],
          command.context,
          (current) =>
            this.pointerResizeSettlement === operation &&
            this.pointerResizeIntent === intent &&
            this.observer.source(current.windowId) ===
              operation.windowById.get(current.windowId)?.source,
        );
        operation.forwardWrites += applied;

        if (applied !== 1) {
          break;
        }
      }
    } catch (error) {
      try {
        this.beginPointerResizeCompensation(
          operation,
          `target geometry staging failed: ${String(error)}`,
        );
      } catch (recoveryError) {
        this.finishPointerResizeSettlementRecovery(
          operation,
          `target geometry recovery failed: ${String(recoveryError)}`,
        );
      }

      return true;
    }

    if (operation.forwardWrites !== changes.length) {
      this.beginPointerResizeCompensation(
        operation,
        "a target geometry request was rejected",
      );
    } else {
      this.schedulePointerResizeSettlementProbe(operation);
    }

    return true;
  }

  private schedulePointerResizeSettlementProbe(
    operation: PointerResizeSettlement,
  ): void {
    if (
      !this.started ||
      this.pointerResizeSettlement !== operation ||
      operation.pending
    ) {
      return;
    }

    operation.pending = true;
    const runGeneration = this.runGeneration;
    let schedulerReturned = false;

    try {
      this.scheduleResume(() => {
        if (
          !this.started ||
          this.runGeneration !== runGeneration ||
          this.pointerResizeSettlement !== operation
        ) {
          return;
        }

        const synchronous = !schedulerReturned;

        if (!synchronous) {
          operation.pending = false;
        }

        try {
          this.probePointerResizeSettlement(operation);
        } catch (error) {
          try {
            if (operation.phase === "forward") {
              this.beginPointerResizeCompensation(
                operation,
                `settlement probe failed: ${String(error)}`,
              );
            } else {
              this.finishPointerResizeSettlementRecovery(
                operation,
                `rollback probe failed: ${String(error)}`,
              );
            }
          } catch (recoveryError) {
            this.finishPointerResizeSettlementRecovery(
              operation,
              `settlement recovery failed: ${String(recoveryError)}`,
            );
          }
        }

        if (synchronous && this.pointerResizeSettlement === operation) {
          operation.pending = false;
        }

        if (this.pointerResizeSettlement === operation && !operation.pending) {
          this.schedulePointerResizeSettlementProbe(operation);
        }
      });
      schedulerReturned = true;
    } catch (error) {
      operation.pending = false;

      try {
        if (operation.phase === "forward") {
          this.beginPointerResizeCompensation(
            operation,
            `settlement scheduling failed: ${String(error)}`,
          );
        } else {
          this.finishPointerResizeSettlementRecovery(
            operation,
            `rollback scheduling failed: ${String(error)}`,
          );
        }
      } catch (recoveryError) {
        this.finishPointerResizeSettlementRecovery(
          operation,
          `settlement scheduling recovery failed: ${String(recoveryError)}`,
        );
      }
    }
  }

  private probePointerResizeSettlement(
    operation: PointerResizeSettlement,
  ): void {
    operation.attempts += 1;

    if (operation.phase === "forward") {
      if (
        !this.pointerResizeSettlementStateIsCurrent(
          operation,
          operation.command.before,
        )
      ) {
        this.beginPointerResizeCompensation(
          operation,
          "the captured window state changed",
        );
        return;
      }

      if (this.pointerResizeSettlementFramesMatch(operation, "target")) {
        operation.stableSamples += 1;

        if (
          operation.stableSamples >= REQUIRED_POINTER_RESIZE_SETTLEMENT_SAMPLES
        ) {
          this.commitPointerResizeSettlement(operation);
        }

        return;
      }

      operation.stableSamples = 0;

      if (operation.attempts >= MAX_POINTER_RESIZE_SETTLEMENT_PROBES) {
        this.beginPointerResizeCompensation(
          operation,
          "target geometry did not settle",
        );
      }

      return;
    }

    if (
      !this.restorePointerResizeSettlementLayout(operation) ||
      !this.pointerResizeSettlementCanCompensate(operation)
    ) {
      if (operation.attempts >= MAX_POINTER_RESIZE_COMPENSATION_PROBES) {
        this.finishPointerResizeSettlementRecovery(
          operation,
          "captured rollback ownership was lost",
        );
      }

      return;
    }

    if (this.pointerResizeSettlementFramesMatch(operation, "rollback")) {
      operation.stableSamples += 1;

      if (
        operation.stableSamples >= REQUIRED_POINTER_RESIZE_COMPENSATION_SAMPLES
      ) {
        this.finishPointerResizeCompensation(operation);
      } else if (operation.attempts >= MAX_POINTER_RESIZE_COMPENSATION_PROBES) {
        this.finishPointerResizeSettlementRecovery(
          operation,
          "captured rollback quiet period did not settle",
        );
      }

      return;
    }

    operation.stableSamples = 0;
    this.applyPointerResizeCompensationFrames(operation);

    if (operation.attempts >= MAX_POINTER_RESIZE_COMPENSATION_PROBES) {
      this.finishPointerResizeSettlementRecovery(
        operation,
        "captured rollback geometry did not settle",
      );
    }
  }

  private commitPointerResizeSettlement(
    operation: PointerResizeSettlement,
  ): void {
    if (
      !this.pointerResizeSettlementStateIsCurrent(
        operation,
        operation.command.before,
      ) ||
      !this.pointerResizeSettlementFramesMatch(operation, "target")
    ) {
      this.beginPointerResizeCompensation(
        operation,
        "target acceptance changed before commit",
      );
      return;
    }

    const rollbackFrames = new Map(
      operation.windows.map(
        (window) => [window.id, window.rollbackFrame] as const,
      ),
    );
    this.lastWrites = 0;
    const applied = this.applyColumnWidth(
      operation.command,
      operation.targetWidth,
      "pointer column resize",
      () =>
        this.pointerResizeSettlementStateIsCurrent(
          operation,
          operation.targetLayout,
        ) && this.pointerResizeSettlementFramesMatch(operation, "target"),
      rollbackFrames,
    );

    if (!applied) {
      operation.compensationWrites += this.lastWrites;
      this.beginPointerResizeCompensation(
        operation,
        "the settled layout commit was rejected",
      );
      return;
    }

    const writes = operation.forwardWrites + this.lastWrites;
    this.pointerResizeSettlement = null;

    if (this.stackEditOperation === operation) {
      this.stackEditOperation = null;
    }

    if (this.pointerResizeIntent === operation.intent) {
      this.pointerResizeIntent = null;
    }

    this.handleWindowActivated(this.workspace.activeWindow);

    for (const window of operation.windows) {
      this.pendingWindowSyncs.delete(window.id);
    }

    this.dirtyContexts.delete(operation.command.context.key);
    this.recordPendingMutationWrites(writes);
    this.deleteColumnFullWidthRestore(
      operation.command.context.key,
      operation.intent.activeColumnId,
    );
    this.finishColumnWidthChange(operation.command.context.key);
    this.requestLayoutStatePublication();
    this.scheduleWork();
  }

  private beginPointerResizeCompensation(
    operation: PointerResizeSettlement,
    failure: string,
  ): void {
    if (this.pointerResizeSettlement !== operation) {
      return;
    }

    operation.phase = "compensating";
    operation.attempts = 0;
    operation.stableSamples = 0;
    operation.failure ??= failure;

    try {
      if (!this.restorePointerResizeSettlementLayout(operation)) {
        this.finishPointerResizeSettlementRecovery(
          operation,
          "captured layout rollback was rejected",
        );
        return;
      }

      if (this.pointerResizeSettlementCanCompensate(operation)) {
        this.applyPointerResizeCompensationFrames(operation, true);
      }
    } catch (error) {
      this.finishPointerResizeSettlementRecovery(
        operation,
        `captured rollback request failed: ${String(error)}`,
      );
      return;
    }

    this.schedulePointerResizeSettlementProbe(operation);
  }

  private applyPointerResizeCompensationFrames(
    operation: PointerResizeSettlement,
    supersedeForwardRequests = false,
  ): void {
    const targets: WindowGeometry[] = operation.windows
      .filter(
        (window) =>
          (supersedeForwardRequests &&
            operation.forwardAttemptedIds.has(window.id)) ||
          !rectsEqual(window.source.frameGeometry, window.rollbackFrame),
      )
      .map((window) => ({
        columnId: window.columnId,
        frame: window.rollbackFrame,
        windowId: window.id,
      }));

    for (const target of targets) {
      operation.compensationWrites += this.geometry.apply(
        [target],
        operation.command.context,
        (change) => {
          const window = operation.windowById.get(change.windowId);
          return Boolean(
            window &&
            this.pointerResizeSettlementCompensationContextIsCurrent(
              operation,
            ) &&
            this.pointerResizeSettlementWindowCanCompensate(operation, window),
          );
        },
      );
    }
  }

  private finishPointerResizeCompensation(
    operation: PointerResizeSettlement,
  ): void {
    const failure = operation.failure ?? "target geometry was rejected";
    this.finishPointerResizeSettlement(operation);
    console.warn(
      `[driftile] pointer column resize rolled back context=${operation.command.context.key} error=${failure}`,
    );
  }

  private finishPointerResizeSettlementRecovery(
    operation: PointerResizeSettlement,
    failure: string,
  ): void {
    this.finishPointerResizeSettlement(operation);
    console.warn(
      `[driftile] pointer column resize recovery deferred context=${operation.command.context.key} error=${failure}`,
    );
  }

  private finishPointerResizeSettlement(
    operation: PointerResizeSettlement,
  ): void {
    if (this.pointerResizeSettlement !== operation) {
      return;
    }

    this.pointerResizeSettlement = null;

    if (this.stackEditOperation === operation) {
      this.stackEditOperation = null;
    }

    if (this.pointerResizeIntent === operation.intent) {
      this.pointerResizeIntent = null;
    }

    this.handleWindowActivated(this.workspace.activeWindow);

    for (const window of operation.windows) {
      this.pendingWindowSyncs.add(window.id);
    }

    const context = this.contexts.get(operation.command.context.key);

    if (context) {
      this.markContextDirty(context);
    }

    this.recordPendingMutationWrites(
      operation.forwardWrites + operation.compensationWrites,
    );

    this.scheduleWork();
  }

  private recordPendingMutationWrites(writes: number): void {
    if (writes <= 0) {
      return;
    }

    if (this.workFlushDepth > 0) {
      this.scheduledMutationWrites += writes;
    } else {
      this.pendingMutationWrites += writes;
    }
  }

  private pointerResizeSettlementStateIsCurrent(
    operation: PointerResizeSettlement,
    expectedLayout: LayoutContextSnapshot,
  ): boolean {
    const intent = operation.intent;
    const context = operation.command.context;

    if (
      !this.started ||
      this.pointerResizeSettlement !== operation ||
      this.stackEditOperation !== operation ||
      this.pointerResizeIntent !== intent ||
      this.interactiveResizeSource !== null ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      intent.contextFingerprint !== context.geometryFingerprint ||
      this.contexts.get(context.key) !== context ||
      this.workspace.activeWindow !== intent.source ||
      !this.settledPointerResizeSourceIsEligible(intent.source) ||
      intent.source.output !== intent.sourceOutput ||
      currentDesktopForOutput(this.workspace, intent.sourceOutput)?.id !==
        intent.sourceDesktop.id ||
      this.hasTopologyBarrier() ||
      this.pendingAdmissionContexts.has(context.key) ||
      this.hasStructuralCapacityState(context.key) ||
      this.dirtyContexts.has(context.key) ||
      this.toggleTransitionPending(context.key) ||
      !layoutContextSnapshotsEqual(
        this.layout.snapshot(context.outputId, context.desktopId),
        expectedLayout,
      ) ||
      this.pointerResizeSettlementHasUnexpectedPendingSync(operation)
    ) {
      return false;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch {
      return false;
    }

    if (
      !contextGeometry ||
      contextGeometry.fingerprint !== intent.contextFingerprint
    ) {
      return false;
    }

    return operation.windows.every((window) => {
      const source = this.observer.source(window.id);
      const owner = this.managedWindows.get(window.id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      return Boolean(
        source === window.source &&
        owner?.contextKey === context.key &&
        context.windowIds.has(window.id) &&
        liveContext &&
        contextKey(liveContext) === context.key &&
        !this.suspendedWindows.has(window.id) &&
        !this.requestedSuspensions.has(window.id) &&
        !this.floatingWindows.has(window.id) &&
        !this.waitingWindowContexts.has(window.id) &&
        !this.automaticFloatingWindows.has(window.id) &&
        !this.automaticallyFloats(window.source) &&
        !this.toggleGeometryTransitions.has(window.id) &&
        isGeometryWritable(window.source) &&
        (this.windowStateRevisions.get(window.id) ?? 0) ===
          window.stateRevision,
      );
    });
  }

  private pointerResizeSettlementCanCompensate(
    operation: PointerResizeSettlement,
  ): boolean {
    return (
      this.pointerResizeSettlementCompensationContextIsCurrent(operation) &&
      operation.windows.every((window) =>
        this.pointerResizeSettlementWindowCanCompensate(operation, window),
      )
    );
  }

  private pointerResizeSettlementCompensationContextIsCurrent(
    operation: PointerResizeSettlement,
  ): boolean {
    const intent = operation.intent;
    const context = operation.command.context;

    if (
      !this.started ||
      this.pointerResizeSettlement !== operation ||
      this.stackEditOperation !== operation ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      intent.contextFingerprint !== context.geometryFingerprint ||
      this.contexts.get(context.key) !== context ||
      this.hasTopologyBarrier()
    ) {
      return false;
    }

    try {
      return (
        this.geometry.contextGeometry(context.outputId, context.desktopId)
          ?.fingerprint === intent.contextFingerprint
      );
    } catch {
      return false;
    }
  }

  private pointerResizeSettlementWindowCanCompensate(
    operation: PointerResizeSettlement,
    window: PointerResizeSettlementWindow,
  ): boolean {
    const context = operation.command.context;
    const source = this.observer.source(window.id);
    const observed = source ? normalizeWindow(source) : null;
    const liveContext = observed ? managedContext(observed) : null;

    return Boolean(
      source === window.source &&
      this.managedWindows.get(window.id)?.contextKey === context.key &&
      context.windowIds.has(window.id) &&
      liveContext &&
      contextKey(liveContext) === context.key &&
      !this.suspendedWindows.has(window.id) &&
      !this.requestedSuspensions.has(window.id) &&
      !this.floatingWindows.has(window.id) &&
      !this.waitingWindowContexts.has(window.id) &&
      !this.automaticFloatingWindows.has(window.id) &&
      !this.automaticallyFloats(window.source) &&
      !this.toggleGeometryTransitions.has(window.id) &&
      isGeometryWritable(window.source) &&
      (this.windowStateRevisions.get(window.id) ?? 0) ===
        window.stateRevision &&
      this.geometry.canApplyFrame(window.id, window.rollbackFrame, context),
    );
  }

  private pointerResizeIsSettling(): boolean {
    return this.pointerResizeSettlement !== null;
  }

  private pointerResizeSettlementFramesMatch(
    operation: PointerResizeSettlement,
    frameKind: "rollback" | "target",
  ): boolean {
    return operation.windows.every((window) => {
      const constraints = frameSizeConstraintBounds(window.source);
      const expectedFrame =
        frameKind === "target" ? window.targetFrame : window.rollbackFrame;

      return (
        this.observer.source(window.id) === window.source &&
        constraints !== null &&
        frameSizeConstraintBoundsEqual(constraints, window.constraints) &&
        rectsEqual(window.source.frameGeometry, expectedFrame)
      );
    });
  }

  private pointerResizeSettlementHasUnexpectedPendingSync(
    operation: PointerResizeSettlement,
  ): boolean {
    const contextKeyValue = operation.command.context.key;

    for (const id of this.pendingWindowSyncs) {
      if (operation.windowById.has(id)) {
        continue;
      }

      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (
        this.managedWindows.get(id)?.contextKey === contextKeyValue ||
        this.waitingWindowContexts.get(id) === contextKeyValue ||
        this.capacityLeaseByWindow.get(id)?.contextKey === contextKeyValue ||
        (liveContext && contextKey(liveContext) === contextKeyValue)
      ) {
        return true;
      }
    }

    return false;
  }

  private restorePointerResizeSettlementLayout(
    operation: PointerResizeSettlement,
  ): boolean {
    const context = operation.command.context;
    const current = this.layout.snapshot(context.outputId, context.desktopId);

    if (layoutContextSnapshotsEqual(current, operation.command.before)) {
      return true;
    }

    const beforeColumn = operation.command.before.columns.find(
      (column) => column.id === operation.intent.activeColumnId,
    );

    if (!beforeColumn) {
      return false;
    }

    const previous = this.layout.setActiveColumnWidth(
      operation.intent.resizedWindowId,
      beforeColumn.width,
    );

    if (!previous) {
      return false;
    }

    this.layout.setViewportOffset(
      context.outputId,
      context.desktopId,
      operation.command.before.viewportOffset,
    );
    return layoutContextSnapshotsEqual(
      this.layout.snapshot(context.outputId, context.desktopId),
      operation.command.before,
    );
  }

  private commitFinishedPointerMove(
    id: WindowId,
    source: KWinWindow,
    context: RuntimeContext,
  ): boolean {
    const intent = this.pointerMoveIntent;

    if (
      !intent ||
      intent.externalDrop !== null ||
      intent.draggedWindowId !== id
    ) {
      return false;
    }

    const reject = (): false => {
      if (this.pointerMoveIntent === intent) {
        this.pointerMoveIntent = null;
      }

      return false;
    };

    if (
      intent.phase !== "finished" ||
      !intent.finalCursor ||
      !intent.finishedFrame ||
      intent.source !== source ||
      intent.contextKey !== context.key ||
      intent.generation !== this.runGeneration ||
      intent.topologyRevision !== this.topologyRevision ||
      intent.gap !== this.gap ||
      intent.contextFingerprint !== context.geometryFingerprint ||
      this.workspace.activeWindow !== source ||
      !this.settledPointerMoveSourceIsEligible(source) ||
      !rectsEqual(source.frameGeometry, intent.finishedFrame) ||
      this.hasStructuralCapacityState(context.key) ||
      this.toggleTransitionPending(context.key) ||
      !this.pointerMoveParticipantsAreCurrent(intent, context)
    ) {
      return reject();
    }

    const command = this.prepareActiveColumnCommand();

    if (
      !command ||
      command.activeId !== id ||
      command.context !== context ||
      command.contextGeometry.fingerprint !== intent.contextFingerprint ||
      !layoutContextSnapshotsEqual(command.before, intent.before)
    ) {
      return reject();
    }

    let solved: ReturnType<typeof solveStripGeometry>;

    try {
      solved = this.solveContextGeometry(
        command.before,
        command.contextGeometry,
      );
    } catch {
      return reject();
    }

    const target: PointerWindowDropTarget | null = planPointerWindowDrop({
      context: command.before,
      cursor: intent.finalCursor,
      draggedWindowId: id,
      visibleArea: command.contextGeometry.workArea,
      windows: solved.windows,
    });

    if (!target) {
      return reject();
    }

    const editState: { value: StackEditResult | null } = { value: null };
    const applied = this.applyActiveColumnMutation(
      command,
      "pointer window drop",
      () => {
        editState.value = this.layout.reinsertWindow(id, target);
        return editState.value !== null;
      },
      () =>
        editState.value !== null &&
        this.layout.rollbackStackEdit(editState.value.rollback),
      () =>
        this.pointerMoveIntent === intent &&
        intent.generation === this.runGeneration &&
        intent.topologyRevision === this.topologyRevision &&
        intent.gap === this.gap &&
        intent.contextFingerprint === context.geometryFingerprint &&
        this.workspace.activeWindow === source &&
        this.settledPointerMoveSourceIsEligible(source) &&
        this.pointerMoveParticipantsAreCurrent(intent, context),
    );
    const edit = editState.value;
    this.pointerMoveIntent = null;

    if (!applied || !edit) {
      return false;
    }

    this.scheduledMutationWrites += this.lastWrites;
    this.layout.discardStackEditRollback(edit.rollback);
    this.reconcileColumnFullWidthRestore(
      context.key,
      command.before,
      this.layout.snapshot(context.outputId, context.desktopId),
    );
    this.capacityParkBackoffs.delete(context.key);

    if (edit.kind === "merge" && this.waitingWindowIds.get(context.key)?.size) {
      this.pendingAdmissionContexts.add(context.key);
      this.scheduleWork();
    }

    this.requestLayoutStatePublication();
    return true;
  }

  private pointerMoveParticipantsAreCurrent(
    intent: PointerMoveIntent,
    context: RuntimeContext,
  ): boolean {
    if (
      intent.participants.length !== context.windowIds.size ||
      this.pointerContextHasPendingSync(intent, context)
    ) {
      return false;
    }

    return intent.participants.every((participant) => {
      const source = this.observer.source(participant.id);
      const owner = this.managedWindows.get(participant.id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      return Boolean(
        source === participant.window &&
        owner?.contextKey === context.key &&
        liveContext &&
        contextKey(liveContext) === context.key &&
        (participant.id === intent.draggedWindowId ||
          (this.windowStateRevisions.get(participant.id) ?? 0) ===
            participant.stateRevision) &&
        this.stackTransferMemberIsEligible(
          participant.id,
          participant.window,
          context,
          false,
        ),
      );
    });
  }

  private pointerContextHasPendingSync(
    intent: PointerMoveIntent,
    context: RuntimeContext,
  ): boolean {
    if (this.pendingWindowSyncs.size === 0) {
      return false;
    }

    const participantIds = new Set(
      intent.participants.map((participant) => participant.id),
    );

    for (const id of this.pendingWindowSyncs) {
      if (
        participantIds.has(id) ||
        this.managedWindows.get(id)?.contextKey === context.key ||
        this.waitingWindowContexts.get(id) === context.key ||
        this.capacityLeaseByWindow.get(id)?.contextKey === context.key
      ) {
        return true;
      }

      const source = this.observer.source(id);
      const observed = source ? normalizeWindow(source) : null;
      const liveContext = observed ? managedContext(observed) : null;

      if (liveContext && contextKey(liveContext) === context.key) {
        return true;
      }
    }

    return false;
  }

  private applyActiveColumnMutation(
    command: ActiveColumnCommand,
    label: string,
    mutate: () => boolean,
    rollback: () => boolean,
    accept?: () => boolean,
    rollbackFrames?: ReadonlyMap<WindowId, Rect>,
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

    if (
      rollbackFrames &&
      [...rollbackFrames.keys()].some((id) => !observedBefore.has(id))
    ) {
      restoreLayout();
      return false;
    }

    for (const window of writableLayout) {
      const observedFrame = observedBefore.get(window.windowId);
      const rollbackFrame = rollbackFrames?.get(window.windowId);
      const frame = rollbackFrame ?? observedFrame;
      const source = mutationSources.get(window.windowId);

      if (
        !observedFrame ||
        !frame ||
        !source ||
        this.observer.source(window.windowId) !== source ||
        (rollbackFrame !== undefined &&
          (!respectsSizeConstraints(rollbackFrame, source) ||
            !this.geometry.canApplyFrame(
              window.windowId,
              rollbackFrame,
              context,
            )))
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
    const rollbackTargets = rollbackLayout.filter((window) => {
      const observedFrame = observedBefore.get(window.windowId);
      return (
        forwardWindowIds.has(window.windowId) ||
        (observedFrame !== undefined &&
          !rectsEqual(observedFrame, window.frame))
      );
    });
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
      rollbackFrames !== undefined &&
      writableLayout.some((window) => {
        const source = mutationSources.get(window.windowId);
        return (
          !source ||
          this.observer.source(window.windowId) !== source ||
          !rectsEqual(source.frameGeometry, window.frame)
        );
      })
    ) {
      forwardError = `${label} geometry was not accepted`;
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
      const compensationAccepted =
        compensationTargets.length === rollbackTargets.length &&
        compensationTargets.every((window) => {
          const source = mutationSources.get(window.windowId);
          return (
            source !== undefined &&
            this.observer.source(window.windowId) === source &&
            rectsEqual(source.frameGeometry, window.frame)
          );
        });

      if (
        compensationWrites !== rollbackTargets.length ||
        !compensationAccepted ||
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

  private hasUnsettledTopology(): boolean {
    return (
      this.topologyRecoveryPending ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    );
  }

  private desktopLifecycleCanMutate(): boolean {
    return (
      this.started &&
      !this.hydrationInProgress &&
      !this.initializing &&
      !this.windowTransferOperation &&
      !this.hasTopologyBarrier()
    );
  }

  private initializeStartupWindows(): boolean {
    this.observer.discoverWindows();
    this.tryHydrateInitialLayoutState();

    if (this.initialLayoutHydrationStatus === "pending") {
      return false;
    }

    const topologyBatchPending = this.topologyWindowOrder !== null;
    const topologyBatchConsumed = this.synchronizePendingWindows(
      topologyBatchPending && this.topologyAllowsOverflowAdmissions,
    );

    if (topologyBatchPending && topologyBatchConsumed) {
      this.pruneColumnFullWidthRestores();
      this.topologyColumnByWindow.clear();
      this.topologyKnownOutputRestorations.clear();
      this.topologyAllowsOverflowAdmissions = false;
      this.topologyWindowOrder = null;
    }

    this.handleWindowActivated(
      this.workspace.activeWindow,
      topologyBatchPending && topologyBatchConsumed,
    );
    this.synchronizeWindowBorders();
    return true;
  }

  private completeStartup(): void {
    if (
      this.startupCompleted ||
      this.initialLayoutHydrationStatus === "pending"
    ) {
      return;
    }

    this.lastSettledTopology = this.currentLayoutPersistenceTopology();
    this.startupCompleted = true;

    if (this.initialLayoutHydrationStatus === "failed") {
      this.preservedFallbackLayoutState = this.captureLayoutState();
      return;
    }

    this.preserveLoadedLayoutState = false;
    this.requestLayoutStatePublication();
    this.flushLayoutStatePublication();
  }

  private tryHydrateInitialLayoutState(): boolean {
    if (this.initialLayoutHydrationStatus !== "pending") {
      this.hydrationInProgress = false;
      return false;
    }

    let failureReason: string | null = null;
    const topologyUnsettled = this.hasUnsettledTopology();

    if (topologyUnsettled && this.layoutStateForCurrentTopology) {
      this.initialLayoutHydrationWaited = true;
      this.initialLayoutHydrationCandidateFingerprint = null;
      this.initialLayoutHydrationStableSamples = 0;

      if (
        this.initialLayoutHydrationRetryRemaining > 0 &&
        this.scheduleInitialLayoutHydrationRetry()
      ) {
        this.hydrationInProgress = true;
        return false;
      }

      failureReason = "topology-unsettled";
    }

    try {
      let document = this.initialLayoutStateDocument;

      if (failureReason === null && this.layoutStateForCurrentTopology) {
        const selectedDocument: unknown = this.layoutStateForCurrentTopology();

        if (typeof selectedDocument !== "string") {
          throw new Error("layout state selection must return a string");
        }

        const selected =
          selectedDocument.length === 0 ? null : selectedDocument;

        if (selected !== document) {
          document = selected;
          this.initialLayoutStateDocument = selected;
          this.initialLayoutDecodedState = null;
          this.initialLayoutHydrationCandidateFingerprint = null;
          this.initialLayoutHydrationStableSamples = 0;
          this.layoutStatePublicationLocked = false;
        }
      }

      if (
        failureReason === null &&
        this.layoutStateForCurrentTopology &&
        this.hasUnsettledTopology()
      ) {
        this.initialLayoutHydrationWaited = true;
        this.initialLayoutHydrationCandidateFingerprint = null;
        this.initialLayoutHydrationStableSamples = 0;

        if (
          this.initialLayoutHydrationRetryRemaining > 0 &&
          this.scheduleInitialLayoutHydrationRetry()
        ) {
          this.hydrationInProgress = true;
          return false;
        }

        failureReason = "topology-unsettled";
      }

      if (failureReason === null && document === null) {
        this.finishInitialLayoutHydrationWithoutState();
        return false;
      }

      let state = this.initialLayoutDecodedState;

      if (failureReason === null && state === null && document !== null) {
        const decoded = decodeLayoutPersistence(document);

        if (!decoded.ok) {
          failureReason = decoded.error;
          this.layoutStatePublicationLocked =
            decoded.error === "unsupported-version" ||
            decoded.error === "document-too-large";
        } else {
          state = decoded.value;
          this.initialLayoutDecodedState = state;
        }
      }

      if (failureReason === null) {
        if (topologyUnsettled) {
          failureReason = "topology-unsettled";
        } else if (state !== null) {
          const input = this.liveLayoutHydrationInput();
          const planned = planLayoutHydration(state, input);

          if (!planned.ok) {
            if (
              planned.reason === "missing-live-window" &&
              this.initialLayoutHydrationRetryRemaining > 0
            ) {
              this.initialLayoutHydrationWaited = true;
              this.initialLayoutHydrationCandidateFingerprint = null;
              this.initialLayoutHydrationStableSamples = 0;

              if (this.scheduleInitialLayoutHydrationRetry()) {
                this.hydrationInProgress = true;
                return false;
              }

              failureReason = "retry-schedule-failed";
            } else {
              failureReason = planned.reason;
            }
          } else {
            const candidate = this.prepareLayoutHydrationCandidate(
              planned.value,
            );

            if (!candidate) {
              failureReason = "runtime-preflight";
            } else if (!this.layoutHydrationCandidateIsCurrent(candidate)) {
              failureReason = "live-state-changed";
            } else if (
              this.initialLayoutHydrationWaited &&
              !this.sampleInitialLayoutHydrationCandidate(candidate)
            ) {
              if (
                this.initialLayoutHydrationRetryRemaining > 0 &&
                this.scheduleInitialLayoutHydrationRetry()
              ) {
                this.hydrationInProgress = true;
                return false;
              }

              failureReason = "live-state-unsettled";
            } else if (!this.commitLayoutHydrationCandidate(candidate)) {
              failureReason = "runtime-state-changed";
            }
          }
        }
      }
    } catch (error) {
      failureReason = `runtime-error:${String(error)}`;
    }

    this.hydrationInProgress = false;
    this.initialLayoutDecodedState = null;
    this.initialLayoutHydrationCandidateFingerprint = null;
    this.initialLayoutHydrationRetryRemaining = 0;
    this.initialLayoutHydrationRetryToken = null;
    this.initialLayoutHydrationStableSamples = 0;
    this.initialLayoutHydrationWaited = false;
    this.initialLayoutStateDocument = null;

    if (failureReason !== null) {
      this.initialLayoutHydrationStatus = "failed";
      console.warn(
        `[driftile] initial layout hydration skipped reason=${failureReason}`,
      );
      return false;
    }

    this.initialLayoutHydrationStatus = "succeeded";
    this.preserveLoadedLayoutState = false;
    return true;
  }

  private finishInitialLayoutHydrationWithoutState(): void {
    this.hydrationInProgress = false;
    this.initialLayoutDecodedState = null;
    this.initialLayoutHydrationCandidateFingerprint = null;
    this.initialLayoutHydrationRetryRemaining = 0;
    this.initialLayoutHydrationRetryToken = null;
    this.initialLayoutHydrationStableSamples = 0;
    this.initialLayoutHydrationWaited = false;
    this.initialLayoutHydrationStatus = "none";
    this.initialLayoutStateDocument = null;
    this.layoutStatePublicationLocked = false;
    this.preserveLoadedLayoutState = false;
  }

  private liveLayoutHydrationInput(): LayoutPersistenceHydrationInput {
    const windows = this.observer.snapshot().map((observed) => {
      const source = this.observer.source(observed.id);
      const liveContext = managedContext(observed);
      const identity = layoutPersistenceWindowDescriptor(observed.id, source);

      return {
        desktopId: String(liveContext?.desktopId ?? ""),
        eligible: Boolean(
          source &&
          liveContext &&
          !this.automaticFloatingWindows.has(windowId(observed.id)) &&
          !this.automaticallyFloats(source),
        ),
        liveId: identity.liveId,
        outputName: observed.outputId,
        ...(identity.sessionMatch ?? {}),
      };
    });

    return {
      desktops: this.workspace.desktops.map((desktop) => ({ id: desktop.id })),
      outputs: this.workspace.screens.map(layoutPersistenceOutputDescriptor),
      windows,
    };
  }

  private currentLayoutPersistenceTopology(): LayoutPersistenceTopologyV2 | null {
    try {
      return {
        outputs: this.workspace.screens.map((output) => {
          const descriptor = layoutPersistenceOutputDescriptor(output);

          return { key: descriptor.name, ...descriptor };
        }),
      };
    } catch (error) {
      console.warn(
        `[driftile] layout topology descriptor unavailable error=${String(error)}`,
      );
      return null;
    }
  }

  private prepareKnownOutputTopologyRestorations(
    previousTopology: LayoutPersistenceTopologyV2 | null,
    currentTopology: LayoutPersistenceTopologyV2,
  ): void {
    this.topologyKnownOutputRestorations.clear();

    if (!previousTopology || !this.knownLayoutSnapshots) {
      return;
    }

    const transition = matchPersistedOutputs(
      previousTopology.outputs,
      liveOutputPersistenceDescriptors(currentTopology),
    );

    if (
      transition.matches.length !== previousTopology.outputs.length ||
      transition.unmatchedPersistedKeys.length !== 0 ||
      transition.unmatchedLiveIds.length === 0
    ) {
      return;
    }

    let snapshots: readonly LayoutPersistenceCatalogSnapshot[];

    try {
      snapshots = this.knownLayoutSnapshots();
    } catch (error) {
      console.warn(
        `[driftile] layout history unavailable error=${String(error)}`,
      );
      return;
    }

    let historicalSnapshot: LayoutPersistenceCatalogSnapshot | undefined;

    try {
      historicalSnapshot = snapshots.find((snapshot) =>
        snapshotTopologyMatches(snapshot, currentTopology),
      );
    } catch (error) {
      console.warn(
        `[driftile] layout history selection skipped error=${String(error)}`,
      );
      return;
    }

    if (!historicalSnapshot) {
      return;
    }

    let input: LayoutPersistenceHydrationInput;

    try {
      input = this.liveLayoutHydrationInput();
    } catch (error) {
      console.warn(
        `[driftile] live layout history input unavailable error=${String(error)}`,
      );
      return;
    }

    for (const outputName of transition.unmatchedLiveIds) {
      let planned: ReturnType<typeof planKnownOutputLayoutHydration>;

      try {
        planned = planKnownOutputLayoutHydration(
          historicalSnapshot,
          currentTopology,
          outputName,
          input,
        );
      } catch (error) {
        console.warn(
          `[driftile] known output layout planning skipped output=${outputName} error=${String(error)}`,
        );
        continue;
      }

      if (planned.kind !== "plan") {
        continue;
      }

      const restoredOutputId = outputId(outputName);

      if (
        planned.value.contexts.length === 0 ||
        planned.value.contexts.some(
          (context) => context.layout.outputId !== restoredOutputId,
        )
      ) {
        continue;
      }

      this.topologyKnownOutputRestorations.set(restoredOutputId, {
        outputId: restoredOutputId,
        plan: planned.value,
        topologyRevision: this.topologyRevision,
      });
    }
  }

  private sampleInitialLayoutHydrationCandidate(
    candidate: LayoutHydrationCandidate,
  ): boolean {
    const fingerprint = JSON.stringify({
      contexts: [...candidate.contextGeometryFingerprints].sort(
        ([left], [right]) => left.localeCompare(right),
      ),
      topology: candidate.topologyFingerprint,
      windows: [...candidate.windows]
        .map(([id, window]) => ({
          contextKey: window.contextKey,
          fingerprint: window.fingerprint,
          id: String(id),
          suspended: window.suspended,
          targetFrame: window.targetFrame,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    });

    if (fingerprint === this.initialLayoutHydrationCandidateFingerprint) {
      this.initialLayoutHydrationStableSamples = Math.min(
        this.initialLayoutHydrationQuietSamples,
        this.initialLayoutHydrationStableSamples + 1,
      );
    } else {
      this.initialLayoutHydrationCandidateFingerprint = fingerprint;
      this.initialLayoutHydrationStableSamples = 1;
    }

    return (
      this.initialLayoutHydrationStableSamples >=
      this.initialLayoutHydrationQuietSamples
    );
  }

  private scheduleInitialLayoutHydrationRetry(): boolean {
    if (
      !this.started ||
      this.initialLayoutHydrationStatus !== "pending" ||
      this.initialLayoutHydrationRetryRemaining <= 0
    ) {
      return false;
    }

    if (this.initialLayoutHydrationRetryToken !== null) {
      return true;
    }

    const runGeneration = this.runGeneration;
    const token = {};
    this.initialLayoutHydrationRetryToken = token;

    try {
      this.scheduleResume(() => {
        if (
          !this.started ||
          this.runGeneration !== runGeneration ||
          this.initialLayoutHydrationRetryToken !== token
        ) {
          return;
        }

        this.initialLayoutHydrationRetryToken = null;
        this.initialLayoutHydrationRetryRemaining -= 1;

        try {
          this.initializing = true;
          const initialized = this.initializeStartupWindows();
          this.initializing = false;

          if (!initialized) {
            return;
          }

          this.flushScheduledWork();
          this.completeStartup();
        } catch (error) {
          console.warn(
            `[driftile] delayed layout hydration failed error=${String(error)}`,
          );
          this.initializing = false;
          this.stop();
        } finally {
          this.initializing = false;
        }
      });
    } catch {
      this.initialLayoutHydrationRetryToken = null;
      return false;
    }

    return true;
  }

  private prepareLayoutHydrationCandidate(
    plan: LayoutPersistenceHydrationPlan,
  ): LayoutHydrationCandidate | null {
    if (
      this.contexts.size > 0 ||
      this.managedWindows.size > 0 ||
      this.floatingWindows.size > 0 ||
      this.columnFullWidthRestore.size > 0 ||
      this.waitingWindowContexts.size > 0
    ) {
      return null;
    }

    const candidateLayout = new LayoutEngine();
    const candidateContexts = new Map<string, RuntimeContext>();
    const candidateManagedWindows = new Map<WindowId, ManagedWindow>();
    const candidateFloatingWindows = new Map<WindowId, FloatingWindow>();
    const candidateFullWidthRestores = new Map<
      string,
      Map<ColumnId, ColumnWidth>
    >();
    const candidateFullWidthViewportRestores = new Map<
      string,
      Map<ColumnId, number>
    >();
    const candidateSuspendedWindowIds = new Set<WindowId>();
    const candidateRestoreBaselinePendingWindowIds = new Set<WindowId>();
    const candidateHydratedWindowIds = new Set<WindowId>();
    const candidateWindows = new Map<WindowId, LayoutHydrationWindowSnapshot>();
    const plannedRestoreBaselines = new Map(
      plan.restoreBaselines.map((restore) => [restore.windowId, restore]),
    );
    const contextGeometryFingerprints = new Map<string, string>();
    const topologyFingerprint = this.layoutHydrationTopologyFingerprint();

    for (const planned of plan.contexts) {
      const contextGeometry = this.geometry.contextGeometry(
        planned.layout.outputId,
        planned.layout.desktopId,
      );

      if (!contextGeometry) {
        return null;
      }

      const restored = candidateLayout.restoreColumns({
        activeColumnId: planned.layout.activeColumnId,
        columns: planned.layout.columns.map((column, index) => ({
          column,
          index,
        })),
        desktopId: planned.layout.desktopId,
        outputId: planned.layout.outputId,
        viewportOffset: planned.layout.viewportOffset,
      });

      if (!restored) {
        return null;
      }

      const solved = this.solveContextGeometry(planned.layout, contextGeometry);

      if (!this.canApplyLayout(solved.maxViewportOffset)) {
        return null;
      }

      const targetFrames = new Map(
        solved.windows.map((window) => [window.windowId, window.frame]),
      );
      const windowIds = new Set<WindowId>();
      const runtimeContext: RuntimeContext = {
        desktopId: planned.layout.desktopId,
        geometryFingerprint: contextGeometry.fingerprint,
        key: planned.key,
        outputId: planned.layout.outputId,
        windowIds,
      };

      for (const column of planned.layout.columns) {
        for (const id of column.windowIds) {
          const source = this.observer.source(id);
          const targetFrame = targetFrames.get(id);

          if (
            !source ||
            !targetFrame ||
            candidateHydratedWindowIds.has(id) ||
            !this.layoutHydrationSourceBelongsToContext(id, source, planned.key)
          ) {
            return null;
          }

          const suspended =
            hasGeometryAuthorityBlocker(source) ||
            this.requestedSuspensions.has(id);

          if (
            !respectsSizeConstraints(targetFrame, source) ||
            (!suspended &&
              (!isGeometryWritable(source) ||
                !this.geometry.canApplyFrame(id, targetFrame, runtimeContext)))
          ) {
            return null;
          }

          candidateHydratedWindowIds.add(id);
          windowIds.add(id);
          const plannedRestore = plannedRestoreBaselines.get(id);

          if (plannedRestore && plannedRestore.contextKey !== planned.key) {
            return null;
          }

          const restoredBaseline = this.restoreBaselineFromHydration(
            id,
            plannedRestore?.baseline,
            contextGeometry,
            source,
          );
          candidateManagedWindows.set(id, {
            contextKey: planned.key,
            restoreBaseline:
              restoredBaseline ??
              (suspended
                ? null
                : this.captureRestoreBaseline(
                    source,
                    contextGeometry.fingerprint,
                    "client",
                  )),
          });

          if (suspended) {
            candidateSuspendedWindowIds.add(id);
            candidateRestoreBaselinePendingWindowIds.add(id);
          }

          candidateWindows.set(id, {
            contextKey: planned.key,
            fingerprint: layoutHydrationWindowFingerprint(source),
            source,
            suspended,
            targetFrame: { ...targetFrame },
          });
        }
      }

      candidateContexts.set(planned.key, runtimeContext);
      contextGeometryFingerprints.set(planned.key, contextGeometry.fingerprint);
    }

    for (const restore of plan.fullWidthRestores) {
      if (!candidateContexts.has(restore.contextKey)) {
        return null;
      }

      let contextRestores = candidateFullWidthRestores.get(restore.contextKey);

      if (!contextRestores) {
        contextRestores = new Map<ColumnId, ColumnWidth>();
        candidateFullWidthRestores.set(restore.contextKey, contextRestores);
      }

      if (contextRestores.has(restore.columnId)) {
        return null;
      }

      contextRestores.set(restore.columnId, { ...restore.width });

      if (restore.viewportOffset !== undefined) {
        let viewportRestores = candidateFullWidthViewportRestores.get(
          restore.contextKey,
        );

        if (!viewportRestores) {
          viewportRestores = new Map<ColumnId, number>();
          candidateFullWidthViewportRestores.set(
            restore.contextKey,
            viewportRestores,
          );
        }

        viewportRestores.set(restore.columnId, restore.viewportOffset);
      }
    }

    for (const planned of plan.floatingWindows) {
      const id = planned.placement.windowId;
      const source = this.observer.source(id);

      if (
        !source ||
        candidateHydratedWindowIds.has(id) ||
        !this.layoutHydrationSourceBelongsToContext(
          id,
          source,
          planned.contextKey,
        )
      ) {
        return null;
      }

      const contextGeometry = this.geometry.contextGeometry(
        planned.placement.outputId,
        planned.placement.desktopId,
      );

      if (!contextGeometry) {
        return null;
      }

      const suspended =
        hasGeometryAuthorityBlocker(source) ||
        this.requestedSuspensions.has(id);
      const currentFrame = snapshotRect(source.frameGeometry);
      candidateHydratedWindowIds.add(id);
      candidateFloatingWindows.set(id, {
        currentContextKey: planned.contextKey,
        expectedFrame: currentFrame,
        placement: planned.placement,
        restoreBaseline: this.captureRestoreBaseline(
          source,
          contextGeometry.fingerprint,
          "client",
        ),
        sourceContextKey: planned.contextKey,
      });

      if (suspended) {
        candidateSuspendedWindowIds.add(id);
      }

      candidateWindows.set(id, {
        contextKey: planned.contextKey,
        fingerprint: layoutHydrationWindowFingerprint(source),
        source,
        suspended,
        targetFrame: null,
      });
      contextGeometryFingerprints.set(
        planned.contextKey,
        contextGeometry.fingerprint,
      );
    }

    return {
      contextGeometryFingerprints,
      contexts: candidateContexts,
      floatingWindows: candidateFloatingWindows,
      fullWidthRestores: candidateFullWidthRestores,
      fullWidthViewportRestores: candidateFullWidthViewportRestores,
      hydratedWindowIds: candidateHydratedWindowIds,
      layout: candidateLayout,
      managedWindows: candidateManagedWindows,
      restoreBaselinePendingWindowIds: candidateRestoreBaselinePendingWindowIds,
      suspendedWindowIds: candidateSuspendedWindowIds,
      topologyFingerprint,
      windows: candidateWindows,
    };
  }

  private restoreBaselineFromHydration(
    id: WindowId,
    baseline: LayoutPersistenceHydrationRestoreBaselineValue | undefined,
    contextGeometry: ContextGeometry,
    source: KWinWindow,
  ): RestoreBaseline | null {
    if (!baseline || baseline.fingerprint !== contextGeometry.fingerprint) {
      return null;
    }

    const candidate: RestoreBaseline = {
      clientFrame: snapshotRect(baseline.clientFrame),
      fingerprint: baseline.fingerprint,
      frame: snapshotRect(baseline.frame),
      kind: baseline.kind,
      noBorder: baseline.noBorder ?? undefined,
    };
    const restoredFrame = this.frameForRestoreBaseline(id, candidate);

    if (
      !rectIsContainedInWorkArea(
        candidate.clientFrame,
        contextGeometry.workArea,
      ) ||
      !rectIsContainedInWorkArea(candidate.frame, contextGeometry.workArea) ||
      !rectIsContainedInWorkArea(restoredFrame, contextGeometry.workArea) ||
      !respectsSizeConstraints(restoredFrame, source)
    ) {
      return null;
    }

    return candidate;
  }

  private layoutHydrationCandidateIsCurrent(
    candidate: LayoutHydrationCandidate,
  ): boolean {
    if (
      this.hasUnsettledTopology() ||
      candidate.topologyFingerprint !==
        this.layoutHydrationTopologyFingerprint()
    ) {
      return false;
    }

    for (const [key, fingerprint] of candidate.contextGeometryFingerprints) {
      const context = managedContextFromKey(key);
      const geometry = context
        ? this.geometry.contextGeometry(context.outputId, context.desktopId)
        : null;

      if (!geometry || geometry.fingerprint !== fingerprint) {
        return false;
      }
    }

    for (const [id, window] of candidate.windows) {
      if (
        this.observer.source(id) !== window.source ||
        layoutHydrationWindowFingerprint(window.source) !==
          window.fingerprint ||
        !this.layoutHydrationSourceBelongsToContext(
          id,
          window.source,
          window.contextKey,
        ) ||
        (hasGeometryAuthorityBlocker(window.source) ||
          this.requestedSuspensions.has(id)) !== window.suspended
      ) {
        return false;
      }

      const context = managedContextFromKey(window.contextKey);

      if (
        window.targetFrame &&
        (!respectsSizeConstraints(window.targetFrame, window.source) ||
          (!window.suspended &&
            (!context ||
              !this.geometry.canApplyFrame(id, window.targetFrame, context))))
      ) {
        return false;
      }
    }

    return true;
  }

  private layoutHydrationSourceBelongsToContext(
    id: WindowId,
    source: KWinWindow,
    key: string,
  ): boolean {
    const observed = normalizeWindow(source);
    const context = observed ? managedContext(observed) : null;

    return Boolean(
      context &&
      contextKey(context) === key &&
      !this.automaticFloatingWindows.has(id) &&
      !this.automaticallyFloats(source),
    );
  }

  private layoutHydrationTopologyFingerprint(): string {
    return JSON.stringify({
      desktops: this.workspace.desktops.map((desktop) => desktop.id),
      outputs: this.workspace.screens.map((output) => ({
        devicePixelRatio: output.devicePixelRatio,
        geometry: {
          height: output.geometry.height,
          width: output.geometry.width,
          x: output.geometry.x,
          y: output.geometry.y,
        },
        manufacturer: output.manufacturer ?? null,
        model: output.model ?? null,
        name: output.name,
        serialNumber: output.serialNumber ?? null,
      })),
      outputInstances: [...this.topologyObserver.outputInstances()],
      revision: this.topologyRevision,
    });
  }

  private commitLayoutHydrationCandidate(
    candidate: LayoutHydrationCandidate,
  ): boolean {
    if (
      this.contexts.size > 0 ||
      this.managedWindows.size > 0 ||
      this.floatingWindows.size > 0 ||
      this.columnFullWidthRestore.size > 0 ||
      this.waitingWindowContexts.size > 0
    ) {
      return false;
    }

    const previousLayout = this.layout;
    const previousDirtyContexts = new Set(this.dirtyContexts);
    const previousPendingWindowSyncs = new Set(this.pendingWindowSyncs);
    const previousPendingHydratedRestoreBaselines = new Set(
      this.pendingHydratedRestoreBaselines,
    );
    const previousSuspendedWindows = new Set(this.suspendedWindows);
    const previousWindowAdmissionHistory = new Set(this.windowAdmissionHistory);

    try {
      this.layout = candidate.layout;
      this.contexts.clear();
      this.managedWindows.clear();
      this.floatingWindows.clear();
      this.columnFullWidthRestore.clear();
      this.columnFullWidthViewportRestore.clear();
      this.dirtyContexts.clear();
      this.pendingHydratedRestoreBaselines.clear();

      for (const [key, context] of candidate.contexts) {
        this.contexts.set(key, context);
        this.dirtyContexts.add(key);
      }

      for (const [id, managed] of candidate.managedWindows) {
        this.managedWindows.set(id, managed);
      }

      for (const [id, floating] of candidate.floatingWindows) {
        this.floatingWindows.set(id, floating);
      }

      for (const [key, restores] of candidate.fullWidthRestores) {
        this.columnFullWidthRestore.set(key, new Map(restores));
      }

      for (const [key, restores] of candidate.fullWidthViewportRestores) {
        this.columnFullWidthViewportRestore.set(key, new Map(restores));
      }

      for (const id of candidate.hydratedWindowIds) {
        this.pendingWindowSyncs.delete(id);
        this.suspendedWindows.delete(id);
        this.windowAdmissionHistory.add(id);
      }

      for (const id of candidate.suspendedWindowIds) {
        this.suspendedWindows.add(id);
      }

      for (const id of candidate.restoreBaselinePendingWindowIds) {
        this.pendingHydratedRestoreBaselines.add(id);
      }

      return true;
    } catch {
      this.layout = previousLayout;
      this.contexts.clear();
      this.managedWindows.clear();
      this.floatingWindows.clear();
      this.columnFullWidthRestore.clear();
      this.columnFullWidthViewportRestore.clear();
      this.dirtyContexts.clear();
      replaceSet(this.dirtyContexts, previousDirtyContexts);
      replaceSet(this.pendingWindowSyncs, previousPendingWindowSyncs);
      replaceSet(
        this.pendingHydratedRestoreBaselines,
        previousPendingHydratedRestoreBaselines,
      );
      replaceSet(this.suspendedWindows, previousSuspendedWindows);
      replaceSet(this.windowAdmissionHistory, previousWindowAdmissionHistory);
      return false;
    }
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
        const initialized = this.initializeStartupWindows();
        this.initializing = false;

        if (!initialized) {
          return;
        }

        this.flushScheduledWork();
        this.completeStartup();
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

    this.pointerMoveIntent = null;
    this.pointerResizeIntent = null;
    this.topologyKnownOutputRestorations.clear();

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

  private sampleSettledContextGeometry(
    context: RuntimeContext,
  ): ContextGeometry | null {
    if (!this.isContextVisible(context)) {
      return null;
    }

    let current: ContextGeometry | null;

    try {
      current = this.geometry.contextGeometry(
        context.outputId,
        context.desktopId,
      );
    } catch (error) {
      console.warn(
        `[driftile] topology probe deferred context=${context.key} error=${String(error)}`,
      );
      this.handleTopologyChanged(String(context.outputId));
      return null;
    }

    if (!current || current.fingerprint !== context.geometryFingerprint) {
      this.handleTopologyChanged(String(context.outputId));
      return null;
    }

    return current;
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
    const previousTopology = this.lastSettledTopology;
    const currentTopology = this.currentLayoutPersistenceTopology();
    const persistenceTopologyChanged =
      currentTopology !== null &&
      !layoutPersistenceTopologiesEqual(previousTopology, currentTopology);
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

    const changedCapacityLeaseContexts = new Set<string>();

    for (const [key, affected] of affectedContexts) {
      const leases = this.capacityLeasesByContext.get(key);

      for (const lease of leases ?? []) {
        if (
          !affected.current ||
          affected.current.fingerprint !== lease.contextFingerprint
        ) {
          changedCapacityLeaseContexts.add(key);
          break;
        }
      }
    }

    if (this.topologyRevision !== committingRevision) {
      return false;
    }

    if (currentTopology) {
      this.prepareKnownOutputTopologyRestorations(
        previousTopology,
        currentTopology,
      );
    } else {
      this.topologyKnownOutputRestorations.clear();
    }

    if (this.topologyRevision !== committingRevision) {
      return false;
    }

    const preserveUnchangedContexts =
      this.topologyKnownOutputRestorations.size > 0;

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
        if (
          !preserveUnchangedContexts ||
          this.topologyWindowRequiresSynchronization(
            id,
            undefined,
            replacedOutputs,
            changedCapacityLeaseContexts,
          )
        ) {
          this.pendingWindowSyncs.add(id);
        }
      }

      for (const source of this.workspace.stackingOrder) {
        const observed = normalizeWindow(source);

        if (observed) {
          const id = windowId(observed.id);

          if (
            !preserveUnchangedContexts ||
            this.topologyWindowRequiresSynchronization(
              id,
              source,
              replacedOutputs,
              changedCapacityLeaseContexts,
            )
          ) {
            this.pendingWindowSyncs.add(id);
          }
        }
      }

      for (const id of this.waitingWindowContexts.keys()) {
        if (
          !preserveUnchangedContexts ||
          this.topologyWindowRequiresSynchronization(
            id,
            undefined,
            replacedOutputs,
            changedCapacityLeaseContexts,
          )
        ) {
          this.pendingWindowSyncs.add(id);
        }
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

    if (this.topologyRevision !== committingRevision) {
      return false;
    }

    this.lastSettledTopology = currentTopology;

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

    if (persistenceTopologyChanged) {
      this.layoutTopologyPublicationPending = true;
      this.requestLayoutStatePublication();
    }

    return true;
  }

  private topologyWindowRequiresSynchronization(
    id: WindowId,
    knownSource?: KWinWindow,
    replacedOutputs?: ReadonlySet<OutputId>,
    changedCapacityLeaseContexts?: ReadonlySet<string>,
  ): boolean {
    const source = knownSource ?? this.observer.source(id);

    if (!source) {
      return true;
    }

    const observed = normalizeWindow(source);
    const nextContext = observed ? managedContext(observed) : null;
    const nextKey = nextContext ? contextKey(nextContext) : null;

    if (nextContext && replacedOutputs?.has(nextContext.outputId) === true) {
      return true;
    }

    const owner = this.managedWindows.get(id);

    if (owner) {
      return nextKey !== owner.contextKey;
    }

    const floating = this.floatingWindows.get(id);

    if (floating) {
      return nextKey !== floating.currentContextKey;
    }

    const lease = this.capacityLeaseByWindow.get(id);

    if (lease) {
      return (
        nextKey !== lease.contextKey ||
        changedCapacityLeaseContexts?.has(lease.contextKey) === true
      );
    }

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
    if (!this.started || this.initializing) {
      return;
    }

    if (!this.preserveLoadedLayoutState) {
      this.requestLayoutStatePublication();
    }

    if (this.workScheduled) {
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
    const outermost = this.workFlushDepth === 0;

    if (outermost) {
      this.scheduledMutationWrites = 0;
    }

    this.workFlushDepth += 1;

    try {
      this.flushScheduledWorkPass();
    } finally {
      this.workFlushDepth -= 1;

      if (outermost) {
        this.scheduledMutationWrites = 0;
      }
    }
  }

  private flushScheduledWorkPass(): void {
    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeSettlement !== null
    ) {
      return;
    }

    if (this.stackEditOperation) {
      return;
    }

    if (this.borderlessReconciliationPending) {
      this.applyBorderlessWindowSetting(false);
    }

    if (this.hydrationInProgress) {
      if (this.topologyRecoveryPending) {
        this.synchronizeTopologyRecovery();
      }

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

    if (this.pointerResizeIsSettling()) {
      return;
    }

    if (topologyBatchPending && topologyBatchConsumed) {
      this.pruneColumnFullWidthRestores();
      this.topologyColumnByWindow.clear();
      this.topologyKnownOutputRestorations.clear();
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

    this.lastWrites =
      writeCount + this.scheduledMutationWrites + this.pendingMutationWrites;
    this.pendingMutationWrites = 0;
    this.retryPendingExternalFullscreenExtractions();

    if (this.ownershipFollowUpRequired) {
      this.ownershipFollowUpRequired = false;
      this.scheduleWork();
    }

    if (
      (this.pendingDefaultColumnWidth !== null || this.pendingGap !== null) &&
      this.pointerResizeIntent === null &&
      !this.windowTransferOperation &&
      !this.stackedNativeStateOperation &&
      this.capacityParkOperations.size === 0
    ) {
      this.scheduleWork();
    }

    this.detectPreservedFallbackLayoutMutation();
    this.flushLayoutStatePublication();
  }

  private detectPreservedFallbackLayoutMutation(): void {
    if (
      !this.preserveLoadedLayoutState ||
      this.layoutStatePublicationLocked ||
      !this.startupCompleted
    ) {
      return;
    }

    const canonicalState = this.captureLayoutState();

    if (canonicalState === null) {
      return;
    }

    if (this.preservedFallbackLayoutState === null) {
      this.preservedFallbackLayoutState = canonicalState;
      return;
    }

    if (canonicalState !== this.preservedFallbackLayoutState) {
      this.requestLayoutStatePublication();
    }
  }

  private applyPendingDefaultColumnWidth(): void {
    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeIntent !== null
    ) {
      return;
    }

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
    if (
      this.interactiveResizeSource !== null ||
      this.pointerResizeIntent !== null
    ) {
      return;
    }

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
      this.hydrationInProgress ||
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
      const floating = this.floatingWindows.get(id);

      if (floating && nextContext) {
        const nextContextKey = contextKey(nextContext);

        if (floating.currentContextKey !== nextContextKey) {
          this.floatingWindows.set(id, {
            ...floating,
            currentContextKey: nextContextKey,
          });
          this.refreshRememberedLayerFocus(id, source);
        }
      }

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

      if (
        source &&
        this.waitForExternalPointerContext(id, source, nextContext)
      ) {
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

        if (owner && nextContext && !changedContext) {
          this.captureHydratedRestoreBaselineAfterResume(
            id,
            source,
            owner,
            nextContext,
          );
        }
      }

      if (!source) {
        continue;
      }

      if (floating) {
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

      if (
        resumed &&
        changedContext &&
        nextContext &&
        this.commitFinishedExternalPointerMove(
          id,
          source,
          nextContext,
          pendingIds,
        )
      ) {
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
          let pointerInteractionCommitted = false;

          if (resumed) {
            pointerInteractionCommitted =
              this.commitFinishedPointerResize(id, source, context) ||
              this.commitFinishedPointerMove(id, source, context);
          }

          if (
            resumed &&
            !pointerInteractionCommitted &&
            String(this.workspace.activeWindow?.internalId) === String(id)
          ) {
            this.layout.activateWindow(id);
          }

          if (!pointerInteractionCommitted) {
            this.markContextDirty(context);
          }
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
        this.pendingHydratedRestoreBaselines.delete(id);
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
    const groups = new Map<string, TopologyAdmissionGroup>();

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

    for (const [restoredOutputId, restoration] of [
      ...this.topologyKnownOutputRestorations,
    ]) {
      const outputGroups = [...groups.values()].filter(
        (group) => group.context.outputId === restoredOutputId,
      );
      let restored: number | null;

      try {
        restored = this.admitKnownOutputTopologyRestoration(
          restoration,
          outputGroups,
          preservedRestoreBaselines,
        );
      } catch (error) {
        restored = null;
        console.warn(
          `[driftile] known output layout admission skipped output=${String(restoredOutputId)} error=${String(error)}`,
        );
      }
      this.topologyKnownOutputRestorations.delete(restoredOutputId);

      if (restored === null) {
        continue;
      }

      admitted += restored;

      for (const [key, group] of groups) {
        if (group.context.outputId === restoredOutputId) {
          groups.delete(key);
        }
      }
    }

    for (const group of groups.values()) {
      admitted += this.admitTopologyWindowGroup(
        group.context,
        group.sources,
        preservedRestoreBaselines,
      );
    }

    return admitted;
  }

  private admitKnownOutputTopologyRestoration(
    restoration: KnownOutputTopologyRestoration,
    groups: readonly TopologyAdmissionGroup[],
    preservedRestoreBaselines: ReadonlyMap<WindowId, RestoreBaseline | null>,
  ): number | null {
    if (
      restoration.topologyRevision !== this.topologyRevision ||
      this.topologyRecoveryPending ||
      this.topologyStabilizing ||
      this.topologyRetryPending ||
      restoration.plan.floatingWindows.length !== 0 ||
      restoration.plan.restoreBaselines.length !== 0
    ) {
      return null;
    }

    const plannedContexts = new Map(
      restoration.plan.contexts.map((planned) => [planned.key, planned]),
    );

    if (
      plannedContexts.size !== restoration.plan.contexts.length ||
      groups.length !== plannedContexts.size ||
      groups.some(
        (group) =>
          group.context.outputId !== restoration.outputId ||
          !plannedContexts.has(contextKey(group.context)),
      )
    ) {
      return null;
    }

    const expectedWindowIds = new Set<WindowId>();

    for (const planned of restoration.plan.contexts) {
      if (
        planned.layout.outputId !== restoration.outputId ||
        planned.key !==
          contextKey({
            desktopId: planned.layout.desktopId,
            outputId: planned.layout.outputId,
          })
      ) {
        return null;
      }

      for (const column of planned.layout.columns) {
        for (const id of column.windowIds) {
          if (expectedWindowIds.has(id)) {
            return null;
          }

          expectedWindowIds.add(id);
        }
      }
    }

    const prepared: KnownOutputAdmissionContext[] = [];
    const candidateWindowIds = new Set<WindowId>();

    for (const group of groups) {
      const key = contextKey(group.context);
      const planned = plannedContexts.get(key);

      if (!planned) {
        return null;
      }

      const plannedWindowIds = new Set<WindowId>();

      for (const column of planned.layout.columns) {
        for (const id of column.windowIds) {
          plannedWindowIds.add(id);
        }
      }

      const candidates: Array<
        Omit<KnownOutputAdmissionCandidate, "restoreBaseline">
      > = [];

      for (const source of group.sources) {
        const id = windowId(String(source.internalId));
        const observed = normalizeWindow(source);
        const liveContext = observed ? managedContext(observed) : null;

        if (
          candidateWindowIds.has(id) ||
          !plannedWindowIds.has(id) ||
          this.observer.source(id) !== source ||
          !liveContext ||
          contextKey(liveContext) !== key ||
          this.managedWindows.has(id) ||
          this.floatingWindows.has(id) ||
          this.automaticFloatingWindows.has(id) ||
          this.automaticallyFloats(source)
        ) {
          return null;
        }

        candidateWindowIds.add(id);
        candidates.push({
          fingerprint: layoutHydrationWindowFingerprint(source),
          id,
          source,
          suspended:
            this.suspendedWindows.has(id) ||
            this.requestedSuspensions.has(id) ||
            hasGeometryAuthorityBlocker(source),
        });
      }

      if (
        candidates.length !== plannedWindowIds.size ||
        candidates.some((candidate) => !plannedWindowIds.has(candidate.id))
      ) {
        return null;
      }

      let contextGeometry: ContextGeometry | null;

      try {
        contextGeometry = this.geometry.contextGeometry(
          group.context.outputId,
          group.context.desktopId,
        );
      } catch {
        return null;
      }

      const existingContext = this.contexts.get(key);
      const before = this.layout.snapshot(
        group.context.outputId,
        group.context.desktopId,
      );

      if (
        !contextGeometry ||
        before.columns.length !== 0 ||
        (existingContext !== undefined &&
          (existingContext.windowIds.size !== 0 ||
            existingContext.geometryFingerprint !==
              contextGeometry.fingerprint))
      ) {
        return null;
      }

      const preview = previewColumnRestoration(
        before,
        planned.layout.columns.map((column, index) => ({ column, index })),
        {
          activeColumnId: planned.layout.activeColumnId,
          viewportOffset: planned.layout.viewportOffset,
        },
      );

      if (!preview) {
        return null;
      }

      let solved: ReturnType<typeof solveStripGeometry>;

      try {
        solved = this.solveContextGeometry(preview, contextGeometry);
      } catch {
        return null;
      }

      if (!this.canApplyLayout(solved.maxViewportOffset)) {
        return null;
      }

      const frames = new Map(
        solved.windows.map((window) => [window.windowId, window.frame]),
      );

      for (const candidate of candidates) {
        const frame = frames.get(candidate.id);

        if (
          !frame ||
          !respectsSizeConstraints(frame, candidate.source) ||
          (!candidate.suspended &&
            (!isGeometryWritable(candidate.source) ||
              !this.geometry.canApplyFrame(candidate.id, frame, group.context)))
        ) {
          return null;
        }
      }

      const preparedCandidates: KnownOutputAdmissionCandidate[] = [];

      for (const candidate of candidates) {
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
              : this.previewRestoreBaselineForAdmission(
                  candidate.id,
                  candidate.source,
                  contextGeometry.fingerprint,
                );

        preparedCandidates.push({ ...candidate, restoreBaseline });
      }

      prepared.push({
        candidates: preparedCandidates,
        context: group.context,
        contextGeometry,
        planned,
        targetFrames: frames,
      });
    }

    if (!equalWindowIdSets(expectedWindowIds, candidateWindowIds)) {
      return null;
    }

    for (const context of prepared) {
      if (!this.knownOutputAdmissionContextIsCurrent(context, restoration)) {
        return null;
      }
    }

    if (restoration.topologyRevision !== this.topologyRevision) {
      return null;
    }

    const fullWidthRestores = new Map<string, Map<ColumnId, ColumnWidth>>();
    const fullWidthViewportRestores = new Map<string, Map<ColumnId, number>>();

    for (const restore of restoration.plan.fullWidthRestores) {
      const planned = plannedContexts.get(restore.contextKey);

      if (
        !planned ||
        !planned.layout.columns.some((column) => column.id === restore.columnId)
      ) {
        return null;
      }

      let contextRestores = fullWidthRestores.get(restore.contextKey);

      if (!contextRestores) {
        contextRestores = new Map<ColumnId, ColumnWidth>();
        fullWidthRestores.set(restore.contextKey, contextRestores);
      }

      if (contextRestores.has(restore.columnId)) {
        return null;
      }

      contextRestores.set(restore.columnId, { ...restore.width });

      if (restore.viewportOffset !== undefined) {
        let viewportRestores = fullWidthViewportRestores.get(
          restore.contextKey,
        );

        if (!viewportRestores) {
          viewportRestores = new Map<ColumnId, number>();
          fullWidthViewportRestores.set(restore.contextKey, viewportRestores);
        }

        viewportRestores.set(restore.columnId, restore.viewportOffset);
      }
    }

    const restoredContexts: KnownOutputAdmissionContext[] = [];

    for (const context of prepared) {
      let restored: boolean;

      try {
        restored = this.layout.restoreColumns({
          activeColumnId: context.planned.layout.activeColumnId,
          columns: context.planned.layout.columns.map((column, index) => ({
            column,
            index,
          })),
          desktopId: context.context.desktopId,
          outputId: context.context.outputId,
          viewportOffset: context.planned.layout.viewportOffset,
        });
      } catch {
        restored = false;
      }

      if (!restored) {
        this.rollbackKnownOutputTopologyRestoration(restoredContexts);
        return null;
      }

      restoredContexts.push(context);
    }

    let remainsCurrent: boolean;

    try {
      remainsCurrent =
        restoration.topologyRevision === this.topologyRevision &&
        prepared.every((context) =>
          this.knownOutputAdmissionContextIsCurrent(context, restoration),
        ) &&
        restoration.topologyRevision === this.topologyRevision;
    } catch {
      remainsCurrent = false;
    }

    if (!remainsCurrent) {
      this.rollbackKnownOutputTopologyRestoration(restoredContexts);
      return null;
    }

    let admitted = 0;

    for (const preparedContext of prepared) {
      const key = preparedContext.planned.key;
      let runtimeContext = this.contexts.get(key);

      if (!runtimeContext) {
        runtimeContext = {
          ...preparedContext.context,
          geometryFingerprint: preparedContext.contextGeometry.fingerprint,
          key,
          windowIds: new Set<WindowId>(),
        };
        this.contexts.set(key, runtimeContext);
      }

      this.columnFullWidthRestore.delete(key);
      this.columnFullWidthViewportRestore.delete(key);

      const contextRestores = fullWidthRestores.get(key);

      if (contextRestores && contextRestores.size > 0) {
        this.columnFullWidthRestore.set(key, contextRestores);
      }

      const viewportRestores = fullWidthViewportRestores.get(key);

      if (viewportRestores && viewportRestores.size > 0) {
        this.columnFullWidthViewportRestore.set(key, viewportRestores);
      }

      for (const candidate of preparedContext.candidates) {
        this.claimWindowBorder(candidate.id, candidate.source);
        const borderRestore = this.windowBorderRestore.get(candidate.id);

        if (borderRestore?.admissionBaselinePending) {
          borderRestore.admissionBaselinePending = false;
        }

        this.windowAdmissionHistory.add(candidate.id);

        runtimeContext.windowIds.add(candidate.id);
        this.managedWindows.set(candidate.id, {
          contextKey: key,
          restoreBaseline: cloneRestoreBaseline(candidate.restoreBaseline),
        });
        this.forgetWaitingWindow(candidate.id);

        if (candidate.suspended) {
          this.suspendGeometryLease(candidate.id);
        } else {
          this.resumeSamples.delete(candidate.id);
          this.suspendedWindows.delete(candidate.id);
          this.transientResumeProbes.delete(candidate.id);
        }

        admitted += 1;
      }

      this.capacityParkBackoffs.delete(key);
      this.markContextDirty(runtimeContext);
    }

    return admitted;
  }

  private knownOutputAdmissionContextIsCurrent(
    prepared: KnownOutputAdmissionContext,
    restoration: KnownOutputTopologyRestoration,
  ): boolean {
    if (
      restoration.topologyRevision !== this.topologyRevision ||
      this.topologyRecoveryPending ||
      this.topologyStabilizing ||
      this.topologyRetryPending
    ) {
      return false;
    }

    let contextGeometry: ContextGeometry | null;

    try {
      contextGeometry = this.geometry.contextGeometry(
        prepared.context.outputId,
        prepared.context.desktopId,
      );
    } catch {
      return false;
    }

    if (
      !contextGeometry ||
      contextGeometry.fingerprint !== prepared.contextGeometry.fingerprint
    ) {
      return false;
    }

    return prepared.candidates.every((candidate) => {
      const observed = normalizeWindow(candidate.source);
      const context = observed ? managedContext(observed) : null;
      const targetFrame = prepared.targetFrames.get(candidate.id);

      return (
        this.observer.source(candidate.id) === candidate.source &&
        layoutHydrationWindowFingerprint(candidate.source) ===
          candidate.fingerprint &&
        context !== null &&
        contextKey(context) === prepared.planned.key &&
        !this.managedWindows.has(candidate.id) &&
        !this.floatingWindows.has(candidate.id) &&
        !this.automaticFloatingWindows.has(candidate.id) &&
        !this.automaticallyFloats(candidate.source) &&
        targetFrame !== undefined &&
        respectsSizeConstraints(targetFrame, candidate.source) &&
        (candidate.suspended ||
          (isGeometryWritable(candidate.source) &&
            this.geometry.canApplyFrame(
              candidate.id,
              targetFrame,
              prepared.context,
            ))) &&
        (this.suspendedWindows.has(candidate.id) ||
          this.requestedSuspensions.has(candidate.id) ||
          hasGeometryAuthorityBlocker(candidate.source)) === candidate.suspended
      );
    });
  }

  private rollbackKnownOutputTopologyRestoration(
    contexts: readonly KnownOutputAdmissionContext[],
  ): void {
    for (const context of [...contexts].reverse()) {
      const removed = this.layout.removeColumns({
        columnIds: context.planned.layout.columns.map((column) => column.id),
        desktopId: context.context.desktopId,
        outputId: context.context.outputId,
      });

      if (!removed) {
        throw new Error(
          `known output layout rollback failed context=${context.planned.key}`,
        );
      }
    }
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
    if (this.hydrationInProgress) {
      return false;
    }

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

    if (this.applicationTilingExclusionApplies(source)) {
      return true;
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

  private applicationTilingExclusionApplies(
    source: KWinWindow,
    exclusions = this.applicationTilingExclusions,
  ): boolean {
    if (!source.normalWindow || exclusions.canonicalEntries.length === 0) {
      return false;
    }

    return this.applicationTilingExclusionAppliesToDesktopFileName(
      source,
      this.applicationDesktopFileName(source),
      exclusions,
    );
  }

  private applicationTilingExclusionAppliesToDesktopFileName(
    source: KWinWindow,
    desktopFileName: string | null,
    exclusions = this.applicationTilingExclusions,
  ): boolean {
    return (
      source.normalWindow &&
      desktopFileName !== null &&
      exclusions.canonicalEntries.length > 0 &&
      exclusions.excludes(desktopFileName)
    );
  }

  private applicationTilingExclusionMembershipChanged(
    source: KWinWindow,
    previous: ApplicationTilingExclusions,
    next: ApplicationTilingExclusions,
  ): boolean {
    if (
      !source.normalWindow ||
      (previous.canonicalEntries.length === 0 &&
        next.canonicalEntries.length === 0)
    ) {
      return false;
    }

    const desktopFileName = this.applicationDesktopFileName(source);

    if (desktopFileName === null) {
      return false;
    }

    return (
      (previous.canonicalEntries.length > 0 &&
        previous.excludes(desktopFileName)) !==
      (next.canonicalEntries.length > 0 && next.excludes(desktopFileName))
    );
  }

  private applicationDesktopFileName(source: KWinWindow): string | null {
    let desktopFileName: unknown;

    try {
      desktopFileName = source.desktopFileName;
    } catch {
      return null;
    }

    return typeof desktopFileName === "string" && desktopFileName.length > 0
      ? desktopFileName
      : null;
  }

  private trackWindowDesktopFileNameChange(
    id: WindowId,
    source: KWinWindow,
  ): {
    readonly current: string | null;
    readonly previous: string | null;
  } | null {
    const current = this.applicationDesktopFileName(source);
    const tracked = this.windowDesktopFileNames.has(id);
    const previous = this.windowDesktopFileNames.get(id) ?? null;
    this.windowDesktopFileNames.set(id, current);

    return tracked && previous !== current ? { current, previous } : null;
  }

  private desktopFileNameChangeRequiresLayout(
    id: WindowId,
    source: KWinWindow,
    previous: string | null,
    current: string | null,
  ): boolean {
    return (
      this.waitingWindowContexts.has(id) ||
      this.applicationTilingExclusionAppliesToDesktopFileName(
        source,
        previous,
      ) !==
        this.applicationTilingExclusionAppliesToDesktopFileName(source, current)
    );
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
      affectedContextKeys.add(floating.currentContextKey);
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
    this.pendingHydratedRestoreBaselines.delete(id);
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
    if (this.hydrationInProgress) {
      return;
    }

    const alreadySynchronizing = this.borderSynchronizationIds.has(id);
    const desktopFileName =
      source && this.borderlessWindows
        ? this.applicationDesktopFileName(source)
        : undefined;

    if (desktopFileName !== undefined && !this.windowDesktopFileNames.has(id)) {
      this.windowDesktopFileNames.set(id, desktopFileName);
    }

    if (!alreadySynchronizing) {
      this.borderSynchronizationIds.add(id);
    }

    try {
      if (!source || !this.windowUsesBorderlessMode(source, desktopFileName)) {
        this.restoreWindowBorder(id);
        return;
      }

      this.claimWindowBorder(id, source);
    } finally {
      if (!alreadySynchronizing) {
        this.borderSynchronizationIds.delete(id);
      }
    }
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
      clientFrame: snapshotRect(source.clientGeometry),
      fingerprint,
      frame: snapshotRect(source.frameGeometry),
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
        clientFrame: snapshotRect(borderRestore.clientFrame),
        fingerprint,
        frame: snapshotRect(borderRestore.frame),
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

  private previewRestoreBaselineForAdmission(
    id: WindowId,
    source: KWinWindow,
    fingerprint: string,
  ): RestoreBaseline {
    const borderRestore = this.windowBorderRestore.get(id);

    if (borderRestore?.admissionBaselinePending) {
      return {
        clientFrame: snapshotRect(borderRestore.clientFrame),
        fingerprint,
        frame: snapshotRect(borderRestore.frame),
        kind: "client",
        noBorder: borderRestore.noBorder,
      };
    }

    const borderClaimExpected =
      borderRestore === undefined &&
      this.windowUsesBorderlessMode(source) &&
      typeof source.noBorder === "boolean" &&
      !source.noBorder;
    const firstAdmission = !this.windowAdmissionHistory.has(id);

    return this.captureRestoreBaseline(
      source,
      fingerprint,
      borderClaimExpected || firstAdmission ? "client" : "frame",
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

  private windowUsesBorderlessMode(
    source: KWinWindow,
    knownDesktopFileName?: string | null,
  ): boolean {
    if (
      !this.started ||
      !this.borderlessWindows ||
      source.deleted ||
      !source.managed ||
      source.desktopWindow ||
      source.dock
    ) {
      return false;
    }

    const desktopFileName =
      knownDesktopFileName === undefined
        ? this.applicationDesktopFileName(source)
        : knownDesktopFileName;

    return (
      desktopFileName === null ||
      !this.applicationBorderlessExclusions.excludes(desktopFileName)
    );
  }

  private claimWindowBorder(id: WindowId, source: KWinWindow): boolean {
    let alreadyOwned: boolean;
    let restore: WindowBorderRestore;

    try {
      if (
        !this.windowUsesBorderlessMode(source) ||
        typeof source.noBorder !== "boolean" ||
        source.noBorder
      ) {
        return false;
      }

      const existing = this.windowBorderRestore.get(id);
      alreadyOwned = existing !== undefined;
      restore = existing ?? {
        admissionBaselinePending: !this.managedWindows.has(id),
        clientFrame: snapshotRect(source.clientGeometry),
        frame: snapshotRect(source.frameGeometry),
        noBorder: false,
      };
    } catch (error) {
      console.warn(
        `[driftile] borderless window preflight failed window=${String(id)} error=${String(error)}`,
      );
      return false;
    }

    if (!alreadyOwned) {
      this.windowBorderRestore.set(id, restore);
    }

    let failure: string | undefined;
    let applied = false;

    try {
      source.noBorder = true;
      applied = windowIsBorderless(source);
    } catch (error) {
      failure =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "unknown error";
    }

    let remainsEligible = false;

    try {
      remainsEligible = this.windowUsesBorderlessMode(source);
    } catch (error) {
      failure ??=
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "unknown error";
    }

    if (applied && remainsEligible) {
      if (!this.windowBorderRestore.has(id)) {
        this.windowBorderRestore.set(id, restore);
      }

      this.scheduleBorderlessSettlementSafely(id);

      return true;
    }

    if (!remainsEligible) {
      if (applied && !this.windowBorderRestore.has(id)) {
        this.windowBorderRestore.set(id, restore);
      }

      this.restoreWindowBorder(id);
      this.borderlessSettlementTokens.delete(id);
      return false;
    }

    if (
      failure === undefined &&
      !alreadyOwned &&
      this.windowBorderRestore.get(id) === restore
    ) {
      this.windowBorderRestore.delete(id);
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

    this.scheduleBorderlessSettlementSafely(id);

    return false;
  }

  private scheduleBorderlessSettlementSafely(id: WindowId): void {
    try {
      this.scheduleBorderlessSettlement(id);
    } catch (error) {
      this.borderlessSettlementTokens.delete(id);
      console.warn(
        `[driftile] borderless settlement scheduling failed window=${String(id)} error=${String(error)}`,
      );
    }
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

  private captureHydratedRestoreBaselineAfterResume(
    id: WindowId,
    source: KWinWindow,
    owner: ManagedWindow,
    context: ManagedContext,
  ): void {
    if (
      !this.pendingHydratedRestoreBaselines.has(id) ||
      this.managedWindows.get(id) !== owner ||
      owner.contextKey !== contextKey(context)
    ) {
      return;
    }

    if (owner.restoreBaseline !== null) {
      this.pendingHydratedRestoreBaselines.delete(id);
      return;
    }

    const runtimeContext = this.contexts.get(owner.contextKey);

    if (!runtimeContext?.windowIds.has(id)) {
      return;
    }

    owner.restoreBaseline = this.captureRestoreBaseline(
      source,
      runtimeContext.geometryFingerprint,
      "client",
    );
    this.pendingHydratedRestoreBaselines.delete(id);
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
        this.pendingHydratedRestoreBaselines.delete(window.windowId);
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

    const width = this.initialColumnWidth(sources);
    let requestedWidth: number;

    if (width.kind === "fixed") {
      requestedWidth = width.value;
    } else {
      const denominator = contextGeometry.workArea.width - this.gap;

      if (!Number.isFinite(denominator) || denominator <= 0) {
        return { kind: "fixed", value: minimum };
      }

      requestedWidth = width.value * denominator - this.gap;
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

    return { ...width };
  }

  private initialColumnWidth(sources: readonly KWinWindow[]): ColumnWidth {
    if (sources.length !== 1) {
      return this.defaultColumnWidth;
    }

    const desktopFileName = sources[0]?.desktopFileName;

    if (typeof desktopFileName !== "string") {
      return this.defaultColumnWidth;
    }

    const percent =
      this.applicationColumnWidths.columnWidthPercentFor(desktopFileName);

    return percent === undefined
      ? this.defaultColumnWidth
      : { kind: "proportion", value: percent / 100 };
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

function layoutHydrationWindowFingerprint(source: KWinWindow): string {
  return JSON.stringify({
    clientGeometry: {
      height: source.clientGeometry.height,
      width: source.clientGeometry.width,
      x: source.clientGeometry.x,
      y: source.clientGeometry.y,
    },
    deleted: source.deleted,
    desktopFileName: source.desktopFileName ?? null,
    desktops: source.desktops.map((desktop) => desktop.id),
    dialog: source.dialog,
    frameGeometry: {
      height: source.frameGeometry.height,
      width: source.frameGeometry.width,
      x: source.frameGeometry.x,
      y: source.frameGeometry.y,
    },
    fullScreen: source.fullScreen,
    internalId: String(source.internalId),
    managed: source.managed,
    maxSize: {
      height: source.maxSize.height,
      width: source.maxSize.width,
    },
    maximizeMode: source.maximizeMode,
    minSize: {
      height: source.minSize.height,
      width: source.minSize.width,
    },
    minimized: source.minimized,
    modal: source.modal,
    move: source.move,
    moveable: source.moveable,
    noBorder: source.noBorder,
    normalWindow: source.normalWindow,
    onAllDesktops: source.onAllDesktops,
    outputName: source.output?.name ?? null,
    resourceClass: source.resourceClass ?? null,
    resourceName: source.resourceName ?? null,
    resize: source.resize,
    resizeable: source.resizeable,
    specialWindow: source.specialWindow,
    tag: source.tag ?? null,
    tile: source.tile !== null,
    transient: source.transient,
    transientFor: source.transientFor !== null,
    windowRole: source.windowRole ?? null,
  });
}

function liveOutputPersistenceDescriptors(
  topology: LayoutPersistenceTopologyV2,
) {
  return topology.outputs.map((output) => ({
    liveId: output.name,
    ...(output.manufacturer === undefined
      ? {}
      : { manufacturer: output.manufacturer }),
    ...(output.model === undefined ? {} : { model: output.model }),
    name: output.name,
    ...(output.serialNumber === undefined
      ? {}
      : { serialNumber: output.serialNumber }),
  }));
}

function snapshotTopologyMatches(
  snapshot: LayoutPersistenceCatalogSnapshot,
  currentTopology: LayoutPersistenceTopologyV2,
): boolean {
  if (
    snapshot.topology === null ||
    snapshot.topology.outputs.length !== currentTopology.outputs.length
  ) {
    return false;
  }

  const matched = matchPersistedOutputs(
    snapshot.topology.outputs,
    liveOutputPersistenceDescriptors(currentTopology),
  );

  return (
    matched.matches.length === snapshot.topology.outputs.length &&
    matched.unmatchedLiveIds.length === 0 &&
    matched.unmatchedPersistedKeys.length === 0
  );
}

function equalWindowIdSets(
  left: ReadonlySet<WindowId>,
  right: ReadonlySet<WindowId>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const id of left) {
    if (!right.has(id)) {
      return false;
    }
  }

  return true;
}

function windowIsBorderless(source: KWinWindow): boolean {
  return source.noBorder === true;
}

function replaceSet<T>(target: Set<T>, values: ReadonlySet<T>): void {
  target.clear();

  for (const value of values) {
    target.add(value);
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
        clientFrame: snapshotRect(baseline.clientFrame),
        fingerprint: baseline.fingerprint,
        frame: snapshotRect(baseline.frame),
        kind: baseline.kind,
        noBorder: baseline.noBorder,
      }
    : null;
}

function snapshotRect(rect: Rect): Rect {
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
}

function rectsEqual(left: Rect, right: Rect): boolean {
  return (
    Math.abs(left.x - right.x) <= 1e-6 &&
    Math.abs(left.y - right.y) <= 1e-6 &&
    Math.abs(left.width - right.width) <= 1e-6 &&
    Math.abs(left.height - right.height) <= 1e-6
  );
}

function frameSizeConstraintBoundsEqual(
  left: FrameSizeConstraintBounds,
  right: FrameSizeConstraintBounds,
): boolean {
  return (
    (left.minimumWidth === right.minimumWidth ||
      nearlyEqual(left.minimumWidth, right.minimumWidth)) &&
    (left.minimumHeight === right.minimumHeight ||
      nearlyEqual(left.minimumHeight, right.minimumHeight)) &&
    (left.maximumWidth === right.maximumWidth ||
      nearlyEqual(left.maximumWidth, right.maximumWidth)) &&
    (left.maximumHeight === right.maximumHeight ||
      nearlyEqual(left.maximumHeight, right.maximumHeight))
  );
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}

function sameColumnWidth(left: ColumnWidth, right: ColumnWidth): boolean {
  return left.kind === right.kind && nearlyEqual(left.value, right.value);
}

function sameColumnWidths(
  left: readonly ColumnWidth[],
  right: readonly ColumnWidth[],
): boolean {
  return (
    left.length === right.length &&
    left.every((width, index) => {
      const candidate = right[index];
      return candidate !== undefined && sameColumnWidth(width, candidate);
    })
  );
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

function layoutPersistenceTopologiesEqual(
  left: LayoutPersistenceTopologyV2 | null,
  right: LayoutPersistenceTopologyV2 | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (
    left === null ||
    right === null ||
    left.outputs.length !== right.outputs.length
  ) {
    return false;
  }

  const rightByKey = new Map(
    right.outputs.map((output) => [output.key, output] as const),
  );

  return (
    rightByKey.size === right.outputs.length &&
    left.outputs.every((output) => {
      const candidate = rightByKey.get(output.key);

      return (
        candidate !== undefined &&
        output.manufacturer === candidate.manufacturer &&
        output.model === candidate.model &&
        output.name === candidate.name &&
        output.serialNumber === candidate.serialNumber
      );
    })
  );
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

function columnWidthPresetsFromPercentages(
  percentages: readonly number[],
): readonly ColumnWidth[] | null {
  if (
    !Array.isArray(percentages) ||
    percentages.length > COLUMN_WIDTH_PRESET_LIMITS.entries
  ) {
    return null;
  }

  const candidates = percentages as readonly unknown[];

  if (candidates.length === 0) {
    return DEFAULT_COLUMN_WIDTH_PRESETS.map((width) => ({ ...width }));
  }

  const presets: ColumnWidth[] = [];
  let previous = COLUMN_WIDTH_PRESET_LIMITS.minimumPercent - 1;

  for (const candidate of candidates) {
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      !Number.isInteger(candidate) ||
      candidate < COLUMN_WIDTH_PRESET_LIMITS.minimumPercent ||
      candidate > COLUMN_WIDTH_PRESET_LIMITS.maximumPercent ||
      candidate <= previous
    ) {
      return null;
    }

    presets.push({ kind: "proportion", value: candidate / 100 });
    previous = candidate;
  }

  return presets;
}

function normalizeGap(value: number): number | null {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_GAP &&
    value <= MAX_GAP
    ? value
    : null;
}

function normalizeProbeCount(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(
    MAX_LAYOUT_HYDRATION_PROBES,
    Math.max(minimum, Math.trunc(value)),
  );
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

function moveFloatingFrame(
  frame: Rect,
  workArea: Rect,
  deltaX: number,
  deltaY: number,
): Rect {
  const maximumOffscreenX = maximumFloatingWindowOffscreenExtent(frame.width);
  const maximumOffscreenY = maximumFloatingWindowOffscreenExtent(frame.height);

  return {
    height: frame.height,
    width: frame.width,
    x: clamp(
      frame.x + deltaX,
      workArea.x - maximumOffscreenX,
      workArea.x + workArea.width - frame.width + maximumOffscreenX,
    ),
    y: clamp(
      frame.y + deltaY,
      workArea.y - maximumOffscreenY,
      workArea.y + workArea.height - frame.height + maximumOffscreenY,
    ),
  };
}

function centerFloatingFrame(frame: Rect, workArea: Rect): Rect {
  return {
    height: frame.height,
    width: frame.width,
    x: workArea.x + Math.max((workArea.width - frame.width) / 2, 0),
    y: workArea.y + Math.max((workArea.height - frame.height) / 2, 0),
  };
}

function maximumFloatingWindowOffscreenExtent(size: number): number {
  const visibleExtent = clamp(
    size / 4,
    MINIMUM_FLOATING_WINDOW_VISIBLE_EXTENT,
    MAXIMUM_FLOATING_WINDOW_VISIBLE_EXTENT,
  );
  return Math.max(0, size - visibleExtent);
}

function floatingFrameChangeResultIsTransactionOwned(
  originalFrame: Rect,
  targetFrame: Rect,
  resultFrame: Rect,
  workArea: Rect,
): boolean {
  if (
    !nearlyEqual(resultFrame.width, originalFrame.width) ||
    !nearlyEqual(resultFrame.height, originalFrame.height)
  ) {
    return false;
  }

  if (rectsEqual(resultFrame, originalFrame)) {
    return true;
  }

  if (!floatingFramePositionIsVisible(resultFrame, workArea)) {
    return false;
  }

  const constrainedTarget = clampFrameToWorkArea(targetFrame, workArea);
  const minimumX = Math.min(
    originalFrame.x,
    targetFrame.x,
    constrainedTarget.x,
  );
  const maximumX = Math.max(
    originalFrame.x,
    targetFrame.x,
    constrainedTarget.x,
  );
  const minimumY = Math.min(
    originalFrame.y,
    targetFrame.y,
    constrainedTarget.y,
  );
  const maximumY = Math.max(
    originalFrame.y,
    targetFrame.y,
    constrainedTarget.y,
  );

  return (
    numberWithinInclusiveBounds(resultFrame.x, minimumX, maximumX) &&
    numberWithinInclusiveBounds(resultFrame.y, minimumY, maximumY)
  );
}

function floatingFramePositionIsVisible(frame: Rect, workArea: Rect): boolean {
  const maximumOffscreenX = maximumFloatingWindowOffscreenExtent(frame.width);
  const maximumOffscreenY = maximumFloatingWindowOffscreenExtent(frame.height);

  return (
    numberWithinInclusiveBounds(
      frame.x,
      workArea.x - maximumOffscreenX,
      workArea.x + workArea.width - frame.width + maximumOffscreenX,
    ) &&
    numberWithinInclusiveBounds(
      frame.y,
      workArea.y - maximumOffscreenY,
      workArea.y + workArea.height - frame.height + maximumOffscreenY,
    )
  );
}

function numberWithinInclusiveBounds(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return (
    Number.isFinite(value) && value >= minimum - 1e-6 && value <= maximum + 1e-6
  );
}

function rectIsContainedInWorkArea(frame: Rect, workArea: Rect): boolean {
  return (
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) &&
    Number.isFinite(frame.height) &&
    frame.width > 0 &&
    frame.height > 0 &&
    frame.x >= workArea.x - 1e-6 &&
    frame.y >= workArea.y - 1e-6 &&
    frame.x + frame.width <= workArea.x + workArea.width + 1e-6 &&
    frame.y + frame.height <= workArea.y + workArea.height + 1e-6
  );
}

function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0 &&
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
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
