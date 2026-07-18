import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  planOverviewSpatialWheel,
  planOverviewSpatialWorkspaceWheelTarget,
} from "../../src/overview/spatial-wheel";

const baseInput = Object.freeze({
  angleDeltaY: 0,
  contentHeight: 2400,
  contentY: 600,
  pixelDeltaY: 0,
  pixelRemainder: 0,
  remainder: 0,
  sceneHeight: 800,
});

describe("planOverviewSpatialWheel", () => {
  it("accumulates bounded angle input into discrete workspace movement", () => {
    const partial = planOverviewSpatialWheel({
      ...baseInput,
      angleDeltaY: 50,
    });

    expect(partial).toEqual({
      contentY: 600,
      direction: null,
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 50,
      steps: 0,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: 70,
        remainder: partial?.remainder,
      }),
    ).toEqual({
      contentY: 600,
      direction: "previous",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 0,
      steps: 1,
    });
    expect(Object.isFrozen(partial)).toBe(true);
  });

  it("caps discrete work and resets a contradictory remainder", () => {
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: -480,
        remainder: -119,
      }),
    ).toEqual({
      contentY: 600,
      direction: "next",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: -119,
      steps: 4,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: -100,
        remainder: 90,
      }),
    ).toEqual({
      contentY: 600,
      direction: null,
      intent: "workspace",
      pixelRemainder: 0,
      remainder: -100,
      steps: 0,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: 481,
      }),
    ).toEqual({
      contentY: 600,
      direction: "previous",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 0,
      steps: 4,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: 1_000_000,
        remainder: 60,
      }),
    ).toEqual({
      contentY: 600,
      direction: "previous",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 60,
      steps: 4,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: -1_000_000,
        remainder: 60,
      }),
    ).toEqual({
      contentY: 600,
      direction: "next",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 0,
      steps: 4,
    });
  });

  it("uses pixel input exclusively for precise viewport movement", () => {
    const plan = planOverviewSpatialWheel({
      ...baseInput,
      angleDeltaY: 120,
      contentY: 600.75,
      pixelDeltaY: 12.5,
      remainder: 60,
    });

    expect(plan).toEqual({
      contentY: 588.25,
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    [600, 25.25, 574.75],
    [600, -25.25, 625.25],
    [5, 25.25, 0],
    [1595, -25.25, 1600],
  ])(
    "moves content y %o by pixel delta %o to %o",
    (contentY, pixelDeltaY, expectedContentY) => {
      expect(
        planOverviewSpatialWheel({
          ...baseInput,
          contentY,
          pixelDeltaY,
        }),
      ).toEqual({
        contentY: expectedContentY,
        intent: "viewport",
        pixelRemainder: 0,
        remainder: 0,
      });
    },
  );

  it("accumulates subpixel movement in bounded viewport state", () => {
    let contentY: number = baseInput.contentY;
    let pixelRemainder = 0;

    for (let event = 0; event < 4; event += 1) {
      const plan = planOverviewSpatialWheel({
        ...baseInput,
        contentY,
        pixelDeltaY: 1 / 256,
        pixelRemainder,
      });

      expect(plan?.intent).toBe("viewport");
      if (plan?.intent !== "viewport") {
        throw new Error("expected viewport wheel plan");
      }
      contentY = plan.contentY;
      pixelRemainder = plan.pixelRemainder;
    }

    expect(contentY).toBe(600 - 1 / 64);
    expect(pixelRemainder).toBe(0);
  });

  it("drops stale subpixel state on direction and input mode changes", () => {
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        pixelDeltaY: -1 / 256,
        pixelRemainder: 3 / 256,
      }),
    ).toEqual({
      contentY: 600,
      intent: "viewport",
      pixelRemainder: -1 / 256,
      remainder: 0,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: 40,
        pixelRemainder: 3 / 256,
      }),
    ).toEqual({
      contentY: 600,
      direction: null,
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 40,
      steps: 0,
    });
  });

  it("discards subpixel pressure that reaches a viewport boundary", () => {
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        contentY: 0,
        pixelDeltaY: 1 / 256,
        pixelRemainder: 3 / 256,
      }),
    ).toEqual({
      contentY: 0,
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
    });
  });

  it("honors a direction reversal after a saturated discrete burst", () => {
    const saturated = planOverviewSpatialWheel({
      ...baseInput,
      angleDeltaY: -1_000_000,
      remainder: -90,
    });

    expect(saturated).toEqual({
      contentY: 600,
      direction: "next",
      intent: "workspace",
      pixelRemainder: 0,
      remainder: -90,
      steps: 4,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        angleDeltaY: 30,
        remainder: saturated?.remainder,
      }),
    ).toEqual({
      contentY: 600,
      direction: null,
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 30,
      steps: 0,
    });
  });

  it("normalizes an out-of-range viewport for either intent", () => {
    expect(planOverviewSpatialWheel({ ...baseInput, contentY: -500 })).toEqual({
      contentY: 0,
      direction: null,
      intent: "workspace",
      pixelRemainder: 0,
      remainder: 0,
      steps: 0,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        contentY: 3000,
        pixelDeltaY: -20,
      }),
    ).toEqual({
      contentY: 1600,
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
    });
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, angleDeltaY: 1_000_001 },
    { ...baseInput, angleDeltaY: Number.MAX_SAFE_INTEGER },
    { ...baseInput, angleDeltaY: 0.5 },
    { ...baseInput, angleDeltaY: Number.NaN },
    { ...baseInput, angleDeltaY: Number.POSITIVE_INFINITY },
    { ...baseInput, contentHeight: 799 },
    { ...baseInput, contentHeight: Number.MAX_VALUE },
    { ...baseInput, contentY: Number.NaN },
    { ...baseInput, pixelDeltaY: 4096.01 },
    { ...baseInput, pixelDeltaY: Number.POSITIVE_INFINITY },
    { ...baseInput, pixelRemainder: 1 / 64 },
    { ...baseInput, pixelRemainder: Number.NaN },
    { ...baseInput, pixelRemainder: null },
    { ...baseInput, remainder: 120 },
    { ...baseInput, remainder: 0.5 },
    { ...baseInput, sceneHeight: 0 },
  ])("fails closed for malformed or unbounded input (%o)", (input) => {
    expect(planOverviewSpatialWheel(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "pixelDeltaY", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialWheel(hostile)).toBeNull();
  });
});

describe("planOverviewSpatialWorkspaceWheelTarget", () => {
  it.each([
    ["previous", 3, 4, 10, 0, 3],
    ["next", 3, 4, 10, 7, 4],
    ["previous", 2, 4, 10, 0, 2],
    ["next", 8, 4, 10, 9, 1],
    ["next", 5, 0, 10, 5, 0],
  ] as const)(
    "moves %s from %i by %i within %i workspaces",
    (
      direction,
      currentIndex,
      steps,
      workspaceCount,
      targetIndex,
      appliedSteps,
    ) => {
      const plan = planOverviewSpatialWorkspaceWheelTarget({
        currentIndex,
        direction,
        steps,
        workspaceCount,
      });

      expect(plan).toEqual({ appliedSteps, targetIndex });
      expect(Object.isFrozen(plan)).toBe(true);
    },
  );

  it("stays at the first and last workspace without wrapping", () => {
    expect(
      planOverviewSpatialWorkspaceWheelTarget({
        currentIndex: 0,
        direction: "previous",
        steps: 4,
        workspaceCount: 5,
      }),
    ).toEqual({ appliedSteps: 0, targetIndex: 0 });
    expect(
      planOverviewSpatialWorkspaceWheelTarget({
        currentIndex: 4,
        direction: "next",
        steps: 4,
        workspaceCount: 5,
      }),
    ).toEqual({ appliedSteps: 0, targetIndex: 4 });
  });

  it("accepts the bounded maximum workspace count in constant work", () => {
    const workspaceCount = LAYOUT_PERSISTENCE_LIMITS.contexts;

    expect(
      planOverviewSpatialWorkspaceWheelTarget({
        currentIndex: workspaceCount - 2,
        direction: "next",
        steps: 4,
        workspaceCount,
      }),
    ).toEqual({ appliedSteps: 1, targetIndex: workspaceCount - 1 });
  });

  it.each([
    null,
    [],
    {},
    { currentIndex: 0, direction: "next", steps: 1, workspaceCount: 0 },
    {
      currentIndex: 0,
      direction: "next",
      steps: 1,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
    },
    { currentIndex: -1, direction: "next", steps: 1, workspaceCount: 5 },
    { currentIndex: 5, direction: "next", steps: 1, workspaceCount: 5 },
    { currentIndex: 0.5, direction: "next", steps: 1, workspaceCount: 5 },
    { currentIndex: 0, direction: null, steps: 1, workspaceCount: 5 },
    { currentIndex: 0, direction: "up", steps: 1, workspaceCount: 5 },
    { currentIndex: 0, direction: "next", steps: -1, workspaceCount: 5 },
    { currentIndex: 0, direction: "next", steps: 5, workspaceCount: 5 },
    { currentIndex: 0, direction: "next", steps: 0.5, workspaceCount: 5 },
  ])("fails closed for malformed or unbounded input (%o)", (input) => {
    expect(planOverviewSpatialWorkspaceWheelTarget(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "direction", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialWorkspaceWheelTarget(hostile)).toBeNull();
  });
});
