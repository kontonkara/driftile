import type { Rect } from "../core/geometry";
import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialLiveGeometryInput {
  readonly columnIndex: number;
  readonly liveHeight: number;
  readonly liveWidth: number;
  readonly liveX: number;
  readonly liveY: number;
  readonly memberIndex: number;
  readonly outputHeight: number;
  readonly outputWidth: number;
  readonly outputX: number;
  readonly outputY: number;
  readonly projectionScale: number;
  readonly viewportOriginX: number;
  readonly viewportOriginY: number;
  readonly windowId: string;
}

export interface OverviewSpatialLiveGeometryFrame extends Rect {
  readonly floating: false;
}

export interface OverviewSpatialLiveGeometryPlan extends OverviewSpatialLiveGeometryFrame {
  readonly columnIndex: number;
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
    const liveHeight = input["liveHeight"];
    const liveWidth = input["liveWidth"];
    const liveX = input["liveX"];
    const liveY = input["liveY"];
    const memberIndex = input["memberIndex"];
    const outputHeight = input["outputHeight"];
    const outputWidth = input["outputWidth"];
    const outputX = input["outputX"];
    const outputY = input["outputY"];
    const projectionScale = input["projectionScale"];
    const viewportOriginX = input["viewportOriginX"];
    const viewportOriginY = input["viewportOriginY"];
    const windowId = input["windowId"];

    if (
      !isBoundedIndex(
        columnIndex,
        LAYOUT_PERSISTENCE_LIMITS.columnsPerContext,
      ) ||
      !isBoundedNumber(liveX) ||
      !isBoundedNumber(liveY) ||
      !isPositiveBoundedNumber(liveWidth) ||
      !isPositiveBoundedNumber(liveHeight) ||
      !isBoundedNumber(liveX + liveWidth) ||
      !isBoundedNumber(liveY + liveHeight) ||
      !isBoundedIndex(
        memberIndex,
        LAYOUT_PERSISTENCE_LIMITS.membersPerColumn,
      ) ||
      !isBoundedNumber(outputX) ||
      !isBoundedNumber(outputY) ||
      !isPositiveBoundedNumber(outputWidth) ||
      !isPositiveBoundedNumber(outputHeight) ||
      !isBoundedNumber(outputX + outputWidth) ||
      !isBoundedNumber(outputY + outputHeight) ||
      !isPositiveBoundedNumber(projectionScale) ||
      !isBoundedNumber(viewportOriginX) ||
      !isBoundedNumber(viewportOriginY) ||
      !isIdentifier(windowId) ||
      !rectIntersectsOutputEnvelope(
        liveX,
        liveY,
        liveWidth,
        liveHeight,
        outputX,
        outputY,
        outputWidth,
        outputHeight,
      )
    ) {
      return null;
    }

    const x = viewportOriginX + (liveX - outputX) * projectionScale;
    const y = viewportOriginY + (liveY - outputY) * projectionScale;
    const width = liveWidth * projectionScale;
    const height = liveHeight * projectionScale;

    if (
      !isBoundedNumber(x) ||
      !isBoundedNumber(y) ||
      !isPositiveBoundedNumber(width) ||
      !isPositiveBoundedNumber(height)
    ) {
      return null;
    }

    return Object.freeze({
      columnIndex,
      floating: false,
      height: normalizeZero(height),
      memberIndex,
      width: normalizeZero(width),
      windowId,
      x: normalizeZero(x),
      y: normalizeZero(y),
    });
  } catch {
    return null;
  }
}

function rectIntersectsOutputEnvelope(
  liveX: number,
  liveY: number,
  liveWidth: number,
  liveHeight: number,
  outputX: number,
  outputY: number,
  outputWidth: number,
  outputHeight: number,
) {
  const outputRight = outputX + outputWidth;
  const outputBottom = outputY + outputHeight;
  const liveRight = liveX + liveWidth;
  const liveBottom = liveY + liveHeight;
  const horizontalReach = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputWidth * HORIZONTAL_OUTPUT_ENVELOPE_SPANS,
  );
  const verticalReach = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputHeight * VERTICAL_OUTPUT_ENVELOPE_SPANS,
  );
  const envelopeLeft = Math.max(
    -MAXIMUM_GEOMETRY_MAGNITUDE,
    outputX - horizontalReach,
  );
  const envelopeRight = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputRight + horizontalReach,
  );
  const envelopeTop = Math.max(
    -MAXIMUM_GEOMETRY_MAGNITUDE,
    outputY - verticalReach,
  );
  const envelopeBottom = Math.min(
    MAXIMUM_GEOMETRY_MAGNITUDE,
    outputBottom + verticalReach,
  );

  return (
    liveRight > envelopeLeft &&
    liveX < envelopeRight &&
    liveBottom > envelopeTop &&
    liveY < envelopeBottom
  );
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
