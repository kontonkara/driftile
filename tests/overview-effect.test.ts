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
const touchpadZoomGesture = readFileSync(
  new URL("contents/runtime/ui/OverviewTouchpadZoomGesture.qml", effectRoot),
  "utf8",
);
const touchscreenZoomGesture = readFileSync(
  new URL("contents/runtime/ui/OverviewTouchscreenZoomGesture.qml", effectRoot),
  "utf8",
);
const zoomHud = readFileSync(
  new URL("contents/runtime/ui/OverviewZoomHud.qml", effectRoot),
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
const exitHandoff = readFileSync(
  new URL("contents/runtime/ui/OverviewExitHandoff.qml", effectRoot),
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
const workspaceActionStrip = readFileSync(
  new URL("contents/runtime/ui/WorkspaceActionStrip.qml", effectRoot),
  "utf8",
);
const workspaceGapCreateButton = readFileSync(
  new URL("contents/runtime/ui/WorkspaceGapCreateButton.qml", effectRoot),
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
  touchpadZoomGesture,
  touchscreenZoomGesture,
  zoomHud,
  reader,
  scene,
  exitHandoff,
  desktopCard,
  windowApplicationIcon,
  outputIdentityBadge,
  searchMatchBadge,
  keyboardHelpCloseButton,
  keyboardHelpHint,
  workspaceActionStrip,
  workspaceGapCreateButton,
  windowCloseButton,
];
const workspaceManagementStart = scene.indexOf(
  "function workspaceDesktopName(",
);
const workspaceManagementEnd = scene.indexOf("function planWorkspaceGapDrop(");
const sceneWithoutWorkspaceManagement =
  scene.slice(0, workspaceManagementStart) +
  scene.slice(workspaceManagementEnd);

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
    expect(showWindowLabelsEntry).toContain("<default>false</default>");
    expect(showApplicationIdentityEntry).toContain('type="Bool"');
    expect(showApplicationIdentityEntry).toContain("<default>false</default>");
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
    expect(open).toMatch(/function open\(\) \{\s*activate\(\);\s*\}/u);
    expect(close).toMatch(
      /if \(!active && !loading\) \{\s*return;\s*\}\s*deactivate\(\);/u,
    );
    expect(controller).not.toMatch(/ScreenEdge|registerScreenEdge/u);
    expect(main).not.toContain("ShortcutHandler");
  });

  it("drives one configured vertical touchpad gesture pair interactively", () => {
    const applySettings = controller.slice(
      controller.indexOf("function applyTouchpadGestureSettings("),
      controller.indexOf("function rebuildTouchpadGesture("),
    );
    const rebuild = controller.slice(
      controller.indexOf("function rebuildTouchpadGesture("),
      controller.indexOf("function resetTouchpadGestureState("),
    );
    const beginTouchpadGesture = controller.slice(
      controller.indexOf("function beginTouchpadGesture("),
      controller.indexOf("function updateTouchpadGesture("),
    );
    const updateTouchpadGesture = controller.slice(
      controller.indexOf("function updateTouchpadGesture("),
      controller.indexOf("function finishTouchpadGesture("),
    );
    const finishTouchpadGesture = controller.slice(
      controller.indexOf("function finishTouchpadGesture("),
      controller.indexOf("function cancelTouchpadGesture("),
    );
    const gestureContext = touchpadGesture.slice(
      touchpadGesture.indexOf("function valueKey("),
      touchpadGesture.indexOf(
        "readonly property KWin.SwipeGestureHandler upSwipe",
      ),
    );
    const updateGesture = gestureContext.slice(
      gestureContext.indexOf("function updateGesture("),
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
      gestureContext.indexOf("function activateGesture("),
    );
    const activateGesture = gestureContext.slice(
      gestureContext.indexOf("function activateGesture("),
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
    expect(controller).toContain('property string touchpadGestureOwner: ""');
    expect(controller).toContain("property real touchpadGestureProgress: 0");
    expect(controller).toContain("property int touchpadGestureFingerCount: 4");
    expect(controller).toMatch(
      /readonly property Loader touchpadGestureLoader: Loader \{\s*active: false\s*\}/u,
    );
    expect(controller).toContain("target: touchpadGestureLoader.item");
    expect(controller).toContain(
      "controller.beginTouchpadGesture(owner, progress)",
    );
    expect(controller).toContain(
      "controller.updateTouchpadGesture(owner, progress)",
    );
    expect(controller).toContain("controller.cancelTouchpadGesture(owner)");
    expect(controller).toContain("controller.activateTouchpadGesture(owner)");
    expect(controller).toContain("controller.invalidateTouchpadGesture(owner)");

    expect(applySettings).toContain("const nextEnabled = enabled === true;");
    expect(applySettings).toContain("Number(fingerCount)");
    expect(applySettings).toContain("numericFingerCount >= 3");
    expect(applySettings).toContain("numericFingerCount <= 5");
    expect(applySettings).toMatch(/\? numericFingerCount\s*: 4;/u);
    expect(applySettings.match(/rebuildTouchpadGesture\(\)/gu)).toHaveLength(1);

    expect(rebuild).toMatch(
      /if \(touchpadGestureOwner !== ""\) \{\s*cancelTouchpadGesture\(touchpadGestureOwner\);\s*\}[\s\S]*touchpadGestureLoader\.active = false;\s*touchpadGestureLoader\.source = "";/u,
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

    expect(beginTouchpadGesture).toMatch(
      /owner !== "open" && owner !== "close"[\s\S]*!Number\.isFinite\(numericProgress\)[\s\S]*touchpadGestureOwner !== ""/u,
    );
    expect(beginTouchpadGesture).toMatch(
      /owner === "open"[\s\S]*presentationPhase !== "closed"[\s\S]*touchpadGestureDispatching = true;[\s\S]*activate\(\);[\s\S]*touchpadGestureDispatching = false;/u,
    );
    expect(beginTouchpadGesture).toMatch(
      /presentationPhase !== "open"[\s\S]*invalidatePresentationTransition\(\);[\s\S]*applyTouchpadGestureProgress\(owner, boundedProgress\)/u,
    );
    expect(updateTouchpadGesture).toMatch(
      /owner !== touchpadGestureOwner[\s\S]*touchpadGestureProgress = boundedProgress;[\s\S]*loading && !active[\s\S]*active && presentationPhase === "preparing"[\s\S]*applyTouchpadGestureProgress\(owner, boundedProgress\)/u,
    );
    expect(finishTouchpadGesture).toMatch(
      /resetTouchpadGestureState\(\);[\s\S]*owner === "open" && loading && !active[\s\S]*!committed[\s\S]*deactivateImmediately\(\);[\s\S]*presentationPhase === "preparing"[\s\S]*!committed[\s\S]*deactivateImmediately\(\);[\s\S]*startPresentationTransition\(phase, target, activeSessionId\)/u,
    );
    expect(controller).toMatch(
      /function completeOpeningReadinessIfExact\(\)[\s\S]*if \(touchpadGestureOwner === "open"\) \{[\s\S]*presentationPhase = "opening";[\s\S]*presentationProgress = touchpadGestureTarget\("open", touchpadGestureProgress\);[\s\S]*startPresentationTransition\("opening", 1, sessionId\);/u,
    );
    expect(controller).toMatch(
      /function activate\(\) \{[\s\S]*interruptedTouchpadGesture[\s\S]*resetTouchpadGestureState\(\);[\s\S]*startPresentationTransition\("opening", 1, activeSessionId\)/u,
    );
    expect(controller).toMatch(
      /function deactivate\(\) \{[\s\S]*interruptedTouchpadGesture[\s\S]*resetTouchpadGestureState\(\);[\s\S]*startPresentationTransition\("closing", 0, activeSessionId\)/u,
    );

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
    for (const signal of [
      "gestureStarted(string owner, real progress)",
      "gestureProgressed(string owner, real progress)",
      "gestureCancelled(string owner)",
      "gestureActivated(string owner)",
      "gestureInvalidated(string owner)",
    ]) {
      expect(touchpadGesture).toContain(`signal ${signal}`);
    }
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
    expect(gestureContext).toMatch(
      /function boundedGestureProgress\(progress\)[\s\S]*Number\.isFinite\(numeric\)[\s\S]*Math\.max\(0, Math\.min\(1, numeric\)\)/u,
    );
    expect(updateGesture).toMatch(
      /const boundedProgress = root\.boundedGestureProgress\(progress\);[\s\S]*root\.activeGestureOwner === owner[\s\S]*root\.gestureContextKey !== root\.currentGestureContextKey\(\)[\s\S]*root\.gestureProgressed\(owner, boundedProgress\);/u,
    );
    expect(updateGesture).toMatch(
      /boundedProgress <= 0 \|\| root\.activeGestureOwner !== ""[\s\S]*root\.blockedGestureOwner !== ""[\s\S]*root\.activeGestureOwner = owner;[\s\S]*root\.gestureContextKey = contextKey;[\s\S]*root\.gestureStarted\(owner, boundedProgress\);/u,
    );
    expect(invalidateGesture).toMatch(
      /const owner = root\.activeGestureOwner;[\s\S]*root\.blockedGestureOwner = owner;[\s\S]*root\.activeGestureOwner = "";[\s\S]*root\.gestureInvalidated\(owner\);/u,
    );
    expect(controller).toMatch(
      /function invalidateTouchpadGesture\(owner\)[\s\S]*owner !== touchpadGestureOwner[\s\S]*deactivateImmediately\(\);[\s\S]*return true;/u,
    );
    expect(cancelGesture).toMatch(
      /if \(owner === root\.blockedGestureOwner\) \{\s*root\.resetGesture\(\);\s*return;\s*\}[\s\S]*if \(owner !== root\.activeGestureOwner\)[\s\S]*root\.resetGesture\(\);[\s\S]*root\.gestureCancelled\(owner\);/u,
    );
    expect(activateGesture).toMatch(
      /if \(owner === root\.blockedGestureOwner\) \{\s*root\.resetGesture\(\);\s*return;\s*\}[\s\S]*if \(owner !== root\.activeGestureOwner\) \{\s*return;\s*\}/u,
    );
    expect(activateGesture).toMatch(
      /root\.gestureContextKey === root\.currentGestureContextKey\(\)[\s\S]*root\.resetGesture\(\);[\s\S]*if \(accepted\) \{\s*root\.gestureActivated\(owner\);\s*\} else \{\s*root\.gestureCancelled\(owner\);/u,
    );
    expect(touchpadGesture).toMatch(
      /target: KWin\.Workspace[\s\S]*onCurrentDesktopChanged[\s\S]*onCurrentActivityChanged[\s\S]*onDesktopsChanged[\s\S]*onScreensChanged[\s\S]*onVirtualScreenGeometryChanged/u,
    );
    expect(upSwipe).toContain(
      "direction: KWin.SwipeGestureHandler.Direction.Up",
    );
    expect(upSwipe).toContain(
      'onProgressChanged: root.updateGesture("open", progress)',
    );
    expect(upSwipe).toContain('onCancelled: root.cancelGesture("open")');
    expect(upSwipe).toContain('onActivated: root.activateGesture("open")');
    expect(downSwipe).toContain(
      "direction: KWin.SwipeGestureHandler.Direction.Down",
    );
    expect(downSwipe).toContain(
      'onProgressChanged: root.updateGesture("close", progress)',
    );
    expect(downSwipe).toContain('onCancelled: root.cancelGesture("close")');
    expect(downSwipe).toContain('onActivated: root.activateGesture("close")');
    expect(touchpadGesture).toContain(
      'Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")',
    );
    expect(touchpadGesture).toContain(
      'Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")',
    );
    expect(touchpadGesture.match(/console\.info\(/gu)).toHaveLength(2);
    expect(touchpadGesture).not.toMatch(
      /\bprogress\s*:|ShortcutHandler|sequence\s*:|Timer|WeakSet|WeakMap|new Set|new Map|KWin\.DBusCall|callDBus/iu,
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
    expect(scene).toContain('color: "transparent"');
    expect(scene).toMatch(
      /id: spatialBackdrop[\s\S]*color: root\.sceneEffect && root\.sceneEffect\.backdropColor !== undefined\s*\? root\.sceneEffect\.backdropColor\s*: "#e60b0f17"[\s\S]*opacity: root\.spatialPresentationProgress/u,
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
        'return typeof value === "boolean" ? value : false;',
      );
    }
  });

  it("keeps a fixed scene-effect proxy over the cache-busted controller", () => {
    expect(createHash("sha256").update(main, "utf8").digest("hex")).toBe(
      "1d5f9c2f50556499bdc1fbe312f015e5a5428361f3e3a79cc0f82ecb5ddafe2d",
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
    expect(main).toContain("readonly property real presentationProgress:");
    expect(main).toContain("readonly property string presentationPhase:");
    expect(main).toContain(
      "readonly property bool sceneVisible: controller ? controller.sceneVisible : false",
    );
    expect(main).toContain(
      "visible: controller ? controller.sceneVisible : false",
    );
    expect(main).toContain(
      "delegate: controller ? controller.overviewDelegate : null",
    );
    for (const method of ["toggle", "activate", "deactivate"]) {
      expect(main).toContain(`function ${method}()`);
      expect(main).toContain(`controller.${method}();`);
    }
    expect(main).toContain("function deactivateImmediately()");
    expect(main).toContain("controller.deactivateImmediately();");

    expect(controller).toContain("property real presentationProgress: 0");
    expect(controller).toContain('property string presentationPhase: "closed"');
    expect(controller).toMatch(
      /readonly property NumberAnimation presentationAnimation:[\s\S]*target: controller[\s\S]*property: "presentationProgress"[\s\S]*onFinished: controller\.completePresentationTransition/u,
    );
    expect(controller).toMatch(
      /function deactivate\(\)[\s\S]*startPresentationTransition\("closing", 0, activeSessionId\)/u,
    );
    expect(controller).toMatch(
      /function activate\(\)[\s\S]*presentationPhase === "closing"[\s\S]*startPresentationTransition\("opening", 1, activeSessionId\)/u,
    );
    expect(controller).toMatch(
      /presentationAnimation\.duration = Math\.max\(1, Math\.round\(220 \* distance\)\)/u,
    );
    expect(controller).toMatch(
      /if \(distance <= 0\.000001\) \{\s*presentationProgress = target;\s*completePresentationTransition\(token, sessionId, phase, target\);\s*return true;\s*\}[\s\S]*presentationAnimation\.duration = Math\.max\(1, Math\.round\(220 \* distance\)\);\s*presentationAnimation\.start\(\);/u,
    );
    expect(controller).not.toContain('phase === "opening" || distance');
    expect(controller).toMatch(
      /completePresentationTransition[\s\S]*token !== pendingPresentationTransitionToken[\s\S]*sessionId !== activeSessionId/u,
    );

    expect(controller).toContain("QtObject {");
    expect(controller).not.toContain("KWin.SceneEffect {");
    expect(controller).not.toMatch(/\bvisible\s*=|\bvisible\s*:/u);
    expect(controller).not.toMatch(/^\s*delegate\s*:/mu);
  });

  it("double-confirms persisted layout state before caching it", () => {
    const timer = reader.slice(
      reader.indexOf("readonly property Timer secondSampleTimer"),
      reader.indexOf("Component.onCompleted: primeStableSample()"),
    );
    const beginDoubleSample = reader.slice(
      reader.indexOf("function beginDoubleSample("),
      reader.indexOf("function primeStableSample("),
    );

    expect(reader).toContain('category: "Layout"');
    expect(reader).toContain('settings.value("layout-v1", "")');
    expect(reader.match(/settings\.value\("layout-v1", ""\)/gu)).toHaveLength(
      1,
    );
    expect(reader).toContain("readonly property int sampleInterval: 120");
    expect(reader).toContain("property int requestId: 0");
    expect(reader).toContain('property string stableSample: ""');
    expect(reader).toContain("signal ready(int requestId, string document)");
    expect(reader).toContain("signal rejected(int requestId)");
    expect(beginDoubleSample).toMatch(
      /firstSample = readSample\(\);[\s\S]*requestId = nextRequestId;[\s\S]*secondSampleTimer\.start\(\);/u,
    );
    expect(timer).toContain("const secondSample = root.readSample();");
    expect(timer).toMatch(
      /const confirmed = root\.firstSample\.length > 0 && root\.firstSample === secondSample;[\s\S]*if \(confirmed\) \{\s*root\.stableSample = secondSample;/u,
    );
    expect(timer).toMatch(
      /else \{\s*root\.stableSample = "";[\s\S]*root\.rejected\(completedRequestId\);/u,
    );
    expect(reader.match(/\bTimer\s*\{/gu)).toHaveLength(1);
    expect(reader).not.toMatch(/setValue|repeat:\s*true/u);
  });

  it("serves only a fresh exact stable-state cache hit immediately", () => {
    const sample = reader.slice(
      reader.indexOf("function sample(requestId)"),
      reader.indexOf("function cancel()"),
    );
    const cancel = reader.slice(reader.indexOf("function cancel()"));

    expect(sample).toMatch(
      /cancel\(\);[\s\S]*Number\.isInteger\(requestId\)[\s\S]*const synchronousSample = readSample\(\);/u,
    );
    expect(sample).toMatch(
      /if \(stableSample\.length > 0 && synchronousSample === stableSample\) \{\s*ready\(requestId, synchronousSample\);\s*return;\s*\}/u,
    );
    expect(sample).toMatch(
      /stableSample = "";\s*firstSample = synchronousSample;[\s\S]*root\.requestId = requestId;[\s\S]*secondSampleTimer\.start\(\);/u,
    );
    expect(sample.indexOf("ready(requestId, synchronousSample);")).toBeLessThan(
      sample.indexOf('stableSample = "";'),
    );
    expect(cancel).toMatch(
      /secondSampleTimer\.stop\(\);[\s\S]*sampling = false;[\s\S]*firstSample = "";[\s\S]*requestId = 0;/u,
    );
    expect(cancel).not.toContain("stableSample");
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
      /if \(active\) \{[\s\S]*presentationPhase === "closing"[\s\S]*return;[\s\S]*if \(loading \|\| plasmaOverviewIsActive\(\)\) \{\s*return;/u,
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
      /if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}[\s\S]*runtime\.loadOverviewModel\(document, snapshot\)[\s\S]*if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}[\s\S]*if \(acceptActivationModel\(attemptId, result\.value\)\) \{\s*scheduleActivationCacheStore\(attemptId, document, snapshot,\s*result\.value\);\s*\}/u,
    );
    expect(accept).toMatch(
      /function acceptActivationModel\(attemptId, model\)[\s\S]*pendingActivationAttemptId = 0;[\s\S]*overviewModel = model;[\s\S]*loading = false;[\s\S]*active = true;/u,
    );
    expect(reject).toContain("attemptId !== pendingActivationAttemptId");
    expect(reject).toMatch(
      /if \(plasmaOverviewIsActive\(\)\) \{\s*cancelPendingActivation\(attemptId\);\s*return;\s*\}/u,
    );
    expect(reject).toContain("activation rejected reason=${reason}");

    const guard = reject.indexOf("if (!loading || active");
    const reset = reject.indexOf("deactivateImmediately();");
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
    expect(controller).toContain("function onWindowAdded(window)");
    expect(controller).toContain("function onWindowRemoved(window)");
    expect(scene).not.toContain("function onWindowAdded()");
    expect(scene).not.toContain("function onWindowRemoved()");
    expect(desktopCard).toContain("KWin.WindowModel");
    expect(desktopCard).toContain("KWin.WindowFilterModel");
    expect(desktopCard).toContain("KWin.WindowThumbnail");
    expect(desktopCard.match(/KWin\.WindowModel\s*\{/gu)).toHaveLength(1);
    expect(desktopCard.match(/KWin\.WindowFilterModel\s*\{/gu)).toHaveLength(1);
    expect(desktopCard).toContain("minimizedWindows: true");
    expect(
      qmlSources.join("\n").match(/KWin\.DesktopBackground\s*\{/gu) ?? [],
    ).toHaveLength(2);
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
    ]);
    expect(qmlSources.join("\n")).not.toMatch(/\.setValue\s*\(/u);
  });

  it("renders one public desktop surface only for exact visible workspace rows", () => {
    const projectedSurfaceStart = desktopCard.indexOf(
      "id: projectedOutputSurface",
    );
    const projectedSurfaceEnd = desktopCard.indexOf(
      "id: columnRepeater",
      projectedSurfaceStart,
    );
    const projectedSurface = desktopCard.slice(
      projectedSurfaceStart,
      projectedSurfaceEnd,
    );
    const surfaceLoaderStart = projectedSurface.indexOf(
      "id: desktopSurfaceLoader",
    );
    const surfaceTintStart = projectedSurface.lastIndexOf(
      "Rectangle {",
      projectedSurface.indexOf("color: windowDropArea.validTarget"),
    );
    const surfaceBorderStart = projectedSurface.lastIndexOf(
      "Rectangle {",
      projectedSurface.indexOf("border.width:"),
    );
    const surfaceLoader = projectedSurface.slice(
      surfaceLoaderStart,
      surfaceTintStart,
    );
    const surfaceTint = projectedSurface.slice(
      surfaceTintStart,
      surfaceBorderStart,
    );
    const surfaceBorder = projectedSurface.slice(surfaceBorderStart);
    const surfaceContext = desktopCard.slice(
      desktopCard.indexOf("function desktopSurfaceContextIsExact("),
      desktopCard.indexOf("function collectNavigationTargets("),
    );
    const surfaceEventValidation = scene.slice(
      scene.indexOf("function validatedDesktopSurfaceLifecycleEvent()"),
      scene.indexOf("function desktopCardShouldLoad("),
    );
    const surfaceReloadSchedule = desktopCard.slice(
      desktopCard.indexOf("function scheduleDesktopSurfaceReload()"),
      desktopCard.indexOf("function completeDesktopSurfaceReload("),
    );
    const surfaceReloadCompletion = desktopCard.slice(
      desktopCard.indexOf("function completeDesktopSurfaceReload("),
      desktopCard.indexOf("function desktopSurfaceLifecycleEventRevision("),
    );
    const surfaceEventRevision = desktopCard.slice(
      desktopCard.indexOf("function desktopSurfaceLifecycleEventRevision("),
      desktopCard.indexOf("function planDesktopSurfaceLifecycleRefresh("),
    );
    const surfaceRefreshPlanner = desktopCard.slice(
      desktopCard.indexOf("function planDesktopSurfaceLifecycleRefresh("),
      desktopCard.indexOf(
        "function desktopSurfaceLifecycleRefreshPlanIsValid(",
      ),
    );
    const surfaceRefreshPlanValidation = desktopCard.slice(
      desktopCard.indexOf(
        "function desktopSurfaceLifecycleRefreshPlanIsValid(",
      ),
      desktopCard.indexOf("function desktopSurfaceContextIsExact("),
    );
    const desktopCardLoader = scene.slice(
      scene.indexOf("id: desktopCardLoader"),
      scene.indexOf(
        "sourceComponent: Component",
        scene.indexOf("id: desktopCardLoader"),
      ),
    );
    const desktopCardDelegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf(
        "onDesktopReorderCanceled:",
        scene.indexOf("DesktopCard {"),
      ),
    );
    const cardLoadPolicy = scene.slice(
      scene.indexOf("function desktopCardShouldLoad("),
      scene.indexOf("function desktopSurfaceShouldLoad("),
    );
    const surfaceLoadPolicy = scene.slice(
      scene.indexOf("function desktopSurfaceShouldLoad("),
      scene.indexOf("function desktopCardAt("),
    );

    expect(projectedSurfaceStart).toBeGreaterThan(0);
    expect(projectedSurfaceEnd).toBeGreaterThan(projectedSurfaceStart);
    expect(surfaceLoaderStart).toBeGreaterThan(0);
    expect(surfaceTintStart).toBeGreaterThan(surfaceLoaderStart);
    expect(surfaceBorderStart).toBeGreaterThan(surfaceTintStart);
    expect(desktopCard).toContain("import org.kde.kwin as KWin");
    expect(desktopCard).not.toContain("org.kde.kwin.private");
    expect(scene).not.toContain("KWin.DesktopBackground");
    expect(desktopCard.match(/KWin\.DesktopBackground\s*\{/gu)).toHaveLength(1);

    expect(desktopCard).toContain(
      "required property bool desktopSurfaceEnabled",
    );
    expect(desktopCard).toContain(
      "required property var desktopSurfaceLifecycleEvent",
    );
    expect(desktopCard).toContain(
      "required property int overviewContextGeneration",
    );
    expect(desktopCard).toContain("property bool desktopSurfaceReady:");
    expect(desktopCard).toContain(
      "property int desktopSurfaceReloadRevision: 0",
    );
    expect(desktopCard).toContain("property int desktopSurfaceReloadToken: 0");
    expect(desktopCard).toContain(
      "property bool desktopSurfaceContextInvalidated: false",
    );
    expect(desktopCard).toContain(
      "onDesktopSurfaceLifecycleEventChanged: card.scheduleDesktopSurfaceReload()",
    );
    expect(desktopCard).toMatch(
      /readonly property string desktopSurfaceActivityId: KWin\.Workspace\.currentActivity === undefined[\s\S]*KWin\.Workspace\.currentActivity === null \? "" : String\(KWin\.Workspace\.currentActivity\)/u,
    );
    expect(desktopCard).toMatch(
      /readonly property string desktopSurfaceActivityBindingId: desktopSurfaceActivityId\.length > 0\s*\? desktopSurfaceActivityId : "driftile-unavailable-activity"/u,
    );
    expect(desktopCard).toContain(
      "readonly property bool desktopSurfaceContextExact: desktopSurfaceContextIsExact()",
    );
    expect(desktopCard).toContain(
      "readonly property bool desktopSurfaceReloadContextExact: desktopSurfaceReloadContextIsExact()",
    );
    expect(surfaceLoader).toMatch(
      /active: card\.desktopSurfaceEnabled && card\.desktopSurfaceContextExact\s*&& card\.desktopSurfaceReloadContextExact && card\.desktopSurfaceReady\s*&& card\.desktopSurfaceReadyToken === card\.desktopSurfaceReloadToken/u,
    );
    expect(surfaceLoader).toContain("KWin.DesktopBackground {");
    expect(surfaceLoader).toContain("anchors.fill: parent");
    expect(surfaceLoader).toContain("output: driftileScreen");
    expect(surfaceLoader).toContain("desktop: driftileDesktop");
    expect(surfaceLoader).toContain("activity: driftileActivityId");
    expect(surfaceLoader).toContain(
      "property bool driftileContextCaptured: false",
    );
    expect(surfaceLoader).toMatch(
      /Component\.onCompleted:[\s\S]*driftileContextGeneration = card\.desktopSurfaceReloadGeneration;[\s\S]*driftileReloadToken = card\.desktopSurfaceReadyToken;[\s\S]*driftileContextCaptured = true;/u,
    );
    expect(surfaceLoader).toMatch(
      /onLoaded: acceptDesktopSurfaceCandidate\(desktopSurfaceLoader\.item\)[\s\S]*function acceptDesktopSurfaceCandidate\(candidate\)[\s\S]*card\.acceptDesktopSurfaceLoad\(candidate\);/u,
    );
    expect(surfaceLoader).toMatch(
      /driftileContextCaptured = true;[\s\S]*desktopSurfaceLoader\.acceptDesktopSurfaceCandidate\(desktopBackground\);/u,
    );
    expect(surfaceLoader).toContain("enabled: false");
    expect(surfaceLoader).toContain("z: 0");

    expect(surfaceContext).toMatch(
      /!desktopSurfaceEnabled \|\| !desktop \|\| desktop\.id === undefined \|\| desktop\.id === null[\s\S]*String\(desktop\.id\) !== desktopId[\s\S]*!screen[\s\S]*String\(screen\.name\)\.length === 0[\s\S]*outputId\.length === 0[\s\S]*desktopSurfaceActivityId\.length === 0/u,
    );
    expect(surfaceContext).toContain(
      "for (const liveDesktop of KWin.Workspace.desktops)",
    );
    expect(surfaceContext).toContain("liveDesktop === desktop");
    expect(surfaceContext).toContain("desktopIdMatches !== 1");
    expect(surfaceContext).toContain("!desktopObjectExact");
    expect(surfaceContext).toContain(
      "for (const liveActivityId of KWin.Workspace.activities)",
    );
    expect(surfaceContext).toContain(
      "String(liveActivityId) === desktopSurfaceActivityId",
    );
    expect(surfaceContext).toContain("activityMatches !== 1");
    expect(surfaceContext).toContain(
      "for (const liveScreen of KWin.Workspace.screens)",
    );
    expect(surfaceContext).toContain("liveScreen === screen");
    expect(surfaceContext).toContain("return screenMatches === 1;");
    expect(surfaceContext).toMatch(/catch \(error\) \{\s*return false;/u);

    expect(scene).toContain(
      "readonly property var desktopSurfaceLifecycleEvent: validatedDesktopSurfaceLifecycleEvent()",
    );
    expect(surfaceEventValidation).toContain(
      "const controller = sceneEffect ? sceneEffect.controller : null;",
    );
    expect(surfaceEventValidation).toContain(
      "const event = controller.desktopSurfaceLifecycleEvent;",
    );
    expect(surfaceEventValidation).toMatch(
      /event !== null && event !== undefined\s*&& Number\.isSafeInteger\(event\.revision\) && event\.revision > 0\s*&& event\.revision <= 2147483647 \? event : null/u,
    );
    expect(surfaceEventValidation).toMatch(
      /catch \(error\) \{\s*return null;/u,
    );
    expect(surfaceEventValidation).not.toMatch(
      /event\.(?:global|scopes)|scope\./u,
    );

    expect(surfaceEventRevision).toMatch(
      /event !== null && event !== undefined\s*&& Number\.isSafeInteger\(event\.revision\) && event\.revision > 0\s*&& event\.revision <= 2147483647 \? event\.revision : 0/u,
    );
    expect(surfaceEventRevision).toMatch(/catch \(error\) \{\s*return 0;/u);
    expect(surfaceEventRevision).not.toMatch(
      /event\.(?:global|scopes)|scope\./u,
    );
    expect(surfaceRefreshPlanner).toMatch(
      /const fallback = \{\s*revision: eventRevision,\s*targeted: true\s*\};/u,
    );
    expect(surfaceRefreshPlanner).toContain(
      'typeof runtime.planOverviewDesktopSurfaceLifecycleRefresh !== "function"',
    );
    expect(surfaceRefreshPlanner).toMatch(
      /runtime\.planOverviewDesktopSurfaceLifecycleRefresh\(\{\s*event,\s*output: screen,\s*outputName: String\(screen\.name\),\s*desktopId,\s*activityId: desktopSurfaceActivityId\s*\}\)/u,
    );
    expect(surfaceRefreshPlanner).toContain(
      "desktopSurfaceLifecycleRefreshPlanIsValid(plan, eventRevision) ? plan : fallback",
    );
    expect(surfaceRefreshPlanner).toMatch(
      /catch \(error\) \{\s*return fallback;/u,
    );
    expect(surfaceRefreshPlanValidation).toMatch(
      /plan && !Array\.isArray\(plan\) && typeof plan === "object"\s*&& Number\.isSafeInteger\(plan\.revision\) && plan\.revision === eventRevision\s*&& typeof plan\.targeted === "boolean"/u,
    );

    expect(surfaceReloadSchedule).toContain(
      "const eventRevision = desktopSurfaceLifecycleEventRevision(event);",
    );
    expect(surfaceReloadSchedule).toMatch(
      /if \(eventRevision <= 0 \|\| !desktopSurfaceContextExact\) \{\s*return false;/u,
    );
    expect(surfaceReloadSchedule).toContain(
      "const plan = planDesktopSurfaceLifecycleRefresh(event, eventRevision);",
    );
    expect(surfaceReloadSchedule).toMatch(
      /if \(plan\.targeted !== true\) \{\s*return false;/u,
    );
    expect(surfaceReloadSchedule).toMatch(
      /const expectation = desktopSurfaceReloadExpectation\(\);\s*if \(expectation === null \|\| !Object\.isFrozen\(expectation\)\) \{\s*return false;/u,
    );
    expect(surfaceReloadSchedule).not.toMatch(
      /plan\.revision\s*(?:<=|<|>=|>|===|==)\s*desktopSurfaceReloadRevision/u,
    );
    expect(surfaceReloadSchedule).toMatch(
      /desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647\s*\? 1 : desktopSurfaceReloadToken \+ 1;/u,
    );
    expect(surfaceReloadSchedule).toContain(
      "const token = desktopSurfaceReloadToken;",
    );
    expect(surfaceReloadSchedule).toContain(
      "desktopSurfaceReloadRevision = plan.revision;",
    );
    expect(surfaceReloadSchedule).toContain(
      "const reloadRevision = desktopSurfaceReloadRevision;",
    );
    expect(surfaceReloadSchedule).toContain("desktopSurfaceReady = false;");
    expect(surfaceReloadSchedule).toMatch(
      /Qt\.callLater\(card\.completeDesktopSurfaceReload,\s*token,\s*reloadRevision\);/u,
    );
    expect(surfaceReloadCompletion).toMatch(
      /function completeDesktopSurfaceReload\(token, reloadRevision\)[\s\S]*token !== desktopSurfaceReloadToken[\s\S]*reloadRevision !== desktopSurfaceReloadRevision[\s\S]*return false;/u,
    );
    expect(surfaceReloadCompletion).toMatch(
      /desktopSurfaceReady = true;\s*return true;/u,
    );
    expect(surfaceReloadCompletion).toMatch(
      /function synchronizeDesktopSurfaceContext\(\) \{\s*if \(!desktopSurfaceContextExact\) \{\s*return invalidateDesktopSurfaceContext\(\);[\s\S]*desktopSurfaceContextInvalidated[\s\S]*desktopSurfaceReloadContextExact[\s\S]*return scheduleDesktopSurfaceContextReload\(\);/u,
    );
    expect(surfaceReloadCompletion).toMatch(
      /function invalidateDesktopSurfaceContext\(\)[\s\S]*if \(desktopSurfaceContextInvalidated\)[\s\S]*desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647[\s\S]*desktopSurfaceContextInvalidated = true;[\s\S]*desktopSurfaceReady = false;[\s\S]*desktopSurfaceReadyToken = 0;[\s\S]*desktopSurfaceLoadedToken = 0;/u,
    );
    expect(desktopCard).toContain(
      "onDesktopSurfaceContextExactChanged: card.synchronizeDesktopSurfaceContext()",
    );
    expect(surfaceReloadCompletion).not.toMatch(
      /desktopSurfaceLifecycleEvent|sceneEffect|controller|planOverviewDesktopSurfaceLifecycleRefresh/u,
    );
    const targetGuard = surfaceReloadSchedule.indexOf(
      "if (plan.targeted !== true",
    );
    const tokenWrite = surfaceReloadSchedule.indexOf(
      "desktopSurfaceReloadToken =",
    );
    const expectationGuard = surfaceReloadSchedule.indexOf(
      "if (expectation === null || !Object.isFrozen(expectation))",
    );
    const revisionWrite = surfaceReloadSchedule.indexOf(
      "desktopSurfaceReloadRevision = plan.revision;",
    );
    expect(targetGuard).toBeGreaterThan(0);
    expect(expectationGuard).toBeGreaterThan(targetGuard);
    expect(tokenWrite).toBeGreaterThan(expectationGuard);
    expect(revisionWrite).toBeGreaterThan(tokenWrite);
    expect(
      surfaceReloadSchedule.indexOf("desktopSurfaceReady = false;"),
    ).toBeGreaterThan(revisionWrite);
    expect(
      surfaceReloadSchedule.indexOf("desktopSurfaceReady = false;"),
    ).toBeLessThan(surfaceReloadSchedule.indexOf("Qt.callLater("));
    expect(surfaceReloadSchedule.match(/Qt\.callLater\(/gu)).toHaveLength(1);
    expect(
      `${surfaceEventValidation}\n${surfaceReloadSchedule}\n${surfaceReloadCompletion}\n${surfaceEventRevision}\n${surfaceRefreshPlanner}\n${surfaceRefreshPlanValidation}`,
    ).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|repeat:\s*true|setInterval|setTimeout|KWin\.Workspace\.(?:stackingOrder|windows)\b/u,
    );

    expect(projectedSurface).toContain("clip: true");
    expect(projectedSurface).toContain('color: "#171e2a"');
    expect(projectedSurface).toContain("z: -100");
    expect(surfaceTint).toContain("z: 1");
    expect(surfaceBorder).toContain("id: projectedOutputSurfaceBorder");
    expect(surfaceBorder).toContain("border.width:");
    expect(surfaceBorder).toMatch(
      /border\.width: windowDropArea\.validTarget \|\| card\.desktopReorderSource \? 2\s*: card\.current \? 1 : 0/u,
    );
    expect(surfaceBorder).toMatch(
      /border\.color: windowDropArea\.validTarget \? "#86aee8"\s*: card\.desktopReorderSource \? "#668baad6"\s*: "#66758b"/u,
    );
    expect(surfaceBorder).toContain("z: 2");
    expect(projectedSurface.indexOf('color: "#171e2a"')).toBeLessThan(
      projectedSurface.indexOf("id: desktopSurfaceLoader"),
    );
    expect(projectedSurface.indexOf("KWin.DesktopBackground {")).toBeLessThan(
      surfaceTintStart,
    );
    expect(projectedSurface).not.toMatch(
      /\b(?:TapHandler|DragHandler|HoverHandler|WheelHandler|DropArea|MouseArea|ShortcutHandler|Connections)\s*\{/u,
    );

    expect(desktopCardLoader).toContain(
      "readonly property var desktopObject: root.desktopForId(modelData)",
    );
    expect(desktopCardDelegate).toContain(
      "desktop: desktopCardLoader.desktopObject",
    );
    expect(desktopCardDelegate).toMatch(
      /desktopSurfaceEnabled: root\.desktopSurfaceShouldLoad\(\s*desktopCardLoader\.index,\s*desktopCardLoader\.modelData,\s*desktopCardLoader\.desktopObject\)/u,
    );
    expect(desktopCardDelegate).toContain(
      "desktopSurfaceLifecycleEvent: root.desktopSurfaceLifecycleEvent",
    );
    expect(
      scene.match(
        /desktopSurfaceLifecycleEvent:\s*root\.desktopSurfaceLifecycleEvent/gu,
      ),
    ).toHaveLength(1);
    expect(scene).toMatch(
      /readonly property var overviewSpatialVisibleRangePlan: planSpatialVisibleRange\(\)[\s\S]*readonly property var overviewSpatialVisibleRange:\s*spatialVisibleRangeIsValid\(overviewSpatialVisibleRangePlan\)\s*\? overviewSpatialVisibleRangePlan : fallbackSpatialVisibleRange\(\)/u,
    );
    expect(surfaceLoadPolicy).toContain(
      "desktopSurfaceResidencyContextMatchesCurrent()",
    );
    expect(surfaceLoadPolicy).toContain(
      "spatialVisibleRangeIsValid(desktopSurfaceResidencyRange)",
    );
    expect(surfaceLoadPolicy).toContain(
      "String(expectedDesktop.id) !== expectedDesktopId",
    );
    expect(surfaceLoadPolicy).toContain(
      "index >= desktopSurfaceResidencyRange.firstIndex",
    );
    expect(surfaceLoadPolicy).toContain(
      "index <= desktopSurfaceResidencyRange.lastIndex",
    );
    expect(surfaceLoadPolicy).not.toMatch(
      /searchQuery|spatialPresentationPhase|desktopReorderActive|spatialWindowDragSource|desktopSurfaceLifecycleEvent|desktopSurfaceReloadRevision|desktopSurfaceReady/u,
    );
    expect(cardLoadPolicy).toContain("if (searchQuery.length > 0");
    expect(cardLoadPolicy).toContain('spatialPresentationPhase !== "open"');
    expect(cardLoadPolicy).toContain("desktopReorderActive");
    expect(cardLoadPolicy).toContain("spatialWindowDragSource !== null");
    expect(cardLoadPolicy).toContain("spatialColumnDragSource !== null");
  });

  it("keeps neutral workspace chrome and the current cue below windows and input", () => {
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: desktopNameGutter"),
    );
    const desktopNameGutter = desktopCard.slice(
      desktopCard.indexOf("id: desktopNameGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const numberBackplate = numberGutter.slice(
      numberGutter.indexOf("id: numberGutterBackplate"),
      numberGutter.indexOf("Text {"),
    );
    const nameBackplate = desktopNameGutter.slice(
      desktopNameGutter.indexOf("id: desktopNameGutterBackplate"),
      desktopNameGutter.indexOf("Text {"),
    );
    const projectedSurface = desktopCard.slice(
      desktopCard.indexOf("id: projectedOutputSurface"),
      desktopCard.indexOf("id: columnRepeater"),
    );
    const projectedBorder = projectedSurface.slice(
      projectedSurface.indexOf("id: projectedOutputSurfaceBorder"),
    );
    const emptyInput = desktopCard.slice(
      desktopCard.indexOf("id: emptyContentInput"),
      desktopCard.indexOf("id: windowRepeater"),
    );
    const windows = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );

    for (const backplate of [numberBackplate, nameBackplate]) {
      expect(backplate).toContain("anchors.fill: parent");
      expect(backplate).toContain('color: "#dc111824"');
      expect(backplate).toContain("border.width: 1");
      expect(backplate).toContain('border.color: "#805f718a"');
      expect(backplate).toContain("radius: 4");
      expect(backplate).not.toMatch(
        /card\.current|keyboardSelected|searchQuery|windowDropArea|desktopReorderSource|\b(?:TapHandler|DragHandler|Timer)\s*\{/u,
      );
    }
    expect(numberGutter.indexOf("id: numberGutterBackplate")).toBeLessThan(
      numberGutter.indexOf("Text {"),
    );
    expect(
      desktopNameGutter.indexOf("id: desktopNameGutterBackplate"),
    ).toBeLessThan(desktopNameGutter.indexOf("Text {"));

    expect(projectedSurface).toContain('color: "#171e2a"');
    expect(projectedSurface).toContain("z: -100");
    expect(projectedSurface.indexOf('color: "#171e2a"')).toBeLessThan(
      projectedSurface.indexOf("id: desktopSurfaceLoader"),
    );
    expect(projectedBorder).toMatch(
      /border\.width: windowDropArea\.validTarget \|\| card\.desktopReorderSource \? 2\s*: card\.current \? 1 : 0/u,
    );
    expect(projectedBorder).toMatch(
      /border\.color: windowDropArea\.validTarget \? "#86aee8"\s*: card\.desktopReorderSource \? "#668baad6"\s*: "#66758b"/u,
    );
    expect(projectedBorder).toContain("z: 2");
    expect(emptyInput).toContain("z: 1");
    expect(windows).toContain(
      "z: frame && frame.floating ? 1000 + index : 100 + index",
    );
    expect(
      `${numberBackplate}\n${nameBackplate}\n${projectedBorder}`,
    ).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
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
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const thumbnailTouchTap = thumbnail.slice(
      thumbnail.indexOf("id: thumbnailTouchHoldHandler"),
      thumbnail.indexOf("id: thumbnailTouchDragHandler"),
    );

    expect(numberGutter).toContain("acceptedButtons: Qt.LeftButton");
    expect(thumbnail).toContain("acceptedButtons: Qt.LeftButton");
    expect(windowPresentation).toContain("width: viewport.width");
    expect(windowPresentation).toContain("height: viewport.height");
    expect(thumbnail).toContain("acceptedButtons: Qt.LeftButton");
    expect(thumbnail).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(thumbnail).toContain(
      "enabled: thumbnailShell.visible && card.desktop && card.screen",
    );
    expect(thumbnail).toContain(
      'windowPresentation.primaryVisualKind === "thumbnail"',
    );
    expect(thumbnail).toContain(
      "visible: visualFrame !== null && visualOpacity > 0.0001 && model.window",
    );
    expect(thumbnail).not.toContain("enabled: card.current");
    expect(thumbnail).toContain(
      "card.windowTapped(model.window, windowPresentation.windowId, card.desktop,",
    );
    expect(thumbnail).toContain("card.desktopId, card.screen)");
    expect(thumbnailTouchTap).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(thumbnailTouchTap).toContain(
      "gesturePolicy: TapHandler.DragThreshold",
    );
    expect(thumbnailTouchTap).toContain(
      "enabled: thumbnailShell.visible && card.desktop && card.screen",
    );
    expect(thumbnailTouchTap).not.toMatch(
      /enabled:[^\n]*windowPresentation\.dragEligible/u,
    );
    expect(thumbnailTouchTap).toMatch(
      /onTapped: point => \{[\s\S]*card\.closeButtonContainsPoint\(thumbnailCloseButton, thumbnailShell,[\s\S]*point\.position[\s\S]*return;[\s\S]*card\.windowTapped\(model\.window, windowPresentation\.windowId, card\.desktop,[\s\S]*card\.desktopId, card\.screen\)/u,
    );
    expect(thumbnailTouchTap).not.toMatch(
      /desktopTapped|windowCloseRequested|org\.kde\.kwin\.private|\b(?:MouseArea|Timer)\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
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
      /if \(activeDesktop !== liveDesktop \|\| String\(activeDesktop\.id\) !== expectedDesktopId\) \{\s*if \(!requestDesktopSelection\([\s\S]*?true\)\) \{\s*cancelSpatialExitHandoff\(\);\s*return false;\s*\}\s*\}/u,
    );
    expect(focusHandler).toContain("const selectedDesktop = currentDesktop;");
    expect(focusHandler).toContain("selectedDesktop !== liveDesktop");
    expect(focusHandler).toContain(
      "String(selectedDesktop.id) !== expectedDesktopId",
    );
    expect(focusHandler).toContain(
      "const activeWindowBaseline = KWin.Workspace.activeWindow;",
    );
    expect(focusHandler).toMatch(
      /windowFocusStateIsExact\(candidate,\s*restoredFromMinimized,\s*false\)/u,
    );
    expect(focusHandler).toContain("catch (error)");
    expect(focusHandler).toContain("activeWindowBaseline,");
    expect(focusHandler).toContain('? "restore-requested" : "focus-queued"');
    expect(focusHandler).toContain("focusFrame: 0");
    expect(focusHandler).toMatch(
      /function queuePendingWindowFocusWrite\(request\)[\s\S]*request\.phase !== "focus-queued"[\s\S]*Qt\.callLater\(function\(\) \{\s*root\.performPendingWindowFocusWrite\(request\);/u,
    );
    expect(focusHandler).toMatch(
      /function performPendingWindowFocusWrite\(request\)[\s\S]*activeWindow !== request\.candidate[\s\S]*activeWindow !== request\.activeWindowBaseline[\s\S]*replacePendingWindowFocusPhase\(request,[\s\S]*"focus-requested"\)[\s\S]*KWin\.Workspace\.activeWindow = requested\.candidate/u,
    );
    expect(focusHandler).toMatch(
      /pendingWindowFocusRequestIsExact\(request, true\)[\s\S]*settleSpatialExitHandoff\(request\.candidate, request\.exitToken\)[\s\S]*clearPendingWindowFocus\(\);[\s\S]*effect\.deactivate\(\);/u,
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

    expect(focusHandler).toContain(
      "activeWindow !== request.activeWindowBaseline",
    );
    expect(focusHandler).toContain(
      "KWin.Workspace.activeWindow = requested.candidate",
    );
    expect(
      focusHandler.match(
        /KWin\.Workspace\.activeWindow = requested\.candidate/gu,
      ),
    ).toHaveLength(1);
    expect(focusHandler).toMatch(
      /function completePendingWindowFocus[\s\S]*pendingWindowFocusRequestIsExact\(request, true\)[\s\S]*settleSpatialExitHandoff\(request\.candidate, request\.exitToken\)[\s\S]*clearPendingWindowFocus\(\);[\s\S]*effect\.deactivate\(\);/u,
    );

    const minimizedSnapshot = focusHandler.indexOf(
      "const expectedMinimized = candidate !== null",
    );
    const preSelectionValidation = focusHandler.indexOf(
      "windowFocusStateIsExact(candidate, expectedMinimized, false)",
    );
    const handoffCapture = focusHandler.indexOf(
      "prepareOverviewWindowExitHandoff(",
    );
    const desktopRequest = focusHandler.indexOf("requestDesktopSelection(");
    const minimizedBranch = focusHandler.indexOf("if (expectedMinimized) {");
    const activeWindowBaseline = focusHandler.indexOf(
      "const activeWindowBaseline = KWin.Workspace.activeWindow;",
    );
    const preRestoreValidation = focusHandler.indexOf(
      "windowFocusStateIsExact(candidate, true, false)",
    );
    const restoreWrite = focusHandler.indexOf("candidate.minimized = false");
    const requestCreation = focusHandler.indexOf(
      "const request = createPendingWindowFocusRequest(",
    );
    const requestPublication = focusHandler.indexOf(
      "pendingWindowFocusRequest = request;",
    );
    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = requested.candidate",
    );
    const focusConfirmation = focusHandler.indexOf(
      "advancePendingWindowFocusActivation(current)",
    );
    const exactFocusSettle = focusHandler.indexOf(
      "pendingWindowFocusRequestIsExact(request, true)",
    );
    const deactivate = focusHandler.indexOf(
      "effect.deactivate()",
      focusHandler.indexOf("function completePendingWindowFocus("),
    );
    expect(minimizedSnapshot).toBeGreaterThan(0);
    expect(preSelectionValidation).toBeGreaterThan(0);
    expect(preSelectionValidation).toBeGreaterThan(minimizedSnapshot);
    expect(handoffCapture).toBeGreaterThan(preSelectionValidation);
    expect(desktopRequest).toBeGreaterThan(handoffCapture);
    expect(minimizedBranch).toBeGreaterThan(desktopRequest);
    expect(activeWindowBaseline).toBeGreaterThan(desktopRequest);
    expect(activeWindowBaseline).toBeLessThan(minimizedBranch);
    expect(preRestoreValidation).toBeGreaterThan(minimizedBranch);
    expect(requestCreation).toBeGreaterThan(preRestoreValidation);
    expect(requestPublication).toBeGreaterThan(requestCreation);
    expect(restoreWrite).toBeGreaterThan(requestPublication);
    expect(activeWindowWrite).toBeGreaterThan(requestPublication);
    expect(focusConfirmation).toBeGreaterThan(activeWindowWrite);
    expect(exactFocusSettle).toBeGreaterThan(requestPublication);
    expect(deactivate).toBeGreaterThan(exactFocusSettle);
    expect(deactivate).toBeGreaterThan(activeWindowWrite);
    expect(focusHandler.match(/candidate\.minimized = false/gu)).toHaveLength(
      1,
    );
    expect(focusHandler).toMatch(
      /const transientHiddenAllowed = request[\s\S]*request\.restoredFromMinimized === true[\s\S]*request\.phase !== "geometry-settle"[\s\S]*windowFocusStateIsExact\(request\.candidate, false,[\s\S]*!transientHiddenAllowed\)/u,
    );

    expect(sceneWithoutWorkspaceManagement).not.toContain(
      "KWin.Workspace.stackingOrder",
    );
    expect(`${sceneWithoutWorkspaceManagement}\n${desktopCard}`).not.toMatch(
      /MouseArea|ShortcutHandler|\.setValue\s*\(/u,
    );
  });

  it("snapshots effect-window action fields outside live handler bindings", () => {
    const presentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: windowDropArea"),
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
      /onCandidateChanged: \{\s*card\.advanceWindowDragSourceRevision\(windowPresentation\);\s*card\.schedulePresentationMotion\(\);\s*card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);\s*refreshActionSnapshot\(\);\s*card\.attentionRevision \+= 1;\s*\}/u,
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
      "enabled: thumbnailShell.visible && windowPresentation.closeEligible",
    );
    expect(presentation).toContain("wId: windowPresentation.windowId");
    expect(presentation).not.toContain("wId: model.window.internalId");
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
    expect(snapshotDrop).not.toContain("source.dragEligible === true");
    expect(snapshotDrop).toContain("windowCanDrag(source)");
    expect(snapshotDrop).toContain(
      "source.spatialDragLifecycleActive === true",
    );
    expect(snapshotDrop).toContain(
      "windowDropSourceDragSnapshotIsExact(source)",
    );
    const windowDropValidity = desktopCard.slice(
      desktopCard.indexOf(
        "readonly property bool validTarget:",
        desktopCard.indexOf("id: windowDropArea"),
      ),
      desktopCard.indexOf(
        "readonly property var spatialPreview:",
        desktopCard.indexOf("id: windowDropArea"),
      ),
    );
    const columnDropValidity = desktopCard.slice(
      desktopCard.indexOf(
        "readonly property bool validTarget:",
        desktopCard.indexOf("id: columnDropArea"),
      ),
      desktopCard.indexOf(
        "readonly property var spatialPreview:",
        desktopCard.indexOf("id: columnDropArea"),
      ),
    );
    const clearInvalidWindowDropHover = desktopCard.slice(
      desktopCard.indexOf("function clearInvalidWindowDropHover("),
      desktopCard.indexOf("function clearWindowDropHover("),
    );
    const clearInvalidColumnDropHover = desktopCard.slice(
      desktopCard.indexOf("function clearInvalidColumnDropHover("),
      desktopCard.indexOf("function clearColumnDropHover("),
    );
    const windowDropOwnership = desktopCard.slice(
      desktopCard.indexOf("function windowDropHoverOwnershipIsValid("),
      desktopCard.indexOf("function windowDropLocalPosition("),
    );
    const columnDropOwnership = desktopCard.slice(
      desktopCard.indexOf("function columnDropHoverOwnershipIsValid("),
      desktopCard.indexOf("function planColumnDropPreview("),
    );
    const windowDropHandler = desktopCard.slice(
      desktopCard.indexOf(
        "onDropped: drop =>",
        desktopCard.indexOf("id: windowDropArea"),
      ),
      desktopCard.indexOf(
        "Connections {",
        desktopCard.indexOf("id: windowDropArea"),
      ),
    );
    const columnDropHandler = desktopCard.slice(
      desktopCard.indexOf(
        "onDropped: drop =>",
        desktopCard.indexOf("id: columnDropArea"),
      ),
      desktopCard.indexOf(
        "Connections {",
        desktopCard.indexOf("id: columnDropArea"),
      ),
    );
    expect(windowDropValidity).toMatch(
      /readonly property bool validTarget:\s*card\.windowDropHoverOwned\s*&& card\.windowDropHoverTarget !== null\s*&& card\.windowDropHoverPreview !== null/u,
    );
    expect(columnDropValidity).toMatch(
      /readonly property bool validTarget:\s*card\.columnDropHoverOwned\s*&& card\.columnDropHoverTarget !== null\s*&& card\.columnDropHoverPreview !== null/u,
    );
    expect(`${windowDropValidity}\n${columnDropValidity}`).not.toMatch(
      /containsDrag|DropHoverOwnership(?:IsValid|Matches)\s*\(/u,
    );
    expect(clearInvalidWindowDropHover).toMatch(
      /windowDropHoverOwned && !windowDropHoverOwnershipIsValid\(\)/u,
    );
    expect(clearInvalidColumnDropHover).toMatch(
      /columnDropHoverOwned && !columnDropHoverOwnershipIsValid\(\)/u,
    );
    expect(windowDropOwnership).toMatch(
      /return windowDropHoverOwnershipMatches\(windowDropHoverSource\)\s*&& windowDropIsValid\(windowDropHoverSource, \["driftile-window"\]\);/u,
    );
    expect(columnDropOwnership).toMatch(
      /return columnDropHoverOwnershipMatches\(columnDropHoverSource\)\s*&& columnDropIsValid\(columnDropHoverSource, \["driftile-column"\]\);/u,
    );
    expect(windowDropHandler).toMatch(
      /!card\.windowDropIsValid\(source, drop\.keys\)\s*\|\| !card\.windowDropHoverOwnershipMatches\(source\)/u,
    );
    expect(columnDropHandler).toMatch(
      /!card\.columnDropIsValid\(source, drop\.keys\)\s*\|\| !card\.columnDropHoverOwnershipMatches\(source\)/u,
    );
    expect(liveDrop).toContain("windowCanDrag(source)");
    expect(desktopCard).toContain(
      "onEntered: drag => drag.accepted = card.trackWindowDropHover(drag)",
    );
    expect(desktopCard).toContain(
      "onPositionChanged: drag => drag.accepted = card.trackWindowDropHover(drag)",
    );
    const hoverTracking = desktopCard.slice(
      desktopCard.indexOf("function trackWindowDropHover("),
      desktopCard.indexOf("function moveWindowDropHoverToPositions("),
    );
    expect(hoverTracking).toMatch(
      /if \(!drag \|\| !windowDropIsValid\(source, drag\.keys\)\) \{\s*rejectWindowDropHover\(\);\s*return false;\s*\}/u,
    );
    expect(hoverTracking).toMatch(
      /if \(windowDropHoverOwned\) \{\s*moveWindowDropHover\(source, drag\);\s*\} else \{\s*claimWindowDropHover\(source, drag\);\s*\}\s*return true;/u,
    );
    expect(hoverTracking).not.toMatch(
      /return (?:move|claim)WindowDropHover\(/u,
    );
    expect(desktopCard).toContain(
      "|| !card.windowDropHoverOwnershipMatches(source))",
    );
    expect(liveDrop).not.toContain("moveWindowDropHover(source, drop)");
  });

  it("submits one exact live window through a guarded spatial drop", () => {
    const delegate = scene.slice(
      scene.indexOf("DesktopCard {"),
      scene.indexOf("Rectangle {", scene.indexOf("DesktopCard {")),
    );
    const transaction = scene.slice(
      scene.indexOf("function submitWindowSpatialDrop("),
      scene.indexOf("function canonicalSpatialDropTarget("),
    );
    const canonicalTarget = scene.slice(
      scene.indexOf("function canonicalSpatialDropTarget("),
      scene.indexOf("function spatialDropContextContainsWindow("),
    );
    const targetMembership = scene.slice(
      scene.indexOf("function spatialDropContextContainsWindow("),
      scene.indexOf("function windowSpatialDropSceneIsExact("),
    );
    const sceneGuard = scene.slice(
      scene.indexOf("function windowSpatialDropSceneIsExact("),
      scene.indexOf("function windowDesktopDropCandidateIsExact("),
    );
    const candidateGuard = scene.slice(
      scene.indexOf("function windowDesktopDropCandidateIsExact("),
      scene.indexOf("function orderedDesktopIds("),
    );
    const workspaceRelation = desktopCard.slice(
      desktopCard.indexOf("function windowDropSourceWorkspaceRelationIsExact("),
      desktopCard.indexOf(
        "function windowDropSourceTargetsDifferentWorkspace(",
      ),
    );
    const dropValidation = desktopCard.slice(
      desktopCard.indexOf("function windowDropIsValid("),
      desktopCard.indexOf("function windowDropSourceIsEligible("),
    );

    expect(scene).toContain(
      "readonly property string activeOverviewActivityId: canonicalOverviewActivityId()",
    );
    expect(scene).toMatch(
      /function canonicalOverviewActivityId\(\)[\s\S]*const fallbackActivityId = "driftile-default-activity";[\s\S]*KWin\.Workspace\.currentActivity[\s\S]*KWin\.Workspace\.activities[\s\S]*return activityIds\.length === 1 \? activityIds\[0\] : fallbackActivityId;/u,
    );
    expect(desktopCard).toContain(
      "required property string overviewActivityId",
    );
    expect(delegate).toContain(
      "overviewActivityId: root.activeOverviewActivityId",
    );
    expect(desktopCard).toMatch(
      /signal windowDropped\(var candidate, string expectedWindowId, var expectedSourceDesktop,\s*string expectedSourceDesktopId, var expectedTargetDesktop,\s*string expectedTargetDesktopId, var expectedScreen, var exactTarget,\s*string basisFingerprint\)/u,
    );
    expect(desktopCard.match(/\bDragHandler\s*\{/gu)).toHaveLength(7);
    expect(desktopCard.match(/\bDropArea\s*\{/gu)).toHaveLength(2);
    expect(desktopCard.match(/\.Drag\.active = true;/gu)).toHaveLength(6);
    expect(desktopCard.match(/\.Drag\.active = false;/gu)).toHaveLength(12);
    expect(delegate).toMatch(
      /onWindowDropped:\s*\(\s*candidate,\s*expectedWindowId,\s*expectedSourceDesktop,\s*expectedSourceDesktopId,\s*expectedTargetDesktop,\s*expectedTargetDesktopId,\s*expectedScreen,\s*exactTarget,\s*basisFingerprint\s*\)\s*=>\s*root\.submitWindowSpatialDrop\(\s*candidate,\s*expectedWindowId,\s*expectedSourceDesktop,\s*expectedSourceDesktopId,\s*expectedTargetDesktop,\s*expectedTargetDesktopId,\s*expectedScreen,\s*expectedScreen,\s*exactTarget,\s*basisFingerprint\s*\)/u,
    );

    expect(transaction).toContain("const effect = sceneEffect;");
    expect(transaction).toContain("const model = overviewModel;");
    expect(transaction).toContain(
      "const liveSourceScreen = liveScreenFor(expectedSourceScreen);",
    );
    expect(transaction).toContain(
      "const liveTargetScreen = liveScreenFor(expectedTargetScreen);",
    );
    expect(transaction).toContain(
      "const sourceOutput = projectedOutput(model, liveSourceScreen);",
    );
    expect(transaction).toContain(
      "const targetOutput = projectedOutput(model, liveTargetScreen);",
    );
    expect(transaction).toContain(
      "const expectedActivityId = activeOverviewActivityId;",
    );
    expect(transaction).toContain(
      "liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId)",
    );
    expect(transaction).toContain(
      "liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId)",
    );
    expect(transaction).toContain(
      "const target = canonicalSpatialDropTarget(exactTarget, expectedActivityId, targetOutputId,",
    );
    expect(transaction).toContain(
      "expectedTargetDesktopId, expectedWindowId);",
    );
    expect(transaction).toContain(
      'typeof effect.submitSpatialDropCommand !== "function"',
    );
    expect(transaction).toContain("effect.submitSpatialDropCommand({");
    for (const field of [
      "activityId: expectedActivityId",
      "desktopId: expectedSourceDesktopId",
      "outputId: sourceOutputId",
      "windowId: expectedWindowId",
    ]) {
      expect(transaction).toContain(field);
    }
    expect(transaction).toContain("}, target, basisFingerprint) === true;");
    expect(transaction.match(/windowSpatialDropSceneIsExact\(/gu)).toHaveLength(
      1,
    );
    expect(
      transaction.match(/windowDesktopDropCandidateIsExact\(/gu),
    ).toHaveLength(1);
    expect(transaction).not.toMatch(
      /requestDesktopSelection\(|KWin\.Workspace\.activeWindow\s*=|effect\.deactivate\(/u,
    );

    expect(sceneGuard).not.toContain("liveSourceDesktop !== liveTargetDesktop");
    expect(sceneGuard).not.toContain(
      "expectedSourceDesktopId !== expectedTargetDesktopId",
    );
    expect(sceneGuard.match(/desktopContextIsExact\(/gu)).toHaveLength(2);
    expect(workspaceRelation).toContain(
      "const sameDesktop = source.sourceDesktop === desktop;",
    );
    expect(workspaceRelation).toContain(
      "const sameDesktopId = source.sourceDesktopId === desktopId;",
    );
    expect(workspaceRelation).toContain(
      "return sameDesktop === sameDesktopId;",
    );
    expect(dropValidation).toContain(
      "windowDropSourceWorkspaceRelationIsExact(source)",
    );
    expect(dropValidation).not.toContain(
      "windowDropSourceTargetsDifferentWorkspace(source)",
    );

    for (const guard of [
      "!exactTarget",
      "!Object.isFrozen(exactTarget)",
      "exactTarget.rowIndex !== 0",
      "exactTarget.activityId !== expectedActivityId",
      "exactTarget.outputId !== expectedOutputId",
      "exactTarget.desktopId !== expectedTargetDesktopId",
      'exactTarget.kind === "empty-row"',
      "const exactEmptyContext = targetContext === null",
      "indexedListHasBoundedLength(targetContext.columns, 0, 0)",
      'exactTarget.kind !== "column-boundary"',
      'exactTarget.kind !== "stack-insertion"',
      'exactTarget.position !== "before"',
      'exactTarget.position !== "after"',
      'typeof exactTarget.targetWindowId !== "string"',
      'exactTarget.kind === "stack-insertion"',
      "exactTarget.targetWindowId === expectedSourceWindowId",
      "spatialDropContextContainsWindow(targetContext, exactTarget.targetWindowId)",
    ]) {
      expect(canonicalTarget).toContain(guard);
    }
    expect(targetMembership).toContain("return matches === 1;");
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
      "activeOverviewActivityId !== expectedActivityId",
      "!windowUsesActivity(candidate, expectedActivityId)",
      "candidate.transient !== false",
      "candidate.transientFor !== null",
      "desktops.length === 1",
      "desktops[0] === expectedDesktop",
      "String(desktops[0].id) === expectedDesktopId",
    ]) {
      expect(candidateGuard).toContain(guard);
    }

    const canonicalization = transaction.indexOf(
      "const target = canonicalSpatialDropTarget(",
    );
    const initialValidation = transaction.indexOf(
      "if (!windowSpatialDropSceneIsExact(",
    );
    const submit = transaction.indexOf("effect.submitSpatialDropCommand({");
    expect(canonicalization).toBeGreaterThan(0);
    expect(initialValidation).toBeGreaterThan(canonicalization);
    expect(submit).toBeGreaterThan(initialValidation);

    expect(transaction).not.toMatch(
      /candidate\.(?:desktops|output|geometry|frameGeometry)\s*=(?!=)|effect\.deactivate\(|org\.kde\.kwin\.private|\bTimer\s*\{|setTimeout|\.setValue\s*\(/u,
    );
  });

  it("previews and submits an exact workspace-gap drop", () => {
    const gapDelegate = scene.slice(
      scene.indexOf("id: workspaceGapDropRepeater"),
      scene.indexOf("id: spatialHorizontalRowInput"),
    );
    const columnGapDelegate = gapDelegate.slice(
      gapDelegate.indexOf("id: workspaceGapColumnDropArea"),
      gapDelegate.indexOf(
        "Rectangle {",
        gapDelegate.indexOf("id: workspaceGapColumnDropArea"),
      ),
    );
    const planning = scene.slice(
      scene.indexOf("function planWorkspaceGapDrop("),
      scene.indexOf("function workspaceGapDropSourceIsExact("),
    );
    const submission = scene.slice(
      scene.indexOf("function submitWindowWorkspaceGapDrop("),
      scene.indexOf("function handleCrossOutputWindowDrop("),
    );
    const crossOutput = scene.slice(
      scene.indexOf("function handleCrossOutputWindowDrop("),
      scene.indexOf("function moveWindowAcrossOutputs("),
    );

    expect(gapDelegate).toContain(
      "model: Math.max(0, root.desktopIds.length - 1)",
    );
    expect(gapDelegate).toContain('keys: ["driftile-window"]');
    expect(gapDelegate).not.toContain("root.spatialWindowDragSource !== null");
    expect(gapDelegate).toMatch(
      /root\.claimWorkspaceGapPreview\(\s*workspaceGapDropArea, drag, workspaceGapDropSlot\.index\)/u,
    );
    expect(gapDelegate).toContain(
      "root.submitWindowWorkspaceGapDrop(drop.source, plan, root.targetScreen,",
    );
    expect(gapDelegate).toContain("basisFingerprint);");
    expect(gapDelegate).toMatch(
      /onDropped: drop => \{\s*const exactPreview = root\.workspaceGapPreviewSource === drop\.source\s*&& root\.workspaceGapPreviewIndex === workspaceGapDropSlot\.index\s*&& root\.workspaceGapPreviewIsExact\(\);\s*const plan = exactPreview \? root\.workspaceGapPreviewPlan : null;/u,
    );
    expect(gapDelegate).toMatch(
      /const basisFingerprint = root\.workspaceGapPreviewBasisFingerprint;\s*root\.releaseWorkspaceGapPreview\(workspaceGapDropSlot\.index\);\s*const accepted = plan !== null/u,
    );
    expect(gapDelegate).not.toMatch(
      /onDropped: drop => \{[\s\S]*?planWorkspaceGapDrop\(workspaceGapDropArea, drop/u,
    );
    expect(gapDelegate).toMatch(
      /drop\.action = accepted \? Qt\.MoveAction : Qt\.IgnoreAction;[\s\S]*drop\.accepted = accepted;/u,
    );
    expect(gapDelegate).toMatch(
      /readonly property bool previewContainsDrag:[\s\S]*workspaceGapColumnDropArea\.containsDrag[\s\S]*workspaceGapDropArea\.containsDrag[\s\S]*readonly property var plan: previewContainsDrag[\s\S]*root\.workspaceGapPreviewSourceId\(root\.workspaceGapPreviewSource\)[\s\S]*root\.workspaceGapPreviewPlan !== null \? root\.workspaceGapPreviewPlan : null[\s\S]*x: root\.cardX[\s\S]*y: plan \? plan\.lineY - workspaceGapDropSlot\.y - height \/ 2[\s\S]*width: root\.cardWidth[\s\S]*visible: plan !== null/u,
    );
    expect(gapDelegate).toContain("workspaceGapPreviewIsExact()");
    expect(gapDelegate).not.toContain(
      "onExited: root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index)",
    );
    expect(gapDelegate).not.toContain("onContainsDragChanged:");
    expect(columnGapDelegate).toContain('keys: ["driftile-column"]');
    expect(columnGapDelegate.match(/onDropped: drop =>/gu)).toHaveLength(1);
    expect(
      columnGapDelegate.match(/submitColumnWorkspaceGapDrop/gu),
    ).toHaveLength(1);
    expect(columnGapDelegate).not.toContain("submitWindowWorkspaceGapDrop");
    expect(columnGapDelegate).not.toContain("planColumnWorkspaceGapDrop(");
    expect(columnGapDelegate).toMatch(
      /const exactPreview = root\.workspaceGapPreviewSource === drop\.source[\s\S]*const plan = exactPreview \? root\.workspaceGapPreviewPlan : null;[\s\S]*const basisFingerprint = root\.workspaceGapPreviewBasisFingerprint;[\s\S]*root\.releaseWorkspaceGapPreview\(workspaceGapDropSlot\.index\);[\s\S]*root\.submitColumnWorkspaceGapDrop\(drop\.source, plan, root\.targetScreen,[\s\S]*basisFingerprint\);[\s\S]*drop\.action = accepted \? Qt\.MoveAction : Qt\.IgnoreAction;[\s\S]*drop\.accepted = accepted;/u,
    );

    expect(planning).toContain(
      'typeof runtime.planOverviewSpatialWorkspaceGap !== "function"',
    );
    expect(planning).toContain(
      "const canvasPoint = spatialCanvas.mapFromItem(root, point.x, point.y);",
    );
    expect(planning).toContain(
      "const externalSource = liveSourceScreen !== liveTargetScreen",
    );
    expect(planning).toContain(
      "spatialWindowDragSource === null && sourceOutputId !== targetOutputId",
    );
    expect(planning).toContain("windowSpatialDropSceneIsExact(");
    expect(planning).toContain("windowDesktopDropCandidateIsExact(");
    expect(planning).toContain("clearInvalidWorkspaceGapPreview()");
    expect(planning).toMatch(
      /function claimWorkspaceGapPreview[\s\S]*workspaceGapPreviewContextIsExact\(source, plan, expectedGapIndex\)[\s\S]*captureWorkspaceGapBasisFingerprint\(source, plan\)/u,
    );
    expect(planning).toMatch(
      /function clearInvalidWorkspaceGapPreview[\s\S]*!workspaceGapPreviewIsExact\(\)/u,
    );
    for (const field of [
      "cardGap: cardGap",
      "cardHeight: cardHeight",
      "cardTop: 0",
      "desktopIds: desktopIds",
      "keepEmptyDesktopAboveFirst: emptyDesktopAboveFirst",
      "pointY: pointY",
    ]) {
      expect(planning).toContain(field);
    }
    expect(planning).toContain("Object.isFrozen(plan)");
    expect(planning).toContain(
      "adjacentIndex + 1 === anchorIndex && plan.insertionIndex === anchorIndex",
    );
    expect(planning).toContain(
      "anchorIndex + 1 === adjacentIndex && plan.insertionIndex === adjacentIndex",
    );

    expect(submission).toContain("workspaceGapDropSourceIsExact(source)");
    expect(submission).toContain("windowSpatialDropSceneIsExact(");
    expect(submission).toContain("windowDesktopDropCandidateIsExact(");
    expect(submission).toContain("canonicalWorkspaceGapDropTarget(");
    expect(submission).toContain('kind: "workspace-gap"');
    expect(submission).toContain(
      "adjacentDesktopId: exactPlan.adjacentDesktopId",
    );
    expect(submission).toContain("anchorDesktopId: exactPlan.anchorDesktopId");
    expect(submission).toContain("position: exactPlan.position");
    expect(submission).toContain("effect.submitSpatialDropCommand({");
    expect(submission).not.toMatch(
      /createDesktop|removeDesktop|moveDesktop|candidate\.(?:desktops|output|frameGeometry)\s*=(?!=)|org\.kde\.kwin\.private/u,
    );

    expect(crossOutput).toMatch(
      /if \(targetHit\.kind === "workspace-gap"\) \{\s*const basisFingerprint = captureWorkspaceGapBasisFingerprint\(source, targetHit\.plan\);\s*submitWindowWorkspaceGapDrop\(source, targetHit\.plan, expectedTargetScreen,\s*basisFingerprint\);\s*return;\s*\}/u,
    );
    expect(crossOutput).toContain(
      "const workspaceGapPlan = planWorkspaceGapDropAtRootPoint(localPosition);",
    );
  });

  it("routes one exact live window across outputs and compensates partial writes", () => {
    const sourceHandlers = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailDragHandler"),
      desktopCard.indexOf("id: windowDropArea"),
    );
    const transport = desktopCard.slice(
      desktopCard.indexOf("function crossOutputWindowDropGlobalPosition("),
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
    ).toHaveLength(1);
    expect(sourceHandlers.match(/action !== Qt\.MoveAction/gu)).toHaveLength(1);
    expect(
      sourceHandlers.match(
        /card\.requestCrossOutputWindowDrop\(source, globalPosition\)/gu,
      ),
    ).toHaveLength(1);
    expect(transport).toContain("screen.mapToGlobal(scenePosition)");
    expect(
      sourceHandlers.indexOf("crossOutputWindowDropGlobalPosition("),
    ).toBeLessThan(sourceHandlers.indexOf(".Drag.drop()"));
    const crossOutputRequestIndex = sourceHandlers.indexOf(
      "requestCrossOutputWindowDrop(",
    );
    expect(crossOutputRequestIndex).toBeGreaterThanOrEqual(0);
    expect(crossOutputRequestIndex).toBeLessThan(
      sourceHandlers.indexOf(".Drag.active = false", crossOutputRequestIndex),
    );
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
      "const targetHit = crossOutputDropTargetAt(globalPosition, expectedTargetScreen);",
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
      /if \(targetHit\) \{\s*return null;\s*\}/u,
    );
    expect(targetResolution).toContain("localPosition: Object.freeze({");
    expect(targetResolution).toContain(
      "targetCard.planCrossOutputWindowDropTarget(source, targetHit.localPosition)",
    );
    expect(targetResolution).toContain(
      'typeof sourceCard.crossOutputWindowDropSourceIsExact === "function"',
    );
    expect(targetResolution).toContain(
      "sourceCard.crossOutputWindowDropSourceIsExact(source)",
    );
    expect(targetResolution).toMatch(
      /if \(exactTarget && typeof basisFingerprint === "string"[\s\S]*?submitWindowSpatialDrop\([\s\S]*?source\.sourceScreen, targetCard\.screen, exactTarget,\s*basisFingerprint\);\s*return;\s*\}/u,
    );
    expect(targetResolution).not.toContain("moveWindowAcrossOutputs(");

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
    expect(settlement).toContain("state.effect.deactivateImmediately();");
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
    const spatialCanvasStart = scene.indexOf("id: spatialCanvas");
    const spatialInput = scene.slice(
      spatialInputStart,
      scene.lastIndexOf("Repeater {", desktopRepeaterStart) +
        "Repeater {".length,
    );
    const spatialHorizontalRowInput = scene.slice(
      scene.indexOf("id: spatialHorizontalRowInput"),
      scene.indexOf("KeyboardHelpHint {"),
    );
    const numberGutter = desktopCard.slice(
      desktopCard.indexOf("id: numberGutter"),
      desktopCard.indexOf("id: viewport"),
    );
    const desktopLoaderId = scene.indexOf("id: desktopCardLoader");
    const desktopLoaderStart = scene.lastIndexOf("Loader {", desktopLoaderId);
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
    const desktopCardLoadPolicy = scene.slice(
      scene.indexOf("function desktopCardShouldLoad("),
      scene.indexOf("function desktopCardAt("),
    );
    const currentDesktopChangeHandler = scene.slice(
      scene.indexOf("function handleCurrentDesktopChanged("),
      scene.indexOf("onOverviewModelChanged:"),
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
      "const horizontalError = Math.abs(plan.cardX) + Math.abs(plan.cardWidth - width);",
    );
    expect(spatialLayout).toMatch(
      /function legacySpatialLayout[\s\S]*legacyCardHeight = count > 0 \? Math\.max\(1, height \* zoom\)[\s\S]*cardWidth: Math\.max\(1, width\),[\s\S]*cardX: 0,[\s\S]*initialContentY:/u,
    );
    expect(scene).toContain(
      "readonly property real cardTop: overviewSpatialLayout.edgeMargin - spatialVisualContentY",
    );
    expect(scene).toContain("property real spatialContentY: 0");
    expect(scene).toContain("property real spatialVisualContentY: 0");
    expect(scene).toContain(
      "property bool spatialVisualContentYDeferred: false",
    );
    expect(scene).toMatch(
      /readonly property real spatialPresentationProgress:[\s\S]*sceneEffect\.presentationProgress[\s\S]*Math\.max\(0, Math\.min\(1, sceneEffect\.presentationProgress\)\)/u,
    );
    expect(scene).toMatch(
      /readonly property string spatialPresentationPhase:[\s\S]*sceneEffect\.presentationPhase[\s\S]*: "open"/u,
    );
    expect(scene).toContain("enabled: spatialPresentationVisible");
    expect(scene).toContain(
      "property int spatialPresentationWorkspaceIndex: -1",
    );
    expect(scene).toMatch(
      /Component\.onCompleted:[\s\S]*spatialPresentationWorkspaceIndex = currentWorkspaceIndex;[\s\S]*handleSpatialPresentationPhaseChanged\(\);/u,
    );
    expect(scene).toMatch(
      /id: spatialBackdrop[\s\S]*opacity: root\.spatialPresentationProgress/u,
    );
    expect(scene).not.toContain("id: spatialOpenAnimation");
    expect(scene).toMatch(
      /id: spatialVerticalCameraAnimation[\s\S]*target: root[\s\S]*property: "spatialVisualContentY"[\s\S]*easing\.type: Easing\.OutCubic/u,
    );
    expect(scene).toMatch(
      /function setSpatialContentY\(requestedContentY, animateVisual = false\)[\s\S]*const animateBoundedDistance = animateVisual === true[\s\S]*distance <= stride \* 4;[\s\S]*spatialVerticalCameraAnimation\.duration = Math\.max\(90, Math\.min\(180,/u,
    );
    expect(spatialCanvasStart).toBeGreaterThan(spatialInputStart);
    expect(spatialCanvasStart).toBeLessThan(desktopRepeaterStart);
    expect(scene).toMatch(
      /id: spatialCanvas[\s\S]*presentationOffsetY:[\s\S]*root\.height \/ 2 - \(root\.cardTop \+ presentationRowCenter\)[\s\S]*x: 0[\s\S]*y: root\.cardTop \+ presentationOffsetY[\s\S]*width: root\.width[\s\S]*height: Math\.max\(0, root\.desktopIds\.length \* \(root\.cardHeight \+ root\.cardGap\) - root\.cardGap\)/u,
    );
    expect(scene).toMatch(
      /id: spatialCanvas[\s\S]*presentationWorkspaceIndex:[\s\S]*fullScale: root\.cardHeight > 0[\s\S]*presentationScale: 1 \+ \(fullScale - 1\)[\s\S]*transform: Scale \{[\s\S]*origin\.x: spatialCanvas\.width \/ 2[\s\S]*origin\.y: spatialCanvas\.presentationWorkspaceIndex[\s\S]*xScale: spatialCanvas\.presentationScale[\s\S]*yScale: spatialCanvas\.presentationScale/u,
    );
    expect(desktopLoaderStart).toBeGreaterThan(0);
    expect(desktopLoader).toContain("x: 0");
    expect(desktopLoader).toContain(
      "y: index * (root.cardHeight + root.cardGap)",
    );
    expect(desktopLoader).toContain("width: spatialCanvas.width");
    expect(desktopLoader).toContain("height: root.cardHeight");
    expect(desktopLoader).toContain(
      "active: root.desktopCardShouldLoad(index, modelData)",
    );
    expect(desktopCardLoadPolicy).toMatch(
      /desktopIds\[index\] !== expectedDesktopId\) \{\s*return false;/u,
    );
    expect(desktopLoader).toMatch(
      /onActiveChanged: \{[\s\S]*root\.advanceOverviewDesktopCardEpoch\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*\}/u,
    );
    expect(desktopLoader).toMatch(
      /onLoaded: \{[\s\S]*root\.advanceOverviewDesktopCardEpoch\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*\}/u,
    );
    expect(reorderDelegate).toMatch(
      /onNavigationTargetsChanged: \{[\s\S]*root\.advanceOverviewDesktopCardEpoch\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*\}/u,
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
      /const logicalRange = planSpatialVisibleRangeAt\(runtime, spatialContentY\);[\s\S]*const visualRange = planSpatialVisibleRangeAt\(runtime, spatialVisualContentY\);[\s\S]*firstIndex: Math\.min\(logicalRange\.firstIndex, visualRange\.firstIndex\),[\s\S]*lastIndex: Math\.max\(logicalRange\.lastIndex, visualRange\.lastIndex\)/u,
    );
    expect(spatialLayout).toMatch(
      /function planSpatialVisibleRangeAt\(runtime, contentY\)[\s\S]*runtime\.planOverviewSpatialVisibleRange\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY,[\s\S]*workspaceCount: desktopIds\.length,[\s\S]*overscan: 1/u,
    );
    expect(spatialLayout).toContain("return fallback;");
    expect(spatialLayout).toContain("if (searchQuery.length > 0");
    expect(spatialLayout).toContain('spatialPresentationPhase !== "open"');
    expect(spatialLayout).toContain(
      "index === spatialPresentationWorkspaceIndex",
    );
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
      /function resetSpatialViewport\(animateVisual = false\)[\s\S]*planSpatialViewport\(overviewSpatialLayout\.initialContentY\)[\s\S]*return setSpatialContentY\(plan\.contentY, animateVisual\);/u,
    );
    expect(scene).toMatch(
      /onOverviewSpatialLayoutChanged: \{[\s\S]*spatialExternalZoomTransaction !== null[\s\S]*spatialZoomTransaction !== null[\s\S]*root\.refreshOverviewSpatialSession\(true\);/u,
    );
    expect(scene).toMatch(
      /onOverviewModelChanged: \{[\s\S]*root\.cancelSpatialZoomTransaction\(\);[\s\S]*root\.refreshOverviewSpatialSession\(true\);[\s\S]*root\.synchronizeSpatialZoomInputState\(\);/u,
    );
    expect(scene).toContain(
      "onCurrentDesktopChanged: root.handleCurrentDesktopChanged()",
    );
    expect(currentDesktopChangeHandler).toMatch(
      /spatialPresentationPhase === "closing"[\s\S]*sceneEffect\.deactivateImmediately\(\);[\s\S]*return;/u,
    );
    expect(currentDesktopChangeHandler).toMatch(
      /spatialPresentationPhase === "opening" && currentWorkspaceIndex >= 0[\s\S]*spatialPresentationWorkspaceIndex = currentWorkspaceIndex;/u,
    );
    expect(currentDesktopChangeHandler).toMatch(
      /spatialPresentationInteractive && spatialDirectDragSource !== null[\s\S]*spatialDirectDragSourceIsExact\(spatialDirectDragSource,[\s\S]*resetWindowWorkspaceHover\(\);[\s\S]*planSpatialWorkspaceCenter\(currentWorkspaceIndex\)[\s\S]*setSpatialContentY\(plan\.contentY, true\);[\s\S]*resolveSpatialLiveCamera\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*return;/u,
    );
    expect(currentDesktopChangeHandler).toContain(
      "root.refreshOverviewSpatialSession(false, spatialPresentationInteractive)",
    );
    expect(scene).toMatch(
      /function handleSpatialPresentationPhaseChanged\(\)[\s\S]*spatialPresentationPhase === "closing"[\s\S]*spatialPresentationWorkspaceIndex = currentWorkspaceIndex;[\s\S]*if \(!adoptSpatialVisualContentY\(\)\) \{\s*spatialVerticalCameraAnimation\.stop\(\);/u,
    );
    expect(scene).toMatch(
      /Component\.onCompleted:[\s\S]*resetOverviewSession\(\);[\s\S]*forceActiveFocus\(\);/u,
    );
    expect(scene).toMatch(
      /function onActiveChanged\(\) \{[\s\S]*root\.clearPendingWindowFocus\(\);[\s\S]*root\.cancelSpatialZoomTransaction\(\);\s*root\.resetOverviewSession\(\);/u,
    );
    expect(sessionReset).toMatch(
      /function resetOverviewSession\(\)[\s\S]*keyboardSelectionId = "";[\s\S]*keyboardHelpVisible = false;[\s\S]*searchQuery = "";[\s\S]*spatialViewportSnapshot = null;[\s\S]*refreshOverviewSpatialSession\(false\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /function refreshOverviewSpatialSession\(preserveViewport, animateViewport = false\)[\s\S]*cancelKeyboardBoundaryNavigation\(\);/u,
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
    expect(spatialSessionRefresh).toContain(
      "clearSpatialHorizontalViewportDrag();",
    );
    expect(spatialSessionRefresh).toMatch(
      /resetDesktopReorder\(\);[\s\S]*resetSpatialEdgePanTracking\(\);/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /sceneEffect && sceneEffect\.active === true[\s\S]*planSpatialViewportAnchor\(previousViewportSnapshot, nextViewportGeometry\)[\s\S]*setSpatialContentY\(anchorPlan\.contentY, animateViewport\);[\s\S]*resetSpatialViewport\(animateViewport\);[\s\S]*captureSpatialViewportSnapshot\(\);[\s\S]*Qt\.callLater\(root\.repairKeyboardSelection\);[\s\S]*spatialVerticalCameraAnimation\.stop\(\);[\s\S]*spatialContentY = 0;[\s\S]*spatialVisualContentY = 0;[\s\S]*spatialViewportSnapshot = null;/u,
    );
    expect(spatialSessionRefresh).toMatch(
      /desktopIds\.indexOf\(selectedDesktopId\)[\s\S]*planSpatialWorkspaceCenter\(selectedWorkspaceIndex\)[\s\S]*setSpatialContentY\(selectionPlan\.contentY, animateViewport\);/u,
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
      /onKeyboardSelectionIdChanged: \{[\s\S]*const expectedTargetId = keyboardSelectionId;[\s\S]*const animateVisual = keyboardSelectionViewportAnimateVisual;[\s\S]*keyboardSelectionViewportTarget = null;[\s\S]*Qt\.callLater\(root\.synchronizeKeyboardSelectionViewportTarget,\s*expectedTargetId, animateVisual\);/u,
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
    expect(spatialInput.match(/\bDragHandler\s*\{/gu)).toHaveLength(2);
    expect(spatialInput).toContain("target: null");
    expect(spatialInput).toContain("acceptedButtons: Qt.LeftButton");
    expect(spatialInput).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(spatialInput).not.toContain("PointerDevice.TouchScreen");
    expect(spatialInput).toContain(
      "grabPermissions: PointerHandler.TakeOverForbidden",
    );
    expect(spatialInput).toContain("xAxis.enabled: false");
    expect(spatialInput).toContain("yAxis.enabled: true");
    expect(spatialInput).toContain("id: spatialHorizontalViewportInput");
    expect(spatialInput).toContain("id: spatialHorizontalViewportDragHandler");
    expect(spatialInput).toContain("xAxis.enabled: true");
    expect(spatialInput).toContain("yAxis.enabled: false");
    expect(spatialInput).toContain(
      "return root.spatialHorizontalViewportBackdropContains(point)",
    );
    expect(spatialInput).toContain(
      "root.beginSpatialHorizontalViewportDrag(centroid.pressPosition)",
    );
    expect(spatialInput).toContain(
      "root.updateSpatialHorizontalViewportDrag(activeTranslation.x)",
    );
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
    expect(spatialInput).toContain("!spatialHorizontalRowDragHandler.active");
    expect(spatialInput).not.toContain("preventStealing");
    expect(
      spatialHorizontalRowInput.match(/\bDragHandler\s*\{/gu),
    ).toHaveLength(1);
    expect(spatialHorizontalRowInput).toContain(
      "id: spatialHorizontalRowDragHandler",
    );
    expect(spatialHorizontalRowInput).toContain(
      "acceptedButtons: Qt.RightButton",
    );
    expect(spatialHorizontalRowInput).toContain(
      "acceptedDevices: PointerDevice.Mouse",
    );
    expect(spatialHorizontalRowInput).toContain(
      "root.beginSpatialHorizontalViewportDrag(centroid.pressPosition, true)",
    );
    expect(spatialHorizontalRowInput).toContain(
      "root.updateSpatialHorizontalViewportDrag(activeTranslation.x)",
    );
    expect(spatialHorizontalRowInput).toContain(
      "root.clearSpatialHorizontalViewportDrag()",
    );
    expect(spatialLayout).toContain("point.x < cardX");
    expect(spatialLayout).toContain("point.x >= cardX + cardWidth");
    expect(spatialLayout).toContain(
      "return relativeY - workspaceIndex * stride >= cardHeight",
    );
    expect(spatialLayout).toMatch(
      /function spatialHorizontalViewportBackdropContains[\s\S]*spatialWorkspaceIndexAtPoint\(point\)[\s\S]*card\.mapFromItem\(root, point\.x, point\.y\)[\s\S]*card\.viewportPointHitsWindow\(\{ x: viewportX, y: viewportY \}\)/u,
    );
    expect(spatialLayout).toMatch(
      /function beginSpatialHorizontalViewportDrag\(point, includeWindows = false\)[\s\S]*includeWindows === true[\s\S]*spatialHorizontalViewportRowContains\(point\)[\s\S]*includeWindows === false && spatialHorizontalViewportBackdropContains\(point\)[\s\S]*spatialWheelPresentationIsExact\(\)[\s\S]*resetOverviewWheelState\(\);[\s\S]*panOutputId = outputId;[\s\S]*panStartViewportOffset = viewportOffset[\s\S]*panWorkspaceIndex = workspaceIndex/u,
    );
    expect(spatialLayout).toMatch(
      /function spatialHorizontalViewportDragContext[\s\S]*spatialWheelPresentationIsExact\(\)[\s\S]*outputId !== expectedOutputId[\s\S]*expectedOutputId,/u,
    );
    expect(spatialLayout).toMatch(
      /runtime\.planOverviewSpatialHorizontalDrag\(\{[\s\S]*maximumViewportOffset: context\.bounds\.maximum,[\s\S]*minimumViewportOffset: context\.bounds\.minimum,[\s\S]*projectionScale: context\.projectionScale,[\s\S]*startViewportOffset: context\.startViewportOffset,[\s\S]*translationX/u,
    );
    expect(spatialLayout).toMatch(
      /setSpatialHorizontalViewportOffsetForBounds\(context\.workspaceIndex,[\s\S]*plan\.viewportOffset, context\.bounds\)[\s\S]*context\.workspaceIndex === currentWorkspaceIndex[\s\S]*detachSpatialLiveCameraForManualOffset[\s\S]*panGeometryEpoch = spatialHorizontalViewportRevision;[\s\S]*panLastViewportOffset = plan\.viewportOffset;/u,
    );
    expect(spatialLayout).toMatch(
      /const rollbackSucceeded = rollbackBounds[\s\S]*context\.lastViewportOffset, rollbackBounds\)[\s\S]*clearSpatialHorizontalViewportDrag\(\);[\s\S]*if \(!rollbackSucceeded && !refreshSpatialHorizontalViewports\(false\)\) \{\s*refreshOverviewSpatialSession\(true\);/u,
    );
    expect(spatialLayout).toMatch(
      /function spatialHorizontalViewportDragPlanIsValid[\s\S]*const expectedViewportOffset = Math\.min\(context\.bounds\.maximum,[\s\S]*context\.startViewportOffset[\s\S]*- translationX \/ context\.projectionScale[\s\S]*Object\.is\(expectedViewportOffset, -0\)[\s\S]*plan\.viewportOffset === normalizedExpectedViewportOffset;/u,
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
      /resetOverviewSession\(\);\s*if \(sceneEffect && typeof sceneEffect\.deactivateImmediately === "function"\) \{\s*sceneEffect\.deactivateImmediately\(\);/u,
    );

    expect(scene.match(/\bTimer\s*\{/gu)).toHaveLength(2);
    expect(spatialEdgePanTimer).toContain("interval: 16");
    expect(spatialEdgePanTimer).toContain("repeat: true");
    expect(spatialEdgePanTimer).toContain("running: false");
    expect(spatialEdgePanTimer).toContain("triggeredOnStart: false");
    expect(spatialEdgePanTimer).toMatch(
      /onTriggered: \{\s*root\.advanceSpatialEdgePan\(interval\);\s*root\.refreshSpatialEdgePanTimer\(\);\s*\}/u,
    );
    expect(spatialEdgePanTimer).not.toMatch(
      /running:\s*root\.spatialEdgePanCanRun\(\)/u,
    );
    expect(spatialEdgePan).toMatch(
      /function refreshSpatialEdgePanTimer\(\) \{[\s\S]*spatialEdgePanCanRun\(\)[\s\S]*spatialEdgePanTimer\.start\(\);[\s\S]*spatialEdgePanTimer\.stop\(\);[\s\S]*\}/u,
    );
    expect(spatialEdgePan).toMatch(
      /function storeSpatialEdgePanScenePoint[\s\S]*spatialEdgePanPointerY = point\.y;\s*refreshSpatialEdgePanTimer\(\);\s*return true;/u,
    );
    expect(spatialEdgePan).toMatch(
      /function clearSpatialEdgePanScenePoint\(\) \{\s*spatialEdgePanTimer\.stop\(\);[\s\S]*spatialEdgePanPointerY = Number\.NaN;\s*\}/u,
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
    expect(spatialEdgePan).toContain("spatialEdgePanPointerX = point.x");
    expect(spatialEdgePan).toContain(
      "spatialWindowDragSourceWorkspaceIndex = workspaceIndex",
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
      /function spatialHorizontalEdgePanContext[\s\S]*workspaceIndex >= desktopIds\.length[\s\S]*spatialDirectDragSourceIsExact\(spatialDirectDragSource, expectedDesktopId\)[\s\S]*card\.mapToItem\(root, card\.contentLeft, card\.contentTop\)[\s\S]*spatialHorizontalViewportOffsetForBounds/u,
    );
    expect(spatialEdgePan).toMatch(
      /function spatialHorizontalEdgePanCanRun[\s\S]*context\.pointerX < context\.viewportLeft \+ edgeZone[\s\S]*context\.viewportOffset > context\.bounds\.minimum[\s\S]*context\.pointerX > viewportRight - edgeZone[\s\S]*context\.viewportOffset < context\.bounds\.maximum/u,
    );
    expect(spatialEdgePan).toMatch(
      /runtime\.planOverviewSpatialEdgePan\(\{[\s\S]*sceneHeight: height,[\s\S]*contentHeight: overviewSpatialLayout\.contentHeight,[\s\S]*contentY: spatialContentY,[\s\S]*pointerY: spatialEdgePanPointerY,[\s\S]*elapsedMilliseconds/u,
    );
    expect(spatialEdgePan).toContain(
      "spatialEdgePanPlanIsValid(plan, elapsedMilliseconds)",
    );
    expect(spatialEdgePan).toMatch(
      /function advanceSpatialEdgePan[\s\S]*advanceSpatialVerticalEdgePan\(elapsedMilliseconds\)[\s\S]*advanceSpatialHorizontalEdgePan\(elapsedMilliseconds\)[\s\S]*verticalAdvanced \|\| horizontalAdvanced/u,
    );
    expect(spatialEdgePan).toMatch(
      /runtime\.planOverviewSpatialHorizontalEdgePan\(\{[\s\S]*maximumViewportOffset: context\.bounds\.maximum,[\s\S]*minimumViewportOffset: context\.bounds\.minimum,[\s\S]*pointerX: context\.pointerX,[\s\S]*projectionScale: context\.projectionScale,[\s\S]*viewportLeft: context\.viewportLeft,[\s\S]*viewportOffset: context\.viewportOffset,[\s\S]*viewportWidth: context\.viewportWidth/u,
    );
    expect(spatialEdgePan).toMatch(
      /setSpatialHorizontalViewportOffsetForBounds\(context\.workspaceIndex,[\s\S]*plan\.viewportOffset, context\.bounds\)[\s\S]*context\.workspaceIndex === currentWorkspaceIndex[\s\S]*detachSpatialLiveCameraForManualOffset\(context\.workspaceIndex, context\.expectedDesktopId,[\s\S]*context\.viewportOffset, plan\.viewportOffset\)/u,
    );
    expect(spatialEdgePan).toMatch(
      /function spatialHorizontalEdgePanPlanIsValid[\s\S]*plan\.viewportOffset < context\.bounds\.minimum[\s\S]*plan\.viewportOffset > context\.bounds\.maximum[\s\S]*plan\.direction === "left" && delta < 0[\s\S]*plan\.direction === "right" && delta > 0/u,
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
    expect(`${sceneWithoutWorkspaceManagement}\n${desktopCard}`).not.toMatch(
      /\bMouseArea\s*\{|KWin\.Workspace\.(?:stackingOrder|windows)\b|\.setValue\s*\(/u,
    );
  });

  it("routes full-surface touchscreen pans through one latched spatial axis", () => {
    const touchInput = scene.slice(
      scene.indexOf("id: spatialTouchPanInput"),
      scene.indexOf("id: spatialViewportInput"),
    );
    const touchLogic = scene.slice(
      scene.indexOf("function spatialTouchPanContains("),
      scene.indexOf("function spatialViewportBackdropContains("),
    );
    const touchBegin = touchLogic.slice(
      touchLogic.indexOf("function beginSpatialTouchPan("),
      touchLogic.indexOf("function updateSpatialTouchPan("),
    );
    const touchUpdate = touchLogic.slice(
      touchLogic.indexOf("function updateSpatialTouchPan("),
      touchLogic.indexOf("function spatialTouchPanContextIsExact("),
    );
    const backdropInputs = scene.slice(
      scene.indexOf("id: spatialViewportInput"),
      scene.indexOf("id: spatialCanvas"),
    );
    const rowInput = scene.slice(
      scene.indexOf("id: spatialHorizontalRowInput"),
      scene.indexOf("KeyboardHelpHint {"),
    );
    const thumbnailTouchId = desktopCard.indexOf(
      "id: thumbnailTouchDragHandler",
    );
    const thumbnailTouch = desktopCard.slice(
      desktopCard.lastIndexOf("DragHandler {", thumbnailTouchId),
      desktopCard.indexOf(
        "\n                    DragHandler {",
        thumbnailTouchId,
      ),
    );
    const sessionRefresh = scene.slice(
      scene.indexOf("function refreshOverviewSpatialSession("),
      scene.indexOf("function currentSpatialViewportGeometry("),
    );

    expect(overviewRuntimeIndex).toContain("planOverviewTouchPanAxis");
    expect(touchInput.match(/\bDragHandler\s*\{/gu)).toHaveLength(1);
    expect(touchInput).toContain("anchors.fill: parent");
    expect(touchInput).toContain("z: 18000");
    expect(touchInput).toContain("containmentMask: QtObject {");
    expect(touchInput).toContain("return root.spatialTouchPanContains(point)");
    expect(touchInput).toContain("target: null");
    expect(touchInput).toContain("acceptedButtons: Qt.NoButton");
    expect(touchInput).toContain("acceptedDevices: PointerDevice.TouchScreen");
    expect(touchInput).toContain("acceptedModifiers: Qt.NoModifier");
    expect(touchInput).toContain("minimumPointCount: 1");
    expect(touchInput).toContain("maximumPointCount: 1");
    expect(touchInput).toContain(
      "PointerHandler.CanTakeOverFromHandlersOfDifferentType",
    );
    expect(touchInput).toContain("PointerHandler.CanTakeOverFromItems");
    expect(touchInput).toContain(
      "PointerHandler.ApprovesTakeOverByHandlersOfSameType",
    );
    expect(touchInput).toContain("PointerHandler.ApprovesCancellation");
    expect(touchInput).not.toContain(
      "PointerHandler.CanTakeOverFromHandlersOfSameType",
    );
    expect(touchInput).toContain(
      "PointerHandler.ApprovesTakeOverByHandlersOfDifferentType",
    );
    expect(touchInput).not.toContain("PointerHandler.ApprovesTakeOverByItems");
    expect(touchInput).toMatch(
      /beginSpatialTouchPan\(centroid\.pressPosition,[\s\S]*centroid\.position\.x - centroid\.pressPosition\.x,[\s\S]*centroid\.position\.y - centroid\.pressPosition\.y/u,
    );
    expect(touchInput).toMatch(
      /onCentroidChanged:[\s\S]*updateSpatialTouchPan\(centroid\.position\.x - centroid\.pressPosition\.x,[\s\S]*centroid\.position\.y - centroid\.pressPosition\.y/u,
    );
    expect(touchInput).not.toContain("activeTranslation");
    expect(touchInput).toMatch(
      /onGrabChanged:[\s\S]*PointerDevice\.CancelGrabExclusive[\s\S]*PointerDevice\.CancelGrabPassive[\s\S]*root\.clearSpatialTouchPan\(\)/u,
    );

    expect(backdropInputs.match(/\bDragHandler\s*\{/gu)).toHaveLength(2);
    expect(backdropInputs).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(backdropInputs).not.toContain("PointerDevice.TouchScreen");
    expect(backdropInputs).toContain("!spatialTouchPanDragHandler.active");
    expect(rowInput).toContain("!spatialTouchPanDragHandler.active");

    expect(touchLogic).toMatch(
      /function spatialTouchPanContains[\s\S]*point\.x < 0[\s\S]*point\.x >= width[\s\S]*spatialViewportOverlayContainsPoint\(keyboardHelpHint, point\)[\s\S]*spatialViewportOverlayContainsPoint\(searchOverlay, point\)[\s\S]*spatialViewportOverlayContainsPoint\(outputIdentityLoader, point\)/u,
    );
    expect(touchLogic).toMatch(
      /const verticalAvailable = overviewSpatialLayout\.contentHeight > height;\s*return verticalAvailable \|\| spatialHorizontalViewportRowContains\(point\);/u,
    );
    expect(touchBegin).toContain(
      "const horizontalCandidate = spatialHorizontalViewportRowContains(point)",
    );
    expect(touchBegin).toContain(
      "const verticalCandidate = overviewSpatialLayout.contentHeight > height",
    );
    expect(touchBegin).toContain('spatialTouchPanInput.panAxis = "pending"');
    expect(touchBegin).toContain("spatialTouchPanInput.panPressX = point.x");
    expect(touchBegin).toContain("spatialTouchPanInput.panPressY = point.y");
    expect(touchBegin).toContain("spatialTouchPanInput.panOutputId = outputId");
    expect(touchBegin).toContain(
      "spatialTouchPanInput.panSceneHeight = height",
    );
    expect(touchBegin).toMatch(
      /beginSpatialHorizontalViewportDrag\([\s\S]*panPressX[\s\S]*panPressY[\s\S]*true\)/u,
    );
    expect(touchBegin).not.toContain("adoptSpatialVisualContentY()");
    expect(touchUpdate).toMatch(
      /runtime\.planOverviewTouchPanAxis\(\{[\s\S]*axis,[\s\S]*horizontalAvailable:[\s\S]*translationX,[\s\S]*translationY,[\s\S]*verticalAvailable:/u,
    );
    expect(touchUpdate).toMatch(
      /axis === "pending" && plan\.axis === "pending"[\s\S]*return true;/u,
    );
    expect(touchUpdate).toMatch(
      /plan\.axis === "horizontal"[\s\S]*updateSpatialHorizontalViewportDrag\(translationX\)[\s\S]*panAxis = "horizontal"[\s\S]*panVerticalAvailable = false;/u,
    );
    expect(touchUpdate).toMatch(
      /plan\.axis === "vertical"[\s\S]*axis === "pending"[\s\S]*adoptSpatialVisualContentY\(\)[\s\S]*panStartContentY = spatialContentY[\s\S]*clearSpatialHorizontalViewportDrag\(\)[\s\S]*planSpatialViewport\([\s\S]*panStartContentY - translationY[\s\S]*setSpatialContentY\(viewportPlan\.contentY\)[\s\S]*panLastContentY = spatialContentY/u,
    );
    expect(touchLogic).toMatch(
      /function spatialTouchPanContextIsExact[\s\S]*centroid\.pressPosition[\s\S]*pressPosition\.x !== spatialTouchPanInput\.panPressX[\s\S]*pressPosition\.y !== spatialTouchPanInput\.panPressY[\s\S]*spatialHorizontalViewportDragContext\(\) === null/u,
    );
    expect(touchLogic).toMatch(
      /function spatialTouchPanVerticalContextIsExact[\s\S]*layout === overviewSpatialLayout[\s\S]*panOutputId === outputId[\s\S]*panSceneHeight === height[\s\S]*spatialContentY === spatialTouchPanInput\.panLastContentY/u,
    );
    expect(touchLogic).toMatch(
      /function blockSpatialTouchPan[\s\S]*panAxis = "blocked"[\s\S]*clearSpatialHorizontalViewportDrag\(\);[\s\S]*function clearSpatialTouchPan[\s\S]*panPressX = Number\.NaN[\s\S]*panPressY = Number\.NaN/u,
    );
    expect(sessionRefresh).toContain("clearSpatialTouchPan();");
    expect(scene).toMatch(
      /function handleSpatialPresentationPhaseChanged[\s\S]*spatialPresentationPhase === "closing"[\s\S]*clearSpatialTouchPan\(\);/u,
    );
    expect(scene).toMatch(
      /function resetOverviewSession\(\)[\s\S]*clearSpatialTouchPan\(\);/u,
    );
    expect(scene).toMatch(
      /function beginDesktopReorder[\s\S]*spatialTouchPanDragHandler\.active/u,
    );
    expect(scene).toMatch(
      /function handleOverviewWheel[\s\S]*spatialTouchPanDragHandler\.active[\s\S]*event\.accepted = true;/u,
    );
    expect(desktopCard).not.toContain("spatialTouchPanActive");
    expect(thumbnailTouch).toContain(
      "PointerHandler.CanTakeOverFromHandlersOfSameType",
    );
    expect(thumbnailTouch).toContain(
      "PointerHandler.CanTakeOverFromHandlersOfDifferentType",
    );
    expect(thumbnailTouch).toContain("PointerHandler.CanTakeOverFromItems");
    expect(thumbnailTouch).toContain(
      "PointerHandler.ApprovesTakeOverByAnything",
    );
    expect(`${touchInput}\n${touchLogic}`).not.toMatch(
      /org\.kde\.kwin\.private|\b(?:Animation|Behavior|MouseArea|TapHandler|Timer|WheelHandler)\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
    );
  });

  it("projects exact minimized windows as fail-closed compact placeholders", () => {
    const presentation = desktopCard.slice(
      desktopCard.indexOf("id: windowPresentation"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const minimizedActivationBinding = presentation.slice(
      presentation.indexOf(
        "readonly property bool minimizedActivationEligible:",
      ),
      presentation.indexOf("readonly property var minimizedPlaceholderFrame:"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
    );
    const planner = desktopCard.slice(
      desktopCard.indexOf("function planMinimizedPlaceholderFrame("),
      desktopCard.indexOf("function boundedWindowCaption("),
    );
    const placeholderTapDevice = placeholder.indexOf(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    const placeholderTapStart = placeholder.lastIndexOf(
      "TapHandler {",
      placeholderTapDevice,
    );
    const placeholderTap = placeholder.slice(
      placeholderTapStart,
      placeholder.indexOf(
        "\n                    TapHandler {",
        placeholderTapDevice,
      ),
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
    expect(presentation).toMatch(
      /readonly property bool minimizedActivationEligible: minimizedWindow\s*&& selectedThumbnail && matchesSearch && frame !== null/u,
    );
    expect(minimizedActivationBinding).not.toContain(
      "windowSnapshotCanActivateMinimizedWindow",
    );
    expect(minimizedActivationBinding).not.toContain("windowCanNavigate");
    expect(presentation).toContain(
      "readonly property var minimizedPlaceholderFrame: minimizedActivationEligible",
    );
    expect(presentation).toContain("card.planMinimizedPlaceholderFrame(frame)");
    expect(presentation).toContain(
      "readonly property var minimizedPlaceholderTarget: minimizedPlaceholderShell",
    );
    expect(presentation).toMatch(
      /readonly property string primaryVisualKind:[\s\S]*"thumbnail"[\s\S]*"placeholder"[\s\S]*"tab"/u,
    );
    expect(presentation).toMatch(
      /onMinimizedPlaceholderFrameChanged: \{\s*card\.navigationTargetsChanged\(\);\s*card\.schedulePresentationMotion\(\);\s*\}/u,
    );

    expect(planner).toContain(
      "!frame || !viewport || viewport.width <= 0 || viewport.height <= 0",
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
      'readonly property bool activationEligible: windowPresentation.primaryVisualKind === "placeholder"',
    );
    expect(placeholder).toContain(
      "&& windowPresentation.minimizedActivationEligible",
    );
    expect(placeholder).toContain(
      "readonly property bool keyboardTarget: visible && activationEligible",
    );
    expect(placeholder).toContain(
      "card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)",
    );
    expect(placeholder).toContain(
      "visible: visualFrame !== null && visualOpacity > 0.0001 && model.window",
    );
    expect(placeholder).toContain(
      'windowPresentation.primaryVisualKind === "placeholder"',
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
    expect(placeholderTap).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    expect(placeholderTap).toContain("gesturePolicy: TapHandler.DragThreshold");
    expect(placeholderTap).toContain("&& card.desktop && card.screen");
    expect(placeholderTap).toMatch(
      /onTapped: point => \{\s*if \(card\.closeButtonContainsPoint\(minimizedPlaceholderCloseButton,\s*minimizedPlaceholderShell, point\.position\)\s*\|\| !minimizedPlaceholderShell\.activationIsExact\(\)\) \{\s*return;\s*\}\s*card\.windowTapped\(model\.window, windowPresentation\.windowId, card\.desktop,\s*card\.desktopId, card\.screen\);/u,
    );
    expect(placeholder).toMatch(
      /function activationIsExact\(\) \{[\s\S]*minimizedPlaceholderShell\.visible[\s\S]*windowPresentation\.minimizedWindow[\s\S]*windowPresentation\.matchesSearch[\s\S]*card\.windowSnapshotCanActivateMinimizedWindow\(windowPresentation\);[\s\S]*\}/u,
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
    expect(placeholderTap).not.toMatch(
      /desktopTapped|windowCloseRequested|org\.kde\.kwin\.private|\b(?:DragHandler|MouseArea|Timer)\s*\{|setInterval|setTimeout|\.setValue\s*\(|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)/u,
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
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
    );
    const thumbnailFooterStart = thumbnail.indexOf("id: thumbnailLabelFooter");
    const thumbnailFooter = thumbnail.slice(
      thumbnailFooterStart,
      thumbnail.indexOf(
        "border.width: thumbnailShell.keyboardSelected ? 2 : 0",
        thumbnailFooterStart,
      ),
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
    const labelUi = `${thumbnailFooter}\n${placeholderLabel}`;

    expect(overviewRuntimeIndex).toContain(
      'export { planOverviewWindowLabel } from "./window-label";',
    );
    expect(presentation).toMatch(
      /readonly property var windowLabel: card\.planWindowLabel\(candidate, matchesSearch && model\.window[\s\S]*!minimizedWindow && selectedThumbnail[\s\S]*\|\| \(minimizedPlaceholderFrame !== null/u,
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

    expect(placeholderLabel).toContain(
      '? `Minimized · ${windowPresentation.windowLabel.primary}` : "Minimized"',
    );
    for (const label of [thumbnailFooter, placeholderLabel]) {
      expect(label).toContain("elide: Text.ElideRight");
      expect(label).toContain("textFormat: Text.PlainText");
    }

    expect(thumbnailFooter).toContain(
      "anchors.bottomMargin: windowPresentation.attentionRequested ? 8 : 5",
    );
    expect(placeholderLabel).toContain(
      "anchors.rightMargin: minimizedPlaceholderCloseButton.visible",
    );
    expect(placeholderLabel).toContain(
      ": (windowPresentation.attentionRequested",
    );
    expect(thumbnail).toMatch(
      /anchors\.bottom: parent\.bottom\s*height: 3\s*visible: windowPresentation\.attentionRequested\s*color: "#e2556f"/u,
    );
    expect(thumbnail).not.toContain("id: thumbnailAttentionBadge");
    for (const [visual, attentionBadge, keyboardBorder] of [
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

  it("presents bounded desktop names as spatial overlays", () => {
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
    expect(desktopCard).toContain("readonly property real contentLeft: 0");
    expect(desktopCard).toContain("readonly property real contentTop: 0");
    expect(desktopCard).toContain(
      "readonly property real contentWidth: Math.max(1, width)",
    );
    expect(desktopCard).toContain(
      "readonly property real contentHeight: Math.max(1, height)",
    );
    expect(numberGutter).toContain("width: 36");
    expect(numberGutter).toContain("height: 36");
    expect(numberGutter).toContain("z: 9500");
    expect(desktopNameGutter).toContain(
      "x: Math.max(numberGutter.x + numberGutter.width + 8,",
    );
    expect(desktopNameGutter).toContain(
      "width: Math.max(0, Math.min(220, card.width - x - 8))",
    );
    expect(desktopNameGutter).toContain(
      "visible: card.desktopNamePresented && width >= 48",
    );
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
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
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
      /id: tabApplicationIcon[\s\S]*width: Math\.max\(10, Math\.min\(14, tabShell\.height - 6\)\)\s*height: width[\s\S]*candidate: windowPresentation\.candidate[\s\S]*presentationEligible: card\.showApplicationIcons && tabShell\.visible\s*&& tabShell\.width >= 72 && tabShell\.height >= 20/u,
    );
    expect(tab).toContain(
      "tabApplicationIcon.x + tabApplicationIcon.width + 4",
    );

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
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
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
    const tab = desktopCard.slice(
      desktopCard.indexOf("id: tabShell"),
      desktopCard.indexOf("id: thumbnailShell"),
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
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
    expect(boundaryNavigation).toContain(
      "setSpatialContentY(plan.contentY, true)",
    );
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
    expect(navigation).toContain("let currentDesktopMarker = null");
    expect(navigation).toMatch(
      /target\.kind === "desktop" && target\.desktopId === activeDesktopId\s*&& \(!currentDesktopMarker \|\| navigationTargetPrecedes\(target, currentDesktopMarker\)\)/u,
    );
    expect(navigation).toContain(
      "return firstActive || firstCurrentDesktop || currentDesktopMarker || firstVisual",
    );
    expect(navigation).toContain(
      "navigationTargetPrecedes(target, firstVisual)",
    );

    expect(desktopCard).toContain("id: windowRepeater");
    expect(cardTargets).toContain("windowRepeater.itemAt(index)");
    expect(cardTargets).toContain(
      "!presentation.matchesSearch || !windowCanNavigate(presentation)",
    );
    expect(cardTargets).toContain(
      "const visual = navigationVisualForPresentation(presentation);",
    );
    expect(cardTargets).toContain("presentation.minimizedPlaceholderTarget");
    expect(cardTargets).toContain("presentation.thumbnailTarget");
    expect(cardTargets).toContain("presentation.tabTarget");
    expect(cardTargets).toContain(
      "visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)",
    );
    expect(cardTargets).toContain(
      "visualContainsViewportPoint(presentation.tabTarget, point)",
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

    expect(thumbnail).toContain(
      "readonly property bool keyboardTarget: visible",
    );
    expect(thumbnail).toContain("windowPresentation.selectedThumbnail");
    expect(thumbnail).toContain(
      'windowPresentation.primaryVisualKind === "thumbnail"',
    );
    expect(thumbnail).toContain(
      "visible: visualFrame !== null && visualOpacity > 0.0001 && model.window",
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
    for (const visual of [thumbnail, placeholder, tab]) {
      expect(visual).toContain(
        "card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)",
      );
      expect(visual).not.toContain("isSelectedNavigationTarget");
    }
    expect(desktopCard).not.toContain("function isSelectedNavigationTarget(");
    expect(placeholder).toContain(
      "border.width: minimizedPlaceholderShell.keyboardSelected ? 3 : 0",
    );
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
          `on${signal}: \\{\\s*card\\.navigationTargetsChanged\\(\\);\\s*card\\.attentionRevision \\+= 1;\\s*card\\.spatialLiveGeometryRevision \\+= 1;\\s*card\\.scheduleColumnDragEligibilityRefresh\\(\\);\\s*card\\.schedulePresentationMotion\\(\\);\\s*\\}`,
          "u",
        ),
      );
    }
    expect(windowPresentation).toContain(
      "readonly property bool attentionRequested: card.windowDemandsAttention(candidate)",
    );
    expect(windowPresentation).toMatch(
      /onCandidateChanged: \{\s*card\.advanceWindowDragSourceRevision\(windowPresentation\);\s*card\.schedulePresentationMotion\(\);\s*card\.cancelInvalidWindowSpatialDragSource\(windowPresentation\);\s*refreshActionSnapshot\(\);\s*card\.attentionRevision \+= 1;\s*\}/u,
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
      "border.width: KWin.Workspace.activeWindow === model.window ? 2 : 0",
    );
    expect(thumbnail).toContain('border.color: "#f4f8ff"');
    expect(thumbnail).toContain(
      "border.width: thumbnailShell.keyboardSelected ? 2 : 0",
    );
    expect(thumbnail).toContain('border.color: "#86aee8"');
    expect(thumbnail).not.toContain("#71839e");
    expect(thumbnail).not.toContain("id: thumbnailAttentionBadge");
    expect(
      `${attentionProjection}\n${numberGutter}\n${thumbnail}\n${placeholder}`,
    ).not.toMatch(/\b(?:Timer|Behavior|Animation)\s*\{/u);
    expect(attentionProjection).not.toMatch(
      /windowTapped|windowCloseRequested|closeWindow|activeWindow\s*=|\.setValue\s*\(|Settings/u,
    );
    expect(`${sceneWithoutWorkspaceManagement}\n${desktopCard}`).not.toMatch(
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
    const wheelWorkspaceSchedule = scene.slice(
      scene.indexOf("function requestSpatialWheelWorkspace("),
      scene.indexOf("function completeSpatialWheelWorkspaceSelection("),
    );
    const wheelWorkspaceCompletion = scene.slice(
      scene.indexOf("function completeSpatialWheelWorkspaceSelection("),
      scene.indexOf("function deferredSpatialWheelWorkspaceRequest("),
    );
    const horizontalSelectionHandler = scene.slice(
      scene.indexOf("function handleSpatialHorizontalSelectionWheel("),
      scene.indexOf("function planSpatialHorizontalWheel("),
    );
    const horizontalSelectionRequest = scene.slice(
      scene.indexOf("function requestSpatialHorizontalWheelSelection("),
      scene.indexOf("function horizontalWheelSelectionTargetPlan("),
    );
    const horizontalSelectionTarget = scene.slice(
      scene.indexOf("function horizontalWheelSelectionTargetPlan("),
      scene.indexOf("function completeSpatialHorizontalWheelSelection("),
    );
    const horizontalSelectionCompletion = scene.slice(
      scene.indexOf("function completeSpatialHorizontalWheelSelection("),
      scene.indexOf("function horizontalWheelSelectionRequestContextIsExact("),
    );
    const horizontalSelectionGuard = scene.slice(
      scene.indexOf("function horizontalWheelSelectionRequestContextIsExact("),
      scene.indexOf("function horizontalBoundaryNavigationTarget("),
    );
    const horizontalSelectionFailure = scene.slice(
      scene.indexOf("function finishFailedSpatialHorizontalWheelSelection("),
      scene.indexOf("function horizontalWheelScalarIdIsValid("),
    );
    const preciseWorkspaceSettleSchedule = scene.slice(
      scene.indexOf("function finishSpatialVerticalWheelGesture("),
      scene.indexOf("function completeSpatialVerticalWheelSettle("),
    );
    const horizontalViewportRefresh = scene.slice(
      scene.indexOf("function refreshSpatialHorizontalViewports("),
      scene.indexOf("function spatialHorizontalViewportBounds("),
    );
    const horizontalViewportBounds = scene.slice(
      scene.indexOf("function spatialHorizontalViewportBounds("),
      scene.indexOf("function spatialHorizontalViewportOffsetAt("),
    );
    const presentationViewportOffset = scene.slice(
      scene.indexOf("function spatialPresentationViewportOffsetAt("),
      scene.indexOf("function spatialHorizontalViewportOffsetForBounds("),
    );
    const liveCamera = scene.slice(
      scene.indexOf("function resolveSpatialLiveCamera("),
      scene.indexOf("function resetSpatialViewport("),
    );
    const liveCameraResolve = scene.slice(
      scene.indexOf("function resolveSpatialLiveCamera("),
      scene.indexOf("function createSpatialLiveCameraAttachment("),
    );
    const liveCameraAttachment = scene.slice(
      scene.indexOf("function spatialLiveCameraAttachmentContextIsExact("),
      scene.indexOf("function applySpatialLiveCamera("),
    );
    const liveCameraHotPath = scene.slice(
      scene.indexOf("function applySpatialLiveCamera("),
      scene.indexOf("function refreshSpatialLiveCameraReturnOffset("),
    );
    const liveCameraReturn = scene.slice(
      scene.indexOf("function refreshSpatialLiveCameraReturnOffset("),
      scene.indexOf("function spatialLiveCameraPlanIsValid("),
    );
    const liveCameraRefresh = scene.slice(
      scene.indexOf("function scheduleSpatialLiveCameraRefresh("),
      scene.indexOf("function resetSpatialLiveCameraSession("),
    );
    const liveCameraConnections = scene.slice(
      scene.indexOf("target: root.spatialLiveCameraWindow"),
      scene.indexOf("target: root.spatialLiveCameraProbeWindow"),
    );
    const liveCameraProbeConnections = scene.slice(
      scene.indexOf("target: root.spatialLiveCameraProbeWindow"),
      scene.indexOf("target: root.targetScreen"),
    );
    const liveColumnFrames = desktopCard.slice(
      desktopCard.indexOf("function buildSpatialLiveColumnFrames("),
      desktopCard.indexOf("function spatialLiveColumnPlanIsExact("),
    );
    const liveColumnPlan = desktopCard.slice(
      desktopCard.indexOf("function spatialLiveColumnPlan("),
      desktopCard.indexOf("function buildSpatialLiveColumnFrames("),
    );
    const liveColumnValidation = desktopCard.slice(
      desktopCard.indexOf("function spatialLiveColumnPlanIsExact("),
      desktopCard.indexOf("function widthForColumn("),
    );
    const columnGuides = desktopCard.slice(
      desktopCard.indexOf("id: columnShell"),
      desktopCard.indexOf("id: emptyContentInput"),
    );

    expect(scene).toContain("property real overviewWheelPixelRemainder: 0");
    expect(scene).toContain("property int overviewWheelRemainder: 0");
    expect(scene).toContain(
      "property bool overviewVerticalWheelSettlePending: false",
    );
    expect(scene).toContain(
      "property int overviewVerticalWheelSettleRequestId: 0",
    );
    expect(scene).toContain(
      "property int overviewVerticalWheelWorkspaceRequestId: 0",
    );
    expect(scene).toContain(
      'property string overviewVerticalWheelWorkspaceDesktopId: ""',
    );
    expect(scene).toContain(
      "property int overviewVerticalWheelWorkspaceTargetIndex: -1",
    );
    expect(scene).toContain(
      "property real overviewHorizontalWheelPixelRemainder: 0",
    );
    expect(scene).toContain("property int overviewHorizontalWheelRemainder: 0");
    expect(scene).toContain("property int overviewDesktopCardEpoch: 0");
    expect(scene).toContain(
      "property bool overviewHorizontalWheelSelectionPending: false",
    );
    expect(scene).toContain(
      "property int overviewHorizontalWheelSelectionRequestId: 0",
    );
    expect(scene).toContain(
      "property int overviewHorizontalWheelSelectionStepOffset: 0",
    );
    expect(scene).toContain(
      'property string overviewHorizontalWheelSelectionTargetId: ""',
    );
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
      /runtime\.planOverviewSpatialWheelAxis\(\{[\s\S]*angleDeltaX: event\.angleDelta\.x,[\s\S]*angleDeltaY: event\.angleDelta\.y,[\s\S]*axisOwner: expectedAxisOwner,[\s\S]*pixelDeltaX: event\.pixelDelta\.x,[\s\S]*pixelDeltaY: event\.pixelDelta\.y/u,
    );
    expect(wheelRouting).toMatch(
      /spatialWheelAxisPlanIsValid\(plan, expectedAxisOwner\)[\s\S]*plan\.axis === null[\s\S]*handlerAxis !== plan\.axis/u,
    );
    expect(wheelRouting).toMatch(
      /overviewWheelAxisOwner = plan\.axisOwner;[\s\S]*if \(plan\.axis !== plan\.axisOwner\) \{\s*event\.accepted = true;\s*return true;/u,
    );
    expect(wheelRouting).toMatch(
      /const handled = plan\.axis === "horizontal"[\s\S]*handleOverviewHorizontalWheel\(event, point\)[\s\S]*handleOverviewWheel\(event\)[\s\S]*if \(claimedAxis && !handled\)/u,
    );
    expect(wheelRouting).toMatch(
      /function spatialWheelAxisPlanIsValid[\s\S]*plan\.axis === null[\s\S]*plan\.inputMode === null && plan\.axisOwner === expectedAxisOwner[\s\S]*expectedAxisOwner === null \? plan\.axisOwner === plan\.axis[\s\S]*plan\.axisOwner === expectedAxisOwner/u,
    );
    expect(wheelRouting).toMatch(
      /function routeOverviewShiftHorizontalWheel[\s\S]*event\.modifiers !== Qt\.ShiftModifier[\s\S]*const pixelDeltaX = event\.pixelDelta\.y;[\s\S]*const angleDeltaX = event\.angleDelta\.y;[\s\S]*overviewWheelAxisOwner = "horizontal";[\s\S]*handleOverviewHorizontalWheelInput\(event, point, angleDeltaX, pixelDeltaX\)/u,
    );
    expect(wheelRouting).toMatch(
      /function releaseOverviewWheelAxisIfIdle[\s\S]*!spatialVerticalWheelHandler\.active && !spatialHorizontalWheelHandler\.active[\s\S]*!spatialShiftHorizontalWheelHandler\.active[\s\S]*overviewWheelAxisOwner === "vertical"[\s\S]*finishSpatialVerticalWheelGesture\(\);[\s\S]*overviewWheelAxisOwner = "";/u,
    );
    expect(wheelNavigation).toContain("event.modifiers !== Qt.NoModifier");
    expect(wheelNavigation).toContain("keyboardHelpVisible");
    expect(wheelNavigation).toMatch(
      /runtime\.normalizeOverviewPhysicalWheelAngleDelta\(\s*event\.angleDelta\.y, event\.inverted === true\);[\s\S]*Number\.isSafeInteger\(angleDeltaY\)/u,
    );
    expect(scene).toMatch(
      /onKeyboardHelpVisibleChanged: \{[\s\S]*root\.cancelSpatialZoomTransaction\(\);[\s\S]*root\.resetOverviewWheelState\(\);\s*root\.resetWindowWorkspaceHover\(\);\s*\}/u,
    );
    expect(scene).toMatch(
      /onSpatialContentYChanged: \{[\s\S]*if \(!spatialVisualContentYDeferred\)[\s\S]*spatialVerticalCameraAnimation\.stop\(\);[\s\S]*spatialVisualContentY = spatialContentY;[\s\S]*root\.resetOverviewWheelState\(\);\s*root\.captureSpatialViewportSnapshot\(\);/u,
    );
    expect(scene).toMatch(
      /function adoptSpatialVisualContentY\(\)[\s\S]*planSpatialViewport\(spatialVisualContentY\)[\s\S]*spatialVerticalCameraAnimation\.stop\(\);[\s\S]*spatialContentY = plan\.contentY;[\s\S]*spatialVisualContentY = plan\.contentY;/u,
    );
    expect(scene).toMatch(
      /id: spatialViewportDragHandler[\s\S]*root\.adoptSpatialHorizontalCameraMotionOwner\(\)[\s\S]*root\.adoptSpatialVisualContentY\(\)[\s\S]*panStartContentY = root\.spatialContentY;/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleSpatialViewportWheel[\s\S]*spatialVerticalCameraAnimation\.running && !adoptSpatialVisualContentY\(\)[\s\S]*planSpatialWheel\(angleDeltaY, pixelDeltaY\)/u,
    );
    expect(wheelNavigation).toMatch(
      /spatialTouchPanDragHandler\.active \|\| spatialViewportDragHandler\.active[\s\S]*spatialHorizontalViewportDragHandler\.active[\s\S]*spatialHorizontalRowDragHandler\.active[\s\S]*spatialDirectDragActive[\s\S]*\|\| desktopReorderActive[\s\S]*resetOverviewWheelState\(\);[\s\S]*event\.accepted = true;[\s\S]*return true;/u,
    );
    expect(
      wheelNavigation.indexOf("if (spatialTouchPanDragHandler.active"),
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
      /function handleOverviewHorizontalWheelInput[\s\S]*resetOverviewVerticalWheelState\(\);[\s\S]*handleSpatialHorizontalViewportWheel/u,
    );
    expect(horizontalSelectionHandler).toMatch(
      /plan\.steps > 0[\s\S]*requestSpatialHorizontalWheelSelection\(workspaceIndex, expectedDesktopId,[\s\S]*plan\.direction, plan\.steps\)/u,
    );
    expect(horizontalSelectionHandler).not.toMatch(
      /setKeyboardSelectionTarget|setSpatialHorizontalViewportOffset|Qt\.callLater/u,
    );
    expect(horizontalSelectionRequest).toMatch(
      /const sourceTargetId = pendingExact[\s\S]*overviewHorizontalWheelSelectionSourceTargetId : keyboardSelectionId;[\s\S]*const currentStepOffset = pendingExact[\s\S]*overviewHorizontalWheelSelectionStepOffset : 0;/u,
    );
    expect(horizontalSelectionRequest).toMatch(
      /const stepDelta = direction === "next" \? steps : -steps;[\s\S]*const requestedStepOffset = Math\.max\(-4, Math\.min\(4, currentStepOffset \+ stepDelta\)\);[\s\S]*if \(requestedStepOffset === 0\) \{[\s\S]*if \(pendingExact\) \{[\s\S]*cancelOverviewHorizontalWheelSelectionRequest\(\);/u,
    );
    expect(horizontalSelectionRequest).toMatch(
      /horizontalWheelSelectionTargetPlan\(expectedDesktopId, sourceTargetId,[\s\S]*requestedStepOffset\)[\s\S]*catch \(error\) \{[\s\S]*if \(pendingExact\) \{[\s\S]*cancelOverviewHorizontalWheelSelectionRequest\(\);[\s\S]*Math\.abs\(targetPlan\.stepOffset\) > Math\.abs\(requestedStepOffset\)[\s\S]*Math\.sign\(targetPlan\.stepOffset\) !== Math\.sign\(requestedStepOffset\)[\s\S]*if \(pendingExact\) \{[\s\S]*cancelOverviewHorizontalWheelSelectionRequest\(\);/u,
    );
    expect(horizontalSelectionRequest).toMatch(
      /if \(pendingExact\) \{[\s\S]*overviewHorizontalWheelSelectionStepOffset = targetPlan\.stepOffset;[\s\S]*overviewHorizontalWheelSelectionTargetId = targetPlan\.targetId;[\s\S]*return true;[\s\S]*overviewHorizontalWheelSelectionSourceTargetId = sourceTargetId;[\s\S]*overviewHorizontalWheelSelectionStepOffset = targetPlan\.stepOffset;[\s\S]*overviewHorizontalWheelSelectionTargetId = targetPlan\.targetId;[\s\S]*Qt\.callLater\(root\.completeSpatialHorizontalWheelSelection,[\s\S]*requestId, expectedOutputId, expectedDesktopId, workspaceIndex,[\s\S]*geometryEpoch, cardEpoch, sourceTargetId\)/u,
    );
    expect(horizontalSelectionRequest).not.toContain("startingTargetId");
    expect(
      horizontalSelectionRequest.match(/Qt\.callLater\(/gu) ?? [],
    ).toHaveLength(1);
    expect(horizontalSelectionTarget).toMatch(
      /requestedStepOffset === 0[\s\S]*Math\.abs\(requestedStepOffset\) > 4[\s\S]*rowTargets\.length >= 131072/u,
    );
    expect(horizontalSelectionTarget).toMatch(
      /const direction = requestedStepOffset > 0 \? "next" : "previous";[\s\S]*const stepSign = requestedStepOffset > 0 \? 1 : -1;[\s\S]*let remainingSteps = Math\.abs\(requestedStepOffset\);[\s\S]*let appliedSteps = 0;[\s\S]*navigationTargetForId\(rowTargets, sourceTargetId\)/u,
    );
    expect(horizontalSelectionTarget).toMatch(
      /if \(!selected\) \{[\s\S]*horizontalBoundaryNavigationTarget\(rowTargets, direction === "next" \? "first" : "last"\);[\s\S]*remainingSteps -= 1;[\s\S]*appliedSteps = 1;/u,
    );
    expect(horizontalSelectionTarget).toMatch(
      /for \(let step = 0; step < remainingSteps; step \+= 1\)[\s\S]*findOverviewNavigationTarget\(selected\.id, rowTargets, navigationDirection\)[\s\S]*if \(!target\) \{[\s\S]*break;[\s\S]*selected = target;[\s\S]*appliedSteps \+= 1;[\s\S]*stepOffset: appliedSteps \* stepSign,[\s\S]*targetId: selected\.id/u,
    );
    expect(horizontalSelectionTarget).not.toMatch(
      /setKeyboardSelectionTarget|setSpatialHorizontalViewportOffset|Qt\.callLater/u,
    );
    expect(horizontalSelectionTarget).not.toContain("return false;");
    expect(horizontalSelectionCompletion).toMatch(
      /horizontalWheelSelectionRequestContextIsExact[\s\S]*collectNavigationTargets\(\)[\s\S]*horizontalWheelSelectionRequestContextIsExact[\s\S]*clearOverviewHorizontalWheelSelectionRequest\(\);[\s\S]*setKeyboardSelectionTarget\(target, true\)/u,
    );
    expect(horizontalSelectionGuard).toMatch(
      /requestId !== overviewHorizontalWheelSelectionRequestId[\s\S]*expectedGeometryEpoch !== spatialHorizontalViewportRevision[\s\S]*expectedCardEpoch !== overviewDesktopCardEpoch[\s\S]*overviewHorizontalWheelSelectionStepOffset === 0[\s\S]*Math\.abs\(overviewHorizontalWheelSelectionStepOffset\) > 4[\s\S]*keyboardSelectionId !== expectedSourceTargetId[\s\S]*searchQuery\.length > 0[\s\S]*card\.desktopId === expectedDesktopId/u,
    );
    expect(horizontalSelectionFailure).toMatch(
      /requestId !== overviewHorizontalWheelSelectionRequestId[\s\S]*return;[\s\S]*clearOverviewHorizontalWheelSelectionRequest\(\);/u,
    );
    expect(scene).toMatch(
      /function clearOverviewHorizontalWheelSelectionRequest\(\) \{[\s\S]*overviewHorizontalWheelSelectionSourceTargetId = "";[\s\S]*overviewHorizontalWheelSelectionStepOffset = 0;[\s\S]*overviewHorizontalWheelSelectionTargetId = "";/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleOverviewHorizontalWheelInput[\s\S]*if \(pixelDeltaX !== 0\) \{[\s\S]*cancelOverviewHorizontalWheelSelectionRequest\(\);[\s\S]*spatialWorkspaceIndexAtPoint\(point\)/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewHorizontalWheelState\(\) \{[\s\S]*cancelOverviewHorizontalWheelSelectionRequest\(\);[\s\S]*overviewHorizontalWheelPixelRemainder = 0;/u,
    );
    expect(wheelNavigation).toMatch(
      /function revealHorizontalNavigationTarget[\s\S]*sceneAdjustment \/ card\.projectionScale[\s\S]*setSpatialHorizontalViewportOffset/u,
    );
    expect(scene).toContain("property var spatialHorizontalDesktopIds: []");
    expect(scene).toContain("property var spatialHorizontalGeometryPlans: []");
    expect(scene).toContain(
      "property var spatialHorizontalViewportOffsets: []",
    );
    expect(scene).toContain("property var spatialLiveCameraAttachment: null");
    expect(scene).toContain("property var spatialLiveCameraWindow: null");
    expect(scene).toContain('property string spatialLiveCameraWindowId: ""');
    expect(scene).toContain('property string spatialLiveCameraDesktopId: ""');
    expect(scene).toContain("property var spatialLiveCameraProbeWindow: null");
    expect(scene).toContain(
      "property var spatialLiveCameraDetachedWindow: null",
    );
    expect(scene).toContain(
      'property string spatialLiveCameraDetachedWindowId: ""',
    );
    expect(scene).toContain(
      'property string spatialLiveGeometryDetachedDesktopId: ""',
    );
    expect(scene).toContain(
      'property string spatialLiveGeometryDetachedOutputId: ""',
    );
    expect(scene).toContain(
      "property bool spatialLiveCameraRefreshPending: false",
    );
    expect(scene).toContain("property int spatialLiveCameraRefreshBudget: 1");
    expect(scene).toContain("property int spatialLiveCameraRefreshEpoch: 0");
    expect(scene).toMatch(
      /liveGeometryEnabled: current && !root\.spatialLiveGeometryIsManuallyDetached\([\s\S]*root\.outputId, desktopCardLoader\.modelData\)/u,
    );
    expect(scene).not.toContain(
      "liveGeometryEnabled: current && root.spatialLiveCameraDetachedWindow === null",
    );
    expect(desktopCard).toContain("required property bool liveGeometryEnabled");
    expect(desktopCard).toMatch(
      /function buildTiledPresentations[\s\S]*columnIndex,[\s\S]*memberIndex,[\s\S]*plannedColumnFrame: spatialSourceColumnFrame\(columnIndex\)/u,
    );
    expect(desktopCard).toMatch(
      /readonly property var spatialLiveFrame: card\.planSpatialLiveWindowFrame\(model\.window, windowId,[\s\S]*tiledPresentation\)[\s\S]*readonly property var frame: card\.frameForWindow\(model\.window, windowId, tiledPresentation,[\s\S]*spatialLiveFrame\)/u,
    );
    expect(desktopCard).toMatch(
      /function frameForWindow\(window, windowId, tiled, spatialLiveFrame\)[\s\S]*column\.presentation === "tabbed"[\s\S]*spatialLiveTabbedWindowFrame\(windowId, tiled, column\)[\s\S]*liveFrame !== null \? liveFrame : tiled\.thumbnailFrame[\s\S]*spatialLiveWindowPlanIsExact\(spatialLiveFrame, windowId, tiled\)[\s\S]*return spatialLiveFrame;[\s\S]*return tiled\.thumbnailFrame;/u,
    );
    expect(desktopCard).toMatch(
      /function spatialLiveTabbedWindowFrame[\s\S]*!liveGeometryEnabled \|\| !current[\s\S]*column\.presentation !== "tabbed"[\s\S]*tiled\.selected !== true[\s\S]*column\.selectedMemberIndex !== tiled\.memberIndex[\s\S]*context\.columns\[tiled\.columnIndex\] !== column[\s\S]*tiledPresentations\[windowId\] !== tiled[\s\S]*spatialLiveColumnPlan\(tiled\.columnIndex\)[\s\S]*plan\.selectedMemberIndex !== tiled\.memberIndex[\s\S]*spatialLiveWindowPlanIsExact\(frame, windowId, tiled\)/u,
    );
    expect(desktopCard).toMatch(
      /function planSpatialLiveWindowFrame[\s\S]*!liveGeometryEnabled \|\| !current[\s\S]*const expectedPresentation = column\.presentation;[\s\S]*const expectedSelectedMemberIndex = column\.selectedMemberIndex;[\s\S]*const tabbed = expectedPresentation === "tabbed"[\s\S]*tiled\.selected !== true[\s\S]*expectedSelectedMemberIndex !== memberIndex[\s\S]*const deleted = window\.deleted;[\s\S]*const minimized = window\.minimized;[\s\S]*const output = window\.output;[\s\S]*const internalId = window\.internalId;[\s\S]*deleted !== false \|\| minimized !== false \|\| output !== expectedScreen[\s\S]*const liveGeometry = window\.frameGeometry;[\s\S]*const liveX = liveGeometry \? Number\(liveGeometry\.x\)[\s\S]*const outputX = outputGeometry \? Number\(outputGeometry\.x\)[\s\S]*const confirmedLiveGeometry = window\.frameGeometry;[\s\S]*column\.presentation !== expectedPresentation[\s\S]*column\.selectedMemberIndex !== expectedSelectedMemberIndex[\s\S]*tiledPresentations\[windowId\] !== tiled[\s\S]*tiled\.selected !== true[\s\S]*window\.deleted !== false[\s\S]*window\.minimized !== false[\s\S]*window\.output !== expectedScreen[\s\S]*projectionGeometryMatches\(confirmedLiveGeometry, liveX, liveY, liveWidth, liveHeight\)/u,
    );
    expect(desktopCard).toMatch(
      /runtime\.projectOverviewSpatialLiveGeometry\(\{[\s\S]*columnIndex,[\s\S]*liveHeight,[\s\S]*liveWidth,[\s\S]*liveX,[\s\S]*liveY,[\s\S]*memberIndex,[\s\S]*outputHeight,[\s\S]*outputWidth,[\s\S]*outputX,[\s\S]*outputY,[\s\S]*projectionScale: scale,[\s\S]*viewportOriginX: originX,[\s\S]*viewportOriginY: originY,[\s\S]*windowId/u,
    );
    expect(desktopCard).toMatch(
      /function spatialLiveWindowPlanIsExact[\s\S]*plan\.windowId !== windowId[\s\S]*plan\.columnIndex !== tiled\.columnIndex[\s\S]*plan\.memberIndex !== tiled\.memberIndex[\s\S]*plan\.floating !== false[\s\S]*projectionGeometryScalarsAreValid\(plan\.x, plan\.y, plan\.width, plan\.height\)/u,
    );
    expect(desktopCard).not.toMatch(
      /projectOverviewSpatialLiveGeometry\(\{[\s\S]{0,900}\b(?:liveFrame|outputFrame|plannedColumnFrame)\b/u,
    );
    expect(desktopCard).toContain(
      "readonly property var spatialLiveColumnFrames: buildSpatialLiveColumnFrames(spatialLiveGeometryRevision)",
    );
    expect(desktopCard).toContain(
      "property int spatialLiveGeometryRevision: 0",
    );
    expect(desktopCard).toMatch(
      /readonly property var liveGeometryPlan: card\.spatialLiveColumnPlan\(index\)[\s\S]*readonly property var frame: card\.columnShellFrame\(index, liveGeometryPlan\)[\s\S]*x: frame\.x[\s\S]*width: frame\.width/u,
    );
    expect(liveColumnPlan).toMatch(
      /function spatialLiveColumnPlan\(columnIndex\)[\s\S]*columnIndex >= 0 && columnIndex < liveFrames\.length \? liveFrames\[columnIndex\] : null[\s\S]*function columnShellFrame\(columnIndex, livePlan\)[\s\S]*livePlan !== null \? livePlan : columnFrame\(columnIndex\)/u,
    );
    expect(liveColumnPlan).not.toContain("spatialLiveColumnPlanIsExact(");
    expect(columnGuides).not.toContain("columnMemberGuideFrame(");
    expect(columnGuides).not.toContain(
      "memberPresentation ? memberPresentation.thumbnailFrame : null",
    );
    expect(liveColumnPlan).not.toContain("function columnMemberGuideFrame(");
    expect(liveColumnFrames).toMatch(
      /!liveGeometryEnabled \|\| !current[\s\S]*context\.columns\.length > 512[\s\S]*windowRepeater\.count > 131072/u,
    );
    expect(liveColumnFrames).toMatch(
      /column\.members\.length < 1 \|\| column\.members\.length > 256[\s\S]*column\.presentation === "tabbed"[\s\S]*column\.selectedMemberIndex < 0[\s\S]*samples\.push\(\[\]\)/u,
    );
    expect(liveColumnFrames).toMatch(
      /for \(let index = 0; index < windowCount; index \+= 1\)[\s\S]*windowRepeater\.itemAt\(index\)[\s\S]*presentation\.spatialLiveFrame[\s\S]*spatialLiveWindowPlanIsExact\(plan, windowId, tiled\)[\s\S]*member\.windowId !== windowId[\s\S]*column\.selectedMemberIndex !== memberIndex[\s\S]*tiled\.selected !== true[\s\S]*columnSamples\.length !== 0[\s\S]*columnSamples\.push\(plan\)/u,
    );
    expect(liveColumnFrames).toMatch(
      /tiledPresentations !== expectedPresentations[\s\S]*spatialLiveGeometryRevision !== revision[\s\S]*aggregateOverviewSpatialLiveColumnGeometry\(\{[\s\S]*columnIndex,[\s\S]*memberCount: column\.members\.length,[\s\S]*presentation: tabbed[\s\S]*samples: samples\[columnIndex\],[\s\S]*selectedMemberIndex: tabbed[\s\S]*column\.selectedMemberIndex/u,
    );
    expect(liveColumnFrames).not.toContain(
      'if (column.presentation === "tabbed") {\n                    frames.push(null);',
    );
    expect(liveColumnFrames).toContain("return Object.freeze(frames);");
    expect(liveColumnValidation).toMatch(
      /plan\.memberFrames\.length !== members\.length[\s\S]*const tabbed = column\.presentation === "tabbed"[\s\S]*plan\.selectedMemberIndex !== selectedMemberIndex[\s\S]*memberIndex !== selectedMemberIndex[\s\S]*frame !== null[\s\S]*frame\.windowId !== member\.windowId[\s\S]*frame\.columnIndex !== columnIndex[\s\S]*frame\.memberIndex !== memberIndex[\s\S]*frame\.x !== plan\.x \|\| frame\.width !== plan\.width/u,
    );
    expect(
      liveColumnFrames.match(/windowRepeater\.itemAt\(/gu) ?? [],
    ).toHaveLength(1);
    expect(liveColumnFrames).not.toMatch(
      /WeakSet|WeakMap|KWin\.|Qt\.callLater|\b(?:Timer|Behavior|Animation)\s*\{/u,
    );
    expect(scene).toMatch(
      /function desktopIdListShapeIsValid\(candidate\) \{\s*return candidate !== undefined && candidate !== null && Number\.isInteger\(candidate\.length\)[\s\S]*candidate\.length >= 0 && candidate\.length <= 512;\s*\}/u,
    );
    expect(horizontalViewportRefresh).toMatch(
      /function refreshSpatialHorizontalViewports[\s\S]*const currentDesktopIds = desktopIds;[\s\S]*!desktopIdListShapeIsValid\(currentDesktopIds\)[\s\S]*return false;[\s\S]*previousOffsets\.length === previousDesktopIds\.length[\s\S]*previousOffsetsByDesktopId\[previousDesktopId\] = previousOffset;[\s\S]*index < currentDesktopIds\.length[\s\S]*planSpatialHorizontalGeometry\(index, desktopId\)[\s\S]*const preservedOffset = preserve \? previousOffsetsByDesktopId\[desktopId\] : undefined;[\s\S]*nextGeometryPlans\.push\(geometryPlan\)[\s\S]*nextOffsets\.push\(Math\.min\(bounds\.maximum, Math\.max\(bounds\.minimum, previous\)\)\)/u,
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
      /function planSpatialHorizontalGeometry[\s\S]*!overviewModel \|\| outputId\.length === 0[\s\S]*const storedContext = contextFor\(expectedDesktopId\);[\s\S]*const context = storedContext !== null \? storedContext : \{[\s\S]*activeColumnIndex: null,[\s\S]*columns: \[\],[\s\S]*desktopId: expectedDesktopId,[\s\S]*outputId,[\s\S]*viewportOffset: 0[\s\S]*runtime\.planOverviewSpatialRowGeometry\(\{[\s\S]*activeColumnIndex: context\.activeColumnIndex,[\s\S]*alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,[\s\S]*devicePixelRatio,[\s\S]*gap: overviewGap,[\s\S]*viewportOffset: context\.viewportOffset,[\s\S]*workArea/u,
    );
    expect(scene).toMatch(
      /function spatialWindowHeightBounds\(context\)[\s\S]*const seenIds = Object\.create\(null\);[\s\S]*member\.height !== undefined[\s\S]*const memberBounds = member \? member\.heightBounds : null;[\s\S]*memberBounds\.maximumClientHeight !== Number\.POSITIVE_INFINITY[\s\S]*bounds\.push\(\{[\s\S]*windowId: id[\s\S]*return bounds;/u,
    );
    expect(scene).toMatch(
      /function planSpatialHorizontalGeometry[\s\S]*const windowHeightBounds = spatialWindowHeightBounds\(context\);[\s\S]*windowHeightBounds === null[\s\S]*runtime\.planOverviewSpatialRowGeometry\(\{[\s\S]*windowHeightBounds,/u,
    );
    expect(scene).toContain(
      "KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea, screen, desktop)",
    );
    expect(scene).toMatch(
      /function spatialHorizontalGeometryPlanIsValid[\s\S]*plan\.columnFrames\.length !== context\.columns\.length[\s\S]*plan\.camera\.minimum > plan\.camera\.base[\s\S]*plan\.dimensions\.viewportWidth !== workArea\.width[\s\S]*plan\.dimensions\.devicePixelRatio !== devicePixelRatio[\s\S]*frame\.columnId !== `overview-column-\$\{columnIndex\}`/u,
    );
    expect(scene).not.toMatch(
      /function spatialHorizontalViewportBounds[\s\S]{0,2500}resolvedWidth/u,
    );
    expect(scene).toMatch(
      /previewViewportOffset: root\.spatialPresentationViewportOffsetAt\([\s\S]*desktopCardLoader\.index, desktopCardLoader\.modelData,[\s\S]*root\.spatialHorizontalViewportRevision\)/u,
    );
    expect(scene).toContain(
      'property string spatialLiveCameraReturnDesktopId: ""',
    );
    expect(scene).toContain(
      'property string spatialLiveCameraReturnOutputId: ""',
    );
    expect(scene).toContain(
      "property real spatialLiveCameraReturnViewportOffset: Number.NaN",
    );
    expect(presentationViewportOffset).toMatch(
      /function spatialPresentationViewportOffsetAt[\s\S]*spatialHorizontalViewportOffsetAt\(index, expectedDesktopId, expectedRevision\)[\s\S]*spatialPresentationPhase === "opening" \|\| spatialPresentationPhase === "closing"[\s\S]*index === currentWorkspaceIndex[\s\S]*expectedDesktopId === spatialLiveCameraReturnDesktopId[\s\S]*outputId === spatialLiveCameraReturnOutputId[\s\S]*returnOffset >= bounds\.minimum && returnOffset <= bounds\.maximum[\s\S]*const progress = Math\.max\(0, Math\.min\(1, spatialPresentationProgress\)\);[\s\S]*return returnOffset \+ \(viewportOffset - returnOffset\) \* progress;[\s\S]*spatialHorizontalCameraMotionIsExact\(index, expectedDesktopId, expectedRevision\)[\s\S]*spatialVisualHorizontalViewportOffset : viewportOffset;/u,
    );
    expect(presentationViewportOffset).not.toMatch(
      /spatialHorizontalViewportOffsets\[[^\]]+\]\s*=|setSpatialHorizontalViewportOffset|KWin\./u,
    );
    expect(scene).toMatch(
      /spatialRowGeometryPlan: root\.spatialHorizontalGeometryPlanAt\([\s\S]*desktopCardLoader\.index, desktopCardLoader\.modelData,[\s\S]*root\.spatialHorizontalViewportRevision\)/u,
    );
    expect(scene).toMatch(
      /function setSpatialHorizontalViewportOffsetForBounds[\s\S]*spatialHorizontalViewportOffsets\[index\] === normalizedOffset[\s\S]*return true;[\s\S]*spatialHorizontalViewportOffsets\[index\] = normalizedOffset;\s*advanceSpatialHorizontalViewportRevision\(\);/u,
    );
    expect(scene).toMatch(
      /function onWindowActivated\(\) \{\s*if \(root\.pendingWindowFocusRequest\) \{\s*root\.handlePendingWindowFocusActivation\(KWin\.Workspace\.activeWindow\);\s*return;\s*\}\s*if \(root\.spatialPresentationPhase !== "retiring" && !root\.spatialExitHandoffActive\) \{\s*root\.cancelSpatialHorizontalCameraMotion\(\);\s*root\.resolveSpatialLiveCamera\(\);/u,
    );
    expect(scene).not.toContain("onClientAreaChanged");
    expect(scene).toContain(
      'function onWindowRemoved(window) {\n            if (root.pendingWindowFocusCandidate === window) {\n                root.abortPendingWindowFocus("stale");\n                return;\n            }\n            if (root.spatialPresentationPhase !== "retiring") {\n                root.handleSpatialLiveCameraWindowRemoved(window);',
    );
    expect(liveCameraConnections).toMatch(
      /target: root\.spatialLiveCameraWindow[\s\S]*enabled: target !== null[\s\S]*function onFrameGeometryChanged\(\) \{\s*root\.applySpatialLiveCamera\(\);/u,
    );
    expect(liveCameraProbeConnections).toMatch(
      /target: root\.spatialLiveCameraProbeWindow[\s\S]*enabled: target !== null && target !== root\.spatialLiveCameraWindow/u,
    );
    for (const signal of [
      "ActivitiesChanged",
      "DeletedChanged",
      "DesktopsChanged",
      "DialogChanged",
      "FullScreenChanged",
      "ManagedChanged",
      "MaximizedChanged",
      "ModalChanged",
      "MinimizedChanged",
      "MoveResizedChanged",
      "NormalWindowChanged",
      "OutputChanged",
      "TileChanged",
      "TransientChanged",
      "TransientForChanged",
      "UtilityChanged",
      "WindowRoleChanged",
    ]) {
      expect(liveCameraConnections).toContain(`function on${signal}()`);
      expect(liveCameraProbeConnections).toContain(`function on${signal}()`);
    }
    expect(liveCameraProbeConnections).not.toContain("onFrameGeometryChanged");
    expect(liveCameraProbeConnections).toMatch(
      /function onActivitiesChanged\(\) \{\s*root\.resolveSpatialLiveCameraProbe\(\);/u,
    );
    expect(liveCamera).toMatch(
      /function createSpatialLiveCameraAttachment\(candidate\)[\s\S]*context\.activityId !== activityId[\s\S]*context\.activeColumnIndex[\s\S]*column\.selectedMemberIndex[\s\S]*spatialLiveCameraWindowIsEligible\(candidate, windowId, screen\)/u,
    );
    expect(liveCamera).toMatch(
      /runtime\.planOverviewSpatialLiveCamera\(\{[\s\S]*camera: attachment\.camera,[\s\S]*columnFrame: attachment\.columnFrame,[\s\S]*devicePixelRatio: attachment\.devicePixelRatio,[\s\S]*liveFrame,[\s\S]*workAreaX: attachment\.workAreaX/u,
    );
    expect(liveCamera).toMatch(
      /spatialHorizontalViewportOffsets\[index\] = normalizedOffset;\s*advanceSpatialHorizontalViewportRevision\(\);/u,
    );
    expect(liveCamera).not.toContain(
      "spatialHorizontalViewportOffsets.slice()",
    );
    expect(liveCamera).toMatch(
      /spatialLiveCameraDetachedWindow === attachment\.window[\s\S]*refreshSpatialLiveCameraReturnOffset\(attachment\)[\s\S]*return false;[\s\S]*spatialLiveGeometryDetachedDesktopId\.length > 0[\s\S]*spatialLiveGeometryDetachedOutputId\.length > 0[\s\S]*clearSpatialLiveCameraDetachment\(\);/u,
    );
    expect(liveCameraResolve).toMatch(
      /const candidate = KWin\.Workspace\.activeWindow;\s*const attachment = createSpatialLiveCameraAttachment\(candidate\);\s*if \(!attachment\) \{\s*updateSpatialLiveCameraProbe\(candidate\);\s*return false;/u,
    );
    expect(liveCameraResolve).not.toContain(
      "clearSpatialLiveCameraAttachment()",
    );
    expect(liveCameraResolve).toMatch(
      /clearSpatialLiveCameraProbe\(\);[\s\S]*spatialLiveCameraWindow = attachment\.window;/u,
    );
    expect(liveCamera).toMatch(
      /function resolveSpatialLiveCameraProbe\(\)[\s\S]*KWin\.Workspace\.activeWindow !== candidate[\s\S]*return resolveSpatialLiveCamera\(\);/u,
    );
    expect(liveCamera).toMatch(
      /function updateSpatialLiveCameraProbe\(candidate\)[\s\S]*candidate === spatialLiveCameraWindow[\s\S]*clearSpatialLiveCameraProbe\(\);[\s\S]*spatialLiveCameraProbeWindow = candidate;/u,
    );
    expect(liveCamera).toMatch(
      /typeof runtime\.hasAutomaticFloatingRole !== "function"[\s\S]*runtime\.hasAutomaticFloatingRole\(candidate\) === false[\s\S]*catch \(error\) \{\s*return false;/u,
    );
    expect(liveCamera).toMatch(
      /spatialLiveCameraDimensionsAreExact\(geometryPlan\.dimensions, outputGeometry,[\s\S]*workArea, devicePixelRatio\)[\s\S]*dimensions\.outputWidth === outputGeometry\.width[\s\S]*dimensions\.viewportInsetX === workArea\.x - outputGeometry\.x[\s\S]*dimensions\.devicePixelRatio === devicePixelRatio/u,
    );
    expect(liveCamera).toMatch(
      /if \(!geometryPlan \|\| !bounds \|\| !columnFrame[\s\S]*devicePixelRatio <= 0\) \{\s*return null;\s*\}\s*if \(!spatialLiveCameraDimensionsAreExact\(geometryPlan\.dimensions, outputGeometry,[\s\S]*workArea, devicePixelRatio\)\) \{\s*scheduleSpatialLiveCameraRefresh\(\);\s*return null;/u,
    );
    expect(liveCameraAttachment).toMatch(
      /function spatialLiveCameraAttachmentContextIsExact[\s\S]*spatialHorizontalGeometryPlans\[attachment\.workspaceIndex\] !== attachment\.geometryPlan[\s\S]*attachment\.geometryPlan\.columnFrames\[attachment\.columnIndex\] !== attachment\.columnFrame[\s\S]*dimensions\.viewportWidth !== attachment\.workAreaWidth[\s\S]*dimensions\.devicePixelRatio !== attachment\.devicePixelRatio/u,
    );
    expect(liveCameraAttachment).toMatch(
      /function spatialLiveCameraDetachedAttachmentIsExact[\s\S]*spatialLiveCameraAttachment === null[\s\S]*spatialLiveCameraDetachedWindow === attachment\.window[\s\S]*spatialLiveCameraReturnDesktopId === attachment\.desktopId[\s\S]*spatialLiveCameraReturnOutputId === attachment\.outputId[\s\S]*spatialLiveCameraAttachmentContextIsExact\(attachment\)/u,
    );
    expect(liveCamera).toMatch(
      /applySpatialLiveCameraViewportOffset\(attachment\.workspaceIndex, attachment\.desktopId,[\s\S]*attachment\.geometryPlan\)[\s\S]*spatialHorizontalGeometryPlans\[index\] !== expectedGeometryPlan/u,
    );
    expect(liveCameraHotPath).toMatch(
      /KWin\.Workspace\.clientArea\(KWin\.Workspace\.MaximizeArea,[\s\S]*attachment\.screen, attachment\.desktop\)[\s\S]*Number\(workArea\.x\) !== attachment\.workAreaX[\s\S]*Number\(workArea\.height\) !== attachment\.workAreaHeight[\s\S]*runtime\.planOverviewSpatialLiveCamera/u,
    );
    expect(liveCameraHotPath).toMatch(
      /Number\(workArea\.height\) !== attachment\.workAreaHeight\) \{\s*clearSpatialLiveCameraAttachment\(\);\s*scheduleSpatialLiveCameraRefresh\(\);\s*return false;[\s\S]*runtime\.planOverviewSpatialLiveCamera/u,
    );
    expect(
      liveCameraHotPath.match(/KWin\.Workspace\.clientArea\(/gu) ?? [],
    ).toHaveLength(1);
    expect(liveCameraHotPath).not.toMatch(
      /contextFor|liveScreenFor|liveDesktopFor|spatialWorkArea|createSpatialLiveCameraAttachment|\.indexOf\(|\bfor\s*\(/u,
    );
    expect(liveCameraReturn).toMatch(
      /function refreshSpatialLiveCameraReturnOffset[\s\S]*spatialLiveCameraDetachedAttachmentIsExact\(attachment\)[\s\S]*KWin\.Workspace\.clientArea\(KWin\.Workspace\.MaximizeArea,[\s\S]*attachment\.window\.frameGeometry[\s\S]*runtime\.planOverviewSpatialLiveCamera\(\{[\s\S]*camera: attachment\.camera,[\s\S]*columnFrame: attachment\.columnFrame,[\s\S]*spatialLiveCameraPlanIsValid\(plan, attachment\.bounds\)[\s\S]*spatialLiveCameraDetachedAttachmentIsExact\(attachment\)[\s\S]*spatialLiveCameraReturnViewportOffset = plan\.viewportOffset;/u,
    );
    expect(liveCameraReturn).not.toMatch(
      /applySpatialLiveCameraViewportOffset|spatialHorizontalViewportOffsets\[[^\]]+\]\s*=/u,
    );
    expect(liveCamera).toMatch(
      /const applied = applySpatialLiveCameraViewportOffset[\s\S]*if \(applied\) \{\s*completeSpatialLiveCameraRefresh\(\);\s*\}\s*return applied;/u,
    );
    expect(liveCameraRefresh).toMatch(
      /spatialLiveCameraRefreshPending[\s\S]*spatialLiveCameraRefreshBudget <= 0[\s\S]*spatialLiveCameraRefreshBudget -= 1;\s*spatialLiveCameraRefreshPending = true;\s*const requestEpoch = spatialLiveCameraRefreshEpoch;\s*Qt\.callLater\(function\(\) \{[\s\S]*root\.spatialLiveCameraRefreshEpoch !== requestEpoch[\s\S]*root\.spatialLiveCameraRefreshPending = false;[\s\S]*root\.sceneEffect\.active !== true[\s\S]*root\.refreshOverviewSpatialSession\(true\);/u,
    );
    expect(liveCamera.match(/Qt\.callLater\(/gu) ?? []).toHaveLength(1);
    expect(liveCameraRefresh).toMatch(
      /function completeSpatialLiveCameraRefresh\(\) \{\s*if \(spatialLiveCameraRefreshPending\) \{\s*advanceSpatialLiveCameraRefreshEpoch\(\);\s*spatialLiveCameraRefreshPending = false;\s*\}\s*spatialLiveCameraRefreshBudget = 1;/u,
    );
    expect(liveCameraRefresh).toMatch(
      /function resetSpatialLiveCameraRefresh\(\) \{\s*advanceSpatialLiveCameraRefreshEpoch\(\);\s*spatialLiveCameraRefreshPending = false;\s*spatialLiveCameraRefreshBudget = 1;/u,
    );
    expect(
      liveCamera.match(/spatialLiveCameraRefreshBudget = 1;/gu) ?? [],
    ).toHaveLength(2);
    expect(liveCameraRefresh).toMatch(
      /spatialLiveCameraRefreshEpoch = spatialLiveCameraRefreshEpoch >= 2147483646\s*\? 0 : spatialLiveCameraRefreshEpoch \+ 1;/u,
    );
    expect(liveCamera).toMatch(
      /function handleSpatialLiveCameraWindowRemoved\(removedWindow\)[\s\S]*removedWindow === spatialLiveCameraWindow[\s\S]*clearSpatialLiveCameraAttachment\(\);[\s\S]*removedWindow === spatialLiveCameraDetachedWindow[\s\S]*clearSpatialLiveCameraDetachment\(\);[\s\S]*removedWindow === spatialLiveCameraProbeWindow[\s\S]*clearSpatialLiveCameraProbe\(\);/u,
    );
    expect(wheelNavigation).toMatch(
      /handleSpatialHorizontalViewportWheel[\s\S]*detachSpatialLiveCameraForManualOffset\(workspaceIndex, expectedDesktopId,[\s\S]*currentOffset, plan\.viewportOffset\)/u,
    );
    expect(wheelNavigation).toMatch(
      /function revealHorizontalNavigationTarget[\s\S]*detachSpatialLiveCameraForManualOffset\(\s*workspaceIndex, expectedDesktopId, currentOffset, nextOffset\)/u,
    );
    expect(liveCamera).toMatch(
      /function detachSpatialLiveCameraForManualOffset[\s\S]*manualSpatialLiveGeometryDetachIsExact\(index, expectedDesktopId, previousOffset,[\s\S]*spatialLiveCameraReturnDesktopId !== expectedDesktopId[\s\S]*spatialLiveCameraReturnOutputId !== outputId[\s\S]*spatialLiveCameraReturnViewportOffset = previousOffset;[\s\S]*spatialLiveGeometryDetachedDesktopId = expectedDesktopId;[\s\S]*spatialLiveGeometryDetachedOutputId = outputId;/u,
    );
    expect(liveCamera).toMatch(
      /function manualSpatialLiveGeometryDetachIsExact[\s\S]*index !== currentWorkspaceIndex[\s\S]*spatialHorizontalViewportOffsets\[index\] !== nextOffset[\s\S]*desktopContextIsExact/u,
    );
    expect(liveCamera).toMatch(
      /function spatialLiveGeometryIsManuallyDetached[\s\S]*spatialLiveGeometryDetachedOutputId === expectedOutputId[\s\S]*spatialLiveGeometryDetachedDesktopId === expectedDesktopId/u,
    );
    expect(scene).toMatch(
      /function resetOverviewSession\(\) \{\s*cancelSpatialHorizontalCameraMotion\(\);\s*cancelWorkspaceRename\(\);\s*cancelSpatialZoomTransaction\(\);\s*clearExternalSpatialZoom\(\);\s*invalidateDesktopTopologyRefresh\(\);\s*resetSpatialLiveCameraSession\(\);/u,
    );
    expect(liveCamera).toMatch(
      /function resetSpatialLiveCameraSession\(\) \{\s*resetSpatialLiveCameraRefresh\(\);\s*clearSpatialLiveCameraAttachment\(\);\s*clearSpatialLiveCameraProbe\(\);/u,
    );
    expect(liveCamera).toMatch(
      /function clearSpatialLiveCameraDetachment[\s\S]*spatialLiveCameraDetachedWindow = null;[\s\S]*spatialLiveCameraReturnDesktopId = "";[\s\S]*spatialLiveCameraReturnOutputId = "";[\s\S]*spatialLiveCameraReturnViewportOffset = Number\.NaN;[\s\S]*spatialLiveGeometryDetachedDesktopId = "";[\s\S]*spatialLiveGeometryDetachedOutputId = "";[\s\S]*function resetSpatialLiveCameraSession[\s\S]*clearSpatialLiveCameraDetachment\(\);/u,
    );
    expect(liveCamera).not.toMatch(
      /KWin\.Workspace\.(?:stackingOrder|windows)\b|\b(?:Timer|Behavior|Animation)\s*\{|setInterval|org\.kde\.kwin\.private/u,
    );
    expect(wheelNavigation).toMatch(
      /function handleSpatialViewportWheel[\s\S]*advanceOverviewVerticalWheelSettleRequestId\(\);[\s\S]*const previousContentY = spatialContentY;[\s\S]*setSpatialContentY\(plan\.contentY\)[\s\S]*overviewWheelPixelRemainder = plan\.pixelRemainder;[\s\S]*overviewWheelRemainder = 0;[\s\S]*searchQuery\.length === 0 && plan\.contentY !== previousContentY[\s\S]*overviewVerticalWheelSettlePending = true;[\s\S]*return true;/u,
    );
    const preciseWheel = wheelNavigation.slice(
      wheelNavigation.indexOf("function handleSpatialViewportWheel("),
      wheelNavigation.indexOf("function handleSpatialWorkspaceWheel("),
    );
    expect(preciseWheel).toContain("overviewWheelRemainder = 0");
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
      /runtime\.planOverviewSpatialWorkspaceWheelTarget\(\{[\s\S]*currentIndex: planningSourceIndex,[\s\S]*direction,[\s\S]*steps,[\s\S]*workspaceCount: request\.desktopIds\.length/u,
    );
    expect(wheelNavigation).toMatch(
      /function finishSpatialVerticalWheelGesture[\s\S]*overviewVerticalWheelSettlePending[\s\S]*resetOverviewPreciseVerticalWheelState\(\);[\s\S]*captureSpatialWheelWorkspaceRequest\(\)[\s\S]*Qt\.callLater\(root\.completeSpatialVerticalWheelSettle,[\s\S]*requestId, request\.outputId, request\.sourceDesktopId, request\.sourceIndex,[\s\S]*request\.geometryEpoch,[\s\S]*request\.layout\.contentHeight, request\.desktopIds\.length\);/u,
    );
    expect(wheelNavigation).toMatch(
      /function completeSpatialVerticalWheelSettle[\s\S]*requestId !== overviewVerticalWheelSettleRequestId[\s\S]*deferredSpatialWheelWorkspaceRequest\([\s\S]*planSpatialWorkspaceSettle\(request\)[\s\S]*requestSpatialWheelWorkspaceIndex\(request, plan\.targetIndex\)/u,
    );
    expect(wheelNavigation).toMatch(
      /runtime\.planOverviewSpatialWorkspaceSettle\(\{[\s\S]*cardHeight: request\.cardHeight,[\s\S]*contentHeight: request\.layout\.contentHeight,[\s\S]*contentY: request\.contentY,[\s\S]*gap: request\.gap,[\s\S]*sceneHeight: request\.sceneHeight,[\s\S]*workspaceCount: request\.desktopIds\.length/u,
    );
    expect(wheelNavigation).toMatch(
      /function spatialWheelWorkspaceRequestIsExact[\s\S]*desktopIds === request\.desktopIds[\s\S]*currentDesktop === request\.sourceDesktop[\s\S]*overviewSpatialLayout === request\.layout[\s\S]*spatialContentY === request\.contentY[\s\S]*desktopContextIsExact/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewVerticalWheelState[\s\S]*resetOverviewPreciseVerticalWheelState\(\);[\s\S]*clearOverviewVerticalWheelWorkspaceRequest\(\);[\s\S]*advanceOverviewVerticalWheelWorkspaceRequestId\(\);[\s\S]*overviewWheelRemainder = 0;[\s\S]*function resetOverviewPreciseVerticalWheelState[\s\S]*advanceOverviewVerticalWheelSettleRequestId\(\);[\s\S]*overviewWheelPixelRemainder = 0;[\s\S]*overviewVerticalWheelSettlePending = false;/u,
    );
    expect(wheelNavigation).toMatch(
      /function requestSpatialWheelWorkspace[\s\S]*Qt\.callLater\(root\.completeSpatialWheelWorkspaceSelection,[\s\S]*targetPlan\.targetIndex\);[\s\S]*function completeSpatialWheelWorkspaceSelection[\s\S]*requestId !== overviewVerticalWheelWorkspaceRequestId[\s\S]*deferredSpatialWheelWorkspaceRequest\([\s\S]*requestSpatialWheelWorkspaceIndex\(request, expectedTargetIndex\)/u,
    );
    expect(wheelWorkspaceSchedule).toMatch(
      /Qt\.callLater\(root\.completeSpatialWheelWorkspaceSelection,\s*requestId,\s*request\.outputId,\s*request\.sourceDesktopId,\s*request\.sourceIndex,\s*request\.geometryEpoch,\s*request\.contentY,\s*request\.cardHeight,\s*request\.gap,\s*request\.sceneHeight,\s*request\.layout\.contentHeight,\s*request\.desktopIds\.length,\s*targetPlan\.targetIndex\);/u,
    );
    expect(wheelWorkspaceSchedule).not.toMatch(
      /requestSpatialWheelWorkspaceIndex|requestDesktopSelection/u,
    );
    expect(preciseWorkspaceSettleSchedule).toMatch(
      /Qt\.callLater\(root\.completeSpatialVerticalWheelSettle,\s*requestId,\s*request\.outputId,\s*request\.sourceDesktopId,\s*request\.sourceIndex,\s*request\.geometryEpoch,\s*request\.contentY,\s*request\.cardHeight,\s*request\.gap,\s*request\.sceneHeight,\s*request\.layout\.contentHeight,\s*request\.desktopIds\.length\);/u,
    );
    expect(preciseWorkspaceSettleSchedule).not.toMatch(
      /requestSpatialWheelWorkspaceIndex|requestDesktopSelection/u,
    );
    expect(wheelWorkspaceCompletion).toContain(
      "return requestSpatialWheelWorkspaceIndex(request, expectedTargetIndex)",
    );
    expect(wheelNavigation).toMatch(
      /const planningSourceIndex = overviewVerticalWheelWorkspaceRequestIsExact\(request\)[\s\S]*\? overviewVerticalWheelWorkspaceTargetIndex : request\.sourceIndex;[\s\S]*currentIndex: planningSourceIndex[\s\S]*rememberOverviewVerticalWheelWorkspaceRequest\(request, targetPlan\.targetIndex\)/u,
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
    expect(overviewRuntimeIndex).toContain(
      "planOverviewSpatialWorkspaceSettle",
    );
    expect(overviewRuntimeIndex).toContain(
      "projectOverviewSpatialLiveGeometry",
    );
    expect(scene).toMatch(
      /function refreshOverviewSpatialSession\(preserveViewport, animateViewport = false\)[\s\S]*resetOverviewWheelState\(\);/u,
    );
    expect(scene).toMatch(
      /DragHandler \{[\s\S]*id: spatialViewportDragHandler[\s\S]*onActiveChanged: \{[\s\S]*if \(active\) \{\s*root\.resetOverviewWheelState\(\);/u,
    );
    expect(scene).toMatch(
      /function beginWindowSpatialEdgePan\([\s\S]*resetOverviewWheelState\(\);\s*spatialWindowDragSource = source;/u,
    );
    expect(scene).toMatch(
      /function beginWindowSpatialEdgePan\([\s\S]*adoptSpatialHorizontalCameraMotion\(workspaceIndex, expectedDesktopId, horizontalBounds\)[\s\S]*adoptSpatialVisualContentY\(\)[\s\S]*resetOverviewWheelState\(\);\s*spatialWindowDragSource = source;/u,
    );
    expect(scene).toMatch(
      /function beginDesktopReorder\([\s\S]*resetOverviewWheelState\(\);\s*desktopReorderActive = true;/u,
    );
    expect(scene).toMatch(
      /function beginDesktopReorder\([\s\S]*adoptSpatialHorizontalCameraMotion\(sourceIndex, expectedDesktopId, horizontalBounds\)[\s\S]*adoptSpatialVisualContentY\(\)[\s\S]*resetOverviewWheelState\(\);\s*desktopReorderActive = true;/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewWheelState\(\) \{\s*if \(overviewTabRailWheelGestureOwned\) \{\s*invalidateOverviewTabRailWheelOwner\(\);\s*\} else \{\s*resetOverviewTabRailWheelState\(\);\s*\}\s*resetOverviewHorizontalWheelState\(\);\s*resetOverviewVerticalWheelState\(\);\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewHorizontalWheelState\(\) \{\s*cancelOverviewHorizontalWheelSelectionRequest\(\);\s*overviewHorizontalWheelPixelRemainder = 0;\s*overviewHorizontalWheelRemainder = 0;\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /function resetOverviewVerticalWheelState\(\) \{\s*resetOverviewPreciseVerticalWheelState\(\);\s*clearOverviewVerticalWheelWorkspaceRequest\(\);\s*advanceOverviewVerticalWheelWorkspaceRequestId\(\);\s*overviewWheelRemainder = 0;\s*\}/u,
    );
    expect(wheelNavigation).toMatch(
      /if \(plan\.steps > 0\)[\s\S]*overviewWheelPixelRemainder = 0;[\s\S]*overviewWheelRemainder = 0;[\s\S]*requestSpatialWheelWorkspace\(plan\.direction, plan\.steps\)[\s\S]*else \{[\s\S]*overviewWheelRemainder = plan\.remainder;/u,
    );
    expect(`${wheelHandler}\n${wheelNavigation}`).not.toMatch(
      /candidate\.[A-Za-z0-9_]+\s*=(?!=)|overviewModel\.[A-Za-z0-9_]+\s*=(?!=)|\bTimer\s*\{|\.setValue\s*\(/u,
    );
  });

  it("navigates to every desktop gutter including the current row and empty tail", () => {
    const cardTargets = desktopCard.slice(
      desktopCard.indexOf("function collectNavigationTargets("),
      desktopCard.indexOf("function windowCanDrag("),
    );
    const activation = scene.slice(
      scene.indexOf("function activateKeyboardSelection("),
      scene.indexOf("function closeKeyboardSelection("),
    );
    const initialSelection = scene.slice(
      scene.indexOf("function preferredInitialNavigationTarget("),
      scene.indexOf("function navigationTargetPrecedes("),
    );

    expect(desktopCard).toMatch(
      /onCurrentChanged: \{\s*if \(card\.presentationMotionStructuralDriftShouldReset\(\)\) \{\s*card\.resetPresentationMotionAfterDrift\(\);\s*\}\s*card\.navigationTargetsChanged\(\);\s*\}/u,
    );
    expect(cardTargets).toContain("if (searchQuery.trim().length === 0)");
    expect(cardTargets).not.toContain("if (!current &&");
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
      "return selectDesktop(target.candidate, target.desktopId, target.screen)",
    );
    expect(activation).toContain('target.kind === "window"');
    expect(activation).toContain(
      "return focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen)",
    );
    expect(activation.match(/collectNavigationTargets\(\)/gu)).toHaveLength(1);
    expect(activation).toMatch(
      /const targets = collectNavigationTargets\(\);\s*let target = navigationTargetForId\(targets, keyboardSelectionId\);\s*if \(!target\) \{\s*repairKeyboardSelectionFrom\(targets\);\s*target = navigationTargetForId\(targets, keyboardSelectionId\);\s*\}\s*if \(!target\) \{\s*return false;/u,
    );
    expect(
      activation.indexOf("repairKeyboardSelectionFrom(targets)"),
    ).toBeLessThan(
      activation.lastIndexOf(
        "navigationTargetForId(targets, keyboardSelectionId)",
      ),
    );
    expect(activation).toMatch(
      /if \(target\.kind === "desktop"\) \{\s*return selectDesktop[\s\S]*if \(target\.kind === "window"\) \{\s*return focusWindow/u,
    );
    expect(activation).not.toMatch(
      /Qt\.callLater|root\.activateKeyboardSelection|\bTimer\s*\{|org\.kde\.kwin\.private/u,
    );
    expect(initialSelection).toContain(
      'target.kind === "window" && target.candidate === activeWindow',
    );
    expect(initialSelection).toContain(
      'target.kind === "window" && target.desktopId === activeDesktopId',
    );
    expect(initialSelection).toContain(
      'target.kind === "desktop" && target.desktopId === activeDesktopId',
    );
    expect(initialSelection).toContain(
      "return firstActive || firstCurrentDesktop || currentDesktopMarker || firstVisual",
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
    expect(scene).toContain(
      "readonly property bool spatialHorizontalRowDragActive: spatialHorizontalRowDragHandler.active",
    );
    expect(scene).toMatch(
      /enabled: interactionEligible && !root\.keyboardHelpVisible\s*&& !root\.spatialHorizontalRowDragActive/u,
    );
    expect(scene).not.toContain("root.spatialHorizontalRowDragHandler");

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
    expect(helpHint).toContain(
      "visible: root.spatialPresentationSettled && !root.keyboardHelpVisible",
    );
    expect(helpHint).toContain("root.searchQuery.length === 0");
    expect(helpHint).not.toContain("visible: false");
    expect(helpHint).toContain("z: 19000");
    expect(scene.indexOf("KeyboardHelpHint {")).toBeGreaterThan(
      scene.indexOf("id: spatialCanvas"),
    );
    expect(scene).toContain(
      "spatialViewportOverlayContainsPoint(keyboardHelpHint, point)",
    );
    expect(helpHint).toContain(
      "onOpenRequested: root.keyboardHelpVisible = true",
    );
    expect(keyboardHelpHint).toContain(
      'readonly property string label: "Type to search \\u00b7 F1 help"',
    );
    expect(keyboardHelpHint).toContain("Accessible.name: hint.label");
    expect(keyboardHelpHint).toContain("Accessible.role: Accessible.Button");
    expect(keyboardHelpHint).toContain(
      "Accessible.onPressAction: hint.openRequested()",
    );
    expect(keyboardHelpHint).toContain("text: hint.label");
    expect(keyboardHelpHint).toContain("implicitWidth: 168");
    expect(keyboardHelpHint).toContain("implicitHeight: 28");
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
    expect(helpHint).not.toMatch(
      /\bTimer\s*\{|Qt\.callLater|org\.kde\.kwin\.private/u,
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
      /onSearchQueryChanged: \{\s*root\.cancelSpatialHorizontalCameraMotion\(\);\s*root\.cancelWorkspaceRenameOnDrift\(\);\s*root\.cancelActiveWindowSpatialDrag\(\);\s*root\.cancelActiveColumnSpatialDrag\(\);\s*resetOverviewWheelState\(\);\s*resetWindowWorkspaceHover\(\);\s*cancelKeyboardBoundaryNavigation\(\);\s*Qt\.callLater\(root\.repairKeyboardSelection\);\s*\}/u,
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
      scene.indexOf("function deleteKeyboardSelection("),
      scene.indexOf("function boundedExpectedWorkspaceName("),
    );
    const transaction = scene.slice(
      scene.indexOf("function closeWindow("),
      scene.indexOf("function windowUsesDesktop("),
    );

    expect(keyHandler).toContain("event.key === Qt.Key_Delete");
    expect(keyHandler).toContain("root.deleteKeyboardSelection()");
    expect(selection).toContain(
      "navigationTargetForId(targets, keyboardSelectionId)",
    );
    expect(selection).toContain('if (target.kind === "window")');
    expect(selection).toMatch(
      /closeWindow\(target\.candidate, target\.windowId, target\.desktop,\s*target\.desktopId, target\.screen\)/u,
    );
    expect(selection).toContain('if (target.kind !== "desktop")');
    expect(selection).toContain(
      "return removeWorkspace(target.candidate, target.desktopId, index)",
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
      /function onWindowRemoved\(window\) \{\s*if \(controller\.pendingSceneRestartRequest\) \{\s*return;\s*\}\s*if \(controller\.pendingSceneRetirementBarrier\) \{\s*controller\.forceSceneRetirementBarrier\(true\);\s*return;\s*\}\s*if \(controller\.presentationPhase === "preparing"\) \{\s*controller\.restartPreparingSceneForContextDrift\(\);\s*return;\s*\}\s*if \(controller\.presentationPhase === "retiring"\) \{\s*controller\.pendingSceneRetirementContextDrift = true;\s*return;\s*\}\s*controller\.handleOverviewExitWindowRemoved\(window\);\s*controller\.queueDesktopSurfaceLifecycleEvent\(window\);\s*controller\.requestLiveModelRefresh\(\);/u,
    );
  });

  it("routes guarded middle-click closes through the live window transaction", () => {
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
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
      /onWindowCloseRequested:\s*\(\s*candidate,\s*expectedWindowId,\s*expectedDesktop,\s*expectedDesktopId,\s*expectedScreen\s*\)\s*=>\s*root\.closeWindow\(\s*candidate,\s*expectedWindowId,\s*expectedDesktop,\s*expectedDesktopId,\s*expectedScreen\s*\)/u,
    );
  });

  it("offers touch-safe exact close buttons without activating or dragging their windows", () => {
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    const placeholder = desktopCard.slice(
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
      desktopCard.indexOf("id: windowDropArea"),
    );
    const thumbnailTouchActivation = thumbnail.slice(
      thumbnail.indexOf("id: thumbnailTouchHoldHandler"),
      thumbnail.lastIndexOf(
        "DragHandler {",
        thumbnail.indexOf("id: thumbnailTouchDragHandler"),
      ),
    );
    const placeholderTouchDevice = placeholder.indexOf(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    const placeholderTouchActivation = placeholder.slice(
      placeholder.lastIndexOf("TapHandler {", placeholderTouchDevice),
      placeholder.indexOf(
        "\n                    TapHandler {",
        placeholderTouchDevice,
      ),
    );
    const closeTapHandler = windowCloseButton.slice(
      windowCloseButton.lastIndexOf(
        "TapHandler {",
        windowCloseButton.indexOf("id: closeTapHandler"),
      ),
    );
    const hitMarginLiteral = windowCloseButton.match(
      /readonly property real hitMargin:\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/u,
    )?.[1];
    const hitMargin = Number(hitMarginLiteral ?? Number.NaN);

    expect(desktopCard).toContain(
      "required property bool showWindowCloseButtons",
    );
    expect(windowCloseButton).toContain("required property bool closeEligible");
    expect(windowCloseButton).toContain(
      "required property bool settingEnabled",
    );
    expect(windowCloseButton).toContain(
      "required property bool surfaceLargeEnough",
    );
    const visibility = windowCloseButton.match(
      /^\s*visible:\s*([^\n]+)$/mu,
    )?.[1];
    expect(visibility?.trim()).toBe(
      "settingEnabled && closeEligible && surfaceLargeEnough",
    );
    expect(visibility).not.toMatch(/surfaceHovered|keyboardSelected/u);

    expect(hitMarginLiteral).toBeDefined();
    expect(Number.isFinite(hitMargin)).toBe(true);
    expect(hitMargin).toBeGreaterThan(0);
    expect(windowCloseButton).toMatch(
      /HoverHandler \{[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*cursorShape: Qt\.PointingHandCursor[\s\S]*margin: button\.hitMargin/u,
    );
    expect(closeTapHandler).toContain("acceptedButtons: Qt.LeftButton");
    expect(closeTapHandler).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    expect(closeTapHandler).toContain("enabled: button.visible");
    expect(closeTapHandler).toContain("margin: button.hitMargin");
    expect(closeTapHandler).toContain(
      "gesturePolicy: TapHandler.ReleaseWithinBounds",
    );
    expect(closeTapHandler).toContain(
      "grabPermissions: PointerHandler.CanTakeOverFromAnything",
    );
    expect(closeTapHandler).toContain("onTapped: button.closeRequested()");
    expect(closeTapHandler).not.toMatch(
      /windowTapped|touchSpatialDragArmed|DragHandler|KWin\.|\.setValue\s*\(/u,
    );

    for (const visual of [
      {
        buttonId: "thumbnailCloseButton",
        keyboardSelection: "thumbnailShell.keyboardSelected",
        minimum: "width >= 52 && height >= 40",
        source: thumbnail,
        surface: "thumbnailShell",
      },
      {
        buttonId: "minimizedPlaceholderCloseButton",
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
      expect(visual.source).toMatch(
        new RegExp(
          `onTapped: point => \\{[\\s\\S]*card\\.closeButtonContainsPoint\\(${visual.buttonId},[\\s\\S]*point\\.position\\)[\\s\\S]*return;[\\s\\S]*card\\.windowTapped\\(`,
          "u",
        ),
      );
      const buttonStart = visual.source.indexOf(`id: ${visual.buttonId}`);
      const buttonEnd = visual.source.indexOf("TapHandler {", buttonStart);
      const button = visual.source.slice(buttonStart, buttonEnd);
      expect(button).not.toMatch(
        /\b(?:Timer|Behavior|Animation|DragHandler|Settings)\s*\{|windowTapped|activeWindow\s*=|candidate\.[A-Za-z0-9_]+\s*=(?!=)|\.setValue\s*\(|org\.kde\.kwin\.private|KWin\.|layoutStateReader|overviewSpatialLayout|requestDesktopReorder/u,
      );
    }

    for (const activation of [
      {
        buttonId: "thumbnailCloseButton",
        source: thumbnailTouchActivation,
        surfaceId: "thumbnailShell",
      },
      {
        buttonId: "minimizedPlaceholderCloseButton",
        source: placeholderTouchActivation,
        surfaceId: "minimizedPlaceholderShell",
      },
    ] as const) {
      expect(activation.source).toContain("PointerDevice.TouchScreen");
      expect(activation.source).toMatch(
        new RegExp(
          `onTapped: point => \\{[\\s\\S]*card\\.closeButtonContainsPoint\\(${activation.buttonId},[\\s\\S]*${activation.surfaceId},\\s*point\\.position\\)[\\s\\S]*return;[\\s\\S]*card\\.windowTapped\\(`,
          "u",
        ),
      );
    }
    expect(thumbnailTouchActivation).toMatch(
      /onLongPressed:\s*\{[\s\S]*card\.closeButtonContainsPoint\(thumbnailCloseButton, thumbnailShell,[\s\S]*point\.pressPosition\)\)\s*\{\s*return;\s*\}[\s\S]*windowPresentation\.touchSpatialDragArmed = true;/u,
    );

    expect(thumbnail).toContain("anchors.rightMargin: 5");
    expect(thumbnail).not.toContain(
      "anchors.rightMargin: windowPresentation.attentionRequested",
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
    expect(containmentGuard).toContain("const margin = button.hitMargin;");
    expect(containmentGuard).toContain("!Number.isFinite(margin)");
    expect(containmentGuard).toContain("margin < 0");
    expect(containmentGuard).toMatch(
      /localPoint\.x >= -margin && localPoint\.y >= -margin\s*&& localPoint\.x < button\.width \+ margin && localPoint\.y < button\.height \+ margin/u,
    );
    expect(containmentGuard).toContain("return true;");
    expect(
      `${windowCloseButton}\n${containmentGuard}\n${thumbnailTouchActivation}\n${placeholderTouchActivation}`,
    ).not.toMatch(
      /\b(?:Timer|Settings|Behavior|Animation|DragHandler|DropArea|WheelHandler)\s*\{|org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.|layoutStateReader|overviewSpatialLayout|requestDesktopReorder|desktopReorderSource/u,
    );
  });

  it("activates exact current and non-current desktops from the workspace surface", () => {
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
    const workspaceHoverCompletion = scene.slice(
      scene.indexOf("function completeWindowWorkspaceHover("),
      scene.indexOf("function planWindowWorkspaceHover("),
    );

    expect(desktopCard).toContain(
      "signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)",
    );
    expect(numberGutter).toContain("width: 36");
    expect(numberGutter).toContain("height: 36");
    expect(numberGutter).toContain("z: 9500");
    expect(numberGutter).toContain("id: numberGutterTapHandler");
    expect(numberGutter).toContain("acceptedButtons: Qt.LeftButton");
    expect(numberGutter).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    expect(numberGutter).toMatch(
      /enabled: card\.desktop && card\.screen\s*&& card\.searchQuery\.trim\(\)\.length === 0/u,
    );
    expect(numberGutter).toContain("gesturePolicy: TapHandler.DragThreshold");
    expect(numberGutter).not.toContain("enabled: !card.current");
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
    expect(selector).toContain("const activeDesktop = currentDesktop;");
    expect(selector).toContain("requestDesktopSelection(");
    expect(scene.match(/requestDesktopSelection\(/gu)).toHaveLength(5);
    expect(
      workspaceHoverCompletion.match(/requestDesktopSelection\(/gu),
    ).toHaveLength(1);

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
    expect(selector).toMatch(
      /if \(activeDesktop === liveDesktop && String\(activeDesktop\.id\) === expectedDesktopId\) \{\s*if \(!settleSpatialExitHandoff\(null, exitToken\)\) \{[\s\S]*effect\.deactivate\(\);\s*return true;/u,
    );
    expect(selector.match(/effect\.deactivate\(\)/gu)).toHaveLength(2);
    expect(desktopRequest).not.toContain("deactivate()");

    const currentDesktopBranchStart = selector.indexOf(
      "if (activeDesktop === liveDesktop",
    );
    const nonCurrentRequest = selector.indexOf("if (!requestDesktopSelection(");
    const currentDesktopBranch = selector.slice(
      currentDesktopBranchStart,
      nonCurrentRequest,
    );
    expect(currentDesktopBranchStart).toBeGreaterThan(
      selector.indexOf("desktopContextIsExact("),
    );
    expect(nonCurrentRequest).toBeGreaterThan(currentDesktopBranchStart);
    expect(currentDesktopBranch).toContain("effect.deactivate();");
    expect(currentDesktopBranch).not.toMatch(
      /requestDesktopSelection|KWin\.(?:SceneView|Workspace)\.[A-Za-z0-9_]+\s*=(?!=)|\.setValue\s*\(/u,
    );

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
    const deactivate = selector.lastIndexOf("effect.deactivate()");
    expect(preWriteGuard).toBeGreaterThan(0);
    expect(sceneWrite).toBeGreaterThan(0);
    expect(sceneWrite).toBeGreaterThan(preWriteGuard);
    expect(fallbackWrite).toBeGreaterThan(sceneWrite);
    expect(postWriteRead).toBeGreaterThan(fallbackWrite);
    expect(confirmation).toBeGreaterThan(postWriteRead);
    expect(selector).toMatch(
      /if \(!requestDesktopSelection\([\s\S]*?true\)\) \{\s*cancelSpatialExitHandoff\(\);\s*return false;\s*\}\s*if \(!settleSpatialExitHandoff\(null, exitToken\)\) \{[\s\S]*effect\.deactivate\(\);\s*return true;/u,
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

  it("activates current and non-current desktops from empty card content", () => {
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
    expect(background).toContain("id: emptyContentTapHandler");
    expect(windowPresentation).toContain(
      "z: frame && frame.floating ? 1000 + index : 100 + index",
    );

    expect(background).toContain("acceptedButtons: Qt.LeftButton");
    expect(background).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen",
    );
    expect(background).toMatch(
      /enabled: card\.desktop && card\.screen\s*&& card\.searchQuery\.trim\(\)\.length === 0/u,
    );
    expect(background).toContain("gesturePolicy: TapHandler.DragThreshold");
    expect(background).not.toContain("enabled: !card.current");
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
      "visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)",
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
      "const sourceFrame = sourceFrames[sourceFrameIndex]",
    );
    expect(presentations).toContain(
      "sourceFrame.columnIndex !== columnIndex || sourceFrame.memberIndex !== memberIndex",
    );
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
      desktopCard.indexOf("function columnShellFrame("),
    );
    expect(columnFrame).not.toMatch(/for\s*\(|\.slice\(|\.map\(/u);
    expect(desktopCard).toMatch(
      /function clippedNavigationRect[\s\S]*if \(includeOffscreen === true\) \{[\s\S]*width: rect\.width,[\s\S]*x: rect\.x,[\s\S]*return navigationRectIsValid\(rect\) \? rect : null;/u,
    );
    expect(presentations).toContain(
      'const selected = column.presentation !== "tabbed"',
    );
    expect(presentations).toContain(
      "|| memberIndex === column.selectedMemberIndex",
    );
    expect(presentations).toContain("thumbnailFrame: selected ? frame : null");
    expect(presentations).toContain(
      "plannedColumnFrame: spatialSourceColumnFrame(columnIndex)",
    );
    expect(desktopCard).toContain(
      "readonly property bool selectedThumbnail: !tiledPresentation || tiledPresentation.selected",
    );
    const thumbnail = desktopCard.slice(
      desktopCard.indexOf("id: thumbnailShell"),
      desktopCard.indexOf("id: minimizedPlaceholderShell"),
    );
    expect(thumbnail).toContain("card.presentationMotionVisualFrame(");
    expect(thumbnail).toContain('"thumbnail", windowPresentation.frame,');
    expect(thumbnail).toContain(
      "visible: visualFrame !== null && visualOpacity > 0.0001 && model.window",
    );
    expect(thumbnail).toMatch(
      /KWin\.WindowThumbnail \{[\s\S]*wId: windowPresentation\.windowId/u,
    );
    expect(desktopCard.match(/KWin\.WindowThumbnail \{/gu)).toHaveLength(1);
    expect(desktopCard).toContain("id: tabRailLayer");
    expect(desktopCard).toContain("id: tabShell");
    expect(desktopCard).toContain("readonly property var tabTarget: tabShell");
    expect(desktopCard).toContain("card.tabFrameForPresentation(");
  });

  it("overlays compact guarded controls for every real tabbed member", () => {
    const viewportStart = desktopCard.indexOf("id: viewport");
    const railLayerStart = desktopCard.indexOf("id: tabRailLayer");
    const columnRepeaterStart = desktopCard.indexOf("id: columnRepeater");
    const windowPresentationStart = desktopCard.indexOf(
      "id: windowPresentation",
    );
    const thumbnailStart = desktopCard.indexOf("id: thumbnailShell");
    const tabStart = desktopCard.indexOf("id: tabShell");
    const plannerStart = desktopCard.indexOf("function buildTabRailPlans(");
    const frameLookupStart = desktopCard.indexOf(
      "function tabFrameForPresentation(",
    );
    const filterStart = desktopCard.indexOf("KWin.WindowFilterModel {");
    const filter = desktopCard.slice(
      filterStart,
      desktopCard.indexOf("windowType:", filterStart),
    );

    expect(viewportStart).toBeGreaterThanOrEqual(0);
    expect(railLayerStart).toBeGreaterThan(viewportStart);
    expect(columnRepeaterStart).toBeGreaterThan(viewportStart);
    expect(windowPresentationStart).toBeGreaterThan(columnRepeaterStart);
    expect(thumbnailStart).toBeGreaterThan(windowPresentationStart);
    expect(tabStart).toBeGreaterThan(windowPresentationStart);
    expect(plannerStart).toBeGreaterThanOrEqual(0);
    expect(frameLookupStart).toBeGreaterThanOrEqual(0);
    expect(filter).toContain("minimizedWindows: true");
    expect(filter).not.toContain("minimizedWindows: false");

    const railLayer = desktopCard.slice(railLayerStart, railLayerStart + 260);
    const thumbnail = desktopCard.slice(
      thumbnailStart,
      desktopCard.indexOf("id: minimizedPlaceholderShell", thumbnailStart),
    );
    const tab = desktopCard.slice(tabStart, thumbnailStart);
    const planner = desktopCard.slice(plannerStart, frameLookupStart);
    const frameLookup = desktopCard.slice(
      frameLookupStart,
      desktopCard.indexOf(
        "function buildSpatialColumnFrames(",
        frameLookupStart,
      ),
    );

    expect(railLayer).toContain("anchors.fill: parent");
    expect(railLayer).toContain("clip: true");
    expect(railLayer).toContain("z: 10000");
    expect(desktopCard).toMatch(/id: columnShell[\s\S]*z: 9000/u);
    expect(tab).toContain("parent: tabRailLayer");

    for (const geometry of [
      "x: visualFrame ? visualFrame.x : 0",
      "y: visualFrame ? visualFrame.y : 0",
      "width: visualBaseFrame ? Math.max(1, visualBaseFrame.width) : 0",
      "height: visualBaseFrame ? Math.max(1, visualBaseFrame.height) : 0",
    ]) {
      expect(thumbnail).toContain(geometry);
    }
    expect(thumbnail).not.toMatch(/tab(?:Frame|Rail|Shell)/u);

    expect(tab).toContain(
      "readonly property var frame: windowPresentation.tabFrame",
    );
    expect(tab).toContain("windowPresentation.matchesSearch");
    expect(tab).toContain("windowPresentation.minimizedWindow");
    expect(tab).toContain("windowPresentation.attentionRequested");
    expect(tab).toContain(
      "readonly property bool selectedTab: frame !== null && frame.selected === true",
    );
    expect(tab).toMatch(
      /readonly property bool activationEligible: windowPresentation\.primaryVisualKind === "tab"\s*&& frame !== null && frame\.visible === true\s*&& windowPresentation\.matchesSearch/u,
    );
    expect(tab).toContain(
      "readonly property bool keyboardTarget: activationEligible",
    );
    expect(tab).toContain('windowPresentation.primaryVisualKind === "tab"');
    expect(tab).not.toMatch(
      /readonly property bool (?:activationEligible|keyboardTarget):[^\n]*windowCanNavigate/u,
    );
    expect(tab).toMatch(/`Tab \$\{[^}]*memberIndex \+ 1 : ""\}`/u);
    expect(tab).toContain("elide: Text.ElideRight");
    expect(tab).toContain("textFormat: Text.PlainText");

    expect(tab).toContain("acceptedButtons: Qt.LeftButton");
    expect(tab).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(tab).toContain("acceptedDevices: PointerDevice.TouchScreen");
    expect(tab).toContain("id: tabActivationHandler");
    expect(tab).toContain("gesturePolicy: TapHandler.ReleaseWithinBounds");
    expect(tab).not.toMatch(
      /id: tabActivationHandler[\s\S]{0,500}gesturePolicy: TapHandler\.DragThreshold/u,
    );
    expect(tab).toMatch(
      /id: tabActivationHandler[\s\S]*grabPermissions: PointerHandler\.ApprovesTakeOverByHandlersOfSameType\s*\| PointerHandler\.ApprovesTakeOverByHandlersOfDifferentType\s*\| PointerHandler\.ApprovesCancellation/u,
    );
    expect(tab).toContain("const candidate = windowPresentation.candidate;");
    expect(tab).toContain(
      "const expectedWindowId = windowPresentation.windowId;",
    );
    expect(tab).toContain(
      "const expectedDesktop = windowPresentation.sourceDesktop;",
    );
    expect(tab).toContain(
      "const expectedDesktopId = windowPresentation.sourceDesktopId;",
    );
    expect(tab).toContain(
      "const expectedScreen = windowPresentation.sourceScreen;",
    );
    expect(tab).toContain(
      "card.windowTapped(candidate, expectedWindowId, expectedDesktop,",
    );
    expect(tab).toContain("acceptedButtons: Qt.MiddleButton");
    expect(tab).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(tab).toContain("windowPresentation.closeEligible");
    expect(tab).toContain("!card.spatialDirectDragBlocked");
    expect(tab).toContain(
      "card.windowCloseRequested(windowPresentation.candidate,",
    );

    expect(planner).toContain("OverviewRuntime.DriftileOverview");
    expect(planner).toContain(
      'typeof runtime.planOverviewTabRail !== "function"',
    );
    expect(planner).toContain('column.presentation !== "tabbed"');
    expect(planner).toContain(
      "!indexedListHasBoundedLength(column.members, 2, 256)",
    );
    expect(planner).toContain("tabRailPlanIsExact(");
    expect(planner).toContain("minimumY: tabRailMinimumY");
    expect(planner).toContain(
      "const availableTop = Math.max(visibleTop, tabRailMinimumY);",
    );
    expect(planner).toContain("rail.y < availableTop - epsilon");
    expect(desktopCard).toContain("Object.isFrozen(plan)");
    expect(desktopCard).toContain("Object.isFrozen(plan.railFrame)");
    expect(desktopCard).toContain("Object.isFrozen(plan.chipFrames)");
    expect(desktopCard).toContain("Object.isFrozen(chip)");
    expect(frameLookup).toContain("tabRailPlanIsExact(");
    expect(frameLookup).toContain("tiled.memberIndex");
    expect(frameLookup).toContain(
      "tiledPresentations[expectedWindowId] !== tiled",
    );
    expect(frameLookup).toContain("member.windowId !== expectedWindowId");
    expect(frameLookup).toMatch(/catch \(error\) \{\s*return null;/u);
    expect(`${railLayer}\n${tab}\n${planner}\n${frameLookup}`).not.toMatch(
      /org\.kde\.kwin\.private|\.setValue\s*\(|KWin\.Workspace\.(?:stackingOrder|windows)/u,
    );
  });

  it("recovers exact minimized tab releases under exclusive primary ownership", () => {
    const tabStart = desktopCard.indexOf("id: tabShell");
    const tab = desktopCard.slice(
      tabStart,
      desktopCard.indexOf("id: thumbnailShell", tabStart),
    );
    const activationHandlerId = tab.indexOf("id: tabActivationHandler");
    const activationHandler = tab.slice(
      tab.lastIndexOf("TapHandler {", activationHandlerId),
      tab.indexOf("\n                    TapHandler {", activationHandlerId),
    );
    const recovery = tab.slice(
      tab.indexOf("function armMinimizedActivation("),
      tab.indexOf("function closeIsExact("),
    );
    const dispatch = tab.slice(
      tab.indexOf("function dispatchExactActivation("),
      tab.indexOf("function handleActivationGrabChanged("),
    );

    expect(tabStart).toBeGreaterThanOrEqual(0);
    expect(activationHandlerId).toBeGreaterThanOrEqual(0);
    expect(activationHandler).toContain(
      "gesturePolicy: TapHandler.ReleaseWithinBounds",
    );
    expect(activationHandler).not.toContain("TapHandler.DragThreshold");
    expect(activationHandler).toMatch(
      /grabPermissions: PointerHandler\.ApprovesTakeOverByHandlersOfSameType\s*\| PointerHandler\.ApprovesTakeOverByHandlersOfDifferentType\s*\| PointerHandler\.ApprovesCancellation/u,
    );
    expect(recovery).toMatch(
      /point\.state !== EventPoint\.Pressed[\s\S]*!minimizedTab[\s\S]*!activationIsExact\(\)[\s\S]*minimizedActivationSnapshot = Object\.freeze/u,
    );
    expect(recovery).toMatch(
      /candidate: windowPresentation\.candidate[\s\S]*windowId: windowPresentation\.windowId[\s\S]*sourceDesktop: windowPresentation\.sourceDesktop[\s\S]*sourceScreen: windowPresentation\.sourceScreen/u,
    );
    expect(recovery).toMatch(
      /frame: tabShell\.frame[\s\S]*overviewContextGeneration: card\.overviewContextGeneration[\s\S]*overviewActivityId: card\.overviewActivityId[\s\S]*outputId: card\.outputId/u,
    );
    expect(recovery).toMatch(
      /pointId,[\s\S]*device: point\.device[\s\S]*localX: localPosition\.x[\s\S]*sceneX: scenePosition\.x/u,
    );
    expect(recovery).not.toMatch(/(?:point|eventPoint):\s*point\b/u);
    expect(recovery).toMatch(
      /snapshot === minimizedActivationSnapshot[\s\S]*activationTappedSerial !== snapshot\.serial[\s\S]*activationCanceledSerial !== snapshot\.serial[\s\S]*activationConsumedSerial !== snapshot\.serial/u,
    );
    expect(recovery).toMatch(
      /PointerDevice\.CancelGrabPassive[\s\S]*PointerDevice\.CancelGrabExclusive[\s\S]*disarmMinimizedActivation\(\)/u,
    );
    expect(recovery).toMatch(
      /transition === PointerDevice\.GrabPassive\s*\|\| transition === PointerDevice\.GrabExclusive[\s\S]*EventPoint\.Pressed[\s\S]*armMinimizedActivation\(point\)/u,
    );
    expect(recovery).toMatch(
      /transition !== PointerDevice\.UngrabPassive\s*&& transition !== PointerDevice\.UngrabExclusive[\s\S]*EventPoint\.Released[\s\S]*Qt\.callLater/u,
    );
    expect(recovery).toMatch(
      /deltaX \* deltaX \+ deltaY \* deltaY <= threshold \* threshold[\s\S]*snapshot\.localX \+ release\.sceneX - snapshot\.sceneX[\s\S]*const releaseLocalPosition = Qt\.point[\s\S]*tabShell\.contains\(releaseLocalPosition\)[\s\S]*!card\.closeButtonContainsPoint\(tabCloseButton, tabShell,/u,
    );

    expect(activationHandler).toContain(
      "onCanceled: tabShell.disarmMinimizedActivation()",
    );
    expect(activationHandler).toContain(
      "onLongPressed: tabShell.disarmMinimizedActivation()",
    );
    expect(activationHandler).toMatch(
      /onEnabledChanged:[\s\S]*if \(!enabled\)[\s\S]*disarmMinimizedActivation\(\)/u,
    );
    const pressedChanged = activationHandler.slice(
      activationHandler.indexOf("onPressedChanged:"),
      activationHandler.indexOf("onTapped:"),
    );
    expect(pressedChanged).toContain(
      "activationSceneDisplacementIsWithinThreshold(",
    );
    expect(pressedChanged).not.toContain("point.state");

    expect(dispatch).toContain("activationCanceledSerial === serial");
    expect(dispatch.indexOf("activationConsumedSerial = serial;")).toBeLessThan(
      dispatch.indexOf("card.windowTapped("),
    );
    expect(`${recovery}\n${activationHandler}`).not.toMatch(
      /\bTimer\s*\{|org\.kde\.kwin\.private|\.setValue\s*\(/u,
    );
  });
  it("loads the runtime through the fail-closed adapter boundary", () => {
    expect(controller).toContain('import "../code/main.js" as OverviewRuntime');
    expect(controller).toContain("OverviewRuntime.DriftileOverview");
    expect(controller).toContain(
      "runtime.loadOverviewModel(document, snapshot)",
    );
    expect(controller).toContain("activityIds,");
    expect(controller).toContain("currentActivityId,");
    expect(controller).toContain("KWin.Workspace.activities");
    expect(controller).toContain("KWin.Workspace.currentActivity");
    expect(controller).toMatch(
      /for \(const window of KWin\.Workspace\.stackingOrder\)[\s\S]*const bounds = liveWindowHeightBound\(window, windowId\);[\s\S]*windowHeightBounds\.push\(bounds\);/u,
    );
    expect(controller).toMatch(
      /function liveWindowHeightBound\(window, windowId\)[\s\S]*window\.frameGeometry\.height[\s\S]*window\.clientGeometry\.height[\s\S]*window\.minSize\.height[\s\S]*window\.maxSize\.height[\s\S]*Number\.POSITIVE_INFINITY/u,
    );
    expect(controller).toMatch(
      /rawMaximumClientHeight > 0 && rawMaximumClientHeight <= maximumMagnitude[\s\S]*\? rawMaximumClientHeight : Number\.POSITIVE_INFINITY/u,
    );
    expect(controller).not.toMatch(/maximumClientHeight > maximumMagnitude/u);
    expect(controller).toContain("result.ok !== true");
    expect(controller).toContain("overviewModel = null");
  });
});
