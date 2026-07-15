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

  setApplicationFocusCentering(): boolean {
    return true;
  }

  setApplicationInitialFloating(): boolean {
    return true;
  }

  setApplicationTilingExclusions(): boolean {
    return true;
  }

  setBorderlessWindows(): boolean {
    return true;
  }

  setCenterFocusedColumn(): boolean {
    return true;
  }

  setColumnWidthPresets(): boolean {
    return true;
  }

  setColumnWidthStepPercent(): boolean {
    return true;
  }

  setDefaultColumnWidthPercent(): boolean {
    return true;
  }

  setDefaultColumnPresentation(): boolean {
    return true;
  }

  setGap(): boolean {
    return true;
  }

  setWindowHeightPresets(): boolean {
    return true;
  }

  setWindowHeightStepPercent(): boolean {
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
    const naturalScrollEntry = configuration.match(
      /<entry name="TouchpadNaturalScroll" type="Bool">([\s\S]*?)<\/entry>/u,
    )?.[1];

    expect(entry).toContain("<default>false</default>");
    expect(fingerCountEntry).toContain("<default>5</default>");
    expect(fingerCountEntry).toContain("<min>3</min>");
    expect(fingerCountEntry).toContain("<max>5</max>");
    expect(naturalScrollEntry).toContain("<default>true</default>");
    expect(configurationUi).toContain('name="kcfg_TouchpadNavigation"');
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
    expect(touchpadQml).toContain("property int fingerCount: 5");
    expect(touchpadQml).toContain("property bool naturalScroll: true");
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

  it("loads and updates the handler pair only from accepted applied settings", () => {
    expect(mainQml).toContain("property bool appliedTouchpadNavigation: false");
    expect(mainQml).toContain(
      "property int appliedTouchpadNavigationFingerCount: 5",
    );
    expect(mainQml).toContain(
      "property bool appliedTouchpadNaturalScroll: true",
    );
    expect(mainQml).toMatch(
      /readonly property Loader touchpadNavigationLoader: Loader \{[\s\S]*active: root\.appliedTouchpadNavigation[\s\S]*source: "TouchpadNavigation\.qml"[\s\S]*onLoaded: root\.updateTouchpadNavigationHandler\(\)[\s\S]*\}/u,
    );
    expect(mainQml).toMatch(
      /function onConfigChanged\(\) \{\s*root\.applySettings\(root\.readSettings\(\)\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function applySettings\(settings\) \{[\s\S]*root\.appliedTouchpadNavigation = Runtime\.DriftileRuntime\.getTouchpadNavigation\(\);[\s\S]*root\.appliedTouchpadNavigationFingerCount = Runtime\.DriftileRuntime\.getTouchpadNavigationFingerCount\(\);[\s\S]*root\.appliedTouchpadNaturalScroll = Runtime\.DriftileRuntime\.getTouchpadNaturalScroll\(\);[\s\S]*root\.updateTouchpadNavigationHandler\(\);\s*\}/u,
    );
    expect(mainQml).toContain(
      'touchpadNavigation: KWin.readConfig("TouchpadNavigation", false)',
    );
    expect(mainQml).toContain(
      'touchpadNavigationFingerCount: KWin.readConfig("TouchpadNavigationFingerCount", 5)',
    );
    expect(mainQml).toContain(
      'touchpadNaturalScroll: KWin.readConfig("TouchpadNaturalScroll", true)',
    );
    expect(mainQml).toMatch(
      /function updateTouchpadNavigationHandler\(\) \{[\s\S]*handler\.fingerCount = root\.appliedTouchpadNavigationFingerCount;[\s\S]*handler\.naturalScroll = root\.appliedTouchpadNaturalScroll;[\s\S]*\}/u,
    );
    expect(mainQml).toContain(
      'applicationBorderlessExclusions: KWin.readConfig("ApplicationBorderlessExclusions", "")',
    );
    expect(mainQml).toContain(
      'applicationFocusCentering: KWin.readConfig("ApplicationFocusCentering", "")',
    );
    expect(mainQml).toContain(
      'applicationInitialFloating: KWin.readConfig("ApplicationInitialFloating", "")',
    );
    expect(
      mainQml.match(
        /root\.appliedTouchpadNavigation = Runtime\.DriftileRuntime\.getTouchpadNavigation\(\);/gu,
      ),
    ).toHaveLength(2);
    expect(
      mainQml.match(
        /root\.appliedTouchpadNavigationFingerCount = Runtime\.DriftileRuntime\.getTouchpadNavigationFingerCount\(\);/gu,
      ),
    ).toHaveLength(2);
    expect(
      mainQml.match(
        /root\.appliedTouchpadNaturalScroll = Runtime\.DriftileRuntime\.getTouchpadNaturalScroll\(\);/gu,
      ),
    ).toHaveLength(2);
    expect(mainQml).toMatch(
      /function onFocusLeftRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusLeft\(\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function onFocusRightRequested\(\) \{\s*Runtime\.DriftileRuntime\.focusRight\(\)\s*\}/u,
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
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);
    expect(
      runtime.applySettings(
        settings({
          touchpadNaturalScroll: false,
          touchpadNavigation: true,
          touchpadNavigationFingerCount: 3,
        }),
      ),
    ).toBe(false);
    expect(runtime.getTouchpadNavigation()).toBe(false);
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
          touchpadNavigationFingerCount: 3,
        }),
      ),
    ).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(true);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(3);
    expect(runtime.getTouchpadNaturalScroll()).toBe(false);
    expect(runtime.applySettings(settings())).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);

    runtime.destroy();
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(5);
    expect(runtime.getTouchpadNaturalScroll()).toBe(true);
  });

  it("keeps the runtime getter and package file in their exact contracts", () => {
    expect(runtimeSource).toMatch(
      /export function getTouchpadNavigation\(\): boolean \{\s*return appliedSettings\?\.touchpadNavigation === true;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function getTouchpadNavigationFingerCount\(\): number \{\s*return appliedSettings\?\.touchpadNavigationFingerCount \?\? 5;\s*\}/u,
    );
    expect(runtimeSource).toMatch(
      /export function getTouchpadNaturalScroll\(\): boolean \{\s*return appliedSettings\?\.touchpadNaturalScroll \?\? true;\s*\}/u,
    );
    expect(packageCheck).toContain('"ui/TouchpadNavigation.qml"');
  });
});

function settings(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    applicationBorderlessExclusions: "",
    applicationColumnPresentations: "",
    applicationColumnWidths: "",
    applicationFocusCentering: "",
    applicationInitialFloating: "",
    applicationTilingExclusions: "",
    borderlessWindows: true,
    centerFocusedColumn: false,
    columnWidthPresets: "",
    columnWidthStepPercent: 10,
    defaultColumnPresentation: "stacked",
    defaultColumnWidthPercent: 50,
    gap: 16,
    showTabIndicator: true,
    touchpadNavigation: false,
    touchpadNavigationFingerCount: 5,
    touchpadNaturalScroll: true,
    windowHeightPresets: "",
    windowHeightStepPercent: 10,
    ...overrides,
  };
}
