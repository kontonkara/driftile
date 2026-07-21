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
      "clippedNavigationRect(visual, sceneItem, includeOffscreen)",
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

    expect(collection).toContain(
      "const visual = navigationVisualForPresentation(presentation);",
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
      collection.indexOf("navigationVisualForPresentation(presentation)"),
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

    expect(Number.isFinite(tabRailZ)).toBe(true);
    expect(Number.isFinite(columnShellZ)).toBe(true);
    expect(tabRailZ).toBeGreaterThan(columnShellZ);
    expect(tabShell).toContain("parent: tabRailLayer");
    expect(tabShell).toMatch(
      /readonly property bool activationEligible: windowPresentation\.primaryVisualKind === "tab"\s*&& frame !== null/u,
    );
    expect(tabShell).toMatch(
      /function activationIsExact\(\) \{\s*return tabShell\.visible && tabShell\.frameIsExact\(\)\s*&& windowPresentation\.primaryVisualKind === "tab"/u,
    );
    expect(tabShell).toMatch(
      /TapHandler \{\s*id: tabActivationHandler[\s\S]*gesturePolicy: TapHandler\.DragThreshold/u,
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
      /PointerDevice\.GrabPassive[\s\S]*EventPoint\.Pressed[\s\S]*armMinimizedActivation\(point\)[\s\S]*PointerDevice\.UngrabPassive[\s\S]*EventPoint\.Released[\s\S]*Qt\.callLater/u,
    );
    expect(tabShell).toMatch(
      /onTapped:[\s\S]*activationTappedSerial = serial;[\s\S]*minimizedActivationSnapshot = null;[\s\S]*dispatchExactActivation\(serial, snapshot\)/u,
    );
    expect(tabShell.indexOf("activationConsumedSerial = serial;")).toBeLessThan(
      tabShell.indexOf("card.windowTapped("),
    );
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
});
