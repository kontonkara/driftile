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
});
