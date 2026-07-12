import { describe, expect, it } from "vitest";
import {
  decodeDriftileSettings,
  DEFAULT_DRIFTILE_SETTINGS,
  sameDriftileSettings,
  type DriftileSettings,
} from "../src/settings";

const validSettings: DriftileSettings = {
  borderlessWindows: false,
  columnWidthStepPercent: 25,
  defaultColumnWidthPercent: 75,
  gap: 32,
  windowHeightStepPercent: 20,
};

describe("Driftile settings", () => {
  it("exposes the current immutable defaults", () => {
    expect(DEFAULT_DRIFTILE_SETTINGS).toEqual({
      borderlessWindows: true,
      columnWidthStepPercent: 10,
      defaultColumnWidthPercent: 50,
      gap: 16,
      windowHeightStepPercent: 10,
    });
    expect(Object.isFrozen(DEFAULT_DRIFTILE_SETTINGS)).toBe(true);
  });

  it("decodes a valid snapshot without retaining the input object", () => {
    const input = { ...validSettings };
    const decoded = decodeDriftileSettings(input);

    expect(decoded).toEqual(validSettings);
    expect(decoded).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(input).toEqual(validSettings);
  });

  it.each([
    {
      borderlessWindows: true,
      columnWidthStepPercent: 1,
      defaultColumnWidthPercent: 10,
      gap: 0,
      windowHeightStepPercent: 1,
    },
    {
      borderlessWindows: false,
      columnWidthStepPercent: 50,
      defaultColumnWidthPercent: 100,
      gap: 64,
      windowHeightStepPercent: 50,
    },
  ])("accepts the inclusive numeric bounds", (settings) => {
    expect(decodeDriftileSettings(settings)).toEqual(settings);
  });

  it.each([
    ["a non-boolean borderless setting", { borderlessWindows: 1 }],
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
    const input = { ...validSettings, ...invalidField };

    expect(decodeDriftileSettings(input)).toBeNull();
    expect(input).toEqual({ ...validSettings, ...invalidField });
  });

  it.each([null, [], "settings", 1, true])(
    "rejects a non-record root: %j",
    (input) => {
      expect(decodeDriftileSettings(input)).toBeNull();
    },
  );

  it("rejects missing fields", () => {
    const incomplete = {
      borderlessWindows: validSettings.borderlessWindows,
      columnWidthStepPercent: validSettings.columnWidthStepPercent,
      defaultColumnWidthPercent: validSettings.defaultColumnWidthPercent,
      windowHeightStepPercent: validSettings.windowHeightStepPercent,
    };

    expect(decodeDriftileSettings(incomplete)).toBeNull();
  });

  it("rejects extra fields to expose incompatible snapshots and typos", () => {
    expect(
      decodeDriftileSettings({ ...validSettings, unexpected: true }),
    ).toBeNull();
  });

  it("compares snapshots by every setting", () => {
    expect(sameDriftileSettings(validSettings, { ...validSettings })).toBe(
      true,
    );

    for (const changed of [
      { borderlessWindows: true },
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
