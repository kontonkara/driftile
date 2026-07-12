import { describe, expect, it } from "vitest";
import {
  COLUMN_WIDTH_PRESET_LIMITS,
  EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
  decodeColumnWidthPresetPercentages,
  sameColumnWidthPresetPercentages,
} from "../src/column-width-presets";

describe("column width preset percentages", () => {
  it("maps blank input to the exact empty preset value", () => {
    expect(decodeColumnWidthPresetPercentages("")).toBe(
      EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
    );
    expect(decodeColumnWidthPresetPercentages(" \t\n ")).toBe(
      EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
    );
    expect(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES).toEqual({
      canonicalValue: "",
      percentages: [],
    });
    expect(Object.isFrozen(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES)).toBe(true);
    expect(
      Object.isFrozen(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES.percentages),
    ).toBe(true);
  });

  it("canonicalizes bounded increasing integer percentages", () => {
    const decoded = decodeColumnWidthPresetPercentages(" 10, 25 , 50,100 ");

    expect(decoded).toEqual({
      canonicalValue: "10,25,50,100",
      percentages: [10, 25, 50, 100],
    });
    expect(decoded && Object.isFrozen(decoded)).toBe(true);
    expect(decoded && Object.isFrozen(decoded.percentages)).toBe(true);
  });

  it("accepts the maximum number of entries", () => {
    const percentages = Array.from(
      { length: COLUMN_WIDTH_PRESET_LIMITS.entries },
      (_, index) => COLUMN_WIDTH_PRESET_LIMITS.minimumPercent + index,
    );

    expect(
      decodeColumnWidthPresetPercentages(percentages.join(","))?.percentages,
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
    expect(decodeColumnWidthPresetPercentages(value)).toBeNull();
  });

  it("rejects inputs beyond both bounds", () => {
    const tooMany = Array.from(
      { length: COLUMN_WIDTH_PRESET_LIMITS.entries + 1 },
      (_, index) => COLUMN_WIDTH_PRESET_LIMITS.minimumPercent + index,
    ).join(",");
    const tooLong = " ".repeat(
      COLUMN_WIDTH_PRESET_LIMITS.documentCharacters + 1,
    );

    expect(decodeColumnWidthPresetPercentages(tooMany)).toBeNull();
    expect(decodeColumnWidthPresetPercentages(tooLong)).toBeNull();
  });

  it("compares canonical percentage lists", () => {
    const left = decodeColumnWidthPresetPercentages("10, 50,100");
    const equivalent = decodeColumnWidthPresetPercentages(" 10 ,50, 100 ");
    const different = decodeColumnWidthPresetPercentages("10,60,100");

    if (!left || !equivalent || !different) {
      throw new Error("valid preset percentages were rejected");
    }

    expect(sameColumnWidthPresetPercentages(left, equivalent)).toBe(true);
    expect(sameColumnWidthPresetPercentages(left, different)).toBe(false);
  });
});
