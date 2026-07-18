import { solveStripGeometry, type Rect } from "../core/geometry";
import {
  activityId,
  columnId,
  desktopId,
  outputId,
  windowId,
} from "../core/ids";
import type {
  ColumnWidth,
  LayoutColumnSnapshot,
  LayoutContextSnapshot,
} from "../core/layout-engine";
import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialRowGeometryInput {
  readonly activeColumnIndex: number | null;
  readonly alwaysCenterSingleColumn: boolean;
  readonly columns: readonly OverviewSpatialRowGeometryColumnInput[];
  readonly devicePixelRatio: number;
  readonly gap: number;
  readonly outputGeometry: Rect;
  readonly viewportOffset: number;
  readonly workArea: Rect;
}

export interface OverviewSpatialRowGeometryColumnInput {
  readonly width: ColumnWidth;
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

export interface OverviewSpatialRowGeometryPlan {
  readonly camera: OverviewSpatialRowCamera;
  readonly columnFrames: readonly OverviewSpatialRowColumnFrame[];
  readonly contentWidth: number;
  readonly dimensions: OverviewSpatialRowDimensions;
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
    const workArea = readRect(input["workArea"]);

    if (
      columns === null ||
      !isActiveColumnIndex(activeColumnIndex, columns.length) ||
      typeof alwaysCenterSingleColumn !== "boolean" ||
      !isPositiveBoundedNumber(devicePixelRatio) ||
      !isNonNegativeBoundedNumber(gap) ||
      outputGeometry === null ||
      !isBoundedNumber(viewportOffset) ||
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
      workArea,
    });

    if (
      !isNonNegativeBoundedNumber(solved.stripWidth) ||
      !isBoundedNumber(solved.viewportOffset) ||
      !isNonNegativeBoundedNumber(solved.maxViewportOffset) ||
      solved.windows.length !== columns.length
    ) {
      return null;
    }

    const columnFrames: OverviewSpatialRowColumnFrame[] = [];

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const solvedWindow = solved.windows[columnIndex];
      const expectedColumnId = solverColumnId(columnIndex);

      if (
        solvedWindow === undefined ||
        solvedWindow.columnId !== expectedColumnId ||
        !isBoundedNumber(solvedWindow.frame.x) ||
        !isPositiveBoundedNumber(solvedWindow.frame.width)
      ) {
        return null;
      }

      const contentX =
        solvedWindow.frame.x - workArea.x + solved.viewportOffset;

      if (!isBoundedNumber(contentX)) {
        return null;
      }

      columnFrames.push(
        Object.freeze({
          columnId: expectedColumnId,
          columnIndex,
          contentX: normalizeZero(contentX),
          width: solvedWindow.frame.width,
        }),
      );
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
    });
  } catch {
    return null;
  }
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

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const width = readColumnWidth(candidate["width"]);

    if (width === null) {
      return null;
    }

    columns.push(Object.freeze({ width }));
  }

  return Object.freeze(columns);
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
      const memberId = windowId(`overview-window-${String(columnIndex)}`);

      return {
        id,
        presentation: "stacked",
        selectedWindowId: memberId,
        width: column.width,
        windowIds: [memberId],
      };
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
