import {
  projectOverviewLayout,
  type OverviewLayoutProjectionResult,
  type OverviewLiveLayout,
} from "./layout-view";

export { createOverviewActivationCache } from "./activation-cache";
export {
  captureOverviewExitHandoff,
  planOverviewExitHandoffTransition,
} from "./exit-handoff";

export { hasAutomaticFloatingRole } from "../core/window-classification";
export {
  countOverviewWindowNavigationTargets,
  findOverviewNavigationTarget,
  findOverviewSequentialNavigationTarget,
  planOverviewWheelNavigation,
  summarizeOverviewWindowNavigationTargets,
} from "./navigation";
export type {
  OverviewWheelNavigationPlan,
  OverviewWindowNavigationTargetSummary,
} from "./navigation";
export { planOverviewDesktopLabel } from "./desktop-label";
export type { OverviewDesktopLabelPlan } from "./desktop-label";
export { planOverviewDesktopSurfaceLifecycleRefresh } from "./desktop-surface-lifecycle";
export type {
  OverviewDesktopSurfaceLifecycleEvent,
  OverviewDesktopSurfaceLifecycleRefreshInput,
  OverviewDesktopSurfaceLifecycleRefreshPlan,
  OverviewDesktopSurfaceLifecycleScope,
} from "./desktop-surface-lifecycle";
export {
  MAXIMUM_RESIDENT_ROWS,
  planOverviewDesktopSurfaceResidency,
} from "./desktop-surface-residency";
export type {
  OverviewDesktopSurfaceResidencyInput,
  OverviewDesktopSurfaceResidencyPlan,
  OverviewDesktopSurfaceResidencyRange,
} from "./desktop-surface-residency";
export { planOverviewTouchPanAxis } from "./touch-pan";
export type {
  OverviewTouchPanAxis,
  OverviewTouchPanAxisInput,
  OverviewTouchPanAxisPlan,
} from "./touch-pan";
export { planOverviewOutputLabel } from "./output-label";
export type { OverviewOutputLabelPlan } from "./output-label";
export { planOverviewDesktopDrop } from "./desktop-drop";
export { planOverviewMinimizedPlaceholder } from "./minimized-placeholder";
export type { OverviewMinimizedPlaceholderRect } from "./minimized-placeholder";
export { planOverviewWindowDesktopDrop } from "./window-drop";
export { planOverviewWindowLabel } from "./window-label";
export type { OverviewWindowLabelPlan } from "./window-label";
export { planOverviewWindowState } from "./window-state";
export type {
  OverviewWindowStateBadge,
  OverviewWindowStatePlan,
} from "./window-state";
export {
  appendOverviewSearchText,
  matchesOverviewWindowSearchPlan,
  matchesOverviewWindowSearch,
  planOverviewWindowSearchQuery,
  removeLastOverviewSearchCharacter,
  removeLastOverviewSearchClause,
} from "./window-search";
export type {
  OverviewWindowSearchFieldName,
  OverviewWindowSearchQueryClause,
  OverviewWindowSearchQueryGroup,
  OverviewWindowSearchQueryPlan,
} from "./window-search";
export {
  OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS,
  planOverviewSpatialLayout,
} from "./spatial-layout";
export type {
  OverviewSpatialLayoutInput,
  OverviewSpatialLayoutPlan,
} from "./spatial-layout";
export {
  OVERVIEW_SPATIAL_ZOOM_LIMITS,
  planOverviewSpatialZoomBegin,
  planOverviewSpatialZoomFinish,
  planOverviewSpatialZoomLevel,
  planOverviewSpatialZoomPreview,
} from "./spatial-zoom";
export type {
  OverviewSpatialZoomBeginInput,
  OverviewSpatialZoomFinishDisposition,
  OverviewSpatialZoomFinishInput,
  OverviewSpatialZoomLevelInput,
  OverviewSpatialZoomLevelPlan,
  OverviewSpatialZoomPlan,
  OverviewSpatialZoomPreviewInput,
  OverviewSpatialZoomPreviewPlan,
  OverviewSpatialZoomStepDirection,
  OverviewSpatialZoomTransaction,
} from "./spatial-zoom";
export {
  planOverviewSpatialViewportAnchor,
  planOverviewSpatialViewport,
  planOverviewSpatialWorkspaceCenter,
  planOverviewSpatialWorkspaceSettle,
} from "./spatial-viewport";
export type {
  OverviewSpatialViewportAnchorInput,
  OverviewSpatialViewportAnchorLayoutInput,
  OverviewSpatialViewportAnchorPlan,
  OverviewSpatialViewportInput,
  OverviewSpatialViewportPlan,
  OverviewSpatialWorkspaceCenterInput,
  OverviewSpatialWorkspaceSettleInput,
  OverviewSpatialWorkspaceSettlePlan,
} from "./spatial-viewport";
export {
  normalizeOverviewPhysicalWheelAngleDelta,
  normalizeOverviewPhysicalWheelPixelDelta,
  planOverviewSpatialWheelAxis,
  planOverviewSpatialWheel,
  planOverviewSpatialWorkspaceWheelTarget,
} from "./spatial-wheel";
export type {
  OverviewSpatialViewportWheelPlan,
  OverviewSpatialWheelAxis,
  OverviewSpatialWheelAxisInput,
  OverviewSpatialWheelAxisPlan,
  OverviewSpatialWheelDirection,
  OverviewSpatialWheelInput,
  OverviewSpatialWheelInputMode,
  OverviewSpatialWheelPlan,
  OverviewSpatialWorkspaceWheelPlan,
  OverviewSpatialWorkspaceWheelTargetInput,
  OverviewSpatialWorkspaceWheelTargetPlan,
} from "./spatial-wheel";
export { planOverviewSpatialHorizontalWheel } from "./spatial-horizontal-wheel";
export type {
  OverviewSpatialHorizontalSelectionWheelPlan,
  OverviewSpatialHorizontalViewportWheelPlan,
  OverviewSpatialHorizontalWheelDirection,
  OverviewSpatialHorizontalWheelInput,
  OverviewSpatialHorizontalWheelPlan,
} from "./spatial-horizontal-wheel";
export { planOverviewSpatialHorizontalDrag } from "./spatial-horizontal-drag";
export type {
  OverviewSpatialHorizontalDragInput,
  OverviewSpatialHorizontalDragPlan,
} from "./spatial-horizontal-drag";
export { planOverviewSpatialDragHover } from "./spatial-drag-hover";
export type {
  OverviewSpatialDragHoverInput,
  OverviewSpatialDragHoverIntent,
  OverviewSpatialDragHoverPlan,
} from "./spatial-drag-hover";
export {
  decodeSpatialDropCommand,
  encodeSpatialDropCommand,
} from "./spatial-drop-command";
export type {
  SpatialDropCommand,
  SpatialDropSource,
  SpatialDropSourceScope,
  SpatialDropTarget,
} from "./spatial-drop-command";
export {
  buildOverviewSpatialWindowDropPlan,
  hitTestOverviewSpatialWindowDrop,
} from "./spatial-window-drop";
export type {
  OverviewSpatialWindowDropPlan,
  OverviewSpatialWindowDropTarget,
} from "./spatial-window-drop";
export { planOverviewSpatialWorkspaceGap } from "./spatial-workspace-drop";
export type {
  OverviewSpatialWorkspaceGapInput,
  OverviewSpatialWorkspaceGapPlan,
} from "./spatial-workspace-drop";
export { planOverviewSpatialHorizontalEdgePan } from "./spatial-horizontal-edge-pan";
export type {
  OverviewSpatialHorizontalEdgePanDirection,
  OverviewSpatialHorizontalEdgePanInput,
  OverviewSpatialHorizontalEdgePanPlan,
} from "./spatial-horizontal-edge-pan";
export { planOverviewSpatialEdgePan } from "./spatial-edge-pan";
export type {
  OverviewSpatialEdgePanDirection,
  OverviewSpatialEdgePanInput,
  OverviewSpatialEdgePanPlan,
} from "./spatial-edge-pan";
export { planOverviewSpatialVisibleRange } from "./spatial-visible-range";
export type {
  OverviewSpatialVisibleRangeInput,
  OverviewSpatialVisibleRangePlan,
} from "./spatial-visible-range";
export {
  planOverviewSpatialLiveCamera,
  planOverviewSpatialRowGeometry,
} from "./spatial-row-geometry";
export type {
  OverviewSpatialLiveCameraInput,
  OverviewSpatialLiveCameraPlan,
  OverviewSpatialRowCamera,
  OverviewSpatialRowColumnFrame,
  OverviewSpatialRowDimensions,
  OverviewSpatialRowGeometryColumnInput,
  OverviewSpatialRowGeometryInput,
  OverviewSpatialRowGeometryPlan,
} from "./spatial-row-geometry";
export {
  aggregateOverviewSpatialLiveColumnGeometry,
  projectOverviewSpatialLiveGeometry,
} from "./spatial-live-geometry";
export type {
  OverviewSpatialLiveColumnGeometryInput,
  OverviewSpatialLiveColumnGeometryPlan,
  OverviewSpatialLiveGeometryFrame,
  OverviewSpatialLiveGeometryInput,
  OverviewSpatialLiveGeometryPlan,
} from "./spatial-live-geometry";

export type OverviewModelLoadResult =
  | OverviewLayoutProjectionResult
  | {
      readonly error: "invalid-live-layout";
      readonly ok: false;
    };

export function loadOverviewModel(
  document: unknown,
  live: unknown,
): OverviewModelLoadResult {
  try {
    if (typeof document !== "string") {
      return { error: "missing-state", ok: false };
    }

    if (!isOverviewLiveLayout(live)) {
      return { error: "invalid-live-layout", ok: false };
    }

    return projectOverviewLayout(document, live);
  } catch {
    return { error: "invalid-live-layout", ok: false };
  }
}

function isOverviewLiveLayout(value: unknown): value is OverviewLiveLayout {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate["activityIds"]) &&
    typeof candidate["currentActivityId"] === "string" &&
    Array.isArray(candidate["desktopIds"]) &&
    Array.isArray(candidate["outputs"]) &&
    Array.isArray(candidate["windowIds"])
  );
}
