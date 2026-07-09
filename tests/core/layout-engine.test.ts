import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import { LayoutEngine } from "../../src/core/layout-engine";

const output = outputId("DP-1");
const desktop = desktopId("desktop-1");

describe("LayoutEngine", () => {
  it("inserts a new column after the active column", () => {
    const engine = new LayoutEngine();

    engine.manageWindow({
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.5 },
      windowId: windowId("window-1"),
    });
    engine.manageWindow({
      columnId: columnId("column-2"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.33 },
      windowId: windowId("window-2"),
    });

    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-2",
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

    engine.unmanageWindow(windowId("window-2"));

    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "column-1",
      columns: [{ id: "column-1" }],
    });
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
});
