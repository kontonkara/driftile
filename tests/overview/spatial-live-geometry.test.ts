import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  aggregateOverviewSpatialLiveColumnGeometry,
  projectOverviewSpatialLiveGeometry,
} from "../../src/overview/spatial-live-geometry";

describe("projectOverviewSpatialLiveGeometry", () => {
  it("maps an exact live frame into viewport-local card coordinates", () => {
    const result = project({
      liveHeight: 360,
      liveWidth: 640,
      liveX: -1260,
      liveY: 140,
      outputHeight: 1080,
      outputWidth: 1920,
      outputX: -1920,
      outputY: 40,
      projectionScale: 0.4,
      viewportOriginX: 18,
      viewportOriginY: 12,
    });

    expect(result).toEqual({
      columnIndex: 1,
      floating: false,
      height: 144,
      memberIndex: 0,
      width: 256,
      windowId: "window-1",
      x: 282,
      y: 52,
    });
  });

  it("projects every stack member through one flat plan", () => {
    const frames = [
      { liveHeight: 300, liveWidth: 700, liveX: 220, liveY: 50 },
      { liveHeight: 420, liveWidth: 700, liveX: 220, liveY: 350 },
      { liveHeight: 250, liveWidth: 700, liveX: 220, liveY: 770 },
    ];
    const plans = frames.map((frame, memberIndex) =>
      project({
        ...frame,
        memberIndex,
        windowId: `window-${String(memberIndex + 1)}`,
      }),
    );

    expect(plans).toEqual([
      {
        columnIndex: 1,
        floating: false,
        height: 150,
        memberIndex: 0,
        width: 350,
        windowId: "window-1",
        x: 110,
        y: 25,
      },
      {
        columnIndex: 1,
        floating: false,
        height: 210,
        memberIndex: 1,
        width: 350,
        windowId: "window-2",
        x: 110,
        y: 175,
      },
      {
        columnIndex: 1,
        floating: false,
        height: 125,
        memberIndex: 2,
        width: 350,
        windowId: "window-3",
        x: 110,
        y: 385,
      },
    ]);
  });

  it("allows a moving member to cross its planned column frame", () => {
    const result = project({
      liveHeight: 700,
      liveWidth: 700,
      liveX: -480,
      liveY: 100,
    });

    expect(result).toEqual({
      columnIndex: 1,
      floating: false,
      height: 350,
      memberIndex: 0,
      width: 350,
      windowId: "window-1",
      x: -240,
      y: 50,
    });
  });

  it("returns one frozen plan containing only primitive values", () => {
    const candidate = input();
    const result = projectOverviewSpatialLiveGeometry(candidate);

    candidate.liveX = 900;

    expect(result?.x).toBe(10);
    expect(result?.width).toBe(350);
    expect(Object.isFrozen(result)).toBe(true);
    expect(
      Object.values(result ?? {}).every((value) => typeof value !== "object"),
    ).toBe(true);
    expect(result).not.toHaveProperty("frame");
    expect(result).not.toHaveProperty("columnFrame");
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
    input({ liveWidth: 0 }),
    input({ outputWidth: 0 }),
    input({ liveHeight: 40, liveWidth: 40, liveX: 0, liveY: 4_000 }),
  ])("fails closed for malformed or unrelated input (%o)", (candidate) => {
    expect(projectOverviewSpatialLiveGeometry(candidate)).toBeNull();
  });

  it("fails closed when an input accessor throws", () => {
    const hostile = Object.defineProperty({}, "liveX", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(projectOverviewSpatialLiveGeometry(hostile)).toBeNull();
  });
});

describe("aggregateOverviewSpatialLiveColumnGeometry", () => {
  it("derives one frozen primitive column frame from every live member", () => {
    const samples = [
      project({ memberIndex: 1, windowId: "window-2" }),
      project({ memberIndex: 0, windowId: "window-1" }),
    ];

    const result = aggregateOverviewSpatialLiveColumnGeometry({
      columnIndex: 1,
      memberCount: 2,
      samples,
    });

    expect(result).toEqual({
      columnIndex: 1,
      memberFrames: [
        project({ memberIndex: 0, windowId: "window-1" }),
        project({ memberIndex: 1, windowId: "window-2" }),
      ],
      width: 350,
      x: 10,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.memberFrames)).toBe(true);
    expect(
      result?.memberFrames.every(
        (frame) =>
          frame !== null &&
          Object.isFrozen(frame) &&
          Object.values(frame).every((value) => typeof value !== "object"),
      ),
    ).toBe(true);
    expect(result?.memberFrames[0]).not.toBe(samples[1]);
    expect(result?.memberFrames[1]).not.toBe(samples[0]);
  });

  it("derives a tabbed column from only its selected live member", () => {
    const selected = project({
      memberIndex: 1,
      windowId: "window-2",
      liveHeight: 840,
      liveWidth: 920,
      liveX: -120,
      liveY: 80,
    });

    const result = aggregateOverviewSpatialLiveColumnGeometry({
      columnIndex: 1,
      memberCount: 3,
      presentation: "tabbed",
      samples: [selected],
      selectedMemberIndex: 1,
    });

    expect(result).toEqual({
      columnIndex: 1,
      memberFrames: [null, selected, null],
      selectedMemberIndex: 1,
      width: 460,
      x: -60,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.memberFrames)).toBe(true);
    expect(Object.isFrozen(result?.memberFrames[1])).toBe(true);
    expect(result?.memberFrames[1]).not.toBe(selected);
  });

  it.each([
    {
      memberCount: 3,
      presentation: "tabbed",
      samples: [],
      selectedMemberIndex: 1,
    },
    {
      memberCount: 3,
      presentation: "tabbed",
      samples: [project(), project({ memberIndex: 1, windowId: "window-2" })],
      selectedMemberIndex: 1,
    },
    {
      memberCount: 3,
      presentation: "tabbed",
      samples: [project()],
      selectedMemberIndex: 1,
    },
    {
      memberCount: 3,
      presentation: "tabbed",
      samples: [project()],
      selectedMemberIndex: 3,
    },
    {
      memberCount: 1,
      presentation: "unknown",
      samples: [project()],
      selectedMemberIndex: 0,
    },
  ])("fails closed for an ambiguous tabbed column (%o)", (candidate) => {
    expect(
      aggregateOverviewSpatialLiveColumnGeometry({
        columnIndex: 1,
        ...candidate,
      }),
    ).toBeNull();
  });

  it.each([
    { memberCount: 2, samples: [project()] },
    {
      memberCount: 2,
      samples: [project(), project({ windowId: "window-2" })],
    },
    {
      memberCount: 2,
      samples: [
        project(),
        project({ memberIndex: 1, windowId: "window-2", liveX: 24 }),
      ],
    },
    {
      memberCount: 2,
      samples: [
        project(),
        project({ memberIndex: 1, windowId: "window-2", liveWidth: 702 }),
      ],
    },
  ])("fails closed for a partial or inconsistent column (%o)", (candidate) => {
    expect(
      aggregateOverviewSpatialLiveColumnGeometry({
        columnIndex: 1,
        ...candidate,
      }),
    ).toBeNull();
  });

  it("fails closed when a sample accessor throws", () => {
    const hostile = Object.defineProperty({}, "columnIndex", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      aggregateOverviewSpatialLiveColumnGeometry({
        columnIndex: 1,
        memberCount: 1,
        samples: [hostile],
      }),
    ).toBeNull();
  });

  it("snapshots each sample scalar once", () => {
    const sample = project();
    let memberIndexReads = 0;
    const changing = Object.defineProperty({ ...sample }, "memberIndex", {
      get(): number {
        memberIndexReads += 1;
        return memberIndexReads === 1 ? 0 : 4_000;
      },
    });

    expect(
      aggregateOverviewSpatialLiveColumnGeometry({
        columnIndex: 1,
        memberCount: 1,
        samples: [changing],
      }),
    ).toEqual({
      columnIndex: 1,
      memberFrames: [project()],
      width: 350,
      x: 10,
    });
    expect(memberIndexReads).toBe(1);
  });
});

function project(overrides: Record<string, unknown> = {}) {
  return projectOverviewSpatialLiveGeometry(input(overrides));
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    columnIndex: 1,
    liveHeight: 700,
    liveWidth: 700,
    liveX: 20,
    liveY: 100,
    memberIndex: 0,
    outputHeight: 1080,
    outputWidth: 1920,
    outputX: 0,
    outputY: 0,
    projectionScale: 0.5,
    viewportOriginX: 0,
    viewportOriginY: 0,
    windowId: "window-1",
    ...overrides,
  };
}
