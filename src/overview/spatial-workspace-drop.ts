import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialWorkspaceGapInput {
  readonly cardGap: number;
  readonly cardHeight: number;
  readonly cardTop: number;
  readonly desktopIds: readonly string[];
  readonly keepEmptyDesktopAboveFirst: boolean;
  readonly pointY: number;
}

export interface OverviewSpatialWorkspaceGapPlan {
  readonly adjacentDesktopId: string;
  readonly anchorDesktopId: string;
  readonly insertionIndex: number;
  readonly lineY: number;
  readonly position: "after" | "before";
}

const MAXIMUM_GEOMETRY_MAGNITUDE = LAYOUT_PERSISTENCE_LIMITS.numericMagnitude;

export function planOverviewSpatialWorkspaceGap(
  input: unknown,
): OverviewSpatialWorkspaceGapPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const cardGap = input["cardGap"];
    const cardHeight = input["cardHeight"];
    const cardTop = input["cardTop"];
    const desktopIds = input["desktopIds"];
    const keepEmptyDesktopAboveFirst = input["keepEmptyDesktopAboveFirst"];
    const pointY = input["pointY"];

    if (
      !isPositiveBoundedNumber(cardGap) ||
      !isPositiveBoundedNumber(cardHeight) ||
      !isBoundedNumber(cardTop) ||
      !Array.isArray(desktopIds) ||
      typeof keepEmptyDesktopAboveFirst !== "boolean" ||
      !isBoundedNumber(pointY) ||
      desktopIds.length < (keepEmptyDesktopAboveFirst ? 3 : 2) ||
      desktopIds.length > LAYOUT_PERSISTENCE_LIMITS.contexts
    ) {
      return null;
    }

    const orderedDesktopIds = readUniqueDesktopIds(desktopIds);
    if (orderedDesktopIds === null) {
      return null;
    }

    const stride = cardHeight + cardGap;
    const lastCardBottom =
      cardTop + (orderedDesktopIds.length - 1) * stride + cardHeight;
    if (!isPositiveBoundedNumber(stride) || !isBoundedNumber(lastCardBottom)) {
      return null;
    }

    const firstGapTop = cardTop + cardHeight;
    const relativeY = pointY - firstGapTop;
    if (!Number.isFinite(relativeY) || relativeY < 0) {
      return null;
    }

    const cycleIndex = Math.floor(relativeY / stride);
    const insertionIndex = cycleIndex + 1;
    if (insertionIndex >= orderedDesktopIds.length) {
      return null;
    }

    const gapOffset = relativeY - cycleIndex * stride;
    if (gapOffset < 0 || gapOffset >= cardGap) {
      return null;
    }

    const previousDesktopId = orderedDesktopIds[insertionIndex - 1];
    const nextDesktopId = orderedDesktopIds[insertionIndex];
    if (previousDesktopId === undefined || nextDesktopId === undefined) {
      return null;
    }

    const anchorPrevious = insertionIndex === orderedDesktopIds.length - 1;
    const anchorDesktopId = anchorPrevious ? previousDesktopId : nextDesktopId;
    const adjacentDesktopId = anchorPrevious
      ? nextDesktopId
      : previousDesktopId;
    const anchorIndex = anchorPrevious ? insertionIndex - 1 : insertionIndex;
    if (
      anchorIndex === orderedDesktopIds.length - 1 ||
      (keepEmptyDesktopAboveFirst && anchorIndex === 0)
    ) {
      return null;
    }

    const gapTop = firstGapTop + cycleIndex * stride;
    const lineY = gapTop + cardGap / 2;
    return isBoundedNumber(lineY)
      ? Object.freeze({
          adjacentDesktopId,
          anchorDesktopId,
          insertionIndex,
          lineY: normalizeZero(lineY),
          position: anchorPrevious ? "after" : "before",
        })
      : null;
  } catch {
    return null;
  }
}

function readUniqueDesktopIds(
  value: readonly unknown[],
): readonly string[] | null {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!isIdentifier(candidate) || seen.has(candidate)) {
      return null;
    }

    seen.add(candidate);
    result.push(candidate);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
