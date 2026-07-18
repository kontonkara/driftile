import { describe, expect, it } from "vitest";
import { planOverviewSpatialHorizontalWheel } from "../../src/overview/spatial-horizontal-wheel";

const baseInput = Object.freeze({
  angleDeltaX: 0,
  maximumViewportOffset: 500,
  minimumViewportOffset: -500,
  pixelDeltaX: 0,
  pixelRemainder: 0,
  projectionScale: 1,
  remainder: 0,
  viewportOffset: 100,
});

describe("planOverviewSpatialHorizontalWheel", () => {
  it("converts precise pixel input into clamped scene movement", () => {
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        pixelDeltaX: 20,
        projectionScale: 0.5,
      }),
    ).toEqual({
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
      viewportOffset: 60,
    });
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        pixelDeltaX: -12,
        projectionScale: 2,
      }),
    ).toEqual({
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
      viewportOffset: 106,
    });
  });

  it("prioritizes precise input and clears discrete state", () => {
    const plan = planOverviewSpatialHorizontalWheel({
      ...baseInput,
      angleDeltaX: 120,
      pixelDeltaX: 8,
      remainder: 70,
    });

    expect(plan).toEqual({
      intent: "viewport",
      pixelRemainder: 0,
      remainder: 0,
      viewportOffset: 92,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    [-495, 20, -500],
    [495, -20, 500],
    [-500, 1 / 256, -500],
    [500, -1 / 256, 500],
  ])(
    "clamps viewport offset %o with pixel delta %o to %o",
    (viewportOffset, pixelDeltaX, expectedViewportOffset) => {
      expect(
        planOverviewSpatialHorizontalWheel({
          ...baseInput,
          pixelDeltaX,
          viewportOffset,
        }),
      ).toEqual({
        intent: "viewport",
        pixelRemainder: 0,
        remainder: 0,
        viewportOffset: expectedViewportOffset,
      });
    },
  );

  it("accumulates bounded scene-space subpixels", () => {
    let viewportOffset: number = baseInput.viewportOffset;
    let pixelRemainder = 0;

    for (let event = 0; event < 4; event += 1) {
      const plan = planOverviewSpatialHorizontalWheel({
        ...baseInput,
        pixelDeltaX: 1 / 128,
        pixelRemainder,
        projectionScale: 2,
        viewportOffset,
      });

      expect(plan?.intent).toBe("viewport");
      if (plan?.intent !== "viewport") {
        throw new Error("expected viewport wheel plan");
      }
      viewportOffset = plan.viewportOffset;
      pixelRemainder = plan.pixelRemainder;
    }

    expect(viewportOffset).toBe(100 - 1 / 64);
    expect(pixelRemainder).toBe(0);
  });

  it("drops stale subpixels on direction and input mode changes", () => {
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        pixelDeltaX: -1 / 256,
        pixelRemainder: 3 / 256,
      }),
    ).toEqual({
      intent: "viewport",
      pixelRemainder: -1 / 256,
      remainder: 0,
      viewportOffset: 100,
    });
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        angleDeltaX: 40,
        pixelRemainder: 3 / 256,
      }),
    ).toEqual({
      direction: null,
      intent: "selection",
      pixelRemainder: 0,
      remainder: 40,
      steps: 0,
      viewportOffset: 100,
    });
  });

  it("accumulates discrete input and reverses immediately", () => {
    const partial = planOverviewSpatialHorizontalWheel({
      ...baseInput,
      angleDeltaX: 70,
    });

    expect(partial).toEqual({
      direction: null,
      intent: "selection",
      pixelRemainder: 0,
      remainder: 70,
      steps: 0,
      viewportOffset: 100,
    });
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        angleDeltaX: 50,
        remainder: partial?.remainder,
      }),
    ).toEqual({
      direction: "previous",
      intent: "selection",
      pixelRemainder: 0,
      remainder: 0,
      steps: 1,
      viewportOffset: 100,
    });
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        angleDeltaX: -100,
        remainder: 90,
      }),
    ).toEqual({
      direction: null,
      intent: "selection",
      pixelRemainder: 0,
      remainder: -100,
      steps: 0,
      viewportOffset: 100,
    });
  });

  it("caps discrete work at four steps per event", () => {
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        angleDeltaX: -1_000_000,
        remainder: -119,
      }),
    ).toEqual({
      direction: "next",
      intent: "selection",
      pixelRemainder: 0,
      remainder: -119,
      steps: 4,
      viewportOffset: 100,
    });
    expect(
      planOverviewSpatialHorizontalWheel({
        ...baseInput,
        angleDeltaX: 1_000_000,
        remainder: -60,
      }),
    ).toEqual({
      direction: "previous",
      intent: "selection",
      pixelRemainder: 0,
      remainder: 0,
      steps: 4,
      viewportOffset: 100,
    });
  });

  it("returns a frozen zero-step discrete plan for zero input", () => {
    const plan = planOverviewSpatialHorizontalWheel({
      ...baseInput,
      pixelRemainder: 3 / 256,
      remainder: 40,
    });

    expect(plan).toEqual({
      direction: null,
      intent: "selection",
      pixelRemainder: 0,
      remainder: 40,
      steps: 0,
      viewportOffset: 100,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("defaults missing pixel remainder and normalizes negative zero", () => {
    const plan = planOverviewSpatialHorizontalWheel({
      angleDeltaX: -0,
      maximumViewportOffset: 10,
      minimumViewportOffset: -0,
      pixelDeltaX: -0,
      projectionScale: 1,
      remainder: -0,
      viewportOffset: -0,
    });

    expect(plan).toEqual({
      direction: null,
      intent: "selection",
      pixelRemainder: 0,
      remainder: 0,
      steps: 0,
      viewportOffset: 0,
    });
    expect(Object.is(plan?.viewportOffset, -0)).toBe(false);
    expect(Object.is(plan?.remainder, -0)).toBe(false);
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, angleDeltaX: 1_000_001 },
    { ...baseInput, angleDeltaX: 0.5 },
    { ...baseInput, angleDeltaX: Number.NaN },
    { ...baseInput, maximumViewportOffset: Number.POSITIVE_INFINITY },
    {
      ...baseInput,
      maximumViewportOffset: -501,
      minimumViewportOffset: -500,
    },
    { ...baseInput, minimumViewportOffset: Number.MAX_VALUE },
    { ...baseInput, pixelDeltaX: 4096.01 },
    { ...baseInput, pixelDeltaX: Number.POSITIVE_INFINITY },
    { ...baseInput, pixelRemainder: 1 / 64 },
    { ...baseInput, pixelRemainder: Number.NaN },
    { ...baseInput, pixelRemainder: null },
    { ...baseInput, projectionScale: 0 },
    { ...baseInput, projectionScale: Number.MIN_VALUE, pixelDeltaX: 1 },
    { ...baseInput, projectionScale: Number.POSITIVE_INFINITY },
    { ...baseInput, remainder: 120 },
    { ...baseInput, remainder: 0.5 },
    { ...baseInput, viewportOffset: -501 },
    { ...baseInput, viewportOffset: 501 },
  ])("fails closed for malformed or unbounded input (%o)", (input) => {
    expect(planOverviewSpatialHorizontalWheel(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "pixelDeltaX", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialHorizontalWheel(hostile)).toBeNull();
  });
});
