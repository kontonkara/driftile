import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { projectOverviewSpatialLiveGeometry } from "../../src/overview/spatial-live-geometry";

describe("projectOverviewSpatialLiveGeometry", () => {
  it("maps an exact live frame into viewport-local card coordinates", () => {
    const result = project({
      liveFrame: { height: 360, width: 640, x: -1260, y: 140 },
      outputFrame: { height: 1080, width: 1920, x: -1920, y: 40 },
      plannedColumnFrame: {
        columnId: "overview-column-1",
        columnIndex: 1,
        contentX: 652,
        width: 640,
      },
      projectionScale: 0.4,
      viewportOriginX: 18,
      viewportOriginY: 12,
    });

    expect(result).toEqual({
      columnFrame: {
        columnId: "overview-column-1",
        columnIndex: 1,
        contentX: 652,
        width: 640,
      },
      columnIndex: 1,
      frame: {
        floating: false,
        height: 144,
        width: 256,
        x: 282,
        y: 52,
      },
      memberIndex: 0,
      windowId: "window-1",
    });
  });

  it("projects every stack member through the same exact column mapping", () => {
    const frames = [
      { height: 300, width: 700, x: 220, y: 50 },
      { height: 420, width: 700, x: 220, y: 350 },
      { height: 250, width: 700, x: 220, y: 770 },
    ];
    const plans = frames.map((liveFrame, memberIndex) =>
      project({
        liveFrame,
        memberIndex,
        windowId: `window-${String(memberIndex + 1)}`,
      }),
    );

    expect(plans.map((plan) => plan?.columnFrame)).toEqual([
      plans[0]?.columnFrame,
      plans[0]?.columnFrame,
      plans[0]?.columnFrame,
    ]);
    expect(plans.map((plan) => plan?.frame)).toEqual([
      { floating: false, height: 150, width: 350, x: 110, y: 25 },
      { floating: false, height: 210, width: 350, x: 110, y: 175 },
      { floating: false, height: 125, width: 350, x: 110, y: 385 },
    ]);
  });

  it("allows a moving member to cross its planned column frame", () => {
    const result = project({
      liveFrame: { height: 700, width: 700, x: -480, y: 100 },
      plannedColumnFrame: {
        columnId: "overview-column-1",
        columnIndex: 1,
        contentX: 900,
        width: 320,
      },
    });

    expect(result?.frame).toEqual({
      floating: false,
      height: 350,
      width: 350,
      x: -240,
      y: 50,
    });
  });

  it("returns frozen copies without retaining source geometry", () => {
    const liveFrame = { height: 700, width: 700, x: 20, y: 100 };
    const plannedColumnFrame = {
      columnId: "overview-column-1",
      columnIndex: 1,
      contentX: 652,
      width: 700,
    };
    const result = project({ liveFrame, plannedColumnFrame });

    liveFrame.x = 900;
    plannedColumnFrame.width = 900;

    expect(result?.frame.x).toBe(10);
    expect(result?.columnFrame.width).toBe(700);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.frame)).toBe(true);
    expect(Object.isFrozen(result?.columnFrame)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    input({ columnIndex: -1 }),
    input({ columnIndex: LAYOUT_PERSISTENCE_LIMITS.columnsPerContext }),
    input({ memberIndex: LAYOUT_PERSISTENCE_LIMITS.membersPerColumn }),
    input({ windowId: "" }),
    input({ projectionScale: 0 }),
    input({ viewportOriginX: Number.NaN }),
    input({ liveFrame: { height: 700, width: 0, x: 0, y: 0 } }),
    input({ outputFrame: { height: 1080, width: 0, x: 0, y: 0 } }),
    input({
      plannedColumnFrame: {
        columnId: "overview-column-0",
        columnIndex: 1,
        contentX: 652,
        width: 700,
      },
    }),
    input({
      plannedColumnFrame: {
        columnId: "overview-column-1",
        columnIndex: 2,
        contentX: 652,
        width: 700,
      },
    }),
    input({ liveFrame: { height: 40, width: 40, x: 0, y: 4_000 } }),
  ])("fails closed for malformed or unrelated input (%o)", (candidate) => {
    expect(projectOverviewSpatialLiveGeometry(candidate)).toBeNull();
  });

  it("fails closed when an input accessor throws", () => {
    const hostile = Object.defineProperty({}, "liveFrame", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(projectOverviewSpatialLiveGeometry(hostile)).toBeNull();
  });
});

function project(overrides: Record<string, unknown> = {}) {
  return projectOverviewSpatialLiveGeometry(input(overrides));
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    columnIndex: 1,
    liveFrame: { height: 700, width: 700, x: 20, y: 100 },
    memberIndex: 0,
    outputFrame: { height: 1080, width: 1920, x: 0, y: 0 },
    plannedColumnFrame: {
      columnId: "overview-column-1",
      columnIndex: 1,
      contentX: 652,
      width: 700,
    },
    projectionScale: 0.5,
    viewportOriginX: 0,
    viewportOriginY: 0,
    windowId: "window-1",
    ...overrides,
  };
}
