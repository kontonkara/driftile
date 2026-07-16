import {
  projectOverviewLayout,
  type OverviewLayoutProjectionResult,
  type OverviewLiveLayout,
} from "./layout-view";

export { findOverviewNavigationTarget } from "./navigation";
export { planOverviewDesktopDrop } from "./desktop-drop";
export { planOverviewWindowDesktopDrop } from "./window-drop";
export {
  appendOverviewSearchText,
  matchesOverviewWindowSearch,
  removeLastOverviewSearchCharacter,
} from "./window-search";

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
