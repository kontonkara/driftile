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

  it("admits thumbnails only for bounded interactive row drags", () => {
    expect(horizontalRowHitTest).toContain("!spatialPresentationInteractive");
    expect(horizontalRowHitTest).toContain("keyboardHelpVisible");
    expect(horizontalRowHitTest).toContain("desktopReorderActive");
    expect(horizontalRowHitTest).toContain("spatialWindowDragSource !== null");
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
