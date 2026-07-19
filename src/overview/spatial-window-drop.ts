import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialWindowDropPoint {
  readonly x: number;
  readonly y: number;
}

export interface OverviewSpatialWindowDropRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface OverviewSpatialWindowDropMemberInput {
  readonly frame: OverviewSpatialWindowDropRect;
  readonly windowId: string;
}

export interface OverviewSpatialWindowDropColumnInput {
  readonly frame: OverviewSpatialWindowDropRect;
  readonly members: readonly OverviewSpatialWindowDropMemberInput[];
}

export interface OverviewSpatialWindowDropRowInput {
  readonly activityId: string;
  readonly columns: readonly OverviewSpatialWindowDropColumnInput[];
  readonly desktopId: string;
  readonly frame: OverviewSpatialWindowDropRect;
  readonly outputId: string;
}

export interface OverviewSpatialWindowDropPlanInput {
  readonly rows: readonly OverviewSpatialWindowDropRowInput[];
}

interface OverviewSpatialWindowDropTargetContext {
  readonly activityId: string;
  readonly desktopId: string;
  readonly outputId: string;
  readonly rowIndex: number;
}

export interface OverviewSpatialWindowDropEmptyRowTarget extends OverviewSpatialWindowDropTargetContext {
  readonly kind: "empty-row";
}

export interface OverviewSpatialWindowDropColumnBoundaryTarget extends OverviewSpatialWindowDropTargetContext {
  readonly kind: "column-boundary";
  readonly position: "after" | "before";
  readonly targetWindowId: string;
}

export interface OverviewSpatialWindowDropStackInsertionTarget extends OverviewSpatialWindowDropTargetContext {
  readonly kind: "stack-insertion";
  readonly position: "after" | "before";
  readonly targetWindowId: string;
}

export type OverviewSpatialWindowDropTarget =
  | OverviewSpatialWindowDropColumnBoundaryTarget
  | OverviewSpatialWindowDropEmptyRowTarget
  | OverviewSpatialWindowDropStackInsertionTarget;

interface OverviewSpatialWindowDropMemberPlan {
  readonly afterTarget: OverviewSpatialWindowDropStackInsertionTarget;
  readonly beforeTarget: OverviewSpatialWindowDropStackInsertionTarget;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly split: number;
  readonly top: number;
}

interface OverviewSpatialWindowDropBoundaryZone {
  readonly kind: "boundary";
  readonly left: number;
  readonly right: number;
  readonly target: OverviewSpatialWindowDropColumnBoundaryTarget;
}

interface OverviewSpatialWindowDropColumnZone {
  readonly bottom: number;
  readonly kind: "column";
  readonly left: number;
  readonly members: readonly OverviewSpatialWindowDropMemberPlan[];
  readonly right: number;
  readonly top: number;
}

type OverviewSpatialWindowDropHorizontalZone =
  OverviewSpatialWindowDropBoundaryZone | OverviewSpatialWindowDropColumnZone;

interface OverviewSpatialWindowDropRowPlan {
  readonly bottom: number;
  readonly emptyTarget: OverviewSpatialWindowDropEmptyRowTarget | null;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly zones: readonly OverviewSpatialWindowDropHorizontalZone[];
}

const planBrand: unique symbol = Symbol("overview-spatial-window-drop-plan");

export interface OverviewSpatialWindowDropPlan {
  readonly [planBrand]: true;
  readonly rows: readonly OverviewSpatialWindowDropRowPlan[];
}

interface GeometryRect {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

interface ParsedColumn {
  readonly anchorWindowId: string;
  readonly frame: GeometryRect;
  readonly members: readonly OverviewSpatialWindowDropMemberPlan[];
}

interface BuildState {
  readonly contextKeys: Set<string>;
  totalWindowCount: number;
  readonly windowIds: Set<string>;
}

const MAXIMUM_GEOMETRY_MAGNITUDE = LAYOUT_PERSISTENCE_LIMITS.numericMagnitude;

export function buildOverviewSpatialWindowDropPlan(
  input: unknown,
): OverviewSpatialWindowDropPlan | null {
  try {
    const candidate = record(input);
    const rowsValue = candidate?.["rows"];

    if (
      candidate === null ||
      !Array.isArray(rowsValue) ||
      rowsValue.length === 0 ||
      rowsValue.length > LAYOUT_PERSISTENCE_LIMITS.contexts
    ) {
      return null;
    }

    const state: BuildState = {
      contextKeys: new Set<string>(),
      totalWindowCount: 0,
      windowIds: new Set<string>(),
    };
    const rows: OverviewSpatialWindowDropRowPlan[] = [];
    let previousBottom = Number.NEGATIVE_INFINITY;

    for (let rowIndex = 0; rowIndex < rowsValue.length; rowIndex += 1) {
      const row = buildRowPlan(rowsValue[rowIndex], rowIndex, state);

      if (row === null || row.top < previousBottom) {
        return null;
      }

      rows.push(row);
      previousBottom = row.bottom;
    }

    return Object.freeze({
      [planBrand]: true as const,
      rows: Object.freeze(rows),
    });
  } catch {
    return null;
  }
}

export function hitTestOverviewSpatialWindowDrop(
  plan: unknown,
  point: unknown,
): OverviewSpatialWindowDropTarget | null {
  try {
    const candidate = record(plan);

    if (
      candidate === null ||
      candidate[planBrand] !== true ||
      !Object.isFrozen(candidate) ||
      !isBoundedPoint(point)
    ) {
      return null;
    }

    const rows = candidate["rows"];
    if (!Array.isArray(rows) || !Object.isFrozen(rows)) {
      return null;
    }

    const row = findRow(rows as readonly unknown[], point.y);
    if (row === null || point.x < row.left || point.x >= row.right) {
      return null;
    }

    if (row.emptyTarget !== null) {
      return row.emptyTarget;
    }

    const zone = findHorizontalZone(row.zones, point.x);
    if (zone === null) {
      return null;
    }

    if (zone.kind === "boundary") {
      return zone.target;
    }

    if (point.y < zone.top || point.y >= zone.bottom) {
      return null;
    }

    const member = findMember(zone.members, point.y);
    if (member === null || point.x < member.left || point.x >= member.right) {
      return null;
    }

    return point.y < member.split ? member.beforeTarget : member.afterTarget;
  } catch {
    return null;
  }
}

function buildRowPlan(
  value: unknown,
  rowIndex: number,
  state: BuildState,
): OverviewSpatialWindowDropRowPlan | null {
  const candidate = record(value);

  if (candidate === null) {
    return null;
  }

  const columnsValue = candidate["columns"];
  const activityId = candidate["activityId"];
  const desktopId = candidate["desktopId"];
  const outputId = candidate["outputId"];
  const frame = readRect(candidate["frame"]);

  if (
    !Array.isArray(columnsValue) ||
    columnsValue.length > LAYOUT_PERSISTENCE_LIMITS.columnsPerContext ||
    !isIdentifier(activityId) ||
    !isIdentifier(desktopId) ||
    !isIdentifier(outputId) ||
    frame === null
  ) {
    return null;
  }

  const contextKey = `${activityId}\u0000${outputId}\u0000${desktopId}`;
  if (state.contextKeys.has(contextKey)) {
    return null;
  }
  state.contextKeys.add(contextKey);

  const context = Object.freeze({
    activityId,
    desktopId,
    outputId,
    rowIndex,
  });
  if (columnsValue.length === 0) {
    return Object.freeze({
      bottom: frame.bottom,
      emptyTarget: Object.freeze({ kind: "empty-row", ...context }),
      left: frame.left,
      right: frame.right,
      top: frame.top,
      zones: Object.freeze([]),
    });
  }

  const columns: ParsedColumn[] = [];
  let previousRight = Number.NEGATIVE_INFINITY;

  for (const columnValue of columnsValue) {
    const column = buildColumnPlan(columnValue, context, frame, state);

    if (column === null || column.frame.left < previousRight) {
      return null;
    }

    columns.push(column);
    previousRight = column.frame.right;
  }

  const zones = buildHorizontalZones(columns, context, frame);
  return zones === null
    ? null
    : Object.freeze({
        bottom: frame.bottom,
        emptyTarget: null,
        left: frame.left,
        right: frame.right,
        top: frame.top,
        zones,
      });
}

function buildColumnPlan(
  value: unknown,
  context: OverviewSpatialWindowDropTargetContext,
  rowFrame: GeometryRect,
  state: BuildState,
): ParsedColumn | null {
  const candidate = record(value);

  if (candidate === null) {
    return null;
  }

  const frame = readRect(candidate["frame"]);
  const membersValue = candidate["members"];

  if (
    frame === null ||
    !rectContainsRect(rowFrame, frame) ||
    !Array.isArray(membersValue) ||
    membersValue.length === 0 ||
    membersValue.length > LAYOUT_PERSISTENCE_LIMITS.membersPerColumn ||
    state.totalWindowCount + membersValue.length >
      LAYOUT_PERSISTENCE_LIMITS.windows
  ) {
    return null;
  }

  const members: OverviewSpatialWindowDropMemberPlan[] = [];
  let previousBottom = Number.NEGATIVE_INFINITY;

  for (const memberValue of membersValue) {
    const member = buildMemberPlan(memberValue, context, frame, state);

    if (member === null || member.top < previousBottom) {
      return null;
    }

    members.push(member);
    previousBottom = member.bottom;
  }

  state.totalWindowCount += members.length;
  const firstMember = members[0];

  if (firstMember === undefined) {
    return null;
  }

  return {
    anchorWindowId: firstMember.beforeTarget.targetWindowId,
    frame,
    members: Object.freeze(members),
  };
}

function buildMemberPlan(
  value: unknown,
  context: OverviewSpatialWindowDropTargetContext,
  columnFrame: GeometryRect,
  state: BuildState,
): OverviewSpatialWindowDropMemberPlan | null {
  const candidate = record(value);

  if (candidate === null) {
    return null;
  }

  const windowId = candidate["windowId"];
  const frame = readRect(candidate["frame"]);

  if (
    !isIdentifier(windowId) ||
    state.windowIds.has(windowId) ||
    frame === null ||
    !rectContainsRect(columnFrame, frame)
  ) {
    return null;
  }

  const split = frame.top + (frame.bottom - frame.top) / 2;
  if (!isBoundedCoordinate(split)) {
    return null;
  }

  state.windowIds.add(windowId);

  return Object.freeze({
    afterTarget: Object.freeze({
      ...context,
      kind: "stack-insertion",
      position: "after",
      targetWindowId: windowId,
    }),
    beforeTarget: Object.freeze({
      ...context,
      kind: "stack-insertion",
      position: "before",
      targetWindowId: windowId,
    }),
    bottom: frame.bottom,
    left: frame.left,
    right: frame.right,
    split,
    top: frame.top,
  });
}

function buildHorizontalZones(
  columns: readonly ParsedColumn[],
  context: OverviewSpatialWindowDropTargetContext,
  rowFrame: GeometryRect,
): readonly OverviewSpatialWindowDropHorizontalZone[] | null {
  const first = columns[0];

  if (first === undefined) {
    return null;
  }

  const zones: OverviewSpatialWindowDropHorizontalZone[] = [];
  if (rowFrame.left < first.frame.left) {
    zones.push(
      boundaryZone(
        rowFrame.left,
        first.frame.left,
        context,
        "before",
        first.anchorWindowId,
      ),
    );
  }

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];

    if (column === undefined) {
      return null;
    }

    zones.push(
      Object.freeze({
        bottom: column.frame.bottom,
        kind: "column",
        left: column.frame.left,
        members: column.members,
        right: column.frame.right,
        top: column.frame.top,
      }),
    );

    const next = columns[index + 1];
    if (next !== undefined && column.frame.right < next.frame.left) {
      zones.push(
        boundaryZone(
          column.frame.right,
          next.frame.left,
          context,
          "after",
          column.anchorWindowId,
        ),
      );
    }
  }

  const last = columns[columns.length - 1];
  if (last === undefined) {
    return null;
  }

  if (last.frame.right < rowFrame.right) {
    zones.push(
      boundaryZone(
        last.frame.right,
        rowFrame.right,
        context,
        "after",
        last.anchorWindowId,
      ),
    );
  }

  return Object.freeze(zones);
}

function boundaryZone(
  left: number,
  right: number,
  context: OverviewSpatialWindowDropTargetContext,
  position: "after" | "before",
  targetWindowId: string,
): OverviewSpatialWindowDropBoundaryZone {
  return Object.freeze({
    kind: "boundary",
    left,
    right,
    target: Object.freeze({
      ...context,
      kind: "column-boundary",
      position,
      targetWindowId,
    }),
  });
}

function findRow(
  rows: readonly unknown[],
  y: number,
): OverviewSpatialWindowDropRowPlan | null {
  let low = 0;
  let high = rows.length - 1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const row = rows[middle] as OverviewSpatialWindowDropRowPlan | undefined;

    if (row === undefined || !validRowPlanBoundary(row)) {
      return null;
    }

    if (y < row.top) {
      high = middle - 1;
    } else if (y >= row.bottom) {
      low = middle + 1;
    } else {
      return row;
    }
  }

  return null;
}

function findHorizontalZone(
  zones: readonly OverviewSpatialWindowDropHorizontalZone[],
  x: number,
): OverviewSpatialWindowDropHorizontalZone | null {
  let low = 0;
  let high = zones.length - 1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const zone = zones[middle];

    if (zone === undefined || !validHorizontalZoneBoundary(zone)) {
      return null;
    }

    if (x < zone.left) {
      high = middle - 1;
    } else if (x >= zone.right) {
      low = middle + 1;
    } else {
      return zone;
    }
  }

  return null;
}

function findMember(
  members: readonly OverviewSpatialWindowDropMemberPlan[],
  y: number,
): OverviewSpatialWindowDropMemberPlan | null {
  let low = 0;
  let high = members.length - 1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const member = members[middle];

    if (member === undefined || !validMemberPlanBoundary(member)) {
      return null;
    }

    if (y < member.top) {
      high = middle - 1;
    } else if (y >= member.bottom) {
      low = middle + 1;
    } else {
      return member;
    }
  }

  return null;
}

function validRowPlanBoundary(
  value: OverviewSpatialWindowDropRowPlan,
): boolean {
  return (
    Object.isFrozen(value) &&
    isBoundedCoordinate(value.left) &&
    isBoundedCoordinate(value.right) &&
    value.right > value.left &&
    isBoundedCoordinate(value.top) &&
    isBoundedCoordinate(value.bottom) &&
    value.bottom > value.top &&
    Array.isArray(value.zones) &&
    Object.isFrozen(value.zones)
  );
}

function validHorizontalZoneBoundary(
  value: OverviewSpatialWindowDropHorizontalZone,
): boolean {
  return (
    Object.isFrozen(value) &&
    isBoundedCoordinate(value.left) &&
    isBoundedCoordinate(value.right) &&
    value.right > value.left
  );
}

function validMemberPlanBoundary(
  value: OverviewSpatialWindowDropMemberPlan,
): boolean {
  return (
    Object.isFrozen(value) &&
    isBoundedCoordinate(value.left) &&
    isBoundedCoordinate(value.right) &&
    value.right > value.left &&
    isBoundedCoordinate(value.top) &&
    isBoundedCoordinate(value.bottom) &&
    value.bottom > value.top &&
    isBoundedCoordinate(value.split) &&
    value.split > value.top &&
    value.split < value.bottom
  );
}

function readRect(value: unknown): GeometryRect | null {
  const candidate = record(value);

  if (candidate === null) {
    return null;
  }

  const height = candidate["height"];
  const width = candidate["width"];
  const x = candidate["x"];
  const y = candidate["y"];

  if (
    !isBoundedCoordinate(x) ||
    !isBoundedCoordinate(y) ||
    !isPositiveBoundedExtent(width) ||
    !isPositiveBoundedExtent(height)
  ) {
    return null;
  }

  const right = x + width;
  const bottom = y + height;

  return isBoundedCoordinate(right) && isBoundedCoordinate(bottom)
    ? {
        bottom: normalizeZero(bottom),
        left: normalizeZero(x),
        right: normalizeZero(right),
        top: normalizeZero(y),
      }
    : null;
}

function rectContainsRect(outer: GeometryRect, inner: GeometryRect): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

function record(value: unknown): Record<PropertyKey, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<PropertyKey, unknown>)
    : null;
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

function isBoundedPoint(
  value: unknown,
): value is OverviewSpatialWindowDropPoint {
  const candidate = record(value);

  return (
    candidate !== null &&
    isBoundedCoordinate(candidate["x"]) &&
    isBoundedCoordinate(candidate["y"])
  );
}

function isBoundedCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_GEOMETRY_MAGNITUDE
  );
}

function isPositiveBoundedExtent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAXIMUM_GEOMETRY_MAGNITUDE
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
