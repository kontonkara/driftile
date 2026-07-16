import { describe, expect, it } from "vitest";
import { decodeApplicationBorderlessExclusions } from "../src/application-borderless-exclusions";
import { decodeApplicationInitialFloating } from "../src/application-initial-floating";
import { decodeApplicationColumnPresentations } from "../src/application-column-presentations";
import { decodeApplicationColumnWidthOverrides } from "../src/application-overrides";
import { decodeApplicationFocusCentering } from "../src/application-focus-centering";
import { decodeApplicationTilingExclusions } from "../src/application-tiling-exclusions";
import { decodeColumnWidthPresetPercentages } from "../src/column-width-presets";
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

const validSettings: DriftileSettings = {
  applicationBorderlessExclusions: validApplicationBorderlessExclusions,
  applicationColumnPresentations: validApplicationColumnPresentations,
  applicationColumnWidths: validApplicationColumnWidths,
  applicationFocusCentering: validApplicationFocusCentering,
  applicationInitialFloating: validApplicationInitialFloating,
  applicationTilingExclusions: validApplicationTilingExclusions,
  alwaysCenterSingleColumn: true,
  borderlessWindows: false,
  centerFocusedColumn: true,
  centerFocusedColumnOnOverflow: true,
  columnWidthPresets: validColumnWidthPresets,
  columnWidthStepPercent: 25,
  defaultColumnPresentation: "tabbed",
  defaultColumnWidthPercent: 75,
  emptyDesktopAboveFirst: true,
  gap: 32.5,
  showTabIndicator: false,
  touchpadNavigation: true,
  touchpadNavigationFingerCount: 4,
  touchpadNaturalScroll: false,
  touchpadWorkspaceNavigation: true,
  windowHeightPresets: validWindowHeightPresets,
  windowHeightStepPercent: 20,
};

const validSettingsInput = {
  applicationBorderlessExclusions:
    "org.example.Decorated\norg.example.Legacy=tool",
  applicationColumnPresentations:
    "org.example.Browser=tabbed\norg.example.Editor=stacked",
  applicationColumnWidths: "org.example.Editor=75",
  applicationFocusCentering: "org.example.Browser\norg.example.Editor",
  applicationInitialFloating: "org.example.Floating\norg.example.Floating=tool",
  applicationTilingExclusions: "org.example.Legacy\norg.example.Editor=tool",
  alwaysCenterSingleColumn: validSettings.alwaysCenterSingleColumn,
  borderlessWindows: validSettings.borderlessWindows,
  centerFocusedColumn: validSettings.centerFocusedColumn,
  centerFocusedColumnOnOverflow: validSettings.centerFocusedColumnOnOverflow,
  columnWidthPresets: validSettings.columnWidthPresets.canonicalValue,
  columnWidthStepPercent: validSettings.columnWidthStepPercent,
  defaultColumnPresentation: validSettings.defaultColumnPresentation,
  defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
  emptyDesktopAboveFirst: validSettings.emptyDesktopAboveFirst,
  gap: validSettings.gap,
  showTabIndicator: validSettings.showTabIndicator,
  touchpadNavigation: validSettings.touchpadNavigation,
  touchpadNavigationFingerCount: validSettings.touchpadNavigationFingerCount,
  touchpadNaturalScroll: validSettings.touchpadNaturalScroll,
  touchpadWorkspaceNavigation: validSettings.touchpadWorkspaceNavigation,
  windowHeightPresets: validSettings.windowHeightPresets.canonicalValue,
  windowHeightStepPercent: validSettings.windowHeightStepPercent,
};

describe("Driftile settings", () => {
  it("exposes the current immutable defaults", () => {
    expect(DEFAULT_DRIFTILE_SETTINGS).toMatchObject({
      alwaysCenterSingleColumn: false,
      borderlessWindows: true,
      centerFocusedColumn: false,
      centerFocusedColumnOnOverflow: false,
      columnWidthStepPercent: 10,
      defaultColumnPresentation: "stacked",
      defaultColumnWidthPercent: 33,
      emptyDesktopAboveFirst: false,
      gap: 16,
      showTabIndicator: true,
      touchpadNavigation: false,
      touchpadNavigationFingerCount: 5,
      touchpadNaturalScroll: true,
      touchpadWorkspaceNavigation: false,
      windowHeightStepPercent: 10,
    });
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationBorderlessExclusions
        .canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationColumnWidths.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationColumnPresentations.canonicalEntries,
    ).toEqual([]);
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationInitialFloating.canonicalEntries,
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
      columnWidthStepPercent: validSettings.columnWidthStepPercent,
      defaultColumnPresentation: validSettings.defaultColumnPresentation,
      defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
      emptyDesktopAboveFirst: validSettings.emptyDesktopAboveFirst,
      gap: validSettings.gap,
      showTabIndicator: validSettings.showTabIndicator,
      touchpadNavigation: validSettings.touchpadNavigation,
      touchpadNavigationFingerCount:
        validSettings.touchpadNavigationFingerCount,
      touchpadNaturalScroll: validSettings.touchpadNaturalScroll,
      touchpadWorkspaceNavigation: validSettings.touchpadWorkspaceNavigation,
      windowHeightPresets: validSettings.windowHeightPresets,
      windowHeightStepPercent: validSettings.windowHeightStepPercent,
    });
    expect(decoded?.applicationColumnWidths.canonicalEntries).toEqual(
      validApplicationColumnWidths.canonicalEntries,
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
      applicationFocusCentering: "",
      applicationInitialFloating: "",
      applicationTilingExclusions: "",
      alwaysCenterSingleColumn: false,
      borderlessWindows: true,
      centerFocusedColumn: false,
      centerFocusedColumnOnOverflow: false,
      columnWidthPresets: "10",
      columnWidthStepPercent: 1,
      defaultColumnPresentation: "stacked",
      defaultColumnWidthPercent: 10,
      emptyDesktopAboveFirst: false,
      gap: 0,
      showTabIndicator: false,
      touchpadNavigation: false,
      touchpadNavigationFingerCount: 3,
      touchpadNaturalScroll: false,
      touchpadWorkspaceNavigation: false,
      windowHeightPresets: "10",
      windowHeightStepPercent: 1,
    },
    {
      applicationBorderlessExclusions: "org.example.Decorated",
      applicationColumnPresentations: "org.example.Browser=tabbed",
      applicationColumnWidths: "org.example.Browser=80",
      applicationFocusCentering: "org.example.Browser",
      applicationInitialFloating: "org.example.Floating",
      applicationTilingExclusions: "org.example.Legacy",
      alwaysCenterSingleColumn: true,
      borderlessWindows: false,
      centerFocusedColumn: true,
      centerFocusedColumnOnOverflow: true,
      columnWidthPresets: "100",
      columnWidthStepPercent: 50,
      defaultColumnPresentation: "tabbed",
      defaultColumnWidthPercent: 100,
      emptyDesktopAboveFirst: true,
      gap: 64,
      showTabIndicator: true,
      touchpadNavigation: true,
      touchpadNavigationFingerCount: 5,
      touchpadNaturalScroll: true,
      touchpadWorkspaceNavigation: true,
      windowHeightPresets: "100",
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
    expect(
      decoded?.applicationColumnPresentations.canonicalEntries.join("\n"),
    ).toBe(settings.applicationColumnPresentations);
    expect(decoded?.applicationFocusCentering.canonicalEntries.join("\n")).toBe(
      settings.applicationFocusCentering,
    );
    expect(
      decoded?.applicationInitialFloating.canonicalEntries.join("\n"),
    ).toBe(settings.applicationInitialFloating);
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
      columnWidthStepPercent: settings.columnWidthStepPercent,
      defaultColumnPresentation: settings.defaultColumnPresentation,
      defaultColumnWidthPercent: settings.defaultColumnWidthPercent,
      emptyDesktopAboveFirst: settings.emptyDesktopAboveFirst,
      gap: settings.gap,
      showTabIndicator: settings.showTabIndicator,
      touchpadNavigation: settings.touchpadNavigation,
      touchpadNavigationFingerCount: settings.touchpadNavigationFingerCount,
      touchpadNaturalScroll: settings.touchpadNaturalScroll,
      touchpadWorkspaceNavigation: settings.touchpadWorkspaceNavigation,
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
    ["an invalid default presentation", { defaultColumnPresentation: "tiled" }],
    ["invalid column-width presets", { columnWidthPresets: "50,40" }],
    ["invalid window-height presets", { windowHeightPresets: "50,40" }],
    [
      "invalid application overrides",
      { applicationColumnWidths: "org.example.Editor=9" },
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
    ["a non-numeric width step", { columnWidthStepPercent: "10" }],
    ["a non-finite width step", { columnWidthStepPercent: Number.NaN }],
    ["an infinite width step", { columnWidthStepPercent: Infinity }],
    ["a fractional width step", { columnWidthStepPercent: 10.5 }],
    ["a width step below its range", { columnWidthStepPercent: 0 }],
    ["a width step above its range", { columnWidthStepPercent: 51 }],
    ["a non-numeric height step", { windowHeightStepPercent: "10" }],
    ["a non-finite height step", { windowHeightStepPercent: Number.NaN }],
    ["an infinite height step", { windowHeightStepPercent: -Infinity }],
    ["a fractional height step", { windowHeightStepPercent: 10.5 }],
    ["a height step below its range", { windowHeightStepPercent: 0 }],
    ["a height step above its range", { windowHeightStepPercent: 51 }],
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

  it("rejects the previous twenty-two-field snapshot", () => {
    const incomplete: Record<string, unknown> = { ...validSettingsInput };
    delete incomplete["emptyDesktopAboveFirst"];

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
      { applicationFocusCentering: changedApplicationFocusCentering },
      { applicationInitialFloating: changedApplicationInitialFloating },
      { applicationTilingExclusions: changedApplicationTilingExclusions },
      { alwaysCenterSingleColumn: false },
      { borderlessWindows: true },
      { centerFocusedColumn: false },
      { centerFocusedColumnOnOverflow: false },
      { columnWidthPresets: changedColumnWidthPresets },
      { columnWidthStepPercent: 26 },
      { defaultColumnPresentation: "stacked" as const },
      { defaultColumnWidthPercent: 76 },
      { emptyDesktopAboveFirst: false },
      { gap: 33 },
      { showTabIndicator: true },
      { touchpadNavigation: false },
      { touchpadNavigationFingerCount: 5 },
      { touchpadNaturalScroll: true },
      { touchpadWorkspaceNavigation: false },
      { windowHeightPresets: changedWindowHeightPresets },
      { windowHeightStepPercent: 21 },
    ]) {
      expect(
        sameDriftileSettings(validSettings, { ...validSettings, ...changed }),
      ).toBe(false);
    }
  });
});
