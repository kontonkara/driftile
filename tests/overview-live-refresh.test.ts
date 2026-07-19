import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const reader = readFileSync(
  new URL("contents/runtime/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

describe("overview live model refresh", () => {
  it("coalesces workspace lifecycle events without hiding the active model", () => {
    const lifecycle = controller.slice(
      controller.indexOf("id: workspaceWindowLifecycleConnection"),
      controller.indexOf("function toggle("),
    );
    const request = controller.slice(
      controller.indexOf("function requestLiveModelRefresh("),
      controller.indexOf("function acceptLiveModelRefresh("),
    );

    expect(lifecycle).toContain("target: KWin.Workspace");
    expect(lifecycle).toMatch(
      /function onWindowAdded\(\) \{\s*controller\.requestLiveModelRefresh\(\);/u,
    );
    expect(lifecycle).toMatch(
      /function onWindowRemoved\(\) \{\s*controller\.requestLiveModelRefresh\(\);/u,
    );
    expect(lifecycle).toMatch(
      /function onDesktopsChanged\(\) \{\s*controller\.requestLiveModelRefresh\(\);/u,
    );
    expect(request).toMatch(
      /if \(!active \|\| loading \|\| activeSessionId <= 0 \|\| !overviewModel\) \{\s*return;/u,
    );
    expect(request).toContain("layoutStateReader.cancel();");
    expect(request).toContain("clearPendingLiveModelRefresh();");
    expect(request).toContain("pendingLiveRefreshModel = expectedModel;");
    expect(request).toContain("pendingLiveRefreshSessionId = sessionId;");
    expect(request).toContain("pendingLiveRefreshAttemptId = attemptId;");
    expect(request).toContain("layoutStateReader.sample(attemptId);");
    expect(request.indexOf("layoutStateReader.cancel();")).toBeLessThan(
      request.indexOf("layoutStateReader.sample(attemptId);"),
    );
    expect(request).not.toMatch(
      /overviewModel = null|active = false|loading = true|\bTimer\s*\{|setInterval|setTimeout/u,
    );

    expect(reader).toContain("readonly property int sampleInterval: 325");
    expect(reader.match(/\bTimer\s*\{/gu)).toHaveLength(1);
    expect(reader).toMatch(/interval: root\.sampleInterval\s*repeat: false/u);
    expect(reader).toMatch(
      /function sample\(requestId\) \{\s*cancel\(\);[\s\S]*firstSample = [\s\S]*secondSampleTimer\.start\(\);/u,
    );
  });

  it("swaps only an exact active session and retries one rejected sample", () => {
    const dispatch = controller.slice(
      controller.indexOf(
        "readonly property LayoutStateReader layoutStateReader",
      ),
      controller.indexOf(
        "readonly property KWin.ShortcutHandler toggleShortcut",
      ),
    );
    const accept = controller.slice(
      controller.indexOf("function acceptLiveModelRefresh("),
      controller.indexOf("function rejectLiveModelRefresh("),
    );
    const reject = controller.slice(
      controller.indexOf("function rejectLiveModelRefresh("),
      controller.indexOf("function liveModelRefreshIsExact("),
    );
    const exact = controller.slice(
      controller.indexOf("function liveModelRefreshIsExact("),
      controller.indexOf("function clearPendingLiveModelRefresh("),
    );
    const deactivate = controller.slice(
      controller.indexOf("function deactivate("),
      controller.indexOf("function plasmaOverviewIsActive("),
    );

    expect(dispatch).toContain(
      "controller.acceptLayoutState(attemptId, document)",
    );
    expect(dispatch).toContain(
      'controller.rejectLayoutState(attemptId, "unstable-state")',
    );
    expect(accept.match(/liveModelRefreshIsExact\(/gu)).toHaveLength(2);
    expect(accept).toContain(
      "runtime.loadOverviewModel(document, liveSnapshot())",
    );
    expect(accept).toContain("controller.rejectLiveModelRefresh(attemptId)");
    expect(accept.indexOf("clearPendingLiveModelRefresh();")).toBeLessThan(
      accept.indexOf("overviewModel = result.value;"),
    );
    expect(exact).toMatch(
      /attemptId === pendingLiveRefreshAttemptId[\s\S]*sessionId === pendingLiveRefreshSessionId[\s\S]*activeSessionId === sessionId[\s\S]*overviewModel === expectedModel[\s\S]*pendingLiveRefreshModel === expectedModel/u,
    );
    expect(reject).toContain(
      "const retryCount = pendingLiveRefreshRetryCount;",
    );
    expect(reject).toMatch(/if \(retryCount >= 1\) \{\s*return;/u);
    expect(reject).toContain("startLiveModelRefresh(retryCount + 1);");
    expect(deactivate).toContain("clearPendingLiveModelRefresh();");
    expect(deactivate).toContain("layoutStateReader.cancel();");
    expect(deactivate).toContain("activeSessionId = 0;");
    expect(`${accept}\n${reject}\n${exact}`).not.toMatch(
      /rejectionOsdCall|console\.|\bTimer\s*\{|repeat:\s*true|org\.kde\.kwin\.private|\.setValue\s*\(/u,
    );
  });

  it("keeps context changes fail closed while workspace churn refreshes in place", () => {
    const workspaceLifecycle = scene.slice(
      scene.indexOf("target: KWin.Workspace"),
      scene.indexOf("Timer {", scene.indexOf("target: KWin.Workspace")),
    );
    const spatialSessionRefresh = scene.slice(
      scene.indexOf("function refreshOverviewSpatialSession("),
      scene.indexOf("function resetSpatialViewport("),
    );
    const resetSession = scene.slice(
      scene.indexOf("function resetOverviewSession("),
      scene.indexOf("function scheduleDesktopTopologyRefresh("),
    );
    const topologySchedule = scene.slice(
      scene.indexOf("function scheduleDesktopTopologyRefresh("),
      scene.indexOf("function completeDesktopTopologyRefresh("),
    );
    const topologyCompletion = scene.slice(
      scene.indexOf("function completeDesktopTopologyRefresh("),
      scene.indexOf("function invalidateDesktopTopologyRefresh("),
    );

    expect(workspaceLifecycle).toMatch(
      /function onDesktopsChanged\(\) \{\s*root\.scheduleDesktopTopologyRefresh\(\);/u,
    );
    for (const signal of [
      "onCurrentActivityChanged",
      "onActivitiesChanged",
      "onScreensChanged",
    ]) {
      expect(workspaceLifecycle).toMatch(
        new RegExp(
          `function ${signal}\\(\\) \\{\\s*root\\.closeStaleOverview\\(\\);`,
          "u",
        ),
      );
    }
    expect(resetSession).toContain("invalidateDesktopTopologyRefresh();");
    expect(topologySchedule).toMatch(
      /if \(!effect \|\| effect\.active !== true \|\| spatialPresentationPhase === "closing"[\s\S]*!expectedModel \|\| expectedSessionId <= 0\) \{\s*return false;/u,
    );
    expect(topologySchedule).toContain("resetWindowWorkspaceHover();");
    expect(topologySchedule).toMatch(
      /Qt\.callLater\(function\(\) \{\s*root\.completeDesktopTopologyRefresh\(requestId, expectedSessionId, expectedModel\);/u,
    );
    expect(topologyCompletion).toMatch(
      /requestId !== desktopTopologyRefreshRequestId[\s\S]*spatialPresentationPhase === "closing"[\s\S]*effect\.activeSessionId !== expectedSessionId[\s\S]*overviewModel !== expectedModel[\s\S]*effect\.overviewModel !== expectedModel/u,
    );
    expect(workspaceLifecycle).not.toContain("function onWindowAdded");
    expect(workspaceLifecycle).toMatch(
      /function onWindowRemoved\(window\) \{\s*root\.handleSpatialLiveCameraWindowRemoved\(window\);/u,
    );
    expect(workspaceLifecycle).not.toMatch(
      /function onWindowRemoved\(window\)[\s\S]*requestLiveModelRefresh|function onWindowRemoved\(window\)[\s\S]*closeStaleOverview/u,
    );
    expect(scene).toContain(
      "onOverviewModelChanged: root.refreshOverviewSpatialSession(true)",
    );
    expect(scene).toMatch(
      /function refreshOverviewSpatialSession\(preserveViewport, animateViewport = false\)[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /const selectedWorkspaceIndex = desktopIds\s*&& typeof desktopIds\.indexOf === "function"\s*\? desktopIds\.indexOf\(selectedDesktopId\) : -1;/u,
    );
    expect(
      spatialSessionRefresh.indexOf(
        "selectedDesktopId = selectedTarget.desktopId;",
      ),
    ).toBeLessThan(
      spatialSessionRefresh.indexOf("cancelKeyboardBoundaryNavigation();"),
    );
    expect(
      spatialSessionRefresh.indexOf("const selectedWorkspaceIndex"),
    ).toBeLessThan(
      spatialSessionRefresh.indexOf(
        "planSpatialWorkspaceCenter(selectedWorkspaceIndex)",
      ),
    );
    expect(spatialSessionRefresh).toMatch(
      /const previousViewportSnapshot = preserveViewport === true \? spatialViewportSnapshot : null;[\s\S]*planSpatialViewportAnchor\(previousViewportSnapshot, nextViewportGeometry\)[\s\S]*setSpatialContentY\(anchorPlan\.contentY, animateViewport\);/u,
    );
    expect(spatialSessionRefresh.indexOf("anchorPlan")).toBeLessThan(
      spatialSessionRefresh.indexOf("resetSpatialViewport(animateViewport);"),
    );
    expect(spatialSessionRefresh).not.toMatch(
      /keyboardSelectionId = ""|keyboardHelpVisible = false|searchQuery = ""/u,
    );
  });
});
