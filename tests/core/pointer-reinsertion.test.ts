import { describe, expect, it } from "vitest";
import type { Rect, WindowGeometry } from "../../src/core/geometry";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import type { LayoutContextSnapshot } from "../../src/core/layout-engine";
import {
  planPointerWindowDrop,
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

function geometry(id: string, column: string, frame: Rect): WindowGeometry {
  return {
    columnId: columnId(column),
    frame,
    windowId: windowId(id),
  };
}
