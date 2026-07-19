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

export interface OverviewSpatialLiveColumnGeometryInput {
  readonly columnIndex: number;
  readonly memberCount: number;
  readonly presentation?: "stacked" | "tabbed";
  readonly samples: readonly unknown[];
  readonly selectedMemberIndex?: number;
}

export interface OverviewSpatialLiveColumnGeometryPlan {
  readonly columnIndex: number;
  readonly memberFrames: readonly (OverviewSpatialLiveGeometryPlan | null)[];
  readonly selectedMemberIndex?: number;
  readonly width: number;
  readonly x: number;
}

interface OverviewSpatialLiveGeometrySample {
  readonly columnIndex: number;
  readonly floating: false;
  readonly height: number;
  readonly memberIndex: number;
  readonly width: number;
  readonly windowId: string;
  readonly x: number;
  readonly y: number;
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

export function aggregateOverviewSpatialLiveColumnGeometry(
  input: unknown,
): OverviewSpatialLiveColumnGeometryPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const columnIndex = input["columnIndex"];
    const memberCount = input["memberCount"];
    const presentationValue = input["presentation"];
    const presentation =
      presentationValue === undefined ? "stacked" : presentationValue;
    const samples = input["samples"];
    const selectedMemberIndex = input["selectedMemberIndex"];
    if (
      !isBoundedIndex(
        columnIndex,
        LAYOUT_PERSISTENCE_LIMITS.columnsPerContext,
      ) ||
      !isPositiveBoundedCount(
        memberCount,
        LAYOUT_PERSISTENCE_LIMITS.membersPerColumn,
      ) ||
      !Array.isArray(samples) ||
      (presentation !== "stacked" && presentation !== "tabbed") ||
      (presentation === "stacked" && samples.length !== memberCount)
    ) {
      return null;
    }

    let exactSelectedMemberIndex: number | undefined;
    if (presentation === "tabbed") {
      if (
        samples.length !== 1 ||
        !isBoundedIndex(selectedMemberIndex, memberCount)
      ) {
        return null;
      }
      exactSelectedMemberIndex = selectedMemberIndex;
    }

    const memberFrames: (OverviewSpatialLiveGeometryPlan | null)[] =
      presentation === "tabbed"
        ? Array<OverviewSpatialLiveGeometryPlan | null>(memberCount).fill(null)
        : [];
    let columnX: number | null = null;
    let columnWidth: number | null = null;
    for (const sample of samples) {
      const snapshot = readSpatialLiveGeometrySample(
        sample,
        columnIndex,
        memberCount,
      );
      if (snapshot === null) {
        return null;
      }

      const memberIndex = snapshot.memberIndex;
      if (
        presentation === "tabbed" &&
        memberIndex !== exactSelectedMemberIndex
      ) {
        return null;
      }
      if (
        memberFrames[memberIndex] !== undefined &&
        memberFrames[memberIndex] !== null
      ) {
        return null;
      }
      memberFrames[memberIndex] = Object.freeze({
        columnIndex: snapshot.columnIndex,
        floating: false,
        height: normalizeZero(snapshot.height),
        memberIndex,
        width: normalizeZero(snapshot.width),
        windowId: snapshot.windowId,
        x: normalizeZero(snapshot.x),
        y: normalizeZero(snapshot.y),
      });

      const x = snapshot.x;
      const width = snapshot.width;
      if (columnX === null) {
        columnX = x;
        columnWidth = width;
      } else if (x !== columnX || width !== columnWidth) {
        return null;
      }
    }

    if (
      columnX === null ||
      columnWidth === null ||
      memberFrames.length !== memberCount
    ) {
      return null;
    }

    const frozenMemberFrames = Object.freeze(memberFrames);
    if (presentation === "tabbed") {
      if (exactSelectedMemberIndex === undefined) {
        return null;
      }
      return Object.freeze({
        columnIndex,
        memberFrames: frozenMemberFrames,
        selectedMemberIndex: exactSelectedMemberIndex,
        width: normalizeZero(columnWidth),
        x: normalizeZero(columnX),
      });
    }

    return Object.freeze({
      columnIndex,
      memberFrames: frozenMemberFrames,
      width: normalizeZero(columnWidth),
      x: normalizeZero(columnX),
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

function isPositiveBoundedCount(
  value: unknown,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}

function readSpatialLiveGeometrySample(
  sample: unknown,
  columnIndex: number,
  memberCount: number,
): OverviewSpatialLiveGeometrySample | null {
  if (!isRecord(sample)) {
    return null;
  }

  const sampleColumnIndex = sample["columnIndex"];
  const floating = sample["floating"];
  const height = sample["height"];
  const memberIndex = sample["memberIndex"];
  const width = sample["width"];
  const windowId = sample["windowId"];
  const x = sample["x"];
  const y = sample["y"];
  if (
    sampleColumnIndex !== columnIndex ||
    floating !== false ||
    !isBoundedIndex(memberIndex, memberCount) ||
    !isBoundedNumber(x) ||
    !isBoundedNumber(y) ||
    !isPositiveBoundedNumber(width) ||
    !isPositiveBoundedNumber(height) ||
    !isBoundedNumber(x + width) ||
    !isBoundedNumber(y + height) ||
    !isIdentifier(windowId)
  ) {
    return null;
  }

  return {
    columnIndex: sampleColumnIndex,
    floating,
    height,
    memberIndex,
    width,
    windowId,
    x,
    y,
  };
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
