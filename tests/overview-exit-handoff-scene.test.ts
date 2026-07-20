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
  it("exposes one immutable externally-driven handoff contract", () => {
    for (const property of [
      "required property var handoff",
      "required property var windowCandidate",
      "required property string thumbnailSource",
      "required property rect sourceRect",
      "required property rect targetRect",
      "required property rect targetOutputGeometry",
      "required property real progress",
      "required property bool handoffActive",
      "required property string activeOutput",
      "required property string promotedOutput",
    ]) {
      expect(handoff).toContain(property);
    }

    expect(handoff).toContain(
      "signal handoffCompleted(var immutableHandoff, string visualMode)",
    );
    expect(handoff).toContain(
      "readonly property string expectedOutput: promotedOutput",
    );
    expect(handoff).toContain(
      "readonly property bool outputPromoted: activeOutput.length > 0",
    );
    expect(handoff).toContain("activeOutput === expectedOutput");
    expect(handoff).toContain(
      "readonly property real boundedProgress: boundedUnit(progress)",
    );
    expect(handoff).toContain("onBoundedProgressChanged: updateCompletion()");
    expect(handoff).toContain("handoffCompleted(handoff, visualMode)");
    expect(handoff).not.toMatch(
      /(?:handoff|windowCandidate)\.[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/u,
    );
  });

  it("morphs one exact public thumbnail toward the frozen frame", () => {
    const candidateGuard = sourceBetween(
      "function windowCandidateIsExact()",
      "function plannedFallbackReason()",
    );
    const windowShell = sourceBetween(
      "id: windowHandoffShell",
      "id: rowFallbackShell",
    );

    expect(handoff).toContain("import org.kde.kwin as KWin");
    expect(handoff).toContain("pragma ComponentBehavior: Bound");
    expect(handoff.match(/KWin\.WindowThumbnail\s*\{/gu)).toHaveLength(1);
    expect(windowShell).toContain(
      "active: root.handoffActive && root.liveThumbnailEligible",
    );
    expect(windowShell).toContain("wId: root.thumbnailSource");
    expect(handoff).toContain(
      "readonly property rect localTargetRect: rectForOutput(targetRect, targetOutputGeometry)",
    );
    expect(handoff).toContain(
      "readonly property rect animatedRect: interpolatedRect(safeSourceRect, localTargetRect,",
    );
    expect(handoff).toContain(
      "+ (finiteNumber(second.x) - finiteNumber(first.x)) * bounded",
    );
    expect(handoff).toContain(
      "+ (finiteNumber(second.width) - finiteNumber(first.width)) * bounded",
    );
    for (const exactGuard of [
      'handoffKind !== "window"',
      "handoffWindowId.length === 0",
      "!rectIsUsable(sourceRect)",
      "!rectIsUsable(targetRect)",
      "!rectIsUsable(targetOutputGeometry)",
      "!outputPromoted",
      "!objectAvailable(windowCandidate)",
      "windowCandidate.deleted === true",
      "windowCandidate.minimized === true",
      "String(windowCandidate.internalId) !== handoffWindowId",
      "!rectsMatch(windowCandidate.frameGeometry, targetRect)",
    ]) {
      expect(candidateGuard).toContain(exactGuard);
    }
    expect(candidateGuard).not.toMatch(/x11|wayland|surfaceItem|windowItem/iu);
    expect(candidateGuard).not.toContain("windowCandidate.output");
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
      output: {
        x: number;
        y: number;
      },
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

  it("uses monochrome and row-scale fallbacks without stale thumbnails", () => {
    const fallbackPlanner = sourceBetween(
      "function plannedFallbackReason()",
      "function updateCompletion()",
    );
    const windowShell = sourceBetween(
      "id: windowHandoffShell",
      "id: rowFallbackShell",
    );
    const rowShell = handoff.slice(handoff.indexOf("id: rowFallbackShell"));

    expect(handoff).toContain(
      '? "thumbnail" : exactWindowCandidate ? "monochrome" : "row-fallback"',
    );
    for (const reason of [
      'return "desktop";',
      'return "stale-handoff";',
      'return "stale-geometry";',
      'return "missing-candidate";',
      'return "deleted-candidate";',
      'return "minimized-candidate";',
      'return "stale-window";',
      'return "stale-output";',
      'return "stale-frame";',
      'return "stale-candidate";',
      '"missing-thumbnail-source"',
    ]) {
      expect(fallbackPlanner).toContain(reason);
    }
    expect(windowShell).toContain('color: "#202936"');
    expect(rowShell).toContain('visible: root.visualMode === "row-fallback"');
    expect(rowShell).toContain("opacity: root.rowFallbackOpacity");
    expect(rowShell).toContain("scale: root.rowFallbackScale");
    expect(rowShell).toContain("transformOrigin: Item.Center");
    expect(handoff).toContain(
      "readonly property real chromeOpacity: 1 - boundedUnit(boundedProgress / 0.45)",
    );
    expect(handoff).toContain(
      "readonly property real surfaceOpacity: 1 - easedProgress",
    );
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
