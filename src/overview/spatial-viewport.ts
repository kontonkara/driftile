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

export interface OverviewSpatialViewportAnchorLayoutInput {
  readonly cardHeight: number;
  readonly contentHeight: number;
  readonly edgeMargin: number;
  readonly gap: number;
}

export interface OverviewSpatialViewportAnchorInput {
  readonly nextDesktopIds: readonly string[];
  readonly nextLayout: OverviewSpatialViewportAnchorLayoutInput;
  readonly nextSceneHeight: number;
  readonly previousContentY: number;
  readonly previousDesktopIds: readonly string[];
  readonly previousLayout: OverviewSpatialViewportAnchorLayoutInput;
  readonly previousSceneHeight: number;
}

export interface OverviewSpatialViewportPlan {
  readonly contentY: number;
  readonly maximumContentY: number;
}

export interface OverviewSpatialViewportAnchorPlan extends OverviewSpatialViewportPlan {
  readonly anchorDesktopId: string;
  readonly anchorOffsetFraction: number;
  readonly anchorWorkspaceIndex: number;
}

interface SpatialViewportAnchorGeometry {
  readonly contentHeight: number;
  readonly firstCardCenter: number;
  readonly maximumContentY: number;
  readonly stride: number;
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

export function planOverviewSpatialViewportAnchor(
  input: unknown,
): OverviewSpatialViewportAnchorPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const previousDesktopIds = readDesktopIds(input["previousDesktopIds"]);
    const nextDesktopIds = readDesktopIds(input["nextDesktopIds"]);
    const previousSceneHeight = input["previousSceneHeight"];
    const nextSceneHeight = input["nextSceneHeight"];
    const previousContentY = input["previousContentY"];

    if (
      previousDesktopIds === null ||
      nextDesktopIds === null ||
      !isPositiveFiniteNumber(previousSceneHeight) ||
      !isPositiveFiniteNumber(nextSceneHeight) ||
      !isNonNegativeFiniteNumber(previousContentY)
    ) {
      return null;
    }

    const previousGeometry = readAnchorGeometry(
      input["previousLayout"],
      previousSceneHeight,
      previousDesktopIds.length,
    );
    const nextGeometry = readAnchorGeometry(
      input["nextLayout"],
      nextSceneHeight,
      nextDesktopIds.length,
    );

    if (
      previousGeometry === null ||
      nextGeometry === null ||
      previousContentY > previousGeometry.maximumContentY
    ) {
      return null;
    }

    const previousReferenceY = previousContentY + previousSceneHeight / 2;
    const continuousWorkspaceIndex =
      (previousReferenceY - previousGeometry.firstCardCenter) /
      previousGeometry.stride;

    if (!isFiniteNumber(continuousWorkspaceIndex)) {
      return null;
    }

    const previousAnchorIndex = clampInteger(
      Math.floor(continuousWorkspaceIndex + 0.5),
      0,
      previousDesktopIds.length - 1,
    );
    const anchorOffsetFraction = clamp(
      continuousWorkspaceIndex - previousAnchorIndex,
      -0.5,
      0.5,
    );
    const previousAnchorId = previousDesktopIds[previousAnchorIndex];

    if (previousAnchorId === undefined) {
      return null;
    }

    const preservedIndex = indexOfIdentifier(nextDesktopIds, previousAnchorId);
    const anchorWorkspaceIndex =
      preservedIndex >= 0
        ? preservedIndex
        : Math.min(previousAnchorIndex, nextDesktopIds.length - 1);
    const anchorDesktopId = nextDesktopIds[anchorWorkspaceIndex];

    if (anchorDesktopId === undefined) {
      return null;
    }

    const nextReferenceY =
      nextGeometry.firstCardCenter +
      (anchorWorkspaceIndex + anchorOffsetFraction) * nextGeometry.stride;
    const requestedContentY = nextReferenceY - nextSceneHeight / 2;

    if (!isFiniteNumber(requestedContentY)) {
      return null;
    }

    const viewport = createViewportPlan(
      nextSceneHeight,
      nextGeometry.contentHeight,
      requestedContentY,
    );

    return Object.freeze({
      anchorDesktopId,
      anchorOffsetFraction: normalizeZero(anchorOffsetFraction),
      anchorWorkspaceIndex,
      contentY: viewport.contentY,
      maximumContentY: viewport.maximumContentY,
    });
  } catch {
    return null;
  }
}

function readAnchorGeometry(
  value: unknown,
  sceneHeight: number,
  workspaceCount: number,
): SpatialViewportAnchorGeometry | null {
  if (!isRecord(value)) {
    return null;
  }

  const cardHeight = value["cardHeight"];
  const contentHeight = value["contentHeight"];
  const edgeMargin = value["edgeMargin"];
  const gap = value["gap"];

  if (
    !isPositiveFiniteNumber(cardHeight) ||
    cardHeight > sceneHeight ||
    !isPositiveFiniteNumber(contentHeight) ||
    contentHeight < sceneHeight ||
    !isNonNegativeFiniteNumber(edgeMargin) ||
    !isNonNegativeFiniteNumber(gap)
  ) {
    return null;
  }

  const stride = cardHeight + gap;
  const firstCardCenter = edgeMargin + cardHeight / 2;
  const lastCardEnd = edgeMargin + (workspaceCount - 1) * stride + cardHeight;
  const expectedContentHeight = lastCardEnd + edgeMargin;
  const maximumContentY = contentHeight - sceneHeight;

  if (
    !isPositiveFiniteNumber(stride) ||
    !isNonNegativeFiniteNumber(firstCardCenter) ||
    !isPositiveFiniteNumber(lastCardEnd) ||
    lastCardEnd > contentHeight ||
    !approximatelyEqual(expectedContentHeight, contentHeight) ||
    !isNonNegativeFiniteNumber(maximumContentY)
  ) {
    return null;
  }

  return {
    contentHeight,
    firstCardCenter,
    maximumContentY,
    stride,
  };
}

function readDesktopIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const length = value.length;
  if (
    !isSafeInteger(length) ||
    length < 1 ||
    length > LAYOUT_PERSISTENCE_LIMITS.contexts
  ) {
    return null;
  }

  const desktopIds: string[] = [];
  const uniqueDesktopIds = new Set<string>();

  for (let index = 0; index < length; index += 1) {
    const desktopId: unknown = value[index];
    if (!isIdentifier(desktopId) || uniqueDesktopIds.has(desktopId)) {
      return null;
    }

    uniqueDesktopIds.add(desktopId);
    desktopIds.push(desktopId);
  }

  return desktopIds;
}

function indexOfIdentifier(
  identifiers: readonly string[],
  expected: string,
): number {
  for (let index = 0; index < identifiers.length; index += 1) {
    if (identifiers[index] === expected) {
      return index;
    }
  }

  return -1;
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

function isIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function approximatelyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Number.isFinite(scale) && Math.abs(left - right) <= scale * 0.000001;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
