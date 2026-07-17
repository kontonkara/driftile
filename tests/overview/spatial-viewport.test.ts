import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  planOverviewSpatialViewport,
  planOverviewSpatialWorkspaceCenter,
} from "../../src/overview/spatial-viewport";

describe("planOverviewSpatialViewport", () => {
  it.each([
    [-400, 0],
    [-0, 0],
    [0, 0],
    [450, 450],
    [900, 900],
    [1_200, 900],
  ])("clamps content y %o to %o", (contentY, expectedContentY) => {
    const plan = planOverviewSpatialViewport({
      contentHeight: 1800,
      contentY,
      sceneHeight: 900,
    });

    expect(plan).toEqual({
      contentY: expectedContentY,
      maximumContentY: 900,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("keeps a scene-sized viewport fixed at zero", () => {
    expect(
      planOverviewSpatialViewport({
        contentHeight: 900,
        contentY: 600,
        sceneHeight: 900,
      }),
    ).toEqual({ contentY: 0, maximumContentY: 0 });
  });

  it.each([
    null,
    [],
    {},
    { contentHeight: 1800, contentY: 0, sceneHeight: 0 },
    { contentHeight: 899, contentY: 0, sceneHeight: 900 },
    { contentHeight: Number.POSITIVE_INFINITY, contentY: 0, sceneHeight: 900 },
    { contentHeight: 1800, contentY: Number.NaN, sceneHeight: 900 },
  ])("rejects malformed viewport input (%o)", (input) => {
    expect(planOverviewSpatialViewport(input)).toBeNull();
  });
});

describe("planOverviewSpatialWorkspaceCenter", () => {
  it("centers every workspace by its card stride", () => {
    const stride = 270 + 32.4;
    const contentHeight = 900 + 3 * stride;

    for (let workspaceIndex = 0; workspaceIndex < 4; workspaceIndex += 1) {
      const plan = planOverviewSpatialWorkspaceCenter({
        cardHeight: 270,
        contentHeight,
        gap: 32.4,
        sceneHeight: 900,
        workspaceCount: 4,
        workspaceIndex,
      });

      expect(plan?.contentY).toBeCloseTo(workspaceIndex * stride);
      expect(plan?.maximumContentY).toBeCloseTo(3 * stride);
      expect(Object.isFrozen(plan)).toBe(true);
    }
  });

  it("clamps a valid workspace target to the available content range", () => {
    expect(
      planOverviewSpatialWorkspaceCenter({
        cardHeight: 450,
        contentHeight: 1200,
        gap: 48,
        sceneHeight: 900,
        workspaceCount: 4,
        workspaceIndex: 3,
      }),
    ).toEqual({ contentY: 300, maximumContentY: 300 });
  });

  it("accepts the persistence workspace limit without scanning it", () => {
    const workspaceCount = LAYOUT_PERSISTENCE_LIMITS.contexts;
    const stride = 128;
    const maximumContentY = (workspaceCount - 1) * stride;

    expect(
      planOverviewSpatialWorkspaceCenter({
        cardHeight: 128,
        contentHeight: 720 + maximumContentY,
        gap: 0,
        sceneHeight: 720,
        workspaceCount,
        workspaceIndex: workspaceCount - 1,
      }),
    ).toEqual({ contentY: maximumContentY, maximumContentY });
  });

  it.each([
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: 0,
      workspaceIndex: 0,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
      workspaceIndex: 0,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 2,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: -1,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 1,
    },
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      gap: Number.MAX_VALUE,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 1,
    },
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      gap: 0,
      sceneHeight: 900,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts,
      workspaceIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
    },
  ])("rejects malformed or overflowing center input (%o)", (input) => {
    expect(planOverviewSpatialWorkspaceCenter(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "contentHeight", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialViewport(hostile)).toBeNull();
    expect(planOverviewSpatialWorkspaceCenter(hostile)).toBeNull();
  });
});
