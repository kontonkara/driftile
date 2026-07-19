export interface OverviewSpatialHorizontalEdgePanInput {
  readonly elapsedMilliseconds: number;
  readonly maximumViewportOffset: number;
  readonly minimumViewportOffset: number;
  readonly pointerX: number;
  readonly projectionScale: number;
  readonly viewportLeft: number;
  readonly viewportOffset: number;
  readonly viewportWidth: number;
}

export type OverviewSpatialHorizontalEdgePanDirection = "left" | "right";

export interface OverviewSpatialHorizontalEdgePanPlan {
  readonly active: boolean;
  readonly direction: OverviewSpatialHorizontalEdgePanDirection | null;
  readonly viewportOffset: number;
}

const EDGE_ZONE_RATIO = 0.12;
const MAXIMUM_EDGE_ZONE = 96;
const MAXIMUM_SPEED_VIEWPORT_RATIO = 1.5;
const MAXIMUM_SPEED = 1_800;
const MAXIMUM_ELAPSED_MILLISECONDS = 250;
const MAXIMUM_COORDINATE = Number.MAX_SAFE_INTEGER;
const MILLISECONDS_PER_SECOND = 1_000;

export function planOverviewSpatialHorizontalEdgePan(
  input: unknown,
): OverviewSpatialHorizontalEdgePanPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const elapsedMilliseconds = input["elapsedMilliseconds"];
    const maximumViewportOffset = input["maximumViewportOffset"];
    const minimumViewportOffset = input["minimumViewportOffset"];
    const pointerX = input["pointerX"];
    const projectionScale = input["projectionScale"];
    const viewportLeft = input["viewportLeft"];
    const viewportOffset = input["viewportOffset"];
    const viewportWidth = input["viewportWidth"];

    if (
      !isNonNegativeElapsedMilliseconds(elapsedMilliseconds) ||
      !isCoordinate(maximumViewportOffset) ||
      !isCoordinate(minimumViewportOffset) ||
      minimumViewportOffset > maximumViewportOffset ||
      !isCoordinate(pointerX) ||
      !isProjectionScale(projectionScale) ||
      !isCoordinate(viewportLeft) ||
      !isCoordinate(viewportOffset) ||
      viewportOffset < minimumViewportOffset ||
      viewportOffset > maximumViewportOffset ||
      !isPositiveCoordinate(viewportWidth)
    ) {
      return null;
    }

    const viewportRight = viewportLeft + viewportWidth;
    if (!isCoordinate(viewportRight)) {
      return null;
    }

    const normalizedViewportOffset = normalizeZero(viewportOffset);
    if (
      elapsedMilliseconds === 0 ||
      minimumViewportOffset === maximumViewportOffset
    ) {
      return inactivePlan(normalizedViewportOffset);
    }

    const edgeZone = Math.min(
      viewportWidth * EDGE_ZONE_RATIO,
      MAXIMUM_EDGE_ZONE,
    );
    const maximumScreenSpeed = Math.min(
      viewportWidth * MAXIMUM_SPEED_VIEWPORT_RATIO,
      MAXIMUM_SPEED,
    );

    if (
      !isPositiveCoordinate(edgeZone) ||
      !isPositiveCoordinate(maximumScreenSpeed)
    ) {
      return null;
    }

    const boundedPointerX = clamp(pointerX, viewportLeft, viewportRight);
    let direction: OverviewSpatialHorizontalEdgePanDirection;
    let intensity: number;

    if (boundedPointerX < viewportLeft + edgeZone) {
      direction = "left";
      intensity = (viewportLeft + edgeZone - boundedPointerX) / edgeZone;
    } else if (boundedPointerX > viewportRight - edgeZone) {
      direction = "right";
      intensity = (boundedPointerX - (viewportRight - edgeZone)) / edgeZone;
    } else {
      return inactivePlan(normalizedViewportOffset);
    }

    const distance =
      (maximumScreenSpeed * intensity * intensity * elapsedMilliseconds) /
      (MILLISECONDS_PER_SECOND * projectionScale);

    if (!isPositiveCoordinate(distance)) {
      return inactivePlan(normalizedViewportOffset);
    }

    const requestedViewportOffset =
      direction === "left"
        ? normalizedViewportOffset - distance
        : normalizedViewportOffset + distance;
    const nextViewportOffset = clamp(
      requestedViewportOffset,
      minimumViewportOffset,
      maximumViewportOffset,
    );

    return nextViewportOffset === normalizedViewportOffset
      ? inactivePlan(normalizedViewportOffset)
      : Object.freeze({
          active: true,
          direction,
          viewportOffset: normalizeZero(nextViewportOffset),
        });
  } catch {
    return null;
  }
}

function inactivePlan(
  viewportOffset: number,
): OverviewSpatialHorizontalEdgePanPlan {
  return Object.freeze({
    active: false,
    direction: null,
    viewportOffset: normalizeZero(viewportOffset),
  });
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

function isProjectionScale(value: unknown): value is number {
  return (
    isPositiveCoordinate(value) &&
    Number.isFinite(1 / value) &&
    1 / value <= MAXIMUM_COORDINATE
  );
}

function isNonNegativeElapsedMilliseconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAXIMUM_ELAPSED_MILLISECONDS
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
