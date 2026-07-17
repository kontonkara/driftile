import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationBorderlessExclusions } from "../src/application-borderless-exclusions";
import type { ApplicationColumnPresentations } from "../src/application-column-presentations";
import type {
  ApplicationInitialDestination,
  ApplicationInitialDestinations,
} from "../src/application-initial-destinations";
import type { ApplicationInitialFocused } from "../src/application-initial-focused";
import type { ApplicationInitialUnfocused } from "../src/application-initial-unfocused";
import type { ApplicationInitialFloating } from "../src/application-initial-floating";
import type { ApplicationInitialFullWidth } from "../src/application-initial-full-width";
import type { ApplicationInitialFullscreen } from "../src/application-initial-fullscreen";
import type { ApplicationInitialMaximized } from "../src/application-initial-maximized";
import type { ApplicationColumnWidthOverrides } from "../src/application-overrides";
import type { ApplicationWindowHeightOverrides } from "../src/application-window-heights";
import type { ApplicationFocusCentering } from "../src/application-focus-centering";
import type {
  ApplicationFloatingPosition,
  ApplicationFloatingPositions,
} from "../src/application-floating-positions";
import type { ApplicationTilingExclusions } from "../src/application-tiling-exclusions";
import type { ColumnWidth } from "../src/core/layout-engine";
import type { DefaultWindowHeight } from "../src/default-window-height";
import type { DefaultInitialFocus } from "../src/default-initial-focus";
import type { NumberedDesktopTargets } from "../src/numbered-desktop-targets";
import type { KWinWorkspace } from "../src/platform/kwin/api";
import type { WindowHeightPresetCycleEntry } from "../src/window-height-presets";

interface DeliveredSettings {
  readonly applicationBorderlessExclusions: readonly string[];
  readonly applicationColumnPresentations: readonly string[];
  readonly applicationColumnWidths: readonly string[];
  readonly applicationWindowHeights: readonly string[];
  readonly applicationFocusCentering: readonly string[];
  readonly applicationFloatingPositions: readonly string[];
  readonly applicationInitialDestinations: readonly string[];
  readonly applicationInitialFocused: readonly string[];
  readonly applicationInitialUnfocused: readonly string[];
  readonly applicationInitialFloating: readonly string[];
  readonly applicationInitialFullWidth: readonly string[];
  readonly applicationInitialFullscreen: readonly string[];
  readonly applicationInitialMaximized: readonly string[];
  readonly applicationTilingExclusions: readonly string[];
  readonly alwaysCenterSingleColumn: boolean;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly centerFocusedColumnOnOverflow: boolean;
  readonly columnWidthPresets: readonly ColumnWidth[];
  readonly columnWidthStepPixels: number;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidth: ColumnWidth;
  readonly useInitialWindowWidth: boolean;
  readonly defaultColumnPresentation: "stacked" | "tabbed";
  readonly defaultFloatingPosition: ApplicationFloatingPosition | null;
  readonly defaultInitialDestination: ApplicationInitialDestination | null;
  readonly defaultInitialFocus: DefaultInitialFocus;
  readonly defaultWindowHeight: string;
  readonly emptyDesktopAboveFirst: boolean;
  readonly gap: number;
  readonly numberedDesktopTargets: readonly string[];
  readonly windowHeightPresets: readonly WindowHeightPresetCycleEntry[];
  readonly windowHeightStepPixels: number;
  readonly windowHeightStepPercent: number;
  readonly workspaceAutoBackAndForth: boolean;
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
  readonly applicationWindowHeights: ApplicationWindowHeightOverrides;
  readonly applicationFocusCentering: ApplicationFocusCentering;
  readonly applicationFloatingPositions: ApplicationFloatingPositions;
  readonly applicationInitialDestinations: ApplicationInitialDestinations;
  readonly applicationInitialFocused: ApplicationInitialFocused;
  readonly applicationInitialUnfocused: ApplicationInitialUnfocused;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationInitialFullWidth: ApplicationInitialFullWidth;
  readonly applicationInitialFullscreen: ApplicationInitialFullscreen;
  readonly applicationInitialMaximized: ApplicationInitialMaximized;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly borderlessWindows: boolean;
  readonly columnWidth: ColumnWidth;
  readonly defaultColumnPresentation: "stacked" | "tabbed";
  readonly defaultFloatingPosition: ApplicationFloatingPosition | null;
  readonly defaultInitialDestination: ApplicationInitialDestination | null;
  readonly defaultInitialFocus: DefaultInitialFocus;
  readonly defaultWindowHeight: DefaultWindowHeight;
  readonly emptyDesktopAboveFirst: boolean;
  readonly gap: number;
  readonly numberedDesktopTargets: NumberedDesktopTargets;
  readonly schedule: (callback: () => void) => void;
  readonly workspaceAutoBackAndForth: boolean;
  readonly useInitialWindowWidth: boolean;
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
      applicationWindowHeights:
        options.applicationWindowHeights.canonicalEntries,
      applicationFocusCentering:
        options.applicationFocusCentering.canonicalEntries,
      applicationFloatingPositions:
        options.applicationFloatingPositions.canonicalEntries,
      applicationInitialDestinations:
        options.applicationInitialDestinations.canonicalEntries,
      applicationInitialFocused:
        options.applicationInitialFocused.canonicalEntries,
      applicationInitialUnfocused:
        options.applicationInitialUnfocused.canonicalEntries,
      applicationInitialFloating:
        options.applicationInitialFloating.canonicalEntries,
      applicationInitialFullWidth:
        options.applicationInitialFullWidth.canonicalEntries,
      applicationInitialFullscreen:
        options.applicationInitialFullscreen.canonicalEntries,
      applicationInitialMaximized:
        options.applicationInitialMaximized.canonicalEntries,
      applicationTilingExclusions:
        options.applicationTilingExclusions.canonicalEntries,
      alwaysCenterSingleColumn: false,
      borderlessWindows: options.borderlessWindows,
      centerFocusedColumn: false,
      centerFocusedColumnOnOverflow: false,
      columnWidthPresets: [],
      columnWidthStepPixels: 0,
      columnWidthStepPercent: 1,
      defaultColumnWidth: { ...options.columnWidth },
      useInitialWindowWidth: options.useInitialWindowWidth,
      defaultColumnPresentation: options.defaultColumnPresentation,
      defaultFloatingPosition: options.defaultFloatingPosition,
      defaultInitialDestination: options.defaultInitialDestination,
      defaultInitialFocus: options.defaultInitialFocus,
      defaultWindowHeight: options.defaultWindowHeight.canonicalValue,
      emptyDesktopAboveFirst: options.emptyDesktopAboveFirst,
      gap: options.gap,
      numberedDesktopTargets: options.numberedDesktopTargets.canonicalEntries,
      windowHeightPresets: [],
      windowHeightStepPixels: 0,
      windowHeightStepPercent: 1,
      workspaceAutoBackAndForth: options.workspaceAutoBackAndForth,
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

  setApplicationWindowHeights(
    overrides: ApplicationWindowHeightOverrides,
  ): boolean {
    this.calls.push("applicationWindowHeights");
    this.state = {
      ...this.state,
      applicationWindowHeights: overrides.canonicalEntries,
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

  setApplicationFloatingPositions(
    positions: ApplicationFloatingPositions,
  ): boolean {
    this.calls.push("applicationFloatingPositions");
    this.state = {
      ...this.state,
      applicationFloatingPositions: positions.canonicalEntries,
    };
    return true;
  }

  setApplicationInitialDestinations(
    destinations: ApplicationInitialDestinations,
  ): boolean {
    this.calls.push("applicationInitialDestinations");
    this.state = {
      ...this.state,
      applicationInitialDestinations: destinations.canonicalEntries,
    };
    return true;
  }

  setApplicationInitialFocused(
    applications: ApplicationInitialFocused,
  ): boolean {
    this.calls.push("applicationInitialFocused");
    this.state = {
      ...this.state,
      applicationInitialFocused: applications.canonicalEntries,
    };
    return true;
  }

  setApplicationInitialUnfocused(
    applications: ApplicationInitialUnfocused,
  ): boolean {
    this.calls.push("applicationInitialUnfocused");
    this.state = {
      ...this.state,
      applicationInitialUnfocused: applications.canonicalEntries,
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

  setApplicationInitialFullWidth(
    applications: ApplicationInitialFullWidth,
  ): boolean {
    this.calls.push("applicationInitialFullWidth");
    this.state = {
      ...this.state,
      applicationInitialFullWidth: applications.canonicalEntries,
    };
    return true;
  }

  setApplicationInitialFullscreen(
    applications: ApplicationInitialFullscreen,
  ): boolean {
    this.calls.push("applicationInitialFullscreen");
    this.state = {
      ...this.state,
      applicationInitialFullscreen: applications.canonicalEntries,
    };
    return true;
  }

  setApplicationInitialMaximized(
    applications: ApplicationInitialMaximized,
  ): boolean {
    this.calls.push("applicationInitialMaximized");
    this.state = {
      ...this.state,
      applicationInitialMaximized: applications.canonicalEntries,
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

  setColumnWidthStepPixels(value: number): boolean {
    this.calls.push("columnWidthStepPixels");
    this.state = { ...this.state, columnWidthStepPixels: value };
    return true;
  }

  setDefaultColumnWidth(value: ColumnWidth): boolean {
    this.calls.push("defaultColumnWidth");
    this.state = { ...this.state, defaultColumnWidth: { ...value } };
    return true;
  }

  setUseInitialWindowWidth(value: boolean): boolean {
    this.calls.push("useInitialWindowWidth");
    this.state = { ...this.state, useInitialWindowWidth: value };
    return true;
  }

  setDefaultColumnPresentation(value: "stacked" | "tabbed"): boolean {
    this.calls.push("defaultColumnPresentation");
    this.state = { ...this.state, defaultColumnPresentation: value };
    return true;
  }

  setDefaultFloatingPosition(
    value: ApplicationFloatingPosition | null,
  ): boolean {
    this.calls.push("defaultFloatingPosition");
    this.state = {
      ...this.state,
      defaultFloatingPosition: value === null ? null : { ...value },
    };
    return true;
  }

  setDefaultInitialDestination(
    value: ApplicationInitialDestination | null,
  ): boolean {
    this.calls.push("defaultInitialDestination");
    this.state = {
      ...this.state,
      defaultInitialDestination: value === null ? null : { ...value },
    };
    return true;
  }

  setDefaultInitialFocus(value: DefaultInitialFocus): boolean {
    this.calls.push("defaultInitialFocus");
    this.state = { ...this.state, defaultInitialFocus: value };
    return true;
  }

  setDefaultWindowHeight(value: DefaultWindowHeight): boolean {
    this.calls.push("defaultWindowHeight");
    this.state = {
      ...this.state,
      defaultWindowHeight: value.canonicalValue,
    };
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

  setNumberedDesktopTargets(value: NumberedDesktopTargets): boolean {
    this.calls.push("numberedDesktopTargets");
    this.state = {
      ...this.state,
      numberedDesktopTargets: value.canonicalEntries,
    };
    return true;
  }

  setWindowHeightStepPercent(value: number): boolean {
    this.calls.push("windowHeightStepPercent");
    this.state = { ...this.state, windowHeightStepPercent: value };
    return true;
  }

  setWindowHeightStepPixels(value: number): boolean {
    this.calls.push("windowHeightStepPixels");
    this.state = { ...this.state, windowHeightStepPixels: value };
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

  setWorkspaceAutoBackAndForth(value: boolean): boolean {
    this.calls.push("workspaceAutoBackAndForth");
    this.state = { ...this.state, workspaceAutoBackAndForth: value };
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
      applicationInitialDestinations:
        "org.example.InitialChat=desktop:2,output:DP-1",
      applicationInitialFocused: "org.example.InitialDialog",
      applicationInitialUnfocused: "org.example.InitialBackground",
      applicationInitialFloating: "org.example.InitialFloat",
      applicationInitialFullWidth: "org.example.InitialWide",
      applicationInitialFullscreen: "org.example.InitialGame",
      applicationInitialMaximized: "org.example.InitialMail",
      applicationTilingExclusions: "org.example.InitiallyExcluded",
      alwaysCenterSingleColumn: true,
      defaultFloatingPosition: "top-left,12,8",
      defaultInitialDestination: "desktop:2,output:DP-1",
      defaultInitialFocus: "focused",
      useInitialWindowWidth: true,
      emptyDesktopAboveFirst: true,
      numberedDesktopTargets: "1=Web\n9=Archive",
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
    expect(controller.deliveredSettings.applicationInitialDestinations).toEqual(
      ["org.example.InitialChat=desktop:2,output:DP-1"],
    );
    expect(controller.deliveredSettings.applicationInitialFocused).toEqual([
      "org.example.InitialDialog",
    ]);
    expect(controller.deliveredSettings.applicationInitialUnfocused).toEqual([
      "org.example.InitialBackground",
    ]);
    expect(controller.deliveredSettings.applicationInitialFullWidth).toEqual([
      "org.example.InitialWide",
    ]);
    expect(controller.deliveredSettings.applicationInitialFullscreen).toEqual([
      "org.example.InitialGame",
    ]);
    expect(controller.deliveredSettings.applicationInitialMaximized).toEqual([
      "org.example.InitialMail",
    ]);
    expect(controller.deliveredSettings.windowHeightPresets).toEqual(
      heightPresetCycle([30, "640px", 60, "960px", 90]),
    );
    expect(controller.deliveredSettings.defaultColumnWidth).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(controller.deliveredSettings.useInitialWindowWidth).toBe(true);
    expect(controller.deliveredSettings.defaultFloatingPosition).toEqual({
      anchor: "top-left",
      x: 12,
      y: 8,
    });
    expect(controller.deliveredSettings.defaultInitialDestination).toEqual({
      desktop: 2,
      output: "DP-1",
    });
    expect(controller.deliveredSettings.defaultInitialFocus).toBe("focused");
    expect(controller.deliveredSettings.alwaysCenterSingleColumn).toBe(true);
    expect(controller.deliveredSettings.emptyDesktopAboveFirst).toBe(true);
    expect(controller.deliveredSettings.numberedDesktopTargets).toEqual([
      "1=Web",
      "9=Archive",
    ]);
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
      applicationWindowHeights: "org.example.Editor=420px",
      applicationFocusCentering: "org.example.Browser",
      applicationFloatingPositions: "org.example.Browser=bottom-right,24,16",
      applicationInitialDestinations:
        "org.example.Chat=output:HDMI-A-1,desktop:4",
      applicationInitialFocused: "org.example.NewDialog",
      applicationInitialUnfocused: "org.example.NewBackground",
      applicationInitialFloating: "org.example.NewFloat",
      applicationInitialFullWidth: "org.example.NewWide",
      applicationInitialFullscreen: "org.example.NewGame",
      applicationInitialMaximized: "org.example.NewMail",
      applicationTilingExclusions: "org.example.NewlyExcluded",
      alwaysCenterSingleColumn: false,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: "20,640px,50,1280px,80",
      columnWidthStepPixels: 144,
      columnWidthStepPercent: 13,
      defaultColumnPresentation: "tabbed",
      defaultColumnWidthPercent: 65,
      defaultColumnWidthPixels: 720,
      useInitialWindowWidth: false,
      defaultFloatingPosition: "bottom-right,24,16",
      defaultInitialDestination: "desktop-name:Work,output:HDMI-A-1",
      defaultInitialFocus: "unfocused",
      defaultWindowHeight: "60%",
      emptyDesktopAboveFirst: false,
      gap: 7.5,
      numberedDesktopTargets: "2=Development\n7=Review",
      touchpadNavigation: true,
      touchpadNavigationFingerCount: 3,
      touchpadNaturalScroll: false,
      touchpadWorkspaceNavigation: true,
      windowHeightPresets: "25,480px,50,960px,75",
      windowHeightStepPixels: 96,
      windowHeightStepPercent: 17,
      workspaceAutoBackAndForth: true,
    });
    const expected: DeliveredSettings = {
      applicationBorderlessExclusions: ["org.example.NewBorder"],
      applicationColumnPresentations: ["org.example.Editor=tabbed"],
      applicationColumnWidths: ["org.example.Editor=75"],
      applicationWindowHeights: ["org.example.Editor=420px"],
      applicationFocusCentering: ["org.example.Browser"],
      applicationFloatingPositions: ["org.example.Browser=bottom-right,24,16"],
      applicationInitialDestinations: [
        "org.example.Chat=desktop:4,output:HDMI-A-1",
      ],
      applicationInitialFocused: ["org.example.NewDialog"],
      applicationInitialUnfocused: ["org.example.NewBackground"],
      applicationInitialFloating: ["org.example.NewFloat"],
      applicationInitialFullWidth: ["org.example.NewWide"],
      applicationInitialFullscreen: ["org.example.NewGame"],
      applicationInitialMaximized: ["org.example.NewMail"],
      applicationTilingExclusions: ["org.example.NewlyExcluded"],
      alwaysCenterSingleColumn: false,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: columnWidthPolicies([20, "640px", 50, "1280px", 80]),
      columnWidthStepPixels: 144,
      columnWidthStepPercent: 13,
      defaultColumnWidth: { kind: "fixed", value: 720 },
      useInitialWindowWidth: false,
      defaultColumnPresentation: "tabbed",
      defaultFloatingPosition: {
        anchor: "bottom-right",
        x: 24,
        y: 16,
      },
      defaultInitialDestination: {
        desktopName: "Work",
        output: "HDMI-A-1",
      },
      defaultInitialFocus: "unfocused",
      defaultWindowHeight: "60",
      emptyDesktopAboveFirst: false,
      gap: 7.5,
      numberedDesktopTargets: ["2=Development", "7=Review"],
      windowHeightPresets: heightPresetCycle([25, "480px", 50, "960px", 75]),
      windowHeightStepPixels: 96,
      windowHeightStepPercent: 17,
      workspaceAutoBackAndForth: true,
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
      "applicationWindowHeights",
      "applicationFocusCentering",
      "applicationFloatingPositions",
      "applicationInitialDestinations",
      "applicationInitialFocused",
      "applicationInitialUnfocused",
      "applicationInitialFloating",
      "applicationInitialFullWidth",
      "applicationInitialFullscreen",
      "applicationInitialMaximized",
      "applicationTilingExclusions",
      "alwaysCenterSingleColumn",
      "centerFocusedColumn",
      "centerFocusedColumnOnOverflow",
      "defaultColumnPresentation",
      "defaultColumnWidth",
      "useInitialWindowWidth",
      "defaultFloatingPosition",
      "defaultInitialDestination",
      "defaultInitialFocus",
      "defaultWindowHeight",
      "emptyDesktopAboveFirst",
      "numberedDesktopTargets",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "columnWidthStepPixels",
      "windowHeightPresets",
      "windowHeightStepPercent",
      "windowHeightStepPixels",
      "workspaceAutoBackAndForth",
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

    controller.calls.length = 0;
    expect(
      runtime.applySettings({
        ...next,
        defaultFloatingPosition: " bottom-right,24,16 ",
        defaultInitialDestination: " desktop-name:Work,output:HDMI-A-1 ",
        numberedDesktopTargets: " 7 = Review \n 2 = Development ",
      }),
    ).toBe(true);
    expect(controller.calls).toEqual([]);

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
      "applicationWindowHeights",
      "applicationFocusCentering",
      "applicationFloatingPositions",
      "applicationInitialDestinations",
      "applicationInitialFocused",
      "applicationInitialUnfocused",
      "applicationInitialFloating",
      "applicationInitialFullWidth",
      "applicationInitialFullscreen",
      "applicationInitialMaximized",
      "applicationTilingExclusions",
      "alwaysCenterSingleColumn",
      "centerFocusedColumn",
      "centerFocusedColumnOnOverflow",
      "defaultColumnPresentation",
      "defaultColumnWidth",
      "useInitialWindowWidth",
      "defaultFloatingPosition",
      "defaultInitialDestination",
      "defaultInitialFocus",
      "defaultWindowHeight",
      "emptyDesktopAboveFirst",
      "numberedDesktopTargets",
      "columnWidthPresets",
      "columnWidthStepPercent",
      "columnWidthStepPixels",
      "windowHeightPresets",
      "windowHeightStepPercent",
      "windowHeightStepPixels",
      "workspaceAutoBackAndForth",
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
    useInitialWindowWidth: false,
    defaultFloatingPosition: "",
    defaultInitialDestination: "",
    defaultInitialFocus: "default",
    defaultWindowHeight: "auto",
    emptyDesktopAboveFirst: false,
    gap: 16,
    numberedDesktopTargets: "",
    showTabIndicator: true,
    touchpadNavigation: false,
    touchpadNavigationFingerCount: 5,
    touchpadNaturalScroll: true,
    touchpadWorkspaceNavigation: false,
    windowHeightPresets: "",
    windowHeightStepPixels: 0,
    windowHeightStepPercent: 10,
    workspaceAutoBackAndForth: false,
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
    applicationWindowHeights: [...settingsValue.applicationWindowHeights],
    applicationFocusCentering: [...settingsValue.applicationFocusCentering],
    applicationFloatingPositions: [
      ...settingsValue.applicationFloatingPositions,
    ],
    applicationInitialDestinations: [
      ...settingsValue.applicationInitialDestinations,
    ],
    applicationInitialFocused: [...settingsValue.applicationInitialFocused],
    applicationInitialUnfocused: [...settingsValue.applicationInitialUnfocused],
    applicationInitialFloating: [...settingsValue.applicationInitialFloating],
    applicationInitialFullWidth: [...settingsValue.applicationInitialFullWidth],
    applicationInitialFullscreen: [
      ...settingsValue.applicationInitialFullscreen,
    ],
    applicationInitialMaximized: [...settingsValue.applicationInitialMaximized],
    applicationTilingExclusions: [...settingsValue.applicationTilingExclusions],
    columnWidthPresets: settingsValue.columnWidthPresets.map((value) => ({
      ...value,
    })),
    defaultColumnWidth: { ...settingsValue.defaultColumnWidth },
    defaultFloatingPosition:
      settingsValue.defaultFloatingPosition === null
        ? null
        : { ...settingsValue.defaultFloatingPosition },
    defaultInitialDestination:
      settingsValue.defaultInitialDestination === null
        ? null
        : { ...settingsValue.defaultInitialDestination },
    numberedDesktopTargets: [...settingsValue.numberedDesktopTargets],
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
