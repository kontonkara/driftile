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
    expect(surfaceLoader).toMatch(
      /active: card\.desktopSurfaceEnabled && card\.desktopSurfaceContextExact\s*&& card\.desktopSurfaceReady/u,
    );
    expect(surfaceLoader).toMatch(
      /readonly property bool desktopSurfacePresented: desktopSurfaceLoader\.active\s*&& desktopSurfaceLoader\.status === Loader\.Ready\s*&& card\.desktopSurfaceEnabled && card\.desktopSurfaceContextExact\s*&& card\.desktopSurfaceReady/u,
    );
    expect(surfaceLoader).toContain("opacity: 0");
    expect(surfaceLoader).toContain("output: card.screen");
    expect(surfaceLoader).toContain("desktop: card.desktop");
    expect(surfaceLoader).toContain(
      "activity: card.desktopSurfaceActivityBindingId",
    );
  });

  it("fades readiness in briefly and drops stale presentation immediately", () => {
    const durationMatch = surfaceLoader.match(/duration:\s*(\d+)/u);

    expect(surfaceLoader).toMatch(
      /property bool desktopSurfaceComponentComplete: false[\s\S]*Component\.onCompleted:[\s\S]*desktopSurfaceComponentComplete = true;[\s\S]*synchronizeDesktopSurfacePresentation\(\);/u,
    );
    for (const handler of [
      "onActiveChanged: synchronizeDesktopSurfacePresentation()",
      "onDesktopSurfacePresentedChanged: synchronizeDesktopSurfacePresentation()",
      "onLoaded: synchronizeDesktopSurfacePresentation()",
      "onStatusChanged: synchronizeDesktopSurfacePresentation()",
    ]) {
      expect(surfaceLoader).toContain(handler);
    }
    expect(surfaceLoader).toMatch(
      /NumberAnimation \{[\s\S]*id: desktopSurfaceFadeIn[\s\S]*target: desktopSurfaceLoader[\s\S]*property: "opacity"[\s\S]*from: 0[\s\S]*to: 1/u,
    );
    expect(surfaceLoader).toMatch(
      /function synchronizeDesktopSurfacePresentation\(\)[\s\S]*if \(!desktopSurfaceComponentComplete \|\| !desktopSurfacePresented\)[\s\S]*desktopSurfaceFadeIn\.stop\(\);[\s\S]*opacity = 0;[\s\S]*desktopSurfaceFadeIn\.restart\(\);/u,
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
      /desktopSurfaceReady = false;\s*Qt\.callLater\(card\.completeDesktopSurfaceReload,/u,
    );
    expect(reload).toMatch(
      /function completeDesktopSurfaceReload[\s\S]*desktopSurfaceReady = true;/u,
    );
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
