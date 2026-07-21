import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const handoff = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewExitHandoff.qml",
    import.meta.url,
  ),
  "utf8",
);

function sourceBetween(start: string, end: string): string {
  const startIndex = handoff.indexOf(start);
  const endIndex = handoff.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return handoff.slice(startIndex, endIndex);
}

describe("overview exit handoff scene", () => {
  it("separates captured preload ownership from exact promoted rendering", () => {
    for (const property of [
      "required property var handoff",
      "required property string handoffPhase",
      "required property var promotion",
      "required property var windowCandidate",
      "required property rect sourceRect",
      "required property rect targetOutputGeometry",
      "required property real progress",
      "required property bool handoffActive",
      "required property string activeOutput",
      "required property string capturedOutput",
    ]) {
      expect(handoff).toContain(property);
    }

    expect(handoff).not.toContain("required property string thumbnailSource");
    expect(handoff).not.toContain("required property rect targetRect");
    expect(handoff).not.toContain("required property string promotedOutput");
    expect(handoff).toMatch(
      /readonly property bool capturedOutputExact:[\s\S]*activeOutput === capturedOutput/u,
    );
    expect(handoff).toMatch(
      /readonly property bool promotedOutputExact:[\s\S]*promotedOutput === capturedOutput[\s\S]*activeOutput === promotedOutput/u,
    );
    expect(handoff).toMatch(
      /readonly property bool fallbackOutputExact: handoffPhase === "fallback"[\s\S]*capturedOutputExact/u,
    );
    expect(handoff).toContain(
      "readonly property bool resolvedOutputExact: promotedOutputExact || fallbackOutputExact",
    );
    expect(handoff).toContain("visible: handoffActive && capturedOutputExact");
    expect(handoff).toContain(
      "&& (preloadStagingVisible || (visualModeCommitted && resolvedOutputExact))",
    );
    expect(handoff).not.toMatch(/visible:.*boundedProgress < 1/u);
    expect(handoff).not.toMatch(
      /(?:handoff|promotion|windowCandidate)\.[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/u,
    );
  });

  it("preloads one public thumbnail while the captured scene stays hidden", () => {
    const preloadGuard = sourceBetween(
      "function preloadCandidateIsExact()",
      "function promotedCandidateIsExact()",
    );
    const windowShell = sourceBetween(
      "id: windowHandoffShell",
      "id: rowFallbackShell",
    );

    expect(handoff).toContain("import org.kde.kwin as KWin");
    expect(handoff).toContain("pragma ComponentBehavior: Bound");
    expect(handoff.match(/KWin\.WindowThumbnail\s*\{/gu)).toHaveLength(1);
    expect(preloadGuard).toContain('handoffPhase !== "captured"');
    expect(preloadGuard).toContain('handoffPhase !== "promoted"');
    expect(preloadGuard).toContain("!capturedOutputExact");
    expect(preloadGuard).toContain("windowCandidate.deleted !== true");
    expect(preloadGuard).toContain(
      "String(windowCandidate.internalId) === handoffWindowId",
    );
    expect(preloadGuard).not.toContain("promotionExact");
    expect(preloadGuard).not.toContain("windowCandidate.minimized");
    expect(windowShell).toMatch(
      /active: root\.handoffActive && root\.liveThumbnailEligible[\s\S]*!root\.visualModeCommitted \|\| root\.visualMode === "thumbnail"/u,
    );
    expect(windowShell).toContain("asynchronous: true");
    expect(windowShell).toContain("wId: root.handoffWindowId");
    expect(windowShell).toContain(
      "opacity: root.preloadStagingVisible ? 0.001 : root.windowOverlayOpacity",
    );
    expect(windowShell).toMatch(
      /visible: root\.preloadStagingVisible \|\| root\.visualMode === "thumbnail"/u,
    );
    expect(handoff).toMatch(
      /readonly property var liveThumbnailItem: liveThumbnailLoaderStatus === Loader\.Ready[\s\S]*exitThumbnailLoader\.item/u,
    );
  });

  it("owns promotion by immutable identity and exact public geometry", () => {
    const promotionGuard = sourceBetween(
      "function promotionMatchesHandoff()",
      "function validatedPromotedOutput()",
    );
    const candidateGuard = sourceBetween(
      "function promotedCandidateIsExact()",
      "function planInitialVisualMode()",
    );

    for (const identity of [
      "promotion.sessionId",
      "promotion.generation",
      "promotion.token",
      "promotion.sourceDesktopId",
      "promotion.sourceOutputId",
      "promotion.targetDesktopId",
      "promotion.targetOutputId",
      "promotion.targetKind",
      "promotion.targetWindowId",
    ]) {
      expect(promotionGuard).toContain(identity);
    }
    expect(promotionGuard).toContain('handoffPhase !== "promoted"');
    expect(promotionGuard).toContain("promotion.targetMinimized === false");
    expect(promotionGuard).toContain("frozenRecord(promotion)");
    expect(promotionGuard).toContain("return promotion === handoff");
    expect(promotionGuard).toContain("frozenRecord(promotion.camera)");
    expect(promotionGuard).toContain(
      "rectsEqual(promotion.sourceRect, handoff.sourceRect)",
    );
    expect(promotionGuard).toContain(
      "rectsEqual(promotion.targetFrame, handoff.targetFrame)",
    );
    expect(promotionGuard).toContain(
      "camerasEqual(promotion.camera, handoff.camera)",
    );
    expect(candidateGuard).toContain("!promotionExact");
    expect(candidateGuard).toContain("!promotedOutputExact");
    expect(candidateGuard).toContain("!preloadWindowCandidateExact");
    expect(candidateGuard).toContain("windowCandidate.minimized !== true");
    expect(candidateGuard).toContain(
      "rectsMatch(windowCandidate.frameGeometry, targetRect)",
    );
    expect(candidateGuard).not.toMatch(/x11|wayland|surfaceItem|windowItem/iu);
    expect(candidateGuard).not.toContain("windowCandidate.output");
  });

  it("commits one visual mode and permits downgrade-only fallback", () => {
    const initialPlanner = sourceBetween(
      "function planInitialVisualMode()",
      "function planDowngradedVisualMode(currentMode)",
    );
    const downgradePlanner = sourceBetween(
      "function planDowngradedVisualMode(currentMode)",
      "function resetCommittedVisualMode(nextHandoffKey)",
    );
    const synchronization = sourceBetween(
      "function synchronizeVisualMode()",
      "function updateCompletion()",
    );
    const reset = sourceBetween(
      "function resetCommittedVisualMode(nextHandoffKey)",
      "function commitVisualMode(nextMode)",
    );

    expect(handoff).toContain('property string committedHandoffKey: ""');
    expect(handoff).toContain('property string committedVisualMode: "none"');
    expect(handoff).toContain("property bool visualModeCommitted: false");
    expect(handoff).toContain(
      'readonly property string visualMode: visualModeCommitted\n        ? committedVisualMode : "none"',
    );
    expect(initialPlanner).toContain("synchronizePromotionResolution();");
    expect(initialPlanner).toMatch(
      /const promotionResolved = synchronizePromotionResolution\(\);[\s\S]*promotionResolved && preloadPromotionInheritedLatch[\s\S]*preloadLatchIsExact\(\)[\s\S]*\? "thumbnail" : ""/u,
    );
    expect(initialPlanner).toContain('return "row-fallback";');
    expect(downgradePlanner).toContain('if (currentMode === "row-fallback")');
    expect(downgradePlanner).toContain(
      'if (currentMode === "thumbnail" && !liveThumbnailReady)',
    );
    expect(downgradePlanner).toContain('return "monochrome";');
    expect(downgradePlanner).not.toMatch(/return\s+"thumbnail"/u);
    expect(synchronization).toMatch(
      /if \(!visualModeCommitted\) \{[\s\S]*planInitialVisualMode\(\)[\s\S]*commitVisualMode\(initialMode\)[\s\S]*return;[\s\S]*planDowngradedVisualMode\(committedVisualMode\)/u,
    );
    expect(reset).toContain("committedHandoffKey = nextHandoffKey;");
    expect(reset).toContain('committedVisualMode = "none";');
    expect(reset).toContain("visualModeCommitted = false;");
    expect(reset).toContain("completionReported = false;");
    expect(handoff).toContain(
      "onLiveThumbnailReadyChanged: handlePreloadIdentityChange()",
    );
    expect(handoff).toContain(
      "onExactWindowCandidateChanged: synchronizeVisualMode()",
    );
  });

  it("stages an exact thumbnail for two rendered frames before one bounded decision", () => {
    const advance = sourceBetween(
      "function advancePreloadFrame()",
      "function planInitialVisualMode()",
    );
    const identity = sourceBetween(
      "function preloadIdentityIsUsable()",
      "function advancePreloadFrame()",
    );

    expect(handoff).toContain(
      "readonly property bool preloadStagingVisible: handoffActive",
    );
    expect(handoff).toMatch(
      /preloadStagingVisible:[\s\S]*!visualModeCommitted[\s\S]*capturedOutputExact[\s\S]*handoffPhase === "captured"[\s\S]*handoffPhase === "promoted"[\s\S]*preloadWindowCandidateExact/u,
    );
    expect(handoff).toMatch(
      /FrameAnimation \{\s*running: root\.preloadStagingVisible\s*onTriggered: root\.advancePreloadFrame\(\)/u,
    );
    for (const exactIdentity of [
      "preloadTrackedHandoffKey === handoffKey",
      "preloadTrackedOutput === capturedOutput",
      "preloadTrackedCandidate === windowCandidate",
      "rectsEqual(preloadTrackedSourceRect, sourceRect)",
      "preloadTrackedLoaderActive === exitThumbnailLoader.active",
      "preloadTrackedLoaderStatus === liveThumbnailLoaderStatus",
      "preloadTrackedLoaderItem === liveThumbnailItem",
    ]) {
      expect(identity).toContain(exactIdentity);
    }
    expect(advance).toContain(
      "const promotionResolved = synchronizePromotionResolution();",
    );
    expect(advance).toContain(
      "preloadReadyFrameCount = Math.min(2, preloadReadyFrameCount + 1);",
    );
    expect(advance).toContain(
      "preloadPromotedFrameCount = Math.min(2, preloadPromotedFrameCount + 1);",
    );
    expect(advance).toContain("if (preloadPromotedFrameCount < 2");
    expect(advance).toMatch(
      /const nextMode = !promotionResolved \? "row-fallback"[\s\S]*liveThumbnailReady && preloadIdentityIsTracked\(\)[\s\S]*\? "thumbnail" : "monochrome";[\s\S]*return commitVisualMode\(nextMode\);/u,
    );
    expect(handoff).not.toMatch(/Qt\.callLater|\bTimer\s*\{/u);
  });

  it("uses controller easing once and has exact terminal opacity", () => {
    expect(handoff).toContain(
      "readonly property real boundedProgress: boundedUnit(progress)",
    );
    expect(handoff).not.toContain("easedProgress");
    expect(handoff).not.toContain("smoothstep");
    expect(handoff).toContain(
      "readonly property rect animatedRect: interpolatedRect(safeSourceRect, localTargetRect,",
    );
    expect(handoff).toMatch(/localTargetRect,\s*boundedProgress\)/u);
    expect(handoff).toContain(
      "readonly property real surfaceOpacity: 1 - boundedProgress",
    );
    expect(handoff).toContain(
      "readonly property real chromeOpacity: surfaceOpacity",
    );
    expect(handoff).toContain(
      "readonly property real revealOpacity: boundedUnit(boundedProgress / 0.16)",
    );
    expect(handoff).toContain(
      "readonly property real thumbnailOpacity: revealOpacity",
    );
    expect(handoff).toContain(
      "readonly property real fallbackOpacity: revealOpacity * surfaceOpacity",
    );
    expect(handoff).toContain(
      "readonly property real rowFallbackScale: 1 - 0.06 * boundedProgress",
    );

    const opacityAt = (
      mode: "monochrome" | "row-fallback" | "thumbnail",
      progress: number,
    ) => {
      const bounded = Math.max(0, Math.min(1, progress));
      const reveal = Math.max(0, Math.min(1, bounded / 0.16));
      return mode === "thumbnail" ? reveal : reveal * (1 - bounded);
    };
    expect(opacityAt("thumbnail", 0)).toBe(0);
    expect(opacityAt("thumbnail", 1)).toBe(1);
    expect(opacityAt("monochrome", 0)).toBe(0);
    expect(opacityAt("monochrome", 1)).toBe(0);
    expect(opacityAt("row-fallback", 0)).toBe(0);
    expect(opacityAt("row-fallback", 1)).toBe(0);
  });

  it("reports completion only once from the resolved owner", () => {
    const completion = sourceBetween(
      "function updateCompletion()",
      "onHandoffKeyChanged: handlePreloadIdentityChange()",
    );

    expect(handoff).toContain(
      "signal handoffCompleted(var immutableHandoff, string visualMode)",
    );
    expect(completion).toContain("completionReported");
    expect(completion).toContain("!handoffActive");
    expect(completion).toContain("!visualModeCommitted");
    expect(completion).toContain("!resolvedOutputExact");
    expect(completion).toContain("boundedProgress < 1");
    expect(completion).toContain("completionReported = true;");
    expect(completion).toContain("handoffCompleted(handoff, visualMode);");
    expect(handoff).toContain("onBoundedProgressChanged: updateCompletion()");
    expect(handoff).toContain(
      "onResolvedOutputExactChanged: updateCompletion()",
    );
  });

  it("converts the frozen global target into SceneView-local coordinates", () => {
    const conversion = sourceBetween(
      "function rectForOutput(globalRect, outputGeometry)",
      "function interpolatedRect(first, second, amount)",
    );

    expect(conversion).toContain(
      "finiteNumber(globalRect.x) - finiteNumber(outputGeometry.x)",
    );
    expect(conversion).toContain(
      "finiteNumber(globalRect.y) - finiteNumber(outputGeometry.y)",
    );
    expect(conversion).toContain("finiteNumber(globalRect.width)");
    expect(conversion).toContain("finiteNumber(globalRect.height)");
    expect(conversion).not.toMatch(/Math\.(?:abs|max|min)/u);

    const localize = (
      target: { x: number; y: number },
      output: { x: number; y: number },
    ) => ({ x: target.x - output.x, y: target.y - output.y });
    expect(localize({ x: 2048, y: 320 }, { x: 1920, y: 180 })).toEqual({
      x: 128,
      y: 140,
    });
    expect(localize({ x: -1800, y: -840 }, { x: -1920, y: -1080 })).toEqual({
      x: 120,
      y: 240,
    });
  });

  it("remains passive and uses no geometry mutation or private API", () => {
    expect(handoff).toContain("enabled: false");
    expect(handoff).not.toContain("org.kde.kwin.private");
    expect(handoff).not.toMatch(
      /MouseArea|(?:Tap|Drag|Pinch|Swipe|Wheel|Hover)Handler|Keys\.|focus\s*:|acceptedButtons/u,
    );
    expect(handoff).not.toMatch(
      /\b(?:Timer|Animation|Behavior)\b|Qt\.callLater|setTimeout|callDBus|DBusCall|\.setValue\s*\(/u,
    );
    expect(handoff).not.toMatch(
      /windowCandidate\.(?:frameGeometry|geometry|output|minimized|desktops)\s*=(?!=)/u,
    );
    expect(handoff).not.toMatch(
      /KWin\.Workspace\.[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)|effect\.(?:activate|deactivate)\s*\(/u,
    );
  });
});
