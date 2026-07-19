import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);

const presentation = desktopCard.slice(
  desktopCard.indexOf("id: windowPresentation"),
  desktopCard.indexOf("id: thumbnailShell"),
);
const thumbnailDrag = handlerBlock(
  "thumbnailDragHandler",
  "minimizedPlaceholderShell",
);
const lifecycle = desktopCard.slice(
  desktopCard.indexOf("function beginWindowSpatialDrag("),
  desktopCard.indexOf("function windowDropIsValid("),
);

describe("spatial overview window drag lifecycle", () => {
  it("declares one deduplicated source lifecycle for exact thumbnails", () => {
    expect(desktopCard).toContain(
      "signal windowSpatialDragStarted(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal windowSpatialDragMoved(var source, real sceneX, real sceneY)",
    );
    expect(desktopCard).toContain(
      "signal windowSpatialDragFinished(var source)",
    );
    expect(presentation).toContain(
      "property bool spatialDragLifecycleActive: false",
    );
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(2);
    expect(desktopCard).not.toContain("id: tabDragHandler");
    expect(
      desktopCard.slice(
        desktopCard.indexOf("id: minimizedPlaceholderShell"),
        desktopCard.indexOf("id: windowDropArea"),
      ),
    ).not.toContain("windowSpatialDrag");
  });

  it("emits a complete thumbnail drag lifecycle from the existing handler", () => {
    const handlerId = "thumbnailDragHandler";
    const drag = thumbnailDrag;
    expect(drag).toContain("onActiveTranslationChanged:");
    expect(drag).toContain(`if (${handlerId}.active) {`);
    expect(drag).toContain(`${handlerId}.centroid.scenePosition`);
    expect(drag).toMatch(
      /if \(transition === PointerDevice\.GrabExclusive\) \{[\s\S]*?card\.beginWindowSpatialDrag\(windowPresentation, point\.scenePosition\);/u,
    );
    expect(drag.match(/card\.beginWindowSpatialDrag\(/gu)).toHaveLength(1);
    expect(drag.match(/card\.moveWindowSpatialDrag\(/gu)).toHaveLength(1);
    expect(drag.match(/card\.finishWindowSpatialDrag\(/gu)).toHaveLength(3);
    expect(drag).toMatch(
      /const action = [A-Za-z]+Shell\.Drag\.drop\(\);[\s\S]*?[A-Za-z]+Shell\.Drag\.active = false;[\s\S]*?card\.finishWindowSpatialDrag\(source\);[\s\S]*?if \(action === Qt\.MoveAction\) \{\s*return;/u,
    );
    expect(drag).toMatch(
      /else \{\s*[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
    expect(drag).toMatch(
      /transition === PointerDevice\.CancelGrabExclusive[\s\S]*?transition === PointerDevice\.CancelGrabPassive[\s\S]*?[A-Za-z]+Shell\.Drag\.cancel\(\);\s*[A-Za-z]+Shell\.Drag\.active = false;\s*card\.finishWindowSpatialDrag\(windowPresentation\);/u,
    );
  });

  it("guards finite coordinates, source identity, and duplicate finish signals", () => {
    expect(lifecycle).toContain("function spatialDragSourceIsOwned(source)");
    expect(lifecycle).toContain(
      "String(candidate.internalId) === source.windowId",
    );
    expect(lifecycle).toContain("source.sourceDesktop === desktop");
    expect(lifecycle).toContain("source.sourceDesktopId === desktopId");
    expect(lifecycle).toContain("source.sourceScreen === screen");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive === true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive !== true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive = true");
    expect(lifecycle).toContain("source.spatialDragLifecycleActive = false");
    expect(lifecycle).toContain("Number.isFinite(scenePosition.x)");
    expect(lifecycle).toContain("Number.isFinite(scenePosition.y)");
    expect(lifecycle).toContain(
      "windowSpatialDragMoved(source, scenePosition.x, scenePosition.y)",
    );
    expect(lifecycle).toContain("windowSpatialDragFinished(source)");
    expect(`${thumbnailDrag}\n${lifecycle}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)|\.setValue\s*\(|\b(?:MouseArea|Timer)\s*\{/u,
    );
  });
});

function handlerBlock(handlerId: string, nextId: string): string {
  return desktopCard.slice(
    desktopCard.indexOf(`id: ${handlerId}`),
    desktopCard.indexOf(`id: ${nextId}`),
  );
}
