import { describe, expect, it } from "vitest";
import { decodeApplicationBorderlessExclusions } from "../src/application-borderless-exclusions";
import { decodeApplicationInitialFloating } from "../src/application-initial-floating";
import { decodeApplicationInitialFocused } from "../src/application-initial-focused";
import { decodeApplicationInitialUnfocused } from "../src/application-initial-unfocused";
import { decodeApplicationInitialFullWidth } from "../src/application-initial-full-width";
import { decodeApplicationInitialFullscreen } from "../src/application-initial-fullscreen";
import { decodeApplicationInitialMaximized } from "../src/application-initial-maximized";
import {
  APPLICATION_INITIAL_DESTINATION_LIMITS,
  decodeApplicationInitialDestinations,
  EMPTY_APPLICATION_INITIAL_DESTINATIONS,
  sameApplicationInitialDestinations,
} from "../src/application-initial-destinations";
import {
  APPLICATION_FLOATING_POSITION_LIMITS,
  decodeApplicationFloatingPositions,
  EMPTY_APPLICATION_FLOATING_POSITIONS,
  sameApplicationFloatingPositions,
  type ApplicationFloatingPosition,
  type ApplicationFloatingPositionAnchor,
} from "../src/application-floating-positions";
import { decodeApplicationColumnPresentations } from "../src/application-column-presentations";
import { decodeApplicationColumnWidthOverrides } from "../src/application-overrides";
import { decodeApplicationWindowHeightOverrides } from "../src/application-window-heights";
import { decodeApplicationFocusCentering } from "../src/application-focus-centering";
import { decodeApplicationTilingExclusions } from "../src/application-tiling-exclusions";
import { decodeColumnWidthPresetPercentages } from "../src/column-width-presets";
import { decodeDefaultWindowHeight } from "../src/default-window-height";
import {
  decodeDefaultFloatingPosition,
  DISABLED_DEFAULT_FLOATING_POSITION,
  sameDefaultFloatingPositions,
} from "../src/default-floating-position";
import { decodeWindowHeightPresetPercentages } from "../src/window-height-presets";
import {
  decodeDriftileSettings,
  DEFAULT_DRIFTILE_SETTINGS,
  sameDriftileSettings,
  type DriftileSettings,
} from "../src/settings";

const validApplicationColumnWidths = decodeApplicationColumnWidthOverrides(
  "org.example.Editor=75",
);

if (!validApplicationColumnWidths) {
  throw new Error("application override fixture is invalid");
}

const validApplicationWindowHeights = decodeApplicationWindowHeightOverrides(
  "org.example.Editor=75",
);

if (!validApplicationWindowHeights) {
  throw new Error("application window-height fixture is invalid");
}

const validApplicationColumnPresentations =
  decodeApplicationColumnPresentations(
    "org.example.Browser=tabbed\norg.example.Editor=stacked",
  );

if (!validApplicationColumnPresentations) {
  throw new Error("application column-presentation fixture is invalid");
}

const validApplicationBorderlessExclusions =
  decodeApplicationBorderlessExclusions(
    "org.example.Decorated\norg.example.Legacy=tool",
  );

if (!validApplicationBorderlessExclusions) {
  throw new Error("application borderless exclusion fixture is invalid");
}

const validApplicationInitialFloating = decodeApplicationInitialFloating(
  "org.example.Floating\norg.example.Floating=tool",
);

if (!validApplicationInitialFloating) {
  throw new Error("application initial-floating fixture is invalid");
}

const validApplicationFloatingPositions = decodeApplicationFloatingPositions(
  "org.example.Floating=bottom-right,24,16",
);

if (!validApplicationFloatingPositions) {
  throw new Error("application floating-position fixture is invalid");
}

const validApplicationInitialDestinations =
  decodeApplicationInitialDestinations(
    "org.example.Chat=desktop:2,output:DP-1",
  );

if (!validApplicationInitialDestinations) {
  throw new Error("application initial-destination fixture is invalid");
}

const validApplicationInitialFullWidth = decodeApplicationInitialFullWidth(
  "org.example.Browser\norg.example.Browser=tool",
);

if (!validApplicationInitialFullWidth) {
  throw new Error("application initial-full-width fixture is invalid");
}

const validApplicationInitialFocused = decodeApplicationInitialFocused(
  "org.example.Chat\norg.example.Dialog",
);

if (!validApplicationInitialFocused) {
  throw new Error("application initial-focused fixture is invalid");
}

const validApplicationInitialUnfocused = decodeApplicationInitialUnfocused(
  "org.example.Background\norg.example.Notification",
);

if (!validApplicationInitialUnfocused) {
  throw new Error("application initial-unfocused fixture is invalid");
}

const validApplicationInitialFullscreen = decodeApplicationInitialFullscreen(
  "org.example.Game\norg.example.Video",
);

if (!validApplicationInitialFullscreen) {
  throw new Error("application initial-fullscreen fixture is invalid");
}

const validApplicationInitialMaximized = decodeApplicationInitialMaximized(
  "org.example.Mail\norg.example.Calendar",
);

if (!validApplicationInitialMaximized) {
  throw new Error("application initial-maximized fixture is invalid");
}

const validApplicationFocusCentering = decodeApplicationFocusCentering(
  "org.example.Browser\norg.example.Editor",
);

if (!validApplicationFocusCentering) {
  throw new Error("application focus-centering fixture is invalid");
}

const validApplicationTilingExclusions = decodeApplicationTilingExclusions(
  "org.example.Legacy\norg.example.Editor=tool",
);

if (!validApplicationTilingExclusions) {
  throw new Error("application tiling exclusion fixture is invalid");
}

const validColumnWidthPresets = decodeColumnWidthPresetPercentages("20,50,80");

if (!validColumnWidthPresets) {
  throw new Error("column-width preset fixture is invalid");
}

const validWindowHeightPresets =
  decodeWindowHeightPresetPercentages("25,50,75");

if (!validWindowHeightPresets) {
  throw new Error("window-height preset fixture is invalid");
}

const validDefaultWindowHeight = decodeDefaultWindowHeight("720px");

if (!validDefaultWindowHeight) {
  throw new Error("default window-height fixture is invalid");
}

const validDefaultFloatingPosition =
  decodeDefaultFloatingPosition("bottom-left,-40,24");

if (!validDefaultFloatingPosition?.floatingPosition) {
  throw new Error("default floating-position fixture is invalid");
}

const validSettings: DriftileSettings = {
  applicationBorderlessExclusions: validApplicationBorderlessExclusions,
  applicationColumnPresentations: validApplicationColumnPresentations,
  applicationColumnWidths: validApplicationColumnWidths,
  applicationWindowHeights: validApplicationWindowHeights,
  applicationFocusCentering: validApplicationFocusCentering,
  applicationFloatingPositions: validApplicationFloatingPositions,
  applicationInitialDestinations: validApplicationInitialDestinations,
  applicationInitialFocused: validApplicationInitialFocused,
  applicationInitialUnfocused: validApplicationInitialUnfocused,
  applicationInitialFloating: validApplicationInitialFloating,
  applicationInitialFullWidth: validApplicationInitialFullWidth,
  applicationInitialFullscreen: validApplicationInitialFullscreen,
  applicationInitialMaximized: validApplicationInitialMaximized,
  applicationTilingExclusions: validApplicationTilingExclusions,
  alwaysCenterSingleColumn: true,
  borderlessWindows: false,
  centerFocusedColumn: true,
  centerFocusedColumnOnOverflow: true,
  columnWidthPresets: validColumnWidthPresets,
  columnWidthStepPixels: 240,
  columnWidthStepPercent: 25,
  defaultColumnPresentation: "tabbed",
  defaultColumnWidthPercent: 75,
  defaultColumnWidthPixels: 960,
  defaultFloatingPosition: validDefaultFloatingPosition.floatingPosition,
  defaultWindowHeight: validDefaultWindowHeight,
  emptyDesktopAboveFirst: true,
  gap: 32.5,
  showTabIndicator: false,
  touchpadNavigation: true,
  touchpadNavigationFingerCount: 4,
  touchpadNaturalScroll: false,
  touchpadWorkspaceNavigation: true,
  workspaceAutoBackAndForth: true,
  windowHeightPresets: validWindowHeightPresets,
  windowHeightStepPixels: 180,
  windowHeightStepPercent: 20,
};

const validSettingsInput = {
  applicationBorderlessExclusions:
    "org.example.Decorated\norg.example.Legacy=tool",
  applicationColumnPresentations:
    "org.example.Browser=tabbed\norg.example.Editor=stacked",
  applicationColumnWidths: "org.example.Editor=75",
  applicationWindowHeights: "org.example.Editor=75",
  applicationFocusCentering: "org.example.Browser\norg.example.Editor",
  applicationFloatingPositions: "org.example.Floating=bottom-right,24,16",
  applicationInitialDestinations: "org.example.Chat=desktop:2,output:DP-1",
  applicationInitialFocused: "org.example.Chat\norg.example.Dialog",
  applicationInitialUnfocused:
    "org.example.Background\norg.example.Notification",
  applicationInitialFloating: "org.example.Floating\norg.example.Floating=tool",
  applicationInitialFullWidth: "org.example.Browser\norg.example.Browser=tool",
  applicationInitialFullscreen: "org.example.Game\norg.example.Video",
  applicationInitialMaximized: "org.example.Mail\norg.example.Calendar",
  applicationTilingExclusions: "org.example.Legacy\norg.example.Editor=tool",
  alwaysCenterSingleColumn: validSettings.alwaysCenterSingleColumn,
  borderlessWindows: validSettings.borderlessWindows,
  centerFocusedColumn: validSettings.centerFocusedColumn,
  centerFocusedColumnOnOverflow: validSettings.centerFocusedColumnOnOverflow,
  columnWidthPresets: validSettings.columnWidthPresets.canonicalValue,
  columnWidthStepPixels: validSettings.columnWidthStepPixels,
  columnWidthStepPercent: validSettings.columnWidthStepPercent,
  defaultColumnPresentation: validSettings.defaultColumnPresentation,
  defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
  defaultColumnWidthPixels: validSettings.defaultColumnWidthPixels,
  defaultFloatingPosition: validDefaultFloatingPosition.canonicalValue,
  defaultWindowHeight: validSettings.defaultWindowHeight.canonicalValue,
  emptyDesktopAboveFirst: validSettings.emptyDesktopAboveFirst,
  gap: validSettings.gap,
  showTabIndicator: validSettings.showTabIndicator,
  touchpadNavigation: validSettings.touchpadNavigation,
  touchpadNavigationFingerCount: validSettings.touchpadNavigationFingerCount,
  touchpadNaturalScroll: validSettings.touchpadNaturalScroll,
  touchpadWorkspaceNavigation: validSettings.touchpadWorkspaceNavigation,
  workspaceAutoBackAndForth: validSettings.workspaceAutoBackAndForth,
  windowHeightPresets: validSettings.windowHeightPresets.canonicalValue,
  windowHeightStepPixels: validSettings.windowHeightStepPixels,
  windowHeightStepPercent: validSettings.windowHeightStepPercent,
};

describe("Driftile settings", () => {
  it("exposes the current immutable defaults", () => {
    expect(DEFAULT_DRIFTILE_SETTINGS).toMatchObject({
      alwaysCenterSingleColumn: false,
      borderlessWindows: true,
      centerFocusedColumn: false,
      centerFocusedColumnOnOverflow: false,
      columnWidthStepPixels: 0,
      columnWidthStepPercent: 10,
      defaultColumnPresentation: "stacked",
      defaultColumnWidthPercent: 33,
      defaultColumnWidthPixels: 0,
      defaultFloatingPosition: null,
      emptyDesktopAboveFirst: false,
      gap: 16,
      showTabIndicator: true,
      touchpadNavigation: false,
      touchpadNavigationFingerCount: 5,
      touchpadNaturalScroll: true,
      touchpadWorkspaceNavigation: false,
      workspaceAutoBackAndForth: false,
      windowHeightStepPixels: 0,
      windowHeightStepPercent: 10,
    });
    expect(DEFAULT_DRIFTILE_SETTINGS.defaultWindowHeight).toEqual({
      canonicalValue: "auto",
      windowHeight: null,
    });
    expect(DISABLED_DEFAULT_FLOATING_POSITION).toEqual({
      canonicalValue: "",
      floatingPosition: null,
    });
    expect(Object.isFrozen(DISABLED_DEFAULT_FLOATING_POSITION)).toBe(true);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationBorderlessExclusions
        .canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationColumnWidths.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationWindowHeights.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationColumnPresentations.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialFloating.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationFloatingPositions.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialDestinations.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialFocused.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialUnfocused.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialFullWidth.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialFullscreen.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialMaximized.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationFocusCentering.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationTilingExclusions.canonicalEntries,
    ).toEqual([]);
    expect(DEFAULT_DRIFTILE_SETTINGS.columnWidthPresets.canonicalValue).toBe(
      "",
    );
    expect(DEFAULT_DRIFTILE_SETTINGS.columnWidthPresets.percentages).toEqual(
      [],
    );
    expect(DEFAULT_DRIFTILE_SETTINGS.windowHeightPresets.canonicalValue).toBe(
      "",
    );
    expect(DEFAULT_DRIFTILE_SETTINGS.windowHeightPresets.percentages).toEqual(
      [],
    );
    expect(Object.isFrozen(DEFAULT_DRIFTILE_SETTINGS)).toBe(true);
  });

  it("decodes a valid snapshot without retaining the input object", () => {
    const input = { ...validSettingsInput };
    const decoded = decodeDriftileSettings(input);

    expect(decoded).toMatchObject({
      alwaysCenterSingleColumn: validSettings.alwaysCenterSingleColumn,
      borderlessWindows: validSettings.borderlessWindows,
      centerFocusedColumn: validSettings.centerFocusedColumn,
      centerFocusedColumnOnOverflow:
        validSettings.centerFocusedColumnOnOverflow,
      columnWidthPresets: validSettings.columnWidthPresets,
      columnWidthStepPixels: validSettings.columnWidthStepPixels,
      columnWidthStepPercent: validSettings.columnWidthStepPercent,
      defaultColumnPresentation: validSettings.defaultColumnPresentation,
      defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
      defaultColumnWidthPixels: validSettings.defaultColumnWidthPixels,
      defaultFloatingPosition: validSettings.defaultFloatingPosition,
      defaultWindowHeight: validSettings.defaultWindowHeight,
      emptyDesktopAboveFirst: validSettings.emptyDesktopAboveFirst,
      gap: validSettings.gap,
      showTabIndicator: validSettings.showTabIndicator,
      touchpadNavigation: validSettings.touchpadNavigation,
      touchpadNavigationFingerCount:
        validSettings.touchpadNavigationFingerCount,
      touchpadNaturalScroll: validSettings.touchpadNaturalScroll,
      touchpadWorkspaceNavigation: validSettings.touchpadWorkspaceNavigation,
      workspaceAutoBackAndForth: validSettings.workspaceAutoBackAndForth,
      windowHeightPresets: validSettings.windowHeightPresets,
      windowHeightStepPixels: validSettings.windowHeightStepPixels,
      windowHeightStepPercent: validSettings.windowHeightStepPercent,
    });
    expect(decoded?.applicationColumnWidths.canonicalEntries).toEqual(
      validApplicationColumnWidths.canonicalEntries,
    );
    expect(decoded?.applicationWindowHeights.canonicalEntries).toEqual(
      validApplicationWindowHeights.canonicalEntries,
    );
    expect(decoded?.applicationColumnPresentations.canonicalEntries).toEqual(
      validApplicationColumnPresentations.canonicalEntries,
    );
    expect(
      decoded?.applicationColumnPresentations.columnPresentationFor(
        "org.example.Browser",
      ),
    ).toBe("tabbed");
    expect(
      decoded?.applicationColumnPresentations.columnPresentationFor(
        "org.example.Editor",
      ),
    ).toBe("stacked");
    expect(decoded?.applicationBorderlessExclusions.canonicalEntries).toEqual(
      validApplicationBorderlessExclusions.canonicalEntries,
    );
    expect(decoded?.applicationInitialFloating.canonicalEntries).toEqual(
      validApplicationInitialFloating.canonicalEntries,
    );
    expect(decoded?.applicationFloatingPositions.canonicalEntries).toEqual(
      validApplicationFloatingPositions.canonicalEntries,
    );
    expect(decoded?.applicationInitialDestinations.canonicalEntries).toEqual(
      validApplicationInitialDestinations.canonicalEntries,
    );
    expect(decoded?.applicationInitialFocused.canonicalEntries).toEqual(
      validApplicationInitialFocused.canonicalEntries,
    );
    expect(decoded?.applicationInitialUnfocused.canonicalEntries).toEqual(
      validApplicationInitialUnfocused.canonicalEntries,
    );
    expect(
      decoded?.applicationInitialDestinations.initialDestinationFor(
        "org.example.Chat",
      ),
    ).toEqual({ desktop: 2, output: "DP-1" });
    expect(
      decoded?.applicationInitialDestinations.initialDestinationFor(
        "org.example.chat",
      ),
    ).toBeUndefined();
    expect(decoded?.applicationInitialFullWidth.canonicalEntries).toEqual(
      validApplicationInitialFullWidth.canonicalEntries,
    );
    expect(decoded?.applicationInitialFullscreen.canonicalEntries).toEqual(
      validApplicationInitialFullscreen.canonicalEntries,
    );
    expect(decoded?.applicationInitialMaximized.canonicalEntries).toEqual(
      validApplicationInitialMaximized.canonicalEntries,
    );
    expect(decoded?.applicationFocusCentering.canonicalEntries).toEqual(
      validApplicationFocusCentering.canonicalEntries,
    );
    expect(
      decoded?.applicationFocusCentering.centersOnFocus("org.example.Browser"),
    ).toBe(true);
    expect(
      decoded?.applicationFocusCentering.centersOnFocus("org.example.browser"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialFloating.excludes("org.example.Floating"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialFloating.excludes("org.example.floating"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialFocused.excludes("org.example.Chat"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialFocused.excludes("org.example.chat"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialUnfocused.excludes("org.example.Background"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialUnfocused.excludes("org.example.background"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialFullWidth.excludes("org.example.Browser"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialFullWidth.excludes("org.example.browser"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialFullscreen.excludes("org.example.Game"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialFullscreen.excludes("org.example.game"),
    ).toBe(false);
    expect(
      decoded?.applicationInitialMaximized.excludes("org.example.Mail"),
    ).toBe(true);
    expect(
      decoded?.applicationInitialMaximized.excludes("org.example.mail"),
    ).toBe(false);
    expect(decoded?.applicationTilingExclusions.canonicalEntries).toEqual(
      validApplicationTilingExclusions.canonicalEntries,
    );
    expect(decoded).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(input).toEqual(validSettingsInput);
  });

  it.each([
    {
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
      columnWidthPresets: "10",
      columnWidthStepPixels: 0,
      columnWidthStepPercent: 1,
      defaultColumnPresentation: "stacked",
      defaultColumnWidthPercent: 10,
      defaultColumnWidthPixels: 0,
      defaultFloatingPosition: "",
      defaultWindowHeight: "auto",
      emptyDesktopAboveFirst: false,
      gap: 0,
      showTabIndicator: false,
      touchpadNavigation: false,
      touchpadNavigationFingerCount: 3,
      touchpadNaturalScroll: false,
      touchpadWorkspaceNavigation: false,
      workspaceAutoBackAndForth: false,
      windowHeightPresets: "10",
      windowHeightStepPixels: 0,
      windowHeightStepPercent: 1,
    },
    {
      applicationBorderlessExclusions: "org.example.Decorated",
      applicationColumnPresentations: "org.example.Browser=tabbed",
      applicationColumnWidths: "org.example.Browser=80",
      applicationWindowHeights: "org.example.Browser=80",
      applicationFocusCentering: "org.example.Browser",
      applicationFloatingPositions: "org.example.Floating=top-left,0,0",
      applicationInitialDestinations: "org.example.Chat=desktop:25,output:DP-1",
      applicationInitialFocused: "org.example.Chat",
      applicationInitialUnfocused: "org.example.Background",
      applicationInitialFloating: "org.example.Floating",
      applicationInitialFullWidth: "org.example.Browser",
      applicationInitialFullscreen: "org.example.Game",
      applicationInitialMaximized: "org.example.Mail",
      applicationTilingExclusions: "org.example.Legacy",
      alwaysCenterSingleColumn: true,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: "100",
      columnWidthStepPixels: 16_384,
      columnWidthStepPercent: 50,
      defaultColumnPresentation: "tabbed",
      defaultColumnWidthPercent: 100,
      defaultColumnWidthPixels: 16_384,
      defaultFloatingPosition: "right,16384,-16384",
      defaultWindowHeight: "16384px",
      emptyDesktopAboveFirst: true,
      gap: 64,
      showTabIndicator: true,
      touchpadNavigation: true,
      touchpadNavigationFingerCount: 5,
      touchpadNaturalScroll: true,
      touchpadWorkspaceNavigation: true,
      workspaceAutoBackAndForth: true,
      windowHeightPresets: "100",
      windowHeightStepPixels: 16_384,
      windowHeightStepPercent: 50,
    },
  ])("accepts the inclusive numeric bounds", (settings) => {
    const decoded = decodeDriftileSettings(settings);

    expect(decoded).not.toBeNull();
    expect(
      decoded?.applicationBorderlessExclusions.canonicalEntries.join("\n"),
    ).toBe(settings.applicationBorderlessExclusions);
    expect(decoded?.applicationColumnWidths.canonicalEntries.join("\n")).toBe(
      settings.applicationColumnWidths,
    );
    expect(decoded?.defaultWindowHeight.canonicalValue).toBe(
      settings.defaultWindowHeight,
    );
    expect(decoded?.defaultFloatingPosition).toEqual(
      decodeDefaultFloatingPosition(settings.defaultFloatingPosition)
        ?.floatingPosition,
    );
    expect(decoded?.applicationWindowHeights.canonicalEntries.join("\n")).toBe(
      settings.applicationWindowHeights,
    );
    expect(
      decoded?.applicationColumnPresentations.canonicalEntries.join("\n"),
    ).toBe(settings.applicationColumnPresentations);
    expect(decoded?.applicationFocusCentering.canonicalEntries.join("\n")).toBe(
      settings.applicationFocusCentering,
    );
    expect(
      decoded?.applicationFloatingPositions.canonicalEntries.join("\n"),
    ).toBe(settings.applicationFloatingPositions);
    expect(
      decoded?.applicationInitialDestinations.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialDestinations);
    expect(decoded?.applicationInitialFocused.canonicalEntries.join("\n")).toBe(
      settings.applicationInitialFocused,
    );
    expect(
      decoded?.applicationInitialUnfocused.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialUnfocused);
    expect(
      decoded?.applicationInitialFloating.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialFloating);
    expect(
      decoded?.applicationInitialFullWidth.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialFullWidth);
    expect(
      decoded?.applicationInitialFullscreen.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialFullscreen);
    expect(
      decoded?.applicationInitialMaximized.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialMaximized);
    expect(
      decoded?.applicationTilingExclusions.canonicalEntries.join("\n"),
    ).toBe(settings.applicationTilingExclusions);
    expect(decoded?.columnWidthPresets.canonicalValue).toBe(
      settings.columnWidthPresets,
    );
    expect(decoded?.windowHeightPresets.canonicalValue).toBe(
      settings.windowHeightPresets,
    );
    expect(decoded).toMatchObject({
      alwaysCenterSingleColumn: settings.alwaysCenterSingleColumn,
      borderlessWindows: settings.borderlessWindows,
      centerFocusedColumn: settings.centerFocusedColumn,
      centerFocusedColumnOnOverflow: settings.centerFocusedColumnOnOverflow,
      columnWidthStepPixels: settings.columnWidthStepPixels,
      columnWidthStepPercent: settings.columnWidthStepPercent,
      defaultColumnPresentation: settings.defaultColumnPresentation,
      defaultColumnWidthPercent: settings.defaultColumnWidthPercent,
      defaultColumnWidthPixels: settings.defaultColumnWidthPixels,
      emptyDesktopAboveFirst: settings.emptyDesktopAboveFirst,
      gap: settings.gap,
      showTabIndicator: settings.showTabIndicator,
      touchpadNavigation: settings.touchpadNavigation,
      touchpadNavigationFingerCount: settings.touchpadNavigationFingerCount,
      touchpadNaturalScroll: settings.touchpadNaturalScroll,
      touchpadWorkspaceNavigation: settings.touchpadWorkspaceNavigation,
      windowHeightStepPixels: settings.windowHeightStepPixels,
      windowHeightStepPercent: settings.windowHeightStepPercent,
    });
  });

  it.each([
    [
      "a non-boolean single-column centering setting",
      { alwaysCenterSingleColumn: 1 },
    ],
    ["a non-boolean borderless setting", { borderlessWindows: 1 }],
    [
      "a non-boolean empty-desktop-above setting",
      { emptyDesktopAboveFirst: 1 },
    ],
    ["a non-boolean centering setting", { centerFocusedColumn: 1 }],
    [
      "a non-boolean overflow centering setting",
      { centerFocusedColumnOnOverflow: 1 },
    ],
    ["a non-boolean tab-indicator setting", { showTabIndicator: 1 }],
    ["a non-boolean touchpad setting", { touchpadNavigation: 1 }],
    [
      "a non-numeric touchpad finger count",
      { touchpadNavigationFingerCount: "5" },
    ],
    [
      "a non-finite touchpad finger count",
      { touchpadNavigationFingerCount: Number.NaN },
    ],
    [
      "an infinite touchpad finger count",
      { touchpadNavigationFingerCount: Number.POSITIVE_INFINITY },
    ],
    [
      "a fractional touchpad finger count",
      { touchpadNavigationFingerCount: 3.5 },
    ],
    [
      "a touchpad finger count below its range",
      { touchpadNavigationFingerCount: 2 },
    ],
    [
      "a touchpad finger count above its range",
      { touchpadNavigationFingerCount: 6 },
    ],
    ["a non-boolean natural-scroll setting", { touchpadNaturalScroll: 1 }],
    [
      "a non-boolean touchpad workspace setting",
      { touchpadWorkspaceNavigation: 1 },
    ],
    [
      "a non-boolean workspace back-and-forth setting",
      { workspaceAutoBackAndForth: 1 },
    ],
    ["an invalid default presentation", { defaultColumnPresentation: "tiled" }],
    ["invalid column-width presets", { columnWidthPresets: "50,40" }],
    ["invalid window-height presets", { windowHeightPresets: "50,40" }],
    [
      "an invalid default floating position",
      { defaultFloatingPosition: "center,0,0" },
    ],
    ["an invalid default window height", { defaultWindowHeight: "9" }],
    [
      "invalid application overrides",
      { applicationColumnWidths: "org.example.Editor=9" },
    ],
    [
      "invalid application window heights",
      { applicationWindowHeights: "org.example.Editor=9" },
    ],
    [
      "invalid application column presentation",
      { applicationColumnPresentations: "org.example.Editor=tiled" },
    ],
    [
      "duplicate application borderless exclusions",
      {
        applicationBorderlessExclusions:
          "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application initial-floating entries",
      {
        applicationInitialFloating: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application floating-position entries",
      {
        applicationFloatingPositions:
          "org.example.Editor=top,0,0\n org.example.Editor =bottom,0,0",
      },
    ],
    [
      "duplicate application initial-destination entries",
      {
        applicationInitialDestinations:
          "org.example.Editor=desktop:1\n org.example.Editor =output:DP-1",
      },
    ],
    [
      "duplicate application initial-focused entries",
      {
        applicationInitialFocused: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application initial-unfocused entries",
      {
        applicationInitialUnfocused: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application initial-full-width entries",
      {
        applicationInitialFullWidth: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application initial-fullscreen entries",
      {
        applicationInitialFullscreen:
          "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application initial-maximized entries",
      {
        applicationInitialMaximized: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application focus-centering entries",
      {
        applicationFocusCentering: "org.example.Editor\n org.example.Editor ",
      },
    ],
    [
      "duplicate application tiling exclusions",
      {
        applicationTilingExclusions: "org.example.Editor\n org.example.Editor ",
      },
    ],
    ["a non-numeric gap", { gap: "16" }],
    ["a non-finite gap", { gap: Number.NaN }],
    ["an infinite gap", { gap: Number.POSITIVE_INFINITY }],
    ["a gap below its range", { gap: -1 }],
    ["a gap above its range", { gap: 65 }],
    ["a non-numeric default width", { defaultColumnWidthPercent: "50" }],
    ["a non-finite default width", { defaultColumnWidthPercent: Number.NaN }],
    ["an infinite default width", { defaultColumnWidthPercent: -Infinity }],
    ["a fractional default width", { defaultColumnWidthPercent: 50.5 }],
    ["a default width below its range", { defaultColumnWidthPercent: 9 }],
    ["a default width above its range", { defaultColumnWidthPercent: 101 }],
    ["a non-numeric fixed default width", { defaultColumnWidthPixels: "0" }],
    ["a non-finite fixed default width", { defaultColumnWidthPixels: NaN }],
    ["an infinite fixed default width", { defaultColumnWidthPixels: Infinity }],
    ["a fractional fixed default width", { defaultColumnWidthPixels: 0.5 }],
    ["a fixed default width below its range", { defaultColumnWidthPixels: -1 }],
    [
      "a fixed default width above its range",
      { defaultColumnWidthPixels: 16_385 },
    ],
    ["a non-numeric width step", { columnWidthStepPercent: "10" }],
    ["a non-finite width step", { columnWidthStepPercent: Number.NaN }],
    ["an infinite width step", { columnWidthStepPercent: Infinity }],
    ["a fractional width step", { columnWidthStepPercent: 10.5 }],
    ["a width step below its range", { columnWidthStepPercent: 0 }],
    ["a width step above its range", { columnWidthStepPercent: 51 }],
    ["a non-numeric fixed width step", { columnWidthStepPixels: "0" }],
    ["a non-finite fixed width step", { columnWidthStepPixels: Number.NaN }],
    ["an infinite fixed width step", { columnWidthStepPixels: Infinity }],
    ["a fractional fixed width step", { columnWidthStepPixels: 10.5 }],
    ["a fixed width step below its range", { columnWidthStepPixels: -1 }],
    ["a fixed width step above its range", { columnWidthStepPixels: 16_385 }],
    ["a non-numeric height step", { windowHeightStepPercent: "10" }],
    ["a non-finite height step", { windowHeightStepPercent: Number.NaN }],
    ["an infinite height step", { windowHeightStepPercent: -Infinity }],
    ["a fractional height step", { windowHeightStepPercent: 10.5 }],
    ["a height step below its range", { windowHeightStepPercent: 0 }],
    ["a height step above its range", { windowHeightStepPercent: 51 }],
    ["a non-numeric fixed height step", { windowHeightStepPixels: "0" }],
    ["a non-finite fixed height step", { windowHeightStepPixels: Number.NaN }],
    ["an infinite fixed height step", { windowHeightStepPixels: -Infinity }],
    ["a fractional fixed height step", { windowHeightStepPixels: 10.5 }],
    ["a fixed height step below its range", { windowHeightStepPixels: -1 }],
    ["a fixed height step above its range", { windowHeightStepPixels: 16_385 }],
  ])("rejects %s atomically", (_description, invalidField) => {
    const input = { ...validSettingsInput, ...invalidField };

    expect(decodeDriftileSettings(input)).toBeNull();
    expect(input).toEqual({ ...validSettingsInput, ...invalidField });
  });

  it.each([null, [], "settings", 1, true])(
    "rejects a non-record root: %j",
    (input) => {
      expect(decodeDriftileSettings(input)).toBeNull();
    },
  );

  it("rejects an incomplete thirty-seven-field snapshot", () => {
    const incomplete: Record<string, unknown> = { ...validSettingsInput };
    delete incomplete["defaultColumnWidthPixels"];

    expect(decodeDriftileSettings(incomplete)).toBeNull();
  });

  it("rejects extra fields to expose incompatible snapshots and typos", () => {
    expect(
      decodeDriftileSettings({ ...validSettingsInput, unexpected: true }),
    ).toBeNull();
  });

  it("compares snapshots by every setting", () => {
    expect(sameDriftileSettings(validSettings, { ...validSettings })).toBe(
      true,
    );

    const changedApplicationColumnWidths =
      decodeApplicationColumnWidthOverrides("org.example.Editor=76");

    if (!changedApplicationColumnWidths) {
      throw new Error("application override fixture is invalid");
    }

    const changedApplicationWindowHeights =
      decodeApplicationWindowHeightOverrides("org.example.Editor=76");

    if (!changedApplicationWindowHeights) {
      throw new Error("application window-height fixture is invalid");
    }

    const changedApplicationColumnPresentations =
      decodeApplicationColumnPresentations("org.example.Editor=tabbed");

    if (!changedApplicationColumnPresentations) {
      throw new Error("application column-presentation fixture is invalid");
    }

    const changedApplicationBorderlessExclusions =
      decodeApplicationBorderlessExclusions("org.example.Other");

    if (!changedApplicationBorderlessExclusions) {
      throw new Error("application borderless exclusion fixture is invalid");
    }

    const changedApplicationInitialFloating =
      decodeApplicationInitialFloating("org.example.Other");

    if (!changedApplicationInitialFloating) {
      throw new Error("application initial-floating fixture is invalid");
    }

    const changedApplicationFloatingPositions =
      decodeApplicationFloatingPositions("org.example.Other=left,10,20");

    if (!changedApplicationFloatingPositions) {
      throw new Error("application floating-position fixture is invalid");
    }

    const changedApplicationInitialDestinations =
      decodeApplicationInitialDestinations(
        "org.example.Other=desktop:3,output:HDMI-A-1",
      );

    if (!changedApplicationInitialDestinations) {
      throw new Error("application initial-destination fixture is invalid");
    }

    const changedApplicationInitialFocused =
      decodeApplicationInitialFocused("org.example.Other");

    if (!changedApplicationInitialFocused) {
      throw new Error("application initial-focused fixture is invalid");
    }

    const changedApplicationInitialUnfocused =
      decodeApplicationInitialUnfocused("org.example.Other");

    if (!changedApplicationInitialUnfocused) {
      throw new Error("application initial-unfocused fixture is invalid");
    }

    const changedApplicationInitialFullWidth =
      decodeApplicationInitialFullWidth("org.example.Other");

    if (!changedApplicationInitialFullWidth) {
      throw new Error("application initial-full-width fixture is invalid");
    }

    const changedApplicationInitialFullscreen =
      decodeApplicationInitialFullscreen("org.example.Other");

    if (!changedApplicationInitialFullscreen) {
      throw new Error("application initial-fullscreen fixture is invalid");
    }

    const changedApplicationInitialMaximized =
      decodeApplicationInitialMaximized("org.example.Other");

    if (!changedApplicationInitialMaximized) {
      throw new Error("application initial-maximized fixture is invalid");
    }

    const changedApplicationFocusCentering =
      decodeApplicationFocusCentering("org.example.Other");

    if (!changedApplicationFocusCentering) {
      throw new Error("application focus-centering fixture is invalid");
    }

    const changedColumnWidthPresets =
      decodeColumnWidthPresetPercentages("20,50,90");

    if (!changedColumnWidthPresets) {
      throw new Error("column-width preset fixture is invalid");
    }

    const changedWindowHeightPresets =
      decodeWindowHeightPresetPercentages("25,50,90");

    if (!changedWindowHeightPresets) {
      throw new Error("window-height preset fixture is invalid");
    }

    const changedDefaultWindowHeight = decodeDefaultWindowHeight("60%");

    if (!changedDefaultWindowHeight) {
      throw new Error("default window-height fixture is invalid");
    }

    const changedDefaultFloatingPosition =
      decodeDefaultFloatingPosition("top-right,12,-8")?.floatingPosition;

    if (!changedDefaultFloatingPosition) {
      throw new Error("default floating-position fixture is invalid");
    }

    const changedApplicationTilingExclusions =
      decodeApplicationTilingExclusions("org.example.Other");

    if (!changedApplicationTilingExclusions) {
      throw new Error("application tiling exclusion fixture is invalid");
    }

    for (const changed of [
      {
        applicationBorderlessExclusions: changedApplicationBorderlessExclusions,
      },
      {
        applicationColumnPresentations: changedApplicationColumnPresentations,
      },
      { applicationColumnWidths: changedApplicationColumnWidths },
      { applicationWindowHeights: changedApplicationWindowHeights },
      { applicationFocusCentering: changedApplicationFocusCentering },
      { applicationFloatingPositions: changedApplicationFloatingPositions },
      {
        applicationInitialDestinations: changedApplicationInitialDestinations,
      },
      { applicationInitialFocused: changedApplicationInitialFocused },
      { applicationInitialUnfocused: changedApplicationInitialUnfocused },
      { applicationInitialFloating: changedApplicationInitialFloating },
      { applicationInitialFullWidth: changedApplicationInitialFullWidth },
      { applicationInitialFullscreen: changedApplicationInitialFullscreen },
      { applicationInitialMaximized: changedApplicationInitialMaximized },
      { applicationTilingExclusions: changedApplicationTilingExclusions },
      { alwaysCenterSingleColumn: false },
      { borderlessWindows: true },
      { centerFocusedColumn: false },
      { centerFocusedColumnOnOverflow: false },
      { columnWidthPresets: changedColumnWidthPresets },
      { columnWidthStepPixels: 241 },
      { columnWidthStepPercent: 26 },
      { defaultColumnPresentation: "stacked" as const },
      { defaultColumnWidthPercent: 76 },
      { defaultColumnWidthPixels: 961 },
      { defaultFloatingPosition: changedDefaultFloatingPosition },
      { defaultWindowHeight: changedDefaultWindowHeight },
      { emptyDesktopAboveFirst: false },
      { gap: 33 },
      { showTabIndicator: true },
      { touchpadNavigation: false },
      { touchpadNavigationFingerCount: 5 },
      { touchpadNaturalScroll: true },
      { touchpadWorkspaceNavigation: false },
      { workspaceAutoBackAndForth: false },
      { windowHeightPresets: changedWindowHeightPresets },
      { windowHeightStepPixels: 181 },
      { windowHeightStepPercent: 21 },
    ]) {
      expect(
        sameDriftileSettings(validSettings, { ...validSettings, ...changed }),
      ).toBe(false);
    }
  });
});

function decodedDefaultFloatingPosition(value: unknown) {
  const position = decodeDefaultFloatingPosition(value);

  if (!position) {
    throw new Error("default floating-position fixture is invalid");
  }

  return position;
}

describe("default floating-position codec", () => {
  it("normalizes an immutable enabled value without retaining its input", () => {
    const input = " bottom-right,-24,16 ";
    const decoded = decodedDefaultFloatingPosition(input);

    expect(decoded).toEqual({
      canonicalValue: "bottom-right,-24,16",
      floatingPosition: {
        anchor: "bottom-right",
        x: -24,
        y: 16,
      },
    });
    expect(Object.isFrozen(decoded.floatingPosition)).toBe(true);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(input).toBe(" bottom-right,-24,16 ");
  });

  it.each<ApplicationFloatingPositionAnchor>([
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ])("accepts the %s anchor", (anchor) => {
    expect(
      decodedDefaultFloatingPosition(`${anchor},0,0`).floatingPosition,
    ).toEqual({ anchor, x: 0, y: 0 });
  });

  it("supports a disabled singleton and inclusive offset bounds", () => {
    expect(decodeDefaultFloatingPosition("")).toBe(
      DISABLED_DEFAULT_FLOATING_POSITION,
    );
    expect(decodeDefaultFloatingPosition(" \t ")).toBe(
      DISABLED_DEFAULT_FLOATING_POSITION,
    );
    expect(
      decodedDefaultFloatingPosition("left,-16384,16384").floatingPosition,
    ).toEqual({ anchor: "left", x: -16_384, y: 16_384 });
  });

  it("compares disabled and enabled positions by semantic value", () => {
    const position =
      decodedDefaultFloatingPosition("top,4,-8").floatingPosition;
    const equivalent: ApplicationFloatingPosition = Object.freeze({
      anchor: "top",
      x: 4,
      y: -8,
    });
    const changed: ApplicationFloatingPosition = Object.freeze({
      anchor: "top",
      x: 4,
      y: -7,
    });

    expect(sameDefaultFloatingPositions(null, null)).toBe(true);
    expect(sameDefaultFloatingPositions(position, equivalent)).toBe(true);
    expect(sameDefaultFloatingPositions(position, changed)).toBe(false);
    expect(sameDefaultFloatingPositions(position, null)).toBe(false);
  });

  it.each([
    null,
    {},
    ["top,0,0"],
    1,
    "center,0,0",
    "top,+1,0",
    "top,-0,0",
    "top,01,0",
    "top,1.0,0",
    "top,1e2,0",
    "top,16385,0",
    "top,-16385,0",
    "top,0, 0",
    "top,0",
    "top,0,0,0",
    "top,0,0\n",
  ])("rejects malformed input atomically: %j", (value) => {
    expect(decodeDefaultFloatingPosition(value)).toBeNull();
  });

  it("rejects an oversized encoded value before parsing", () => {
    expect(decodeDefaultFloatingPosition(" ".repeat(33))).toBeNull();
  });
});

function decodedApplicationInitialDestinations(value: unknown) {
  const destinations = decodeApplicationInitialDestinations(value);

  if (!destinations) {
    throw new Error("application initial-destination fixture is invalid");
  }

  return destinations;
}

describe("application initial-destination codec", () => {
  it("normalizes entries into deterministic immutable exact lookup state", () => {
    const input =
      " org.telegram.desktop =output:DP-1,desktop:2\norg.mozilla.firefox=output:HDMI-A-1,desktop-name:Web Browsing";
    const destinations = decodedApplicationInitialDestinations(input);

    expect(destinations.canonicalEntries).toEqual([
      "org.mozilla.firefox=desktop-name:Web Browsing,output:HDMI-A-1",
      "org.telegram.desktop=desktop:2,output:DP-1",
    ]);
    expect(destinations.initialDestinationFor("org.mozilla.firefox")).toEqual({
      desktopName: "Web Browsing",
      output: "HDMI-A-1",
    });
    expect(destinations.initialDestinationFor("org.telegram.desktop")).toEqual({
      desktop: 2,
      output: "DP-1",
    });
    expect(
      destinations.initialDestinationFor("org.Telegram.desktop"),
    ).toBeUndefined();
    expect(
      destinations.initialDestinationFor(" org.telegram.desktop "),
    ).toBeUndefined();
    expect(
      Object.isFrozen(
        destinations.initialDestinationFor("org.telegram.desktop"),
      ),
    ).toBe(true);
    expect(Object.isFrozen(destinations.canonicalEntries)).toBe(true);
    expect(Object.isFrozen(destinations)).toBe(true);
    expect(input).toContain("output:DP-1,desktop:2");
  });

  it("accepts numeric, named, output-only, combined destinations, and blank lines", () => {
    const destinations = decodedApplicationInitialDestinations(
      "\n desktop-only =desktop:1\n\t\nnamed-only=desktop-name:Development\noutput-only=output:HDMI-A-1\n both=desktop:25,output:DP-2\n",
    );

    expect(EMPTY_APPLICATION_INITIAL_DESTINATIONS.canonicalEntries).toEqual([]);
    expect(
      EMPTY_APPLICATION_INITIAL_DESTINATIONS.initialDestinationFor(
        "application",
      ),
    ).toBeUndefined();
    expect(destinations.initialDestinationFor("desktop-only")).toEqual({
      desktop: 1,
    });
    expect(destinations.initialDestinationFor("named-only")).toEqual({
      desktopName: "Development",
    });
    expect(destinations.initialDestinationFor("output-only")).toEqual({
      output: "HDMI-A-1",
    });
    expect(destinations.initialDestinationFor("both")).toEqual({
      desktop: 25,
      output: "DP-2",
    });
  });

  it("compares canonical semantics rather than entry or field order", () => {
    const first = decodedApplicationInitialDestinations(
      "zeta=output:DP-1,desktop:4\n alpha =desktop:2",
    );
    const equivalent = decodedApplicationInitialDestinations(
      "alpha=desktop:2\nzeta=desktop:4,output:DP-1",
    );
    const changed = decodedApplicationInitialDestinations(
      "alpha=desktop:2\nzeta=desktop:4,output:DP-2",
    );

    expect(sameApplicationInitialDestinations(first, first)).toBe(true);
    expect(sameApplicationInitialDestinations(first, equivalent)).toBe(true);
    expect(sameApplicationInitialDestinations(first, changed)).toBe(false);
  });

  it.each([
    null,
    {},
    ["application=desktop:2"],
    1,
    "application",
    "=desktop:2",
    "application=",
    "application=workspace:2",
    "application=desktop:0",
    "application=desktop:26",
    "application=desktop:+2",
    "application=desktop:02",
    "application=desktop:2.0",
    "application=desktop:2e0",
    "application=desktop: 2",
    "application=desktop:2 ",
    "application= desktop:2",
    "application=desktop:2, output:DP-1",
    "application=desktop:2,desktop:3",
    "application=desktop:2,desktop-name:Development",
    "application=desktop-name:Development,desktop:2",
    "application=desktop-name:Development,desktop-name:Review",
    "application=desktop:2,desktop-name:Development,output:DP-1",
    "application=desktop-name:",
    "application=desktop-name: Development",
    "application=desktop-name:Development ",
    "application=desktop-name:Development,Review",
    "application=output:DP-1,output:DP-2",
    "application=desktop:2,output:",
    "application=output: DP-1",
    "application=output:DP-1 ",
    "application=output:DP-1,extra",
    "application=desktop:2,output:DP-1,",
    "application=desktop:2=output:DP-1",
    "delete\u007fkey=desktop:2",
    "bad\ud800key=desktop:2",
    "application=desktop-name:bad\u0080name",
    "application=desktop-name:bad\udc00name",
    "application=output:bad\u0080name",
    "application=output:bad\udc00name",
  ])("rejects malformed input atomically: %j", (value) => {
    expect(decodeApplicationInitialDestinations(value)).toBeNull();
  });

  it("enforces entry, line, document, identifier, desktop-name, output, and UTF-8 bounds", () => {
    const maximumEntries = Array.from(
      { length: APPLICATION_INITIAL_DESTINATION_LIMITS.entries },
      (_, index) => `application-${String(index)}=desktop:1`,
    );
    const maximumIdentifier = "a".repeat(
      APPLICATION_INITIAL_DESTINATION_LIMITS.identifierBytes,
    );
    const maximumUtf8Identifier = `${"é".repeat(127)}a`;
    const maximumDesktopName = "d".repeat(
      APPLICATION_INITIAL_DESTINATION_LIMITS.desktopNameBytes,
    );
    const maximumUtf8DesktopName = `${"é".repeat(127)}a`;
    const maximumOutput = "o".repeat(
      APPLICATION_INITIAL_DESTINATION_LIMITS.outputNameBytes,
    );
    const maximumUtf8Output = `${"é".repeat(127)}a`;
    const maximumLineIdentifier = "a".repeat(249);
    const maximumDocument = Array.from(
      { length: APPLICATION_INITIAL_DESTINATION_LIMITS.entries },
      (_, index) => {
        const prefix = `application-${String(index).padStart(3, "0")}`;
        const identifier = `${prefix}${"a".repeat(249 - prefix.length)}`;

        return `${identifier}=output:${maximumOutput}`;
      },
    ).join("\n");

    expect(
      decodeApplicationInitialDestinations(maximumEntries.join("\n")),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        [...maximumEntries, "overflow=desktop:1"].join("\n"),
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(`${maximumIdentifier}=desktop:1`),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(`${maximumIdentifier}a=desktop:1`),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `${maximumUtf8Identifier}=desktop:1`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `${maximumUtf8Identifier}é=desktop:1`,
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=desktop-name:${maximumDesktopName}`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=desktop-name:${maximumDesktopName}d`,
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=desktop-name:${maximumUtf8DesktopName}`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=desktop-name:${maximumUtf8DesktopName}é`,
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=output:${maximumOutput}`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=output:${maximumOutput}o`,
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=output:${maximumUtf8Output}`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `application=output:${maximumUtf8Output}é`,
      ),
    ).toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `${maximumLineIdentifier}=output:${maximumOutput}`,
      ),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(
        `${maximumLineIdentifier}a=output:${maximumOutput}`,
      ),
    ).toBeNull();
    expect(maximumDocument.length).toBe(
      APPLICATION_INITIAL_DESTINATION_LIMITS.documentCharacters - 1,
    );
    expect(
      decodeApplicationInitialDestinations(`${maximumDocument}\n`),
    ).not.toBeNull();
    expect(
      decodeApplicationInitialDestinations(`${maximumDocument}\n\n`),
    ).toBeNull();
  });

  it("rejects duplicate normalized identifiers atomically", () => {
    expect(
      decodeApplicationInitialDestinations(
        "org.example.App=desktop:2\n org.example.App =output:DP-1",
      ),
    ).toBeNull();
  });
});

function decodedApplicationFloatingPositions(value: unknown) {
  const positions = decodeApplicationFloatingPositions(value);

  if (!positions) {
    throw new Error("application floating-position fixture is invalid");
  }

  return positions;
}

describe("application floating-position codec", () => {
  it("normalizes entries into deterministic immutable exact lookup state", () => {
    const input =
      " org.telegram.desktop = bottom-right,-24,16 \norg.mozilla.firefox=top-left,0,32";
    const positions = decodedApplicationFloatingPositions(input);

    expect(positions.canonicalEntries).toEqual([
      "org.mozilla.firefox=top-left,0,32",
      "org.telegram.desktop=bottom-right,-24,16",
    ]);
    expect(positions.floatingPositionFor("org.telegram.desktop")).toEqual({
      anchor: "bottom-right",
      x: -24,
      y: 16,
    });
    expect(
      positions.floatingPositionFor("org.Telegram.desktop"),
    ).toBeUndefined();
    expect(
      positions.floatingPositionFor(" org.telegram.desktop "),
    ).toBeUndefined();
    expect(
      Object.isFrozen(positions.floatingPositionFor("org.telegram.desktop")),
    ).toBe(true);
    expect(Object.isFrozen(positions.canonicalEntries)).toBe(true);
    expect(Object.isFrozen(positions)).toBe(true);
    expect(input).toContain(" org.telegram.desktop ");
  });

  it.each<ApplicationFloatingPositionAnchor>([
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ])("accepts the %s anchor", (anchor) => {
    expect(
      decodedApplicationFloatingPositions(
        `application=${anchor},0,0`,
      ).floatingPositionFor("application"),
    ).toEqual({ anchor, x: 0, y: 0 });
  });

  it("accepts blank lines, an empty singleton, and inclusive offset bounds", () => {
    const positions = decodedApplicationFloatingPositions(
      "\n minimum=left,-16384,-16384 \n\t\nmaximum=right,16384,16384\n",
    );

    expect(EMPTY_APPLICATION_FLOATING_POSITIONS.canonicalEntries).toEqual([]);
    expect(
      EMPTY_APPLICATION_FLOATING_POSITIONS.floatingPositionFor("application"),
    ).toBeUndefined();
    expect(positions.floatingPositionFor("minimum")).toEqual({
      anchor: "left",
      x: -16_384,
      y: -16_384,
    });
    expect(positions.floatingPositionFor("maximum")).toEqual({
      anchor: "right",
      x: 16_384,
      y: 16_384,
    });
  });

  it("compares canonical semantics rather than input order and spacing", () => {
    const first = decodedApplicationFloatingPositions(
      "zeta=bottom,4,-8\n alpha = top,0,1 ",
    );
    const equivalent = decodedApplicationFloatingPositions(
      "alpha=top,0,1\nzeta = bottom,4,-8",
    );
    const changed = decodedApplicationFloatingPositions(
      "alpha=top,0,1\nzeta=bottom,4,-7",
    );

    expect(sameApplicationFloatingPositions(first, first)).toBe(true);
    expect(sameApplicationFloatingPositions(first, equivalent)).toBe(true);
    expect(sameApplicationFloatingPositions(first, changed)).toBe(false);
  });

  it.each([
    null,
    {},
    ["application=top,0,0"],
    1,
    "application=center,0,0",
    "application=top,+1,0",
    "application=top,-0,0",
    "application=top,01,0",
    "application=top,1.0,0",
    "application=top,1e2,0",
    "application=top,16385,0",
    "application=top,-16385,0",
    "application=top,0, 0",
    "application=top,0",
    "application=top,0,0,0",
    "application=top,0,0=extra",
    "=top,0,0",
    "delete\u007fkey=top,0,0",
    "bad\ud800key=top,0,0",
    "application=top,\udc00,0",
  ])("rejects malformed input atomically: %j", (value) => {
    expect(decodeApplicationFloatingPositions(value)).toBeNull();
  });

  it("enforces entry, line, document, identifier, and UTF-8 byte bounds", () => {
    const maximumEntries = Array.from(
      { length: APPLICATION_FLOATING_POSITION_LIMITS.entries },
      (_, index) => `application-${String(index)}=top,0,0`,
    );
    const maximumIdentifier = "a".repeat(
      APPLICATION_FLOATING_POSITION_LIMITS.identifierBytes,
    );
    const maximumUtf8Identifier = "é".repeat(127);

    expect(
      decodeApplicationFloatingPositions(maximumEntries.join("\n")),
    ).not.toBeNull();
    expect(
      decodeApplicationFloatingPositions(
        [...maximumEntries, "overflow=top,0,0"].join("\n"),
      ),
    ).toBeNull();
    expect(
      decodeApplicationFloatingPositions(`${maximumIdentifier}=top,0,0`),
    ).not.toBeNull();
    expect(
      decodeApplicationFloatingPositions(`${maximumIdentifier}a=top,0,0`),
    ).toBeNull();
    expect(
      decodeApplicationFloatingPositions(`${maximumUtf8Identifier}=top,0,0`),
    ).not.toBeNull();
    expect(
      decodeApplicationFloatingPositions(`${maximumUtf8Identifier}é=top,0,0`),
    ).toBeNull();
    expect(
      decodeApplicationFloatingPositions(
        " ".repeat(APPLICATION_FLOATING_POSITION_LIMITS.rawEntryCharacters + 1),
      ),
    ).toBeNull();
    expect(
      decodeApplicationFloatingPositions(
        " ".repeat(APPLICATION_FLOATING_POSITION_LIMITS.documentCharacters + 1),
      ),
    ).toBeNull();
  });

  it("rejects duplicate normalized identifiers atomically", () => {
    expect(
      decodeApplicationFloatingPositions(
        "org.example.App=top,0,0\n org.example.App =bottom,1,1",
      ),
    ).toBeNull();
  });
});
