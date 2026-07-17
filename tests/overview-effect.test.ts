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
const configuration = readFileSync(
  new URL("contents/config/main.xml", effectRoot),
  "utf8",
);
const configurationUi = readFileSync(
  new URL("contents/ui/config.ui", effectRoot),
  "utf8",
);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const touchpadGesture = readFileSync(
  new URL("contents/runtime/ui/OverviewTouchpadGesture.qml", effectRoot),
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
const overviewRuntimeIndex = readFileSync(
  new URL("../src/overview/runtime.ts", import.meta.url),
  "utf8",
);
const qmlSources = [
  main,
  controller,
  touchpadGesture,
  reader,
  scene,
  desktopCard,
];

describe("overview effect package", () => {
  it("declares a disabled standalone configurable KWin effect", () => {
    expect(metadata.KPackageStructure).toBe("KWin/Effect");
    expect(metadata.KPlugin).toMatchObject({
      Category: "Window Management",
      EnabledByDefault: false,
      Id: "io.github.kontonkara.driftile.overview",
      Name: "Driftile Overview",
    });
    expect(metadata["X-Plasma-API"]).toBe("declarativescript");
    expect(metadata["X-Plasma-MainScript"]).toBe("ui/main.qml");
    expect(metadata["X-KDE-ConfigModule"]).toBe("kcm_kwin4_genericscripted");
    expect(metadata).not.toHaveProperty("X-KWin-Border-Activate");

    const enabledEntry = configuration.match(
      /<entry name="TouchpadGesture"[\s\S]*?<\/entry>/u,
    )?.[0];
    const fingerCountEntry = configuration.match(
      /<entry name="TouchpadGestureFingerCount"[\s\S]*?<\/entry>/u,
    )?.[0];
    const screenEdgeEntry = configuration.match(
      /<entry name="ScreenEdge"[\s\S]*?<\/entry>/u,
    )?.[0];
    const backdropColorEntry = configuration.match(
      /<entry name="BackdropColor"[\s\S]*?<\/entry>/u,
    )?.[0];
    expect(enabledEntry).toContain("<default>true</default>");
    expect(fingerCountEntry).toContain("<default>4</default>");
    expect(fingerCountEntry).toContain("<min>3</min>");
    expect(fingerCountEntry).toContain("<max>5</max>");
    expect(screenEdgeEntry).toContain('type="String"');
    expect(screenEdgeEntry).toContain("<default>none</default>");
    expect(backdropColorEntry).toContain('type="Color"');
    expect(backdropColorEntry).toContain("<default>#e60b0f17</default>");
    expect(configurationUi).toContain('name="kcfg_TouchpadGesture"');
    expect(configurationUi).toContain('name="kcfg_TouchpadGestureFingerCount"');
    expect(configurationUi).toContain('name="kcfg_ScreenEdge"');
    expect(configurationUi).toContain('name="kcfg_BackdropColor"');
    expect(configurationUi).toMatch(
      /name="kcfg_BackdropColor"[\s\S]*?<property name="alphaChannelEnabled">\s*<bool>true<\/bool>/u,
    );
  });

  it("registers one Meta+O toggle and two unbound state actions", () => {
    const toggleAction = controller.slice(
      controller.indexOf(
        "readonly property KWin.ShortcutHandler toggleShortcut",
      ),
      controller.indexOf("readonly property KWin.ShortcutHandler openShortcut"),
    );
    const openAction = controller.slice(
      controller.indexOf("readonly property KWin.ShortcutHandler openShortcut"),
      controller.indexOf(
        "readonly property KWin.ShortcutHandler closeShortcut",
      ),
    );
    const closeAction = controller.slice(
      controller.indexOf(
        "readonly property KWin.ShortcutHandler closeShortcut",
      ),
      controller.indexOf("readonly property Loader touchpadGestureLoader"),
    );
    const open = controller.slice(
      controller.indexOf("function open()"),
      controller.indexOf("function close()"),
    );
    const close = controller.slice(
      controller.indexOf("function close()"),
      controller.indexOf("function applyTouchpadGestureSettings("),
    );

    expect(controller.match(/KWin\.ShortcutHandler\s*\{/gu)).toHaveLength(3);
    expect(toggleAction).toContain('name: "driftile_toggle_overview"');
    expect(toggleAction).toContain('sequence: "Meta+O"');
    expect(toggleAction).toContain("onActivated: controller.toggle()");
    expect(openAction).toContain('name: "driftile_open_overview"');
    expect(openAction).toContain("onActivated: controller.open()");
    expect(closeAction).toContain('name: "driftile_close_overview"');
    expect(closeAction).toContain("onActivated: controller.close()");
    expect(openAction).not.toMatch(/\bsequence\s*:/u);
    expect(closeAction).not.toMatch(/\bsequence\s*:/u);
    expect(open).toMatch(
      /if \(active \|\| loading\) \{\s*return;\s*\}\s*activate\(\);/u,
    );
    expect(close).toMatch(
      /if \(!active && !loading\) \{\s*return;\s*\}\s*deactivate\(\);/u,
    );
    expect(controller).not.toMatch(/ScreenEdge|registerScreenEdge/u);
    expect(main).not.toContain("ShortcutHandler");
  });

  it("recreates one configured vertical touchpad gesture pair", () => {
    const applySettings = controller.slice(
      controller.indexOf("function applyTouchpadGestureSettings("),
      controller.indexOf("function rebuildTouchpadGesture("),
    );
    const rebuild = controller.slice(
      controller.indexOf("function rebuildTouchpadGesture("),
      controller.indexOf("function openFromTouchpadGesture("),
    );
    const open = controller.slice(
      controller.indexOf("function openFromTouchpadGesture("),
      controller.indexOf("function closeFromTouchpadGesture("),
    );
    const close = controller.slice(
      controller.indexOf("function closeFromTouchpadGesture("),
      controller.indexOf("function activate("),
    );

    expect(main).toContain(
      "readonly property bool configuredTouchpadGesture: touchpadGestureEnabledFromConfig()",
    );
    expect(main).toContain(
      "readonly property int configuredTouchpadGestureFingerCount: touchpadGestureFingerCountFromConfig()",
    );
    expect(main).toContain("configuration.TouchpadGesture");
    expect(main).toContain("configuration.TouchpadGestureFingerCount");
    expect(main).toContain(
      "controller.applyTouchpadGestureSettings(configuredTouchpadGesture,",
    );
    expect(main).toContain("configuredTouchpadGestureFingerCount);");
    expect(main).toContain(
      "onConfiguredTouchpadGestureChanged: syncTouchpadGestureSettings()",
    );
    expect(main).toContain(
      "onConfiguredTouchpadGestureFingerCountChanged: syncTouchpadGestureSettings()",
    );

    expect(controller).toContain("property bool touchpadGestureEnabled: false");
    expect(controller).toContain("property int touchpadGestureFingerCount: 4");
    expect(controller).toMatch(
      /readonly property Loader touchpadGestureLoader: Loader \{\s*active: false\s*\}/u,
    );
    expect(controller).toContain("target: touchpadGestureLoader.item");
    expect(controller).toContain("controller.openFromTouchpadGesture()");
    expect(controller).toContain("controller.closeFromTouchpadGesture()");

    expect(applySettings).toContain("const nextEnabled = enabled === true;");
    expect(applySettings).toContain("Number(fingerCount)");
    expect(applySettings).toContain("numericFingerCount >= 3");
    expect(applySettings).toContain("numericFingerCount <= 5");
    expect(applySettings).toMatch(/\? numericFingerCount\s*: 4;/u);
    expect(applySettings.match(/rebuildTouchpadGesture\(\)/gu)).toHaveLength(1);

    expect(rebuild).toMatch(
      /touchpadGestureLoader\.active = false;\s*touchpadGestureLoader\.source = "";/u,
    );
    expect(rebuild).toMatch(
      /if \(!touchpadGestureEnabled\) \{\s*return;\s*\}/u,
    );
    expect(rebuild).toContain(
      'touchpadGestureLoader.setSource("OverviewTouchpadGesture.qml", {',
    );
    expect(rebuild).toContain("fingerCount: touchpadGestureFingerCount");
    expect(rebuild.indexOf("setSource(")).toBeGreaterThan(
      rebuild.indexOf("if (!touchpadGestureEnabled)"),
    );
    expect(
      rebuild.indexOf("touchpadGestureLoader.active = true"),
    ).toBeGreaterThan(rebuild.indexOf("setSource("));

    expect(open).toMatch(/open\(\);/u);
    expect(close).toMatch(/close\(\);/u);

    expect(
      touchpadGesture.match(/KWin\.SwipeGestureHandler \{/gu),
    ).toHaveLength(2);
    expect(touchpadGesture).toContain("required property int fingerCount");
    expect(
      touchpadGesture.match(
        /deviceType: KWin\.SwipeGestureHandler\.Device\.Touchpad/gu,
      ),
    ).toHaveLength(2);
    expect(
      touchpadGesture.match(/fingerCount: root\.fingerCount/gu),
    ).toHaveLength(2);
    expect(touchpadGesture).toMatch(
      /direction: KWin\.SwipeGestureHandler\.Direction\.Up[\s\S]*onActivated: root\.openRequested\(\)/u,
    );
    expect(touchpadGesture).toMatch(
      /direction: KWin\.SwipeGestureHandler\.Direction\.Down[\s\S]*onActivated: root\.closeRequested\(\)/u,
    );
    expect(touchpadGesture).toContain(
      'Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")',
    );
    expect(touchpadGesture).toContain(
      'Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")',
    );
    expect(touchpadGesture.match(/console\.info\(/gu)).toHaveLength(2);
    expect(touchpadGesture).not.toMatch(
      /onCancelled|onProgressChanged|\bprogress\s*:|ShortcutHandler|sequence\s*:|Timer/iu,
    );
  });

  it("opens from one optional pointer edge and applies a safe backdrop", () => {
    const screenEdgeHandler = main.slice(
      main.indexOf("KWin.ScreenEdgeHandler {"),
      main.indexOf("onControllerChanged:"),
    );
    const screenEdgeMapping = main.slice(
      main.indexOf("function screenEdgeFromConfig()"),
      main.indexOf("function backdropColorFromConfig()"),
    );
    const backdropColor = main.slice(
      main.indexOf("function backdropColorFromConfig()"),
      main.indexOf("function validColorChannel("),
    );

    expect(main.match(/KWin\.ScreenEdgeHandler\s*\{/gu)).toHaveLength(1);
    expect(main).toContain(
      "readonly property int configuredScreenEdge: screenEdgeFromConfig()",
    );
    expect(screenEdgeHandler).toContain("edge: effect.configuredScreenEdge");
    expect(screenEdgeHandler).toContain(
      "enabled: edge !== KWin.ScreenEdgeHandler.NoEdge",
    );
    expect(screenEdgeHandler).toContain("mode: KWin.ScreenEdgeHandler.Pointer");
    expect(screenEdgeHandler).toContain("onActivated: effect.activate()");
    expect(screenEdgeHandler).not.toContain("toggle()");

    for (const [configured, edge] of [
      ["top-left", "TopLeftEdge"],
      ["top", "TopEdge"],
      ["top-right", "TopRightEdge"],
      ["right", "RightEdge"],
      ["bottom-right", "BottomRightEdge"],
      ["bottom", "BottomEdge"],
      ["bottom-left", "BottomLeftEdge"],
      ["left", "LeftEdge"],
    ] as const) {
      expect(screenEdgeMapping).toContain(`case "${configured}":`);
      expect(screenEdgeMapping).toContain(
        `return KWin.ScreenEdgeHandler.${edge};`,
      );
    }
    expect(screenEdgeMapping).toMatch(
      /default:\s*return KWin\.ScreenEdgeHandler\.NoEdge;/u,
    );
    expect(screenEdgeMapping).not.toMatch(/registerScreenEdge|Timer/u);

    expect(main).toContain(
      "readonly property color backdropColor: backdropColorFromConfig()",
    );
    expect(backdropColor).toContain('const fallback = "#e60b0f17"');
    expect(backdropColor).toContain("configuration.BackdropColor");
    expect(backdropColor).toContain("validColorChannel(value.a)");
    expect(scene).toMatch(
      /color: sceneEffect && sceneEffect\.backdropColor !== undefined\s*\? sceneEffect\.backdropColor\s*: "#e60b0f17"/u,
    );
  });

  it("keeps a fixed scene-effect proxy over the cache-busted controller", () => {
    expect(createHash("sha256").update(main, "utf8").digest("hex")).toBe(
      "a316fd1b56a2f355a8c08e6f7ae80219a02ba28c59e7575ccb113fb105d54f11",
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
    expect(reader).toContain("property int requestId: 0");
    expect(reader).toContain("signal ready(int requestId, string document)");
    expect(reader).toContain("signal rejected(int requestId)");
    expect(reader).toContain("function sample(requestId)");
    expect(reader).toContain("root.requestId = requestId");
    expect(reader).toContain("root.requestId = 0");
    expect(reader).toMatch(
      /function cancel\(\) \{[\s\S]*requestId = 0;[\s\S]*\}/u,
    );
    expect(reader).toContain("root.firstSample === secondSample");
    expect(reader).toContain("root.firstSample.length > 0");
    expect(reader).not.toMatch(/setValue|repeat:\s*true/u);
  });

  it("reports only the current rejected activation through one passive OSD", () => {
    const toggle = controller.slice(
      controller.indexOf("function toggle()"),
      controller.indexOf("function activate()"),
    );
    const activate = controller.slice(
      controller.indexOf("function activate()"),
      controller.indexOf("function deactivate()"),
    );
    const deactivate = controller.slice(
      controller.indexOf("function deactivate()"),
      controller.indexOf("function acceptLayoutState("),
    );
    const plasmaOverview = controller.slice(
      controller.indexOf("function plasmaOverviewIsActive("),
      controller.indexOf("function cancelPendingActivation("),
    );
    const cancelPending = controller.slice(
      controller.indexOf("function cancelPendingActivation("),
      controller.indexOf("function acceptLayoutState("),
    );
    const accept = controller.slice(
      controller.indexOf("function acceptLayoutState("),
      controller.indexOf("function rejectLayoutState("),
    );
    const reject = controller.slice(
      controller.indexOf("function rejectLayoutState("),
      controller.indexOf("function liveSnapshot()"),
    );

    expect(controller.match(/KWin\.DBusCall\s*\{/gu)).toHaveLength(1);
    expect(controller).toContain('service: "org.kde.plasmashell"');
    expect(controller).toContain('path: "/org/kde/osdService"');
    expect(controller).toContain('dbusInterface: "org.kde.osdService"');
    expect(controller).toContain('method: "showText"');
    expect(controller).toContain(
      '["dialog-warning", "Could not open Driftile overview"]',
    );
    expect(controller.match(/rejectionOsdCall\.call\(\)/gu)).toHaveLength(1);

    expect(controller).toContain("property int lastActivationAttemptId: 0");
    expect(controller).toContain("property int pendingActivationAttemptId: 0");
    expect(controller).toContain(
      "onReady: (attemptId, document) => controller.acceptLayoutState(attemptId, document)",
    );
    expect(controller).toContain(
      'onRejected: attemptId => controller.rejectLayoutState(attemptId, "unstable-state")',
    );
    expect(activate).toContain("pendingActivationAttemptId = attemptId");
    expect(activate).toContain("layoutStateReader.sample(attemptId)");
    expect(activate).toMatch(
      /if \(active \|\| loading \|\| plasmaOverviewIsActive\(\)\) \{\s*return;\s*\}/u,
    );
    expect(deactivate).toMatch(
      /pendingActivationAttemptId = 0;[\s\S]*layoutStateReader\.cancel\(\)/u,
    );
    expect(plasmaOverview).toMatch(
      /const workspace = KWin\.Workspace;[\s\S]*workspace\.isEffectActive\("overview"\) === true;/u,
    );
    expect(cancelPending).toMatch(
      /if \(!loading \|\| active \|\| attemptId <= 0 \|\| attemptId !== pendingActivationAttemptId\) \{\s*return false;\s*\}[\s\S]*layoutStateReader\.cancel\(\);[\s\S]*return true;/u,
    );
    expect(accept).toContain("attemptId !== pendingActivationAttemptId");
    expect(accept).toMatch(
      /if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}[\s\S]*runtime\.loadOverviewModel\([\s\S]*if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}[\s\S]*overviewModel = result\.value;/u,
    );
    expect(accept).toMatch(
      /pendingActivationAttemptId = 0;[\s\S]*overviewModel = result\.value;[\s\S]*loading = false;[\s\S]*active = true;/u,
    );
    expect(reject).toContain("attemptId !== pendingActivationAttemptId");
    expect(reject).toMatch(
      /if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}/u,
    );
    expect(reject).toContain("activation rejected reason=${reason}");

    const guard = reject.indexOf("if (!loading || active");
    const reset = reject.indexOf("deactivate();");
    const warning = reject.indexOf("console.warn(");
    const argumentsWrite = reject.indexOf("rejectionOsdCall.arguments =");
    const call = reject.indexOf("rejectionOsdCall.call();");
    expect(guard).toBeGreaterThan(0);
    expect(reset).toBeGreaterThan(guard);
    expect(warning).toBeGreaterThan(reset);
    expect(argumentsWrite).toBeGreaterThan(warning);
    expect(call).toBeGreaterThan(argumentsWrite);

    expect(`${toggle}\n${activate}\n${deactivate}\n${accept}`).not.toContain(
      "rejectionOsdCall",
    );
    expect(`${plasmaOverview}\n${cancelPending}`).not.toMatch(
      /rejectionOsdCall|console\.(?:warn|error)|KWin\.DBusCall|\b(?:activateEffect|deactivateEffect|loadEffect|reconfigureEffect|setEffectActive|toggleEffect|unloadEffect)\s*\(/u,
    );
    expect(reject).not.toMatch(
      /\b(?:Timer|Settings|ShortcutHandler|MouseArea)\s*\{|\.setValue\s*\(|KWin\.Workspace\./u,
    );
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
    expect(scene).toContain("function onCurrentActivityChanged()");
    expect(scene).toContain("function onActivitiesChanged()");
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
    const windowWrites =
      qmlSources
        .join("\n")
        .match(/(?:model\.window|candidate)\.[A-Za-z0-9_]+\s*=(?!=)/gu) ?? [];
    expect(windowWrites.map((write) => write.replace(/\s*=$/u, ""))).toEqual([
      "candidate.minimized",
      "candidate.desktops",
      "candidate.desktops",
      "candidate.desktops",
    ]);
    expect(qmlSources.join("\n")).not.toMatch(/\.setValue\s*\(/u);
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
      scene.indexOf("function windowFocusStateIsExact("),
    );
    const windowFocusState = scene.slice(
      scene.indexOf("function windowFocusStateIsExact("),
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
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );

    expect(numberGutter).toContain("acceptedButtons: Qt.LeftButton");
    expect(thumbnail).toContain("acceptedButtons: Qt.LeftButton");
    expect(tab).toContain("acceptedButtons: Qt.LeftButton");
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
    expect(tab).toContain(
      "enabled: tabShell.visible && tabShell.activationEligible && card.desktop && card.screen",
    );
    expect(tab).toContain("? windowPresentation.minimizedActivationEligible");
    expect(tab).toContain(": !windowPresentation.tiledPresentation.selected");
    expect(tab).toContain(
      "readonly property bool keyboardTarget: activationEligible && windowPresentation.matchesSearch",
    );
    expect(tab).toContain("visible: frame !== null && model.window");
    expect(tab).toContain(
      "opacity: windowPresentation.minimizedWindow ? 0.6 : 1",
    );
    expect(tab).toContain(
      'color: windowPresentation.minimizedWindow ? "#8a96a8" : "#f3f7ff"',
    );
    expect(tab).toContain(
      "text: windowPresentation.windowLabel ? windowPresentation.windowLabel.primary",
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
    expect(focusHandler).toContain(
      "const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;",
    );
    expect(focusHandler).toMatch(
      /desktopContextIsExact\(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,\s*expectedDesktopId\) \|\| !windowContextIsExact\(candidate, expectedWindowId,\s*liveScreen, liveDesktop,\s*expectedDesktopId,\s*expectedActivityId\)\s*\|\| !windowFocusStateIsExact\(candidate, expectedMinimized, false\)\s*\|\| \(expectedMinimized && candidate\.managed !== true\)/u,
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
      /windowContextIsExact\(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,\s*expectedActivityId\)\s*&& windowFocusStateIsExact\(candidate, false, true\)/u,
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
    expect(windowContext).toContain("candidate.wantsInput === true");
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
    expect(windowContext).not.toContain("candidate.minimized");
    expect(windowContext).not.toContain("candidate.hidden");
    expect(windowFocusState).toContain(
      "candidate.minimized === expectedMinimized",
    );
    expect(windowFocusState).toContain("(!rejectHidden || !candidate.hidden)");
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
      /if \(focusConfirmed \|\| \(!expectedMinimized && desktopSelectionConfirmed\)\) \{\s*effect\.deactivate\(\);\s*\}/u,
    );

    const minimizedSnapshot = focusHandler.indexOf(
      "const expectedMinimized = candidate !== null",
    );
    const preSelectionValidation = focusHandler.indexOf(
      "windowFocusStateIsExact(candidate, expectedMinimized, false)",
    );
    const desktopRequest = focusHandler.indexOf("requestDesktopSelection(");
    const selectedFlag = focusHandler.indexOf(
      "desktopSelectionConfirmed = true;",
    );
    const minimizedBranch = focusHandler.indexOf("if (expectedMinimized) {");
    const preRestoreValidation = focusHandler.indexOf(
      "windowFocusStateIsExact(candidate, true, false)",
    );
    const restoreWrite = focusHandler.indexOf("candidate.minimized = false");
    const postRestoreValidation = focusHandler.indexOf(
      "windowFocusStateIsExact(candidate, false, true)",
      restoreWrite,
    );
    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = candidate",
    );
    const focusConfirmation = focusHandler.indexOf(
      "focusConfirmed = KWin.Workspace.activeWindow === candidate;",
    );
    const postFocusValidation = focusHandler.lastIndexOf(
      "windowFocusStateIsExact(candidate, false, true)",
    );
    const deactivate = focusHandler.indexOf("effect.deactivate()");
    expect(minimizedSnapshot).toBeGreaterThan(0);
    expect(preSelectionValidation).toBeGreaterThan(0);
    expect(preSelectionValidation).toBeGreaterThan(minimizedSnapshot);
    expect(desktopRequest).toBeGreaterThan(preSelectionValidation);
    expect(selectedFlag).toBeGreaterThan(desktopRequest);
    expect(minimizedBranch).toBeGreaterThan(selectedFlag);
    expect(preRestoreValidation).toBeGreaterThan(minimizedBranch);
    expect(restoreWrite).toBeGreaterThan(preRestoreValidation);
    expect(postRestoreValidation).toBeGreaterThan(restoreWrite);
    expect(activeWindowWrite).toBeGreaterThan(postRestoreValidation);
    expect(focusConfirmation).toBeGreaterThan(activeWindowWrite);
    expect(postFocusValidation).toBeGreaterThan(focusConfirmation);
    expect(deactivate).toBeGreaterThan(focusConfirmation);
    expect(deactivate).toBeGreaterThan(activeWindowWrite);
    expect(focusHandler.match(/candidate\.minimized = false/gu)).toHaveLength(
      1,
    );
    expect(
      focusHandler.match(/windowFocusStateIsExact\(candidate, false, true\)/gu),
    ).toHaveLength(3);

    expect(scene).not.toContain("KWin.Workspace.stackingOrder");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /MouseArea|ShortcutHandler|\.setValue\s*\(/u,
    );
  });

  it("snapshots effect-window action fields outside live handler bindings", () => {
    const presentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const snapshot = desktopCard.slice(
      desktopCard.indexOf("function snapshotWindowActions("),
      desktopCard.indexOf("function windowSnapshotCanDrag("),
    );
    const snapshotDrag = desktopCard.slice(
      desktopCard.indexOf("function windowSnapshotCanDrag("),
      desktopCard.indexOf("function windowSnapshotCanRequestClose("),
    );
    const liveDrop = desktopCard.slice(
      desktopCard.indexOf("function windowDropIsValid("),
      desktopCard.indexOf("function windowDropSourceIsEligible("),
    );
    const snapshotClose = desktopCard.slice(
      desktopCard.indexOf("function windowSnapshotCanRequestClose("),
      desktopCard.indexOf("function windowCanDrag("),
    );
    const liveDrag = desktopCard.slice(
      desktopCard.indexOf("function windowCanDrag("),
      desktopCard.indexOf("function requestCrossOutputWindowDrop("),
    );
    const snapshotDrop = desktopCard.slice(
      desktopCard.indexOf("function windowDropSourceIsEligible("),
      desktopCard.indexOf("function windowIsActionable("),
    );

    expect(presentation).toContain("property var actionSnapshot: null");
    expect(presentation).toContain(
      "Component.onCompleted: refreshActionSnapshot()",
    );
    expect(presentation).toMatch(
      /onCandidateChanged: \{\s*refreshActionSnapshot\(\);\s*card\.attentionRevision \+= 1;\s*\}/u,
    );
    for (const signal of [
      "Closeable",
      "Deleted",
      "Desktops",
      "Managed",
      "Minimized",
      "Modal",
      "Moveable",
      "NormalWindow",
      "Output",
      "Transient",
      "TransientFor",
      "WantsInput",
    ]) {
      expect(presentation).toContain(`function on${signal}Changed()`);
    }
    expect(presentation).toContain(
      "enabled: thumbnailShell.visible && windowPresentation.dragEligible",
    );
    expect(presentation).toContain(
      "enabled: tabShell.visible && windowPresentation.closeEligible",
    );
    expect(presentation).toContain("wId: model.window.internalId");
    expect(presentation).not.toContain("card.windowCanDrag(");
    expect(presentation).not.toContain("card.windowCanRequestClose(");

    for (const property of [
      "candidate.closeable",
      "candidate.deleted",
      "candidate.desktops",
      "candidate.internalId",
      "candidate.managed",
      "candidate.minimized",
      "candidate.modal",
      "candidate.moveable",
      "candidate.normalWindow",
      "candidate.output",
      "candidate.transient",
      "candidate.transientFor",
      "candidate.wantsInput",
    ]) {
      expect(snapshot).toContain(property);
    }
    expect(snapshotDrag).toContain("snapshot.transient !== false");
    expect(snapshotDrag).toContain("snapshot.transientFor !== null");
    expect(snapshotDrag).toContain("snapshot.minimized");
    expect(snapshotDrag).toContain("desktops && desktops.length === 1");
    expect(liveDrag).toContain("candidate.minimized");
    expect(liveDrag).toContain("presentation.minimizedWindow");
    expect(snapshot).toContain("let desktops = null");
    expect(snapshotClose).toContain("if (!snapshot.desktops)");
    expect(snapshotClose).toContain(
      "snapshot.minimized !== (presentation.minimizedWindow === true)",
    );
    expect(snapshotClose).toContain(
      "candidate.minimized !== snapshot.minimized",
    );
    expect(snapshotDrop).toContain("source.dragEligible === true");
    expect(snapshotDrop).not.toContain("windowCanDrag(");
    expect(desktopCard).toContain(
      "containsDrag && card.windowDropSourceIsEligible(drag.source, drag.keys)",
    );
    expect(liveDrop).toContain("windowCanDrag(source)");
    expect(desktopCard).toContain(
      "onEntered: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)",
    );
    expect(desktopCard).toContain(
      "onPositionChanged: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)",
    );
    expect(desktopCard).toContain(
      "if (!card.windowDropIsValid(source, drop.keys))",
    );
  });

  it("moves one exact live window through a guarded desktop drop", () => {
    const delegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf("Rectangle {", scene.indexOf("DesktopCard {")),
    );
    const transaction = scene.slice(
      scene.indexOf("function moveWindowToDesktop("),
      scene.indexOf("function windowDesktopDropSceneIsExact("),
    );
    const sceneGuard = scene.slice(
      scene.indexOf("function windowDesktopDropSceneIsExact("),
      scene.indexOf("function windowDesktopDropCandidateIsExact("),
    );
    const candidateGuard = scene.slice(
      scene.indexOf("function windowDesktopDropCandidateIsExact("),
      scene.indexOf("function orderedDesktopIds("),
    );

    expect(desktopCard).toMatch(
      /signal windowDropped\(var candidate, string expectedWindowId, var expectedSourceDesktop,\s*string expectedSourceDesktopId, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedScreen\)/u,
    );
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(3);
    expect(desktopCard.match(/\bDropArea\s*\{/gu)).toHaveLength(1);
    expect(desktopCard.match(/\.Drag\.active = true;/gu)).toHaveLength(2);
    expect(desktopCard.match(/\.Drag\.active = false;/gu)).toHaveLength(6);
    expect(delegate).toMatch(
      /onWindowDropped:\s*\(candidate, expectedWindowId, expectedSourceDesktop, expectedSourceDesktopId,\s*expectedTargetDesktop, expectedTargetDesktopId, expectedScreen\)\s*=>\s*root\.moveWindowToDesktop\(candidate, expectedWindowId, expectedSourceDesktop,\s*expectedSourceDesktopId, expectedTargetDesktop,\s*expectedTargetDesktopId, expectedScreen\)/u,
    );

    expect(transaction).toContain("const effect = sceneEffect;");
    expect(transaction).toContain("const model = overviewModel;");
    expect(transaction).toContain(
      "const liveScreen = liveScreenFor(expectedScreen);",
    );
    expect(transaction).toContain(
      "const expectedOutput = projectedOutput(model, liveScreen);",
    );
    expect(transaction).toContain(
      "liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId)",
    );
    expect(transaction).toContain(
      "liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId)",
    );
    expect(transaction).toContain(
      'typeof runtime.planOverviewWindowDesktopDrop !== "function"',
    );
    expect(transaction).toContain(
      "accepted = runtime.planOverviewWindowDesktopDrop(model, {",
    );
    for (const field of [
      "sourceDesktopId: expectedSourceDesktopId",
      "sourceOutputId: expectedOutputId",
      "targetDesktopId: expectedTargetDesktopId",
      "targetOutputId: expectedOutputId",
      "windowId: expectedWindowId",
    ]) {
      expect(transaction).toContain(field);
    }
    expect(transaction).toContain("}) === true;");
    expect(transaction).toContain("catch (error)");
    expect(transaction.match(/windowDesktopDropSceneIsExact\(/gu)).toHaveLength(
      3,
    );
    expect(
      transaction.match(/windowDesktopDropCandidateIsExact\(/gu),
    ).toHaveLength(3);

    expect(sceneGuard).toContain("liveSourceDesktop !== liveTargetDesktop");
    expect(sceneGuard).toContain(
      "expectedSourceDesktopId !== expectedTargetDesktopId",
    );
    expect(sceneGuard.match(/desktopContextIsExact\(/gu)).toHaveLength(2);
    for (const guard of [
      "candidate.deleted",
      "candidate.minimized",
      "candidate.wantsInput !== true",
      "candidate.normalWindow !== true",
      "candidate.managed !== true",
      "candidate.moveable !== true",
      "candidate.modal !== false",
      "candidate.internalId === undefined",
      "candidate.internalId === null",
      "String(candidate.internalId) !== expectedWindowId",
      "candidate.output !== liveScreen",
      "String(KWin.Workspace.currentActivity) !== expectedActivityId",
      "!windowUsesActivity(candidate, expectedActivityId)",
      "candidate.transient !== false",
      "candidate.transientFor !== null",
      "desktops.length === 1",
      "desktops[0] === expectedDesktop",
      "String(desktops[0].id) === expectedDesktopId",
    ]) {
      expect(candidateGuard).toContain(guard);
    }

    expect(
      transaction.match(/candidate\.desktops\s*=\s*\[liveTargetDesktop\]/gu),
    ).toHaveLength(1);
    expect(transaction).toContain(
      "windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId)",
    );
    expect(transaction.match(/effect\.deactivate\(\)/gu)).toHaveLength(1);

    const initialValidation = transaction.indexOf(
      "if (!windowDesktopDropSceneIsExact(",
    );
    const planner = transaction.indexOf(
      "accepted = runtime.planOverviewWindowDesktopDrop(",
    );
    const preWriteValidation = transaction.indexOf("if (!accepted", planner);
    const desktopWrite = transaction.indexOf(
      "candidate.desktops = [liveTargetDesktop]",
    );
    const confirmation = transaction.indexOf(
      "if (!windowDesktopDropSceneIsExact(",
      desktopWrite,
    );
    const sourceGone = transaction.indexOf(
      "windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId)",
      desktopWrite,
    );
    const deactivate = transaction.indexOf("effect.deactivate()");
    expect(initialValidation).toBeGreaterThan(0);
    expect(planner).toBeGreaterThan(initialValidation);
    expect(preWriteValidation).toBeGreaterThan(planner);
    expect(desktopWrite).toBeGreaterThan(preWriteValidation);
    expect(confirmation).toBeGreaterThan(desktopWrite);
    expect(sourceGone).toBeGreaterThan(confirmation);
    expect(deactivate).toBeGreaterThan(sourceGone);

    expect(transaction).not.toMatch(
      /KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|candidate\.(?:output|geometry|frameGeometry)\s*=(?!=)|org\.kde\.kwin\.private|\bTimer\s*\{|setTimeout|\.setValue\s*\(/u,
    );
  });

  it("moves one exact live window across outputs and compensates partial writes", () => {
    const sourceHandlers = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailDragHandler"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const transport = desktopCard.slice(
      desktopCard.indexOf("function requestCrossOutputWindowDrop("),
      desktopCard.indexOf("function windowDropIsValid("),
    );
    const effectConnections = scene.slice(
      scene.indexOf("target: root.sceneEffect"),
      scene.indexOf("target: KWin.Workspace"),
    );
    const targetResolution = scene.slice(
      scene.indexOf("function handleCrossOutputWindowDrop("),
      scene.indexOf("function moveWindowAcrossOutputs("),
    );
    const transaction = scene.slice(
      scene.indexOf("function moveWindowAcrossOutputs("),
      scene.indexOf("function settleFailedCrossOutputWindowDrop("),
    );
    const settlement = scene.slice(
      scene.indexOf("function settleFailedCrossOutputWindowDrop("),
      scene.indexOf("function crossOutputDropSceneIsExact("),
    );
    const sceneGuard = scene.slice(
      scene.indexOf("function crossOutputDropSceneIsExact("),
      scene.indexOf("function moveWindowToDesktop("),
    );

    expect(
      sourceHandlers.match(/const action = .*\.Drag\.drop\(\);/gu),
    ).toHaveLength(2);
    expect(sourceHandlers.match(/action === Qt\.MoveAction/gu)).toHaveLength(2);
    expect(
      sourceHandlers.match(
        /card\.requestCrossOutputWindowDrop\(source, point\)/gu,
      ),
    ).toHaveLength(2);
    expect(transport).toContain("screen.mapToGlobal(point.scenePosition)");
    expect(transport).toContain(
      'typeof effect.checkItemDroppedOutOfScreen !== "function"',
    );
    expect(transport).toContain(
      "effect.checkItemDroppedOutOfScreen(globalPosition, source)",
    );

    expect(effectConnections).toMatch(
      /function onItemDroppedOutOfScreen\(globalPosition, source, screen\)\s*\{\s*root\.handleCrossOutputWindowDrop\(globalPosition, source, screen\);\s*\}/u,
    );
    expect(targetResolution).toContain(
      "const targetCard = crossOutputDropTargetAt(globalPosition, expectedTargetScreen);",
    );
    expect(targetResolution).toContain(
      "liveTargetScreen.mapFromGlobal(globalPosition)",
    );
    expect(targetResolution).toContain(
      "for (let index = 0; index < desktopRepeater.count; index += 1)",
    );
    expect(targetResolution).toContain(
      "candidate.mapFromItem(root, localPosition.x, localPosition.y)",
    );
    expect(targetResolution).toMatch(
      /if \(targetCard\) \{\s*return null;\s*\}/u,
    );
    expect(targetResolution).toContain(
      "moveWindowAcrossOutputs(source.candidate, source.windowId, source.sourceDesktop,",
    );

    expect(transaction).toContain(
      'typeof KWin.Workspace.sendClientToScreen !== "function"',
    );
    expect(transaction).toContain(
      "accepted = runtime.planOverviewWindowDesktopDrop(model, {",
    );
    for (const field of [
      "sourceDesktopId: expectedSourceDesktopId",
      "sourceOutputId",
      "targetDesktopId: expectedTargetDesktopId",
      "targetOutputId",
      "windowId: expectedWindowId",
    ]) {
      expect(transaction).toContain(field);
    }
    expect(transaction).toContain(
      "const targetWorkspaceOutput = workspaceOutputAt(globalPosition);",
    );
    expect(transaction).toContain(
      "KWin.Workspace.sendClientToScreen(candidate, targetWorkspaceOutput)",
    );
    expect(transaction).toContain("candidate.output !== targetWorkspaceOutput");
    expect(transaction).toContain("candidate.desktops = [liveTargetDesktop]");
    expect(
      (transaction.match(/crossOutputDropSceneIsExact\(state\)/gu) ?? [])
        .length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      (transaction.match(/windowDesktopDropCandidateIsExact\(/gu) ?? []).length,
    ).toBeGreaterThanOrEqual(4);
    expect(transaction).toContain(
      "windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId)",
    );
    expect(transaction).toContain("effect.deactivate();");

    const outputWrite = transaction.indexOf(
      "KWin.Workspace.sendClientToScreen(candidate, targetWorkspaceOutput)",
    );
    const outputConfirmation = transaction.indexOf(
      "candidate.output !== targetWorkspaceOutput",
      outputWrite,
    );
    const desktopWrite = transaction.indexOf(
      "candidate.desktops = [liveTargetDesktop]",
      outputConfirmation,
    );
    const finalConfirmation = transaction.lastIndexOf(
      "windowDesktopDropCandidateIsExact(",
    );
    const deactivate = transaction.indexOf("effect.deactivate();");
    expect(outputWrite).toBeGreaterThan(0);
    expect(outputConfirmation).toBeGreaterThan(outputWrite);
    expect(desktopWrite).toBeGreaterThan(outputConfirmation);
    expect(finalConfirmation).toBeGreaterThan(desktopWrite);
    expect(deactivate).toBeGreaterThan(finalConfirmation);

    expect(settlement).toContain("compensateCrossOutputWindowDrop(state)");
    expect(settlement).toContain(
      "state.candidate.desktops = [state.liveSourceDesktop]",
    );
    expect(settlement).toContain(
      "KWin.Workspace.sendClientToScreen(state.candidate, state.sourceWorkspaceOutput)",
    );
    expect(settlement).toContain("state.effect.deactivate();");
    expect(sceneGuard).toContain(
      "state.liveSourceScreen === state.liveTargetScreen",
    );
    expect(sceneGuard).toContain("state.sourceOutput === state.targetOutput");
    expect(sceneGuard).toContain(
      "state.sourceOutputId === state.targetOutputId",
    );
    expect(sceneGuard).toContain(
      "workspaceOutputAt(state.targetGlobalPosition) !== state.targetWorkspaceOutput",
    );
    expect(sceneGuard).toContain(
      "state.sourceWorkspaceOutput !== state.liveSourceScreen",
    );
    expect(sceneGuard).toContain(
      "state.targetWorkspaceOutput !== state.liveTargetScreen",
    );
    expect(scene).not.toContain("function workspaceOutputMatchesSceneScreen(");
    expect(sceneGuard).toContain(
      "projectedOutput(state.model, state.liveSourceScreen) !== state.sourceOutput",
    );
    expect(sceneGuard).toContain(
      "projectedOutput(state.model, state.liveTargetScreen) !== state.targetOutput",
    );

    expect(
      `${transport}\n${targetResolution}\n${transaction}\n${settlement}\n${sceneGuard}`,
    ).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|setTimeout|\.setValue\s*\(|candidate\.(?:output|geometry|frameGeometry)\s*=(?!=)/u,
    );
  });

  it("reorders live desktop cards only through one guarded gutter drag", () => {
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const reorderDelegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf("Rectangle {", scene.indexOf("DesktopCard {")),
    );
    const reorder = scene.slice(
      scene.indexOf("function beginDesktopReorder("),
      scene.indexOf("function collectNavigationTargets("),
    );
    const staleClose = scene.slice(
      scene.indexOf("function closeStaleOverview("),
      scene.indexOf("function outputIdForScreen("),
    );

    expect(numberGutter.match(/\bDragHandler\s*\{/gu)).toHaveLength(1);
    expect(numberGutter).toContain("target: null");
    expect(numberGutter).toContain("acceptedButtons: Qt.LeftButton");
    expect(numberGutter).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(numberGutter).toContain("acceptedModifiers: Qt.NoModifier");
    expect(numberGutter).toContain("onGrabChanged:");
    expect(numberGutter).toContain("PointerDevice.GrabExclusive");
    expect(numberGutter).toContain("PointerDevice.UngrabExclusive");
    expect(numberGutter).toContain("PointerDevice.CancelGrabExclusive");
    expect(numberGutter).toContain("point.state === EventPoint.Released");
    expect(numberGutter).toContain("point.scenePosition.x");
    expect(numberGutter).toContain("point.scenePosition.y");
    expect(numberGutter).toContain("card.desktopReorderReleased(");
    expect(numberGutter).toContain("card.desktopReorderCanceled(");

    expect(controller).toContain("import QtCore");
    expect(controller).toContain(
      'category: "Script-io.github.kontonkara.driftile"',
    );
    expect(controller).toContain(
      'StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/kwinrc"',
    );
    expect(controller).toContain(
      'mainScriptSettings.value("EmptyDesktopAboveFirst", false) === true',
    );
    expect(controller).toContain("mainScriptSettings.sync()");
    expect(reorderDelegate).toContain(
      "root.desktopIds.length > (root.emptyDesktopAboveFirst ? 3 : 2)",
    );
    expect(reorderDelegate).toContain(
      "index >= (root.emptyDesktopAboveFirst ? 1 : 0)",
    );
    expect(reorderDelegate).toContain("index < root.desktopIds.length - 1");
    expect(scene).toContain(
      "visible: root.desktopReorderActive && root.desktopReorderInsertionSlot >= 0",
    );
    expect(reorder).toContain("runtime.planOverviewDesktopDrop(");
    expect(reorder).toContain("desktopReorderEmptyDesktopAboveFirst");
    expect(reorder).toContain(
      "keepEmptyDesktopAboveFirst === emptyDesktopAboveFirstFromConfig()",
    );
    expect(reorder).toContain(
      "point.y < movableTop || point.y >= protectedTop",
    );
    expect(reorder).toContain("root.mapFromItem(null, sceneX, sceneY)");
    expect(reorder).toContain(
      'typeof KWin.Workspace.moveDesktop === "function"',
    );
    expect(reorder.match(/KWin\.Workspace\.moveDesktop\(/gu)).toHaveLength(1);
    expect(reorder).not.toContain("deactivate()");
    expect(staleClose).toMatch(
      /resetDesktopReorder\(\);\s*if \(sceneEffect\) \{\s*sceneEffect\.deactivate\(\);/u,
    );
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\b(?:MouseArea|Timer)\s*\{|KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
    );
  });

  it("shows one fail-closed active-column layout badge with constant-time lookup", () => {
    const badge = desktopCard.slice(
      desktopCard.indexOf("id: activeColumnBadge"),
      desktopCard.indexOf("function collectNavigationTargets("),
    );
    const badgeFormatters = desktopCard.slice(
      desktopCard.indexOf("function layoutBadgeLabel("),
      desktopCard.indexOf("function heightsForMembers("),
    );

    expect(desktopCard.match(/id: activeColumnBadge\b/gu)).toHaveLength(1);
    expect(desktopCard).toContain("id: columnRepeater");
    expect(desktopCard).toContain(
      "onItemAdded: card.columnDelegateRevision += 1",
    );
    expect(desktopCard).toContain(
      "onItemRemoved: card.columnDelegateRevision += 1",
    );
    expect(badge).toContain("card.context.activeColumnIndex");
    expect(badge).toContain("card.context.columns[activeColumnIndex]");
    expect(badge).toContain("card.columnDelegateRevision");
    expect(desktopCard).toContain("return repeater.itemAt(columnIndex)");
    expect(badge).toContain("Math.max(0, activeColumnShell.x)");
    expect(badge).toContain(
      "Math.min(viewport.width, activeColumnShell.x + activeColumnShell.width)",
    );
    expect(badge).toContain("y: viewport.height - height - 4");
    expect(badge).toContain("viewport.height >= 28");
    expect(badge).toContain("visibleWidth >= labelWidth + 20");
    expect(badgeFormatters).toContain('column.presentation !== "stacked"');
    expect(badgeFormatters).toContain('column.presentation !== "tabbed"');
    expect(badgeFormatters).toContain(
      "`${column.presentation} · ${widthLabel}`",
    );
    expect(badgeFormatters).toContain('width.kind === "fixed"');
    expect(badgeFormatters).toContain('width.kind !== "proportion"');
    expect(badgeFormatters).toContain('"<1 px"');
    expect(badgeFormatters).toContain("`${Math.round(width.value)} px`");
    expect(badgeFormatters).toContain('return "<0.1%"');
    expect(badgeFormatters).toContain("`${whole}.${fraction}%`");
    expect(`${badge}\n${badgeFormatters}`).not.toMatch(
      /columnFrame\(|\b(?:for|while)\s*\(|\.(?:map|reduce)\(|KWin\.|WindowModel|\b[A-Za-z][A-Za-z0-9]*Handler\s*\{|MouseArea|Behavior|Animation/u,
    );
  });

  it("projects exact minimized windows as fail-closed compact placeholders", () => {
    const presentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const planner = desktopCard.slice(
      desktopCard.indexOf("function planMinimizedPlaceholderFrame("),
      desktopCard.indexOf("function boundedWindowCaption("),
    );

    expect(overviewRuntimeIndex).toContain(
      'export { planOverviewMinimizedPlaceholder } from "./minimized-placeholder";',
    );
    expect(desktopCard).toContain(
      'import "../code/main.js" as OverviewRuntime',
    );
    expect(presentation).toContain(
      "readonly property bool minimizedActivationEligible: minimizedWindow",
    );
    expect(presentation).toContain(
      "card.windowSnapshotCanActivateMinimizedWindow(windowPresentation)",
    );
    expect(presentation).toContain(
      "readonly property bool hasMinimizedTabFrame: tiledPresentation && tiledPresentation.tabFrame !== null",
    );
    expect(presentation).toContain(
      "readonly property var minimizedPlaceholderFrame: minimizedActivationEligible",
    );
    expect(presentation).toContain(
      "card.planMinimizedPlaceholderFrame(frame, hasMinimizedTabFrame)",
    );
    expect(presentation).toContain(
      "readonly property var minimizedPlaceholderTarget: minimizedPlaceholderShell",
    );
    expect(presentation).toContain(
      "onMinimizedPlaceholderFrameChanged: card.navigationTargetsChanged()",
    );

    expect(planner).toContain(
      "hasMinimizedTabFrame === true || !frame || !viewport || viewport.width <= 0 || viewport.height <= 0",
    );
    expect(planner).toContain("OverviewRuntime.DriftileOverview");
    expect(planner).toContain(
      'typeof runtime.planOverviewMinimizedPlaceholder !== "function"',
    );
    expect(planner).toContain(
      "runtime.planOverviewMinimizedPlaceholder(frame, {",
    );
    expect(planner).toContain(
      'if (!planned || Array.isArray(planned) || typeof planned !== "object")',
    );
    expect(planner).toContain("!Number.isFinite(width)");
    expect(planner).toContain("width < 24 || height < 12");
    expect(planner).toContain("width > 180 || height > 28");
    expect(planner).toContain("x < frameLeft || y < frameTop");
    expect(planner).toContain(
      "x + width > frameRight || y + height > frameBottom",
    );
    expect(planner).toMatch(/catch \(error\) \{\s*return null;/u);

    expect(placeholder).toContain(
      "readonly property bool activationEligible: windowPresentation.minimizedActivationEligible",
    );
    expect(placeholder).toContain(
      "readonly property bool keyboardTarget: activationEligible && windowPresentation.matchesSearch",
    );
    expect(placeholder).toContain(
      "card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)",
    );
    expect(placeholder).toContain(
      "visible: frame !== null && model.window && windowPresentation.minimizedWindow",
    );
    expect(placeholder).toContain("&& windowPresentation.matchesSearch");
    expect(placeholder).toContain(
      '? `Minimized · ${windowPresentation.windowLabel.primary}` : "Minimized"',
    );
    expect(placeholder).toContain("textFormat: Text.PlainText");
    expect(placeholder).toContain("elide: Text.ElideRight");
    expect(placeholder).toContain("id: minimizedPlaceholderAttentionBadge");
    expect(placeholder).toContain(
      "visible: windowPresentation.attentionRequested",
    );
    expect(placeholder).toContain(
      "enabled: minimizedPlaceholderShell.visible && minimizedPlaceholderShell.activationEligible",
    );
    expect(placeholder).toContain(
      "card.windowTapped(model.window, windowPresentation.windowId, card.desktop,",
    );
    expect(placeholder).toContain(
      "enabled: minimizedPlaceholderShell.visible && windowPresentation.closeEligible",
    );
    expect(placeholder).toContain(
      "card.windowCloseRequested(windowPresentation.candidate,",
    );
    expect(`${planner}\n${placeholder}`).not.toMatch(
      /\b(?:Timer|Behavior|Animation|DragHandler|ShortcutHandler)\s*\{|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("labels visible windows through one fail-closed presentation plan", () => {
    const presentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: tabShell"),
    );
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const thumbnailFooterStart = thumbnail.indexOf("id: thumbnailLabelFooter");
    const thumbnailFooter = thumbnail.slice(
      thumbnailFooterStart,
      thumbnail.indexOf(
        "border.width: thumbnailShell.keyboardSelected ? 3 : 0",
        thumbnailFooterStart,
      ),
    );
    const tabLabelStart = tab.indexOf("Text {");
    const tabLabel = tab.slice(
      tabLabelStart,
      tab.indexOf("Rectangle {", tabLabelStart),
    );
    const placeholderLabelStart = placeholder.indexOf("Text {");
    const placeholderLabel = placeholder.slice(
      placeholderLabelStart,
      placeholder.indexOf("Rectangle {", placeholderLabelStart),
    );
    const planner = desktopCard.slice(
      desktopCard.indexOf("function planWindowLabel("),
      desktopCard.indexOf("function anyWindowDemandsAttention("),
    );
    const labelUi = `${thumbnailFooter}\n${tabLabel}\n${placeholderLabel}`;

    expect(overviewRuntimeIndex).toContain(
      'export { planOverviewWindowLabel } from "./window-label";',
    );
    expect(presentation).toMatch(
      /readonly property var windowLabel: card\.planWindowLabel\(candidate, matchesSearch && model\.window[\s\S]*!minimizedWindow && selectedThumbnail[\s\S]*\|\| hasMinimizedTabFrame[\s\S]*\|\| \(minimizedPlaceholderFrame !== null/u,
    );

    expect(thumbnailFooter).toMatch(
      /id: thumbnailLabelFooter[\s\S]*anchors\.left: parent\.left[\s\S]*anchors\.right: parent\.right[\s\S]*anchors\.bottom: parent\.bottom[\s\S]*anchors\.leftMargin: 5[\s\S]*anchors\.rightMargin: 5/u,
    );
    expect(thumbnailFooter).toContain(
      "visible: windowPresentation.windowLabel !== null && thumbnailShell.width >= 120",
    );
    expect(thumbnailFooter).toContain(
      "&& thumbnailShell.height >= (hasSecondary ? 72 : 52)",
    );
    expect(thumbnailFooter).toMatch(
      /clip: true[\s\S]*text: windowPresentation\.windowLabel \? windowPresentation\.windowLabel\.primary[\s\S]*text: windowPresentation\.windowLabel && windowPresentation\.windowLabel\.secondary !== null/u,
    );

    expect(tabLabel).toMatch(
      /text: windowPresentation\.windowLabel \? windowPresentation\.windowLabel\.primary[\s\S]*\? String\(windowPresentation\.tiledPresentation\.memberIndex \+ 1\)/u,
    );
    expect(placeholderLabel).toContain(
      '? `Minimized · ${windowPresentation.windowLabel.primary}` : "Minimized"',
    );
    for (const label of [thumbnailFooter, tabLabel, placeholderLabel]) {
      expect(label).toContain("elide: Text.ElideRight");
      expect(label).toContain("textFormat: Text.PlainText");
    }

    expect(thumbnailFooter).toContain(
      "anchors.bottomMargin: windowPresentation.attentionRequested ? 8 : 5",
    );
    expect(tabLabel).toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested ? 18 : 4",
    );
    expect(placeholderLabel).toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested",
    );
    for (const [visual, attentionBadge, keyboardBorder] of [
      [thumbnail, "thumbnailAttentionBadge", "thumbnailShell.keyboardSelected"],
      [tab, "tabAttentionBadge", "tabShell.keyboardSelected"],
      [
        placeholder,
        "minimizedPlaceholderAttentionBadge",
        "minimizedPlaceholderShell.keyboardSelected",
      ],
    ] as const) {
      expect(visual).toContain(`id: ${attentionBadge}`);
      expect(visual).toContain(
        "visible: windowPresentation.attentionRequested",
      );
      expect(visual).toMatch(
        new RegExp(
          `id: ${attentionBadge}[\\s\\S]*z: 2[\\s\\S]*border\\.width: ${keyboardBorder.replace(".", "\\.")} \\? 3 : 0[\\s\\S]*z: 3`,
          "u",
        ),
      );
    }

    expect(planner).toContain("if (eligible !== true || !candidate)");
    expect(planner).toContain(
      'typeof runtime.planOverviewWindowLabel !== "function"',
    );
    for (const field of [
      "caption",
      "desktopFileName",
      "resourceClass",
      "resourceName",
    ]) {
      expect(planner).toContain(`const ${field} = candidate.${field}`);
      expect(planner).toContain(`${field}: ${field} === null ? undefined`);
    }
    expect(planner).toContain(
      'if (!planned || Array.isArray(planned) || typeof planned !== "object")',
    );
    expect(planner).toMatch(
      /runtime\.planOverviewWindowLabel\(\{[\s\S]*!boundedPlainWindowLabel\(primary\)[\s\S]*secondary !== null && !boundedPlainWindowLabel\(secondary\)/u,
    );
    expect(planner).toContain(
      'typeof value !== "string" || value.length === 0 || value.length > 192',
    );
    expect(planner).toContain("if (codePoints > 96)");
    expect(planner).toMatch(/catch \(error\) \{\s*return null;/u);

    expect(labelUi).not.toMatch(
      /\b(?:TapHandler|DragHandler|Timer|Behavior|Animation|ShortcutHandler)\s*\{|^\s*import\s+|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|candidate\.[A-Za-z0-9_]+\s*=(?!=)/mu,
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
    const windowRepeaterHeader = desktopCard.slice(
      desktopCard.indexOf("id: windowRepeater"),
      desktopCard.indexOf("id: windowPresentation"),
    );
    const windowPresentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: tabShell"),
    );
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const attentionProjection = desktopCard.slice(
      desktopCard.indexOf("function anyWindowDemandsAttention("),
      desktopCard.indexOf("function windowMatchesSearch("),
    );
    const minimizedActivation = desktopCard.slice(
      desktopCard.indexOf("function windowSnapshotCanActivateMinimizedWindow("),
      desktopCard.indexOf("function planMinimizedPlaceholderFrame("),
    );

    expect(scene).toContain('import "../code/main.js" as OverviewRuntime');
    expect(scene).toContain('property string keyboardSelectionId: ""');
    expect(keyHandler).toContain(
      "const modifiers = event.modifiers & ~Qt.KeypadModifier",
    );
    expect(keyHandler).toContain(
      "const forbiddenModifiers = Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier",
    );
    expect(keyHandler).toMatch(
      /\(modifiers & forbiddenModifiers\) !== Qt\.NoModifier\) \{\s*event\.accepted = false;\s*return;/u,
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
    expect(keyHandler).toContain("event.key === Qt.Key_Tab");
    expect(keyHandler).toContain("event.key === Qt.Key_Backtab");
    expect(keyHandler).toContain("event.key === Qt.Key_Home");
    expect(keyHandler).toContain("event.key === Qt.Key_End");
    for (const direction of ["next", "previous", "first", "last"]) {
      expect(keyHandler).toContain(
        `root.navigateKeyboardSequence("${direction}")`,
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
      'typeof runtime.findOverviewSequentialNavigationTarget !== "function"',
    );
    expect(navigation).toContain(
      "runtime.findOverviewSequentialNavigationTarget(keyboardSelectionId, targets, direction)",
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
      "!presentation.matchesSearch || !windowCanNavigate(presentation)",
    );
    expect(cardTargets).toMatch(
      /const visual = presentation\.minimizedWindow\s*\? presentation\.hasMinimizedTabFrame \? presentation\.tabTarget : presentation\.minimizedPlaceholderTarget/u,
    );
    expect(cardTargets).toContain(
      "&& !presentation.tiledPresentation.selected",
    );
    expect(cardTargets).toContain("presentation.tabTarget");
    expect(cardTargets).toContain("presentation.minimizedPlaceholderTarget");
    expect(cardTargets).toContain("presentation.thumbnailTarget");
    expect(cardTargets).toContain(
      "visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)",
    );
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
      'return JSON.stringify(["window", desktopId, windowId])',
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
    expect(thumbnail).toContain("!windowPresentation.minimizedWindow");
    expect(tab).toContain(
      "readonly property bool activationEligible: windowPresentation.tiledPresentation",
    );
    expect(tab).toContain("windowPresentation.minimizedWindow");
    expect(tab).toContain("? windowPresentation.minimizedActivationEligible");
    expect(tab).toContain(": !windowPresentation.tiledPresentation.selected");
    expect(tab).toContain(
      "readonly property bool keyboardTarget: activationEligible && windowPresentation.matchesSearch",
    );
    expect(tab).toContain(
      "enabled: tabShell.visible && tabShell.activationEligible && card.desktop && card.screen",
    );
    expect(tab).toContain(
      "visible: frame !== null && model.window && windowPresentation.matchesSearch",
    );
    for (const condition of [
      "presentation.matchesSearch !== true",
      "presentation.minimizedWindow !== true",
      "snapshot.deleted",
      "snapshot.minimized !== true",
      "snapshot.managed !== true",
      "snapshot.wantsInput !== true",
      "snapshot.windowId.length === 0",
      "snapshot.windowId !== presentation.windowId",
      "candidate.deleted === true",
      "candidate.minimized !== true",
      "candidate.managed !== true",
      "candidate.wantsInput !== true",
      "String(candidate.internalId) !== snapshot.windowId",
      "snapshot.output !== expectedScreen",
      "candidate.output !== expectedScreen",
    ]) {
      expect(minimizedActivation).toContain(condition);
    }
    expect(minimizedActivation).toContain("const desktops = snapshot.desktops");
    expect(minimizedActivation).toContain("if (!desktops)");
    expect(minimizedActivation).toMatch(
      /if \(desktops\.length === 0\) \{\s*return true;/u,
    );
    expect(minimizedActivation).toContain(
      "desktops[index] === expectedDesktop && snapshot.desktopIds[index] === expectedDesktopId",
    );
    expect(minimizedActivation).not.toMatch(
      /\b(?:Timer|Behavior|Animation|ShortcutHandler)\s*\{|org\.kde\.kwin\.private|\bsequence\s*:|(?:candidate|snapshot|presentation)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
    for (const visual of [thumbnail, tab, placeholder]) {
      expect(visual).toContain(
        "card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)",
      );
      expect(visual).not.toContain("isSelectedNavigationTarget");
    }
    expect(desktopCard).not.toContain("function isSelectedNavigationTarget(");
    expect(placeholder).toContain(
      "border.width: minimizedPlaceholderShell.keyboardSelected ? 3 : 0",
    );
    expect(placeholder).toContain('border.color: "#ffd166"');
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    expect(numberGutter).toContain(
      "card.keyboardSelectionId === card.desktopNavigationTargetId()",
    );
    expect(numberGutter).toContain("visible: numberGutter.keyboardSelected");
    expect(desktopCard).toContain("property int attentionRevision: 0");
    expect(numberGutter).toContain(
      "readonly property bool attentionRequested: card.anyWindowDemandsAttention(card.attentionRevision)",
    );
    expect(numberGutter).toContain("id: desktopAttentionBadge");
    expect(numberGutter).toContain("visible: numberGutter.attentionRequested");
    expect(numberGutter.indexOf("id: desktopAttentionBadge")).toBeLessThan(
      numberGutter.lastIndexOf("z: 2"),
    );
    for (const signal of ["ItemAdded", "ItemRemoved"]) {
      expect(windowRepeaterHeader).toMatch(
        new RegExp(
          `on${signal}: \\{\\s*card\\.navigationTargetsChanged\\(\\);\\s*card\\.attentionRevision \\+= 1;\\s*\\}`,
          "u",
        ),
      );
    }
    expect(windowPresentation).toContain(
      "readonly property bool attentionRequested: card.windowDemandsAttention(candidate)",
    );
    expect(windowPresentation).toMatch(
      /onCandidateChanged: \{\s*refreshActionSnapshot\(\);\s*card\.attentionRevision \+= 1;\s*\}/u,
    );
    expect(windowPresentation).toContain(
      "onAttentionRequestedChanged: card.attentionRevision += 1",
    );
    expect(windowPresentation).toContain("ignoreUnknownSignals: true");
    expect(attentionProjection).toContain("windowRepeater.count");
    expect(attentionProjection).toContain("windowRepeater.itemAt(index)");
    expect(attentionProjection).toContain(
      "presentation.attentionRequested === true",
    );
    expect(attentionProjection).toContain(
      "candidate.demandsAttention === true",
    );
    expect(attentionProjection).toMatch(
      /function windowDemandsAttention\(candidate\) \{[\s\S]*try \{[\s\S]*catch \(error\) \{\s*return false;/u,
    );
    for (const visual of [
      { badge: "thumbnailAttentionBadge", source: thumbnail },
      { badge: "tabAttentionBadge", source: tab },
      { badge: "minimizedPlaceholderAttentionBadge", source: placeholder },
    ]) {
      expect(visual.source).toContain(`id: ${visual.badge}`);
      expect(visual.source).toContain(
        "visible: windowPresentation.attentionRequested",
      );
      expect(visual.source).toContain('text: "!"');
      expect(visual.source.indexOf(`id: ${visual.badge}`)).toBeLessThan(
        visual.source.lastIndexOf("z: 3"),
      );
    }
    expect(thumbnail).toContain(
      'border.color: KWin.Workspace.activeWindow === model.window ? "#f4f8ff" : "#71839e"',
    );
    expect(tab).toContain("windowPresentation.tiledPresentation.selected");
    expect(
      `${attentionProjection}\n${numberGutter}\n${thumbnail}\n${tab}\n${placeholder}`,
    ).not.toMatch(/\b(?:Timer|Behavior|Animation)\s*\{/u);
    expect(attentionProjection).not.toMatch(
      /windowTapped|windowCloseRequested|closeWindow|activeWindow\s*=|\.setValue\s*\(|Settings/u,
    );
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\bTimer\s*\{|KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
    );
  });

  it("cycles the current target set from bounded vertical mouse wheel input", () => {
    const wheelHandlerStart = scene.indexOf("WheelHandler {");
    const wheelHandler = scene.slice(
      wheelHandlerStart,
      scene.indexOf("Repeater {", wheelHandlerStart),
    );
    const wheelNavigation = scene.slice(
      scene.indexOf("function handleOverviewWheel("),
      scene.indexOf("function activateKeyboardSelection("),
    );

    expect(scene).toContain("property int overviewWheelRemainder: 0");
    expect(wheelHandler).toMatch(
      /target: null[\s\S]*acceptedDevices: PointerDevice\.Mouse[\s\S]*acceptedModifiers: Qt\.NoModifier[\s\S]*orientation: Qt\.Vertical[\s\S]*onWheel: event => root\.handleOverviewWheel\(event\)/u,
    );
    expect(wheelNavigation).toContain(
      "runtime.planOverviewWheelNavigation(overviewWheelRemainder,",
    );
    expect(wheelNavigation).toMatch(
      /Math\.abs\(plan\.remainder\) >= 120[\s\S]*plan\.steps > 4[\s\S]*for \(let step = 0; step < plan\.steps; step \+= 1\)[\s\S]*navigateKeyboardSequence\(plan\.direction\)/u,
    );
    expect(scene).toMatch(
      /function onActiveChanged\(\)[\s\S]*sceneEffect\.active !== true[\s\S]*root\.overviewWheelRemainder = 0;/u,
    );
    expect(`${wheelHandler}\n${wheelNavigation}`).not.toMatch(
      /KWin\.|candidate\.[A-Za-z0-9_]+\s*=(?!=)|overviewModel\.[A-Za-z0-9_]+\s*=(?!=)|\bTimer\s*\{|\.setValue\s*\(/u,
    );
  });

  it("navigates to non-current desktop gutters including an empty tail", () => {
    const cardTargets = desktopCard.slice(
      desktopCard.indexOf("function collectNavigationTargets("),
      desktopCard.indexOf("function windowCanDrag("),
    );
    const activation = scene.slice(
      scene.indexOf("function activateKeyboardSelection("),
      scene.indexOf("function repairKeyboardSelection("),
    );
    const initialSelection = scene.slice(
      scene.indexOf("function preferredInitialNavigationTarget("),
      scene.indexOf("function navigationTargetPrecedes("),
    );

    expect(desktopCard).toContain(
      "onCurrentChanged: card.navigationTargetsChanged()",
    );
    expect(cardTargets).toContain(
      "if (!current && searchQuery.trim().length === 0)",
    );
    expect(cardTargets).toContain(
      "clippedCardNavigationRect(numberGutter, sceneItem)",
    );
    expect(cardTargets).toContain('kind: "desktop"');
    expect(cardTargets).toContain('kind: "window"');
    expect(cardTargets).toContain(
      'return JSON.stringify(["desktop", desktopId])',
    );
    expect(cardTargets).toContain(
      'return JSON.stringify(["window", desktopId, windowId])',
    );
    const cardClip = desktopCard.slice(
      desktopCard.indexOf("function clippedCardNavigationRect("),
      desktopCard.indexOf("function intersectRects("),
    );
    expect(cardClip).toContain("visual.mapToItem(sceneItem");
    expect(cardClip).toContain("card.mapToItem(sceneItem");
    expect(cardClip).not.toContain("viewport.mapToItem(sceneItem");

    expect(activation).toContain('target.kind === "desktop"');
    expect(activation).toContain(
      "selectDesktop(target.candidate, target.desktopId, target.screen)",
    );
    expect(activation).toContain('target.kind === "window"');
    expect(activation).toContain(
      "focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen)",
    );
    expect(initialSelection).toContain(
      'target.kind === "window" && target.candidate === activeWindow',
    );
    expect(initialSelection).toContain(
      'target.kind === "window" && target.desktopId === activeDesktopId',
    );
  });

  it("filters overview windows through one bounded session query", () => {
    const keyHandler = scene.slice(
      scene.indexOf("Keys.onPressed:"),
      scene.indexOf("Component.onCompleted:"),
    );
    const searchFunctions = scene.slice(
      scene.indexOf("function appendSearchText("),
      scene.indexOf("function selectDesktop("),
    );
    const matcher = desktopCard.slice(
      desktopCard.indexOf("function windowMatchesSearch("),
      desktopCard.indexOf("function clippedNavigationRect("),
    );
    const searchFeedback = scene.slice(
      scene.indexOf("function repairKeyboardSelectionFrom("),
      scene.indexOf("function preferredInitialNavigationTarget("),
    );

    expect(scene).toContain('property string searchQuery: ""');
    expect(scene).toContain("searchQuery: root.searchQuery");
    expect(scene).toContain(
      "onSearchQueryChanged: Qt.callLater(root.repairKeyboardSelection)",
    );
    expect(keyHandler).toContain("event.key === Qt.Key_Backspace");
    expect(keyHandler).toContain("root.removeLastSearchCharacter()");
    expect(keyHandler).toContain(
      "event.key === Qt.Key_Space && searchQuery.length === 0",
    );
    expect(keyHandler).toMatch(
      /event\.key === Qt\.Key_Escape[\s\S]*searchQuery = "";[\s\S]*sceneEffect\.deactivate\(\);/u,
    );
    expect(keyHandler).toContain("root.isPrintableSearchText(event.text)");
    expect(searchFunctions).toContain(
      'typeof runtime.appendOverviewSearchText !== "function"',
    );
    expect(searchFunctions).toContain(
      'typeof runtime.removeLastOverviewSearchCharacter !== "function"',
    );
    expect(scene).toContain("function onActiveChanged()");
    expect(scene).toContain('root.searchQuery = ""');
    expect(scene).toContain("No matching windows: ${root.searchQuery}");
    expect(scene).toContain("textFormat: Text.PlainText");
    expect(scene).not.toContain("TextInput");
    expect(searchFeedback).toContain(
      "runtime.countOverviewWindowNavigationTargets(targets)",
    );
    expect(searchFeedback).toContain("searchResultCount = resultCount");
    expect(searchFeedback).not.toContain("collectNavigationTargets()");

    expect(desktopCard).toContain("required property string searchQuery");
    expect(desktopCard).toContain(
      "readonly property bool matchesSearch: card.windowMatchesSearch(candidate)",
    );
    expect(desktopCard).toContain("!presentation.matchesSearch");
    expect(desktopCard).toContain("function onCaptionChanged()");
    expect(desktopCard).toContain("function onDesktopFileNameChanged()");
    expect(desktopCard).toContain("function onWindowClassChanged()");
    for (const field of [
      "caption",
      "resourceClass",
      "resourceName",
      "desktopFileName",
      "state",
    ]) {
      expect(matcher).toContain(`${field}:`);
    }
    expect(matcher).toContain("state: card.windowSearchState(candidate)");
    expect(matcher).toContain("function windowSearchState(candidate)");
    expect(matcher).toContain("if (windowDemandsAttention(candidate))");
    expect(matcher).toContain('states.push("urgent attention")');
    expect(matcher).toContain(
      "candidate && candidate.deleted !== true && candidate.minimized === true",
    );
    expect(matcher).toContain('states.push("minimized")');
    expect(matcher.match(/states\.push\(/gu)).toHaveLength(2);
    expect(matcher).toContain('return states.join(" ")');
    expect(matcher).toContain(
      'typeof runtime.matchesOverviewWindowSearch !== "function"',
    );
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\b(?:Timer|TextInput)\s*\{|\.setValue\s*\(/u,
    );
  });

  it("closes only the exact selected live window after Delete", () => {
    const keyHandler = scene.slice(
      scene.indexOf("Keys.onPressed:"),
      scene.indexOf("Component.onCompleted:"),
    );
    const selection = scene.slice(
      scene.indexOf("function closeKeyboardSelection("),
      scene.indexOf("function repairKeyboardSelection("),
    );
    const transaction = scene.slice(
      scene.indexOf("function closeWindow("),
      scene.indexOf("function windowUsesDesktop("),
    );

    expect(keyHandler).toContain("event.key === Qt.Key_Delete");
    expect(keyHandler).toContain("root.closeKeyboardSelection()");
    expect(selection).toContain(
      "navigationTargetForId(targets, keyboardSelectionId)",
    );
    expect(selection).toMatch(/if \(target\.kind !== "window"\) \{\s*return;/u);
    expect(selection).toContain(
      "closeWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen)",
    );

    expect(transaction.match(/closeWindowContextIsExact\(/gu)).toHaveLength(3);
    expect(transaction).toContain("desktopContextIsExact(");
    expect(transaction).toContain("windowContextIsExact(");
    expect(transaction).toContain(
      "const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;",
    );
    expect(transaction).toContain("candidate.minimized === expectedMinimized");
    expect(transaction).toContain("candidate.managed === true");
    expect(transaction).toContain("candidate.closeable === true");
    expect(transaction).toContain(
      'typeof candidate.closeWindow === "function"',
    );
    expect(transaction.match(/candidate\.closeWindow\(\)/gu)).toHaveLength(1);
    expect(transaction).not.toContain("effect.deactivate()");
    expect(transaction).not.toMatch(
      /KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|candidate\.[A-Za-z0-9_]+\s*=(?!=)|\bTimer\s*\{|\.setValue\s*\(/u,
    );
    expect(scene).toMatch(
      /function onWindowRemoved\(\) \{\s*root\.closeStaleOverview\(\);/u,
    );
  });

  it("routes guarded middle-click closes through the live window transaction", () => {
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: tabShell"),
    );
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: activeColumnBadge"),
    );
    const eligibility = desktopCard.slice(
      desktopCard.indexOf("function windowSnapshotCanRequestClose("),
      desktopCard.indexOf("function windowCanDrag("),
    );
    const desktopDelegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf("Rectangle {", scene.indexOf("DesktopCard {")),
    );

    expect(desktopCard).toContain(
      "signal windowCloseRequested(var candidate, string expectedWindowId, var expectedDesktop,",
    );
    for (const visual of [
      { source: thumbnail, id: "thumbnailShell" },
      { source: tab, id: "tabShell" },
      { source: placeholder, id: "minimizedPlaceholderShell" },
    ]) {
      expect(visual.source).toContain(
        `enabled: ${visual.id}.visible && windowPresentation.closeEligible`,
      );
      expect(visual.source).toContain(
        "onTapped: card.windowCloseRequested(windowPresentation.candidate,",
      );
      expect(visual.source).toContain("windowPresentation.windowId,");
      expect(visual.source).toContain("windowPresentation.sourceDesktop,");
      expect(visual.source).toContain("windowPresentation.sourceDesktopId,");
      expect(visual.source).toContain("windowPresentation.sourceScreen)");
    }

    expect(eligibility).toContain("presentation.matchesSearch !== true");
    expect(eligibility).toContain("snapshot.deleted");
    expect(eligibility).toContain("snapshot.managed !== true");
    expect(eligibility).toContain("snapshot.closeable !== true");
    expect(eligibility).toContain("snapshot.windowId.length === 0");
    expect(eligibility).toContain(
      "snapshot.windowId !== presentation.windowId",
    );
    expect(eligibility).toContain(
      "snapshot.minimized !== (presentation.minimizedWindow === true)",
    );
    expect(eligibility).not.toMatch(
      /\|\|\s*snapshot\.minimized\s*(?:\|\||\n)/u,
    );
    expect(eligibility).toContain("candidate.managed !== true");
    expect(eligibility).toContain("candidate.closeable !== true");
    expect(eligibility).toContain("candidate.minimized !== snapshot.minimized");
    expect(eligibility).toContain(
      "String(candidate.internalId) !== snapshot.windowId",
    );
    expect(eligibility).toContain("snapshot.output !== expectedScreen");
    expect(eligibility).toContain("candidate.output !== expectedScreen");
    expect(eligibility).toContain(
      "snapshot.desktops[index] === expectedDesktop",
    );
    expect(eligibility).toContain(
      "snapshot.desktopIds[index] === expectedDesktopId",
    );
    expect(desktopCard).not.toContain("candidate.closeWindow()");

    expect(desktopDelegate).toContain("onWindowCloseRequested:");
    expect(desktopDelegate).toMatch(
      /onWindowCloseRequested:[\s\S]*=> root\.closeWindow\(candidate, expectedWindowId,[\s\S]*expectedDesktop, expectedDesktopId,[\s\S]*expectedScreen\)/u,
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
      /\b(?:Action|MouseArea|Settings|ShortcutHandler|Timer)\s*\{|\.setValue\s*\(|\bsequence\s*:/u,
    );
    expect(`${selector}\n${desktopRequest}\n${outputProjection}`).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)\b|KWin\.WindowModel|layoutStateReader|model\.(?:contexts|desktopIds|floatingWindows)/u,
    );
  });

  it("selects a non-current desktop from empty card content", () => {
    const viewportStart = desktopCard.indexOf("id: viewport");
    const backgroundStart = desktopCard.indexOf("id: emptyContentInput");
    const windowRepeaterStart = desktopCard.indexOf("id: windowRepeater");
    const background = desktopCard.slice(backgroundStart, windowRepeaterStart);
    const windowPresentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const windowHitTest = desktopCard.slice(
      desktopCard.indexOf("function viewportPointHitsWindow("),
      desktopCard.indexOf("function visualContainsViewportPoint("),
    );
    const visualHitTest = desktopCard.slice(
      desktopCard.indexOf("function visualContainsViewportPoint("),
      desktopCard.indexOf("function desktopNavigationTargetId("),
    );

    expect(backgroundStart).toBeGreaterThan(viewportStart);
    expect(windowRepeaterStart).toBeGreaterThan(backgroundStart);
    expect(background).toContain("anchors.fill: parent");
    expect(background).toContain("z: 1");
    expect(background.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(windowPresentation).toContain(
      "z: frame && frame.floating ? 1000 + index : 100 + index",
    );

    expect(background).toContain("acceptedButtons: Qt.LeftButton");
    expect(background).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(background).toMatch(
      /enabled: !card\.current && card\.desktop && card\.screen\s*&& card\.searchQuery\.trim\(\)\.length === 0/u,
    );
    expect(background).toContain(
      "if (!card.viewportPointHitsWindow(point.position))",
    );
    expect(background).toContain(
      "card.desktopTapped(card.desktop, card.desktopId, card.screen)",
    );
    expect(background.match(/card\.desktopTapped\(/gu)).toHaveLength(1);
    expect(background).not.toMatch(
      /KWin\.|windowTapped|windowCloseRequested|\.deactivate\(\)|currentDesktop\s*=/u,
    );

    expect(windowHitTest).toContain("windowRepeater.itemAt(index)");
    expect(windowHitTest).toContain(
      "visualContainsViewportPoint(presentation.thumbnailTarget, point)",
    );
    expect(windowHitTest).toContain(
      "visualContainsViewportPoint(presentation.tabTarget, point)",
    );
    expect(visualHitTest).toContain("!visual.visible");
    expect(visualHitTest).toContain(
      "visual.mapFromItem(emptyContentInput, point.x, point.y)",
    );
    expect(visualHitTest).toContain("localPoint.x >= 0");
    expect(visualHitTest).toContain("localPoint.y >= 0");
    expect(visualHitTest).toContain("localPoint.x < visual.width");
    expect(visualHitTest).toContain("localPoint.y < visual.height");
    expect(`${background}\n${windowHitTest}\n${visualHitTest}`).not.toMatch(
      /\bMouseArea\s*\{|org\.kde\.kwin\.private/u,
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
    expect(controller).toContain("activityIds,");
    expect(controller).toContain("currentActivityId,");
    expect(controller).toContain("KWin.Workspace.activities");
    expect(controller).toContain("KWin.Workspace.currentActivity");
    expect(controller).toContain("result.ok !== true");
    expect(controller).toContain("overviewModel = null");
  });
});
