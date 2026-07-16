import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE,
  EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
  WINDOW_HEIGHT_PRESET_LIMITS,
  WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE,
  decodeWindowHeightPresetPercentages,
  resolveWindowHeightPresetPolicy,
  sameWindowHeightPresetCycles,
  sameWindowHeightPresetPercentages,
  windowHeightPresetCycleFromPercentages,
} from "../src/window-height-presets";

describe("window height presets", () => {
  it("maps blank input to the exact immutable default cycle", () => {
    expect(decodeWindowHeightPresetPercentages("")).toBe(
      EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
    );
    expect(decodeWindowHeightPresetPercentages(" \t\n ")).toBe(
      EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
    );
    expect(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES).toEqual({
      canonicalValue: "",
      cycle: DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE,
      percentages: [],
    });
    expect(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES.cycle).toBe(
      DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE,
    );
    expect(Object.isFrozen(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES)).toBe(true);
    expect(
      Object.isFrozen(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES.percentages),
    ).toBe(true);
    expect(Object.isFrozen(EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES.cycle)).toBe(
      true,
    );
  });

  it("preserves bare percentage canonical values and state indices", () => {
    const decoded = decodeWindowHeightPresetPercentages(" 10, 25 , 50,100 ");

    expect(decoded?.canonicalValue).toBe("10,25,50,100");
    expect(decoded?.percentages).toEqual([10, 25, 50, 100]);
    expect(decoded?.cycle.map(({ stateIndex }) => stateIndex)).toEqual([
      110, 125, 150, 200,
    ]);
    expect(decoded?.cycle.map(({ policy }) => policy)).toEqual([
      { kind: "proportion", value: 0.1 },
      { kind: "proportion", value: 0.25 },
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 1 },
    ]);
  });

  it("canonicalizes explicit percentage suffixes to legacy bare values", () => {
    const decoded = decodeWindowHeightPresetPercentages("10%, 50%,100%");

    expect(decoded?.canonicalValue).toBe("10,50,100");
    expect(decoded?.percentages).toEqual([10, 50, 100]);
    expect(decoded?.cycle.map(({ stateIndex }) => stateIndex)).toEqual([
      110, 150, 200,
    ]);
  });

  it("preserves mixed-unit cycle order and percentage compatibility", () => {
    const decoded = decodeWindowHeightPresetPercentages(
      "10%,64px,50,1024px,100%",
    );

    expect(decoded?.canonicalValue).toBe("10,64px,50,1024px,100");
    expect(decoded?.percentages).toEqual([10, 50, 100]);
    expect(decoded?.cycle).toEqual([
      {
        policy: { kind: "proportion", value: 0.1 },
        stateIndex: 110,
      },
      { policy: { kind: "fixed", value: 64 }, stateIndex: 264 },
      {
        policy: { kind: "proportion", value: 0.5 },
        stateIndex: 150,
      },
      { policy: { kind: "fixed", value: 1024 }, stateIndex: 1224 },
      { policy: { kind: "proportion", value: 1 }, stateIndex: 200 },
    ]);
  });

  it("accepts fixed logical-pixel bounds with compact stable indices", () => {
    const decoded = decodeWindowHeightPresetPercentages("1px,16384px");

    expect(decoded?.canonicalValue).toBe("1px,16384px");
    expect(decoded?.percentages).toEqual([]);
    expect(decoded?.cycle).toEqual([
      { policy: { kind: "fixed", value: 1 }, stateIndex: 201 },
      { policy: { kind: "fixed", value: 16_384 }, stateIndex: 16_584 },
    ]);
    expect(WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE).toHaveLength(201);

    for (const entry of decoded?.cycle ?? []) {
      expect(resolveWindowHeightPresetPolicy(entry.stateIndex)).toBe(
        entry.policy,
      );
    }
  });

  it("resolves fixed semantic states lazily with bounded arithmetic", () => {
    expect(resolveWindowHeightPresetPolicy(201)).toEqual({
      kind: "fixed",
      value: 1,
    });
    expect(resolveWindowHeightPresetPolicy(16_584)).toEqual({
      kind: "fixed",
      value: 16_384,
    });
    expect(resolveWindowHeightPresetPolicy(201)).toBe(
      resolveWindowHeightPresetPolicy(201),
    );
    expect(resolveWindowHeightPresetPolicy(110)).toBe(
      WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE[110],
    );
    expect(resolveWindowHeightPresetPolicy(200)).toBe(
      WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE[200],
    );
    expect(resolveWindowHeightPresetPolicy(3)).toBeNull();
    expect(resolveWindowHeightPresetPolicy(109)).toBeNull();
    expect(resolveWindowHeightPresetPolicy(16_585)).toBeNull();
    expect(resolveWindowHeightPresetPolicy(Number.NaN)).toBeNull();
    expect(resolveWindowHeightPresetPolicy(201.5)).toBeNull();
  });

  it("accepts the maximum number of entries", () => {
    const percentages = Array.from(
      { length: WINDOW_HEIGHT_PRESET_LIMITS.entries },
      (_, index) => WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent + index,
    );
    const decoded = decodeWindowHeightPresetPercentages(percentages.join(","));

    expect(decoded?.percentages).toEqual(percentages);
    expect(decoded?.cycle).toHaveLength(WINDOW_HEIGHT_PRESET_LIMITS.entries);
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
    "ten",
    "0px",
    "16385px",
    "01px",
    "+1px",
    "1.0px",
    "1PX",
    "1 px",
    "10%%",
    "10%px",
  ])("rejects malformed value %j", (value) => {
    expect(decodeWindowHeightPresetPercentages(value)).toBeNull();
  });

  it.each([
    "20,20",
    "20,20%",
    "20,100px,10",
    "20px,50,20px",
    "20px,50,10px",
    "100%,50%",
    "100px,50px",
  ])("rejects duplicate or decreasing per-unit policy order: %s", (value) => {
    expect(decodeWindowHeightPresetPercentages(value)).toBeNull();
  });

  it("accepts interleaving while requiring each unit to increase", () => {
    const decoded = decodeWindowHeightPresetPercentages(
      "10,1000px,20%,2000px,30",
    );

    expect(decoded?.canonicalValue).toBe("10,1000px,20,2000px,30");
    expect(decoded?.cycle.map(({ policy }) => policy)).toEqual([
      { kind: "proportion", value: 0.1 },
      { kind: "fixed", value: 1000 },
      { kind: "proportion", value: 0.2 },
      { kind: "fixed", value: 2000 },
      { kind: "proportion", value: 0.3 },
    ]);
  });

  it("rejects inputs beyond both document bounds", () => {
    const tooMany = Array.from(
      { length: WINDOW_HEIGHT_PRESET_LIMITS.entries + 1 },
      (_, index) => `${String(index + 1)}px`,
    ).join(",");
    const tooLong = " ".repeat(
      WINDOW_HEIGHT_PRESET_LIMITS.documentCharacters + 1,
    );

    expect(decodeWindowHeightPresetPercentages(tooMany)).toBeNull();
    expect(decodeWindowHeightPresetPercentages(tooLong)).toBeNull();
  });

  it("keeps default and legacy percentage semantic states stable", () => {
    const legacy = windowHeightPresetCycleFromPercentages([10, 50, 100]);
    const explicit = decodeWindowHeightPresetPercentages("10%,50%,100%");

    expect(
      DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE.map(({ stateIndex }) => stateIndex),
    ).toEqual([0, 1, 2]);
    expect(legacy?.map(({ stateIndex }) => stateIndex)).toEqual([
      110, 150, 200,
    ]);
    expect(
      explicit &&
        legacy &&
        sameWindowHeightPresetCycles(explicit.cycle, legacy),
    ).toBe(true);
  });

  it("returns deeply immutable decoded cycles", () => {
    const decoded = decodeWindowHeightPresetPercentages("10,64px,50");

    if (!decoded) {
      throw new Error("valid mixed presets were rejected");
    }

    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.percentages)).toBe(true);
    expect(Object.isFrozen(decoded.cycle)).toBe(true);

    for (const entry of decoded.cycle) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.policy)).toBe(true);
    }
  });

  it("compares canonical mixed preset lists", () => {
    const left = decodeWindowHeightPresetPercentages("10%, 64px,50");
    const equivalent = decodeWindowHeightPresetPercentages(" 10 ,64px, 50% ");
    const different = decodeWindowHeightPresetPercentages("10,65px,50");

    if (!left || !equivalent || !different) {
      throw new Error("valid mixed presets were rejected");
    }

    expect(sameWindowHeightPresetPercentages(left, equivalent)).toBe(true);
    expect(sameWindowHeightPresetPercentages(left, different)).toBe(false);
  });
});
