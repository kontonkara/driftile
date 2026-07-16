import { describe, expect, it } from "vitest";
import { planOverviewDesktopDrop } from "../../src/overview/runtime";

describe("planOverviewDesktopDrop", () => {
  it.each([
    [0, [null, null, 1, 2]],
    [1, [0, null, null, 2]],
    [2, [0, 1, null, null]],
    [3, [null, null, null, null]],
  ] as const)(
    "maps every four-desktop insertion slot for source %i",
    (sourceIndex, expectedTargets) => {
      expect(
        expectedTargets.map((_, insertionSlot) =>
          planOverviewDesktopDrop(4, sourceIndex, insertionSlot),
        ),
      ).toEqual(expectedTargets);
    },
  );

  it.each([
    [0, [null, null, null, null, null]],
    [1, [null, null, null, 2, 3]],
    [2, [null, 1, null, null, 3]],
    [3, [null, 1, 2, null, null]],
    [4, [null, null, null, null, null]],
  ] as const)(
    "protects both empty boundaries for source %i",
    (sourceIndex, expectedTargets) => {
      expect(
        expectedTargets.map((_, insertionSlot) =>
          planOverviewDesktopDrop(5, sourceIndex, insertionSlot, true),
        ),
      ).toEqual(expectedTargets);
    },
  );

  it("preserves the trailing-only default", () => {
    expect(planOverviewDesktopDrop(4, 0, 3)).toBe(2);
    expect(planOverviewDesktopDrop(4, 0, 3, false)).toBe(2);
    expect(planOverviewDesktopDrop(4, 0, 3, true)).toBeNull();
  });

  it.each([
    [1, 0, 0],
    [2, 0, 0],
    [2, 0, 1],
    [4, -1, 0],
    [4, 4, 0],
    [4, 0, -1],
    [4, 0, 4],
    [4.5, 0, 0],
    [4, 0.5, 0],
    [4, 0, 0.5],
    [Number.POSITIVE_INFINITY, 0, 0],
    [4, Number.NaN, 0],
    [4, 0, Number.MAX_SAFE_INTEGER + 1],
  ])(
    "rejects invalid or degenerate input (%j, %j, %j)",
    (desktopCount, sourceIndex, insertionSlot) => {
      expect(
        planOverviewDesktopDrop(desktopCount, sourceIndex, insertionSlot),
      ).toBeNull();
    },
  );

  it("rejects a non-boolean boundary mode", () => {
    expect(
      planOverviewDesktopDrop(4, 1, 3, "true" as unknown as boolean),
    ).toBeNull();
  });
});
