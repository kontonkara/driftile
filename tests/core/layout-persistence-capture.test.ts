import { describe, expect, it } from "vitest";
import {
  activityId as toActivityId,
  columnId,
  desktopId,
  outputId,
  windowId,
} from "../../src/core/ids";
import {
  captureLayoutPersistence,
  type LayoutPersistenceCaptureContext,
  type LayoutPersistenceCaptureFloatingWindow,
  type LayoutPersistenceCaptureInput,
  type LayoutPersistenceCaptureRestoreBaseline,
} from "../../src/core/layout-persistence-capture";
import type {
  DetachedWindowPlacement,
  LayoutColumnSnapshot,
} from "../../src/core/layout-engine";
import {
  LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID,
  decodeLayoutPersistence,
} from "../../src/core/layout-persistence";

const firstOutput = outputId("DP-1");
const secondOutput = outputId("HDMI-A-1");
const firstDesktop = desktopId("desktop-1");
const secondDesktop = desktopId("desktop-2");
const activityId = toActivityId("activity-1");
const contextFingerprint =
  "1\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800";

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
            activityId,
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
                presentation: "tabbed",
                selectedMemberIndex: 1,
                width: { kind: "fixed", value: 420 },
              },
              {
                fullWidthRestore: { kind: "fixed", value: 720 },
                fullWidthRestoreViewportOffset: -310,
                members: [{ windowKey: "window-3" }],
                presentation: "stacked",
                selectedMemberIndex: 0,
                width: { kind: "proportion", value: 1 },
              },
            ],
            desktopId: "desktop-1",
            outputKey: "DP-1",
            viewportOffset: -140,
          },
          {
            activeColumnIndex: null,
            activityId,
            columns: [
              {
                members: [{ windowKey: "window-4" }],
                presentation: "stacked",
                selectedMemberIndex: 0,
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
            activityId,
            anchor: {
              columnIndex: 0,
              columnPresentation: "tabbed",
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
        version: 4,
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
      liveOutputs: [...input.liveOutputs].reverse(),
      liveWindows: [...input.liveWindows].reverse(),
    };

    expect(captureLayoutPersistence(reordered)).toBe(
      captureLayoutPersistence(input),
    );
  });

  it("captures independent contexts for the same output and desktop", () => {
    const secondActivity = toActivityId("activity-2");
    const context = (
      key: string,
      ownerActivityId: typeof activityId,
      window: string,
    ): LayoutPersistenceCaptureContext => ({
      activityId: ownerActivityId,
      key,
      layout: {
        activeColumnId: columnId(`column:${window}`),
        activityId: ownerActivityId,
        columns: [column(`column:${window}`, [window])],
        desktopId: firstDesktop,
        outputId: firstOutput,
        viewportOffset: 0,
      },
    });
    const decoded = decodeLayoutPersistence(
      captureLayoutPersistence({
        contexts: [
          context("context-2", secondActivity, "window-2"),
          context("context-1", activityId, "window-1"),
        ],
        floatingWindows: [],
        fullWidthRestores: [],
        liveOutputs: [{ name: String(firstOutput) }],
        liveWindows: [{ liveId: "window-2" }, { liveId: "window-1" }],
      }),
    );

    expect(decoded).toMatchObject({
      ok: true,
      value: {
        contexts: [{ activityId: "activity-1" }, { activityId: "activity-2" }],
      },
    });
  });

  it("captures stable output and window session descriptors", () => {
    const input = representativeInput();
    const document = captureLayoutPersistence({
      ...input,
      liveOutputs: input.liveOutputs.map((output) =>
        output.name === "DP-1"
          ? {
              ...output,
              manufacturer: "Example",
              model: "Panel",
              serialNumber: "serial-1",
            }
          : output,
      ),
      liveWindows: input.liveWindows.map((window) =>
        window.liveId === "window-1"
          ? {
              ...window,
              sessionMatch: {
                desktopFileName: "org.example.Editor",
                resourceClass: "example-editor",
                resourceName: "editor-main",
                tag: "primary-document",
                windowRole: "main",
              },
            }
          : window,
      ),
    });
    const decoded = decodeLayoutPersistence(document);

    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      return;
    }

    expect(
      decoded.value.outputs.find((output) => output.key === "DP-1"),
    ).toEqual({
      key: "DP-1",
      manufacturer: "Example",
      model: "Panel",
      name: "DP-1",
      serialNumber: "serial-1",
    });
    expect(
      decoded.value.windows.find((window) => window.key === "window-1"),
    ).toEqual({
      key: "window-1",
      liveId: "window-1",
      sessionMatch: {
        desktopFileName: "org.example.Editor",
        resourceClass: "example-editor",
        resourceName: "editor-main",
        tag: "primary-document",
        windowRole: "main",
      },
    });
  });

  it("attaches restore baselines to their exact tiled context", () => {
    const input = representativeInput();
    const document = captureLayoutPersistence({
      ...input,
      restoreBaselines: [
        capturedRestoreBaseline("context-1", "window-2"),
        capturedRestoreBaseline("context-1", "window-1"),
      ],
    });
    const decoded = decodeLayoutPersistence(document);

    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      return;
    }

    const context = decoded.value.contexts.find(
      (candidate) => candidate.outputKey === "DP-1",
    );

    expect(context?.restoreFingerprint).toBe(contextFingerprint);
    expect(context?.columns[0]?.members).toMatchObject([
      { restoreBaseline: restoreBaseline() },
      { restoreBaseline: restoreBaseline() },
    ]);
    expect(document.match(/restoreFingerprint/g)).toHaveLength(1);
  });

  it("copies only canonical rectangle fields from restore baselines", () => {
    const input = representativeInput();
    const captured = capturedRestoreBaseline("context-1", "window-1");
    const restoreWithPlatformFields = {
      ...captured,
      baseline: {
        ...captured.baseline,
        clientFrame: {
          ...captured.baseline.clientFrame,
          bottom: 420,
          right: 610,
        },
        frame: {
          ...captured.baseline.frame,
          bottom: 430,
          right: 620,
        },
      },
    };
    const document = captureLayoutPersistence({
      ...input,
      restoreBaselines: [restoreWithPlatformFields],
    });
    const decoded = decodeLayoutPersistence(document);

    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.contexts[0]?.columns[0]?.members[0]).toMatchObject({
      restoreBaseline: restoreBaseline(),
      windowKey: "window-1",
    });
    expect(document).not.toMatch(/bottom|right/);
  });

  it("does not mutate frozen runtime snapshots", () => {
    const input = freezeCaptureInput({
      ...representativeInput(),
      restoreBaselines: [capturedRestoreBaseline("context-1", "window-1")],
    });

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
        liveOutputs: [{ name: String(secondOutput) }],
        liveWindows: [{ liveId: floating.liveId }],
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
          liveOutputs: [{ name: "DP-1" }],
          liveWindows: [
            { liveId: "waiting" },
            { liveId: "automatic-floating" },
          ],
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        contexts: [],
        floatingWindows: [],
        format: "driftile-layout",
        outputs: [],
        version: 4,
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
      columnPresentation: "stacked",
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
        liveOutputs: [{ name: "HDMI-A-1" }],
      }),
    ],
    [
      "a missing live window",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveWindows: input.liveWindows.filter(
          (window) => window.liveId !== "window-1",
        ),
      }),
    ],
    [
      "duplicate live output names",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveOutputs: [...input.liveOutputs, { name: "DP-1" }],
      }),
    ],
    [
      "duplicate live window IDs",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        liveWindows: [...input.liveWindows, { liveId: "window-1" }],
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
      "a non-finite full-width viewport restore",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        fullWidthRestores: input.fullWidthRestores.map((restore) => ({
          ...restore,
          viewportOffset: Number.POSITIVE_INFINITY,
        })),
      }),
    ],
    [
      "duplicate restore baselines",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        restoreBaselines: [
          capturedRestoreBaseline("context-1", "window-1"),
          capturedRestoreBaseline("context-1", "window-1"),
        ],
      }),
    ],
    [
      "a restore baseline in another tiled context",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        restoreBaselines: [capturedRestoreBaseline("context-2", "window-1")],
      }),
    ],
    [
      "a restore baseline for a floating window",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        restoreBaselines: [capturedRestoreBaseline("context-1", "floating-1")],
      }),
    ],
    [
      "different restore fingerprints in one context",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        restoreBaselines: [
          capturedRestoreBaseline("context-1", "window-1"),
          capturedRestoreBaseline(
            "context-1",
            "window-2",
            "2\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800",
          ),
        ],
      }),
    ],
    [
      "a mismatched context activity",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        contexts: input.contexts.map((context, index) =>
          index === 0 ? { ...context, activityId: "activity-2" } : context,
        ),
      }),
    ],
    [
      "a mismatched floating activity",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        floatingWindows: input.floatingWindows.map((floating) => ({
          ...floating,
          activityId: "activity-2",
        })),
      }),
    ],
    [
      "the reserved migration activity",
      (input: LayoutPersistenceCaptureInput) => ({
        ...input,
        contexts: input.contexts.map((context, index) =>
          index === 0
            ? {
                ...context,
                activityId: LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID,
              }
            : context,
        ),
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
        liveWindows: [...input.liveWindows, { liveId: "other-floating" }],
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
    activityId,
    key: "context-1",
    layout: {
      activeColumnId: columnId("column-2"),
      activityId,
      columns: [
        {
          id: columnId("column-1"),
          presentation: "tabbed",
          selectedWindowId: windowId("window-2"),
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
    activityId,
    key: "context-2",
    layout: {
      activeColumnId: null,
      activityId,
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
          columnPresentation: "tabbed",
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
        viewportOffset: -310,
        width: { kind: "fixed", value: 720 },
      },
    ],
    liveOutputs: [
      { name: "HDMI-A-1" },
      { name: "DP-1" },
      { name: "unused-output" },
    ],
    liveWindows: [
      { liveId: "window-4" },
      { liveId: "floating-1" },
      { liveId: "window-3" },
      { liveId: "window-2" },
      { liveId: "window-1" },
      { liveId: "waiting-window" },
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
    activityId,
    key: "context",
    layout: {
      activeColumnId: columns[0]?.id ?? null,
      activityId,
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
      liveOutputs: [{ name: String(firstOutput) }],
      liveWindows: [
        ...tiledIds.map((liveId) => ({ liveId })),
        { liveId: floating.liveId },
        ...additionalFloatingWindows.map((window) => ({
          liveId: window.liveId,
        })),
        ...additionalLiveIds.map((liveId) => ({ liveId })),
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
  const selected = windows[0];

  if (selected === undefined) {
    throw new Error("test column must contain a window");
  }

  return {
    id: columnId(id),
    presentation: "stacked",
    selectedWindowId: windowId(selected),
    width,
    windowIds: windows.map(windowId),
  };
}

function placement(
  id: string,
  overrides: Partial<DetachedWindowPlacement> = {},
): DetachedWindowPlacement {
  return {
    activityId,
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
    columnPresentation: overrides.columnPresentation ?? "stacked",
  };
}

function capturedFloating(
  floatingPlacement: DetachedWindowPlacement,
): LayoutPersistenceCaptureFloatingWindow {
  return {
    activityId,
    liveId: String(floatingPlacement.windowId),
    placement: floatingPlacement,
  };
}

function capturedRestoreBaseline(
  contextKey: string,
  liveId: string,
  fingerprint = contextFingerprint,
): LayoutPersistenceCaptureRestoreBaseline {
  return {
    baseline: {
      ...restoreBaseline(),
      fingerprint,
    },
    contextKey,
    liveId,
  };
}

function restoreBaseline() {
  return {
    clientFrame: { height: 330, width: 500, x: 110, y: 90 },
    frame: { height: 360, width: 520, x: 100, y: 70 },
    kind: "client" as const,
    noBorder: false,
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

  for (const restore of input.restoreBaselines ?? []) {
    Object.freeze(restore.baseline.clientFrame);
    Object.freeze(restore.baseline.frame);
    Object.freeze(restore.baseline);
    Object.freeze(restore);
  }

  Object.freeze(input.contexts);
  Object.freeze(input.floatingWindows);
  Object.freeze(input.fullWidthRestores);
  input.liveOutputs.forEach(Object.freeze);
  input.liveWindows.forEach((window) => {
    Object.freeze(window.sessionMatch);
    Object.freeze(window);
  });
  Object.freeze(input.liveOutputs);
  Object.freeze(input.liveWindows);
  Object.freeze(input.restoreBaselines);
  return Object.freeze(input);
}
