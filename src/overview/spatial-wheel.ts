import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialWheelInput {
  readonly angleDeltaY: number;
  readonly contentHeight: number;
  readonly contentY: number;
  readonly pixelDeltaY: number;
  readonly pixelRemainder?: number;
  readonly remainder: number;
  readonly sceneHeight: number;
}

export type OverviewSpatialWheelDirection = "next" | "previous";

export type OverviewSpatialWheelAxis = "horizontal" | "vertical";

export type OverviewSpatialWheelInputMode = "angle" | "pixel";

export interface OverviewSpatialWheelAxisInput {
  readonly angleDeltaX: number;
  readonly angleDeltaY: number;
  readonly axisOwner: OverviewSpatialWheelAxis | null;
  readonly pixelDeltaX: number;
  readonly pixelDeltaY: number;
}

export interface OverviewSpatialWheelAxisPlan {
  readonly axis: OverviewSpatialWheelAxis | null;
  readonly axisOwner: OverviewSpatialWheelAxis | null;
  readonly inputMode: OverviewSpatialWheelInputMode | null;
}

export interface OverviewSpatialWorkspaceWheelPlan {
  readonly contentY: number;
  readonly direction: OverviewSpatialWheelDirection | null;
  readonly intent: "workspace";
  readonly pixelRemainder: 0;
  readonly remainder: number;
  readonly steps: number;
}

export interface OverviewSpatialViewportWheelPlan {
  readonly contentY: number;
  readonly intent: "viewport";
  readonly pixelRemainder: number;
  readonly remainder: 0;
}

export type OverviewSpatialWheelPlan =
  OverviewSpatialViewportWheelPlan | OverviewSpatialWorkspaceWheelPlan;

export interface OverviewSpatialWorkspaceWheelTargetInput {
  readonly currentIndex: number;
  readonly direction: OverviewSpatialWheelDirection;
  readonly steps: number;
  readonly workspaceCount: number;
}

export interface OverviewSpatialWorkspaceWheelTargetPlan {
  readonly appliedSteps: number;
  readonly targetIndex: number;
}

const ANGLE_DELTA_PER_STEP = 120;
const MAXIMUM_STEPS_PER_EVENT = 4;
const MAXIMUM_ANGLE_DELTA_CONTRIBUTION =
  ANGLE_DELTA_PER_STEP * MAXIMUM_STEPS_PER_EVENT;
const MAXIMUM_ANGLE_DELTA_INPUT = 1_000_000;
const MAXIMUM_PIXEL_DELTA_PER_EVENT = 4_096;
const MAXIMUM_COORDINATE = Number.MAX_SAFE_INTEGER;
const PIXEL_SCROLL_QUANTA_PER_UNIT = 64;
const PIXEL_SCROLL_QUANTUM = 1 / PIXEL_SCROLL_QUANTA_PER_UNIT;

export function normalizeOverviewPhysicalWheelAngleDelta(
  angleDeltaY: unknown,
  inverted: unknown,
): number | null {
  try {
    if (!isAngleDelta(angleDeltaY) || typeof inverted !== "boolean") {
      return null;
    }

    return normalizeZero(inverted ? angleDeltaY : -angleDeltaY);
  } catch {
    return null;
  }
}

export function planOverviewSpatialWheelAxis(
  input: unknown,
): OverviewSpatialWheelAxisPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const angleDeltaX = input["angleDeltaX"];
    const angleDeltaY = input["angleDeltaY"];
    const axisOwner = input["axisOwner"];
    const pixelDeltaX = input["pixelDeltaX"];
    const pixelDeltaY = input["pixelDeltaY"];

    if (
      !isAngleDelta(angleDeltaX) ||
      !isAngleDelta(angleDeltaY) ||
      !isWheelAxisOwner(axisOwner) ||
      !isPixelDelta(pixelDeltaX) ||
      !isPixelDelta(pixelDeltaY)
    ) {
      return null;
    }

    const hasPixelInput = pixelDeltaX !== 0 || pixelDeltaY !== 0;
    const horizontalMagnitude = Math.abs(
      hasPixelInput ? pixelDeltaX : angleDeltaX,
    );
    const verticalMagnitude = Math.abs(
      hasPixelInput ? pixelDeltaY : angleDeltaY,
    );

    if (horizontalMagnitude === 0 && verticalMagnitude === 0) {
      return Object.freeze({
        axis: null,
        axisOwner,
        inputMode: null,
      });
    }

    const axis =
      horizontalMagnitude === verticalMagnitude
        ? (axisOwner ?? "vertical")
        : horizontalMagnitude > verticalMagnitude
          ? "horizontal"
          : "vertical";

    return Object.freeze({
      axis,
      axisOwner: axisOwner ?? axis,
      inputMode: hasPixelInput ? "pixel" : "angle",
    });
  } catch {
    return null;
  }
}

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
    const pixelRemainderValue = input["pixelRemainder"];
    const pixelRemainder =
      pixelRemainderValue === undefined ? 0 : pixelRemainderValue;
    const remainder = input["remainder"];
    const sceneHeight = input["sceneHeight"];

    if (
      !isPositiveCoordinate(sceneHeight) ||
      !isPositiveCoordinate(contentHeight) ||
      contentHeight < sceneHeight ||
      !isCoordinate(contentY) ||
      !isAngleDelta(angleDeltaY) ||
      !isPixelDelta(pixelDeltaY) ||
      !isPixelRemainder(pixelRemainder) ||
      !isRemainder(remainder)
    ) {
      return null;
    }

    const maximumContentY = contentHeight - sceneHeight;
    const boundedContentY = clamp(contentY, 0, maximumContentY);

    if (pixelDeltaY !== 0) {
      const accumulatedPixelDelta = accumulateDirectionalRemainder(
        pixelDeltaY,
        pixelRemainder,
      );
      const quantizedPixelDelta = quantizePixelDelta(accumulatedPixelDelta);
      const contentY = moveViewport(
        boundedContentY,
        maximumContentY,
        quantizedPixelDelta,
      );
      const reachedBoundary =
        (accumulatedPixelDelta > 0 && contentY === 0) ||
        (accumulatedPixelDelta < 0 && contentY === maximumContentY);

      return Object.freeze({
        contentY,
        intent: "viewport",
        pixelRemainder: reachedBoundary
          ? 0
          : normalizeZero(accumulatedPixelDelta - quantizedPixelDelta),
        remainder: 0,
      });
    }

    if (angleDeltaY === 0) {
      return Object.freeze({
        contentY: normalizeZero(boundedContentY),
        direction: null,
        intent: "workspace",
        pixelRemainder: 0,
        remainder: normalizeZero(remainder),
        steps: 0,
      });
    }

    const boundedAngleDelta = clamp(
      angleDeltaY,
      -MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
      MAXIMUM_ANGLE_DELTA_CONTRIBUTION,
    );
    const accumulated = accumulateDirectionalRemainder(
      boundedAngleDelta,
      remainder,
    );
    const steps = Math.min(
      Math.floor(Math.abs(accumulated) / ANGLE_DELTA_PER_STEP),
      MAXIMUM_STEPS_PER_EVENT,
    );
    const nextRemainder =
      accumulated - Math.sign(accumulated) * steps * ANGLE_DELTA_PER_STEP;

    return Object.freeze({
      contentY: normalizeZero(boundedContentY),
      direction: steps === 0 ? null : accumulated > 0 ? "next" : "previous",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: normalizeZero(nextRemainder),
      steps,
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

function quantizePixelDelta(value: number): number {
  return normalizeZero(
    Math.trunc(value * PIXEL_SCROLL_QUANTA_PER_UNIT) /
      PIXEL_SCROLL_QUANTA_PER_UNIT,
  );
}

export function planOverviewSpatialWorkspaceWheelTarget(
  input: unknown,
): OverviewSpatialWorkspaceWheelTargetPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const currentIndex = input["currentIndex"];
    const direction = input["direction"];
    const steps = input["steps"];
    const workspaceCount = input["workspaceCount"];

    if (
      !isWorkspaceCount(workspaceCount) ||
      !isWorkspaceIndex(currentIndex, workspaceCount) ||
      !isWheelDirection(direction) ||
      !isStepCount(steps)
    ) {
      return null;
    }

    const targetIndex =
      direction === "previous"
        ? Math.max(0, currentIndex - steps)
        : Math.min(workspaceCount - 1, currentIndex + steps);

    return Object.freeze({
      appliedSteps: Math.abs(targetIndex - currentIndex),
      targetIndex,
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
    Math.abs(value) < PIXEL_SCROLL_QUANTUM
  );
}

function isRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) < ANGLE_DELTA_PER_STEP
  );
}

function isWorkspaceCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.contexts
  );
}

function isWorkspaceIndex(
  value: unknown,
  workspaceCount: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < workspaceCount
  );
}

function isWheelDirection(
  value: unknown,
): value is OverviewSpatialWheelDirection {
  return value === "next" || value === "previous";
}

function isWheelAxisOwner(
  value: unknown,
): value is OverviewSpatialWheelAxis | null {
  return value === null || value === "horizontal" || value === "vertical";
}

function isStepCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_STEPS_PER_EVENT
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
