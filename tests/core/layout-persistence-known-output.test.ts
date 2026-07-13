import { describe, expect, it } from "vitest";
import {
  planKnownOutputLayoutHydration,
  type LayoutPersistenceKnownOutputFailure,
} from "../../src/core/layout-persistence-known-output";
import type {
  LayoutPersistenceCatalogSnapshot,
  LayoutPersistenceTopologyV2,
} from "../../src/core/layout-persistence-catalog";
import type { LayoutPersistenceHydrationInput } from "../../src/core/layout-persistence-hydration";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_VERSION,
  type LayoutPersistenceV1,
  type PersistedOutputV1,
} from "../../src/core/layout-persistence";

const historicalReturned = output("historical-returned", "DP-1", "panel-a");
const historicalOther = output("historical-other", "HDMI-A-1", "panel-b");
const currentReturned = output("current-returned", "DP-3", "panel-a");
const currentOther = output("current-other", "HDMI-A-1", "panel-b");

describe("known-output layout persistence hydration", () => {
  it("restores only the returned output across a connector rename", () => {
    const historical = representativeSnapshot();
    const current = topology(currentOther, currentReturned);
    const input = representativeInput();
    const historicalBefore = JSON.stringify(historical);
    const currentBefore = JSON.stringify(current);
    const inputBefore = JSON.stringify(input);
    const result = planKnownOutputLayoutHydration(
      historical,
      current,
      "DP-3",
      input,
    );

    expect(result).toEqual({
      kind: "plan",
      ok: true,
      value: {
        contexts: [
          {
            key: "DP-3\u0000desktop-1",
            layout: {
              activeColumnId: "column:live-terminal",
              columns: [
                {
                  id: "column:live-editor",
                  width: { kind: "fixed", value: 620 },
                  windowHeights: [
                    { kind: "auto", weight: 2 },
                    { clientHeight: 360, kind: "fixed" },
                  ],
                  windowIds: ["live-editor", "live-chat"],
                },
                {
                  id: "column:live-terminal",
                  width: { kind: "proportion", value: 1 },
                  windowIds: ["live-terminal"],
                },
              ],
              desktopId: "desktop-1",
              outputId: "DP-3",
              viewportOffset: -90,
            },
          },
        ],
        floatingWindows: [],
        fullWidthRestores: [
          {
            columnId: "column:live-terminal",
            contextKey: "DP-3\u0000desktop-1",
            viewportOffset: -270,
            width: { kind: "fixed", value: 840 },
          },
        ],
        restoreBaselines: [],
      },
    });
    expect(JSON.stringify(historical)).toBe(historicalBefore);
    expect(JSON.stringify(current)).toBe(currentBefore);
    expect(JSON.stringify(input)).toBe(inputBefore);
  });

  it("ignores ineligible windows on the returned output and eligible windows elsewhere", () => {
    const input = representativeInput();
    const result = planKnownOutputLayoutHydration(
      representativeSnapshot(),
      topology(currentReturned, currentOther),
      "DP-3",
      {
        ...input,
        windows: input.windows.map((window) =>
          window.liveId === "automatic-dialog"
            ? {
                ...window,
                desktopFileName: "org.example.Editor",
                tag: "main",
              }
            : window,
        ),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.kind).toBe("plan");
  });

  it("reports a safe no-op when the returned output has no historical contexts", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      contexts: historical.state.contexts.filter(
        (context) => context.outputKey === historicalOther.key,
      ),
      outputs: [historicalOther],
      windows: historical.state.windows.filter(
        (window) => window.key === "other-window",
      ),
    };

    expect(
      planKnownOutputLayoutHydration(
        { ...historical, state },
        topology(currentReturned, currentOther),
        "DP-3",
        representativeInput(),
      ),
    ).toEqual({ kind: "no-historical-contexts", ok: true });
  });

  it("rejects an eligible window not represented in the historical context", () => {
    const input = representativeInput();

    expectFailure(
      representativeSnapshot(),
      {
        ...input,
        windows: [
          ...input.windows,
          liveWindow("live-browser", "DP-3", "desktop-1", {
            desktopFileName: "org.example.Browser",
            tag: "browser",
          }),
        ],
      },
      "eligible-window-set-mismatch",
    );
  });

  it("rejects a missing historical window without returning a partial plan", () => {
    const input = representativeInput();

    expectFailure(
      representativeSnapshot(),
      {
        ...input,
        windows: input.windows.filter(
          (window) => window.liveId !== "live-terminal",
        ),
      },
      "missing-live-window",
    );
  });

  it("rejects repatriation from a different live output", () => {
    const input = representativeInput();

    expectFailure(
      representativeSnapshot(),
      {
        ...input,
        windows: input.windows.map((window) =>
          window.liveId === "live-editor"
            ? { ...window, outputName: "HDMI-A-1" }
            : window,
        ),
      },
      "live-window-context-mismatch",
    );
  });

  it("rejects a missing historical desktop", () => {
    const input = representativeInput();

    expectFailure(
      representativeSnapshot(),
      { ...input, desktops: [{ id: "desktop-2" }] },
      "missing-live-desktop",
    );
  });

  it("rejects weak and ambiguous cross-session window identities", () => {
    const historical = representativeSnapshot();
    const weak: LayoutPersistenceV1 = {
      ...historical.state,
      windows: historical.state.windows.map((window) =>
        window.key === "editor"
          ? {
              ...window,
              sessionMatch: { desktopFileName: "org.example.Editor" },
            }
          : window,
      ),
    };
    expectFailure(
      { ...historical, state: weak },
      representativeInput(),
      "unresolved-live-window",
    );

    const ambiguousState: LayoutPersistenceV1 = {
      ...historical.state,
      windows: historical.state.windows.map((window) =>
        window.key === "editor" || window.key === "chat"
          ? {
              ...window,
              sessionMatch: {
                desktopFileName: "org.example.Shared",
                tag: "shared",
              },
            }
          : window,
      ),
    };
    const ambiguousInput = representativeInput();

    expectFailure(
      { ...historical, state: ambiguousState },
      {
        ...ambiguousInput,
        windows: ambiguousInput.windows.map((window) =>
          window.liveId === "live-editor" || window.liveId === "live-chat"
            ? {
                ...window,
                desktopFileName: "org.example.Shared",
                tag: "shared",
              }
            : window,
        ),
      },
      "unresolved-live-window",
    );
  });

  it("keeps live identity ambiguity global across outputs", () => {
    const input = representativeInput();

    expectFailure(
      representativeSnapshot(),
      {
        ...input,
        windows: input.windows.map((window) =>
          window.liveId === "live-other"
            ? {
                ...window,
                desktopFileName: "org.example.Editor",
                tag: "main",
              }
            : window,
        ),
      },
      "unresolved-live-window",
    );
  });

  it("keeps persisted identity ambiguity global across outputs", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      windows: historical.state.windows.map((window) =>
        window.key === "other-window"
          ? {
              ...window,
              sessionMatch: {
                desktopFileName: "org.example.Editor",
                tag: "main",
              },
            }
          : window,
      ),
    };

    expectFailure(
      { ...historical, state },
      representativeInput(),
      "unresolved-live-window",
    );
  });

  it("keeps strong persisted projections global across outputs", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      windows: historical.state.windows.map((window) => {
        if (window.key === "editor") {
          return {
            ...window,
            sessionMatch: {
              ...window.sessionMatch,
              resourceName: "editor-primary",
            },
          };
        }

        if (window.key === "other-window") {
          return {
            ...window,
            sessionMatch: {
              desktopFileName: "org.example.Editor",
              resourceName: "editor-secondary",
              tag: "main",
            },
          };
        }

        return window;
      }),
    };
    const input = representativeInput();

    expectFailure(
      { ...historical, state },
      {
        ...input,
        windows: input.windows.map((window) =>
          window.liveId === "live-editor"
            ? { ...window, resourceName: "editor-primary" }
            : window,
        ),
      },
      "unresolved-live-window",
    );
  });

  it("reserves exact identities globally before planning the returned subset", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      windows: historical.state.windows.map((window) =>
        window.key === "other-window"
          ? {
              ...window,
              liveId: "live-other",
              sessionMatch: {
                desktopFileName: "org.example.Editor",
                tag: "main",
              },
            }
          : window,
      ),
    };
    const input = representativeInput();
    const result = planKnownOutputLayoutHydration(
      { ...historical, state },
      topology(currentReturned, currentOther),
      "DP-3",
      {
        ...input,
        windows: input.windows.map((window) =>
          window.liveId === "live-other"
            ? {
                ...window,
                desktopFileName: "org.example.Editor",
                tag: "main",
              }
            : window,
        ),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.kind).toBe("plan");
  });

  it("rejects restore baselines anywhere in a historical snapshot", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      contexts: historical.state.contexts.map((context) => {
        if (context.outputKey !== historicalOther.key) {
          return context;
        }

        return {
          ...context,
          columns: context.columns.map((column) => ({
            ...column,
            members: column.members.map((member) => ({
              ...member,
              restoreBaseline: {
                clientFrame: { height: 400, width: 600, x: 100, y: 80 },
                frame: { height: 440, width: 620, x: 90, y: 60 },
                kind: "client" as const,
                noBorder: false,
              },
            })),
          })),
          restoreFingerprint:
            "1\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800",
        };
      }),
    };

    expectFailure(
      { ...historical, state },
      representativeInput(),
      "historical-restore-baseline",
    );
  });

  it("rejects floating ownership on the returned historical output", () => {
    const historical = representativeSnapshot();
    const state: LayoutPersistenceV1 = {
      ...historical.state,
      floatingWindows: [
        {
          anchor: {
            columnIndex: 1,
            columnWidth: { kind: "fixed", value: 500 },
            memberIndex: 0,
            previousWindowKey: "terminal",
          },
          desktopId: "desktop-1",
          outputKey: historicalReturned.key,
          windowKey: "floating",
        },
      ],
      windows: [
        ...historical.state.windows,
        {
          key: "floating",
          liveId: "old-floating",
          sessionMatch: {
            desktopFileName: "org.example.Floating",
            tag: "floating",
          },
        },
      ],
    };

    expectFailure(
      { ...historical, state },
      representativeInput(),
      "historical-floating-window",
    );
  });

  it.each([
    [
      "an incomplete historical topology",
      (historical: LayoutPersistenceCatalogSnapshot) => ({
        ...historical,
        topology: null,
      }),
      "historical-topology-incomplete",
    ],
    [
      "an ambiguous historical topology",
      (historical: LayoutPersistenceCatalogSnapshot) => ({
        ...historical,
        topology: topology(
          historicalReturned,
          output(historicalOther.key, historicalOther.name, "panel-a"),
        ),
      }),
      "historical-topology-invalid",
    ],
  ] as const)("rejects %s", (_label, mutate, reason) => {
    expectFailure(
      mutate(representativeSnapshot()),
      representativeInput(),
      reason,
    );
  });

  it("rejects a different complete topology and a missing returned output", () => {
    const differentCurrent = topology(
      { ...currentReturned, serialNumber: "replacement-panel" },
      currentOther,
    );
    const differentInput = representativeInput();

    expect(
      planKnownOutputLayoutHydration(
        representativeSnapshot(),
        differentCurrent,
        "DP-3",
        {
          ...differentInput,
          outputs: differentInput.outputs.map((output) =>
            output.name === "DP-3"
              ? { ...output, serialNumber: "replacement-panel" }
              : output,
          ),
        },
      ),
    ).toEqual({
      kind: "failed",
      ok: false,
      reason: "historical-topology-unresolved",
    });

    expect(
      planKnownOutputLayoutHydration(
        representativeSnapshot(),
        topology(currentReturned, currentOther),
        "DP-9",
        representativeInput(),
      ),
    ).toEqual({
      kind: "failed",
      ok: false,
      reason: "returned-output-missing",
    });
  });

  it("rejects disagreement between the declared and hydration topologies", () => {
    const input = representativeInput();

    expect(
      planKnownOutputLayoutHydration(
        representativeSnapshot(),
        topology(currentReturned, currentOther),
        "DP-3",
        { ...input, outputs: input.outputs.slice(0, 1) },
      ),
    ).toEqual({
      kind: "failed",
      ok: false,
      reason: "live-topology-mismatch",
    });
  });
});

function representativeSnapshot(): LayoutPersistenceCatalogSnapshot {
  return {
    state: {
      contexts: [
        {
          activeColumnIndex: 1,
          columns: [
            {
              members: [
                {
                  height: { kind: "auto", weight: 2 },
                  windowKey: "editor",
                },
                {
                  height: { clientHeight: 360, kind: "fixed" },
                  windowKey: "chat",
                },
              ],
              width: { kind: "fixed", value: 620 },
            },
            {
              fullWidthRestore: { kind: "fixed", value: 840 },
              fullWidthRestoreViewportOffset: -270,
              members: [{ windowKey: "terminal" }],
              width: { kind: "proportion", value: 1 },
            },
          ],
          desktopId: "desktop-1",
          outputKey: historicalReturned.key,
          viewportOffset: -90,
        },
        {
          activeColumnIndex: 0,
          columns: [
            {
              members: [{ windowKey: "other-window" }],
              width: { kind: "proportion", value: 1 },
            },
          ],
          desktopId: "desktop-2",
          outputKey: historicalOther.key,
          viewportOffset: 0,
        },
      ],
      floatingWindows: [],
      format: LAYOUT_PERSISTENCE_FORMAT,
      outputs: [historicalReturned, historicalOther],
      version: LAYOUT_PERSISTENCE_VERSION,
      windows: [
        persistedWindow("editor", "old-editor", {
          desktopFileName: "org.example.Editor",
          tag: "main",
        }),
        persistedWindow("chat", "old-chat", {
          desktopFileName: "org.example.Chat",
          tag: "conversation",
        }),
        persistedWindow("terminal", "old-terminal", {
          resourceClass: "example-terminal",
          windowRole: "terminal",
        }),
        persistedWindow("other-window", "old-other", {
          desktopFileName: "org.example.Other",
          tag: "other",
        }),
      ],
    },
    topology: topology(historicalReturned, historicalOther),
  };
}

function representativeInput(): LayoutPersistenceHydrationInput {
  return {
    desktops: [{ id: "desktop-1" }, { id: "desktop-2" }],
    outputs: [liveOutput(currentReturned), liveOutput(currentOther)],
    windows: [
      liveWindow("live-editor", "DP-3", "desktop-1", {
        desktopFileName: "org.example.Editor",
        tag: "main",
      }),
      liveWindow("live-chat", "DP-3", "desktop-1", {
        desktopFileName: "org.example.Chat",
        tag: "conversation",
      }),
      liveWindow("live-terminal", "DP-3", "desktop-1", {
        resourceClass: "example-terminal",
        windowRole: "terminal",
      }),
      liveWindow(
        "automatic-dialog",
        "DP-3",
        "desktop-1",
        { desktopFileName: "org.example.Dialog", tag: "dialog" },
        false,
      ),
      liveWindow("live-other", "HDMI-A-1", "desktop-2", {
        desktopFileName: "org.example.Other",
        tag: "other",
      }),
    ],
  };
}

function output(
  key: string,
  name: string,
  serialNumber: string,
): PersistedOutputV1 {
  return {
    key,
    manufacturer: "Example",
    model: "Panel",
    name,
    serialNumber,
  };
}

function topology(
  ...outputs: readonly PersistedOutputV1[]
): LayoutPersistenceTopologyV2 {
  return { outputs };
}

function liveOutput(outputDescriptor: PersistedOutputV1) {
  return {
    ...(outputDescriptor.manufacturer === undefined
      ? {}
      : { manufacturer: outputDescriptor.manufacturer }),
    ...(outputDescriptor.model === undefined
      ? {}
      : { model: outputDescriptor.model }),
    name: outputDescriptor.name,
    ...(outputDescriptor.serialNumber === undefined
      ? {}
      : { serialNumber: outputDescriptor.serialNumber }),
  };
}

function persistedWindow(
  key: string,
  liveId: string,
  sessionMatch: NonNullable<
    LayoutPersistenceV1["windows"][number]["sessionMatch"]
  >,
) {
  return { key, liveId, sessionMatch };
}

function liveWindow(
  liveId: string,
  outputName: string,
  desktopId: string,
  identity: {
    readonly desktopFileName?: string;
    readonly resourceClass?: string;
    readonly tag?: string;
    readonly windowRole?: string;
  },
  eligible = true,
) {
  return { desktopId, eligible, liveId, outputName, ...identity };
}

function expectFailure(
  historical: LayoutPersistenceCatalogSnapshot,
  input: LayoutPersistenceHydrationInput,
  reason: LayoutPersistenceKnownOutputFailure,
): void {
  expect(
    planKnownOutputLayoutHydration(
      historical,
      topology(currentReturned, currentOther),
      "DP-3",
      input,
    ),
  ).toEqual({ kind: "failed", ok: false, reason });
}
