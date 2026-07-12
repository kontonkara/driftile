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
import {
  LAYOUT_PERSISTENCE_LIMITS,
  type LayoutPersistenceV1,
  type PersistedRectV1,
  type PersistedRestoreBaselineV1,
  type PersistedWindowMatchV1,
} from "./layout-persistence";
import {
  matchPersistedOutputs,
  matchPersistedWindows,
} from "./layout-persistence-match";

export interface LiveLayoutHydrationDesktop {
  readonly id: string;
}

export interface LiveLayoutHydrationOutput {
  readonly manufacturer?: string;
  readonly model?: string;
  readonly name: string;
  readonly serialNumber?: string;
}

export interface LiveLayoutHydrationWindow {
  readonly desktopFileName?: string;
  readonly desktopId: string;
  readonly eligible: boolean;
  readonly liveId: string;
  readonly outputName: string;
  readonly resourceClass?: string;
  readonly resourceName?: string;
  readonly tag?: string;
  readonly windowRole?: string;
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
  | "non-unique-output-match"
  | "unresolved-live-output"
  | "unresolved-live-window";

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

const STRONG_WINDOW_APP_FIELDS = ["desktopFileName", "resourceClass"] as const;
const STRONG_WINDOW_DISCRIMINATOR_FIELDS = ["tag", "windowRole"] as const;

type RemappedPersistenceResult =
  | {
      readonly ok: false;
      readonly reason: LayoutPersistenceHydrationFailure;
    }
  | {
      readonly ok: true;
      readonly value: LayoutPersistenceV1;
    };

export function planLayoutHydration(
  state: LayoutPersistenceV1,
  input: LayoutPersistenceHydrationInput,
): LayoutPersistenceHydrationResult {
  const structuralFailure = remappableStructureFailure(state);

  if (structuralFailure) {
    return failure(structuralFailure);
  }

  const exact = planExactLayoutHydration(state, input);

  if (
    exact.ok ||
    (exact.reason !== "missing-live-output" &&
      exact.reason !== "missing-live-window")
  ) {
    return exact;
  }

  const remapped = remapPersistenceIdentities(state, input);
  return remapped.ok
    ? planExactLayoutHydration(remapped.value, input)
    : failure(remapped.reason);
}

function remappableStructureFailure(
  state: LayoutPersistenceV1,
): LayoutPersistenceHydrationFailure | null {
  if (
    hasDuplicateBy(state.outputs, (output) => output.key) ||
    hasDuplicateBy(state.windows, (window) => window.key) ||
    hasDuplicateBy(state.windows, (window) => window.liveId)
  ) {
    return "invalid-persisted-state";
  }

  if (hasDuplicateBy(state.outputs, (output) => output.name)) {
    return "non-unique-output-match";
  }

  for (const context of state.contexts) {
    const hasRestoreBaseline = context.columns.some((column) =>
      column.members.some((member) => member.restoreBaseline !== undefined),
    );

    if (hasRestoreBaseline !== (context.restoreFingerprint !== undefined)) {
      return "invalid-persisted-state";
    }
  }

  return null;
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

function remapPersistenceIdentities(
  state: LayoutPersistenceV1,
  input: LayoutPersistenceHydrationInput,
): RemappedPersistenceResult {
  if (!validLiveIdentityDescriptors(input)) {
    return { ok: false, reason: "invalid-live-descriptor" };
  }

  const outputMatches = matchPersistedOutputs(
    state.outputs,
    input.outputs.map((output) => ({
      liveId: output.name,
      ...(output.manufacturer === undefined
        ? {}
        : { manufacturer: output.manufacturer }),
      ...(output.model === undefined ? {} : { model: output.model }),
      name: output.name,
      ...(output.serialNumber === undefined
        ? {}
        : { serialNumber: output.serialNumber }),
    })),
  );

  if (outputMatches.unmatchedPersistedKeys.length !== 0) {
    return { ok: false, reason: "unresolved-live-output" };
  }

  const windowMatches = matchPersistedWindows(
    state.windows,
    input.windows.map((window) => ({
      ...(window.desktopFileName === undefined
        ? {}
        : { desktopFileName: window.desktopFileName }),
      liveId: window.liveId,
      ...(window.resourceClass === undefined
        ? {}
        : { resourceClass: window.resourceClass }),
      ...(window.resourceName === undefined
        ? {}
        : { resourceName: window.resourceName }),
      ...(window.tag === undefined ? {} : { tag: window.tag }),
      ...(window.windowRole === undefined
        ? {}
        : { windowRole: window.windowRole }),
    })),
  );

  if (windowMatches.unmatchedPersistedKeys.length !== 0) {
    return { ok: false, reason: "unresolved-live-window" };
  }

  const persistedWindows = new Map(
    state.windows.map((window) => [window.key, window]),
  );
  const liveWindows = new Map(
    input.windows.map((window) => [window.liveId, window]),
  );
  const exactPersistedWindowKeys = new Set<string>();
  const exactLiveWindowIds = new Set<string>();

  for (const match of windowMatches.matches) {
    if (match.basis === "live-id") {
      exactPersistedWindowKeys.add(match.persistedKey);
      exactLiveWindowIds.add(match.liveId);
    }
  }

  const persistedStrongProjectionCounts = new Map<string, number>();
  const liveStrongProjectionCounts = new Map<string, number>();

  for (const persisted of state.windows) {
    if (
      !exactPersistedWindowKeys.has(persisted.key) &&
      persisted.sessionMatch !== undefined
    ) {
      countStrongProjections(
        persisted.sessionMatch,
        persistedStrongProjectionCounts,
      );
    }
  }

  for (const live of input.windows) {
    if (!exactLiveWindowIds.has(live.liveId)) {
      countStrongProjections(live, liveStrongProjectionCounts);
    }
  }

  const sessionMatchedWindowKeys = new Set<string>();

  for (const match of windowMatches.matches) {
    if (match.basis !== "session") {
      continue;
    }

    const descriptor = persistedWindows.get(match.persistedKey)?.sessionMatch;
    const live = liveWindows.get(match.liveId);

    if (
      !descriptor ||
      !live ||
      !hasMutuallyUniqueStrongProjection(
        descriptor,
        live,
        persistedStrongProjectionCounts,
        liveStrongProjectionCounts,
      )
    ) {
      return { ok: false, reason: "unresolved-live-window" };
    }

    sessionMatchedWindowKeys.add(match.persistedKey);
  }

  const outputNames = new Map(
    outputMatches.matches.map((match) => [match.persistedKey, match.liveId]),
  );
  const windowIds = new Map(
    windowMatches.matches.map((match) => [match.persistedKey, match.liveId]),
  );

  return {
    ok: true,
    value: {
      ...state,
      contexts: state.contexts.map((context) =>
        contextWithoutStaleRestoreBaselines(context, sessionMatchedWindowKeys),
      ),
      outputs: state.outputs.map((output) => ({
        ...output,
        name: requiredIdentity(outputNames.get(output.key)),
      })),
      windows: state.windows.map((window) => ({
        ...window,
        liveId: requiredIdentity(windowIds.get(window.key)),
      })),
    },
  };
}

function contextWithoutStaleRestoreBaselines(
  context: LayoutPersistenceV1["contexts"][number],
  sessionMatchedWindowKeys: ReadonlySet<string>,
): LayoutPersistenceV1["contexts"][number] {
  const removesBaseline = context.columns.some((column) =>
    column.members.some(
      (member) =>
        member.restoreBaseline !== undefined &&
        sessionMatchedWindowKeys.has(member.windowKey),
    ),
  );

  if (!removesBaseline) {
    return context;
  }

  const columns = context.columns.map((column) => ({
    ...column,
    members: column.members.map((member) => {
      if (
        member.restoreBaseline === undefined ||
        !sessionMatchedWindowKeys.has(member.windowKey)
      ) {
        return member;
      }

      return {
        ...(member.height === undefined ? {} : { height: member.height }),
        windowKey: member.windowKey,
      };
    }),
  }));
  const retainedBaseline = columns.some((column) =>
    column.members.some((member) => member.restoreBaseline !== undefined),
  );

  return {
    activeColumnIndex: context.activeColumnIndex,
    columns,
    desktopId: context.desktopId,
    outputKey: context.outputKey,
    ...(retainedBaseline && context.restoreFingerprint !== undefined
      ? { restoreFingerprint: context.restoreFingerprint }
      : {}),
    viewportOffset: context.viewportOffset,
  };
}

function countStrongProjections(
  descriptor: PersistedWindowMatchV1,
  counts: Map<string, number>,
): void {
  forEachStrongProjection(descriptor, (key) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
}

function hasMutuallyUniqueStrongProjection(
  persisted: PersistedWindowMatchV1,
  live: PersistedWindowMatchV1,
  persistedCounts: ReadonlyMap<string, number>,
  liveCounts: ReadonlyMap<string, number>,
): boolean {
  let unique = false;

  forEachStrongProjection(
    persisted,
    (key, appField, appValue, discriminatorField, discriminatorValue) => {
      if (unique) {
        return;
      }

      if (
        live[appField] === appValue &&
        live[discriminatorField] === discriminatorValue &&
        persistedCounts.get(key) === 1 &&
        liveCounts.get(key) === 1
      ) {
        unique = true;
      }
    },
  );

  return unique;
}

function forEachStrongProjection(
  descriptor: PersistedWindowMatchV1,
  visit: (
    key: string,
    appField: (typeof STRONG_WINDOW_APP_FIELDS)[number],
    appValue: string,
    discriminatorField: (typeof STRONG_WINDOW_DISCRIMINATOR_FIELDS)[number],
    discriminatorValue: string,
  ) => void,
): void {
  for (const appField of STRONG_WINDOW_APP_FIELDS) {
    const appValue = descriptor[appField];

    if (appValue === undefined) {
      continue;
    }

    for (const discriminatorField of STRONG_WINDOW_DISCRIMINATOR_FIELDS) {
      const discriminatorValue = descriptor[discriminatorField];

      if (discriminatorValue !== undefined) {
        visit(
          strongProjectionKey(
            appField,
            appValue,
            discriminatorField,
            discriminatorValue,
          ),
          appField,
          appValue,
          discriminatorField,
          discriminatorValue,
        );
      }
    }
  }
}

function strongProjectionKey(
  appField: (typeof STRONG_WINDOW_APP_FIELDS)[number],
  appValue: string,
  discriminatorField: (typeof STRONG_WINDOW_DISCRIMINATOR_FIELDS)[number],
  discriminatorValue: string,
): string {
  return `${appField}\u0000${appValue}\u0000${discriminatorField}\u0000${discriminatorValue}`;
}

function validLiveIdentityDescriptors(
  input: LayoutPersistenceHydrationInput,
): boolean {
  return (
    input.outputs.every(
      (output) =>
        validOptionalIdentifier(output.manufacturer) &&
        validOptionalIdentifier(output.model) &&
        validOptionalIdentifier(output.serialNumber),
    ) &&
    input.windows.every(
      (window) =>
        validOptionalIdentifier(window.desktopFileName) &&
        validOptionalIdentifier(window.resourceClass) &&
        validOptionalIdentifier(window.resourceName) &&
        validOptionalIdentifier(window.tag) &&
        validOptionalIdentifier(window.windowRole),
    )
  );
}

function validOptionalIdentifier(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  if (
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

function requiredIdentity(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("matched persistence identity is missing");
  }

  return value;
}

function hasDuplicateBy<T>(
  values: readonly T[],
  identity: (value: T) => string,
): boolean {
  const seen = new Set<string>();

  for (const value of values) {
    const key = identity(value);

    if (seen.has(key)) {
      return true;
    }

    seen.add(key);
  }

  return false;
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
