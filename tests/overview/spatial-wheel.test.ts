import { describe, expect, it } from "vitest";
import { planOverviewSpatialWheel } from "../../src/overview/spatial-wheel";

const baseInput = Object.freeze({
  angleDeltaY: 0,
  contentHeight: 2400,
  contentY: 600,
  pixelDeltaY: 0,
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
      remainder: -100,
      steps: 0,
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
        remainder: 0,
      });
    },
  );

  it("normalizes an out-of-range viewport for either intent", () => {
    expect(planOverviewSpatialWheel({ ...baseInput, contentY: -500 })).toEqual({
      contentY: 0,
      direction: null,
      intent: "workspace",
      remainder: 0,
      steps: 0,
    });
    expect(
      planOverviewSpatialWheel({
        ...baseInput,
        contentY: 3000,
        pixelDeltaY: -20,
      }),
    ).toEqual({ contentY: 1600, intent: "viewport", remainder: 0 });
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, angleDeltaY: 481 },
    { ...baseInput, angleDeltaY: 0.5 },
    { ...baseInput, contentHeight: 799 },
    { ...baseInput, contentHeight: Number.MAX_VALUE },
    { ...baseInput, contentY: Number.NaN },
    { ...baseInput, pixelDeltaY: 4096.01 },
    { ...baseInput, pixelDeltaY: Number.POSITIVE_INFINITY },
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
