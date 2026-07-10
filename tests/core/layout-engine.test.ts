import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import { LayoutEngine } from "../../src/core/layout-engine";

const output = outputId("DP-1");
const desktop = desktopId("desktop-1");

describe("LayoutEngine", () => {
  it("inserts a new column after the active column without activating it", () => {
    const engine = new LayoutEngine();

    engine.manageWindow({
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.5 },
      windowId: windowId("window-1"),
    });
    engine.activateWindow(windowId("window-1"));
    engine.manageWindow({
      columnId: columnId("column-2"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.33 },
      windowId: windowId("window-2"),
    });

    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-1",
      columns: [
        { id: "column-1", windowIds: ["window-1"] },
        { id: "column-2", windowIds: ["window-2"] },
      ],
    });
  });

  it("removes an empty column and selects its neighbor", () => {
    const engine = new LayoutEngine();

    for (const index of [1, 2]) {
      engine.manageWindow({
        columnId: columnId(`column-${String(index)}`),
        desktopId: desktop,
        outputId: output,
        width: { kind: "proportion", value: 0.5 },
        windowId: windowId(`window-${String(index)}`),
      });
    }
    engine.activateWindow(windowId("window-2"));

    engine.unmanageWindow(windowId("window-2"));

    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-1",
      columns: [{ id: "column-1" }],
    });
  });

  it("unmanages windows atomically across full and partial columns", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            width: { kind: "proportion", value: 0.5 },
            windowIds: [windowId("window-4"), windowId("window-5")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });

    expect(
      engine.unmanageWindows({
        desktopId: desktop,
        outputId: output,
        windowIds: [
          windowId("window-2"),
          windowId("window-3"),
          windowId("window-5"),
        ],
      }),
    ).toEqual({
      removedColumns: [{ id: "column-2", index: 1 }],
    });
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-3",
      columns: [
        {
          id: "column-1",
          width: { kind: "fixed", value: 400 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
          width: { kind: "proportion", value: 0.5 },
          windowIds: ["window-4"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 0,
    });
  });

  it("rejects an invalid batch unmanage without mutation", () => {
    const engine = new LayoutEngine();
    const otherOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    engine.manageWindow({
      columnId: columnId("column-2"),
      desktopId: desktop,
      outputId: otherOutput,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-2"),
    });
    const before = engine.snapshot(output, desktop);

    expect(
      engine.unmanageWindows({
        desktopId: desktop,
        outputId: output,
        windowIds: [windowId("window-1"), windowId("window-2")],
      }),
    ).toBeNull();
    expect(
      engine.unmanageWindows({
        desktopId: desktop,
        outputId: output,
        windowIds: [windowId("window-1"), windowId("window-1")],
      }),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("tracks activation for deterministic insertion", () => {
    const engine = new LayoutEngine();

    for (const index of [1, 2, 3]) {
      engine.manageWindow({
        columnId: columnId(`column-${String(index)}`),
        desktopId: desktop,
        outputId: output,
        width: { kind: "proportion", value: 0.25 },
        windowId: windowId(`window-${String(index)}`),
      });
    }

    expect(engine.activateWindow(windowId("window-1"))).toBe(true);
    expect(engine.activateWindow(windowId("window-1"))).toBe(false);
    expect(engine.activateWindow(windowId("unknown"))).toBe(false);
    engine.manageWindow({
      columnId: columnId("column-4"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.25 },
      windowId: windowId("window-4"),
    });

    expect(
      engine.snapshot(output, desktop).columns.map((column) => column.id),
    ).toEqual(["column-1", "column-4", "column-2", "column-3"]);
  });

  it("moves a whole column without changing its active state or width", () => {
    const engine = new LayoutEngine();
    const otherOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2"), windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-4")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 120,
    });
    engine.manageWindow({
      columnId: columnId("other-column"),
      desktopId: desktop,
      outputId: otherOutput,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("other-window"),
    });
    const otherBefore = engine.snapshot(otherOutput, desktop);

    expect(engine.moveActiveColumn(windowId("window-3"), "left")).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-2",
      columns: [
        {
          id: "column-2",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-2", "window-3"],
        },
        {
          id: "column-1",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-4"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 120,
    });
    expect(engine.snapshot(otherOutput, desktop)).toEqual(otherBefore);

    expect(engine.moveActiveColumn(windowId("window-2"), "right")).toBe(true);
    expect(
      engine.snapshot(output, desktop).columns.map((column) => column.id),
    ).toEqual(["column-1", "column-2", "column-3"]);
  });

  it("does not move a column past a context boundary", () => {
    const engine = new LayoutEngine();

    for (const index of [1, 2]) {
      engine.manageWindow({
        columnId: columnId(`column-${String(index)}`),
        desktopId: desktop,
        outputId: output,
        width: { kind: "fixed", value: 300 },
        windowId: windowId(`window-${String(index)}`),
      });
    }
    engine.activateWindow(windowId("window-1"));

    const before = engine.snapshot(output, desktop);
    expect(engine.moveActiveColumn(windowId("window-1"), "left")).toBe(false);
    expect(engine.moveActiveColumn(windowId("window-2"), "left")).toBe(false);
    expect(engine.moveActiveColumn(windowId("window-2"), "right")).toBe(false);
    expect(engine.moveActiveColumn(windowId("missing"), "left")).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("sets the active whole column width and returns an exact rollback value", () => {
    const engine = new LayoutEngine();
    const nextWidth: { kind: "fixed"; value: number } = {
      kind: "fixed",
      value: 420,
    };

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            width: { kind: "proportion", value: 0.5 },
            windowIds: [windowId("window-2"), windowId("window-3")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 80,
    });

    const previousWidth = engine.setActiveColumnWidth(
      windowId("window-3"),
      nextWidth,
    );

    expect(previousWidth).toEqual({ kind: "proportion", value: 0.5 });
    nextWidth.value = 900;
    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-2",
      columns: [
        { id: "column-1", width: { kind: "fixed", value: 300 } },
        { id: "column-2", width: { kind: "fixed", value: 420 } },
      ],
      viewportOffset: 80,
    });
    expect(
      previousWidth &&
        engine.setActiveColumnWidth(windowId("window-2"), previousWidth),
    ).toEqual({ kind: "fixed", value: 420 });
    expect(engine.snapshot(output, desktop).columns[1]?.width).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(
      engine.setActiveColumnWidth(windowId("window-1"), {
        kind: "fixed",
        value: 500,
      }),
    ).toBeNull();
    expect(
      engine.setActiveColumnWidth(windowId("window-2"), {
        kind: "proportion",
        value: 0.5,
      }),
    ).toBeNull();
    expect(() =>
      engine.setActiveColumnWidth(windowId("window-2"), {
        kind: "fixed",
        value: 0,
      }),
    ).toThrow("column width must be finite and greater than zero");
    expect(engine.snapshot(output, desktop).columns[1]?.width).toEqual({
      kind: "proportion",
      value: 0.5,
    });
  });

  it("stores viewport offsets independently for each context", () => {
    const engine = new LayoutEngine();
    const secondOutput = outputId("HDMI-A-1");

    for (const [index, contextOutput] of [output, secondOutput].entries()) {
      engine.manageWindow({
        columnId: columnId(`column-${String(index + 1)}`),
        desktopId: desktop,
        outputId: contextOutput,
        width: { kind: "proportion", value: 0.5 },
        windowId: windowId(`window-${String(index + 1)}`),
      });
    }

    expect(engine.setViewportOffset(output, desktop, 936)).toBe(true);

    expect(engine.snapshot(output, desktop).viewportOffset).toBe(936);
    expect(engine.snapshot(secondOutput, desktop).viewportOffset).toBe(0);
    expect(engine.setViewportOffset(outputId("unknown"), desktop, 10)).toBe(
      false,
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid viewport offset of %s",
    (viewportOffset) => {
      const engine = new LayoutEngine();

      engine.manageWindow({
        columnId: columnId("column-1"),
        desktopId: desktop,
        outputId: output,
        width: { kind: "proportion", value: 0.5 },
        windowId: windowId("window-1"),
      });

      expect(() =>
        engine.setViewportOffset(output, desktop, viewportOffset),
      ).toThrow(RangeError);
      expect(engine.snapshot(output, desktop).viewportOffset).toBe(0);
    },
  );

  it("finds adjacent windows without crossing context boundaries", () => {
    const engine = new LayoutEngine();

    for (const index of [1, 2, 3]) {
      engine.manageWindow({
        columnId: columnId(`column-${String(index)}`),
        desktopId: desktop,
        outputId: output,
        width: { kind: "proportion", value: 0.33 },
        windowId: windowId(`window-${String(index)}`),
      });
    }

    expect(engine.adjacentWindow(windowId("window-2"), "left")).toBe(
      "window-1",
    );
    expect(engine.adjacentWindow(windowId("window-2"), "right")).toBe(
      "window-3",
    );
    expect(engine.adjacentWindow(windowId("window-1"), "left")).toBeNull();
    expect(engine.adjacentWindow(windowId("window-3"), "right")).toBeNull();
    expect(engine.adjacentWindow(windowId("unknown"), "right")).toBeNull();
  });

  it("rejects duplicate window and column identifiers", () => {
    const engine = new LayoutEngine();
    const baseCommand = {
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion" as const, value: 0.5 },
      windowId: windowId("window-1"),
    };

    expect(engine.manageWindow(baseCommand)).toBe(true);
    expect(engine.manageWindow(baseCommand)).toBe(false);
    expect(
      engine.manageWindow({
        ...baseCommand,
        windowId: windowId("window-2"),
      }),
    ).toBe(false);
    expect(engine.snapshot(output, desktop).columns).toHaveLength(1);

    expect(engine.unmanageWindow(baseCommand.windowId)).toBe(true);
    expect(
      engine.manageWindow({
        ...baseCommand,
        windowId: windowId("window-2"),
      }),
    ).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid column width of %s",
    (value) => {
      const engine = new LayoutEngine();

      expect(() =>
        engine.manageWindow({
          columnId: columnId("column-1"),
          desktopId: desktop,
          outputId: output,
          width: { kind: "fixed", value },
          windowId: windowId("window-1"),
        }),
      ).toThrow(RangeError);
      expect(engine.snapshot(output, desktop).columns).toHaveLength(0);
    },
  );

  it("does not expose mutable width state", () => {
    const engine = new LayoutEngine();
    const width = { kind: "fixed" as const, value: 800 };

    engine.manageWindow({
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width,
      windowId: windowId("window-1"),
    });
    width.value = 600;

    const snapshot = engine.snapshot(output, desktop);
    const snapshotWidth = snapshot.columns[0]?.width as { value: number };
    snapshotWidth.value = 400;

    expect(engine.snapshot(output, desktop).columns[0]?.width.value).toBe(800);
  });

  it("never changes existing widths when adding columns", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 10_000 }), {
          minLength: 1,
          maxLength: 100,
        }),
        (values) => {
          const engine = new LayoutEngine();
          const expectedWidths: number[] = [];

          for (const [index, value] of values.entries()) {
            const width = (value % 90) / 100 + 0.1;
            expectedWidths.push(width);
            engine.manageWindow({
              columnId: columnId(`column-${String(index)}`),
              desktopId: desktop,
              outputId: output,
              width: { kind: "proportion", value: width },
              windowId: windowId(`window-${String(index)}`),
            });

            expect(
              engine
                .snapshot(output, desktop)
                .columns.map((column) => column.width.value),
            ).toEqual(expectedWidths);
          }
        },
      ),
    );
  });

  it("removes and restores whole columns at their exact positions", () => {
    const engine = new LayoutEngine();

    expect(
      engine.restoreColumns({
        activeColumnId: columnId("column-3"),
        columns: [
          {
            column: {
              id: columnId("column-1"),
              width: { kind: "fixed", value: 240 },
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-2"),
              width: { kind: "proportion", value: 0.4 },
              windowIds: [windowId("window-3")],
            },
            index: 1,
          },
          {
            column: {
              id: columnId("column-3"),
              width: { kind: "fixed", value: 360 },
              windowIds: [windowId("window-4")],
            },
            index: 2,
          },
        ],
        desktopId: desktop,
        outputId: output,
        viewportOffset: 120,
      }),
    ).toBe(true);

    expect(
      engine.removeColumns({
        columnIds: [columnId("column-1"), columnId("column-3")],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-2",
      columns: [{ id: "column-2", windowIds: ["window-3"] }],
    });

    expect(
      engine.restoreColumns({
        activeColumnId: columnId("column-3"),
        columns: [
          {
            column: {
              id: columnId("column-1"),
              width: { kind: "fixed", value: 240 },
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-3"),
              width: { kind: "fixed", value: 360 },
              windowIds: [windowId("window-4")],
            },
            index: 2,
          },
        ],
        desktopId: desktop,
        outputId: output,
        viewportOffset: 120,
      }),
    ).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-3",
      columns: [
        {
          id: "column-1",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column-2",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-3"],
        },
        {
          id: "column-3",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-4"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 120,
    });
  });

  it("does not mutate layout when an exact column restoration is invalid", () => {
    const engine = new LayoutEngine();

    engine.manageWindow({
      columnId: columnId("column-2"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.5 },
      windowId: windowId("window-2"),
    });
    const before = engine.snapshot(output, desktop);

    expect(
      engine.restoreColumns({
        columns: [
          {
            column: {
              id: columnId("column-1"),
              width: { kind: "proportion", value: 0.5 },
              windowIds: [windowId("window-1")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-3"),
              width: { kind: "proportion", value: 0.5 },
              windowIds: [windowId("window-3")],
            },
            index: 0,
          },
        ],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });
});
