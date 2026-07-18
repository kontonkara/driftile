import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialLayoutInput {
  readonly currentWorkspaceIndex: number;
  readonly sceneHeight: number;
  readonly sceneWidth: number;
  readonly workspaceCount: number;
  readonly zoom: number;
}

export interface OverviewSpatialLayoutPlan {
  readonly cardHeight: number;
  readonly cardWidth: number;
  readonly cardX: number;
  readonly contentHeight: number;
  readonly edgeMargin: number;
  readonly gap: number;
  readonly initialContentY: number;
}

const MINIMUM_ZOOM = 0.2;
const MAXIMUM_ZOOM = 0.75;
const CARD_GAP_RATIO = 0.12;
const MAXIMUM_CARD_GAP = 48;
const HORIZONTAL_MARGIN_RATIO = 0.035;
const MINIMUM_HORIZONTAL_MARGIN = 20;
const MAXIMUM_HORIZONTAL_MARGIN = 64;
const MAXIMUM_HORIZONTAL_MARGIN_RATIO = 0.2;

export function planOverviewSpatialLayout(
  input: unknown,
): OverviewSpatialLayoutPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const sceneWidth = input["sceneWidth"];
    const sceneHeight = input["sceneHeight"];
    const workspaceCount = input["workspaceCount"];
    const currentWorkspaceIndex = input["currentWorkspaceIndex"];
    const zoom = input["zoom"];

    if (
      !isPositiveFiniteNumber(sceneWidth) ||
      !isPositiveFiniteNumber(sceneHeight) ||
      !isSafeInteger(workspaceCount) ||
      workspaceCount < 1 ||
      workspaceCount > LAYOUT_PERSISTENCE_LIMITS.contexts ||
      !isSafeInteger(currentWorkspaceIndex) ||
      currentWorkspaceIndex < 0 ||
      currentWorkspaceIndex >= workspaceCount ||
      typeof zoom !== "number" ||
      !Number.isFinite(zoom) ||
      zoom < MINIMUM_ZOOM ||
      zoom > MAXIMUM_ZOOM
    ) {
      return null;
    }

    const cardHeight = sceneHeight * zoom;
    const cardX = Math.min(
      Math.max(
        Math.min(sceneWidth, sceneHeight) * HORIZONTAL_MARGIN_RATIO,
        MINIMUM_HORIZONTAL_MARGIN,
      ),
      MAXIMUM_HORIZONTAL_MARGIN,
      sceneWidth * MAXIMUM_HORIZONTAL_MARGIN_RATIO,
    );
    const cardWidth = sceneWidth - cardX * 2;
    const edgeMargin = (sceneHeight - cardHeight) / 2;
    const gap = Math.min(cardHeight * CARD_GAP_RATIO, MAXIMUM_CARD_GAP);
    const stride = cardHeight + gap;
    // Two edge margins plus one card equal the scene height, so both ends center.
    const contentHeight = sceneHeight + (workspaceCount - 1) * stride;
    const maximumContentY = contentHeight - sceneHeight;
    const centeredContentY = currentWorkspaceIndex * stride;
    const initialContentY = clamp(centeredContentY, 0, maximumContentY);

    if (
      !isPositiveFiniteNumber(cardWidth) ||
      !isPositiveFiniteNumber(cardHeight) ||
      !isPositiveFiniteNumber(cardX) ||
      !isPositiveFiniteNumber(edgeMargin) ||
      !isPositiveFiniteNumber(gap) ||
      !isPositiveFiniteNumber(contentHeight) ||
      !Number.isFinite(initialContentY)
    ) {
      return null;
    }

    return Object.freeze({
      cardHeight,
      cardWidth,
      cardX: normalizeZero(cardX),
      contentHeight,
      edgeMargin: normalizeZero(edgeMargin),
      gap,
      initialContentY: normalizeZero(initialContentY),
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

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
