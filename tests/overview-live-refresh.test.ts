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
      /function onWindowAdded\(window\) \{\s*controller\.queueDesktopSurfaceLifecycleEvent\(window\);\s*controller\.requestLiveModelRefresh\(\);/u,
    );
    expect(lifecycle).toMatch(
      /function onWindowRemoved\(window\) \{\s*controller\.queueDesktopSurfaceLifecycleEvent\(window\);\s*controller\.requestLiveModelRefresh\(\);/u,
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

  it("snapshots only active confirmed desktop windows through exact public identities", () => {
    const lifecycle = controller.slice(
      controller.indexOf("id: workspaceWindowLifecycleConnection"),
      controller.indexOf("function toggle("),
    );
    const capture = controller.slice(
      controller.indexOf("function queueDesktopSurfaceLifecycleEvent(window)"),
      controller.indexOf("function open()"),
    );
    const queue = capture.slice(
      capture.indexOf("function queueDesktopSurfaceLifecycleEvent(window)"),
      capture.indexOf("function snapshotDesktopSurfaceLifecycleScope(window)"),
    );
    const output = capture.slice(
      capture.indexOf("function snapshotDesktopSurfaceLifecycleOutput(window)"),
      capture.indexOf(
        "function snapshotDesktopSurfaceLifecycleDesktops(window)",
      ),
    );
    const desktops = capture.slice(
      capture.indexOf(
        "function snapshotDesktopSurfaceLifecycleDesktops(window)",
      ),
      capture.indexOf(
        "function snapshotDesktopSurfaceLifecycleActivities(window)",
      ),
    );
    const activities = capture.slice(
      capture.indexOf(
        "function snapshotDesktopSurfaceLifecycleActivities(window)",
      ),
      capture.indexOf(
        "function desktopSurfaceLifecycleSequenceIsValid(sequence)",
      ),
    );

    expect(controller).toContain(
      "property var desktopSurfaceLifecycleEvent: null",
    );
    expect(controller).toContain(
      "property int desktopSurfaceLifecycleRevision: 0",
    );
    expect(
      lifecycle.match(/queueDesktopSurfaceLifecycleEvent\(window\)/gu),
    ).toHaveLength(2);
    expect(queue).toMatch(
      /try \{\s*if \(!window \|\| window\.desktopWindow !== true\) \{\s*return false;\s*\}\s*\} catch \(error\) \{\s*return false;/u,
    );
    expect(queue).toMatch(
      /if \(!active\) \{\s*return false;\s*\}[\s\S]*scope = snapshotDesktopSurfaceLifecycleScope\(window\);/u,
    );
    expect(queue.indexOf("window.desktopWindow !== true")).toBeLessThan(
      queue.indexOf("snapshotDesktopSurfaceLifecycleScope(window)"),
    );
    expect(queue).not.toMatch(/window\.(?:output|desktops|activities)/u);
    expect(queue).toMatch(
      /if \(!scope\) \{\s*queueGlobalDesktopSurfaceLifecycleEvent\(\);\s*return true;/u,
    );

    expect(output).toContain("const output = window.output;");
    expect(output).toContain("const liveOutputs = KWin.Workspace.screens;");
    expect(output).toContain("liveOutput === output");
    expect(output).toContain("objectMatches === 1 && nameMatches === 1");
    expect(output).toContain(
      "desktopSurfaceLifecycleIdentifierIsValid(outputName)",
    );

    expect(desktops).toContain("const memberships = window.desktops;");
    expect(desktops).toContain("const liveDesktops = KWin.Workspace.desktops;");
    expect(desktops).toMatch(
      /if \(memberships\.length === 0\) \{\s*return \{ all: true, ids: \[\] \};/u,
    );
    expect(desktops).toContain("liveDesktop === desktop");
    expect(desktops).toContain("objectMatches !== 1 || idMatches !== 1");
    expect(desktops).toMatch(
      /if \(knownIds\[desktopId\] === true\) \{\s*return null;/u,
    );

    expect(activities).toContain("const memberships = window.activities;");
    expect(activities).toContain(
      "const liveActivities = KWin.Workspace.activities;",
    );
    expect(activities).toMatch(
      /if \(memberships\.length === 0\) \{\s*return \{ all: true, ids: \[\] \};/u,
    );
    expect(activities).toContain("if (matches !== 1)");
    expect(activities).toMatch(
      /if \(knownIds\[activityId\] === true\) \{\s*return null;/u,
    );
  });

  it("bounds, validates, and deduplicates exact lifecycle scopes", () => {
    const capture = controller.slice(
      controller.indexOf("function queueDesktopSurfaceLifecycleEvent(window)"),
      controller.indexOf("function open()"),
    );
    const shapeValidation = capture.slice(
      capture.indexOf(
        "function desktopSurfaceLifecycleSequenceIsValid(sequence)",
      ),
      capture.indexOf("function mergeDesktopSurfaceLifecycleScope(scope)"),
    );
    const merge = capture.slice(
      capture.indexOf("function mergeDesktopSurfaceLifecycleScope(scope)"),
      capture.indexOf("function queueGlobalDesktopSurfaceLifecycleEvent()"),
    );
    const scopeValidation = capture.slice(
      capture.indexOf("function desktopSurfaceLifecycleScopeIsValid(scope)"),
      capture.indexOf("function desktopSurfaceLifecycleScopesAreEqual("),
    );
    const scopeEquality = capture.slice(
      capture.indexOf("function desktopSurfaceLifecycleScopesAreEqual("),
      capture.indexOf("function queueGlobalDesktopSurfaceLifecycleEvent()"),
    );

    expect(controller).toContain(
      "readonly property int desktopSurfaceLifecycleIdLimit: 512",
    );
    expect(controller).toContain(
      "readonly property int desktopSurfaceLifecycleIdentifierLimit: 256",
    );
    expect(controller).toContain(
      "readonly property int desktopSurfaceLifecycleScopeLimit: 64",
    );
    expect(shapeValidation).toContain(
      "sequence.length <= desktopSurfaceLifecycleIdLimit",
    );
    expect(shapeValidation).toMatch(
      /typeof value !== "string" \|\| value\.length === 0[\s\S]*value\.length > desktopSurfaceLifecycleIdentifierLimit/u,
    );
    expect(shapeValidation).toMatch(
      /const code = value\.charCodeAt\(index\);\s*if \(code <= 31 \|\| code === 127\)/u,
    );

    expect(merge).toMatch(
      /if \(!desktopSurfaceLifecycleScopeIsValid\(scope\)\) \{\s*queueGlobalDesktopSurfaceLifecycleEvent\(\);/u,
    );
    expect(merge).toMatch(
      /pendingScope\.output === scope\.output\s*&& pendingScope\.outputName !== scope\.outputName/u,
    );
    expect(merge).toContain(
      "desktopSurfaceLifecycleScopesAreEqual(pendingScope, scope)",
    );
    expect(merge).toContain("pendingDesktopSurfaceLifecycleScopes.push({");
    expect(merge).toContain(
      "pendingDesktopSurfaceLifecycleScopes.length >= desktopSurfaceLifecycleScopeLimit",
    );
    expect(scopeValidation).toMatch(
      /desktopSurfaceLifecycleIdSelectionIsValid\(scope\.allDesktops, scope\.desktopIds\)[\s\S]*desktopSurfaceLifecycleIdSelectionIsValid\(scope\.allActivities, scope\.activityIds\)/u,
    );
    expect(scopeValidation).toMatch(
      /all \? ids\.length !== 0 : ids\.length === 0/u,
    );
    expect(scopeValidation).toMatch(
      /!desktopSurfaceLifecycleIdentifierIsValid\(id\) \|\| knownIds\[id\] === true/u,
    );
    expect(scopeEquality).toMatch(
      /first\.output === second\.output && first\.outputName === second\.outputName[\s\S]*first\.allDesktops === second\.allDesktops[\s\S]*first\.allActivities === second\.allActivities[\s\S]*desktopSurfaceLifecycleIdSetsAreEqual\(first\.desktopIds, second\.desktopIds\)[\s\S]*desktopSurfaceLifecycleIdSetsAreEqual\(first\.activityIds, second\.activityIds\)/u,
    );
  });

  it("preserves desktop and activity rectangles without cross-product widening", () => {
    const merge = controller.slice(
      controller.indexOf("function mergeDesktopSurfaceLifecycleScope(scope)"),
      controller.indexOf("function desktopSurfaceLifecycleScopeIsValid(scope)"),
    );

    const dedupe = merge.indexOf(
      "desktopSurfaceLifecycleScopesAreEqual(pendingScope, scope)",
    );
    const append = merge.indexOf("pendingDesktopSurfaceLifecycleScopes.push({");
    expect(dedupe).toBeGreaterThan(0);
    expect(append).toBeGreaterThan(dedupe);
    expect(merge).not.toMatch(
      /pendingScope\.(?:allDesktops|desktopIds|allActivities|activityIds)\s*=/u,
    );
    expect(merge).not.toMatch(
      /mergeDesktopSurfaceLifecycleIds|pendingScope\.allDesktops \|\| scope\.allDesktops|pendingScope\.allActivities \|\| scope\.allActivities/u,
    );
    expect(merge).toMatch(
      /desktopIds: scope\.allDesktops \? \[\] : scope\.desktopIds\.slice\(\)[\s\S]*activityIds: scope\.allActivities \? \[\] : scope\.activityIds\.slice\(\)/u,
    );
  });

  it("flushes one immutable lifecycle event and cancels stale bursts on teardown", () => {
    const capture = controller.slice(
      controller.indexOf("function queueDesktopSurfaceLifecycleEvent(window)"),
      controller.indexOf("function open()"),
    );
    const globalFallback = capture.slice(
      capture.indexOf("function queueGlobalDesktopSurfaceLifecycleEvent()"),
      capture.indexOf("function scheduleDesktopSurfaceLifecycleFlush()"),
    );
    const schedule = capture.slice(
      capture.indexOf("function scheduleDesktopSurfaceLifecycleFlush()"),
      capture.indexOf("function flushDesktopSurfaceLifecycleEvent()"),
    );
    const flush = capture.slice(
      capture.indexOf("function flushDesktopSurfaceLifecycleEvent()"),
      capture.indexOf(
        "function clearPublishedDesktopSurfaceLifecycleEvent(expectedEvent)",
      ),
    );
    const publicationClear = capture.slice(
      capture.indexOf(
        "function clearPublishedDesktopSurfaceLifecycleEvent(expectedEvent)",
      ),
      capture.indexOf("function clearPendingDesktopSurfaceLifecycleEvent()"),
    );
    const revision = capture.slice(
      capture.indexOf("function nextDesktopSurfaceLifecycleRevision()"),
    );
    const deactivateImmediately = controller.slice(
      controller.indexOf("function deactivateImmediately()"),
      controller.indexOf("function boundedPresentationProgress("),
    );

    expect(controller).toContain(
      "property bool desktopSurfaceLifecycleFlushQueued: false",
    );
    expect(globalFallback).toMatch(
      /pendingDesktopSurfaceLifecycleGlobal = true;\s*pendingDesktopSurfaceLifecycleScopes = \[\];\s*scheduleDesktopSurfaceLifecycleFlush\(\);/u,
    );
    expect(schedule).toMatch(
      /if \(desktopSurfaceLifecycleFlushQueued\) \{\s*return;\s*\}[\s\S]*desktopSurfaceLifecycleFlushQueued = true;\s*Qt\.callLater\(controller\.flushDesktopSurfaceLifecycleEvent\);/u,
    );
    expect(schedule.match(/Qt\.callLater\(/gu)).toHaveLength(1);
    expect(flush.match(/Qt\.callLater\(/gu)).toHaveLength(1);
    expect(capture.match(/Qt\.callLater\(/gu)).toHaveLength(2);
    expect(flush).toMatch(
      /clearPendingDesktopSurfaceLifecycleEvent\(\);\s*if \(!active\) \{\s*return false;/u,
    );
    expect(flush).toContain("scopes.push(Object.freeze({");
    expect(flush).toContain(
      "desktopIds: Object.freeze(allDesktops ? [] : scope.desktopIds.slice())",
    );
    expect(flush).toContain(
      "activityIds: Object.freeze(allActivities ? [] : scope.activityIds.slice())",
    );
    expect(flush).toContain("scopes: Object.freeze(scopes)");
    expect(flush).toContain("const event = Object.freeze({");
    expect(flush).toContain("desktopSurfaceLifecycleEvent = event;");
    expect(flush).toContain(
      "Qt.callLater(controller.clearPublishedDesktopSurfaceLifecycleEvent, event);",
    );
    expect(
      flush.indexOf("desktopSurfaceLifecycleRevision = revision;"),
    ).toBeLessThan(flush.indexOf("desktopSurfaceLifecycleEvent = event;"));
    expect(flush).toMatch(
      /desktopSurfaceLifecycleRevision = revision;\s*if \(!active\) \{\s*desktopSurfaceLifecycleEvent = null;\s*return false;/u,
    );
    expect(revision).toMatch(
      /desktopSurfaceLifecycleRevision >= 2147483647 \? 1[\s\S]*desktopSurfaceLifecycleRevision \+ 1/u,
    );
    expect(publicationClear).toMatch(
      /if \(desktopSurfaceLifecycleEvent !== expectedEvent\) \{\s*return false;\s*\}[\s\S]*desktopSurfaceLifecycleEvent = null;\s*return true;/u,
    );
    expect(deactivateImmediately).toMatch(
      /clearPendingDesktopSurfaceLifecycleEvent\(\);\s*desktopSurfaceLifecycleEvent = null;/u,
    );
    expect(`${capture}\n${deactivateImmediately}`).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|repeat:\s*true|setInterval|setTimeout|KWin\.Workspace\.(?:stackingOrder|windows)\b/u,
    );
  });

  it("does not retain or let an older callback clear a published lifecycle event", () => {
    const flush = controller.slice(
      controller.indexOf("function flushDesktopSurfaceLifecycleEvent()"),
      controller.indexOf(
        "function clearPublishedDesktopSurfaceLifecycleEvent(expectedEvent)",
      ),
    );
    const publicationClear = controller.slice(
      controller.indexOf(
        "function clearPublishedDesktopSurfaceLifecycleEvent(expectedEvent)",
      ),
      controller.indexOf("function clearPendingDesktopSurfaceLifecycleEvent()"),
    );

    expect(flush).toMatch(
      /desktopSurfaceLifecycleEvent = event;\s*Qt\.callLater\(controller\.clearPublishedDesktopSurfaceLifecycleEvent, event\);/u,
    );
    expect(publicationClear).toMatch(
      /desktopSurfaceLifecycleEvent !== expectedEvent[\s\S]*return false;[\s\S]*desktopSurfaceLifecycleEvent = null;/u,
    );
    expect(publicationClear).not.toMatch(
      /desktopSurfaceLifecycleRevision|pendingDesktopSurfaceLifecycleScopes|clearPendingDesktopSurfaceLifecycleEvent/u,
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
    expect(dispatch).toContain(
      "onPublicationDetected: controller.requestLiveModelRefresh()",
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

  it("observes persisted layout publications without polling", () => {
    expect(reader).toContain("import Qt.labs.folderlistmodel");
    expect(reader).toContain("import QtQml.Models");
    expect(reader).toContain("signal publicationDetected()");
    expect(reader).toMatch(
      /readonly property FolderListModel stateFiles:[\s\S]*folder: root\.stateDirectory[\s\S]*nameFilters: \["driftile-layout-state\.ini"\][\s\S]*showDirs: false[\s\S]*showFiles: true/u,
    );
    expect(reader).toMatch(
      /readonly property Instantiator stateFileObserver:[\s\S]*model: root\.stateFiles[\s\S]*required property date fileModified[\s\S]*required property double fileSize/u,
    );
    expect(reader).toMatch(
      /Component\.onCompleted:[\s\S]*armed = true;[\s\S]*root\.publicationDetected\(\);/u,
    );
    expect(reader).toMatch(
      /onFileModifiedChanged:[\s\S]*if \(armed\)[\s\S]*root\.publicationDetected\(\);/u,
    );
    expect(reader).toMatch(
      /onFileSizeChanged:[\s\S]*if \(armed\)[\s\S]*root\.publicationDetected\(\);/u,
    );
    expect(reader.match(/\bTimer\s*\{/gu)).toHaveLength(1);
    expect(reader).not.toMatch(
      /repeat:\s*true|setInterval|setTimeout|WeakSet|WeakMap|_q_directory|setValue/u,
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
