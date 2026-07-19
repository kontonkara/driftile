import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { planOverviewSpatialLayout } from "../../src/overview/runtime";

describe("planOverviewSpatialLayout", () => {
  it("plans one centered workspace row across the full scene", () => {
    const plan = planOverviewSpatialLayout({
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 1,
      zoom: 0.5,
    });

    expect(plan).toMatchObject({
      cardHeight: 450,
      cardWidth: 1600,
      cardX: 0,
      contentHeight: 900,
      edgeMargin: 225,
      gap: 45,
      initialContentY: 0,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("centers each current workspace within the bounded scroll range", () => {
    const expectedStride = 270 + 27;
    const expectedContentHeight = 900 + 3 * expectedStride;

    for (
      let currentWorkspaceIndex = 0;
      currentWorkspaceIndex < 4;
      currentWorkspaceIndex += 1
    ) {
      const plan = planOverviewSpatialLayout({
        currentWorkspaceIndex,
        sceneHeight: 900,
        sceneWidth: 1600,
        workspaceCount: 4,
        zoom: 0.3,
      });

      expect(plan?.cardWidth).toBe(1600);
      expect(plan?.cardHeight).toBe(270);
      expect(plan?.cardX).toBe(0);
      expect(plan?.edgeMargin).toBe(315);
      expect(plan?.gap).toBe(27);
      expect(plan?.contentHeight).toBeCloseTo(expectedContentHeight);
      expect(plan?.initialContentY).toBeCloseTo(
        currentWorkspaceIndex * expectedStride,
      );
      expect(
        (plan?.edgeMargin ?? Number.NaN) +
          currentWorkspaceIndex * expectedStride -
          (plan?.initialContentY ?? Number.NaN),
      ).toBe(plan?.edgeMargin);
    }
  });

  it("spans small and large scenes without horizontal insets", () => {
    const small = planOverviewSpatialLayout({
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 80,
      workspaceCount: 1,
      zoom: 0.5,
    });
    const large = planOverviewSpatialLayout({
      currentWorkspaceIndex: 0,
      sceneHeight: 2160,
      sceneWidth: 3840,
      workspaceCount: 1,
      zoom: 0.75,
    });

    expect(small?.cardX).toBe(0);
    expect(small?.cardWidth).toBe(80);
    expect(large?.cardX).toBe(0);
    expect(large?.cardWidth).toBe(3840);
    expect(Object.isFrozen(small)).toBe(true);
    expect(Object.isFrozen(large)).toBe(true);
  });

  it("caps the logical card gap without allocating workspace geometry", () => {
    const plan = planOverviewSpatialLayout({
      currentWorkspaceIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
      sceneHeight: 2160,
      sceneWidth: 3840,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts,
      zoom: 0.75,
    });

    expect(plan?.gap).toBe(48);
    expect(plan?.contentHeight).toBe(
      2160 + (LAYOUT_PERSISTENCE_LIMITS.contexts - 1) * ((2160 * 3) / 4 + 48),
    );
    expect(plan?.initialContentY).toBe((plan?.contentHeight ?? 0) - 2160);
    expect(Object.keys(plan ?? {})).toHaveLength(7);
  });

  it.each([
    null,
    [],
    {},
    {
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 0,
      workspaceCount: 1,
      zoom: 0.5,
    },
    {
      currentWorkspaceIndex: 0,
      sceneHeight: Number.POSITIVE_INFINITY,
      sceneWidth: 1600,
      workspaceCount: 1,
      zoom: 0.5,
    },
    {
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 0,
      zoom: 0.5,
    },
    {
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
      zoom: 0.5,
    },
    {
      currentWorkspaceIndex: 1,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 1,
      zoom: 0.5,
    },
    {
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 1,
      zoom: 0.199,
    },
    {
      currentWorkspaceIndex: 0,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 1,
      zoom: 0.751,
    },
    {
      currentWorkspaceIndex: 1,
      sceneHeight: Number.MAX_VALUE,
      sceneWidth: Number.MAX_VALUE,
      workspaceCount: 2,
      zoom: 0.75,
    },
  ])("rejects malformed or overflowing input (%o)", (input) => {
    expect(planOverviewSpatialLayout(input)).toBeNull();
  });

  it("fails closed for hostile input accessors", () => {
    const hostile = Object.defineProperty({}, "sceneWidth", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialLayout(hostile)).toBeNull();
  });
});
