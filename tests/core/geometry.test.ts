import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW_HEIGHT_PRESETS,
  solveStripGeometry,
} from "../../src/core/geometry";
import {
  activityId,
  columnId,
  desktopId,
  outputId,
  windowId,
} from "../../src/core/ids";
import type {
  ColumnWidth,
  LayoutColumnSnapshot,
  LayoutContextSnapshot,
  WindowHeight,
} from "../../src/core/layout-engine";

const output = outputId("DP-1");
const desktop = desktopId("desktop-1");
const FALLBACK_ACTIVITY_ID = activityId("activity-1");
const floatingPointTolerance = 1e-9;

describe("solveStripGeometry", () => {
  it("returns an empty strip for an empty context", () => {
    expect(solve([])).toEqual({
      maxViewportOffset: 0,
      stripWidth: 0,
      viewportOffset: 0,
      windows: [],
    });
  });

  it("places a fixed-width column inside the outer gaps", () => {
    const result = solve([{ kind: "fixed", value: 600 }]);

    expect(result).toMatchObject({
      maxViewportOffset: 0,
      stripWidth: 632,
      windows: [
        {
          frame: { height: 1048, width: 600, x: 116, y: 66 },
          windowId: "window-1",
        },
      ],
    });
  });

  it("centers a narrow single column when requested", () => {
    const result = solve([{ kind: "fixed", value: 600 }], {
      centerSingleColumn: true,
    });

    expect(result.viewportOffset).toBe(-644);
    expect(result.windows[0]?.frame).toMatchObject({ width: 600, x: 760 });
    expect(
      (result.windows[0]?.frame.x ?? 0) +
        (result.windows[0]?.frame.width ?? 0) / 2,
    ).toBe(1060);
  });

  it.each([-4_000, 4_000])(
    "overrides a signed prior offset of %s for a centered single column",
    (viewportOffset) => {
      const result = solve([{ kind: "fixed", value: 600 }], {
        centerSingleColumn: true,
        viewportOffset,
      });

      expect(result.viewportOffset).toBe(-644);
      expect(result.windows[0]?.frame.x).toBe(760);
    },
  );

  it("keeps full-width outer gaps while centering a single column", () => {
    const result = solve([{ kind: "proportion", value: 1 }], {
      centerSingleColumn: true,
    });
    const frame = result.windows[0]?.frame;

    expect(result.viewportOffset).toBe(0);
    expect(frame).toMatchObject({ width: 1888, x: 116 });
    expect((frame?.x ?? 0) - 100).toBe(16);
    expect(2020 - ((frame?.x ?? 0) + (frame?.width ?? 0))).toBe(16);
  });

  it("centers an oversized fixed single column symmetrically", () => {
    const result = solve([{ kind: "fixed", value: 2200 }], {
      centerSingleColumn: true,
    });
    const frame = result.windows[0]?.frame;

    expect(result.viewportOffset).toBe(156);
    expect(frame).toMatchObject({ width: 2200, x: -40 });
    expect((frame?.x ?? 0) + (frame?.width ?? 0) / 2).toBe(1060);
  });

  it.each(["stacked", "tabbed"] as const)(
    "treats a %s stack as one centered column",
    (presentation) => {
      const context = createContext([{ kind: "fixed", value: 600 }]);
      const column = context.columns[0];

      if (!column) {
        throw new Error("expected a column fixture");
      }

      const result = solveStripGeometry({
        centerSingleColumn: true,
        context: {
          ...context,
          columns: [
            {
              ...column,
              presentation,
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
          ],
        },
        devicePixelRatio: 1,
        gap: 16,
        pixelGridOrigin: { x: 100, y: 50 },
        workArea: { height: 1080, width: 1920, x: 100, y: 50 },
      });

      expect(result.viewportOffset).toBe(-644);
      expect(result.windows).toHaveLength(2);
      expect(
        result.windows.map(({ frame }) => ({ width: frame.width, x: frame.x })),
      ).toEqual([
        { width: 600, x: 760 },
        { width: 600, x: 760 },
      ]);
    },
  );

  it.each([1.25, 1.5, 1.75, 2.5])(
    "centers a single column on the physical grid at %s DPR",
    (devicePixelRatio) => {
      const result = solve([{ kind: "fixed", value: 333.3 }], {
        centerSingleColumn: true,
        devicePixelRatio,
      });
      const frame = result.windows[0]?.frame;

      if (!frame) {
        throw new Error("expected a centered frame");
      }

      const physicalLeft = (frame.x - 100) * devicePixelRatio;
      const physicalRight = (frame.x + frame.width - 100) * devicePixelRatio;
      const frameCenter = frame.x + frame.width / 2;

      expect(result.viewportOffset * devicePixelRatio).toBeCloseTo(
        Math.round(result.viewportOffset * devicePixelRatio),
        10,
      );
      expect(physicalLeft).toBeCloseTo(Math.round(physicalLeft), 10);
      expect(physicalRight).toBeCloseTo(Math.round(physicalRight), 10);
      expect(Math.abs(frameCenter - 1060)).toBeLessThanOrEqual(
        0.5 / devicePixelRatio + floatingPointTolerance,
      );
    },
  );

  it("does not change explicit false or multi-column geometry", () => {
    const single = [{ kind: "fixed", value: 600 }] as const;
    const multiple = [
      { kind: "fixed", value: 600 },
      { kind: "fixed", value: 600 },
    ] as const;

    expect(solve(single, { centerSingleColumn: false })).toEqual(solve(single));
    expect(solve(multiple, { centerSingleColumn: true })).toEqual(
      solve(multiple),
    );
  });

  it("preserves a signed offset that centers a visible column", () => {
    const result = solve([{ kind: "fixed", value: 600 }], {
      viewportOffset: -644,
    });

    expect(result.viewportOffset).toBe(-644);
    expect(result.windows[0]?.frame.x).toBe(760);
  });

  it.each([-4_000, 4_000])(
    "corrects a stale signed offset of %s when the active column is off-screen",
    (viewportOffset) => {
      const result = solve([{ kind: "fixed", value: 600 }], {
        viewportOffset,
      });

      expect(result.maxViewportOffset).toBe(0);
      expect(result.viewportOffset).toBe(0);
      expect(result.windows[0]?.frame).toMatchObject({
        width: 600,
        x: 116,
      });
    },
  );

  it("fits proportional columns together with their gaps", () => {
    const result = solve([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
    ]);

    expect(result.stripWidth).toBe(1920);
    expect(result.windows.map((window) => window.frame)).toEqual([
      { height: 1048, width: 936, x: 116, y: 66 },
      { height: 1048, width: 936, x: 1068, y: 66 },
    ]);
  });

  it("clamps the viewport offset to the scrollable strip", () => {
    const result = solve(
      [
        { kind: "proportion", value: 0.5 },
        { kind: "proportion", value: 0.5 },
        { kind: "proportion", value: 0.5 },
      ],
      { viewportOffset: 20_000 },
    );

    expect(result.maxViewportOffset).toBe(952);
    expect(result.viewportOffset).toBe(952);
    expect(result.windows[result.windows.length - 1]?.frame.x).toBe(1068);
  });

  it("reveals the active overflow column with the smallest scroll", () => {
    const result = solve([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
    ]);

    expect(result.maxViewportOffset).toBe(952);
    expect(result.viewportOffset).toBe(952);
    expect(result.windows.map((window) => window.frame.x)).toEqual([
      -836, 116, 1068,
    ]);
    expect(result.windows[2]?.frame.x).toBe(1068);
    expect(
      (result.windows[2]?.frame.x ?? 0) + (result.windows[2]?.frame.width ?? 0),
    ).toBe(2004);
  });

  it("does not scroll when the active column is already fully visible", () => {
    const context = createContext([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
    ]);

    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
        viewportOffset: 936,
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });

    expect(result.viewportOffset).toBe(936);
    expect(result.windows[1]?.frame).toMatchObject({
      width: 936,
      x: 132,
    });
  });

  it("keeps a full-width middle column between equal outer gaps", () => {
    const context = createContext([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 1 },
      { kind: "proportion", value: 0.5 },
    ]);
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
        viewportOffset: 1_904,
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });
    const [previous, active, next] = result.windows;

    expect(result.viewportOffset).toBe(952);
    expect((previous?.frame.x ?? 0) + (previous?.frame.width ?? 0)).toBe(84);
    expect(active?.frame).toMatchObject({ width: 1888, x: 116 });
    expect((active?.frame.x ?? 0) + (active?.frame.width ?? 0)).toBe(2004);
    expect(next?.frame.x).toBe(2036);
  });

  it("keeps a full-width successor visible beside an active normal column", () => {
    const context = createContext([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 1 },
    ]);
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
        viewportOffset: 952,
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });
    const [, active, successor] = result.windows;

    expect(result.viewportOffset).toBe(952);
    expect(active?.frame).toMatchObject({ width: 936, x: 116 });
    expect(successor?.frame).toMatchObject({ width: 1888, x: 1068 });
    expect(successor?.frame.x).toBeLessThan(2020);
  });

  it("minimally reveals an ordinary column after a full-width column", () => {
    const context = createContext([
      { kind: "proportion", value: 1 },
      { kind: "proportion", value: 1 / 3 },
    ]);
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });
    const [previous, active] = result.windows;
    const previousEnd = (previous?.frame.x ?? 0) + (previous?.frame.width ?? 0);
    const activeEnd = (active?.frame.x ?? 0) + (active?.frame.width ?? 0);

    expect(result.viewportOffset).toBe(result.maxViewportOffset);
    expect(previous?.frame.width).toBe(1888);
    expect(previousEnd).toBeGreaterThan(100);
    expect(active?.frame.width).toBeCloseTo(619, 0);
    expect(active?.frame.x).toBeGreaterThan(previousEnd);
    expect(activeEnd).toBe(2004);
  });

  it("reveals only the adjacent ordinary column after a full-width column", () => {
    const gap = 17;
    const workArea = { height: 900, width: 1366, x: 23, y: 31 };
    const context = createContext([
      { kind: "proportion", value: 1 },
      { kind: "proportion", value: 1 / 3 },
      { kind: "proportion", value: 1 / 3 },
      { kind: "proportion", value: 1 / 3 },
    ]);
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
        viewportOffset: 0,
      },
      devicePixelRatio: 1,
      gap,
      pixelGridOrigin: { x: 0, y: 0 },
      workArea,
    });
    const [previous, active, next, terminal] = result.windows;
    const viewportEnd = workArea.x + workArea.width;
    const previousEnd = (previous?.frame.x ?? 0) + (previous?.frame.width ?? 0);
    const activeEnd = (active?.frame.x ?? 0) + (active?.frame.width ?? 0);

    expect(previousEnd).toBeGreaterThan(workArea.x);
    expect(active?.frame.x).toBeGreaterThan(previousEnd);
    expect(activeEnd).toBe(viewportEnd - gap);
    expect(next?.frame.x).toBeGreaterThanOrEqual(viewportEnd);
    expect(terminal?.frame.x).toBeGreaterThan(next?.frame.x ?? 0);
  });

  it.each([1.25, 1.5, 1.75, 2.5])(
    "keeps full-width outer gaps aligned at %s DPR",
    (devicePixelRatio) => {
      const context = createContext([
        { kind: "proportion", value: 1 / 3 },
        { kind: "proportion", value: 1 },
        { kind: "proportion", value: 1 / 3 },
      ]);
      const result = solveStripGeometry({
        context: {
          ...context,
          activeColumnId: columnId("column-2"),
          viewportOffset: 0,
        },
        devicePixelRatio,
        gap: 16,
        pixelGridOrigin: { x: 100, y: 50 },
        workArea: { height: 1080, width: 1920, x: 100, y: 50 },
      });
      const [previous, active, next] = result.windows;
      const activeEnd = (active?.frame.x ?? 0) + (active?.frame.width ?? 0);

      expect((previous?.frame.x ?? 0) + (previous?.frame.width ?? 0)).toBe(84);
      expect(active?.frame.x).toBe(116);
      expect(activeEnd).toBe(2004);
      expect(next?.frame.x).toBe(2036);
      expect(result.viewportOffset * devicePixelRatio).toBeCloseTo(
        Math.round(result.viewportOffset * devicePixelRatio),
        10,
      );
    },
  );

  it.each([1, 1.25, 1.5, 2, 2.5])(
    "quantizes fractional logical gaps onto the physical grid at %s DPR",
    (devicePixelRatio) => {
      const gap = 7.5;
      const pixelGridOrigin = { x: 0, y: 0 };
      const workArea = { height: 900, width: 1001, x: 14, y: 10 };
      const context = createContext([
        { kind: "fixed", value: 333.3 },
        { kind: "fixed", value: 333.3 },
        { kind: "fixed", value: 333.3 },
      ]);
      const result = solveStripGeometry({
        context: {
          ...context,
          activeColumnId: columnId("column-1"),
          viewportOffset: 0,
        },
        devicePixelRatio,
        gap,
        pixelGridOrigin,
        workArea,
      });

      for (const { frame } of result.windows) {
        for (const edge of [
          frame.x - pixelGridOrigin.x,
          frame.y - pixelGridOrigin.y,
          frame.x + frame.width - pixelGridOrigin.x,
          frame.y + frame.height - pixelGridOrigin.y,
        ]) {
          const physicalEdge = edge * devicePixelRatio;
          expect(physicalEdge).toBeCloseTo(Math.round(physicalEdge), 10);
        }
      }

      for (let index = 1; index < result.windows.length; index += 1) {
        const previous = result.windows[index - 1];
        const current = result.windows[index];

        if (!previous || !current) {
          throw new Error("fractional gap fixture is incomplete");
        }

        const physicalGap =
          (current.frame.x - (previous.frame.x + previous.frame.width)) *
          devicePixelRatio;
        const requestedPhysicalGap = gap * devicePixelRatio;

        expect(physicalGap).toBeCloseTo(Math.round(physicalGap), 10);
        expect(
          Math.abs(physicalGap - requestedPhysicalGap),
        ).toBeLessThanOrEqual(1 + 1e-10);

        if (Number.isInteger(requestedPhysicalGap)) {
          expect(physicalGap).toBeCloseTo(requestedPhysicalGap, 10);
        } else {
          expect(physicalGap).not.toBeCloseTo(requestedPhysicalGap, 10);
        }
      }
    },
  );

  it.each([1.25, 1.5, 1.75, 2.5])(
    "keeps full-width neighbors one aligned gap beyond the viewport at %s DPR",
    (devicePixelRatio) => {
      const context = createContext([
        { kind: "proportion", value: 1 / 3 },
        { kind: "proportion", value: 1 },
        { kind: "proportion", value: 1 / 3 },
      ]);
      const gap = 17;
      const pixelGridOrigin = { x: 0, y: 0 };
      const workArea = { height: 900, width: 1001, x: 14, y: 10 };
      const result = solveStripGeometry({
        context: {
          ...context,
          activeColumnId: columnId("column-2"),
          viewportOffset: 0,
        },
        devicePixelRatio,
        gap,
        pixelGridOrigin,
        workArea,
      });
      const [previous, , next] = result.windows;
      const clearance = Math.ceil(gap * devicePixelRatio) / devicePixelRatio;
      const previousEnd =
        (previous?.frame.x ?? 0) + (previous?.frame.width ?? 0);

      expect(previousEnd).toBeLessThanOrEqual(workArea.x - clearance + 1e-10);
      expect(next?.frame.x ?? 0).toBeGreaterThanOrEqual(
        workArea.x + workArea.width + clearance - 1e-10,
      );

      for (const { frame } of result.windows) {
        expect((frame.x - pixelGridOrigin.x) * devicePixelRatio).toBeCloseTo(
          Math.round((frame.x - pixelGridOrigin.x) * devicePixelRatio),
          10,
        );
        expect(
          (frame.x + frame.width - pixelGridOrigin.x) * devicePixelRatio,
        ).toBeCloseTo(
          Math.round(
            (frame.x + frame.width - pixelGridOrigin.x) * devicePixelRatio,
          ),
          10,
        );
      }
    },
  );

  it("adds no full-width neighbor clearance when the configured gap is zero", () => {
    const context = createContext([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 1 },
      { kind: "proportion", value: 0.5 },
    ]);
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-2"),
        viewportOffset: 0,
      },
      devicePixelRatio: 1,
      gap: 0,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });
    const [previous, active, next] = result.windows;

    expect((previous?.frame.x ?? 0) + (previous?.frame.width ?? 0)).toBe(100);
    expect(active?.frame).toMatchObject({ width: 1920, x: 100 });
    expect(next?.frame.x).toBe(2020);
  });

  it("reveals a column on the left with its outer gap", () => {
    const context = createContext([
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
      { kind: "proportion", value: 0.5 },
    ]);

    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-1"),
        viewportOffset: 936,
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });

    expect(result.viewportOffset).toBe(0);
    expect(result.windows[0]?.frame.x).toBe(116);
  });

  it("keeps every fitting active column inside the work area", () => {
    for (const devicePixelRatio of [1, 1.25, 1.5, 1.75, 2]) {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.nat(),
          fc.integer({ min: 0, max: 20_000 }),
          (columnCount, targetSeed, viewportOffset) => {
            const context = createContext(
              Array.from({ length: columnCount }, () => ({
                kind: "fixed" as const,
                value: 333.3,
              })),
            );
            const targetIndex = targetSeed % columnCount;
            const result = solveStripGeometry({
              context: {
                ...context,
                activeColumnId: columnId(`column-${String(targetIndex + 1)}`),
                viewportOffset,
              },
              devicePixelRatio,
              gap: 16,
              pixelGridOrigin: { x: 100, y: 50 },
              workArea: { height: 1080, width: 1920, x: 100, y: 50 },
            });
            const target = result.windows[targetIndex];

            expect(target).toBeDefined();
            expect(target?.frame.x).toBeGreaterThanOrEqual(
              100 - floatingPointTolerance,
            );
            expect(
              (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
            ).toBeLessThanOrEqual(2020 + floatingPointTolerance);
          },
        ),
        { numRuns: 1_000 },
      );
    }
  });

  it.each([1.25, 1.75])(
    "revalidates the final right edge at %s DPR",
    (devicePixelRatio) => {
      const context = createContext(
        Array.from({ length: 28 }, () => ({
          kind: "fixed" as const,
          value: 333.3,
        })),
      );
      const result = solveStripGeometry({
        context: {
          ...context,
          activeColumnId: columnId("column-28"),
          viewportOffset: 5589,
        },
        devicePixelRatio,
        gap: 16,
        pixelGridOrigin: { x: 100, y: 50 },
        workArea: { height: 1080, width: 1920, x: 100, y: 50 },
      });
      const target = result.windows[27];

      expect(target).toBeDefined();
      expect(target?.frame.x).toBeGreaterThanOrEqual(
        100 - floatingPointTolerance,
      );
      expect(
        (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
      ).toBeLessThanOrEqual(2020 + floatingPointTolerance);
      expect(result.viewportOffset * devicePixelRatio).toBeCloseTo(
        Math.round(result.viewportOffset * devicePixelRatio),
        10,
      );
    },
  );

  it("rounds the maximum offset up to reach the final physical pixel", () => {
    const context = createContext(
      Array.from({ length: 24 }, () => ({
        kind: "fixed" as const,
        value: 625.2975735180612,
      })),
    );
    const result = solveStripGeometry({
      context: {
        ...context,
        activeColumnId: columnId("column-24"),
        viewportOffset: 20_000,
      },
      devicePixelRatio: 2.5,
      gap: 0,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 3919, x: 100, y: 50 },
    });
    const target = result.windows[23];

    expect(result.maxViewportOffset).toBeCloseTo(11088.4, 10);
    expect(result.viewportOffset).toBe(result.maxViewportOffset);
    expect(target).toBeDefined();
    expect(
      (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
    ).toBeLessThanOrEqual(4019 + floatingPointTolerance);
  });

  it.each([
    {
      devicePixelRatio: 1.2,
      expectedMaxViewportOffset: 586.6666666666667,
      width: 884.9034843704916,
      workAreaWidth: 1184,
    },
    {
      devicePixelRatio: 1.25,
      expectedMaxViewportOffset: 280.8,
      width: 301,
      workAreaWidth: 322,
    },
  ])(
    "extends a terminal boundary to the next physical pixel at $devicePixelRatio DPR",
    ({ devicePixelRatio, expectedMaxViewportOffset, width, workAreaWidth }) => {
      const context = createContext([
        { kind: "fixed", value: width },
        { kind: "fixed", value: width },
      ]);
      const result = solveStripGeometry({
        context: { ...context, viewportOffset: 20_000 },
        devicePixelRatio,
        gap: 0,
        pixelGridOrigin: { x: 100, y: 50 },
        workArea: {
          height: 1080,
          width: workAreaWidth,
          x: 100,
          y: 50,
        },
      });
      const target = result.windows[1];

      expect(result.maxViewportOffset).toBeCloseTo(
        expectedMaxViewportOffset,
        10,
      );
      expect(result.viewportOffset).toBe(result.maxViewportOffset);
      expect(target).toBeDefined();
      expect(
        (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
      ).toBeLessThanOrEqual(100 + workAreaWidth + floatingPointTolerance);
    },
  );

  it("treats arithmetic noise above a fitting strip as zero overflow", () => {
    const context = createContext([
      { kind: "fixed", value: 1000.1 },
      { kind: "fixed", value: 1000.2 },
    ]);
    const result = solveStripGeometry({
      context,
      devicePixelRatio: 1,
      gap: 0,
      pixelGridOrigin: { x: 0, y: 0 },
      workArea: { height: 1080, width: 2000.3, x: 0, y: 0 },
    });

    expect(1000.1 + 1000.2).toBeGreaterThan(2000.3);
    expect(result.maxViewportOffset).toBe(0);
    expect(result.viewportOffset).toBe(0);
  });

  it("extends a raw-fitting strip when its terminal edge snaps outward", () => {
    const context = createContext([
      { kind: "fixed", value: 161 },
      { kind: "fixed", value: 161 },
    ]);
    const result = solveStripGeometry({
      context,
      devicePixelRatio: 1.25,
      gap: 0,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 322, x: 100, y: 50 },
    });
    const target = result.windows[1];

    expect(result.maxViewportOffset).toBe(0.8);
    expect(result.viewportOffset).toBe(0.8);
    expect(target?.frame.x).toBeGreaterThanOrEqual(100);
    expect(
      (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
    ).toBeLessThanOrEqual(422 + floatingPointTolerance);
  });

  it("reveals fitting columns across variable widths and gaps", () => {
    for (const devicePixelRatio of [1, 1.25, 1.5, 1.75, 2, 2.5]) {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.nat(),
          fc.integer({ min: 0, max: 20_000 }),
          fc.integer({ min: 320, max: 4_000 }),
          fc.integer({ min: 0, max: 64 }),
          fc.integer({ min: 1, max: 1_000_000 }),
          (
            columnCount,
            targetSeed,
            viewportOffset,
            workAreaWidth,
            gap,
            widthSeed,
          ) => {
            const width = Math.min(
              workAreaWidth - 2,
              1 + (widthSeed % 2_000_000) / 1_000,
            );
            const context = createContext(
              Array.from({ length: columnCount }, () => ({
                kind: "fixed" as const,
                value: width,
              })),
            );
            const targetIndex = targetSeed % columnCount;
            const result = solveStripGeometry({
              context: {
                ...context,
                activeColumnId: columnId(`column-${String(targetIndex + 1)}`),
                viewportOffset,
              },
              devicePixelRatio,
              gap,
              pixelGridOrigin: { x: 100, y: 50 },
              workArea: {
                height: 1080,
                width: workAreaWidth,
                x: 100,
                y: 50,
              },
            });
            const target = result.windows[targetIndex];

            expect(target).toBeDefined();
            expect(target?.frame.x).toBeGreaterThanOrEqual(
              100 - floatingPointTolerance,
            );
            expect(
              (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
            ).toBeLessThanOrEqual(100 + workAreaWidth + floatingPointTolerance);
          },
        ),
        { numRuns: 500 },
      );
    }
  });

  it.each([
    { expectedOffset: 192, initialOffset: 175 },
    { expectedOffset: 1746, initialOffset: 1763 },
  ])(
    "snaps a reveal from $initialOffset toward the valid pixel interval",
    ({ expectedOffset, initialOffset }) => {
      const context = createContext(
        Array.from({ length: 24 }, () => ({
          kind: "fixed" as const,
          value: 333.3,
        })),
      );
      const result = solveStripGeometry({
        context: {
          ...context,
          activeColumnId: columnId("column-6"),
          viewportOffset: initialOffset,
        },
        devicePixelRatio: 1,
        gap: 16,
        pixelGridOrigin: { x: 100, y: 50 },
        workArea: { height: 1080, width: 1920, x: 100, y: 50 },
      });
      const target = result.windows[5];

      expect(result.viewportOffset).toBe(expectedOffset);
      expect(target?.frame.x).toBeGreaterThanOrEqual(116);
      expect(
        (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
      ).toBeLessThanOrEqual(2004);
    },
  );

  it("stacks multiple windows without cumulative rounding drift", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
        ],
      },
      devicePixelRatio: 1.25,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });

    expect(result.windows.map((window) => window.frame)).toEqual([
      { height: 516, width: 600, x: 116, y: 66 },
      { height: 516, width: 600, x: 116, y: 598 },
    ]);
    const lastWindow = result.windows[result.windows.length - 1];

    expect(lastWindow?.frame.y).toBe(598);
    expect((lastWindow?.frame.y ?? 0) + (lastWindow?.frame.height ?? 0)).toBe(
      1114,
    );
  });

  it("overlays tabbed members inside normal outer gaps and ignores heights", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const tabbedColumn: LayoutColumnSnapshot = {
      id: columnId("column-1"),
      presentation: "tabbed",
      selectedWindowId: windowId("window-2"),
      width: { kind: "fixed", value: 600 },
      windowHeights: [
        { clientHeight: 120, kind: "fixed" },
        { kind: "auto", weight: 7 },
        { kind: "auto", weight: 2 },
      ],
      windowIds: [
        windowId("window-1"),
        windowId("window-2"),
        windowId("window-3"),
      ],
    };
    const input = {
      context: {
        ...context,
        columns: [tabbedColumn],
      },
      devicePixelRatio: 1,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      windowHeightBounds: new Map([
        [
          windowId("window-1"),
          { maximumClientHeight: 1_048, minimumClientHeight: 1_048 },
        ],
        [
          windowId("window-2"),
          {
            decorationHeight: 20,
            maximumClientHeight: 1_028,
            minimumClientHeight: 1_028,
          },
        ],
      ]),
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    };
    const result = solveStripGeometry(input);

    expect(result.windows).toEqual([
      {
        columnId: "column-1",
        frame: { height: 1048, width: 600, x: 116, y: 66 },
        windowId: "window-1",
      },
      {
        columnId: "column-1",
        frame: { height: 1048, width: 600, x: 116, y: 66 },
        windowId: "window-2",
      },
      {
        columnId: "column-1",
        frame: { height: 1048, width: 600, x: 116, y: 66 },
        windowId: "window-3",
      },
    ]);

    const solveColumn = (column: LayoutColumnSnapshot) =>
      solveStripGeometry({
        ...input,
        context: { ...input.context, columns: [column] },
      });

    expect(() =>
      solveColumn({
        ...tabbedColumn,
        selectedWindowId: windowId("missing"),
      }),
    ).toThrow("column presentation state is invalid");
    expect(
      solveColumn({
        ...tabbedColumn,
        selectedWindowId: windowId("window-1"),
        windowHeights: [{ kind: "auto", weight: 1 }],
        windowIds: [windowId("window-1")],
      }).windows,
    ).toEqual([
      {
        columnId: "column-1",
        frame: { height: 1048, width: 600, x: 116, y: 66 },
        windowId: "window-1",
      },
    ]);
    expect(() =>
      solveColumn({
        ...tabbedColumn,
        presentation: "invalid",
      } as unknown as LayoutColumnSnapshot),
    ).toThrow("column presentation state is invalid");
    expect(() =>
      solveColumn({
        ...tabbedColumn,
        windowHeights: [{ kind: "auto", weight: 1 }],
      }),
    ).toThrow("window height state does not match the column");
    expect(() =>
      solveColumn({
        ...tabbedColumn,
        windowHeights: [
          { kind: "auto", weight: 0 },
          { kind: "auto", weight: 1 },
          { kind: "auto", weight: 1 },
        ],
      }),
    ).toThrow("window height state is invalid");
    expect(() =>
      solveColumn({
        ...tabbedColumn,
        windowHeights: [
          { clientHeight: 100, kind: "fixed" },
          { index: 0, kind: "preset" },
          { kind: "auto", weight: 1 },
        ],
      }),
    ).toThrow("at most one non-automatic");
    expect(() =>
      solveStripGeometry({
        ...input,
        windowHeightBounds: new Map([
          [windowId("window-1"), { maximumClientHeight: 1_047 }],
        ]),
      }),
    ).toThrow("tabbed window height bounds cannot accept the common frame");
  });

  it("distributes automatic height by weight around one fixed client height", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const fixed = windowId("window-2");
    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { kind: "auto", weight: 1 },
              { clientHeight: 300, kind: "fixed" },
              { kind: "auto", weight: 3 },
            ],
            windowIds: [windowId("window-1"), fixed, windowId("window-3")],
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([
        [
          fixed,
          {
            decorationHeight: 20,
            maximumClientHeight: 800,
            minimumClientHeight: 100,
          },
        ],
      ]),
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });

    expect(result.windows.map((window) => window.frame)).toEqual([
      { height: 160, width: 600, x: 10, y: 10 },
      { height: 320, width: 600, x: 10, y: 180 },
      { height: 480, width: 600, x: 10, y: 510 },
    ]);
  });

  it("resolves proportional and fixed presets with frame decorations", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const proportional = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { index: 1, kind: "preset" },
              { kind: "auto", weight: 1 },
            ],
            windowIds: [first, windowId("window-2")],
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([[first, { decorationHeight: 30 }]]),
      windowHeightPresets: DEFAULT_WINDOW_HEIGHT_PRESETS,
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });
    const fixed = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { index: 0, kind: "preset" },
              { kind: "auto", weight: 1 },
            ],
            windowIds: [first, windowId("window-2")],
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([[first, { decorationHeight: 20 }]]),
      windowHeightPresets: [{ kind: "fixed", value: 300 }],
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });
    const resolvedFixed = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { index: 840, kind: "preset" },
              { kind: "auto", weight: 1 },
            ],
            windowIds: [first, windowId("window-2")],
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([[first, { decorationHeight: 20 }]]),
      windowHeightPresetResolver: (stateIndex) =>
        stateIndex === 840 ? { kind: "fixed", value: 640 } : null,
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });

    expect(proportional.windows.map((window) => window.frame.height)).toEqual([
      485, 485,
    ]);
    expect(fixed.windows.map((window) => window.frame.height)).toEqual([
      320, 650,
    ]);
    expect(resolvedFixed.windows.map((window) => window.frame.height)).toEqual([
      660, 310,
    ]);
  });

  it("redistributes weighted automatic height at client bounds", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const second = windowId("window-2");
    const third = windowId("window-3");
    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { kind: "auto", weight: 1.01 },
              { kind: "auto", weight: 1 },
              { kind: "auto", weight: 1 },
            ],
            windowIds: [first, second, third],
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([
        [first, { minimumClientHeight: 400 }],
        [third, { maximumClientHeight: 200 }],
      ]),
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });

    expect(result.windows.map((window) => window.frame.height)).toEqual([
      400, 360, 200,
    ]);
    expect(result.windows[2]?.frame.y).toBe(790);
  });

  it("water-fills across several lower and upper height bounds", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const second = windowId("window-2");
    const third = windowId("window-3");
    const fourth = windowId("window-4");
    const fifth = windowId("window-5");
    const windows = [first, second, third, fourth, fifth];
    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { kind: "auto", weight: 1 },
              { kind: "auto", weight: 2 },
              { kind: "auto", weight: 1 },
              { kind: "auto", weight: 3 },
              { kind: "auto", weight: 1 },
            ],
            windowIds: windows,
          },
        ],
      },
      devicePixelRatio: 1,
      gap: 0,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([
        [first, { minimumClientHeight: 200 }],
        [second, { maximumClientHeight: 150 }],
        [fourth, { maximumClientHeight: 300 }],
        [fifth, { minimumClientHeight: 100 }],
      ]),
      workArea: { height: 1000, width: 1000, x: 0, y: 0 },
    });

    expect(result.windows.map((window) => window.frame)).toEqual([
      { height: 200, width: 600, x: 0, y: 0 },
      { height: 150, width: 600, x: 0, y: 200 },
      { height: 175, width: 600, x: 0, y: 350 },
      { height: 300, width: 600, x: 0, y: 525 },
      { height: 175, width: 600, x: 0, y: 825 },
    ]);
  });

  it("honors height bounds with subnormal automatic weights", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const second = windowId("window-2");
    const solveWithBounds = (
      windowHeightBounds: NonNullable<
        Parameters<typeof solveStripGeometry>[0]["windowHeightBounds"]
      >,
    ) =>
      solveStripGeometry({
        context: {
          ...context,
          columns: [
            {
              ...column,
              windowHeights: [
                { kind: "auto", weight: Number.MIN_VALUE },
                { kind: "auto", weight: Number.MIN_VALUE },
              ],
              windowIds: [first, second],
            },
          ],
        },
        devicePixelRatio: 1,
        gap: 0,
        pixelGridOrigin: { x: 0, y: 0 },
        windowHeightBounds,
        workArea: { height: 1000, width: 1000, x: 0, y: 0 },
      });

    expect(
      solveWithBounds(
        new Map([[first, { minimumClientHeight: 600 }]]),
      ).windows.map((window) => window.frame.height),
    ).toEqual([600, 400]);
    expect(() =>
      solveWithBounds(
        new Map([
          [first, { maximumClientHeight: 1 }],
          [second, { maximumClientHeight: 1 }],
        ]),
      ),
    ).toThrow("maximum heights cannot fill");
  });

  it("performance budget: bounds automatic height policy reads", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const windowCount = 128;
    const constrainedWindowCount = windowCount / 2;
    const windows = Array.from({ length: windowCount }, (_value, index) =>
      windowId(`window-${String(index + 1)}`),
    );
    const policies: WindowHeight[] = Array.from(
      { length: windowCount },
      () => ({ kind: "auto", weight: 1 }),
    );
    let policyReads = 0;
    const observedPolicies = new Proxy(policies, {
      get: (target, property, receiver) => {
        if (typeof property === "string") {
          const index = Number(property);

          if (
            Number.isInteger(index) &&
            index >= 0 &&
            String(index) === property
          ) {
            policyReads += 1;
          }
        }

        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: observedPolicies,
            windowIds: windows,
          },
        ],
      },
      devicePixelRatio: 1_000_000_000,
      gap: 0,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map(
        windows
          .slice(windowCount - constrainedWindowCount)
          .map((id) => [id, { minimumClientHeight: 1500 }]),
      ),
      workArea: {
        height: windowCount * 1000,
        width: 1000,
        x: 0,
        y: 0,
      },
    });

    expect(policyReads).toBeLessThanOrEqual(windowCount * 3);

    for (const [index, window] of result.windows.entries()) {
      expect(window.frame.height).toBe(
        index < windowCount - constrainedWindowCount ? 500 : 1500,
      );
    }
  });

  it("reserves a physical-pixel-aligned sibling minimum", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const second = windowId("window-2");
    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { kind: "auto", weight: 1 },
              { clientHeight: 1000, kind: "fixed" },
            ],
            windowIds: [first, second],
          },
        ],
      },
      devicePixelRatio: 1.25,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([[first, { minimumClientHeight: 101 }]]),
      workArea: { height: 800, width: 1000, x: 0, y: 0 },
    });

    expect(result.windows[0]?.frame.height).toBeGreaterThanOrEqual(101);
    expect(result.windows[1]?.frame.height).toBeLessThanOrEqual(668);
  });

  it("keeps a finite maximum representable after fractional snapping", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];
    const id = windowId("window-1");

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [{ clientHeight: 1000, kind: "fixed" }],
            windowIds: [id],
          },
        ],
      },
      devicePixelRatio: 1.25,
      gap: 10,
      pixelGridOrigin: { x: 0, y: 0 },
      windowHeightBounds: new Map([[id, { maximumClientHeight: 100.1 }]]),
      workArea: { height: 800, width: 1000, x: 0, y: 0 },
    });

    expect(result.windows[0]?.frame.height).toBeLessThanOrEqual(100.1);
  });

  it("snaps weighted window-height edges to fractional physical pixels", () => {
    const context = createContext([{ kind: "fixed", value: 333.3 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const result = solveStripGeometry({
      context: {
        ...context,
        columns: [
          {
            ...column,
            windowHeights: [
              { kind: "auto", weight: 1 },
              { clientHeight: 317.3, kind: "fixed" },
              { kind: "auto", weight: 2 },
            ],
            windowIds: [
              windowId("window-1"),
              windowId("window-2"),
              windowId("window-3"),
            ],
          },
        ],
      },
      devicePixelRatio: 1.25,
      gap: 16,
      pixelGridOrigin: { x: 100, y: 50 },
      workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    });

    for (const { frame } of result.windows) {
      expect((frame.y - 50) * 1.25).toBeCloseTo(
        Math.round((frame.y - 50) * 1.25),
        10,
      );
      expect((frame.y + frame.height - 50) * 1.25).toBeCloseTo(
        Math.round((frame.y + frame.height - 50) * 1.25),
        10,
      );
    }
  });

  it("rejects invalid serialized window-height geometry", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const solveColumn = (
      windowHeights: NonNullable<typeof column.windowHeights>,
    ) =>
      solveStripGeometry({
        context: {
          ...context,
          columns: [
            {
              ...column,
              windowHeights,
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
          ],
        },
        devicePixelRatio: 1,
        gap: 10,
        pixelGridOrigin: { x: 0, y: 0 },
        workArea: { height: 1000, width: 1000, x: 0, y: 0 },
      });

    expect(() => solveColumn([{ kind: "auto", weight: 1 }])).toThrow(
      "does not match",
    );
    expect(() =>
      solveColumn([
        { clientHeight: 200, kind: "fixed" },
        { index: 0, kind: "preset" },
      ]),
    ).toThrow("at most one non-automatic");
    expect(() =>
      solveColumn([
        { index: 99, kind: "preset" },
        { kind: "auto", weight: 1 },
      ]),
    ).toThrow("preset index is out of range");
  });

  it("rejects an automatic stack whose maxima cannot fill the work area", () => {
    const context = createContext([{ kind: "fixed", value: 600 }]);
    const column = context.columns[0];

    if (!column) {
      throw new Error("expected a column fixture");
    }

    const first = windowId("window-1");
    const second = windowId("window-2");

    expect(() =>
      solveStripGeometry({
        context: {
          ...context,
          columns: [
            {
              ...column,
              windowHeights: [
                { kind: "auto", weight: 2 },
                { kind: "auto", weight: 1 },
              ],
              windowIds: [first, second],
            },
          ],
        },
        devicePixelRatio: 1,
        gap: 10,
        pixelGridOrigin: { x: 0, y: 0 },
        windowHeightBounds: new Map([
          [first, { maximumClientHeight: 100 }],
          [second, { maximumClientHeight: 100 }],
        ]),
        workArea: { height: 1000, width: 1000, x: 0, y: 0 },
      }),
    ).toThrow("maximum heights cannot fill");
  });

  it("snaps every frame edge to the physical pixel grid", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.constantFrom(1, 1.25, 1.5, 2),
        (columnCount, devicePixelRatio) => {
          const result = solve(
            Array.from({ length: columnCount }, () => ({
              kind: "fixed" as const,
              value: 333.3,
            })),
            { devicePixelRatio, viewportOffset: 10_000 },
          );

          for (const { frame } of result.windows) {
            for (const edge of [
              (frame.x - 100) * devicePixelRatio,
              (frame.y - 50) * devicePixelRatio,
              (frame.x + frame.width - 100) * devicePixelRatio,
              (frame.y + frame.height - 50) * devicePixelRatio,
            ]) {
              expect(edge).toBeCloseTo(Math.round(edge), 10);
            }
          }
        },
      ),
    );
  });

  it.each([
    { gap: -1 },
    { devicePixelRatio: 0 },
    { workArea: { height: 0, width: 1920, x: 0, y: 0 } },
    { viewportOffset: Number.NaN },
  ])("rejects invalid input $input", (overrides) => {
    expect(() => solve([{ kind: "fixed", value: 600 }], overrides)).toThrow(
      RangeError,
    );
  });
});

interface SolveOverrides {
  readonly centerSingleColumn?: boolean;
  readonly devicePixelRatio?: number;
  readonly gap?: number;
  readonly viewportOffset?: number;
  readonly workArea?: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
}

function solve(widths: readonly ColumnWidth[], overrides: SolveOverrides = {}) {
  const context = createContext(widths);

  return solveStripGeometry({
    ...(overrides.centerSingleColumn === undefined
      ? {}
      : { centerSingleColumn: overrides.centerSingleColumn }),
    context: {
      ...context,
      viewportOffset: overrides.viewportOffset ?? context.viewportOffset,
    },
    devicePixelRatio: overrides.devicePixelRatio ?? 1,
    gap: overrides.gap ?? 16,
    pixelGridOrigin: { x: 100, y: 50 },
    workArea: overrides.workArea ?? {
      height: 1080,
      width: 1920,
      x: 100,
      y: 50,
    },
  });
}

function createContext(widths: readonly ColumnWidth[]): LayoutContextSnapshot {
  return {
    activeColumnId:
      widths.length === 0 ? null : columnId(`column-${String(widths.length)}`),
    activityId: FALLBACK_ACTIVITY_ID,
    columns: widths.map((width, index) => ({
      id: columnId(`column-${String(index + 1)}`),
      presentation: "stacked",
      selectedWindowId: windowId(`window-${String(index + 1)}`),
      width,
      windowIds: [windowId(`window-${String(index + 1)}`)],
    })),
    desktopId: desktop,
    outputId: output,
    viewportOffset: 0,
  };
}
