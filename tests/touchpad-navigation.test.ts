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
  it("keeps the setting opt-in across KConfig and the KCM", () => {
    const entry = configuration.match(
      /<entry name="TouchpadNavigation" type="Bool">([\s\S]*?)<\/entry>/u,
    )?.[1];

    expect(entry).toContain("<default>false</default>");
    expect(configurationUi).toContain('name="kcfg_TouchpadNavigation"');
  });

  it("creates only two activation-only five-finger touchpad handlers with inverse focus mapping", () => {
    expect(touchpadQml.match(/SwipeGestureHandler \{/gu)).toHaveLength(2);
    expect(
      touchpadQml.match(/deviceType: SwipeGestureHandler\.Device\.Touchpad/gu),
    ).toHaveLength(2);
    expect(touchpadQml.match(/fingerCount: 5/gu)).toHaveLength(2);
    expect(touchpadQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Left[\s\S]*onActivated: root\.focusRightRequested\(\)/u,
    );
    expect(touchpadQml).toMatch(
      /direction: SwipeGestureHandler\.Direction\.Right[\s\S]*onActivated: root\.focusLeftRequested\(\)/u,
    );
    expect(touchpadQml).not.toMatch(
      /onCancelled|onProgressChanged|\bprogress\s*:|ShortcutHandler|sequence\s*:|action/iu,
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

  it("loads and destroys the handler pair only from the accepted applied setting", () => {
    expect(mainQml).toContain("property bool appliedTouchpadNavigation: false");
    expect(mainQml).toMatch(
      /readonly property Loader touchpadNavigationLoader: Loader \{[\s\S]*active: root\.appliedTouchpadNavigation[\s\S]*source: "TouchpadNavigation\.qml"[\s\S]*\}/u,
    );
    expect(mainQml).toMatch(
      /function onConfigChanged\(\) \{\s*root\.applySettings\(root\.readSettings\(\)\)\s*\}/u,
    );
    expect(mainQml).toMatch(
      /function applySettings\(settings\) \{\s*if \(!Runtime\.DriftileRuntime\.applySettings\(settings\)\) \{\s*return;\s*\}\s*root\.appliedTouchpadNavigation = Runtime\.DriftileRuntime\.getTouchpadNavigation\(\);\s*\}/u,
    );
    expect(mainQml).toContain(
      'touchpadNavigation: KWin.readConfig("TouchpadNavigation", false)',
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
    expect(runtime.applySettings(settings({ touchpadNavigation: true }))).toBe(
      false,
    );
    expect(runtime.getTouchpadNavigation()).toBe(false);

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
    expect(
      runtime.applySettings(settings({ gap: 65, touchpadNavigation: true })),
    ).toBe(false);
    expect(runtime.getTouchpadNavigation()).toBe(false);
    expect(runtime.applySettings(settings({ touchpadNavigation: true }))).toBe(
      true,
    );
    expect(runtime.getTouchpadNavigation()).toBe(true);
    expect(runtime.applySettings(settings())).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(false);

    runtime.destroy();
    expect(runtime.getTouchpadNavigation()).toBe(false);
  });

  it("keeps the runtime getter and package file in their exact contracts", () => {
    expect(runtimeSource).toMatch(
      /export function getTouchpadNavigation\(\): boolean \{\s*return appliedSettings\?\.touchpadNavigation === true;\s*\}/u,
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
    windowHeightPresets: "",
    windowHeightStepPercent: 10,
    ...overrides,
  };
}
