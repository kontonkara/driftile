import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import {
  LayoutEngine,
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

  it("resolves edge columns and reorders the active column with exact rollback", () => {
    const engine = new LayoutEngine();

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

  it("mutates complete window-height state and rolls it back exactly", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
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

  it("keeps height state through reorder, floating, and whole-column transfer", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("column-stack"),
      columns: [
        {
          column: {
            id: columnId("column-stack"),
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
    expect(attach?.layout).toEqual(before);
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
    expect(engine.snapshot(output, desktop)).toEqual(before);

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
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
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
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column-3",
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

  it("extracts an active stack member beside its source and rolls back", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
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
    );

    expect(edit?.kind).toBe("extract");
    expect(engine.snapshot(output, desktop)).toEqual({
      activeColumnId: "column:split:window-2",
      columns: [
        {
          id: "column-1",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-1", "window-3"],
        },
        {
          id: "column:split:window-2",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-2"],
        },
        {
          id: "column-2",
          width: { kind: "fixed", value: 320 },
          windowIds: ["window-4"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: 40,
    });
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
            width: { kind: "fixed", value: 180 },
            windowIds: [windowId("window-source")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-middle"),
            width: { kind: "fixed", value: 260 },
            windowIds: [windowId("window-middle")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-target"),
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
          width: { kind: "fixed", value: 260 },
          windowIds: ["window-middle"],
        },
        {
          id: "column-target",
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
            width: { kind: "proportion", value: 0.25 },
            windowIds: [windowId("window-middle")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-source"),
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
          width: { kind: "fixed", value: 480 },
          windowIds: ["window-target-1", "window-target-2", "window-source-2"],
        },
        {
          id: "column-middle",
          width: { kind: "proportion", value: 0.25 },
          windowIds: ["window-middle"],
        },
        {
          id: "column-source",
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

  it("navigates and reorders members inside the active stack", () => {
    const engine = new LayoutEngine();

    engine.restoreColumns({
      activeColumnId: columnId("column-1"),
      columns: [
        {
          column: {
            id: columnId("column-1"),
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
            width: { kind: "fixed", value: 300 },
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
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-1")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-2"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-2")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-3"),
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
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-1"],
        },
        {
          id: "column-3",
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
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
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
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
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
          width: { kind: "fixed", value: 200 },
          windowIds: ["window-left"],
        },
        {
          id: "column-right",
          width: { kind: "fixed", value: 440 },
          windowIds: ["window-right"],
        },
        {
          id: "column-stack",
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
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-b"),
            width: { kind: "fixed", value: 333 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-c"),
            width: { kind: "fixed", value: 360 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
        {
          column: {
            id: columnId("column-d"),
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
          width: { kind: "fixed", value: 260 },
          windowIds: ["window-a"],
        },
        {
          id: "column-b",
          width: { kind: "fixed", value: 333 },
          windowIds: ["window-b"],
        },
        {
          id: "column-d",
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-d"],
        },
        {
          id: "column-c",
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
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-b"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column-c"),
            width: { kind: "fixed", value: 400 },
            windowIds: [windowId("window-c")],
          },
          index: 2,
        },
        {
          column: {
            id: columnId("column-d"),
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
            width: { kind: "fixed", value: 200 },
            windowIds: [windowId("window-left")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column-stack"),
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
          width: { kind: "fixed", value: 250 },
          windowIds: ["window-live-1"],
        },
        {
          id: "column-fresh",
          width: { kind: "fixed", value: 480 },
          windowIds: ["window-floating"],
        },
        {
          id: "column-live-2",
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

  it("previews and atomically transfers the whole active column", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-stack"),
      columns: [
        {
          column: {
            id: columnId("source-a"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-stack"),
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
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("window-target-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target-b"),
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
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-a"],
        },
        {
          id: "source-c",
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
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-target-a"],
        },
        {
          id: "transferred",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-b1", "window-b2", "window-b3"],
        },
        {
          id: "target-b",
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

  it("previews and atomically transfers an active singleton after the target active column", () => {
    const engine = new LayoutEngine();
    const targetOutput = outputId("HDMI-A-1");

    engine.restoreColumns({
      activeColumnId: columnId("source-b"),
      columns: [
        {
          column: {
            id: columnId("source-a"),
            width: { kind: "fixed", value: 240 },
            windowIds: [windowId("window-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("source-b"),
            width: { kind: "proportion", value: 0.4 },
            windowIds: [windowId("window-b")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("source-c"),
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
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("window-target-a")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("target-b"),
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
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-a"],
        },
        {
          id: "source-c",
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
          width: { kind: "fixed", value: 280 },
          windowIds: ["window-target-a"],
        },
        {
          id: "transferred",
          width: { kind: "proportion", value: 0.4 },
          windowIds: ["window-b"],
        },
        {
          id: "target-b",
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
});
