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
