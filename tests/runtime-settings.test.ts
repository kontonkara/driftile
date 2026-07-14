import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationBorderlessExclusions } from "../src/application-borderless-exclusions";
import type { ApplicationInitialFloating } from "../src/application-initial-floating";
import type { ApplicationColumnWidthOverrides } from "../src/application-overrides";
import type { ApplicationTilingExclusions } from "../src/application-tiling-exclusions";
import type { KWinWorkspace } from "../src/platform/kwin/api";

interface DeliveredSettings {
  readonly applicationBorderlessExclusions: readonly string[];
  readonly applicationColumnWidths: readonly string[];
  readonly applicationInitialFloating: readonly string[];
  readonly applicationTilingExclusions: readonly string[];
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly columnWidthPresets: readonly number[];
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidthPercent: number;
  readonly gap: number;
  readonly windowHeightStepPercent: number;
}

type RuntimeSettingsInput = Record<keyof DeliveredSettings, unknown> & {
  readonly touchpadNavigation: unknown;
};

interface RuntimeControllerOptions {
  readonly applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly borderlessWindows: boolean;
  readonly gap: number;
  readonly schedule: (callback: () => void) => void;
}

const controllerInstances: RuntimeControllerDouble[] = [];

class RuntimeControllerDouble {
  readonly borderDeliverySnapshots: Array<{
    readonly applicationBorderlessExclusions: readonly string[];
    readonly borderlessWindows: boolean;
  }> = [];
  readonly calls: string[] = [];
  readonly deferredSnapshots: DeliveredSettings[] = [];
  readonly lastWriteCount = 0;
  readonly managedCount = 0;
  private readonly schedule: (callback: () => void) => void;
  private state: DeliveredSettings;

  constructor(_workspace: unknown, options: RuntimeControllerOptions) {
    this.schedule = options.schedule;
    this.state = {
      applicationBorderlessExclusions:
        options.applicationBorderlessExclusions.canonicalEntries,
      applicationColumnWidths: options.applicationColumnWidths.canonicalEntries,
      applicationInitialFloating:
        options.applicationInitialFloating.canonicalEntries,
      applicationTilingExclusions:
        options.applicationTilingExclusions.canonicalEntries,
      borderlessWindows: options.borderlessWindows,
      centerFocusedColumn: false,
      columnWidthPresets: [],
      columnWidthStepPercent: 1,
      defaultColumnWidthPercent: 10,
      gap: options.gap,
      windowHeightStepPercent: 1,
    };
    controllerInstances.push(this);
  }

  get deliveredSettings(): DeliveredSettings {
    return snapshot(this.state);
  }

  start(): boolean {
    return true;
  }

  stop(): void {}

  setApplicationColumnWidths(
    overrides: ApplicationColumnWidthOverrides,
  ): boolean {
    this.calls.push("applicationColumnWidths");
    this.state = {
      ...this.state,
      applicationColumnWidths: overrides.canonicalEntries,
    };
    return true;
  }

  setApplicationBorderlessExclusions(
    exclusions: ApplicationBorderlessExclusions,
  ): boolean {
    this.calls.push("applicationBorderlessExclusions");
    this.state = {
      ...this.state,
      applicationBorderlessExclusions: exclusions.canonicalEntries,
    };
    this.captureBorderDelivery();
    return true;
  }

  setApplicationInitialFloating(
    applications: ApplicationInitialFloating,
  ): boolean {
    this.calls.push("applicationInitialFloating");
    this.state = {
      ...this.state,
      applicationInitialFloating: applications.canonicalEntries,
    };
    return true;
  }

  setApplicationTilingExclusions(
    exclusions: ApplicationTilingExclusions,
  ): boolean {
    this.calls.push("applicationTilingExclusions");
    this.state = {
      ...this.state,
      applicationTilingExclusions: exclusions.canonicalEntries,
    };
    this.schedule(() => {
      this.deferredSnapshots.push(snapshot(this.state));
    });
    return true;
  }

  setBorderlessWindows(value: boolean): boolean {
    this.calls.push("borderlessWindows");
    this.state = { ...this.state, borderlessWindows: value };
    this.captureBorderDelivery();
    return true;
  }

  private captureBorderDelivery(): void {
    this.borderDeliverySnapshots.push({
      applicationBorderlessExclusions: [
        ...this.state.applicationBorderlessExclusions,
      ],
      borderlessWindows: this.state.borderlessWindows,
    });
  }

  setCenterFocusedColumn(value: boolean): boolean {
    this.calls.push("centerFocusedColumn");
    this.state = { ...this.state, centerFocusedColumn: value };
    return true;
  }

  setColumnWidthPresets(values: readonly number[]): boolean {
    this.calls.push("columnWidthPresets");
    this.state = { ...this.state, columnWidthPresets: [...values] };
    return true;
  }

  setColumnWidthStepPercent(value: number): boolean {
    this.calls.push("columnWidthStepPercent");
    this.state = { ...this.state, columnWidthStepPercent: value };
    return true;
  }

  setDefaultColumnWidthPercent(value: number): boolean {
    this.calls.push("defaultColumnWidthPercent");
    this.state = { ...this.state, defaultColumnWidthPercent: value };
    return true;
  }

  setGap(value: number): boolean {
    this.calls.push("gap");
    this.state = { ...this.state, gap: value };
    return true;
  }

  setWindowHeightStepPercent(value: number): boolean {
    this.calls.push("windowHeightStepPercent");
    this.state = { ...this.state, windowHeightStepPercent: value };
    return true;
  }
}

afterEach(() => {
  controllerInstances.length = 0;
  vi.doUnmock("../src/runtime-controller");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("runtime settings delivery", () => {
  it("keeps invalid ownership and disables borders before replacing exclusions", async () => {
    vi.doMock("../src/runtime-controller", () => ({
      RuntimeController: RuntimeControllerDouble,
    }));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const runtime = await import("../src/runtime");
    const deferredWork: Array<() => void> = [];
    const schedule = (callback: () => void): void => {
      deferredWork.push(callback);
    };
    const initial = settings({
      applicationBorderlessExclusions: "org.example.InitialBorder",
      applicationInitialFloating: "org.example.InitialFloat",
      applicationTilingExclusions: "org.example.InitiallyExcluded",
    });

    runtime.init(
      { screens: [] } as unknown as KWinWorkspace,
      2,
      (x, y, width, height) => ({ height, width, x, y }),
      schedule,
      schedule,
      initial,
      "",
      () => {},
    );

    const controller = controllerInstances[0];

    if (!controller) {
      throw new Error("runtime controller test double was not created");
    }

    controller.calls.length = 0;
    controller.borderDeliverySnapshots.length = 0;
    expect(controller.deliveredSettings.applicationTilingExclusions).toEqual([
      "org.example.InitiallyExcluded",
    ]);
    expect(controller.deliveredSettings.applicationInitialFloating).toEqual([
      "org.example.InitialFloat",
    ]);

    expect(
      runtime.applySettings(
        settings({ applicationTilingExclusions: "", gap: 65 }),
      ),
    ).toBe(false);
    expect(controller.calls).toEqual([]);
    expect(deferredWork).toEqual([]);
    expect(controller.deliveredSettings.applicationTilingExclusions).toEqual([
      "org.example.InitiallyExcluded",
    ]);

    const next = settings({
      applicationBorderlessExclusions: "org.example.NewBorder",
      applicationColumnWidths: "org.example.Editor=75",
      applicationInitialFloating: "org.example.NewFloat",
      applicationTilingExclusions: "org.example.NewlyExcluded",
      borderlessWindows: false,
      centerFocusedColumn: true,
      columnWidthPresets: "20,50,80",
      columnWidthStepPercent: 13,
      defaultColumnWidthPercent: 65,
      gap: 7,
      touchpadNavigation: true,
      windowHeightStepPercent: 17,
    });
    const expected: DeliveredSettings = {
      applicationBorderlessExclusions: ["org.example.NewBorder"],
      applicationColumnWidths: ["org.example.Editor=75"],
      applicationInitialFloating: ["org.example.NewFloat"],
      applicationTilingExclusions: ["org.example.NewlyExcluded"],
      borderlessWindows: false,
      centerFocusedColumn: true,
      columnWidthPresets: [20, 50, 80],
      columnWidthStepPercent: 13,
      defaultColumnWidthPercent: 65,
      gap: 7,
      windowHeightStepPercent: 17,
    };

    expect(runtime.applySettings(next)).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(true);
    expect(controller.calls).toEqual([
      "borderlessWindows",
      "applicationBorderlessExclusions",
      "applicationColumnWidths",
      "applicationInitialFloating",
      "applicationTilingExclusions",
      "centerFocusedColumn",
      "defaultColumnWidthPercent",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "windowHeightStepPercent",
      "gap",
    ]);
    expect(controller.borderDeliverySnapshots).toEqual([
      {
        applicationBorderlessExclusions: ["org.example.InitialBorder"],
        borderlessWindows: false,
      },
      {
        applicationBorderlessExclusions: ["org.example.NewBorder"],
        borderlessWindows: false,
      },
    ]);
    expect(controller.deliveredSettings).toEqual(expected);
    expect(controller.deferredSnapshots).toEqual([]);
    expect(deferredWork).toHaveLength(1);

    deferredWork[0]?.();
    expect(controller.deferredSnapshots).toEqual([expected]);

    runtime.destroy();
  });

  it("delivers exclusions before enabling borderless mode", async () => {
    vi.doMock("../src/runtime-controller", () => ({
      RuntimeController: RuntimeControllerDouble,
    }));
    vi.spyOn(console, "info").mockImplementation(() => {});

    const runtime = await import("../src/runtime");
    const initial = settings({
      applicationBorderlessExclusions: "org.example.InitialBorder",
      borderlessWindows: false,
    });

    runtime.init(
      { screens: [] } as unknown as KWinWorkspace,
      2,
      (x, y, width, height) => ({ height, width, x, y }),
      () => {},
      () => {},
      initial,
      "",
      () => {},
    );

    const controller = controllerInstances[0];

    if (!controller) {
      throw new Error("runtime controller test double was not created");
    }

    controller.calls.length = 0;
    controller.borderDeliverySnapshots.length = 0;
    expect(
      runtime.applySettings(
        settings({
          applicationBorderlessExclusions: "org.example.NewBorder",
          borderlessWindows: true,
        }),
      ),
    ).toBe(true);
    expect(controller.calls).toEqual([
      "applicationBorderlessExclusions",
      "applicationColumnWidths",
      "applicationInitialFloating",
      "applicationTilingExclusions",
      "centerFocusedColumn",
      "defaultColumnWidthPercent",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "windowHeightStepPercent",
      "gap",
      "borderlessWindows",
    ]);
    expect(controller.borderDeliverySnapshots).toEqual([
      {
        applicationBorderlessExclusions: ["org.example.NewBorder"],
        borderlessWindows: false,
      },
      {
        applicationBorderlessExclusions: ["org.example.NewBorder"],
        borderlessWindows: true,
      },
    ]);
    runtime.destroy();
  });
});

function settings(
  overrides: Partial<RuntimeSettingsInput> = {},
): RuntimeSettingsInput {
  return {
    applicationBorderlessExclusions: "",
    applicationColumnWidths: "",
    applicationInitialFloating: "",
    applicationTilingExclusions: "",
    borderlessWindows: true,
    centerFocusedColumn: false,
    columnWidthPresets: "",
    columnWidthStepPercent: 10,
    defaultColumnWidthPercent: 50,
    gap: 16,
    touchpadNavigation: false,
    windowHeightStepPercent: 10,
    ...overrides,
  };
}

function snapshot(settingsValue: DeliveredSettings): DeliveredSettings {
  return {
    ...settingsValue,
    applicationBorderlessExclusions: [
      ...settingsValue.applicationBorderlessExclusions,
    ],
    applicationColumnWidths: [...settingsValue.applicationColumnWidths],
    applicationInitialFloating: [...settingsValue.applicationInitialFloating],
    applicationTilingExclusions: [...settingsValue.applicationTilingExclusions],
    columnWidthPresets: [...settingsValue.columnWidthPresets],
  };
}
