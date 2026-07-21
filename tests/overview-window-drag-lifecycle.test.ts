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
const tabShell = section(desktopCard, "id: tabShell", "id: thumbnailShell");
const tabTouchHoldHandler = section(
  desktopCard,
  "id: tabTouchHoldHandler",
  "id: tabTouchDragHandler",
);
const tabTouchHandler = section(
  desktopCard,
  "id: tabTouchDragHandler",
  "id: tabDragHandler",
);
const tabPointerHandler = section(
  desktopCard,
  "id: tabDragHandler",
  "acceptedButtons: Qt.MiddleButton",
);
const thumbnailTouchHandler = section(
  desktopCard,
  "id: thumbnailTouchDragHandler",
  "id: thumbnailDragHandler",
);
const thumbnailPointerHandler = section(
  desktopCard,
  "id: thumbnailDragHandler",
  "id: minimizedPlaceholderShell",
);
const dragHandlerOwnership = section(
  desktopCard,
  "function windowDragHandlerOwnsLifecycle(",
  "function windowDragSurfaceIsExact(",
);
const dragSurfaceExactness = section(
  desktopCard,
  "function windowDragSurfaceIsExact(",
  "function windowDragActionSnapshotIsExact(",
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
  it("freezes the exact source surface before publishing the owned lifecycle", () => {
    expect(presentation).toContain("property var windowDragSnapshot: null");
    expect(dragCapture).toMatch(
      /function captureWindowDragSnapshot\(source,\s*surfaceKind,\s*surfaceTarget\)/u,
    );
    expect(dragCapture).toMatch(
      /const expectedSurfaceFrame = surfaceKind === "thumbnail"\s*\? source\.frame : source\.tabFrame;/u,
    );
    expect(dragCapture).toContain(
      "const expectedSurfaceHeight = surfaceTarget.height;",
    );
    expect(dragCapture).toContain(
      "const expectedSurfaceWidth = surfaceTarget.width;",
    );
    expect(dragCapture).toContain("return Object.freeze({");
    expect(dragCapture).toContain("candidate: expectedCandidate");
    expect(dragCapture).toContain("context: expectedContext");
    expect(dragCapture).toContain("columns: expectedColumns");
    expect(dragCapture).toContain("desktopId: expectedDesktopId");
    expect(dragCapture).toContain("outputId: expectedOutputId");
    expect(dragCapture).toContain("screen: expectedScreen");
    expect(dragCapture).toContain("surfaceFrame: expectedSurfaceFrame");
    expect(dragCapture).toContain("surfaceHeight: expectedSurfaceHeight");
    expect(dragCapture).toContain("surfaceKind,");
    expect(dragCapture).toContain("surfaceTarget,");
    expect(dragCapture).toContain("surfaceWidth: expectedSurfaceWidth");
    expect(dragCapture).toContain("windowId: expectedWindowId");
    expect(dragLifecycle).toMatch(
      /function beginWindowSpatialDrag\(source,\s*surfaceKind,\s*surfaceTarget,\s*scenePosition\)[\s\S]*const snapshot = captureWindowDragSnapshot\(source, surfaceKind, surfaceTarget\);[\s\S]*source\.windowDragSnapshot = snapshot;[\s\S]*windowDragActiveSource = source;[\s\S]*source\.spatialDragLifecycleActive = true;[\s\S]*windowSpatialDragStarted/u,
    );
  });

  it("keeps each source-surface handler alive only for its owned lifecycle", () => {
    expect(dragHandlerOwnership).toMatch(
      /function windowDragHandlerOwnsLifecycle\(source,\s*surfaceKind,\s*surfaceTarget\)/u,
    );
    expect(dragHandlerOwnership).toContain(
      'surfaceKind === "thumbnail" || surfaceKind === "tab"',
    );
    expect(dragHandlerOwnership).toContain(
      "snapshot.surfaceKind === surfaceKind",
    );
    expect(dragHandlerOwnership).toContain(
      "snapshot.surfaceTarget === surfaceTarget",
    );

    for (const handler of [tabTouchHandler, tabPointerHandler]) {
      expect(handler).toMatch(
        /enabled: \(tabShell\.visible && tabShell\.spatialDragEligible[\s\S]*!card\.spatialDirectDragBlocked\)\s*\|\| card\.windowDragHandlerOwnsLifecycle\(\s*windowPresentation, "tab", tabShell\)/u,
      );
      expect(handler).toMatch(
        /card\.beginWindowSpatialDrag\(windowPresentation, "tab", tabShell,[\s\S]*point\.scenePosition\);[\s\S]*if \(!windowPresentation\.spatialDragLifecycleActive\)[\s\S]*tabShell\.Drag\.active = true;/u,
      );
      expect(handler).not.toContain("thumbnailShell.Drag");
    }
    for (const handler of [thumbnailTouchHandler, thumbnailPointerHandler]) {
      expect(handler).toMatch(
        /enabled: thumbnailShell\.visible && windowPresentation\.dragEligible[\s\S]*\|\| card\.windowDragHandlerOwnsLifecycle\(\s*windowPresentation, "thumbnail", thumbnailShell\)/u,
      );
      expect(handler).toMatch(
        /card\.beginWindowSpatialDrag\(windowPresentation, "thumbnail",[\s\S]*thumbnailShell, point\.scenePosition\);[\s\S]*if \(!windowPresentation\.spatialDragLifecycleActive\)[\s\S]*thumbnailShell\.Drag\.active = true;/u,
      );
      expect(handler).not.toContain("tabShell.Drag");
    }
    expect(presentation).toMatch(
      /function cancelWindowDrag\(\)[\s\S]*thumbnailShell\.Drag\.cancel\(\);[\s\S]*tabShell\.Drag\.cancel\(\);[\s\S]*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
  });

  it("keeps thumbnail and visible non-minimized tab exactness disjoint", () => {
    expect(dragSurfaceExactness).toMatch(
      /if \(surfaceKind === "thumbnail"\)[\s\S]*surfaceTarget === source\.thumbnailTarget[\s\S]*source\.primaryVisualKind === "thumbnail"[\s\S]*tiled\.selected === true/u,
    );
    expect(dragSurfaceExactness).toMatch(
      /const tabFrame = source\.tabFrame;[\s\S]*surfaceTarget === source\.tabTarget[\s\S]*source\.primaryVisualKind === "tab"[\s\S]*tiled\.selected === false/u,
    );
    expect(dragSurfaceExactness).toContain('column.presentation === "tabbed"');
    expect(dragSurfaceExactness).toContain("source.minimizedWindow !== true");
    expect(dragSurfaceExactness).toContain("tabFrame.visible === true");
    expect(dragSurfaceExactness).toContain("tabFrame.selected === false");
    expect(tabShell).toMatch(
      /readonly property bool spatialDragEligible:[\s\S]*activationEligible[\s\S]*!selectedTab && !minimizedTab/u,
    );
    expect(tabTouchHoldHandler).toMatch(
      /onLongPressed:[\s\S]*!tabShell\.spatialDragEligible[\s\S]*tabShell\.cancelActivationForSpatialDrag\(\);[\s\S]*touchSpatialDragArmed = true/u,
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

  it("schedules exact validation for surface, rail, selection, and geometry drift", () => {
    expect(presentation).toMatch(
      /onPrimaryVisualKindChanged: \{[\s\S]*scheduleWindowSpatialDragValidation\(windowPresentation\)/u,
    );
    expect(presentation).toMatch(
      /onTabFrameChanged: \{[\s\S]*scheduleWindowSpatialDragValidation\(windowPresentation\)/u,
    );
    expect(presentation).toContain(
      "onFrameChanged: card.scheduleWindowSpatialDragValidation(windowPresentation)",
    );
    expect(desktopCard).toMatch(
      /onTiledPresentationsChanged:[\s\S]*scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\)/u,
    );
    expect(desktopCard).toMatch(
      /onTabRailPlansChanged:[\s\S]*scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\)/u,
    );
    expect(dragExactness).toMatch(
      /windowDragSurfaceIsExact\(source, snapshot\.surfaceKind,[\s\S]*snapshot\.surfaceTarget\)/u,
    );
    expect(dragExactness).toMatch(
      /snapshot\.surfaceKind === "thumbnail"[\s\S]*frame !== null && frame\.floating === false[\s\S]*frame === snapshot\.surfaceFrame[\s\S]*snapshot\.surfaceKind === "tab" && frame === null[\s\S]*source\.tabFrame === snapshot\.surfaceFrame/u,
    );
    expect(dragExactness).toContain(
      "snapshot.surfaceTarget.width === snapshot.surfaceWidth",
    );
    expect(dragExactness).toContain(
      "snapshot.surfaceTarget.height === snapshot.surfaceHeight",
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

  it("keeps a generic frozen-surface proxy through tolerated eligibility churn", () => {
    const visualExactness = section(
      overviewScene,
      "function spatialWindowDragVisualIsExact(",
      "function captureSpatialColumnDragVisual(",
    );
    expect(sceneVisual).toMatch(
      /const snapshot = source \? source\.windowDragSnapshot : null;[\s\S]*const surfaceKind = snapshot \? snapshot\.surfaceKind : "";[\s\S]*const target = snapshot \? snapshot\.surfaceTarget : null;/u,
    );
    expect(sceneVisual).toMatch(
      /surfaceKind === "thumbnail"[\s\S]*target !== source\.thumbnailTarget[\s\S]*surfaceKind === "tab"[\s\S]*target !== source\.tabTarget/u,
    );
    expect(sceneVisual).toContain(
      "const visualFrame = target.mapToItem(root, 0, 0, target.width, target.height);",
    );
    expect(sceneVisual).toMatch(
      /spatialWindowDragVisualPlan = Object\.freeze\(\{[\s\S]*snapshot,[\s\S]*surfaceKind,[\s\S]*surfaceTarget: target/u,
    );
    expect(visualExactness).toContain(
      'typeof sourceCard.windowDragHandlerOwnsLifecycle === "function"',
    );
    expect(visualExactness).toMatch(
      /sourceCard\.windowDragHandlerOwnsLifecycle\(\s*source, plan\.surfaceKind, plan\.surfaceTarget\)/u,
    );
    expect(visualExactness).toContain(
      "plan.snapshot === source.windowDragSnapshot",
    );
    expect(visualExactness).toContain(
      "plan.surfaceKind === plan.snapshot.surfaceKind",
    );
    expect(visualExactness).toContain(
      "plan.surfaceTarget === plan.snapshot.surfaceTarget",
    );
    expect(visualExactness).not.toContain("windowSpatialDragSourceIsExact(");
  });

  it("atomically cancels either failed surface and clears ownership idempotently", () => {
    expect(thumbnailTouchHandler).toMatch(
      /onActiveTranslationChanged:[\s\S]*if \(!thumbnailShell\.storeSpatialDragHotSpot\(scenePosition\)\) \{\s*thumbnailTouchDragHandler\.cancelSpatialDrag\(\);/u,
    );
    expect(thumbnailPointerHandler).toMatch(
      /onActiveTranslationChanged:[\s\S]*if \(!thumbnailShell\.storeSpatialDragHotSpot\(scenePosition\)\) \{\s*card\.cancelWindowSpatialDragSource\(windowPresentation\);/u,
    );
    for (const handler of [tabTouchHandler, tabPointerHandler]) {
      expect(handler).toMatch(
        /onActiveTranslationChanged:[\s\S]*if \(!tabShell\.storeSpatialDragHotSpot\(scenePosition\)\) \{\s*tabShell\.cancelSpatialDrag\(\);/u,
      );
    }
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
