import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export type OverviewSpatialPresentationKind =
  "placeholder" | "tab" | "thumbnail";

export interface OverviewSpatialPresentationMotionFrame {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface OverviewSpatialPresentationMotionColumnIdentity {
  readonly memberIds: readonly string[];
  readonly selectedWindowId: string;
}

export interface OverviewSpatialPresentationMotionSnapshot {
  readonly column?: OverviewSpatialPresentationMotionColumnIdentity;
  readonly frame: OverviewSpatialPresentationMotionFrame;
  readonly kind: OverviewSpatialPresentationKind;
  readonly minimized: boolean;
  readonly windowId: string;
}

export interface OverviewSpatialPresentationMotionInput {
  readonly current: readonly OverviewSpatialPresentationMotionSnapshot[];
  readonly next: readonly OverviewSpatialPresentationMotionSnapshot[];
}

export type OverviewSpatialPresentationMotionDisposition = "entry" | "survivor";

export interface OverviewSpatialPresentationMotionTrack {
  readonly column: OverviewSpatialPresentationMotionColumnIdentity | null;
  readonly disposition: OverviewSpatialPresentationMotionDisposition;
  readonly fromFrame: OverviewSpatialPresentationMotionFrame;
  readonly fromKind: OverviewSpatialPresentationKind;
  readonly fromMarkerProgress: 0 | 1;
  readonly fromMinimized: boolean;
  readonly toFrame: OverviewSpatialPresentationMotionFrame;
  readonly toKind: OverviewSpatialPresentationKind;
  readonly toMarkerProgress: 0 | 1;
  readonly toMinimized: boolean;
  readonly windowId: string;
}

export interface OverviewSpatialPresentationMotionPlan {
  readonly entries: readonly OverviewSpatialPresentationMotionTrack[];
  readonly survivors: readonly OverviewSpatialPresentationMotionTrack[];
}

export interface OverviewSpatialPresentationMotionSample {
  readonly frame: OverviewSpatialPresentationMotionFrame;
  readonly fromMarkerProgress: number;
  readonly fromOpacity: number;
  readonly toMarkerProgress: number;
  readonly toOpacity: number;
}

interface ParsedPresentationSnapshot {
  readonly byWindowId: ReadonlyMap<
    string,
    OverviewSpatialPresentationMotionSnapshot
  >;
}

const MAXIMUM_GEOMETRY_MAGNITUDE = LAYOUT_PERSISTENCE_LIMITS.numericMagnitude;
const trustedMotionTracks = new WeakSet();

export function planOverviewSpatialPresentationMotion(
  input: unknown,
): OverviewSpatialPresentationMotionPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const current = readPresentationSnapshot(input["current"]);
    const next = readPresentationSnapshot(input["next"]);
    if (current === null || next === null) {
      return null;
    }

    const entries: OverviewSpatialPresentationMotionTrack[] = [];
    const survivors: OverviewSpatialPresentationMotionTrack[] = [];
    for (const [windowId, nextWindow] of next.byWindowId) {
      const currentWindow = current.byWindowId.get(windowId);
      if (currentWindow === undefined) {
        entries.push(createEntryTrack(nextWindow));
        continue;
      }

      const fromMarkerProgress = markerProgress(currentWindow);
      const toMarkerProgress = markerProgress(nextWindow);
      if (
        sameFrame(currentWindow.frame, nextWindow.frame) &&
        currentWindow.kind === nextWindow.kind &&
        currentWindow.minimized === nextWindow.minimized &&
        fromMarkerProgress === toMarkerProgress
      ) {
        continue;
      }

      survivors.push(
        freezeTrustedTrack({
          column: unchangedColumnIdentity(currentWindow, nextWindow),
          disposition: "survivor",
          fromFrame: currentWindow.frame,
          fromKind: currentWindow.kind,
          fromMarkerProgress,
          fromMinimized: currentWindow.minimized,
          toFrame: nextWindow.frame,
          toKind: nextWindow.kind,
          toMarkerProgress,
          toMinimized: nextWindow.minimized,
          windowId,
        }),
      );
    }

    entries.sort(compareTracksByWindowId);
    survivors.sort(compareTracksByWindowId);
    return Object.freeze({
      entries: Object.freeze(entries),
      survivors: Object.freeze(survivors),
    });
  } catch {
    return null;
  }
}

export function sampleOverviewSpatialPresentationMotion(
  track: unknown,
  progress: unknown,
): OverviewSpatialPresentationMotionSample | null {
  try {
    const snapshot = readTrack(track);
    if (
      snapshot === null ||
      typeof progress !== "number" ||
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress > 1
    ) {
      return null;
    }

    const amount = normalizeZero(progress);
    const fromOpacity =
      snapshot.disposition === "entry" ? 0 : normalizeZero(1 - amount);
    const toOpacity = amount;
    return Object.freeze({
      frame: sampleFrame(snapshot.fromFrame, snapshot.toFrame, amount),
      fromMarkerProgress: normalizeZero(
        snapshot.fromMarkerProgress * fromOpacity,
      ),
      fromOpacity,
      toMarkerProgress: normalizeZero(snapshot.toMarkerProgress * toOpacity),
      toOpacity,
    });
  } catch {
    return null;
  }
}

function readPresentationSnapshot(
  value: unknown,
): ParsedPresentationSnapshot | null {
  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.windows
  ) {
    return null;
  }

  const byWindowId = new Map<
    string,
    OverviewSpatialPresentationMotionSnapshot
  >();
  const parsedColumns = new Map<
    object,
    OverviewSpatialPresentationMotionColumnIdentity
  >();
  const columnOwnerByMemberId = new Map<string, string>();
  const selectedWindowIdByColumn = new Map<string, string>();
  for (const candidate of value) {
    const snapshot = readSnapshotRecord(candidate, parsedColumns);
    if (snapshot === null || byWindowId.has(snapshot.windowId)) {
      return null;
    }

    const column = snapshot.column;
    if (column !== undefined) {
      const columnKey = JSON.stringify(column.memberIds);
      const knownSelection = selectedWindowIdByColumn.get(columnKey);
      if (
        (knownSelection !== undefined &&
          knownSelection !== column.selectedWindowId) ||
        column.memberIds.some((memberId) => {
          const owner = columnOwnerByMemberId.get(memberId);
          return owner !== undefined && owner !== columnKey;
        })
      ) {
        return null;
      }

      selectedWindowIdByColumn.set(columnKey, column.selectedWindowId);
      for (const memberId of column.memberIds) {
        columnOwnerByMemberId.set(memberId, columnKey);
      }
    }

    byWindowId.set(snapshot.windowId, snapshot);
  }

  for (const snapshot of byWindowId.values()) {
    const column = snapshot.column;
    if (column === undefined) {
      continue;
    }
    for (const memberId of column.memberIds) {
      const presentMember = byWindowId.get(memberId);
      if (
        presentMember !== undefined &&
        (presentMember.column === undefined ||
          !sameColumnIdentity(column, presentMember.column))
      ) {
        return null;
      }
    }
  }

  return { byWindowId };
}

function readSnapshotRecord(
  value: unknown,
  parsedColumns: Map<object, OverviewSpatialPresentationMotionColumnIdentity>,
): OverviewSpatialPresentationMotionSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const windowId = value["windowId"];
  const kind = value["kind"];
  const frame = readFrame(value["frame"]);
  const minimized = value["minimized"];
  const columnValue = value["column"];
  const column =
    columnValue === undefined
      ? undefined
      : readColumnIdentity(columnValue, parsedColumns);
  if (column === null) {
    return null;
  }
  if (
    !isIdentifier(windowId) ||
    !isPresentationKind(kind) ||
    frame === null ||
    typeof minimized !== "boolean" ||
    (column !== undefined && !column.memberIds.includes(windowId))
  ) {
    return null;
  }

  return column === undefined
    ? Object.freeze({ frame, kind, minimized, windowId })
    : Object.freeze({ column, frame, kind, minimized, windowId });
}

function readTrack(
  value: unknown,
): OverviewSpatialPresentationMotionTrack | null {
  if (!isRecord(value)) {
    return null;
  }
  if (trustedMotionTracks.has(value)) {
    return value as unknown as OverviewSpatialPresentationMotionTrack;
  }

  const columnValue = value["column"];
  const column = columnValue === null ? null : readColumnIdentity(columnValue);
  const disposition = value["disposition"];
  const fromFrame = readFrame(value["fromFrame"]);
  const fromKind = value["fromKind"];
  const fromMarkerProgress = value["fromMarkerProgress"];
  const fromMinimized = value["fromMinimized"];
  const toFrame = readFrame(value["toFrame"]);
  const toKind = value["toKind"];
  const toMarkerProgress = value["toMarkerProgress"];
  const toMinimized = value["toMinimized"];
  const windowId = value["windowId"];
  if (columnValue !== null && column === null) {
    return null;
  }
  if (
    !isMotionDisposition(disposition) ||
    fromFrame === null ||
    !isPresentationKind(fromKind) ||
    !isMarkerProgress(fromMarkerProgress) ||
    typeof fromMinimized !== "boolean" ||
    toFrame === null ||
    !isPresentationKind(toKind) ||
    !isMarkerProgress(toMarkerProgress) ||
    typeof toMinimized !== "boolean" ||
    !isIdentifier(windowId)
  ) {
    return null;
  }

  if (
    disposition === "entry" &&
    (column !== null ||
      !sameFrame(fromFrame, toFrame) ||
      fromKind !== toKind ||
      fromMarkerProgress !== 0 ||
      fromMinimized !== toMinimized)
  ) {
    return null;
  }
  if (
    column !== null &&
    (!column.memberIds.includes(windowId) ||
      fromMarkerProgress !== toMarkerProgress ||
      fromMarkerProgress !== (column.selectedWindowId === windowId ? 1 : 0))
  ) {
    return null;
  }

  return Object.freeze({
    column,
    disposition,
    fromFrame,
    fromKind,
    fromMarkerProgress,
    fromMinimized,
    toFrame,
    toKind,
    toMarkerProgress,
    toMinimized,
    windowId,
  });
}

function createEntryTrack(
  snapshot: OverviewSpatialPresentationMotionSnapshot,
): OverviewSpatialPresentationMotionTrack {
  return freezeTrustedTrack({
    column: null,
    disposition: "entry",
    fromFrame: snapshot.frame,
    fromKind: snapshot.kind,
    fromMarkerProgress: 0,
    fromMinimized: snapshot.minimized,
    toFrame: snapshot.frame,
    toKind: snapshot.kind,
    toMarkerProgress: markerProgress(snapshot),
    toMinimized: snapshot.minimized,
    windowId: snapshot.windowId,
  });
}

function freezeTrustedTrack(
  track: OverviewSpatialPresentationMotionTrack,
): OverviewSpatialPresentationMotionTrack {
  const frozen = Object.freeze(track);
  trustedMotionTracks.add(frozen);
  return frozen;
}

function unchangedColumnIdentity(
  current: OverviewSpatialPresentationMotionSnapshot,
  next: OverviewSpatialPresentationMotionSnapshot,
): OverviewSpatialPresentationMotionColumnIdentity | null {
  const currentColumn = current.column;
  const nextColumn = next.column;
  return currentColumn !== undefined &&
    nextColumn !== undefined &&
    sameColumnIdentity(currentColumn, nextColumn)
    ? nextColumn
    : null;
}

function markerProgress(
  snapshot: OverviewSpatialPresentationMotionSnapshot,
): 0 | 1 {
  return snapshot.column?.selectedWindowId === snapshot.windowId ? 1 : 0;
}

function readColumnIdentity(
  value: unknown,
  parsedColumns?: Map<object, OverviewSpatialPresentationMotionColumnIdentity>,
): OverviewSpatialPresentationMotionColumnIdentity | null {
  if (!isRecord(value)) {
    return null;
  }
  const cached = parsedColumns?.get(value);
  if (cached !== undefined) {
    return cached;
  }

  const memberIdsValue = value["memberIds"];
  const selectedWindowId = value["selectedWindowId"];
  if (
    !Array.isArray(memberIdsValue) ||
    memberIdsValue.length < 1 ||
    memberIdsValue.length > LAYOUT_PERSISTENCE_LIMITS.membersPerColumn ||
    !isIdentifier(selectedWindowId)
  ) {
    return null;
  }

  const memberIds: string[] = [];
  const uniqueMemberIds = new Set<string>();
  for (const memberId of memberIdsValue) {
    if (!isIdentifier(memberId) || uniqueMemberIds.has(memberId)) {
      return null;
    }
    uniqueMemberIds.add(memberId);
    memberIds.push(memberId);
  }
  if (!uniqueMemberIds.has(selectedWindowId)) {
    return null;
  }

  const identity = Object.freeze({
    memberIds: Object.freeze(memberIds),
    selectedWindowId,
  });
  parsedColumns?.set(value, identity);
  return identity;
}

function readFrame(
  value: unknown,
): OverviewSpatialPresentationMotionFrame | null {
  if (!isRecord(value)) {
    return null;
  }

  const height = value["height"];
  const width = value["width"];
  const x = value["x"];
  const y = value["y"];
  if (
    !isPositiveGeometryNumber(height) ||
    !isPositiveGeometryNumber(width) ||
    !isGeometryNumber(x) ||
    !isGeometryNumber(y) ||
    !isGeometryNumber(x + width) ||
    !isGeometryNumber(y + height)
  ) {
    return null;
  }

  return Object.freeze({
    height: normalizeZero(height),
    width: normalizeZero(width),
    x: normalizeZero(x),
    y: normalizeZero(y),
  });
}

function sameColumnIdentity(
  first: OverviewSpatialPresentationMotionColumnIdentity,
  second: OverviewSpatialPresentationMotionColumnIdentity,
): boolean {
  return (
    first.selectedWindowId === second.selectedWindowId &&
    first.memberIds.length === second.memberIds.length &&
    first.memberIds.every(
      (memberId, memberIndex) => memberId === second.memberIds[memberIndex],
    )
  );
}

function sameFrame(
  first: OverviewSpatialPresentationMotionFrame,
  second: OverviewSpatialPresentationMotionFrame,
): boolean {
  return (
    first.height === second.height &&
    first.width === second.width &&
    first.x === second.x &&
    first.y === second.y
  );
}

function compareTracksByWindowId(
  first: OverviewSpatialPresentationMotionTrack,
  second: OverviewSpatialPresentationMotionTrack,
): number {
  return first.windowId < second.windowId
    ? -1
    : first.windowId > second.windowId
      ? 1
      : 0;
}

function sampleFrame(
  fromFrame: OverviewSpatialPresentationMotionFrame,
  toFrame: OverviewSpatialPresentationMotionFrame,
  progress: number,
): OverviewSpatialPresentationMotionFrame {
  if (progress === 0) {
    return fromFrame;
  }
  if (progress === 1) {
    return toFrame;
  }

  const x = interpolate(fromFrame.x, toFrame.x, progress);
  const y = interpolate(fromFrame.y, toFrame.y, progress);
  const width = boundInterpolatedDimension(
    x,
    interpolate(fromFrame.width, toFrame.width, progress),
  );
  const height = boundInterpolatedDimension(
    y,
    interpolate(fromFrame.height, toFrame.height, progress),
  );
  return Object.freeze({ height, width, x, y });
}

function boundInterpolatedDimension(
  position: number,
  dimension: number,
): number {
  if (position + dimension <= MAXIMUM_GEOMETRY_MAGNITUDE) {
    return dimension;
  }

  const bounded = MAXIMUM_GEOMETRY_MAGNITUDE - position;
  return bounded > 0 ? bounded : Number.MIN_VALUE;
}

function interpolate(first: number, second: number, progress: number): number {
  if (progress === 0) {
    return first;
  }
  if (progress === 1) {
    return second;
  }
  return normalizeZero(first + (second - first) * progress);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
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

function isGeometryNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_GEOMETRY_MAGNITUDE
  );
}

function isPositiveGeometryNumber(value: unknown): value is number {
  return isGeometryNumber(value) && value > 0;
}

function isMarkerProgress(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isMotionDisposition(
  value: unknown,
): value is OverviewSpatialPresentationMotionDisposition {
  return value === "entry" || value === "survivor";
}

function isPresentationKind(
  value: unknown,
): value is OverviewSpatialPresentationKind {
  return value === "placeholder" || value === "tab" || value === "thumbnail";
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
