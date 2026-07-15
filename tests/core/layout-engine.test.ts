import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import {
  LayoutEngine,
  type ColumnStackEditPreview,
  type ColumnTransferPreview,
  type DetachedWindowPlacement,
  type StackEditRollback,
  type WindowAttachPreview,
  type WindowDetachPreview,
  type WindowTransferPreview,
} from "../../src/core/layout-engine";

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
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-3"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            presentation: "stacked",
            selectedWindowId: windowId("window-4"),
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
          presentation: "stacked",
          selectedWindowId: "window-1",
          width: { kind: "fixed", value: 400 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
          presentation: "stacked",
          selectedWindowId: "window-4",
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
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2"), windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            presentation: "stacked",
            selectedWindowId: windowId("window-4"),
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
          presentation: "stacked",
          selectedWindowId: "window-2",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-2", "window-3"],
        },
        {
          id: "column-1",
          presentation: "stacked",
          selectedWindowId: "window-1",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
          presentation: "stacked",
          selectedWindowId: "window-4",
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

  it("resolves edge columns and reorders the active column with exact rollback", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2"), windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            presentation: "stacked",
            selectedWindowId: windowId("window-4"),
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
    const before = engine.snapshot(output, desktop);

    expect(engine.edgeWindow(windowId("window-3"), "first")).toBe("window-1");
    expect(engine.edgeWindow(windowId("window-3"), "last")).toBe("window-4");
    expect(engine.edgeWindow(windowId("window-1"), "first")).toBeNull();
    expect(engine.edgeWindow(windowId("missing"), "last")).toBeNull();

    const first = engine.moveActiveColumnToEdge(windowId("window-3"), "first");
    expect(first?.kind).toBe("reorder");
    expect(
      engine.snapshot(output, desktop).columns.map((column) => column.id),
    ).toEqual(["column-2", "column-1", "column-3"]);
    expect(first && engine.rollbackStackEdit(first.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);

    const last = engine.moveActiveColumnToEdge(windowId("window-2"), "last");
    expect(last?.kind).toBe("reorder");
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      columns: [before.columns[0], before.columns[2], before.columns[1]],
    });
    expect(last && engine.discardStackEditRollback(last.rollback)).toBe(true);
    expect(last && engine.rollbackStackEdit(last.rollback)).toBe(false);
    expect(
      engine.moveActiveColumnToEdge(windowId("window-2"), "last"),
    ).toBeNull();
    expect(
      engine.moveActiveColumnToEdge(windowId("window-1"), "first"),
    ).toBeNull();
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
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-2"),
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

  it("mutates complete window-height state and rolls it back exactly", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 70,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 1.5 },
      { clientHeight: 360, kind: "fixed" },
    ]);

    expect(edit).not.toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      columns: [
        {
          ...before.columns[0],
          windowHeights: [
            { kind: "auto", weight: 1.5 },
            { clientHeight: 360, kind: "fixed" },
          ],
        },
      ],
    });
    expect(edit && engine.rollbackWindowHeightEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(edit && engine.rollbackWindowHeightEdit(edit.rollback)).toBe(false);

    const stale = engine.setActiveColumnWindowHeights(windowId("window-1"), [
      { kind: "auto", weight: 2 },
      { index: 1, kind: "preset" },
    ]);
    expect(stale).not.toBeNull();
    expect(
      engine.setActiveColumnWidth(windowId("window-1"), {
        kind: "fixed",
        value: 500,
      }),
    ).toEqual({ kind: "fixed", value: 420 });
    const changed = engine.snapshot(output, desktop);
    expect(stale && engine.rollbackWindowHeightEdit(stale.rollback)).toBe(
      false,
    );
    expect(engine.snapshot(output, desktop)).toEqual(changed);
  });

  it("validates and compacts serialized window-height state", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });

    expect(
      engine.setActiveColumnWindowHeights(windowId("window-1"), [
        { kind: "auto", weight: 1 },
      ]),
    ).toBeNull();
    expect(() =>
      engine.setActiveColumnWindowHeights(windowId("window-1"), [
        { clientHeight: 200, kind: "fixed" },
        { index: 0, kind: "preset" },
      ]),
    ).toThrow("at most one non-automatic");
    expect(() =>
      engine.setActiveColumnWindowHeights(windowId("window-1"), [
        { kind: "auto", weight: 0 },
        { kind: "auto", weight: 1 },
      ]),
    ).toThrow("window height state is invalid");

    const edit = engine.setActiveColumnWindowHeights(windowId("window-1"), [
      { kind: "auto", weight: 2 },
      { clientHeight: 240, kind: "fixed" },
    ]);
    expect(edit).not.toBeNull();
    const reset = engine.setActiveColumnWindowHeights(windowId("window-1"), [
      { kind: "auto", weight: 1 },
      { kind: "auto", weight: 1 },
    ]);
    expect(reset).not.toBeNull();
    expect(engine.snapshot(output, desktop).columns[0]).not.toHaveProperty(
      "windowHeights",
    );
  });

  it("tracks tabbed selection and accepts an initial singleton presentation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("stack"),
      columns: [
        {
          column: {
            id: columnId("stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 480 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 360, kind: "fixed" },
            ],
            windowIds: [windowId("window-a"), windowId("window-b")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const dormantHeights = JSON.stringify(
      engine.snapshot(output, desktop).columns[0]?.windowHeights,
    );

    expect(engine.activateWindow(windowId("window-b"))).toBe(true);
    expect(engine.setColumnPresentation(windowId("window-a"), "tabbed")).toBe(
      "stacked",
    );
    expect(engine.snapshot(output, desktop).columns[0]).toMatchObject({
      presentation: "tabbed",
      selectedWindowId: "window-b",
    });
    expect(engine.tabIndicator(windowId("window-b"))).toEqual({
      selectedIndex: 1,
      tabCount: 2,
    });
    expect(engine.tabIndicator(windowId("window-a"))).toBeNull();
    expect(
      engine.setActiveColumnWindowHeights(windowId("window-b"), [
        { kind: "auto", weight: 1 },
        { kind: "auto", weight: 1 },
      ]),
    ).toBeNull();
    expect(engine.toggleActiveColumnPresentation(windowId("window-b"))).toBe(
      "stacked",
    );
    expect(engine.toggleActiveColumnPresentation(windowId("window-b"))).toBe(
      "tabbed",
    );
    expect(
      JSON.stringify(
        engine.snapshot(output, desktop).columns[0]?.windowHeights,
      ),
    ).toBe(dormantHeights);

    engine.manageWindow({
      columnId: columnId("single"),
      desktopId: desktop,
      outputId: output,
      presentation: "tabbed",
      width: { kind: "fixed", value: 320 },
      windowId: windowId("single-window"),
    });
    expect(engine.snapshot(output, desktop).columns[1]).toMatchObject({
      presentation: "tabbed",
      selectedWindowId: "single-window",
      windowIds: ["single-window"],
    });
    expect(engine.tabIndicator(windowId("single-window"))).toBeNull();
  });

  it("keeps destination and depleted source presentations", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("source"),
            presentation: "tabbed",
            selectedWindowId: windowId("source-b"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("source-a"),
              windowId("source-b"),
              windowId("source-c"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target"),
            presentation: "stacked",
            selectedWindowId: windowId("target-b"),
            width: { kind: "fixed", value: 520 },
            windowIds: [windowId("target-a"), windowId("target-b")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });

    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("source-b"),
        columnId("target"),
      )?.kind,
    ).toBe("insert");
    expect(engine.snapshot(output, desktop).columns).toMatchObject([
      {
        presentation: "tabbed",
        selectedWindowId: "source-c",
        windowIds: ["source-a", "source-c"],
      },
      {
        presentation: "stacked",
        selectedWindowId: "source-b",
        windowIds: ["target-a", "target-b", "source-b"],
      },
    ]);

    expect(engine.activateWindow(windowId("source-c"))).toBe(true);
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("source-c"),
        columnId("target"),
      )?.kind,
    ).toBe("insert");
    expect(engine.snapshot(output, desktop).columns).toMatchObject([
      {
        presentation: "tabbed",
        selectedWindowId: "source-a",
        windowIds: ["source-a"],
      },
      {
        presentation: "stacked",
        selectedWindowId: "source-c",
        windowIds: ["target-a", "target-b", "source-b", "source-c"],
      },
    ]);
    expect(engine.tabIndicator(windowId("source-a"))).toBeNull();
  });

  it("preserves a tabbed singleton through detachment and attachment", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("stack"),
      columns: [
        {
          column: {
            id: columnId("stack"),
            presentation: "tabbed",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 480 },
            windowIds: [windowId("window-a"), windowId("window-b")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const staleDetach = engine.previewWindowDetach(windowId("window-a"));

    expect(staleDetach?.placement.columnPresentation).toBe("tabbed");
    expect(staleDetach?.layout.columns[0]).toMatchObject({
      presentation: "tabbed",
      selectedWindowId: "window-b",
    });
    expect(engine.selectWindowInColumn(windowId("window-b"))).toBe(true);
    expect(staleDetach && engine.commitWindowDetach(staleDetach)).toBe(false);
    expect(engine.selectWindowInColumn(windowId("window-a"))).toBe(true);
    const detached = engine.previewWindowDetach(windowId("window-a"));
    expect(detached && engine.commitWindowDetach(detached)).toBe(true);
    expect(engine.tabIndicator(windowId("window-b"))).toBeNull();
    const survivingAttach =
      detached && engine.previewWindowAttach(detached.placement);
    expect(survivingAttach?.layout.columns[0]).toMatchObject({
      presentation: "tabbed",
      selectedWindowId: "window-a",
    });
    expect(survivingAttach && engine.commitWindowAttach(survivingAttach)).toBe(
      true,
    );
    expect(engine.tabIndicator(windowId("window-a"))).toEqual({
      selectedIndex: 0,
      tabCount: 2,
    });

    const recreation = new LayoutEngine();
    expect(
      recreation.restoreColumns({
        activeColumnId: columnId("recreated"),
        columns: [
          {
            column: {
              id: columnId("recreated"),
              presentation: "tabbed",
              selectedWindowId: windowId("only-window"),
              width: { kind: "fixed", value: 360 },
              windowIds: [windowId("only-window")],
            },
            index: 0,
          },
        ],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    expect(recreation.snapshot(output, desktop).columns[0]).toMatchObject({
      presentation: "tabbed",
      selectedWindowId: "only-window",
      windowIds: ["only-window"],
    });
    expect(recreation.tabIndicator(windowId("only-window"))).toBeNull();
  });

  it("rebases a rollback over a newer same-column selection", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("stack"),
      columns: [
        {
          column: {
            id: columnId("stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 480 },
            windowIds: [
              windowId("window-a"),
              windowId("window-b"),
              windowId("window-c"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const edit = engine.reinsertWindow(windowId("window-b"), {
      position: "after",
      targetWindowId: windowId("window-c"),
    });

    expect(edit?.kind).toBe("reorder");
    expect(engine.activateWindow(windowId("window-c"))).toBe(true);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop).columns[0]).toMatchObject({
      selectedWindowId: "window-c",
      windowIds: ["window-a", "window-b", "window-c"],
    });
  });

  it("keeps height state through reorder, floating, and whole-column transfer", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const edit = engine.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 2 },
      { clientHeight: 320, kind: "fixed" },
    ]);
    expect(edit).not.toBeNull();
    expect(edit && engine.discardWindowHeightEditRollback(edit.rollback)).toBe(
      true,
    );
    const before = engine.snapshot(output, desktop);
    const reorder = engine.moveActiveWindowInColumn(windowId("window-2"), "up");

    expect(engine.snapshot(output, desktop).columns[0]).toMatchObject({
      windowHeights: [
        { clientHeight: 320, kind: "fixed" },
        { kind: "auto", weight: 2 },
      ],
      windowIds: ["window-2", "window-1"],
    });
    expect(reorder && engine.rollbackStackEdit(reorder.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);

    const detach = engine.previewWindowDetach(windowId("window-2"));
    expect(detach?.placement.windowHeight).toEqual({
      clientHeight: 320,
      kind: "fixed",
    });
    expect(detach?.layout.columns[0]).toMatchObject({
      windowHeights: [{ kind: "auto", weight: 2 }],
      windowIds: ["window-1"],
    });
    expect(detach && engine.commitWindowDetach(detach)).toBe(true);

    const attach = detach && engine.previewWindowAttach(detach.placement);
    expect(attach?.layout).toEqual({
      ...before,
      columns: before.columns.map((column) => ({
        ...column,
        selectedWindowId: windowId("window-2"),
      })),
    });
    expect(attach && engine.commitWindowAttach(attach)).toBe(true);

    const parkedColumn = engine.snapshot(output, desktop).columns[0];

    if (!parkedColumn) {
      throw new Error("expected a parked column fixture");
    }

    expect(
      engine.removeColumns({
        columnIds: [parkedColumn.id],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    expect(
      engine.restoreColumns({
        activeColumnId: parkedColumn.id,
        columns: [{ column: parkedColumn, index: 0 }],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      columns: before.columns.map((column) => ({
        ...column,
        selectedWindowId: windowId("window-2"),
      })),
    });

    const transfer = engine.previewColumnTransfer(windowId("window-2"), {
      columnId: columnId("column-moved"),
      desktopId: desktop,
      outputId: targetOutput,
    });
    expect(transfer?.targetLayout.columns[0]).toMatchObject({
      id: "column-moved",
      windowHeights: [
        { kind: "auto", weight: 2 },
        { clientHeight: 320, kind: "fixed" },
      ],
      windowIds: ["window-1", "window-2"],
    });
    expect(transfer && engine.commitColumnTransfer(transfer)).toBe(true);
    expect(engine.snapshot(targetOutput, desktop).columns[0]).toEqual(
      transfer?.targetLayout.columns[0],
    );
  });

  it("resets a single moved window height without disturbing survivors", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const edit = engine.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 2 },
      { clientHeight: 320, kind: "fixed" },
    ]);
    expect(edit && engine.discardWindowHeightEditRollback(edit.rollback)).toBe(
      true,
    );

    const extracted = engine.moveActiveWindow(
      windowId("window-2"),
      "right",
      columnId("column-extracted"),
    );
    expect(extracted?.kind).toBe("extract");
    expect(engine.snapshot(output, desktop).columns).toMatchObject([
      { windowIds: ["window-1"] },
      { windowIds: ["window-2"] },
    ]);
    expect(engine.snapshot(output, desktop).columns[0]).not.toHaveProperty(
      "windowHeights",
    );
    expect(engine.snapshot(output, desktop).columns[1]).not.toHaveProperty(
      "windowHeights",
    );

    const fixedSingleton = engine.setActiveColumnWindowHeights(
      windowId("window-2"),
      [{ clientHeight: 410, kind: "fixed" }],
    );
    expect(
      fixedSingleton &&
        engine.discardWindowHeightEditRollback(fixedSingleton.rollback),
    ).toBe(true);
    const consumed = engine.moveActiveWindow(
      windowId("window-2"),
      "left",
      columnId("unused"),
    );
    expect(consumed?.kind).toBe("merge");
    expect(engine.snapshot(output, desktop).columns[0]).not.toHaveProperty(
      "windowHeights",
    );
    expect(consumed && engine.rollbackStackEdit(consumed.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop).columns[1]).toMatchObject({
      windowHeights: [{ clientHeight: 410, kind: "fixed" }],
      windowIds: ["window-2"],
    });

    const singleTransfer = engine.previewWindowTransfer(windowId("window-2"), {
      columnId: columnId("column-transferred"),
      desktopId: desktop,
      outputId: targetOutput,
    });
    expect(singleTransfer?.targetLayout.columns[0]).not.toHaveProperty(
      "windowHeights",
    );
  });

  it("moves a singleton into an adjacent stack and rolls back exactly", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            presentation: "stacked",
            selectedWindowId: windowId("window-3"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-3")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 120,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.moveActiveWindow(
      windowId("window-2"),
      "left",
      columnId("unused"),
    );

    expect(edit?.kind).toBe("merge");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-1",
      columns: [
        {
          id: "column-1",
          presentation: "stacked",
          selectedWindowId: "window-2",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column-3",
          presentation: "stacked",
          selectedWindowId: "window-3",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-3"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 120,
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(false);
  });

  it("extracts an active stack member with the requested presentation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [
              windowId("window-1"),
              windowId("window-2"),
              windowId("window-3"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-4"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("window-4")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 40,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.moveActiveWindow(
      windowId("window-2"),
      "right",
      columnId("column:split:window-2"),
      "tabbed",
    );

    expect(edit?.kind).toBe("extract");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column:split:window-2",
      columns: [
        {
          id: "column-1",
          presentation: "stacked",
          selectedWindowId: "window-1",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-1", "window-3"],
        },
        {
          id: "column:split:window-2",
          presentation: "tabbed",
          selectedWindowId: "window-2",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-2"],
        },
        {
          id: "column-2",
          presentation: "stacked",
          selectedWindowId: "window-4",
          width: { kind: "fixed", value: 320 },
          windowIds: ["window-4"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 40,
    });
    expect(engine.tabIndicator(windowId("window-2"))).toBeNull();
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("inserts a singleton active window into a far-right stack and rolls back once", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-source"),
      columns: [
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("window-source"),
            width: { kind: "fixed", value: 180 },
            windowIds: [windowId("window-source")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-middle"),
            presentation: "stacked",
            selectedWindowId: windowId("window-middle"),
            width: { kind: "fixed", value: 260 },
            windowIds: [windowId("window-middle")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-target"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-1"),
            width: { kind: "proportion", value: 0.6 },
            windowIds: [
              windowId("window-target-1"),
              windowId("window-target-2"),
            ],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 145,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.insertActiveWindowIntoColumn(
      windowId("window-source"),
      columnId("column-target"),
    );

    expect(edit?.kind).toBe("merge");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-target",
      columns: [
        {
          id: "column-middle",
          presentation: "stacked",
          selectedWindowId: "window-middle",
          width: { kind: "fixed", value: 260 },
          windowIds: ["window-middle"],
        },
        {
          id: "column-target",
          presentation: "stacked",
          selectedWindowId: "window-source",
          width: { kind: "proportion", value: 0.6 },
          windowIds: ["window-target-1", "window-target-2", "window-source"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 145,
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(false);
  });

  it("inserts a middle active stack member into a far-left stack", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-source"),
      columns: [
        {
          column: {
            id: columnId("column-target"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-1"),
            width: { kind: "fixed", value: 480 },
            windowIds: [
              windowId("window-target-1"),
              windowId("window-target-2"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-middle"),
            presentation: "stacked",
            selectedWindowId: windowId("window-middle"),
            width: { kind: "proportion", value: 0.25 },
            windowIds: [windowId("window-middle")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("window-source-1"),
            width: { kind: "fixed", value: 320 },
            windowIds: [
              windowId("window-source-1"),
              windowId("window-source-2"),
              windowId("window-source-3"),
            ],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 75,
    });
    const edit = engine.insertActiveWindowIntoColumn(
      windowId("window-source-2"),
      columnId("column-target"),
    );

    expect(edit?.kind).toBe("insert");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-target",
      columns: [
        {
          id: "column-target",
          presentation: "stacked",
          selectedWindowId: "window-source-2",
          width: { kind: "fixed", value: 480 },
          windowIds: ["window-target-1", "window-target-2", "window-source-2"],
        },
        {
          id: "column-middle",
          presentation: "stacked",
          selectedWindowId: "window-middle",
          width: { kind: "proportion", value: 0.25 },
          windowIds: ["window-middle"],
        },
        {
          id: "column-source",
          presentation: "stacked",
          selectedWindowId: "window-source-1",
          width: { kind: "fixed", value: 320 },
          windowIds: ["window-source-1", "window-source-3"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 75,
    });
  });

  it("rejects invalid direct stack insertions without mutation", () => {
    const engine = new LayoutEngine();
    const otherOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("column-source"),
      columns: [
        {
          column: {
            id: columnId("column-target"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("window-target-1"),
              windowId("window-target-2"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("window-source-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [
              windowId("window-source-1"),
              windowId("window-source-2"),
            ],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-singleton"),
            presentation: "stacked",
            selectedWindowId: windowId("window-singleton"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-singleton")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 55,
    });
    engine.restoreColumns({
      activeColumnId: columnId("column-foreign"),
      columns: [
        {
          column: {
            id: columnId("column-foreign"),
            presentation: "stacked",
            selectedWindowId: windowId("window-foreign-1"),
            width: { kind: "fixed", value: 360 },
            windowIds: [
              windowId("window-foreign-1"),
              windowId("window-foreign-2"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: otherOutput,
    });
    const before = engine.snapshot(output, desktop);
    const foreignBefore = engine.snapshot(otherOutput, desktop);

    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-missing"),
        columnId("column-target"),
      ),
    ).toBeNull();
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-source-1"),
        columnId("column-source"),
      ),
    ).toBeNull();
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-source-1"),
        columnId("column-missing"),
      ),
    ).toBeNull();
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-source-1"),
        columnId("column-singleton"),
      ),
    ).toBeNull();
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-source-1"),
        columnId("column-foreign"),
      ),
    ).toBeNull();
    expect(
      engine.insertActiveWindowIntoColumn(
        windowId("window-singleton"),
        columnId("column-target"),
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(engine.snapshot(otherOutput, desktop)).toEqual(foreignBefore);
  });

  it("previews consuming the top right member at the active column bottom", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-active"),
      columns: [
        {
          column: {
            id: columnId("column-active"),
            presentation: "stacked",
            selectedWindowId: windowId("active-top"),
            width: { kind: "fixed", value: 440 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 260, kind: "fixed" },
            ],
            windowIds: [windowId("active-top"), windowId("active-bottom")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("source-top"),
            width: { kind: "proportion", value: 0.65 },
            windowHeights: [
              { clientHeight: 310, kind: "fixed" },
              { kind: "auto", weight: 4 },
            ],
            windowIds: [windowId("source-top"), windowId("source-bottom")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-trailing"),
            presentation: "stacked",
            selectedWindowId: windowId("trailing"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("trailing")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -135,
    });
    const before = engine.snapshot(output, desktop);
    const preview = engine.previewConsumeWindowIntoColumn(
      windowId("active-bottom"),
    );

    expect(preview).toMatchObject({
      kind: "consume",
      movedWindowId: "source-top",
    });
    expect(preview?.layout).toEqual({
      activeColumnId: "column-active",
      columns: [
        {
          id: "column-active",
          presentation: "stacked",
          selectedWindowId: "active-top",
          width: { kind: "fixed", value: 440 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { clientHeight: 260, kind: "fixed" },
            { kind: "auto", weight: 1 },
          ],
          windowIds: ["active-top", "active-bottom", "source-top"],
        },
        {
          id: "column-source",
          presentation: "stacked",
          selectedWindowId: "source-bottom",
          width: { kind: "proportion", value: 0.65 },
          windowIds: ["source-bottom"],
        },
        {
          id: "column-trailing",
          presentation: "stacked",
          selectedWindowId: "trailing",
          width: { kind: "fixed", value: 280 },
          windowIds: ["trailing"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: -135,
    });
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(preview && engine.commitColumnStackEdit(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview?.layout);
    expect(preview && engine.commitColumnStackEdit(preview)).toBe(false);
  });

  it("removes a consumed singleton source without changing the active column", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-active"),
      columns: [
        {
          column: {
            id: columnId("column-active"),
            presentation: "stacked",
            selectedWindowId: windowId("active"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("active")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("source"),
            width: { kind: "fixed", value: 720 },
            windowHeights: [{ clientHeight: 360, kind: "fixed" }],
            windowIds: [windowId("source")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-trailing"),
            presentation: "stacked",
            selectedWindowId: windowId("trailing"),
            width: { kind: "fixed", value: 260 },
            windowIds: [windowId("trailing")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 91,
    });
    const preview = engine.previewConsumeWindowIntoColumn(windowId("active"));

    expect(preview?.layout).toEqual({
      activeColumnId: "column-active",
      columns: [
        {
          id: "column-active",
          presentation: "stacked",
          selectedWindowId: "active",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["active", "source"],
        },
        {
          id: "column-trailing",
          presentation: "stacked",
          selectedWindowId: "trailing",
          width: { kind: "fixed", value: 260 },
          windowIds: ["trailing"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 91,
    });
  });

  it("rolls back a stack edit while preserving a newer active column", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-active"),
      columns: [
        {
          column: {
            id: columnId("column-active"),
            presentation: "stacked",
            selectedWindowId: windowId("active"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("active")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("source-top"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("source-top"), windowId("source-bottom")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-trailing"),
            presentation: "stacked",
            selectedWindowId: windowId("trailing"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("trailing")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -40,
    });
    const before = engine.snapshot(output, desktop);
    const preview = engine.previewConsumeWindowIntoColumn(windowId("active"));
    const edit = preview ? engine.applyColumnStackEdit(preview) : null;

    expect(edit?.kind).toBe("consume");
    expect(engine.activateWindow(windowId("trailing"))).toBe(true);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      activeColumnId: "column-trailing",
    });
  });

  it("rebases a stack rollback across an authoritative window removal", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-source"),
      columns: [
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("earlier"),
            width: { kind: "proportion", value: 0.45 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 220, kind: "fixed" },
              { kind: "auto", weight: 5 },
            ],
            windowIds: [
              windowId("earlier"),
              windowId("removed"),
              windowId("moved"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-trailing"),
            presentation: "stacked",
            selectedWindowId: windowId("trailing"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("trailing")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -40,
    });
    const preview = engine.previewExpelWindowFromColumn(
      windowId("moved"),
      columnId("column-moved"),
    );
    const edit = preview ? engine.applyColumnStackEdit(preview) : null;

    expect(edit?.kind).toBe("expel");
    expect(engine.unmanageWindow(windowId("removed"))).toBe(true);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column-source",
      columns: [
        {
          id: "column-source",
          presentation: "stacked",
          selectedWindowId: "earlier",
          width: { kind: "proportion", value: 0.45 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 5 },
          ],
          windowIds: ["earlier", "moved"],
        },
        {
          id: "column-trailing",
          presentation: "stacked",
          selectedWindowId: "trailing",
          width: { kind: "fixed", value: 240 },
          windowIds: ["trailing"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: -40,
    });
  });

  it("rejects stack rollback after a surviving member is recolumned", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-source"),
      columns: [
        {
          column: {
            id: columnId("column-source"),
            presentation: "stacked",
            selectedWindowId: windowId("survivor"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("survivor"),
              windowId("middle"),
              windowId("moved"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-trailing"),
            presentation: "stacked",
            selectedWindowId: windowId("trailing"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("trailing")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const preview = engine.previewExpelWindowFromColumn(
      windowId("moved"),
      columnId("column-moved"),
    );
    const outer = preview ? engine.applyColumnStackEdit(preview) : null;
    const nested = engine.moveActiveWindow(
      windowId("survivor"),
      "right",
      columnId("column-survivor"),
    );

    expect(outer?.kind).toBe("expel");
    expect(nested?.kind).toBe("extract");
    expect(nested && engine.discardStackEditRollback(nested.rollback)).toBe(
      true,
    );
    const recolumned = engine.snapshot(output, desktop);
    expect(outer && engine.rollbackStackEdit(outer.rollback)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(recolumned);
  });

  it("previews expelling the bottom member with the requested presentation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-active"),
      columns: [
        {
          column: {
            id: columnId("column-leading"),
            presentation: "stacked",
            selectedWindowId: windowId("leading"),
            width: { kind: "fixed", value: 250 },
            windowIds: [windowId("leading")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-active"),
            presentation: "stacked",
            selectedWindowId: windowId("source-top"),
            width: { kind: "proportion", value: 0.45 },
            windowHeights: [
              { kind: "auto", weight: 3 },
              { clientHeight: 285, kind: "fixed" },
            ],
            windowIds: [windowId("source-top"), windowId("source-bottom")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-existing-right"),
            presentation: "stacked",
            selectedWindowId: windowId("existing-right"),
            width: { kind: "fixed", value: 610 },
            windowIds: [windowId("existing-right")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 147,
    });
    const before = engine.snapshot(output, desktop);
    const preview = engine.previewExpelWindowFromColumn(
      windowId("source-top"),
      columnId("column-expelled"),
      "tabbed",
    );

    expect(preview).toMatchObject({
      kind: "expel",
      movedWindowId: "source-bottom",
    });
    expect(preview?.layout).toEqual({
      activeColumnId: "column-active",
      columns: [
        {
          id: "column-leading",
          presentation: "stacked",
          selectedWindowId: "leading",
          width: { kind: "fixed", value: 250 },
          windowIds: ["leading"],
        },
        {
          id: "column-active",
          presentation: "stacked",
          selectedWindowId: "source-top",
          width: { kind: "proportion", value: 0.45 },
          windowIds: ["source-top"],
        },
        {
          id: "column-expelled",
          presentation: "tabbed",
          selectedWindowId: "source-bottom",
          width: { kind: "proportion", value: 0.45 },
          windowIds: ["source-bottom"],
        },
        {
          id: "column-existing-right",
          presentation: "stacked",
          selectedWindowId: "existing-right",
          width: { kind: "fixed", value: 610 },
          windowIds: ["existing-right"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 147,
    });
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(preview && engine.commitColumnStackEdit(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview?.layout);
  });

  it("rejects invalid, discarded, foreign, and stale column stack edits", () => {
    const engine = new LayoutEngine();
    const foreign = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-active"),
      columns: [
        {
          column: {
            id: columnId("column-active"),
            presentation: "stacked",
            selectedWindowId: windowId("active-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("active-1"), windowId("active-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-right"),
            presentation: "stacked",
            selectedWindowId: windowId("right"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("right")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 45,
    });
    const before = engine.snapshot(output, desktop);

    expect(
      engine.previewConsumeWindowIntoColumn(windowId("missing")),
    ).toBeNull();
    expect(engine.previewConsumeWindowIntoColumn(windowId("right"))).toBeNull();
    expect(
      engine.previewExpelWindowFromColumn(
        windowId("right"),
        columnId("column-new"),
      ),
    ).toBeNull();
    expect(
      engine.previewExpelWindowFromColumn(
        windowId("active-1"),
        columnId("column-right"),
      ),
    ).toBeNull();
    expect(engine.commitColumnStackEdit({} as ColumnStackEditPreview)).toBe(
      false,
    );

    const discarded = engine.previewConsumeWindowIntoColumn(
      windowId("active-1"),
    );

    if (!discarded) {
      throw new Error("expected a column stack edit preview");
    }

    expect(foreign.commitColumnStackEdit(discarded)).toBe(false);
    expect(engine.discardColumnStackEdit(discarded)).toBe(true);
    expect(engine.discardColumnStackEdit(discarded)).toBe(false);
    expect(engine.commitColumnStackEdit(discarded)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(before);

    const stale = engine.previewExpelWindowFromColumn(
      windowId("active-2"),
      columnId("column-expelled"),
    );

    if (!stale) {
      throw new Error("expected a stale column stack edit preview");
    }

    expect(engine.setViewportOffset(output, desktop, 84)).toBe(true);
    const changed = engine.snapshot(output, desktop);
    expect(engine.commitColumnStackEdit(stale)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(changed);
    expect(engine.commitColumnStackEdit(stale)).toBe(false);
  });

  it("rejects consume and expel boundaries without changing the model", () => {
    const engine = new LayoutEngine();

    engine.manageWindow({
      columnId: columnId("column-only"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("only"),
    });
    engine.activateWindow(windowId("only"));
    engine.setViewportOffset(output, desktop, -42);
    const before = engine.snapshot(output, desktop);

    expect(engine.previewConsumeWindowIntoColumn(windowId("only"))).toBeNull();
    expect(
      engine.previewExpelWindowFromColumn(
        windowId("only"),
        columnId("column-new"),
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("navigates and reorders members inside the active stack", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [
              windowId("window-1"),
              windowId("window-2"),
              windowId("window-3"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const before = engine.snapshot(output, desktop);

    expect(engine.adjacentWindowInColumn(windowId("window-2"), "up")).toBe(
      "window-1",
    );
    expect(engine.adjacentWindowInColumn(windowId("window-2"), "down")).toBe(
      "window-3",
    );
    expect(
      engine.adjacentWindowInColumn(windowId("window-1"), "up"),
    ).toBeNull();
    const edit = engine.moveActiveWindowInColumn(windowId("window-2"), "up");
    expect(edit?.kind).toBe("reorder");
    expect(engine.snapshot(output, desktop).columns[0]?.windowIds).toEqual([
      "window-2",
      "window-1",
      "window-3",
    ]);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("discards an unused stack rollback without reverting the edit", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const edit = engine.moveActiveWindowInColumn(windowId("window-1"), "down");

    if (!edit) {
      throw new Error("expected a stack edit");
    }

    const after = engine.snapshot(output, desktop);
    expect(engine.discardStackEditRollback(edit.rollback)).toBe(true);
    expect(engine.discardStackEditRollback(edit.rollback)).toBe(false);
    expect(engine.rollbackStackEdit(edit.rollback)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(after);
  });

  it("rejects invalid and stale stack edits without mutation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-3"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-3")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const before = engine.snapshot(output, desktop);

    expect(
      engine.moveActiveWindow(
        windowId("window-1"),
        "left",
        columnId("column-2"),
      ),
    ).toBeNull();
    expect(
      engine.moveActiveWindow(windowId("window-3"), "left", columnId("new")),
    ).toBeNull();
    expect(
      engine.moveActiveWindowInColumn(windowId("window-1"), "up"),
    ).toBeNull();
    expect(engine.rollbackStackEdit({} as StackEditRollback)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(before);

    expect(engine.activateWindow(windowId("window-3"))).toBe(true);
    const boundary = engine.snapshot(output, desktop);
    expect(
      engine.moveActiveWindow(windowId("window-3"), "right", columnId("new")),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(boundary);
    expect(engine.activateWindow(windowId("window-1"))).toBe(true);

    const edit = engine.moveActiveWindowInColumn(windowId("window-1"), "down");
    expect(edit).not.toBeNull();
    engine.manageWindow({
      columnId: columnId("column-3"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-4"),
    });
    const stale = engine.snapshot(output, desktop);
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(stale);
  });

  it("previews and commits a singleton window detachment without early mutation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-2"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            presentation: "stacked",
            selectedWindowId: windowId("window-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
            presentation: "stacked",
            selectedWindowId: windowId("window-3"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-3")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 120,
    });
    const before = engine.snapshot(output, desktop);
    const preview = engine.previewWindowDetach(windowId("window-2"));

    if (!preview) {
      throw new Error("expected a window detachment preview");
    }

    expect(preview.placement).toEqual({
      columnId: "column-2",
      columnIndex: 1,
      columnPresentation: "stacked",
      columnWidth: { kind: "proportion", value: 0.4 },
      desktopId: "desktop-1",
      memberIndex: 0,
      nextColumnId: "column-3",
      nextWindowId: null,
      outputId: "DP-1",
      previousColumnId: "column-1",
      previousWindowId: null,
      windowId: "window-2",
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.layout)).toBe(true);
    expect(Object.isFrozen(preview.layout.columns)).toBe(true);
    expect(Object.isFrozen(preview.placement)).toBe(true);
    expect(Object.isFrozen(preview.placement.columnWidth)).toBe(true);
    expect(preview.layout).toEqual({
      activeColumnId: "column-3",
      columns: [
        {
          id: "column-1",
          presentation: "stacked",
          selectedWindowId: "window-1",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
          presentation: "stacked",
          selectedWindowId: "window-3",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-3"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 120,
    });
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(engine.commitWindowDetach(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.layout);
    expect(engine.activateWindow(windowId("window-2"))).toBe(false);
    expect(engine.commitWindowDetach(preview)).toBe(false);
  });

  it("records both member anchors when detaching a middle stack member", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-left"),
            presentation: "stacked",
            selectedWindowId: windowId("window-left"),
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-1"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("window-1"),
              windowId("window-2"),
              windowId("window-3"),
            ],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-right"),
            presentation: "stacked",
            selectedWindowId: windowId("window-right"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-right")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 70,
    });
    const before = engine.snapshot(output, desktop);
    const preview = engine.previewWindowDetach(windowId("window-2"));

    if (!preview) {
      throw new Error("expected a stack member detachment preview");
    }

    expect(preview.placement).toMatchObject({
      columnId: "column-stack",
      columnIndex: 1,
      memberIndex: 1,
      nextColumnId: "column-right",
      nextWindowId: "window-3",
      previousColumnId: "column-left",
      previousWindowId: "window-1",
    });
    expect(preview.layout).toMatchObject({
      activeColumnId: "column-stack",
      columns: [
        { id: "column-left", windowIds: ["window-left"] },
        { id: "column-stack", windowIds: ["window-1", "window-3"] },
        { id: "column-right", windowIds: ["window-right"] },
      ],
      viewportOffset: 70,
    });
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(engine.commitWindowDetach(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.layout);
  });

  it("reattaches into a surviving column by anchors and keeps live changes", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-left"),
            presentation: "stacked",
            selectedWindowId: windowId("window-left"),
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("window-a"),
              windowId("window-b"),
              windowId("window-c"),
            ],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-right"),
            presentation: "stacked",
            selectedWindowId: windowId("window-right"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-right")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 40,
    });
    const detached = engine.previewWindowDetach(windowId("window-b"));

    if (!detached || !engine.commitWindowDetach(detached)) {
      throw new Error("expected the stack member to detach");
    }

    expect(
      engine.setActiveColumnWidth(windowId("window-a"), {
        kind: "fixed",
        value: 500,
      }),
    ).toEqual({ kind: "fixed", value: 420 });
    expect(
      engine.manageWindow({
        columnId: columnId("column-new"),
        desktopId: desktop,
        outputId: output,
        width: { kind: "fixed", value: 180 },
        windowId: windowId("window-x"),
      }),
    ).toBe(true);
    expect(engine.activateWindow(windowId("window-x"))).toBe(true);
    expect(
      engine.moveActiveWindow(windowId("window-x"), "left", columnId("unused"))
        ?.kind,
    ).toBe("merge");
    expect(
      engine.moveActiveWindowInColumn(windowId("window-x"), "up")?.kind,
    ).toBe("reorder");
    expect(engine.moveActiveColumn(windowId("window-x"), "right")).toBe(true);
    expect(engine.activateWindow(windowId("window-right"))).toBe(true);
    expect(
      engine.setActiveColumnWidth(windowId("window-right"), {
        kind: "fixed",
        value: 440,
      }),
    ).toEqual({ kind: "fixed", value: 300 });
    expect(engine.setViewportOffset(output, desktop, 170)).toBe(true);
    const live = engine.snapshot(output, desktop);
    const attached = engine.previewWindowAttach(detached.placement);

    if (!attached) {
      throw new Error("expected a window attachment preview");
    }

    expect(engine.snapshot(output, desktop)).toEqual(live);
    expect(attached.layout).toEqual({
      activeColumnId: "column-stack",
      columns: [
        {
          id: "column-left",
          presentation: "stacked",
          selectedWindowId: "window-left",
          width: { kind: "fixed", value: 200 },
          windowIds: ["window-left"],
        },
        {
          id: "column-right",
          presentation: "stacked",
          selectedWindowId: "window-right",
          width: { kind: "fixed", value: 440 },
          windowIds: ["window-right"],
        },
        {
          id: "column-stack",
          presentation: "stacked",
          selectedWindowId: "window-b",
          width: { kind: "fixed", value: 500 },
          windowIds: ["window-a", "window-b", "window-x", "window-c"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 170,
    });
    expect(engine.commitWindowAttach(attached)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(attached.layout);
    expect(engine.commitWindowAttach(attached)).toBe(false);
  });

  it("recreates a vanished singleton column by its live anchors and saved width", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-b"),
      columns: [
        {
          column: {
            id: columnId("column-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-b"),
            presentation: "stacked",
            selectedWindowId: windowId("window-b"),
            width: { kind: "fixed", value: 333 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-c"),
            presentation: "stacked",
            selectedWindowId: windowId("window-c"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
        {
          column: {
            id: columnId("column-d"),
            presentation: "stacked",
            selectedWindowId: windowId("window-d"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("window-d")],
          },
          index: 3,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const detached = engine.previewWindowDetach(windowId("window-b"));

    if (!detached || !engine.commitWindowDetach(detached)) {
      throw new Error("expected the singleton to detach");
    }

    expect(engine.activateWindow(windowId("window-a"))).toBe(true);
    expect(
      engine.setActiveColumnWidth(windowId("window-a"), {
        kind: "fixed",
        value: 260,
      }),
    ).toEqual({ kind: "fixed", value: 240 });
    expect(engine.activateWindow(windowId("window-d"))).toBe(true);
    expect(engine.moveActiveColumn(windowId("window-d"), "left")).toBe(true);
    expect(engine.setViewportOffset(output, desktop, 90)).toBe(true);
    const live = engine.snapshot(output, desktop);
    const attached = engine.previewWindowAttach(detached.placement);

    if (!attached) {
      throw new Error("expected the singleton attachment preview");
    }

    expect(engine.snapshot(output, desktop)).toEqual(live);
    expect(attached.layout).toEqual({
      activeColumnId: "column-b",
      columns: [
        {
          id: "column-a",
          presentation: "stacked",
          selectedWindowId: "window-a",
          width: { kind: "fixed", value: 260 },
          windowIds: ["window-a"],
        },
        {
          id: "column-b",
          presentation: "stacked",
          selectedWindowId: "window-b",
          width: { kind: "fixed", value: 333 },
          windowIds: ["window-b"],
        },
        {
          id: "column-d",
          presentation: "stacked",
          selectedWindowId: "window-d",
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-d"],
        },
        {
          id: "column-c",
          presentation: "stacked",
          selectedWindowId: "window-c",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-c"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 90,
    });
    expect(engine.commitWindowAttach(attached)).toBe(true);
  });

  it("clamps restoration when saved column and member anchors vanish", () => {
    const singletonEngine = new LayoutEngine();

    singletonEngine.restoreColumns({
      activeColumnId: columnId("column-b"),
      columns: [
        {
          column: {
            id: columnId("column-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-b"),
            presentation: "stacked",
            selectedWindowId: windowId("window-b"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-c"),
            presentation: "stacked",
            selectedWindowId: windowId("window-c"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
        {
          column: {
            id: columnId("column-d"),
            presentation: "stacked",
            selectedWindowId: windowId("window-d"),
            width: { kind: "fixed", value: 500 },
            windowIds: [windowId("window-d")],
          },
          index: 3,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const singleton = singletonEngine.previewWindowDetach(windowId("window-b"));

    if (!singleton || !singletonEngine.commitWindowDetach(singleton)) {
      throw new Error("expected the singleton to detach");
    }

    expect(
      singletonEngine.removeColumns({
        columnIds: [columnId("column-a"), columnId("column-c")],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    const singletonAttach = singletonEngine.previewWindowAttach(
      singleton.placement,
    );

    if (!singletonAttach) {
      throw new Error("expected a clamped singleton attachment");
    }

    expect(singletonAttach.layout.columns.map((column) => column.id)).toEqual([
      "column-d",
      "column-b",
    ]);
    expect(singletonEngine.commitWindowAttach(singletonAttach)).toBe(true);

    const stackEngine = new LayoutEngine();
    stackEngine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-left"),
            presentation: "stacked",
            selectedWindowId: windowId("window-left"),
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 420 },
            windowIds: [
              windowId("window-a"),
              windowId("window-b"),
              windowId("window-c"),
            ],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-right"),
            presentation: "stacked",
            selectedWindowId: windowId("window-right"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-right")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const member = stackEngine.previewWindowDetach(windowId("window-b"));

    if (!member || !stackEngine.commitWindowDetach(member)) {
      throw new Error("expected the stack member to detach");
    }

    expect(stackEngine.unmanageWindow(windowId("window-a"))).toBe(true);
    expect(stackEngine.unmanageWindow(windowId("window-c"))).toBe(true);
    expect(
      stackEngine.restoreColumns({
        columns: [
          {
            column: {
              id: columnId("column-stack"),
              presentation: "stacked",
              selectedWindowId: windowId("window-x"),
              width: { kind: "fixed", value: 640 },
              windowIds: [windowId("window-x")],
            },
            index: 1,
          },
        ],
        desktopId: desktop,
        outputId: output,
      }),
    ).toBe(true);
    const memberAttach = stackEngine.previewWindowAttach(member.placement);

    if (!memberAttach) {
      throw new Error("expected a clamped stack attachment");
    }

    expect(memberAttach.layout.columns[1]).toEqual({
      id: "column-stack",
      presentation: "stacked",
      selectedWindowId: "window-b",
      width: { kind: "fixed", value: 640 },
      windowIds: ["window-x", "window-b"],
    });
    expect(stackEngine.commitWindowAttach(memberAttach)).toBe(true);
  });

  it("detaches and reattaches the last window through an empty context", () => {
    const engine = new LayoutEngine();

    engine.manageWindow({
      columnId: columnId("column-only"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "proportion", value: 0.6 },
      windowId: windowId("window-only"),
    });
    engine.activateWindow(windowId("window-only"));
    engine.setViewportOffset(output, desktop, 250);
    const detached = engine.previewWindowDetach(windowId("window-only"));

    if (!detached) {
      throw new Error("expected the last window detachment preview");
    }

    expect(detached.layout).toEqual({
      activeColumnId: null,
      columns: [],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(engine.commitWindowDetach(detached)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(detached.layout);
    const attached = engine.previewWindowAttach(detached.placement);

    if (!attached) {
      throw new Error("expected an empty-context attachment preview");
    }

    expect(attached.layout).toEqual({
      activeColumnId: "column-only",
      columns: [
        {
          id: "column-only",
          presentation: "stacked",
          selectedWindowId: "window-only",
          width: { kind: "proportion", value: 0.6 },
          windowIds: ["window-only"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(engine.commitWindowAttach(attached)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(attached.layout);
  });

  it("rejects stale and foreign detach and attach previews", () => {
    const engine = new LayoutEngine();
    const foreign = new LayoutEngine();

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
    const staleDetach = engine.previewWindowDetach(windowId("window-1"));

    if (!staleDetach) {
      throw new Error("expected a detachment preview");
    }

    expect(foreign.commitWindowDetach(staleDetach)).toBe(false);
    expect(engine.setViewportOffset(output, desktop, 20)).toBe(true);
    const changed = engine.snapshot(output, desktop);
    expect(engine.commitWindowDetach(staleDetach)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(changed);
    expect(engine.commitWindowDetach(staleDetach)).toBe(false);

    const detached = engine.previewWindowDetach(windowId("window-1"));

    if (!detached || !engine.commitWindowDetach(detached)) {
      throw new Error("expected the window to detach");
    }

    const staleAttach = engine.previewWindowAttach(detached.placement);

    if (!staleAttach) {
      throw new Error("expected an attachment preview");
    }

    expect(foreign.commitWindowAttach(staleAttach)).toBe(false);
    expect(engine.setViewportOffset(output, desktop, 40)).toBe(true);
    const detachedLayout = engine.snapshot(output, desktop);
    expect(engine.commitWindowAttach(staleAttach)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(detachedLayout);
    expect(engine.commitWindowAttach(staleAttach)).toBe(false);
    expect(engine.commitWindowDetach({} as WindowDetachPreview)).toBe(false);
    expect(engine.commitWindowAttach({} as WindowAttachPreview)).toBe(false);
  });

  it("rejects duplicate windows and invalid detached placement metadata", () => {
    const engine = new LayoutEngine();
    const otherOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("column-1"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    const detached = engine.previewWindowDetach(windowId("window-1"));

    if (!detached || !engine.commitWindowDetach(detached)) {
      throw new Error("expected the window to detach");
    }

    expect(
      engine.manageWindow({
        columnId: columnId("column-foreign"),
        desktopId: desktop,
        outputId: otherOutput,
        width: { kind: "fixed", value: 200 },
        windowId: windowId("window-1"),
      }),
    ).toBe(true);
    expect(engine.previewWindowAttach(detached.placement)).toBeNull();
    expect(engine.unmanageWindow(windowId("window-1"))).toBe(true);

    const invalidPlacements: DetachedWindowPlacement[] = [
      {} as DetachedWindowPlacement,
      null as unknown as DetachedWindowPlacement,
      { ...detached.placement, columnIndex: -1 },
      { ...detached.placement, memberIndex: 0.5 },
      {
        ...detached.placement,
        columnWidth: { kind: "fixed", value: Number.NaN },
      },
      {
        ...detached.placement,
        columnWidth: {
          kind: "invalid",
          value: 300,
        } as unknown as DetachedWindowPlacement["columnWidth"],
      },
      {
        ...detached.placement,
        nextColumnId: columnId("duplicate-column-anchor"),
        previousColumnId: columnId("duplicate-column-anchor"),
      },
      {
        ...detached.placement,
        nextWindowId: windowId("duplicate-window-anchor"),
        previousWindowId: windowId("duplicate-window-anchor"),
      },
      {
        ...detached.placement,
        previousColumnId: detached.placement.columnId,
      },
      {
        ...detached.placement,
        nextWindowId: detached.placement.windowId,
      },
    ];
    const before = engine.snapshot(output, desktop);

    for (const placement of invalidPlacements) {
      expect(engine.previewWindowAttach(placement)).toBeNull();
    }

    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("accepts a deterministic fresh placement for a different live context", () => {
    const engine = new LayoutEngine();
    const liveOutput = outputId("HDMI-A-1");
    const liveDesktop = desktopId("desktop-2");

    engine.manageWindow({
      columnId: columnId("column-saved"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-floating"),
    });
    const detached = engine.previewWindowDetach(windowId("window-floating"));

    if (!detached || !engine.commitWindowDetach(detached)) {
      throw new Error("expected the window to detach");
    }

    for (const index of [1, 2]) {
      engine.manageWindow({
        columnId: columnId(`column-live-${String(index)}`),
        desktopId: liveDesktop,
        outputId: liveOutput,
        width: { kind: "fixed", value: 250 },
        windowId: windowId(`window-live-${String(index)}`),
      });
    }
    engine.setViewportOffset(liveOutput, liveDesktop, 60);
    const freshPlacement: DetachedWindowPlacement = {
      ...detached.placement,
      columnId: columnId("column-fresh"),
      columnIndex: 1,
      columnWidth: { kind: "fixed", value: 480 },
      desktopId: liveDesktop,
      memberIndex: 0,
      nextColumnId: columnId("column-live-2"),
      nextWindowId: null,
      outputId: liveOutput,
      previousColumnId: columnId("column-live-1"),
      previousWindowId: null,
    };
    const attached = engine.previewWindowAttach(freshPlacement);

    if (!attached) {
      throw new Error("expected a fresh-context attachment preview");
    }

    expect(attached.layout).toEqual({
      activeColumnId: "column-fresh",
      columns: [
        {
          id: "column-live-1",
          presentation: "stacked",
          selectedWindowId: "window-live-1",
          width: { kind: "fixed", value: 250 },
          windowIds: ["window-live-1"],
        },
        {
          id: "column-fresh",
          presentation: "stacked",
          selectedWindowId: "window-floating",
          width: { kind: "fixed", value: 480 },
          windowIds: ["window-floating"],
        },
        {
          id: "column-live-2",
          presentation: "stacked",
          selectedWindowId: "window-live-2",
          width: { kind: "fixed", value: 250 },
          windowIds: ["window-live-2"],
        },
      ],
      desktopId: "desktop-2",
      outputId: "HDMI-A-1",
      viewportOffset: 60,
    });
    expect(engine.commitWindowAttach(attached)).toBe(true);
    expect(engine.snapshot(output, desktop).columns).toEqual([]);
    expect(engine.snapshot(liveOutput, liveDesktop)).toEqual(attached.layout);
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
    expect(engine.setViewportOffset(output, desktop, -250)).toBe(true);
    expect(engine.snapshot(output, desktop).viewportOffset).toBe(-250);
    expect(engine.setViewportOffset(outputId("unknown"), desktop, 10)).toBe(
      false,
    );
  });

  it.each([Number.NEGATIVE_INFINITY, Number.NaN, Number.POSITIVE_INFINITY])(
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
              presentation: "stacked",
              selectedWindowId: windowId("window-1"),
              width: { kind: "fixed", value: 240 },
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-2"),
              presentation: "stacked",
              selectedWindowId: windowId("window-3"),
              width: { kind: "proportion", value: 0.4 },
              windowIds: [windowId("window-3")],
            },
            index: 1,
          },
          {
            column: {
              id: columnId("column-3"),
              presentation: "stacked",
              selectedWindowId: windowId("window-4"),
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
              presentation: "stacked",
              selectedWindowId: windowId("window-1"),
              width: { kind: "fixed", value: 240 },
              windowIds: [windowId("window-1"), windowId("window-2")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-3"),
              presentation: "stacked",
              selectedWindowId: windowId("window-4"),
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
          presentation: "stacked",
          selectedWindowId: "window-1",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column-2",
          presentation: "stacked",
          selectedWindowId: "window-3",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-3"],
        },
        {
          id: "column-3",
          presentation: "stacked",
          selectedWindowId: "window-4",
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
              presentation: "stacked",
              selectedWindowId: windowId("window-1"),
              width: { kind: "proportion", value: 0.5 },
              windowIds: [windowId("window-1")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("column-3"),
              presentation: "stacked",
              selectedWindowId: windowId("window-3"),
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

  it("previews and atomically transfers the whole active column", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-stack"),
      columns: [
        {
          column: {
            id: columnId("source-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-stack"),
            presentation: "tabbed",
            selectedWindowId: windowId("window-b1"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [
              windowId("window-b1"),
              windowId("window-b2"),
              windowId("window-b3"),
            ],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("source-c"),
            presentation: "stacked",
            selectedWindowId: windowId("window-c"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -120,
    });
    engine.restoreColumns({
      activeColumnId: columnId("target-a"),
      columns: [
        {
          column: {
            id: columnId("target-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-a"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("window-target-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target-b"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-b"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-target-b")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: targetOutput,
      viewportOffset: -75,
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const preview = engine.previewColumnTransfer(windowId("window-b2"), {
      columnId: columnId("transferred"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected a column transfer preview");
    }

    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
    expect(preview.sourceLayout).toEqual({
      activeColumnId: "source-c",
      columns: [
        {
          id: "source-a",
          presentation: "stacked",
          selectedWindowId: "window-a",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-a"],
        },
        {
          id: "source-c",
          presentation: "stacked",
          selectedWindowId: "window-c",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-c"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: -120,
    });
    expect(preview.targetLayout).toEqual({
      activeColumnId: "transferred",
      columns: [
        {
          id: "target-a",
          presentation: "stacked",
          selectedWindowId: "window-target-a",
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-target-a"],
        },
        {
          id: "transferred",
          presentation: "tabbed",
          selectedWindowId: "window-b1",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-b1", "window-b2", "window-b3"],
        },
        {
          id: "target-b",
          presentation: "stacked",
          selectedWindowId: "window-target-b",
          width: { kind: "fixed", value: 420 },
          windowIds: ["window-target-b"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "HDMI-A-1",
      viewportOffset: -75,
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout.columns)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1])).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1]?.width)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1]?.windowIds)).toBe(
      true,
    );
    expect(engine.commitColumnTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(
      preview.targetLayout,
    );
    expect(engine.commitColumnTransfer(preview)).toBe(false);
  });

  it("transfers the last active column into an empty context", () => {
    const engine = new LayoutEngine();
    const targetDesktop = desktopId("desktop-2");

    engine.restoreColumns({
      activeColumnId: columnId("source-only"),
      columns: [
        {
          column: {
            id: columnId("source-only"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 515 },
            windowIds: [windowId("window-a"), windowId("window-b")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 44,
    });
    const preview = engine.previewColumnTransfer(windowId("window-b"), {
      columnId: columnId("target-only"),
      desktopId: targetDesktop,
      outputId: output,
    });

    if (!preview) {
      throw new Error("expected a last-column transfer preview");
    }

    expect(preview.sourceLayout).toEqual({
      activeColumnId: null,
      columns: [],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(preview.targetLayout).toEqual({
      activeColumnId: "target-only",
      columns: [
        {
          id: "target-only",
          presentation: "stacked",
          selectedWindowId: "window-a",
          width: { kind: "fixed", value: 515 },
          windowIds: ["window-a", "window-b"],
        },
      ],
      desktopId: "desktop-2",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(engine.commitColumnTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(output, targetDesktop)).toEqual(
      preview.targetLayout,
    );
  });

  it("rejects invalid whole-column transfer preconditions without mutation", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-active"),
      columns: [
        {
          column: {
            id: columnId("source-active"),
            presentation: "stacked",
            selectedWindowId: windowId("window-active-a"),
            width: { kind: "fixed", value: 300 },
            windowIds: [
              windowId("window-active-a"),
              windowId("window-active-b"),
            ],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-inactive"),
            presentation: "stacked",
            selectedWindowId: windowId("window-inactive"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("window-inactive")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    engine.restoreColumns({
      activeColumnId: columnId("target-collision"),
      columns: [
        {
          column: {
            id: columnId("target-collision"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target"),
            width: { kind: "fixed", value: 340 },
            windowIds: [windowId("window-target")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: targetOutput,
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);

    expect(
      engine.previewColumnTransfer(windowId("unknown"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewColumnTransfer(windowId("window-inactive"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewColumnTransfer(windowId("window-active-a"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: output,
      }),
    ).toBeNull();
    expect(
      engine.previewColumnTransfer(windowId("window-active-b"), {
        columnId: columnId("target-collision"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewColumnTransfer(
        windowId("window-active-a"),
        null as unknown as Parameters<LayoutEngine["previewColumnTransfer"]>[1],
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
  });

  it("rejects forged, foreign, discarded, and reused column transfer previews", () => {
    const engine = new LayoutEngine();
    const foreign = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    engine.activateWindow(windowId("window-1"));
    const discarded = engine.previewColumnTransfer(windowId("window-1"), {
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!discarded) {
      throw new Error("expected an owned column transfer preview");
    }

    expect(engine.commitColumnTransfer({} as ColumnTransferPreview)).toBe(
      false,
    );
    expect(foreign.commitColumnTransfer(discarded)).toBe(false);
    expect(engine.discardColumnTransfer(discarded)).toBe(true);
    expect(engine.discardColumnTransfer(discarded)).toBe(false);
    expect(engine.commitColumnTransfer(discarded)).toBe(false);

    const committed = engine.previewColumnTransfer(windowId("window-1"), {
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!committed) {
      throw new Error("expected a second column transfer preview");
    }

    expect(engine.commitColumnTransfer(committed)).toBe(true);
    expect(engine.commitColumnTransfer(committed)).toBe(false);
  });

  it("consumes a column transfer preview when either context becomes stale", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-source"),
    });
    engine.activateWindow(windowId("window-source"));
    engine.manageWindow({
      columnId: columnId("target-existing"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 450 },
      windowId: windowId("window-target"),
    });
    engine.activateWindow(windowId("window-target"));
    const targetStale = engine.previewColumnTransfer(
      windowId("window-source"),
      {
        columnId: columnId("target-new"),
        desktopId: desktop,
        outputId: targetOutput,
      },
    );

    if (!targetStale) {
      throw new Error("expected a target-staleness preview");
    }

    expect(engine.setViewportOffset(targetOutput, desktop, 65)).toBe(true);
    const sourceBefore = engine.snapshot(output, desktop);
    const targetChanged = engine.snapshot(targetOutput, desktop);
    expect(engine.commitColumnTransfer(targetStale)).toBe(false);
    expect(engine.commitColumnTransfer(targetStale)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetChanged);

    const sourceStale = engine.previewColumnTransfer(
      windowId("window-source"),
      {
        columnId: columnId("target-new"),
        desktopId: desktop,
        outputId: targetOutput,
      },
    );

    if (!sourceStale) {
      throw new Error("expected a source-staleness preview");
    }

    expect(engine.setViewportOffset(output, desktop, 35)).toBe(true);
    const sourceChanged = engine.snapshot(output, desktop);
    expect(engine.commitColumnTransfer(sourceStale)).toBe(false);
    expect(engine.commitColumnTransfer(sourceStale)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceChanged);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetChanged);
  });

  it("transfers an active singleton with the requested presentation", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-b"),
      columns: [
        {
          column: {
            id: columnId("source-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-b"),
            presentation: "stacked",
            selectedWindowId: windowId("window-b"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("source-c"),
            presentation: "stacked",
            selectedWindowId: windowId("window-c"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 120,
    });
    engine.restoreColumns({
      activeColumnId: columnId("target-a"),
      columns: [
        {
          column: {
            id: columnId("target-a"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-a"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("window-target-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target-b"),
            presentation: "stacked",
            selectedWindowId: windowId("window-target-b"),
            width: { kind: "fixed", value: 420 },
            windowIds: [windowId("window-target-b")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: targetOutput,
      viewportOffset: 75,
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const preview = engine.previewWindowTransfer(windowId("window-b"), {
      columnId: columnId("transferred"),
      desktopId: desktop,
      outputId: targetOutput,
      presentation: "tabbed",
    });

    if (!preview) {
      throw new Error("expected a window transfer preview");
    }

    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
    expect(preview.sourceLayout).toEqual({
      activeColumnId: "source-c",
      columns: [
        {
          id: "source-a",
          presentation: "stacked",
          selectedWindowId: "window-a",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-a"],
        },
        {
          id: "source-c",
          presentation: "stacked",
          selectedWindowId: "window-c",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-c"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 120,
    });
    expect(preview.targetLayout).toEqual({
      activeColumnId: "transferred",
      columns: [
        {
          id: "target-a",
          presentation: "stacked",
          selectedWindowId: "window-target-a",
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-target-a"],
        },
        {
          id: "transferred",
          presentation: "tabbed",
          selectedWindowId: "window-b",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-b"],
        },
        {
          id: "target-b",
          presentation: "stacked",
          selectedWindowId: "window-target-b",
          width: { kind: "fixed", value: 420 },
          windowIds: ["window-target-b"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "HDMI-A-1",
      viewportOffset: 75,
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout.columns)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout.columns[0])).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout.columns[0]?.width)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout.columns[0]?.windowIds)).toBe(
      true,
    );
    expect(Object.isFrozen(preview.targetLayout)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1])).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1]?.width)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[1]?.windowIds)).toBe(
      true,
    );
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(
      preview.targetLayout,
    );
    expect(engine.commitWindowTransfer(preview)).toBe(false);
  });

  it("transfers a middle stack member into an empty desktop context", () => {
    const engine = new LayoutEngine();
    const targetDesktop = desktopId("desktop-2");

    engine.restoreColumns({
      activeColumnId: columnId("source-stack"),
      columns: [
        {
          column: {
            id: columnId("source-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 515 },
            windowIds: [
              windowId("window-a"),
              windowId("window-b"),
              windowId("window-c"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 44,
    });
    const preview = engine.previewWindowTransfer(windowId("window-b"), {
      columnId: columnId("target-only"),
      desktopId: targetDesktop,
      outputId: output,
    });

    if (!preview) {
      throw new Error("expected a stack member transfer preview");
    }

    expect(preview.sourceLayout).toEqual({
      activeColumnId: "source-stack",
      columns: [
        {
          id: "source-stack",
          presentation: "stacked",
          selectedWindowId: "window-a",
          width: { kind: "fixed", value: 515 },
          windowIds: ["window-a", "window-c"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 44,
    });
    expect(preview.targetLayout).toEqual({
      activeColumnId: "target-only",
      columns: [
        {
          id: "target-only",
          presentation: "stacked",
          selectedWindowId: "window-b",
          width: { kind: "fixed", value: 515 },
          windowIds: ["window-b"],
        },
      ],
      desktopId: "desktop-2",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(output, targetDesktop)).toEqual(
      preview.targetLayout,
    );
    expect(engine.activateWindow(windowId("window-b"))).toBe(false);
    expect(engine.activateWindow(windowId("window-a"))).toBe(false);
  });

  it("resets the effective source viewport when its last column transfers", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source-only"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 390 },
      windowId: windowId("window-only"),
    });
    engine.activateWindow(windowId("window-only"));
    engine.setViewportOffset(output, desktop, 210);
    engine.manageWindow({
      columnId: columnId("target-a"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 250 },
      windowId: windowId("window-target-a"),
    });
    engine.manageWindow({
      columnId: columnId("target-b"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 350 },
      windowId: windowId("window-target-b"),
    });
    const preview = engine.previewWindowTransfer(windowId("window-only"), {
      columnId: columnId("target-only"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected a last-window transfer preview");
    }

    expect(preview.sourceLayout).toEqual({
      activeColumnId: null,
      columns: [],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 0,
    });
    expect(preview.targetLayout.columns.map((column) => column.id)).toEqual([
      "target-a",
      "target-b",
      "target-only",
    ]);
    expect(preview.targetLayout.activeColumnId).toBe("target-only");
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(
      preview.targetLayout,
    );
  });

  it("rejects invalid window transfer preconditions without mutation", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source-active"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-active"),
    });
    engine.manageWindow({
      columnId: columnId("source-inactive"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 320 },
      windowId: windowId("window-inactive"),
    });
    engine.activateWindow(windowId("window-active"));
    engine.manageWindow({
      columnId: columnId("target-collision"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 340 },
      windowId: windowId("window-target"),
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);

    expect(
      engine.previewWindowTransfer(windowId("unknown"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransfer(windowId("window-inactive"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransfer(windowId("window-active"), {
        columnId: columnId("fresh"),
        desktopId: desktop,
        outputId: output,
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransfer(windowId("window-active"), {
        columnId: columnId("target-collision"),
        desktopId: desktop,
        outputId: targetOutput,
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransfer(
        windowId("window-active"),
        null as unknown as Parameters<LayoutEngine["previewWindowTransfer"]>[1],
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
  });

  it("rejects forged and foreign transfer previews while preserving engine ownership", () => {
    const engine = new LayoutEngine();
    const foreign = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    engine.activateWindow(windowId("window-1"));
    const preview = engine.previewWindowTransfer(windowId("window-1"), {
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected an owned transfer preview");
    }

    expect(engine.commitWindowTransfer({} as WindowTransferPreview)).toBe(
      false,
    );
    expect(foreign.commitWindowTransfer(preview)).toBe(false);
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
  });

  it("discards an unused transfer preview without changing either context", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    engine.activateWindow(windowId("window-1"));
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const preview = engine.previewWindowTransfer(windowId("window-1"), {
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected a transfer preview");
    }

    expect(engine.discardWindowTransfer(preview)).toBe(true);
    expect(engine.discardWindowTransfer(preview)).toBe(false);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
  });

  it("consumes a transfer preview when the source context becomes stale", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-1"),
    });
    engine.activateWindow(windowId("window-1"));
    const preview = engine.previewWindowTransfer(windowId("window-1"), {
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected a transfer preview");
    }

    expect(engine.setViewportOffset(output, desktop, 35)).toBe(true);
    const sourceChanged = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceChanged);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
  });

  it("consumes a transfer preview when the target context becomes stale", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("window-source"),
    });
    engine.activateWindow(windowId("window-source"));
    engine.manageWindow({
      columnId: columnId("target-existing"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 450 },
      windowId: windowId("window-target"),
    });
    const preview = engine.previewWindowTransfer(windowId("window-source"), {
      columnId: columnId("target-new"),
      desktopId: desktop,
      outputId: targetOutput,
    });

    if (!preview) {
      throw new Error("expected a transfer preview");
    }

    expect(engine.setViewportOffset(targetOutput, desktop, 65)).toBe(true);
    const sourceBefore = engine.snapshot(output, desktop);
    const targetChanged = engine.snapshot(targetOutput, desktop);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetChanged);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
  });

  it("reorders a stack member atomically while retaining its height policy", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("stack"),
      columns: [
        {
          column: {
            id: columnId("stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "proportion", value: 0.45 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 320, kind: "fixed" },
              { kind: "auto", weight: 4 },
            ],
            windowIds: [
              windowId("window-a"),
              windowId("window-b"),
              windowId("window-c"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 73,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.reinsertWindow(windowId("window-b"), {
      position: "after",
      targetWindowId: windowId("window-c"),
    });

    expect(edit?.kind).toBe("reorder");
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      columns: [
        {
          ...before.columns[0],
          selectedWindowId: "window-b",
          windowHeights: [
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 4 },
            { clientHeight: 320, kind: "fixed" },
          ],
          windowIds: ["window-a", "window-c", "window-b"],
        },
      ],
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("reinserts a member at a cross-column anchor with automatic height", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("source"),
            presentation: "stacked",
            selectedWindowId: windowId("source-a"),
            width: { kind: "fixed", value: 360 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 330, kind: "fixed" },
            ],
            windowIds: [windowId("source-a"), windowId("moved")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("destination"),
            presentation: "stacked",
            selectedWindowId: windowId("target-a"),
            width: { kind: "fixed", value: 700 },
            windowHeights: [
              { index: 0, kind: "preset" },
              { kind: "auto", weight: 3 },
            ],
            windowIds: [windowId("target-a"), windowId("target-b")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 115,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.reinsertWindow(windowId("moved"), {
      position: "before",
      targetWindowId: windowId("target-b"),
    });

    expect(edit?.kind).toBe("insert");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "destination",
      columns: [
        {
          id: "source",
          presentation: "stacked",
          selectedWindowId: "source-a",
          width: { kind: "fixed", value: 360 },
          windowIds: ["source-a"],
        },
        {
          id: "destination",
          presentation: "stacked",
          selectedWindowId: "moved",
          width: { kind: "fixed", value: 700 },
          windowHeights: [
            { index: 0, kind: "preset" },
            { kind: "auto", weight: 1 },
            { kind: "auto", weight: 3 },
          ],
          windowIds: ["target-a", "moved", "target-b"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 115,
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("removes an emptied source column during pointer reinsertion", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("source"),
            presentation: "stacked",
            selectedWindowId: windowId("moved"),
            width: { kind: "fixed", value: 310 },
            windowHeights: [{ clientHeight: 280, kind: "fixed" }],
            windowIds: [windowId("moved")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("destination"),
            presentation: "stacked",
            selectedWindowId: windowId("target"),
            width: { kind: "proportion", value: 0.6 },
            windowIds: [windowId("target")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -52,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.reinsertWindow(windowId("moved"), {
      position: "after",
      targetWindowId: windowId("target"),
    });

    expect(edit?.kind).toBe("merge");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "destination",
      columns: [
        {
          id: "destination",
          presentation: "stacked",
          selectedWindowId: "moved",
          width: { kind: "proportion", value: 0.6 },
          windowIds: ["target", "moved"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: -52,
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("rejects invalid and ineffective window reinsertions without mutation", () => {
    const engine = new LayoutEngine();
    const otherDesktop = desktopId("desktop-2");

    engine.restoreColumns({
      activeColumnId: columnId("stack"),
      columns: [
        {
          column: {
            id: columnId("stack"),
            presentation: "stacked",
            selectedWindowId: windowId("window-a"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("window-a"), windowId("window-b")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    engine.manageWindow({
      columnId: columnId("other"),
      desktopId: otherDesktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("other-window"),
    });
    const before = engine.snapshot(output, desktop);
    const otherBefore = engine.snapshot(output, otherDesktop);

    expect(
      engine.reinsertWindow(windowId("window-a"), {
        position: "before",
        targetWindowId: windowId("window-b"),
      }),
    ).toBeNull();
    expect(
      engine.reinsertWindow(windowId("window-a"), {
        position: "after",
        targetWindowId: windowId("window-a"),
      }),
    ).toBeNull();
    expect(
      engine.reinsertWindow(windowId("window-a"), {
        position: "after",
        targetWindowId: windowId("missing"),
      }),
    ).toBeNull();
    expect(
      engine.reinsertWindow(windowId("window-a"), {
        position: "after",
        targetWindowId: windowId("other-window"),
      }),
    ).toBeNull();
    expect(
      engine.reinsertWindow(windowId("window-a"), {
        position: "middle",
        targetWindowId: windowId("window-b"),
      } as never),
    ).toBeNull();
    expect(
      engine.reinsertWindow(
        windowId("window-a"),
        null as unknown as Parameters<LayoutEngine["reinsertWindow"]>[1],
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(before);
    expect(engine.snapshot(output, otherDesktop)).toEqual(otherBefore);
  });

  it("rejects reinsertion from an inactive column", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("active"),
      columns: [
        {
          column: {
            id: columnId("source"),
            presentation: "stacked",
            selectedWindowId: windowId("moved"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("moved"), windowId("source-peer")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("active"),
            presentation: "stacked",
            selectedWindowId: windowId("active-window"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("active-window")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const before = engine.snapshot(output, desktop);

    expect(
      engine.reinsertWindow(windowId("moved"), {
        position: "after",
        targetWindowId: windowId("source-peer"),
      }),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it("handles every same-stack source, target, and edge combination", () => {
    const ids = ["", "window-b", "window-c", "window-d"];

    for (const [sourceIndex, moved] of ids.entries()) {
      for (const [targetIndex, target] of ids.entries()) {
        if (sourceIndex === targetIndex) {
          continue;
        }

        for (const position of ["before", "after"] as const) {
          const engine = new LayoutEngine();

          engine.restoreColumns({
            activeColumnId: columnId("stack"),
            columns: [
              {
                column: {
                  id: columnId("stack"),
                  presentation: "stacked",
                  selectedWindowId: windowId(ids[0] ?? ""),
                  width: { kind: "fixed", value: 400 },
                  windowIds: ids.map(windowId),
                },
                index: 0,
              },
            ],
            desktopId: desktop,
            outputId: output,
          });
          const before = engine.snapshot(output, desktop);
          const expected = [...ids];
          expected.splice(sourceIndex, 1);
          const targetIndexAfterRemoval = expected.indexOf(target);
          const insertionIndex =
            targetIndexAfterRemoval + (position === "after" ? 1 : 0);
          expected.splice(insertionIndex, 0, moved);
          const edit = engine.reinsertWindow(windowId(moved), {
            position,
            targetWindowId: windowId(target),
          });

          if (expected.every((id, index) => id === ids[index])) {
            expect(edit).toBeNull();
            expect(engine.snapshot(output, desktop)).toEqual(before);
          } else {
            expect(edit?.kind).toBe("reorder");
            expect(
              engine.snapshot(output, desktop).columns[0]?.windowIds,
            ).toEqual(expected);
            expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
            expect(engine.snapshot(output, desktop)).toEqual(before);
          }
        }
      }
    }
  });

  it("reinserts into a destination before the source column", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("destination"),
            presentation: "stacked",
            selectedWindowId: windowId("target"),
            width: { kind: "fixed", value: 640 },
            windowIds: [windowId("target")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source"),
            presentation: "stacked",
            selectedWindowId: windowId("moved"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("moved"), windowId("source-peer")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const edit = engine.reinsertWindow(windowId("moved"), {
      position: "before",
      targetWindowId: windowId("target"),
    });

    expect(edit?.kind).toBe("insert");
    expect(engine.snapshot(output, desktop)).toMatchObject({
      activeColumnId: "destination",
      columns: [
        {
          id: "destination",
          presentation: "stacked",
          selectedWindowId: "moved",
          width: { kind: "fixed", value: 640 },
          windowIds: ["moved", "target"],
        },
        {
          id: "source",
          presentation: "stacked",
          selectedWindowId: "source-peer",
          width: { kind: "fixed", value: 320 },
          windowIds: ["source-peer"],
        },
      ],
    });
  });

  it("reorders a complete singleton column at a distant boundary and rolls back exactly", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("left"),
            presentation: "stacked",
            selectedWindowId: windowId("left-window"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("left-window")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source"),
            presentation: "tabbed",
            selectedWindowId: windowId("moved"),
            width: { kind: "proportion", value: 0.43 },
            windowHeights: [{ index: 2, kind: "preset" }],
            windowIds: [windowId("moved")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("middle"),
            presentation: "stacked",
            selectedWindowId: windowId("middle-window"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("middle-window")],
          },
          index: 2,
        },
        {
          column: {
            id: columnId("target"),
            presentation: "stacked",
            selectedWindowId: windowId("target-window"),
            width: { kind: "proportion", value: 0.5 },
            windowIds: [windowId("target-window")],
          },
          index: 3,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: -91,
    });
    const before = engine.snapshot(output, desktop);
    const edit = engine.reinsertWindowAtColumnBoundary(
      windowId("moved"),
      { position: "after", targetColumnId: columnId("target") },
      columnId("unused"),
      "stacked",
    );

    expect(edit?.kind).toBe("reorder");
    expect(engine.snapshot(output, desktop)).toEqual({
      ...before,
      columns: [
        before.columns[0],
        before.columns[2],
        before.columns[3],
        before.columns[1],
      ],
    });
    expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(before);
  });

  it.each([
    [
      "before its source",
      "before",
      "source",
      ["left", "new", "source", "target"],
    ],
    [
      "after its source",
      "after",
      "source",
      ["left", "source", "new", "target"],
    ],
    [
      "before another column",
      "before",
      "target",
      ["left", "source", "new", "target"],
    ],
    [
      "after another column",
      "after",
      "target",
      ["left", "source", "target", "new"],
    ],
  ] as const)(
    "extracts a middle stack member %s with passive state intact",
    (_description, position, targetColumn, expectedColumnIds) => {
      const engine = new LayoutEngine();

      engine.restoreColumns({
        activeColumnId: columnId("source"),
        columns: [
          {
            column: {
              id: columnId("left"),
              presentation: "stacked",
              selectedWindowId: windowId("left-window"),
              width: { kind: "fixed", value: 260 },
              windowIds: [windowId("left-window")],
            },
            index: 0,
          },
          {
            column: {
              id: columnId("source"),
              presentation: "stacked",
              selectedWindowId: windowId("moved"),
              width: { kind: "proportion", value: 0.43 },
              windowHeights: [
                { kind: "auto", weight: 2 },
                { clientHeight: 333, kind: "fixed" },
                { kind: "auto", weight: 4 },
              ],
              windowIds: [
                windowId("source-a"),
                windowId("moved"),
                windowId("source-c"),
              ],
            },
            index: 1,
          },
          {
            column: {
              id: columnId("target"),
              presentation: "tabbed",
              selectedWindowId: windowId("target-window"),
              width: { kind: "fixed", value: 720 },
              windowHeights: [{ clientHeight: 410, kind: "fixed" }],
              windowIds: [windowId("target-window")],
            },
            index: 2,
          },
        ],
        desktopId: desktop,
        outputId: output,
        viewportOffset: 117,
      });
      const before = engine.snapshot(output, desktop);
      const edit = engine.reinsertWindowAtColumnBoundary(
        windowId("moved"),
        { position, targetColumnId: columnId(targetColumn) },
        columnId("new"),
        "tabbed",
      );
      const after = engine.snapshot(output, desktop);

      expect(edit?.kind).toBe("extract");
      expect(after.activeColumnId).toBe("new");
      expect(after.viewportOffset).toBe(117);
      expect(after.columns.map((column) => column.id)).toEqual(
        expectedColumnIds,
      );
      expect(after.columns.find((column) => column.id === "source")).toEqual({
        id: "source",
        presentation: "stacked",
        selectedWindowId: "source-c",
        width: { kind: "proportion", value: 0.43 },
        windowHeights: [
          { kind: "auto", weight: 2 },
          { kind: "auto", weight: 4 },
        ],
        windowIds: ["source-a", "source-c"],
      });
      expect(after.columns.find((column) => column.id === "new")).toEqual({
        id: "new",
        presentation: "tabbed",
        selectedWindowId: "moved",
        width: { kind: "proportion", value: 0.43 },
        windowIds: ["moved"],
      });
      expect(after.columns.find((column) => column.id === "target")).toEqual(
        before.columns[2],
      );
      expect(edit && engine.rollbackStackEdit(edit.rollback)).toBe(true);
      expect(engine.snapshot(output, desktop)).toEqual(before);
    },
  );

  it("rejects invalid column-boundary edits without mutation", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("source"),
      columns: [
        {
          column: {
            id: columnId("source"),
            presentation: "stacked",
            selectedWindowId: windowId("moved"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("moved"), windowId("source-peer")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target"),
            presentation: "stacked",
            selectedWindowId: windowId("target-window"),
            width: { kind: "fixed", value: 500 },
            windowIds: [windowId("target-window")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const activeBefore = engine.snapshot(output, desktop);

    expect(
      engine.reinsertWindowAtColumnBoundary(
        windowId("moved"),
        { position: "after", targetColumnId: columnId("missing") },
        columnId("new"),
      ),
    ).toBeNull();
    expect(
      engine.reinsertWindowAtColumnBoundary(
        windowId("moved"),
        { position: "after", targetColumnId: columnId("target") },
        columnId("target"),
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(activeBefore);

    expect(engine.activateWindow(windowId("target-window"))).toBe(true);
    const inactiveBefore = engine.snapshot(output, desktop);
    expect(
      engine.reinsertWindowAtColumnBoundary(
        windowId("moved"),
        { position: "after", targetColumnId: columnId("target") },
        columnId("new"),
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(inactiveBefore);

    const singleton = new LayoutEngine();
    singleton.restoreColumns({
      activeColumnId: columnId("singleton"),
      columns: [
        {
          column: {
            id: columnId("singleton"),
            presentation: "stacked",
            selectedWindowId: windowId("singleton-window"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("singleton-window")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("neighbor"),
            presentation: "stacked",
            selectedWindowId: windowId("neighbor-window"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("neighbor-window")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    const singletonBefore = singleton.snapshot(output, desktop);

    expect(
      singleton.reinsertWindowAtColumnBoundary(
        windowId("singleton-window"),
        { position: "before", targetColumnId: columnId("neighbor") },
        columnId("unused"),
      ),
    ).toBeNull();
    expect(
      singleton.reinsertWindowAtColumnBoundary(
        windowId("singleton-window"),
        { position: "after", targetColumnId: columnId("singleton") },
        columnId("unused"),
      ),
    ).toBeNull();
    expect(singleton.snapshot(output, desktop)).toEqual(singletonBefore);
  });

  it("commits a singleton transfer before a window in another context", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-moved"),
      columns: [
        {
          column: {
            id: columnId("source-left"),
            presentation: "stacked",
            selectedWindowId: windowId("source-left-window"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("source-left-window")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-moved"),
            presentation: "stacked",
            selectedWindowId: windowId("moved"),
            width: { kind: "fixed", value: 310 },
            windowHeights: [{ clientHeight: 380, kind: "fixed" }],
            windowIds: [windowId("moved")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("source-right"),
            presentation: "stacked",
            selectedWindowId: windowId("source-right-window"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("source-right-window")],
          },
          index: 2,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 80,
    });
    engine.restoreColumns({
      activeColumnId: null,
      columns: [
        {
          column: {
            id: columnId("target"),
            presentation: "stacked",
            selectedWindowId: windowId("target-window"),
            width: { kind: "proportion", value: 0.7 },
            windowIds: [windowId("target-window")],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: targetOutput,
      viewportOffset: -45,
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const preview = engine.previewWindowTransferToWindow(windowId("moved"), {
      desktopId: desktop,
      outputId: targetOutput,
      position: "before",
      targetWindowId: windowId("target-window"),
    });

    if (!preview) {
      throw new Error("expected a target-window transfer preview");
    }

    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
    expect(preview.sourceLayout).toEqual({
      activeColumnId: "source-right",
      columns: [
        {
          id: "source-left",
          presentation: "stacked",
          selectedWindowId: "source-left-window",
          width: { kind: "fixed", value: 240 },
          windowIds: ["source-left-window"],
        },
        {
          id: "source-right",
          presentation: "stacked",
          selectedWindowId: "source-right-window",
          width: { kind: "fixed", value: 360 },
          windowIds: ["source-right-window"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 80,
    });
    expect(preview.targetLayout).toEqual({
      activeColumnId: "target",
      columns: [
        {
          id: "target",
          presentation: "stacked",
          selectedWindowId: "moved",
          width: { kind: "proportion", value: 0.7 },
          windowIds: ["moved", "target-window"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "HDMI-A-1",
      viewportOffset: -45,
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.sourceLayout)).toBe(true);
    expect(Object.isFrozen(preview.targetLayout.columns[0]?.windowIds)).toBe(
      true,
    );
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(
      preview.targetLayout,
    );
  });

  it("moves a stack member after a destination member with automatic height", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-stack"),
      columns: [
        {
          column: {
            id: columnId("source-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("source-a"),
            width: { kind: "fixed", value: 310 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 330, kind: "fixed" },
              { kind: "auto", weight: 4 },
            ],
            windowIds: [
              windowId("source-a"),
              windowId("moved"),
              windowId("source-c"),
            ],
          },
          index: 0,
        },
      ],
      desktopId: desktop,
      outputId: output,
      viewportOffset: 35,
    });
    engine.restoreColumns({
      activeColumnId: columnId("target-left"),
      columns: [
        {
          column: {
            id: columnId("target-left"),
            presentation: "stacked",
            selectedWindowId: windowId("target-left-window"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("target-left-window")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target-stack"),
            presentation: "stacked",
            selectedWindowId: windowId("target-a"),
            width: { kind: "proportion", value: 0.62 },
            windowHeights: [
              { kind: "auto", weight: 3 },
              { index: 2, kind: "preset" },
              { kind: "auto", weight: 5 },
            ],
            windowIds: [
              windowId("target-a"),
              windowId("target-b"),
              windowId("target-c"),
            ],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: targetOutput,
      viewportOffset: -20,
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const preview = engine.previewWindowTransferToWindow(windowId("moved"), {
      desktopId: desktop,
      outputId: targetOutput,
      position: "after",
      targetWindowId: windowId("target-b"),
    });

    if (!preview) {
      throw new Error("expected a stacked target-window transfer preview");
    }

    expect(preview.sourceLayout).toEqual({
      ...sourceBefore,
      columns: [
        {
          id: "source-stack",
          presentation: "stacked",
          selectedWindowId: "source-a",
          width: { kind: "fixed", value: 310 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 4 },
          ],
          windowIds: ["source-a", "source-c"],
        },
      ],
    });
    expect(preview.targetLayout).toEqual({
      ...targetBefore,
      activeColumnId: "target-stack",
      columns: [
        targetBefore.columns[0],
        {
          id: "target-stack",
          presentation: "stacked",
          selectedWindowId: "moved",
          width: { kind: "proportion", value: 0.62 },
          windowHeights: [
            { kind: "auto", weight: 3 },
            { index: 2, kind: "preset" },
            { kind: "auto", weight: 1 },
            { kind: "auto", weight: 5 },
          ],
          windowIds: ["target-a", "target-b", "moved", "target-c"],
        },
      ],
    });
    expect(engine.commitWindowTransfer(preview)).toBe(true);
    expect(engine.snapshot(output, desktop)).toEqual(preview.sourceLayout);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(
      preview.targetLayout,
    );
  });

  it("rejects invalid target-window transfers without mutating either context", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-active"),
      columns: [
        {
          column: {
            id: columnId("source-inactive"),
            presentation: "stacked",
            selectedWindowId: windowId("inactive"),
            width: { kind: "fixed", value: 260 },
            windowIds: [windowId("inactive")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-active"),
            presentation: "stacked",
            selectedWindowId: windowId("active"),
            width: { kind: "fixed", value: 320 },
            windowIds: [windowId("active")],
          },
          index: 1,
        },
      ],
      desktopId: desktop,
      outputId: output,
    });
    engine.manageWindow({
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 450 },
      windowId: windowId("target-window"),
    });
    const sourceBefore = engine.snapshot(output, desktop);
    const targetBefore = engine.snapshot(targetOutput, desktop);
    const request = {
      desktopId: desktop,
      outputId: targetOutput,
      position: "before" as const,
      targetWindowId: windowId("target-window"),
    };

    expect(
      engine.previewWindowTransferToWindow(windowId("unknown"), request),
    ).toBeNull();
    expect(
      engine.previewWindowTransferToWindow(windowId("inactive"), request),
    ).toBeNull();
    expect(
      engine.previewWindowTransferToWindow(windowId("active"), {
        ...request,
        outputId: output,
        targetWindowId: windowId("inactive"),
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransferToWindow(windowId("active"), {
        ...request,
        targetWindowId: windowId("missing"),
      }),
    ).toBeNull();
    expect(
      engine.previewWindowTransferToWindow(windowId("active"), {
        ...request,
        position: "middle",
      } as never),
    ).toBeNull();
    expect(
      engine.previewWindowTransferToWindow(
        windowId("active"),
        null as unknown as Parameters<
          LayoutEngine["previewWindowTransferToWindow"]
        >[1],
      ),
    ).toBeNull();
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetBefore);
  });

  it("consumes a target-window preview when either context is stale", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.manageWindow({
      columnId: columnId("source"),
      desktopId: desktop,
      outputId: output,
      width: { kind: "fixed", value: 300 },
      windowId: windowId("moved"),
    });
    engine.activateWindow(windowId("moved"));
    engine.manageWindow({
      columnId: columnId("target"),
      desktopId: desktop,
      outputId: targetOutput,
      width: { kind: "fixed", value: 420 },
      windowId: windowId("target-window"),
    });
    const preview = engine.previewWindowTransferToWindow(windowId("moved"), {
      desktopId: desktop,
      outputId: targetOutput,
      position: "after",
      targetWindowId: windowId("target-window"),
    });

    if (!preview) {
      throw new Error("expected a target-window transfer preview");
    }

    expect(engine.setViewportOffset(targetOutput, desktop, 70)).toBe(true);
    const sourceBefore = engine.snapshot(output, desktop);
    const targetChanged = engine.snapshot(targetOutput, desktop);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
    expect(engine.commitWindowTransfer(preview)).toBe(false);
    expect(engine.snapshot(output, desktop)).toEqual(sourceBefore);
    expect(engine.snapshot(targetOutput, desktop)).toEqual(targetChanged);
  });
});
