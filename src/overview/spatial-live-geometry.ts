import type { Rect } from "../core/geometry";
import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialLiveGeometryColumnFrame {
  readonly columnId: string;
  readonly columnIndex: number;
  readonly contentX: number;
  readonly width: number;
}

export interface OverviewSpatialLiveGeometryInput {
  readonly columnIndex: number;
  readonly liveFrame: Rect;
  readonly memberIndex: number;
  readonly outputFrame: Rect;
  readonly plannedColumnFrame: OverviewSpatialLiveGeometryColumnFrame;
  readonly projectionScale: number;
  readonly viewportOriginX: number;
  readonly viewportOriginY: number;
  readonly windowId: string;
}

export interface OverviewSpatialLiveGeometryFrame extends Rect {
  readonly floating: false;
}

export interface OverviewSpatialLiveGeometryPlan {
  readonly columnFrame: OverviewSpatialLiveGeometryColumnFrame;
  readonly columnIndex: number;
  readonly frame: OverviewSpatialLiveGeometryFrame;
  readonly memberIndex: number;
  readonly windowId: string;
}

const MAXIMUM_GEOMETRY_MAGNITUDE = LAYOUT_PERSISTENCE_LIMITS.numericMagnitude;
const HORIZONTAL_OUTPUT_ENVELOPE_SPANS =
  LAYOUT_PERSISTENCE_LIMITS.columnsPerContext + 1;
const VERTICAL_OUTPUT_ENVELOPE_SPANS = 2;

export function projectOverviewSpatialLiveGeometry(
  input: unknown,
): OverviewSpatialLiveGeometryPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const columnIndex = input["columnIndex"];
    const liveFrame = readRect(input["liveFrame"]);
    const memberIndex = input["memberIndex"];
    const outputFrame = readRect(input["outputFrame"]);
    const plannedColumnFrame = readColumnFrame(input["plannedColumnFrame"]);
    const projectionScale = input["projectionScale"];
    const viewportOriginX = input["viewportOriginX"];
    const viewportOriginY = input["viewportOriginY"];
    const windowId = input["windowId"];

    if (
      !isBoundedIndex(
        columnIndex,
        LAYOUT_PERSISTENCE_LIMITS.columnsPerContext,
      ) ||
      liveFrame === null ||
      !isBoundedIndex(
        memberIndex,
        LAYOUT_PERSISTENCE_LIMITS.membersPerColumn,
      ) ||
      outputFrame === null ||
      plannedColumnFrame === null ||
      plannedColumnFrame.columnIndex !== columnIndex ||
      plannedColumnFrame.columnId !== plannedColumnId(columnIndex) ||
      !isPositiveBoundedNumber(projectionScale) ||
      !isBoundedNumber(viewportOriginX) ||
      !isBoundedNumber(viewportOriginY) ||
      !isIdentifier(windowId) ||
      !rectIntersectsOutputEnvelope(liveFrame, outputFrame)
    ) {
      return null;
    }

    const x = viewportOriginX + (liveFrame.x - outputFrame.x) * projectionScale;
    const y = viewportOriginY + (liveFrame.y - outputFrame.y) * projectionScale;
    const width = liveFrame.width * projectionScale;
    const height = liveFrame.height * projectionScale;

    if (
      !isBoundedNumber(x) ||
      !isBoundedNumber(y) ||
      !isPositiveBoundedNumber(width) ||
      !isPositiveBoundedNumber(height)
    ) {
      return null;
    }

    return Object.freeze({
      columnFrame: plannedColumnFrame,
      columnIndex,
      frame: Object.freeze({
        floating: false,
        height: normalizeZero(height),
        width: normalizeZero(width),
        x: normalizeZero(x),
        y: normalizeZero(y),
      }),
      memberIndex,
      windowId,
    });
  } catch {
    return null;
  }
}

function readColumnFrame(
  value: unknown,
): OverviewSpatialLiveGeometryColumnFrame | null {
  if (!isRecord(value)) {
    return null;
  }

  const columnId = value["columnId"];
  const columnIndex = value["columnIndex"];
  const contentX = value["contentX"];
  const width = value["width"];

  if (
    !isIdentifier(columnId) ||
    !isBoundedIndex(columnIndex, LAYOUT_PERSISTENCE_LIMITS.columnsPerContext) ||
    !isBoundedNumber(contentX) ||
    !isPositiveBoundedNumber(width) ||
    !isBoundedNumber(contentX + width)
  ) {
    return null;
  }

  return Object.freeze({ columnId, columnIndex, contentX, width });
}

function readRect(value: unknown): Rect | null {
  if (!isRecord(value)) {
    return null;
  }

  const height = value["height"];
  const width = value["width"];
  const x = value["x"];
  const y = value["y"];

  if (
    !isPositiveBoundedNumber(height) ||
    !isPositiveBoundedNumber(width) ||
    !isBoundedNumber(x) ||
    !isBoundedNumber(y) ||
    !isBoundedNumber(x + width) ||
    !isBoundedNumber(y + height)
  ) {
    return null;
  }

  return Object.freeze({ height, width, x, y });
}

function rectIntersectsOutputEnvelope(liveFrame: Rect, outputFrame: Rect) {
  const outputRight = outputFrame.x + outputFrame.width;
  const outputBottom = outputFrame.y + outputFrame.height;
  const liveRight = liveFrame.x + liveFrame.width;
  const liveBottom = liveFrame.y + liveFrame.height;
  const horizontalReach = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputFrame.width * HORIZONTAL_OUTPUT_ENVELOPE_SPANS,
  );
  const verticalReach = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputFrame.height * VERTICAL_OUTPUT_ENVELOPE_SPANS,
  );
  const envelopeLeft = Math.max(
    -MAXIMUM_GEOMETRY_MAGNITUDE,
    outputFrame.x - horizontalReach,
  );
  const envelopeRight = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputRight + horizontalReach,
  );
  const envelopeTop = Math.max(
    -MAXIMUM_GEOMETRY_MAGNITUDE,
    outputFrame.y - verticalReach,
  );
  const envelopeBottom = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputBottom + verticalReach,
  );

  return (
    liveRight > envelopeLeft &&
    liveFrame.x < envelopeRight &&
    liveBottom > envelopeTop &&
    liveFrame.y < envelopeBottom
  );
}

function plannedColumnId(columnIndex: number): string {
  return `overview-column-${String(columnIndex)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  );
}

function isBoundedIndex(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < maximum
  );
}

function isBoundedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_GEOMETRY_MAGNITUDE
  );
}

function isPositiveBoundedNumber(value: unknown): value is number {
  return isBoundedNumber(value) && value > 0;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
