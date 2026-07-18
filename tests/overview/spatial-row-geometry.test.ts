import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  planOverviewSpatialLiveCamera,
  planOverviewSpatialRowGeometry,
} from "../../src/overview/runtime";

const thirds = [
  { width: { kind: "proportion", value: 1 / 3 } },
  { width: { kind: "proportion", value: 1 / 3 } },
  { width: { kind: "proportion", value: 1 / 3 } },
] as const;

describe("planOverviewSpatialRowGeometry", () => {
  it("uses the core strip geometry for thirds and outer gaps", () => {
    const result = plan({ activeColumnIndex: 1, columns: thirds });

    expect(result).toMatchObject({
      camera: { base: 0, maximum: 0, minimum: 0 },
      columnFrames: [
        {
          columnId: "overview-column-0",
          columnIndex: 0,
          contentX: 12,
          width: 384,
        },
        {
          columnId: "overview-column-1",
          columnIndex: 1,
          contentX: 408,
          width: 384,
        },
        {
          columnId: "overview-column-2",
          columnIndex: 2,
          contentX: 804,
          width: 384,
        },
      ],
      contentWidth: 1200,
      dimensions: {
        devicePixelRatio: 1,
        outputHeight: 900,
        outputWidth: 1200,
        viewportHeight: 900,
        viewportInsetX: 0,
        viewportInsetY: 0,
        viewportWidth: 1200,
      },
    });
  });

  it("keeps an inset work area in output-local dimensions", () => {
    const result = plan({
      activeColumnIndex: 0,
      columns: [{ width: { kind: "proportion", value: 0.5 } }],
      gap: 20,
      outputGeometry: { height: 900, width: 1600, x: 100, y: 50 },
      workArea: { height: 820, width: 1500, x: 132, y: 94 },
    });

    expect(result).toMatchObject({
      columnFrames: [{ columnIndex: 0, contentX: 20, width: 720 }],
      contentWidth: 760,
      dimensions: {
        devicePixelRatio: 1,
        outputHeight: 900,
        outputWidth: 1600,
        viewportHeight: 820,
        viewportInsetX: 32,
        viewportInsetY: 44,
        viewportWidth: 1500,
      },
    });
  });

  it("preserves physical-pixel column edges with fractional DPR and gap", () => {
    const outputGeometry = { height: 800, width: 1000, x: -100, y: 25 };
    const workArea = { height: 700, width: 900, x: -80, y: 45 };
    const devicePixelRatio = 1.25;
    const result = plan({
      activeColumnIndex: 1,
      columns: [
        { width: { kind: "fixed", value: 333.3 } },
        { width: { kind: "fixed", value: 333.3 } },
      ],
      devicePixelRatio,
      gap: 13.2,
      outputGeometry,
      workArea,
    });

    expect(result).not.toBeNull();
    expect(result?.dimensions.devicePixelRatio).toBe(devicePixelRatio);
    for (const frame of result?.columnFrames ?? []) {
      const presentedLeft = workArea.x + frame.contentX;
      const presentedRight = presentedLeft + frame.width;

      expect((presentedLeft - outputGeometry.x) * devicePixelRatio).toBeCloseTo(
        Math.round((presentedLeft - outputGeometry.x) * devicePixelRatio),
        10,
      );
      expect(
        (presentedRight - outputGeometry.x) * devicePixelRatio,
      ).toBeCloseTo(
        Math.round((presentedRight - outputGeometry.x) * devicePixelRatio),
        10,
      );
    }
  });

  it("separates the live camera from stable strip content coordinates", () => {
    const result = plan({
      activeColumnIndex: 1,
      columns: [
        { width: { kind: "proportion", value: 0.5 } },
        { width: { kind: "proportion", value: 0.5 } },
        { width: { kind: "proportion", value: 0.5 } },
      ],
      viewportOffset: 250,
    });

    expect(result?.camera).toEqual({
      base: 250,
      maximum: 594,
      minimum: 0,
    });
    expect(result?.columnFrames).toEqual([
      {
        columnId: "overview-column-0",
        columnIndex: 0,
        contentX: 12,
        width: 582,
      },
      {
        columnId: "overview-column-1",
        columnIndex: 1,
        contentX: 606,
        width: 582,
      },
      {
        columnId: "overview-column-2",
        columnIndex: 2,
        contentX: 1200,
        width: 582,
      },
    ]);
    expect(
      (result?.columnFrames[1]?.contentX ?? 0) - (result?.camera.base ?? 0),
    ).toBe(356);
  });

  it("locks the camera to a centered singleton when requested", () => {
    const result = plan({
      activeColumnIndex: 0,
      alwaysCenterSingleColumn: true,
      columns: [{ width: { kind: "fixed", value: 300 } }],
    });

    expect(result?.camera).toEqual({
      base: -438,
      maximum: -438,
      minimum: -438,
    });
    expect(result?.columnFrames).toEqual([
      {
        columnId: "overview-column-0",
        columnIndex: 0,
        contentX: 12,
        width: 300,
      },
    ]);
    expect(
      (result?.columnFrames[0]?.contentX ?? 0) - (result?.camera.base ?? 0),
    ).toBe(450);
  });

  it("keeps an empty workspace as a bounded zero-width row", () => {
    const result = plan({ activeColumnIndex: null, columns: [] });

    expect(result).toMatchObject({
      camera: { base: 0, maximum: 0, minimum: 0 },
      columnFrames: [],
      contentWidth: 0,
      dimensions: { viewportHeight: 900, viewportWidth: 1200 },
    });
  });

  it.each([
    { maximum: 0, minimum: -100, viewportOffset: -100 },
    { maximum: 100, minimum: 0, viewportOffset: 100 },
  ])(
    "preserves a valid row without an active column at camera $viewportOffset",
    ({ maximum, minimum, viewportOffset }) => {
      const result = plan({
        activeColumnIndex: null,
        columns: [{ width: { kind: "fixed", value: 300 } }],
        viewportOffset,
      });

      expect(result?.camera).toEqual({
        base: viewportOffset,
        maximum,
        minimum,
      });
      expect(result?.columnFrames).toEqual([
        {
          columnId: "overview-column-0",
          columnIndex: 0,
          contentX: 12,
          width: 300,
        },
      ]);
    },
  );

  it("keeps full-width neighboring columns reachable within camera bounds", () => {
    const successor = plan({
      activeColumnIndex: 0,
      columns: [
        { width: { kind: "proportion", value: 1 / 3 } },
        { width: { kind: "proportion", value: 1 } },
      ],
    });
    const afterFullWidth = plan({
      activeColumnIndex: 0,
      columns: [
        { width: { kind: "proportion", value: 1 } },
        { width: { kind: "proportion", value: 1 / 3 } },
      ],
    });

    const successorFrame = successor?.columnFrames[1];
    expect(successor?.camera.maximum).toBe(396);
    expect(successorFrame?.contentX).toBe(408);
    expect(successorFrame?.contentX ?? 1200).toBeLessThan(1200);
    expect(
      (successorFrame?.contentX ?? 0) + (successorFrame?.width ?? 0),
    ).toBeGreaterThan(1200);

    const followingFrame = afterFullWidth?.columnFrames[1];
    expect(afterFullWidth?.camera.maximum).toBe(396);
    expect(followingFrame?.contentX).toBe(1212);
    expect(
      (followingFrame?.contentX ?? 0) - (afterFullWidth?.camera.maximum ?? 0),
    ).toBeLessThan(1200);
  });

  it("returns deeply frozen plans without retaining input objects", () => {
    const width = { kind: "fixed" as const, value: 400 };
    const input = baseInput({
      activeColumnIndex: 0,
      columns: [{ width }],
    });
    const result = planOverviewSpatialRowGeometry(input);

    width.value = 700;

    expect(result?.columnFrames[0]?.width).toBe(400);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.camera)).toBe(true);
    expect(Object.isFrozen(result?.columnFrames)).toBe(true);
    expect(Object.isFrozen(result?.columnFrames[0])).toBe(true);
    expect(Object.isFrozen(result?.dimensions)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    baseInput({ activeColumnIndex: 3, columns: thirds }),
    baseInput({ alwaysCenterSingleColumn: "true" }),
    baseInput({ columns: [{ width: { kind: "unknown", value: 1 } }] }),
    baseInput({ columns: [{ width: { kind: "fixed", value: 0 } }] }),
    baseInput({ devicePixelRatio: 0 }),
    baseInput({ gap: -1 }),
    baseInput({ viewportOffset: Number.NaN }),
    baseInput({
      outputGeometry: { height: 900, width: 1200, x: 0, y: 0 },
      workArea: { height: 900, width: 1200, x: 1, y: 0 },
    }),
    baseInput({
      activeColumnIndex: 0,
      columns: Array.from(
        { length: LAYOUT_PERSISTENCE_LIMITS.columnsPerContext + 1 },
        () => ({ width: { kind: "fixed", value: 10 } }),
      ),
    }),
  ])("fails closed for malformed or oversized input (%o)", (input) => {
    expect(planOverviewSpatialRowGeometry(input)).toBeNull();
  });

  it("fails closed when an input accessor throws", () => {
    const hostile = Object.defineProperty({}, "columns", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialRowGeometry(hostile)).toBeNull();
  });
});

describe("planOverviewSpatialLiveCamera", () => {
  it("infers an exact bounded viewport from the live active column", () => {
    const result = planLiveCamera({
      camera: { maximum: 400, minimum: 0 },
      columnFrame: { contentX: 420, width: 400 },
      liveFrame: { width: 400, x: 270 },
      workAreaX: 100,
    });

    expect(result).toEqual({ viewportOffset: 250 });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("snaps inferred offsets to a fractional-DPR physical pixel", () => {
    const result = planLiveCamera({
      camera: { maximum: 400, minimum: 0 },
      columnFrame: { contentX: 500, width: 320 },
      devicePixelRatio: 1.25,
      liveFrame: { width: 320, x: 349.69 },
      workAreaX: 100,
    });

    expect(result).toEqual({ viewportOffset: 250.4 });
    expect((result?.viewportOffset ?? 0) * 1.25).toBeCloseTo(313, 12);
  });

  it("clamps only rounding-distance values at camera boundaries", () => {
    expect(
      planLiveCamera({
        camera: { maximum: 100, minimum: 0 },
        devicePixelRatio: 2,
        liveFrame: { width: 400, x: -0.24 },
      }),
    ).toEqual({ viewportOffset: 100 });
    expect(
      planLiveCamera({
        camera: { maximum: 100, minimum: 0 },
        devicePixelRatio: 2,
        liveFrame: { width: 400, x: 100.24 },
      }),
    ).toEqual({ viewportOffset: 0 });

    expect(
      planLiveCamera({
        camera: { maximum: 100, minimum: 0 },
        devicePixelRatio: 2,
        liveFrame: { width: 400, x: -0.26 },
      }),
    ).toBeNull();
    expect(
      planLiveCamera({
        camera: { maximum: 100, minimum: 0 },
        devicePixelRatio: 2,
        liveFrame: { width: 400, x: 100.26 },
      }),
    ).toBeNull();
  });

  it("accepts at most one physical pixel of width difference", () => {
    expect(
      planLiveCamera({
        devicePixelRatio: 2,
        liveFrame: { width: 400.5, x: -50 },
      }),
    ).toEqual({ viewportOffset: 150 });
    expect(
      planLiveCamera({
        columnFrame: { contentX: 100, width: 333.3 },
        devicePixelRatio: 1.25,
        liveFrame: { width: 334.1, x: -50 },
      }),
    ).toEqual({ viewportOffset: 150.4 });
    expect(
      planLiveCamera({
        devicePixelRatio: 2,
        liveFrame: { width: 400.500_001, x: -50 },
      }),
    ).toBeNull();
  });

  it.each([
    null,
    [],
    {},
    liveCameraInput({ camera: { maximum: -1, minimum: 0 } }),
    liveCameraInput({ camera: { maximum: 100.25, minimum: 0 } }),
    liveCameraInput({ columnFrame: { contentX: Number.NaN, width: 400 } }),
    liveCameraInput({ columnFrame: { contentX: 100, width: 0 } }),
    liveCameraInput({ devicePixelRatio: 0 }),
    liveCameraInput({ liveFrame: { width: 0, x: 0 } }),
    liveCameraInput({ liveFrame: { width: 400, x: Number.POSITIVE_INFINITY } }),
    liveCameraInput({ workAreaX: Number.NaN }),
  ])("fails closed for malformed live camera input (%o)", (input) => {
    expect(planOverviewSpatialLiveCamera(input)).toBeNull();
  });

  it("fails closed when a live frame accessor throws", () => {
    const liveFrame = Object.defineProperty({}, "x", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewSpatialLiveCamera(liveCameraInput({ liveFrame })),
    ).toBeNull();
  });
});

function plan(overrides: Record<string, unknown> = {}) {
  return planOverviewSpatialRowGeometry(baseInput(overrides));
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    activeColumnIndex: 0,
    alwaysCenterSingleColumn: false,
    columns: [{ width: { kind: "fixed", value: 400 } }],
    devicePixelRatio: 1,
    gap: 12,
    outputGeometry: { height: 900, width: 1200, x: 0, y: 0 },
    viewportOffset: 0,
    workArea: { height: 900, width: 1200, x: 0, y: 0 },
    ...overrides,
  };
}

function planLiveCamera(overrides: Record<string, unknown> = {}) {
  return planOverviewSpatialLiveCamera(liveCameraInput(overrides));
}

function liveCameraInput(overrides: Record<string, unknown> = {}) {
  return {
    camera: { maximum: 200, minimum: 0 },
    columnFrame: { contentX: 100, width: 400 },
    devicePixelRatio: 1,
    liveFrame: { width: 400, x: 0 },
    workAreaX: 0,
    ...overrides,
  };
}
