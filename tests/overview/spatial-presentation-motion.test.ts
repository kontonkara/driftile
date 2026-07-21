import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  planOverviewSpatialPresentationMotion,
  sampleOverviewSpatialPresentationMotion,
} from "../../src/overview/runtime";

const baseFrame = Object.freeze({ height: 120, width: 200, x: 20, y: 40 });

function presentation(
  windowId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    frame: baseFrame,
    kind: "thumbnail",
    minimized: false,
    windowId,
    ...overrides,
  };
}

function column(
  memberIds: readonly string[],
  selectedWindowId: string,
): Record<string, unknown> {
  return { memberIds, selectedWindowId };
}

function plan(
  current: readonly unknown[],
  next: readonly unknown[],
): NonNullable<ReturnType<typeof planOverviewSpatialPresentationMotion>> {
  const result = planOverviewSpatialPresentationMotion({ current, next });
  if (result === null) {
    throw new Error("expected a presentation motion plan");
  }
  return result;
}

describe("planOverviewSpatialPresentationMotion", () => {
  it("matches reordered survivors strictly by stable window ID", () => {
    const result = plan(
      [
        presentation("window-a", {
          frame: { height: 100, width: 180, x: 10, y: 20 },
        }),
        presentation("window-b", {
          frame: { height: 140, width: 220, x: 300, y: 60 },
        }),
      ],
      [
        presentation("window-b", {
          frame: { height: 150, width: 240, x: 340, y: 80 },
        }),
        presentation("window-a", {
          frame: { height: 110, width: 190, x: 40, y: 30 },
        }),
      ],
    );

    expect(result.survivors.map((track) => track.windowId)).toEqual([
      "window-a",
      "window-b",
    ]);
    expect(result.survivors[0]).toMatchObject({
      fromFrame: { height: 100, width: 180, x: 10, y: 20 },
      toFrame: { height: 110, width: 190, x: 40, y: 30 },
    });
    expect(result.survivors[1]).toMatchObject({
      fromFrame: { height: 140, width: 220, x: 300, y: 60 },
      toFrame: { height: 150, width: 240, x: 340, y: 80 },
    });
  });

  it("omits exact no-op survivors even when snapshot order changes", () => {
    const first = presentation("window-a");
    const second = presentation("window-b", {
      frame: { height: 90, width: 160, x: 260, y: 40 },
    });

    expect(plan([first, second], [second, first])).toEqual({
      entries: [],
      survivors: [],
    });
  });

  it("reflows survivors without retaining removed window identities", () => {
    const result = plan(
      [
        presentation("removed-window"),
        presentation("survivor", {
          frame: { height: 120, width: 200, x: 240, y: 40 },
        }),
      ],
      [
        presentation("survivor", {
          frame: { height: 120, width: 200, x: 20, y: 40 },
        }),
      ],
    );

    expect(result.entries).toEqual([]);
    expect(result.survivors).toHaveLength(1);
    expect(result.survivors[0]).toMatchObject({
      fromFrame: { height: 120, width: 200, x: 240, y: 40 },
      toFrame: { height: 120, width: 200, x: 20, y: 40 },
      windowId: "survivor",
    });
    expect(
      [...result.entries, ...result.survivors].some(
        (track) => track.windowId === "removed-window",
      ),
    ).toBe(false);
  });

  it("preserves both kinds and marker states across a tab swap", () => {
    const currentColumn = column(["window-a", "window-b"], "window-a");
    const nextColumn = column(["window-a", "window-b"], "window-b");
    const result = plan(
      [
        presentation("window-a", {
          column: currentColumn,
          kind: "thumbnail",
        }),
        presentation("window-b", { column: currentColumn, kind: "tab" }),
      ],
      [
        presentation("window-a", { column: nextColumn, kind: "tab" }),
        presentation("window-b", {
          column: nextColumn,
          kind: "thumbnail",
        }),
      ],
    );

    expect(result.survivors).toMatchObject([
      {
        column: null,
        fromKind: "thumbnail",
        fromMarkerProgress: 1,
        toKind: "tab",
        toMarkerProgress: 0,
        windowId: "window-a",
      },
      {
        column: null,
        fromKind: "tab",
        fromMarkerProgress: 0,
        toKind: "thumbnail",
        toMarkerProgress: 1,
        windowId: "window-b",
      },
    ]);
  });

  it("preserves minimized state for minimize and restore morphs", () => {
    const result = plan(
      [
        presentation("minimize"),
        presentation("restore", { kind: "placeholder", minimized: true }),
      ],
      [
        presentation("minimize", { kind: "placeholder", minimized: true }),
        presentation("restore"),
      ],
    );

    expect(result.survivors).toMatchObject([
      {
        fromKind: "thumbnail",
        fromMinimized: false,
        toKind: "placeholder",
        toMinimized: true,
        windowId: "minimize",
      },
      {
        fromKind: "placeholder",
        fromMinimized: true,
        toKind: "thumbnail",
        toMinimized: false,
        windowId: "restore",
      },
    ]);
  });

  it("plans marker-only selection changes", () => {
    const before = column(["window-a", "window-b"], "window-a");
    const after = column(["window-a", "window-b"], "window-b");
    const result = plan(
      [
        presentation("window-a", { column: before, kind: "tab" }),
        presentation("window-b", { column: before, kind: "tab" }),
      ],
      [
        presentation("window-a", { column: after, kind: "tab" }),
        presentation("window-b", { column: after, kind: "tab" }),
      ],
    );

    expect(result.survivors).toHaveLength(2);
    expect(result.survivors[0]).toMatchObject({
      fromFrame: baseFrame,
      fromMarkerProgress: 1,
      toFrame: baseFrame,
      toMarkerProgress: 0,
      windowId: "window-a",
    });
    expect(result.survivors[1]).toMatchObject({
      fromMarkerProgress: 0,
      toMarkerProgress: 1,
      windowId: "window-b",
    });
  });

  it("retains exact column identity across array and column-position changes", () => {
    const exactColumn = column(["window-a", "window-b"], "window-a");
    const result = plan(
      [
        presentation("window-a", { column: exactColumn }),
        presentation("window-b", { column: exactColumn }),
        presentation("leading-window"),
      ],
      [
        presentation("leading-window"),
        presentation("window-b", { column: exactColumn }),
        presentation("window-a", {
          column: exactColumn,
          frame: { ...baseFrame, x: 320 },
        }),
      ],
    );

    expect(result.survivors).toHaveLength(1);
    expect(result.survivors[0]?.column).toEqual({
      memberIds: ["window-a", "window-b"],
      selectedWindowId: "window-a",
    });
  });

  it("moves every surviving presentation in one exact column together", () => {
    const exactColumn = column(["window-a", "window-b"], "window-a");
    const result = plan(
      [
        presentation("window-a", {
          column: exactColumn,
          frame: { height: 140, width: 220, x: 40, y: 30 },
        }),
        presentation("window-b", {
          column: exactColumn,
          frame: { height: 24, width: 220, x: 40, y: 176 },
          kind: "tab",
        }),
      ],
      [
        presentation("window-a", {
          column: exactColumn,
          frame: { height: 160, width: 250, x: 300, y: 50 },
        }),
        presentation("window-b", {
          column: exactColumn,
          frame: { height: 28, width: 250, x: 300, y: 216 },
          kind: "tab",
        }),
      ],
    );

    expect(result.survivors).toHaveLength(2);
    for (const track of result.survivors) {
      expect(track.column).toEqual({
        memberIds: ["window-a", "window-b"],
        selectedWindowId: "window-a",
      });
      const sample = sampleOverviewSpatialPresentationMotion(track, 0.5);
      expect(sample).not.toBeNull();
      expect(sample?.frame.x).toBe(170);
    }
    expect(result.survivors.map((track) => track.windowId)).toEqual([
      "window-a",
      "window-b",
    ]);
  });

  it("invalidates whole-column grouping when ordered membership drifts", () => {
    const result = plan(
      [
        presentation("window-a", {
          column: column(["window-a", "window-b"], "window-a"),
        }),
      ],
      [
        presentation("window-a", {
          column: column(["window-a", "window-c"], "window-a"),
          frame: { ...baseFrame, x: 120 },
        }),
      ],
    );

    expect(result.survivors[0]?.column).toBeNull();
  });

  it("plans next-only windows as stable fade-in entries", () => {
    const result = plan([], [presentation("new-window", { kind: "tab" })]);

    expect(result.entries).toEqual([
      {
        column: null,
        disposition: "entry",
        fromFrame: baseFrame,
        fromKind: "tab",
        fromMarkerProgress: 0,
        fromMinimized: false,
        toFrame: baseFrame,
        toKind: "tab",
        toMarkerProgress: 0,
        toMinimized: false,
        windowId: "new-window",
      },
    ]);
  });

  it("returns detached deeply frozen tracks and column groups", () => {
    const mutableFrame = { height: 120, width: 200, x: 20, y: 40 };
    const mutableMembers = ["window-a", "window-b"];
    const before = presentation("window-a", {
      column: column(mutableMembers, "window-a"),
      frame: mutableFrame,
    });
    const after = presentation("window-a", {
      column: column(mutableMembers, "window-a"),
      frame: { ...mutableFrame, x: 80 },
    });
    const result = plan([before], [after]);

    mutableFrame.x = 700;
    mutableMembers[0] = "changed";

    const track = result.survivors[0];
    expect(track?.fromFrame.x).toBe(20);
    expect(track?.column?.memberIds).toEqual(["window-a", "window-b"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(Object.isFrozen(result.survivors)).toBe(true);
    expect(Object.isFrozen(track)).toBe(true);
    expect(Object.isFrozen(track?.fromFrame)).toBe(true);
    expect(Object.isFrozen(track?.toFrame)).toBe(true);
    expect(Object.isFrozen(track?.column)).toBe(true);
    expect(Object.isFrozen(track?.column?.memberIds)).toBe(true);
  });

  it.each([
    null,
    {},
    { current: null, next: [] },
    {
      current: [],
      next: [presentation("duplicate"), presentation("duplicate")],
    },
    { current: [], next: [presentation("")] },
    { current: [], next: [presentation("window", { kind: "unknown" })] },
    { current: [], next: [presentation("window", { minimized: "no" })] },
    {
      current: [],
      next: [presentation("window", { frame: { ...baseFrame, width: 0 } })],
    },
    {
      current: [],
      next: [
        presentation("window", {
          frame: {
            ...baseFrame,
            x: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
          },
        }),
      ],
    },
    {
      current: [],
      next: [
        presentation("window", {
          column: column([], "window"),
        }),
      ],
    },
    {
      current: [],
      next: [
        presentation("window", {
          column: column(["window", "window"], "window"),
        }),
      ],
    },
    {
      current: [],
      next: [
        presentation("window", {
          column: column(["other"], "other"),
        }),
      ],
    },
    {
      current: [],
      next: [
        presentation("window", {
          column: column(["window"], "other"),
        }),
      ],
    },
  ])("fails closed for malformed snapshots (%o)", (candidate) => {
    expect(planOverviewSpatialPresentationMotion(candidate)).toBeNull();
  });

  it("rejects excessive snapshots and column membership", () => {
    const excessiveSnapshot = Array.from(
      { length: LAYOUT_PERSISTENCE_LIMITS.windows + 1 },
      (_, index) => presentation(`window-${String(index)}`),
    );
    const excessiveMembers = Array.from(
      { length: LAYOUT_PERSISTENCE_LIMITS.membersPerColumn + 1 },
      (_, index) => `member-${String(index)}`,
    );

    expect(
      planOverviewSpatialPresentationMotion({
        current: [],
        next: excessiveSnapshot,
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialPresentationMotion({
        current: [],
        next: [
          presentation("member-0", {
            column: column(excessiveMembers, "member-0"),
          }),
        ],
      }),
    ).toBeNull();
  });

  it("rejects overlapping or internally inconsistent exact columns", () => {
    expect(
      planOverviewSpatialPresentationMotion({
        current: [],
        next: [
          presentation("window-a", {
            column: column(["window-a", "window-b"], "window-a"),
          }),
          presentation("window-c", {
            column: column(["window-b", "window-c"], "window-c"),
          }),
        ],
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialPresentationMotion({
        current: [],
        next: [
          presentation("window-a", {
            column: column(["window-a", "window-b"], "window-a"),
          }),
          presentation("window-b", {
            column: column(["window-a", "window-b"], "window-b"),
          }),
        ],
      }),
    ).toBeNull();
  });

  it.each([
    [
      presentation("window-a", {
        column: column(["window-a", "window-b"], "window-a"),
      }),
      presentation("window-b"),
    ],
    [
      presentation("window-b"),
      presentation("window-a", {
        column: column(["window-a", "window-b"], "window-a"),
      }),
    ],
  ])(
    "rejects present members without the same exact column identity (%o)",
    (next) => {
      expect(
        planOverviewSpatialPresentationMotion({ current: [], next }),
      ).toBeNull();
    },
  );

  it("fails closed when a snapshot accessor throws", () => {
    const hostile = Object.defineProperty({}, "windowId", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewSpatialPresentationMotion({ current: [], next: [hostile] }),
    ).toBeNull();
  });
});

describe("sampleOverviewSpatialPresentationMotion", () => {
  it("samples an exact mid-flight frame and separate visual channels", () => {
    const result = plan(
      [
        presentation("window", {
          column: column(["window"], "window"),
          frame: { height: 50, width: 100, x: 0, y: 10 },
        }),
      ],
      [
        presentation("window", {
          frame: { height: 150, width: 200, x: 100, y: 50 },
        }),
      ],
    );
    const sample = sampleOverviewSpatialPresentationMotion(
      result.survivors[0],
      0.25,
    );

    expect(sample).toEqual({
      frame: { height: 75, width: 125, x: 25, y: 20 },
      fromMarkerProgress: 0.75,
      fromOpacity: 0.75,
      toMarkerProgress: 0,
      toOpacity: 0.25,
    });
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample?.frame)).toBe(true);
  });

  it("samples an entry without inventing a source layer", () => {
    const result = plan(
      [],
      [
        presentation("entry", {
          column: column(["entry"], "entry"),
          kind: "tab",
        }),
      ],
    );

    expect(
      sampleOverviewSpatialPresentationMotion(result.entries[0], 0.4),
    ).toEqual({
      frame: baseFrame,
      fromMarkerProgress: 0,
      fromOpacity: 0,
      toMarkerProgress: 0.4,
      toOpacity: 0.4,
    });
  });

  it("preserves exact endpoint frames", () => {
    const result = plan(
      [
        presentation("window", {
          frame: {
            height: 0.000_001,
            width: 0.000_001,
            x: -999_999.999_999,
            y: -999_999.999_999,
          },
        }),
      ],
      [
        presentation("window", {
          frame: {
            height: 0.000_002,
            width: 0.000_002,
            x: 0.000_001,
            y: 0.000_001,
          },
        }),
      ],
    );
    const track = result.survivors[0];

    expect(sampleOverviewSpatialPresentationMotion(track, 0)?.frame).toEqual(
      track?.fromFrame,
    );
    expect(sampleOverviewSpatialPresentationMotion(track, 1)?.frame).toEqual(
      track?.toFrame,
    );
  });

  it("keeps rounded intermediate edges inside the geometry envelope", () => {
    const result = plan(
      [
        presentation("window", {
          frame: {
            height: 883_765.069_913_384_3,
            width: 883_765.069_913_384_3,
            x: 116_234.930_086_608_53,
            y: 116_234.930_086_608_53,
          },
        }),
      ],
      [
        presentation("window", {
          frame: {
            height: 370_043.015_215_265_16,
            width: 370_043.015_215_265_16,
            x: 629_956.984_784_734_9,
            y: 629_956.984_784_734_9,
          },
        }),
      ],
    );
    const sample = sampleOverviewSpatialPresentationMotion(
      result.survivors[0],
      0.997_229_434_602_409_3,
    );

    expect(
      (sample?.frame.x ?? 0) + (sample?.frame.width ?? 0),
    ).toBeLessThanOrEqual(LAYOUT_PERSISTENCE_LIMITS.numericMagnitude);
    expect(
      (sample?.frame.y ?? 0) + (sample?.frame.height ?? 0),
    ).toBeLessThanOrEqual(LAYOUT_PERSISTENCE_LIMITS.numericMagnitude);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, "0.5"])(
    "fails closed for out-of-range progress (%o)",
    (progress) => {
      const track = plan([], [presentation("entry")]).entries[0];
      expect(
        sampleOverviewSpatialPresentationMotion(track, progress),
      ).toBeNull();
    },
  );

  it("fails closed for malformed and hostile tracks", () => {
    const hostile = Object.defineProperty({}, "fromFrame", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(sampleOverviewSpatialPresentationMotion({}, 0.5)).toBeNull();
    expect(sampleOverviewSpatialPresentationMotion(hostile, 0.5)).toBeNull();
  });
});
