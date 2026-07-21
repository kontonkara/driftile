export interface OverviewTabRailWheelInput {
  readonly angleDelta: number;
  readonly angleRemainder: number;
  readonly currentIndex: number;
  readonly memberCount: number;
  readonly pixelDelta: number;
  readonly pixelRemainder: number;
}

export type OverviewTabRailWheelDirection = "next" | "previous";
export type OverviewTabRailWheelInputMode = "angle" | "pixel";

export interface OverviewTabRailWheelPlan {
  readonly angleRemainder: number;
  readonly consumed: true;
  readonly direction: OverviewTabRailWheelDirection | null;
  readonly inputMode: OverviewTabRailWheelInputMode;
  readonly moved: boolean;
  readonly pixelRemainder: number;
  readonly stepsApplied: number;
  readonly targetIndex: number;
}

const ANGLE_DELTA_PER_STEP = 120;
const PIXEL_DELTA_PER_STEP = 40;
const MAXIMUM_STEPS_PER_EVENT = 4;
const MAXIMUM_ANGLE_DELTA_CONTRIBUTION =
  ANGLE_DELTA_PER_STEP * MAXIMUM_STEPS_PER_EVENT;
const MAXIMUM_PIXEL_DELTA_CONTRIBUTION =
  PIXEL_DELTA_PER_STEP * MAXIMUM_STEPS_PER_EVENT;
const MAXIMUM_ANGLE_DELTA_INPUT = 1_000_000;
const MAXIMUM_PIXEL_DELTA_INPUT = 4_096;
const MINIMUM_MEMBER_COUNT = 1;
const MAXIMUM_MEMBER_COUNT = 256;

export function planOverviewTabRailWheel(
  input: unknown,
): OverviewTabRailWheelPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const angleDelta = input["angleDelta"];
    const angleRemainder = input["angleRemainder"];
    const currentIndex = input["currentIndex"];
    const memberCount = input["memberCount"];
    const pixelDelta = input["pixelDelta"];
    const pixelRemainder = input["pixelRemainder"];

    if (
      !isAngleDelta(angleDelta) ||
      !isAngleRemainder(angleRemainder) ||
      !isMemberCount(memberCount) ||
      !isMemberIndex(currentIndex, memberCount) ||
      !isPixelDelta(pixelDelta) ||
      !isPixelRemainder(pixelRemainder) ||
      (pixelDelta === 0 && angleDelta === 0)
    ) {
      return null;
    }

    const inputMode: OverviewTabRailWheelInputMode =
      pixelDelta !== 0 ? "pixel" : "angle";
    const quantum =
      inputMode === "pixel" ? PIXEL_DELTA_PER_STEP : ANGLE_DELTA_PER_STEP;
    const delta =
      inputMode === "pixel"
        ? clamp(
            pixelDelta,
            -MAXIMUM_PIXEL_DELTA_CONTRIBUTION,
            MAXIMUM_PIXEL_DELTA_CONTRIBUTION,
          )
        : clamp(
            angleDelta,
            -MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
            MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
          );
    const previousRemainder =
      inputMode === "pixel" ? pixelRemainder : angleRemainder;
    const accumulated = accumulateDirectionalRemainder(
      delta,
      previousRemainder,
    );
    const quantizedSteps = Math.min(
      Math.floor(Math.abs(accumulated) / quantum),
      MAXIMUM_STEPS_PER_EVENT,
    );
    const stepSign = Math.sign(accumulated);
    const direction: OverviewTabRailWheelDirection | null =
      quantizedSteps === 0 ? null : stepSign > 0 ? "next" : "previous";
    const targetIndex = clamp(
      currentIndex + stepSign * quantizedSteps,
      0,
      memberCount - 1,
    );
    const stepsApplied = Math.abs(targetIndex - currentIndex);
    const reachedBoundary =
      (stepSign > 0 && targetIndex === memberCount - 1) ||
      (stepSign < 0 && targetIndex === 0);
    const nextRemainder = reachedBoundary
      ? 0
      : normalizeZero(accumulated - stepSign * quantizedSteps * quantum);

    return Object.freeze({
      angleRemainder: inputMode === "angle" ? nextRemainder : 0,
      consumed: true,
      direction,
      inputMode,
      moved: targetIndex !== currentIndex,
      pixelRemainder: inputMode === "pixel" ? nextRemainder : 0,
      stepsApplied,
      targetIndex,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAngleDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAXIMUM_ANGLE_DELTA_INPUT
  );
}

function isAngleRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) < ANGLE_DELTA_PER_STEP
  );
}

function isMemberCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MINIMUM_MEMBER_COUNT &&
    value <= MAXIMUM_MEMBER_COUNT
  );
}

function isMemberIndex(value: unknown, memberCount: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < memberCount
  );
}

function isPixelDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAXIMUM_PIXEL_DELTA_INPUT
  );
}

function isPixelRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) < PIXEL_DELTA_PER_STEP
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
