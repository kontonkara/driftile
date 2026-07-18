export interface OverviewSpatialWheelInput {
  readonly angleDeltaY: number;
  readonly contentHeight: number;
  readonly contentY: number;
  readonly pixelDeltaY: number;
  readonly remainder: number;
  readonly sceneHeight: number;
}

export type OverviewSpatialWheelDirection = "next" | "previous";

export interface OverviewSpatialWorkspaceWheelPlan {
  readonly contentY: number;
  readonly direction: OverviewSpatialWheelDirection | null;
  readonly intent: "workspace";
  readonly remainder: number;
  readonly steps: number;
}

export interface OverviewSpatialViewportWheelPlan {
  readonly contentY: number;
  readonly intent: "viewport";
  readonly remainder: 0;
}

export type OverviewSpatialWheelPlan =
  OverviewSpatialViewportWheelPlan | OverviewSpatialWorkspaceWheelPlan;

const ANGLE_DELTA_PER_STEP = 120;
const MAXIMUM_STEPS_PER_EVENT = 4;
const MAXIMUM_ANGLE_DELTA_PER_EVENT =
  ANGLE_DELTA_PER_STEP * MAXIMUM_STEPS_PER_EVENT;
const MAXIMUM_PIXEL_DELTA_PER_EVENT = 4_096;
const MAXIMUM_COORDINATE = Number.MAX_SAFE_INTEGER;

export function planOverviewSpatialWheel(
  input: unknown,
): OverviewSpatialWheelPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const angleDeltaY = input["angleDeltaY"];
    const contentHeight = input["contentHeight"];
    const contentY = input["contentY"];
    const pixelDeltaY = input["pixelDeltaY"];
    const remainder = input["remainder"];
    const sceneHeight = input["sceneHeight"];

    if (
      !isPositiveCoordinate(sceneHeight) ||
      !isPositiveCoordinate(contentHeight) ||
      contentHeight < sceneHeight ||
      !isCoordinate(contentY) ||
      !isAngleDelta(angleDeltaY) ||
      !isPixelDelta(pixelDeltaY) ||
      !isRemainder(remainder)
    ) {
      return null;
    }

    const maximumContentY = contentHeight - sceneHeight;
    const boundedContentY = clamp(contentY, 0, maximumContentY);

    if (pixelDeltaY !== 0) {
      return Object.freeze({
        contentY: moveViewport(boundedContentY, maximumContentY, pixelDeltaY),
        intent: "viewport",
        remainder: 0,
      });
    }

    if (angleDeltaY === 0) {
      return Object.freeze({
        contentY: normalizeZero(boundedContentY),
        direction: null,
        intent: "workspace",
        remainder: normalizeZero(remainder),
        steps: 0,
      });
    }

    const accumulated =
      remainder !== 0 && Math.sign(remainder) !== Math.sign(angleDeltaY)
        ? angleDeltaY
        : remainder + angleDeltaY;
    const steps = Math.min(
      Math.floor(Math.abs(accumulated) / ANGLE_DELTA_PER_STEP),
      MAXIMUM_STEPS_PER_EVENT,
    );
    const nextRemainder =
      accumulated - Math.sign(accumulated) * steps * ANGLE_DELTA_PER_STEP;

    return Object.freeze({
      contentY: normalizeZero(boundedContentY),
      direction: steps === 0 ? null : accumulated > 0 ? "previous" : "next",
      intent: "workspace",
      remainder: normalizeZero(nextRemainder),
      steps,
    });
  } catch {
    return null;
  }
}

function moveViewport(
  contentY: number,
  maximumContentY: number,
  pixelDeltaY: number,
): number {
  if (pixelDeltaY > 0) {
    return normalizeZero(contentY <= pixelDeltaY ? 0 : contentY - pixelDeltaY);
  }

  const distance = -pixelDeltaY;
  const remainingDistance = maximumContentY - contentY;

  return normalizeZero(
    remainingDistance <= distance ? maximumContentY : contentY + distance,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_COORDINATE
  );
}

function isPositiveCoordinate(value: unknown): value is number {
  return isCoordinate(value) && value > 0;
}

function isAngleDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAXIMUM_ANGLE_DELTA_PER_EVENT
  );
}

function isPixelDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_PIXEL_DELTA_PER_EVENT
  );
}

function isRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) < ANGLE_DELTA_PER_STEP
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
