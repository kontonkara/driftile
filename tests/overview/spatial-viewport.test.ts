import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  planOverviewSpatialViewportAnchor,
  planOverviewSpatialViewport,
  planOverviewSpatialWorkspaceCenter,
  planOverviewSpatialWorkspaceSettle,
} from "../../src/overview/spatial-viewport";

const previousLayout = Object.freeze({
  cardHeight: 450,
  contentHeight: 1896,
  edgeMargin: 225,
  gap: 48,
});

const nextLayout = Object.freeze({
  cardHeight: 600,
  contentHeight: 3144,
  edgeMargin: 300,
  gap: 48,
});

describe("planOverviewSpatialViewport", () => {
  it.each([
    [-400, 0],
    [-0, 0],
    [0, 0],
    [450, 450],
    [900, 900],
    [1_200, 900],
  ])("clamps content y %o to %o", (contentY, expectedContentY) => {
    const plan = planOverviewSpatialViewport({
      contentHeight: 1800,
      contentY,
      sceneHeight: 900,
    });

    expect(plan).toEqual({
      contentY: expectedContentY,
      maximumContentY: 900,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("keeps a scene-sized viewport fixed at zero", () => {
    expect(
      planOverviewSpatialViewport({
        contentHeight: 900,
        contentY: 600,
        sceneHeight: 900,
      }),
    ).toEqual({ contentY: 0, maximumContentY: 0 });
  });

  it.each([
    null,
    [],
    {},
    { contentHeight: 1800, contentY: 0, sceneHeight: 0 },
    { contentHeight: 899, contentY: 0, sceneHeight: 900 },
    { contentHeight: Number.POSITIVE_INFINITY, contentY: 0, sceneHeight: 900 },
    { contentHeight: 1800, contentY: Number.NaN, sceneHeight: 900 },
  ])("rejects malformed viewport input (%o)", (input) => {
    expect(planOverviewSpatialViewport(input)).toBeNull();
  });
});

describe("planOverviewSpatialWorkspaceCenter", () => {
  it("centers every workspace by its card stride", () => {
    const stride = 270 + 32.4;
    const contentHeight = 900 + 3 * stride;

    for (let workspaceIndex = 0; workspaceIndex < 4; workspaceIndex += 1) {
      const plan = planOverviewSpatialWorkspaceCenter({
        cardHeight: 270,
        contentHeight,
        gap: 32.4,
        sceneHeight: 900,
        workspaceCount: 4,
        workspaceIndex,
      });

      expect(plan?.contentY).toBeCloseTo(workspaceIndex * stride);
      expect(plan?.maximumContentY).toBeCloseTo(3 * stride);
      expect(Object.isFrozen(plan)).toBe(true);
    }
  });

  it("clamps a valid workspace target to the available content range", () => {
    expect(
      planOverviewSpatialWorkspaceCenter({
        cardHeight: 450,
        contentHeight: 1200,
        gap: 48,
        sceneHeight: 900,
        workspaceCount: 4,
        workspaceIndex: 3,
      }),
    ).toEqual({ contentY: 300, maximumContentY: 300 });
  });

  it("accepts the persistence workspace limit without scanning it", () => {
    const workspaceCount = LAYOUT_PERSISTENCE_LIMITS.contexts;
    const stride = 128;
    const maximumContentY = (workspaceCount - 1) * stride;

    expect(
      planOverviewSpatialWorkspaceCenter({
        cardHeight: 128,
        contentHeight: 720 + maximumContentY,
        gap: 0,
        sceneHeight: 720,
        workspaceCount,
        workspaceIndex: workspaceCount - 1,
      }),
    ).toEqual({ contentY: maximumContentY, maximumContentY });
  });

  it.each([
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: 0,
      workspaceIndex: 0,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
      workspaceIndex: 0,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: 48,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 2,
    },
    {
      cardHeight: 450,
      contentHeight: 1800,
      gap: -1,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 1,
    },
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      gap: Number.MAX_VALUE,
      sceneHeight: 900,
      workspaceCount: 2,
      workspaceIndex: 1,
    },
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      gap: 0,
      sceneHeight: 900,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts,
      workspaceIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
    },
  ])("rejects malformed or overflowing center input (%o)", (input) => {
    expect(planOverviewSpatialWorkspaceCenter(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "contentHeight", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialViewport(hostile)).toBeNull();
    expect(planOverviewSpatialWorkspaceCenter(hostile)).toBeNull();
  });
});

describe("planOverviewSpatialWorkspaceSettle", () => {
  const sceneHeight = 900;
  const cardHeight = 270;
  const gap = 32.4;
  const workspaceCount = 4;
  const stride = cardHeight + gap;
  const maximumContentY = (workspaceCount - 1) * stride;
  const contentHeight = sceneHeight + maximumContentY;

  it.each([
    [0, 0],
    [stride * 0.5 - 0.001, 0],
    [stride * 0.5, 1],
    [stride * 1.49, 1],
    [stride * 1.5, 2],
    [stride * 2.5, 3],
    [maximumContentY, 3],
  ])(
    "settles content y %o on workspace %o",
    (contentY, expectedTargetIndex) => {
      const plan = planOverviewSpatialWorkspaceSettle({
        cardHeight,
        contentHeight,
        contentY,
        gap,
        sceneHeight,
        workspaceCount,
      });

      expect(plan?.targetIndex).toBe(expectedTargetIndex);
      expect(plan?.contentY).toBeCloseTo(expectedTargetIndex * stride);
      expect(plan?.maximumContentY).toBeCloseTo(maximumContentY);
      expect(Object.isFrozen(plan)).toBe(true);
    },
  );

  it("keeps a single workspace centered at zero", () => {
    expect(
      planOverviewSpatialWorkspaceSettle({
        cardHeight: 450,
        contentHeight: 900,
        contentY: 0,
        gap: 48,
        sceneHeight: 900,
        workspaceCount: 1,
      }),
    ).toEqual({ targetIndex: 0, contentY: 0, maximumContentY: 0 });
  });

  it("accepts the bounded workspace limit with constant-time selection", () => {
    const boundedWorkspaceCount = LAYOUT_PERSISTENCE_LIMITS.contexts;
    const boundedStride = 128;
    const boundedMaximumContentY = (boundedWorkspaceCount - 1) * boundedStride;

    expect(
      planOverviewSpatialWorkspaceSettle({
        cardHeight: boundedStride,
        contentHeight: 720 + boundedMaximumContentY,
        contentY: boundedMaximumContentY - boundedStride * 0.49,
        gap: 0,
        sceneHeight: 720,
        workspaceCount: boundedWorkspaceCount,
      }),
    ).toEqual({
      targetIndex: boundedWorkspaceCount - 1,
      contentY: boundedMaximumContentY,
      maximumContentY: boundedMaximumContentY,
    });
  });

  it.each([
    null,
    [],
    {},
    {
      cardHeight,
      contentHeight,
      contentY: -1,
      gap,
      sceneHeight,
      workspaceCount,
    },
    {
      cardHeight,
      contentHeight,
      contentY: maximumContentY + 1,
      gap,
      sceneHeight,
      workspaceCount,
    },
    {
      cardHeight,
      contentHeight: contentHeight + 1,
      contentY: 0,
      gap,
      sceneHeight,
      workspaceCount,
    },
    {
      cardHeight: sceneHeight + 1,
      contentHeight,
      contentY: 0,
      gap,
      sceneHeight,
      workspaceCount,
    },
    {
      cardHeight,
      contentHeight,
      contentY: 0,
      gap,
      sceneHeight,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
    },
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      contentY: 0,
      gap: Number.MAX_VALUE,
      sceneHeight: Number.MAX_VALUE,
      workspaceCount: 2,
    },
    {
      cardHeight,
      contentHeight,
      contentY: Number.NaN,
      gap,
      sceneHeight,
      workspaceCount,
    },
  ])("rejects malformed or inconsistent settle input (%o)", (input) => {
    expect(planOverviewSpatialWorkspaceSettle(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "contentY", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialWorkspaceSettle(hostile)).toBeNull();
  });
});

describe("planOverviewSpatialViewportAnchor", () => {
  it("preserves the centered workspace identity and local stride offset", () => {
    const plan = planOverviewSpatialViewportAnchor({
      nextDesktopIds: ["desktop-3", "desktop-1", "desktop-2", "desktop-4"],
      nextLayout,
      nextSceneHeight: 1200,
      previousContentY: 498 * 1.25,
      previousDesktopIds: ["desktop-1", "desktop-2", "desktop-3"],
      previousLayout,
      previousSceneHeight: 900,
    });

    expect(plan).toEqual({
      anchorDesktopId: "desktop-2",
      anchorOffsetFraction: 0.25,
      anchorWorkspaceIndex: 2,
      contentY: 648 * 2.25,
      maximumContentY: 1944,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("falls back to the nearest valid ordinal when the anchor disappears", () => {
    const plan = planOverviewSpatialViewportAnchor({
      nextDesktopIds: ["desktop-1", "desktop-3"],
      nextLayout: {
        ...nextLayout,
        contentHeight: 1848,
      },
      nextSceneHeight: 1200,
      previousContentY: 498 * 0.8,
      previousDesktopIds: ["desktop-1", "desktop-2", "desktop-3"],
      previousLayout,
      previousSceneHeight: 900,
    });

    expect(plan).toMatchObject({
      anchorDesktopId: "desktop-3",
      anchorWorkspaceIndex: 1,
      maximumContentY: 648,
    });
    expect(plan?.anchorOffsetFraction).toBeCloseTo(-0.2);
    expect(plan?.contentY).toBeCloseTo(648 * 0.8);
  });

  it("clamps a removed trailing anchor and the resulting viewport", () => {
    const plan = planOverviewSpatialViewportAnchor({
      nextDesktopIds: ["desktop-1"],
      nextLayout: {
        cardHeight: 600,
        contentHeight: 1200,
        edgeMargin: 300,
        gap: 48,
      },
      nextSceneHeight: 1200,
      previousContentY: 996,
      previousDesktopIds: ["desktop-1", "desktop-2", "desktop-3"],
      previousLayout,
      previousSceneHeight: 900,
    });

    expect(plan).toEqual({
      anchorDesktopId: "desktop-1",
      anchorOffsetFraction: 0,
      anchorWorkspaceIndex: 0,
      contentY: 0,
      maximumContentY: 0,
    });
  });

  it("keeps center-boundary selection deterministic", () => {
    const plan = planOverviewSpatialViewportAnchor({
      nextDesktopIds: ["desktop-1", "desktop-2", "desktop-3"],
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: 498 * 0.5,
      previousDesktopIds: ["desktop-1", "desktop-2", "desktop-3"],
      previousLayout,
      previousSceneHeight: 900,
    });

    expect(plan).toMatchObject({
      anchorDesktopId: "desktop-2",
      anchorOffsetFraction: -0.5,
      anchorWorkspaceIndex: 1,
      contentY: 249,
    });
  });

  it("accepts bounded desktop lists without retaining them", () => {
    const desktopIds = Array.from(
      { length: LAYOUT_PERSISTENCE_LIMITS.contexts },
      (_, index) => `desktop-${String(index)}`,
    );
    const stride = 128;
    const sceneHeight = 720;
    const layout = {
      cardHeight: 128,
      contentHeight: sceneHeight + (desktopIds.length - 1) * stride,
      edgeMargin: (sceneHeight - 128) / 2,
      gap: 0,
    };

    expect(
      planOverviewSpatialViewportAnchor({
        nextDesktopIds: [...desktopIds].reverse(),
        nextLayout: layout,
        nextSceneHeight: sceneHeight,
        previousContentY: 255 * stride,
        previousDesktopIds: desktopIds,
        previousLayout: layout,
        previousSceneHeight: sceneHeight,
      }),
    ).toMatchObject({
      anchorDesktopId: "desktop-255",
      anchorOffsetFraction: 0,
      anchorWorkspaceIndex: desktopIds.length - 1 - 255,
    });
  });

  it.each([
    {},
    {
      nextDesktopIds: ["desktop-1"],
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: [],
      previousLayout,
      previousSceneHeight: 900,
    },
    {
      nextDesktopIds: ["desktop-1", "desktop-1"],
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    },
    {
      nextDesktopIds: Array.from(
        { length: LAYOUT_PERSISTENCE_LIMITS.contexts + 1 },
        (_, index) => `desktop-${String(index)}`,
      ),
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    },
    {
      nextDesktopIds: ["desktop-1"],
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: Number.POSITIVE_INFINITY,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    },
    {
      nextDesktopIds: ["desktop-1"],
      nextLayout: { ...previousLayout, edgeMargin: Number.NaN },
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    },
    {
      nextDesktopIds: ["desktop-1"],
      nextLayout: {
        cardHeight: 450,
        contentHeight: 900,
        edgeMargin: 600,
        gap: 48,
      },
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    },
  ])("rejects malformed anchor input (%o)", (input) => {
    expect(planOverviewSpatialViewportAnchor(input)).toBeNull();
  });

  it("fails closed for hostile nested accessors", () => {
    const hostileLayout = Object.defineProperty({}, "cardHeight", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    const hostileIds = new Proxy(["desktop-1"], {
      get(target, property, receiver): unknown {
        if (property === "0") {
          throw new Error("unavailable");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const baseInput = {
      nextDesktopIds: ["desktop-1"],
      nextLayout: previousLayout,
      nextSceneHeight: 900,
      previousContentY: 0,
      previousDesktopIds: ["desktop-1"],
      previousLayout,
      previousSceneHeight: 900,
    };

    expect(
      planOverviewSpatialViewportAnchor({
        ...baseInput,
        previousLayout: hostileLayout,
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialViewportAnchor({
        ...baseInput,
        previousDesktopIds: hostileIds,
      }),
    ).toBeNull();
  });
});
