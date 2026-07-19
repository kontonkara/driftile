import { describe, expect, it } from "vitest";

import { LAYOUT_PERSISTENCE_LIMITS } from "../src/core/layout-persistence";
import {
  planOverviewSpatialWorkspaceGap,
  type OverviewSpatialWorkspaceGapInput,
} from "../src/overview/runtime";

const desktopIds = Object.freeze([
  "desktop-leading",
  "desktop-a",
  "desktop-b",
  "desktop-trailing",
]);

function input(
  pointY: number,
  keepEmptyDesktopAboveFirst = true,
): OverviewSpatialWorkspaceGapInput {
  return {
    cardGap: 40,
    cardHeight: 200,
    cardTop: 100,
    desktopIds,
    keepEmptyDesktopAboveFirst,
    pointY,
  };
}

describe("planOverviewSpatialWorkspaceGap", () => {
  it("plans every internal gap without anchoring a protected boundary", () => {
    const beforeFirst = planOverviewSpatialWorkspaceGap(input(320));
    const interior = planOverviewSpatialWorkspaceGap(input(560));
    const beforeTrailing = planOverviewSpatialWorkspaceGap(input(800));

    expect(beforeFirst).toEqual({
      adjacentDesktopId: "desktop-leading",
      anchorDesktopId: "desktop-a",
      insertionIndex: 1,
      lineY: 320,
      position: "before",
    });
    expect(interior).toEqual({
      adjacentDesktopId: "desktop-a",
      anchorDesktopId: "desktop-b",
      insertionIndex: 2,
      lineY: 560,
      position: "before",
    });
    expect(beforeTrailing).toEqual({
      adjacentDesktopId: "desktop-trailing",
      anchorDesktopId: "desktop-b",
      insertionIndex: 3,
      lineY: 800,
      position: "after",
    });
    expect(Object.isFrozen(beforeFirst)).toBe(true);

    for (const plan of [beforeFirst, interior, beforeTrailing]) {
      expect(plan?.anchorDesktopId).not.toBe("desktop-leading");
      expect(plan?.anchorDesktopId).not.toBe("desktop-trailing");
    }
  });

  it("keeps the trailing boundary protected without a leading boundary", () => {
    const withoutLeading = {
      ...input(320, false),
      desktopIds: ["desktop-a", "desktop-b", "desktop-trailing"],
    };

    expect(planOverviewSpatialWorkspaceGap(withoutLeading)).toEqual({
      adjacentDesktopId: "desktop-a",
      anchorDesktopId: "desktop-b",
      insertionIndex: 1,
      lineY: 320,
      position: "before",
    });
    expect(
      planOverviewSpatialWorkspaceGap({ ...withoutLeading, pointY: 560 }),
    ).toEqual({
      adjacentDesktopId: "desktop-trailing",
      anchorDesktopId: "desktop-b",
      insertionIndex: 2,
      lineY: 560,
      position: "after",
    });
  });

  it("hit-tests half-open gaps and ignores cards and outer space", () => {
    expect(planOverviewSpatialWorkspaceGap(input(299.999))).toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(300))).not.toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(339.999))).not.toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(340))).toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(539.999))).toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(540))).not.toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(820))).toBeNull();
    expect(planOverviewSpatialWorkspaceGap(input(1_020))).toBeNull();
  });

  it("requires enough movable space for each configured boundary mode", () => {
    expect(
      planOverviewSpatialWorkspaceGap({
        ...input(300),
        desktopIds: ["desktop-leading", "desktop-trailing"],
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialWorkspaceGap({
        ...input(300, false),
        desktopIds: ["desktop-a", "desktop-trailing"],
      }),
    ).toEqual({
      adjacentDesktopId: "desktop-trailing",
      anchorDesktopId: "desktop-a",
      insertionIndex: 1,
      lineY: 320,
      position: "after",
    });
  });

  it.each([
    null,
    {},
    { ...input(320), cardGap: 0 },
    { ...input(320), cardHeight: Number.POSITIVE_INFINITY },
    { ...input(320), keepEmptyDesktopAboveFirst: "true" },
    { ...input(320), desktopIds: ["desktop-a", "desktop-a", "tail"] },
    { ...input(320), desktopIds: ["desktop-a", "desktop\u0000b", "tail"] },
    {
      ...input(320),
      desktopIds: Array.from(
        { length: LAYOUT_PERSISTENCE_LIMITS.contexts + 1 },
        (_, index) => `desktop-${String(index)}`,
      ),
    },
    {
      ...input(320),
      cardTop: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
    },
  ])("rejects malformed or unbounded input: %#", (candidate) => {
    expect(planOverviewSpatialWorkspaceGap(candidate)).toBeNull();
  });

  it("fails closed when input access throws", () => {
    const hostile = Object.defineProperty({}, "desktopIds", {
      enumerable: true,
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialWorkspaceGap(hostile)).toBeNull();
    expect(
      planOverviewSpatialWorkspaceGap({
        ...input(320),
        desktopIds: new Proxy([...desktopIds], {
          get(): never {
            throw new Error("unavailable");
          },
        }),
      }),
    ).toBeNull();
  });
});
