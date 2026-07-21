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
  readonly hitBottom: number;
  readonly hitTop: number;
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
const PREFERRED_BOUNDARY_SNAP_BAND = 12;
const MAXIMUM_BOUNDARY_SNAP_FRACTION = 0.25;
const DEFAULT_HYSTERESIS_EXIT_MARGIN = 6;
const MAXIMUM_HYSTERESIS_EXIT_MARGIN = 24;

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
    const rows = readPlanRows(plan);
    const position = readPoint(point);
    if (rows === null || position === null) {
      return null;
    }

    return hitTestPlanRows(rows, position);
  } catch {
    return null;
  }
}

export function hitTestOverviewSpatialWindowDropWithHysteresis(
  plan: unknown,
  point: unknown,
  previousTarget: unknown,
  exitMargin: unknown = DEFAULT_HYSTERESIS_EXIT_MARGIN,
): OverviewSpatialWindowDropTarget | null {
  try {
    const rows = readPlanRows(plan);
    const position = readPoint(point);
    const margin = readHysteresisExitMargin(exitMargin);
    if (rows === null || position === null || margin === null) {
      return null;
    }

    if (previousTarget === null || previousTarget === undefined) {
      return hitTestPlanRows(rows, position);
    }
    if (!Object.isFrozen(previousTarget)) {
      return null;
    }

    const previousBounds = exactTargetHitBounds(rows, previousTarget);
    if (previousBounds === null) {
      return null;
    }

    return pointIsInsideExpandedRect(position, previousBounds, margin)
      ? (previousTarget as OverviewSpatialWindowDropTarget)
      : hitTestPlanRows(rows, position);
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

  const hitMembers = extendMemberHitZones(members, frame);
  if (hitMembers === null) {
    return null;
  }

  return {
    anchorWindowId: firstMember.beforeTarget.targetWindowId,
    frame,
    members: hitMembers,
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
    hitBottom: frame.bottom,
    hitTop: frame.top,
    left: frame.left,
    right: frame.right,
    split,
    top: frame.top,
  });
}

function extendMemberHitZones(
  members: readonly OverviewSpatialWindowDropMemberPlan[],
  columnFrame: GeometryRect,
): readonly OverviewSpatialWindowDropMemberPlan[] | null {
  const result: OverviewSpatialWindowDropMemberPlan[] = [];

  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    const previous = members[index - 1];
    const next = members[index + 1];
    if (member === undefined) {
      return null;
    }

    const hitTop = previous
      ? previous.bottom + (member.top - previous.bottom) / 2
      : columnFrame.top;
    const hitBottom = next
      ? member.bottom + (next.top - member.bottom) / 2
      : columnFrame.bottom;
    if (
      !isBoundedCoordinate(hitTop) ||
      !isBoundedCoordinate(hitBottom) ||
      hitTop > member.top ||
      hitBottom < member.bottom ||
      hitBottom <= hitTop
    ) {
      return null;
    }

    result.push(
      Object.freeze({
        ...member,
        hitBottom: normalizeZero(hitBottom),
        hitTop: normalizeZero(hitTop),
      }),
    );
  }

  return Object.freeze(result);
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

  const stackIntervals: GeometryRect[] = [];
  for (const column of columns) {
    const inset = Math.min(
      PREFERRED_BOUNDARY_SNAP_BAND,
      (column.frame.right - column.frame.left) * MAXIMUM_BOUNDARY_SNAP_FRACTION,
    );
    const left = normalizeZero(column.frame.left + inset);
    const right = normalizeZero(column.frame.right - inset);
    if (
      !isBoundedCoordinate(left) ||
      !isBoundedCoordinate(right) ||
      right <= left
    ) {
      return null;
    }
    stackIntervals.push({
      bottom: column.frame.bottom,
      left,
      right,
      top: column.frame.top,
    });
  }

  const firstStack = stackIntervals[0];
  if (firstStack === undefined || firstStack.left <= rowFrame.left) {
    return null;
  }

  const zones: OverviewSpatialWindowDropHorizontalZone[] = [
    boundaryZone(
      rowFrame.left,
      firstStack.left,
      context,
      "before",
      first.anchorWindowId,
    ),
  ];

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const stack = stackIntervals[index];

    if (column === undefined || stack === undefined) {
      return null;
    }

    zones.push(
      Object.freeze({
        bottom: column.frame.bottom,
        kind: "column",
        left: stack.left,
        members: column.members,
        right: stack.right,
        top: column.frame.top,
      }),
    );

    const next = columns[index + 1];
    const nextStack = stackIntervals[index + 1];
    if (next !== undefined && nextStack !== undefined) {
      zones.push(
        boundaryZone(
          stack.right,
          nextStack.left,
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

  const lastStack = stackIntervals[stackIntervals.length - 1];
  if (lastStack === undefined || lastStack.right >= rowFrame.right) {
    return null;
  }
  zones.push(
    boundaryZone(
      lastStack.right,
      rowFrame.right,
      context,
      "after",
      last.anchorWindowId,
    ),
  );

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

function readPlanRows(plan: unknown): readonly unknown[] | null {
  const candidate = record(plan);
  if (
    candidate === null ||
    candidate[planBrand] !== true ||
    !Object.isFrozen(candidate)
  ) {
    return null;
  }

  const rows = candidate["rows"];
  return Array.isArray(rows) && Object.isFrozen(rows) ? rows : null;
}

function readPoint(value: unknown): OverviewSpatialWindowDropPoint | null {
  const candidate = record(value);
  if (candidate === null) {
    return null;
  }

  const x = candidate["x"];
  const y = candidate["y"];
  return isBoundedCoordinate(x) && isBoundedCoordinate(y)
    ? { x: normalizeZero(x), y: normalizeZero(y) }
    : null;
}

function hitTestPlanRows(
  rows: readonly unknown[],
  point: OverviewSpatialWindowDropPoint,
): OverviewSpatialWindowDropTarget | null {
  const row = findRow(rows, point.y);
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
  if (member === null) {
    return null;
  }

  return point.y < member.split ? member.beforeTarget : member.afterTarget;
}

function readHysteresisExitMargin(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(
        MAXIMUM_HYSTERESIS_EXIT_MARGIN,
        Math.max(0, normalizeZero(value)),
      )
    : null;
}

function exactTargetHitBounds(
  rows: readonly unknown[],
  target: unknown,
): GeometryRect | null {
  const candidate = record(target);
  const rowIndex = candidate?.["rowIndex"];
  if (
    candidate === null ||
    !Object.isFrozen(candidate) ||
    !Number.isSafeInteger(rowIndex) ||
    (rowIndex as number) < 0 ||
    (rowIndex as number) >= rows.length
  ) {
    return null;
  }

  const row = rows[rowIndex as number] as
    OverviewSpatialWindowDropRowPlan | undefined;
  if (row === undefined || !validRowPlanBoundary(row)) {
    return null;
  }
  if (row.emptyTarget === target) {
    return {
      bottom: row.bottom,
      left: row.left,
      right: row.right,
      top: row.top,
    };
  }
  if (row.emptyTarget !== null) {
    return null;
  }

  for (const zone of row.zones) {
    if (!validHorizontalZoneBoundary(zone)) {
      return null;
    }
    if (zone.kind === "boundary") {
      if (zone.target === target) {
        return {
          bottom: row.bottom,
          left: zone.left,
          right: zone.right,
          top: row.top,
        };
      }
      continue;
    }
    if (!Object.isFrozen(zone.members)) {
      return null;
    }

    for (const member of zone.members) {
      if (!validMemberPlanBoundary(member)) {
        return null;
      }
      if (member.beforeTarget === target) {
        return {
          bottom: member.split,
          left: zone.left,
          right: zone.right,
          top: member.hitTop,
        };
      }
      if (member.afterTarget === target) {
        return {
          bottom: member.hitBottom,
          left: zone.left,
          right: zone.right,
          top: member.split,
        };
      }
    }
  }

  return null;
}

function pointIsInsideExpandedRect(
  point: OverviewSpatialWindowDropPoint,
  rect: GeometryRect,
  margin: number,
): boolean {
  const left = Math.max(-MAXIMUM_GEOMETRY_MAGNITUDE, rect.left - margin);
  const right = Math.min(MAXIMUM_GEOMETRY_MAGNITUDE, rect.right + margin);
  const top = Math.max(-MAXIMUM_GEOMETRY_MAGNITUDE, rect.top - margin);
  const bottom = Math.min(MAXIMUM_GEOMETRY_MAGNITUDE, rect.bottom + margin);
  return (
    point.x >= left && point.x < right && point.y >= top && point.y < bottom
  );
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

    if (y < member.hitTop) {
      high = middle - 1;
    } else if (y >= member.hitBottom) {
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
    isBoundedCoordinate(value.hitTop) &&
    isBoundedCoordinate(value.hitBottom) &&
    value.hitTop <= value.top &&
    value.hitBottom >= value.bottom &&
    value.hitBottom > value.hitTop &&
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

  return isBoundedCoordinate(right) &&
    isBoundedCoordinate(bottom) &&
    right > x &&
    bottom > y
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
