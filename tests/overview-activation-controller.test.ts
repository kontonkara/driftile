import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const entrypoint = readFileSync(
  new URL("contents/ui/main.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const reader = readFileSync(
  new URL("contents/runtime/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);

describe("overview activation controller", () => {
  it("reuses only an exact synchronous persisted-state and live-snapshot hit", () => {
    const activation = controller.slice(
      controller.indexOf("function activate()"),
      controller.indexOf("function deactivate()"),
    );
    const lookup = controller.slice(
      controller.indexOf("function lookupActivationCache("),
      controller.indexOf("function scheduleActivationCacheStore("),
    );

    expect(controller).toContain(
      "readonly property var overviewActivationCache: createActivationCache()",
    );
    expect(activation).toMatch(
      /const synchronousDocument = layoutStateReader\.readSample\(\);\s*const cachedModel = lookupActivationCache\(synchronousDocument\);/u,
    );
    expect(activation).not.toContain("liveSnapshot()");
    expect(activation).toMatch(
      /if \(cachedModel\) \{\s*acceptActivationModel\(attemptId, cachedModel\);\s*return;\s*\}\s*layoutStateReader\.sample\(attemptId\);/u,
    );
    expect(activation.indexOf("layoutStateReader.readSample()")).toBeLessThan(
      activation.indexOf("lookupActivationCache("),
    );
    expect(activation.indexOf("lookupActivationCache(")).toBeLessThan(
      activation.indexOf("layoutStateReader.sample(attemptId)"),
    );
    expect(lookup).toMatch(
      /cache\.hasExactDocument\(document\)[\s\S]*const snapshot = liveSnapshot\(\);[\s\S]*cache\.lookup\(document, snapshot\)/u,
    );
    expect(lookup.indexOf("cache.hasExactDocument(document)")).toBeLessThan(
      lookup.indexOf("liveSnapshot()"),
    );
  });

  it("keeps changed state on the existing two-sample confirmation path", () => {
    const sample = reader.slice(
      reader.indexOf("function sample(requestId)"),
      reader.indexOf("function cancel()"),
    );

    expect(reader).toContain("readonly property int sampleInterval: 120");
    expect(sample).toContain("const synchronousSample = readSample();");
    expect(sample).toContain("synchronousSample === stableSample");
    expect(sample).toContain("firstSample = synchronousSample;");
    expect(sample).toContain("secondSampleTimer.start();");
    expect(reader).toMatch(
      /const secondSample = root\.readSample\(\);[\s\S]*root\.firstSample === secondSample[\s\S]*root\.ready\(completedRequestId, secondSample\)/u,
    );
  });

  it("presents a validated activation before its guarded cache clone", () => {
    const acceptance = controller.slice(
      controller.indexOf("function acceptLayoutState("),
      controller.indexOf("function acceptActivationModel("),
    );
    const deferredStore = controller.slice(
      controller.indexOf("function scheduleActivationCacheStore("),
      controller.indexOf("function storeActivationCache("),
    );
    const refresh = controller.slice(
      controller.indexOf("function acceptLiveModelRefresh("),
      controller.indexOf("function rejectLiveModelRefresh("),
    );

    for (const path of [acceptance, refresh]) {
      expect(path).toMatch(
        /const snapshot = liveSnapshot\(\);\s*const result = runtime\.loadOverviewModel\(document, snapshot\);/u,
      );
    }
    expect(acceptance).toMatch(
      /result\.ok !== true \|\| !result\.value[\s\S]*acceptActivationModel\(attemptId, result\.value\)[\s\S]*scheduleActivationCacheStore\(attemptId, document, snapshot,[\s\S]*result\.value\)/u,
    );
    expect(acceptance).not.toContain("storeActivationCache(");
    expect(refresh).toMatch(
      /result\.ok !== true \|\| !result\.value[\s\S]*overviewModel = result\.value;[\s\S]*scheduleActivationCacheStore\(sessionId, document, snapshot,[\s\S]*result\.value\)/u,
    );
    expect(refresh).not.toContain("storeActivationCache(");
    expect(deferredStore).toMatch(
      /activeSessionId !== sessionId[\s\S]*overviewModel !== model[\s\S]*Qt\.callLater\(function\(\) \{[\s\S]*controller\.activeSessionId !== sessionId[\s\S]*controller\.overviewModel !== model[\s\S]*controller\.storeActivationCache\(document, snapshot, model\)/u,
    );
    expect(controller).toMatch(
      /function lookupActivationCache\(document\)[\s\S]*cache\.hasExactDocument\(document\)[\s\S]*result\.ok === true && result\.value/u,
    );
    expect(controller).toMatch(
      /function storeActivationCache\(document, snapshot, model\)[\s\S]*result\.ok === true && result\.value/u,
    );
    expect(`${controller}\n${reader}`).not.toMatch(
      /org\.kde\.kwin\.private|setInterval|setTimeout/u,
    );
  });

  it("waits for one exact ready delegate per output after public activation", () => {
    const accept = controller.slice(
      controller.indexOf("function acceptActivationModel("),
      controller.indexOf("function createActivationCache("),
    );
    const prepare = controller.slice(
      controller.indexOf("function prepareOpeningReadiness("),
      controller.indexOf("function openingReadinessContextIsExact("),
    );
    const register = controller.slice(
      controller.indexOf("function registerOverviewSceneReady("),
      controller.indexOf("function unregisterOverviewSceneReady("),
    );
    const unregister = controller.slice(
      controller.indexOf("function unregisterOverviewSceneReady("),
      controller.indexOf("function completeOpeningReadinessIfExact("),
    );
    const complete = controller.slice(
      controller.indexOf("function completeOpeningReadinessIfExact("),
      controller.indexOf("function boundedPresentationProgress("),
    );

    expect(entrypoint).toContain(
      "visible: controller ? controller.sceneVisible : false",
    );
    expect(entrypoint).toMatch(
      /onActivated:[\s\S]*acknowledgeOverviewSceneActivated\(controller\.openingReadinessEpoch,[\s\S]*controller\.openingReadinessSessionId\)/u,
    );
    expect(accept).toContain(
      "return prepareOpeningReadiness(attemptId, model);",
    );
    expect(accept).not.toContain('startPresentationTransition("opening"');
    expect(prepare).toMatch(
      /openingReadinessEpoch = epoch;[\s\S]*openingReadinessExpectedOutputIds = outputIds;[\s\S]*openingReadinessModel = model;[\s\S]*openingReadinessTopologyGeneration = overviewTopologyGeneration;[\s\S]*presentationProgress = 0;[\s\S]*presentationPhase = "preparing";[\s\S]*sceneVisible = true;[\s\S]*Qt\.callLater[\s\S]*rejectUnstartedOpeningScene/u,
    );
    expect(register).toMatch(
      /openingReadinessExpectedOutputIds\.indexOf\(outputId\)[\s\S]*latchOpeningSceneActivation\(epoch, sessionId, model,[\s\S]*topologyGeneration\)[\s\S]*registration\.outputId === outputId \|\| registration\.sceneToken === sceneToken[\s\S]*requestSceneRetirement\(sessionId\)/u,
    );
    expect(complete).toMatch(
      /openingReadinessSceneActivated[\s\S]*registrations\.length !== outputIds\.length[\s\S]*matches !== 1[\s\S]*clearOpeningReadiness\(\)[\s\S]*startPresentationTransition\("opening", 1, sessionId\)/u,
    );
    expect(scene).toContain(
      "readonly property var spatialPresentationReadinessContext: sceneReadinessContext()",
    );
    expect(scene).toContain(
      "onSpatialPresentationReadinessContextChanged: root.synchronizePresentationReadiness()",
    );
    expect(scene).toMatch(
      /Component\.onDestruction:[\s\S]*unregisterPresentationReadiness\(true\)/u,
    );
    expect(scene).toMatch(
      /function sceneReadinessContext\(\)[\s\S]*effect\.sceneVisible !== true[\s\S]*spatialPresentationPhase !== "preparing"[\s\S]*Number\(geometry\.width\) !== width[\s\S]*spatialLayoutIsValid\(overviewSpatialLayout\)[\s\S]*spatialViewportSnapshot[\s\S]*outputMatches !== 1/u,
    );
    expect(controller).toMatch(
      /function rejectUnstartedOpeningScene[\s\S]*openingReadinessIdentityIsExact[\s\S]*openingReadinessSceneActivated[\s\S]*sceneVisible = false;[\s\S]*finalizeInactiveOverviewState/u,
    );
    expect(unregister).toMatch(
      /openingReadinessRegistrations = nextRegistrations;[\s\S]*fatal === true[\s\S]*requestSceneRetirement\(sessionId\)/u,
    );
    expect(unregister).not.toMatch(
      /openingReadinessRegistrations = nextRegistrations;\s*if \(active/u,
    );
    expect(`${controller}\n${scene}`).not.toMatch(/setInterval|setTimeout/u);
    expect(prepare).not.toMatch(/\bTimer\s*\{/u);
    expect(controller).toMatch(
      /function advanceOverviewTopologyGeneration\(\)[\s\S]*presentationPhase === "preparing"[\s\S]*restartPreparingSceneForContextDrift\(\)/u,
    );
    expect(controller).toMatch(
      /function restartPreparingSceneForContextDrift\(\)[\s\S]*openingReadinessSceneActivated[\s\S]*queueSceneRestart\(sessionId, true\)[\s\S]*requestSceneRetirement\(sessionId, true, true\)/u,
    );
    expect(controller).toMatch(
      /function activate\(\)[\s\S]*if \(active\)[\s\S]*presentationPhase === "preparing"[\s\S]*return;[\s\S]*startPresentationTransition\("opening", 1, activeSessionId\)/u,
    );
  });

  it("recovers when public scene activation predates readiness setup", () => {
    const acknowledge = controller.slice(
      controller.indexOf("function acknowledgeOverviewSceneActivated("),
      controller.indexOf("function latchOpeningSceneActivation("),
    );
    const latch = controller.slice(
      controller.indexOf("function latchOpeningSceneActivation("),
      controller.indexOf("function registerOverviewSceneReady("),
    );
    const register = controller.slice(
      controller.indexOf("function registerOverviewSceneReady("),
      controller.indexOf("function unregisterOverviewSceneReady("),
    );
    const readinessContext = scene.slice(
      scene.indexOf("function sceneReadinessContext()"),
      scene.indexOf("function synchronizePresentationReadiness()"),
    );

    expect(readinessContext).toMatch(
      /effect\.active !== true[\s\S]*spatialPresentationPhase !== "preparing"/u,
    );
    expect(acknowledge).toMatch(
      /if \(!latchOpeningSceneActivation\(epoch, sessionId, openingReadinessModel,[\s\S]*openingReadinessTopologyGeneration\)\) \{[\s\S]*return false;[\s\S]*return completeOpeningReadinessIfExact\(\);/u,
    );
    expect(latch).toMatch(
      /openingReadinessContextIsExact\(epoch, sessionId, model, topologyGeneration\)[\s\S]*return false;[\s\S]*openingReadinessSceneActivated = true;[\s\S]*return true;/u,
    );
    expect(register).toMatch(
      /if \(!overviewZoomIdentifierIsValid\(outputId\)[\s\S]*\|\| !overviewZoomSceneTokenIsValid\(sceneToken\)[\s\S]*\|\| !latchOpeningSceneActivation\(epoch, sessionId, model,[\s\S]*topologyGeneration\)\) \{[\s\S]*return false;/u,
    );
    expect(register).toMatch(
      /registration\.outputId === outputId && registration\.sceneToken === sceneToken\) \{\s*completeOpeningReadinessIfExact\(\);\s*return true;/u,
    );
    expect(register).toMatch(
      /openingReadinessRegistrations = nextRegistrations;\s*completeOpeningReadinessIfExact\(\);\s*return true;/u,
    );
    expect(`${entrypoint}\n${controller}\n${scene}`).not.toMatch(
      /org\.kde\.kwin\.private|setInterval|setTimeout/u,
    );
  });

  it("accepts canonical rows without a tiled readiness context", () => {
    const contextIndex = scene.slice(
      scene.indexOf("function indexReadinessContextsForOutput("),
      scene.indexOf("function sceneReadinessContext()"),
    );
    const readinessContext = scene.slice(
      scene.indexOf("function sceneReadinessContext()"),
      scene.indexOf("function resetPresentationReadinessRegistration()"),
    );

    expect(contextIndex).toMatch(
      /indexedListHasBoundedLength\(model\.contexts, 0, 512\)[\s\S]*typeof expectedOutputId !== "string" \|\| expectedOutputId\.length === 0[\s\S]*model\.currentActivityId !== activeOverviewActivityId/u,
    );
    expect(contextIndex).toMatch(
      /for \(const context of model\.contexts\)[\s\S]*context\.activityId !== activeOverviewActivityId[\s\S]*context\.outputId\.length === 0[\s\S]*context\.desktopId\.length === 0/u,
    );
    expect(contextIndex).toMatch(
      /if \(context\.outputId !== expectedOutputId\) \{\s*continue;\s*\}/u,
    );
    expect(contextIndex).toMatch(
      /const desktopIndex = desktopIds\.indexOf\(context\.desktopId\);[\s\S]*desktopIds\.lastIndexOf\(context\.desktopId\) !== desktopIndex[\s\S]*contextsByDesktopId\[context\.desktopId\] !== undefined[\s\S]*return null;/u,
    );
    expect(contextIndex).toMatch(
      /contextsByDesktopId\[context\.desktopId\] = context;[\s\S]*return Object\.freeze\(contextsByDesktopId\);/u,
    );

    expect(readinessContext).toMatch(
      /effect\.active !== true[\s\S]*sessionId <= 0 \|\| epoch <= 0 \|\| topologyGeneration <= 0[\s\S]*!model \|\| effect\.overviewModel !== model/u,
    );
    expect(readinessContext).toMatch(
      /const contextsByDesktopId = indexReadinessContextsForOutput\(model, expectedOutputId\);[\s\S]*outputId !== expectedOutputId[\s\S]*contextsByDesktopId === null[\s\S]*outputMatches !== 1/u,
    );
    expect(readinessContext).toMatch(
      /for \(let index = 0; index < desktopIds\.length; index \+= 1\)[\s\S]*const context = contextsByDesktopId\[desktopId\];[\s\S]*context !== undefined[\s\S]*context\.outputId !== expectedOutputId \|\| context\.desktopId !== desktopId[\s\S]*!spatialHorizontalGeometryPlanAt\(index, desktopId,[\s\S]*spatialHorizontalViewportRevision\)[\s\S]*!Number\.isFinite\(spatialHorizontalViewportOffsets\[index\]\)/u,
    );
    expect(readinessContext).not.toMatch(/if \(\(!context \|\|/u);
    expect(`${controller}\n${scene}`).not.toMatch(
      /org\.kde\.kwin\.private|setInterval|setTimeout/u,
    );
  });
});
