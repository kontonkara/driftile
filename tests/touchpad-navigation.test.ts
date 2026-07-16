import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KWinWorkspace } from "../src/platform/kwin/api";

const mainQml = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/main.qml",
    import.meta.url,
  ),
  "utf8",
);
const touchpadQml = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/TouchpadNavigation.qml",
    import.meta.url,
  ),
  "utf8",
);
const touchpadWorkspaceQml = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/TouchpadWorkspaceNavigation.qml",
    import.meta.url,
  ),
  "utf8",
);
const configuration = readFileSync(
  new URL("../packaging/kwin-script/contents/config/main.xml", import.meta.url),
  "utf8",
);
const configurationUi = readFileSync(
  new URL("../packaging/kwin-script/contents/ui/config.ui", import.meta.url),
  "utf8",
);
const runtimeSource = readFileSync(
  new URL("../src/runtime.ts", import.meta.url),
  "utf8",
);
const packageCheck = readFileSync(
  new URL("../tools/check-package.mjs", import.meta.url),
  "utf8",
);

class RuntimeControllerDouble {
  readonly lastWriteCount = 0;
  readonly managedCount = 0;

  start(): boolean {
    return true;
  }

  stop(): void {}

  setApplicationBorderlessExclusions(): boolean {
    return true;
  }

  setApplicationColumnPresentations(): boolean {
    return true;
  }

  setApplicationColumnWidths(): boolean {
    return true;
  }

  setApplicationWindowHeights(): boolean {
    return true;
  }

  setApplicationFocusCentering(): boolean {
    return true;
  }

  setApplicationFloatingPositions(): boolean {
    return true;
  }

  setApplicationInitialDestinations(): boolean {
    return true;
  }

  setApplicationInitialFocused(): boolean {
    return true;
  }

  setApplicationInitialUnfocused(): boolean {
    return true;
  }

  setApplicationInitialFloating(): boolean {
    return true;
  }

  setApplicationInitialFullWidth(): boolean {
    return true;
  }

  setApplicationInitialFullscreen(): boolean {
    return true;
  }

  setApplicationInitialMaximized(): boolean {
    return true;
  }

  setApplicationTilingExclusions(): boolean {
    return true;
  }

  setAlwaysCenterSingleColumn(): boolean {
    return true;
  }

  setBorderlessWindows(): boolean {
    return true;
  }

  setCenterFocusedColumn(): boolean {
    return true;
  }

  setCenterFocusedColumnOnOverflow(): boolean {
    return true;
  }

  setColumnWidthPresets(): boolean {
    return true;
  }

  setColumnWidthStepPercent(): boolean {
    return true;
  }

  setColumnWidthStepPixels(): boolean {
    return true;
  }

  setDefaultColumnWidthPercent(): boolean {
    return true;
  }

  setDefaultColumnWidth(): boolean {
    return true;
  }

  setDefaultColumnPresentation(): boolean {
    return true;
  }

  setDefaultFloatingPosition(): boolean {
    return true;
  }

  setDefaultInitialDestination(): boolean {
    return true;
  }

  setDefaultInitialFocus(): boolean {
    return true;
  }

  setDefaultWindowHeight(): boolean {
    return true;
  }

  setEmptyDesktopAboveFirst(): boolean {
    return true;
  }

  setGap(): boolean {
    return true;
  }

  setNumberedDesktopTargets(): boolean {
    return true;
  }

  setWindowHeightPresets(): boolean {
    return true;
  }

  setWindowHeightStepPercent(): boolean {
    return true;
  }

  setWindowHeightStepPixels(): boolean {
    return true;
  }

  setWorkspaceAutoBackAndForth(): boolean {
    return true;
  }
}

afterEach(() => {
  vi.doUnmock("../src/runtime-controller");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("touchpad navigation", () => {
  it("keeps navigation opt-in while exposing bounded direction settings", () => {
    const entry = configuration.match(
      /<entry name="TouchpadNavigation" type="Bool">([\s\S]*?)<\/entry>/u,
    )?.[1];
    const fingerCountEntry = configuration.match(
      /<entry name="TouchpadNavigationFingerCount" type="Int">([\s\S]*?)<\/entry>/u,
    )?.[1];
    const workspaceEntry = configuration.match(
      /<entry name="TouchpadWorkspaceNavigation" type="Bool">([\s\S]*?)<\/entry>/u,
    )?.[1];
    const naturalScrollEntry = configuration.match(
      /<entry name="TouchpadNaturalScroll" type="Bool">([\s\S]*?)<\/entry>/u,
    )?.[1];

    expect(entry).toContain("<default>false</default>");
    expect(workspaceEntry).toContain("<default>false</default>");
    expect(fingerCountEntry).toContain("<default>5</default>");
    expect(fingerCountEntry).toContain("<min>3</min>");
    expect(fingerCountEntry).toContain("<max>5</max>");
    expect(naturalScrollEntry).toContain("<default>true</default>");
    expect(configurationUi).toContain('name="kcfg_TouchpadNavigation"');
    expect(configurationUi).toContain(
      'name="kcfg_TouchpadWorkspaceNavigation"',
    );
    expect(configurationUi).toContain(
      'name="kcfg_TouchpadNavigationFingerCount"',
    );
    expect(configurationUi).toContain('name="kcfg_TouchpadNaturalScroll"');
  });

  it("creates only two activation-only variable-finger touchpad handlers", () => {
    expect(touchpadQml.match(/SwipeGestureHandler \{/gu)).toHaveLength(2);
    expect(
      touchpadQml.match(/deviceType: SwipeGestureHandler\.Device\.Touchpad/gu),
    ).toHaveLength(2);
    expect(touchpadQml).toContain("required property int fingerCount");
    expect(touchpadQml).toContain("required property bool naturalScroll");
    expect(touchpadQml.match(/fingerCount: root\.fingerCount/gu)).toHaveLength(
      2,
    );
    expect(touchpadQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Left[\s\S]*if \(root\.naturalScroll\) \{\s*root\.focusRightRequested\(\);\s*\} else \{\s*root\.focusLeftRequested\(\);/u,
    );
    expect(touchpadQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Right[\s\S]*if \(root\.naturalScroll\) \{\s*root\.focusLeftRequested\(\);\s*\} else \{\s*root\.focusRightRequested\(\);/u,
    );
    expect(touchpadQml).not.toMatch(
      /onCancelled|onProgressChanged|\bprogress\s*:|ShortcutHandler|sequence\s*:|Timer|action/iu,
    );
    expect(touchpadQml).toContain(
      'Component.onCompleted: console.info("[driftile] touchpad-navigation lifecycle=created")',
    );
    expect(touchpadQml).toContain(
      'Component.onDestruction: console.info("[driftile] touchpad-navigation lifecycle=destroyed")',
    );
    expect(touchpadQml.match(/Component\.on/gu)).toHaveLength(2);
    expect(touchpadQml.match(/console\.info\(/gu)).toHaveLength(2);
  });

  it("creates only two activation-only vertical desktop handlers", () => {
    expect(touchpadWorkspaceQml.match(/SwipeGestureHandler \{/gu)).toHaveLength(
      2,
    );
    expect(
      touchpadWorkspaceQml.match(
        /deviceType: SwipeGestureHandler\.Device\.Touchpad/gu,
      ),
    ).toHaveLength(2);
    expect(touchpadWorkspaceQml).toContain("required property int fingerCount");
    expect(touchpadWorkspaceQml).toContain(
      "required property bool naturalScroll",
    );
    expect(
      touchpadWorkspaceQml.match(/fingerCount: root\.fingerCount/gu),
    ).toHaveLength(2);
    expect(touchpadWorkspaceQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Up[\s\S]*if \(root\.naturalScroll\) \{\s*root\.focusNextDesktopRequested\(\);\s*\} else \{\s*root\.focusPreviousDesktopRequested\(\);/u,
    );
    expect(touchpadWorkspaceQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Down[\s\S]*if \(root\.naturalScroll\) \{\s*root\.focusPreviousDesktopRequested\(\);\s*\} else \{\s*root\.focusNextDesktopRequested\(\);/u,
    );
    expect(touchpadWorkspaceQml).not.toMatch(
      /onCancelled|onProgressChanged|\bprogress\s*:|ShortcutHandler|sequence\s*:|Timer|action/iu,
    );
  });

  it("recreates only enabled handler pairs from accepted applied settings", () => {
    expect(mainQml).toContain("property bool appliedTouchpadNavigation: false");
    expect(mainQml).toContain(
      "property bool appliedTouchpadWorkspaceNavigation: false",
    );
    expect(mainQml).toContain(
      "property int appliedTouchpadNavigationFingerCount: 5",
    );
    expect(mainQml).toContain(
      "property bool appliedTouchpadNaturalScroll: true",
    );
    expect(mainQml).toMatch(
      /readonly property Loader touchpadNavigationLoader: Loader \{\s*active: false\s*\}/u,
    );
    expect(mainQml).toMatch(
      /readonly property Loader touchpadWorkspaceNavigationLoader: Loader \{\s*active: false\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function onConfigChanged\(\) \{\s*root\.applySettings\(root\.readSettings\(\)\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function applySettings\(settings\) \{[\s\S]*root\.refreshTouchpadNavigationHandlers\(false\);\s*\}/u,
    );
    expect(mainQml).toContain(
      'touchpadNavigation: KWin.readConfig("TouchpadNavigation", false)',
    );
    expect(mainQml).toContain(
      'touchpadWorkspaceNavigation: KWin.readConfig("TouchpadWorkspaceNavigation", false)',
    );
    expect(mainQml).toContain(
      'touchpadNavigationFingerCount: KWin.readConfig("TouchpadNavigationFingerCount", 5)',
    );
    expect(mainQml).toContain(
      'touchpadNaturalScroll: KWin.readConfig("TouchpadNaturalScroll", true)',
    );
    expect(mainQml).toContain(
      'centerFocusedColumnOnOverflow: KWin.readConfig("CenterFocusedColumnOnOverflow", false)',
    );
    expect(mainQml).toMatch(
      /function refreshTouchpadNavigationHandlers\(force\) \{[\s\S]*Runtime\.DriftileRuntime\.getTouchpadWorkspaceNavigation\(\)[\s\S]*gesturePropertiesChanged[\s\S]*touchpadNavigationChanged[\s\S]*touchpadWorkspaceNavigationChanged[\s\S]*root\.rebuildTouchpadNavigationHandler\(\);[\s\S]*root\.rebuildTouchpadWorkspaceNavigationHandler\(\);[\s\S]*\}/u,
    );
    expect(mainQml).toMatch(
      /function rebuildTouchpadNavigationHandler\(\) \{[\s\S]*touchpadNavigationLoader\.active = false;[\s\S]*if \(!root\.appliedTouchpadNavigation\) \{\s*return;\s*\}[\s\S]*touchpadNavigationLoader\.setSource\("TouchpadNavigation\.qml", \{\s*fingerCount: root\.appliedTouchpadNavigationFingerCount,\s*naturalScroll: root\.appliedTouchpadNaturalScroll\s*\}\);[\s\S]*touchpadNavigationLoader\.active = true;[\s\S]*\}/u,
    );
    expect(mainQml).toMatch(
      /function rebuildTouchpadWorkspaceNavigationHandler\(\) \{[\s\S]*touchpadWorkspaceNavigationLoader\.active = false;[\s\S]*if \(!root\.appliedTouchpadWorkspaceNavigation\) \{\s*return;\s*\}[\s\S]*touchpadWorkspaceNavigationLoader\.setSource\("TouchpadWorkspaceNavigation\.qml", \{\s*fingerCount: root\.appliedTouchpadNavigationFingerCount,\s*naturalScroll: root\.appliedTouchpadNaturalScroll\s*\}\);[\s\S]*touchpadWorkspaceNavigationLoader\.active = true;[\s\S]*\}/u,
    );
    expect(mainQml).not.toMatch(/\.item\.(?:fingerCount|naturalScroll)\s*=/u);
    expect(mainQml).toContain(
      'applicationBorderlessExclusions: KWin.readConfig("ApplicationBorderlessExclusions", "")',
    );
    expect(mainQml).toContain(
      'applicationFocusCentering: KWin.readConfig("ApplicationFocusCentering", "")',
    );
    expect(mainQml).toContain(
      'applicationFloatingPositions: KWin.readConfig("ApplicationFloatingPositions", "")',
    );
    expect(mainQml).toContain(
      'applicationInitialDestinations: KWin.readConfig("ApplicationInitialDestinations", "")',
    );
    expect(mainQml).toContain(
      'applicationInitialFloating: KWin.readConfig("ApplicationInitialFloating", "")',
    );
    expect(mainQml).toContain(
      'defaultFloatingPosition: KWin.readConfig("DefaultFloatingPosition", "")',
    );
    expect(mainQml).toContain(
      'defaultInitialDestination: KWin.readConfig("DefaultInitialDestination", "")',
    );
    expect(mainQml).toContain(
      'defaultInitialFocus: KWin.readConfig("DefaultInitialFocus", "default")',
    );
    expect(mainQml).toContain("root.refreshTouchpadNavigationHandlers(true)");
    expect(mainQml).toMatch(
      /function onFocusLeftRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusLeft\(\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function onFocusRightRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusRight\(\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function onFocusPreviousDesktopRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusPreviousDesktopUnderPointer\(\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function onFocusNextDesktopRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusNextDesktopUnderPointer\(\)\s*\}/u,
    );
  });

  it("exposes the accepted setting across invalid, init, apply, and destroy lifecycle", async () => {
    vi.doMock("../src/runtime-controller", () => ({
      RuntimeController: RuntimeControllerDouble,
    }));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const runtime = await import("../src/runtime");

    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);
    expect(
      runtime.applySettings(
        settings({
          touchpadNaturalScroll: false,
          touchpadNavigation: true,
          touchpadWorkspaceNavigation: true,
          touchpadNavigationFingerCount: 3,
        }),
      ),
    ).toBe(false);
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);

    runtime.init(
      { screens: [] } as unknown as KWinWorkspace,
      2,
      (x, y, width, height) => ({ height, width, x, y }),
      () => {},
      () => {},
      settings(),
      "",
      () => {},
    );

    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);
    expect(
      runtime.applySettings(settings({ gap: 65, touchpadNavigation: true })),
    ).toBe(false);
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(
      runtime.applySettings(
        settings({
          touchpadNaturalScroll: false,
          touchpadNavigation: true,
          touchpadWorkspaceNavigation: true,
          touchpadNavigationFingerCount: 3,
        }),
      ),
    ).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(true);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(true);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(3);
    expect(runtime.getTouchpadNaturalScroll()).toBe(false);
    expect(runtime.applySettings(settings())).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);

    runtime.destroy();
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);
  });

  it("keeps the runtime getter and package file in their exact contracts", () => {
    expect(runtimeSource).toMatch(
      /export function getTouchpadNavigation\(\): boolean \{\s*return appliedSettings\?\.touchpadNavigation === true;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function getTouchpadWorkspaceNavigation\(\): boolean \{\s*return appliedSettings\?\.touchpadWorkspaceNavigation === true;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function getTouchpadNavigationFingerCount\(\): number \{\s*return appliedSettings\?\.touchpadNavigationFingerCount \?\? 5;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function getTouchpadNaturalScroll\(\): boolean \{\s*return appliedSettings\?\.touchpadNaturalScroll \?\? true;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function focusPreviousDesktopUnderPointer\(\): void \{\s*runCommand\(\(activeController\) =>\s*activeController\.focusPreviousDesktopUnderPointer\(\),\s*\);\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function focusNextDesktopUnderPointer\(\): void \{\s*runCommand\(\(activeController\) =>\s*activeController\.focusNextDesktopUnderPointer\(\),\s*\);\s*\}/u,
    );
    expect(packageCheck).toContain('"ui/TouchpadNavigation.qml"');
    expect(packageCheck).toContain('"ui/TouchpadWorkspaceNavigation.qml"');
  });
});

function settings(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    applicationBorderlessExclusions: "",
    applicationColumnPresentations: "",
    applicationColumnWidths: "",
    applicationWindowHeights: "",
    applicationFocusCentering: "",
    applicationFloatingPositions: "",
    applicationInitialDestinations: "",
    applicationInitialFocused: "",
    applicationInitialUnfocused: "",
    applicationInitialFloating: "",
    applicationInitialFullWidth: "",
    applicationInitialFullscreen: "",
    applicationInitialMaximized: "",
    applicationTilingExclusions: "",
    alwaysCenterSingleColumn: false,
    borderlessWindows: true,
    centerFocusedColumn: false,
    centerFocusedColumnOnOverflow: false,
    columnWidthPresets: "",
    columnWidthStepPixels: 0,
    columnWidthStepPercent: 10,
    defaultColumnPresentation: "stacked",
    defaultColumnWidthPercent: 50,
    defaultColumnWidthPixels: 0,
    defaultFloatingPosition: "",
    defaultInitialDestination: "",
    defaultInitialFocus: "default",
    defaultWindowHeight: "auto",
    emptyDesktopAboveFirst: false,
    gap: 16,
    numberedDesktopTargets: "",
    showTabIndicator: true,
    touchpadNavigation: false,
    touchpadWorkspaceNavigation: false,
    touchpadNavigationFingerCount: 5,
    touchpadNaturalScroll: true,
    windowHeightPresets: "",
    windowHeightStepPixels: 0,
    windowHeightStepPercent: 10,
    workspaceAutoBackAndForth: false,
    ...overrides,
  };
}
