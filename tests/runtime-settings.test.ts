import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationBorderlessExclusions } from "../src/application-borderless-exclusions";
import type { ApplicationColumnPresentations } from "../src/application-column-presentations";
import type { ApplicationInitialFloating } from "../src/application-initial-floating";
import type { ApplicationColumnWidthOverrides } from "../src/application-overrides";
import type { ApplicationFocusCentering } from "../src/application-focus-centering";
import type { ApplicationTilingExclusions } from "../src/application-tiling-exclusions";
import type { ColumnWidth } from "../src/core/layout-engine";
import type { KWinWorkspace } from "../src/platform/kwin/api";
import type { WindowHeightPresetCycleEntry } from "../src/window-height-presets";

interface DeliveredSettings {
  readonly applicationBorderlessExclusions: readonly string[];
  readonly applicationColumnPresentations: readonly string[];
  readonly applicationColumnWidths: readonly string[];
  readonly applicationFocusCentering: readonly string[];
  readonly applicationInitialFloating: readonly string[];
  readonly applicationTilingExclusions: readonly string[];
  readonly alwaysCenterSingleColumn: boolean;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly centerFocusedColumnOnOverflow: boolean;
  readonly columnWidthPresets: readonly ColumnWidth[];
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidth: ColumnWidth;
  readonly defaultColumnPresentation: "stacked" | "tabbed";
  readonly emptyDesktopAboveFirst: boolean;
  readonly gap: number;
  readonly windowHeightPresets: readonly WindowHeightPresetCycleEntry[];
  readonly windowHeightStepPercent: number;
}

type RuntimeSettingsInput = Record<
  Exclude<keyof DeliveredSettings, "defaultColumnWidth">,
  unknown
> & {
  readonly defaultColumnWidthPercent: unknown;
  readonly defaultColumnWidthPixels: unknown;
  readonly showTabIndicator: unknown;
  readonly touchpadNaturalScroll: unknown;
  readonly touchpadNavigation: unknown;
  readonly touchpadNavigationFingerCount: unknown;
  readonly touchpadWorkspaceNavigation: unknown;
};

interface RuntimeControllerOptions {
  readonly applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  readonly applicationColumnPresentations: ApplicationColumnPresentations;
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly applicationFocusCentering: ApplicationFocusCentering;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly borderlessWindows: boolean;
  readonly columnWidth: ColumnWidth;
  readonly defaultColumnPresentation: "stacked" | "tabbed";
  readonly emptyDesktopAboveFirst: boolean;
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
      applicationColumnPresentations:
        options.applicationColumnPresentations.canonicalEntries,
      applicationColumnWidths: options.applicationColumnWidths.canonicalEntries,
      applicationFocusCentering:
        options.applicationFocusCentering.canonicalEntries,
      applicationInitialFloating:
        options.applicationInitialFloating.canonicalEntries,
      applicationTilingExclusions:
        options.applicationTilingExclusions.canonicalEntries,
      alwaysCenterSingleColumn: false,
      borderlessWindows: options.borderlessWindows,
      centerFocusedColumn: false,
      centerFocusedColumnOnOverflow: false,
      columnWidthPresets: [],
      columnWidthStepPercent: 1,
      defaultColumnWidth: { ...options.columnWidth },
      defaultColumnPresentation: options.defaultColumnPresentation,
      emptyDesktopAboveFirst: options.emptyDesktopAboveFirst,
      gap: options.gap,
      windowHeightPresets: [],
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

  setApplicationColumnPresentations(
    presentations: ApplicationColumnPresentations,
  ): boolean {
    this.calls.push("applicationColumnPresentations");
    this.state = {
      ...this.state,
      applicationColumnPresentations: presentations.canonicalEntries,
    };
    return true;
  }

  setApplicationFocusCentering(
    applications: ApplicationFocusCentering,
  ): boolean {
    this.calls.push("applicationFocusCentering");
    this.state = {
      ...this.state,
      applicationFocusCentering: applications.canonicalEntries,
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

  setAlwaysCenterSingleColumn(value: boolean): boolean {
    this.calls.push("alwaysCenterSingleColumn");
    this.state = { ...this.state, alwaysCenterSingleColumn: value };
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

  setCenterFocusedColumnOnOverflow(value: boolean): boolean {
    this.calls.push("centerFocusedColumnOnOverflow");
    this.state = { ...this.state, centerFocusedColumnOnOverflow: value };
    return true;
  }

  setColumnWidthPresets(values: readonly ColumnWidth[]): boolean {
    this.calls.push("columnWidthPresets");
    this.state = {
      ...this.state,
      columnWidthPresets: values.map((value) => ({ ...value })),
    };
    return true;
  }

  setColumnWidthStepPercent(value: number): boolean {
    this.calls.push("columnWidthStepPercent");
    this.state = { ...this.state, columnWidthStepPercent: value };
    return true;
  }

  setDefaultColumnWidth(value: ColumnWidth): boolean {
    this.calls.push("defaultColumnWidth");
    this.state = { ...this.state, defaultColumnWidth: { ...value } };
    return true;
  }

  setDefaultColumnPresentation(value: "stacked" | "tabbed"): boolean {
    this.calls.push("defaultColumnPresentation");
    this.state = { ...this.state, defaultColumnPresentation: value };
    return true;
  }

  setEmptyDesktopAboveFirst(value: boolean): boolean {
    this.calls.push("emptyDesktopAboveFirst");
    this.state = { ...this.state, emptyDesktopAboveFirst: value };
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

  setWindowHeightPresets(
    values: readonly WindowHeightPresetCycleEntry[],
  ): boolean {
    this.calls.push("windowHeightPresets");
    this.state = {
      ...this.state,
      windowHeightPresets: values.map((value) => ({
        policy: { ...value.policy },
        stateIndex: value.stateIndex,
      })),
    };
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
      alwaysCenterSingleColumn: true,
      emptyDesktopAboveFirst: true,
      windowHeightPresets: "30,640px,60,960px,90",
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
    expect(controller.deliveredSettings.windowHeightPresets).toEqual(
      heightPresetCycle([30, "640px", 60, "960px", 90]),
    );
    expect(controller.deliveredSettings.defaultColumnWidth).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(controller.deliveredSettings.alwaysCenterSingleColumn).toBe(true);
    expect(controller.deliveredSettings.emptyDesktopAboveFirst).toBe(true);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(false);

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
      applicationColumnPresentations: "org.example.Editor=tabbed",
      applicationColumnWidths: "org.example.Editor=75",
      applicationFocusCentering: "org.example.Browser",
      applicationInitialFloating: "org.example.NewFloat",
      applicationTilingExclusions: "org.example.NewlyExcluded",
      alwaysCenterSingleColumn: false,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: "20,640px,50,1280px,80",
      columnWidthStepPercent: 13,
      defaultColumnPresentation: "tabbed",
      defaultColumnWidthPercent: 65,
      defaultColumnWidthPixels: 720,
      emptyDesktopAboveFirst: false,
      gap: 7.5,
      touchpadNavigation: true,
      touchpadNavigationFingerCount: 3,
      touchpadNaturalScroll: false,
      touchpadWorkspaceNavigation: true,
      windowHeightPresets: "25,480px,50,960px,75",
      windowHeightStepPercent: 17,
    });
    const expected: DeliveredSettings = {
      applicationBorderlessExclusions: ["org.example.NewBorder"],
      applicationColumnPresentations: ["org.example.Editor=tabbed"],
      applicationColumnWidths: ["org.example.Editor=75"],
      applicationFocusCentering: ["org.example.Browser"],
      applicationInitialFloating: ["org.example.NewFloat"],
      applicationTilingExclusions: ["org.example.NewlyExcluded"],
      alwaysCenterSingleColumn: false,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: columnWidthPolicies([20, "640px", 50, "1280px", 80]),
      columnWidthStepPercent: 13,
      defaultColumnWidth: { kind: "fixed", value: 720 },
      defaultColumnPresentation: "tabbed",
      emptyDesktopAboveFirst: false,
      gap: 7.5,
      windowHeightPresets: heightPresetCycle([25, "480px", 50, "960px", 75]),
      windowHeightStepPercent: 17,
    };

    expect(runtime.applySettings(next)).toBe(true);
    expect(runtime.getTouchpadNavigation()).toBe(true);
    expect(runtime.getTouchpadNavigationFingerCount()).toBe(3);
    expect(runtime.getTouchpadNaturalScroll()).toBe(false);
    expect(runtime.getTouchpadWorkspaceNavigation()).toBe(true);
    expect(controller.calls).toEqual([
      "borderlessWindows",
      "applicationBorderlessExclusions",
      "applicationColumnPresentations",
      "applicationColumnWidths",
      "applicationFocusCentering",
      "applicationInitialFloating",
      "applicationTilingExclusions",
      "alwaysCenterSingleColumn",
      "centerFocusedColumn",
      "centerFocusedColumnOnOverflow",
      "defaultColumnPresentation",
      "defaultColumnWidth",
      "emptyDesktopAboveFirst",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "windowHeightPresets",
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
      "applicationColumnPresentations",
      "applicationColumnWidths",
      "applicationFocusCentering",
      "applicationInitialFloating",
      "applicationTilingExclusions",
      "alwaysCenterSingleColumn",
      "centerFocusedColumn",
      "centerFocusedColumnOnOverflow",
      "defaultColumnPresentation",
      "defaultColumnWidth",
      "emptyDesktopAboveFirst",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "windowHeightPresets",
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
    applicationColumnPresentations: "",
    applicationColumnWidths: "",
    applicationFocusCentering: "",
    applicationInitialFloating: "",
    applicationTilingExclusions: "",
    alwaysCenterSingleColumn: false,
    borderlessWindows: true,
    centerFocusedColumn: false,
    centerFocusedColumnOnOverflow: false,
    columnWidthPresets: "",
    columnWidthStepPercent: 10,
    defaultColumnPresentation: "stacked",
    defaultColumnWidthPercent: 50,
    defaultColumnWidthPixels: 0,
    emptyDesktopAboveFirst: false,
    gap: 16,
    showTabIndicator: true,
    touchpadNavigation: false,
    touchpadNavigationFingerCount: 5,
    touchpadNaturalScroll: true,
    touchpadWorkspaceNavigation: false,
    windowHeightPresets: "",
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
    applicationColumnPresentations: [
      ...settingsValue.applicationColumnPresentations,
    ],
    applicationColumnWidths: [...settingsValue.applicationColumnWidths],
    applicationFocusCentering: [...settingsValue.applicationFocusCentering],
    applicationInitialFloating: [...settingsValue.applicationInitialFloating],
    applicationTilingExclusions: [...settingsValue.applicationTilingExclusions],
    columnWidthPresets: settingsValue.columnWidthPresets.map((value) => ({
      ...value,
    })),
    defaultColumnWidth: { ...settingsValue.defaultColumnWidth },
    windowHeightPresets: settingsValue.windowHeightPresets.map((value) => ({
      policy: { ...value.policy },
      stateIndex: value.stateIndex,
    })),
  };
}

function columnWidthPolicies(
  values: readonly (number | `${number}px`)[],
): readonly ColumnWidth[] {
  return values.map((value) =>
    typeof value === "number"
      ? { kind: "proportion", value: value / 100 }
      : { kind: "fixed", value: Number(value.slice(0, -2)) },
  );
}

function heightPresetCycle(
  values: readonly (number | `${number}px`)[],
): readonly WindowHeightPresetCycleEntry[] {
  return values.map((value) => {
    if (typeof value === "number") {
      return {
        policy: { kind: "proportion", value: value / 100 },
        stateIndex: 100 + value,
      };
    }

    const pixels = Number(value.slice(0, -2));
    return {
      policy: { kind: "fixed", value: pixels },
      stateIndex: 200 + pixels,
    };
  });
}
