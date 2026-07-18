export interface OverviewSpatialHorizontalWheelInput {
  readonly angleDeltaX: number;
  readonly maximumViewportOffset: number;
  readonly minimumViewportOffset: number;
  readonly pixelDeltaX: number;
  readonly pixelRemainder?: number;
  readonly projectionScale: number;
  readonly remainder: number;
  readonly viewportOffset: number;
}

export type OverviewSpatialHorizontalWheelDirection = "next" | "previous";

export interface OverviewSpatialHorizontalSelectionWheelPlan {
  readonly direction: OverviewSpatialHorizontalWheelDirection | null;
  readonly intent: "selection";
  readonly pixelRemainder: 0;
  readonly remainder: number;
  readonly steps: number;
  readonly viewportOffset: number;
}

export interface OverviewSpatialHorizontalViewportWheelPlan {
  readonly intent: "viewport";
  readonly pixelRemainder: number;
  readonly remainder: 0;
  readonly viewportOffset: number;
}

export type OverviewSpatialHorizontalWheelPlan =
  | OverviewSpatialHorizontalSelectionWheelPlan
  | OverviewSpatialHorizontalViewportWheelPlan;

const ANGLE_DELTA_PER_STEP = 120;
const MAXIMUM_STEPS_PER_EVENT = 4;
const MAXIMUM_ANGLE_DELTA_CONTRIBUTION =
  ANGLE_DELTA_PER_STEP * MAXIMUM_STEPS_PER_EVENT;
const MAXIMUM_ANGLE_DELTA_INPUT = 1_000_000;
const MAXIMUM_PIXEL_DELTA_PER_EVENT = 4_096;
const MAXIMUM_COORDINATE = Number.MAX_SAFE_INTEGER;
const SCENE_SCROLL_QUANTA_PER_UNIT = 64;
const SCENE_SCROLL_QUANTUM = 1 / SCENE_SCROLL_QUANTA_PER_UNIT;
const MAXIMUM_SCENE_DELTA_PER_EVENT =
  MAXIMUM_COORDINATE / SCENE_SCROLL_QUANTA_PER_UNIT;

export function planOverviewSpatialHorizontalWheel(
  input: unknown,
): OverviewSpatialHorizontalWheelPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const angleDeltaX = input["angleDeltaX"];
    const maximumViewportOffset = input["maximumViewportOffset"];
    const minimumViewportOffset = input["minimumViewportOffset"];
    const pixelDeltaX = input["pixelDeltaX"];
    const pixelRemainderValue = input["pixelRemainder"];
    const pixelRemainder =
      pixelRemainderValue === undefined ? 0 : pixelRemainderValue;
    const projectionScale = input["projectionScale"];
    const remainder = input["remainder"];
    const viewportOffset = input["viewportOffset"];

    if (
      !isAngleDelta(angleDeltaX) ||
      !isCoordinate(maximumViewportOffset) ||
      !isCoordinate(minimumViewportOffset) ||
      minimumViewportOffset > maximumViewportOffset ||
      !isPixelDelta(pixelDeltaX) ||
      !isPixelRemainder(pixelRemainder) ||
      !isProjectionScale(projectionScale) ||
      !isRemainder(remainder) ||
      !isCoordinate(viewportOffset) ||
      viewportOffset < minimumViewportOffset ||
      viewportOffset > maximumViewportOffset
    ) {
      return null;
    }

    const normalizedViewportOffset = normalizeZero(viewportOffset);

    if (pixelDeltaX !== 0) {
      const sceneDelta = pixelDeltaX / projectionScale;

      if (
        !Number.isFinite(sceneDelta) ||
        Math.abs(sceneDelta) > MAXIMUM_SCENE_DELTA_PER_EVENT
      ) {
        return null;
      }

      const accumulatedSceneDelta = accumulateDirectionalRemainder(
        sceneDelta,
        pixelRemainder,
      );

      if (
        !Number.isFinite(accumulatedSceneDelta) ||
        Math.abs(accumulatedSceneDelta) > MAXIMUM_SCENE_DELTA_PER_EVENT
      ) {
        return null;
      }

      const quantizedSceneDelta = quantizeSceneDelta(accumulatedSceneDelta);
      const nextViewportOffset = moveViewport(
        normalizedViewportOffset,
        minimumViewportOffset,
        maximumViewportOffset,
        quantizedSceneDelta,
      );
      const reachedBoundary =
        (accumulatedSceneDelta > 0 &&
          nextViewportOffset === minimumViewportOffset) ||
        (accumulatedSceneDelta < 0 &&
          nextViewportOffset === maximumViewportOffset);

      return Object.freeze({
        intent: "viewport",
        pixelRemainder: reachedBoundary
          ? 0
          : normalizeZero(accumulatedSceneDelta - quantizedSceneDelta),
        remainder: 0,
        viewportOffset: normalizeZero(nextViewportOffset),
      });
    }

    if (angleDeltaX === 0) {
      return Object.freeze({
        direction: null,
        intent: "selection",
        pixelRemainder: 0,
        remainder: normalizeZero(remainder),
        steps: 0,
        viewportOffset: normalizedViewportOffset,
      });
    }

    const boundedAngleDelta = clamp(
      angleDeltaX,
      -MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
      MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
    );
    const accumulatedAngleDelta = accumulateDirectionalRemainder(
      boundedAngleDelta,
      remainder,
    );
    const steps = Math.min(
      Math.floor(Math.abs(accumulatedAngleDelta) / ANGLE_DELTA_PER_STEP),
      MAXIMUM_STEPS_PER_EVENT,
    );
    const nextRemainder =
      accumulatedAngleDelta -
      Math.sign(accumulatedAngleDelta) * steps * ANGLE_DELTA_PER_STEP;

    return Object.freeze({
      direction:
        steps === 0 ? null : accumulatedAngleDelta > 0 ? "previous" : "next",
      intent: "selection",
      pixelRemainder: 0,
      remainder: normalizeZero(nextRemainder),
      steps,
      viewportOffset: normalizedViewportOffset,
    });
  } catch {
    return null;
  }
}

function accumulateDirectionalRemainder(
  delta: number,
  remainder: number,
): number {
  return remainder !== 0 && Math.sign(remainder) !== Math.sign(delta)
    ? delta
    : remainder + delta;
}

function moveViewport(
  viewportOffset: number,
  minimumViewportOffset: number,
  maximumViewportOffset: number,
  sceneDelta: number,
): number {
  if (sceneDelta > 0) {
    const availableDistance = viewportOffset - minimumViewportOffset;

    return sceneDelta >= availableDistance
      ? minimumViewportOffset
      : viewportOffset - sceneDelta;
  }

  if (sceneDelta < 0) {
    const availableDistance = maximumViewportOffset - viewportOffset;

    return -sceneDelta >= availableDistance
      ? maximumViewportOffset
      : viewportOffset - sceneDelta;
  }

  return viewportOffset;
}

function quantizeSceneDelta(value: number): number {
  return normalizeZero(
    Math.trunc(value * SCENE_SCROLL_QUANTA_PER_UNIT) /
      SCENE_SCROLL_QUANTA_PER_UNIT,
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

function isProjectionScale(value: unknown): value is number {
  return isCoordinate(value) && value > 0;
}

function isAngleDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAXIMUM_ANGLE_DELTA_INPUT
  );
}

function isPixelDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_PIXEL_DELTA_PER_EVENT
  );
}

function isPixelRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) < SCENE_SCROLL_QUANTUM
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
