import { describe, expect, it } from "vitest";
import { planOverviewTabRailWheel } from "../../src/overview/tab-rail-wheel";

const baseInput = Object.freeze({
  angleDelta: 0,
  angleRemainder: 0,
  currentIndex: 2,
  memberCount: 6,
  pixelDelta: 0,
  pixelRemainder: 0,
});

describe("planOverviewTabRailWheel", () => {
  it("accumulates partial angle input before moving to the next member", () => {
    const partial = planOverviewTabRailWheel({
      ...baseInput,
      angleDelta: 70,
    });

    expect(partial).toEqual({
      angleRemainder: 70,
      consumed: true,
      direction: null,
      inputMode: "angle",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 2,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: 50,
        angleRemainder: partial?.angleRemainder,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "next",
      inputMode: "angle",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 1,
      targetIndex: 3,
    });
  });

  it("accumulates partial pixel input before moving to the previous member", () => {
    const partial = planOverviewTabRailWheel({
      ...baseInput,
      pixelDelta: -24.5,
    });

    expect(partial).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: null,
      inputMode: "pixel",
      moved: false,
      pixelRemainder: -24.5,
      stepsApplied: 0,
      targetIndex: 2,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        pixelDelta: -15.5,
        pixelRemainder: partial?.pixelRemainder,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "pixel",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 1,
      targetIndex: 1,
    });
  });

  it("drops an accumulated remainder when its direction reverses", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -60,
        angleRemainder: 90,
      }),
    ).toEqual({
      angleRemainder: -60,
      consumed: true,
      direction: null,
      inputMode: "angle",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 2,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        pixelDelta: 12.25,
        pixelRemainder: -39.5,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: null,
      inputMode: "pixel",
      moved: false,
      pixelRemainder: 12.25,
      stepsApplied: 0,
      targetIndex: 2,
    });
  });

  it("prioritizes pixel input and resets the inactive remainder", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -240,
        angleRemainder: -119,
        pixelDelta: 40,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "next",
      inputMode: "pixel",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 1,
      targetIndex: 3,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -120,
        pixelRemainder: 39.5,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "angle",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 1,
      targetIndex: 1,
    });
  });

  it.each([
    { angleDelta: 120, direction: "next", targetIndex: 3 },
    { angleDelta: -120, direction: "previous", targetIndex: 1 },
  ] as const)(
    "maps angle delta $angleDelta to $direction",
    ({ angleDelta, direction, targetIndex }) => {
      expect(
        planOverviewTabRailWheel({ ...baseInput, angleDelta }),
      ).toMatchObject({
        direction,
        moved: true,
        stepsApplied: 1,
        targetIndex,
      });
    },
  );

  it.each([
    { direction: "next", pixelDelta: 40, targetIndex: 3 },
    { direction: "previous", pixelDelta: -40, targetIndex: 1 },
  ] as const)(
    "maps pixel delta $pixelDelta to $direction",
    ({ direction, pixelDelta, targetIndex }) => {
      expect(
        planOverviewTabRailWheel({ ...baseInput, pixelDelta }),
      ).toMatchObject({
        direction,
        moved: true,
        stepsApplied: 1,
        targetIndex,
      });
    },
  );

  it("caps angle and pixel work at four steps per event", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: 1_000_000,
        angleRemainder: 119,
        currentIndex: 100,
        memberCount: 256,
      }),
    ).toEqual({
      angleRemainder: 119,
      consumed: true,
      direction: "next",
      inputMode: "angle",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 4,
      targetIndex: 104,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        currentIndex: 100,
        memberCount: 256,
        pixelDelta: -4_096,
        pixelRemainder: -39.5,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "pixel",
      moved: true,
      pixelRemainder: -39.5,
      stepsApplied: 4,
      targetIndex: 96,
    });
  });

  it("consumes outward input at both boundaries without moving", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -120,
        angleRemainder: -30,
        currentIndex: 0,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "angle",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 0,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        currentIndex: 5,
        pixelDelta: 40,
        pixelRemainder: 20,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "next",
      inputMode: "pixel",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 5,
    });
  });

  it("consumes both directions when only one member is actionable", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -120,
        currentIndex: 0,
        memberCount: 1,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "angle",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 0,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        currentIndex: 0,
        memberCount: 1,
        pixelDelta: 40,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "next",
      inputMode: "pixel",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 0,
    });
  });

  it("clears partial input that pushes a boundary or remains after reaching it", () => {
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        currentIndex: 5,
        pixelDelta: 5,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: null,
      inputMode: "pixel",
      moved: false,
      pixelRemainder: 0,
      stepsApplied: 0,
      targetIndex: 5,
    });
    expect(
      planOverviewTabRailWheel({
        ...baseInput,
        angleDelta: -170,
        currentIndex: 1,
      }),
    ).toEqual({
      angleRemainder: 0,
      consumed: true,
      direction: "previous",
      inputMode: "angle",
      moved: true,
      pixelRemainder: 0,
      stepsApplied: 1,
      targetIndex: 0,
    });
  });

  it("returns a deterministic deeply frozen plan", () => {
    const first = planOverviewTabRailWheel({
      ...baseInput,
      pixelDelta: 41.25,
    });
    const second = planOverviewTabRailWheel({
      ...baseInput,
      pixelDelta: 41.25,
    });

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      if (first) {
        Object.assign(first, { targetIndex: 5 });
      }
    }).toThrow(TypeError);
  });

  it("normalizes negative zero in the active remainder", () => {
    const plan = planOverviewTabRailWheel({
      ...baseInput,
      angleDelta: -120,
      angleRemainder: -0,
    });

    expect(plan?.angleRemainder).toBe(0);
    expect(Object.is(plan?.angleRemainder, -0)).toBe(false);
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput },
    { ...baseInput, angleDelta: 0.5 },
    { ...baseInput, angleDelta: 1_000_001 },
    { ...baseInput, angleDelta: Number.NaN },
    { ...baseInput, angleRemainder: 120, pixelDelta: 1 },
    { ...baseInput, angleRemainder: 0.5, pixelDelta: 1 },
    { ...baseInput, currentIndex: -1, pixelDelta: 1 },
    { ...baseInput, currentIndex: 6, pixelDelta: 1 },
    { ...baseInput, currentIndex: 1.5, pixelDelta: 1 },
    { ...baseInput, memberCount: 0, pixelDelta: 1 },
    { ...baseInput, memberCount: 257, pixelDelta: 1 },
    { ...baseInput, memberCount: 2.5, pixelDelta: 1 },
    { ...baseInput, pixelDelta: 4_096.01 },
    { ...baseInput, pixelDelta: Number.POSITIVE_INFINITY },
    { ...baseInput, pixelRemainder: 40, angleDelta: 1 },
    { ...baseInput, pixelRemainder: Number.NaN, angleDelta: 1 },
  ])("fails closed for zero, malformed, or unbounded input (%o)", (input) => {
    expect(planOverviewTabRailWheel(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "pixelDelta", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewTabRailWheel(hostile)).toBeNull();
  });
});
