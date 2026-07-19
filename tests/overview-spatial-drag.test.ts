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
const thumbnailDrag = handlerBlock(
  "thumbnailDragHandler",
  "minimizedPlaceholderShell",
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
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(2);
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
      /const action = [A-Za-z]+Shell\.Drag\.drop\(\);[\s\S]*?[A-Za-z]+Shell\.Drag\.active = false;[\s\S]*?card\.finishWindowSpatialDrag\(source\);[\s\S]*?if \(action === Qt\.MoveAction\) \{\s*return;/u,
    );
    expect(drag).toMatch(
      /else \{\s*[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
    expect(drag).toMatch(
      /transition === PointerDevice\.CancelGrabExclusive[\s\S]*?transition === PointerDevice\.CancelGrabPassive[\s\S]*?[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
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

  it("renders a bounded preview from the cached exact drop target", () => {
    expect(dropArea).toContain(
      "readonly property var spatialPreview: validTarget",
    );
    expect(dropArea).toContain(
      "card.planWindowDropPreview(card.windowDropHoverTarget, card.windowDropHoverSnapshot)",
    );
    expect(dropArea).toContain("id: spatialWindowDropPreviewSurface");
    expect(dropArea).toContain("id: spatialWindowDropPreviewMarker");
    expect(dropArea).toContain('plan.kind === "empty-row"');
    expect(dropArea).toContain('plan.kind === "stack-insertion"');
    expect(dropPlanner).toContain("const previewFrames = Object.create(null)");
    expect(dropPlanner).toContain("Object.freeze(previewFrames)");
    expect(dropPlanner).toContain("previewFrames,");
    expect(dropPlanner).toContain(
      "function planWindowDropPreview(target, snapshot)",
    );
    expect(dropPlanner).toContain(
      "windowDropPlannerTargetIsExact(target, snapshot)",
    );
    expect(dropPlanner).toContain(
      "function windowDropPreviewFrameIsBounded(frame, snapshot)",
    );
    expect(dropPlanner).toContain(
      "frame.x + frame.width <= snapshot.cardWidth",
    );
    expect(dropPlanner).toContain(
      "frame.y + frame.height <= snapshot.cardHeight",
    );
    expect(`${dropArea}\n${dropPlanner}`).not.toMatch(
      /\b(?:Behavior|NumberAnimation|Timer)\b|\.setValue\s*\(/u,
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
