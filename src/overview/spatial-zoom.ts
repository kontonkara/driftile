import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";
import {
  OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS,
  planOverviewSpatialLayout,
  type OverviewSpatialLayoutPlan,
} from "./spatial-layout";
import { planOverviewSpatialViewport } from "./spatial-viewport";

export const OVERVIEW_SPATIAL_ZOOM_LIMITS = Object.freeze({
  maximum: OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS.maximum,
  maximumPreviewScale: 16,
  maximumSteps: 4,
  minimum: OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS.minimum,
  minimumPreviewScale: 1 / 16,
  step: 0.05,
});

export type OverviewSpatialZoomStepDirection = "in" | "out";

export type OverviewSpatialZoomLevelInput =
  | {
      readonly configuredZoom: number;
      readonly currentZoom: number;
      readonly intent: "reset";
    }
  | {
      readonly currentZoom: number;
      readonly direction: OverviewSpatialZoomStepDirection;
      readonly intent: "step";
      readonly steps: number;
    };

export interface OverviewSpatialZoomLevelPlan {
  readonly atMaximum: boolean;
  readonly atMinimum: boolean;
  readonly changed: boolean;
  readonly scale: number;
  readonly zoom: number;
}

export interface OverviewSpatialZoomBeginInput {
  readonly anchorSceneY: number;
  readonly contentY: number;
  readonly currentWorkspaceIndex: number;
  readonly sceneHeight: number;
  readonly sceneWidth: number;
  readonly workspaceCount: number;
  readonly zoom: number;
}

export interface OverviewSpatialZoomTransaction {
  readonly anchorSceneY: number;
  readonly anchorWorkspacePosition: number;
  readonly currentWorkspaceIndex: number;
  readonly originContentY: number;
  readonly originMaximumContentY: number;
  readonly originZoom: number;
  readonly previewContentY: number;
  readonly previewMaximumContentY: number;
  readonly previewZoom: number;
  readonly sceneHeight: number;
  readonly sceneWidth: number;
  readonly workspaceCount: number;
}

export interface OverviewSpatialZoomPreviewInput {
  readonly scale: number;
  readonly transaction: OverviewSpatialZoomTransaction;
}

export interface OverviewSpatialZoomPlan {
  readonly contentY: number;
  readonly maximumContentY: number;
  readonly zoom: number;
}

export interface OverviewSpatialZoomPreviewPlan extends OverviewSpatialZoomPlan {
  readonly anchorClamped: boolean;
  readonly transaction: OverviewSpatialZoomTransaction;
}

export type OverviewSpatialZoomFinishDisposition = "cancel" | "commit";

export interface OverviewSpatialZoomFinishInput {
  readonly disposition: OverviewSpatialZoomFinishDisposition;
  readonly transaction: OverviewSpatialZoomTransaction;
}

interface SpatialZoomLayoutGeometry {
  readonly firstCardCenter: number;
  readonly layout: OverviewSpatialLayoutPlan;
  readonly maximumContentY: number;
  readonly stride: number;
}

export function planOverviewSpatialZoomLevel(
  input: unknown,
): OverviewSpatialZoomLevelPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const intent = input["intent"];
    const currentZoom = input["currentZoom"];

    if (!isZoom(currentZoom)) {
      return null;
    }

    let zoom: number;

    if (intent === "reset") {
      const configuredZoom = input["configuredZoom"];
      if (!isZoom(configuredZoom)) {
        return null;
      }

      zoom = configuredZoom;
    } else if (intent === "step") {
      const direction = input["direction"];
      const steps = input["steps"];

      if (!isStepDirection(direction) || !isStepCount(steps)) {
        return null;
      }

      const signedSteps = direction === "in" ? steps : -steps;
      const requestedZoom =
        currentZoom + signedSteps * OVERVIEW_SPATIAL_ZOOM_LIMITS.step;
      zoom = clampZoom(roundZoomStep(requestedZoom));
    } else {
      return null;
    }

    const scale = zoom / currentZoom;
    if (!isPositiveFiniteNumber(scale)) {
      return null;
    }

    return Object.freeze({
      atMaximum: zoom === OVERVIEW_SPATIAL_ZOOM_LIMITS.maximum,
      atMinimum: zoom === OVERVIEW_SPATIAL_ZOOM_LIMITS.minimum,
      changed: zoom !== currentZoom,
      scale,
      zoom,
    });
  } catch {
    return null;
  }
}

export function planOverviewSpatialZoomBegin(
  input: unknown,
): OverviewSpatialZoomTransaction | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const anchorSceneY = input["anchorSceneY"];
    const contentY = input["contentY"];
    const currentWorkspaceIndex = input["currentWorkspaceIndex"];
    const sceneHeight = input["sceneHeight"];
    const sceneWidth = input["sceneWidth"];
    const workspaceCount = input["workspaceCount"];
    const zoom = input["zoom"];

    if (
      !isPositiveFiniteNumber(sceneHeight) ||
      !isPositiveFiniteNumber(sceneWidth) ||
      !isNonNegativeFiniteNumber(anchorSceneY) ||
      anchorSceneY > sceneHeight ||
      !isNonNegativeFiniteNumber(contentY) ||
      !isWorkspaceCount(workspaceCount) ||
      !isWorkspaceIndex(currentWorkspaceIndex, workspaceCount) ||
      !isZoom(zoom)
    ) {
      return null;
    }

    const geometry = readSpatialZoomLayoutGeometry(
      sceneHeight,
      sceneWidth,
      workspaceCount,
      currentWorkspaceIndex,
      zoom,
    );

    if (geometry === null || contentY > geometry.maximumContentY) {
      return null;
    }

    const anchorWorkspacePosition =
      (contentY + anchorSceneY - geometry.firstCardCenter) / geometry.stride;

    if (!isFiniteNumber(anchorWorkspacePosition)) {
      return null;
    }

    return freezeSpatialZoomTransaction({
      anchorSceneY,
      anchorWorkspacePosition,
      currentWorkspaceIndex,
      originContentY: contentY,
      originMaximumContentY: geometry.maximumContentY,
      originZoom: zoom,
      previewContentY: contentY,
      previewMaximumContentY: geometry.maximumContentY,
      previewZoom: zoom,
      sceneHeight,
      sceneWidth,
      workspaceCount,
    });
  } catch {
    return null;
  }
}

export function planOverviewSpatialZoomPreview(
  input: unknown,
): OverviewSpatialZoomPreviewPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const scale = input["scale"];
    const transaction = readSpatialZoomTransaction(input["transaction"]);

    if (
      !isFiniteNumber(scale) ||
      scale < OVERVIEW_SPATIAL_ZOOM_LIMITS.minimumPreviewScale ||
      scale > OVERVIEW_SPATIAL_ZOOM_LIMITS.maximumPreviewScale ||
      transaction === null
    ) {
      return null;
    }

    const requestedZoom = transaction.originZoom * scale;
    if (!isPositiveFiniteNumber(requestedZoom)) {
      return null;
    }

    const zoom = clampZoom(requestedZoom);
    const geometry = readSpatialZoomLayoutGeometry(
      transaction.sceneHeight,
      transaction.sceneWidth,
      transaction.workspaceCount,
      transaction.currentWorkspaceIndex,
      zoom,
    );

    if (geometry === null) {
      return null;
    }

    const requestedContentY =
      geometry.firstCardCenter +
      transaction.anchorWorkspacePosition * geometry.stride -
      transaction.anchorSceneY;

    if (!isFiniteNumber(requestedContentY)) {
      return null;
    }

    const viewport = planOverviewSpatialViewport({
      contentHeight: geometry.layout.contentHeight,
      contentY: requestedContentY,
      sceneHeight: transaction.sceneHeight,
    });

    if (viewport === null) {
      return null;
    }

    const nextTransaction = freezeSpatialZoomTransaction({
      ...transaction,
      previewContentY: viewport.contentY,
      previewMaximumContentY: viewport.maximumContentY,
      previewZoom: zoom,
    });

    return Object.freeze({
      anchorClamped:
        requestedContentY < 0 || requestedContentY > geometry.maximumContentY,
      contentY: viewport.contentY,
      maximumContentY: viewport.maximumContentY,
      transaction: nextTransaction,
      zoom,
    });
  } catch {
    return null;
  }
}

export function planOverviewSpatialZoomFinish(
  input: unknown,
): OverviewSpatialZoomPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const disposition = input["disposition"];
    const transaction = readSpatialZoomTransaction(input["transaction"]);

    if (
      (disposition !== "cancel" && disposition !== "commit") ||
      transaction === null
    ) {
      return null;
    }

    return disposition === "cancel"
      ? Object.freeze({
          contentY: transaction.originContentY,
          maximumContentY: transaction.originMaximumContentY,
          zoom: transaction.originZoom,
        })
      : Object.freeze({
          contentY: transaction.previewContentY,
          maximumContentY: transaction.previewMaximumContentY,
          zoom: transaction.previewZoom,
        });
  } catch {
    return null;
  }
}

function readSpatialZoomLayoutGeometry(
  sceneHeight: unknown,
  sceneWidth: unknown,
  workspaceCount: unknown,
  currentWorkspaceIndex: unknown,
  zoom: unknown,
): SpatialZoomLayoutGeometry | null {
  const layout = planOverviewSpatialLayout({
    currentWorkspaceIndex,
    sceneHeight,
    sceneWidth,
    workspaceCount,
    zoom,
  });

  if (layout === null || !isPositiveFiniteNumber(sceneHeight)) {
    return null;
  }

  const stride = layout.cardHeight + layout.gap;
  const firstCardCenter = layout.edgeMargin + layout.cardHeight / 2;
  const maximumContentY = layout.contentHeight - sceneHeight;

  if (
    !isPositiveFiniteNumber(stride) ||
    !isNonNegativeFiniteNumber(firstCardCenter) ||
    !isNonNegativeFiniteNumber(maximumContentY)
  ) {
    return null;
  }

  return {
    firstCardCenter,
    layout,
    maximumContentY,
    stride,
  };
}

function readSpatialZoomTransaction(
  value: unknown,
): OverviewSpatialZoomTransaction | null {
  if (!isRecord(value)) {
    return null;
  }

  const anchorSceneY = value["anchorSceneY"];
  const anchorWorkspacePosition = value["anchorWorkspacePosition"];
  const currentWorkspaceIndex = value["currentWorkspaceIndex"];
  const originContentY = value["originContentY"];
  const originMaximumContentY = value["originMaximumContentY"];
  const originZoom = value["originZoom"];
  const previewContentY = value["previewContentY"];
  const previewMaximumContentY = value["previewMaximumContentY"];
  const previewZoom = value["previewZoom"];
  const sceneHeight = value["sceneHeight"];
  const sceneWidth = value["sceneWidth"];
  const workspaceCount = value["workspaceCount"];

  if (
    !isPositiveFiniteNumber(sceneHeight) ||
    !isPositiveFiniteNumber(sceneWidth) ||
    !isNonNegativeFiniteNumber(anchorSceneY) ||
    anchorSceneY > sceneHeight ||
    !isFiniteNumber(anchorWorkspacePosition) ||
    !isNonNegativeFiniteNumber(originContentY) ||
    !isNonNegativeFiniteNumber(originMaximumContentY) ||
    !isZoom(originZoom) ||
    !isNonNegativeFiniteNumber(previewContentY) ||
    !isNonNegativeFiniteNumber(previewMaximumContentY) ||
    !isZoom(previewZoom) ||
    !isWorkspaceCount(workspaceCount) ||
    !isWorkspaceIndex(currentWorkspaceIndex, workspaceCount)
  ) {
    return null;
  }

  const originGeometry = readSpatialZoomLayoutGeometry(
    sceneHeight,
    sceneWidth,
    workspaceCount,
    currentWorkspaceIndex,
    originZoom,
  );
  const previewGeometry = readSpatialZoomLayoutGeometry(
    sceneHeight,
    sceneWidth,
    workspaceCount,
    currentWorkspaceIndex,
    previewZoom,
  );

  if (
    originGeometry === null ||
    previewGeometry === null ||
    originContentY > originGeometry.maximumContentY ||
    previewContentY > previewGeometry.maximumContentY ||
    originMaximumContentY !== originGeometry.maximumContentY ||
    previewMaximumContentY !== previewGeometry.maximumContentY
  ) {
    return null;
  }

  const expectedAnchorWorkspacePosition =
    (originContentY + anchorSceneY - originGeometry.firstCardCenter) /
    originGeometry.stride;
  const requestedPreviewContentY =
    previewGeometry.firstCardCenter +
    anchorWorkspacePosition * previewGeometry.stride -
    anchorSceneY;
  const expectedPreviewViewport = planOverviewSpatialViewport({
    contentHeight: previewGeometry.layout.contentHeight,
    contentY: requestedPreviewContentY,
    sceneHeight,
  });
  const previewIsOrigin =
    previewZoom === originZoom &&
    previewContentY === originContentY &&
    previewMaximumContentY === originMaximumContentY;

  if (
    !isFiniteNumber(expectedAnchorWorkspacePosition) ||
    expectedPreviewViewport === null ||
    anchorWorkspacePosition !== expectedAnchorWorkspacePosition ||
    (!previewIsOrigin && previewContentY !== expectedPreviewViewport.contentY)
  ) {
    return null;
  }

  return freezeSpatialZoomTransaction({
    anchorSceneY,
    anchorWorkspacePosition,
    currentWorkspaceIndex,
    originContentY,
    originMaximumContentY,
    originZoom,
    previewContentY,
    previewMaximumContentY,
    previewZoom,
    sceneHeight,
    sceneWidth,
    workspaceCount,
  });
}

function freezeSpatialZoomTransaction(
  transaction: OverviewSpatialZoomTransaction,
): OverviewSpatialZoomTransaction {
  return Object.freeze({
    ...transaction,
    anchorSceneY: normalizeZero(transaction.anchorSceneY),
    anchorWorkspacePosition: normalizeZero(transaction.anchorWorkspacePosition),
    originContentY: normalizeZero(transaction.originContentY),
    originMaximumContentY: normalizeZero(transaction.originMaximumContentY),
    previewContentY: normalizeZero(transaction.previewContentY),
    previewMaximumContentY: normalizeZero(transaction.previewMaximumContentY),
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

function isZoom(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    value >= OVERVIEW_SPATIAL_ZOOM_LIMITS.minimum &&
    value <= OVERVIEW_SPATIAL_ZOOM_LIMITS.maximum
  );
}

function isStepDirection(
  value: unknown,
): value is OverviewSpatialZoomStepDirection {
  return value === "in" || value === "out";
}

function isStepCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= OVERVIEW_SPATIAL_ZOOM_LIMITS.maximumSteps
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

function clampZoom(value: number): number {
  return Math.min(
    Math.max(value, OVERVIEW_SPATIAL_ZOOM_LIMITS.minimum),
    OVERVIEW_SPATIAL_ZOOM_LIMITS.maximum,
  );
}

function roundZoomStep(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
