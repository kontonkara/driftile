import { describe, expect, it } from "vitest";
import { decodeApplicationColumnWidthOverrides } from "../src/application-overrides";
import { decodeColumnWidthPresetPercentages } from "../src/column-width-presets";
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

const validColumnWidthPresets = decodeColumnWidthPresetPercentages("20,50,80");

if (!validColumnWidthPresets) {
  throw new Error("column-width preset fixture is invalid");
}

const validSettings: DriftileSettings = {
  applicationColumnWidths: validApplicationColumnWidths,
  borderlessWindows: false,
  columnWidthPresets: validColumnWidthPresets,
  columnWidthStepPercent: 25,
  defaultColumnWidthPercent: 75,
  gap: 32,
  windowHeightStepPercent: 20,
};

const validSettingsInput = {
  applicationColumnWidths: "org.example.Editor=75",
  borderlessWindows: validSettings.borderlessWindows,
  columnWidthPresets: validSettings.columnWidthPresets.canonicalValue,
  columnWidthStepPercent: validSettings.columnWidthStepPercent,
  defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
  gap: validSettings.gap,
  windowHeightStepPercent: validSettings.windowHeightStepPercent,
};

describe("Driftile settings", () => {
  it("exposes the current immutable defaults", () => {
    expect(DEFAULT_DRIFTILE_SETTINGS).toMatchObject({
      borderlessWindows: true,
      columnWidthStepPercent: 10,
      defaultColumnWidthPercent: 50,
      gap: 16,
      windowHeightStepPercent: 10,
    });
    expect(
      DEFAULT_DRIFTILE_SETTINGS.applicationColumnWidths.canonicalEntries,
    ).toEqual([]);
    expect(DEFAULT_DRIFTILE_SETTINGS.columnWidthPresets.canonicalValue).toBe(
      "",
    );
    expect(DEFAULT_DRIFTILE_SETTINGS.columnWidthPresets.percentages).toEqual(
      [],
    );
    expect(Object.isFrozen(DEFAULT_DRIFTILE_SETTINGS)).toBe(true);
  });

  it("decodes a valid snapshot without retaining the input object", () => {
    const input = { ...validSettingsInput };
    const decoded = decodeDriftileSettings(input);

    expect(decoded).toMatchObject({
      borderlessWindows: validSettings.borderlessWindows,
      columnWidthPresets: validSettings.columnWidthPresets,
      columnWidthStepPercent: validSettings.columnWidthStepPercent,
      defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
      gap: validSettings.gap,
      windowHeightStepPercent: validSettings.windowHeightStepPercent,
    });
    expect(decoded?.applicationColumnWidths.canonicalEntries).toEqual(
      validApplicationColumnWidths.canonicalEntries,
    );
    expect(decoded).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(input).toEqual(validSettingsInput);
  });

  it.each([
    {
      applicationColumnWidths: "",
      borderlessWindows: true,
      columnWidthPresets: "10",
      columnWidthStepPercent: 1,
      defaultColumnWidthPercent: 10,
      gap: 0,
      windowHeightStepPercent: 1,
    },
    {
      applicationColumnWidths: "org.example.Browser=80",
      borderlessWindows: false,
      columnWidthPresets: "100",
      columnWidthStepPercent: 50,
      defaultColumnWidthPercent: 100,
      gap: 64,
      windowHeightStepPercent: 50,
    },
  ])("accepts the inclusive numeric bounds", (settings) => {
    const decoded = decodeDriftileSettings(settings);

    expect(decoded).not.toBeNull();
    expect(decoded?.applicationColumnWidths.canonicalEntries.join("\n")).toBe(
      settings.applicationColumnWidths,
    );
    expect(decoded?.columnWidthPresets.canonicalValue).toBe(
      settings.columnWidthPresets,
    );
    expect(decoded).toMatchObject({
      borderlessWindows: settings.borderlessWindows,
      columnWidthStepPercent: settings.columnWidthStepPercent,
      defaultColumnWidthPercent: settings.defaultColumnWidthPercent,
      gap: settings.gap,
      windowHeightStepPercent: settings.windowHeightStepPercent,
    });
  });

  it.each([
    ["a non-boolean borderless setting", { borderlessWindows: 1 }],
    ["invalid column-width presets", { columnWidthPresets: "50,40" }],
    [
      "invalid application overrides",
      { applicationColumnWidths: "org.example.Editor=9" },
    ],
    ["a non-numeric gap", { gap: "16" }],
    ["a non-finite gap", { gap: Number.NaN }],
    ["an infinite gap", { gap: Number.POSITIVE_INFINITY }],
    ["a fractional gap", { gap: 1.5 }],
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

  it("rejects missing fields", () => {
    const incomplete = {
      applicationColumnWidths: validSettingsInput.applicationColumnWidths,
      borderlessWindows: validSettings.borderlessWindows,
      columnWidthPresets: validSettingsInput.columnWidthPresets,
      columnWidthStepPercent: validSettings.columnWidthStepPercent,
      defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
      windowHeightStepPercent: validSettings.windowHeightStepPercent,
    };

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

    const changedColumnWidthPresets =
      decodeColumnWidthPresetPercentages("20,50,90");

    if (!changedColumnWidthPresets) {
      throw new Error("column-width preset fixture is invalid");
    }

    for (const changed of [
      { applicationColumnWidths: changedApplicationColumnWidths },
      { borderlessWindows: true },
      { columnWidthPresets: changedColumnWidthPresets },
      { columnWidthStepPercent: 26 },
      { defaultColumnWidthPercent: 76 },
      { gap: 33 },
      { windowHeightStepPercent: 21 },
    ]) {
      expect(
        sameDriftileSettings(validSettings, { ...validSettings, ...changed }),
      ).toBe(false);
    }
  });
});
