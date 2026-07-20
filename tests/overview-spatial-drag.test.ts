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
  desktopCard.indexOf("onCurrentChanged:"),
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
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(3);
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
      "opacity: thumbnailShell.Drag.active ? 0.2 : 1",
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
    expect(hoverRouting).toContain("card.windowDropHoverOwned === true");
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
    expect(currentDesktopHandler).toContain("spatialWindowDragSource !== null");
    expect(currentDesktopHandler).toContain(
      "windowSpatialDragSourceIsExact(spatialWindowDragSource,",
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

function handlerBlock(handlerId: string, nextId: string): string {
  return desktopCard.slice(
    desktopCard.indexOf(`id: ${handlerId}`),
    desktopCard.indexOf(`id: ${nextId}`),
  );
}
