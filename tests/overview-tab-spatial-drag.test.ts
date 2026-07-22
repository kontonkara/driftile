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

function qmlBlockContainingId(
  source: string,
  type: "DragHandler" | "Item" | "Rectangle" | "TapHandler",
  id: string,
): string {
  const idIndex = source.indexOf(`id: ${id}`);
  if (idIndex < 0) {
    return "";
  }
  const startIndex = source.lastIndexOf(`${type} {`, idIndex);
  if (startIndex < 0) {
    return "";
  }

  const openingBrace = source.indexOf("{", startIndex);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }
  return "";
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex <= startIndex) {
    return "";
  }
  return source.slice(startIndex, endIndex);
}

const presentation = qmlBlockContainingId(
  desktopCard,
  "Item",
  "windowPresentation",
);
const tabShell = qmlBlockContainingId(desktopCard, "Rectangle", "tabShell");
const thumbnailTouchDrag = qmlBlockContainingId(
  desktopCard,
  "DragHandler",
  "thumbnailTouchDragHandler",
);
const thumbnailPointerDrag = qmlBlockContainingId(
  desktopCard,
  "DragHandler",
  "thumbnailDragHandler",
);
const tabTouchHold = qmlBlockContainingId(
  desktopCard,
  "TapHandler",
  "tabTouchHoldHandler",
);
const tabTouchDrag = qmlBlockContainingId(
  desktopCard,
  "DragHandler",
  "tabTouchDragHandler",
);
const tabPointerDrag = qmlBlockContainingId(
  desktopCard,
  "DragHandler",
  "tabDragHandler",
);
const dragOwnership = section(
  desktopCard,
  "function windowDragHandlerOwnsLifecycle(",
  "function windowDragActionSnapshotIsExact(",
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
const dragSemantics = section(
  desktopCard,
  "function windowDragSourceSemanticsAreExact(",
  "function ownedWindowDragSnapshotIsExact(",
);
const tiledSourceExactness = section(
  desktopCard,
  "function ownedWindowDropTiledPresentationIsExact(",
  "function windowDropIsValid(",
);
const sceneVisualCapture = section(
  overviewScene,
  "function captureSpatialWindowDragVisual(",
  "function clearSpatialWindowDragVisual(",
);

describe("overview visible tab spatial drag", () => {
  it("freezes the exact rendered source surface into the drag snapshot", () => {
    expect(dragCapture).toMatch(
      /function captureWindowDragSnapshot\(source,\s*surfaceKind,\s*surfaceTarget\)/u,
    );
    expect(dragCapture).toContain("return Object.freeze({");
    expect(dragCapture).toContain(
      "sourceFrameHeight: expectedSourceFrameHeight",
    );
    expect(dragCapture).toContain("sourceFrameWidth: expectedSourceFrameWidth");
    expect(dragCapture).toMatch(
      /return Object\.freeze\(\{[\s\S]*surfaceKind,[\s\S]*surfaceTarget,/u,
    );
    expect(dragCapture).toMatch(
      /const expectedSurfaceFrame = surfaceKind === "thumbnail"\s*\? source\.frame : source\.tabFrame;/u,
    );
    expect(dragCapture).toContain(
      "windowDragSurfaceIsExact(source, surfaceKind, surfaceTarget)",
    );
  });

  it("keeps thumbnail and visible non-selected tab sources strictly disjoint", () => {
    expect(dragSurfaceExactness).toMatch(
      /surfaceKind === "thumbnail"[\s\S]*source\.primaryVisualKind === "thumbnail"[\s\S]*tiled\.selected === true/u,
    );
    expect(dragSurfaceExactness).toMatch(
      /const tabFrame = source\.tabFrame;[\s\S]*source\.primaryVisualKind === "tab"[\s\S]*tiled\.selected === false/u,
    );
    expect(dragSurfaceExactness).toMatch(
      /surfaceKind === "thumbnail"[\s\S]*surfaceTarget === source\.thumbnailTarget/u,
    );
    expect(dragSurfaceExactness).toContain(
      "surfaceTarget === source.tabTarget",
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
    expect(dragSemantics).toMatch(
      /tabRailPlan\.anchorIndex === snapshot\.tabRailAnchorIndex[\s\S]*tabRailPlan\.firstVisibleIndex === snapshot\.tabRailFirstVisibleIndex[\s\S]*tabRailPlan\.lastVisibleIndex === snapshot\.tabRailLastVisibleIndex/u,
    );
    expect(tiledSourceExactness).toContain(
      "windowDragSurfaceIsExact(source, surfaceKind, surfaceTarget)",
    );
  });

  it("keeps window-frame invariants specific to the dragged surface", () => {
    const commonSurfaceValidation = section(
      dragSurfaceExactness,
      "function windowDragSurfaceIsExact(",
      'if (surfaceKind === "thumbnail")',
    );
    const thumbnailSurfaceValidation = section(
      dragSurfaceExactness,
      'if (surfaceKind === "thumbnail")',
      "const tabFrame = source.tabFrame;",
    );
    const tabSurfaceValidation = section(
      dragSurfaceExactness,
      "const tabFrame = source.tabFrame;",
      "} catch (error)",
    );

    expect(commonSurfaceValidation).not.toMatch(
      /frame === null|frame\.floating/u,
    );
    expect(thumbnailSurfaceValidation).toMatch(
      /frame !== null\s*&& frame\.floating === false && source\.frame === frame/u,
    );
    expect(tabSurfaceValidation).toMatch(
      /frame === null[\s\S]*tabFrameForPresentation\(tiled, windowId\) === tabFrame[\s\S]*surfaceTarget\.frame === tabFrame/u,
    );
    expect(dragExactness).not.toMatch(
      /snapshot\.surfaceTarget\.height === snapshot\.surfaceHeight\s*&& frame && frame\.floating === false/u,
    );
  });

  it("rejects selected, minimized, and logically hidden tab chips", () => {
    expect(tabShell).toMatch(
      /readonly property bool (?:spatialDragEligible|dragEligible):[\s\S]*windowPresentation\.primaryVisualKind === "tab"/u,
    );
    expect(tabShell).toMatch(
      /readonly property bool (?:spatialDragEligible|dragEligible):[\s\S]*frame\.visible === true/u,
    );
    expect(tabShell).toMatch(
      /readonly property bool (?:spatialDragEligible|dragEligible):[\s\S]*(?:!selectedTab|selectedTab === false)/u,
    );
    expect(tabShell).toMatch(
      /readonly property bool (?:spatialDragEligible|dragEligible):[\s\S]*(?:!minimizedTab|minimizedTab === false)/u,
    );
    expect(dragCapture).toContain("source.minimizedWindow === true");
    expect(dragSurfaceExactness).toContain("tabFrame.visible === true");
    expect(dragSurfaceExactness).toContain("tabFrame.selected === false");
  });

  it("starts mouse and touchpad tab drags outside the close region", () => {
    expect(tabShell).toContain("id: tabDragHandler");
    expect(tabPointerDrag).toContain("target: null");
    expect(tabPointerDrag).toMatch(
      /acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad/u,
    );
    expect(tabPointerDrag).toMatch(
      /grabPermissions: PointerHandler\.CanTakeOverFromHandlersOfSameType\s*\| PointerHandler\.CanTakeOverFromHandlersOfDifferentType\s*\| PointerHandler\.CanTakeOverFromItems\s*\| PointerHandler\.ApprovesCancellation/u,
    );
    expect(tabPointerDrag).toMatch(
      /enabled:[\s\S]*(?:tabShell\.(?:spatialDragEligible|dragEligible)|windowPresentation\.dragEligible)[\s\S]*windowDragHandlerOwnsLifecycle\(\s*windowPresentation,\s*"tab",\s*tabShell\)/u,
    );
    expect(tabPointerDrag).toMatch(
      /transition === PointerDevice\.GrabExclusive[\s\S]*closeButtonContainsPoint\(tabCloseButton, tabShell,[\s\S]*point\.pressPosition[\s\S]*beginWindowSpatialDrag\(windowPresentation,/u,
    );
    expect(tabPointerDrag).toMatch(
      /transition === PointerDevice\.GrabExclusive[\s\S]*tabShell\.(?:cancelActivationForSpatialDrag|disarmMinimizedActivation)\(\)[\s\S]*beginWindowSpatialDrag\(windowPresentation,/u,
    );
  });

  it("arms touchscreen tab drag only after an exact long press", () => {
    expect(tabShell).toContain("id: tabTouchHoldHandler");
    expect(tabShell).toContain("id: tabTouchDragHandler");
    expect(tabTouchHold).toContain("target: null");
    expect(tabTouchHold).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(tabTouchHold).toContain("gesturePolicy: TapHandler.DragThreshold");
    expect(tabTouchHold).toMatch(
      /onLongPressed:[\s\S]*(?:tabShell\.(?:spatialDragEligible|dragEligible)|windowPresentation\.dragEligible)[\s\S]*closeButtonContainsPoint\(tabCloseButton, tabShell,[\s\S]*point\.pressPosition[\s\S]*touchSpatialDragArmed = true/u,
    );

    expect(tabTouchDrag).toContain("target: null");
    expect(tabTouchDrag).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(tabTouchDrag).toMatch(
      /dragThreshold: windowPresentation\.touchSpatialDragArmed \? 0 : 32767/u,
    );
    expect(tabTouchDrag).toMatch(
      /enabled:[\s\S]*(?:tabShell\.(?:spatialDragEligible|dragEligible)|windowPresentation\.dragEligible)[\s\S]*windowDragHandlerOwnsLifecycle\(\s*windowPresentation,\s*"tab",\s*tabShell\)/u,
    );
    expect(tabTouchDrag).toMatch(
      /transition === PointerDevice\.GrabExclusive[\s\S]*tabShell\.(?:cancelActivationForSpatialDrag|disarmMinimizedActivation)\(\)[\s\S]*beginWindowSpatialDrag\(windowPresentation,/u,
    );
  });

  it("owns lifecycle and Drag attachment per exact source surface", () => {
    expect(dragOwnership).toMatch(
      /function windowDragHandlerOwnsLifecycle\(source,\s*surfaceKind,\s*surfaceTarget\)/u,
    );
    expect(dragOwnership).toContain("snapshot.surfaceKind === surfaceKind");
    expect(dragOwnership).toContain("snapshot.surfaceTarget === surfaceTarget");
    for (const handler of [tabTouchDrag, tabPointerDrag]) {
      expect(handler).toMatch(
        /windowDragHandlerOwnsLifecycle\(\s*windowPresentation,\s*"tab",\s*tabShell\)/u,
      );
      expect(handler).toContain("tabShell.Drag.active = true");
      expect(handler).toMatch(
        /tabShell\.(?:releaseSpatialDrag|cancelSpatialDrag)\(/u,
      );
      expect(handler).not.toContain("thumbnailShell.Drag");
    }
    for (const handler of [thumbnailTouchDrag, thumbnailPointerDrag]) {
      expect(handler).toMatch(
        /windowDragHandlerOwnsLifecycle\(\s*windowPresentation,\s*"thumbnail",\s*thumbnailShell\)/u,
      );
      expect(handler).not.toContain("tabShell.Drag");
    }
    expect(tabShell).toContain("Drag.source: windowPresentation");
    expect(tabShell).toContain("tabShell.Drag.cancel()");
    expect(tabShell).toContain("tabShell.Drag.drop()");
    expect(tabShell).toContain('Drag.keys: ["driftile-window"]');
    expect(tabShell).toContain("Drag.proposedAction: Qt.MoveAction");
    expect(tabShell).toContain("Drag.supportedActions: Qt.MoveAction");
  });

  it("captures the proxy from the frozen surface and cancels stale tab identity", () => {
    expect(sceneVisualCapture).toMatch(
      /const snapshot = source \? source\.windowDragSnapshot : null;[\s\S]*const target = snapshot \? snapshot\.surfaceTarget : null;/u,
    );
    expect(sceneVisualCapture).toMatch(
      /spatialWindowDragVisualPlan = Object\.freeze\(\{[\s\S]*surfaceKind,[\s\S]*surfaceTarget: target/u,
    );
    expect(sceneVisualCapture).not.toContain(
      "const target = source ? source.thumbnailTarget : null;",
    );

    expect(presentation).toMatch(
      /onPrimaryVisualKindChanged:[\s\S]*(?:scheduleWindowSpatialDragValidation|cancelInvalidWindowSpatialDragSource)\(windowPresentation\)/u,
    );
    expect(presentation).toMatch(
      /onTabFrameChanged:[\s\S]*(?:scheduleWindowSpatialDragValidation|cancelInvalidWindowSpatialDragSource)\(windowPresentation\)/u,
    );
    expect(dragExactness).toContain(
      "windowDragSourceSemanticsAreExact(source, snapshot)",
    );
    expect(dragSurfaceExactness).toContain(
      'source.primaryVisualKind === "tab"',
    );
    expect(dragSurfaceExactness).toContain("tabFrame.visible === true");
  });

  it("uses only public timer-free pointer contracts for tab drag", () => {
    expect(`${tabTouchHold}\n${tabTouchDrag}\n${tabPointerDrag}`).not.toMatch(
      /org\.kde\.kwin\.private|\b(?:Timer|MouseArea)\s*\{|setInterval|setTimeout/u,
    );
  });
});
