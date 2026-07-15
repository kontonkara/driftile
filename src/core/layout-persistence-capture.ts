import type { ColumnId } from "./ids";
import type {
  ColumnWidth,
  DetachedWindowPlacement,
  LayoutContextSnapshot,
  WindowHeight,
} from "./layout-engine";
import {
  encodeLayoutPersistence,
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID,
  LAYOUT_PERSISTENCE_LIMITS,
  LAYOUT_PERSISTENCE_VERSION,
  type LayoutPersistenceV4,
  type PersistedColumnMemberV1,
  type PersistedContextV4,
  type PersistedFloatingWindowV4,
  type PersistedOutputV1,
  type PersistedRectV1,
  type PersistedRestoreBaselineV1,
  type PersistedWindowMatchV1,
  type PersistedWindowV1,
} from "./layout-persistence";

export interface LayoutPersistenceCaptureContext {
  readonly activityId: string;
  readonly key: string;
  readonly layout: LayoutContextSnapshot;
}

export interface LayoutPersistenceCaptureFloatingWindow {
  readonly activityId: string;
  readonly liveId: string;
  readonly placement: DetachedWindowPlacement;
}

export interface LayoutPersistenceCaptureFullWidthRestore {
  readonly columnId: ColumnId;
  readonly contextKey: string;
  readonly viewportOffset?: number;
  readonly width: ColumnWidth;
}

export interface LayoutPersistenceCaptureRestoreBaseline {
  readonly baseline: LayoutPersistenceCaptureRestoreBaselineValue;
  readonly contextKey: string;
  readonly liveId: string;
}

export interface LayoutPersistenceCaptureRestoreBaselineValue {
  readonly clientFrame: PersistedRectV1;
  readonly fingerprint: string;
  readonly frame: PersistedRectV1;
  readonly kind: PersistedRestoreBaselineV1["kind"];
  readonly noBorder: boolean | null;
}

export interface LayoutPersistenceCaptureOutput {
  readonly manufacturer?: string;
  readonly model?: string;
  readonly name: string;
  readonly serialNumber?: string;
}

export interface LayoutPersistenceCaptureWindow {
  readonly liveId: string;
  readonly sessionMatch?: PersistedWindowMatchV1;
}

export interface LayoutPersistenceCaptureInput {
  readonly contexts: readonly LayoutPersistenceCaptureContext[];
  readonly floatingWindows: readonly LayoutPersistenceCaptureFloatingWindow[];
  readonly fullWidthRestores: readonly LayoutPersistenceCaptureFullWidthRestore[];
  readonly liveOutputs: readonly LayoutPersistenceCaptureOutput[];
  readonly liveWindows: readonly LayoutPersistenceCaptureWindow[];
  readonly restoreBaselines?: readonly LayoutPersistenceCaptureRestoreBaseline[];
}

interface TiledPosition {
  readonly columnIndex: number;
  readonly memberIndex: number;
}

interface IndexedRestoreBaselines {
  readonly baselinesByWindow: ReadonlyMap<string, PersistedRestoreBaselineV1>;
  readonly fingerprintByContext: ReadonlyMap<string, string>;
}

export function captureLayoutPersistence(
  input: LayoutPersistenceCaptureInput,
): string {
  const liveOutputs = indexLiveOutputs(input.liveOutputs);
  const liveWindows = indexLiveWindows(input.liveWindows);
  const contextsByKey = new Map<string, LayoutPersistenceCaptureContext>();
  const columnsByContext = new Map<string, ReadonlySet<ColumnId>>();
  const tiledContextByWindow = new Map<string, string>();
  const tiledPositionsByContext = new Map<
    string,
    ReadonlyMap<string, TiledPosition>
  >();

  for (const context of input.contexts) {
    if (context.key.length === 0 || contextsByKey.has(context.key)) {
      invalid("layout context keys must be non-empty and unique");
    }

    requireLiveActivityId(context.activityId);

    if (String(context.layout.activityId) !== context.activityId) {
      invalid("a captured context activity must match its layout snapshot");
    }

    const identity = contextIdentity(
      String(context.layout.outputId),
      String(context.layout.desktopId),
      context.activityId,
    );

    if (tiledPositionsByContext.has(identity)) {
      invalid(
        "an output, desktop, and activity can contain only one layout context",
      );
    }

    const columnIds = new Set<ColumnId>();
    const positions = new Map<string, TiledPosition>();

    for (const [columnIndex, column] of context.layout.columns.entries()) {
      if (columnIds.has(column.id)) {
        invalid("column IDs must be unique inside a layout context");
      }

      columnIds.add(column.id);

      for (const [memberIndex, id] of column.windowIds.entries()) {
        const liveId = String(id);

        if (positions.has(liveId) || tiledContextByWindow.has(liveId)) {
          invalid("a tiled window can occupy only one layout slot");
        }

        positions.set(liveId, { columnIndex, memberIndex });
        tiledContextByWindow.set(liveId, context.key);
      }
    }

    contextsByKey.set(context.key, context);
    columnsByContext.set(context.key, columnIds);
    tiledPositionsByContext.set(identity, positions);
  }

  const fullWidthRestores = indexFullWidthRestores(
    input.fullWidthRestores,
    contextsByKey,
    columnsByContext,
  );
  const restoreBaselines = indexRestoreBaselines(
    input.restoreBaselines ?? [],
    contextsByKey,
    liveWindows,
    tiledContextByWindow,
  );
  const outputs = new Map<string, PersistedOutputV1>();
  const windows = new Map<string, PersistedWindowV1>();
  const ownedWindowIds = new Set<string>();
  const contexts: PersistedContextV4[] = [];

  for (const context of input.contexts) {
    const outputName = String(context.layout.outputId);
    registerOutput(outputName, liveOutputs, outputs);
    const activeColumnIndex = resolveActiveColumnIndex(context.layout);
    const contextRestores = fullWidthRestores.get(context.key);
    const restoreFingerprint = restoreBaselines.fingerprintByContext.get(
      context.key,
    );

    contexts.push({
      activeColumnIndex,
      activityId: context.activityId,
      columns: context.layout.columns.map((column) => {
        const heights = column.windowHeights;
        const selectedMemberIndex = column.windowIds.indexOf(
          column.selectedWindowId,
        );

        if (
          selectedMemberIndex < 0 ||
          (heights !== undefined && heights.length !== column.windowIds.length)
        ) {
          invalid("column state must select one member and align all heights");
        }

        const members = column.windowIds.map((id, memberIndex) => {
          const liveId = String(id);
          registerWindow(liveId, liveWindows, ownedWindowIds, windows);
          const height = heights?.[memberIndex];

          if (heights !== undefined && height === undefined) {
            invalid("window height state cannot contain an empty member");
          }

          return persistedMember(
            liveId,
            height,
            restoreBaselines.baselinesByWindow.get(liveId),
          );
        });
        const fullWidthRestore = contextRestores?.get(column.id);

        return {
          ...(fullWidthRestore === undefined
            ? {}
            : {
                fullWidthRestore: cloneWidth(fullWidthRestore.width),
                ...(fullWidthRestore.viewportOffset === undefined
                  ? {}
                  : {
                      fullWidthRestoreViewportOffset:
                        fullWidthRestore.viewportOffset,
                    }),
              }),
          members,
          presentation: column.presentation,
          selectedMemberIndex,
          width: cloneWidth(column.width),
        };
      }),
      desktopId: String(context.layout.desktopId),
      outputKey: outputName,
      ...(restoreFingerprint === undefined ? {} : { restoreFingerprint }),
      viewportOffset: context.layout.viewportOffset,
    });
  }

  const floatingWindows: PersistedFloatingWindowV4[] = [];

  for (const floating of input.floatingWindows) {
    const placement = floating.placement;
    const liveId = floating.liveId;

    requireLiveActivityId(floating.activityId);

    if (String(placement.activityId) !== floating.activityId) {
      invalid("a floating activity must match its detached placement");
    }

    if (String(placement.windowId) !== liveId) {
      invalid("a floating registry key must match its placement window ID");
    }

    const outputName = String(placement.outputId);
    registerOutput(outputName, liveOutputs, outputs);
    registerWindow(liveId, liveWindows, ownedWindowIds, windows);
    const positions = tiledPositionsByContext.get(
      contextIdentity(
        outputName,
        String(placement.desktopId),
        floating.activityId,
      ),
    );
    const anchors = survivingWindowAnchors(placement, positions);

    floatingWindows.push({
      activityId: floating.activityId,
      anchor: {
        columnIndex: placement.columnIndex,
        columnPresentation: placement.columnPresentation,
        columnWidth: cloneWidth(placement.columnWidth),
        memberIndex: placement.memberIndex,
        ...anchors,
        ...(placement.windowHeight === undefined
          ? {}
          : { windowHeight: cloneHeight(placement.windowHeight) }),
      },
      desktopId: String(placement.desktopId),
      outputKey: outputName,
      windowKey: liveId,
    });
  }

  const state: LayoutPersistenceV4 = {
    contexts,
    floatingWindows,
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [...outputs.values()],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [...windows.values()],
  };

  return encodeLayoutPersistence(state);
}

function indexFullWidthRestores(
  restores: readonly LayoutPersistenceCaptureFullWidthRestore[],
  contexts: ReadonlyMap<string, LayoutPersistenceCaptureContext>,
  columnsByContext: ReadonlyMap<string, ReadonlySet<ColumnId>>,
): ReadonlyMap<
  string,
  ReadonlyMap<ColumnId, LayoutPersistenceCaptureFullWidthRestore>
> {
  const indexed = new Map<
    string,
    Map<ColumnId, LayoutPersistenceCaptureFullWidthRestore>
  >();

  for (const restore of restores) {
    if (!contexts.has(restore.contextKey)) {
      invalid("a full-width restore must reference a captured context");
    }

    if (!columnsByContext.get(restore.contextKey)?.has(restore.columnId)) {
      invalid("a full-width restore must reference a captured column");
    }

    if (
      restore.viewportOffset !== undefined &&
      (!Number.isFinite(restore.viewportOffset) ||
        Math.abs(restore.viewportOffset) >
          LAYOUT_PERSISTENCE_LIMITS.numericMagnitude)
    ) {
      invalid("a full-width viewport restore must be finite and bounded");
    }

    let contextRestores = indexed.get(restore.contextKey);

    if (contextRestores === undefined) {
      contextRestores = new Map<
        ColumnId,
        LayoutPersistenceCaptureFullWidthRestore
      >();
      indexed.set(restore.contextKey, contextRestores);
    }

    if (contextRestores.has(restore.columnId)) {
      invalid("a column can have only one full-width restore value");
    }

    contextRestores.set(restore.columnId, restore);
  }

  return indexed;
}

function indexRestoreBaselines(
  baselines: readonly LayoutPersistenceCaptureRestoreBaseline[],
  contexts: ReadonlyMap<string, LayoutPersistenceCaptureContext>,
  liveWindows: ReadonlyMap<string, LayoutPersistenceCaptureWindow>,
  tiledContextByWindow: ReadonlyMap<string, string>,
): IndexedRestoreBaselines {
  const baselinesByWindow = new Map<string, PersistedRestoreBaselineV1>();
  const fingerprintByContext = new Map<string, string>();

  for (const entry of baselines) {
    if (!contexts.has(entry.contextKey)) {
      invalid("a restore baseline must reference a captured context");
    }

    if (!liveWindows.has(entry.liveId)) {
      invalid("a restore baseline must reference a live window");
    }

    if (tiledContextByWindow.get(entry.liveId) !== entry.contextKey) {
      invalid("a restore baseline must reference its tiled owner context");
    }

    if (baselinesByWindow.has(entry.liveId)) {
      invalid("a tiled window can have only one restore baseline");
    }

    const contextFingerprint = fingerprintByContext.get(entry.contextKey);

    if (
      contextFingerprint !== undefined &&
      contextFingerprint !== entry.baseline.fingerprint
    ) {
      invalid("restore baselines in one context must share a fingerprint");
    }

    fingerprintByContext.set(entry.contextKey, entry.baseline.fingerprint);
    baselinesByWindow.set(entry.liveId, cloneRestoreBaseline(entry.baseline));
  }

  return { baselinesByWindow, fingerprintByContext };
}

function resolveActiveColumnIndex(
  layout: LayoutContextSnapshot,
): number | null {
  if (layout.activeColumnId === null) {
    return null;
  }

  const index = layout.columns.findIndex(
    (column) => column.id === layout.activeColumnId,
  );

  if (index < 0) {
    invalid("the active column must belong to its layout context");
  }

  return index;
}

function survivingWindowAnchors(
  placement: DetachedWindowPlacement,
  positions: ReadonlyMap<string, TiledPosition> | undefined,
): {
  readonly nextWindowKey?: string;
  readonly previousWindowKey?: string;
} {
  const previousId = nullableString(placement.previousWindowId);
  const nextId = nullableString(placement.nextWindowId);
  const previous =
    previousId === undefined ? undefined : positions?.get(previousId);
  const next = nextId === undefined ? undefined : positions?.get(nextId);

  if (
    previous !== undefined &&
    next === undefined &&
    previousId !== undefined
  ) {
    return { previousWindowKey: previousId };
  }

  if (next !== undefined && previous === undefined && nextId !== undefined) {
    return { nextWindowKey: nextId };
  }

  if (
    previous !== undefined &&
    next !== undefined &&
    previousId !== undefined &&
    nextId !== undefined &&
    previous.columnIndex === next.columnIndex &&
    previous.memberIndex < next.memberIndex
  ) {
    return { nextWindowKey: nextId, previousWindowKey: previousId };
  }

  return {};
}

function persistedMember(
  liveId: string,
  height: WindowHeight | undefined,
  restoreBaseline: PersistedRestoreBaselineV1 | undefined,
): PersistedColumnMemberV1 {
  return {
    ...(height === undefined ? {} : { height: cloneHeight(height) }),
    ...(restoreBaseline === undefined ? {} : { restoreBaseline }),
    windowKey: liveId,
  };
}

function registerOutput(
  name: string,
  live: ReadonlyMap<string, LayoutPersistenceCaptureOutput>,
  outputs: Map<string, PersistedOutputV1>,
): void {
  const descriptor = live.get(name);

  if (!descriptor) {
    invalid("captured layout state references a non-live output");
  }

  if (!outputs.has(name)) {
    outputs.set(name, persistedOutput(descriptor));
  }
}

function registerWindow(
  liveId: string,
  live: ReadonlyMap<string, LayoutPersistenceCaptureWindow>,
  owned: Set<string>,
  windows: Map<string, PersistedWindowV1>,
): void {
  const descriptor = live.get(liveId);

  if (!descriptor) {
    invalid("captured layout state references a non-live window");
  }

  if (owned.has(liveId)) {
    invalid("a window can have only one captured layout owner");
  }

  owned.add(liveId);
  windows.set(liveId, persistedWindow(descriptor));
}

function indexLiveOutputs(
  outputs: readonly LayoutPersistenceCaptureOutput[],
): ReadonlyMap<string, LayoutPersistenceCaptureOutput> {
  const indexed = new Map<string, LayoutPersistenceCaptureOutput>();

  for (const output of outputs) {
    if (output.name.length === 0 || indexed.has(output.name)) {
      invalid("live output names must be non-empty and unique");
    }

    indexed.set(output.name, output);
  }

  return indexed;
}

function indexLiveWindows(
  windows: readonly LayoutPersistenceCaptureWindow[],
): ReadonlyMap<string, LayoutPersistenceCaptureWindow> {
  const indexed = new Map<string, LayoutPersistenceCaptureWindow>();

  for (const window of windows) {
    if (window.liveId.length === 0 || indexed.has(window.liveId)) {
      invalid("live window IDs must be non-empty and unique");
    }

    indexed.set(window.liveId, window);
  }

  return indexed;
}

function persistedOutput(
  output: LayoutPersistenceCaptureOutput,
): PersistedOutputV1 {
  return {
    key: output.name,
    ...(output.manufacturer === undefined
      ? {}
      : { manufacturer: output.manufacturer }),
    ...(output.model === undefined ? {} : { model: output.model }),
    name: output.name,
    ...(output.serialNumber === undefined
      ? {}
      : { serialNumber: output.serialNumber }),
  };
}

function persistedWindow(
  window: LayoutPersistenceCaptureWindow,
): PersistedWindowV1 {
  return {
    key: window.liveId,
    liveId: window.liveId,
    ...(window.sessionMatch === undefined
      ? {}
      : { sessionMatch: cloneWindowMatch(window.sessionMatch) }),
  };
}

function cloneWindowMatch(
  match: PersistedWindowMatchV1,
): PersistedWindowMatchV1 {
  return {
    ...(match.desktopFileName === undefined
      ? {}
      : { desktopFileName: match.desktopFileName }),
    ...(match.resourceClass === undefined
      ? {}
      : { resourceClass: match.resourceClass }),
    ...(match.resourceName === undefined
      ? {}
      : { resourceName: match.resourceName }),
    ...(match.tag === undefined ? {} : { tag: match.tag }),
    ...(match.windowRole === undefined ? {} : { windowRole: match.windowRole }),
  };
}

function cloneWidth(width: ColumnWidth): ColumnWidth {
  return { kind: width.kind, value: width.value };
}

function cloneHeight(height: WindowHeight): WindowHeight {
  switch (height.kind) {
    case "auto":
      return { kind: height.kind, weight: height.weight };
    case "fixed":
      return { clientHeight: height.clientHeight, kind: height.kind };
    case "preset":
      return { index: height.index, kind: height.kind };
  }
}

function cloneRestoreBaseline(
  baseline: LayoutPersistenceCaptureRestoreBaselineValue,
): PersistedRestoreBaselineV1 {
  return {
    clientFrame: cloneRect(baseline.clientFrame),
    frame: cloneRect(baseline.frame),
    kind: baseline.kind,
    noBorder: baseline.noBorder,
  };
}

function cloneRect(rect: PersistedRectV1): PersistedRectV1 {
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
}

function nullableString(value: string | null): string | undefined {
  return value === null ? undefined : value;
}

function contextIdentity(
  outputId: string,
  desktopId: string,
  activityId: string,
): string {
  return `${String(outputId.length)}:${outputId}${String(desktopId.length)}:${desktopId}${activityId}`;
}

function requireLiveActivityId(activityId: string): void {
  if (
    activityId.length === 0 ||
    activityId.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters ||
    containsControlCharacter(activityId) ||
    activityId === LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID
  ) {
    invalid("captured activity IDs must identify a live activity");
  }
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function invalid(message: string): never {
  throw new Error(`Cannot capture layout persistence: ${message}`);
}
