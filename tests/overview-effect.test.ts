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

  it("activates current and non-current thumbnails through one guarded path", () => {
    const focusHandler = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function requestDesktopSelection("),
    );
    const desktopContext = scene.slice(
      scene.indexOf("function desktopContextIsExact("),
      scene.indexOf("function windowContextIsExact("),
    );
    const windowContext = scene.slice(
      scene.indexOf("function windowContextIsExact("),
      scene.indexOf("function windowUsesDesktop("),
    );
    const desktopMembership = scene.slice(
      scene.indexOf("function windowUsesDesktop("),
      scene.indexOf("function windowUsesActivity("),
    );
    const activityMembership = scene.slice(
      scene.indexOf("function windowUsesActivity("),
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
      "enabled: thumbnailShell.visible && card.desktop && card.screen",
    );
    expect(thumbnail).not.toContain("enabled: card.current");
    expect(thumbnail).toContain(
      "card.windowTapped(model.window, thumbnailShell.windowId, card.desktop, card.desktopId,",
    );
    expect(thumbnail).toContain("card.screen)");
    expect(scene).toMatch(
      /onWindowTapped:\s*\(candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen\)\s*=>\s*root\.focusWindow\(candidate, expectedWindowId, expectedDesktop, expectedDesktopId,\s*expectedScreen\)/u,
    );

    expect(focusHandler).toContain("const effect = sceneEffect;");
    expect(focusHandler).toContain("const model = overviewModel;");
    expect(focusHandler).toContain(
      "const liveScreen = liveScreenFor(expectedScreen);",
    );
    expect(focusHandler).toContain(
      "const expectedOutput = projectedOutput(model, liveScreen);",
    );
    expect(focusHandler).toContain(
      "const liveDesktop = liveDesktopFor(expectedDesktop, expectedDesktopId);",
    );
    expect(focusHandler).toContain(
      "const expectedActivityId = String(KWin.Workspace.currentActivity);",
    );
    expect(focusHandler).toMatch(
      /desktopContextIsExact\(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,\s*expectedDesktopId\) \|\| !windowContextIsExact\(candidate, expectedWindowId,\s*liveScreen, liveDesktop,\s*expectedDesktopId,\s*expectedActivityId, false\)/u,
    );
    expect(focusHandler).toContain("const activeDesktop = currentDesktop;");
    expect(focusHandler).toMatch(
      /if \(activeDesktop !== liveDesktop \|\| String\(activeDesktop\.id\) !== expectedDesktopId\) \{\s*if \(!requestDesktopSelection\([\s\S]*?\)\) \{\s*return;\s*\}\s*desktopSelectionConfirmed = true;\s*\}/u,
    );
    expect(focusHandler).toContain("const selectedDesktop = currentDesktop;");
    expect(focusHandler).toContain("selectedDesktop === liveDesktop");
    expect(focusHandler).toContain(
      "String(selectedDesktop.id) === expectedDesktopId",
    );
    expect(focusHandler).toMatch(
      /windowContextIsExact\(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,\s*expectedActivityId, true\)/u,
    );
    expect(focusHandler).toContain("catch (error)");
    expect(focusHandler).toContain("focusConfirmed = false;");
    expect(focusHandler).toContain(
      "focusConfirmed = KWin.Workspace.activeWindow === candidate;",
    );

    expect(desktopContext).toContain("effect !== sceneEffect");
    expect(desktopContext).toContain("effect.active !== true");
    expect(desktopContext).toContain("effect.overviewModel !== model");
    expect(desktopContext).toContain("overviewModel !== model");
    expect(desktopContext).toContain("targetScreen !== liveScreen");
    expect(desktopContext).toContain(
      "liveScreenFor(liveScreen) !== liveScreen",
    );
    expect(desktopContext).toContain(
      "projectedOutput(model, liveScreen) !== expectedOutput",
    );
    expect(desktopContext).toContain("outputId !== expectedOutputId");
    expect(desktopContext).toContain(
      "liveDesktopFor(liveDesktop, expectedDesktopId) !== liveDesktop",
    );

    expect(windowContext).toContain("!candidate.deleted");
    expect(windowContext).toContain("!candidate.minimized");
    expect(windowContext).toContain("candidate.wantsInput === true");
    expect(windowContext).toContain("(!rejectHidden || !candidate.hidden)");
    expect(windowContext).toContain("expectedWindowId.length > 0");
    expect(windowContext).toContain(
      "String(candidate.internalId) === expectedWindowId",
    );
    expect(windowContext).toContain("candidate.output === liveScreen");
    expect(windowContext).toContain(
      "String(KWin.Workspace.currentActivity) === expectedActivityId",
    );
    expect(windowContext).toContain(
      "windowUsesDesktop(candidate, liveDesktop, expectedDesktopId)",
    );
    expect(windowContext).toContain(
      "windowUsesActivity(candidate, expectedActivityId)",
    );
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
    expect(activityMembership).toContain(
      "String(activity) === expectedActivityId",
    );

    expect(focusHandler).toContain("KWin.Workspace.activeWindow !== candidate");
    expect(focusHandler).toContain("KWin.Workspace.activeWindow = candidate");
    expect(
      focusHandler.match(/KWin\.Workspace\.activeWindow = candidate/gu),
    ).toHaveLength(1);
    expect(focusHandler.match(/effect\.deactivate\(\)/gu)).toHaveLength(1);
    expect(focusHandler).toMatch(
      /if \(focusConfirmed \|\| desktopSelectionConfirmed\) \{\s*effect\.deactivate\(\);\s*\}/u,
    );

    const preSelectionValidation = focusHandler.indexOf(
      "expectedActivityId, false",
    );
    const desktopRequest = focusHandler.indexOf("requestDesktopSelection(");
    const selectedFlag = focusHandler.indexOf(
      "desktopSelectionConfirmed = true;",
    );
    const postSelectionValidation = focusHandler.lastIndexOf(
      "expectedActivityId, true",
    );
    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = candidate",
    );
    const focusConfirmation = focusHandler.indexOf(
      "focusConfirmed = KWin.Workspace.activeWindow === candidate;",
    );
    const deactivate = focusHandler.indexOf("effect.deactivate()");
    expect(preSelectionValidation).toBeGreaterThan(0);
    expect(desktopRequest).toBeGreaterThan(preSelectionValidation);
    expect(selectedFlag).toBeGreaterThan(desktopRequest);
    expect(postSelectionValidation).toBeGreaterThan(selectedFlag);
    expect(activeWindowWrite).toBeGreaterThan(postSelectionValidation);
    expect(focusConfirmation).toBeGreaterThan(activeWindowWrite);
    expect(deactivate).toBeGreaterThan(focusConfirmation);
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
    const desktopRequest = scene.slice(
      scene.indexOf("function requestDesktopSelection("),
      scene.indexOf("function desktopContextIsExact("),
    );
    const desktopContext = scene.slice(
      scene.indexOf("function desktopContextIsExact("),
      scene.indexOf("function windowContextIsExact("),
    );
    const outputProjection = scene.slice(
      scene.indexOf("function projectedOutput("),
      scene.indexOf("function liveScreenFor("),
    );
    const liveScreenLookup = scene.slice(
      scene.indexOf("function liveScreenFor("),
      scene.indexOf("function liveDesktopFor("),
    );
    const liveDesktopLookup = scene.slice(
      scene.indexOf("function liveDesktopFor("),
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

    expect(selector).toContain("const effect = sceneEffect;");
    expect(selector).toContain("const model = overviewModel;");
    expect(selector).toContain(
      "const liveScreen = liveScreenFor(expectedScreen);",
    );
    expect(selector).toContain(
      "const expectedOutput = projectedOutput(model, liveScreen);",
    );
    expect(selector).toContain(
      "const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);",
    );
    expect(selector).toContain("desktopContextIsExact(");
    expect(selector).toContain("requestDesktopSelection(");
    expect(scene.match(/requestDesktopSelection\(/gu)).toHaveLength(3);

    expect(liveScreenLookup).toContain(
      "for (const screen of KWin.Workspace.screens)",
    );
    expect(liveScreenLookup).toContain("screen === expectedScreen");
    expect(liveScreenLookup).toContain("liveScreen !== null");
    expect(liveDesktopLookup).toContain(
      "for (const desktop of KWin.Workspace.desktops)",
    );
    expect(liveDesktopLookup).toContain(
      "desktop === expectedDesktop && String(desktop.id) === expectedDesktopId",
    );
    expect(liveDesktopLookup).toContain("liveDesktop !== null");

    expect(outputProjection).toContain("for (const output of model.outputs)");
    expect(outputProjection).toContain(
      "outputDescriptorsMatch(output, screen)",
    );
    expect(outputProjection).toContain("return null;");
    expect(outputProjection).toContain("return projected;");

    expect(desktopContext).toContain("effect !== sceneEffect");
    expect(desktopContext).toContain("effect.active !== true");
    expect(desktopContext).toContain("effect.overviewModel !== model");
    expect(desktopContext).toContain("overviewModel !== model");
    expect(desktopContext).toContain("targetScreen !== liveScreen");
    expect(desktopContext).toContain("outputId !== expectedOutputId");
    expect(desktopContext).toContain(
      "projectedOutput(model, liveScreen) !== expectedOutput",
    );
    expect(desktopContext).toContain(
      "liveDesktopFor(liveDesktop, expectedDesktopId) !== liveDesktop",
    );

    expect(desktopRequest).toContain(
      'const hasSceneDesktop = typeof KWin.SceneView.currentDesktop !== "undefined";',
    );
    expect(desktopRequest).toContain("const screens = KWin.Workspace.screens;");
    expect(desktopRequest).toContain(
      "!hasSceneDesktop && (screens.length !== 1 || screens[0] !== liveScreen)",
    );
    expect(desktopRequest).toContain("const activeDesktop = currentDesktop;");
    expect(desktopRequest).toContain("activeDesktop === liveDesktop");
    expect(desktopRequest).toContain(
      "String(activeDesktop.id) === expectedDesktopId",
    );

    expect(desktopRequest).toContain(
      "KWin.SceneView.currentDesktop = liveDesktop",
    );
    expect(desktopRequest).toContain(
      "KWin.Workspace.currentDesktop = liveDesktop",
    );
    expect(desktopRequest).toMatch(
      /if \(hasSceneDesktop\) \{\s*KWin\.SceneView\.currentDesktop = liveDesktop;\s*\} else \{\s*KWin\.Workspace\.currentDesktop = liveDesktop;\s*\}/u,
    );
    expect(desktopRequest).toContain("catch (error)");
    expect(desktopRequest).toContain("return false;");
    expect(desktopRequest).toContain("const selectedDesktop = currentDesktop;");
    expect(desktopRequest).toContain(
      "return selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId;",
    );
    expect(selector.match(/effect\.deactivate\(\)/gu)).toHaveLength(1);
    expect(desktopRequest).not.toContain("deactivate()");

    const preWriteGuard = desktopRequest.indexOf("desktopContextIsExact(");
    const sceneWrite = desktopRequest.indexOf(
      "KWin.SceneView.currentDesktop = liveDesktop",
    );
    const fallbackWrite = desktopRequest.indexOf(
      "KWin.Workspace.currentDesktop = liveDesktop",
    );
    const postWriteRead = desktopRequest.indexOf(
      "const selectedDesktop = currentDesktop;",
    );
    const confirmation = desktopRequest.indexOf(
      "return selectedDesktop === liveDesktop",
    );
    const deactivate = selector.indexOf("effect.deactivate()");
    expect(preWriteGuard).toBeGreaterThan(0);
    expect(sceneWrite).toBeGreaterThan(0);
    expect(sceneWrite).toBeGreaterThan(preWriteGuard);
    expect(fallbackWrite).toBeGreaterThan(sceneWrite);
    expect(postWriteRead).toBeGreaterThan(fallbackWrite);
    expect(confirmation).toBeGreaterThan(postWriteRead);
    expect(selector).toMatch(
      /if \(!requestDesktopSelection\([\s\S]*?\)\) \{\s*return;\s*\}\s*effect\.deactivate\(\);/u,
    );
    expect(deactivate).toBeGreaterThan(
      selector.indexOf("requestDesktopSelection("),
    );

    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\b(?:Action|DragHandler|MouseArea|Settings|ShortcutHandler|Timer)\s*\{|\.setValue\s*\(|\bsequence\s*:/u,
    );
    expect(`${selector}\n${desktopRequest}\n${outputProjection}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)\b|KWin\.WindowModel|layoutStateReader|model\.(?:contexts|desktopIds|floatingWindows)/u,
    );
  });

  it("projects stack heights without mixing pixels and auto weights", () => {
    expect(desktopCard).toContain(
      'column.presentation === "tabbed"\n                ? [contentHeight]',
    );
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
