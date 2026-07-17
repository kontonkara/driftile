import { describe, expect, it } from "vitest";
import { planOverviewSpatialEdgePan } from "../../src/overview/spatial-edge-pan";

const baseInput = Object.freeze({
  contentHeight: 1800,
  contentY: 500,
  elapsedMilliseconds: 100,
  pointerY: 400,
  sceneHeight: 800,
});

describe("planOverviewSpatialEdgePan", () => {
  it("accelerates quadratically through the upper and lower edge zones", () => {
    expect(planOverviewSpatialEdgePan({ ...baseInput, pointerY: 48 })).toEqual({
      active: true,
      contentY: 470,
      direction: "up",
    });
    expect(planOverviewSpatialEdgePan({ ...baseInput, pointerY: 752 })).toEqual(
      { active: true, contentY: 530, direction: "down" },
    );
  });

  it("saturates pointer depth outside the scene and clamps movement", () => {
    const upper = planOverviewSpatialEdgePan({
      ...baseInput,
      contentY: 200,
      elapsedMilliseconds: 250,
      pointerY: -100,
    });
    const lower = planOverviewSpatialEdgePan({
      ...baseInput,
      contentY: 900,
      elapsedMilliseconds: 250,
      pointerY: 900,
    });

    expect(upper).toEqual({ active: true, contentY: 0, direction: "up" });
    expect(lower).toEqual({
      active: true,
      contentY: 1000,
      direction: "down",
    });
    expect(Object.isFrozen(upper)).toBe(true);
    expect(Object.isFrozen(lower)).toBe(true);
  });

  it("uses the bounded maximum speed on tall scenes", () => {
    expect(
      planOverviewSpatialEdgePan({
        contentHeight: 5000,
        contentY: 1000,
        elapsedMilliseconds: 250,
        pointerY: 0,
        sceneHeight: 2000,
      }),
    ).toEqual({ active: true, contentY: 550, direction: "up" });
  });

  it.each([
    [{ ...baseInput, contentY: 0, pointerY: 0 }, 0],
    [{ ...baseInput, contentY: 1000, pointerY: 800 }, 1000],
    [{ ...baseInput, elapsedMilliseconds: 0, pointerY: 0 }, 500],
    [{ ...baseInput, pointerY: 96 }, 500],
    [{ ...baseInput, pointerY: 704 }, 500],
    [
      {
        ...baseInput,
        contentHeight: 800,
        contentY: 500,
        pointerY: 0,
      },
      0,
    ],
  ])("stays inactive without possible movement (%o)", (input, contentY) => {
    const plan = planOverviewSpatialEdgePan(input);

    expect(plan).toEqual({ active: false, contentY, direction: null });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("normalizes an out-of-range starting viewport before planning", () => {
    expect(
      planOverviewSpatialEdgePan({
        ...baseInput,
        contentY: -100,
        pointerY: 400,
      }),
    ).toEqual({ active: false, contentY: 0, direction: null });
    expect(
      planOverviewSpatialEdgePan({
        ...baseInput,
        contentY: 1200,
        pointerY: 400,
      }),
    ).toEqual({ active: false, contentY: 1000, direction: null });
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, sceneHeight: 0 },
    { ...baseInput, contentHeight: 799 },
    { ...baseInput, contentY: Number.NaN },
    { ...baseInput, pointerY: Number.POSITIVE_INFINITY },
    { ...baseInput, elapsedMilliseconds: -1 },
    { ...baseInput, elapsedMilliseconds: 250.01 },
    { ...baseInput, elapsedMilliseconds: Number.NaN },
    { ...baseInput, sceneHeight: Number.MIN_VALUE },
  ])("rejects malformed or underflowing input (%o)", (input) => {
    expect(planOverviewSpatialEdgePan(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "pointerY", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialEdgePan(hostile)).toBeNull();
  });
});
