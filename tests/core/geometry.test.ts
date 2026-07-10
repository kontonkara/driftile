import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { solveStripGeometry } from "../../src/core/geometry";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import type {
  ColumnWidth,
  LayoutContextSnapshot,
} from "../../src/core/layout-engine";

const output = outputId("DP-1");
const desktop = desktopId("desktop-1");
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
    expect(result.viewportOffset).toBe(936);
    expect(result.windows.map((window) => window.frame.x)).toEqual([
      -820, 132, 1084,
    ]);
    expect(result.windows[2]?.frame.x).toBe(1084);
    expect(
      (result.windows[2]?.frame.x ?? 0) + (result.windows[2]?.frame.width ?? 0),
    ).toBe(2020);
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

  it("reveals a column on the left without restoring an outer gap", () => {
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

    expect(result.viewportOffset).toBe(16);
    expect(result.windows[0]?.frame.x).toBe(100);
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
    { expectedOffset: 176, initialOffset: 175 },
    { expectedOffset: 1762, initialOffset: 1763 },
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
      expect(target?.frame.x).toBeGreaterThanOrEqual(100);
      expect(
        (target?.frame.x ?? 0) + (target?.frame.width ?? 0),
      ).toBeLessThanOrEqual(2020);
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
    columns: widths.map((width, index) => ({
      id: columnId(`column-${String(index + 1)}`),
      width,
      windowIds: [windowId(`window-${String(index + 1)}`)],
    })),
    desktopId: desktop,
    outputId: output,
    viewportOffset: 0,
  };
}
