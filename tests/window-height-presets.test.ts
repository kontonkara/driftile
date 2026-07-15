import { describe, expect, it } from "vitest";
import {
  EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
  WINDOW_HEIGHT_PRESET_LIMITS,
  decodeWindowHeightPresetPercentages,
  sameWindowHeightPresetPercentages,
} from "../src/window-height-presets";

describe("window height preset percentages", () => {
  it("maps blank input to the exact empty preset value", () => {
    expect(decodeWindowHeightPresetPercentages("")).toBe(
      EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
    );
    expect(decodeWindowHeightPresetPercentages(" \t\n ")).toBe(
      EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
    );
    expect(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES).toEqual({
      canonicalValue: "",
      percentages: [],
    });
    expect(Object.isFrozen(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES)).toBe(true);
    expect(
      Object.isFrozen(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES.percentages),
    ).toBe(true);
  });

  it("canonicalizes bounded increasing integer percentages", () => {
    const decoded = decodeWindowHeightPresetPercentages(" 10, 25 , 50,100 ");

    expect(decoded).toEqual({
      canonicalValue: "10,25,50,100",
      percentages: [10, 25, 50, 100],
    });
    expect(decoded && Object.isFrozen(decoded)).toBe(true);
    expect(decoded && Object.isFrozen(decoded.percentages)).toBe(true);
  });

  it("accepts the maximum number of entries", () => {
    const percentages = Array.from(
      { length: WINDOW_HEIGHT_PRESET_LIMITS.entries },
      (_, index) => WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent + index,
    );

    expect(
      decodeWindowHeightPresetPercentages(percentages.join(","))?.percentages,
    ).toEqual(percentages);
  });

  it.each([
    null,
    undefined,
    33,
    [],
    "10,",
    ",10",
    "10,,20",
    "9",
    "101",
    "10.5",
    "10.0",
    "+10",
    "010",
    "20,20",
    "20,10",
    "ten",
  ])("rejects malformed value %j", (value) => {
    expect(decodeWindowHeightPresetPercentages(value)).toBeNull();
  });

  it("rejects inputs beyond both bounds", () => {
    const tooMany = Array.from(
      { length: WINDOW_HEIGHT_PRESET_LIMITS.entries + 1 },
      (_, index) => WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent + index,
    ).join(",");
    const tooLong = " ".repeat(
      WINDOW_HEIGHT_PRESET_LIMITS.documentCharacters + 1,
    );

    expect(decodeWindowHeightPresetPercentages(tooMany)).toBeNull();
    expect(decodeWindowHeightPresetPercentages(tooLong)).toBeNull();
  });

  it("compares canonical percentage lists", () => {
    const left = decodeWindowHeightPresetPercentages("10, 50,100");
    const equivalent = decodeWindowHeightPresetPercentages(" 10 ,50, 100 ");
    const different = decodeWindowHeightPresetPercentages("10,60,100");

    if (!left || !equivalent || !different) {
      throw new Error("valid preset percentages were rejected");
    }

    expect(sameWindowHeightPresetPercentages(left, equivalent)).toBe(true);
    expect(sameWindowHeightPresetPercentages(left, different)).toBe(false);
  });
});
