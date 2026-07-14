import { describe, expect, it } from "vitest";
import {
  planExactLayoutHydration,
  planLayoutHydration,
  type LayoutPersistenceHydrationInput,
} from "../../src/core/layout-persistence-hydration";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_VERSION,
  type LayoutPersistenceV3,
} from "../../src/core/layout-persistence";
import { LayoutEngine } from "../../src/core/layout-engine";

const contextFingerprint =
  "1\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800";

describe("exact layout persistence hydration", () => {
  it("plans the complete durable model with exact remapped identities", () => {
    const state = representativeState();
    const input = representativeInput();
    const beforeState = JSON.stringify(state);
    const beforeInput = JSON.stringify(input);
    const result = planExactLayoutHydration(state, input);

    expect(result).toEqual({
      ok: true,
      value: {
        contexts: [
          {
            key: "DP-1\u0000desktop-1",
            layout: {
              activeColumnId: "column:live-d",
              columns: [
                {
                  id: "column:live-a",
                  presentation: "tabbed",
                  selectedWindowId: "live-b",
                  width: { kind: "fixed", value: 420 },
                  windowHeights: [
                    { kind: "auto", weight: 2 },
                    { kind: "auto", weight: 1 },
                    { index: 1, kind: "preset" },
                  ],
                  windowIds: ["live-a", "live-b", "live-c"],
                },
                {
                  id: "column:live-d",
                  presentation: "stacked",
                  selectedWindowId: "live-d",
                  width: { kind: "proportion", value: 1 },
                  windowIds: ["live-d"],
                },
              ],
              desktopId: "desktop-1",
              outputId: "DP-1",
              viewportOffset: -140,
            },
          },
          {
            key: "HDMI-A-1\u0000desktop-2",
            layout: {
              activeColumnId: null,
              columns: [
                {
                  id: "column:live-e",
                  presentation: "stacked",
                  selectedWindowId: "live-e",
                  width: { kind: "proportion", value: 0.5 },
                  windowIds: ["live-e"],
                },
              ],
              desktopId: "desktop-2",
              outputId: "HDMI-A-1",
              viewportOffset: 32,
            },
          },
        ],
        floatingWindows: [
          {
            contextKey: "DP-1\u0000desktop-1",
            placement: {
              columnId: "column:live-a",
              columnIndex: 0,
              columnPresentation: "tabbed",
              columnWidth: { kind: "fixed", value: 420 },
              desktopId: "desktop-1",
              memberIndex: 1,
              nextColumnId: "column:live-d",
              nextWindowId: "live-b",
              outputId: "DP-1",
              previousColumnId: null,
              previousWindowId: "live-a",
              windowHeight: { clientHeight: 360, kind: "fixed" },
              windowId: "live-floating-anchored",
            },
          },
          {
            contextKey: "HDMI-A-1\u0000desktop-2",
            placement: {
              columnId: "column:live-floating-new",
              columnIndex: 1,
              columnPresentation: "stacked",
              columnWidth: { kind: "proportion", value: 0.4 },
              desktopId: "desktop-2",
              memberIndex: 0,
              nextColumnId: null,
              nextWindowId: null,
              outputId: "HDMI-A-1",
              previousColumnId: "column:live-e",
              previousWindowId: null,
              windowId: "live-floating-new",
            },
          },
        ],
        fullWidthRestores: [
          {
            columnId: "column:live-d",
            contextKey: "DP-1\u0000desktop-1",
            viewportOffset: -310,
            width: { kind: "fixed", value: 720 },
          },
        ],
        restoreBaselines: [
          {
            baseline: {
              ...restoreBaseline(),
              fingerprint: contextFingerprint,
            },
            contextKey: "DP-1\u0000desktop-1",
            windowId: "live-a",
          },
        ],
      },
    });
    expect(JSON.stringify(state)).toBe(beforeState);
    expect(JSON.stringify(input)).toBe(beforeInput);
  });

  it("hydrates legacy full-width restores without viewport offsets", () => {
    const state = representativeState();
    const context = required(state.contexts[0]);
    const fullWidthColumn = required(context.columns[1]);
    const legacyState: LayoutPersistenceV3 = {
      ...state,
      contexts: [
        {
          ...context,
          columns: [
            required(context.columns[0]),
            {
              fullWidthRestore: required(fullWidthColumn.fullWidthRestore),
              members: fullWidthColumn.members,
              presentation: fullWidthColumn.presentation,
              selectedMemberIndex: fullWidthColumn.selectedMemberIndex,
              width: fullWidthColumn.width,
            },
          ],
        },
        required(state.contexts[1]),
      ],
    };
    const result = planExactLayoutHydration(legacyState, representativeInput());

    expect(result).toMatchObject({
      ok: true,
      value: {
        fullWidthRestores: [
          {
            columnId: "column:live-d",
            contextKey: "DP-1\u0000desktop-1",
            width: { kind: "fixed", value: 720 },
          },
        ],
      },
    });

    if (result.ok) {
      expect(result.value.fullWidthRestores[0]).not.toHaveProperty(
        "viewportOffset",
      );
    }
  });

  it("returns deeply frozen plan data", () => {
    const result = planExactLayoutHydration(
      representativeState(),
      representativeInput(),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const context = result.value.contexts[0];
    const column = context?.layout.columns[0];
    const floating = result.value.floatingWindows[0];
    const restore = result.value.restoreBaselines[0];

    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.contexts)).toBe(true);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context?.layout)).toBe(true);
    expect(Object.isFrozen(context?.layout.columns)).toBe(true);
    expect(Object.isFrozen(column)).toBe(true);
    expect(Object.isFrozen(column?.width)).toBe(true);
    expect(Object.isFrozen(column?.windowIds)).toBe(true);
    expect(Object.isFrozen(column?.windowHeights)).toBe(true);
    expect(Object.isFrozen(column?.windowHeights?.[0])).toBe(true);
    expect(Object.isFrozen(floating)).toBe(true);
    expect(Object.isFrozen(floating?.placement)).toBe(true);
    expect(Object.isFrozen(floating?.placement.columnWidth)).toBe(true);
    expect(Object.isFrozen(floating?.placement.windowHeight)).toBe(true);
    expect(Object.isFrozen(result.value.fullWidthRestores[0])).toBe(true);
    expect(Object.isFrozen(result.value.fullWidthRestores[0]?.width)).toBe(
      true,
    );
    expect(Object.isFrozen(result.value.restoreBaselines)).toBe(true);
    expect(Object.isFrozen(restore)).toBe(true);
    expect(Object.isFrozen(restore?.baseline)).toBe(true);
    expect(Object.isFrozen(restore?.baseline.clientFrame)).toBe(true);
    expect(Object.isFrozen(restore?.baseline.frame)).toBe(true);
  });

  it("produces contexts and floating placements consumable by LayoutEngine", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      floatingWindows: [
        ...baseState.floatingWindows,
        {
          anchor: {
            columnIndex: 1,
            columnPresentation: "stacked",
            columnWidth: { kind: "proportion", value: 1 },
            memberIndex: 1,
            previousWindowKey: "tiled-d",
          },
          desktopId: "desktop-1",
          outputKey: "primary-output",
          windowKey: "floating-one-sided",
        },
      ],
      windows: [
        ...baseState.windows,
        {
          key: "floating-one-sided",
          liveId: "live-floating-one-sided",
        },
      ],
    };
    const baseInput = representativeInput();
    const result = planExactLayoutHydration(state, {
      ...baseInput,
      windows: [
        ...baseInput.windows,
        liveWindow("live-floating-one-sided", "DP-1", "desktop-1"),
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const planBefore = JSON.stringify(result.value);
    const engine = new LayoutEngine();

    for (const context of result.value.contexts) {
      expect(
        engine.restoreColumns({
          activeColumnId: context.layout.activeColumnId,
          columns: context.layout.columns.map((column, index) => ({
            column,
            index,
          })),
          desktopId: context.layout.desktopId,
          outputId: context.layout.outputId,
          viewportOffset: context.layout.viewportOffset,
        }),
      ).toBe(true);
      expect(
        engine.snapshot(context.layout.outputId, context.layout.desktopId),
      ).toEqual(context.layout);
    }

    const placements = new Map(
      result.value.floatingWindows.map((floating) => [
        String(floating.placement.windowId),
        floating.placement,
      ]),
    );
    const variants = [
      {
        id: "live-floating-anchored",
        nextWindowId: "live-b",
        previousWindowId: "live-a",
      },
      {
        id: "live-floating-one-sided",
        nextWindowId: null,
        previousWindowId: "live-d",
      },
      {
        id: "live-floating-new",
        nextWindowId: null,
        previousWindowId: null,
      },
    ] as const;

    for (const variant of variants) {
      const placement = required(placements.get(variant.id));
      const before = engine.snapshot(placement.outputId, placement.desktopId);

      expect(placement.previousWindowId).toBe(variant.previousWindowId);
      expect(placement.nextWindowId).toBe(variant.nextWindowId);
      expect(engine.previewWindowAttach(placement)).not.toBeNull();
      expect(engine.snapshot(placement.outputId, placement.desktopId)).toEqual(
        before,
      );
    }

    expect(JSON.stringify(result.value)).toBe(planBefore);
  });

  it("is independent of live registry order and ignores extra live windows", () => {
    const input = representativeInput();
    const expected = planExactLayoutHydration(representativeState(), input);

    expect(
      planExactLayoutHydration(representativeState(), {
        desktops: [...input.desktops].reverse(),
        outputs: [...input.outputs].reverse(),
        windows: [...input.windows].reverse(),
      }),
    ).toEqual(expected);
  });

  it("plans a floating-only context with an independent fallback column", () => {
    const state: LayoutPersistenceV3 = {
      contexts: [],
      floatingWindows: [
        {
          anchor: {
            columnIndex: 4,
            columnPresentation: "stacked",
            columnWidth: { kind: "fixed", value: 500 },
            memberIndex: 2,
          },
          desktopId: "desktop-1",
          outputKey: "output",
          windowKey: "floating",
        },
      ],
      format: LAYOUT_PERSISTENCE_FORMAT,
      outputs: [{ key: "output", name: "DP-1" }],
      version: LAYOUT_PERSISTENCE_VERSION,
      windows: [{ key: "floating", liveId: "live-floating" }],
    };

    expect(
      planExactLayoutHydration(state, {
        desktops: [{ id: "desktop-1" }],
        outputs: [{ name: "DP-1" }],
        windows: [
          {
            desktopId: "desktop-1",
            eligible: true,
            liveId: "live-floating",
            outputName: "DP-1",
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        contexts: [],
        floatingWindows: [
          {
            contextKey: "DP-1\u0000desktop-1",
            placement: {
              columnId: "column:live-floating",
              columnIndex: 4,
              columnPresentation: "stacked",
              columnWidth: { kind: "fixed", value: 500 },
              desktopId: "desktop-1",
              memberIndex: 2,
              nextColumnId: null,
              nextWindowId: null,
              outputId: "DP-1",
              previousColumnId: null,
              previousWindowId: null,
              windowId: "live-floating",
            },
          },
        ],
        fullWidthRestores: [],
        restoreBaselines: [],
      },
    });
  });

  it.each<
    [
      string,
      (
        state: LayoutPersistenceV3,
        input: LayoutPersistenceHydrationInput,
      ) => readonly [LayoutPersistenceV3, LayoutPersistenceHydrationInput],
      string,
    ]
  >([
    [
      "duplicate live desktop IDs",
      (state, input) => [
        state,
        {
          ...input,
          desktops: [...input.desktops, required(input.desktops[0])],
        },
      ],
      "duplicate-live-desktop-id",
    ],
    [
      "duplicate live output names",
      (state, input) => [
        state,
        { ...input, outputs: [...input.outputs, required(input.outputs[0])] },
      ],
      "duplicate-live-output-name",
    ],
    [
      "duplicate live window IDs",
      (state, input) => [
        state,
        { ...input, windows: [...input.windows, required(input.windows[0])] },
      ],
      "duplicate-live-window-id",
    ],
    [
      "a missing exact window ID",
      (state, input) => [
        state,
        {
          ...input,
          windows: input.windows.filter((window) => window.liveId !== "live-a"),
        },
      ],
      "missing-live-window",
    ],
    [
      "a missing exact output name",
      (state, input) => [
        state,
        {
          ...input,
          outputs: input.outputs.filter((output) => output.name !== "DP-1"),
        },
      ],
      "missing-live-output",
    ],
    [
      "a missing exact desktop ID",
      (state, input) => [
        state,
        {
          ...input,
          desktops: input.desktops.filter(
            (desktop) => desktop.id !== "desktop-1",
          ),
        },
      ],
      "missing-live-desktop",
    ],
    [
      "an ineligible persisted window",
      (state, input) => [
        state,
        {
          ...input,
          windows: input.windows.map((window) =>
            window.liveId === "live-a"
              ? { ...window, eligible: false }
              : window,
          ),
        },
      ],
      "ineligible-live-window",
    ],
    [
      "a persisted window in another live context",
      (state, input) => [
        state,
        {
          ...input,
          windows: input.windows.map((window) =>
            window.liveId === "live-a"
              ? { ...window, outputName: "HDMI-A-1" }
              : window,
          ),
        },
      ],
      "live-window-context-mismatch",
    ],
    [
      "two persisted outputs resolving to one exact name",
      (state, input) => [
        {
          ...state,
          outputs: state.outputs.map((output) =>
            output.key === "secondary-output"
              ? { ...output, name: "DP-1" }
              : output,
          ),
        },
        input,
      ],
      "non-unique-output-match",
    ],
    [
      "session metadata without the exact live ID",
      (state, input) => [
        {
          ...state,
          windows: state.windows.map((window) =>
            window.key === "tiled-a"
              ? {
                  ...window,
                  liveId: "stale-live-a",
                  sessionMatch: { tag: "same-application" },
                }
              : window,
          ),
        },
        input,
      ],
      "missing-live-window",
    ],
  ])("fails atomically for %s", (_name, change, reason) => {
    const [state, input] = change(representativeState(), representativeInput());

    expect(planExactLayoutHydration(state, input)).toEqual({
      ok: false,
      reason,
    });
  });

  it("handles the complete persisted window limit in one pass", () => {
    const windowCount = 4_096;
    const membersPerColumn = 256;
    const windows = Array.from({ length: windowCount }, (_value, index) => ({
      key: `window-${String(index)}`,
      liveId: `live-${String(index)}`,
    }));
    const state: LayoutPersistenceV3 = {
      contexts: [
        {
          activeColumnIndex: 0,
          columns: Array.from(
            { length: windowCount / membersPerColumn },
            (_value, columnIndex) => ({
              members: Array.from(
                { length: membersPerColumn },
                (_member, memberIndex) => ({
                  windowKey: required(
                    windows[columnIndex * membersPerColumn + memberIndex],
                  ).key,
                }),
              ),
              presentation: "stacked" as const,
              selectedMemberIndex: 0,
              width: { kind: "fixed" as const, value: 400 },
            }),
          ),
          desktopId: "desktop-1",
          outputKey: "output",
          viewportOffset: 0,
        },
      ],
      floatingWindows: [],
      format: LAYOUT_PERSISTENCE_FORMAT,
      outputs: [{ key: "output", name: "DP-1" }],
      version: LAYOUT_PERSISTENCE_VERSION,
      windows,
    };
    const result = planExactLayoutHydration(state, {
      desktops: [{ id: "desktop-1" }],
      outputs: [{ name: "DP-1" }],
      windows: windows.map((window) => ({
        desktopId: "desktop-1",
        eligible: true,
        liveId: window.liveId,
        outputName: "DP-1",
      })),
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.contexts[0]?.layout.columns).toHaveLength(16);
      expect(
        result.value.contexts[0]?.layout.columns.reduce(
          (count, column) => count + column.windowIds.length,
          0,
        ),
      ).toBe(windowCount);
    }
  });
});

describe("layout persistence hydration identity fallback", () => {
  it("remaps a renamed output and a replaced window without changing the layout", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      outputs: baseState.outputs.map((output) =>
        output.key === "primary-output"
          ? {
              ...output,
              manufacturer: "Example",
              model: "Panel",
              serialNumber: "primary-serial",
            }
          : output,
      ),
      windows: baseState.windows.map((window) =>
        window.key === "tiled-b"
          ? {
              ...window,
              liveId: "stale-live-b",
              sessionMatch: editorWindowMatch("secondary"),
            }
          : window,
      ),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      outputs: baseInput.outputs.map((output) =>
        output.name === "DP-1"
          ? {
              manufacturer: "Example",
              model: "Panel",
              name: "DP-9",
              serialNumber: "primary-serial",
            }
          : output,
      ),
      windows: baseInput.windows.map((window) => {
        const outputName =
          window.outputName === "DP-1" ? "DP-9" : window.outputName;

        return window.liveId === "live-b"
          ? {
              ...window,
              ...editorWindowMatch("secondary"),
              liveId: "restored-live-b",
              outputName,
            }
          : { ...window, outputName };
      }),
    };
    const result = planLayoutHydration(state, input);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const primary = required(
      result.value.contexts.find(
        (context) => context.layout.desktopId === "desktop-1",
      ),
    );
    const anchored = required(
      result.value.floatingWindows.find(
        (floating) => floating.placement.windowId === "live-floating-anchored",
      ),
    );

    expect(primary.key).toBe("DP-9\u0000desktop-1");
    expect(primary.layout.outputId).toBe("DP-9");
    expect(primary.layout.viewportOffset).toBe(-140);
    expect(primary.layout.columns[0]?.windowIds).toEqual([
      "live-a",
      "restored-live-b",
      "live-c",
    ]);
    expect(anchored.contextKey).toBe("DP-9\u0000desktop-1");
    expect(anchored.placement.nextWindowId).toBe("restored-live-b");
  });

  it("prefers exact identities even when optional metadata conflicts", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      outputs: baseState.outputs.map((output) =>
        output.key === "primary-output"
          ? { ...output, serialNumber: "persisted-serial" }
          : output,
      ),
      windows: baseState.windows.map((window) =>
        window.key === "tiled-a"
          ? {
              ...window,
              sessionMatch: editorWindowMatch("persisted-tag"),
            }
          : window,
      ),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      outputs: baseInput.outputs.map((output) =>
        output.name === "DP-1"
          ? { ...output, serialNumber: "different-serial" }
          : output,
      ),
      windows: baseInput.windows.map((window) =>
        window.liveId === "live-a"
          ? {
              ...window,
              desktopFileName: "org.example.Other",
              tag: "",
            }
          : window,
      ),
    };

    expect(planLayoutHydration(state, input)).toEqual(
      planExactLayoutHydration(state, input),
    );
    expect(planLayoutHydration(state, input).ok).toBe(true);
  });

  it("retains exact restore baselines and drops session-matched baselines", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      contexts: baseState.contexts.map((context) =>
        context.outputKey === "primary-output"
          ? {
              ...context,
              columns: context.columns.map((column, columnIndex) =>
                columnIndex === 0
                  ? {
                      ...column,
                      members: column.members.map((member) =>
                        member.windowKey === "tiled-b"
                          ? { ...member, restoreBaseline: restoreBaseline() }
                          : member,
                      ),
                    }
                  : column,
              ),
            }
          : context,
      ),
      windows: baseState.windows.map((window) =>
        window.key === "tiled-b"
          ? {
              ...window,
              liveId: "stale-live-b",
              sessionMatch: editorWindowMatch("secondary"),
            }
          : window,
      ),
    };
    const input = replaceWindowIdentity(
      representativeInput(),
      "live-b",
      "restored-live-b",
      editorWindowMatch("secondary"),
    );
    const result = planLayoutHydration(state, input);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(
        result.value.restoreBaselines.map((baseline) => baseline.windowId),
      ).toEqual(["live-a"]);
    }
  });

  it("drops every restore baseline when all baseline owners use session identities", () => {
    const baseState = representativeState();
    const sessionKeys = new Set(["tiled-a", "tiled-b", "tiled-c", "tiled-d"]);
    const state: LayoutPersistenceV3 = {
      ...baseState,
      contexts: baseState.contexts.map((context) =>
        context.outputKey === "primary-output"
          ? {
              ...context,
              columns: context.columns.map((column) => ({
                ...column,
                members: column.members.map((member) => ({
                  ...member,
                  restoreBaseline: restoreBaseline(),
                })),
              })),
            }
          : context,
      ),
      windows: baseState.windows.map((window) =>
        sessionKeys.has(window.key)
          ? {
              ...window,
              liveId: `stale-${window.key}`,
              sessionMatch: editorWindowMatch(window.key),
            }
          : window,
      ),
    };
    const input: LayoutPersistenceHydrationInput = {
      ...representativeInput(),
      windows: representativeInput().windows.map((window) => {
        const key = window.liveId.replace("live-", "tiled-");

        return sessionKeys.has(key)
          ? {
              ...window,
              ...editorWindowMatch(key),
              liveId: `restored-${key}`,
            }
          : window;
      }),
    };
    const result = planLayoutHydration(state, input);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.restoreBaselines).toEqual([]);
      expect(
        result.value.contexts[0]?.layout.columns.flatMap(
          (column) => column.windowIds,
        ),
      ).toEqual([
        "restored-tiled-a",
        "restored-tiled-b",
        "restored-tiled-c",
        "restored-tiled-d",
      ]);
    }
  });

  it("rejects ambiguous replacement windows", () => {
    const state = withStaleWindow(
      representativeState(),
      "tiled-a",
      editorWindowMatch("primary"),
    );
    const baseInput = representativeInput();
    const withoutExact = baseInput.windows.filter(
      (window) => window.liveId !== "live-a",
    );
    const original = required(
      baseInput.windows.find((window) => window.liveId === "live-a"),
    );
    const descriptor = editorWindowMatch("primary");

    expect(
      planLayoutHydration(state, {
        ...baseInput,
        windows: [
          ...withoutExact,
          { ...original, ...descriptor, liveId: "restored-a" },
          { ...original, ...descriptor, liveId: "restored-a-duplicate" },
        ],
      }),
    ).toEqual({ ok: false, reason: "unresolved-live-window" });
  });

  it("distinguishes a strong window that can still arrive", () => {
    const state = withStaleWindow(
      representativeState(),
      "tiled-a",
      editorWindowMatch("primary"),
    );
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      windows: baseInput.windows.filter((window) => window.liveId !== "live-a"),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "missing-live-window",
    });
  });

  it("waits when every missing strong window can still arrive", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      windows: baseState.windows.map((window) => {
        if (window.key === "tiled-a") {
          return {
            ...window,
            liveId: "stale-a",
            sessionMatch: editorWindowMatch("primary"),
          };
        }

        if (window.key === "tiled-b") {
          return {
            ...window,
            liveId: "stale-b",
            sessionMatch: editorWindowMatch("secondary"),
          };
        }

        return window;
      }),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      windows: baseInput.windows.filter(
        (window) => window.liveId !== "live-a" && window.liveId !== "live-b",
      ),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "missing-live-window",
    });
  });

  it("does not wait when another unresolved identity is ambiguous", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      windows: baseState.windows.map((window) => {
        if (window.key === "tiled-a") {
          return {
            ...window,
            liveId: "stale-a",
            sessionMatch: editorWindowMatch("primary"),
          };
        }

        if (window.key === "tiled-b") {
          return {
            ...window,
            liveId: "stale-b",
            sessionMatch: editorWindowMatch("secondary"),
          };
        }

        return window;
      }),
    };
    const baseInput = representativeInput();
    const retained = baseInput.windows.filter(
      (window) => window.liveId !== "live-a" && window.liveId !== "live-b",
    );
    const ambiguousSource = required(
      baseInput.windows.find((window) => window.liveId === "live-b"),
    );
    const descriptor = editorWindowMatch("secondary");
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      windows: [
        ...retained,
        { ...ambiguousSource, ...descriptor, liveId: "restored-b-1" },
        { ...ambiguousSource, ...descriptor, liveId: "restored-b-2" },
      ],
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "unresolved-live-window",
    });
  });

  it("does not wait behind an already matched weak identity", () => {
    const baseState = representativeState();
    const weakDescriptor = { desktopFileName: "org.example.Weak" } as const;
    const state: LayoutPersistenceV3 = {
      ...baseState,
      windows: baseState.windows.map((window) => {
        if (window.key === "tiled-a") {
          return {
            ...window,
            liveId: "stale-a",
            sessionMatch: editorWindowMatch("primary"),
          };
        }

        if (window.key === "tiled-b") {
          return {
            ...window,
            liveId: "stale-b",
            sessionMatch: weakDescriptor,
          };
        }

        return window;
      }),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      windows: baseInput.windows
        .filter((window) => window.liveId !== "live-a")
        .map((window) =>
          window.liveId === "live-b"
            ? { ...window, ...weakDescriptor, liveId: "restored-b" }
            : window,
        ),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "unresolved-live-window",
    });
  });

  it("does not use resource names to disambiguate a shared strong identity", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      windows: baseState.windows.map((window) => {
        if (window.key !== "tiled-a" && window.key !== "tiled-b") {
          return window;
        }

        return {
          ...window,
          liveId: `stale-${window.key}`,
          sessionMatch: {
            desktopFileName: "org.example.Editor",
            resourceName: window.key,
            tag: "shared-document",
          },
        };
      }),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      windows: baseInput.windows.map((window) => {
        if (window.liveId !== "live-a" && window.liveId !== "live-b") {
          return window;
        }

        return {
          ...window,
          desktopFileName: "org.example.Editor",
          liveId: `restored-${window.liveId}`,
          resourceName: window.liveId === "live-a" ? "tiled-a" : "tiled-b",
          tag: "shared-document",
        };
      }),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "unresolved-live-window",
    });
  });

  it("rejects a replacement window without a strong discriminator", () => {
    const weakMatch = { desktopFileName: "org.example.Editor" };
    const state = withStaleWindow(representativeState(), "tiled-a", weakMatch);
    const input = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      weakMatch,
    );

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "unresolved-live-window",
    });
  });

  it("rejects invalid optional metadata before fallback matching", () => {
    const state = withStaleWindow(
      representativeState(),
      "tiled-a",
      editorWindowMatch("primary"),
    );
    const input = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      { desktopFileName: "org.example.Editor", tag: "" },
    );

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "invalid-live-descriptor",
    });
  });

  it("does not reuse output metadata that conflicts during fallback", () => {
    const baseState = withStaleWindow(
      representativeState(),
      "tiled-a",
      editorWindowMatch("primary"),
    );
    const state: LayoutPersistenceV3 = {
      ...baseState,
      outputs: baseState.outputs.map((output) =>
        output.key === "primary-output"
          ? { ...output, serialNumber: "persisted-serial" }
          : output,
      ),
    };
    const baseInput = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      editorWindowMatch("primary"),
    );
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      outputs: baseInput.outputs.map((output) =>
        output.name === "DP-1"
          ? { ...output, serialNumber: "different-serial" }
          : output,
      ),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "unresolved-live-output",
    });
  });

  it("does not sanitize duplicate persisted output names during fallback", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      outputs: baseState.outputs.map((output) => ({
        ...output,
        name: "stale-connector",
        serialNumber:
          output.key === "primary-output" ? "primary-serial" : "other-serial",
      })),
    };
    const baseInput = representativeInput();
    const input: LayoutPersistenceHydrationInput = {
      ...baseInput,
      outputs: baseInput.outputs.map((output) => {
        if (output.name === "DP-1") {
          return { name: "DP-9", serialNumber: "primary-serial" };
        }

        if (output.name === "HDMI-A-1") {
          return { name: "HDMI-A-9", serialNumber: "other-serial" };
        }

        return output;
      }),
      windows: baseInput.windows.map((window) => ({
        ...window,
        outputName:
          window.outputName === "DP-1"
            ? "DP-9"
            : window.outputName === "HDMI-A-1"
              ? "HDMI-A-9"
              : window.outputName,
      })),
    };

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "non-unique-output-match",
    });
  });

  it("does not sanitize duplicate persisted window identities during fallback", () => {
    const baseState = representativeState();
    const state: LayoutPersistenceV3 = {
      ...baseState,
      windows: baseState.windows.map((window) => {
        if (window.key === "tiled-a") {
          return {
            ...window,
            liveId: "stale-duplicate",
            sessionMatch: editorWindowMatch("primary"),
          };
        }

        if (window.key === "tiled-b") {
          return {
            ...window,
            liveId: "stale-duplicate",
            sessionMatch: editorWindowMatch("secondary"),
          };
        }

        return window;
      }),
    };
    const firstReplacement = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      editorWindowMatch("primary"),
    );
    const input = replaceWindowIdentity(
      firstReplacement,
      "live-b",
      "restored-b",
      editorWindowMatch("secondary"),
    );

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "invalid-persisted-state",
    });
  });

  it("does not repair an invalid restore fingerprint invariant", () => {
    const baseState = withStaleWindow(
      representativeState(),
      "tiled-a",
      editorWindowMatch("primary"),
    );
    const state: LayoutPersistenceV3 = {
      ...baseState,
      contexts: baseState.contexts.map((context) =>
        context.outputKey === "primary-output"
          ? {
              activeColumnIndex: context.activeColumnIndex,
              columns: context.columns,
              desktopId: context.desktopId,
              outputKey: context.outputKey,
              viewportOffset: context.viewportOffset,
            }
          : context,
      ),
    };
    const input = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      editorWindowMatch("primary"),
    );

    expect(planLayoutHydration(state, input)).toEqual({
      ok: false,
      reason: "invalid-persisted-state",
    });
  });

  it.each([
    [
      "an ineligible replacement",
      { eligible: false },
      "ineligible-live-window",
    ],
    [
      "a replacement on another desktop",
      { desktopId: "desktop-2" },
      "live-window-context-mismatch",
    ],
    [
      "a replacement on another output",
      { outputName: "HDMI-A-1" },
      "live-window-context-mismatch",
    ],
  ] as const)("preserves ownership guards for %s", (_name, change, reason) => {
    const descriptor = editorWindowMatch("primary");
    const state = withStaleWindow(representativeState(), "tiled-a", descriptor);
    const input = replaceWindowIdentity(
      representativeInput(),
      "live-a",
      "restored-a",
      descriptor,
      change,
    );

    expect(planLayoutHydration(state, input)).toEqual({ ok: false, reason });
  });
});

function representativeState(): LayoutPersistenceV3 {
  return {
    contexts: [
      {
        activeColumnIndex: 1,
        columns: [
          {
            members: [
              {
                height: { kind: "auto", weight: 2 },
                restoreBaseline: restoreBaseline(),
                windowKey: "tiled-a",
              },
              { windowKey: "tiled-b" },
              {
                height: { index: 1, kind: "preset" },
                windowKey: "tiled-c",
              },
            ],
            presentation: "tabbed",
            selectedMemberIndex: 1,
            width: { kind: "fixed", value: 420 },
          },
          {
            fullWidthRestore: { kind: "fixed", value: 720 },
            fullWidthRestoreViewportOffset: -310,
            members: [{ windowKey: "tiled-d" }],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "proportion", value: 1 },
          },
        ],
        desktopId: "desktop-1",
        outputKey: "primary-output",
        restoreFingerprint: contextFingerprint,
        viewportOffset: -140,
      },
      {
        activeColumnIndex: null,
        columns: [
          {
            members: [{ windowKey: "tiled-e" }],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "proportion", value: 0.5 },
          },
        ],
        desktopId: "desktop-2",
        outputKey: "secondary-output",
        viewportOffset: 32,
      },
    ],
    floatingWindows: [
      {
        anchor: {
          columnIndex: 0,
          columnPresentation: "tabbed",
          columnWidth: { kind: "fixed", value: 420 },
          memberIndex: 1,
          nextWindowKey: "tiled-b",
          previousWindowKey: "tiled-a",
          windowHeight: { clientHeight: 360, kind: "fixed" },
        },
        desktopId: "desktop-1",
        outputKey: "primary-output",
        windowKey: "floating-anchored",
      },
      {
        anchor: {
          columnIndex: 1,
          columnPresentation: "stacked",
          columnWidth: { kind: "proportion", value: 0.4 },
          memberIndex: 0,
        },
        desktopId: "desktop-2",
        outputKey: "secondary-output",
        windowKey: "floating-new",
      },
    ],
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [
      { key: "primary-output", name: "DP-1" },
      { key: "secondary-output", name: "HDMI-A-1" },
    ],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [
      { key: "tiled-a", liveId: "live-a" },
      { key: "tiled-b", liveId: "live-b" },
      { key: "tiled-c", liveId: "live-c" },
      { key: "tiled-d", liveId: "live-d" },
      { key: "tiled-e", liveId: "live-e" },
      {
        key: "floating-anchored",
        liveId: "live-floating-anchored",
      },
      { key: "floating-new", liveId: "live-floating-new" },
    ],
  };
}

function representativeInput(): LayoutPersistenceHydrationInput {
  return {
    desktops: [
      { id: "desktop-2" },
      { id: "desktop-1" },
      { id: "desktop-extra" },
    ],
    outputs: [{ name: "HDMI-A-1" }, { name: "DP-1" }, { name: "DP-extra" }],
    windows: [
      liveWindow("live-floating-new", "HDMI-A-1", "desktop-2"),
      liveWindow("live-e", "HDMI-A-1", "desktop-2"),
      liveWindow("live-c", "DP-1", "desktop-1"),
      liveWindow("live-a", "DP-1", "desktop-1"),
      liveWindow("live-floating-anchored", "DP-1", "desktop-1"),
      liveWindow("live-d", "DP-1", "desktop-1"),
      liveWindow("live-b", "DP-1", "desktop-1"),
      liveWindow("live-extra", "DP-extra", "desktop-extra"),
    ],
  };
}

function liveWindow(
  liveId: string,
  outputName: string,
  desktop: string,
): LayoutPersistenceHydrationInput["windows"][number] {
  return {
    desktopId: desktop,
    eligible: true,
    liveId,
    outputName,
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

function editorWindowMatch(tag: string) {
  return {
    desktopFileName: "org.example.Editor",
    tag,
  } as const;
}

function withStaleWindow(
  state: LayoutPersistenceV3,
  key: string,
  sessionMatch: NonNullable<
    LayoutPersistenceV3["windows"][number]["sessionMatch"]
  >,
): LayoutPersistenceV3 {
  return {
    ...state,
    windows: state.windows.map((window) =>
      window.key === key
        ? { ...window, liveId: `stale-${key}`, sessionMatch }
        : window,
    ),
  };
}

function replaceWindowIdentity(
  input: LayoutPersistenceHydrationInput,
  currentLiveId: string,
  liveId: string,
  descriptor: NonNullable<
    LayoutPersistenceV3["windows"][number]["sessionMatch"]
  >,
  change: Partial<LayoutPersistenceHydrationInput["windows"][number]> = {},
): LayoutPersistenceHydrationInput {
  return {
    ...input,
    windows: input.windows.map((window) =>
      window.liveId === currentLiveId
        ? { ...window, ...descriptor, ...change, liveId }
        : window,
    ),
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("required test value is missing");
  }

  return value;
}
