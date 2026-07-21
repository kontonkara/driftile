import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const entrypoint = readFileSync(
  new URL("contents/ui/main.qml", effectRoot),
  "utf8",
);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

describe("overview exit handoff integration", () => {
  it("captures one exact immutable handoff before any desktop or focus write", () => {
    const desktopSelection = scene.slice(
      scene.indexOf("function selectDesktop("),
      scene.indexOf("function focusWindow("),
    );
    const windowSelection = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function requestDesktopSelection("),
    );
    const preparation = scene.slice(
      scene.indexOf("function prepareOverviewWindowExitHandoff("),
      scene.indexOf("function selectDesktop("),
    );

    expect(preparation).toContain("sourceRect: target.rect");
    expect(preparation).toContain("targetFrame");
    expect(preparation).toContain("offsetX");
    expect(preparation).toContain("offsetY: spatialContentY");
    expect(preparation).toContain("zoom: overviewZoom");
    expect(preparation).toContain("sourceOutputId: outputId");
    expect(preparation).toContain(
      "effect.beginOverviewExitHandoff(windowCandidate",
    );

    expect(
      desktopSelection.indexOf("prepareOverviewDesktopExitHandoff("),
    ).toBeLessThan(desktopSelection.indexOf("requestDesktopSelection("));
    expect(
      windowSelection.indexOf("prepareOverviewWindowExitHandoff("),
    ).toBeLessThan(windowSelection.indexOf("requestDesktopSelection("));
    expect(
      windowSelection.indexOf("prepareOverviewWindowExitHandoff("),
    ).toBeLessThan(windowSelection.indexOf("candidate.minimized = false"));
    expect(
      windowSelection.indexOf("prepareOverviewWindowExitHandoff("),
    ).toBeLessThan(
      windowSelection.indexOf("KWin.Workspace.activeWindow = candidate"),
    );
    expect(windowSelection.indexOf("settleSpatialExitHandoff(")).toBeLessThan(
      windowSelection.indexOf("effect.deactivate()"),
    );
  });

  it("promotes geometry only after the exact controller transition", () => {
    const capture = controller.slice(
      controller.indexOf("function beginOverviewExitHandoff("),
      controller.indexOf("function settleOverviewExitHandoff("),
    );
    const settle = controller.slice(
      controller.indexOf("function settleOverviewExitHandoff("),
      controller.indexOf("function invalidateOverviewExitHandoff("),
    );
    const apply = controller.slice(
      controller.indexOf("function applyOverviewExitHandoffPlan("),
      controller.indexOf("function overviewExitHandoffIsActive("),
    );

    expect(capture).toContain("runtime.captureOverviewExitHandoff({");
    expect(capture).toContain("generation: overviewTopologyGeneration");
    expect(capture).toContain("sessionId: activeSessionId");
    expect(capture).toContain("clearPendingLiveModelRefresh();");
    expect(settle).toContain('type: "settle"');
    expect(settle).toContain("topologyGeneration: overviewTopologyGeneration");
    expect(apply).toMatch(
      /overviewExitHandoffPromotion = plan\.disposition === "promote"\s*&& plan\.promotion \? plan\.promotion : null;/u,
    );
    expect(apply).toMatch(
      /overviewExitHandoffWindow = overviewExitHandoffPromotion && windowCandidate/u,
    );
  });

  it("cancels every post-capture failure and deactivates after cancellation failure", () => {
    const desktopSelection = scene.slice(
      scene.indexOf("function selectDesktop("),
      scene.indexOf("function focusWindow("),
    );
    const windowSelection = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function requestDesktopSelection("),
    );
    const cancellation = scene.slice(
      scene.indexOf("function cancelSpatialExitHandoff("),
      scene.indexOf("function invalidateSpatialExitHandoff("),
    );
    const desktopException = desktopSelection.slice(
      desktopSelection.lastIndexOf("} catch (error)"),
    );
    const windowException = windowSelection.slice(
      windowSelection.lastIndexOf("} catch (error)"),
    );

    expect(desktopException).toMatch(
      /catch \(error\) \{\s*cancelSpatialExitHandoff\(\);\s*return false;/u,
    );
    expect(windowSelection).toMatch(
      /const exitToken = prepareOverviewWindowExitHandoff[\s\S]*if \(exitToken <= 0\) \{[\s\S]*return false;[\s\S]*\}\s*try \{/u,
    );
    expect(windowException).toMatch(
      /catch \(error\) \{\s*cancelSpatialExitHandoff\(\);\s*return false;/u,
    );
    expect(cancellation).toContain("let canceled = false;");
    expect(cancellation).toContain(
      'canceled = effect.cancelOverviewExitHandoff("interrupt") === true;',
    );
    expect(cancellation).toMatch(
      /catch \(error\) \{\s*canceled = false;\s*\}[\s\S]*if \(!canceled && spatialExitHandoffActive[\s\S]*effect\.deactivateImmediately\(\);/u,
    );
    expect(cancellation).toContain("return canceled;");
  });

  it("freezes the closing scene, locks input, and restores an interrupted camera", () => {
    expect(scene).toMatch(
      /readonly property bool spatialPresentationInteractive:[\s\S]*!spatialExitHandoffActive/u,
    );
    expect(scene).toContain(
      "readonly property int spatialLayoutWorkspaceIndex: spatialExitHandoffActive",
    );
    expect(scene).toMatch(
      /function handleCurrentDesktopChanged\(\)[\s\S]*if \(spatialExitHandoffActive\) \{\s*return;/u,
    );
    expect(scene).toMatch(
      /function resolveSpatialLiveCamera\(\) \{\s*if \(spatialExitHandoffActive\) \{\s*return false;/u,
    );
    expect(scene).toMatch(
      /function restoreSpatialExitCamera\(capture\)[\s\S]*setSpatialContentY\(camera\.offsetY, false\)[\s\S]*setSpatialHorizontalViewportOffset\(sourceIndex, sourceDesktopId, camera\.offsetX\)/u,
    );
    expect(controller).toMatch(
      /presentationPhase === "closing"[\s\S]*cancelOverviewExitHandoff\("reopen"\)[\s\S]*startPresentationTransition\("opening", 1, activeSessionId\)/u,
    );
  });

  it("renders one target-output public thumbnail with safe fallback", () => {
    expect(scene).toContain("OverviewExitHandoff {");
    expect(scene).toContain(
      'root.overviewExitHandoffState.phase === "promoted"',
    );
    expect(scene).toContain("activeOutput: root.outputId");
    expect(scene).toContain("root.overviewExitHandoffCapture.targetOutputId");
    expect(scene).toContain("progress: 1 - root.spatialPresentationProgress");
    expect(scene).toContain("overviewExitOverlaySourceRect()");
    expect(entrypoint).toContain(
      "readonly property var overviewExitHandoffPromotion: controller",
    );
    expect(entrypoint).toContain("function beginOverviewExitHandoff(");
    expect(entrypoint).toContain("function settleOverviewExitHandoff(");
    expect(`${entrypoint}\n${controller}\n${scene}`).not.toMatch(
      /org\.kde\.kwin\.private|candidate\.(?:geometry|frameGeometry)\s*=/u,
    );
  });

  it("retires the public scene before clearing its exact session", () => {
    const immediate = controller.slice(
      controller.indexOf("function deactivateImmediately("),
      controller.indexOf("function finalizeInactiveOverviewState("),
    );
    const retirement = controller.slice(
      controller.indexOf("function requestSceneRetirement("),
      controller.indexOf("function handleSceneDeactivated("),
    );
    const deactivated = controller.slice(
      controller.indexOf("function handleSceneDeactivated("),
      controller.indexOf("function prepareOverviewZoomForFreshActivation("),
    );
    const restart = controller.slice(
      controller.indexOf("function queueSceneRestart("),
      controller.indexOf("function clearSceneRetirement("),
    );

    expect(controller).toContain("property bool sceneVisible: false");
    expect(entrypoint).toContain(
      "visible: controller ? controller.sceneVisible : false",
    );
    expect(entrypoint).toMatch(
      /onDeactivated:[\s\S]*handleSceneDeactivated\(controller\.pendingSceneRetirementToken,[\s\S]*controller\.pendingSceneRetirementSessionId\)/u,
    );
    expect(immediate).toMatch(
      /presentationPhase === "retiring"\) \{\s*return;/u,
    );
    expect(retirement).toMatch(
      /presentationProgress = 0;[\s\S]*presentationPhase = "retiring";[\s\S]*pendingSceneRetirementSessionId = sessionId;[\s\S]*pendingSceneRetirementToken = nextSceneRetirementToken\(\);[\s\S]*sceneVisible = false;/u,
    );
    expect(retirement).toMatch(
      /presentationPhase === "preparing" && !openingReadinessSceneActivated[\s\S]*sceneVisible = false;[\s\S]*finalizeInactiveOverviewState\(\)/u,
    );
    expect(retirement).not.toMatch(
      /active = false|activeSessionId = 0|overviewModel = null|clearOverviewExitHandoff\(\)/u,
    );
    expect(deactivated).toMatch(
      /retirementToken !== pendingSceneRetirementToken[\s\S]*sessionId !== pendingSceneRetirementSessionId[\s\S]*presentationPhase !== "retiring"/u,
    );
    expect(deactivated).toMatch(
      /const reopen = pendingSceneRetirementReopen;[\s\S]*const contextDrift = pendingSceneRetirementContextDrift;[\s\S]*const completedSessionId = pendingSceneRetirementSessionId;[\s\S]*if \(!reopen\)[\s\S]*finalizeInactiveOverviewState\(\)[\s\S]*queueSceneRestart\(completedSessionId, contextDrift\)/u,
    );
    expect(deactivated).not.toMatch(/prepareOpeningReadiness|\bactivate\(\)/u);
    expect(restart).toMatch(
      /Object\.freeze[\s\S]*restartToken: nextSceneRestartToken\(\)[\s\S]*Qt\.callLater[\s\S]*pendingSceneRestartRequest !== request[\s\S]*presentationPhase !== "closed"[\s\S]*controller\.activate\(\)/u,
    );
    expect(scene).not.toContain("id: spatialTerminalFallback");
    expect(scene).toMatch(
      /id: spatialBackdrop[\s\S]*opacity: root\.spatialPresentationProgress/u,
    );
  });
});
