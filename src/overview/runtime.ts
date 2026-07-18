import {
  projectOverviewLayout,
  type OverviewLayoutProjectionResult,
  type OverviewLiveLayout,
} from "./layout-view";

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
export { planOverviewSpatialLayout } from "./spatial-layout";
export type {
  OverviewSpatialLayoutInput,
  OverviewSpatialLayoutPlan,
} from "./spatial-layout";
export {
  planOverviewSpatialViewportAnchor,
  planOverviewSpatialViewport,
  planOverviewSpatialWorkspaceCenter,
} from "./spatial-viewport";
export type {
  OverviewSpatialViewportAnchorInput,
  OverviewSpatialViewportAnchorLayoutInput,
  OverviewSpatialViewportAnchorPlan,
  OverviewSpatialViewportInput,
  OverviewSpatialViewportPlan,
  OverviewSpatialWorkspaceCenterInput,
} from "./spatial-viewport";
export {
  planOverviewSpatialWheel,
  planOverviewSpatialWorkspaceWheelTarget,
} from "./spatial-wheel";
export type {
  OverviewSpatialViewportWheelPlan,
  OverviewSpatialWheelDirection,
  OverviewSpatialWheelInput,
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
