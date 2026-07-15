import { describe, expect, it } from "vitest";
import type { Rect, WindowGeometry } from "../../src/core/geometry";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import type { LayoutContextSnapshot } from "../../src/core/layout-engine";
import {
  planPointerColumnDrop,
  planPointerColumnDropPreview,
  planPointerExternalColumnDrop,
  planPointerExternalWindowDrop,
  planPointerWindowDrop,
  planPointerWindowDropPreview,
  type PointerColumnDropInput,
  type PointerExternalColumnDropInput,
  type PointerExternalWindowDropInput,
  type PointerWindowDropInput,
} from "../../src/core/pointer-reinsertion";

const visibleArea: Rect = { height: 300, width: 500, x: 0, y: 0 };

describe("planPointerWindowDrop", () => {
  it("selects before and after relative to the target vertical midpoint", () => {
    const input = fixture();
    const before = planPointerWindowDrop({
      ...input,
      cursor: { x: 250, y: 49.999 },
    });
    const after = planPointerWindowDrop({
      ...input,
      cursor: { x: 250, y: 50 },
    });

    expect(before).toEqual({
      position: "before",
      targetWindowId: "target-a",
    });
    expect(after).toEqual({
      position: "after",
      targetWindowId: "target-a",
    });
    expect(Object.isFrozen(before)).toBe(true);
  });

  it.each([
    {
      expected: {
        frame: { height: 51, width: 99, x: 201, y: 0 },
        target: { position: "before", targetWindowId: "target-a" },
      },
      input: () => ({
        ...fractionalPreviewFixture(),
        cursor: { x: 250, y: 50.999 },
      }),
      name: "before",
    },
    {
      expected: {
        frame: { height: 51, width: 99, x: 201, y: 51 },
        target: { position: "after", targetWindowId: "target-a" },
      },
      input: () => ({
        ...fractionalPreviewFixture(),
        cursor: { x: 250, y: 51 },
      }),
      name: "after",
    },
    {
      expected: null,
      input: sameColumnNoOpFixture,
      name: "same-column no-op",
    },
    {
      expected: null,
      input: () => ({
        ...fractionalPreviewFixture(),
        cursor: { x: Number.NaN, y: 25 },
      }),
      name: "invalid input",
    },
    {
      expected: null,
      input: () => ({
        ...fixture({
          targetAFrame: {
            height: Number.MIN_VALUE,
            width: 100,
            x: 200,
            y: 0,
          },
        }),
        cursor: { x: 250, y: 0 },
      }),
      name: "unrepresentable target half",
    },
  ])("plans an immutable $name preview", ({ expected, input }) => {
    const previewInput = input();
    const preview = planPointerWindowDropPreview(previewInput);

    expect(preview).toEqual(expected);

    if (preview) {
      expect(preview.target).toEqual(planPointerWindowDrop(previewInput));
      expect(preview.frame.height).toBeGreaterThan(0);
      expect(Object.isFrozen(preview)).toBe(true);
      expect(Object.isFrozen(preview.frame)).toBe(true);
      expect(Object.isFrozen(preview.target)).toBe(true);
    }
  });

  it("uses half-open hit regions for adjacent target frames", () => {
    const input = fixture();

    expect(
      planPointerWindowDrop({ ...input, cursor: { x: 250, y: 99.999 } }),
    ).toEqual({ position: "after", targetWindowId: "target-a" });
    expect(
      planPointerWindowDrop({ ...input, cursor: { x: 250, y: 100 } }),
    ).toEqual({ position: "before", targetWindowId: "target-b" });
  });

  it("hit-tests only the visible part of a target frame", () => {
    const input = fixture({
      targetAFrame: { height: 100, width: 100, x: -50, y: 0 },
    });

    expect(
      planPointerWindowDrop({ ...input, cursor: { x: 25, y: 25 } }),
    ).toEqual({ position: "before", targetWindowId: "target-a" });
    expect(
      planPointerWindowDrop({ ...input, cursor: { x: -25, y: 25 } }),
    ).toBeNull();
  });

  it("rejects ambiguous overlapping target frames", () => {
    const input = fixture({
      targetBFrame: { height: 100, width: 100, x: 200, y: 0 },
    });

    expect(
      planPointerWindowDrop({ ...input, cursor: { x: 250, y: 25 } }),
    ).toBeNull();
  });

  it("hit-tests only the selected member of an overlapping tabbed column", () => {
    const input = fixture();
    const sourceColumn = input.context.columns[0];
    const targetColumn = input.context.columns[1];
    const targetFrame = input.windows[1]?.frame;

    if (!sourceColumn || !targetColumn || !targetFrame) {
      throw new Error("expected a tabbed destination fixture");
    }

    const context: LayoutContextSnapshot = {
      ...input.context,
      columns: [
        sourceColumn,
        {
          ...targetColumn,
          presentation: "tabbed",
          selectedWindowId: windowId("target-b"),
        },
      ],
    };
    const windows = input.windows.map((candidate) =>
      candidate.windowId === "target-b"
        ? { ...candidate, frame: targetFrame }
        : candidate,
    );

    expect(
      planPointerWindowDrop({
        ...input,
        context,
        cursor: { x: 250, y: 25 },
        windows,
      }),
    ).toEqual({ position: "before", targetWindowId: "target-b" });
  });

  it("rejects a dragged-window hit and an ineffective adjacent drop", () => {
    const input = fixture();
    const sameColumnContext: LayoutContextSnapshot = {
      ...input.context,
      activeColumnId: columnId("stack"),
      columns: [
        {
          id: columnId("stack"),
          presentation: "stacked",
          selectedWindowId: windowId("dragged"),
          width: { kind: "fixed", value: 400 },
          windowIds: [windowId("dragged"), windowId("target-a")],
        },
      ],
    };
    const sameColumnWindows = [
      geometry("dragged", "stack", { height: 100, width: 100, x: 0, y: 0 }),
      geometry("target-a", "stack", {
        height: 100,
        width: 100,
        x: 200,
        y: 0,
      }),
    ];

    expect(
      planPointerWindowDrop({ ...input, cursor: { x: 50, y: 50 } }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        context: sameColumnContext,
        cursor: { x: 250, y: 25 },
        windows: sameColumnWindows,
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        context: sameColumnContext,
        cursor: { x: 250, y: 75 },
        windows: sameColumnWindows,
      }),
    ).toEqual({ position: "after", targetWindowId: "target-a" });
  });

  it("rejects duplicate context and geometry identities", () => {
    const input = fixture();
    const duplicateContext: LayoutContextSnapshot = {
      ...input.context,
      columns: [
        ...input.context.columns,
        {
          id: columnId("duplicate"),
          presentation: "stacked",
          selectedWindowId: windowId("target-a"),
          width: { kind: "fixed", value: 200 },
          windowIds: [windowId("target-a")],
        },
      ],
    };
    const duplicateGeometry = [input.windows[0], ...input.windows];

    expect(
      planPointerWindowDrop({
        ...input,
        context: duplicateContext,
        cursor: { x: 250, y: 25 },
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: 250, y: 25 },
        windows: duplicateGeometry as readonly WindowGeometry[],
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: 250, y: 25 },
        windows: input.windows.slice(1),
      }),
    ).toBeNull();
  });

  it("rejects stale column ownership and invalid coordinates", () => {
    const input = fixture();
    const stale = input.windows.map((candidate) =>
      candidate.windowId === "target-a"
        ? { ...candidate, columnId: columnId("stale") }
        : candidate,
    );

    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: 250, y: 25 },
        windows: stale,
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: Number.NaN, y: 25 },
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: 250, y: 25 },
        visibleArea: { ...visibleArea, width: 0 },
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        cursor: { x: 250, y: 25 },
        windows: [
          ...input.windows.slice(0, 1),
          {
            ...input.windows[1],
            frame: {
              height: 100,
              width: Number.POSITIVE_INFINITY,
              x: 200,
              y: 0,
            },
          } as WindowGeometry,
          ...input.windows.slice(2),
        ],
      }),
    ).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    const input = fixture();

    expect(
      planPointerWindowDrop(
        null as unknown as Parameters<typeof planPointerWindowDrop>[0],
      ),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        context: null as unknown as LayoutContextSnapshot,
      }),
    ).toBeNull();
    expect(
      planPointerWindowDrop({
        ...input,
        windows: null as unknown as readonly WindowGeometry[],
      }),
    ).toBeNull();
  });
});

describe("planPointerColumnDrop", () => {
  it("selects canonical interior and outer insertion targets", () => {
    const sourceFirst = columnDropFixture({ sourceIndex: 0 });
    const sourceLast = columnDropFixture({ sourceIndex: 2 });

    expect(
      planPointerColumnDrop({
        ...sourceFirst,
        cursor: { x: 325, y: 100 },
      }),
    ).toEqual({ position: "after", targetColumnId: "middle-column" });
    expect(
      planPointerColumnDrop({
        ...sourceFirst,
        cursor: { x: 475, y: 100 },
      }),
    ).toEqual({ position: "after", targetColumnId: "right-column" });
    expect(
      planPointerColumnDrop({
        ...sourceLast,
        cursor: { x: 25, y: 100 },
      }),
    ).toEqual({ position: "before", targetColumnId: "left-column" });
  });

  it("leaves exact-window hits to the exact-window planner", () => {
    const input = fixture();
    const cursor = { x: 250, y: 25 };

    expect(planPointerWindowDrop({ ...input, cursor })).toEqual({
      position: "before",
      targetWindowId: "target-a",
    });
    expect(planPointerColumnDrop({ ...input, cursor })).toBeNull();
    expect(
      planPointerColumnDrop({ ...input, cursor: { x: 250, y: 250 } }),
    ).toBeNull();
  });

  it("rejects both original insertion boundaries for a singleton source", () => {
    const input = columnDropFixture({ sourceIndex: 1 });

    expect(
      planPointerColumnDrop({ ...input, cursor: { x: 175, y: 100 } }),
    ).toBeNull();
    expect(
      planPointerColumnDrop({ ...input, cursor: { x: 325, y: 100 } }),
    ).toBeNull();
  });

  it("keeps a source-column boundary valid for a stacked member", () => {
    const input = stackedSourceColumnDropFixture();

    expect(planPointerColumnDrop(input)).toEqual({
      position: "after",
      targetColumnId: "source-column",
    });
  });

  it("clips half-open gutters and preview height to the visible tiled envelope", () => {
    const input = clippedColumnDropFixture();
    const preview = planPointerColumnDropPreview(input);

    expect(preview).toEqual({
      frame: { height: 300, width: 50, x: 50, y: 0 },
      target: { position: "after", targetColumnId: "left-column" },
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview?.frame)).toBe(true);
    expect(Object.isFrozen(preview?.target)).toBe(true);
    expect(
      planPointerColumnDrop({ ...input, cursor: { x: 50, y: 100 } }),
    ).toEqual({ position: "after", targetColumnId: "left-column" });
    expect(
      planPointerColumnDrop({ ...input, cursor: { x: 100, y: 100 } }),
    ).toBeNull();
  });

  it("rounds preview edges before deriving its dimensions", () => {
    const input = columnDropFixture({ sourceIndex: 2 });
    const preview = planPointerColumnDropPreview({
      ...input,
      cursor: { x: 175, y: 100 },
      visibleArea: { height: 299.5, width: 499.5, x: 0.25, y: 0.25 },
      windows: input.windows.map((candidate) => {
        if (candidate.columnId === "left-column") {
          return {
            ...candidate,
            frame: { height: 311, width: 99.7, x: 50.4, y: -5.4 },
          };
        }

        if (candidate.columnId === "middle-column") {
          return {
            ...candidate,
            frame: { height: 220, width: 99.6, x: 200.6, y: 10 },
          };
        }

        return {
          ...candidate,
          frame: { height: 200, width: 99.2, x: 350.8, y: 30 },
        };
      }),
    });

    expect(preview?.frame).toEqual({
      height: 300,
      width: 51,
      x: 150,
      y: 0,
    });

    const huge = stackedSourceColumnDropFixture();
    expect(
      planPointerColumnDropPreview({
        ...huge,
        cursor: { x: 0, y: 100 },
        visibleArea: {
          height: 200,
          width: Number.MAX_SAFE_INTEGER * 2,
          x: -Number.MAX_SAFE_INTEGER,
          y: 0,
        },
        windows: huge.windows.map((candidate) => ({
          ...candidate,
          frame: {
            ...candidate.frame,
            width: 1,
            x:
              candidate.columnId === "source-column"
                ? -Number.MAX_SAFE_INTEGER
                : Number.MAX_SAFE_INTEGER - 1,
          },
        })),
      }),
    ).toBeNull();
  });

  it.each([
    {
      mutate: (input: PointerColumnDropInput): PointerColumnDropInput => ({
        ...input,
        windows: input.windows.slice(1),
      }),
      name: "missing geometry",
    },
    {
      mutate: (input: PointerColumnDropInput): PointerColumnDropInput => ({
        ...input,
        windows: input.windows.map((candidate) =>
          candidate.windowId === "source-peer"
            ? { ...candidate, frame: { ...candidate.frame, x: 1 } }
            : candidate,
        ),
      }),
      name: "inconsistent member bounds",
    },
    {
      mutate: (input: PointerColumnDropInput): PointerColumnDropInput => ({
        ...input,
        windows: input.windows.map((candidate) =>
          candidate.columnId === "target-column"
            ? { ...candidate, frame: { ...candidate.frame, x: 50 } }
            : candidate,
        ),
      }),
      name: "overlapping column spans",
    },
    {
      mutate: (input: PointerColumnDropInput): PointerColumnDropInput => ({
        ...input,
        cursor: { x: 100, y: 100 },
        windows: input.windows.map((candidate) =>
          candidate.columnId === "target-column"
            ? { ...candidate, frame: { ...candidate.frame, x: 100 } }
            : candidate,
        ),
      }),
      name: "zero-width gutter",
    },
  ])("rejects $name", ({ mutate }) => {
    expect(
      planPointerColumnDrop(mutate(stackedSourceColumnDropFixture())),
    ).toBeNull();
  });
});

describe("planPointerExternalWindowDrop", () => {
  it("selects a complete destination target around its vertical midpoint", () => {
    const input = externalFixture();
    const before = planPointerExternalWindowDrop({
      ...input,
      cursor: { x: 250, y: 49.999 },
    });
    const after = planPointerExternalWindowDrop({
      ...input,
      cursor: { x: 250, y: 50 },
    });

    expect(before).toEqual({
      position: "before",
      targetWindowId: "target-a",
    });
    expect(after).toEqual({
      position: "after",
      targetWindowId: "target-a",
    });
    expect(Object.isFrozen(before)).toBe(true);
  });

  it("rejects outside, ambiguous, and incomplete destination hits", () => {
    const input = externalFixture();
    const overlapping = input.windows.map((candidate) =>
      candidate.windowId === "target-b"
        ? { ...candidate, frame: { ...candidate.frame, y: 0 } }
        : candidate,
    );

    expect(
      planPointerExternalWindowDrop({
        ...input,
        cursor: { x: -1, y: 25 },
      }),
    ).toBeNull();
    expect(
      planPointerExternalWindowDrop({ ...input, windows: overlapping }),
    ).toBeNull();
    expect(
      planPointerExternalWindowDrop({
        ...input,
        windows: input.windows.slice(1),
      }),
    ).toBeNull();
  });

  it("rejects dragged membership and invalid destination state", () => {
    const input = externalFixture();
    const draggedColumn = fixture().context.columns[0];

    if (!draggedColumn) {
      throw new Error("expected a dragged source column");
    }

    expect(
      planPointerExternalWindowDrop({
        ...input,
        context: {
          ...input.context,
          columns: [draggedColumn, ...input.context.columns],
        },
        windows: [fixture().windows[0], ...input.windows].filter(
          (candidate): candidate is WindowGeometry => candidate !== undefined,
        ),
      }),
    ).toBeNull();
    expect(
      planPointerExternalWindowDrop({
        ...input,
        context: {
          ...input.context,
          activeColumnId: columnId("missing"),
        },
      }),
    ).toBeNull();
    expect(
      planPointerExternalWindowDrop({
        ...input,
        context: {
          ...input.context,
          columns: input.context.columns.map((column) => ({
            ...column,
            width: { kind: "fixed" as const, value: 0 },
          })),
        },
      }),
    ).toBeNull();
    expect(
      planPointerExternalWindowDrop(
        null as unknown as Parameters<typeof planPointerExternalWindowDrop>[0],
      ),
    ).toBeNull();
  });
});

describe("planPointerExternalColumnDrop", () => {
  it.each([
    ["before", 25, { position: "before", targetColumnId: "left-column" }],
    ["between", 175, { position: "after", targetColumnId: "left-column" }],
    ["after", 475, { position: "after", targetColumnId: "right-column" }],
  ] as const)("selects the %s destination gutter", (_name, x, expected) => {
    const target = planPointerExternalColumnDrop({
      ...externalColumnDropFixture(),
      cursor: { x, y: 100 },
    });

    expect(target).toEqual(expected);
    expect(Object.isFrozen(target)).toBe(true);
  });

  it.each([
    [
      "invalid geometry",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        windows: input.windows.map((candidate, index) =>
          index === 0
            ? { ...candidate, frame: { ...candidate.frame, width: 0 } }
            : candidate,
        ),
      }),
    ],
    [
      "incomplete geometry",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        windows: input.windows.slice(1),
      }),
    ],
    [
      "duplicate geometry",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        windows: [...input.windows, ...input.windows],
      }),
    ],
    [
      "overlapping columns",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        windows: input.windows.map((candidate) =>
          candidate.columnId === "middle-column"
            ? { ...candidate, frame: { ...candidate.frame, x: 100 } }
            : candidate,
        ),
      }),
    ],
    [
      "window hit",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        cursor: { x: 75, y: 100 },
      }),
    ],
    [
      "dragged destination member",
      (input: PointerExternalColumnDropInput) => ({
        ...input,
        draggedWindowId: windowId("left-window"),
      }),
    ],
  ] as const)("fails closed for %s", (_name, mutate) => {
    expect(
      planPointerExternalColumnDrop(mutate(externalColumnDropFixture())),
    ).toBeNull();
  });
});

function fixture(
  options: {
    readonly targetAFrame?: Rect;
    readonly targetBFrame?: Rect;
  } = {},
): PointerWindowDropInput {
  const context: LayoutContextSnapshot = {
    activeColumnId: columnId("dragged-column"),
    columns: [
      {
        id: columnId("dragged-column"),
        presentation: "stacked",
        selectedWindowId: windowId("dragged"),
        width: { kind: "fixed", value: 300 },
        windowIds: [windowId("dragged")],
      },
      {
        id: columnId("target-column"),
        presentation: "stacked",
        selectedWindowId: windowId("target-a"),
        width: { kind: "fixed", value: 400 },
        windowIds: [windowId("target-a"), windowId("target-b")],
      },
    ],
    desktopId: desktopId("desktop-1"),
    outputId: outputId("DP-1"),
    viewportOffset: 0,
  };

  return {
    context,
    cursor: { x: 250, y: 25 },
    draggedWindowId: windowId("dragged"),
    visibleArea,
    windows: [
      geometry("dragged", "dragged-column", {
        height: 100,
        width: 100,
        x: 0,
        y: 0,
      }),
      geometry(
        "target-a",
        "target-column",
        options.targetAFrame ?? { height: 100, width: 100, x: 200, y: 0 },
      ),
      geometry(
        "target-b",
        "target-column",
        options.targetBFrame ?? { height: 100, width: 100, x: 200, y: 100 },
      ),
    ],
  };
}

function externalFixture(): PointerExternalWindowDropInput {
  const input = fixture();
  const targetColumn = input.context.columns[1];

  if (!targetColumn) {
    throw new Error("expected a destination column");
  }

  return {
    context: {
      ...input.context,
      activeColumnId: targetColumn.id,
      columns: [targetColumn],
      outputId: outputId("HDMI-A-1"),
    },
    cursor: input.cursor,
    draggedWindowId: input.draggedWindowId,
    visibleArea: input.visibleArea,
    windows: input.windows.slice(1),
  };
}

function externalColumnDropFixture(): PointerExternalColumnDropInput {
  return {
    ...columnDropFixture({ sourceIndex: 0 }),
    draggedWindowId: windowId("external"),
  };
}

function columnDropFixture(options: {
  readonly sourceIndex: number;
}): PointerColumnDropInput {
  const logicalColumns = [
    {
      column: "left-column",
      frame: { height: 180, width: 100, x: 50, y: 20 },
      window: "left-window",
    },
    {
      column: "middle-column",
      frame: { height: 220, width: 100, x: 200, y: 10 },
      window: "middle-window",
    },
    {
      column: "right-column",
      frame: { height: 200, width: 100, x: 350, y: 30 },
      window: "right-window",
    },
  ];
  const source = logicalColumns[options.sourceIndex];

  if (!source) {
    throw new Error("expected a source column fixture");
  }

  return {
    context: {
      activeColumnId: columnId(source.column),
      columns: logicalColumns.map((candidate) => ({
        id: columnId(candidate.column),
        presentation: "stacked" as const,
        selectedWindowId: windowId(candidate.window),
        width: { kind: "fixed" as const, value: candidate.frame.width },
        windowIds: [windowId(candidate.window)],
      })),
      desktopId: desktopId("desktop-1"),
      outputId: outputId("DP-1"),
      viewportOffset: 0,
    },
    cursor: { x: 325, y: 100 },
    draggedWindowId: windowId(source.window),
    visibleArea,
    windows: logicalColumns.map((candidate) =>
      geometry(candidate.window, candidate.column, candidate.frame),
    ),
  };
}

function stackedSourceColumnDropFixture(): PointerColumnDropInput {
  return {
    context: {
      activeColumnId: columnId("source-column"),
      columns: [
        {
          id: columnId("source-column"),
          presentation: "stacked",
          selectedWindowId: windowId("dragged"),
          width: { kind: "fixed", value: 100 },
          windowIds: [windowId("dragged"), windowId("source-peer")],
        },
        {
          id: columnId("target-column"),
          presentation: "stacked",
          selectedWindowId: windowId("target"),
          width: { kind: "fixed", value: 100 },
          windowIds: [windowId("target")],
        },
      ],
      desktopId: desktopId("desktop-1"),
      outputId: outputId("DP-1"),
      viewportOffset: 0,
    },
    cursor: { x: 150, y: 100 },
    draggedWindowId: windowId("dragged"),
    visibleArea,
    windows: [
      geometry("dragged", "source-column", {
        height: 100,
        width: 100,
        x: 0,
        y: 0,
      }),
      geometry("source-peer", "source-column", {
        height: 100,
        width: 100,
        x: 0,
        y: 100,
      }),
      geometry("target", "target-column", {
        height: 200,
        width: 100,
        x: 200,
        y: 0,
      }),
    ],
  };
}

function clippedColumnDropFixture(): PointerColumnDropInput {
  const input = columnDropFixture({ sourceIndex: 2 });

  return {
    ...input,
    cursor: { x: 75, y: 100 },
    windows: input.windows.map((candidate) => {
      if (candidate.columnId === "left-column") {
        return {
          ...candidate,
          frame: { height: 370, width: 100, x: -50, y: -20 },
        };
      }

      if (candidate.columnId === "middle-column") {
        return {
          ...candidate,
          frame: { height: 220, width: 100, x: 100, y: 10 },
        };
      }

      return {
        ...candidate,
        frame: { height: 200, width: 100, x: 260, y: 30 },
      };
    }),
  };
}

function fractionalPreviewFixture(): PointerWindowDropInput {
  return fixture({
    targetAFrame: { height: 101.5, width: 99.25, x: 200.5, y: 0.25 },
    targetBFrame: { height: 100, width: 99.25, x: 200.5, y: 110 },
  });
}

function sameColumnNoOpFixture(): PointerWindowDropInput {
  const input = fixture();

  return {
    ...input,
    context: {
      ...input.context,
      activeColumnId: columnId("stack"),
      columns: [
        {
          id: columnId("stack"),
          presentation: "stacked",
          selectedWindowId: windowId("dragged"),
          width: { kind: "fixed", value: 400 },
          windowIds: [windowId("dragged"), windowId("target-a")],
        },
      ],
    },
    cursor: { x: 250, y: 25 },
    windows: [
      geometry("dragged", "stack", {
        height: 100,
        width: 100,
        x: 0,
        y: 0,
      }),
      geometry("target-a", "stack", {
        height: 100,
        width: 100,
        x: 200,
        y: 0,
      }),
    ],
  };
}

function geometry(id: string, column: string, frame: Rect): WindowGeometry {
  return {
    columnId: columnId(column),
    frame,
    windowId: windowId(id),
  };
}
