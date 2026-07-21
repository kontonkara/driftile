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
      scene.indexOf("function createPendingWindowFocusRequest("),
    );
    const requestCreation = scene.slice(
      scene.indexOf("function createPendingWindowFocusRequest("),
      scene.indexOf("function capturedWindowExitHandoffIsExact("),
    );
    const capturedHandoff = scene.slice(
      scene.indexOf("function capturedWindowExitHandoffIsExact("),
      scene.indexOf("function pendingWindowFocusRequestIsExact("),
    );
    const exactRequest = scene.slice(
      scene.indexOf("function pendingWindowFocusRequestIsExact("),
      scene.indexOf("function replacePendingWindowFocusPhase("),
    );
    const phaseReplacement = scene.slice(
      scene.indexOf("function replacePendingWindowFocusPhase("),
      scene.indexOf("function queuePendingWindowFocusWrite("),
    );
    const focusQueue = scene.slice(
      scene.indexOf("function queuePendingWindowFocusWrite("),
      scene.indexOf("function queuePendingWindowRestoreSettle("),
    );
    const restoreQueue = scene.slice(
      scene.indexOf("function queuePendingWindowRestoreSettle("),
      scene.indexOf("function replacePendingWindowRestoreSettleAttempt("),
    );
    const restoreAttempts = scene.slice(
      scene.indexOf("function replacePendingWindowRestoreSettleAttempt("),
      scene.indexOf("function performPendingWindowFocusWrite("),
    );
    const focusWrite = scene.slice(
      scene.indexOf("function performPendingWindowFocusWrite("),
      scene.indexOf("function queuePendingWindowFocusWriteConfirmation("),
    );
    const focusSettle = scene.slice(
      scene.indexOf("function queuePendingWindowFocusSettle("),
      scene.indexOf("function validatePendingWindowFocusCandidate("),
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
    expect(windowSelection).toMatch(
      /pendingWindowFocusRequest = request;\s*return queuePendingWindowFocusWrite\(request\);/u,
    );
    expect(windowSelection).toMatch(
      /const activeWindowBaseline = KWin\.Workspace\.activeWindow;[\s\S]*candidate\.minimized = false;[\s\S]*candidate, expectedWindowId, exitToken, expectedMinimized,[\s\S]*activeWindowBaseline\);/u,
    );
    expect(requestCreation).toContain("return Object.freeze({");
    expect(requestCreation).toContain("activeWindowBaseline,");
    expect(requestCreation).toContain(
      'typeof restoredFromMinimized !== "boolean"',
    );
    expect(requestCreation).toContain(
      'phase: restoredFromMinimized && candidate.hidden === true\n                                         ? "restore-settle" : "focus-queued"',
    );
    expect(requestCreation).toContain("restoreSettleAttempt: 0");
    expect(requestCreation).toContain("restoredFromMinimized,");
    expect(capturedHandoff).toContain(
      'typeof expectedTargetMinimized === "boolean"',
    );
    expect(capturedHandoff).toContain(
      "capture.targetMinimized === expectedTargetMinimized",
    );
    expect(exactRequest).toMatch(
      /capturedWindowExitHandoffIsExact\(request\.exitToken,[\s\S]*request\.restoredFromMinimized\)/u,
    );
    expect(phaseReplacement).toContain(
      "restoredFromMinimized: request.restoredFromMinimized",
    );
    expect(phaseReplacement).toContain(
      "restoreSettleAttempt: request.restoreSettleAttempt",
    );
    expect(focusQueue).toMatch(
      /request\.phase !== "restore-settle"[\s\S]*request\.phase !== "focus-queued"[\s\S]*if \(request\.phase === "restore-settle"\) \{\s*return queuePendingWindowRestoreSettle\(request\);\s*\}[\s\S]*Qt\.callLater\(function\(\) \{\s*root\.performPendingWindowFocusWrite\(request\);\s*\}\);/u,
    );
    expect(focusQueue).not.toMatch(/KWin\.Workspace\.activeWindow\s*=(?!=)/u);
    expect(focusWrite).not.toContain("Qt.callLater(function() {");
    expect(focusWrite).toMatch(
      /replacePendingWindowFocusPhase\(request,\s*"focus-requested"\)/u,
    );
    expect(
      focusWrite.match(/KWin\.Workspace\.activeWindow\s*=(?!=)/gu),
    ).toHaveLength(1);
    expect(focusSettle).toMatch(
      /pendingWindowFocusRequestIsExact\(request, true\)[\s\S]*Qt\.callLater[\s\S]*completePendingWindowFocus[\s\S]*settleSpatialExitHandoff\(request\.candidate, request\.exitToken\)[\s\S]*clearPendingWindowFocus\(\);[\s\S]*effect\.deactivate\(\);/u,
    );
    expect(`${focusQueue}\n${focusWrite}`).not.toContain(
      "effect.deactivate();",
    );
    expect(
      `${requestCreation}\n${capturedHandoff}\n${exactRequest}\n${phaseReplacement}\n${focusQueue}\n${restoreQueue}\n${restoreAttempts}\n${focusWrite}\n${focusSettle}`,
    ).not.toMatch(/\bTimer\s*\{|setTimeout|setInterval/u);
  });

  it("bounds minimized restore settlement before any focus write", () => {
    const candidateConnections = scene.slice(
      scene.indexOf("target: root.pendingWindowFocusCandidate"),
      scene.indexOf("target: root.workspaceRenameDesktop"),
    );
    const windowSelection = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function createPendingWindowFocusRequest("),
    );
    const requestCreation = scene.slice(
      scene.indexOf("function createPendingWindowFocusRequest("),
      scene.indexOf("function capturedWindowExitHandoffIsExact("),
    );
    const exactRequest = scene.slice(
      scene.indexOf("function pendingWindowFocusRequestIsExact("),
      scene.indexOf("function replacePendingWindowFocusPhase("),
    );
    const phaseReplacement = scene.slice(
      scene.indexOf("function replacePendingWindowFocusPhase("),
      scene.indexOf("function queuePendingWindowFocusWrite("),
    );
    const restoreQueue = scene.slice(
      scene.indexOf("function queuePendingWindowRestoreSettle("),
      scene.indexOf("function replacePendingWindowRestoreSettleAttempt("),
    );
    const restoreAttempts = scene.slice(
      scene.indexOf("function replacePendingWindowRestoreSettleAttempt("),
      scene.indexOf("function performPendingWindowFocusWrite("),
    );
    const focusWrite = scene.slice(
      scene.indexOf("function performPendingWindowFocusWrite("),
      scene.indexOf("function queuePendingWindowFocusWriteConfirmation("),
    );
    const activation = scene.slice(
      scene.indexOf("function handlePendingWindowFocusActivation("),
      scene.indexOf("function queuePendingWindowFocusSettle("),
    );

    const baselineCapture = windowSelection.indexOf(
      "const activeWindowBaseline = KWin.Workspace.activeWindow;",
    );
    const restoreWrite = windowSelection.indexOf(
      "candidate.minimized = false;",
    );
    const requestCreationCall = windowSelection.indexOf(
      "const request = createPendingWindowFocusRequest(",
    );
    expect(baselineCapture).toBeGreaterThanOrEqual(0);
    expect(restoreWrite).toBeGreaterThan(baselineCapture);
    expect(requestCreationCall).toBeGreaterThan(restoreWrite);
    expect(windowSelection).toMatch(
      /candidate\.minimized = false;[\s\S]*windowFocusStateIsExact\(candidate, false, false\)[\s\S]*activeWindowBaseline\);/u,
    );

    expect(requestCreation).toMatch(
      /windowFocusStateIsExact\(candidate, false,\s*!restoredFromMinimized\)/u,
    );
    expect(requestCreation).toMatch(
      /return Object\.freeze\(\{[\s\S]*activeWindowBaseline,[\s\S]*phase: restoredFromMinimized && candidate\.hidden === true\s*\? "restore-settle" : "focus-queued",[\s\S]*restoreSettleAttempt: 0,[\s\S]*restoredFromMinimized,/u,
    );
    expect(exactRequest).toMatch(
      /const restoreSettling = request && request\.phase === "restore-settle";[\s\S]*restoreSettling && request\.restoredFromMinimized !== true[\s\S]*Number\.isInteger\(request\.restoreSettleAttempt\)[\s\S]*request\.restoreSettleAttempt < 0[\s\S]*request\.restoreSettleAttempt > 2/u,
    );
    expect(exactRequest).toMatch(
      /windowFocusStateIsExact\(request\.candidate, false,\s*!restoreSettling\)/u,
    );
    expect(exactRequest).toMatch(
      /!requireActiveCandidate[\s\S]*\(!restoreSettling[\s\S]*KWin\.Workspace\.activeWindow === request\.candidate\)/u,
    );

    expect(phaseReplacement).toMatch(
      /request\.phase === "restore-settle"\s*&& phase === "focus-queued"/u,
    );
    expect(phaseReplacement).toContain(
      "restoreSettleAttempt: request.restoreSettleAttempt",
    );
    expect(restoreQueue).toMatch(
      /activeWindow !== request\.candidate\s*&& activeWindow !== request\.activeWindowBaseline[\s\S]*yieldPendingWindowFocusToExternalActivation\(\)/u,
    );
    expect(restoreQueue).toMatch(
      /request\.candidate\.hidden !== true[\s\S]*replacePendingWindowFocusPhase\(request, "focus-queued"\)[\s\S]*pendingWindowFocusRequestIsExact\(queued\)[\s\S]*queuePendingWindowFocusWrite\(queued\)/u,
    );
    expect(restoreQueue).toMatch(
      /request\.restoreSettleAttempt >= 2[\s\S]*abortPendingWindowFocus\("stale"\)[\s\S]*replacePendingWindowRestoreSettleAttempt\(request\)[\s\S]*Qt\.callLater\(function\(\) \{\s*if \(root\.pendingWindowFocusRequest === next\) \{\s*root\.queuePendingWindowRestoreSettle\(next\);/u,
    );
    expect(restoreAttempts).toMatch(
      /request\.restoreSettleAttempt >= 2[\s\S]*const next = Object\.freeze\(\{[\s\S]*phase: request\.phase,[\s\S]*restoreSettleAttempt: request\.restoreSettleAttempt \+ 1,[\s\S]*pendingWindowFocusRequest = next;/u,
    );
    expect(candidateConnections).toMatch(
      /function onHiddenChanged\(\) \{[\s\S]*request\.phase === "restore-settle"[\s\S]*Qt\.callLater\(function\(\) \{\s*if \(root\.pendingWindowFocusRequest === request\) \{\s*root\.queuePendingWindowRestoreSettle\(request\);\s*\}\s*\}\);[\s\S]*return;[\s\S]*root\.validatePendingWindowFocusCandidate\(\);/u,
    );
    expect(activation).toMatch(
      /request\.phase === "restore-settle"[\s\S]*activeWindow = KWin\.Workspace\.activeWindow[\s\S]*window === activeWindow[\s\S]*activeWindow === request\.candidate[\s\S]*activeWindow === request\.activeWindowBaseline[\s\S]*pendingWindowFocusRequestIsExact\(request\)[\s\S]*return true;[\s\S]*yieldPendingWindowFocusToExternalActivation\(\)/u,
    );
    expect(focusWrite).toMatch(
      /request\.phase !== "focus-queued"[\s\S]*replacePendingWindowFocusPhase\(request,[\s\S]*"focus-requested"\)[\s\S]*KWin\.Workspace\.activeWindow = requested\.candidate/u,
    );
    expect(
      `${candidateConnections}\n${requestCreation}\n${exactRequest}\n${phaseReplacement}\n${restoreQueue}\n${restoreAttempts}\n${focusWrite}\n${activation}`,
    ).not.toMatch(/\bTimer\s*\{|setTimeout|setInterval|setImmediate/u);
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
      /if \(pendingSceneRetirementBarrier\) \{\s*pendingSceneRetirementContextDrift = true;\s*forceSceneRetirementBarrier\(true\);\s*return false;/u,
    );
    expect(apply).toMatch(
      /const nextPromotion = plan\.disposition === "promote"\s*&& plan\.promotion \? plan\.promotion : null;/u,
    );
    expect(apply).toContain("overviewExitHandoffPromotion = nextPromotion;");
    expect(apply).toMatch(
      /overviewExitHandoffWindow = nextPromotion && windowCandidate/u,
    );
  });

  it("cancels every post-capture failure and yields external focus without replay", () => {
    const desktopSelection = scene.slice(
      scene.indexOf("function selectDesktop("),
      scene.indexOf("function focusWindow("),
    );
    const windowSelection = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function createPendingWindowFocusRequest("),
    );
    const cancellation = scene.slice(
      scene.indexOf("function cancelSpatialExitHandoff("),
      scene.indexOf("function invalidateSpatialExitHandoff("),
    );
    const desktopException = desktopSelection.slice(
      desktopSelection.lastIndexOf("} catch (error)"),
    );
    const abort = scene.slice(
      scene.indexOf("function abortPendingWindowFocus("),
      scene.indexOf("function yieldPendingWindowFocusToExternalActivation("),
    );
    const externalYield = scene.slice(
      scene.indexOf("function yieldPendingWindowFocusToExternalActivation("),
      scene.indexOf("function requestDesktopSelection("),
    );

    expect(desktopException).toMatch(
      /catch \(error\) \{\s*cancelSpatialExitHandoff\(\);\s*return false;/u,
    );
    expect(windowSelection).toMatch(
      /const exitToken = prepareOverviewWindowExitHandoff[\s\S]*if \(exitToken <= 0\) \{[\s\S]*return false;[\s\S]*\}\s*try \{/u,
    );
    expect(windowSelection).toMatch(
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
    expect(abort).toMatch(
      /clearPendingWindowFocus\(\);\s*invalidateSpatialExitHandoff\(reason\);[\s\S]*effect\.deactivate\(\);/u,
    );
    expect(externalYield).toMatch(
      /clearPendingWindowFocus\(\);\s*cancelSpatialExitHandoff\(\);[\s\S]*effect\.deactivate\(\);/u,
    );
    expect(`${abort}\n${externalYield}`).not.toMatch(
      /KWin\.Workspace\.activeWindow\s*=(?!=)/u,
    );
  });

  it("requires exact active-window confirmation and invalidates every stale callback", () => {
    const exactRequest = scene.slice(
      scene.indexOf("function pendingWindowFocusRequestIsExact("),
      scene.indexOf("function replacePendingWindowFocusPhase("),
    );
    const capturedHandoff = scene.slice(
      scene.indexOf("function capturedWindowExitHandoffIsExact("),
      scene.indexOf("function pendingWindowFocusRequestIsExact("),
    );
    const focusQueue = scene.slice(
      scene.indexOf("function queuePendingWindowFocusWrite("),
      scene.indexOf("function performPendingWindowFocusWrite("),
    );
    const focusWrite = scene.slice(
      scene.indexOf("function performPendingWindowFocusWrite("),
      scene.indexOf("function handlePendingWindowFocusActivation("),
    );
    const activation = scene.slice(
      scene.indexOf("function handlePendingWindowFocusActivation("),
      scene.indexOf("function queuePendingWindowFocusSettle("),
    );
    const settle = scene.slice(
      scene.indexOf("function queuePendingWindowFocusSettle("),
      scene.indexOf("function validatePendingWindowFocusCandidate("),
    );

    expect(capturedHandoff).toContain('state.phase === "captured"');
    expect(capturedHandoff).toMatch(
      /capture\.targetMinimized === expectedTargetMinimized/u,
    );
    expect(exactRequest).toMatch(
      /pendingWindowFocusRequest !== request[\s\S]*windowFocusStateIsExact\(request\.candidate, false,\s*!restoreSettling\)[\s\S]*capturedWindowExitHandoffIsExact\(request\.exitToken,[\s\S]*request\.restoredFromMinimized\)[\s\S]*!restoreSettling[\s\S]*KWin\.Workspace\.activeWindow === request\.candidate/u,
    );
    expect(focusQueue).toMatch(
      /request\.phase === "restore-settle"[\s\S]*return queuePendingWindowRestoreSettle\(request\);[\s\S]*Qt\.callLater[\s\S]*root\.performPendingWindowFocusWrite\(request\);/u,
    );
    expect(focusWrite).toMatch(
      /pendingWindowFocusRequest !== request[\s\S]*pendingWindowFocusRequestIsExact\(request\)[\s\S]*activeWindow !== request\.activeWindowBaseline[\s\S]*yieldPendingWindowFocusToExternalActivation/u,
    );
    expect(focusWrite).toMatch(
      /KWin\.Workspace\.activeWindow = requested\.candidate;[\s\S]*const current = pendingWindowFocusRequest;[\s\S]*current\.candidate === requested\.candidate[\s\S]*current\.exitToken === requested\.exitToken[\s\S]*pendingWindowFocusRequestIsExact\(current, true\)[\s\S]*queuePendingWindowFocusSettle\(current\)/u,
    );
    expect(activation).toMatch(
      /request\.phase === "restore-settle"[\s\S]*window === activeWindow[\s\S]*activeWindow === request\.candidate[\s\S]*activeWindow === request\.activeWindowBaseline[\s\S]*pendingWindowFocusRequestIsExact\(request\)[\s\S]*return true;[\s\S]*yieldPendingWindowFocusToExternalActivation\(\)[\s\S]*window === request\.candidate[\s\S]*pendingWindowFocusRequestIsExact\(request, true\)[\s\S]*queuePendingWindowFocusSettle\(request\)[\s\S]*yieldPendingWindowFocusToExternalActivation\(\)/u,
    );
    expect(settle).toMatch(
      /pendingWindowFocusRequest !== request[\s\S]*pendingWindowFocusRequestIsExact\(request, true\)[\s\S]*overviewExitWindowFrame\(request\.candidate\)/u,
    );
    expect(scene).toMatch(
      /function onWindowActivated\(\) \{\s*if \(root\.pendingWindowFocusRequest\) \{\s*root\.handlePendingWindowFocusActivation\(KWin\.Workspace\.activeWindow\);\s*return;/u,
    );
    expect(scene).toMatch(
      /function onPresentationPhaseChanged\(\) \{\s*if \(root\.spatialPresentationPhase !== "open"\s*&& root\.pendingWindowFocusRequest\) \{\s*root\.clearPendingWindowFocus\(\);\s*root\.cancelSpatialExitHandoff\(\);/u,
    );
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

  it("renders target-output public window and desktop bridges", () => {
    const planApplication = controller.slice(
      controller.indexOf("function applyOverviewExitHandoffPlan("),
      controller.indexOf("function overviewExitHandoffIsActive("),
    );

    expect(scene).toContain("OverviewExitHandoff {");
    expect(scene).toContain("handoffPhase: root.overviewExitHandoffState");
    expect(scene).toContain("promotion: root.overviewExitHandoffPromotion");
    expect(scene).toContain("activeOutput: root.outputId");
    expect(scene).toContain("capturedOutput: root.overviewExitHandoffCapture");
    expect(scene).toContain(
      "targetActivityId: root.overviewExitTargetActivityId()",
    );
    expect(scene).toContain("targetDesktop: root.overviewExitTargetDesktop()");
    expect(scene).toContain(
      "targetDesktopId: root.overviewExitTargetDesktopId()",
    );
    expect(scene).toContain("targetScreen: root.targetScreen");
    expect(scene).toMatch(
      /windowCandidate: root\.overviewExitHandoffCapture[\s\S]*targetKind === "window"[\s\S]*sceneEffect\.overviewExitHandoffWindow/u,
    );
    expect(scene).not.toContain("thumbnailSource:");
    expect(scene).not.toContain("promotedOutput:");
    expect(scene).toContain("progress: 1 - root.spatialPresentationProgress");
    expect(scene).toContain("overviewExitOverlaySourceRect()");
    expect(scene).toContain("desktopSourceRect: target.desktopSourceRect");
    expect(controller).toContain("desktopSourceRect: input.desktopSourceRect");
    expect(scene).toMatch(
      /function overviewExitDesktopSurfaceRect\(expectedDesktopId\)[\s\S]*card\.contentLeft \+ card\.viewportOriginX[\s\S]*card\.contentTop \+ card\.viewportOriginY[\s\S]*card\.projectedViewportWidth[\s\S]*card\.projectedViewportHeight/u,
    );
    expect(scene).not.toContain("function overviewExitDesktopRowRect(");
    expect(scene).not.toMatch(
      /overviewExitDesktopSurfaceRect\(expectedDesktopId\)\s*\|\|\s*target\.rect/u,
    );
    expect(scene).toMatch(
      /const targetIndex = target[\s\S]*desktopIds\.indexOf\(target\.targetDesktopId\)[\s\S]*spatialExitFrozenWorkspaceIndex = targetIndex;[\s\S]*spatialPresentationWorkspaceIndex = targetIndex;/u,
    );
    expect(entrypoint).toContain(
      "readonly property var overviewExitHandoffPromotion: controller",
    );
    expect(
      planApplication.indexOf("overviewExitHandoffPromotion = nextPromotion"),
    ).toBeLessThan(
      planApplication.indexOf("overviewExitHandoffState = plan.state"),
    );
    expect(
      planApplication.indexOf("overviewExitHandoffWindow = nextPromotion"),
    ).toBeLessThan(
      planApplication.indexOf("overviewExitHandoffState = plan.state"),
    );
    expect(entrypoint).toContain("function beginOverviewExitHandoff(");
    expect(entrypoint).toContain("function settleOverviewExitHandoff(");
    expect(`${entrypoint}\n${controller}\n${scene}`).not.toMatch(
      /org\.kde\.kwin\.private|candidate\.(?:geometry|frameGeometry)\s*=/u,
    );
  });

  it("holds the terminal scene for two frames on every exact output", () => {
    const retirement = controller.slice(
      controller.indexOf("function requestSceneRetirement("),
      controller.indexOf("function handleSceneDeactivated("),
    );
    const barrierContext = controller.slice(
      controller.indexOf("function sceneRetirementBarrierContextIsExact("),
      controller.indexOf("function commitSceneRetirementVisibility("),
    );
    const visibilityCommit = controller.slice(
      controller.indexOf("function commitSceneRetirementVisibility("),
      controller.indexOf("function forceSceneRetirementBarrier("),
    );
    const registration = controller.slice(
      controller.indexOf("function registerOverviewSceneRetirementFrame("),
      controller.indexOf("function invalidateOverviewSceneRetirement("),
    );
    const frameContext = scene.slice(
      scene.indexOf("function sceneRetirementFrameContext("),
      scene.indexOf("function resetSceneRetirementFrameTracking("),
    );
    const frameAdvance = scene.slice(
      scene.indexOf("function advanceSceneRetirementFrame("),
      scene.indexOf("function resetPresentationReadinessRegistration("),
    );
    const frameSynchronization = scene.slice(
      scene.indexOf("function synchronizeSceneRetirementFrame("),
      scene.indexOf("function advanceSceneRetirementFrame("),
    );

    expect(controller).toContain(
      "property var pendingSceneRetirementBarrier: null",
    );
    expect(controller).toContain(
      "property var pendingSceneRetirementFrameRegistrations: []",
    );
    expect(retirement).toContain(
      "const outputIds = openingModelOutputIds(model);",
    );
    expect(retirement).toMatch(
      /const barrierContextInvalid = forcedContextDrift === true\s*\|\| overviewContextRefreshPending;/u,
    );
    expect(retirement).toMatch(
      /if \(outputIds === null \|\| barrierContextInvalid\) \{\s*presentationPhase = "retiring";\s*sceneVisible = false;/u,
    );
    expect(retirement).toContain("const barrier = Object.freeze({");
    expect(retirement).toContain("outputIds: Object.freeze(outputIds.slice())");
    for (const identity of [
      "handoffPromotion: overviewExitHandoffPromotion",
      "handoffState: overviewExitHandoffState",
      "handoffWindow: overviewExitHandoffWindow",
      "model,",
      "sessionId,",
      "token: pendingSceneRetirementToken",
      "topologyGeneration: overviewTopologyGeneration",
    ]) {
      expect(retirement).toContain(identity);
    }
    expect(retirement).toMatch(
      /presentationProgress = 0;\s*presentationPhase = "closing";/u,
    );
    expect(retirement).toMatch(
      /pendingSceneRetirementBarrier = barrier;\s*return true;/u,
    );
    expect(barrierContext).toContain(
      "barrier !== pendingSceneRetirementBarrier",
    );
    expect(barrierContext).toContain("barrier.model !== overviewModel");
    expect(barrierContext).toContain(
      "sameOpeningOutputIds(outputIds, barrier.outputIds)",
    );
    expect(visibilityCommit).toMatch(
      /clearSceneRetirementBarrier\(\);\s*presentationProgress = 0;\s*presentationPhase = "retiring";\s*sceneVisible = false;/u,
    );
    expect(registration).toContain(
      "pendingSceneRetirementFrameRegistrations = Object.freeze(nextRegistrations)",
    );
    expect(registration).toContain(
      "completeSceneRetirementBarrierIfExact(barrier)",
    );
    expect(scene).toMatch(
      /FrameAnimation \{[\s\S]*running: root\.spatialSceneRetirementFrameContext !== null[\s\S]*onTriggered: root\.advanceSceneRetirementFrame\(\)/u,
    );
    expect(frameContext).toContain("barrier !== effect.sceneRetirementBarrier");
    expect(frameContext).toContain(
      "barrier.handoffState !== overviewExitHandoffState",
    );
    expect(frameContext).toContain(
      "!overviewExitHandoffOverlay.terminalCoverageOpaque",
    );
    expect(frameContext).toMatch(
      /const coverageMode = overviewExitHandoffOverlay\.terminalCoverageMode;[\s\S]*coverageMode !== "canvas" && coverageMode !== "bridge"[\s\S]*Object\.freeze\(\{ barrier, coverageMode, outputId: expectedOutputId \}\)/u,
    );
    expect(frameAdvance).toMatch(
      /spatialSceneRetirementFrameCount \+= 1;[\s\S]*spatialSceneRetirementFrameCount !== 2[\s\S]*registerOverviewSceneRetirementFrame/u,
    );
    expect(frameAdvance).toContain(
      "spatialSceneRetirementFrameRegistered = true;",
    );
    expect(frameSynchronization).toContain(
      "const context = sceneRetirementFrameContext();",
    );
    expect(frameSynchronization).toContain(
      "spatialSceneRetirementTrackedCoverageMode === context.coverageMode",
    );
    expect(frameSynchronization).not.toContain(
      "const context = spatialSceneRetirementFrameContext;",
    );
    expect(entrypoint).toContain(
      "readonly property var sceneRetirementBarrier: controller",
    );
    expect(entrypoint).toContain(
      "function registerOverviewSceneRetirementFrame(",
    );
    expect(entrypoint).toContain("function invalidateOverviewSceneRetirement(");
    expect(
      `${barrierContext}\n${visibilityCommit}\n${registration}\n${frameContext}\n${frameAdvance}`,
    ).not.toMatch(/\bTimer\s*\{|Qt\.callLater|org\.kde\.kwin\.private/u);
  });

  it("rejects stale retirement owners and reverses an exact barrier in place", () => {
    const activation = controller.slice(
      controller.indexOf("function activate()"),
      controller.indexOf("function deactivate()"),
    );
    const registration = controller.slice(
      controller.indexOf("function registerOverviewSceneRetirementFrame("),
      controller.indexOf("function completeSceneRetirementBarrierIfExact("),
    );
    const invalidation = controller.slice(
      controller.indexOf("function invalidateOverviewSceneRetirement("),
      controller.indexOf("function cancelSceneRetirementBarrierForReopen("),
    );
    const cancellation = controller.slice(
      controller.indexOf("function cancelSceneRetirementBarrierForReopen("),
      controller.indexOf("function requestSceneRetirement("),
    );
    const deactivated = controller.slice(
      controller.indexOf("function handleSceneDeactivated("),
      controller.indexOf("function prepareOverviewZoomForFreshActivation("),
    );
    const restart = controller.slice(
      controller.indexOf("function queueSceneRestart("),
      controller.indexOf("function clearSceneRetirement("),
    );

    expect(registration).toMatch(
      /if \(barrier !== pendingSceneRetirementBarrier\) \{\s*return false;/u,
    );
    expect(registration).toMatch(
      /registration\.outputId === outputId \|\| registration\.sceneToken === sceneToken[\s\S]*registration\.outputId === outputId && registration\.sceneToken === sceneToken[\s\S]*return true;[\s\S]*commitSceneRetirementVisibility\(barrier, true\);/u,
    );
    expect(invalidation).toMatch(
      /if \(barrier !== pendingSceneRetirementBarrier\) \{\s*return false;/u,
    );
    expect(cancellation).toContain(
      "sceneRetirementBarrierContextIsExact(barrier)",
    );
    expect(cancellation).toMatch(
      /const refreshAfterReopen = pendingSceneRetirementContextDrift;\s*clearSceneRetirement\(\);\s*pendingPostTransitionLiveRefresh = pendingPostTransitionLiveRefresh\s*\|\| refreshAfterReopen;/u,
    );
    expect(cancellation).toContain("clearSceneRetirement();");
    expect(
      activation.indexOf("cancelSceneRetirementBarrierForReopen"),
    ).toBeLessThan(activation.indexOf('cancelOverviewExitHandoff("reopen")'));
    expect(
      activation.indexOf('cancelOverviewExitHandoff("reopen")'),
    ).toBeLessThan(
      activation.indexOf(
        'startPresentationTransition("opening", 1, activeSessionId)',
      ),
    );
    expect(controller).toMatch(
      /function advanceOverviewTopologyGeneration\(\)[\s\S]*pendingSceneRetirementBarrier[\s\S]*forceSceneRetirementBarrier\(true\)/u,
    );
    expect(controller).toContain(
      "onOverviewExitHandoffStateChanged: reconcileSceneRetirementBarrier()",
    );
    expect(scene).toMatch(
      /Component\.onDestruction: \{\s*root\.invalidateTrackedSceneRetirementFrame\(\);/u,
    );
    expect(scene).toContain(
      "onSceneRetirementBarrierChanged: root.synchronizeSceneRetirementFrame()",
    );
    expect(scene).toMatch(
      /const barrier = spatialSceneRetirementTrackedBarrier \|\| sceneRetirementBarrier;[\s\S]*sceneOwnsRetirementBarrier\(barrier\)/u,
    );
    const sceneOwnership = scene.slice(
      scene.indexOf("function sceneOwnsRetirementBarrier("),
      scene.indexOf("function invalidateTrackedSceneRetirementFrame("),
    );
    expect(sceneOwnership).not.toContain(
      "barrier.outputIds.indexOf(expectedOutputId)",
    );
    expect(entrypoint).toMatch(
      /onDeactivated:[\s\S]*controller\.pendingSceneRetirementBarrier[\s\S]*forceSceneRetirementBarrier\(true\)[\s\S]*handleSceneDeactivated\(controller\.pendingSceneRetirementToken,[\s\S]*controller\.pendingSceneRetirementSessionId\)/u,
    );
    expect(deactivated).toMatch(
      /retirementToken !== pendingSceneRetirementToken[\s\S]*sessionId !== pendingSceneRetirementSessionId[\s\S]*pendingSceneRetirementBarrier !== null[\s\S]*presentationPhase !== "retiring"/u,
    );
    expect(deactivated).toMatch(
      /const reopen = pendingSceneRetirementReopen;[\s\S]*const contextDrift = pendingSceneRetirementContextDrift;[\s\S]*const completedSessionId = pendingSceneRetirementSessionId;[\s\S]*if \(!reopen\)[\s\S]*finalizeInactiveOverviewState\(\)[\s\S]*queueSceneRestart\(completedSessionId, contextDrift\)/u,
    );
    expect(deactivated).not.toMatch(/prepareOpeningReadiness|\bactivate\(\)/u);
    expect(restart).toMatch(
      /Object\.freeze[\s\S]*restartToken: nextSceneRestartToken\(\)[\s\S]*Qt\.callLater[\s\S]*pendingSceneRestartRequest !== request[\s\S]*presentationPhase !== "closed"[\s\S]*controller\.activate\(\)/u,
    );
    expect(
      `${activation}\n${registration}\n${invalidation}\n${cancellation}`,
    ).not.toMatch(/\bTimer\s*\{|Qt\.callLater|org\.kde\.kwin\.private/u);
  });
});
