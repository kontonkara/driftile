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
      presets: [],
    });
    expect(Object.isFrozen(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES)).toBe(true);
    expect(
      Object.isFrozen(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES.percentages),
    ).toBe(true);
    expect(Object.isFrozen(EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES.presets)).toBe(
      true,
    );
  });

  it("canonicalizes bounded increasing integer percentages", () => {
    const decoded = decodeColumnWidthPresetPercentages(" 10, 25 , 50,100 ");

    expect(decoded).toEqual({
      canonicalValue: "10,25,50,100",
      percentages: [10, 25, 50, 100],
      presets: [
        { kind: "proportion", value: 0.1 },
        { kind: "proportion", value: 0.25 },
        { kind: "proportion", value: 0.5 },
        { kind: "proportion", value: 1 },
      ],
    });
    expect(decoded && Object.isFrozen(decoded)).toBe(true);
    expect(decoded && Object.isFrozen(decoded.percentages)).toBe(true);
    expect(decoded && Object.isFrozen(decoded.presets)).toBe(true);
    expect(decoded?.presets.every((preset) => Object.isFrozen(preset))).toBe(
      true,
    );
  });

  it("preserves mixed-unit cycle order while canonicalizing percentages", () => {
    const decoded = decodeColumnWidthPresetPercentages(
      " 10% , 320px, 25 , 640px, 100% ",
    );

    expect(decoded).toEqual({
      canonicalValue: "10,320px,25,640px,100",
      percentages: [10, 25, 100],
      presets: [
        { kind: "proportion", value: 0.1 },
        { kind: "fixed", value: 320 },
        { kind: "proportion", value: 0.25 },
        { kind: "fixed", value: 640 },
        { kind: "proportion", value: 1 },
      ],
    });
  });

  it("accepts increasing fixed-only presets at both bounds", () => {
    expect(decodeColumnWidthPresetPercentages("1px, 800px,16384px")).toEqual({
      canonicalValue: "1px,800px,16384px",
      percentages: [],
      presets: [
        { kind: "fixed", value: 1 },
        { kind: "fixed", value: 800 },
        { kind: "fixed", value: 16_384 },
      ],
    });
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
    "10 %",
    "0px",
    "16385px",
    "01px",
    "+1px",
    "1.0px",
    "1PX",
    "20,20",
    "20,20%",
    "20,10",
    "200px,200px",
    "200px,100px",
    "20,200px,10",
    "200px,20,100px",
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
    const left = decodeColumnWidthPresetPercentages("10%, 400px,50,100%");
    const equivalent = decodeColumnWidthPresetPercentages(
      " 10 ,400px, 50%, 100 ",
    );
    const different = decodeColumnWidthPresetPercentages("10,500px,50,100");

    if (!left || !equivalent || !different) {
      throw new Error("valid preset percentages were rejected");
    }

    expect(sameColumnWidthPresetPercentages(left, equivalent)).toBe(true);
    expect(sameColumnWidthPresetPercentages(left, different)).toBe(false);
  });
});
