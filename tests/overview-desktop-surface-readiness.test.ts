import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);
const scene = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewScene.qml",
    import.meta.url,
  ),
  "utf8",
);

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const remainder = source.slice(start + name.length + 10);
  const nextOffset = remainder.search(/\n\s*function\s+[A-Za-z]/u);
  return source.slice(
    start,
    nextOffset >= 0 ? start + name.length + 10 + nextOffset : source.length,
  );
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("overview desktop surface opening readiness", () => {
  const projectedSurface = sourceBetween(
    desktopCard,
    "id: projectedOutputSurface",
    "id: columnRepeater",
  );
  const surfaceLoader = sourceBetween(
    desktopCard,
    "id: desktopSurfaceLoader",
    "color: windowDropArea.validTarget",
  );
  const openingReadiness = sourceBetween(
    scene,
    "function sceneReadinessContext()",
    "function sceneRetirementFrameContext()",
  );
  const presentationCanvas = sourceBetween(
    scene,
    "id: spatialCanvas",
    "id: desktopRepeater",
  );

  it("holds the native desktop until the exact current surface is ready", () => {
    expect(surfaceLoader).toMatch(
      /asynchronous:\s*!card\.desktopSurfaceOpeningCritical/u,
    );
    expect(desktopCard).toMatch(
      /readonly property bool desktopSurfacePresented:\s*desktopSurfaceLoader\.desktopSurfacePresented\s*&& desktopSurfaceLoader\.opacity >= 1/u,
    );
    expect(desktopCard).toMatch(
      /readonly property string desktopSurfaceOpeningDisposition:\s*desktopSurfacePresented\s*\? "ready"\s*:\s*desktopSurfaceFallbackTerminal\s*\? "fallback"\s*:\s*"pending"/u,
    );
    expect(openingReadiness).toContain(
      "desktopRepeater.itemAt(currentWorkspaceIndex)",
    );
    expect(openingReadiness).toContain(
      "const desktopCardEpoch = overviewDesktopCardEpoch",
    );
    expect(openingReadiness).toContain("currentCardLoader.active !== true");
    expect(openingReadiness).toContain(
      "currentCard.overviewSessionId !== sessionId",
    );
    expect(openingReadiness).toContain(
      "currentCard.overviewContextGeneration !== topologyGeneration",
    );
    expect(openingReadiness).toContain(
      "currentCard.overviewActivityId !== activeOverviewActivityId",
    );
    expect(openingReadiness).toContain(
      "currentCard.outputId !== expectedOutputId",
    );
    expect(openingReadiness).toContain(
      "currentCard.desktopSurfaceOpeningCritical !== true",
    );
    expect(openingReadiness).toContain("desktopSurfaceOpeningDisposition");
    expect(openingReadiness).toMatch(
      /desktopSurfaceOpeningDisposition[\s\S]*"pending"[\s\S]*return null;/u,
    );
    expect(openingReadiness).toMatch(
      /const desktopSurfaceToken = currentCard\.desktopSurfaceReloadToken;[\s\S]*!Number\.isInteger\(desktopSurfaceToken\) \|\| desktopSurfaceToken <= 0[\s\S]*return null;/u,
    );
    expect(presentationCanvas).toMatch(
      /opacity:[\s\S]*root\.spatialPresentationPhase === "preparing"[\s\S]*\|\|\s*root\.spatialPresentationPhase === "opening"[\s\S]*\|\|\s*root\.spatialPresentationPhase === "closing"\s*\? 1\s*:\s*root\.spatialPresentationProgress/u,
    );
  });

  it("bootstraps the exact preparing row before deferred residency settles", () => {
    const openingCritical = functionSource(
      scene,
      "desktopSurfaceOpeningCritical",
    );
    const cardLoad = functionSource(scene, "desktopCardShouldLoad");
    const surfaceLoad = functionSource(scene, "desktopSurfaceShouldLoad");

    expect(openingCritical).toMatch(
      /spatialPresentationPhase\s*(?:===|!==)\s*"preparing"/u,
    );
    expect(openingCritical).toContain("spatialPresentationProgress");
    expect(openingCritical).toContain("activeOverviewSessionId");
    expect(openingCritical).toContain("overviewContextModelExact");
    expect(openingCritical).toContain("currentWorkspaceIndex");
    expect(openingCritical).toContain("desktopIds[index]");
    expect(openingCritical).toContain("currentDesktop");
    expect(openingCritical).toContain("expectedDesktop");
    expect(openingCritical).toContain("outputId");
    expect(openingCritical).toContain("targetScreen");

    for (const bootstrap of [cardLoad, surfaceLoad]) {
      const criticalIndex = bootstrap.indexOf("desktopSurfaceOpeningCritical(");
      const residencyIndex = bootstrap.indexOf(
        "desktopSurfaceResidencyContextMatchesCurrent()",
      );
      expect(criticalIndex).toBeGreaterThanOrEqual(0);
      expect(residencyIndex).toBeGreaterThan(criticalIndex);
    }

    expect(desktopCard).toContain(
      "required property bool desktopSurfaceOpeningCritical",
    );
    expect(scene).toMatch(
      /DesktopCard\s*\{[\s\S]*desktopSurfaceOpeningCritical:\s*root\.desktopSurfaceOpeningCritical\(/u,
    );
  });

  it("fences publication to the exact resident current row", () => {
    const residencyGuard = openingReadiness.match(
      /!desktopSurfaceResidencyContextMatchesCurrent\(\)[\s\S]*!spatialVisibleRangeIsValid\(desktopSurfaceResidencyRange\)[\s\S]*currentWorkspaceIndex < desktopSurfaceResidencyRange\.firstIndex[\s\S]*currentWorkspaceIndex > desktopSurfaceResidencyRange\.lastIndex/u,
    );
    const residencyGuardIndex = residencyGuard?.index ?? -1;
    const currentCardFenceIndex = openingReadiness.indexOf(
      "desktopRepeater.itemAt(currentWorkspaceIndex)",
    );

    expect(residencyGuard).not.toBeNull();
    expect(residencyGuardIndex).toBeGreaterThanOrEqual(0);
    expect(currentCardFenceIndex).toBeGreaterThan(residencyGuardIndex);
  });

  it("presents only the critical opening surface synchronously", () => {
    const presentation = functionSource(
      desktopCard,
      "synchronizeDesktopSurfacePresentation",
    );
    const contextReload = functionSource(
      desktopCard,
      "scheduleDesktopSurfaceContextReload",
    );
    const ordinaryReload = functionSource(
      desktopCard,
      "scheduleDesktopSurfaceReload",
    );
    const criticalPresentation = presentation.match(
      /if\s*\(card\.desktopSurfaceOpeningCritical\)\s*\{([\s\S]*?)\n\s*\}/u,
    );

    expect(surfaceLoader).toMatch(
      /asynchronous:\s*!card\.desktopSurfaceOpeningCritical/u,
    );
    expect(criticalPresentation).not.toBeNull();
    expect(criticalPresentation?.[1]).toContain("desktopSurfaceFadeIn.stop()");
    expect(criticalPresentation?.[1]).toMatch(/opacity\s*=\s*1/u);
    expect(criticalPresentation?.[1]).toContain("return true");

    const criticalCompletion = contextReload.indexOf(
      "if (desktopSurfaceOpeningCritical)",
    );
    const immediateCompletion = contextReload.indexOf(
      "completeDesktopSurfaceReload(",
      criticalCompletion,
    );
    const deferredCompletion = contextReload.indexOf(
      "Qt.callLater(card.completeDesktopSurfaceReload",
    );
    expect(criticalCompletion).toBeGreaterThanOrEqual(0);
    expect(immediateCompletion).toBeGreaterThan(criticalCompletion);
    expect(deferredCompletion).toBeGreaterThan(immediateCompletion);
    expect(ordinaryReload).toContain(
      "Qt.callLater(card.completeDesktopSurfaceReload",
    );
  });

  it("keeps ordinary surfaces asynchronous and faded", () => {
    const presentation = functionSource(
      desktopCard,
      "synchronizeDesktopSurfacePresentation",
    );
    const criticalBranch = presentation.indexOf(
      "if (card.desktopSurfaceOpeningCritical)",
    );
    const ordinaryReset = presentation.indexOf("opacity = 0", criticalBranch);
    const ordinaryFade = presentation.indexOf(
      "desktopSurfaceFadeIn.restart()",
      criticalBranch,
    );

    expect(surfaceLoader).toMatch(
      /asynchronous:\s*!card\.desktopSurfaceOpeningCritical/u,
    );
    expect(surfaceLoader).toMatch(
      /NumberAnimation\s*\{[\s\S]*target:\s*desktopSurfaceLoader[\s\S]*from:\s*0[\s\S]*to:\s*1[\s\S]*duration:\s*90/u,
    );
    expect(criticalBranch).toBeGreaterThanOrEqual(0);
    expect(ordinaryReset).toBeGreaterThan(criticalBranch);
    expect(ordinaryFade).toBeGreaterThan(ordinaryReset);
  });

  it("uses the solid fallback only after a terminal surface failure", () => {
    const fallbackMatch = surfaceLoader.match(
      /readonly property bool desktopSurfaceFallbackTerminal:([\s\S]*?)\n\s*anchors\.fill:/u,
    );
    const fallbackDeclaration = fallbackMatch?.[1] ?? "";

    expect(projectedSurface).toContain('color: "#171e2a"');
    expect(desktopCard).toMatch(
      /readonly property bool desktopSurfaceFallbackTerminal:\s*desktopSurfaceLoader\.desktopSurfaceFallbackTerminal/u,
    );
    expect(fallbackMatch).not.toBeNull();
    expect(fallbackDeclaration).toContain("status === Loader.Error");
    expect(fallbackDeclaration).toContain("card.desktopSurfaceEnabled");
    expect(fallbackDeclaration).toContain("card.desktopSurfaceContextExact");
    expect(fallbackDeclaration).toContain(
      "card.desktopSurfaceReloadContextExact",
    );
    expect(fallbackDeclaration).not.toMatch(/Loader\.(?:Null|Loading)/u);
  });

  it("reloads surfaces for each exact overview session", () => {
    expect(desktopCard).toContain(
      "property int desktopSurfaceReloadSessionId: 0",
    );
    expect(desktopCard).toContain("sessionId: overviewSessionId");
    expect(desktopCard).toContain(
      "desktopSurfaceReloadSessionId === overviewSessionId",
    );
    expect(desktopCard).toContain(
      "candidate.driftileSessionId === desktopSurfaceReloadSessionId",
    );
    expect(desktopCard).toMatch(
      /onOverviewSessionIdChanged:\s*\{[\s\S]*synchronizeDesktopSurfaceContext\(\);[\s\S]*\}/u,
    );
  });

  it("does not turn async readiness into a timing heuristic", () => {
    expect(`${surfaceLoader}\n${openingReadiness}`).not.toMatch(
      /\bTimer\s*\{|setTimeout|setInterval/u,
    );
    expect(openingReadiness).not.toMatch(/Qt\.callLater/u);
  });

  it("publishes an exact composed frame before starting the entry transition", () => {
    const frameGate = Array.from(
      scene.matchAll(/FrameAnimation\s*\{([\s\S]*?)\n\s*\}/gu),
    ).find((match) =>
      match[1]?.includes("spatialPresentationReadinessContext"),
    );
    expect(frameGate).toBeDefined();

    const gateBody = frameGate?.[1] ?? "";
    const advanceName = gateBody.match(
      /onTriggered:\s*root\.([A-Za-z][A-Za-z0-9_]*)\(\)/u,
    )?.[1];
    expect(advanceName).toBeDefined();

    const advance = functionSource(scene, advanceName ?? "");
    const synchronizeIndex = advance.indexOf(
      "synchronizePresentationReadiness()",
    );
    const registrationIndex = advance.indexOf("registerOverviewSceneReady(");
    const renderedFrameCheckpoint = advance.match(
      /([A-Za-z][A-Za-z0-9_]*)\s*\+=\s*1;[\s\S]*?if\s*\(\s*\1\s*!==\s*2\s*\)\s*\{\s*return true;/u,
    );
    const resetTracking = functionSource(
      scene,
      "resetPresentationReadinessFrameTracking",
    );
    const trackingMatches = functionSource(
      scene,
      "presentationReadinessFrameTrackingMatches",
    );
    const readinessResult = openingReadiness.match(
      /return\s*\{([\s\S]*?)\n\s*\};/u,
    )?.[1];

    expect(gateBody).toMatch(
      /running:[\s\S]*spatialPresentationReadinessContext\s*!==\s*null/u,
    );
    expect(advance).toMatch(
      /const context = (?:root\.)?(?:spatialPresentationReadinessContext|sceneReadinessContext\(\))/u,
    );
    expect(renderedFrameCheckpoint).not.toBeNull();
    expect(synchronizeIndex).toBeGreaterThanOrEqual(0);
    expect(registrationIndex).toBeGreaterThan(
      (renderedFrameCheckpoint?.index ?? Number.MAX_SAFE_INTEGER) +
        (renderedFrameCheckpoint?.[0].length ?? 0),
    );
    expect(registrationIndex).toBeGreaterThan(synchronizeIndex);

    const synchronize = functionSource(
      scene,
      "synchronizePresentationReadiness",
    );
    const registrationIdentity = sourceBetween(
      synchronize,
      "const registrationMatches =",
      "if (registered && !registrationMatches)",
    );
    const retainedRegistration = sourceBetween(
      synchronize,
      "if (registrationMatches)",
      "if (!presentationReadinessFrameTrackingMatches(context))",
    );
    const driftBranch = synchronize.indexOf(
      "if (!presentationReadinessFrameTrackingMatches(context))",
    );
    const driftReset = synchronize.indexOf(
      "resetPresentationReadinessFrameTracking()",
      driftBranch,
    );
    const retrackEpoch = synchronize.indexOf(
      "spatialPresentationReadinessTrackedDesktopCardEpoch = context.desktopCardEpoch",
      driftBranch,
    );

    expect(readinessResult).toBeDefined();
    for (const field of [
      "desktopCardEpoch",
      "desktopSurfaceDisposition",
      "desktopSurfaceToken",
      "epoch",
      "model",
      "outputId",
      "sessionId",
      "topologyGeneration",
    ]) {
      expect(readinessResult).toMatch(new RegExp(`\\b${field}\\b`, "u"));
    }
    expect(scene).toMatch(
      /property int spatialPresentationReadinessTrackedDesktopCardEpoch:\s*(?:-1|0)/u,
    );
    expect(scene).toContain(
      'property string spatialPresentationReadinessTrackedDesktopSurfaceDisposition: ""',
    );
    expect(scene).toContain(
      "property int spatialPresentationReadinessTrackedDesktopSurfaceToken: 0",
    );
    expect(resetTracking).toMatch(
      /spatialPresentationReadinessTrackedDesktopCardEpoch\s*=\s*(?:-1|0)/u,
    );
    expect(resetTracking).toContain(
      'spatialPresentationReadinessTrackedDesktopSurfaceDisposition = ""',
    );
    expect(resetTracking).toContain(
      "spatialPresentationReadinessTrackedDesktopSurfaceToken = 0",
    );
    expect(trackingMatches).toContain(
      "spatialPresentationReadinessTrackedDesktopCardEpoch === context.desktopCardEpoch",
    );
    expect(trackingMatches).toMatch(
      /spatialPresentationReadinessTrackedDesktopSurfaceDisposition\s*=== context\.desktopSurfaceDisposition/u,
    );
    expect(trackingMatches).toMatch(
      /spatialPresentationReadinessTrackedDesktopSurfaceToken\s*=== context\.desktopSurfaceToken/u,
    );
    expect(driftBranch).toBeGreaterThanOrEqual(0);
    expect(driftReset).toBeGreaterThan(driftBranch);
    expect(retrackEpoch).toBeGreaterThan(driftReset);
    expect(synchronize).toMatch(
      /spatialPresentationReadinessTrackedDesktopSurfaceDisposition\s*=\s*context\.desktopSurfaceDisposition;/u,
    );
    expect(synchronize).toMatch(
      /spatialPresentationReadinessTrackedDesktopSurfaceToken\s*=\s*context\.desktopSurfaceToken;/u,
    );
    expect(registrationIdentity).toContain(
      "presentationReadinessFrameTrackingMatches(context)",
    );
    expect(synchronize).toMatch(
      /let context = spatialPresentationReadinessContext;[\s\S]*if \(registered && !registrationMatches\) \{\s*unregisterPresentationReadiness\(false\);\s*context = spatialPresentationReadinessContext;\s*\}[\s\S]*if \(!context\)/u,
    );
    expect(retainedRegistration).toMatch(
      /if \(registrationMatches\) \{\s*return true;\s*\}/u,
    );
    expect(retainedRegistration).not.toContain(
      "resetPresentationReadinessFrameTracking()",
    );

    const acceptedRegistration = advance.slice(registrationIndex);
    expect(acceptedRegistration).toMatch(
      /if \(!accepted\) \{\s*resetPresentationReadinessRegistration\(\);\s*resetPresentationReadinessFrameTracking\(\);\s*return false;\s*\}/u,
    );
    expect(acceptedRegistration).toMatch(
      /const currentContext = spatialPresentationReadinessContext;[\s\S]*const stillPreparing = spatialPresentationPhase === "preparing"[\s\S]*presentationReadinessEpoch === context\.epoch[\s\S]*presentationReadinessFrameTrackingMatches\(currentContext\);/u,
    );
    expect(acceptedRegistration).toMatch(
      /if \(!stillPreparing\) \{\s*unregisterPresentationReadiness\(false\);\s*\}\s*return accepted;/u,
    );
    expect(acceptedRegistration).not.toMatch(
      /\}\s*resetPresentationReadinessFrameTracking\(\);\s*return accepted;/u,
    );
    expect(synchronize).not.toContain("registerOverviewSceneReady(");
    expect(`${gateBody}\n${advance}`).not.toMatch(
      /\bTimer\s*\{|Qt\.callLater|setTimeout|setInterval/u,
    );
  });
});
