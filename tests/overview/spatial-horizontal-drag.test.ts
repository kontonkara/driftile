import { describe, expect, it } from "vitest";
import { planOverviewSpatialHorizontalDrag } from "../../src/overview/spatial-horizontal-drag";

const baseInput = Object.freeze({
  maximumViewportOffset: 500,
  minimumViewportOffset: -500,
  projectionScale: 1,
  startViewportOffset: 100,
  translationX: 0,
});

describe("planOverviewSpatialHorizontalDrag", () => {
  it("converts the current screen translation into row-space movement", () => {
    expect(
      planOverviewSpatialHorizontalDrag({
        ...baseInput,
        projectionScale: 0.5,
        translationX: 20,
      }),
    ).toEqual({ viewportOffset: 60 });
    expect(
      planOverviewSpatialHorizontalDrag({
        ...baseInput,
        projectionScale: 2,
        translationX: -12,
      }),
    ).toEqual({ viewportOffset: 106 });
  });

  it("derives every plan from the captured drag start", () => {
    expect(
      planOverviewSpatialHorizontalDrag({
        ...baseInput,
        translationX: 25,
      }),
    ).toEqual({ viewportOffset: 75 });
    expect(
      planOverviewSpatialHorizontalDrag({
        ...baseInput,
        translationX: 40,
      }),
    ).toEqual({ viewportOffset: 60 });
  });

  it.each([
    [20, 0.5, -495, -500],
    [-20, 0.5, 495, 500],
    [10, 1, -500, -500],
    [-10, 1, 500, 500],
  ])(
    "clamps translation %o at scale %o from %o to %o",
    (translationX, projectionScale, startViewportOffset, viewportOffset) => {
      const plan = planOverviewSpatialHorizontalDrag({
        ...baseInput,
        projectionScale,
        startViewportOffset,
        translationX,
      });

      expect(plan).toEqual({ viewportOffset });
      expect(Object.isFrozen(plan)).toBe(true);
    },
  );

  it("returns a frozen normalized plan without movement", () => {
    const plan = planOverviewSpatialHorizontalDrag({
      ...baseInput,
      maximumViewportOffset: 0,
      minimumViewportOffset: -0,
      startViewportOffset: -0,
      translationX: -0,
    });

    expect(plan).toEqual({ viewportOffset: 0 });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.is(plan?.viewportOffset, -0)).toBe(false);
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, maximumViewportOffset: Number.POSITIVE_INFINITY },
    {
      ...baseInput,
      maximumViewportOffset: -501,
      minimumViewportOffset: -500,
    },
    { ...baseInput, minimumViewportOffset: Number.NEGATIVE_INFINITY },
    { ...baseInput, projectionScale: 0 },
    { ...baseInput, projectionScale: Number.MIN_VALUE },
    { ...baseInput, projectionScale: Number.POSITIVE_INFINITY },
    { ...baseInput, startViewportOffset: -501 },
    { ...baseInput, startViewportOffset: 501 },
    { ...baseInput, translationX: Number.NaN },
    { ...baseInput, translationX: Number.MAX_VALUE },
    {
      ...baseInput,
      projectionScale: 1 / Number.MAX_SAFE_INTEGER,
      translationX: Number.MAX_SAFE_INTEGER,
    },
  ])("fails closed for malformed or overflowing input (%o)", (input) => {
    expect(planOverviewSpatialHorizontalDrag(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "translationX", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialHorizontalDrag(hostile)).toBeNull();
  });
});
