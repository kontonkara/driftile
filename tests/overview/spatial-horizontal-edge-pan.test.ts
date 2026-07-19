import { describe, expect, it } from "vitest";
import { planOverviewSpatialHorizontalEdgePan } from "../../src/overview/spatial-horizontal-edge-pan";

const baseInput = Object.freeze({
  elapsedMilliseconds: 100,
  maximumViewportOffset: 1_000,
  minimumViewportOffset: -1_000,
  pointerX: 500,
  projectionScale: 0.5,
  viewportLeft: 100,
  viewportOffset: 0,
  viewportWidth: 800,
});

describe("planOverviewSpatialHorizontalEdgePan", () => {
  it("accelerates through either viewport edge in projected row units", () => {
    expect(
      planOverviewSpatialHorizontalEdgePan({
        ...baseInput,
        pointerX: 148,
      }),
    ).toEqual({ active: true, direction: "left", viewportOffset: -60 });
    expect(
      planOverviewSpatialHorizontalEdgePan({
        ...baseInput,
        pointerX: 852,
      }),
    ).toEqual({ active: true, direction: "right", viewportOffset: 60 });
  });

  it("uses projection scale without changing the screen-space speed", () => {
    const projected = planOverviewSpatialHorizontalEdgePan({
      ...baseInput,
      pointerX: 100,
      projectionScale: 2,
    });
    const unprojected = planOverviewSpatialHorizontalEdgePan({
      ...baseInput,
      pointerX: 100,
      projectionScale: 1,
    });

    expect(projected).toEqual({
      active: true,
      direction: "left",
      viewportOffset: -60,
    });
    expect(unprojected).toEqual({
      active: true,
      direction: "left",
      viewportOffset: -120,
    });
  });

  it("clamps out-of-viewport pointers and offset movement", () => {
    const left = planOverviewSpatialHorizontalEdgePan({
      ...baseInput,
      elapsedMilliseconds: 250,
      minimumViewportOffset: -200,
      pointerX: -10_000,
      projectionScale: 1,
    });
    const right = planOverviewSpatialHorizontalEdgePan({
      ...baseInput,
      elapsedMilliseconds: 250,
      maximumViewportOffset: 200,
      pointerX: 10_000,
      projectionScale: 1,
    });

    expect(left).toEqual({
      active: true,
      direction: "left",
      viewportOffset: -200,
    });
    expect(right).toEqual({
      active: true,
      direction: "right",
      viewportOffset: 200,
    });
    expect(Object.isFrozen(left)).toBe(true);
    expect(Object.isFrozen(right)).toBe(true);
  });

  it.each([
    [{ ...baseInput, elapsedMilliseconds: 0, pointerX: 100 }, 0],
    [{ ...baseInput, pointerX: 196 }, 0],
    [{ ...baseInput, pointerX: 804 }, 0],
    [
      {
        ...baseInput,
        maximumViewportOffset: 0,
        minimumViewportOffset: 0,
        pointerX: 100,
      },
      0,
    ],
    [
      {
        ...baseInput,
        pointerX: 100,
        viewportOffset: -1_000,
      },
      -1_000,
    ],
    [
      {
        ...baseInput,
        pointerX: 900,
        viewportOffset: 1_000,
      },
      1_000,
    ],
  ])(
    "stays inactive without possible movement (%o)",
    (input, viewportOffset) => {
      const plan = planOverviewSpatialHorizontalEdgePan(input);

      expect(plan).toEqual({ active: false, direction: null, viewportOffset });
      expect(Object.isFrozen(plan)).toBe(true);
    },
  );

  it("normalizes negative zero", () => {
    const plan = planOverviewSpatialHorizontalEdgePan({
      ...baseInput,
      elapsedMilliseconds: 0,
      viewportOffset: -0,
    });

    expect(plan).toEqual({ active: false, direction: null, viewportOffset: 0 });
    expect(Object.is(plan?.viewportOffset, -0)).toBe(false);
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, elapsedMilliseconds: -1 },
    { ...baseInput, elapsedMilliseconds: 250.01 },
    { ...baseInput, maximumViewportOffset: Number.POSITIVE_INFINITY },
    { ...baseInput, minimumViewportOffset: 1_001 },
    { ...baseInput, pointerX: Number.NaN },
    { ...baseInput, projectionScale: 0 },
    { ...baseInput, projectionScale: Number.MIN_VALUE },
    { ...baseInput, viewportLeft: Number.MAX_SAFE_INTEGER, viewportWidth: 1 },
    { ...baseInput, viewportOffset: -1_001 },
    { ...baseInput, viewportOffset: 1_001 },
    { ...baseInput, viewportWidth: 0 },
  ])("fails closed for malformed or overflowing input (%o)", (input) => {
    expect(planOverviewSpatialHorizontalEdgePan(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "pointerX", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialHorizontalEdgePan(hostile)).toBeNull();
  });
});
