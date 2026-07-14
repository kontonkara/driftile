import { decodeLayoutPersistenceCatalog } from "../core/layout-persistence-catalog";
import type {
  LayoutPersistenceCatalogSnapshot,
  LayoutPersistenceTopologyV2,
} from "../core/layout-persistence-catalog";
import {
  LAYOUT_PERSISTENCE_LIMITS,
  type LayoutPersistenceDecodeError,
  type PersistedColumnMemberV1,
  type PersistedColumnV3,
  type PersistedFloatingAnchorV3,
  type PersistedOutputV1,
} from "../core/layout-persistence";

export type OverviewColumnPresentation = PersistedColumnV3["presentation"];
export type OverviewColumnWidth = PersistedColumnV3["width"];
export type OverviewWindowHeight = NonNullable<
  PersistedColumnMemberV1["height"]
>;

export interface OverviewLiveOutput {
  readonly manufacturer?: string;
  readonly model?: string;
  readonly name: string;
  readonly serialNumber?: string;
}

export interface OverviewLiveLayout {
  readonly desktopIds: readonly string[];
  readonly outputs: readonly OverviewLiveOutput[];
  readonly windowIds: readonly string[];
}

export interface OverviewProjectionMetrics {
  operations: number;
}

export interface OverviewLayoutOutput extends OverviewLiveOutput {
  readonly outputId: string;
}

export interface OverviewLayoutMember {
  readonly height?: OverviewWindowHeight;
  readonly windowId: string;
}

export interface OverviewLayoutColumn {
  readonly fullWidthRestore?: OverviewColumnWidth;
  readonly members: readonly OverviewLayoutMember[];
  readonly presentation: OverviewColumnPresentation;
  readonly width: OverviewColumnWidth;
}

export interface OverviewLayoutContext {
  readonly activeColumnIndex: number | null;
  readonly columns: readonly OverviewLayoutColumn[];
  readonly desktopId: string;
  readonly outputId: string;
  readonly viewportOffset: number;
}

export interface OverviewFloatingAnchor {
  readonly columnIndex: number;
  readonly columnWidth: OverviewColumnWidth;
  readonly memberIndex: number;
  readonly nextWindowId?: string;
  readonly previousWindowId?: string;
  readonly windowHeight?: OverviewWindowHeight;
}

export interface OverviewFloatingWindow {
  readonly anchor: OverviewFloatingAnchor;
  readonly desktopId: string;
  readonly outputId: string;
  readonly windowId: string;
}

export interface OverviewLayoutModel {
  readonly contexts: readonly OverviewLayoutContext[];
  readonly desktopIds: readonly string[];
  readonly floatingWindows: readonly OverviewFloatingWindow[];
  readonly outputs: readonly OverviewLayoutOutput[];
}

export type OverviewLayoutProjectionError =
  | LayoutPersistenceDecodeError
  | "missing-state"
  | "missing-active-snapshot"
  | "legacy-topology"
  | "invalid-live-output"
  | "topology-mismatch"
  | "invalid-live-desktop"
  | "desktop-mismatch"
  | "invalid-live-window"
  | "window-mismatch";

export type OverviewLayoutProjectionResult =
  | {
      readonly error: OverviewLayoutProjectionError;
      readonly ok: false;
    }
  | {
      readonly ok: true;
      readonly value: OverviewLayoutModel;
    };

type ProjectionFailure = Extract<OverviewLayoutProjectionResult, { ok: false }>;

interface ProjectionIndexes {
  readonly desktopIdSet: ReadonlySet<string>;
  readonly desktopIds: readonly string[];
  readonly liveWindowIds: ReadonlySet<string>;
  readonly outputIdByKey: ReadonlyMap<string, string>;
  readonly outputs: readonly OverviewLayoutOutput[];
  readonly windowIdByKey: ReadonlyMap<string, string>;
}

export function projectOverviewLayout(
  document: string,
  live: OverviewLiveLayout,
  metrics?: OverviewProjectionMetrics,
): OverviewLayoutProjectionResult {
  if (metrics !== undefined) {
    metrics.operations = 0;
  }

  if (document.length === 0) {
    return failure("missing-state");
  }

  const decoded = decodeLayoutPersistenceCatalog(document);

  if (!decoded.ok) {
    return failure(decoded.error);
  }

  const snapshot = decoded.value.snapshots[0];

  if (snapshot === undefined) {
    return failure("missing-active-snapshot");
  }

  if (snapshot.topology === null) {
    return failure("legacy-topology");
  }

  const outputResult = indexOutputs(snapshot.topology, live.outputs, metrics);

  if (!outputResult.ok) {
    return outputResult;
  }

  const desktopResult = indexDesktopIds(snapshot, live.desktopIds, metrics);

  if (!desktopResult.ok) {
    return desktopResult;
  }

  const windowResult = indexWindows(snapshot, live.windowIds, metrics);

  if (!windowResult.ok) {
    return windowResult;
  }

  const indexes: ProjectionIndexes = {
    desktopIdSet: desktopResult.liveDesktopIds,
    desktopIds: desktopResult.value,
    liveWindowIds: windowResult.liveWindowIds,
    outputIdByKey: outputResult.outputIdByKey,
    outputs: outputResult.outputs,
    windowIdByKey: windowResult.windowIdByKey,
  };

  if (!referencesAreCurrent(snapshot, indexes, metrics)) {
    return failure("window-mismatch");
  }

  recordOperations(metrics, snapshot.state.contexts.length);
  const contexts = snapshot.state.contexts.map((context) => {
    recordOperations(metrics, context.columns.length);

    return Object.freeze({
      activeColumnIndex: context.activeColumnIndex,
      columns: Object.freeze(
        context.columns.map((column) => {
          const members =
            column.presentation === "tabbed"
              ? column.members.slice(
                  column.selectedMemberIndex,
                  column.selectedMemberIndex + 1,
                )
              : column.members;
          recordOperations(metrics, members.length);

          return Object.freeze({
            ...(column.fullWidthRestore === undefined
              ? {}
              : {
                  fullWidthRestore: freezeWidth(column.fullWidthRestore),
                }),
            members: Object.freeze(
              members.map((member) =>
                Object.freeze({
                  ...(member.height === undefined
                    ? {}
                    : { height: freezeHeight(member.height) }),
                  windowId: required(indexes.windowIdByKey, member.windowKey),
                }),
              ),
            ),
            presentation: column.presentation,
            width: freezeWidth(column.width),
          });
        }),
      ),
      desktopId: context.desktopId,
      outputId: required(indexes.outputIdByKey, context.outputKey),
      viewportOffset: context.viewportOffset,
    });
  });
  recordOperations(metrics, snapshot.state.floatingWindows.length);
  const floatingWindows = snapshot.state.floatingWindows.map((floating) =>
    Object.freeze({
      anchor: projectFloatingAnchor(floating.anchor, indexes.windowIdByKey),
      desktopId: floating.desktopId,
      outputId: required(indexes.outputIdByKey, floating.outputKey),
      windowId: required(indexes.windowIdByKey, floating.windowKey),
    }),
  );

  return {
    ok: true,
    value: Object.freeze({
      contexts: Object.freeze(contexts),
      desktopIds: indexes.desktopIds,
      floatingWindows: Object.freeze(floatingWindows),
      outputs: indexes.outputs,
    }),
  };
}

function indexOutputs(
  topology: LayoutPersistenceTopologyV2,
  liveOutputs: readonly OverviewLiveOutput[],
  metrics: OverviewProjectionMetrics | undefined,
):
  | ProjectionFailure
  | {
      readonly ok: true;
      readonly outputIdByKey: ReadonlyMap<string, string>;
      readonly outputs: readonly OverviewLayoutOutput[];
    } {
  if (liveOutputs.length > LAYOUT_PERSISTENCE_LIMITS.outputs) {
    return failure("invalid-live-output");
  }

  const liveByName = new Map<string, OverviewLiveOutput>();

  recordOperations(metrics, liveOutputs.length);
  for (const output of liveOutputs) {
    if (
      !validIdentifier(output.name) ||
      !validOptionalIdentifier(output.manufacturer) ||
      !validOptionalIdentifier(output.model) ||
      !validOptionalIdentifier(output.serialNumber) ||
      liveByName.has(output.name)
    ) {
      return failure("invalid-live-output");
    }

    liveByName.set(output.name, output);
  }

  if (topology.outputs.length !== liveOutputs.length) {
    return failure("topology-mismatch");
  }

  const outputIdByKey = new Map<string, string>();
  const outputs: OverviewLayoutOutput[] = [];

  recordOperations(metrics, topology.outputs.length);
  for (const persisted of topology.outputs) {
    const live = liveByName.get(persisted.name);

    if (live === undefined || !outputDescriptorsEqual(persisted, live)) {
      return failure("topology-mismatch");
    }

    outputIdByKey.set(persisted.key, live.name);
    outputs.push(
      Object.freeze({
        ...(live.manufacturer === undefined
          ? {}
          : { manufacturer: live.manufacturer }),
        ...(live.model === undefined ? {} : { model: live.model }),
        name: live.name,
        outputId: live.name,
        ...(live.serialNumber === undefined
          ? {}
          : { serialNumber: live.serialNumber }),
      }),
    );
  }

  return {
    ok: true,
    outputIdByKey,
    outputs: Object.freeze(outputs),
  };
}

function indexDesktopIds(
  snapshot: LayoutPersistenceCatalogSnapshot,
  liveDesktopIds: readonly string[],
  metrics: OverviewProjectionMetrics | undefined,
):
  | ProjectionFailure
  | {
      readonly liveDesktopIds: ReadonlySet<string>;
      readonly ok: true;
      readonly value: readonly string[];
    } {
  if (liveDesktopIds.length > LAYOUT_PERSISTENCE_LIMITS.contexts) {
    return failure("invalid-live-desktop");
  }

  const live = new Set<string>();

  recordOperations(metrics, liveDesktopIds.length);
  for (const desktopId of liveDesktopIds) {
    if (!validIdentifier(desktopId) || live.has(desktopId)) {
      return failure("invalid-live-desktop");
    }

    live.add(desktopId);
  }

  recordOperations(metrics, snapshot.state.contexts.length);
  for (const context of snapshot.state.contexts) {
    if (!live.has(context.desktopId)) {
      return failure("desktop-mismatch");
    }
  }

  recordOperations(metrics, snapshot.state.floatingWindows.length);
  for (const floating of snapshot.state.floatingWindows) {
    if (!live.has(floating.desktopId)) {
      return failure("desktop-mismatch");
    }
  }

  return {
    liveDesktopIds: live,
    ok: true,
    value: Object.freeze([...liveDesktopIds].sort(compareStrings)),
  };
}

function indexWindows(
  snapshot: LayoutPersistenceCatalogSnapshot,
  liveWindowIds: readonly string[],
  metrics: OverviewProjectionMetrics | undefined,
):
  | ProjectionFailure
  | {
      readonly liveWindowIds: ReadonlySet<string>;
      readonly ok: true;
      readonly windowIdByKey: ReadonlyMap<string, string>;
    } {
  if (liveWindowIds.length > LAYOUT_PERSISTENCE_LIMITS.windows) {
    return failure("invalid-live-window");
  }

  const live = new Set<string>();

  recordOperations(metrics, liveWindowIds.length);
  for (const windowId of liveWindowIds) {
    if (!validIdentifier(windowId) || live.has(windowId)) {
      return failure("invalid-live-window");
    }

    live.add(windowId);
  }

  const windowIdByKey = new Map<string, string>();

  recordOperations(metrics, snapshot.state.windows.length);
  for (const persisted of snapshot.state.windows) {
    if (!live.has(persisted.liveId)) {
      return failure("window-mismatch");
    }

    windowIdByKey.set(persisted.key, persisted.liveId);
  }

  return {
    liveWindowIds: live,
    ok: true,
    windowIdByKey,
  };
}

function referencesAreCurrent(
  snapshot: LayoutPersistenceCatalogSnapshot,
  indexes: ProjectionIndexes,
  metrics: OverviewProjectionMetrics | undefined,
): boolean {
  recordOperations(metrics, snapshot.state.contexts.length);
  for (const context of snapshot.state.contexts) {
    if (
      !indexes.outputIdByKey.has(context.outputKey) ||
      !indexes.desktopIdSet.has(context.desktopId)
    ) {
      return false;
    }

    recordOperations(metrics, context.columns.length);
    for (const column of context.columns) {
      recordOperations(metrics, column.members.length);
      for (const member of column.members) {
        const windowId = indexes.windowIdByKey.get(member.windowKey);

        if (windowId === undefined || !indexes.liveWindowIds.has(windowId)) {
          return false;
        }
      }
    }
  }

  recordOperations(metrics, snapshot.state.floatingWindows.length);
  for (const floating of snapshot.state.floatingWindows) {
    const windowId = indexes.windowIdByKey.get(floating.windowKey);

    if (
      !indexes.outputIdByKey.has(floating.outputKey) ||
      !indexes.desktopIdSet.has(floating.desktopId) ||
      windowId === undefined ||
      !indexes.liveWindowIds.has(windowId)
    ) {
      return false;
    }
  }

  return true;
}

function projectFloatingAnchor(
  anchor: PersistedFloatingAnchorV3,
  windowIdByKey: ReadonlyMap<string, string>,
): OverviewFloatingAnchor {
  return Object.freeze({
    columnIndex: anchor.columnIndex,
    columnWidth: freezeWidth(anchor.columnWidth),
    memberIndex: anchor.memberIndex,
    ...(anchor.nextWindowKey === undefined
      ? {}
      : {
          nextWindowId: required(windowIdByKey, anchor.nextWindowKey),
        }),
    ...(anchor.previousWindowKey === undefined
      ? {}
      : {
          previousWindowId: required(windowIdByKey, anchor.previousWindowKey),
        }),
    ...(anchor.windowHeight === undefined
      ? {}
      : { windowHeight: freezeHeight(anchor.windowHeight) }),
  });
}

function freezeWidth(width: OverviewColumnWidth): OverviewColumnWidth {
  return Object.freeze({ ...width });
}

function freezeHeight(height: OverviewWindowHeight): OverviewWindowHeight {
  return Object.freeze({ ...height });
}

function outputDescriptorsEqual(
  persisted: PersistedOutputV1,
  live: OverviewLiveOutput,
): boolean {
  return (
    persisted.manufacturer === live.manufacturer &&
    persisted.model === live.model &&
    persisted.name === live.name &&
    persisted.serialNumber === live.serialNumber
  );
}

function validOptionalIdentifier(value: unknown): boolean {
  return value === undefined || validIdentifier(value);
}

function validIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return false;
    }
  }

  return true;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);

  if (value === undefined) {
    throw new Error("validated overview reference is missing");
  }

  return value;
}

function failure(error: OverviewLayoutProjectionError): ProjectionFailure {
  return { error, ok: false };
}

function recordOperations(
  metrics: OverviewProjectionMetrics | undefined,
  operations: number,
): void {
  if (metrics !== undefined) {
    metrics.operations += operations;
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
