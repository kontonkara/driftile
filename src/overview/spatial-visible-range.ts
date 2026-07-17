export interface OverviewSpatialVisibleRangeInput {
  readonly cardHeight: number;
  readonly contentHeight: number;
  readonly contentY: number;
  readonly edgeMargin: number;
  readonly gap: number;
  readonly overscan: number;
  readonly sceneHeight: number;
  readonly workspaceCount: number;
}

export interface OverviewSpatialVisibleRangePlan {
  readonly firstIndex: number;
  readonly lastIndex: number;
}

const MAXIMUM_WORKSPACE_COUNT = 512;
const MAXIMUM_OVERSCAN = 2;

export function planOverviewSpatialVisibleRange(
  input: unknown,
): OverviewSpatialVisibleRangePlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const sceneHeight = input["sceneHeight"];
    const contentHeight = input["contentHeight"];
    const contentY = input["contentY"];
    const edgeMargin = input["edgeMargin"];
    const cardHeight = input["cardHeight"];
    const gap = input["gap"];
    const workspaceCount = input["workspaceCount"];
    const overscan = input["overscan"];

    if (
      !isPositiveFiniteNumber(sceneHeight) ||
      !isPositiveFiniteNumber(contentHeight) ||
      !isNonNegativeFiniteNumber(contentY) ||
      !isNonNegativeFiniteNumber(edgeMargin) ||
      !isPositiveFiniteNumber(cardHeight) ||
      !isNonNegativeFiniteNumber(gap) ||
      !isSafeInteger(workspaceCount) ||
      workspaceCount < 1 ||
      workspaceCount > MAXIMUM_WORKSPACE_COUNT ||
      !isSafeInteger(overscan) ||
      overscan < 0 ||
      overscan > MAXIMUM_OVERSCAN ||
      sceneHeight > contentHeight
    ) {
      return null;
    }

    const maximumContentY = contentHeight - sceneHeight;
    const stride = cardHeight + gap;
    const firstCardEnd = edgeMargin + cardHeight;
    const lastCardStart = edgeMargin + (workspaceCount - 1) * stride;
    const lastCardEnd = lastCardStart + cardHeight;
    const viewportEnd = contentY + sceneHeight;

    if (
      !Number.isFinite(maximumContentY) ||
      contentY > maximumContentY ||
      !isPositiveFiniteNumber(stride) ||
      !Number.isFinite(firstCardEnd) ||
      !Number.isFinite(lastCardStart) ||
      !Number.isFinite(lastCardEnd) ||
      lastCardEnd > contentHeight ||
      !Number.isFinite(viewportEnd)
    ) {
      return null;
    }

    const firstCandidate = Math.floor((contentY - firstCardEnd) / stride) + 1;
    const lastCandidate = Math.ceil((viewportEnd - edgeMargin) / stride) - 1;

    if (!Number.isFinite(firstCandidate) || !Number.isFinite(lastCandidate)) {
      return null;
    }

    const firstExact = Math.max(0, firstCandidate);
    const lastExact = Math.min(workspaceCount - 1, lastCandidate);

    if (
      firstExact >= workspaceCount ||
      lastExact < 0 ||
      firstExact > lastExact
    ) {
      return null;
    }

    return Object.freeze({
      firstIndex: Math.max(0, firstExact - overscan),
      lastIndex: Math.min(workspaceCount - 1, lastExact + overscan),
    });
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
