import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scene = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewScene.qml",
    import.meta.url,
  ),
  "utf8",
);
const runtime = readFileSync(
  new URL("../src/overview/runtime.ts", import.meta.url),
  "utf8",
);
const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);

function section(start: string, end: string): string {
  const startIndex = scene.indexOf(start);
  const endIndex = scene.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return scene.slice(startIndex, endIndex);
}

describe("overview desktop surface residency scene", () => {
  const residency = section(
    "function fallbackSpatialVisibleRange()",
    "function validatedDesktopSurfaceLifecycleEvent()",
  );
  const surfacePolicy = section(
    "function desktopSurfaceShouldLoad(",
    "function desktopCardAt(",
  );
  const updateResidency = section(
    "function updateDesktopSurfaceResidency()",
    "function planDesktopSurfaceResidency(",
  );

  it("keeps transient invalid geometry bounded instead of loading every card", () => {
    expect(scene).toMatch(
      /readonly property int desktopSurfaceMaximumResidentRows: \{[\s\S]*runtime\.MAXIMUM_RESIDENT_ROWS/u,
    );
    expect(scene).toMatch(
      /readonly property var overviewSpatialVisibleRange:\s*spatialVisibleRangeIsValid\(overviewSpatialVisibleRangePlan\)\s*\? overviewSpatialVisibleRangePlan : fallbackSpatialVisibleRange\(\)/u,
    );
    expect(residency).toMatch(
      /function fallbackSpatialVisibleRange\(\)[\s\S]*firstIndex: currentWorkspaceIndex,[\s\S]*lastIndex: currentWorkspaceIndex[\s\S]*lastIndex: -1/u,
    );
    expect(
      section(
        "function fallbackSpatialVisibleRange()",
        "function restartDesktopSurfaceResidency()",
      ),
    ).not.toContain("desktopSurfaceResidencyRange");
    expect(updateResidency).toMatch(
      /if \(candidate === null\)[\s\S]*spatialVisibleRangeIsValid\(desktopSurfaceResidencyRange\)[\s\S]*planDesktopSurfaceResidency\(null, retained, false, true\)/u,
    );
    expect(scene).not.toContain("allDesktopCardsRange");
  });

  it("keeps the settled source frozen while exact candidates advance", () => {
    expect(runtime).toContain("planOverviewDesktopSurfaceResidency");
    expect(runtime).toContain("MAXIMUM_RESIDENT_ROWS");
    expect(scene).toContain("property var desktopSurfaceCandidateRange: null");
    expect(updateResidency).toMatch(
      /desktopSurfaceCandidateRange = candidate;[\s\S]*if \(!spatialVisibleRangeIsValid\(desktopSurfaceCommittedRange\)\) \{\s*desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange\(candidate\);\s*\}[\s\S]*const previous = copyDesktopSurfaceResidencyRange\(desktopSurfaceCommittedRange\)/u,
    );
    expect(updateResidency).toMatch(
      /planDesktopSurfaceResidency\(candidate, previous, true,\s*desktopSurfaceResidencyShouldPinCurrent\(candidate\)\)/u,
    );
    for (const field of [
      "candidateRange: candidate",
      "currentWorkspaceIndex",
      "pinCurrent",
      "previousRange: previous",
      "retainPrevious",
      "workspaceCount: desktopIds.length",
    ]) {
      expect(residency).toContain(field);
    }
    expect(residency).toMatch(
      /function desktopSurfaceResidencyPlanIsValid\(plan\)[\s\S]*Object\.isFrozen\(plan\)[\s\S]*desktopSurfaceMaximumResidentRows/u,
    );
  });

  it("preloads the destination before releasing the previous resident range", () => {
    expect(updateResidency).toMatch(
      /desktopSurfaceResidencyRange = plan;[\s\S]*scheduleDesktopSurfaceResidencySettle\(candidate\)/u,
    );
    expect(residency).toMatch(
      /Qt\.callLater\(root\.advanceDesktopSurfaceResidencySettle, requestId, expectation, 0\)/u,
    );
    expect(residency).toMatch(
      /if \(stage === 0\)[\s\S]*Qt\.callLater\(root\.advanceDesktopSurfaceResidencySettle, requestId, expectation, 1\)/u,
    );
    expect(residency).toMatch(
      /stage !== 1[\s\S]*planDesktopSurfaceResidency\(expectation\.candidate, null, false,/u,
    );
    expect(residency).toMatch(
      /desktopSurfaceResidencyExpectationIsExact[\s\S]*requestId === desktopSurfaceResidencyRequestId[\s\S]*expectation\.candidate, desktopSurfaceCandidateRange[\s\S]*expectation\.candidate, overviewSpatialVisibleRangePlan/u,
    );
  });

  it("holds the bounded union through camera and zoom transactions", () => {
    expect(residency).toMatch(
      /function desktopSurfaceResidencyBridgeIsActive\(\)[\s\S]*spatialVisualContentYDeferred[\s\S]*spatialVerticalCameraAnimation\.running[\s\S]*spatialZoomOwner\.length > 0[\s\S]*spatialZoomTransaction !== null[\s\S]*spatialExternalZoomTransaction !== null[\s\S]*spatialExternalZoomActive/u,
    );
    expect(updateResidency).toMatch(
      /if \(!desktopSurfaceResidencyBridgeIsActive\(\)[\s\S]*desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange\(candidate\);[\s\S]*else if \(!desktopSurfaceResidencyBridgeIsActive\(\)\)[\s\S]*scheduleDesktopSurfaceResidencySettle\(candidate\)/u,
    );
    for (const handler of [
      "onSpatialExternalZoomActiveChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onSpatialExternalZoomTransactionChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onSpatialVisualContentYDeferredChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onSpatialZoomApplyingChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onSpatialZoomOwnerChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onSpatialZoomTransactionChanged: root.finishDesktopSurfaceResidencyBridge()",
      "onRunningChanged: root.finishDesktopSurfaceResidencyBridge()",
    ]) {
      expect(scene).toContain(handler);
    }
    expect(residency).toMatch(
      /function finishDesktopSurfaceResidencyBridge\(\)[\s\S]*planDesktopSurfaceResidency\(candidate, null, false,[\s\S]*desktopSurfaceCandidateRange = copyDesktopSurfaceResidencyRange\(candidate\);[\s\S]*desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange\(candidate\);[\s\S]*desktopSurfaceResidencyRange = plan;/u,
    );
  });

  it("isolates residency by session, output, activity, and desktop topology", () => {
    for (const handler of [
      "onActiveOverviewSessionIdChanged: root.restartDesktopSurfaceResidency()",
      "onActiveOverviewActivityIdChanged: root.restartDesktopSurfaceResidency()",
      "onOverviewSpatialVisibleRangePlanChanged: root.updateDesktopSurfaceResidency()",
    ]) {
      expect(scene).toContain(handler);
    }
    expect(scene).toMatch(
      /onOutputIdChanged:[\s\S]*restartDesktopSurfaceResidency\(\)/u,
    );
    expect(scene).toMatch(
      /onDesktopIdsChanged:[\s\S]*handleDesktopSurfaceResidencyDesktopIdsChanged\(\)/u,
    );
    expect(residency).toMatch(
      /function handleDesktopSurfaceResidencyDesktopIdsChanged\(\)[\s\S]*desktopSurfaceResidencyContextMatchesCurrent\(\)[\s\S]*Qt\.callLater\(root\.updateDesktopSurfaceResidency\)[\s\S]*restartDesktopSurfaceResidency\(\)/u,
    );
    expect(residency).toMatch(
      /desktopSurfaceResidencyContextMatchesCurrent\(\)[\s\S]*desktopSurfaceResidencySessionId === activeOverviewSessionId[\s\S]*desktopSurfaceResidencyOutputId === outputId[\s\S]*desktopSurfaceResidencyActivityId === activeOverviewActivityId[\s\S]*sameStringList\(desktopSurfaceResidencyDesktopIds, desktopIds\)/u,
    );
    expect(residency).toMatch(
      /function resetDesktopSurfaceResidency\(\)[\s\S]*desktopSurfaceCandidateRange = null;[\s\S]*desktopSurfaceCommittedRange = null;[\s\S]*desktopSurfaceResidencyRange = null;[\s\S]*desktopSurfaceResidencyDesktopIds = \[\];/u,
    );
  });

  it("keeps exact resident hosts loaded without admitting them to input", () => {
    expect(surfacePolicy).toContain(
      "desktopSurfaceResidencyContextMatchesCurrent()",
    );
    expect(surfacePolicy).toContain(
      "spatialVisibleRangeIsValid(desktopSurfaceResidencyRange)",
    );
    expect(surfacePolicy).toContain(
      "index >= desktopSurfaceResidencyRange.firstIndex",
    );
    expect(surfacePolicy).toContain(
      "index <= desktopSurfaceResidencyRange.lastIndex",
    );
    expect(surfacePolicy).not.toMatch(
      /searchQuery|desktopReorderActive|spatialWindowDragSource/u,
    );

    const cardPolicy = section(
      "function desktopCardShouldLoad(",
      "function desktopSurfaceShouldLoad(",
    );
    expect(cardPolicy).toMatch(
      /function desktopCardShouldLoad[\s\S]*desktopCardInteractionEligible[\s\S]*desktopSurfaceResidencyContextMatchesCurrent\(\)[\s\S]*desktopSurfaceResidencyRange\.firstIndex[\s\S]*desktopSurfaceResidencyRange\.lastIndex/u,
    );
    expect(cardPolicy).toContain("if (searchQuery.length > 0");
    expect(cardPolicy).toContain("desktopReorderActive");
    expect(cardPolicy).toContain("spatialWindowDragSource !== null");
    expect(cardPolicy).toMatch(
      /return spatialVisibleRangeIsValid\(overviewSpatialVisibleRangePlan\)\s*&& index >= overviewSpatialVisibleRangePlan\.firstIndex\s*&& index <= overviewSpatialVisibleRangePlan\.lastIndex;/u,
    );
    expect(scene).toMatch(
      /DesktopCard \{[\s\S]*enabled: interactionEligible[\s\S]*interactionEligible: root\.desktopCardInteractionEligible\(/u,
    );
    expect(desktopCard).toContain("required property bool interactionEligible");
    expect(desktopCard).toMatch(
      /function collectNavigationTargets[\s\S]*if \(!interactionEligible[\s\S]*return targets;/u,
    );
    expect(
      section("function desktopCardAt(", "function beginWindowSpatialEdgePan("),
    ).toMatch(
      /loader\.active !== true \|\| !loader\.item[\s\S]*loader\.item\.desktopId !== expectedDesktopId[\s\S]*loader\.item\.interactionEligible !== true[\s\S]*return null;/u,
    );
  });

  it("adds no polling, layout ownership, private API, or unbounded fallback", () => {
    expect(residency).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|setTimeout|setInterval|repeat:\s*true|\.setValue\s*\(|createDesktop|removeDesktop|moveDesktop/u,
    );
    expect(residency).not.toMatch(
      /KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });
});
