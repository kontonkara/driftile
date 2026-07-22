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

function qmlHandler(source: string, name: string): string {
  const token = `${name}:`;
  const startIndex = source.indexOf(token);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const lineStart = source.lastIndexOf("\n", startIndex) + 1;
  const indentation = source.slice(lineStart, startIndex);
  const nextHandler = new RegExp(
    `\\n${indentation}(?:on[A-Z][A-Za-z0-9]*:|Component\\.)`,
    "gu",
  );
  nextHandler.lastIndex = startIndex + token.length;
  const match = nextHandler.exec(source);
  return source.slice(startIndex, match ? match.index : source.length);
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
const tabRelease = section(
  tabShell,
  "function releaseSpatialDrag(",
  "function handleActivationGrabChanged(",
);
const tabSurfaceLifecycle = section(
  tabShell,
  "id: tabShell",
  "function nextActivationGestureSerial(",
);
const thumbnailTouchHandler = section(
  desktopCard,
  "id: thumbnailTouchDragHandler",
  "id: thumbnailDragHandler",
);
const thumbnailTouchRelease = section(
  thumbnailTouchHandler,
  "function releaseSpatialDrag(",
  "onActiveTranslationChanged:",
);
const thumbnailPointerHandler = section(
  desktopCard,
  "id: thumbnailDragHandler",
  "id: minimizedPlaceholderShell",
);
const thumbnailSurfaceLifecycle = section(
  desktopCard,
  "id: thumbnailShell",
  "function storeSpatialDragHotSpot(",
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
const dragSemantics = section(
  desktopCard,
  "function windowDragSourceSemanticsAreExact(",
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
const cardReactiveLifecycle = section(
  desktopCard,
  "onCurrentChanged:",
  "Component.onCompleted:",
);
const cameraTranslationLifecycle = section(
  overviewScene,
  "onSpatialContentYChanged:",
  "onSearchQueryChanged:",
);
const workspaceHoverLifecycle = section(
  overviewScene,
  "function beginWindowWorkspaceHover(",
  "function windowWorkspaceHoverContextIsExact(",
);
const sceneDragCleanup = section(
  overviewScene,
  "function resetSpatialEdgePanTracking(",
  "function handleSpatialPresentationPhaseChanged(",
);
const crossOutputRequest = section(
  desktopCard,
  "function requestCrossOutputWindowDrop(",
  "function selectedWindowIdForColumn(",
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
    expect(dragCapture).toContain(
      "sourceFrameHeight: expectedSourceFrameHeight",
    );
    expect(dragCapture).toContain("sourceFrameWidth: expectedSourceFrameWidth");
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
      /onTiledPresentationChanged: \{[\s\S]*card\.scheduleWindowSpatialDragValidation\(windowPresentation\);[\s\S]*card\.schedulePresentationMotion\(\);[\s\S]*\}/u,
    );
    expect(desktopCard).toMatch(
      /onTiledPresentationsChanged:[\s\S]*card\.scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\);/u,
    );
    expect(qmlHandler(presentation, "onActionSnapshotChanged")).toContain(
      "card.cancelInvalidWindowSpatialDragSource(windowPresentation)",
    );
    expect(dragSemantics).toContain(
      "windowDragActionSnapshotIsExact(source.actionSnapshot, snapshot)",
    );
    expect(dragExactness).not.toContain("source.dragEligible === true");
    expect(dragLifecycle).toMatch(
      /function scheduleWindowSpatialDragValidation\([\s\S]*ownedWindowDragSnapshotIsExact\(source\)[\s\S]*advanceWindowDragValidationRevision\(\);[\s\S]*Qt\.callLater\([\s\S]*requestId === card\.windowDragValidationRevision[\s\S]*cancelInvalidWindowSpatialDragSource/u,
    );
  });

  it("captures a monotonic source invalidation revision in the owned snapshot", () => {
    expect(presentation).toMatch(/property int windowDragSourceRevision:\s*0/u);
    expect(desktopCard).toMatch(
      /function advanceWindowDragSourceRevision\(source\)[\s\S]*source\.windowDragSourceRevision[\s\S]*source\.windowDragSourceRevision \+ 1/u,
    );
    expect(dragCapture).toMatch(
      /const expectedSourceRevision = source\.windowDragSourceRevision;/u,
    );
    expect(dragCapture).toMatch(
      /Number\.isInteger\(expectedSourceRevision\)[\s\S]*expectedSourceRevision >= 0/u,
    );
    expect(dragCapture).toContain("sourceRevision: expectedSourceRevision");
    expect(dragExactness).toMatch(
      /Number\.isInteger\(snapshot\.sourceRevision\)[\s\S]*source\.windowDragSourceRevision === snapshot\.sourceRevision/u,
    );
  });

  it("invalidates selection, presentation, rail, geometry, and topology drift", () => {
    const sourceRevisionInvalidation =
      /card\.\w*WindowDragSourceRevision\w*\(windowPresentation\)/u;

    for (const signal of [
      "onActionSnapshotChanged",
      "onFrameChanged",
      "onMinimizedWindowChanged",
      "onPrimaryVisualKindChanged",
      "onSelectedThumbnailChanged",
      "onSourceDesktopChanged",
      "onSourceDesktopIdChanged",
      "onSourceScreenChanged",
      "onTabFrameChanged",
      "onTiledPresentationChanged",
      "onWindowIdChanged",
    ]) {
      expect(qmlHandler(presentation, signal)).toMatch(
        sourceRevisionInvalidation,
      );
    }

    expect(presentation).toMatch(
      /function onFrameGeometryChanged\(\) \{[\s\S]*card\.invalidateWindowDragSourceGeometry\(windowPresentation\)/u,
    );
    expect(qmlHandler(cardReactiveLifecycle, "onContextChanged")).toContain(
      "card.advanceWindowDragSourceRevision(card.windowDragActiveSource)",
    );
    expect(qmlHandler(cardReactiveLifecycle, "onColumnsChanged")).toContain(
      "card.advanceWindowDragSourceRevision(card.windowDragActiveSource)",
    );

    for (const surface of [tabSurfaceLifecycle, thumbnailSurfaceLifecycle]) {
      for (const signal of [
        "onVisibleChanged",
        "onWidthChanged",
        "onHeightChanged",
      ]) {
        expect(qmlHandler(surface, signal)).toMatch(sourceRevisionInvalidation);
      }
    }
  });

  it("preserves the drag revision through camera translation and workspace hover", () => {
    const horizontalCameraLifecycle = section(
      cardReactiveLifecycle,
      "onPreviewViewportOffsetChanged:",
      "onSpatialDirectDragBlockedChanged:",
    );

    for (const lifecycle of [
      horizontalCameraLifecycle,
      cameraTranslationLifecycle,
      workspaceHoverLifecycle,
    ]) {
      expect(lifecycle).not.toMatch(/WindowDragSourceRevision/u);
    }
    expect(tabSurfaceLifecycle).not.toMatch(
      /onXChanged:[^\n]*WindowDragSourceRevision/u,
    );
    expect(tabSurfaceLifecycle).not.toMatch(
      /onYChanged:[^\n]*WindowDragSourceRevision/u,
    );
    expect(thumbnailSurfaceLifecycle).not.toMatch(
      /onXChanged:[^\n]*WindowDragSourceRevision/u,
    );
    expect(thumbnailSurfaceLifecycle).not.toMatch(
      /onYChanged:[^\n]*WindowDragSourceRevision/u,
    );
    expect(cameraTranslationLifecycle).not.toContain(
      "cancelActiveWindowSpatialDrag",
    );
    expect(workspaceHoverLifecycle).not.toContain(
      "cancelActiveWindowSpatialDrag",
    );
  });

  it("schedules exact validation for surface, rail, selection, and geometry drift", () => {
    expect(presentation).toMatch(
      /onPrimaryVisualKindChanged: \{[\s\S]*scheduleWindowSpatialDragValidation\(windowPresentation\)/u,
    );
    expect(presentation).toMatch(
      /onTabFrameChanged: \{[\s\S]*scheduleWindowSpatialDragValidation\(windowPresentation\)/u,
    );
    expect(qmlHandler(presentation, "onFrameChanged")).toContain(
      "card.scheduleWindowSpatialDragValidation(windowPresentation)",
    );
    expect(desktopCard).toMatch(
      /onTiledPresentationsChanged:[\s\S]*scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\)/u,
    );
    expect(desktopCard).toMatch(
      /onTabRailPlansChanged:[\s\S]*scheduleWindowSpatialDragValidation\(card\.windowDragActiveSource\)/u,
    );
    expect(dragSemantics).toMatch(
      /windowDragSurfaceIsExact\(source, snapshot\.surfaceKind,[\s\S]*snapshot\.surfaceTarget\)/u,
    );
    expect(dragSemantics).toMatch(
      /sourceFrame\.width === snapshot\.sourceFrameWidth[\s\S]*sourceFrame\.height === snapshot\.sourceFrameHeight/u,
    );
    expect(dragSemantics).not.toMatch(
      /(?:frame|source\.tabFrame) === snapshot\.surfaceFrame/u,
    );
    expect(dragSemantics).toContain(
      "snapshot.surfaceTarget.width === snapshot.surfaceWidth",
    );
    expect(dragSemantics).toContain(
      "snapshot.surfaceTarget.height === snapshot.surfaceHeight",
    );
    expect(dragSemantics).toMatch(
      /tabRailPlan\.anchorIndex === snapshot\.tabRailAnchorIndex[\s\S]*tabRailPlan\.firstVisibleIndex === snapshot\.tabRailFirstVisibleIndex[\s\S]*tabRailPlan\.lastVisibleIndex === snapshot\.tabRailLastVisibleIndex[\s\S]*tabRailPlan\.visibleCapacity === snapshot\.tabRailVisibleCapacity/u,
    );
  });

  it("cancels authoritative source and topology invalidations", () => {
    expect(presentation).toMatch(
      /onCandidateChanged:[\s\S]*card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);/u,
    );
    expect(qmlHandler(presentation, "onMinimizedWindowChanged")).toMatch(
      /card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);[\s\S]*card\.schedulePresentationMotion\(\);/u,
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

  it("rejects an invalid release before local or cross-output submission", () => {
    for (const release of [tabRelease, thumbnailTouchRelease]) {
      const guardIndex = release.indexOf(
        "if (!card.ownedWindowDragSnapshotIsExact(source))",
      );
      const localDropIndex = release.indexOf("Drag.drop()");
      const crossOutputIndex = release.indexOf(
        "card.requestCrossOutputWindowDrop(source, globalPosition)",
      );
      expect(guardIndex).toBeGreaterThanOrEqual(0);
      expect(localDropIndex).toBeGreaterThan(guardIndex);
      expect(crossOutputIndex).toBeGreaterThan(localDropIndex);
      expect(release.slice(guardIndex, localDropIndex)).toMatch(
        /if \(!card\.ownedWindowDragSnapshotIsExact\(source\)\)[\s\S]*cancelSpatialDrag\(\);[\s\S]*return/u,
      );
    }

    const pointerRelease = section(
      thumbnailPointerHandler,
      "PointerDevice.UngrabExclusive",
      "PointerDevice.CancelGrabExclusive",
    );
    const guardIndex = pointerRelease.indexOf(
      "if (!card.ownedWindowDragSnapshotIsExact(source))",
    );
    const localDropIndex = pointerRelease.indexOf("Drag.drop()");
    const crossOutputIndex = pointerRelease.indexOf(
      "card.requestCrossOutputWindowDrop(source, globalPosition)",
    );
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(localDropIndex).toBeGreaterThan(guardIndex);
    expect(crossOutputIndex).toBeGreaterThan(localDropIndex);
    expect(pointerRelease.slice(guardIndex, localDropIndex)).toMatch(
      /if \(!card\.ownedWindowDragSnapshotIsExact\(source\)\)[\s\S]*(?:cancelWindowSpatialDragSource|Drag\.cancel)[\s\S]*return/u,
    );
    expect(crossOutputRequest).toMatch(
      /!ownedWindowDragSnapshotIsExact\(source\)[\s\S]*checkItemDroppedOutOfScreen\(globalPosition, source\)/u,
    );
  });

  it("clears the drag proxy, drop preview, and edge-pan owner on cancellation", () => {
    expect(sceneDragCleanup).toContain("resetWindowWorkspaceHover();");
    expect(sceneDragCleanup).toContain("clearWorkspaceGapPreview();");
    expect(sceneDragCleanup).toContain("clearSpatialWindowDragVisual();");
    expect(sceneDragCleanup).toContain("spatialWindowDragSource = null;");
    expect(sceneDragCleanup).toContain("clearSpatialEdgePanScenePoint();");
    expect(overviewScene).toMatch(
      /function clearSpatialEdgePanScenePoint\(\)[\s\S]*spatialEdgePanTimer\.stop\(\);/u,
    );
    expect(sceneEdgePan).toMatch(
      /function finishWindowSpatialEdgePan\([\s\S]*resetSpatialEdgePanTracking\(\);/u,
    );
  });
});
