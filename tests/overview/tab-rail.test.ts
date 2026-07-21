import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { planOverviewTabRail } from "../../src/overview/runtime";

function windowIds(memberCount: number): readonly string[] {
  return Array.from(
    { length: memberCount },
    (_, memberIndex) => `window-${String(memberIndex)}`,
  );
}

const baseInput = Object.freeze({
  anchorIndex: 1,
  columnFrame: Object.freeze({ height: 480, width: 420, x: 120, y: 80 }),
  memberCount: 3,
  memberWindowIds: Object.freeze(windowIds(3)),
  minimumY: 30,
  presentation: "tabbed",
  selectedIndex: 1,
  viewport: Object.freeze({ height: 720, width: 1280, x: 0, y: 0 }),
});

describe("planOverviewTabRail", () => {
  it("preserves full-fit geometry while attaching exact member identity", () => {
    const plan = planOverviewTabRail(baseInput);

    expect(plan).toEqual({
      anchorIndex: 1,
      chipFrames: [
        {
          height: 24,
          memberIndex: 0,
          selected: false,
          visible: true,
          width: 120,
          windowId: "window-0",
          x: 146,
          y: 88,
        },
        {
          height: 24,
          memberIndex: 1,
          selected: true,
          visible: true,
          width: 120,
          windowId: "window-1",
          x: 270,
          y: 88,
        },
        {
          height: 24,
          memberIndex: 2,
          selected: false,
          visible: true,
          width: 120,
          windowId: "window-2",
          x: 394,
          y: 88,
        },
      ],
      firstVisibleIndex: 0,
      hiddenAfter: 0,
      hiddenBefore: 0,
      lastVisibleIndex: 2,
      railFrame: { height: 24, width: 368, x: 146, y: 88 },
      visibleCapacity: 3,
    });
    expect(baseInput.columnFrame).toEqual({
      height: 480,
      width: 420,
      x: 120,
      y: 80,
    });
    expect(baseInput.memberWindowIds).toEqual([
      "window-0",
      "window-1",
      "window-2",
    ]);
  });

  it("clips a full-fit rail to the visible column and viewport intersection", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      anchorIndex: 3,
      columnFrame: { height: 300, width: 400, x: -100, y: -20 },
      memberCount: 4,
      memberWindowIds: windowIds(4),
      selectedIndex: 3,
      viewport: { height: 200, width: 260, x: 0, y: 0 },
    });

    expect(plan).toEqual({
      anchorIndex: 3,
      chipFrames: [
        {
          height: 24,
          memberIndex: 0,
          selected: false,
          visible: true,
          width: 58,
          windowId: "window-0",
          x: 8,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 1,
          selected: false,
          visible: true,
          width: 58,
          windowId: "window-1",
          x: 70,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 2,
          selected: false,
          visible: true,
          width: 58,
          windowId: "window-2",
          x: 132,
          y: 38,
        },
        {
          height: 24,
          memberIndex: 3,
          selected: true,
          visible: true,
          width: 58,
          windowId: "window-3",
          x: 194,
          y: 38,
        },
      ],
      firstVisibleIndex: 0,
      hiddenAfter: 0,
      hiddenBefore: 0,
      lastVisibleIndex: 3,
      railFrame: { height: 24, width: 244, x: 8, y: 38 },
      visibleCapacity: 4,
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

  it("keeps one exact anchored chip visible at narrow capacity one", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      columnFrame: { height: 100, width: 28, x: 10, y: 20 },
      minimumY: 20,
      viewport: { height: 100, width: 28, x: 10, y: 20 },
    });

    expect(plan).toMatchObject({
      anchorIndex: 1,
      firstVisibleIndex: 1,
      hiddenAfter: 1,
      hiddenBefore: 1,
      lastVisibleIndex: 1,
      railFrame: { height: 24, width: 28, x: 10, y: 28 },
      visibleCapacity: 1,
    });
    expect(plan?.chipFrames.map(({ visible, x }) => ({ visible, x }))).toEqual([
      { visible: false, x: -22 },
      { visible: true, x: 10 },
      { visible: false, x: 42 },
    ]);
  });

  it.each([
    {
      anchorIndex: 4,
      firstVisibleIndex: 3,
      hiddenAfter: 3,
      hiddenBefore: 3,
      lastVisibleIndex: 6,
    },
    {
      anchorIndex: 9,
      firstVisibleIndex: 6,
      hiddenAfter: 0,
      hiddenBefore: 6,
      lastVisibleIndex: 9,
    },
  ])(
    "clamps a deterministic long-rail window around anchor $anchorIndex",
    ({
      anchorIndex,
      firstVisibleIndex,
      hiddenAfter,
      hiddenBefore,
      lastVisibleIndex,
    }) => {
      const plan = planOverviewTabRail({
        ...baseInput,
        anchorIndex,
        columnFrame: { height: 100, width: 124, x: 100, y: 20 },
        memberCount: 10,
        memberWindowIds: windowIds(10),
        minimumY: 20,
        selectedIndex: 8,
        viewport: { height: 100, width: 124, x: 100, y: 20 },
      });

      expect(plan).toMatchObject({
        anchorIndex,
        firstVisibleIndex,
        hiddenAfter,
        hiddenBefore,
        lastVisibleIndex,
        railFrame: { height: 24, width: 124, x: 100, y: 28 },
        visibleCapacity: 4,
      });
      expect(plan?.chipFrames[anchorIndex]?.visible).toBe(true);
      expect(
        plan?.chipFrames
          .filter(({ visible }) => visible)
          .map(({ memberIndex }) => memberIndex),
      ).toEqual(
        Array.from(
          { length: lastVisibleIndex - firstVisibleIndex + 1 },
          (_, offset) => firstVisibleIndex + offset,
        ),
      );
    },
  );

  it("plans all 256 exact members while bounding the visible rail", () => {
    const memberCount = LAYOUT_PERSISTENCE_LIMITS.membersPerColumn;
    const plan = planOverviewTabRail({
      ...baseInput,
      anchorIndex: 128,
      columnFrame: { height: 100, width: 156, x: 0, y: 0 },
      memberCount,
      memberWindowIds: windowIds(memberCount),
      minimumY: 0,
      selectedIndex: 255,
      viewport: { height: 100, width: 156, x: 0, y: 0 },
    });

    expect(plan).toMatchObject({
      anchorIndex: 128,
      firstVisibleIndex: 126,
      hiddenAfter: 125,
      hiddenBefore: 126,
      lastVisibleIndex: 130,
      visibleCapacity: 5,
    });
    expect(plan?.chipFrames).toHaveLength(memberCount);
    expect(plan?.chipFrames[128]).toMatchObject({
      memberIndex: 128,
      visible: true,
      windowId: "window-128",
    });
    expect(plan?.chipFrames[255]).toMatchObject({
      memberIndex: 255,
      selected: true,
      visible: false,
      windowId: "window-255",
    });
  });

  it("keeps hidden chip identities and finite logical ordering around the rail", () => {
    const plan = planOverviewTabRail({
      ...baseInput,
      anchorIndex: 3,
      columnFrame: { height: 100, width: 92, x: 200, y: 0 },
      memberCount: 7,
      memberWindowIds: windowIds(7),
      minimumY: 0,
      selectedIndex: 6,
      viewport: { height: 100, width: 92, x: 200, y: 0 },
    });

    expect(plan).toMatchObject({
      firstVisibleIndex: 2,
      hiddenAfter: 2,
      hiddenBefore: 2,
      lastVisibleIndex: 4,
      visibleCapacity: 3,
    });
    expect(
      plan?.chipFrames.map(({ memberIndex, visible, windowId }) => ({
        memberIndex,
        visible,
        windowId,
      })),
    ).toEqual(
      windowIds(7).map((windowId, memberIndex) => ({
        memberIndex,
        visible: memberIndex >= 2 && memberIndex <= 4,
        windowId,
      })),
    );

    const frames = plan?.chipFrames ?? [];

    for (let memberIndex = 1; memberIndex < frames.length; memberIndex += 1) {
      const previous = frames[memberIndex - 1];
      const current = frames[memberIndex];

      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(Number.isFinite(current?.x)).toBe(true);
      expect(current?.x).toBe((previous?.x ?? 0) + (previous?.width ?? 0) + 4);
    }

    expect((frames[1]?.x ?? 0) + (frames[1]?.width ?? 0)).toBeLessThan(
      plan?.railFrame.x ?? 0,
    );
    expect(frames[5]?.x).toBeGreaterThan(
      (plan?.railFrame.x ?? 0) + (plan?.railFrame.width ?? 0),
    );
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
    { ...baseInput, columnFrame: { height: 100, width: 27.99, x: 0, y: 0 } },
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
      anchorIndex: baseInput.anchorIndex,
      columnFrame: baseInput.columnFrame,
      memberCount: baseInput.memberCount,
      memberWindowIds: baseInput.memberWindowIds,
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
  ])("rejects malformed or unbounded scalar input (%o)", (input) => {
    expect(planOverviewTabRail(input)).toBeNull();
  });

  it.each([
    { ...baseInput, anchorIndex: undefined },
    { ...baseInput, anchorIndex: -1 },
    { ...baseInput, anchorIndex: 3 },
    { ...baseInput, anchorIndex: 1.5 },
    { ...baseInput, anchorIndex: Number.NaN },
    { ...baseInput, anchorIndex: "1" },
    { ...baseInput, memberWindowIds: null },
    { ...baseInput, memberWindowIds: [] },
    { ...baseInput, memberWindowIds: ["window-0", "window-1"] },
    { ...baseInput, memberWindowIds: ["window-0", "", "window-2"] },
    {
      ...baseInput,
      memberWindowIds: ["window-0", "x".repeat(4097), "window-2"],
    },
    {
      ...baseInput,
      memberWindowIds: ["window-0", "window-0", "window-2"],
    },
    { ...baseInput, memberWindowIds: ["window-0", 1, "window-2"] },
    { ...baseInput, memberWindowIds: new Array(3) },
  ])("rejects malformed anchor or exact member identity (%o)", (input) => {
    expect(planOverviewTabRail(input)).toBeNull();
  });

  it("fails closed when hidden logical geometry exceeds numeric bounds", () => {
    const memberCount = LAYOUT_PERSISTENCE_LIMITS.membersPerColumn;

    expect(
      planOverviewTabRail({
        ...baseInput,
        anchorIndex: 0,
        columnFrame: {
          height: 100,
          width: 28,
          x: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude - 28,
          y: 0,
        },
        memberCount,
        memberWindowIds: windowIds(memberCount),
        minimumY: 0,
        selectedIndex: 0,
        viewport: {
          height: 100,
          width: 28,
          x: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude - 28,
          y: 0,
        },
      }),
    ).toBeNull();
  });

  it("fails closed for hostile top-level input accessors", () => {
    const hostile = Object.defineProperty({}, "columnFrame", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewTabRail(hostile)).toBeNull();
  });

  it("fails closed for hostile member identity accessors", () => {
    const hostileWindowIds = [...baseInput.memberWindowIds];

    Object.defineProperty(hostileWindowIds, 1, {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewTabRail({
        ...baseInput,
        memberWindowIds: hostileWindowIds,
      }),
    ).toBeNull();
  });
});
