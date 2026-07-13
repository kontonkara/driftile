import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const metadata = JSON.parse(
  readFileSync(new URL("metadata.json", effectRoot), "utf8"),
) as {
  readonly KPackageStructure?: string;
  readonly KPlugin?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};
const main = readFileSync(new URL("contents/ui/main.qml", effectRoot), "utf8");
const reader = readFileSync(
  new URL("contents/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const desktopCard = readFileSync(
  new URL("contents/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const qmlSources = [main, reader, scene, desktopCard];

describe("overview effect package", () => {
  it("declares a disabled standalone KWin effect without configuration", () => {
    expect(metadata.KPackageStructure).toBe("KWin/Effect");
    expect(metadata.KPlugin).toMatchObject({
      Category: "Window Management",
      EnabledByDefault: false,
      Id: "io.github.kontonkara.driftile.overview",
      Name: "Driftile Overview",
    });
    expect(metadata["X-Plasma-API"]).toBe("declarativescript");
    expect(metadata["X-Plasma-MainScript"]).toBe("ui/main.qml");
    expect(metadata).not.toHaveProperty("X-KDE-ConfigModule");
    expect(metadata).not.toHaveProperty("X-KWin-Border-Activate");
  });

  it("registers one unbound toggle action and no screen edge", () => {
    expect(main.match(/KWin\.ShortcutHandler\s*\{/gu)).toHaveLength(1);
    expect(main).toContain('name: "driftile_toggle_overview"');
    expect(main).not.toMatch(/\bsequence\s*:/u);
    expect(main).not.toMatch(/ScreenEdge|registerScreenEdge/u);
  });

  it("samples the persisted layout exactly twice without writing", () => {
    expect(reader).toContain('category: "Layout"');
    expect(reader).toContain('settings.value("layout-v1", "")');
    expect(reader.match(/settings\.value\("layout-v1", ""\)/gu)).toHaveLength(
      2,
    );
    expect(reader).toContain("readonly property int sampleInterval: 325");
    expect(reader).toContain("root.firstSample === secondSample");
    expect(reader).toContain("root.firstSample.length > 0");
    expect(reader).not.toMatch(/setValue|repeat:\s*true/u);
  });

  it("uses only public KWin QML writes for focus and desktop selection", () => {
    for (const source of qmlSources) {
      expect(source).not.toContain("org.kde.kwin.private");
    }

    expect(main).toContain("KWin.SceneEffect");
    expect(scene).toContain("KWin.SceneView.effect");
    expect(scene).toContain("KWin.SceneView.screen");
    expect(scene).toContain("KWin.SceneView.currentDesktop");
    expect(scene).toContain("for (const desktop of KWin.Workspace.desktops)");
    expect(scene).toContain("function onWindowAdded()");
    expect(scene).toContain("function onWindowRemoved()");
    expect(desktopCard).toContain("KWin.WindowModel");
    expect(desktopCard).toContain("KWin.WindowFilterModel");
    expect(desktopCard).toContain("KWin.WindowThumbnail");
    const kwinWrites =
      qmlSources
        .join("\n")
        .match(/KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/gu) ?? [];
    expect(
      kwinWrites.map((write) => write.replace(/\s*=$/u, "")).sort(),
    ).toEqual([
      "KWin.SceneView.currentDesktop",
      "KWin.Workspace.activeWindow",
      "KWin.Workspace.currentDesktop",
    ]);
    expect(qmlSources.join("\n")).not.toMatch(
      /(?:model\.window|candidate)\.[A-Za-z0-9_]+\s*=(?!=)|\.setValue\s*\(/u,
    );
  });

  it("focuses only a valid current-context thumbnail on a left click", () => {
    const focusHandler = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function windowUsesDesktop("),
    );
    const desktopMembership = scene.slice(
      scene.indexOf("function windowUsesDesktop("),
      scene.indexOf("function windowUsesCurrentActivity("),
    );
    const activityMembership = scene.slice(
      scene.indexOf("function windowUsesCurrentActivity("),
      scene.indexOf("function orderedDesktopIds("),
    );
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("function indexOfDesktop("),
    );

    expect(desktopCard.match(/\bTapHandler\s*\{/gu)).toHaveLength(2);
    expect(numberGutter.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(thumbnail.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(thumbnail).toContain("acceptedButtons: Qt.LeftButton");
    expect(thumbnail).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(thumbnail).toContain(
      "enabled: card.current && thumbnailShell.visible",
    );
    expect(thumbnail).toContain(
      "card.windowTapped(model.window, thumbnailShell.windowId, card.desktop, card.desktopId)",
    );

    expect(focusHandler).toContain("!sceneEffect");
    expect(focusHandler).toContain("sceneEffect.active !== true");
    expect(focusHandler).toContain("!candidate");
    expect(focusHandler).toContain("candidate.deleted");
    expect(focusHandler).toContain("candidate.hidden");
    expect(focusHandler).toContain("candidate.minimized");
    expect(focusHandler).toContain("candidate.wantsInput !== true");
    expect(focusHandler).toContain(
      "String(candidate.internalId) !== expectedWindowId",
    );
    expect(focusHandler).toContain("!targetScreen");
    expect(focusHandler).toContain("candidate.output !== targetScreen");
    expect(focusHandler).toContain("activeDesktop !== expectedDesktop");
    expect(focusHandler).toContain(
      "String(activeDesktop.id) !== expectedDesktopId",
    );
    expect(focusHandler).toContain("expectedDesktopId.length === 0");
    expect(desktopMembership).toContain("const desktops = candidate.desktops");
    expect(desktopMembership).toMatch(
      /if \(desktops\.length === 0\) \{\s*return true;/u,
    );
    expect(activityMembership).toContain(
      "const activities = candidate.activities",
    );
    expect(activityMembership).toMatch(
      /if \(activities\.length === 0\) \{\s*return true;/u,
    );
    expect(activityMembership).toContain("KWin.Workspace.currentActivity");
    expect(
      focusHandler.match(/KWin\.Workspace\.activeWindow !== candidate/gu),
    ).toHaveLength(2);
    expect(focusHandler).toContain("KWin.Workspace.activeWindow = candidate");
    expect(focusHandler).toContain("sceneEffect.deactivate()");

    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = candidate",
    );
    const deactivate = focusHandler.indexOf("sceneEffect.deactivate()");
    const earlyReturns = [...focusHandler.matchAll(/\breturn;/gu)].map(
      (match) => match.index,
    );
    expect(earlyReturns).toHaveLength(3);
    expect(
      earlyReturns.slice(0, 2).every((index) => index < activeWindowWrite),
    ).toBe(true);
    expect(activeWindowWrite).toBeGreaterThan(0);
    expect(earlyReturns[2]).toBeGreaterThan(activeWindowWrite);
    expect(earlyReturns[2]).toBeLessThan(deactivate);
    expect(deactivate).toBeGreaterThan(activeWindowWrite);

    expect(scene).not.toContain("KWin.Workspace.stackingOrder");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /MouseArea|DragHandler|ShortcutHandler|\.setValue\s*\(/u,
    );
  });

  it("selects only an exact live non-current desktop from its number gutter", () => {
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const selector = scene.slice(
      scene.indexOf("function selectDesktop("),
      scene.indexOf("function focusWindow("),
    );
    const outputProjection = scene.slice(
      scene.indexOf("function projectedOutputId("),
      scene.indexOf("function outputDescriptorsMatch("),
    );

    expect(desktopCard).toContain(
      "signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)",
    );
    expect(numberGutter).toContain("width: card.contentLeft");
    expect(numberGutter).toContain("height: card.height");
    expect(numberGutter).toContain("acceptedButtons: Qt.LeftButton");
    expect(numberGutter).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(numberGutter).toContain(
      "enabled: !card.current && card.desktop && card.screen",
    );
    expect(numberGutter).toContain(
      "card.desktopTapped(card.desktop, card.desktopId, card.screen)",
    );
    expect(scene).toMatch(
      /onDesktopTapped:\s*\(candidate, expectedDesktopId, expectedScreen\)\s*=>\s*root\.selectDesktop\(\s*candidate, expectedDesktopId, expectedScreen\)/u,
    );

    expect(selector).toContain("const model = overviewModel;");
    expect(selector).toContain("!sceneEffect");
    expect(selector.match(/sceneEffect\.active !== true/gu)).toHaveLength(2);
    expect(selector).toContain("!model");
    expect(selector).toContain("!candidate");
    expect(selector).toContain("expectedDesktopId.length === 0");
    expect(selector).toContain("!targetScreen");
    expect(selector).toContain("expectedScreen !== targetScreen");

    expect(selector).toContain("const screens = KWin.Workspace.screens;");
    expect(selector).toContain("for (const screen of screens)");
    expect(selector).toContain("screen === expectedScreen");
    expect(selector).toContain("liveScreen !== null");
    expect(selector).toContain("liveScreen === null");
    expect(selector).toContain("const expectedOutputId = outputId;");
    expect(selector).toContain("expectedOutputId.length === 0");
    expect(selector).toContain(
      "projectedOutputId(model, liveScreen) !== expectedOutputId",
    );
    expect(outputProjection).toContain("for (const output of model.outputs)");
    expect(outputProjection).toContain(
      "outputDescriptorsMatch(output, screen)",
    );

    expect(selector).toContain(
      "for (const desktop of KWin.Workspace.desktops)",
    );
    expect(selector).toContain(
      "desktop === candidate && String(desktop.id) === expectedDesktopId",
    );
    expect(selector).toContain("liveDesktop !== null");
    expect(selector).toContain("liveDesktop === null");
    expect(selector).toContain("sceneEffect.overviewModel !== model");
    expect(selector).toContain("overviewModel !== model");
    expect(selector).toContain("targetScreen !== liveScreen");
    expect(selector).toContain("outputId !== expectedOutputId");

    expect(selector).toContain(
      'const hasSceneDesktop = typeof KWin.SceneView.currentDesktop !== "undefined";',
    );
    expect(selector).toContain(
      "!hasSceneDesktop && (screens.length !== 1 || screens[0] !== liveScreen)",
    );
    expect(selector).toContain("const activeDesktop = currentDesktop;");
    expect(selector).toContain("activeDesktop === liveDesktop");
    expect(selector).toContain(
      "String(activeDesktop.id) === expectedDesktopId",
    );

    expect(selector).toContain("KWin.SceneView.currentDesktop = liveDesktop");
    expect(selector).toContain("KWin.Workspace.currentDesktop = liveDesktop");
    expect(selector).toMatch(
      /if \(hasSceneDesktop\) \{\s*KWin\.SceneView\.currentDesktop = liveDesktop;\s*\} else \{\s*KWin\.Workspace\.currentDesktop = liveDesktop;\s*\}/u,
    );
    expect(selector).toContain("catch (error)");
    expect(selector).toContain("const selectedDesktop = currentDesktop;");
    expect(selector).toContain("selectedDesktop !== liveDesktop");
    expect(selector).toContain(
      "String(selectedDesktop.id) !== expectedDesktopId",
    );
    expect(selector.match(/sceneEffect\.deactivate\(\)/gu)).toHaveLength(1);

    const sceneWrite = selector.indexOf(
      "KWin.SceneView.currentDesktop = liveDesktop",
    );
    const fallbackWrite = selector.indexOf(
      "KWin.Workspace.currentDesktop = liveDesktop",
    );
    const postWriteRead = selector.indexOf(
      "const selectedDesktop = currentDesktop;",
    );
    const confirmation = selector.indexOf("selectedDesktop !== liveDesktop");
    const deactivate = selector.indexOf("sceneEffect.deactivate()");
    const preWriteGuards = [
      selector.lastIndexOf("sceneEffect.active !== true"),
      selector.indexOf("expectedScreen !== targetScreen"),
      selector.indexOf("targetScreen !== liveScreen"),
      selector.indexOf("desktop === candidate"),
      selector.indexOf("outputId !== expectedOutputId"),
      selector.indexOf("screens.length !== 1"),
      selector.indexOf("activeDesktop === liveDesktop"),
    ];
    expect(sceneWrite).toBeGreaterThan(0);
    expect(
      preWriteGuards.every((guard) => guard > 0 && guard < sceneWrite),
    ).toBe(true);
    expect(fallbackWrite).toBeGreaterThan(sceneWrite);
    expect(postWriteRead).toBeGreaterThan(fallbackWrite);
    expect(confirmation).toBeGreaterThan(postWriteRead);
    expect(deactivate).toBeGreaterThan(confirmation);
    expect(selector).toMatch(
      /if \(selectedDesktop !== liveDesktop \|\| String\(selectedDesktop\.id\) !== expectedDesktopId\) \{\s*return;\s*\}\s*sceneEffect\.deactivate\(\);/u,
    );

    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\b(?:Action|DragHandler|MouseArea|Settings|ShortcutHandler|Timer)\s*\{|\.setValue\s*\(|\bsequence\s*:/u,
    );
    expect(`${selector}\n${outputProjection}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)\b|KWin\.WindowModel|layoutStateReader|model\.(?:contexts|desktopIds|floatingWindows)/u,
    );
  });

  it("projects stack heights without mixing pixels and auto weights", () => {
    expect(desktopCard).toContain(
      "const remaining = Math.max(0, contentHeight - fixedTotal * fixedScale)",
    );
    expect(desktopCard).toContain("remaining * weight / autoWeightTotal");
    expect(desktopCard).toContain("return contentHeight / 3");
    expect(desktopCard).toContain("return contentHeight / 2");
    expect(desktopCard).toContain("return contentHeight * 2 / 3");
  });

  it("loads the runtime through the fail-closed adapter boundary", () => {
    expect(main).toContain('import "../code/main.js" as OverviewRuntime');
    expect(main).toContain("OverviewRuntime.DriftileOverview");
    expect(main).toContain(
      "runtime.loadOverviewModel(document, liveSnapshot())",
    );
    expect(main).toContain("result.ok !== true");
    expect(main).toContain("overviewModel = null");
  });
});
