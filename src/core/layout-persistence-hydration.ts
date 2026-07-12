import {
  columnId,
  desktopId,
  outputId,
  windowId,
  type ColumnId,
  type WindowId,
} from "./ids";
import type {
  ColumnWidth,
  DetachedWindowPlacement,
  LayoutColumnSnapshot,
  LayoutContextSnapshot,
  WindowHeight,
} from "./layout-engine";
import type {
  LayoutPersistenceV1,
  PersistedRectV1,
  PersistedRestoreBaselineV1,
} from "./layout-persistence";

export interface LiveLayoutHydrationDesktop {
  readonly id: string;
}

export interface LiveLayoutHydrationOutput {
  readonly name: string;
}

export interface LiveLayoutHydrationWindow {
  readonly desktopId: string;
  readonly eligible: boolean;
  readonly liveId: string;
  readonly outputName: string;
}

export interface LayoutPersistenceHydrationInput {
  readonly desktops: readonly LiveLayoutHydrationDesktop[];
  readonly outputs: readonly LiveLayoutHydrationOutput[];
  readonly windows: readonly LiveLayoutHydrationWindow[];
}

export interface LayoutPersistenceHydrationContext {
  readonly key: string;
  readonly layout: LayoutContextSnapshot;
}

export interface LayoutPersistenceHydrationFullWidthRestore {
  readonly columnId: ColumnId;
  readonly contextKey: string;
  readonly width: ColumnWidth;
}

export interface LayoutPersistenceHydrationFloatingWindow {
  readonly contextKey: string;
  readonly placement: DetachedWindowPlacement;
}

export interface LayoutPersistenceHydrationRestoreBaseline {
  readonly baseline: LayoutPersistenceHydrationRestoreBaselineValue;
  readonly contextKey: string;
  readonly windowId: WindowId;
}

export interface LayoutPersistenceHydrationRestoreBaselineValue {
  readonly clientFrame: PersistedRectV1;
  readonly fingerprint: string;
  readonly frame: PersistedRectV1;
  readonly kind: PersistedRestoreBaselineV1["kind"];
  readonly noBorder: boolean | null;
}

export interface LayoutPersistenceHydrationPlan {
  readonly contexts: readonly LayoutPersistenceHydrationContext[];
  readonly floatingWindows: readonly LayoutPersistenceHydrationFloatingWindow[];
  readonly fullWidthRestores: readonly LayoutPersistenceHydrationFullWidthRestore[];
  readonly restoreBaselines: readonly LayoutPersistenceHydrationRestoreBaseline[];
}

export type LayoutPersistenceHydrationFailure =
  | "duplicate-live-desktop-id"
  | "duplicate-live-output-name"
  | "duplicate-live-window-id"
  | "ineligible-live-window"
  | "invalid-live-descriptor"
  | "invalid-persisted-state"
  | "live-window-context-mismatch"
  | "missing-live-desktop"
  | "missing-live-output"
  | "missing-live-window"
  | "non-unique-output-match";

export type LayoutPersistenceHydrationResult =
  | {
      readonly ok: false;
      readonly reason: LayoutPersistenceHydrationFailure;
    }
  | {
      readonly ok: true;
      readonly value: LayoutPersistenceHydrationPlan;
    };

interface TiledPosition {
  readonly columnId: ColumnId;
  readonly columnIndex: number;
  readonly liveId: WindowId;
  readonly memberIndex: number;
}

interface PlannedContextIndex {
  readonly context: LayoutPersistenceHydrationContext;
  readonly positions: ReadonlyMap<string, TiledPosition>;
}

export function planExactLayoutHydration(
  state: LayoutPersistenceV1,
  input: LayoutPersistenceHydrationInput,
): LayoutPersistenceHydrationResult {
  const liveDesktopIds = new Map<string, LiveLayoutHydrationDesktop>();

  for (const desktop of input.desktops) {
    if (!validIdentifier(desktop.id)) {
      return failure("invalid-live-descriptor");
    }

    if (liveDesktopIds.has(desktop.id)) {
      return failure("duplicate-live-desktop-id");
    }

    liveDesktopIds.set(desktop.id, desktop);
  }

  const liveOutputs = new Map<string, LiveLayoutHydrationOutput>();

  for (const output of input.outputs) {
    if (!validIdentifier(output.name)) {
      return failure("invalid-live-descriptor");
    }

    if (liveOutputs.has(output.name)) {
      return failure("duplicate-live-output-name");
    }

    liveOutputs.set(output.name, output);
  }

  const liveWindows = new Map<string, LiveLayoutHydrationWindow>();

  for (const window of input.windows) {
    if (!validIdentifier(window.liveId)) {
      return failure("invalid-live-descriptor");
    }

    if (liveWindows.has(window.liveId)) {
      return failure("duplicate-live-window-id");
    }

    liveWindows.set(window.liveId, window);
  }

  const outputNamesByKey = new Map<string, string>();
  const claimedOutputNames = new Set<string>();

  for (const persisted of state.outputs) {
    if (outputNamesByKey.has(persisted.key)) {
      return failure("invalid-persisted-state");
    }

    if (!liveOutputs.has(persisted.name)) {
      return failure("missing-live-output");
    }

    if (claimedOutputNames.has(persisted.name)) {
      return failure("non-unique-output-match");
    }

    claimedOutputNames.add(persisted.name);
    outputNamesByKey.set(persisted.key, persisted.name);
  }

  const windowsByKey = new Map<string, LiveLayoutHydrationWindow>();
  const claimedLiveWindowIds = new Set<string>();

  for (const persisted of state.windows) {
    if (
      windowsByKey.has(persisted.key) ||
      claimedLiveWindowIds.has(persisted.liveId)
    ) {
      return failure("invalid-persisted-state");
    }

    const live = liveWindows.get(persisted.liveId);

    if (!live) {
      return failure("missing-live-window");
    }

    claimedLiveWindowIds.add(persisted.liveId);
    windowsByKey.set(persisted.key, live);
  }

  const contexts: LayoutPersistenceHydrationContext[] = [];
  const fullWidthRestores: LayoutPersistenceHydrationFullWidthRestore[] = [];
  const restoreBaselines: LayoutPersistenceHydrationRestoreBaseline[] = [];
  const contextIndices = new Map<string, PlannedContextIndex>();
  const ownedWindowKeys = new Set<string>();

  for (const persisted of state.contexts) {
    const outputName = outputNamesByKey.get(persisted.outputKey);

    if (!outputName) {
      return failure("invalid-persisted-state");
    }

    if (!liveDesktopIds.has(persisted.desktopId)) {
      return failure("missing-live-desktop");
    }

    const key = contextKey(outputName, persisted.desktopId);
    const hasRestoreBaseline = persisted.columns.some((column) =>
      column.members.some((member) => member.restoreBaseline !== undefined),
    );

    if (hasRestoreBaseline !== (persisted.restoreFingerprint !== undefined)) {
      return failure("invalid-persisted-state");
    }

    if (contextIndices.has(key)) {
      return failure("invalid-persisted-state");
    }

    const columns: LayoutColumnSnapshot[] = [];
    const positions = new Map<string, TiledPosition>();

    for (const [columnIndex, persistedColumn] of persisted.columns.entries()) {
      const firstMember = persistedColumn.members[0];

      if (!firstMember) {
        return failure("invalid-persisted-state");
      }

      const firstWindow = windowsByKey.get(firstMember.windowKey);

      if (!firstWindow) {
        return failure("invalid-persisted-state");
      }

      const plannedColumnId = columnId(`column:${firstWindow.liveId}`);
      const plannedWindowIds: WindowId[] = [];
      const hasPersistedHeights = persistedColumn.members.some(
        (member) => member.height !== undefined,
      );
      const plannedHeights: WindowHeight[] = [];

      for (const [memberIndex, member] of persistedColumn.members.entries()) {
        const live = windowsByKey.get(member.windowKey);

        if (!live || ownedWindowKeys.has(member.windowKey)) {
          return failure("invalid-persisted-state");
        }

        const ownershipFailure = validateWindowOwnership(
          live,
          outputName,
          persisted.desktopId,
        );

        if (ownershipFailure) {
          return failure(ownershipFailure);
        }

        const plannedWindowId = windowId(live.liveId);
        ownedWindowKeys.add(member.windowKey);
        plannedWindowIds.push(plannedWindowId);
        positions.set(member.windowKey, {
          columnId: plannedColumnId,
          columnIndex,
          liveId: plannedWindowId,
          memberIndex,
        });

        if (member.restoreBaseline) {
          const contextFingerprint = persisted.restoreFingerprint;

          if (contextFingerprint === undefined) {
            return failure("invalid-persisted-state");
          }

          restoreBaselines.push(
            Object.freeze({
              baseline: immutableRestoreBaseline(
                member.restoreBaseline,
                contextFingerprint,
              ),
              contextKey: key,
              windowId: plannedWindowId,
            }),
          );
        }

        if (hasPersistedHeights) {
          plannedHeights.push(
            immutableHeight(member.height ?? { kind: "auto", weight: 1 }),
          );
        }
      }

      const column = immutableColumn({
        id: plannedColumnId,
        width: immutableWidth(persistedColumn.width),
        ...(hasPersistedHeights
          ? { windowHeights: immutableArray(plannedHeights) }
          : {}),
        windowIds: immutableArray(plannedWindowIds),
      });
      columns.push(column);

      if (persistedColumn.fullWidthRestore) {
        fullWidthRestores.push(
          Object.freeze({
            columnId: plannedColumnId,
            contextKey: key,
            width: immutableWidth(persistedColumn.fullWidthRestore),
          }),
        );
      }
    }

    const activeColumnId =
      persisted.activeColumnIndex === null
        ? null
        : columns[persisted.activeColumnIndex]?.id;

    if (activeColumnId === undefined) {
      return failure("invalid-persisted-state");
    }

    const layout = Object.freeze({
      activeColumnId,
      columns: immutableArray(columns),
      desktopId: desktopId(persisted.desktopId),
      outputId: outputId(outputName),
      viewportOffset: persisted.viewportOffset,
    });
    const context = Object.freeze({ key, layout });
    contexts.push(context);
    contextIndices.set(key, { context, positions });
  }

  const floatingWindows: LayoutPersistenceHydrationFloatingWindow[] = [];

  for (const persisted of state.floatingWindows) {
    const outputName = outputNamesByKey.get(persisted.outputKey);
    const live = windowsByKey.get(persisted.windowKey);

    if (!outputName || !live || ownedWindowKeys.has(persisted.windowKey)) {
      return failure("invalid-persisted-state");
    }

    if (!liveDesktopIds.has(persisted.desktopId)) {
      return failure("missing-live-desktop");
    }

    const ownershipFailure = validateWindowOwnership(
      live,
      outputName,
      persisted.desktopId,
    );

    if (ownershipFailure) {
      return failure(ownershipFailure);
    }

    const key = contextKey(outputName, persisted.desktopId);
    const indexedContext = contextIndices.get(key);
    const previous = persisted.anchor.previousWindowKey;
    const next = persisted.anchor.nextWindowKey;
    const previousPosition =
      previous === undefined
        ? undefined
        : indexedContext?.positions.get(previous);
    const nextPosition =
      next === undefined ? undefined : indexedContext?.positions.get(next);

    if (
      (previous !== undefined && previousPosition === undefined) ||
      (next !== undefined && nextPosition === undefined) ||
      (previousPosition !== undefined &&
        nextPosition !== undefined &&
        (previousPosition.columnId !== nextPosition.columnId ||
          previousPosition.memberIndex >= nextPosition.memberIndex))
    ) {
      return failure("invalid-persisted-state");
    }

    const survivingPosition = previousPosition ?? nextPosition;
    const plannedWindowId = windowId(live.liveId);
    const plannedColumnId =
      survivingPosition?.columnId ?? columnId(`column:${live.liveId}`);
    const columns = indexedContext?.context.layout.columns ?? [];
    const neighborIndex = survivingPosition
      ? survivingPosition.columnIndex
      : Math.min(persisted.anchor.columnIndex, columns.length);
    const previousColumnId = columns[neighborIndex - 1]?.id ?? null;
    const nextColumnId = survivingPosition
      ? (columns[neighborIndex + 1]?.id ?? null)
      : (columns[neighborIndex]?.id ?? null);
    const placement = immutablePlacement({
      columnId: plannedColumnId,
      columnIndex: persisted.anchor.columnIndex,
      columnWidth: immutableWidth(persisted.anchor.columnWidth),
      desktopId: desktopId(persisted.desktopId),
      memberIndex: persisted.anchor.memberIndex,
      nextColumnId,
      nextWindowId: nextPosition?.liveId ?? null,
      outputId: outputId(outputName),
      previousColumnId,
      previousWindowId: previousPosition?.liveId ?? null,
      ...(persisted.anchor.windowHeight
        ? { windowHeight: immutableHeight(persisted.anchor.windowHeight) }
        : {}),
      windowId: plannedWindowId,
    });

    ownedWindowKeys.add(persisted.windowKey);
    floatingWindows.push(Object.freeze({ contextKey: key, placement }));
  }

  if (ownedWindowKeys.size !== state.windows.length) {
    return failure("invalid-persisted-state");
  }

  return {
    ok: true,
    value: Object.freeze({
      contexts: immutableArray(contexts),
      floatingWindows: immutableArray(floatingWindows),
      fullWidthRestores: immutableArray(fullWidthRestores),
      restoreBaselines: immutableArray(restoreBaselines),
    }),
  };
}

function validateWindowOwnership(
  window: LiveLayoutHydrationWindow,
  outputName: string,
  desktop: string,
): LayoutPersistenceHydrationFailure | null {
  if (!window.eligible) {
    return "ineligible-live-window";
  }

  if (window.outputName !== outputName || window.desktopId !== desktop) {
    return "live-window-context-mismatch";
  }

  return null;
}

function contextKey(outputName: string, desktop: string): string {
  return `${outputName}\u0000${desktop}`;
}

function validIdentifier(value: string): boolean {
  return value.length > 0;
}

function immutableColumn(column: LayoutColumnSnapshot): LayoutColumnSnapshot {
  return Object.freeze(column);
}

function immutablePlacement(
  placement: DetachedWindowPlacement,
): DetachedWindowPlacement {
  return Object.freeze(placement);
}

function immutableWidth(width: ColumnWidth): ColumnWidth {
  return Object.freeze({ kind: width.kind, value: width.value });
}

function immutableHeight(height: WindowHeight): WindowHeight {
  switch (height.kind) {
    case "auto":
      return Object.freeze({ kind: height.kind, weight: height.weight });
    case "fixed":
      return Object.freeze({
        clientHeight: height.clientHeight,
        kind: height.kind,
      });
    case "preset":
      return Object.freeze({ index: height.index, kind: height.kind });
  }
}

function immutableRestoreBaseline(
  baseline: PersistedRestoreBaselineV1,
  fingerprint: string,
): LayoutPersistenceHydrationRestoreBaselineValue {
  return Object.freeze({
    clientFrame: Object.freeze({ ...baseline.clientFrame }),
    fingerprint,
    frame: Object.freeze({ ...baseline.frame }),
    kind: baseline.kind,
    noBorder: baseline.noBorder,
  });
}

function immutableArray<T>(values: T[]): readonly T[] {
  return Object.freeze(values);
}

function failure(
  reason: LayoutPersistenceHydrationFailure,
): LayoutPersistenceHydrationResult {
  return { ok: false, reason };
}
