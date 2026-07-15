import { createHash } from "node:crypto";
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
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const reader = readFileSync(
  new URL("contents/runtime/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const desktopCard = readFileSync(
  new URL("contents/runtime/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const qmlSources = [main, controller, reader, scene, desktopCard];

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

  it("registers one Meta+O toggle action and no screen edge", () => {
    expect(controller.match(/KWin\.ShortcutHandler\s*\{/gu)).toHaveLength(1);
    expect(controller).toContain('name: "driftile_toggle_overview"');
    expect(controller).toContain('sequence: "Meta+O"');
    expect(controller).not.toMatch(/ScreenEdge|registerScreenEdge/u);
    expect(main).not.toContain("ShortcutHandler");
  });

  it("keeps a fixed scene-effect proxy over the cache-busted controller", () => {
    expect(createHash("sha256").update(main, "utf8").digest("hex")).toBe(
      "a56cf4d37cef8491473837985971d08114966be72160158317ad8f76cc9cb356",
    );
    expect(main).toContain("KWin.SceneEffect {");
    expect(main).toContain("Date.now().toString(36)");
    expect(main).toContain("Math.random().toString(36).slice(2)");
    expect(main).toContain('Qt.resolvedUrl("../runtime/selector.qml")');
    expect(main).toContain("selectorLoader.item && selectorLoader.item.item");
    expect(main).toContain(
      "readonly property bool active: controller ? controller.active : false",
    );
    expect(main).toContain(
      "readonly property bool loading: controller ? controller.loading : false",
    );
    expect(main).toContain(
      "readonly property var overviewModel: controller ? controller.overviewModel : null",
    );
    expect(main).toContain("visible: controller ? controller.active : false");
    expect(main).toContain(
      "delegate: controller ? controller.overviewDelegate : null",
    );
    for (const method of ["toggle", "activate", "deactivate"]) {
      expect(main).toContain(`function ${method}()`);
      expect(main).toContain(`controller.${method}();`);
    }

    expect(controller).toContain("QtObject {");
    expect(controller).not.toContain("KWin.SceneEffect {");
    expect(controller).not.toMatch(/\bvisible\s*=|\bvisible\s*:/u);
    expect(controller).not.toMatch(/^\s*delegate\s*:/mu);
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
    expect(desktopCard.match(/KWin\.WindowModel\s*\{/gu)).toHaveLength(1);
    expect(desktopCard.match(/KWin\.WindowFilterModel\s*\{/gu)).toHaveLength(1);
    expect(desktopCard).toContain("minimizedWindows: true");
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
    const windowPresentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("function indexOfDesktop("),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: tabShell"),
    );
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("function indexOfDesktop("),
    );

    expect(desktopCard.match(/\bTapHandler\s*\{/gu)).toHaveLength(3);
    expect(numberGutter.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(thumbnail.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(tab.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(windowPresentation).toContain("width: viewport.width");
    expect(windowPresentation).toContain("height: viewport.height");
    expect(thumbnail).toContain("acceptedButtons: Qt.LeftButton");
    expect(thumbnail).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(thumbnail).toContain(
      "enabled: thumbnailShell.visible && card.desktop && card.screen",
    );
    expect(thumbnail).toContain("!windowPresentation.minimizedWindow");
    expect(thumbnail).not.toContain("enabled: card.current");
    expect(thumbnail).toContain(
      "card.windowTapped(model.window, windowPresentation.windowId, card.desktop,",
    );
    expect(thumbnail).toContain("card.desktopId, card.screen)");
    expect(tab).toContain("acceptedButtons: Qt.LeftButton");
    expect(tab).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(tab).toContain("enabled: tabShell.visible");
    expect(tab).toContain("!windowPresentation.tiledPresentation.selected");
    expect(tab).toContain("!windowPresentation.minimizedWindow");
    expect(tab).toContain("visible: frame !== null && model.window");
    expect(tab).toContain(
      "opacity: windowPresentation.minimizedWindow ? 0.6 : 1",
    );
    expect(tab).toContain(
      'color: windowPresentation.minimizedWindow ? "#8a96a8" : "#f3f7ff"',
    );
    expect(tab).toContain(
      "model.window && model.window.caption ? String(model.window.caption)",
    );
    expect(tab).toContain("elide: Text.ElideRight");
    expect(tab).toContain(
      "card.windowTapped(model.window, windowPresentation.windowId, card.desktop,",
    );
    expect(tab).toContain("card.desktopId, card.screen)");
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

  it("navigates only live visible window targets with unmodified keys", () => {
    const keyHandler = scene.slice(
      scene.indexOf("Keys.onPressed:"),
      scene.indexOf("Component.onCompleted:"),
    );
    const navigation = scene.slice(
      scene.indexOf("function collectNavigationTargets("),
      scene.indexOf("function selectDesktop("),
    );
    const cardTargets = desktopCard.slice(
      desktopCard.indexOf("function collectNavigationTargets("),
      desktopCard.indexOf("function indexOfDesktop("),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: tabShell"),
    );
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("function collectNavigationTargets("),
    );

    expect(scene).toContain('import "../code/main.js" as OverviewRuntime');
    expect(scene).toContain('property string keyboardSelectionId: ""');
    expect(keyHandler).toContain(
      "(event.modifiers & ~Qt.KeypadModifier) !== Qt.NoModifier",
    );
    expect(keyHandler).toMatch(
      /\(event\.modifiers & ~Qt\.KeypadModifier\) !== Qt\.NoModifier\) \{\s*event\.accepted = false;\s*return;/u,
    );
    for (const [key, direction] of [
      ["Left", "left"],
      ["Right", "right"],
      ["Up", "up"],
      ["Down", "down"],
    ] as const) {
      expect(keyHandler).toContain(`event.key === Qt.Key_${key}`);
      expect(keyHandler).toContain(
        `root.navigateKeyboardSelection("${direction}")`,
      );
    }
    expect(keyHandler).toContain("event.key === Qt.Key_Enter");
    expect(keyHandler).toContain("event.key === Qt.Key_Return");
    expect(keyHandler).toContain("event.key === Qt.Key_Space");
    expect(keyHandler).toContain("root.activateKeyboardSelection()");
    expect(keyHandler).toContain("event.key === Qt.Key_Escape");
    expect(keyHandler).toContain("sceneEffect.deactivate()");
    expect(keyHandler).toContain("event.accepted = handled");

    expect(scene).toContain("id: desktopRepeater");
    expect(navigation).toContain("desktopRepeater.itemAt(cardIndex)");
    expect(navigation).toContain("desktopCard.collectNavigationTargets(root)");
    expect(navigation).toContain("OverviewRuntime.DriftileOverview");
    expect(navigation).toContain(
      'typeof runtime.findOverviewNavigationTarget !== "function"',
    );
    expect(navigation).toContain(
      "runtime.findOverviewNavigationTarget(keyboardSelectionId, targets, direction)",
    );
    expect(navigation).toContain(
      "focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen)",
    );
    expect(navigation).toContain(
      "navigationTargetForId(targets, keyboardSelectionId)",
    );
    expect(navigation).toContain("target.candidate === activeWindow");
    expect(navigation).toContain("target.desktopId === activeDesktopId");
    expect(navigation).toContain(
      "return firstActive || firstCurrentDesktop || firstVisual",
    );
    expect(navigation).toContain(
      "navigationTargetPrecedes(target, firstVisual)",
    );

    expect(desktopCard).toContain("id: windowRepeater");
    expect(cardTargets).toContain("windowRepeater.itemAt(index)");
    expect(cardTargets).toContain(
      "presentation.tiledPresentation && !presentation.tiledPresentation.selected",
    );
    expect(cardTargets).toContain("presentation.tabTarget");
    expect(cardTargets).toContain("presentation.thumbnailTarget");
    expect(cardTargets).toContain(
      "id: navigationTargetId(presentation.windowId)",
    );
    for (const field of [
      "candidate",
      "desktop",
      "desktopId",
      "rect",
      "screen",
      "window",
      "windowId",
    ]) {
      expect(cardTargets).toMatch(new RegExp(`\\b${field}(?::|,)`, "u"));
    }
    expect(cardTargets).toContain(
      "return JSON.stringify([desktopId, windowId])",
    );
    expect(cardTargets).toContain("!candidate.deleted");
    expect(cardTargets).toContain("!candidate.minimized");
    expect(cardTargets).toContain("candidate.wantsInput === true");
    expect(cardTargets).toContain("candidate.output === screen");
    expect(cardTargets).toContain("visual.mapToItem(sceneItem");
    expect(cardTargets).toContain("viewport.mapToItem(sceneItem");
    expect(cardTargets).toContain("card.mapToItem(sceneItem");
    expect(cardTargets).toContain("height: sceneItem.height");
    expect(cardTargets).toContain("width: sceneItem.width");
    expect(cardTargets).toContain("right <= left || bottom <= top");

    expect(thumbnail).toContain("!windowPresentation.tiledPresentation");
    expect(thumbnail).toContain(
      "windowPresentation.tiledPresentation.selected",
    );
    expect(tab).toContain("!windowPresentation.tiledPresentation.selected");
    expect(desktopCard.match(/border\.color: "#ffd166"/gu)).toHaveLength(2);
    expect(desktopCard.match(/keyboardSelected \? 3 : 0/gu)).toHaveLength(2);
    expect(
      desktopCard.slice(
        desktopCard.indexOf("id: numberGutter"),
        desktopCard.indexOf("id: viewport"),
      ),
    ).not.toContain("keyboardSelectionId");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\bTimer\s*\{|KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
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
    const presentations = desktopCard.slice(
      desktopCard.indexOf("function buildTiledPresentations("),
      desktopCard.indexOf("function buildFloatingWindowIds("),
    );

    expect(presentations).toContain(
      "const presentations = Object.create(null)",
    );
    expect(presentations).toContain(
      'const tabbed = column.presentation === "tabbed"',
    );
    expect(presentations).toContain(
      "const selected = !tabbed || memberIndex === column.selectedMemberIndex",
    );
    expect(presentations).toContain("thumbnailFrame: selected ? {");
    expect(presentations).toContain("} : null");
    expect(presentations).toContain("tabWidth * memberIndex");
    expect(presentations).toContain("const stripBodyGap = gap");
    expect(presentations).toContain(
      "const tabHeight = Math.max(1, tabStripHeight - stripBodyGap)",
    );
    expect(presentations).toContain(
      "const thumbnailY = tabbed ? tabStripHeight + stripBodyGap / 2 : gap / 2",
    );
    expect(presentations).toContain(
      "return Math.max(1, Math.min(28, contentHeight * 0.16))",
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
    expect(controller).toContain('import "../code/main.js" as OverviewRuntime');
    expect(controller).toContain("OverviewRuntime.DriftileOverview");
    expect(controller).toContain(
      "runtime.loadOverviewModel(document, liveSnapshot())",
    );
    expect(controller).toContain("result.ok !== true");
    expect(controller).toContain("overviewModel = null");
  });
});
