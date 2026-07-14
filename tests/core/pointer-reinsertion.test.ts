import { describe, expect, it } from "vitest";
import type { Rect, WindowGeometry } from "../../src/core/geometry";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import type { LayoutContextSnapshot } from "../../src/core/layout-engine";
import {
  planPointerExternalWindowDrop,
  planPointerWindowDrop,
  planPointerWindowDropPreview,
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

  it("rejects a dragged-window hit and an ineffective adjacent drop", () => {
    const input = fixture();
    const sameColumnContext: LayoutContextSnapshot = {
      ...input.context,
      activeColumnId: columnId("stack"),
      columns: [
        {
          id: columnId("stack"),
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
        width: { kind: "fixed", value: 300 },
        windowIds: [windowId("dragged")],
      },
      {
        id: columnId("target-column"),
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
