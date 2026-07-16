import type { Rect } from "../core/geometry";
import { outputId } from "../core/ids";
import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";
import {
  findAdjacentOutput,
  type OutputDirection,
  type OutputGeometry,
} from "../core/output-navigation";

type OverviewSequentialNavigationDirection =
  "first" | "last" | "next" | "previous";

export interface OverviewWheelNavigationPlan {
  readonly direction: "next" | "previous" | null;
  readonly remainder: number;
  readonly steps: number;
}

const MAXIMUM_NAVIGATION_TARGETS =
  LAYOUT_PERSISTENCE_LIMITS.windows + LAYOUT_PERSISTENCE_LIMITS.contexts;
const MAXIMUM_NAVIGATION_TARGET_ID_CHARACTERS =
  LAYOUT_PERSISTENCE_LIMITS.identifierCharacters * 2 + 32;
const OVERVIEW_WHEEL_ANGLE_DELTA_PER_STEP = 120;
const MAXIMUM_OVERVIEW_WHEEL_STEPS_PER_EVENT = 4;
const MAXIMUM_OVERVIEW_WHEEL_ANGLE_DELTA_PER_EVENT =
  OVERVIEW_WHEEL_ANGLE_DELTA_PER_STEP * MAXIMUM_OVERVIEW_WHEEL_STEPS_PER_EVENT;

export function planOverviewWheelNavigation(
  remainder: unknown,
  verticalAngleDelta: unknown,
): OverviewWheelNavigationPlan | null {
  try {
    if (
      !isWheelRemainder(remainder) ||
      !isWheelAngleDelta(verticalAngleDelta)
    ) {
      return null;
    }

    if (verticalAngleDelta === 0) {
      return { direction: null, remainder: normalizeZero(remainder), steps: 0 };
    }

    const accumulated =
      remainder !== 0 && Math.sign(remainder) !== Math.sign(verticalAngleDelta)
        ? verticalAngleDelta
        : remainder + verticalAngleDelta;
    const steps = Math.min(
      Math.floor(Math.abs(accumulated) / OVERVIEW_WHEEL_ANGLE_DELTA_PER_STEP),
      MAXIMUM_OVERVIEW_WHEEL_STEPS_PER_EVENT,
    );
    const nextRemainder =
      accumulated -
      Math.sign(accumulated) * steps * OVERVIEW_WHEEL_ANGLE_DELTA_PER_STEP;

    return {
      direction: steps === 0 ? null : accumulated > 0 ? "previous" : "next",
      remainder: normalizeZero(nextRemainder),
      steps,
    };
  } catch {
    return null;
  }
}

export function countOverviewWindowNavigationTargets(
  targets: unknown,
): number | null {
  try {
    if (
      !Array.isArray(targets) ||
      targets.length > MAXIMUM_NAVIGATION_TARGETS
    ) {
      return null;
    }

    const windowIds = new Set<string>();
    for (const target of targets) {
      if (!isRecord(target) || target["kind"] !== "window") {
        continue;
      }

      const windowId = target["windowId"];
      if (validIdentifier(windowId)) {
        windowIds.add(windowId);
      }
    }

    return windowIds.size;
  } catch {
    return null;
  }
}

export function findOverviewNavigationTarget(
  sourceId: unknown,
  targets: unknown,
  direction: unknown,
): string | null {
  try {
    if (!validIdentifier(sourceId) || !isOutputDirection(direction)) {
      return null;
    }

    const normalizedTargets = snapshotTargets(sourceId, targets);
    if (!normalizedTargets) {
      return null;
    }

    return findAdjacentOutput(outputId(sourceId), normalizedTargets, direction);
  } catch {
    return null;
  }
}

export function findOverviewSequentialNavigationTarget(
  sourceId: unknown,
  targets: unknown,
  direction: unknown,
): string | null {
  try {
    if (!validIdentifier(sourceId) || !isSequentialDirection(direction)) {
      return null;
    }

    const normalizedTargets = snapshotTargets(sourceId, targets);
    if (!normalizedTargets) {
      return null;
    }

    const orderedTargets = normalizedTargets.sort(compareVisualOrder);
    const sourceIndex = orderedTargets.findIndex(({ id }) => id === sourceId);
    if (sourceIndex < 0) {
      return null;
    }

    if (direction === "first") {
      return orderedTargets[0]?.id ?? null;
    }
    if (direction === "last") {
      return orderedTargets[orderedTargets.length - 1]?.id ?? null;
    }
    if (direction === "next") {
      return (
        orderedTargets[(sourceIndex + 1) % orderedTargets.length]?.id ?? null
      );
    }

    return (
      orderedTargets[
        (sourceIndex + orderedTargets.length - 1) % orderedTargets.length
      ]?.id ?? null
    );
  } catch {
    return null;
  }
}

function snapshotTargets(
  sourceId: unknown,
  targets: unknown,
): OutputGeometry[] | null {
  if (
    !validIdentifier(sourceId) ||
    !Array.isArray(targets) ||
    targets.length > MAXIMUM_NAVIGATION_TARGETS
  ) {
    return null;
  }

  const normalizedTargets: OutputGeometry[] = [];
  const targetIds = new Set<string>();
  let sourceFound = false;

  for (const target of targets) {
    if (!isRecord(target)) {
      continue;
    }

    const id = target["id"];
    if (!validIdentifier(id)) {
      continue;
    }

    const rect = snapshotRect(target["rect"]);
    if (!rect) {
      if (id === sourceId) {
        return null;
      }
      continue;
    }

    if (targetIds.has(id)) {
      return null;
    }

    targetIds.add(id);
    sourceFound ||= id === sourceId;
    normalizedTargets.push({ id: outputId(id), rect });
  }

  return sourceFound ? normalizedTargets : null;
}

function compareVisualOrder(
  first: OutputGeometry,
  second: OutputGeometry,
): number {
  if (first.rect.y !== second.rect.y) {
    return first.rect.y < second.rect.y ? -1 : 1;
  }
  if (first.rect.x !== second.rect.x) {
    return first.rect.x < second.rect.x ? -1 : 1;
  }
  if (first.id === second.id) {
    return 0;
  }

  return first.id < second.id ? -1 : 1;
}

function snapshotRect(value: unknown): Rect | null {
  if (!isRecord(value) || Array.isArray(value)) {
    return null;
  }

  const x = value["x"];
  const y = value["y"];
  const width = value["width"];
  const height = value["height"];

  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(x + width) ||
    !Number.isFinite(y + height)
  ) {
    return null;
  }

  return { height, width, x, y };
}

function isOutputDirection(value: unknown): value is OutputDirection {
  return (
    value === "down" || value === "left" || value === "right" || value === "up"
  );
}

function isSequentialDirection(
  value: unknown,
): value is OverviewSequentialNavigationDirection {
  return (
    value === "first" ||
    value === "last" ||
    value === "next" ||
    value === "previous"
  );
}

function isWheelRemainder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Math.abs(value) < OVERVIEW_WHEEL_ANGLE_DELTA_PER_STEP
  );
}

function isWheelAngleDelta(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Math.abs(value) <= MAXIMUM_OVERVIEW_WHEEL_ANGLE_DELTA_PER_EVENT
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function validIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_NAVIGATION_TARGET_ID_CHARACTERS
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
