export interface OverviewSpatialHorizontalDragInput {
  readonly maximumViewportOffset: number;
  readonly minimumViewportOffset: number;
  readonly projectionScale: number;
  readonly startViewportOffset: number;
  readonly translationX: number;
}

export interface OverviewSpatialHorizontalDragPlan {
  readonly viewportOffset: number;
}

const MAXIMUM_COORDINATE = Number.MAX_SAFE_INTEGER;

export function planOverviewSpatialHorizontalDrag(
  input: unknown,
): OverviewSpatialHorizontalDragPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const maximumViewportOffset = input["maximumViewportOffset"];
    const minimumViewportOffset = input["minimumViewportOffset"];
    const projectionScale = input["projectionScale"];
    const startViewportOffset = input["startViewportOffset"];
    const translationX = input["translationX"];

    if (
      !isCoordinate(maximumViewportOffset) ||
      !isCoordinate(minimumViewportOffset) ||
      minimumViewportOffset > maximumViewportOffset ||
      !isProjectionScale(projectionScale) ||
      !isCoordinate(startViewportOffset) ||
      startViewportOffset < minimumViewportOffset ||
      startViewportOffset > maximumViewportOffset ||
      !isCoordinate(translationX)
    ) {
      return null;
    }

    const projectedTranslation = Math.abs(translationX) / projectionScale;
    if (!isCoordinate(projectedTranslation)) {
      return null;
    }

    return Object.freeze({
      viewportOffset: moveViewport(
        normalizeZero(startViewportOffset),
        minimumViewportOffset,
        maximumViewportOffset,
        translationX,
        projectedTranslation,
      ),
    });
  } catch {
    return null;
  }
}

function moveViewport(
  startViewportOffset: number,
  minimumViewportOffset: number,
  maximumViewportOffset: number,
  translationX: number,
  projectedTranslation: number,
): number {
  if (translationX > 0) {
    const availableDistance = startViewportOffset - minimumViewportOffset;

    return projectedTranslation >= availableDistance
      ? normalizeZero(minimumViewportOffset)
      : normalizeZero(startViewportOffset - projectedTranslation);
  }

  if (translationX < 0) {
    const availableDistance = maximumViewportOffset - startViewportOffset;

    return projectedTranslation >= availableDistance
      ? normalizeZero(maximumViewportOffset)
      : normalizeZero(startViewportOffset + projectedTranslation);
  }

  return normalizeZero(startViewportOffset);
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
  return (
    isCoordinate(value) &&
    value > 0 &&
    Number.isFinite(1 / value) &&
    1 / value <= MAXIMUM_COORDINATE
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
