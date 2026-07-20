import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { planOverviewTouchPanAxis } from "../../src/overview/runtime";

const baseInput = Object.freeze({
  axis: "pending" as const,
  horizontalAvailable: true,
  translationX: 0,
  translationY: 0,
  verticalAvailable: true,
});

describe("planOverviewTouchPanAxis", () => {
  it.each([
    { translationX: 8, translationY: 0 },
    { translationX: -8, translationY: 0 },
    { translationX: 10, translationY: 8 },
    { translationX: -100, translationY: 12 },
  ])("latches a dominant horizontal gesture: %o", (translation) => {
    const plan = planOverviewTouchPanAxis({ ...baseInput, ...translation });

    expect(plan).toEqual({ axis: "horizontal" });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    { translationX: 0, translationY: 8 },
    { translationX: 0, translationY: -8 },
    { translationX: 8, translationY: 10 },
    { translationX: 12, translationY: -100 },
  ])("latches a dominant vertical gesture: %o", (translation) => {
    const plan = planOverviewTouchPanAxis({ ...baseInput, ...translation });

    expect(plan).toEqual({ axis: "vertical" });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    { translationX: 0, translationY: 0 },
    { translationX: 7.999, translationY: 0 },
    { translationX: 0, translationY: -7.999 },
    { translationX: 8, translationY: 8 },
    { translationX: 10, translationY: 8.001 },
    { translationX: -8.001, translationY: 10 },
  ])(
    "keeps an ambiguous or sub-threshold gesture pending: %o",
    (translation) => {
      const plan = planOverviewTouchPanAxis({ ...baseInput, ...translation });

      expect(plan).toEqual({ axis: "pending" });
      expect(Object.isFrozen(plan)).toBe(true);
    },
  );

  it("does not redirect a dominant unavailable direction to the lesser axis", () => {
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        horizontalAvailable: false,
        translationX: 20,
        translationY: 1,
      }),
    ).toEqual({ axis: "pending" });
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        translationX: 1,
        translationY: 20,
        verticalAvailable: false,
      }),
    ).toEqual({ axis: "pending" });
  });

  it("keeps an established axis locked while that direction remains available", () => {
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        axis: "horizontal",
        translationX: 1,
        translationY: 100,
        verticalAvailable: false,
      }),
    ).toEqual({ axis: "horizontal" });
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        axis: "vertical",
        horizontalAvailable: false,
        translationX: 100,
        translationY: 1,
      }),
    ).toEqual({ axis: "vertical" });
  });

  it("invalidates an established axis when its direction becomes unavailable", () => {
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        axis: "horizontal",
        horizontalAvailable: false,
      }),
    ).toBeNull();
    expect(
      planOverviewTouchPanAxis({
        ...baseInput,
        axis: "vertical",
        verticalAvailable: false,
      }),
    ).toBeNull();
  });

  it("accepts the shared numeric boundary and freezes the result", () => {
    const horizontal = planOverviewTouchPanAxis({
      ...baseInput,
      translationX: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      translationY: -0,
    });
    const vertical = planOverviewTouchPanAxis({
      ...baseInput,
      translationX: -0,
      translationY: -LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
    });

    expect(horizontal).toEqual({ axis: "horizontal" });
    expect(vertical).toEqual({ axis: "vertical" });
    expect(Object.isFrozen(horizontal)).toBe(true);
    expect(Object.isFrozen(vertical)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, axis: "diagonal" },
    { ...baseInput, axis: null },
    { ...baseInput, horizontalAvailable: 1 },
    { ...baseInput, verticalAvailable: "true" },
    { ...baseInput, translationX: Number.NaN },
    { ...baseInput, translationX: Number.POSITIVE_INFINITY },
    {
      ...baseInput,
      translationX: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
    },
    { ...baseInput, translationY: Number.NEGATIVE_INFINITY },
    {
      ...baseInput,
      translationY: -LAYOUT_PERSISTENCE_LIMITS.numericMagnitude - 1,
    },
  ])("fails closed for malformed or unbounded input: %o", (input) => {
    expect(planOverviewTouchPanAxis(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({ ...baseInput }, "translationY", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewTouchPanAxis(hostile)).toBeNull();
  });

  it("does not mutate caller-owned input", () => {
    const input = Object.freeze({
      ...baseInput,
      translationX: 24,
      translationY: 3,
    });
    const before = JSON.stringify(input);

    expect(planOverviewTouchPanAxis(input)).toEqual({ axis: "horizontal" });
    expect(JSON.stringify(input)).toBe(before);
  });
});
