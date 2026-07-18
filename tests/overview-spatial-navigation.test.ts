import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const desktopCard = readFileSync(
  new URL("contents/runtime/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

const collection = desktopCard.slice(
  desktopCard.indexOf("function collectNavigationTargets("),
  desktopCard.indexOf("function viewportPointHitsWindow("),
);
const windowClip = desktopCard.slice(
  desktopCard.indexOf("function clippedNavigationRect("),
  desktopCard.indexOf("function clippedCardNavigationRect("),
);
const cardClip = desktopCard.slice(
  desktopCard.indexOf("function clippedCardNavigationRect("),
  desktopCard.indexOf("function intersectRects("),
);

describe("spatial overview navigation geometry", () => {
  it("preserves default clipping while the spatial scene opts into offscreen targets", () => {
    expect(collection).toContain(
      "function collectNavigationTargets(sceneItem, includeOffscreen = false)",
    );
    expect(scene).toContain("desktopCard.collectNavigationTargets(root, true)");

    for (const clip of [windowClip, cardClip]) {
      expect(clip).toContain("includeOffscreen = false");
      expect(clip).toMatch(
        /if \(includeOffscreen !== true\) \{[\s\S]*?height: sceneItem\.height,[\s\S]*?width: sceneItem\.width,[\s\S]*?x: 0,[\s\S]*?y: 0[\s\S]*?\}/u,
      );
    }
  });

  it("can retain offscreen mapped targets without escaping card clips", () => {
    expect(collection).toContain(
      "clippedNavigationRect(visual, sceneItem, includeOffscreen)",
    );
    expect(collection).toContain(
      "clippedCardNavigationRect(numberGutter, sceneItem, includeOffscreen)",
    );

    expect(windowClip).toContain("visual.mapToItem(sceneItem");
    expect(windowClip).toContain("viewport.mapToItem(sceneItem");
    expect(windowClip).toContain("card.mapToItem(sceneItem");
    expect(windowClip.indexOf("viewport.mapToItem(sceneItem")).toBeLessThan(
      windowClip.indexOf("if (includeOffscreen !== true)"),
    );
    expect(windowClip.indexOf("card.mapToItem(sceneItem")).toBeLessThan(
      windowClip.indexOf("if (includeOffscreen !== true)"),
    );

    expect(cardClip).toContain("visual.mapToItem(sceneItem");
    expect(cardClip).toContain("card.mapToItem(sceneItem");
    expect(cardClip).not.toContain("viewport.mapToItem(sceneItem");
    expect(cardClip.indexOf("card.mapToItem(sceneItem")).toBeLessThan(
      cardClip.indexOf("if (includeOffscreen !== true)"),
    );
  });

  it("fails closed to finite positive plain rectangles", () => {
    const validation = desktopCard.slice(
      desktopCard.indexOf("function navigationRectIsValid("),
      desktopCard.indexOf("function intersectRects("),
    );

    for (const clip of [windowClip, cardClip]) {
      expect(clip).toContain(
        "return navigationRectIsValid(rect) ? rect : null;",
      );
      expect(clip).toMatch(/catch \(error\) \{\s*return null;/u);
    }
    for (const field of ["x", "y", "width", "height"]) {
      expect(validation).toContain(`Number.isFinite(rect.${field})`);
    }
    expect(validation).toContain("rect.width > 0 && rect.height > 0");
    expect(
      `${collection}\n${windowClip}\n${cardClip}\n${validation}`,
    ).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(|\b(?:MouseArea|Timer|WheelHandler|TapHandler|DragHandler)\s*\{/u,
    );
  });
});
