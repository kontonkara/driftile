export interface OverviewSpatialEdgePanInput {
  readonly contentHeight: number;
  readonly contentY: number;
  readonly elapsedMilliseconds: number;
  readonly pointerY: number;
  readonly sceneHeight: number;
}

export type OverviewSpatialEdgePanDirection = "down" | "up";

export interface OverviewSpatialEdgePanPlan {
  readonly active: boolean;
  readonly contentY: number;
  readonly direction: OverviewSpatialEdgePanDirection | null;
}

const EDGE_ZONE_RATIO = 0.12;
const MAXIMUM_EDGE_ZONE = 96;
const MAXIMUM_SPEED_SCENE_RATIO = 1.5;
const MAXIMUM_SPEED = 1_800;
const MAXIMUM_ELAPSED_MILLISECONDS = 250;
const MILLISECONDS_PER_SECOND = 1_000;

export function planOverviewSpatialEdgePan(
  input: unknown,
): OverviewSpatialEdgePanPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const sceneHeight = input["sceneHeight"];
    const contentHeight = input["contentHeight"];
    const contentY = input["contentY"];
    const pointerY = input["pointerY"];
    const elapsedMilliseconds = input["elapsedMilliseconds"];

    if (
      !isPositiveFiniteNumber(sceneHeight) ||
      !isPositiveFiniteNumber(contentHeight) ||
      contentHeight < sceneHeight ||
      !isFiniteNumber(contentY) ||
      !isFiniteNumber(pointerY) ||
      !isFiniteNumber(elapsedMilliseconds) ||
      elapsedMilliseconds < 0 ||
      elapsedMilliseconds > MAXIMUM_ELAPSED_MILLISECONDS
    ) {
      return null;
    }

    const maximumContentY = contentHeight - sceneHeight;
    const boundedContentY = clamp(contentY, 0, maximumContentY);
    const edgeZone = Math.min(sceneHeight * EDGE_ZONE_RATIO, MAXIMUM_EDGE_ZONE);
    const maximumSpeed = Math.min(
      sceneHeight * MAXIMUM_SPEED_SCENE_RATIO,
      MAXIMUM_SPEED,
    );

    if (
      !isPositiveFiniteNumber(edgeZone) ||
      !isPositiveFiniteNumber(maximumSpeed)
    ) {
      return null;
    }

    if (elapsedMilliseconds === 0 || maximumContentY === 0) {
      return inactivePlan(boundedContentY);
    }

    const boundedPointerY = clamp(pointerY, 0, sceneHeight);
    let direction: OverviewSpatialEdgePanDirection;
    let intensity: number;

    if (boundedPointerY < edgeZone) {
      direction = "up";
      intensity = (edgeZone - boundedPointerY) / edgeZone;
    } else {
      const lowerEdgeStart = sceneHeight - edgeZone;
      if (boundedPointerY <= lowerEdgeStart) {
        return inactivePlan(boundedContentY);
      }

      direction = "down";
      intensity = (boundedPointerY - lowerEdgeStart) / edgeZone;
    }

    const distance =
      (maximumSpeed * intensity * intensity * elapsedMilliseconds) /
      MILLISECONDS_PER_SECOND;

    if (!isPositiveFiniteNumber(distance)) {
      return inactivePlan(boundedContentY);
    }

    const requestedContentY =
      direction === "up"
        ? boundedContentY - distance
        : boundedContentY + distance;
    const nextContentY = clamp(requestedContentY, 0, maximumContentY);

    return nextContentY === boundedContentY
      ? inactivePlan(boundedContentY)
      : Object.freeze({
          active: true,
          contentY: normalizeZero(nextContentY),
          direction,
        });
  } catch {
    return null;
  }
}

function inactivePlan(contentY: number): OverviewSpatialEdgePanPlan {
  return Object.freeze({
    active: false,
    contentY: normalizeZero(contentY),
    direction: null,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
