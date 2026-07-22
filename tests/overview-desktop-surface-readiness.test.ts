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

  it("holds the native desktop until the current async surface is ready", () => {
    expect(surfaceLoader).toContain("asynchronous: true");
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
    expect(openingReadiness).toContain("desktopSurfaceOpeningDisposition");
    expect(openingReadiness).toMatch(
      /desktopSurfaceOpeningDisposition[\s\S]*"pending"[\s\S]*return null;/u,
    );
    expect(presentationCanvas).toMatch(
      /spatialPresentationPhase === "closing" \? 1\s*:\s*root\.spatialPresentationProgress/u,
    );
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
});
