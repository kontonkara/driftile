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
const windowCloseButton = readFileSync(
  new URL("contents/runtime/ui/WindowCloseButton.qml", effectRoot),
  "utf8",
);
const windowApplicationIcon = readFileSync(
  new URL("contents/runtime/ui/WindowApplicationIcon.qml", effectRoot),
  "utf8",
);
const outputIdentityBadge = readFileSync(
  new URL("contents/runtime/ui/OutputIdentityBadge.qml", effectRoot),
  "utf8",
);
const searchMatchBadge = readFileSync(
  new URL("contents/runtime/ui/SearchMatchBadge.qml", effectRoot),
  "utf8",
);
const keyboardHelpCloseButton = readFileSync(
  new URL("contents/runtime/ui/KeyboardHelpCloseButton.qml", effectRoot),
  "utf8",
);
const keyboardHelpHint = readFileSync(
  new URL("contents/runtime/ui/KeyboardHelpHint.qml", effectRoot),
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
  windowApplicationIcon,
  outputIdentityBadge,
  searchMatchBadge,
  keyboardHelpCloseButton,
  keyboardHelpHint,
  windowCloseButton,
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
    const showWindowLabelsEntry = configuration.match(
      /<entry name="ShowWindowLabels"[\s\S]*?<\/entry>/u,
    )?.[0];
    const showApplicationIdentityEntry = configuration.match(
      /<entry name="ShowApplicationIdentity"[\s\S]*?<\/entry>/u,
    )?.[0];
    expect(enabledEntry).toContain("<default>true</default>");
    expect(fingerCountEntry).toContain("<default>4</default>");
    expect(fingerCountEntry).toContain("<min>3</min>");
    expect(fingerCountEntry).toContain("<max>5</max>");
    expect(screenEdgeEntry).toContain('type="String"');
    expect(screenEdgeEntry).toContain("<default>none</default>");
    expect(backdropColorEntry).toContain('type="Color"');
    expect(backdropColorEntry).toContain("<default>#e60b0f17</default>");
    expect(showWindowLabelsEntry).toContain('type="Bool"');
    expect(showWindowLabelsEntry).toContain("<default>true</default>");
    expect(showApplicationIdentityEntry).toContain('type="Bool"');
    expect(showApplicationIdentityEntry).toContain("<default>true</default>");
    expect(configurationUi).toContain('name="kcfg_TouchpadGesture"');
    expect(configurationUi).toContain('name="kcfg_TouchpadGestureFingerCount"');
    expect(configurationUi).toContain('name="kcfg_ScreenEdge"');
    expect(configurationUi).toContain('name="kcfg_BackdropColor"');
    expect(configurationUi).toContain('name="kcfg_ShowWindowLabels"');
    expect(configurationUi).toContain('name="kcfg_ShowApplicationIdentity"');
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
    const gestureContext = touchpadGesture.slice(
      touchpadGesture.indexOf("function valueKey("),
      touchpadGesture.indexOf(
        "readonly property KWin.SwipeGestureHandler upSwipe",
      ),
    );
    const beginGesture = gestureContext.slice(
      gestureContext.indexOf("function beginGesture("),
      gestureContext.indexOf("function invalidateGestureContext("),
    );
    const desktopForOutput = gestureContext.slice(
      gestureContext.indexOf("function desktopForOutput("),
      gestureContext.indexOf("function currentGestureContextKey("),
    );
    const invalidateGesture = gestureContext.slice(
      gestureContext.indexOf("function invalidateGestureContext("),
      gestureContext.indexOf("function resetGesture("),
    );
    const cancelGesture = gestureContext.slice(
      gestureContext.indexOf("function cancelGesture("),
      gestureContext.indexOf("function completeGesture("),
    );
    const completeGesture = gestureContext.slice(
      gestureContext.indexOf("function completeGesture("),
      gestureContext.indexOf(
        "readonly property Connections workspaceContextConnection",
      ),
    );
    const upSwipe = touchpadGesture.slice(
      touchpadGesture.indexOf(
        "readonly property KWin.SwipeGestureHandler upSwipe",
      ),
      touchpadGesture.indexOf(
        "readonly property KWin.SwipeGestureHandler downSwipe",
      ),
    );
    const downSwipe = touchpadGesture.slice(
      touchpadGesture.indexOf(
        "readonly property KWin.SwipeGestureHandler downSwipe",
      ),
      touchpadGesture.indexOf("Component.onCompleted:"),
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
    expect(touchpadGesture).toContain('property string activeGestureOwner: ""');
    expect(touchpadGesture).toContain(
      'property string blockedGestureOwner: ""',
    );
    expect(touchpadGesture).toContain('property string gestureContextKey: ""');
    expect(gestureContext).toContain("KWin.Workspace.currentActivity");
    expect(gestureContext).toContain("KWin.Workspace.currentDesktopForScreen");
    expect(gestureContext).toContain("KWin.Workspace.currentDesktop");
    expect(gestureContext).toContain("KWin.Workspace.desktops");
    expect(gestureContext).toContain("KWin.Workspace.screens");
    expect(gestureContext).toContain("output.geometry");
    expect(desktopForOutput).toMatch(
      /if \(typeof KWin\.Workspace\.currentDesktopForScreen !== "function"\) \{\s*return KWin\.Workspace\.currentDesktop;\s*\}[\s\S]*return KWin\.Workspace\.currentDesktopForScreen\(output\) \|\| null;[\s\S]*catch \(error\) \{\s*return null;/u,
    );
    expect(desktopForOutput).not.toMatch(/desktop \|\|/u);
    expect(beginGesture).toMatch(/if \(!\(progress > 0\)\) \{\s*return;\s*\}/u);
    expect(beginGesture).toMatch(
      /if \(root\.activeGestureOwner !== "" \|\| root\.blockedGestureOwner !== ""\) \{\s*return;\s*\}/u,
    );
    expect(beginGesture).toMatch(
      /const contextKey = root\.currentGestureContextKey\(\);[\s\S]*if \(contextKey\.length === 0\) \{\s*return;\s*\}[\s\S]*root\.activeGestureOwner = owner;[\s\S]*root\.gestureContextKey = contextKey;/u,
    );
    expect(invalidateGesture).toMatch(
      /if \(root\.activeGestureOwner === ""\) \{\s*return;\s*\}[\s\S]*root\.blockedGestureOwner = root\.activeGestureOwner;[\s\S]*root\.activeGestureOwner = "";[\s\S]*root\.gestureContextKey = "";/u,
    );
    expect(cancelGesture).toMatch(
      /if \(owner === root\.activeGestureOwner \|\| owner === root\.blockedGestureOwner\) \{\s*root\.resetGesture\(\);\s*\}/u,
    );
    expect(completeGesture).toMatch(
      /if \(owner === root\.blockedGestureOwner\) \{\s*root\.resetGesture\(\);\s*return false;\s*\}[\s\S]*if \(owner !== root\.activeGestureOwner\) \{\s*return false;\s*\}/u,
    );
    expect(completeGesture).toMatch(
      /root\.gestureContextKey === root\.currentGestureContextKey\(\)[\s\S]*root\.resetGesture\(\);[\s\S]*return accepted;/u,
    );
    expect(touchpadGesture).toMatch(
      /target: KWin\.Workspace[\s\S]*onCurrentDesktopChanged[\s\S]*onCurrentActivityChanged[\s\S]*onDesktopsChanged[\s\S]*onScreensChanged[\s\S]*onVirtualScreenGeometryChanged/u,
    );
    expect(upSwipe).toContain(
      "direction: KWin.SwipeGestureHandler.Direction.Up",
    );
    expect(upSwipe).toContain(
      'onProgressChanged: root.beginGesture("open", progress)',
    );
    expect(upSwipe).toContain('onCancelled: root.cancelGesture("open")');
    expect(upSwipe).toMatch(
      /if \(!root\.completeGesture\("open"\)\) \{\s*return;\s*\}[\s\S]*root\.openRequested\(\);/u,
    );
    expect(downSwipe).toContain(
      "direction: KWin.SwipeGestureHandler.Direction.Down",
    );
    expect(downSwipe).toContain(
      'onProgressChanged: root.beginGesture("close", progress)',
    );
    expect(downSwipe).toContain('onCancelled: root.cancelGesture("close")');
    expect(downSwipe).toMatch(
      /if \(!root\.completeGesture\("close"\)\) \{\s*return;\s*\}[\s\S]*root\.closeRequested\(\);/u,
    );
    expect(touchpadGesture).toContain(
      'Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")',
    );
    expect(touchpadGesture).toContain(
      'Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")',
    );
    expect(touchpadGesture.match(/console\.info\(/gu)).toHaveLength(2);
    expect(touchpadGesture).not.toMatch(
      /\bprogress\s*:|ShortcutHandler|sequence\s*:|Timer|KWin\.DBusCall|callDBus/iu,
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
    expect(main).toContain(
      "readonly property bool showWindowLabels: showWindowLabelsFromConfig()",
    );
    expect(main).toContain(
      "readonly property bool showApplicationIdentity: showApplicationIdentityFromConfig()",
    );
    for (const [property, reader] of [
      ["ShowWindowLabels", "showWindowLabelsFromConfig"],
      ["ShowApplicationIdentity", "showApplicationIdentityFromConfig"],
    ] as const) {
      const configReader = main.slice(
        main.indexOf(`function ${reader}()`),
        main.indexOf("\n    }", main.indexOf(`function ${reader}()`)) + 6,
      );
      expect(configReader).toContain(`configuration.${property}`);
      expect(configReader).toContain(
        'return typeof value === "boolean" ? value : true;',
      );
    }
  });

  it("keeps a fixed scene-effect proxy over the cache-busted controller", () => {
    expect(createHash("sha256").update(main, "utf8").digest("hex")).toBe(
      "519b1f54dde8dca88174a708ecdd6f4b3c5b8e105f8ca3c047f7e5a189064132",
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
    expect(controller).toContain("function onWindowAdded()");
    expect(controller).toContain("function onWindowRemoved()");
    expect(scene).not.toContain("function onWindowAdded()");
    expect(scene).not.toContain("function onWindowRemoved()");
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
      /onWindowTapped:\s*\(candidate,\s*expectedWindowId,\s*expectedDesktop,\s*expectedDesktopId,\s*expectedScreen\)\s*=>\s*root\.focusWindow\(candidate,\s*expectedWindowId,\s*expectedDesktop,\s*expectedDesktopId,\s*expectedScreen\)/u,
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
    const spatialLayout = scene.slice(
      scene.indexOf("function planSpatialLayout("),
      scene.indexOf("function beginDesktopReorder("),
    );
    const spatialInputStart = scene.indexOf("id: spatialViewportInput");
    const desktopRepeaterStart = scene.indexOf("id: desktopRepeater");
    const spatialInput = scene.slice(
      spatialInputStart,
      scene.lastIndexOf("Repeater {", desktopRepeaterStart) +
        "Repeater {".length,
    );
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const desktopLoaderStart = scene.indexOf(
      "Loader {\n            id: desktopCardLoader",
    );
    const desktopLoader = scene.slice(
      desktopLoaderStart,
      scene.indexOf("sourceComponent: Component", desktopLoaderStart),
    );
    const reorderDelegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf("Rectangle {", scene.indexOf("DesktopCard {")),
    );
    const reorder = scene.slice(
      scene.indexOf("function beginDesktopReorder("),
      scene.indexOf("function collectNavigationTargets("),
    );
    const spatialEdgePanTimer = scene.slice(
      scene.indexOf("id: spatialEdgePanTimer"),
      scene.indexOf("WheelHandler {"),
    );
    const spatialEdgePan = scene.slice(
      scene.indexOf("function beginWindowSpatialEdgePan("),
      scene.indexOf("function setKeyboardSelectionTarget("),
    );
    const staleClose = scene.slice(
      scene.indexOf("function closeStaleOverview("),
      scene.indexOf("function outputIdForScreen("),
    );
    const sessionReset = scene.slice(
      scene.indexOf("function resetOverviewSession("),
      scene.indexOf("function refreshOverviewSpatialSession("),
    );
    const spatialSessionRefresh = scene.slice(
      scene.indexOf("function refreshOverviewSpatialSession("),
      scene.indexOf("function resetSpatialViewport("),
    );

    expect(scene).toMatch(
      /readonly property int currentWorkspaceIndex:[\s\S]*desktopIds\.indexOf\(String\(currentDesktop\.id\)\)/u,
    );
    expect(scene).toMatch(
      /readonly property real overviewZoom:[\s\S]*Number\.isFinite\(sceneEffect\.overviewZoom\)[\s\S]*\? sceneEffect\.overviewZoom : 0\.5/u,
    );
    expect(spatialLayout).toContain(
      'typeof runtime.planOverviewSpatialLayout !== "function"',
    );
    expect(spatialLayout).toMatch(
      /runtime\.planOverviewSpatialLayout\(\{[\s\S]*sceneWidth: width,[\s\S]*sceneHeight: height,[\s\S]*workspaceCount: desktopIds\.length,[\s\S]*currentWorkspaceIndex,[\s\S]*zoom: overviewZoom/u,
    );
    expect(spatialLayout).toMatch(
      /return spatialLayoutIsValid\(plan\) \? plan : fallback;[\s\S]*catch \(error\) \{\s*return fallback;/u,
    );
    expect(spatialLayout).toContain("function legacySpatialLayout()");
    expect(spatialLayout).toContain(
      "const horizontalError = Math.abs(plan.cardX * 2 + plan.cardWidth - width);",
    );
    expect(scene).toContain(
      "readonly property real cardTop: overviewSpatialLayout.edgeMargin - spatialContentY",
    );
    expect(scene).toContain("property real spatialContentY: 0");
    expect(desktopLoaderStart).toBeGreaterThan(0);
    expect(desktopLoader).toContain("x: root.cardX");
    expect(desktopLoader).toContain(
      "y: root.cardTop + index * (root.cardHeight + root.cardGap)",
    );
    expect(desktopLoader).toContain("width: root.cardWidth");
    expect(desktopLoader).toContain("height: root.cardHeight");
    expect(desktopLoader).toContain(
      "active: root.desktopCardShouldLoad(index, modelData)",
    );
    expect(desktopLoader).toContain(
      "onActiveChanged: Qt.callLater(root.repairKeyboardSelection)",
    );
    expect(desktopLoader).toContain(
      "onLoaded: Qt.callLater(root.repairKeyboardSelection)",
    );
    expect(reorderDelegate).toContain(
      "desktopReorderSource: root.desktopReorderActive",
    );
    expect(reorderDelegate).toContain(
      "root.desktopReorderSourceId === desktopCardLoader.modelData",
    );

    expect(overviewRuntimeIndex).toContain("planOverviewSpatialViewport");
    expect(overviewRuntimeIndex).toContain("planOverviewSpatialViewportAnchor");
    expect(overviewRuntimeIndex).toContain(
      "planOverviewSpatialWorkspaceCenter",
    );
    expect(overviewRuntimeIndex).toContain("planOverviewSpatialVisibleRange");
    expect(overviewRuntimeIndex).toContain("planOverviewSpatialEdgePan");
    expect(spatialLayout).toContain(
      'typeof runtime.planOverviewSpatialVisibleRange !== "function"',
    );
    expect(spatialLayout).toMatch(
      /runtime\.planOverviewSpatialVisibleRange\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY: spatialContentY,[\s\S]*workspaceCount: desktopIds\.length,[\s\S]*overscan: 1/u,
    );
    expect(spatialLayout).toContain(
      "return spatialVisibleRangeIsValid(plan) ? plan : fallback",
    );
    expect(spatialLayout).toContain("return fallback;");
    expect(spatialLayout).toContain("if (searchQuery.length > 0");
    expect(spatialLayout).toContain(
      "desktopReorderSourceId === expectedDesktopId",
    );
    expect(spatialLayout).toContain(
      "spatialWindowDragSourceDesktopId === expectedDesktopId",
    );
    expect(spatialLayout).toMatch(
      /runtime\.planOverviewSpatialViewport\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY: requestedContentY/u,
    );
    expect(spatialLayout).toMatch(
      /function resetSpatialViewport\(\)[\s\S]*planSpatialViewport\(overviewSpatialLayout\.initialContentY\)[\s\S]*spatialContentY = plan\.contentY/u,
    );
    expect(scene).toContain(
      "onOverviewSpatialLayoutChanged: root.refreshOverviewSpatialSession(true)",
    );
    expect(scene).toContain(
      "onOverviewModelChanged: root.refreshOverviewSpatialSession(true)",
    );
    expect(scene).toContain(
      "onCurrentDesktopChanged: root.refreshOverviewSpatialSession(false)",
    );
    expect(scene).toMatch(
      /Component\.onCompleted:[\s\S]*resetOverviewSession\(\);[\s\S]*forceActiveFocus\(\);/u,
    );
    expect(scene).toMatch(
      /function onActiveChanged\(\) \{\s*root\.resetOverviewSession\(\);/u,
    );
    expect(sessionReset).toMatch(
      /function resetOverviewSession\(\)[\s\S]*keyboardSelectionId = "";[\s\S]*keyboardHelpVisible = false;[\s\S]*searchQuery = "";[\s\S]*spatialViewportSnapshot = null;[\s\S]*refreshOverviewSpatialSession\(false\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /function refreshOverviewSpatialSession\(preserveViewport\)[\s\S]*cancelKeyboardBoundaryNavigation\(\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /navigationTargetForId\(collectNavigationTargets\(\), keyboardSelectionId\)[\s\S]*selectedDesktopId = selectedTarget\.desktopId;/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /searchResultCount = 0;[\s\S]*searchResultCountsByDesktop = Object\.create\(null\);[\s\S]*searchResultOrdinalsByTarget = Object\.create\(null\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /resetOverviewWheelState\(\);[\s\S]*spatialViewportInput\.panLayout = null;[\s\S]*spatialViewportInput\.panStartContentY = 0;/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /resetDesktopReorder\(\);[\s\S]*resetSpatialEdgePanTracking\(\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /sceneEffect && sceneEffect\.active === true[\s\S]*planSpatialViewportAnchor\(previousViewportSnapshot, nextViewportGeometry\)[\s\S]*spatialContentY = anchorPlan\.contentY;[\s\S]*resetSpatialViewport\(\);[\s\S]*captureSpatialViewportSnapshot\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*spatialContentY = 0;[\s\S]*spatialViewportSnapshot = null;/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /desktopIds\.indexOf\(selectedDesktopId\)[\s\S]*planSpatialWorkspaceCenter\(selectedWorkspaceIndex\)[\s\S]*spatialContentY = selectionPlan\.contentY;/u,
    );
    expect(spatialSessionRefresh).not.toMatch(
      /keyboardSelectionId = ""|keyboardHelpVisible = false|searchQuery = ""/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /runtime\.planOverviewSpatialViewportAnchor\(\{[\s\S]*nextDesktopIds: nextGeometry\.desktopIds,[\s\S]*previousContentY: previousSnapshot\.contentY,[\s\S]*previousDesktopIds: previousSnapshot\.desktopIds/u,
    );
    expect(spatialSessionRefresh).toContain(
      "plan.anchorDesktopId !== nextGeometry.desktopIds[plan.anchorWorkspaceIndex]",
    );

    expect(scene).toMatch(
      /onKeyboardSelectionIdChanged: \{[\s\S]*const target = keyboardSelectionViewportTarget;[\s\S]*keyboardSelectionViewportTarget = null;[\s\S]*root\.synchronizeKeyboardSelectionViewport\(target\);/u,
    );
    expect(spatialLayout).toContain(
      "target = navigationTargetForId(collectNavigationTargets(), selectedTargetId)",
    );
    expect(spatialLayout).toContain(
      "const workspaceIndex = desktopIds.indexOf(target.desktopId)",
    );
    expect(spatialLayout).toMatch(
      /runtime\.planOverviewSpatialWorkspaceCenter\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*cardHeight,[\s\S]*gap: cardGap,[\s\S]*workspaceCount: desktopIds\.length,[\s\S]*workspaceIndex/u,
    );
    expect(spatialLayout).toContain(
      "!plan || keyboardSelectionId !== selectedTargetId",
    );
    expect(spatialLayout).toMatch(
      /function setKeyboardSelectionTarget[\s\S]*keyboardSelectionViewportTarget = target;[\s\S]*keyboardSelectionId = target\.id;/u,
    );

    expect(scene).toContain("clip: true");
    expect(spatialInputStart).toBeGreaterThan(0);
    expect(desktopRepeaterStart).toBeGreaterThan(spatialInputStart);
    expect(spatialInput).toContain("anchors.fill: parent");
    expect(spatialInput).toContain("containmentMask: QtObject {");
    expect(spatialInput).toContain("function contains(point: point) : bool {");
    expect(spatialInput).not.toMatch(/function contains\(point\)\s*\{/u);
    expect(spatialInput).toContain(
      "return root.spatialViewportBackdropContains(point)",
    );
    expect(spatialInput.match(/\bDragHandler\s*\{/gu)).toHaveLength(1);
    expect(spatialInput).toContain("target: null");
    expect(spatialInput).toContain("acceptedButtons: Qt.LeftButton");
    expect(spatialInput).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    expect(spatialInput).toContain(
      "grabPermissions: PointerHandler.TakeOverForbidden",
    );
    expect(spatialInput).toContain("xAxis.enabled: false");
    expect(spatialInput).toContain("yAxis.enabled: true");
    expect(spatialInput).toContain(
      "root.setSpatialContentY(spatialViewportInput.panStartContentY - activeTranslation.y)",
    );
    expect(spatialInput).toContain(
      "spatialViewportInput.panLayout = root.overviewSpatialLayout",
    );
    expect(spatialInput).toContain(
      "spatialViewportInput.panLayout === root.overviewSpatialLayout",
    );
    expect(spatialInput).toContain("!root.desktopReorderActive");
    expect(spatialInput).toContain("!root.keyboardHelpVisible");
    expect(spatialInput).not.toContain("preventStealing");
    expect(spatialLayout).toContain("point.x < cardX");
    expect(spatialLayout).toContain("point.x >= cardX + cardWidth");
    expect(spatialLayout).toContain(
      "return relativeY - workspaceIndex * stride >= cardHeight",
    );
    expect(spatialLayout).toContain(
      "spatialViewportOverlayContainsPoint(keyboardHelpHint, point)",
    );
    expect(scene).toMatch(/KeyboardHelpHint\s*\{\s*id: keyboardHelpHint/u);
    expect(spatialLayout).toContain(
      "spatialViewportOverlayContainsPoint(searchOverlay, point)",
    );
    expect(`${spatialInput}\n${spatialLayout}`).not.toMatch(
      /\b(?:Animation|Behavior|MouseArea|TapHandler|Timer|WheelHandler)\s*\{|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
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
    expect(controller).toMatch(
      /function captureOverviewLayoutSettings[\s\S]*mainScriptSettings\.value\("AlwaysCenterSingleColumn", false\)[\s\S]*mainScriptSettings\.value\("Gap", 16\)[\s\S]*gap >= 0 && gap <= 64[\s\S]*overviewAlwaysCenterSingleColumn = nextAlwaysCenterSingleColumn;[\s\S]*overviewGap = nextGap;/u,
    );
    expect(controller).toMatch(
      /function activate\(\)[\s\S]*captureOverviewLayoutSettings\(\);[\s\S]*lastActivationAttemptId/u,
    );
    expect(main).toContain(
      "readonly property bool overviewAlwaysCenterSingleColumn: controller",
    );
    expect(main).toContain("readonly property real overviewGap: controller");
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
    expect(scene).toMatch(
      /x: root\.desktopReorderCardX[\s\S]*y: root\.desktopReorderCardTop[\s\S]*width: root\.desktopReorderCardWidth/u,
    );
    expect(reorder).toContain("desktopReorderCardTop = cardTop");
    expect(reorder).toContain("desktopReorderCardWidth = cardWidth");
    expect(reorder).toContain("desktopReorderCardX = cardX");
    expect(reorder).toContain("cardTop === desktopReorderCardTop");
    expect(reorder).toContain("point.x < desktopReorderCardX");
    expect(reorder).toContain(
      "point.x >= desktopReorderCardX + desktopReorderCardWidth",
    );
    expect(reorder).toContain(
      "const movableTop = desktopReorderCardTop + firstMovableIndex * stride",
    );
    expect(reorder).toContain(
      "const protectedTop = desktopReorderCardTop + movableCount * stride",
    );
    expect(reorder).not.toContain("desktopReorderOuterMargin");
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
      /resetOverviewSession\(\);\s*if \(sceneEffect\) \{\s*sceneEffect\.deactivate\(\);/u,
    );

    expect(scene.match(/\bTimer\s*\{/gu)).toHaveLength(1);
    expect(spatialEdgePanTimer).toContain("interval: 16");
    expect(spatialEdgePanTimer).toContain("repeat: true");
    expect(spatialEdgePanTimer).toContain(
      "running: root.spatialEdgePanCanRun()",
    );
    expect(spatialEdgePanTimer).toContain("triggeredOnStart: false");
    expect(spatialEdgePanTimer).toContain(
      "onTriggered: root.advanceSpatialEdgePan(interval)",
    );
    for (const signal of [
      "onWindowSpatialDragStarted:",
      "onWindowSpatialDragMoved:",
      "onWindowSpatialDragFinished:",
    ]) {
      expect(reorderDelegate).toContain(signal);
    }
    expect(spatialEdgePan).toContain(
      "function windowSpatialDragSourceIsExact(source, expectedDesktopId)",
    );
    expect(spatialEdgePan).toContain("source === spatialWindowDragSource");
    expect(spatialEdgePan).toContain(
      "source.sourceDesktopId !== expectedDesktopId",
    );
    expect(spatialEdgePan).toContain(
      "point = root.mapFromItem(null, sceneX, sceneY)",
    );
    expect(spatialEdgePan).toContain("desktopReorderSpatialEdgePanIsExact()");
    expect(spatialEdgePan).toContain(
      "const edgeZone = Math.min(height * 0.12, 96)",
    );
    expect(spatialEdgePan).toContain(
      "spatialEdgePanPointerY < edgeZone && spatialContentY > 0",
    );
    expect(spatialEdgePan).toContain(
      "spatialEdgePanPointerY > height - edgeZone",
    );
    expect(spatialEdgePan).toContain("!canMoveUp && !canMoveDown");
    expect(spatialEdgePan).toMatch(
      /runtime\.planOverviewSpatialEdgePan\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY: spatialContentY,[\s\S]*pointerY: spatialEdgePanPointerY,[\s\S]*elapsedMilliseconds/u,
    );
    expect(spatialEdgePan).toContain(
      "spatialEdgePanPlanIsValid(plan, elapsedMilliseconds)",
    );
    expect(spatialEdgePan).toContain(
      "const maximumDistance = Math.min(height * 1.5, 1800) * elapsedMilliseconds / 1000",
    );
    expect(spatialEdgePan).toContain("desktopReorderCardTop = cardTop");
    expect(spatialEdgePan).toContain(
      "updateDesktopReorder(desktopReorderSourceId, spatialEdgePanSceneX, spatialEdgePanSceneY)",
    );
    expect(reorder).toContain("storeSpatialEdgePanScenePoint(sceneX, sceneY)");
    expect(spatialSessionRefresh).toContain("resetSpatialEdgePanTracking();");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\bMouseArea\s*\{|KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
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
    expect(thumbnailFooter).toMatch(
      /visible: card\.showWindowLabels && windowPresentation\.windowLabel !== null\s*&& thumbnailShell\.width >= 120/u,
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
    expect(tabLabel).toContain("anchors.rightMargin: tabCloseButton.visible");
    expect(tabLabel).toContain(
      ": (windowPresentation.attentionRequested ? 18 : 4)",
    );
    expect(placeholderLabel).toContain(
      "anchors.rightMargin: minimizedPlaceholderCloseButton.visible",
    );
    expect(placeholderLabel).toContain(
      ": (windowPresentation.attentionRequested",
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
      /runtime\.planOverviewWindowLabel\(\{[\s\S]*\}, card\.showApplicationIdentity\);[\s\S]*!boundedPlainWindowLabel\(primary\)[\s\S]*secondary !== null && !boundedPlainWindowLabel\(secondary\)/u,
    );
    expect(scene).toContain(
      'typeof sceneEffect.showWindowLabels === "boolean"',
    );
    expect(scene).toContain(
      'typeof sceneEffect.showApplicationIdentity === "boolean"',
    );
    expect(scene).toContain("showWindowLabels: root.showWindowLabels");
    expect(scene).toContain(
      "showApplicationIdentity: root.showApplicationIdentity",
    );
    expect(desktopCard).toContain("required property bool showWindowLabels");
    expect(desktopCard).toContain(
      "required property bool showApplicationIdentity",
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

  it("presents bounded desktop names without changing compact gutter input", () => {
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: desktopNameGutter"),
    );
    const desktopNameGutter = desktopCard.slice(
      desktopCard.indexOf("id: desktopNameGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const labelTextPosition = desktopNameGutter.indexOf(
      "text: card.desktopLabel ? card.desktopLabel.label",
    );
    const labelTextStart = desktopNameGutter.lastIndexOf(
      "Text {",
      labelTextPosition,
    );
    const labelText = desktopNameGutter.slice(
      labelTextStart,
      desktopNameGutter.length,
    );
    const planner = desktopCard.slice(
      desktopCard.indexOf("function planDesktopLabel("),
      desktopCard.indexOf("function planWindowState("),
    );
    const search = desktopCard.slice(
      desktopCard.indexOf("function windowMatchesSearch("),
      desktopCard.indexOf("function windowSearchState("),
    );

    expect(desktopCard).toContain("required property bool showDesktopNames");
    expect(desktopCard).toContain(
      "readonly property var desktopLabel: planDesktopLabel(desktop)",
    );
    expect(desktopCard).toMatch(
      /readonly property bool desktopNamePresented: showDesktopNames && desktopLabel !== null\s*&& width >= 560 && height >= 72/u,
    );
    expect(desktopCard).toContain(
      "readonly property real contentLeft: desktopNamePresented ? Math.max(112, Math.min(170, width * 0.14)) : 42",
    );
    expect(numberGutter).toContain("width: 42");
    expect(numberGutter).toContain("width: numberGutter.width - 18");
    expect(desktopNameGutter).toContain("x: 42");
    expect(desktopNameGutter).toContain(
      "width: Math.max(0, card.contentLeft - 42)",
    );
    expect(desktopNameGutter).toContain("visible: card.desktopNamePresented");
    expect(labelTextPosition).toBeGreaterThan(0);
    expect(labelText).toContain("anchors.fill: parent");
    expect(labelText).toContain("elide: Text.ElideRight");
    expect(labelText).toContain("textFormat: Text.PlainText");

    expect(planner).toContain("const name = desktop.name");
    expect(planner).toContain('typeof name !== "string"');
    expect(planner).toContain(
      'typeof runtime.planOverviewDesktopLabel !== "function"',
    );
    expect(planner).toMatch(
      /runtime\.planOverviewDesktopLabel\(\{\s*name\s*\}\)/u,
    );
    expect(planner).toContain("!boundedPlainDesktopLabel(planned.label)");
    expect(planner).toContain(
      'typeof value !== "string" || value.length === 0 || value.length > 128',
    );
    expect(planner).toContain("if (codePoints > 64)");
    expect(planner).toMatch(/catch \(error\) \{\s*return null;/u);
    expect(search).toContain(
      'desktopName: card.desktopLabel ? card.desktopLabel.label : ""',
    );
    expect(search).not.toContain("showDesktopNames");

    expect(numberGutter.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(numberGutter.match(/\bDragHandler\s*\{/gu)).toHaveLength(1);
    expect(numberGutter).toContain("id: desktopAttentionBadge");
    expect(labelText).not.toMatch(
      /\b(?:TapHandler|DragHandler|Timer|Behavior|Animation|ShortcutHandler|Connections)\s*\{|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|desktop\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("lazily presents one bounded output label in eligible multi-output scenes", () => {
    const loader = scene.slice(
      scene.indexOf("id: outputIdentityLoader"),
      scene.indexOf("function beginDesktopReorder("),
    );
    const liveScreenCount = scene.slice(
      scene.indexOf("function liveScreenCountForOutputLabel("),
      scene.indexOf("function planOutputLabel("),
    );
    const planner = scene.slice(
      scene.indexOf("function planOutputLabel("),
      scene.indexOf("function projectedOutputId("),
    );

    expect(scene).toContain('typeof sceneEffect.showOutputNames === "boolean"');
    expect(scene).toContain(
      "readonly property bool outputLabelGeometryEligible: width >= 640 && height >= 360",
    );
    expect(scene).toContain("searchQuery.length === 0");
    expect(scene).toMatch(
      /readonly property int outputLabelLiveScreenCount: showOutputNames && outputLabelGeometryEligible\s*\? liveScreenCountForOutputLabel\(targetScreen\) : 0/u,
    );
    expect(scene).toContain(
      "readonly property bool outputLabelNeeded: searchQuery.length > 0 || outputLabelLiveScreenCount >= 2",
    );
    expect(scene).toContain(
      "readonly property var outputLabelPlan: outputLabelNeeded ? planOutputLabel(targetScreen) : null",
    );
    expect(scene).toContain(
      'readonly property string outputName: outputLabelPlan ? outputLabelPlan.label : ""',
    );
    expect(scene).toContain("outputName: root.outputName");
    expect(desktopCard).toContain("required property string outputName");

    expect(loader).toContain("anchors.top: parent.top");
    expect(loader).toContain("anchors.right: parent.right");
    expect(loader).toContain("active: root.outputLabelLiveScreenCount >= 2");
    expect(loader).toMatch(
      /sourceComponent: Component \{\s*OutputIdentityBadge \{\s*labelPlan: root\.outputLabelPlan/u,
    );
    expect(loader).not.toContain("screen.name");
    expect(scene.match(/planOutputLabel\(targetScreen\)/gu)).toHaveLength(1);

    expect(liveScreenCount).toContain("const screens = KWin.Workspace.screens");
    expect(liveScreenCount).toContain("screens.length < 2");
    expect(liveScreenCount).toContain("screens.length > 64");
    expect(liveScreenCount).toContain("screen === expectedScreen");
    expect(liveScreenCount).toContain(
      "targetMatches === 1 ? screens.length : 0",
    );
    expect(liveScreenCount).toMatch(/catch \(error\) \{\s*return 0;/u);

    expect(planner).toContain(
      'typeof runtime.planOverviewOutputLabel !== "function"',
    );
    expect(planner).toContain("runtime.planOverviewOutputLabel(screen)");
    expect(planner).toContain("boundedPlainOutputLabel(planned.label)");
    expect(planner).toContain(
      'typeof value !== "string" || value.length === 0 || value.length > 128',
    );
    expect(planner).toContain("if (codePoints > 64)");
    expect(planner).toMatch(/catch \(error\) \{\s*return null;/u);

    expect(outputIdentityBadge).toContain("required property var labelPlan");
    expect(outputIdentityBadge).toContain(
      "implicitWidth: Math.min(240, Math.max(96, outputIdentityText.implicitWidth + 20))",
    );
    expect(outputIdentityBadge).toContain("implicitHeight: 28");
    expect(outputIdentityBadge).toContain("visible: label.length > 0");
    expect(outputIdentityBadge).toContain("textFormat: Text.PlainText");
    expect(outputIdentityBadge).toContain("elide: Text.ElideRight");
    expect(outputIdentityBadge).toMatch(/catch \(error\) \{\s*return "";/u);

    expect(outputIdentityBadge).not.toMatch(
      /\b(?:TapHandler|DragHandler|HoverHandler|WheelHandler|DropArea|Timer|Behavior|Animation|ShortcutHandler|Connections)\s*\{|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("loads bounded application icons only for eligible static window labels", () => {
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
    const iconLoader = windowApplicationIcon.slice(
      windowApplicationIcon.indexOf("Loader {"),
      windowApplicationIcon.indexOf("function readCandidateIcon("),
    );
    const iconReader = windowApplicationIcon.slice(
      windowApplicationIcon.indexOf("function readCandidateIcon("),
    );

    expect(desktopCard).toContain(
      "required property bool showApplicationIcons",
    );
    expect(desktopCard.match(/WindowApplicationIcon \{/gu)).toHaveLength(3);
    expect(desktopCard).not.toContain("candidate.icon");

    expect(windowApplicationIcon).toContain(
      "import org.kde.kirigami as Kirigami",
    );
    expect(windowApplicationIcon).toContain(
      "required property bool presentationEligible",
    );
    expect(windowApplicationIcon).toContain("required property var candidate");
    expect(windowApplicationIcon).toContain(
      "readonly property bool boundedGeometry: Number.isFinite(root.width) && Number.isFinite(root.height)",
    );
    expect(windowApplicationIcon).toContain(
      "root.width >= 8 && root.height >= 8 && root.width <= 24 && root.height <= 24",
    );
    expect(iconLoader).toContain(
      "active: root.presentationEligible && root.boundedGeometry",
    );
    expect(iconLoader.match(/Kirigami\.Icon \{/gu)).toHaveLength(1);
    expect(iconLoader).toContain(
      "readonly property var iconSource: root.readCandidateIcon(root.candidate)",
    );
    expect(iconLoader).toContain("source: iconHost.iconSource");
    expect(iconLoader).toContain("visible: iconHost.iconAvailable");
    expect(iconReader.match(/candidate\.icon/gu)).toHaveLength(1);
    expect(iconReader).toContain(
      'icon === null || icon === undefined || typeof icon !== "object" || Array.isArray(icon)',
    );
    expect(iconReader).toMatch(/return null;\s*\}\s*return icon;/u);
    expect(iconReader).toMatch(/catch \(error\) \{\s*return null;/u);

    expect(thumbnail).toMatch(
      /id: thumbnailApplicationIcon[\s\S]*width: 16\s*height: 16[\s\S]*candidate: windowPresentation\.candidate[\s\S]*presentationEligible: card\.showApplicationIcons && thumbnailLabelFooter\.visible\s*&& thumbnailLabelFooter\.width >= 160/u,
    );
    expect(thumbnail).toContain(
      "anchors.leftMargin: thumbnailApplicationIcon.iconAvailable ? 28 : 6",
    );
    expect(
      thumbnail.match(
        /anchors\.leftMargin: thumbnailApplicationIcon\.iconAvailable \? 28 : 6/gu,
      ),
    ).toHaveLength(2);

    expect(tab).toMatch(
      /id: tabApplicationIcon[\s\S]*width: Math\.max\(10, Math\.min\(14, tabShell\.height - 6\)\)\s*height: width[\s\S]*candidate: windowPresentation\.candidate[\s\S]*presentationEligible: card\.showApplicationIcons && tabShell\.visible\s*&& tabShell\.width >= 84 && tabShell\.height >= 18/u,
    );
    expect(tab).toMatch(
      /anchors\.leftMargin: tabApplicationIcon\.iconAvailable\s*\? tabApplicationIcon\.x \+ tabApplicationIcon\.width \+ 5 : 4/u,
    );
    expect(tab).toContain("anchors.rightMargin: tabCloseButton.visible");

    expect(placeholder).toMatch(
      /id: minimizedPlaceholderApplicationIcon[\s\S]*width: Math\.max\(10, Math\.min\(16, minimizedPlaceholderShell\.height - 8\)\)\s*height: width[\s\S]*candidate: windowPresentation\.candidate[\s\S]*presentationEligible: card\.showApplicationIcons && minimizedPlaceholderShell\.visible\s*&& minimizedPlaceholderShell\.width >= 120\s*&& minimizedPlaceholderShell\.height >= 20/u,
    );
    expect(placeholder).toMatch(
      /anchors\.leftMargin: minimizedPlaceholderApplicationIcon\.iconAvailable\s*\? minimizedPlaceholderApplicationIcon\.x \+ minimizedPlaceholderApplicationIcon\.width \+ 5 : 7/u,
    );
    expect(placeholder).toContain(
      "anchors.rightMargin: minimizedPlaceholderCloseButton.visible",
    );

    expect(windowApplicationIcon).not.toMatch(
      /\b(?:TapHandler|DragHandler|HoverHandler|Timer|Behavior|Animation|ShortcutHandler|Connections)\s*\{|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|candidate\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("shows one bounded static state badge on eligible selected thumbnails", () => {
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
    const planner = desktopCard.slice(
      desktopCard.indexOf("function planWindowState("),
      desktopCard.indexOf("function planWindowLabel("),
    );
    const search = desktopCard.slice(
      desktopCard.indexOf("function windowMatchesSearch("),
      desktopCard.indexOf("function clippedNavigationRect("),
    );
    const badgeStart = thumbnail.indexOf("id: thumbnailWindowStateBadge");
    const badge = thumbnail.slice(
      badgeStart,
      thumbnail.indexOf("id: thumbnailLabelFooter", badgeStart),
    );

    expect(desktopCard).toContain(
      "required property bool showWindowStateBadges",
    );
    expect(presentation).toContain("property int windowStateRevision: 0");
    expect(presentation).toMatch(
      /readonly property var windowState: card\.planWindowState\(candidate, frame, tiledPresentation,\s*windowStateRevision\)/u,
    );
    expect(presentation).toContain("function onFullScreenChanged()");
    expect(presentation).toContain("function onMaximizedChanged()");
    expect(presentation.match(/windowStateRevision \+= 1/gu)).toHaveLength(2);
    expect(presentation).toContain(
      "onWindowStateChanged: card.navigationTargetsChanged()",
    );

    expect(planner).toContain("const fullScreen = candidate.fullScreen");
    expect(planner).toContain("const maximizeMode = candidate.maximizeMode");
    expect(planner).toContain("floating = frame.floating");
    expect(planner).toContain("floating = false");
    expect(planner).toContain(
      'typeof runtime.planOverviewWindowState !== "function"',
    );
    expect(planner).toMatch(
      /runtime\.planOverviewWindowState\(\{\s*floating,\s*fullScreen,\s*maximizeMode\s*\}\)/u,
    );
    expect(planner).toContain("function windowStatePlanIsValid(planned)");
    expect(planner).toContain('badge === "Fullscreen"');
    expect(planner).toContain('badge === "Maximized"');
    expect(planner).toContain('badge === "Floating"');
    expect(planner).toContain('searchText === "fullscreen maximized floating"');
    expect(planner).toContain("candidate.normalWindow === true");
    expect(planner).toMatch(/catch \(error\) \{\s*return null;/u);

    expect(badgeStart).toBeGreaterThan(0);
    expect(badge).toContain("anchors.top: parent.top");
    expect(badge).toContain("anchors.left: parent.left");
    expect(badge).toContain(
      "visible: card.showWindowStateBadges && thumbnailShell.visible",
    );
    expect(badge).toContain(
      "thumbnailShell.width >= 96 && thumbnailShell.height >= 52",
    );
    expect(badge).toContain("windowStateBadgeEligible(");
    expect(badge).toContain("windowPresentation.selectedThumbnail");
    expect(badge).toContain("windowPresentation.minimizedWindow");
    expect(badge).toContain("windowPresentation.windowState.badge");
    expect(badge).toContain("textFormat: Text.PlainText");
    expect(tab).not.toContain("thumbnailWindowStateBadge");
    expect(placeholder).not.toContain("thumbnailWindowStateBadge");
    expect(search).toContain(
      "function windowMatchesSearch(candidate, windowState)",
    );
    expect(search).toContain(
      "state: card.windowSearchState(candidate, windowState)",
    );
    expect(search).toContain("states.push(windowState.searchText)");
    expect(`${badge}\n${planner}`).not.toMatch(
      /\b(?:TapHandler|DragHandler|Timer|Behavior|Animation|ShortcutHandler)\s*\{|\bsequence\s*:|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|candidate\.[A-Za-z0-9_]+\s*=(?!=)/u,
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
    const boundaryNavigation = scene.slice(
      scene.indexOf("function navigateKeyboardBoundary("),
      scene.indexOf("function handleOverviewWheel("),
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
      /\(modifiers & forbiddenModifiers\) !== Qt\.NoModifier\) \{\s*handled = false;/u,
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
    for (const direction of ["next", "previous"]) {
      expect(keyHandler).toContain(
        `root.navigateKeyboardSequence("${direction}")`,
      );
    }
    for (const direction of ["first", "last"]) {
      expect(keyHandler).toContain(
        `root.navigateKeyboardBoundary("${direction}")`,
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
    expect(navigation).toContain("desktopCardAt(cardIndex)");
    expect(navigation).toContain(
      "desktopCard.collectNavigationTargets(root, true)",
    );
    expect(scene).toContain("const loader = desktopRepeater.itemAt(index)");
    expect(scene).toContain("return loader.item;");
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
    expect(boundaryNavigation).toContain("if (searchQuery.length > 0)");
    expect(boundaryNavigation).toContain("navigateKeyboardSequence(direction)");
    expect(boundaryNavigation).toContain(
      'const workspaceIndex = direction === "first" ? 0 : desktopIds.length - 1',
    );
    expect(boundaryNavigation).toContain(
      "const plan = planSpatialWorkspaceCenter(workspaceIndex)",
    );
    expect(boundaryNavigation).toContain("setSpatialContentY(plan.contentY)");
    expect(boundaryNavigation).toContain(
      "Qt.callLater(root.completeKeyboardBoundaryNavigation, request)",
    );
    expect(boundaryNavigation).toContain(
      "request.requestId !== keyboardBoundaryNavigationRequestId",
    );
    expect(boundaryNavigation).toContain(
      "request.effect.overviewModel !== request.model",
    );
    expect(boundaryNavigation).toContain(
      "request.layout !== overviewSpatialLayout",
    );
    expect(boundaryNavigation).toContain("request.desktopIds !== desktopIds");
    expect(boundaryNavigation).toContain(
      "!desktopCardAt(request.workspaceIndex)",
    );
    expect(boundaryNavigation).toContain(
      "keyboardBoundaryNavigationTarget(targets, request.direction)",
    );
    expect(boundaryNavigation).toContain(
      "navigationTargetPrecedes(target, selected)",
    );
    expect(boundaryNavigation).toContain(
      "navigationTargetPrecedes(selected, target)",
    );
    const boundaryCompletion = boundaryNavigation.slice(
      boundaryNavigation.indexOf(
        "function completeKeyboardBoundaryNavigation(",
      ),
      boundaryNavigation.indexOf(
        "function finishFailedKeyboardBoundaryNavigation(",
      ),
    );
    expect(boundaryCompletion).not.toContain("navigateKeyboardBoundary(");
    expect(scene).toMatch(
      /function repairKeyboardSelection\(\) \{\s*if \(!sceneEffect \|\| sceneEffect\.active !== true \|\| keyboardBoundaryNavigationPending\) \{\s*return;/u,
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
      /KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
    );
  });

  it("routes bounded wheel and touchpad input through spatial intent", () => {
    const wheelHandlerStart = scene.indexOf("WheelHandler {");
    const wheelHandler = scene.slice(
      wheelHandlerStart,
      scene.indexOf("Repeater {", wheelHandlerStart),
    );
    const wheelNavigation = scene.slice(
      scene.indexOf("function handleOverviewWheel("),
      scene.indexOf("function activateKeyboardSelection("),
    );
    const wheelRouting = scene.slice(
      scene.indexOf("function routeOverviewWheel("),
      scene.indexOf("function handleOverviewWheel("),
    );
    const wheelPresentationGuard = scene.slice(
      scene.indexOf("function spatialWheelPresentationIsExact("),
      scene.indexOf("function requestSpatialWheelWorkspace("),
    );
    const wheelWorkspaceSelection = scene.slice(
      scene.indexOf("function requestSpatialWheelWorkspace("),
      scene.indexOf("function spatialWorkspaceWheelTargetPlanIsValid("),
    );
    const horizontalViewportRefresh = scene.slice(
      scene.indexOf("function refreshSpatialHorizontalViewports("),
      scene.indexOf("function spatialHorizontalViewportBounds("),
    );
    const horizontalViewportBounds = scene.slice(
      scene.indexOf("function spatialHorizontalViewportBounds("),
      scene.indexOf("function spatialHorizontalViewportOffsetAt("),
    );

    expect(scene).toContain("property real overviewWheelPixelRemainder: 0");
    expect(scene).toContain("property int overviewWheelRemainder: 0");
    expect(scene).toContain(
      "property real overviewHorizontalWheelPixelRemainder: 0",
    );
    expect(scene).toContain("property int overviewHorizontalWheelRemainder: 0");
    expect(wheelHandler).toMatch(
      /id: spatialVerticalWheelHandler[\s\S]*target: null[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*acceptedModifiers: Qt\.NoModifier[\s\S]*blocking: false[\s\S]*orientation: Qt\.Vertical[\s\S]*onWheel: event => root\.routeOverviewWheel\(event, point\.position, "vertical"\)/u,
    );
    expect(wheelHandler).toMatch(
      /id: spatialHorizontalWheelHandler[\s\S]*blocking: false[\s\S]*orientation: Qt\.Horizontal[\s\S]*onWheel: event => root\.routeOverviewWheel\(event, point\.position, "horizontal"\)/u,
    );
    expect(wheelHandler).toMatch(
      /id: spatialShiftHorizontalWheelHandler[\s\S]*target: null[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*acceptedModifiers: Qt\.ShiftModifier[\s\S]*blocking: false[\s\S]*orientation: Qt\.Vertical[\s\S]*onWheel: event => root\.routeOverviewShiftHorizontalWheel\(event, point\.position\)/u,
    );
    expect(scene).toContain('property string overviewWheelAxisOwner: ""');
    expect(wheelRouting).not.toContain("event.accepted === true");
    expect(wheelRouting).not.toContain("event.accepted = false");
    expect(wheelRouting).toMatch(
      /const pixelInput = event\.pixelDelta\.x !== 0 \|\| event\.pixelDelta\.y !== 0;[\s\S]*horizontalMagnitude > verticalMagnitude \? "horizontal" : "vertical"/u,
    );
    expect(wheelRouting).toMatch(
      /if \(handlerAxis !== requestedAxis\) \{\s*return false;\s*\}/u,
    );
    expect(wheelRouting).toMatch(
      /if \(overviewWheelAxisOwner !== requestedAxis\) \{\s*event\.accepted = true;\s*return true;/u,
    );
    expect(wheelRouting).toMatch(
      /const handled = requestedAxis === "horizontal"[\s\S]*handleOverviewHorizontalWheel\(event, point\)[\s\S]*handleOverviewWheel\(event\)[\s\S]*if \(claimedAxis && !handled\)/u,
    );
    expect(wheelRouting).toMatch(
      /function routeOverviewShiftHorizontalWheel[\s\S]*event\.modifiers !== Qt\.ShiftModifier[\s\S]*const pixelDeltaX = event\.pixelDelta\.y;[\s\S]*const angleDeltaX = event\.angleDelta\.y;[\s\S]*overviewWheelAxisOwner = "horizontal";[\s\S]*handleOverviewHorizontalWheelInput\(event, point, angleDeltaX, pixelDeltaX\)/u,
    );
    expect(wheelRouting).toMatch(
      /function releaseOverviewWheelAxisIfIdle[\s\S]*!spatialVerticalWheelHandler\.active && !spatialHorizontalWheelHandler\.active[\s\S]*!spatialShiftHorizontalWheelHandler\.active[\s\S]*overviewWheelAxisOwner = "";/u,
    );
    expect(wheelNavigation).toContain("event.modifiers !== Qt.NoModifier");
    expect(wheelNavigation).toContain("keyboardHelpVisible");
    expect(scene).toContain(
      "onKeyboardHelpVisibleChanged: root.resetOverviewWheelState()",
    );
    expect(scene).toMatch(
      /onSpatialContentYChanged: \{\s*root\.resetOverviewWheelState\(\);\s*root\.captureSpatialViewportSnapshot\(\);\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /spatialViewportDragHandler\.active \|\| spatialWindowDragSource !== null[\s\S]*\|\| desktopReorderActive[\s\S]*resetOverviewWheelState\(\);[\s\S]*event\.accepted = true;[\s\S]*return true;/u,
    );
    expect(
      wheelNavigation.indexOf("if (spatialViewportDragHandler.active"),
    ).toBeLessThan(wheelNavigation.indexOf("const handled = pixelDeltaY"));
    expect(wheelNavigation).toMatch(
      /const handled = pixelDeltaY !== 0[\s\S]*handleSpatialViewportWheel\(angleDeltaY, pixelDeltaY\)[\s\S]*searchQuery\.length > 0[\s\S]*handleSearchResultWheel\(angleDeltaY\)[\s\S]*handleSpatialWorkspaceWheel\(angleDeltaY\)/u,
    );
    expect(wheelNavigation).toContain(
      'typeof runtime.planOverviewSpatialWheel !== "function"',
    );
    expect(wheelNavigation).toMatch(
      /runtime\.planOverviewSpatialWheel\(\{[\s\S]*angleDeltaY,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY: spatialContentY,[\s\S]*pixelDeltaY,[\s\S]*pixelRemainder: overviewWheelPixelRemainder,[\s\S]*remainder: overviewWheelRemainder,[\s\S]*sceneHeight: height/u,
    );
    expect(wheelNavigation).toContain('plan.intent === "viewport"');
    expect(wheelNavigation).toContain('plan.intent === "workspace"');
    expect(wheelNavigation).toContain(
      'typeof runtime.planOverviewSpatialHorizontalWheel !== "function"',
    );
    expect(wheelNavigation).toMatch(
      /runtime\.planOverviewSpatialHorizontalWheel\(\{[\s\S]*angleDeltaX,[\s\S]*maximumViewportOffset: bounds\.maximum,[\s\S]*minimumViewportOffset: bounds\.minimum,[\s\S]*pixelDeltaX,[\s\S]*projectionScale,[\s\S]*viewportOffset/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleOverviewHorizontalWheel[\s\S]*spatialWorkspaceIndexAtPoint\(point\)[\s\S]*pixelDeltaX !== 0[\s\S]*handleSpatialHorizontalViewportWheel[\s\S]*handleSpatialHorizontalSelectionWheel/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleOverviewHorizontalWheel\(event, point\)[\s\S]*event\.modifiers !== Qt\.NoModifier[\s\S]*handleOverviewHorizontalWheelInput\(event, point,[\s\S]*event\.angleDelta\.x, event\.pixelDelta\.x\)/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleOverviewHorizontalWheelInput\(event, point, angleDeltaX, pixelDeltaX\)[\s\S]*keyboardHelpVisible \|\| !sceneEffect \|\| sceneEffect\.active !== true[\s\S]*searchQuery\.length > 0[\s\S]*spatialWorkspaceIndexAtPoint\(point\)/u,
    );
    expect(wheelNavigation).toMatch(
      /function navigateHorizontalWheelSelection[\s\S]*target\.desktopId === expectedDesktopId[\s\S]*findOverviewNavigationTarget\(selected\.id, rowTargets, navigationDirection\)/u,
    );
    expect(wheelNavigation).toMatch(
      /function revealHorizontalNavigationTarget[\s\S]*sceneAdjustment \/ card\.projectionScale[\s\S]*setSpatialHorizontalViewportOffset/u,
    );
    expect(scene).toContain("property var spatialHorizontalDesktopIds: []");
    expect(scene).toContain("property var spatialHorizontalGeometryPlans: []");
    expect(scene).toContain(
      "property var spatialHorizontalViewportOffsets: []",
    );
    expect(scene).toMatch(
      /function desktopIdListShapeIsValid\(candidate\) \{\s*return candidate !== undefined && candidate !== null && Number\.isInteger\(candidate\.length\)[\s\S]*candidate\.length >= 0 && candidate\.length <= 512;\s*\}/u,
    );
    expect(horizontalViewportRefresh).toMatch(
      /function refreshSpatialHorizontalViewports[\s\S]*const currentDesktopIds = desktopIds;[\s\S]*!desktopIdListShapeIsValid\(currentDesktopIds\)[\s\S]*return false;[\s\S]*previousOffsets\.length === currentDesktopIds\.length[\s\S]*index < currentDesktopIds\.length[\s\S]*planSpatialHorizontalGeometry\(index, desktopId\)[\s\S]*nextGeometryPlans\.push\(geometryPlan\)[\s\S]*nextOffsets\.push\(Math\.min\(bounds\.maximum, Math\.max\(bounds\.minimum, previous\)\)\)/u,
    );
    expect(horizontalViewportRefresh).toMatch(
      /!desktopIdListShapeIsValid\(currentDesktopIds\)[\s\S]*spatialHorizontalDesktopIds = \[\];[\s\S]*spatialHorizontalGeometryPlans = \[\];[\s\S]*spatialHorizontalViewportOffsets = \[\];[\s\S]*resetOverviewHorizontalWheelState\(\);[\s\S]*return false;/u,
    );
    expect(horizontalViewportBounds).toMatch(
      /function spatialHorizontalViewportBounds[\s\S]*spatialHorizontalGeometryPlanAt\(index, expectedDesktopId,[\s\S]*spatialHorizontalViewportRevision\)[\s\S]*spatialHorizontalViewportBoundsForPlan\(plan\)/u,
    );
    expect(horizontalViewportRefresh).not.toMatch(
      /\bdesktopIds\.length\b|desktopIds\[index\]/u,
    );
    expect(horizontalViewportBounds).not.toMatch(
      /\bdesktopIds\.length\b|desktopIds\[index\]/u,
    );
    expect(scene).toMatch(
      /function planSpatialHorizontalGeometry[\s\S]*runtime\.planOverviewSpatialRowGeometry\(\{[\s\S]*activeColumnIndex: context\.activeColumnIndex,[\s\S]*alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,[\s\S]*devicePixelRatio,[\s\S]*gap: overviewGap,[\s\S]*viewportOffset: context\.viewportOffset,[\s\S]*workArea/u,
    );
    expect(scene).toContain(
      "KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea, screen, desktop)",
    );
    expect(scene).toMatch(
      /function spatialHorizontalGeometryPlanIsValid[\s\S]*plan\.columnFrames\.length !== context\.columns\.length[\s\S]*plan\.camera\.minimum > plan\.camera\.base[\s\S]*plan\.dimensions\.viewportWidth !== workArea\.width[\s\S]*frame\.columnId !== `overview-column-\$\{columnIndex\}`/u,
    );
    expect(scene).not.toMatch(
      /function spatialHorizontalViewportBounds[\s\S]{0,2500}resolvedWidth/u,
    );
    expect(scene).toMatch(
      /previewViewportOffset: root\.spatialHorizontalViewportOffsetAt\([\s\S]*desktopCardLoader\.index, desktopCardLoader\.modelData,[\s\S]*root\.spatialHorizontalViewportRevision\)/u,
    );
    expect(scene).toMatch(
      /spatialRowGeometryPlan: root\.spatialHorizontalGeometryPlanAt\([\s\S]*desktopCardLoader\.index, desktopCardLoader\.modelData,[\s\S]*root\.spatialHorizontalViewportRevision\)/u,
    );
    expect(scene).toMatch(
      /function setSpatialHorizontalViewportOffsetForBounds[\s\S]*spatialHorizontalViewportOffsets\[index\] === normalizedOffset[\s\S]*return true;[\s\S]*spatialHorizontalViewportOffsets\[index\] = normalizedOffset;\s*advanceSpatialHorizontalViewportRevision\(\);/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleSpatialViewportWheel[\s\S]*setSpatialContentY\(plan\.contentY\)[\s\S]*overviewWheelPixelRemainder = plan\.pixelRemainder;[\s\S]*overviewWheelRemainder = 0;[\s\S]*return true;/u,
    );
    expect(wheelNavigation).toContain(
      "runtime.planOverviewWheelNavigation(overviewWheelRemainder,",
    );
    expect(wheelNavigation).toMatch(
      /function handleSearchResultWheel[\s\S]*for \(let step = 0; step < plan\.steps; step \+= 1\)[\s\S]*navigateKeyboardSequence\(plan\.direction\)/u,
    );
    expect(wheelNavigation).toContain(
      'typeof runtime.planOverviewSpatialWorkspaceWheelTarget !== "function"',
    );
    expect(wheelNavigation).toMatch(
      /runtime\.planOverviewSpatialWorkspaceWheelTarget\(\{[\s\S]*currentIndex: sourceIndex,[\s\S]*direction,[\s\S]*steps,[\s\S]*workspaceCount: expectedDesktopIds\.length/u,
    );
    expect(wheelNavigation).toContain(
      "plan.appliedSteps !== Math.abs(plan.targetIndex - sourceIndex)",
    );
    expect(wheelNavigation).toContain(
      'direction === "previous" ? plan.targetIndex <= sourceIndex',
    );
    expect(wheelNavigation).toContain("requestDesktopSelection(");
    expect(wheelNavigation).toContain("effect.active === true");
    expect(wheelWorkspaceSelection).toContain('keyboardSelectionId = ""');
    expect(wheelWorkspaceSelection).toContain(
      "Qt.callLater(root.repairKeyboardSelection)",
    );
    expect(wheelWorkspaceSelection.indexOf("selectionConfirmed")).toBeLessThan(
      wheelWorkspaceSelection.indexOf('keyboardSelectionId = ""'),
    );
    expect(wheelPresentationGuard).not.toMatch(
      /liveScreenFor|liveDesktopFor|projectedOutput|desktopContextIsExact|for\s*\(/u,
    );
    expect(wheelWorkspaceSelection).toContain(
      "const liveScreen = liveScreenFor(targetScreen)",
    );
    expect(wheelWorkspaceSelection).toContain(
      "const expectedOutput = projectedOutput(model, liveScreen)",
    );
    expect(wheelWorkspaceSelection).toContain("desktopContextIsExact(");
    expect(wheelNavigation).not.toContain("deactivate()");
    expect(overviewRuntimeIndex).toContain("planOverviewSpatialWheel");
    expect(overviewRuntimeIndex).toContain(
      "planOverviewSpatialHorizontalWheel",
    );
    expect(overviewRuntimeIndex).toContain(
      "planOverviewSpatialWorkspaceWheelTarget",
    );
    expect(scene).toMatch(
      /function refreshOverviewSpatialSession\(preserveViewport\)[\s\S]*resetOverviewWheelState\(\);/u,
    );
    expect(scene).toMatch(
      /DragHandler \{[\s\S]*id: spatialViewportDragHandler[\s\S]*onActiveChanged: \{[\s\S]*if \(active\) \{\s*root\.resetOverviewWheelState\(\);/u,
    );
    expect(scene).toMatch(
      /function beginWindowSpatialEdgePan\([\s\S]*resetOverviewWheelState\(\);\s*spatialWindowDragSource = source;/u,
    );
    expect(scene).toMatch(
      /function beginDesktopReorder\([\s\S]*resetOverviewWheelState\(\);\s*desktopReorderActive = true;/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewWheelState\(\) \{\s*resetOverviewHorizontalWheelState\(\);\s*resetOverviewVerticalWheelState\(\);\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewHorizontalWheelState\(\) \{\s*overviewHorizontalWheelPixelRemainder = 0;\s*overviewHorizontalWheelRemainder = 0;\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewVerticalWheelState\(\) \{\s*overviewWheelPixelRemainder = 0;\s*overviewWheelRemainder = 0;\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /if \(plan\.steps > 0\)[\s\S]*requestSpatialWheelWorkspace\(plan\.direction, plan\.steps\)[\s\S]*resetOverviewWheelState\(\);[\s\S]*else \{[\s\S]*overviewWheelRemainder = plan\.remainder;/u,
    );
    expect(`${wheelHandler}\n${wheelNavigation}`).not.toMatch(
      /candidate\.[A-Za-z0-9_]+\s*=(?!=)|overviewModel\.[A-Za-z0-9_]+\s*=(?!=)|\bTimer\s*\{|\.setValue\s*\(/u,
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
      "clippedCardNavigationRect(numberGutter, sceneItem, includeOffscreen)",
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

  it("shows bounded keyboard help without dispatching overview input", () => {
    const keyHandler = scene.slice(
      scene.indexOf("Keys.onPressed:"),
      scene.indexOf("Component.onCompleted:"),
    );
    const modalKeyHandler = keyHandler.slice(
      keyHandler.indexOf("if (keyboardHelpVisible)"),
      keyHandler.indexOf(
        "if (unmodified && event.key === Qt.Key_F1)",
        keyHandler.indexOf("if (keyboardHelpVisible)") + 1,
      ),
    );
    const help = scene.slice(
      scene.indexOf("id: keyboardHelpLoader"),
      scene.indexOf("id: outputIdentityLoader"),
    );
    const helpScrolling = help.slice(
      help.indexOf("readonly property real helpLineStep:"),
      help.indexOf("Rectangle {"),
    );
    const helpWheelStart = help.indexOf("WheelHandler {");
    const helpWheel = help.slice(
      helpWheelStart,
      help.indexOf("Column {", helpWheelStart),
    );

    expect(scene).toContain("property bool keyboardHelpVisible: false");
    expect(keyHandler).toMatch(
      /if \(keyboardHelpVisible\) \{[\s\S]*Qt\.Key_F1[\s\S]*Qt\.Key_Escape[\s\S]*keyboardHelpVisible = false;[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
    expect(keyHandler).toMatch(
      /if \(unmodified && event\.key === Qt\.Key_F1\) \{[\s\S]*!event\.isAutoRepeat[\s\S]*keyboardHelpVisible = true;[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
    expect(keyHandler.indexOf("if (keyboardHelpVisible)")).toBeLessThan(
      keyHandler.indexOf("let handled = true"),
    );
    expect(modalKeyHandler).toContain(
      "else if (unmodified && keyboardHelpLoader.item)",
    );
    expect(modalKeyHandler).toContain(
      "keyboardHelpLoader.item.handleScrollKey(event.key);",
    );
    expect(
      modalKeyHandler.indexOf("keyboardHelpVisible = false;"),
    ).toBeLessThan(modalKeyHandler.indexOf("handleScrollKey(event.key)"));
    expect(modalKeyHandler).toMatch(
      /handleScrollKey\(event\.key\);[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
    expect(scene).toMatch(
      /function resetOverviewSession\(\)[\s\S]*keyboardHelpVisible = false;/u,
    );
    expect(scene).toContain("enabled: !root.keyboardHelpVisible");

    expect(help).toContain("active: root.keyboardHelpVisible");
    expect(help).toContain("sourceComponent: Component {");
    expect(help).toContain("width: Math.min(560,");
    expect(help).toContain("height: Math.min(helpContent.implicitHeight + 40,");
    expect(help).toContain("interactive: contentHeight > height");
    expect(helpScrolling).toContain("readonly property real helpLineStep: 40");
    expect(helpScrolling).toContain(
      "Math.max(0, helpViewport.contentHeight - helpViewport.height)",
    );
    expect(helpScrolling).toContain(
      "if (maximumContentY <= 0 || !Number.isFinite(targetContentY))",
    );
    expect(helpScrolling).toContain(
      "helpViewport.contentY = Math.max(0, Math.min(maximumContentY, targetContentY));",
    );
    for (const key of ["Up", "Down", "PageUp", "PageDown", "Home", "End"]) {
      expect(helpScrolling).toContain(`key === Qt.Key_${key}`);
    }
    expect(helpScrolling).toContain(
      "setHelpContentY(helpViewport.contentY - helpLineStep)",
    );
    expect(helpScrolling).toContain(
      "setHelpContentY(helpViewport.contentY + helpLineStep)",
    );
    expect(helpScrolling).toContain(
      "setHelpContentY(helpViewport.contentY - helpViewport.height)",
    );
    expect(helpScrolling).toContain(
      "setHelpContentY(helpViewport.contentY + helpViewport.height)",
    );
    expect(helpScrolling).toContain("setHelpContentY(0)");
    expect(helpScrolling).toContain(
      "setHelpContentY(helpViewport.contentHeight - helpViewport.height)",
    );
    expect(helpScrolling).toMatch(
      /function handleHelpWheel\(event\)[\s\S]*event\.accepted = true;[\s\S]*event\.angleDelta[\s\S]*event\.pixelDelta[\s\S]*setHelpContentY\(helpViewport\.contentY \+ delta\);/u,
    );
    expect(helpScrolling).toContain(
      "delta = -event.angleDelta.y * helpLineStep / 120",
    );
    expect(helpScrolling).toContain("delta = -event.pixelDelta.y");
    expect(helpWheel).toMatch(
      /target: null[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*acceptedModifiers: Qt\.KeyboardModifierMask[\s\S]*orientation: Qt\.Vertical[\s\S]*blocking: true[\s\S]*onWheel: event => keyboardHelpOverlay\.handleHelpWheel\(event\)/u,
    );
    expect(help.match(/\bWheelHandler\s*\{/gu)).toHaveLength(1);
    expect(help).toContain(
      'text: "Scroll: Wheel, Up/Down, Page Up/Page Down, Home/End\\nClose: F1, Escape, or Close"',
    );
    expect(help).toContain("KeyboardHelpCloseButton {");
    expect(help).toContain(
      "onCloseRequested: root.keyboardHelpVisible = false",
    );
    expect(keyboardHelpCloseButton).toContain('text: "Close"');
    expect(keyboardHelpCloseButton).toContain("acceptedButtons: Qt.LeftButton");
    expect(keyboardHelpCloseButton).toContain(
      "cursorShape: Qt.PointingHandCursor",
    );
    expect(keyboardHelpCloseButton).toContain(
      "onTapped: button.closeRequested()",
    );
    for (const label of [
      "Arrow keys",
      "Tab / Shift+Tab",
      "Home / End",
      "Enter / Space",
      "Delete",
      "Type text",
      "Backspace",
      "Ctrl+Backspace",
      "Ctrl+U",
      "Escape",
      "F1",
      "Search fields",
      "Search operators",
    ]) {
      expect(help).toContain(`keys: "${label}"`);
    }
    expect(help).toContain('action: "title:, app:, desktop:, output:, state:"');
    expect(help).toContain('-exclude, | alternatives"');
    expect(help.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(`${help}\n${keyboardHelpCloseButton}`).not.toMatch(
      /\b(?:Action|Animation|Behavior|Connections|Settings|ShortcutHandler|Timer)\s*\{|\.setValue\s*\(|\bsequence\s*:|org\.kde\.kwin\.private/u,
    );

    const helpHint = scene.slice(
      scene.indexOf("KeyboardHelpHint {"),
      scene.indexOf("id: keyboardHelpLoader"),
    );
    expect(helpHint).toContain("root.width >= 480 && root.height >= 320");
    expect(helpHint).toContain("root.searchQuery.length === 0");
    expect(helpHint).toContain("!root.keyboardHelpVisible");
    expect(helpHint).toContain(
      "onOpenRequested: root.keyboardHelpVisible = true",
    );
    expect(keyboardHelpHint).toContain('text: "F1  Keyboard help"');
    expect(keyboardHelpHint).toContain("hintTapHandler.pressed");
    expect(keyboardHelpHint).toContain("hintHoverHandler.hovered");
    expect(keyboardHelpHint).toContain("cursorShape: Qt.PointingHandCursor");
    expect(keyboardHelpHint).toContain("acceptedButtons: Qt.LeftButton");
    expect(keyboardHelpHint).toContain("PointerDevice.TouchScreen");
    expect(keyboardHelpHint).toContain(
      "gesturePolicy: TapHandler.ReleaseWithinBounds",
    );
    expect(keyboardHelpHint).toContain(
      "grabPermissions: PointerHandler.CanTakeOverFromAnything",
    );
    expect(keyboardHelpHint).toContain("onTapped: hint.openRequested()");
    expect(keyboardHelpHint.match(/\bHoverHandler\s*\{/gu)).toHaveLength(1);
    expect(keyboardHelpHint.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(keyboardHelpHint).not.toMatch(
      /\b(?:Action|Animation|Behavior|Connections|Settings|ShortcutHandler|Timer|WheelHandler)\s*\{|\.setValue\s*\(|\bsequence\s*:|org\.kde\.kwin\.private/u,
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
    expect(scene).toContain("searchQueryPlan: root.searchQueryPlan");
    expect(scene).toContain(
      "readonly property var searchQueryPlan: planSearchQuery(searchQuery)",
    );
    expect(scene).toContain(
      "readonly property bool searchQueryValid: searchQueryPlan !== null",
    );
    expect(scene).toMatch(
      /onSearchQueryChanged: \{\s*resetOverviewWheelState\(\);\s*cancelKeyboardBoundaryNavigation\(\);\s*Qt\.callLater\(root\.repairKeyboardSelection\);\s*\}/u,
    );
    expect(keyHandler).toContain("event.key === Qt.Key_Backspace");
    expect(keyHandler).toContain("root.removeLastSearchCharacter()");
    expect(keyHandler).toContain(
      "controlOnly && event.key === Qt.Key_Backspace && searchQuery.length > 0",
    );
    expect(keyHandler).toContain("root.removeLastSearchClause()");
    expect(keyHandler).toContain(
      "controlOnly && event.key === Qt.Key_U && searchQuery.length > 0",
    );
    expect(
      keyHandler.indexOf("controlOnly && event.key === Qt.Key_Backspace"),
    ).toBeLessThan(keyHandler.indexOf("(modifiers & forbiddenModifiers)"));
    expect(keyHandler).toContain("event.accepted = handled");
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
    expect(searchFunctions).toContain(
      'typeof runtime.removeLastOverviewSearchClause !== "function"',
    );
    expect(searchFunctions).toContain(
      "runtime.removeLastOverviewSearchClause(current)",
    );
    expect(searchFunctions).not.toContain("repairKeyboardSelection()");
    expect(scene).toContain("function onActiveChanged()");
    expect(scene).toMatch(
      /function resetOverviewSession\(\)[\s\S]*searchQuery = "";/u,
    );
    expect(scene).toContain("No matching windows: ${root.searchQuery}");
    expect(scene).toContain("Invalid search query: ${root.searchQuery}");
    expect(scene).toContain("textFormat: Text.PlainText");
    expect(scene).not.toContain("TextInput");
    expect(searchFeedback).toContain(
      "runtime.summarizeOverviewWindowNavigationTargets(targets)",
    );
    expect(searchFeedback).toContain("searchSummaryIsValid(summary");
    expect(searchFeedback).toContain("searchResultCount = summary.total");
    expect(searchFeedback).toContain(
      "searchResultCountsByDesktop = summary.byDesktop",
    );
    expect(searchFeedback).toContain(
      "searchResultOrdinalsByTarget = summary.ordinalByTargetId",
    );
    expect(searchFeedback).not.toContain("collectNavigationTargets()");

    expect(desktopCard).toContain("required property string searchQuery");
    expect(desktopCard).toContain("required property var searchQueryPlan");
    expect(desktopCard).toContain(
      "readonly property bool matchesSearch: card.windowMatchesSearch(candidate, windowState)",
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
      "desktopName",
      "outputName",
      "state",
    ]) {
      expect(matcher).toContain(`${field}:`);
    }
    expect(matcher).toContain(
      "state: card.windowSearchState(candidate, windowState)",
    );
    expect(matcher).toContain("outputName: card.outputName");
    expect(matcher).not.toContain("showOutputNames");
    expect(matcher).toContain(
      "function windowSearchState(candidate, windowState)",
    );
    expect(matcher).toContain("if (windowDemandsAttention(candidate))");
    expect(matcher).toContain('states.push("urgent attention")');
    expect(matcher).toContain(
      "candidate && candidate.deleted !== true && candidate.minimized === true",
    );
    expect(matcher).toContain('states.push("minimized")');
    expect(matcher).toContain("states.push(windowState.searchText)");
    expect(matcher.match(/states\.push\(/gu)).toHaveLength(3);
    expect(matcher).toContain('return states.join(" ")');
    expect(matcher).toContain(
      'typeof runtime.matchesOverviewWindowSearchPlan !== "function"',
    );
    expect(matcher).toContain(
      "runtime.matchesOverviewWindowSearchPlan(searchQueryPlan, {",
    );
    expect(matcher).not.toContain("runtime.matchesOverviewWindowSearch(");
    expect(scene).toContain(
      'typeof runtime.planOverviewWindowSearchQuery !== "function"',
    );
    expect(scene).toContain("runtime.planOverviewWindowSearchQuery(query)");
    expect(desktopCard).not.toContain("planOverviewWindowSearchQuery");
    expect(scene).toContain("if (searchQuery.length > 0 && searchQueryValid)");
    expect(scene).toContain("visible: root.searchQuery.length > 0");
    expect(overviewRuntimeIndex).toContain("matchesOverviewWindowSearchPlan");
    expect(overviewRuntimeIndex).toContain("planOverviewWindowSearchQuery");
    expect(overviewRuntimeIndex).toContain("removeLastOverviewSearchClause");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /\bTextInput\s*\{|\.setValue\s*\(/u,
    );
  });

  it("shows passive search navigation context from one navigation summary", () => {
    const searchFeedback = scene.slice(
      scene.indexOf("function repairKeyboardSelectionFrom("),
      scene.indexOf("function preferredInitialNavigationTarget("),
    );
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const searchPresentation = desktopCard.slice(
      desktopCard.indexOf("readonly property bool searchDeemphasized"),
      desktopCard.indexOf("id: numberGutter"),
    );

    expect(scene).toContain(
      "property var searchResultCountsByDesktop: Object.create(null)",
    );
    expect(scene).toContain(
      "property var searchResultOrdinalsByTarget: Object.create(null)",
    );
    expect(scene).toContain(
      "readonly property int searchResultOrdinal: searchResultOrdinalForTarget(keyboardSelectionId)",
    );
    expect(scene).toContain(
      "searchResultCount: root.searchResultCountForDesktop(desktopCardLoader.modelData)",
    );
    expect(
      searchFeedback.match(/summarizeOverviewWindowNavigationTargets/gu),
    ).toHaveLength(2);
    expect(searchFeedback).toContain(
      "searchQuery.length > 0 && searchQueryValid",
    );
    expect(searchFeedback).toContain(
      "searchResultCountsByDesktop = Object.create(null)",
    );
    expect(searchFeedback).toContain(
      "searchResultOrdinalsByTarget = Object.create(null)",
    );
    expect(searchFeedback).toContain(
      "searchResultOrdinalsByTarget = summary.ordinalByTargetId",
    );
    expect(searchFeedback).toContain(
      "function searchResultOrdinalForTarget(targetId)",
    );
    expect(searchFeedback).toContain("Object.keys(summary.ordinalByTargetId)");
    expect(scene).toContain("root.searchResultOrdinal > 0");
    expect(scene).toContain(
      '`${root.searchResultOrdinal}/${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`',
    );
    expect(scene).toContain(
      '`${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`',
    );
    expect(searchFeedback).not.toMatch(
      /desktopRepeater|windowRepeater|collectNavigationTargets\(\)|overviewModel\.outputs/u,
    );

    expect(desktopCard).toContain("required property int searchResultCount");
    expect(desktopCard).toContain(
      "readonly property bool searchDeemphasized: searchQuery.trim().length > 0 && searchResultCount === 0",
    );
    expect(desktopCard).toContain("opacity: searchDeemphasized ? 0.42 : 1");
    expect(searchPresentation).not.toMatch(
      /visible:\s*searchDeemphasized|\b(?:Animation|Behavior|Timer)\s*\{/u,
    );
    expect(numberGutter).toMatch(
      /active: card\.searchQuery\.trim\(\)\.length > 0 && card\.searchResultCount > 0/u,
    );
    expect(numberGutter).toMatch(
      /sourceComponent: Component \{\s*SearchMatchBadge \{\s*count: card\.searchResultCount/u,
    );
    expect(searchMatchBadge).toContain("required property int count");
    expect(searchMatchBadge).toContain("text: String(badge.count)");
    expect(searchMatchBadge).toContain("textFormat: Text.PlainText");
    expect(searchMatchBadge).not.toMatch(
      /\b(?:Action|Animation|Behavior|Connections|DragHandler|MouseArea|TapHandler|Timer)\s*\{|\.setValue\s*\(|\bon[A-Z]\w*\s*:/u,
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
    expect(controller).toMatch(
      /function onWindowRemoved\(\) \{\s*controller\.requestLiveModelRefresh\(\);/u,
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

  it("offers exact close buttons without activating or dragging their windows", () => {
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

    expect(desktopCard).toContain(
      "required property bool showWindowCloseButtons",
    );
    expect(windowCloseButton).toMatch(
      /required property bool closeEligible[\s\S]*required property bool keyboardSelected[\s\S]*required property bool settingEnabled[\s\S]*required property bool surfaceHovered[\s\S]*required property bool surfaceLargeEnough/u,
    );
    expect(windowCloseButton).toContain(
      "visible: settingEnabled && closeEligible && surfaceLargeEnough && (surfaceHovered || keyboardSelected)",
    );
    expect(windowCloseButton).toMatch(
      /acceptedButtons: Qt\.LeftButton[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*gesturePolicy: TapHandler\.ReleaseWithinBounds[\s\S]*grabPermissions: PointerHandler\.CanTakeOverFromAnything[\s\S]*onTapped: button\.closeRequested\(\)/u,
    );

    for (const visual of [
      {
        buttonId: "thumbnailCloseButton",
        hoverId: "thumbnailHoverHandler",
        keyboardSelection: "thumbnailShell.keyboardSelected",
        minimum: "width >= 52 && height >= 40",
        source: thumbnail,
        surface: "thumbnailShell",
      },
      {
        buttonId: "tabCloseButton",
        hoverId: "tabHoverHandler",
        keyboardSelection: "tabShell.keyboardSelected",
        minimum: "width >= 52 && height >= 18",
        source: tab,
        surface: "tabShell",
      },
      {
        buttonId: "minimizedPlaceholderCloseButton",
        hoverId: "minimizedPlaceholderHoverHandler",
        keyboardSelection: "minimizedPlaceholderShell.keyboardSelected",
        minimum: "width >= 72 && height >= 20",
        source: placeholder,
        surface: "minimizedPlaceholderShell",
      },
    ] as const) {
      expect(visual.source).toContain(
        `readonly property bool closeButtonLargeEnough: ${visual.minimum}`,
      );
      expect(visual.source).toContain(`id: ${visual.buttonId}`);
      expect(visual.source).toContain(
        "settingEnabled: card.showWindowCloseButtons",
      );
      expect(visual.source).toContain(
        "closeEligible: windowPresentation.closeEligible",
      );
      expect(visual.source).toContain(
        `surfaceHovered: ${visual.hoverId}.hovered`,
      );
      expect(visual.source).toContain(
        `keyboardSelected: ${visual.keyboardSelection}`,
      );
      expect(visual.source).toContain(
        `surfaceLargeEnough: ${visual.surface}.closeButtonLargeEnough`,
      );
      expect(visual.source).toMatch(
        new RegExp(
          `id: ${visual.buttonId}[\\s\\S]*onCloseRequested: card\\.windowCloseRequested\\(windowPresentation\\.candidate,[\\s\\S]*windowPresentation\\.windowId,[\\s\\S]*windowPresentation\\.sourceDesktop,[\\s\\S]*windowPresentation\\.sourceDesktopId,[\\s\\S]*windowPresentation\\.sourceScreen\\)`,
          "u",
        ),
      );
      expect(visual.source).toContain(`id: ${visual.hoverId}`);
      expect(visual.source).toMatch(
        new RegExp(
          `onTapped: point => \\{[\\s\\S]*card\\.closeButtonContainsPoint\\(${visual.buttonId},[\\s\\S]*point\\.position\\)[\\s\\S]*return;[\\s\\S]*card\\.windowTapped\\(`,
          "u",
        ),
      );
      const buttonStart = visual.source.indexOf(`id: ${visual.buttonId}`);
      const buttonEnd = visual.source.indexOf(
        `id: ${visual.hoverId}`,
        buttonStart,
      );
      const button = visual.source.slice(buttonStart, buttonEnd);
      expect(button).not.toMatch(
        /\b(?:Timer|Behavior|Animation|DragHandler)\s*\{|windowTapped|activeWindow\s*=|candidate\.minimized\s*=|\.setValue\s*\(|org\.kde\.kwin\.private/u,
      );
    }

    expect(thumbnail).toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested ? 24 : 5",
    );
    expect(tab).toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested ? 18 : 3",
    );
    expect(placeholder).toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested ? 19 : 4",
    );
    expect(windowCloseButton).not.toMatch(
      /\b(?:Timer|Behavior|Animation|DragHandler)\s*\{|windowTapped|activeWindow\s*=|candidate\.minimized\s*=|\.setValue\s*\(|org\.kde\.kwin\.private/u,
    );
    expect(windowCloseButton).not.toContain(
      "ApprovesTakeOverByHandlersOfDifferentType",
    );
    const containmentGuard = desktopCard.slice(
      desktopCard.indexOf("function closeButtonContainsPoint("),
      desktopCard.indexOf(
        "\n    }",
        desktopCard.indexOf("function closeButtonContainsPoint("),
      ) + 6,
    );
    expect(containmentGuard).toContain("button.mapFromItem(surface");
    expect(containmentGuard).toContain("return true;");
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
    expect(numberGutter).toContain("width: 42");
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
    expect(scene.match(/requestDesktopSelection\(/gu)).toHaveLength(4);

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
      /\b(?:Action|MouseArea|Settings|ShortcutHandler)\s*\{|\.setValue\s*\(|\bsequence\s*:/u,
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

  it("projects neighboring columns with one spatial scale and bounded stack heights", () => {
    const presentations = desktopCard.slice(
      desktopCard.indexOf("function buildTiledPresentations("),
      desktopCard.indexOf("function buildFloatingWindowIds("),
    );

    expect(presentations).toContain(
      "const presentations = Object.create(null)",
    );
    expect(desktopCard).toContain(
      "readonly property real projectionScale: finitePositive(contentHeight / sourceViewportHeight",
    );
    expect(desktopCard).toContain(
      "readonly property real viewportOriginX: finiteNumber((contentWidth - projectedViewportWidth) / 2, 0)",
    );
    expect(desktopCard).toContain(
      "readonly property var columnFrames: buildColumnFrames()",
    );
    expect(desktopCard).toContain(
      "required property real previewViewportOffset",
    );
    expect(desktopCard).toContain(
      "required property var spatialRowGeometryPlan",
    );
    expect(desktopCard).toContain(
      "readonly property real logicalViewportOffset: finiteNumber(previewViewportOffset, 0)",
    );
    expect(presentations).toContain(
      "const columnFrame = card.columnFrame(columnIndex)",
    );
    expect(presentations).toContain("const columnX = columnFrame.x");
    expect(presentations).toContain("const columnWidth = columnFrame.width");
    expect(desktopCard).toMatch(
      /x: viewportOriginX \+ \(geometry\.x - screenGeometry\.x\) \* projectionScale,\s*y: viewportOriginY \+ \(geometry\.y - screenGeometry\.y\) \* projectionScale/u,
    );
    expect(desktopCard).not.toMatch(/horizontalScale|verticalScale/u);
    expect(presentations).not.toContain("context.viewportOffset *");
    expect(desktopCard).not.toContain("Number(context.viewportOffset)");
    expect(desktopCard).toMatch(
      /function buildColumnFrames\(\) \{[\s\S]*buildSpatialColumnFrames\(\)[\s\S]*buildLegacyColumnFrames\(\)/u,
    );
    expect(desktopCard).toMatch(
      /function buildSpatialColumnFrames\(\)[\s\S]*sourceFrames\.length !== columns\.length[\s\S]*dimensions\.viewportInsetX \+ sourceFrame\.contentX - logicalViewportOffset[\s\S]*sourceFrame\.width \* projectionScale/u,
    );
    expect(desktopCard).toMatch(
      /function columnFrame\(columnIndex\) \{[\s\S]*const frame = columnFrames\[columnIndex\];[\s\S]*return frame;/u,
    );
    const columnFrame = desktopCard.slice(
      desktopCard.indexOf("function columnFrame("),
      desktopCard.indexOf("function widthForColumn("),
    );
    expect(columnFrame).not.toMatch(/for\s*\(|\.slice\(|\.map\(/u);
    expect(desktopCard).toMatch(
      /function clippedNavigationRect[\s\S]*if \(includeOffscreen === true\) \{[\s\S]*width: rect\.width,[\s\S]*x: rect\.x,[\s\S]*return navigationRectIsValid\(rect\) \? rect : null;/u,
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
