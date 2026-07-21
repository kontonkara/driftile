import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const desktopCard = readFileSync(
  new URL("contents/runtime/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

const collection = desktopCard.slice(
  desktopCard.indexOf("function collectNavigationTargets("),
  desktopCard.indexOf("function viewportPointHitsWindow("),
);
const navigationVisual = desktopCard.slice(
  desktopCard.indexOf("function navigationVisualForPresentation("),
  desktopCard.indexOf("function windowSnapshotCanActivateMinimizedWindow("),
);
const logicalTabClip = desktopCard.slice(
  desktopCard.indexOf("function clippedLogicalTabNavigationRect("),
  desktopCard.indexOf("function clippedCardNavigationRect("),
);
const tabRailPlanning = desktopCard.slice(
  desktopCard.indexOf("function buildTabRailPlans("),
  desktopCard.indexOf("function buildSpatialColumnFrames("),
);
const tabRailLifecycle = desktopCard.slice(
  desktopCard.indexOf("onTabRailPlansChanged:"),
  desktopCard.indexOf("onSpatialRowGeometryPlanChanged:"),
);
const windowPresentation = desktopCard.slice(
  desktopCard.indexOf("id: windowPresentation"),
  desktopCard.indexOf("id: tabShell"),
);
const tabRailLayer = desktopCard.slice(
  desktopCard.indexOf("id: tabRailLayer"),
  desktopCard.indexOf("id: columnRepeater"),
);
const columnShell = desktopCard.slice(
  desktopCard.indexOf("id: columnShell"),
  desktopCard.indexOf("Drag.active: false"),
);
const tabShell = desktopCard.slice(
  desktopCard.indexOf("id: tabShell"),
  desktopCard.indexOf("id: thumbnailShell"),
);
const viewportHitTest = desktopCard.slice(
  desktopCard.indexOf("function viewportPointHitsWindow("),
  desktopCard.indexOf("function visualContainsViewportPoint("),
);
const windowClip = desktopCard.slice(
  desktopCard.indexOf("function clippedNavigationRect("),
  desktopCard.indexOf("function clippedCardNavigationRect("),
);
const cardClip = desktopCard.slice(
  desktopCard.indexOf("function clippedCardNavigationRect("),
  desktopCard.indexOf("function intersectRects("),
);
const horizontalBackdropInput = scene.slice(
  scene.indexOf("Item {\n        id: spatialHorizontalViewportInput"),
  scene.indexOf("Item {\n        id: spatialCanvas"),
);
const horizontalRowInput = scene.slice(
  scene.indexOf("Item {\n        id: spatialHorizontalRowInput"),
  scene.indexOf("KeyboardHelpHint {"),
);
const horizontalRowHitTest = scene.slice(
  scene.indexOf("function spatialHorizontalViewportRowContains("),
  scene.indexOf("function beginSpatialHorizontalViewportDrag("),
);
const horizontalDragLifecycle = scene.slice(
  scene.indexOf("function beginSpatialHorizontalViewportDrag("),
  scene.indexOf("function spatialViewportOverlayContainsPoint("),
);
const presentationEligibility = scene.slice(
  scene.indexOf("readonly property string spatialPresentationPhase:"),
  scene.indexOf("readonly property bool spatialHorizontalRowDragActive:"),
);
const keyboardInput = scene.slice(
  scene.indexOf("Keys.onPressed:"),
  scene.indexOf("Component.onCompleted:"),
);
const presentationLifecycle = scene.slice(
  scene.indexOf("function handleSpatialPresentationPhaseChanged("),
  scene.indexOf("function resetOverviewSession("),
);
const wheelRouting = scene.slice(
  scene.indexOf("function routeOverviewWheel("),
  scene.indexOf("function releaseOverviewWheelAxisIfIdle("),
);
const numberGutter = desktopCard.slice(
  desktopCard.indexOf("id: numberGutter"),
  desktopCard.indexOf("id: desktopNameGutter"),
);
const keyboardActivation = scene.slice(
  scene.indexOf("function activateKeyboardSelection("),
  scene.indexOf("function closeKeyboardSelection("),
);
const initialSelection = scene.slice(
  scene.indexOf("function preferredInitialNavigationTarget("),
  scene.indexOf("function navigationTargetPrecedes("),
);
const horizontalCameraAnimation = scene.slice(
  scene.indexOf("id: spatialHorizontalCameraAnimation"),
  scene.indexOf(
    "WheelHandler {",
    scene.indexOf("id: spatialHorizontalCameraAnimation"),
  ),
);
const horizontalCameraMotion = scene.slice(
  scene.indexOf("function spatialHorizontalCameraMotionIsExact("),
  scene.indexOf("function advanceSpatialHorizontalViewportRevision("),
);
const horizontalViewportWheel = scene.slice(
  scene.indexOf("function handleSpatialHorizontalViewportWheel("),
  scene.indexOf("function handleSpatialHorizontalSelectionWheel("),
);
const horizontalSelectionWheelCompletion = scene.slice(
  scene.indexOf("function completeSpatialHorizontalWheelSelection("),
  scene.indexOf("function horizontalWheelSelectionRequestContextIsExact("),
);
const keyboardNavigation = scene.slice(
  scene.indexOf("function navigateKeyboardSelection("),
  scene.indexOf("function navigateKeyboardBoundary("),
);
const selectionViewportSynchronization = scene.slice(
  scene.indexOf("function setKeyboardSelectionTarget("),
  scene.indexOf("function planSpatialWorkspaceCenter("),
);
const keyboardSelectionLifecycle = scene.slice(
  scene.indexOf("onKeyboardSelectionIdChanged:"),
  scene.indexOf("onKeyboardHelpVisibleChanged:"),
);
const cardNavigationTargetChange = scene.slice(
  scene.indexOf("onNavigationTargetsChanged:"),
  scene.indexOf("onDesktopTapped:"),
);
const selectionRepair = scene.slice(
  scene.indexOf("function repairKeyboardSelectionFrom("),
  scene.indexOf("function searchSummaryIsValid("),
);
const horizontalReveal = scene.slice(
  scene.indexOf("function revealHorizontalNavigationTarget("),
  scene.indexOf("function handleSpatialViewportWheel("),
);
const exitHandoff = scene.slice(
  scene.indexOf("function beginSpatialExitHandoff("),
  scene.indexOf("function settleSpatialExitHandoff("),
);
const presentationPhaseLifecycle = scene.slice(
  scene.indexOf("function handleSpatialPresentationPhaseChanged("),
  scene.indexOf("function resetOverviewSession("),
);

describe("spatial overview navigation geometry", () => {
  it("preserves default clipping while the spatial scene opts into offscreen targets", () => {
    expect(collection).toContain(
      "function collectNavigationTargets(sceneItem, includeOffscreen = false)",
    );
    expect(scene).toContain("desktopCard.collectNavigationTargets(root, true)");

    expect(windowClip).toContain("includeOffscreen = false");
    expect(windowClip).toMatch(
      /if \(includeOffscreen === true\) \{[\s\S]*height: bottom - top,[\s\S]*width: rect\.width,[\s\S]*x: rect\.x,[\s\S]*y: top/u,
    );
    expect(cardClip).toContain("includeOffscreen = false");
    expect(cardClip).toMatch(
      /if \(includeOffscreen !== true\) \{[\s\S]*?height: sceneItem\.height,[\s\S]*?width: sceneItem\.width,[\s\S]*?x: 0,[\s\S]*?y: 0[\s\S]*?\}/u,
    );
  });

  it("can retain offscreen mapped targets without escaping card clips", () => {
    expect(collection).toContain(
      "navigationRectForPresentation(presentation, sceneItem",
    );
    expect(collection).toContain(
      "clippedCardNavigationRect(numberGutter, sceneItem, includeOffscreen)",
    );

    expect(windowClip).toContain("visual.mapToItem(sceneItem");
    expect(windowClip).toContain("viewport.mapToItem(sceneItem");
    expect(windowClip).toContain("card.mapToItem(sceneItem");
    expect(windowClip.indexOf("viewport.mapToItem(sceneItem")).toBeLessThan(
      windowClip.indexOf("if (includeOffscreen === true)"),
    );
    expect(windowClip.indexOf("card.mapToItem(sceneItem")).toBeLessThan(
      windowClip.indexOf("if (includeOffscreen === true)"),
    );
    expect(windowClip).toContain(
      "const top = Math.max(rect.y, viewportRect.y, cardRect.y)",
    );
    expect(windowClip).toContain(
      "const bottom = Math.min(rect.y + rect.height, viewportRect.y + viewportRect.height",
    );
    expect(windowClip).toContain("cardRect.y + cardRect.height)");
    expect(windowClip).toContain("width: rect.width");
    expect(windowClip).toContain("x: rect.x");

    expect(cardClip).toContain("visual.mapToItem(sceneItem");
    expect(cardClip).toContain("card.mapToItem(sceneItem");
    expect(cardClip).not.toContain("viewport.mapToItem(sceneItem");
    expect(cardClip.indexOf("card.mapToItem(sceneItem")).toBeLessThan(
      cardClip.indexOf("if (includeOffscreen !== true)"),
    );
  });

  it("keeps the current desktop as an actionable keyboard target", () => {
    expect(numberGutter).toMatch(
      /readonly property bool keyboardSelected: card\.searchQuery\.trim\(\)\.length === 0\s*&& card\.keyboardSelectionId === card\.desktopNavigationTargetId\(\)/u,
    );
    expect(numberGutter).not.toContain("!card.current");
    expect(numberGutter).toMatch(
      /visible: numberGutter\.keyboardSelected[\s\S]*border\.width: 3[\s\S]*border\.color: "#ffd166"/u,
    );

    expect(collection).toContain("if (searchQuery.trim().length === 0)");
    expect(collection).not.toContain("if (!current &&");
    expect(collection).toMatch(
      /targets\.push\(\{\s*candidate: desktop,\s*desktop,\s*desktopId,\s*id: desktopNavigationTargetId\(\),\s*kind: "desktop",\s*rect: gutterRect,\s*screen\s*\}\);/u,
    );
    expect(keyboardActivation).toMatch(
      /if \(target\.kind === "desktop"\) \{\s*return selectDesktop\(target\.candidate, target\.desktopId, target\.screen\);/u,
    );
    expect(`${numberGutter}\n${collection}\n${keyboardActivation}`).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("prefers current actionable targets before the visual fallback", () => {
    expect(initialSelection).toContain(
      'const activeDesktopId = currentDesktop ? String(currentDesktop.id) : ""',
    );
    expect(initialSelection).toContain("let firstActive = null");
    expect(initialSelection).toContain("let firstCurrentDesktop = null");
    expect(initialSelection).toContain("let currentDesktopMarker = null");
    expect(initialSelection).toContain("let firstVisual = null");
    expect(initialSelection).toMatch(
      /if \(target\.kind === "window" && target\.candidate === activeWindow\) \{\s*if \(target\.desktopId === activeDesktopId\) \{\s*return target;/u,
    );
    expect(initialSelection).toMatch(
      /target\.kind === "window" && target\.desktopId === activeDesktopId\s*&& \(!firstCurrentDesktop \|\| navigationTargetPrecedes\(target, firstCurrentDesktop\)\)/u,
    );
    expect(initialSelection).toMatch(
      /target\.kind === "desktop" && target\.desktopId === activeDesktopId\s*&& \(!currentDesktopMarker \|\| navigationTargetPrecedes\(target, currentDesktopMarker\)\)/u,
    );
    expect(initialSelection).toContain(
      "return firstActive || firstCurrentDesktop || currentDesktopMarker || firstVisual",
    );
    expect(initialSelection.indexOf("firstCurrentDesktop")).toBeLessThan(
      initialSelection.indexOf("currentDesktopMarker"),
    );
    expect(initialSelection.indexOf("currentDesktopMarker")).toBeLessThan(
      initialSelection.indexOf("firstVisual"),
    );
    expect(collection).toContain("if (searchQuery.trim().length === 0)");
    expect(`${initialSelection}\n${collection}`).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("fails closed to finite positive plain rectangles", () => {
    const validation = desktopCard.slice(
      desktopCard.indexOf("function navigationRectIsValid("),
      desktopCard.indexOf("function intersectRects("),
    );

    for (const clip of [windowClip, cardClip]) {
      expect(clip).toContain(
        "return navigationRectIsValid(rect) ? rect : null;",
      );
      expect(clip).toMatch(/catch \(error\) \{\s*return null;/u);
    }
    for (const field of ["x", "y", "width", "height"]) {
      expect(validation).toContain(`Number.isFinite(rect.${field})`);
    }
    expect(validation).toContain("rect.width > 0 && rect.height > 0");
    expect(
      `${collection}\n${windowClip}\n${cardClip}\n${validation}`,
    ).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(|\b(?:MouseArea|Timer|WheelHandler|TapHandler|DragHandler)\s*\{/u,
    );
  });

  it("projects exactly the declared primary visual for every actionable window", () => {
    expect(windowPresentation).toMatch(
      /readonly property bool minimizedActivationEligible: minimizedWindow\s*&& selectedThumbnail && matchesSearch && frame !== null/u,
    );
    expect(windowPresentation).toMatch(
      /readonly property string primaryVisualKind: !matchesSearch \|\| !model\.window \? ""\s*: !minimizedWindow && selectedThumbnail && frame !== null \? "thumbnail"\s*: minimizedActivationEligible && minimizedPlaceholderFrame !== null \? "placeholder"\s*: tabFrame !== null \? "tab" : ""/u,
    );
    expect(navigationVisual).toContain(
      "function navigationVisualForPresentation(presentation)",
    );
    expect(navigationVisual).toContain(
      "switch (presentation.primaryVisualKind)",
    );
    expect(navigationVisual).toMatch(
      /case "thumbnail":\s*return presentation\.minimizedWindow !== true\s*&& presentation\.selectedThumbnail === true\s*&& presentation\.thumbnailTarget && presentation\.thumbnailTarget\.visible\s*\? presentation\.thumbnailTarget : null;/u,
    );
    expect(navigationVisual).toMatch(
      /case "placeholder":\s*return presentation\.minimizedWindow === true\s*&& presentation\.selectedThumbnail === true\s*&& presentation\.minimizedPlaceholderTarget\s*&& presentation\.minimizedPlaceholderTarget\.visible\s*\? presentation\.minimizedPlaceholderTarget : null;/u,
    );
    expect(navigationVisual).toMatch(
      /case "tab":\s*return presentation\.tabTarget && presentation\.tabTarget\.visible\s*&& presentation\.tabTarget\.activationEligible === true\s*\? presentation\.tabTarget : null;/u,
    );
    expect(navigationVisual).toMatch(/default:\s*return null;/u);
    expect(navigationVisual).not.toMatch(
      /if \(presentation\.minimizedWindow[\s\S]*return presentation\.(?:thumbnailTarget|minimizedPlaceholderTarget|tabTarget)/u,
    );

    expect(navigationVisual).toContain(
      "const visual = navigationVisualForPresentation(presentation);",
    );
    expect(collection).toContain(
      "navigationRectForPresentation(presentation, sceneItem",
    );
    expect(collection.match(/targets\.push\(\{/gu)).toHaveLength(2);
    expect(
      collection.match(/id: navigationTargetId\(presentation\.windowId\)/gu),
    ).toHaveLength(1);
    expect(collection).not.toMatch(
      /presentation\.minimizedWindow\s*\?\s*presentation\.minimizedPlaceholderTarget/u,
    );
  });

  it("keeps tab chips in hit testing without bypassing search filtering", () => {
    expect(viewportHitTest).toContain(
      "visualContainsViewportPoint(presentation.tabTarget, point)",
    );
    expect(viewportHitTest).toContain(
      "visualContainsViewportPoint(presentation.thumbnailTarget, point)",
    );
    expect(viewportHitTest).toContain(
      "visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)",
    );
    expect(collection).toContain(
      "!presentation.matchesSearch || !windowCanNavigate(presentation)",
    );
    expect(collection.indexOf("!presentation.matchesSearch")).toBeLessThan(
      collection.indexOf("navigationRectForPresentation(presentation"),
    );
    expect(
      `${navigationVisual}\n${collection}\n${viewportHitTest}`,
    ).not.toMatch(
      /org\.kde\.kwin\.private|KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(/u,
    );
  });

  it("keeps minimized tab actions above the selected column visual", () => {
    const tabRailZ = Number(tabRailLayer.match(/\bz:\s*(\d+)/u)?.[1]);
    const columnShellZ = Number(columnShell.match(/\bz:\s*(\d+)/u)?.[1]);
    const activationId = tabShell.indexOf("id: tabActivationHandler");
    const activationHandler = tabShell.slice(
      tabShell.lastIndexOf("TapHandler {", activationId),
      tabShell.indexOf("\n                    TapHandler {", activationId),
    );
    const touchActivationId = tabShell.indexOf("id: tabTouchHoldHandler");
    const touchActivationHandler = tabShell.slice(
      tabShell.lastIndexOf("TapHandler {", touchActivationId),
      tabShell.indexOf(
        "\n                    DragHandler {",
        touchActivationId,
      ),
    );
    const activationTapHelperId = tabShell.indexOf(
      "function handleActivationTap(point)",
    );
    const activationTapHelper = tabShell.slice(
      activationTapHelperId,
      tabShell.indexOf("function cancelSpatialDrag()", activationTapHelperId),
    );

    expect(Number.isFinite(tabRailZ)).toBe(true);
    expect(Number.isFinite(columnShellZ)).toBe(true);
    expect(tabRailZ).toBeGreaterThan(columnShellZ);
    expect(tabShell).toContain("parent: tabRailLayer");
    expect(tabShell).toMatch(
      /readonly property bool activationEligible: windowPresentation\.primaryVisualKind === "tab"\s*&& frame !== null && frame\.visible === true\s*&& windowPresentation\.matchesSearch/u,
    );
    expect(tabShell).toMatch(
      /function activationIsExact\(\) \{\s*return tabShell\.visible && tabShell\.frameIsExact\(\)\s*&& tabShell\.frame\.visible === true\s*&& windowPresentation\.primaryVisualKind === "tab"/u,
    );
    expect(activationHandler).toContain(
      "gesturePolicy: TapHandler.ReleaseWithinBounds",
    );
    expect(activationHandler).not.toContain("TapHandler.DragThreshold");
    expect(activationHandler).toMatch(
      /grabPermissions: PointerHandler\.ApprovesTakeOverByHandlersOfSameType\s*\| PointerHandler\.ApprovesTakeOverByHandlersOfDifferentType\s*\| PointerHandler\.ApprovesCancellation/u,
    );
    expect(tabShell).toContain("property int activationGestureSerial: 0");
    expect(tabShell).toContain(
      "property var minimizedActivationSnapshot: null",
    );
    expect(tabShell).toContain("minimizedActivationSnapshot = Object.freeze({");
    expect(tabShell).toMatch(
      /onGrabChanged: \(transition, point\) =>\s*tabShell\.handleActivationGrabChanged\(transition, point\)/u,
    );
    expect(tabShell).toMatch(
      /transition === PointerDevice\.GrabPassive\s*\|\| transition === PointerDevice\.GrabExclusive[\s\S]*EventPoint\.Pressed[\s\S]*armMinimizedActivation\(point\)[\s\S]*transition !== PointerDevice\.UngrabPassive\s*&& transition !== PointerDevice\.UngrabExclusive[\s\S]*EventPoint\.Released[\s\S]*Qt\.callLater/u,
    );
    expect(tabShell).toContain(
      "const threshold = tabActivationHandler.dragThreshold;",
    );
    expect(activationTapHelper).toMatch(
      /const serial = activationGestureSerial;\s*const snapshot = minimizedActivationSnapshot;\s*activationTappedSerial = serial;\s*if \(snapshot && snapshot\.serial === serial\) \{\s*minimizedActivationSnapshot = null;\s*\}\s*return dispatchExactActivation\(serial, snapshot\);/u,
    );
    for (const handler of [activationHandler, touchActivationHandler]) {
      expect(handler).toContain(
        "onTapped: point => tabShell.handleActivationTap(point)",
      );
    }
    expect(tabShell.indexOf("activationConsumedSerial = serial;")).toBeLessThan(
      tabShell.indexOf("card.windowTapped("),
    );
    expect(tabShell).toContain("activationCanceledSerial === serial");
  });

  it("keeps every bounded tab as one logical target while exposing only visible chips to pointer input", () => {
    expect(tabRailPlanning).toContain(
      "plan.chipFrames.length !== column.members.length",
    );
    expect(tabRailPlanning).toMatch(
      /const expectedVisible = memberIndex >= plan\.firstVisibleIndex\s*&& memberIndex <= plan\.lastVisibleIndex;[\s\S]*chip\.visible !== expectedVisible/u,
    );
    expect(tabRailPlanning).toMatch(
      /return plan\.chipFrames\[tiled\.memberIndex\];/u,
    );
    expect(navigationVisual).toMatch(
      /case "tab":\s*return presentation\.tabTarget && presentation\.tabTarget\.visible\s*&& presentation\.tabTarget\.activationEligible === true\s*\? presentation\.tabTarget : null;/u,
    );
    expect(navigationVisual).toMatch(
      /const visibleRect = clippedNavigationRect\(visual, sceneItem, includeOffscreen\);[\s\S]*if \(visibleRect \|\| includeOffscreen !== true[\s\S]*return visibleRect;[\s\S]*typeof frame\.visible !== "boolean"[\s\S]*tabFrameForPresentation\(presentation\.tiledPresentation,[\s\S]*presentation\.windowId\) !== frame[\s\S]*return clippedLogicalTabNavigationRect\(frame, sceneItem\);/u,
    );
    expect(navigationVisual).not.toContain("frame.visible !== false");
    expect(logicalTabClip).toContain(
      "viewport.mapToItem(sceneItem, frame.x, frame.y",
    );
    expect(logicalTabClip).toContain(
      "const top = Math.max(rect.y, viewportRect.y, cardRect.y)",
    );
    expect(logicalTabClip).toContain(
      "const bottom = Math.min(rect.y + rect.height, viewportRect.y + viewportRect.height",
    );
    expect(logicalTabClip).toContain("width: rect.width");
    expect(logicalTabClip).toContain("x: rect.x");
    expect(collection.match(/targets\.push\(\{/gu)).toHaveLength(2);
    expect(
      collection.match(/id: navigationTargetId\(presentation\.windowId\)/gu),
    ).toHaveLength(1);
  });

  it("re-synchronizes an existing keyboard target after the tab rail window moves", () => {
    expect(keyboardSelectionLifecycle).toMatch(
      /const expectedTargetId = keyboardSelectionId;[\s\S]*keyboardSelectionViewportTarget = null;[\s\S]*Qt\.callLater\(root\.synchronizeKeyboardSelectionViewportTarget,\s*expectedTargetId, animateVisual\);/u,
    );
    expect(keyboardSelectionLifecycle).not.toContain(
      "synchronizeKeyboardSelectionViewport(target",
    );
    expect(selectionViewportSynchronization).toMatch(
      /function synchronizeKeyboardSelectionViewportTarget\(expectedTargetId, animateVisual = false\) \{[\s\S]*keyboardSelectionId !== expectedTargetId[\s\S]*navigationTargetForId\(collectNavigationTargets\(\), expectedTargetId\);[\s\S]*synchronizeKeyboardSelectionViewport\(target, animateVisual\)/u,
    );
    expect(tabRailLifecycle).toContain("card.navigationTargetsChanged();");
    expect(cardNavigationTargetChange).toMatch(
      /root\.advanceOverviewDesktopCardEpoch\(\);\s*Qt\.callLater\(root\.repairKeyboardSelection\);/u,
    );
    expect(selectionRepair).toMatch(
      /const currentTarget = navigationTargetForId\(targets, keyboardSelectionId\);\s*if \(currentTarget\) \{\s*synchronizeKeyboardSelectionViewport\(currentTarget\);\s*return;\s*\}/u,
    );
    expect(
      selectionRepair.indexOf("synchronizeKeyboardSelectionViewport"),
    ).toBeLessThan(selectionRepair.indexOf("preferredInitialNavigationTarget"));
  });

  it("pans a spatial row with the right mouse button without widening left-button grabs", () => {
    expect(horizontalBackdropInput).toContain("acceptedButtons: Qt.LeftButton");
    expect(horizontalBackdropInput).toContain(
      "root.beginSpatialHorizontalViewportDrag(centroid.pressPosition);",
    );
    expect(horizontalRowInput).toContain("acceptedButtons: Qt.RightButton");
    expect(horizontalRowInput).toContain(
      "acceptedDevices: PointerDevice.Mouse",
    );
    expect(horizontalRowInput).not.toContain("PointerDevice.TouchPad");
    expect(horizontalRowInput).not.toContain("PointerDevice.TouchScreen");
    expect(horizontalRowInput).toContain("xAxis.enabled: true");
    expect(horizontalRowInput).toContain("yAxis.enabled: false");
    expect(horizontalRowInput).toContain(
      "root.beginSpatialHorizontalViewportDrag(centroid.pressPosition, true);",
    );
    expect(horizontalRowInput).toContain(
      "root.updateSpatialHorizontalViewportDrag(activeTranslation.x);",
    );
    expect(horizontalRowInput).toContain(
      "root.clearSpatialHorizontalViewportDrag();",
    );
  });

  it("accepts spatial input on the first visible opening frame", () => {
    expect(presentationEligibility).toMatch(
      /readonly property bool spatialPresentationVisible:[\s\S]*sceneEffect\.active === true[\s\S]*spatialPresentationProgress > 0[\s\S]*spatialPresentationPhase === "opening"[\s\S]*spatialPresentationPhase === "open"[\s\S]*spatialPresentationPhase === "closing"/u,
    );
    expect(presentationEligibility).toMatch(
      /readonly property bool spatialPresentationInteractive:[\s\S]*spatialPresentationVisible[\s\S]*spatialPresentationPhase === "opening" \|\| spatialPresentationPhase === "open"/u,
    );
    expect(presentationEligibility).toMatch(
      /readonly property bool spatialPresentationSettled:[\s\S]*spatialPresentationPhase === "open"[\s\S]*spatialPresentationProgress >= 1/u,
    );
    expect(presentationEligibility).toMatch(
      /readonly property bool spatialKeyboardInputEligible:\s*spatialPresentationVisible && !spatialExitHandoffActive[\s\S]*spatialPresentationPhase === "opening" \|\| spatialPresentationPhase === "open"/u,
    );
    expect(presentationEligibility).toMatch(
      /readonly property bool spatialPointerInputEligible:[\s\S]*spatialPresentationInteractive && !keyboardHelpVisible/u,
    );
    expect(scene).toContain("enabled: spatialPresentationVisible");
    expect(scene).toContain("focus: spatialKeyboardInputEligible");
    expect(scene).toMatch(
      /onSpatialKeyboardInputEligibleChanged:[\s\S]*if \(spatialKeyboardInputEligible\) \{\s*forceActiveFocus\(\);/u,
    );
    expect(scene).toContain(
      "spatialVisualContentYDeferred = animateVisual === true && spatialPresentationSettled;",
    );
  });

  it("relinquishes event ownership before the closing presentation", () => {
    const eligibilityGuard = keyboardInput.indexOf(
      "if (!spatialKeyboardInputEligible)",
    );
    expect(eligibilityGuard).toBeGreaterThanOrEqual(0);
    expect(keyboardInput).toContain("event.accepted = false;");
    expect(eligibilityGuard).toBeLessThan(
      keyboardInput.indexOf("const modifiers = event.modifiers"),
    );
    expect(presentationLifecycle).toMatch(
      /spatialPresentationPhase === "closing"[\s\S]*cancelKeyboardBoundaryNavigation\(\);[\s\S]*resetOverviewWheelState\(\);[\s\S]*resetDesktopReorder\(\);[\s\S]*resetSpatialEdgePanTracking\(\);[\s\S]*clearSpatialHorizontalViewportDrag\(\);/u,
    );
    expect(wheelRouting).toContain("!spatialPointerInputEligible");
    expect(wheelRouting).not.toContain("event.accepted = false;");
    expect(scene).toContain("enabled: root.spatialPointerInputEligible");
    expect(`${presentationEligibility}\n${keyboardInput}`).not.toMatch(
      /\b(?:WeakSet|WeakMap|Timer)\b/u,
    );
  });

  it("admits thumbnails only for bounded interactive row drags", () => {
    expect(horizontalRowHitTest).toContain("!spatialPointerInputEligible");
    expect(horizontalRowHitTest).not.toContain("keyboardHelpVisible");
    expect(horizontalRowHitTest).not.toContain(
      "!spatialPresentationInteractive",
    );
    expect(horizontalRowHitTest).toContain("desktopReorderActive");
    expect(horizontalRowHitTest).toContain("spatialDirectDragActive");
    expect(horizontalRowHitTest).toContain("spatialViewportDragHandler.active");
    expect(horizontalRowHitTest).toContain(
      "spatialHorizontalViewportDragHandler.active",
    );
    expect(horizontalRowHitTest).toContain(
      "spatialWorkspaceIndexAtPoint(point)",
    );
    expect(horizontalRowHitTest).toContain("desktopCardAt(workspaceIndex)");
    expect(horizontalRowHitTest).toContain(
      "spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId)",
    );
    expect(horizontalRowHitTest).toContain("bounds.minimum < bounds.maximum");
    expect(horizontalRowHitTest).not.toContain("viewportPointHitsWindow");

    expect(horizontalDragLifecycle).toContain(
      "includeWindows === true\n            ? spatialHorizontalViewportRowContains(point)",
    );
    expect(horizontalDragLifecycle).toContain(
      "includeWindows === false && spatialHorizontalViewportBackdropContains(point)",
    );
    expect(horizontalDragLifecycle).toContain("resetOverviewWheelState();");
    expect(horizontalDragLifecycle).toContain(
      "planOverviewSpatialHorizontalDrag",
    );
    expect(horizontalDragLifecycle).toContain(
      "detachSpatialLiveCameraForManualOffset",
    );
  });

  it("retargets deliberate horizontal selection from the rendered camera frame", () => {
    expect(scene).toContain(
      "property real spatialVisualHorizontalViewportOffset: Number.NaN",
    );
    expect(scene).toContain(
      "property var spatialHorizontalCameraMotionContext: null",
    );
    expect(horizontalCameraAnimation).toMatch(
      /target: root\s*property: "spatialVisualHorizontalViewportOffset"[\s\S]*easing\.type: Easing\.OutCubic/u,
    );
    expect(horizontalCameraAnimation).not.toMatch(/loops:|repeat:/u);

    expect(horizontalCameraMotion).toContain(
      "function startSpatialHorizontalCameraMotion(",
    );
    expect(horizontalCameraMotion).toMatch(
      /const startOffset = fromOffset;[\s\S]*const currentOffset = spatialHorizontalViewportOffsetForBounds\([\s\S]*currentOffset !== startOffset/u,
    );
    expect(horizontalCameraMotion).toMatch(
      /spatialVisualHorizontalViewportOffset = startOffset;[\s\S]*spatialHorizontalCameraMotionContext = Object\.freeze\([\s\S]*setSpatialHorizontalViewportOffsetForBounds\([\s\S]*spatialHorizontalCameraAnimation\.from = startOffset;[\s\S]*spatialHorizontalCameraAnimation\.to = targetOffset;[\s\S]*spatialHorizontalCameraAnimation\.duration = Math\.max\(90, Math\.min\(160,[\s\S]*spatialHorizontalCameraAnimation\.start\(\);/u,
    );
    expect(horizontalCameraMotion).toMatch(
      /if \(!spatialHorizontalCameraMotionIsExact\([\s\S]*cancelSpatialHorizontalCameraMotion\(\);[\s\S]*spatialHorizontalViewportOffsetForBounds\([\s\S]*=== targetOffset[\s\S]*setSpatialHorizontalViewportOffsetForBounds\([\s\S]*startOffset, rollbackBounds\);/u,
    );
    expect(horizontalCameraMotion).not.toContain(
      "distance > bounds.sourceWidth",
    );
    expect(horizontalCameraMotion).toContain("!spatialPresentationSettled");
    expect(horizontalCameraMotion).toContain("spatialExitHandoffActive");

    expect(
      keyboardNavigation.match(/setKeyboardSelectionTarget\(target, true\);/gu),
    ).toHaveLength(2);
    expect(horizontalSelectionWheelCompletion).toContain(
      "setKeyboardSelectionTarget(target, true);",
    );
    expect(selectionViewportSynchronization).toContain(
      "function setKeyboardSelectionTarget(target, animateVisual = false)",
    );
    expect(selectionViewportSynchronization).toContain(
      "function synchronizeKeyboardSelectionViewport(preferredTarget, animateVisual = false)",
    );
    expect(selectionViewportSynchronization).toMatch(
      /revealHorizontalNavigationTarget\([\s\S]*workspaceIndex, target\.desktopId, target, animateVisual === true\);/u,
    );
    expect(horizontalReveal).toMatch(
      /function revealHorizontalNavigationTarget\(workspaceIndex, expectedDesktopId, target,\s*animateVisual = false\)/u,
    );
    expect(horizontalReveal).toMatch(
      /animateVisual === true[\s\S]*startSpatialHorizontalCameraMotion\(/u,
    );
    const revealAdoption = horizontalReveal.indexOf(
      "adoptSpatialHorizontalCameraMotion(",
    );
    const revealAnimationBranch = horizontalReveal.indexOf(
      "if (animateVisual === true)",
    );
    const revealLogicalWrite = horizontalReveal.indexOf(
      "setSpatialHorizontalViewportOffsetForBounds(",
    );
    expect(revealAdoption).toBeGreaterThanOrEqual(0);
    expect(revealAdoption).toBeLessThan(revealAnimationBranch);
    expect(revealAnimationBranch).toBeLessThan(revealLogicalWrite);
    expect(horizontalCameraMotion).not.toMatch(
      /KWin\.Workspace\.[A-Za-z0-9_]+\s*=|focusWindow\(|forceActiveFocus\(|deactivate\(/u,
    );
  });

  it("adopts the current horizontal frame before direct pointer and pixel-wheel input", () => {
    const dragAdoption = horizontalDragLifecycle.indexOf(
      "adoptSpatialHorizontalCameraMotion(",
    );
    const dragSnapshot = horizontalDragLifecycle.indexOf(
      "const viewportOffset = spatialHorizontalViewportOffsetForBounds(",
    );
    expect(dragAdoption).toBeGreaterThanOrEqual(0);
    expect(dragAdoption).toBeLessThan(dragSnapshot);

    const wheelAdoption = horizontalViewportWheel.indexOf(
      "adoptSpatialHorizontalCameraMotion(",
    );
    const wheelSnapshot = horizontalViewportWheel.indexOf(
      "const currentOffset = spatialHorizontalViewportOffsetForBounds(",
    );
    expect(wheelAdoption).toBeGreaterThanOrEqual(0);
    expect(wheelAdoption).toBeLessThan(wheelSnapshot);
    expect(horizontalViewportWheel).toContain(
      "setSpatialHorizontalViewportOffsetForBounds(",
    );
    expect(horizontalViewportWheel).not.toContain(
      "startSpatialHorizontalCameraMotion(",
    );
    expect(horizontalDragLifecycle).not.toContain(
      "startSpatialHorizontalCameraMotion(",
    );

    expect(horizontalCameraMotion).toMatch(
      /function adoptSpatialHorizontalCameraMotion\([\s\S]*spatialHorizontalCameraMotionContext = null;[\s\S]*spatialHorizontalCameraAnimation\.stop\(\);[\s\S]*setSpatialHorizontalViewportOffsetForBounds\([\s\S]*spatialVisualHorizontalViewportOffset = Number\.NaN;/u,
    );
  });

  it("hands exit the same horizontal offset that was rendered", () => {
    const adoption = exitHandoff.indexOf(
      "adoptSpatialHorizontalCameraMotionOwner()",
    );
    const capture = exitHandoff.indexOf("const offsetX =");
    expect(adoption).toBeGreaterThanOrEqual(0);
    expect(adoption).toBeLessThan(capture);
    expect(exitHandoff).toMatch(
      /if \(!adoptSpatialHorizontalCameraMotionOwner\(\)\) \{\s*return 0;\s*\}/u,
    );
    expect(exitHandoff).toContain(
      "offsetX = spatialHorizontalViewportOffsetAt(",
    );
    expect(exitHandoff).toContain("camera: {");
    expect(exitHandoff).toContain("offsetX,");

    expect(presentationPhaseLifecycle).toContain(
      'adoptSpatialHorizontalCameraMotionOwner(spatialPresentationPhase === "closing")',
    );
    expect(horizontalCameraMotion).toMatch(
      /function spatialHorizontalCameraMotionContextIsCurrent\([\s\S]*allowClosing = false\)[\s\S]*allowClosing === true && spatialPresentationPhase === "closing"/u,
    );
    expect(horizontalCameraMotion).toMatch(
      /function spatialHorizontalCameraMotionIsExact\([\s\S]*return spatialPresentationSettled && spatialHorizontalCameraMotionContextIsCurrent\(/u,
    );
  });
});
