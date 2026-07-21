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

const presentation = desktopCard.slice(
  desktopCard.indexOf("id: windowPresentation"),
  desktopCard.indexOf("id: thumbnailShell"),
);
const thumbnailSurface = desktopCard.slice(
  desktopCard.indexOf("id: thumbnailShell"),
  desktopCard.indexOf("Rectangle {", desktopCard.indexOf("id: thumbnailShell")),
);
const thumbnailDrag = handlerBlock(
  "thumbnailDragHandler",
  "minimizedPlaceholderShell",
);
const thumbnailTouchHold = handlerBlock(
  "thumbnailTouchHoldHandler",
  "thumbnailTouchDragHandler",
);
const thumbnailTouchDrag = handlerBlock(
  "thumbnailTouchDragHandler",
  "thumbnailDragHandler",
);
const thumbnailMouseActivationStart = desktopCard.indexOf(
  "TapHandler {",
  desktopCard.indexOf("id: thumbnailCloseButton"),
);
const thumbnailMiddleCloseStart = desktopCard.indexOf(
  "TapHandler {",
  thumbnailMouseActivationStart + 1,
);
const thumbnailCloseButton = desktopCard.slice(
  desktopCard.indexOf("id: thumbnailCloseButton"),
  thumbnailMouseActivationStart,
);
const thumbnailMouseActivation = desktopCard.slice(
  thumbnailMouseActivationStart,
  thumbnailMiddleCloseStart,
);
const thumbnailMiddleClose = desktopCard.slice(
  thumbnailMiddleCloseStart,
  desktopCard.indexOf("id: thumbnailTouchHoldHandler"),
);
const lifecycle = desktopCard.slice(
  desktopCard.indexOf("function beginWindowSpatialDrag("),
  desktopCard.indexOf("function windowDropIsValid("),
);
const hoverSignals = desktopCard.slice(
  desktopCard.indexOf("signal windowWorkspaceHoverEntered("),
  desktopCard.indexOf("signal windowTapped("),
);
const dropArea = desktopCard.slice(
  desktopCard.indexOf("id: windowDropArea"),
  desktopCard.indexOf("id: columnDropArea"),
);
const hoverLifecycle = desktopCard.slice(
  desktopCard.indexOf("function claimWindowDropHover("),
  desktopCard.indexOf("function windowDropIsValid("),
);
const dropPlanner = desktopCard.slice(
  desktopCard.indexOf("function buildWindowDropPlannerSnapshot("),
  desktopCard.indexOf("function windowDropTargetIsExact("),
);
const dropValidation = desktopCard.slice(
  desktopCard.indexOf("function windowDropIsValid("),
  desktopCard.indexOf("function windowIsActionable("),
);
const hoverTimer = overviewScene.slice(
  overviewScene.indexOf("id: spatialWindowDragHoverTimer"),
  overviewScene.indexOf(
    "NumberAnimation {",
    overviewScene.indexOf("id: spatialWindowDragHoverTimer"),
  ),
);
const hoverRouting = overviewScene.slice(
  overviewScene.indexOf("function beginWindowWorkspaceHover("),
  overviewScene.indexOf("function windowSpatialDragSourceIsExact("),
);
const sceneDragLifecycle = overviewScene.slice(
  overviewScene.indexOf("function beginWindowSpatialEdgePan("),
  overviewScene.indexOf("function beginWindowWorkspaceHover("),
);
const sceneDragVisual = overviewScene.slice(
  overviewScene.indexOf("id: spatialWindowDragVisual"),
  overviewScene.indexOf("OverviewExitHandoff {"),
);
const sceneDragVisualLifecycle = overviewScene.slice(
  overviewScene.indexOf("function captureSpatialWindowDragVisual("),
  overviewScene.indexOf("function handleSpatialPresentationPhaseChanged("),
);
const spatialCanvas = overviewScene.slice(
  overviewScene.indexOf("id: spatialCanvas"),
  overviewScene.indexOf(
    "Repeater {",
    overviewScene.indexOf("id: spatialCanvas"),
  ),
);
const columnShell = desktopCard.slice(
  desktopCard.indexOf("id: columnShell"),
  desktopCard.indexOf("id: emptyContentInput"),
);
const columnRepeaterLifecycle = desktopCard.slice(
  desktopCard.indexOf("id: columnRepeater"),
  desktopCard.indexOf("id: emptyContentInput"),
);
const windowRepeaterLifecycle = desktopCard.slice(
  desktopCard.indexOf("id: windowRepeater"),
  desktopCard.indexOf("id: windowPresentation"),
);
const columnGrip = desktopCard.slice(
  desktopCard.indexOf("id: columnGrabHandle"),
  desktopCard.indexOf("id: columnTouchHoldHandler"),
);
const columnPointerHover = handlerBlock(
  "columnPointerHoverHandler",
  "columnPointerPressHandler",
);
const columnPointerPress = handlerBlock(
  "columnPointerPressHandler",
  "columnTouchHoldHandler",
);
const columnTouchHold = handlerBlock(
  "columnTouchHoldHandler",
  "columnTouchDragHandler",
);
const columnTouchDrag = handlerBlock(
  "columnTouchDragHandler",
  "columnDragHandler",
);
const columnPointerDrag = desktopCard.slice(
  desktopCard.indexOf("id: columnDragHandler"),
  desktopCard.indexOf("id: windowRepeater"),
);
const columnEligibilityPublication = desktopCard.slice(
  desktopCard.indexOf("function invalidateColumnDragEligibility()"),
  desktopCard.indexOf("function storeColumnDragHotSpot("),
);
const passiveColumnMemberSnapshot = desktopCard.slice(
  desktopCard.indexOf("function windowSnapshotCanJoinColumnDrag("),
  desktopCard.indexOf("function windowSnapshotCanRequestClose("),
);
const columnDropArea = desktopCard.slice(
  desktopCard.indexOf("id: columnDropArea"),
  desktopCard.indexOf("onCurrentChanged:"),
);
const workspaceGapPreviewSourceSignals = overviewScene.slice(
  overviewScene.indexOf("target: root.workspaceGapPreviewSource"),
  overviewScene.indexOf("target: root.spatialColumnDragSource"),
);
const spatialColumnDragSourceSignals = overviewScene.slice(
  overviewScene.indexOf("target: root.spatialColumnDragSource"),
  overviewScene.indexOf("target: root.spatialWindowDragSource"),
);
const columnLifecycle = desktopCard.slice(
  desktopCard.indexOf("function selectedWindowIdForColumn("),
  desktopCard.indexOf("function beginWindowSpatialDrag("),
);
const columnEligibilityScheduler = desktopCard.slice(
  desktopCard.indexOf(
    "function exactActiveColumnDragSourceForEligibilityRefresh()",
  ),
  desktopCard.indexOf("function presentationForWindowId("),
);
const columnPlanner = desktopCard.slice(
  desktopCard.indexOf("function buildColumnDropPlannerSnapshot("),
  desktopCard.indexOf("function buildWindowDropPlannerSnapshot("),
);
const sceneColumnLifecycle = overviewScene.slice(
  overviewScene.indexOf("function beginColumnSpatialEdgePan("),
  overviewScene.indexOf("function beginWindowWorkspaceHover("),
);
const sceneColumnVisual = overviewScene.slice(
  overviewScene.indexOf("id: spatialColumnDragVisual"),
  overviewScene.indexOf("OverviewExitHandoff {"),
);
const sceneColumnVisualLifecycle = overviewScene.slice(
  overviewScene.indexOf("function captureSpatialColumnDragVisual("),
  overviewScene.indexOf("function handleSpatialPresentationPhaseChanged("),
);
const columnWorkspaceGapLifecycle = overviewScene.slice(
  overviewScene.indexOf("function planColumnWorkspaceGapDrop("),
  overviewScene.indexOf("function canonicalWorkspaceGapDropTarget("),
);
const columnSpatialSubmission = overviewScene.slice(
  overviewScene.indexOf("function submitColumnSpatialDrop("),
  overviewScene.indexOf("function submitWindowSpatialDrop("),
);

describe("spatial overview window drag lifecycle", () => {
  it("declares one deduplicated source lifecycle for exact thumbnails", () => {
    expect(desktopCard).toContain(
      "signal windowSpatialDragStarted(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal windowSpatialDragMoved(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal windowSpatialDragFinished(var source)",
    );
    expect(presentation).toContain(
      "property bool spatialDragLifecycleActive: false",
    );
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(5);
    expect(desktopCard).not.toContain("id: tabDragHandler");
    expect(
      desktopCard.slice(
        desktopCard.indexOf("id: minimizedPlaceholderShell"),
        desktopCard.indexOf("id: windowDropArea"),
      ),
    ).not.toContain("windowSpatialDrag");
  });

  it("emits a complete thumbnail drag lifecycle from the existing handler", () => {
    const handlerId = "thumbnailDragHandler";
    const drag = thumbnailDrag;
    expect(drag).toContain("onActiveTranslationChanged:");
    expect(drag).toContain(`if (${handlerId}.active) {`);
    expect(drag).toContain(`${handlerId}.centroid.scenePosition`);
    expect(drag).toMatch(
      /if \(transition === PointerDevice\.GrabExclusive\) \{[\s\S]*?card\.beginWindowSpatialDrag\(windowPresentation, point\.scenePosition\);/u,
    );
    expect(drag.match(/card\.beginWindowSpatialDrag\(/gu)).toHaveLength(1);
    expect(drag.match(/card\.moveWindowSpatialDrag\(/gu)).toHaveLength(1);
    expect(drag.match(/card\.finishWindowSpatialDrag\(/gu)).toHaveLength(3);
    expect(drag).toMatch(
      /const globalPosition = card\.crossOutputWindowDropGlobalPosition\(\s*point\.scenePosition\);[\s\S]*?const action = [A-Za-z]+Shell\.Drag\.drop\(\);[\s\S]*?if \(action !== Qt\.MoveAction\) \{\s*card\.requestCrossOutputWindowDrop\(source, globalPosition\);\s*\}[\s\S]*?[A-Za-z]+Shell\.Drag\.active = false;[\s\S]*?card\.finishWindowSpatialDrag\(source\);/u,
    );
    expect(drag).toMatch(
      /else \{\s*[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
    expect(drag).toMatch(
      /transition === PointerDevice\.CancelGrabExclusive[\s\S]*?transition === PointerDevice\.CancelGrabPassive[\s\S]*?[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
  });

  it("stores the final scene position before completing either thumbnail drag", () => {
    expect(thumbnailSurface).toContain(
      "property point spatialDragHotSpot: Qt.point(0, 0)",
    );
    expect(thumbnailSurface).toContain(
      "function storeSpatialDragHotSpot(scenePosition)",
    );
    expect(thumbnailSurface).toContain(
      "thumbnailShell.mapFromItem(\n                                null, scenePosition.x, scenePosition.y)",
    );
    expect(thumbnailSurface).toContain(
      "thumbnailShell.spatialDragHotSpot = Qt.point(localPosition.x,\n                                                                         localPosition.y)",
    );
    expect(thumbnailSurface).toContain("Drag.hotSpot.x: spatialDragHotSpot.x");
    expect(thumbnailSurface).toContain("Drag.hotSpot.y: spatialDragHotSpot.y");
    expect(thumbnailSurface).not.toContain("activeTranslation");
    expect(thumbnailSurface).not.toContain("pressPosition");

    for (const drag of [thumbnailDrag, thumbnailTouchDrag]) {
      expect(
        drag.match(/thumbnailShell\.storeSpatialDragHotSpot\(/gu),
      ).toHaveLength(3);
      expect(drag).toMatch(
        /GrabExclusive[\s\S]*?storeSpatialDragHotSpot\(point\.scenePosition\)[\s\S]*?Drag\.active = true/u,
      );
      expect(drag).toMatch(
        /onActiveTranslationChanged:[\s\S]*?const scenePosition = [^;]+\.centroid\.scenePosition;[\s\S]*?storeSpatialDragHotSpot\(scenePosition\)[\s\S]*?card\.moveWindowSpatialDrag/u,
      );
      expect(drag).toMatch(
        /storeSpatialDragHotSpot\((?:point\.)?scenePosition\)[\s\S]*?Drag\.drop\(\)/u,
      );
    }
  });

  it("keeps one visible window proxy under the initial grab point across cards", () => {
    expect(thumbnailSurface).toContain(
      "property point spatialDragHotSpot: Qt.point(0, 0)",
    );
    for (const drag of [thumbnailDrag, thumbnailTouchDrag]) {
      expect(drag).toMatch(
        /storeSpatialDragHotSpot\(point\.scenePosition\)[\s\S]*?Drag\.active = true/u,
      );
      expect(drag).toContain("target: null");
    }
    expect(presentation).toContain(
      "opacity: thumbnailShell.Drag.active || card.columnDragWindowIsDimmed(windowId) ? 0.2 : 1",
    );
    expect(sceneDragVisual).toContain("Loader {");
    expect(sceneDragVisual).toContain('color: "#e61b2432"');
    expect(sceneDragVisual.indexOf('color: "#e61b2432"')).toBeLessThan(
      sceneDragVisual.indexOf("Loader {"),
    );
    expect(sceneDragVisual).toContain(
      "active: spatialWindowDragVisual.plan !== null",
    );
    expect(sceneDragVisual).toContain("asynchronous: false");
    expect(sceneDragVisual).toContain("KWin.WindowThumbnail {");
    expect(sceneDragVisual).toContain(
      'wId: spatialWindowDragVisual.plan ? spatialWindowDragVisual.plan.windowId : ""',
    );
    expect(sceneDragVisual).toContain(
      "x: root.spatialEdgePanPointerX - (plan ? plan.hotSpotX : 0)",
    );
    expect(sceneDragVisual).toContain(
      "y: root.spatialEdgePanPointerY - (plan ? plan.hotSpotY : 0)",
    );
    expect(sceneDragVisual).toContain(
      "visible: root.spatialWindowDragVisualIsExact()",
    );
    expect(sceneDragVisual).toContain("enabled: false");
  });

  it("captures, advances, and clears the drag proxy without a move-time scan", () => {
    expect(sceneDragLifecycle).toMatch(
      /storeSpatialEdgePanScenePoint\(sceneX, sceneY\)[\s\S]*?spatialWindowDragSource = source;[\s\S]*?captureSpatialWindowDragVisual\(source\);/u,
    );
    expect(sceneDragLifecycle).toMatch(
      /function updateWindowSpatialEdgePan\([\s\S]*?storeSpatialEdgePanScenePoint\(sceneX, sceneY\);/u,
    );
    expect(sceneDragVisualLifecycle).toContain(
      "const target = source ? source.thumbnailTarget : null;",
    );
    expect(sceneDragVisualLifecycle).toContain(
      "const hotSpot = target ? target.spatialDragHotSpot : null;",
    );
    expect(sceneDragVisualLifecycle).toContain(
      "const visualFrame = target.mapToItem(root, 0, 0, target.width, target.height);",
    );
    expect(sceneDragVisualLifecycle).toContain(
      "const mappedHotSpot = target.mapToItem(root, hotSpot.x, hotSpot.y);",
    );
    expect(sceneDragVisualLifecycle).toContain(
      "spatialWindowDragVisualPlan = Object.freeze({",
    );
    expect(sceneDragVisualLifecycle).toMatch(
      /function resetSpatialEdgePanTracking\(\) \{[\s\S]*?clearSpatialWindowDragVisual\(\);[\s\S]*?clearSpatialEdgePanScenePoint\(\);/u,
    );
    expect(`${sceneDragLifecycle}\n${sceneDragVisualLifecycle}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)|\b(?:Timer|MouseArea)\s*\{|planOverviewSpatialRowGeometry/u,
    );
  });

  it("fades the spatial canvas with presentation progress outside exit handoff", () => {
    expect(spatialCanvas).toMatch(
      /opacity: root\.spatialExitHandoffActive\s*\? overviewExitHandoffOverlay\.surfaceOpacity : root\.spatialPresentationProgress/u,
    );
    expect(spatialCanvas).not.toMatch(
      /overviewExitHandoffOverlay\.surfaceOpacity\s*:\s*1/u,
    );
  });

  it("shares one touchscreen tap and long-press owner without widening drag eligibility", () => {
    expect(presentation).toContain(
      "property bool touchSpatialDragArmed: false",
    );
    expect(thumbnailTouchHold).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(thumbnailTouchHold).toContain(
      "gesturePolicy: TapHandler.DragThreshold",
    );
    expect(thumbnailTouchHold).toContain(
      "enabled: thumbnailShell.visible && card.desktop && card.screen",
    );
    expect(thumbnailTouchHold).not.toMatch(
      /enabled:[^\n]*windowPresentation\.dragEligible/u,
    );
    expect(thumbnailTouchHold.match(/onTapped:/gu)).toHaveLength(1);
    expect(thumbnailTouchHold.match(/onLongPressed:/gu)).toHaveLength(1);
    expect(thumbnailTouchHold).toMatch(
      /onTapped: point => \{\s*if \(card\.closeButtonContainsPoint\(thumbnailCloseButton, thumbnailShell,\s*point\.position\)\) \{\s*return;\s*\}\s*card\.windowTapped\(model\.window, windowPresentation\.windowId, card\.desktop,\s*card\.desktopId, card\.screen\);\s*\}/u,
    );
    expect(thumbnailTouchHold).toContain("onLongPressed:");
    expect(thumbnailTouchHold).toMatch(
      /onLongPressed: \{\s*if \(!windowPresentation\.dragEligible\s*\|\| card\.closeButtonContainsPoint\(thumbnailCloseButton, thumbnailShell,\s*point\.pressPosition\)\) \{\s*return;\s*\}\s*windowPresentation\.touchSpatialDragArmed = true;/u,
    );
    expect(thumbnailTouchHold).toContain(
      "windowPresentation.touchSpatialDragArmed = true",
    );
    expect(thumbnailTouchHold).toContain(
      "card.closeButtonContainsPoint(thumbnailCloseButton, thumbnailShell,",
    );
    expect(thumbnailTouchHold).toContain("point.pressPosition");
    expect(thumbnailTouchDrag).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(thumbnailTouchDrag).toContain(
      "enabled: thumbnailShell.visible && windowPresentation.dragEligible",
    );
    expect(thumbnailTouchDrag).toContain(
      "dragThreshold: windowPresentation.touchSpatialDragArmed ? 0 : 32767",
    );
    expect(thumbnailTouchDrag).toMatch(
      /PointerDevice\.GrabExclusive[\s\S]*?touchSpatialDragArmed[\s\S]*?card\.beginWindowSpatialDrag\(windowPresentation, point\.scenePosition\)/u,
    );
    expect(thumbnailTouchDrag).toContain(
      "card.moveWindowSpatialDrag(windowPresentation,",
    );
    expect(thumbnailTouchDrag).toContain(
      "thumbnailTouchDragHandler.releaseSpatialDrag(point.scenePosition)",
    );
    expect(thumbnailTouchDrag).toContain(
      "thumbnailTouchDragHandler.cancelSpatialDrag()",
    );
    expect(
      thumbnailTouchDrag.match(/touchSpatialDragArmed = false/gu),
    ).toHaveLength(2);
    expect(`${thumbnailTouchHold}\n${thumbnailTouchDrag}`).not.toMatch(
      /desktopTapped|org\.kde\.kwin\.private|\b(?:MouseArea|Timer)\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
    expect(thumbnailDrag).not.toContain("PointerDevice.TouchScreen");
  });

  it("guards finite coordinates, source identity, and duplicate finish signals", () => {
    expect(lifecycle).toContain("function spatialDragSourceIsOwned(source)");
    expect(lifecycle).toContain(
      "String(candidate.internalId) === source.windowId",
    );
    expect(lifecycle).toContain("source.sourceDesktop === desktop");
    expect(lifecycle).toContain("source.sourceDesktopId === desktopId");
    expect(lifecycle).toContain("source.sourceScreen === screen");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive === true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive !== true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive = true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive = false");
    expect(lifecycle).toContain("Number.isFinite(scenePosition.x)");
    expect(lifecycle).toContain("Number.isFinite(scenePosition.y)");
    expect(lifecycle).toContain(
      "windowSpatialDragMoved(source, scenePosition.x, scenePosition.y)",
    );
    expect(lifecycle).toContain("windowSpatialDragFinished(source)");
    expect(`${thumbnailDrag}\n${lifecycle}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(|\b(?:MouseArea|Timer)\s*\{/u,
    );
  });

  it("publishes an explicit external workspace hover lifecycle", () => {
    expect(hoverSignals).toMatch(
      /signal windowWorkspaceHoverEntered\(var source, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedTargetScreen,\s*real sceneX, real sceneY\)/u,
    );
    expect(hoverSignals).toMatch(
      /signal windowWorkspaceHoverMoved\(var source, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedTargetScreen,\s*real sceneX, real sceneY\)/u,
    );
    expect(hoverSignals).toMatch(
      /signal windowWorkspaceHoverLeft\(var source, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedTargetScreen\)/u,
    );
    expect(dropArea).toContain(
      "? card.claimWindowDropHover(drag.source, drag)",
    );
    expect(dropArea).toContain("? card.moveWindowDropHover(drag.source, drag)");
    expect(dropArea).toContain("onExited: card.clearWindowDropHover()");
    expect(dropArea).toContain("onContainsDragChanged:");
    expect(dropArea).toContain("card.clearWindowDropHover();");
    expect(dropArea.indexOf("card.clearWindowDropHover();")).toBeLessThan(
      dropArea.indexOf("card.windowDropped("),
    );
    expect(hoverLifecycle).toContain(
      "windowWorkspaceHoverEntered(source, desktop, desktopId, screen,",
    );
    expect(hoverLifecycle).toContain(
      "windowWorkspaceHoverMoved(source, windowDropHoverDesktop, windowDropHoverDesktopId,",
    );
    expect(hoverLifecycle).toContain(
      "windowWorkspaceHoverLeft(source, targetDesktop, targetDesktopId, targetScreen)",
    );
    expect(hoverLifecycle).toContain("if (crossWorkspace) {");
    expect(hoverLifecycle).toContain("if (windowDropHoverCrossWorkspace) {");
  });

  it("caches one exact card-local spatial target for hover and drop", () => {
    expect(desktopCard).toContain("required property string outputId");
    expect(desktopCard).toMatch(
      /signal windowDropped\(var candidate, string expectedWindowId, var expectedSourceDesktop,\s*string expectedSourceDesktopId, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedScreen, var exactTarget\)/u,
    );
    expect(desktopCard).toContain("property var windowDropHoverSnapshot: null");
    expect(desktopCard).toContain("property var windowDropHoverTarget: null");
    expect(dropPlanner).toContain("function buildWindowDropPlannerSnapshot()");
    expect(dropPlanner).toContain(
      "runtime.buildOverviewSpatialWindowDropPlan({",
    );
    expect(dropPlanner).toContain(
      "runtime.hitTestOverviewSpatialWindowDrop(snapshot.plan, localPosition)",
    );
    expect(dropPlanner).toContain("activityId,");
    expect(dropPlanner).toContain("desktopId: expectedDesktopId");
    expect(dropPlanner).toContain("outputId: expectedOutputId");
    expect(dropPlanner).toContain("frame: rowFrame");
    expect(dropPlanner).toContain("frame: previewColumnFrame");
    expect(dropPlanner).toContain("frame: previewMemberFrame");
    expect(dropPlanner).toContain("windowId");
    expect(dropPlanner).toContain("context !== expectedContext");
    expect(dropPlanner).toContain("columnFrames !== expectedColumnFrames");
    expect(dropPlanner).toContain(
      "tiledPresentations !== expectedPresentations",
    );
    expect(dropPlanner).toContain(
      "spatialLiveColumnFrames !== expectedLiveColumnFrames",
    );
    expect(dropPlanner).toContain(
      "spatialRowGeometryPlan !== expectedRowGeometryPlan",
    );
    expect(dropPlanner).toContain("Object.isFrozen(target)");
    expect(dropPlanner).toContain("target.rowIndex !== 0");
    expect(dropPlanner).toContain("expectedContext === null");
    expect(dropPlanner).toContain("expectedColumns.length !== 0");
    expect(dropPlanner).toContain("snapshot.context === null");
    expect(dropPlanner).toContain(
      "snapshot.targetWindowIds[target.targetWindowId] === true",
    );
    expect(hoverLifecycle).toContain("windowDropHoverSnapshot = snapshot");
    expect(hoverLifecycle).toContain("windowDropHoverTarget = target");
    expect(hoverLifecycle).toContain("windowDropHoverSnapshot = null");
    expect(hoverLifecycle).toContain("windowDropHoverTarget = null");
    expect(dropArea).toContain(
      "const exactTarget = card.windowDropHoverTarget;",
    );
    expect(dropArea.indexOf("const exactTarget")).toBeLessThan(
      dropArea.indexOf(
        "card.clearWindowDropHover();",
        dropArea.indexOf("const exactTarget"),
      ),
    );
    expect(dropArea).toContain(
      "card.desktop, card.desktopId, card.screen, exactTarget);",
    );
  });

  it("solves the final bounded window frame from the cached exact drop target", () => {
    expect(dropArea).toContain(
      "readonly property var spatialPreview: validTarget",
    );
    expect(dropArea).toContain(
      "card.planWindowDropPreview(card.windowDropHoverSource,",
    );
    expect(dropArea).toContain("id: spatialWindowDropPreviewSurface");
    expect(dropArea).toContain("id: spatialWindowDropPreviewMarker");
    expect(dropArea).toMatch(/anchors\.fill: parent\s*clip: true/u);
    expect(dropArea).toContain('plan.kind === "empty-row"');
    expect(dropArea).toContain('plan.kind === "stack-insertion"');
    expect(dropPlanner).toContain("const previewFrames = Object.create(null)");
    expect(dropPlanner).toContain("Object.freeze(previewFrames)");
    expect(dropPlanner).toContain("previewFrames,");
    expect(dropPlanner).toContain(
      "function planWindowDropPreview(source, target, snapshot)",
    );
    expect(dropPlanner).toContain(
      "windowDropPlannerTargetIsExact(target, snapshot)",
    );
    expect(dropPlanner).toContain(
      "function windowDropPreviewFrameIsBounded(frame, snapshot)",
    );
    expect(dropPlanner).toContain("runtime.planOverviewSpatialRowGeometry({");
    expect(dropPlanner.match(/planOverviewSpatialRowGeometry/gu)).toHaveLength(
      2,
    );
    expect(dropPlanner).toContain(
      "buildWindowDropStackPreviewColumns(sourceState, target, columns, sameContext)",
    );
    expect(dropPlanner).toContain(
      "buildWindowDropBoundaryPreviewColumns(sourceState, target, columns, sameContext)",
    );
    expect(dropPlanner).toContain(
      "columns.push(windowDropPreviewSingletonColumn(sourceState))",
    );
    expect(dropPlanner).toContain(
      "height: sourceFrame.height * projectionScale",
    );
    expect(dropPlanner).toContain("width: sourceFrame.width * projectionScale");
    expect(dropPlanner).toContain(
      "x: viewportOriginX + (sourceFrame.x - plan.camera.base) * projectionScale",
    );
    expect(dropPlanner).not.toContain("sourceFrame.x - logicalViewportOffset");
    expect(dropPlanner).toContain("Object.isFrozen(plan.camera)");
    expect(dropPlanner).toContain("plan.camera.minimum > plan.camera.base");
    expect(dropPlanner).toContain("plan.camera.base > plan.camera.maximum");
    expect(dropPlanner).toContain(
      "frame.x + frame.width <= snapshot.cardWidth",
    );
    expect(dropPlanner).toContain(
      "frame.y + frame.height <= snapshot.cardHeight",
    );
    expect(dropPlanner).not.toMatch(
      /\bhalfHeight\b|\bsurfaceWidth\b|Math\.min\(28|\bminimumExtent\b/u,
    );
    expect(`${dropArea}\n${dropPlanner}`).not.toMatch(
      /\b(?:Behavior|NumberAnimation|Timer)\b|\.setValue\s*\(/u,
    );
  });

  it("reuses the cached target and only resolves a new frame when its zone changes", () => {
    const hoverMove = hoverLifecycle.slice(
      hoverLifecycle.indexOf("function moveWindowDropHoverToPositions("),
      hoverLifecycle.indexOf("function rejectWindowDropHover("),
    );
    expect(hoverMove).toContain(
      "const target = hitWindowDropPlannerSnapshot(windowDropHoverSnapshot, localPosition);",
    );
    expect(hoverMove).toMatch(
      /if \(windowDropHoverTarget !== target\) \{\s*windowDropHoverTarget = target;\s*\}/u,
    );
    expect(hoverMove).not.toMatch(
      /buildWindowDropPlannerSnapshot|planWindowDropPreview|planOverviewSpatialRowGeometry/u,
    );
  });

  it("uses only visible tab members and keeps same-workspace drops local", () => {
    expect(dropPlanner).toContain('column.presentation !== "tabbed"');
    expect(dropPlanner).toContain("memberIndex === selectedMemberIndex");
    expect(dropPlanner).toMatch(
      /if \(!selected\) \{\s*if \(tiled\.thumbnailFrame !== null \|\| liveMemberFrame !== null\) \{\s*return null;\s*\}\s*continue;/u,
    );
    expect(hoverLifecycle).toContain(
      "function windowDropSourceWorkspaceRelationIsExact(source)",
    );
    expect(hoverLifecycle).toContain("return sameDesktop === sameDesktopId;");
    expect(hoverLifecycle).toContain(
      "function windowDropSourceTargetsDifferentWorkspace(source)",
    );
    expect(hoverLifecycle).toContain(
      "source.sourceDesktop !== desktop && source.sourceDesktopId !== desktopId",
    );
    expect(hoverLifecycle).toContain(
      "windowDropHoverCrossWorkspace = crossWorkspace",
    );
    expect(dropValidation).toContain(
      "windowDropSourceWorkspaceRelationIsExact(source)",
    );
  });

  it("keeps exact layout targets exclusive to current tiled sources", () => {
    expect(presentation).toContain(
      "card.windowDropSourceTiledPresentationIsExact(windowPresentation)",
    );
    expect(hoverLifecycle).toContain(
      "function windowDropSourceTiledPresentationIsExact(source)",
    );
    expect(hoverLifecycle).toContain(
      'typeof sourceCard.ownedWindowDropTiledPresentationIsExact === "function"',
    );
    expect(hoverLifecycle).toContain(
      "sourceCard.ownedWindowDropTiledPresentationIsExact(source)",
    );
    expect(hoverLifecycle).toContain(
      "function ownedWindowDropTiledPresentationIsExact(source)",
    );
    expect(hoverLifecycle).toContain("source.sourceCard === card");
    expect(hoverLifecycle).toContain("source.sourceCard.context === context");
    expect(hoverLifecycle).toContain("tiledPresentations[windowId] === tiled");
    expect(hoverLifecycle).toContain("tiled.selected === true");
    expect(hoverLifecycle).toContain("frame.floating === false");
    expect(
      `${hoverLifecycle}\n${dropValidation}`.match(
        /windowDropSourceTiledPresentationIsExact\(source\)/gu,
      ),
    ).toHaveLength(3);

    const routedValidation = hoverLifecycle.slice(
      hoverLifecycle.indexOf(
        "function windowDropSourceTiledPresentationIsExact(source)",
      ),
      hoverLifecycle.indexOf(
        "function ownedWindowDropTiledPresentationIsExact(source)",
      ),
    );
    expect(routedValidation).not.toContain("tiledPresentations[windowId]");
    expect(routedValidation).not.toContain("source.sourceCard === card");
    expect(routedValidation).not.toContain("KWin.Workspace.activeWindow");
  });

  it("supplies height bounds only for columns whose solver state needs them", () => {
    expect(dropPlanner).toMatch(
      /for \(const column of columns\) \{\s*if \(!windowDropPreviewColumnUsesExplicitHeights\(column\)\) \{\s*continue;\s*\}\s*for \(const member of column\.members\)/u,
    );
    expect(dropPlanner).not.toContain(
      "const needsBounds = columns.some(column => windowDropPreviewColumnUsesExplicitHeights(column))",
    );
  });

  it("rejects singleton boundary no-ops and retains a multi-member self anchor", () => {
    expect(dropPlanner).toContain(
      "originalSourceColumnIndex = sourceLocation.columnIndex",
    );
    expect(dropPlanner).toMatch(
      /if \(movedColumn && insertionIndex === originalSourceColumnIndex\) \{\s*return null;\s*\}/u,
    );
    expect(dropPlanner).toMatch(
      /if \(target\.targetWindowId === sourceState\.windowId\) \{\s*retainedSourceAnchorIndex = sourceLocation\.columnIndex;\s*\}/u,
    );
    expect(dropPlanner).toContain(
      "let targetColumnIndex = retainedSourceAnchorIndex",
    );
    expect(dropPlanner).toContain(
      "Presentation is geometry-neutral for this one-member preview; runtime policy owns the commit value.",
    );
  });

  it("resolves one exact destination target while the source lifecycle is live", () => {
    expect(presentation).toContain("readonly property var sourceCard: card");
    expect(lifecycle).toContain(
      "function crossOutputWindowDropSourceIsExact(source)",
    );
    expect(lifecycle).toContain("source.sourceCard === card");
    expect(lifecycle).toContain("source.sourceScreen === screen");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive === true");
    expect(lifecycle).toContain("windowDropTargetIsExact()");
    expect(lifecycle).toContain(
      "windowDropSourceTiledPresentationIsExact(source)",
    );
    expect(lifecycle).toContain(
      "function planCrossOutputWindowDropTarget(source, localPosition)",
    );
    expect(lifecycle).toContain("sourceCard.outputId === outputId");
    expect(lifecycle).toContain("source.sourceScreen === screen");
    expect(lifecycle).toContain(
      "sourceCard.crossOutputWindowDropSourceIsExact(source)",
    );
    expect(lifecycle).toContain(
      "hitWindowDropPlannerSnapshot(snapshot, localPosition)",
    );
    expect(lifecycle).toContain(
      "windowDropPlannerTargetIsExact(target, snapshot) ? target : null",
    );
  });

  it("fails closed and releases stale hover ownership", () => {
    expect(dropArea).toContain(
      "enabled: card.enabled && card.searchQuery.trim().length === 0",
    );
    for (const signal of [
      "Candidate",
      "Destroyed",
      "DragEligible",
      "MinimizedWindow",
      "SourceDesktop",
      "SourceDesktopId",
      "SourceScreen",
      "SpatialDragLifecycleActive",
    ]) {
      expect(dropArea).toContain(`function on${signal}`);
    }
    expect(desktopCard).toContain("property bool windowDropHoverOwned");
    expect(hoverLifecycle).toContain("source === windowDropHoverSource");
    expect(hoverLifecycle).toContain(
      "source.windowId === windowDropHoverSourceWindowId",
    );
    expect(hoverLifecycle).toContain(
      "String(candidate.internalId) === windowDropHoverSourceWindowId",
    );
    expect(hoverLifecycle).toContain(
      "source.spatialDragLifecycleActive === true",
    );
    expect(hoverLifecycle).toContain("source.dragEligible === true");
    expect(hoverLifecycle).toContain("source.minimizedWindow !== true");
    expect(hoverLifecycle).toContain(
      "windowDropSourceWorkspaceRelationIsExact(source)",
    );
    expect(hoverLifecycle).toContain("windowDropTargetIsExact()");
    expect(hoverLifecycle).toContain("searchQuery.trim().length === 0");
    expect(dropValidation).toContain("windowCanDrag(source)");
    expect(dropValidation).toContain(
      "windowDropSourceWorkspaceRelationIsExact(source)",
    );
    expect(dropValidation).toContain(
      "source.spatialDragLifecycleActive === true",
    );
    expect(hoverLifecycle).not.toContain("outputName");
    expect(hoverLifecycle).toContain("Number.isFinite(drag.x)");
    expect(hoverLifecycle).toContain("Number.isFinite(drag.y)");
    expect(hoverLifecycle).toContain(
      "windowDropArea.mapToItem(null, drag.x, drag.y)",
    );
    expect(hoverLifecycle).not.toMatch(
      /\b(?:WeakSet|WeakMap|Timer|MouseArea)\b|KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(/u,
    );
  });

  it("activates an exact hovered workspace after one bounded dwell", () => {
    expect(hoverTimer).toContain(
      "interval: root.spatialWindowDragHoverThresholdMilliseconds",
    );
    expect(hoverTimer).toContain("repeat: false");
    expect(hoverTimer).toContain(
      "onTriggered: root.completeWindowWorkspaceHover()",
    );
    expect(hoverRouting).toContain("planOverviewSpatialDragHover");
    expect(hoverRouting).toContain("planWindowWorkspaceHover(0,");
    expect(hoverRouting).toContain('plan.intent !== "pending"');
    expect(hoverRouting).toContain('plan.intent !== "activate"');
    expect(hoverRouting).toContain("spatialWindowDragHoverTimer.restart()");
    expect(hoverRouting).toMatch(
      /resetWindowWorkspaceHover\(\);\s*return requestDesktopSelection\(/u,
    );
    expect(hoverRouting).toContain("sceneEffect.activeSessionId");
    expect(hoverRouting).toContain("overviewDesktopCardEpoch");
    expect(hoverRouting).toContain("spatialHorizontalViewportRevision");
    expect(hoverRouting).toContain(
      "spatialDirectDropHoverOwnedByCard(card, source)",
    );
    const hoverMove = hoverRouting.slice(
      hoverRouting.indexOf("function moveWindowWorkspaceHover("),
      hoverRouting.indexOf("function leaveWindowWorkspaceHover("),
    );
    expect(hoverMove).not.toContain("windowWorkspaceHoverContextIsExact()");
  });

  it("keeps the active window drag alive while dwell activation moves the camera", () => {
    const currentDesktopHandler = overviewScene.slice(
      overviewScene.indexOf("function handleCurrentDesktopChanged()"),
      overviewScene.indexOf("onOverviewModelChanged:"),
    );
    expect(currentDesktopHandler).toContain("spatialDirectDragSource !== null");
    expect(currentDesktopHandler).toContain(
      "spatialDirectDragSourceIsExact(spatialDirectDragSource,",
    );
    expect(currentDesktopHandler).toContain(
      "planSpatialWorkspaceCenter(currentWorkspaceIndex)",
    );
    expect(currentDesktopHandler).toContain(
      "setSpatialContentY(plan.contentY, true)",
    );
    expect(currentDesktopHandler.indexOf("return;")).toBeLessThan(
      currentDesktopHandler.indexOf("refreshOverviewSpatialSession("),
    );
    expect(overviewScene).toContain(
      "windowWorkspaceHoverTarget: root.spatialWindowDragHoverTargetDesktopId",
    );
    expect(overviewScene).toMatch(
      /function resetSpatialEdgePanTracking\(\) \{\s*resetWindowWorkspaceHover\(\);/u,
    );
  });
});

describe("spatial overview column drag lifecycle", () => {
  it("exposes one clipped top-center grip anchored by the selected live member", () => {
    expect(desktopCard).toContain(
      "signal columnSpatialDragStarted(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal columnSpatialDragMoved(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal columnSpatialDragFinished(var source)",
    );
    expect(columnShell).toContain(
      "readonly property string selectedWindowId: card.selectedWindowIdForColumn(sourceColumn)",
    );
    expect(columnShell).toMatch(
      /readonly property bool dragHandleAvailable:\s*\{[\s\S]*indexedListHasBoundedLength\(column\.members, 1, 256\)[\s\S]*column\.members\[selectedMemberIndex\]\.windowId === selectedWindowId;/u,
    );
    expect(columnShell).toContain('readonly property string scope: "column"');
    expect(columnShell).toContain("Drag.source: columnShell");
    expect(columnShell).toContain('Drag.keys: ["driftile-column"]');
    expect(columnShell).toContain("Drag.hotSpot.x: spatialDragHotSpot.x");
    expect(columnShell).toContain("Drag.hotSpot.y: spatialDragHotSpot.y");
    expect(columnGrip).toContain("readonly property real visibleLeft:");
    expect(columnGrip).toContain("readonly property real visibleRight:");
    expect(columnGrip).toContain("readonly property real visibleWidth:");
    expect(columnGrip).toContain("x: visibleLeft + (visibleWidth - width) / 2");
    expect(columnGrip).toContain("width: Math.min(56, visibleWidth)");
    expect(columnGrip).toContain(
      "visible: columnShell.dragHandleAvailable && visibleWidth >= 12",
    );
    expect(columnGrip).toContain("height: 26");
    expect(columnGrip).toContain("anchors.topMargin: 5");
    expect(columnGrip).toContain("height: 7");
    expect(columnLifecycle).toMatch(
      /function selectedWindowIdForColumn[\s\S]*members\[selectedMemberIndex\][\s\S]*return selectedMember && typeof selectedMember\.windowId[\s\S]*selectedMember\.windowId/u,
    );
    expect(`${columnShell}\n${columnLifecycle}`).not.toMatch(
      /selectedWindowId[^\n]*column\.id|windowId[^\n]*column\.id/u,
    );
  });

  it("binds count-model delegates to the authoritative live column identity", () => {
    expect(columnRepeaterLifecycle).toMatch(
      /id: columnRepeater\s*model: card\.columns\.length\s*Item \{\s*id: columnShell\s*required property int index/u,
    );
    expect(columnShell).toMatch(
      /readonly property var sourceColumn: Number\.isInteger\(index\)\s*&& index >= 0 && index < card\.columns\.length \? card\.columns\[index\] : null/u,
    );
    expect(columnShell).toContain("const column = sourceColumn;");
    expect(columnShell).not.toContain("modelData");
    expect(columnLifecycle).toContain(
      "const column = source ? source.sourceColumn : null;",
    );
    expect(columnLifecycle).toContain("columns[source.index] === column");
    expect(columnLifecycle).toContain(
      "const expectedColumn = source.sourceColumn;",
    );
    expect(columnLifecycle).toContain(
      "source.sourceColumn !== snapshot.column",
    );
    expect(columnLifecycle).not.toContain("source.modelData");
  });

  it("invalidates eligibility and owned previews when the live column identity changes", () => {
    expect(columnShell).toContain(
      "onSourceColumnChanged: card.scheduleColumnDragEligibilityRefresh()",
    );
    expect(columnDropArea).toMatch(
      /target: card\.columnDropHoverSource[\s\S]*function onSourceColumnChanged\(\) \{\s*card\.clearInvalidColumnDropHover\(\);\s*\}/u,
    );
    expect(workspaceGapPreviewSourceSignals).toMatch(
      /function onSourceColumnChanged\(\) \{\s*root\.clearInvalidWorkspaceGapPreview\(\);\s*\}/u,
    );
    expect(spatialColumnDragSourceSignals).toMatch(
      /function onSourceColumnChanged\(\) \{\s*root\.cancelActiveColumnSpatialDrag\(\);\s*\}/u,
    );
  });

  it("recomputes grip eligibility only from the latest exact window snapshots", () => {
    expect(desktopCard).toContain(
      "property int columnDragEligibilityRevision: 0",
    );
    expect(desktopCard).toContain(
      "property bool columnDragEligibilityRefreshPending: false",
    );
    expect(columnShell).toContain("property var selectedPresentation: null");
    expect(columnShell).toContain("property bool dragEligible: false");
    expect(columnEligibilityPublication).toMatch(
      /function invalidateColumnDragEligibility\(\) \{\s*selectedPresentation = null;\s*dragEligible = false;\s*\}/u,
    );
    expect(columnEligibilityPublication).toMatch(
      /function refreshColumnDragEligibility\(\) \{\s*if \(card\.columnDragEligibilityRefreshPending\) \{\s*invalidateColumnDragEligibility\(\);\s*return false;\s*\}\s*selectedPresentation = card\.presentationForWindowId\(selectedWindowId\);\s*dragEligible = selectedPresentation !== null\s*&& card\.columnDragHandleIsEligible\(columnShell\);\s*return dragEligible;\s*\}/u,
    );
    expect(
      columnEligibilityPublication.indexOf(
        "selectedPresentation = card.presentationForWindowId(selectedWindowId);",
      ),
    ).toBeLessThan(
      columnEligibilityPublication.indexOf(
        "card.columnDragHandleIsEligible(columnShell)",
      ),
    );
    expect(desktopCard).toMatch(
      /Timer \{\s*id: columnDragEligibilityRefreshTimer\s*interval: 0\s*repeat: false\s*onTriggered: \{\s*card\.columnDragEligibilityRefreshPending = false;\s*card\.advanceColumnDragEligibilityRevision\(\);\s*card\.refreshColumnDragEligibilityDelegates\(\);\s*\}\s*\}/u,
    );
    for (const change of ["onItemAdded", "onItemRemoved"]) {
      const start = windowRepeaterLifecycle.indexOf(change);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(windowRepeaterLifecycle.slice(start, start + 260)).toContain(
        "card.scheduleColumnDragEligibilityRefresh();",
      );
      expect(windowRepeaterLifecycle.slice(start, start + 260)).not.toContain(
        "card.advanceColumnDragEligibilityRevision();",
      );
    }
    expect(presentation).toMatch(
      /function refreshActionSnapshot\(\) \{\s*actionSnapshot = card\.snapshotWindowActions\(candidate\);\s*card\.scheduleColumnDragEligibilityRefresh\(\);\s*card\.navigationTargetsChanged\(\);\s*\}/u,
    );
    expect(columnLifecycle).toMatch(
      /function advanceColumnDragEligibilityRevision\(\) \{\s*columnDragEligibilityRevision = columnDragEligibilityRevision >= 2147483646\s*\? 0 : columnDragEligibilityRevision \+ 1;\s*return columnDragEligibilityRevision;\s*\}/u,
    );
    expect(columnLifecycle).toMatch(
      /function invalidateColumnDragEligibilityDelegates\(preservedSource\) \{\s*if \(!Number\.isInteger\(columnRepeater\.count\) \|\| columnRepeater\.count < 0\s*\|\| columnRepeater\.count > 131072\) \{\s*return false;\s*\}\s*for \(let index = 0; index < columnRepeater\.count; index \+= 1\) \{\s*const source = columnRepeater\.itemAt\(index\);\s*if \(source === preservedSource\) \{\s*continue;\s*\}\s*if \(source && typeof source\.invalidateColumnDragEligibility === "function"\) \{\s*source\.invalidateColumnDragEligibility\(\);\s*\}\s*\}\s*return true;\s*\}/u,
    );
    expect(columnLifecycle).toMatch(
      /function refreshColumnDragEligibilityDelegates\(\) \{\s*if \(columnDragEligibilityRefreshPending\s*\|\| !Number\.isInteger\(columnRepeater\.count\) \|\| columnRepeater\.count < 0\s*\|\| columnRepeater\.count > 131072\) \{\s*return false;\s*\}\s*for \(let index = 0; index < columnRepeater\.count; index \+= 1\) \{\s*const source = columnRepeater\.itemAt\(index\);\s*if \(source && typeof source\.refreshColumnDragEligibility === "function"\) \{\s*source\.refreshColumnDragEligibility\(\);\s*\}\s*\}\s*return true;\s*\}/u,
    );
    expect(columnLifecycle).toMatch(
      /function scheduleColumnDragEligibilityRefresh\(\) \{\s*const preservedSource = exactActiveColumnDragSourceForEligibilityRefresh\(\);\s*columnDragEligibilityRefreshPending = true;\s*invalidateColumnDragEligibilityDelegates\(preservedSource\);\s*columnDragEligibilityRefreshTimer\.restart\(\);\s*\}/u,
    );
    expect(
      columnEligibilityScheduler.indexOf(
        "invalidateColumnDragEligibilityDelegates(preservedSource);",
      ),
    ).toBeLessThan(
      columnEligibilityScheduler.indexOf(
        "columnDragEligibilityRefreshTimer.restart();",
      ),
    );
    expect(
      `${windowRepeaterLifecycle}\n${presentation}\n${columnEligibilityPublication}\n${columnEligibilityScheduler}`,
    ).not.toContain("Qt.callLater");
    for (const delegateTraversal of [
      "invalidateColumnDragEligibilityDelegates",
      "refreshColumnDragEligibilityDelegates",
    ]) {
      const start = columnEligibilityScheduler.indexOf(
        `function ${delegateTraversal}(`,
      );
      expect(start).toBeGreaterThanOrEqual(0);
      const traversal = columnEligibilityScheduler.slice(start, start + 760);
      expect(traversal).toContain("columnRepeater.count > 131072");
      expect(traversal).toContain(
        "for (let index = 0; index < columnRepeater.count; index += 1)",
      );
      expect(traversal).toContain("columnRepeater.itemAt(index)");
    }
    expect(columnEligibilityScheduler).not.toMatch(/while\s*\(|for\s*\(\s*;;/u);
    expect(columnLifecycle).toMatch(
      /function presentationForWindowId\(expectedWindowId\)[\s\S]*expectedWindowId\.length === 0[\s\S]*windowRepeater\.count > 131072[\s\S]*return null;/u,
    );
    expect(columnLifecycle).toMatch(
      /function presentationForWindowId\(expectedWindowId\)[\s\S]*if \(result !== null\) \{\s*return null;\s*\}/u,
    );
    expect(columnLifecycle).toMatch(
      /function indexedListHasBoundedLength\(value, minimumLength, maximumLength\)[\s\S]*Number\.isInteger\(value\.length\)[\s\S]*value\.length <= maximumLength;/u,
    );
    expect(columnLifecycle).toMatch(
      /function selectedWindowIdForColumn\(column\)[\s\S]*indexedListHasBoundedLength\(members, 1, 256\)/u,
    );
    expect(columnLifecycle).toMatch(
      /function columnDragMemberSnapshotsAreEligible\(column, expectedColumnIndex\)[\s\S]*indexedListHasBoundedLength\(column\.members, 1, 256\)/u,
    );
    expect(columnLifecycle).toMatch(
      /function columnDragHandleIsEligible\(source\)[\s\S]*indexedListHasBoundedLength\(column\.members, 1, 256\)[\s\S]*windowSnapshotCanDrag\(selectedPresentation\)[\s\S]*columnDragMemberSnapshotsAreEligible\(column, source\.index\)[\s\S]*windowDropTargetIsExact\(\);/u,
    );
    expect(columnLifecycle).toMatch(
      /function refreshColumnDragEligibilityAtPointer\(source\) \{[\s\S]*source\.dragHandleAvailable !== true[\s\S]*columnDragEligibilityRefreshPending[\s\S]*source\.refreshColumnDragEligibility\(\);[\s\S]*source\.dragEligible === true && columnDragHandleIsEligible\(source\);/u,
    );
  });

  it("starts mouse and touchscreen drags only after exact frozen ownership exists", () => {
    expect(desktopCard).toContain(
      "property var columnPointerHoverSource: null",
    );
    expect(desktopCard).toContain(
      "property var columnPointerPressSource: null",
    );
    expect(desktopCard).toContain(
      "required property bool spatialDirectDragBlocked",
    );
    expect(overviewScene).toContain(
      "spatialDirectDragBlocked: root.spatialDirectDragActive",
    );
    expect(columnGrip).toContain("!card.spatialDirectDragBlocked");
    expect(columnLifecycle).toContain("spatialDirectDragBlocked");
    expect(columnPointerHover).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(columnPointerHover).toContain("cursorShape: Qt.SizeAllCursor");
    expect(columnPointerHover).toMatch(
      /onHoveredChanged:[\s\S]*if \(hovered\)[\s\S]*card\.claimColumnPointerHover\(columnShell\);[\s\S]*card\.releaseColumnPointerHover\(columnShell\);/u,
    );
    expect(columnLifecycle).toMatch(
      /function claimColumnPointerHover\(source\)[\s\S]*source\.sourceCard !== card[\s\S]*!refreshColumnDragEligibilityAtPointer\(source\)[\s\S]*columnPointerHoverSource = source;/u,
    );
    expect(columnLifecycle).toMatch(
      /function releaseColumnPointerHover\(source\)[\s\S]*columnPointerHoverSource === source[\s\S]*columnPointerHoverSource = null;/u,
    );
    expect(columnPointerPress).toContain("target: null");
    expect(columnPointerPress).toContain("acceptedButtons: Qt.LeftButton");
    expect(columnPointerPress).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    for (const tap of [columnPointerPress, columnTouchHold]) {
      expect(tap).toContain("gesturePolicy: TapHandler.ReleaseWithinBounds");
      expect(tap).toContain(
        "PointerHandler.ApprovesTakeOverByHandlersOfDifferentType",
      );
      expect(tap).toContain("PointerHandler.ApprovesCancellation");
      expect(tap).not.toContain("gesturePolicy: TapHandler.DragThreshold");
    }
    expect(columnPointerPress).toMatch(
      /onPressedChanged:[\s\S]*if \(pressed\)[\s\S]*card\.claimColumnPointerPress\(columnShell\);[\s\S]*point\.state === EventPoint\.Released[\s\S]*card\.releaseColumnPointerPress\(columnShell\);/u,
    );
    expect(columnLifecycle).toMatch(
      /function claimColumnPointerPress\(source\)[\s\S]*source\.sourceCard !== card[\s\S]*!refreshColumnDragEligibilityAtPointer\(source\)[\s\S]*columnPointerPressSource = source;/u,
    );
    expect(columnLifecycle).toMatch(
      /function releaseColumnPointerPress\(source\)[\s\S]*columnPointerPressSource === source[\s\S]*columnPointerPressSource = null;/u,
    );
    expect(columnTouchHold).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(columnTouchHold).toMatch(
      /onPressedChanged:[\s\S]*if \(pressed\)[\s\S]*columnShell\.touchColumnDragArmed = false;[\s\S]*card\.claimColumnPointerPress\(columnShell\);[\s\S]*point\.state === EventPoint\.Released[\s\S]*!columnTouchDragHandler\.active[\s\S]*card\.releaseColumnPointerPress\(columnShell\);/u,
    );
    expect(columnTouchHold).toContain("onLongPressed:");
    expect(columnTouchHold).toContain(
      "card.refreshColumnDragEligibilityAtPointer(columnShell)",
    );
    expect(columnTouchHold).toContain(
      "columnShell.touchColumnDragArmed = true",
    );
    expect(columnTouchDrag).toContain(
      "dragThreshold: columnShell.touchColumnDragArmed ? 0 : 32767",
    );
    for (const drag of [columnTouchDrag, columnPointerDrag]) {
      expect(drag).toContain(
        "PointerHandler.CanTakeOverFromHandlersOfSameType",
      );
      expect(drag).toContain(
        "PointerHandler.CanTakeOverFromHandlersOfDifferentType",
      );
      expect(drag).toContain("PointerHandler.CanTakeOverFromItems");
      expect(drag).toContain("PointerHandler.ApprovesCancellation");
      expect(drag).not.toContain("PointerHandler.ApprovesTakeOverByAnything");
      expect(drag).not.toContain("PointerHandler.TakeOverForbidden");
      expect(drag).toMatch(
        /card\.beginColumnSpatialDrag\(columnShell, point\.scenePosition\);[\s\S]*columnSpatialDragLifecycleActive[\s\S]*columnShell\.Drag\.active = true/u,
      );
      expect(drag).toMatch(
        /columnShell\.releaseColumnDrag\(point\.scenePosition\)/u,
      );
      expect(drag).toContain("columnShell.cancelColumnDrag()");
      expect(drag).toContain("target: null");
    }
    expect(columnPointerDrag).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(columnLifecycle).toMatch(
      /function beginColumnSpatialDrag\(source, scenePosition\)[\s\S]*!refreshColumnDragEligibilityAtPointer\(source\)[\s\S]*const snapshot = captureColumnDragSnapshot\(source\);/u,
    );
    expect(columnLifecycle).toMatch(
      /source\.columnDragSnapshot = snapshot;\s*source\.columnSpatialDragLifecycleActive = true;\s*columnDragActiveSource = source;\s*columnSpatialDragStarted/u,
    );
    expect(columnShell).toMatch(
      /Component\.onDestruction:\s*\{\s*cancelColumnDrag\(\);\s*card\.releaseColumnPointerHover\(columnShell\);\s*\}/u,
    );
    expect(columnShell).toMatch(
      /function releaseColumnDrag\(scenePosition\)[\s\S]*storeColumnDragHotSpot\(scenePosition\)[\s\S]*columnShell\.Drag\.drop\(\)/u,
    );
    expect(columnShell).toMatch(
      /function cancelColumnDrag\(\)[\s\S]*card\.finishColumnSpatialDrag\(columnShell\);\s*card\.releaseColumnPointerPress\(columnShell\);/u,
    );
    expect(columnShell).toMatch(
      /function releaseColumnDrag\(scenePosition\)[\s\S]*card\.finishColumnSpatialDrag\(columnShell\);\s*card\.releaseColumnPointerPress\(columnShell\);/u,
    );
    expect(thumbnailMouseActivation).toContain(
      "&& card.columnPointerHoverSource === null",
    );
    expect(thumbnailMouseActivation).toContain(
      "&& card.columnPointerPressSource === null",
    );
    expect(thumbnailCloseButton).toContain(
      "enabled: card.columnPointerHoverSource === null",
    );
    expect(thumbnailCloseButton).toContain(
      "&& card.columnPointerPressSource === null",
    );
    expect(thumbnailMiddleClose).toContain("acceptedButtons: Qt.MiddleButton");
    expect(thumbnailMiddleClose).toContain(
      "&& card.columnPointerHoverSource === null",
    );
    expect(thumbnailTouchHold).toContain(
      "&& card.columnPointerPressSource === null",
    );
    expect(thumbnailDrag).toContain(
      "&& card.columnPointerHoverSource === null",
    );
    expect(thumbnailDrag).toContain(
      "&& card.columnPointerPressSource === null",
    );
    expect(thumbnailDrag).toContain("card.spatialDirectDragBlocked");
    expect(thumbnailDrag).toMatch(
      /card\.beginWindowSpatialDrag\(windowPresentation, point\.scenePosition\);[\s\S]*if \(!windowPresentation\.spatialDragLifecycleActive\)[\s\S]*thumbnailShell\.Drag\.cancel\(\)/u,
    );
    expect(lifecycle).toMatch(
      /function beginWindowSpatialDrag\(source, scenePosition\)[\s\S]*columnDragActiveSource !== null \|\| columnPointerHoverSource !== null\s*\|\| columnPointerPressSource !== null[\s\S]*return;/u,
    );
    expect(columnLifecycle).toMatch(
      /function cancelActiveColumnSpatialDrag\(\)[\s\S]*const hoveredSource = columnPointerHoverSource;[\s\S]*hoveredSource !== null && !columnDragHandleIsEligible\(hoveredSource\)[\s\S]*columnPointerHoverSource = null;/u,
    );
    expect(columnLifecycle).toMatch(
      /function cancelInvalidActiveColumnSpatialDrag\(\)[\s\S]*const hoveredSource = columnPointerHoverSource;[\s\S]*hoveredSource !== null && !columnDragHandleIsEligible\(hoveredSource\)[\s\S]*columnPointerHoverSource = null;/u,
    );
  });

  it("preserves only an exact active column source across eligibility republishing", () => {
    const activeSourceValidation = columnEligibilityScheduler.slice(
      columnEligibilityScheduler.indexOf(
        "function exactActiveColumnDragSourceForEligibilityRefresh()",
      ),
      columnEligibilityScheduler.indexOf(
        "function invalidateColumnDragEligibilityDelegates(",
      ),
    );
    const delegateInvalidation = columnEligibilityScheduler.slice(
      columnEligibilityScheduler.indexOf(
        "function invalidateColumnDragEligibilityDelegates(",
      ),
      columnEligibilityScheduler.indexOf(
        "function refreshColumnDragEligibilityDelegates(",
      ),
    );
    const refreshScheduling = columnEligibilityScheduler.slice(
      columnEligibilityScheduler.indexOf(
        "function scheduleColumnDragEligibilityRefresh()",
      ),
      columnEligibilityScheduler.indexOf("function presentationForWindowId("),
    );

    expect(activeSourceValidation).toMatch(
      /function exactActiveColumnDragSourceForEligibilityRefresh\(\) \{\s*const source = columnDragActiveSource;\s*if \(source === null\) \{\s*return null;\s*\}\s*if \(!ownedColumnDropSnapshotIsExact\(source\)\s*\|\| !columnDragHandleIsEligible\(source\)\) \{\s*cancelColumnSpatialDragSource\(source\);\s*return null;\s*\}\s*return source;\s*\}/u,
    );
    expect(delegateInvalidation).toMatch(
      /function invalidateColumnDragEligibilityDelegates\(preservedSource\)[\s\S]*const source = columnRepeater\.itemAt\(index\);\s*if \(source === preservedSource\) \{\s*continue;\s*\}\s*if \(source && typeof source\.invalidateColumnDragEligibility === "function"\) \{\s*source\.invalidateColumnDragEligibility\(\);\s*\}/u,
    );
    expect(refreshScheduling).toMatch(
      /const preservedSource = exactActiveColumnDragSourceForEligibilityRefresh\(\);\s*columnDragEligibilityRefreshPending = true;\s*invalidateColumnDragEligibilityDelegates\(preservedSource\);\s*columnDragEligibilityRefreshTimer\.restart\(\);/u,
    );
  });

  it("captures the complete column once and validates every member without a move-time scan", () => {
    expect(columnLifecycle).toContain(
      "function columnDragMemberSnapshotsAreEligible(column, expectedColumnIndex)",
    );
    expect(columnLifecycle).toContain(
      "columnDragMemberSnapshotsAreEligible(column, source.index)",
    );
    expect(columnLifecycle).toMatch(
      /function columnDragMemberSnapshotsAreEligible[\s\S]*!windowSnapshotCanJoinColumnDrag\(presentation, selectedMember\)[\s\S]*return matchCount === column\.members\.length/u,
    );
    expect(columnLifecycle).toContain(
      "function captureColumnDragSnapshot(source)",
    );
    expect(columnLifecycle).toContain(
      "const expectedColumn = source.sourceColumn",
    );
    expect(columnLifecycle).toContain(
      "const selectedMemberIndex = expectedColumn.selectedMemberIndex",
    );
    expect(columnLifecycle).toContain(
      "const previewColumn = cloneWindowDropPreviewColumn(expectedColumn)",
    );
    expect(columnLifecycle).toContain(
      "const widthState = captureColumnWidthState(expectedColumn.width)",
    );
    expect(columnLifecycle).toContain("heightState");
    expect(columnLifecycle).toContain("heightBoundsState");
    expect(columnLifecycle).toContain("memberIndex,");
    expect(columnLifecycle).toContain("Object.freeze(previewColumn.members)");
    expect(columnLifecycle).toContain("Object.freeze(records)");
    expect(columnLifecycle).toContain("Object.freeze(expectedMemberIds)");
    expect(columnLifecycle).toContain(
      "function ownedColumnDropSnapshotIsExact(source)",
    );
    expect(columnLifecycle).toContain(
      "snapshot.memberIds[record.windowId] !== memberIndex",
    );
    expect(columnLifecycle).toContain(
      "columnMemberHeightStateIsExact(member, record.heightState)",
    );
    expect(columnLifecycle).toContain(
      "columnMemberHeightBoundsStateIsExact(member, record.heightBoundsState)",
    );
    const move = columnLifecycle.slice(
      columnLifecycle.indexOf("function moveColumnSpatialDrag("),
      columnLifecycle.indexOf("function finishColumnSpatialDrag("),
    );
    expect(move).not.toMatch(
      /windowRepeater\.itemAt|planOverviewSpatialRowGeometry|KWin\.Workspace\.(?:stackingOrder|windows)/u,
    );
    expect(columnLifecycle).not.toMatch(
      /Object\.freeze\((?:expectedColumn|expectedContext|expectedDesktop|expectedScreen|presentation|candidate)\)/u,
    );
  });

  it("keeps settled minimized non-selected members in exact whole-column drags", () => {
    expect(passiveColumnMemberSnapshot).toMatch(
      /function windowSnapshotCanJoinColumnDrag\(presentation, selectedMember\) \{\s*if \(selectedMember === true\) \{\s*return windowSnapshotCanDrag\(presentation\);\s*\}\s*return windowSnapshotCanDrag\(presentation\)\s*\|\| windowSnapshotIsExactPassiveMinimizedMember\(presentation\);/u,
    );
    for (const exactState of [
      "presentation.minimizedWindow !== true",
      "snapshot.minimized !== true",
      "snapshot.managed !== true",
      "snapshot.normalWindow !== true",
      "snapshot.moveable !== true",
      "snapshot.wantsInput !== true",
      "snapshot.modal !== false",
      "snapshot.transient !== false",
      "snapshot.transientFor !== null",
      "snapshot.output !== sourceScreen",
      "candidate.output !== sourceScreen",
      "snapshot.desktops.length !== 1",
      "snapshot.desktopIds.length !== 1",
      "snapshot.desktops[0] !== sourceDesktop",
      "snapshot.desktopIds[0] !== sourceDesktopId",
    ]) {
      expect(passiveColumnMemberSnapshot).toContain(exactState);
    }
    expect(passiveColumnMemberSnapshot).toContain(
      "candidateDesktops[0] === sourceDesktop",
    );
    expect(passiveColumnMemberSnapshot).toContain(
      "String(candidateDesktops[0].id) === sourceDesktopId",
    );
    expect(
      columnLifecycle.match(/windowSnapshotCanJoinColumnDrag\(/gu),
    ).toHaveLength(3);
    expect(columnLifecycle).toContain(
      "memberIndex === column.selectedMemberIndex",
    );
    expect(columnLifecycle).toContain("memberIndex === selectedMemberIndex");
    expect(columnLifecycle).toContain(
      "memberIndex === snapshot.selectedMemberIndex",
    );
    expect(columnLifecycle).toContain(
      "presentation.actionSnapshot !== record.actionSnapshot",
    );
    expect(`${passiveColumnMemberSnapshot}\n${columnLifecycle}`).not.toMatch(
      /org\.kde\.kwin\.private|KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(|candidate\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("keeps window and whole-column drop ownership strictly separate", () => {
    expect(columnDropArea).toContain('keys: ["driftile-column"]');
    expect(dropArea).toContain('keys: ["driftile-window"]');
    expect(columnDropArea).toContain(
      "card.columnDropIsValid(drag.source, drag.keys)",
    );
    expect(columnDropArea).toContain(
      "const exactTarget = card.columnDropHoverTarget",
    );
    expect(columnDropArea).toContain(
      "card.columnDropPreviewIsExact(card.columnDropHoverPreview, source, exactTarget,",
    );
    expect(columnDropArea.indexOf("card.clearColumnDropHover();")).toBeLessThan(
      columnDropArea.indexOf("card.columnDropped("),
    );
    expect(columnDropArea).not.toContain("card.windowDropped(");
    expect(dropArea).not.toContain("card.columnDropped(");
    expect(columnPlanner).toContain("source.sourceScreen === screen");
    expect(columnPlanner).not.toContain("requestCrossOutputWindowDrop");
    expect(columnPointerDrag).not.toContain("requestCrossOutputWindowDrop");
  });

  it("canonicalizes whole-column targets and previews exact no-op-sensitive placement", () => {
    expect(columnPlanner).toContain(
      "column.members[column.selectedMemberIndex]",
    );
    expect(columnPlanner).toContain('kind: "column-boundary"');
    expect(columnPlanner).toContain("targetWindowId: selectedWindowId");
    expect(columnPlanner).toMatch(
      /localPosition\.x < frame\.x \+ frame\.width \/ 2 \? target\.before : target\.after/u,
    );
    expect(columnPlanner).not.toContain('kind: "stack-insertion"');
    expect(columnPlanner).toContain(
      "const sourceLocation = windowDropPreviewLocation(columns, sourceSnapshot.selectedWindowId)",
    );
    expect(columnPlanner).toContain(
      "columns.splice(originalSourceColumnIndex, 1)[0]",
    );
    expect(columnPlanner).toContain(
      "if (sameContext && insertionIndex === originalSourceColumnIndex)",
    );
    expect(columnPlanner).toContain(
      "sourceSnapshot.memberIds[target.targetWindowId] !== undefined",
    );
    expect(columnPlanner).toContain("runtime.planOverviewSpatialRowGeometry({");
    expect(columnPlanner).toContain(
      "plan.dimensions.viewportInsetX + plannedColumn.contentX - plan.camera.base",
    );
    expect(columnPlanner).toContain("frame.x - plan.camera.base");
    expect(columnPlanner).toContain(
      "function columnDropPreviewMemberFramesAreExact(",
    );
    expect(columnPlanner).toContain("Object.isFrozen(frame)");
    expect(columnPlanner).toContain(
      "memberFrames[0].windowId === sourceSnapshot.selectedWindowId",
    );
  });

  it("renders one monochrome scene proxy and reuses the shared pan and dwell owners", () => {
    expect(sceneColumnLifecycle).toContain("spatialColumnDragSource = source");
    expect(sceneColumnLifecycle).toContain(
      "captureSpatialColumnDragVisual(source)",
    );
    expect(sceneColumnVisual).toContain(
      "visible: root.spatialColumnDragVisualIsExact()",
    );
    expect(sceneColumnVisual).toContain(
      "model: spatialColumnDragVisual.plan ? spatialColumnDragVisual.plan.members : []",
    );
    expect(sceneColumnVisual).not.toMatch(
      /KWin\.WindowThumbnail|\bLoader\s*\{/u,
    );
    expect(sceneColumnVisualLifecycle).toContain("members.length >= 32");
    expect(sceneColumnVisualLifecycle).toContain(
      "memberTarget.mapToItem(root, 0, 0,",
    );
    expect(sceneColumnVisualLifecycle).toContain(
      "plan.snapshot === source.columnDragSnapshot",
    );
    expect(overviewScene).toContain(
      "readonly property var spatialDirectDragSource:",
    );
    expect(overviewScene).toContain(
      "readonly property bool spatialDirectDragActive:",
    );
    expect(hoverRouting).toContain("source !== spatialDirectDragSource");
    expect(hoverRouting).toContain(
      "spatialDirectDropHoverOwnedByCard(card, source)",
    );
  });

  it("submits same-output column and workspace-gap commands with explicit v3 scope", () => {
    expect(columnWorkspaceGapLifecycle).toContain(
      "source.sourceScreen === targetScreen",
    );
    expect(columnWorkspaceGapLifecycle).toContain(
      "liveScreen !== liveTargetScreen",
    );
    expect(columnWorkspaceGapLifecycle).toContain('scope: "column"');
    expect(columnSpatialSubmission).toContain(
      "liveSourceScreen !== liveTargetScreen",
    );
    expect(columnSpatialSubmission).toContain(
      "liveSourceScreen !== targetScreen",
    );
    expect(columnSpatialSubmission).toContain('scope: "column"');
    expect(columnSpatialSubmission).toContain(
      "spatialDropContextSelectedColumnAnchorIsExact(",
    );
    expect(columnSpatialSubmission).not.toContain('kind: "stack-insertion"');
    expect(overviewScene.match(/scope: "window"/gu)).toHaveLength(2);
    expect(overviewScene.match(/scope: "column"/gu)).toHaveLength(2);
    expect(
      `${columnWorkspaceGapLifecycle}\n${columnSpatialSubmission}`,
    ).not.toContain("checkItemDroppedOutOfScreen");
  });

  it("fails closed on escape, search, topology, and scene changes without new polling", () => {
    expect(overviewScene).toMatch(
      /Qt\.Key_Escape && spatialColumnDragSource !== null[\s\S]*root\.cancelActiveColumnSpatialDrag\(\)/u,
    );
    expect(overviewScene).toMatch(
      /onSearchQueryChanged: \{[\s\S]*?root\.cancelWorkspaceRenameOnDrift\(\);[\s\S]*?root\.cancelActiveColumnSpatialDrag\(\)/u,
    );
    for (const change of [
      "onOverviewModelChanged",
      "onOutputIdChanged",
      "onDesktopIdsChanged",
      "onWidthChanged",
      "onHeightChanged",
      "onDesktopsChanged",
    ]) {
      const start = overviewScene.indexOf(change);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(overviewScene.slice(start, start + 260)).toContain(
        "cancelActiveColumnSpatialDrag()",
      );
    }
    for (const change of [
      "onCurrentActivityChanged",
      "onActivitiesChanged",
      "onScreensChanged",
      "onVirtualScreenGeometryChanged",
    ]) {
      const start = overviewScene.indexOf(change);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(overviewScene.slice(start, start + 320)).toContain(
        "beginOverviewContextRefreshBarrier()",
      );
    }
    expect(
      `${columnShell}\n${columnLifecycle}\n${columnPlanner}\n${sceneColumnLifecycle}\n${sceneColumnVisualLifecycle}\n${columnWorkspaceGapLifecycle}\n${columnSpatialSubmission}`,
    ).not.toMatch(
      /org\.kde\.kwin\.private|KWin\.Workspace\.(?:stackingOrder|windows)|\b(?:MouseArea|Timer)\s*\{|setInterval|setTimeout|\.setValue\s*\(/u,
    );
  });
});

function handlerBlock(handlerId: string, nextId: string): string {
  return desktopCard.slice(
    desktopCard.indexOf(`id: ${handlerId}`),
    desktopCard.indexOf(`id: ${nextId}`),
  );
}
