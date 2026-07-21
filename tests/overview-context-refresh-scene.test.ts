import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

describe("overview context refresh scene", () => {
  it("keeps the scene visible while activity and output models are replaced", () => {
    const presentation = scene.slice(
      scene.indexOf("readonly property string spatialPresentationPhase:"),
      scene.indexOf("readonly property var spatialDirectDragSource:"),
    );
    const exact = scene.slice(
      scene.indexOf("function contextModelIsExact()"),
      scene.indexOf("function outputIdForScreen()"),
    );

    expect(scene).toContain("enabled: spatialPresentationVisible");
    expect(scene).toContain(
      "readonly property bool overviewContextRefreshPending:",
    );
    expect(scene).toContain("readonly property int overviewContextGeneration:");
    expect(presentation).toMatch(
      /readonly property bool spatialPresentationInteractive:[\s\S]*!overviewContextRefreshPending && overviewContextModelExact/u,
    );
    expect(presentation).toMatch(
      /readonly property bool spatialKeyboardInputEligible:[\s\S]*spatialPresentationVisible[\s\S]*spatialPresentationPhase === "opening"/u,
    );
    expect(exact).toContain(
      "model.currentActivityId === activeOverviewActivityId",
    );
    expect(exact).toContain("liveScreenFor(screen) === screen");
    expect(exact).toContain("projectedOutput(model, screen) !== null");
  });

  it("blocks stale actions but retains Escape as a close control", () => {
    const keys = scene.slice(
      scene.indexOf("Keys.onPressed:"),
      scene.indexOf("Component.onCompleted:"),
    );
    const cardPolicy = scene.slice(
      scene.indexOf("function desktopCardInteractionEligible("),
      scene.indexOf("function desktopSurfaceShouldLoad("),
    );

    expect(keys).toMatch(
      /if \(!spatialPresentationInteractive\) \{[\s\S]*!event\.isAutoRepeat[\s\S]*event\.key === Qt\.Key_Escape[\s\S]*sceneEffect\.deactivate\(\);[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
    expect(cardPolicy).toContain("|| !spatialPresentationInteractive");
    expect(scene).toMatch(
      /readonly property bool spatialPointerInputEligible:[\s\S]*spatialPresentationInteractive/u,
    );
  });

  it("cancels transient manipulation without clearing session UI or cameras", () => {
    const begin = scene.slice(
      scene.indexOf("function beginOverviewContextRefreshBarrier()"),
      scene.indexOf("function finishOverviewContextRefreshBarrier()"),
    );
    const finish = scene.slice(
      scene.indexOf("function finishOverviewContextRefreshBarrier()"),
      scene.indexOf("function synchronizeSpatialZoomInputState()"),
    );

    for (const cancellation of [
      "cancelActiveColumnSpatialDrag();",
      "cancelSpatialZoomTransaction();",
      "cancelKeyboardBoundaryNavigation();",
      "resetOverviewWheelState();",
      "resetDesktopReorder();",
      "resetSpatialEdgePanTracking();",
      "clearSpatialTouchPan();",
      "clearSpatialHorizontalViewportDrag();",
    ]) {
      expect(begin).toContain(cancellation);
    }
    expect(begin).not.toMatch(
      /searchQuery = ""|keyboardHelpVisible = false|resetSpatialLiveCameraSession/u,
    );
    expect(finish).toContain("Qt.callLater(root.repairKeyboardSelection);");
    expect(finish).not.toContain("refreshOverviewSpatialSession(");
  });

  it("refreshes activity and output topology in place", () => {
    const workspace = scene.slice(
      scene.indexOf("Connections {\n        target: KWin.Workspace"),
      scene.indexOf(
        "Connections {\n        target: root.spatialLiveCameraWindow",
      ),
    );
    const modelChanged = scene.slice(
      scene.indexOf("onOverviewModelChanged:"),
      scene.indexOf("onOverviewAlwaysCenterSingleColumnChanged:"),
    );

    for (const signal of [
      "onCurrentActivityChanged",
      "onActivitiesChanged",
      "onScreensChanged",
      "onVirtualScreenGeometryChanged",
    ]) {
      const start = workspace.indexOf(`function ${signal}()`);
      expect(start).toBeGreaterThanOrEqual(0);
      const block = workspace.slice(
        start,
        workspace.indexOf("\n        }", start) + 10,
      );
      expect(block).toContain("root.beginOverviewContextRefreshBarrier();");
      expect(block).not.toContain("root.closeStaleOverview();");
    }
    expect(modelChanged).toContain("root.refreshOverviewSpatialSession(true);");
    expect(modelChanged).toContain("root.restartDesktopSurfaceResidency();");
    expect(modelChanged).not.toMatch(
      /searchQuery = ""|keyboardHelpVisible = false|sceneEffect\.deactivate/u,
    );
    expect(scene).toContain(
      "overviewContextGeneration: root.overviewContextGeneration",
    );
  });
});
