import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../../src/core/ids";
import {
  captureLayoutPersistence,
  type LayoutPersistenceCaptureContext,
  type LayoutPersistenceCaptureFloatingWindow,
  type LayoutPersistenceCaptureInput,
} from "../../src/core/layout-persistence-capture";
import type {
  DetachedWindowPlacement,
  LayoutColumnSnapshot,
} from "../../src/core/layout-engine";
import { decodeLayoutPersistence } from "../../src/core/layout-persistence";

const firstOutput = outputId("DP-1");
const secondOutput = outputId("HDMI-A-1");
const firstDesktop = desktopId("desktop-1");
const secondDesktop = desktopId("desktop-2");

describe("layout persistence capture", () => {
  it("captures every durable runtime policy as one canonical document", () => {
    const input = representativeInput();
    const document = captureLayoutPersistence(input);
    const decoded = decodeLayoutPersistence(document);

    expect(decoded).toEqual({
      ok: true,
      value: {
        contexts: [
          {
            activeColumnIndex: 1,
            columns: [
              {
                members: [
                  {
                    height: { kind: "auto", weight: 2 },
                    windowKey: "window-1",
                  },
                  {
                    height: { index: 1, kind: "preset" },
                    windowKey: "window-2",
                  },
                ],
                width: { kind: "fixed", value: 420 },
              },
              {
                fullWidthRestore: { kind: "fixed", value: 720 },
                members: [{ windowKey: "window-3" }],
                width: { kind: "proportion", value: 1 },
              },
            ],
            desktopId: "desktop-1",
            outputKey: "DP-1",
            viewportOffset: -140,
          },
          {
            activeColumnIndex: null,
            columns: [
              {
                members: [{ windowKey: "window-4" }],
                width: { kind: "proportion", value: 0.5 },
              },
            ],
            desktopId: "desktop-2",
            outputKey: "HDMI-A-1",
            viewportOffset: 0,
          },
        ],
        floatingWindows: [
          {
            anchor: {
              columnIndex: 0,
              columnWidth: { kind: "fixed", value: 420 },
              memberIndex: 1,
              nextWindowKey: "window-2",
              previousWindowKey: "window-1",
              windowHeight: { clientHeight: 360, kind: "fixed" },
            },
            desktopId: "desktop-1",
            outputKey: "DP-1",
            windowKey: "floating-1",
          },
        ],
        format: "driftile-layout",
        outputs: [
          { key: "DP-1", name: "DP-1" },
          { key: "HDMI-A-1", name: "HDMI-A-1" },
        ],
        version: 1,
        windows: [
          { key: "floating-1", liveId: "floating-1" },
          { key: "window-1", liveId: "window-1" },
          { key: "window-2", liveId: "window-2" },
          { key: "window-3", liveId: "window-3" },
          { key: "window-4", liveId: "window-4" },
        ],
      },
    });
    expect(document).not.toMatch(
      /expectedFrame|focus|geometryFingerprint|restoreBaseline|suspension|waiting/,
    );
  });

  it("is deterministic across registry and context input order", () => {
    const input = representativeInput();
    const reordered: LayoutPersistenceCaptureInput = {
      ...input,
      contexts: [...input.contexts].reverse(),
      floatingWindows: [...input.floatingWindows].reverse(),
      fullWidthRestores: [...input.fullWidthRestores].reverse(),
      liveOutputNames: [...input.liveOutputNames].reverse(),
      liveWindowIds: [...input.liveWindowIds].reverse(),
    };

    expect(captureLayoutPersistence(reordered)).toBe(
      captureLayoutPersistence(input),
    );
  });

  it("does not mutate frozen runtime snapshots", () => {
    const input = freezeCaptureInput(representativeInput());

    expect(() => captureLayoutPersistence(input)).not.toThrow();
    expect(captureLayoutPersistence(input)).toBe(
      captureLayoutPersistence(input),
    );
  });

  it("registers a live output used only by a manually floating window", () => {
    const floating = capturedFloating(
      placement("floating-only", {
        desktopId: secondDesktop,
        outputId: secondOutput,
      }),
    );
    const decoded = decodeLayoutPersistence(
      captureLayoutPersistence({
        contexts: [],
        floatingWindows: [floating],
        fullWidthRestores: [],
        liveOutputNames: [String(secondOutput)],
        liveWindowIds: [floating.liveId],
      }),
    );

    expect(decoded).toMatchObject({
      ok: true,
      value: {
        contexts: [],
        floatingWindows: [
          {
            desktopId: "desktop-2",
            outputKey: "HDMI-A-1",
            windowKey: "floating-only",
          },
        ],
        outputs: [{ key: "HDMI-A-1", name: "HDMI-A-1" }],
        windows: [{ key: "floating-only", liveId: "floating-only" }],
      },
    });
  });

  it("encodes an empty durable model without retaining unrelated live state", () => {
    expect(
      decodeLayoutPersistence(
        captureLayoutPersistence({
          contexts: [],
          floatingWindows: [],
          fullWidthRestores: [],
          liveOutputNames: ["DP-1"],
          liveWindowIds: ["waiting", "automatic-floating"],
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        contexts: [],
        floatingWindows: [],
        format: "driftile-layout",
        outputs: [],
        version: 1,
        windows: [],
      },
    });
  });

  it("retains the only surviving tiled anchor when its peer is stale", () => {
    const anchor = captureAnchor(
      [column("column-1", ["previous"])],
      placement("floating", {
        nextWindowId: windowId("stale"),
        previousWindowId: windowId("previous"),
      }),
      ["stale"],
    );

    expect(anchor).toMatchObject({ previousWindowKey: "previous" });
    expect(anchor).not.toHaveProperty("nextWindowKey");
  });

  it("retains a tiled anchor and omits its now-floating peer", () => {
    const anchor = captureAnchor(
      [column("column-1", ["next"])],
      placement("floating", {
        nextWindowId: windowId("next"),
        previousWindowId: windowId("floating-peer"),
      }),
      [],
      [
        capturedFloating(
          placement("floating-peer", {
            columnIndex: 1,
            nextWindowId: null,
            previousWindowId: null,
          }),
        ),
      ],
    );

    expect(anchor).toMatchObject({ nextWindowKey: "next" });
    expect(anchor).not.toHaveProperty("previousWindowKey");
  });

  it("omits reversed tiled anchors and keeps the index fallback", () => {
    const anchor = captureAnchor(
      [column("column-1", ["next", "previous"])],
      placement("floating", {
        columnIndex: 7,
        memberIndex: 4,
        nextWindowId: windowId("next"),
        previousWindowId: windowId("previous"),
      }),
    );

    expect(anchor).toEqual({
      columnIndex: 7,
      columnWidth: { kind: "fixed", value: 400 },
      memberIndex: 4,
    });
  });

  it("omits anchors split across current columns", () => {
    const anchor = captureAnchor(
      [column("column-1", ["previous"]), column("column-2", ["next"])],
      placement("floating", {
        nextWindowId: windowId("next"),
        previousWindowId: windowId("previous"),
      }),
    );

    expect(anchor).not.toHaveProperty("nextWindowKey");
    expect(anchor).not.toHaveProperty("previousWindowKey");
  });

  it.each([
    [
      "a missing live output",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveOutputNames: ["HDMI-A-1"],
      }),
    ],
    [
      "a missing live window",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveWindowIds: input.liveWindowIds.filter((id) => id !== "window-1"),
      }),
    ],
    [
      "duplicate live output names",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveOutputNames: [...input.liveOutputNames, "DP-1"],
      }),
    ],
    [
      "duplicate live window IDs",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveWindowIds: [...input.liveWindowIds, "window-1"],
      }),
    ],
    [
      "an unknown active column",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        contexts: input.contexts.map((context, index) =>
          index === 0
            ? {
                ...context,
                layout: {
                  ...context.layout,
                  activeColumnId: columnId("missing-column"),
                },
              }
            : context,
        ),
      }),
    ],
    [
      "an orphaned full-width restore",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        fullWidthRestores: [
          {
            columnId: columnId("missing-column"),
            contextKey: "context-1",
            width: { kind: "fixed", value: 500 } as const,
          },
        ],
      }),
    ],
    [
      "a mismatched floating registry key",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        floatingWindows: input.floatingWindows.map((floating) => ({
          ...floating,
          liveId: "other-floating",
        })),
        liveWindowIds: [...input.liveWindowIds, "other-floating"],
      }),
    ],
  ])("fails closed for %s", (_name, change) => {
    expect(() =>
      captureLayoutPersistence(change(representativeInput())),
    ).toThrow("Cannot capture layout persistence");
  });
});

function representativeInput(): LayoutPersistenceCaptureInput {
  const firstContext: LayoutPersistenceCaptureContext = {
    key: "context-1",
    layout: {
      activeColumnId: columnId("column-2"),
      columns: [
        {
          id: columnId("column-1"),
          width: { kind: "fixed", value: 420 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { index: 1, kind: "preset" },
          ],
          windowIds: [windowId("window-1"), windowId("window-2")],
        },
        column("column-2", ["window-3"], {
          kind: "proportion",
          value: 1,
        }),
      ],
      desktopId: firstDesktop,
      outputId: firstOutput,
      viewportOffset: -140,
    },
  };
  const secondContext: LayoutPersistenceCaptureContext = {
    key: "context-2",
    layout: {
      activeColumnId: null,
      columns: [
        column("column-3", ["window-4"], {
          kind: "proportion",
          value: 0.5,
        }),
      ],
      desktopId: secondDesktop,
      outputId: secondOutput,
      viewportOffset: 0,
    },
  };

  return {
    contexts: [secondContext, firstContext],
    floatingWindows: [
      capturedFloating(
        placement("floating-1", {
          columnId: columnId("column-1"),
          columnIndex: 0,
          columnWidth: { kind: "fixed", value: 420 },
          memberIndex: 1,
          nextWindowId: windowId("window-2"),
          previousWindowId: windowId("window-1"),
          windowHeight: { clientHeight: 360, kind: "fixed" },
        }),
      ),
    ],
    fullWidthRestores: [
      {
        columnId: columnId("column-2"),
        contextKey: "context-1",
        width: { kind: "fixed", value: 720 },
      },
    ],
    liveOutputNames: ["HDMI-A-1", "DP-1", "unused-output"],
    liveWindowIds: [
      "window-4",
      "floating-1",
      "window-3",
      "window-2",
      "window-1",
      "waiting-window",
    ],
  };
}

function captureAnchor(
  columns: readonly LayoutColumnSnapshot[],
  floatingPlacement: DetachedWindowPlacement,
  additionalLiveIds: readonly string[] = [],
  additionalFloatingWindows: readonly LayoutPersistenceCaptureFloatingWindow[] = [],
): Record<string, unknown> {
  const context: LayoutPersistenceCaptureContext = {
    key: "context",
    layout: {
      activeColumnId: columns[0]?.id ?? null,
      columns,
      desktopId: firstDesktop,
      outputId: firstOutput,
      viewportOffset: 0,
    },
  };
  const tiledIds = columns.flatMap((column) =>
    column.windowIds.map((id) => String(id)),
  );
  const floating = capturedFloating(floatingPlacement);
  const decoded = decodeLayoutPersistence(
    captureLayoutPersistence({
      contexts: [context],
      floatingWindows: [floating, ...additionalFloatingWindows],
      fullWidthRestores: [],
      liveOutputNames: [String(firstOutput)],
      liveWindowIds: [
        ...tiledIds,
        floating.liveId,
        ...additionalFloatingWindows.map((window) => window.liveId),
        ...additionalLiveIds,
      ],
    }),
  );

  if (!decoded.ok) {
    throw new Error("captured anchor did not decode");
  }

  const anchor = decoded.value.floatingWindows.find(
    (window) => window.windowKey === floating.liveId,
  )?.anchor;

  if (!anchor) {
    throw new Error("captured floating window is missing");
  }

  return anchor as unknown as Record<string, unknown>;
}

function column(
  id: string,
  windows: readonly string[],
  width: LayoutColumnSnapshot["width"] = { kind: "fixed", value: 400 },
): LayoutColumnSnapshot {
  return {
    id: columnId(id),
    width,
    windowIds: windows.map(windowId),
  };
}

function placement(
  id: string,
  overrides: Partial<DetachedWindowPlacement> = {},
): DetachedWindowPlacement {
  return {
    columnId: columnId(`column:${id}`),
    columnIndex: 0,
    columnWidth: { kind: "fixed", value: 400 },
    desktopId: firstDesktop,
    memberIndex: 0,
    nextColumnId: null,
    nextWindowId: null,
    outputId: firstOutput,
    previousColumnId: null,
    previousWindowId: null,
    windowId: windowId(id),
    ...overrides,
  };
}

function capturedFloating(
  floatingPlacement: DetachedWindowPlacement,
): LayoutPersistenceCaptureFloatingWindow {
  return {
    liveId: String(floatingPlacement.windowId),
    placement: floatingPlacement,
  };
}

function freezeCaptureInput(
  input: LayoutPersistenceCaptureInput,
): LayoutPersistenceCaptureInput {
  for (const context of input.contexts) {
    for (const column of context.layout.columns) {
      column.windowHeights?.forEach(Object.freeze);
      Object.freeze(column.windowHeights);
      Object.freeze(column.windowIds);
      Object.freeze(column.width);
      Object.freeze(column);
    }

    Object.freeze(context.layout.columns);
    Object.freeze(context.layout);
    Object.freeze(context);
  }

  for (const floating of input.floatingWindows) {
    Object.freeze(floating.placement.columnWidth);
    Object.freeze(floating.placement.windowHeight);
    Object.freeze(floating.placement);
    Object.freeze(floating);
  }

  for (const restore of input.fullWidthRestores) {
    Object.freeze(restore.width);
    Object.freeze(restore);
  }

  Object.freeze(input.contexts);
  Object.freeze(input.floatingWindows);
  Object.freeze(input.fullWidthRestores);
  Object.freeze(input.liveOutputNames);
  Object.freeze(input.liveWindowIds);
  return Object.freeze(input);
}
