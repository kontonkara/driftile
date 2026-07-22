import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);

function sourceBetween(start: string, end: string): string {
  const startIndex = desktopCard.indexOf(start);
  const endIndex = desktopCard.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return desktopCard.slice(startIndex, endIndex);
}

describe("overview desktop surface presentation", () => {
  const projectedSurface = sourceBetween(
    "id: projectedOutputSurface",
    "id: columnRepeater",
  );
  const surfaceLoader = sourceBetween(
    "id: desktopSurfaceLoader",
    "color: windowDropArea.validTarget",
  );

  it("keeps the solid fallback below the passive public surface", () => {
    const fallbackIndex = projectedSurface.indexOf('color: "#171e2a"');
    const loaderIndex = projectedSurface.indexOf("id: desktopSurfaceLoader");
    const tintIndex = projectedSurface.indexOf(
      "color: windowDropArea.validTarget",
    );

    expect(fallbackIndex).toBeGreaterThanOrEqual(0);
    expect(loaderIndex).toBeGreaterThan(fallbackIndex);
    expect(tintIndex).toBeGreaterThan(loaderIndex);
    expect(projectedSurface).toContain("z: -100");
    expect(surfaceLoader).toContain("enabled: false");
    expect(surfaceLoader).toContain("z: 0");
    expect(surfaceLoader).toContain("KWin.DesktopBackground {");
  });

  it("presents only a ready surface in the exact active context", () => {
    expect(surfaceLoader).toContain(
      "asynchronous: !card.desktopSurfaceOpeningCritical",
    );
    expect(surfaceLoader).toMatch(
      /active: card\.desktopSurfaceEnabled && card\.desktopSurfaceContextExact\s*&& card\.desktopSurfaceReloadContextExact && card\.desktopSurfaceReady\s*&& card\.desktopSurfaceReadyToken === card\.desktopSurfaceReloadToken/u,
    );
    expect(surfaceLoader).toMatch(
      /readonly property bool desktopSurfacePresented: desktopSurfaceLoader\.active\s*&& desktopSurfaceLoader\.status === Loader\.Ready\s*&& card\.desktopSurfaceEnabled && card\.desktopSurfaceContextExact\s*&& card\.desktopSurfaceReloadContextExact && card\.desktopSurfaceReady/u,
    );
    expect(surfaceLoader).toContain(
      "card.desktopSurfaceLoadedToken === card.desktopSurfaceReloadToken",
    );
    expect(surfaceLoader).toContain(
      "card.desktopSurfaceLoadedItemIsExact(desktopSurfaceLoader.item)",
    );
    expect(surfaceLoader).toContain("opacity: 0");
    expect(surfaceLoader).toContain("output: driftileScreen");
    expect(surfaceLoader).toContain("desktop: driftileDesktop");
    expect(surfaceLoader).toContain("activity: driftileActivityId");
    expect(surfaceLoader).toMatch(
      /property bool driftileContextCaptured: false[\s\S]*property int driftileContextGeneration: 0[\s\S]*property int driftileReloadToken: 0[\s\S]*property string driftileActivityId: ""[\s\S]*property var driftileDesktop: null[\s\S]*property string driftileDesktopId: ""[\s\S]*property var driftileScreen: null[\s\S]*property string driftileScreenName: ""[\s\S]*property string driftileOutputId: ""/u,
    );
    expect(surfaceLoader).toMatch(
      /KWin\.DesktopBackground \{[\s\S]*Component\.onCompleted: \{[\s\S]*if \(driftileContextCaptured\)[\s\S]*driftileContextGeneration = card\.desktopSurfaceReloadGeneration;[\s\S]*driftileReloadToken = card\.desktopSurfaceReadyToken;[\s\S]*driftileActivityId = card\.desktopSurfaceReloadActivityId;[\s\S]*driftileDesktop = card\.desktopSurfaceReloadDesktop;[\s\S]*driftileDesktopId = card\.desktopSurfaceReloadDesktopId;[\s\S]*driftileScreen = card\.desktopSurfaceReloadScreen;[\s\S]*driftileScreenName = card\.desktopSurfaceReloadScreenName;[\s\S]*driftileOutputId = card\.desktopSurfaceReloadOutputId;[\s\S]*driftileContextCaptured = true;/u,
    );
    expect(surfaceLoader).not.toMatch(
      /readonly property (?:int|string|var) driftile[A-Za-z]+:\s*card\./u,
    );
  });

  it("fades readiness in briefly and drops stale presentation immediately", () => {
    const durationMatch = surfaceLoader.match(/duration:\s*(\d+)/u);

    expect(surfaceLoader).toMatch(
      /property bool desktopSurfaceComponentComplete: false[\s\S]*Component\.onCompleted:[\s\S]*desktopSurfaceComponentComplete = true;[\s\S]*synchronizeDesktopSurfacePresentation\(\);/u,
    );
    expect(surfaceLoader).toContain(
      "onDesktopSurfacePresentedChanged: synchronizeDesktopSurfacePresentation()",
    );
    expect(surfaceLoader).toMatch(
      /onActiveChanged: \{[\s\S]*if \(!active\) \{[\s\S]*card\.rejectDesktopSurfaceLoad\(\);[\s\S]*synchronizeDesktopSurfacePresentation\(\);/u,
    );
    expect(surfaceLoader).toMatch(
      /onLoaded: acceptDesktopSurfaceCandidate\(desktopSurfaceLoader\.item\)/u,
    );
    expect(surfaceLoader).toMatch(
      /onStatusChanged: \{[\s\S]*status !== Loader\.Ready[\s\S]*card\.rejectDesktopSurfaceLoad\(\);[\s\S]*synchronizeDesktopSurfacePresentation\(\);/u,
    );
    expect(surfaceLoader).toMatch(
      /NumberAnimation \{[\s\S]*id: desktopSurfaceFadeIn[\s\S]*target: desktopSurfaceLoader[\s\S]*property: "opacity"[\s\S]*from: 0[\s\S]*to: 1/u,
    );
    expect(surfaceLoader).toMatch(
      /function synchronizeDesktopSurfacePresentation\(\)[\s\S]*if \(!desktopSurfaceComponentComplete \|\| !desktopSurfacePresented\)[\s\S]*desktopSurfaceFadeIn\.stop\(\);[\s\S]*opacity = 0;[\s\S]*desktopSurfaceFadeIn\.restart\(\);/u,
    );
    expect(surfaceLoader).toMatch(
      /function acceptDesktopSurfaceCandidate\(candidate\) \{[\s\S]*card\.acceptDesktopSurfaceLoad\(candidate\);[\s\S]*synchronizeDesktopSurfacePresentation\(\);/u,
    );
    expect(surfaceLoader).toMatch(
      /Component\.onCompleted: \{[\s\S]*driftileContextCaptured = true;[\s\S]*desktopSurfaceLoader\.acceptDesktopSurfaceCandidate\(desktopBackground\);/u,
    );
    expect(surfaceLoader).not.toContain("Behavior on opacity");
    expect(durationMatch).not.toBeNull();
    expect(Number(durationMatch?.[1])).toBeGreaterThanOrEqual(60);
    expect(Number(durationMatch?.[1])).toBeLessThanOrEqual(120);
    expect(surfaceLoader).toContain("easing.type: Easing.OutCubic");
    expect(surfaceLoader).not.toMatch(
      /\bTimer\s*\{|Qt\.callLater|setTimeout|setInterval/u,
    );
  });

  it("retains exact identity and targeted lifecycle recreation", () => {
    const identity = sourceBetween(
      "function desktopSurfaceContextIsExact()",
      "function collectNavigationTargets(",
    );
    const reload = sourceBetween(
      "function scheduleDesktopSurfaceReload()",
      "function desktopSurfaceLifecycleEventRevision(",
    );

    expect(identity).toContain(
      "for (const liveDesktop of KWin.Workspace.desktops)",
    );
    expect(identity).toContain("liveDesktop === desktop");
    expect(identity).toContain("desktopIdMatches !== 1");
    expect(identity).toContain(
      "for (const liveActivityId of KWin.Workspace.activities)",
    );
    expect(identity).toContain("activityMatches !== 1");
    expect(identity).toContain(
      "for (const liveScreen of KWin.Workspace.screens)",
    );
    expect(identity).toContain("return screenMatches === 1;");

    expect(reload).toMatch(
      /if \(plan\.targeted !== true\) \{\s*return false;/u,
    );
    expect(reload).toMatch(
      /expectation === null \|\| !Object\.isFrozen\(expectation\)[\s\S]*desktopSurfaceReady = false;[\s\S]*desktopSurfaceReadyToken = 0;[\s\S]*desktopSurfaceLoadedToken = 0;[\s\S]*applyDesktopSurfaceReloadExpectation\(expectation\)[\s\S]*Qt\.callLater\(card\.completeDesktopSurfaceReload,/u,
    );
    expect(reload).toMatch(
      /function completeDesktopSurfaceReload[\s\S]*token !== desktopSurfaceReloadToken[\s\S]*!desktopSurfaceReloadContextExact[\s\S]*desktopSurfaceReadyToken = token;[\s\S]*desktopSurfaceReady = true;/u,
    );
  });

  it("recreates surfaces behind an exact generation and context token", () => {
    const contextReload = sourceBetween(
      "function scheduleDesktopSurfaceContextReload()",
      "function desktopSurfaceReloadExpectation()",
    );
    const expectation = sourceBetween(
      "function desktopSurfaceReloadExpectation()",
      "function applyDesktopSurfaceReloadExpectation(",
    );
    const exactContext = sourceBetween(
      "function desktopSurfaceReloadContextIsExact()",
      "function desktopSurfaceLoadedItemIsExact(",
    );
    const loadedItem = sourceBetween(
      "function desktopSurfaceLoadedItemIsExact(",
      "function desktopSurfaceLifecycleEventRevision(",
    );
    const generationHandler = sourceBetween(
      "onOverviewContextGenerationChanged:",
      "Component.onCompleted:",
    );

    expect(desktopCard).toContain(
      "required property int overviewContextGeneration",
    );
    expect(desktopCard).toContain("property bool desktopSurfaceReady: false");
    for (const handler of [
      "onDesktopChanged:",
      "onDesktopIdChanged:",
      "onDesktopSurfaceActivityIdChanged: card.synchronizeDesktopSurfaceContext()",
      "onDesktopSurfaceContextExactChanged: card.synchronizeDesktopSurfaceContext()",
      "onDesktopSurfaceEnabledChanged: card.synchronizeDesktopSurfaceContext()",
      "onScreenChanged:",
      "onOutputIdChanged:",
      "onOverviewActivityIdChanged:",
      "onOverviewContextGenerationChanged:",
    ]) {
      expect(desktopCard).toContain(handler);
    }
    expect(desktopCard).toMatch(
      /Component\.onCompleted:\s*\{\s*card\.synchronizeDesktopSurfaceContext\(\);[\s\S]*card\.resetPresentationMotionAfterDrift\(\);/u,
    );
    expect(generationHandler).toMatch(
      /card\.synchronizeDesktopSurfaceContext\(\);[\s\S]*card\.cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(contextReload).toMatch(
      /desktopSurfaceReloadExpectation\(\);[\s\S]*expectation === null \|\| !Object\.isFrozen\(expectation\)[\s\S]*desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647\s*\? 1 : desktopSurfaceReloadToken \+ 1;[\s\S]*desktopSurfaceReady = false;[\s\S]*desktopSurfaceReadyToken = 0;[\s\S]*desktopSurfaceLoadedToken = 0;/u,
    );
    expect(contextReload).toMatch(
      /applyDesktopSurfaceReloadExpectation\(expectation\)[\s\S]*Qt\.callLater\(card\.completeDesktopSurfaceReload, token, reloadRevision\);/u,
    );
    expect(expectation).toMatch(
      /!desktopSurfaceContextExact[\s\S]*!Number\.isSafeInteger\(overviewContextGeneration\)[\s\S]*overviewContextGeneration <= 0[\s\S]*return null;/u,
    );
    expect(expectation).toMatch(
      /Object\.freeze\(\{[\s\S]*generation: overviewContextGeneration,[\s\S]*activityId: desktopSurfaceActivityId,[\s\S]*desktop,[\s\S]*desktopId,[\s\S]*screen,[\s\S]*screenName: String\(screen\.name\),[\s\S]*outputId/u,
    );
    for (const comparison of [
      "desktopSurfaceReloadGeneration === overviewContextGeneration",
      "desktopSurfaceReloadActivityId === desktopSurfaceActivityId",
      "desktopSurfaceReloadActivityId === overviewActivityId",
      "desktopSurfaceReloadDesktop === desktop",
      "desktopSurfaceReloadDesktopId === desktopId",
      "desktopSurfaceReloadScreen === screen",
      "desktopSurfaceReloadScreenName === String(screen.name)",
      "desktopSurfaceReloadOutputId === outputId",
    ]) {
      expect(exactContext).toContain(comparison);
    }
    expect(loadedItem).toMatch(
      /function desktopSurfaceLoadedItemIsExact[\s\S]*candidate\.driftileContextCaptured === true[\s\S]*candidate\.driftileReloadToken === desktopSurfaceReloadToken[\s\S]*candidate\.driftileContextGeneration === desktopSurfaceReloadGeneration[\s\S]*desktopSurfaceReloadContextExact/u,
    );
    expect(loadedItem).toMatch(
      /function acceptDesktopSurfaceLoad[\s\S]*desktopSurfaceReadyToken !== desktopSurfaceReloadToken[\s\S]*!desktopSurfaceLoadedItemIsExact\(candidate\)[\s\S]*return false;[\s\S]*desktopSurfaceLoadedToken = desktopSurfaceReloadToken;/u,
    );
    expect(
      loadedItem.slice(
        loadedItem.indexOf("function acceptDesktopSurfaceLoad("),
        loadedItem.indexOf(
          "desktopSurfaceLoadedToken = desktopSurfaceReloadToken;",
        ),
      ),
    ).not.toContain("desktopSurfaceLoadedToken = 0;");
  });

  it("recovers exact context and leaves newer loads intact after stale completion", () => {
    const synchronization = sourceBetween(
      "function synchronizeDesktopSurfaceContext()",
      "function desktopSurfaceReloadExpectation()",
    );
    const model = desktopSurfacePresentationModel();

    expect(synchronization).toMatch(
      /if \(!desktopSurfaceContextExact\) \{\s*return invalidateDesktopSurfaceContext\(\);/u,
    );
    expect(synchronization).toMatch(
      /desktopSurfaceContextInvalidated[\s\S]*desktopSurfaceReloadContextExact[\s\S]*return scheduleDesktopSurfaceContextReload\(\);/u,
    );
    expect(synchronization).toMatch(
      /function invalidateDesktopSurfaceContext\(\)[\s\S]*if \(desktopSurfaceContextInvalidated\)[\s\S]*desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647[\s\S]*desktopSurfaceContextInvalidated = true;[\s\S]*desktopSurfaceReadyToken = 0;[\s\S]*desktopSurfaceLoadedToken = 0;/u,
    );

    expect(model.synchronize(false)).toBeNull();
    expect(model.state.reloadToken).toBe(1);
    expect(model.synchronize(false)).toBeNull();
    expect(model.state.reloadToken).toBe(1);

    const staleToken = model.synchronize(true);
    expect(staleToken).toBe(2);
    expect(model.synchronize(true)).toBe(staleToken);
    expect(model.state.reloadToken).toBe(staleToken);
    expect(model.synchronize(false)).toBeNull();
    const currentToken = model.synchronize(true);
    expect(currentToken).toBe(4);

    expect(model.complete(staleToken ?? 0)).toBe(false);
    expect(model.complete(currentToken ?? 0)).toBe(true);
    expect(model.accept(staleToken ?? 0)).toBe(false);
    expect(model.accept(currentToken ?? 0)).toBe(true);
    expect(model.accept(staleToken ?? 0)).toBe(false);
    expect(model.state.loadedToken).toBe(currentToken);
  });

  it("adds no input owner, polling, private API, or state write", () => {
    expect(surfaceLoader).not.toMatch(
      /org\.kde\.kwin\.private|\b(?:MouseArea|TapHandler|DragHandler|HoverHandler|WheelHandler|PinchHandler|DropArea|Connections|Timer)\s*\{|repeat:\s*true|setInterval|setTimeout|\.setValue\s*\(/u,
    );
    expect(surfaceLoader).not.toMatch(
      /KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });
});

function desktopSurfacePresentationModel() {
  const state = {
    contextExact: false,
    contextInvalidated: false,
    loadedToken: 0,
    readyToken: 0,
    reloadContextExact: false,
    reloadToken: 0,
  };

  return {
    state,
    synchronize(exact: boolean): number | null {
      state.contextExact = exact;
      if (!exact) {
        if (state.contextInvalidated) {
          return null;
        }
        state.reloadToken += 1;
        state.contextInvalidated = true;
        state.reloadContextExact = false;
        state.readyToken = 0;
        state.loadedToken = 0;
        return null;
      }

      if (!state.contextInvalidated && state.reloadContextExact) {
        return state.reloadToken;
      }

      state.reloadToken += 1;
      state.contextInvalidated = false;
      state.reloadContextExact = true;
      state.readyToken = 0;
      state.loadedToken = 0;
      return state.reloadToken;
    },
    complete(token: number): boolean {
      if (!state.contextExact || token !== state.reloadToken) {
        return false;
      }
      state.readyToken = token;
      return true;
    },
    accept(token: number): boolean {
      if (token !== state.reloadToken || state.readyToken !== token) {
        return false;
      }
      state.loadedToken = token;
      return true;
    },
  };
}
