import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { planOverviewTabRail } from "../../src/overview/runtime";

const baseInput = Object.freeze({
  columnFrame: Object.freeze({ height: 480, width: 420, x: 120, y: 80 }),
  memberCount: 3,
  minimumY: 30,
  presentation: "tabbed",
  selectedIndex: 1,
  viewport: Object.freeze({ height: 720, width: 1280, x: 0, y: 0 }),
});

describe("planOverviewTabRail", () => {
  it("overlays one ordered chip per member near the column top", () => {
    const plan = planOverviewTabRail(baseInput);

    expect(plan).toEqual({
      chipFrames: [
        {
          height: 24,
          memberIndex: 0,
          selected: false,
          width: 120,
          x: 146,
          y: 88,
        },
        {
          height: 24,
          memberIndex: 1,
          selected: true,
          width: 120,
          x: 270,
          y: 88,
        },
        {
          height: 24,
          memberIndex: 2,
          selected: false,
          width: 120,
          x: 394,
          y: 88,
        },
      ],
      railFrame: { height: 24, width: 368, x: 146, y: 88 },
    });
    expect(baseInput.columnFrame).toEqual({
      height: 480,
      width: 420,
      x: 120,
      y: 80,
    });
  });

  it("clips the overlay to the visible column and viewport intersection", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      columnFrame: { height: 300, width: 400, x: -100, y: -20 },
      memberCount: 4,
      selectedIndex: 3,
      viewport: { height: 200, width: 260, x: 0, y: 0 },
    });

    expect(plan).toEqual({
      chipFrames: [
        {
          height: 24,
          memberIndex: 0,
          selected: false,
          width: 58,
          x: 8,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 1,
          selected: false,
          width: 58,
          x: 70,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 2,
          selected: false,
          width: 58,
          x: 132,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 3,
          selected: true,
          width: 58,
          x: 194,
          y: 38,
        },
      ],
      railFrame: { height: 24, width: 244, x: 8, y: 38 },
    });

    for (const chip of plan?.chipFrames ?? []) {
      expect(chip.x).toBeGreaterThanOrEqual(0);
      expect(chip.y).toBeGreaterThanOrEqual(baseInput.minimumY);
      expect(chip.x + chip.width).toBeLessThanOrEqual(260);
      expect(chip.y + chip.height).toBeLessThanOrEqual(200);
    }
  });

  it("uses safe minimum chip geometry at the exact fitting boundary", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      columnFrame: { height: 16, width: 92, x: -92, y: -16 },
      minimumY: -16,
      viewport: { height: 16, width: 92, x: -92, y: -16 },
    });

    expect(plan?.railFrame).toEqual({
      height: 16,
      width: 92,
      x: -92,
      y: -16,
    });
    expect(
      plan?.chipFrames.map(({ height, width }) => ({ height, width })),
    ).toEqual([
      { height: 16, width: 28 },
      { height: 16, width: 28 },
      { height: 16, width: 28 },
    ]);
  });

  it("returns deeply frozen deterministic output", () => {
    const first = planOverviewTabRail(baseInput);
    const second = planOverviewTabRail(baseInput);

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.railFrame)).toBe(true);
    expect(Object.isFrozen(first?.chipFrames)).toBe(true);
    expect(first?.chipFrames.every((chip) => Object.isFrozen(chip))).toBe(true);
  });

  it("accepts the exact coordinate bound for the reserved top lane", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      minimumY: -LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
    });

    expect(plan?.railFrame.y).toBe(88);
  });

  it.each([
    { ...baseInput, presentation: "stacked" },
    { ...baseInput, memberCount: 1, selectedIndex: 0 },
    { ...baseInput, memberCount: 257 },
    { ...baseInput, memberCount: 2.5 },
    { ...baseInput, selectedIndex: -1 },
    { ...baseInput, selectedIndex: 3 },
    { ...baseInput, selectedIndex: 1.5 },
    { ...baseInput, columnFrame: { height: 100, width: 91.99, x: 0, y: 0 } },
    { ...baseInput, columnFrame: { height: 15.99, width: 200, x: 0, y: 0 } },
    { ...baseInput, columnFrame: { height: 100, width: 200, x: 2000, y: 0 } },
    { ...baseInput, viewport: { height: 100, width: 200, x: 0, y: 2000 } },
  ])("fails closed for ineligible or too-narrow input (%o)", (input) => {
    expect(planOverviewTabRail(input)).toBeNull();
  });

  it.each([
    null,
    [],
    {},
    {
      columnFrame: baseInput.columnFrame,
      memberCount: baseInput.memberCount,
      presentation: baseInput.presentation,
      selectedIndex: baseInput.selectedIndex,
      viewport: baseInput.viewport,
    },
    { ...baseInput, minimumY: null },
    { ...baseInput, minimumY: "30" },
    { ...baseInput, minimumY: Number.NaN },
    { ...baseInput, minimumY: Number.POSITIVE_INFINITY },
    {
      ...baseInput,
      minimumY: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
    },
    {
      ...baseInput,
      minimumY: -LAYOUT_PERSISTENCE_LIMITS.numericMagnitude - 1,
    },
    { ...baseInput, columnFrame: null },
    { ...baseInput, columnFrame: { height: 100, width: 0, x: 0, y: 0 } },
    {
      ...baseInput,
      columnFrame: { height: 100, width: 100, x: Number.NaN, y: 0 },
    },
    {
      ...baseInput,
      viewport: {
        height: 100,
        width: 100,
        x: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
        y: 0,
      },
    },
  ])("rejects malformed or unbounded input (%o)", (input) => {
    expect(planOverviewTabRail(input)).toBeNull();
  });

  it("fails closed for hostile input accessors", () => {
    const hostile = Object.defineProperty({}, "columnFrame", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewTabRail(hostile)).toBeNull();
  });
});
