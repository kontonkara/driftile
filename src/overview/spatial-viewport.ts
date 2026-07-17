import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialViewportInput {
  readonly contentHeight: number;
  readonly contentY: number;
  readonly sceneHeight: number;
}

export interface OverviewSpatialWorkspaceCenterInput {
  readonly cardHeight: number;
  readonly contentHeight: number;
  readonly gap: number;
  readonly sceneHeight: number;
  readonly workspaceCount: number;
  readonly workspaceIndex: number;
}

export interface OverviewSpatialViewportPlan {
  readonly contentY: number;
  readonly maximumContentY: number;
}

export function planOverviewSpatialViewport(
  input: unknown,
): OverviewSpatialViewportPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const sceneHeight = input["sceneHeight"];
    const contentHeight = input["contentHeight"];
    const contentY = input["contentY"];

    if (
      !isPositiveFiniteNumber(sceneHeight) ||
      !isPositiveFiniteNumber(contentHeight) ||
      contentHeight < sceneHeight ||
      !isFiniteNumber(contentY)
    ) {
      return null;
    }

    return createViewportPlan(sceneHeight, contentHeight, contentY);
  } catch {
    return null;
  }
}

export function planOverviewSpatialWorkspaceCenter(
  input: unknown,
): OverviewSpatialViewportPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const sceneHeight = input["sceneHeight"];
    const contentHeight = input["contentHeight"];
    const cardHeight = input["cardHeight"];
    const gap = input["gap"];
    const workspaceCount = input["workspaceCount"];
    const workspaceIndex = input["workspaceIndex"];

    if (
      !isPositiveFiniteNumber(sceneHeight) ||
      !isPositiveFiniteNumber(contentHeight) ||
      contentHeight < sceneHeight ||
      !isPositiveFiniteNumber(cardHeight) ||
      !isNonNegativeFiniteNumber(gap) ||
      !isSafeInteger(workspaceCount) ||
      workspaceCount < 1 ||
      workspaceCount > LAYOUT_PERSISTENCE_LIMITS.contexts ||
      !isSafeInteger(workspaceIndex) ||
      workspaceIndex < 0 ||
      workspaceIndex >= workspaceCount
    ) {
      return null;
    }

    const stride = cardHeight + gap;
    const centeredContentY = workspaceIndex * stride;

    if (
      !isPositiveFiniteNumber(stride) ||
      !isNonNegativeFiniteNumber(centeredContentY)
    ) {
      return null;
    }

    return createViewportPlan(sceneHeight, contentHeight, centeredContentY);
  } catch {
    return null;
  }
}

function createViewportPlan(
  sceneHeight: number,
  contentHeight: number,
  requestedContentY: number,
): OverviewSpatialViewportPlan {
  const maximumContentY = contentHeight - sceneHeight;
  const contentY = Math.min(Math.max(requestedContentY, 0), maximumContentY);

  return Object.freeze({
    contentY: normalizeZero(contentY),
    maximumContentY: normalizeZero(maximumContentY),
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

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
