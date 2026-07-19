import {
  solveStripGeometry,
  type Rect,
  type WindowHeightBounds,
} from "../core/geometry";
import {
  activityId,
  columnId,
  desktopId,
  outputId,
  windowId,
} from "../core/ids";
import type {
  ColumnPresentation,
  ColumnWidth,
  LayoutColumnSnapshot,
  LayoutContextSnapshot,
  WindowHeight,
} from "../core/layout-engine";
import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";
import { resolveWindowHeightPresetPolicy } from "../window-height-presets";

export interface OverviewSpatialRowGeometryInput {
  readonly activeColumnIndex: number | null;
  readonly alwaysCenterSingleColumn: boolean;
  readonly columns: readonly OverviewSpatialRowGeometryColumnInput[];
  readonly devicePixelRatio: number;
  readonly gap: number;
  readonly outputGeometry: Rect;
  readonly viewportOffset: number;
  readonly windowHeightBounds?: readonly OverviewSpatialRowWindowHeightBoundsInput[];
  readonly workArea: Rect;
}

export interface OverviewSpatialRowWindowHeightBoundsInput {
  readonly decorationHeight: number;
  readonly maximumClientHeight: number;
  readonly minimumClientHeight: number;
  readonly windowId: string;
}

export interface OverviewSpatialRowGeometryColumnInput {
  readonly members: readonly OverviewSpatialRowGeometryMemberInput[];
  readonly presentation: ColumnPresentation;
  readonly selectedMemberIndex: number;
  readonly width: ColumnWidth;
}

export interface OverviewSpatialRowGeometryMemberInput {
  readonly height?: WindowHeight;
  readonly windowId: string;
}

export interface OverviewSpatialRowColumnFrame {
  readonly columnId: string;
  readonly columnIndex: number;
  readonly contentX: number;
  readonly width: number;
}

export interface OverviewSpatialRowCamera {
  readonly base: number;
  readonly maximum: number;
  readonly minimum: number;
}

export interface OverviewSpatialRowDimensions {
  readonly devicePixelRatio: number;
  readonly outputHeight: number;
  readonly outputWidth: number;
  readonly viewportHeight: number;
  readonly viewportInsetX: number;
  readonly viewportInsetY: number;
  readonly viewportWidth: number;
}

export interface OverviewSpatialRowWindowFrame {
  readonly columnId: string;
  readonly columnIndex: number;
  readonly height: number;
  readonly memberIndex: number;
  readonly width: number;
  readonly windowId: string;
  readonly x: number;
  readonly y: number;
}

export interface OverviewSpatialRowGeometryPlan {
  readonly camera: OverviewSpatialRowCamera;
  readonly columnFrames: readonly OverviewSpatialRowColumnFrame[];
  readonly contentWidth: number;
  readonly dimensions: OverviewSpatialRowDimensions;
  readonly windowFrames: readonly OverviewSpatialRowWindowFrame[];
}

export interface OverviewSpatialLiveCameraInput {
  readonly camera: {
    readonly maximum: number;
    readonly minimum: number;
  };
  readonly columnFrame: {
    readonly contentX: number;
    readonly width: number;
  };
  readonly devicePixelRatio: number;
  readonly liveFrame: {
    readonly width: number;
    readonly x: number;
  };
  readonly workAreaX: number;
}

export interface OverviewSpatialLiveCameraPlan {
  readonly viewportOffset: number;
}

const OVERVIEW_ACTIVITY_ID = activityId("overview-activity");
const OVERVIEW_DESKTOP_ID = desktopId("overview-desktop");
const OVERVIEW_OUTPUT_ID = outputId("overview-output");
const MAXIMUM_GEOMETRY_MAGNITUDE = LAYOUT_PERSISTENCE_LIMITS.numericMagnitude;
const DEFAULT_WINDOW_HEIGHT: WindowHeight = Object.freeze({
  kind: "auto",
  weight: 1,
});

export function planOverviewSpatialLiveCamera(
  input: unknown,
): OverviewSpatialLiveCameraPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const camera = input["camera"];
    const columnFrame = input["columnFrame"];
    const devicePixelRatio = input["devicePixelRatio"];
    const liveFrame = input["liveFrame"];
    const workAreaX = input["workAreaX"];

    if (
      !isRecord(camera) ||
      !isRecord(columnFrame) ||
      !isPositiveBoundedNumber(devicePixelRatio) ||
      !isRecord(liveFrame) ||
      !isBoundedNumber(workAreaX)
    ) {
      return null;
    }

    const maximum = camera["maximum"];
    const minimum = camera["minimum"];
    const contentX = columnFrame["contentX"];
    const plannedWidth = columnFrame["width"];
    const liveWidth = liveFrame["width"];
    const liveX = liveFrame["x"];

    if (
      !isBoundedNumber(maximum) ||
      !isBoundedNumber(minimum) ||
      minimum > maximum ||
      !isBoundedNumber(contentX) ||
      !isPositiveBoundedNumber(plannedWidth) ||
      !isPositiveBoundedNumber(liveWidth) ||
      !isBoundedNumber(liveX) ||
      !isPixelGridAligned(minimum, devicePixelRatio) ||
      !isPixelGridAligned(maximum, devicePixelRatio)
    ) {
      return null;
    }

    const plannedPhysicalWidth = plannedWidth * devicePixelRatio;
    const livePhysicalWidth = liveWidth * devicePixelRatio;
    const physicalWidthDifference =
      Math.abs(plannedWidth - liveWidth) * devicePixelRatio;
    const physicalWidthTolerance = floatingPointTolerance(
      plannedPhysicalWidth,
      livePhysicalWidth,
    );

    if (
      !Number.isFinite(plannedPhysicalWidth) ||
      !Number.isFinite(livePhysicalWidth) ||
      !Number.isFinite(physicalWidthDifference) ||
      physicalWidthDifference > 1 + physicalWidthTolerance
    ) {
      return null;
    }

    const inferredOffset = workAreaX + contentX - liveX;

    if (!isBoundedNumber(inferredOffset)) {
      return null;
    }

    const boundaryTolerance =
      0.5 / devicePixelRatio +
      floatingPointTolerance(inferredOffset, minimum, maximum);

    if (
      inferredOffset < minimum - boundaryTolerance ||
      inferredOffset > maximum + boundaryTolerance
    ) {
      return null;
    }

    const snappedOffset = snapToPixelGrid(inferredOffset, devicePixelRatio);

    if (!isBoundedNumber(snappedOffset)) {
      return null;
    }

    const viewportOffset = Math.min(maximum, Math.max(minimum, snappedOffset));

    return Object.freeze({ viewportOffset: normalizeZero(viewportOffset) });
  } catch {
    return null;
  }
}

export function planOverviewSpatialRowGeometry(
  input: unknown,
): OverviewSpatialRowGeometryPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const columns = readColumns(input["columns"]);
    const activeColumnIndex = input["activeColumnIndex"];
    const alwaysCenterSingleColumn = input["alwaysCenterSingleColumn"];
    const devicePixelRatio = input["devicePixelRatio"];
    const gap = input["gap"];
    const outputGeometry = readRect(input["outputGeometry"]);
    const viewportOffset = input["viewportOffset"];
    const windowHeightBounds = readWindowHeightBounds(
      input["windowHeightBounds"],
      columns ?? [],
    );
    const workArea = readRect(input["workArea"]);

    if (
      columns === null ||
      !isActiveColumnIndex(activeColumnIndex, columns.length) ||
      typeof alwaysCenterSingleColumn !== "boolean" ||
      !isPositiveBoundedNumber(devicePixelRatio) ||
      !isNonNegativeBoundedNumber(gap) ||
      outputGeometry === null ||
      !isBoundedNumber(viewportOffset) ||
      windowHeightBounds === null ||
      workArea === null ||
      !rectContains(outputGeometry, workArea)
    ) {
      return null;
    }

    const context = createSolverContext(
      columns,
      activeColumnIndex,
      viewportOffset,
    );
    const solved = solveStripGeometry({
      centerSingleColumn: alwaysCenterSingleColumn,
      context,
      devicePixelRatio,
      gap,
      pixelGridOrigin: {
        x: outputGeometry.x,
        y: outputGeometry.y,
      },
      windowHeightBounds,
      windowHeightPresetResolver: resolveWindowHeightPresetPolicy,
      workArea,
    });

    const memberCount = columns.reduce(
      (count, column) => count + column.members.length,
      0,
    );

    if (
      !isNonNegativeBoundedNumber(solved.stripWidth) ||
      !isBoundedNumber(solved.viewportOffset) ||
      !isNonNegativeBoundedNumber(solved.maxViewportOffset) ||
      solved.windows.length !== memberCount
    ) {
      return null;
    }

    const columnFrames: OverviewSpatialRowColumnFrame[] = [];
    const windowFrames: OverviewSpatialRowWindowFrame[] = [];
    let solvedWindowIndex = 0;

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const expectedColumnId = solverColumnId(columnIndex);

      if (column === undefined) {
        return null;
      }

      let columnContentX: number | null = null;
      let columnWidth: number | null = null;

      for (
        let memberIndex = 0;
        memberIndex < column.members.length;
        memberIndex += 1
      ) {
        const member = column.members[memberIndex];
        const solvedWindow = solved.windows[solvedWindowIndex];

        if (
          member === undefined ||
          solvedWindow === undefined ||
          solvedWindow.columnId !== expectedColumnId ||
          solvedWindow.windowId !== member.windowId ||
          !rectIsBounded(solvedWindow.frame)
        ) {
          return null;
        }

        const contentX =
          solvedWindow.frame.x - workArea.x + solved.viewportOffset;
        const localX =
          solvedWindow.frame.x - outputGeometry.x + solved.viewportOffset;
        const localY = solvedWindow.frame.y - outputGeometry.y;

        if (
          !isBoundedNumber(contentX) ||
          !isBoundedNumber(localX) ||
          !isBoundedNumber(localY) ||
          !isBoundedNumber(localX + solvedWindow.frame.width) ||
          !isBoundedNumber(localY + solvedWindow.frame.height)
        ) {
          return null;
        }

        if (columnContentX === null) {
          columnContentX = contentX;
          columnWidth = solvedWindow.frame.width;
        } else if (
          contentX !== columnContentX ||
          solvedWindow.frame.width !== columnWidth
        ) {
          return null;
        }

        windowFrames.push(
          Object.freeze({
            columnId: expectedColumnId,
            columnIndex,
            height: solvedWindow.frame.height,
            memberIndex,
            width: solvedWindow.frame.width,
            windowId: member.windowId,
            x: normalizeZero(localX),
            y: normalizeZero(localY),
          }),
        );
        solvedWindowIndex += 1;
      }

      if (columnContentX === null || columnWidth === null) {
        return null;
      }

      columnFrames.push(
        Object.freeze({
          columnId: expectedColumnId,
          columnIndex,
          contentX: normalizeZero(columnContentX),
          width: columnWidth,
        }),
      );
    }

    if (solvedWindowIndex !== solved.windows.length) {
      return null;
    }

    const lockCenteredSingleton =
      alwaysCenterSingleColumn && columns.length === 1;
    const cameraMinimum = lockCenteredSingleton
      ? solved.viewportOffset
      : Math.min(0, solved.viewportOffset);
    const cameraMaximum = lockCenteredSingleton
      ? solved.viewportOffset
      : Math.max(solved.maxViewportOffset, solved.viewportOffset);
    const viewportInsetX = workArea.x - outputGeometry.x;
    const viewportInsetY = workArea.y - outputGeometry.y;

    if (
      !isBoundedNumber(cameraMinimum) ||
      !isBoundedNumber(cameraMaximum) ||
      cameraMinimum > cameraMaximum ||
      !isNonNegativeBoundedNumber(viewportInsetX) ||
      !isNonNegativeBoundedNumber(viewportInsetY)
    ) {
      return null;
    }

    return Object.freeze({
      camera: Object.freeze({
        base: normalizeZero(solved.viewportOffset),
        maximum: normalizeZero(cameraMaximum),
        minimum: normalizeZero(cameraMinimum),
      }),
      columnFrames: Object.freeze(columnFrames),
      contentWidth: normalizeZero(solved.stripWidth),
      dimensions: Object.freeze({
        devicePixelRatio,
        outputHeight: outputGeometry.height,
        outputWidth: outputGeometry.width,
        viewportHeight: workArea.height,
        viewportInsetX: normalizeZero(viewportInsetX),
        viewportInsetY: normalizeZero(viewportInsetY),
        viewportWidth: workArea.width,
      }),
      windowFrames: Object.freeze(windowFrames),
    });
  } catch {
    return null;
  }
}

function readWindowHeightBounds(
  value: unknown,
  columns: readonly OverviewSpatialRowGeometryColumnInput[],
): ReadonlyMap<ReturnType<typeof windowId>, WindowHeightBounds> | null {
  const requiredWindowIds = new Set<string>();

  for (const column of columns) {
    const requiresBounds = column.members.some(
      (member) => member.height !== undefined,
    );

    for (const member of column.members) {
      if (requiresBounds) {
        requiredWindowIds.add(member.windowId);
      }
    }
  }

  if (value === undefined) {
    return requiredWindowIds.size === 0 ? new Map() : null;
  }

  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.windows
  ) {
    return null;
  }

  const bounds = new Map<ReturnType<typeof windowId>, WindowHeightBounds>();
  const suppliedWindowIds = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const id = candidate["windowId"];
    const decorationHeight = candidate["decorationHeight"];
    const minimumClientHeight = candidate["minimumClientHeight"];
    const maximumClientHeight = candidate["maximumClientHeight"];

    if (
      !isIdentifier(id) ||
      !requiredWindowIds.has(id) ||
      suppliedWindowIds.has(id) ||
      !isNonNegativeBoundedNumber(decorationHeight) ||
      !isNonNegativeBoundedNumber(minimumClientHeight) ||
      !isValidMaximumClientHeight(maximumClientHeight) ||
      (maximumClientHeight !== Number.POSITIVE_INFINITY &&
        maximumClientHeight > 0 &&
        maximumClientHeight < minimumClientHeight)
    ) {
      return null;
    }

    suppliedWindowIds.add(id);
    bounds.set(
      windowId(id),
      Object.freeze({
        decorationHeight,
        maximumClientHeight,
        minimumClientHeight,
      }),
    );
  }

  for (const id of requiredWindowIds) {
    if (!suppliedWindowIds.has(id)) {
      return null;
    }
  }

  return bounds;
}

function readColumns(
  value: unknown,
): readonly OverviewSpatialRowGeometryColumnInput[] | null {
  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.columnsPerContext
  ) {
    return null;
  }

  const columns: OverviewSpatialRowGeometryColumnInput[] = [];
  const windowIds = new Set<string>();
  let memberCount = 0;

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const width = readColumnWidth(candidate["width"]);
    const members = readMembers(candidate["members"], windowIds);
    const presentation = candidate["presentation"];
    const selectedMemberIndex = candidate["selectedMemberIndex"];

    if (
      width === null ||
      members === null ||
      (presentation !== "stacked" && presentation !== "tabbed") ||
      !isBoundedIndex(selectedMemberIndex, members.length)
    ) {
      return null;
    }

    memberCount += members.length;

    if (memberCount > LAYOUT_PERSISTENCE_LIMITS.windows) {
      return null;
    }

    columns.push(
      Object.freeze({ members, presentation, selectedMemberIndex, width }),
    );
  }

  return Object.freeze(columns);
}

function readMembers(
  value: unknown,
  windowIds: Set<string>,
): readonly OverviewSpatialRowGeometryMemberInput[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.membersPerColumn
  ) {
    return null;
  }

  const members: OverviewSpatialRowGeometryMemberInput[] = [];
  let nonAutomaticHeightCount = 0;

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const id = candidate["windowId"];
    const height = readWindowHeight(candidate["height"]);

    if (!isIdentifier(id) || windowIds.has(id) || height === null) {
      return null;
    }

    if (height !== undefined && height.kind !== "auto") {
      nonAutomaticHeightCount += 1;

      if (nonAutomaticHeightCount > 1) {
        return null;
      }
    }

    windowIds.add(id);
    members.push(
      Object.freeze({
        ...(height === undefined ? {} : { height }),
        windowId: id,
      }),
    );
  }

  return Object.freeze(members);
}

function readWindowHeight(value: unknown): WindowHeight | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    return null;
  }

  switch (value["kind"]) {
    case "auto":
      return isPositiveBoundedNumber(value["weight"])
        ? Object.freeze({ kind: "auto", weight: value["weight"] })
        : null;
    case "fixed":
      return isPositiveBoundedNumber(value["clientHeight"])
        ? Object.freeze({
            clientHeight: value["clientHeight"],
            kind: "fixed",
          })
        : null;
    case "preset":
      return isBoundedIndex(
        value["index"],
        LAYOUT_PERSISTENCE_LIMITS.presetIndex + 1,
      )
        ? Object.freeze({ index: value["index"], kind: "preset" })
        : null;
    default:
      return null;
  }
}

function readColumnWidth(value: unknown): ColumnWidth | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value["kind"];
  const width = value["value"];

  if (
    (kind !== "fixed" && kind !== "proportion") ||
    !isPositiveBoundedNumber(width)
  ) {
    return null;
  }

  return Object.freeze({ kind, value: width });
}

function createSolverContext(
  columns: readonly OverviewSpatialRowGeometryColumnInput[],
  activeColumnIndex: number | null,
  viewportOffset: number,
): LayoutContextSnapshot {
  const solverColumns: LayoutColumnSnapshot[] = columns.map(
    (column, columnIndex) => {
      const id = solverColumnId(columnIndex);
      const windowIds = column.members.map((member) =>
        windowId(member.windowId),
      );
      const hasExplicitWindowHeight = column.members.some(
        (member) => member.height !== undefined,
      );
      const windowHeights = hasExplicitWindowHeight
        ? column.members.map((member) => member.height ?? DEFAULT_WINDOW_HEIGHT)
        : undefined;
      const selectedWindowId = windowIds[column.selectedMemberIndex];

      if (selectedWindowId === undefined) {
        throw new RangeError("selected window index is invalid");
      }

      return Object.freeze({
        id,
        presentation: column.presentation,
        selectedWindowId,
        width: column.width,
        ...(windowHeights === undefined
          ? {}
          : { windowHeights: Object.freeze(windowHeights) }),
        windowIds: Object.freeze(windowIds),
      });
    },
  );

  return {
    activeColumnId:
      activeColumnIndex === null ? null : solverColumnId(activeColumnIndex),
    activityId: OVERVIEW_ACTIVITY_ID,
    columns: solverColumns,
    desktopId: OVERVIEW_DESKTOP_ID,
    outputId: OVERVIEW_OUTPUT_ID,
    viewportOffset,
  };
}

function rectIsBounded(rect: Rect): boolean {
  return (
    isBoundedNumber(rect.x) &&
    isBoundedNumber(rect.y) &&
    isPositiveBoundedNumber(rect.width) &&
    isPositiveBoundedNumber(rect.height) &&
    isBoundedNumber(rect.x + rect.width) &&
    isBoundedNumber(rect.y + rect.height)
  );
}

function solverColumnId(index: number): ReturnType<typeof columnId> {
  return columnId(`overview-column-${String(index)}`);
}

function readRect(value: unknown): Rect | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = value["x"];
  const y = value["y"];
  const width = value["width"];
  const height = value["height"];

  if (
    !isBoundedNumber(x) ||
    !isBoundedNumber(y) ||
    !isPositiveBoundedNumber(width) ||
    !isPositiveBoundedNumber(height)
  ) {
    return null;
  }

  return Object.freeze({ height, width, x, y });
}

function isActiveColumnIndex(
  value: unknown,
  columnCount: number,
): value is number | null {
  return (
    value === null ||
    (columnCount > 0 &&
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value < columnCount)
  );
}

function isBoundedIndex(
  value: unknown,
  exclusiveMaximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < exclusiveMaximum
  );
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

function rectContains(outer: Rect, inner: Rect): boolean {
  const outerRight = outer.x + outer.width;
  const outerBottom = outer.y + outer.height;
  const innerRight = inner.x + inner.width;
  const innerBottom = inner.y + inner.height;

  return (
    isBoundedNumber(outerRight) &&
    isBoundedNumber(outerBottom) &&
    isBoundedNumber(innerRight) &&
    isBoundedNumber(innerBottom) &&
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    innerRight <= outerRight &&
    innerBottom <= outerBottom
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_GEOMETRY_MAGNITUDE
  );
}

function isNonNegativeBoundedNumber(value: unknown): value is number {
  return isBoundedNumber(value) && value >= 0;
}

function isPositiveBoundedNumber(value: unknown): value is number {
  return isBoundedNumber(value) && value > 0;
}

function isValidMaximumClientHeight(value: unknown): value is number {
  return (
    value === Number.POSITIVE_INFINITY || isNonNegativeBoundedNumber(value)
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function snapToPixelGrid(value: number, devicePixelRatio: number): number {
  return Math.round(value * devicePixelRatio) / devicePixelRatio;
}

function isPixelGridAligned(value: number, devicePixelRatio: number): boolean {
  const physicalValue = value * devicePixelRatio;

  return (
    Number.isFinite(physicalValue) &&
    Math.abs(physicalValue - Math.round(physicalValue)) <=
      floatingPointTolerance(physicalValue)
  );
}

function floatingPointTolerance(...values: readonly number[]): number {
  let magnitude = 1;

  for (const value of values) {
    magnitude = Math.max(magnitude, Math.abs(value));
  }

  return Number.EPSILON * magnitude * 16;
}
