import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);
const overviewScene = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewScene.qml",
    import.meta.url,
  ),
  "utf8",
);

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

const presentation = section(
  desktopCard,
  "id: windowPresentation",
  "id: thumbnailShell",
);
const touchHandler = section(
  desktopCard,
  "id: thumbnailTouchDragHandler",
  "id: thumbnailDragHandler",
);
const mouseHandler = section(
  desktopCard,
  "id: thumbnailDragHandler",
  "id: minimizedPlaceholderShell",
);
const dragCapture = section(
  desktopCard,
  "function captureWindowDragSnapshot(",
  "function ownedWindowDragSnapshotIsExact(",
);
const dragExactness = section(
  desktopCard,
  "function ownedWindowDragSnapshotIsExact(",
  "function beginWindowSpatialDrag(",
);
const dragLifecycle = section(
  desktopCard,
  "function beginWindowSpatialDrag(",
  "function spatialDragSourceIsOwned(",
);
const sceneWindowConnections = section(
  overviewScene,
  "target: root.spatialWindowDragSource",
  "target: root.spatialLiveCameraProbeWindow",
);
const sceneEdgePan = section(
  overviewScene,
  "function beginWindowSpatialEdgePan(",
  "function beginColumnSpatialEdgePan(",
);
const sceneVisual = section(
  overviewScene,
  "function captureSpatialWindowDragVisual(",
  "function captureSpatialColumnDragVisual(",
);

describe("overview window drag ownership lifecycle", () => {
  it("freezes exact source identity before publishing the owned lifecycle", () => {
    expect(presentation).toContain("property var windowDragSnapshot: null");
    expect(dragCapture).toContain("return Object.freeze({");
    expect(dragCapture).toContain("candidate: expectedCandidate");
    expect(dragCapture).toContain("context: expectedContext");
    expect(dragCapture).toContain("columns: expectedColumns");
    expect(dragCapture).toContain("desktopId: expectedDesktopId");
    expect(dragCapture).toContain("outputId: expectedOutputId");
    expect(dragCapture).toContain("screen: expectedScreen");
    expect(dragCapture).toContain("windowId: expectedWindowId");
    expect(dragLifecycle).toMatch(
      /const snapshot = captureWindowDragSnapshot\(source\);[\s\S]*source\.windowDragSnapshot = snapshot;[\s\S]*windowDragActiveSource = source;[\s\S]*source\.spatialDragLifecycleActive = true;[\s\S]*windowSpatialDragStarted/u,
    );
  });

  it("keeps the pointer handlers alive until their owned lifecycle finishes", () => {
    for (const handler of [touchHandler, mouseHandler]) {
      expect(handler).toMatch(
        /enabled: thumbnailShell\.visible && windowPresentation\.dragEligible[\s\S]*\|\| card\.windowDragHandlerOwnsLifecycle\(windowPresentation\)/u,
      );
      expect(handler).toMatch(
        /card\.beginWindowSpatialDrag\(windowPresentation, point\.scenePosition\);[\s\S]*if \(!windowPresentation\.spatialDragLifecycleActive\)[\s\S]*thumbnailShell\.Drag\.active = true;/u,
      );
      expect(handler).toContain(
        "windowPresentation.spatialDragLifecycleActive",
      );
    }
    expect(presentation).toMatch(
      /function cancelWindowDrag\(\)[\s\S]*thumbnailShell\.Drag\.cancel\(\);[\s\S]*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
  });

  it("tolerates benign reactive republishing but revalidates deferred drift", () => {
    expect(presentation).toContain(
      "onDragEligibleChanged: card.scheduleWindowSpatialDragValidation(windowPresentation)",
    );
    expect(presentation).toMatch(
      /onTiledPresentationChanged: \{\s*card\.scheduleWindowSpatialDragValidation\(windowPresentation\);\s*card\.schedulePresentationMotion\(\);\s*\}/u,
    );
    expect(desktopCard).toMatch(
      /onTiledPresentationsChanged:[\s\S]*card\.scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\);/u,
    );
    expect(presentation).toContain(
      "onActionSnapshotChanged: card.cancelInvalidWindowSpatialDragSource(windowPresentation)",
    );
    expect(dragExactness).toContain(
      "windowDragActionSnapshotIsExact(source.actionSnapshot, snapshot)",
    );
    expect(dragExactness).not.toContain("source.dragEligible === true");
    expect(dragLifecycle).toMatch(
      /function scheduleWindowSpatialDragValidation\([\s\S]*ownedWindowDragSnapshotIsExact\(source\)[\s\S]*advanceWindowDragValidationRevision\(\);[\s\S]*Qt\.callLater\([\s\S]*requestId === card\.windowDragValidationRevision[\s\S]*cancelInvalidWindowSpatialDragSource/u,
    );
  });

  it("cancels authoritative source and topology invalidations", () => {
    expect(presentation).toMatch(
      /onCandidateChanged:[\s\S]*card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);/u,
    );
    expect(presentation).toMatch(
      /onMinimizedWindowChanged: \{\s*card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);\s*card\.schedulePresentationMotion\(\);\s*\}/u,
    );
    expect(presentation).toContain(
      "Component.onDestruction: card.cancelWindowSpatialDragSource(windowPresentation)",
    );
    expect(sceneWindowConnections).toMatch(
      /function onCandidateChanged\(\)[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(sceneWindowConnections).toMatch(
      /function onSourceDesktopChanged\(\)[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(overviewScene).toMatch(
      /onOverviewModelChanged:[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(overviewScene).toMatch(
      /onDesktopTopologyRevisionChanged:[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);/u,
    );
  });

  it("keeps the frozen proxy visible through tolerated eligibility churn", () => {
    const visualExactness = section(
      overviewScene,
      "function spatialWindowDragVisualIsExact(",
      "function captureSpatialColumnDragVisual(",
    );
    expect(sceneVisual).toContain("snapshot,");
    expect(visualExactness).toContain(
      'typeof sourceCard.windowDragHandlerOwnsLifecycle === "function"',
    );
    expect(visualExactness).toContain(
      "sourceCard.windowDragHandlerOwnsLifecycle(source)",
    );
    expect(visualExactness).toContain(
      "plan.snapshot === source.windowDragSnapshot",
    );
    expect(visualExactness).not.toContain("windowSpatialDragSourceIsExact(");
  });

  it("atomically cancels failed capture and clears ownership idempotently", () => {
    expect(touchHandler).toMatch(
      /onActiveTranslationChanged:[\s\S]*if \(!thumbnailShell\.storeSpatialDragHotSpot\(scenePosition\)\) \{\s*thumbnailTouchDragHandler\.cancelSpatialDrag\(\);/u,
    );
    expect(mouseHandler).toMatch(
      /onActiveTranslationChanged:[\s\S]*if \(!thumbnailShell\.storeSpatialDragHotSpot\(scenePosition\)\) \{\s*card\.cancelWindowSpatialDragSource\(windowPresentation\);/u,
    );
    expect(sceneEdgePan).toMatch(
      /spatialWindowDragSource = source;[\s\S]*const visualCaptured = captureSpatialWindowDragVisual\(source\);[\s\S]*if \(!visualCaptured\)[\s\S]*cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(dragLifecycle).toMatch(
      /function finishWindowSpatialDrag\([\s\S]*const wasActive[\s\S]*const wasOwned[\s\S]*source\.spatialDragLifecycleActive = false;[\s\S]*windowDragActiveSource = null;[\s\S]*source\.windowDragSnapshot = null;[\s\S]*clearWindowDropHover\(\);[\s\S]*if \(wasActive\)[\s\S]*windowSpatialDragFinished/u,
    );
    expect(overviewScene).toMatch(
      /event\.key === Qt\.Key_Escape && spatialWindowDragSource !== null\)[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
  });
});
