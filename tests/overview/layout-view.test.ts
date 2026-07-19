import { describe, expect, it } from "vitest";
import {
  LAYOUT_PERSISTENCE_CATALOG_VERSION,
  encodeLayoutPersistenceCatalog,
  type LayoutPersistenceCatalogSnapshot,
  type LayoutPersistenceCatalogV2,
  type LayoutPersistenceTopologyV2,
} from "../../src/core/layout-persistence-catalog";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LIMITS,
  LAYOUT_PERSISTENCE_VERSION,
  encodeLayoutPersistence,
  type LayoutPersistenceV4,
  type PersistedOutputV1,
} from "../../src/core/layout-persistence";
import {
  projectOverviewLayout,
  type OverviewLiveLayout,
} from "../../src/overview/layout-view";

const RESTORE_FINGERPRINT =
  "1\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800";
const MAXIMUM_OPERATIONS_PER_WINDOW = 7;
const WORK_ACTIVITY = "work";
const PERSONAL_ACTIVITY = "personal";

const internalOutput = Object.freeze({
  key: "stored-internal",
  manufacturer: "Example",
  model: "Panel",
  name: "eDP-1",
  serialNumber: "internal-1",
} satisfies PersistedOutputV1);

const externalOutput = Object.freeze({
  key: "stored-external",
  manufacturer: "Example",
  model: "Display",
  name: "DP-1",
  serialNumber: "external-1",
} satisfies PersistedOutputV1);

function representativeState(): LayoutPersistenceV4 {
  return {
    contexts: [
      {
        activeColumnIndex: 1,
        activityId: WORK_ACTIVITY,
        columns: [
          {
            fullWidthRestore: { kind: "fixed", value: 800 },
            members: [
              {
                height: { clientHeight: 480, kind: "fixed" },
                restoreBaseline: {
                  clientFrame: { height: 480, width: 700, x: 30, y: 50 },
                  frame: { height: 510, width: 720, x: 20, y: 30 },
                  kind: "client",
                  noBorder: false,
                },
                windowKey: "stored-a",
              },
              { windowKey: "stored-b" },
            ],
            presentation: "tabbed",
            selectedMemberIndex: 1,
            width: { kind: "proportion", value: 1 },
          },
          {
            members: [
              {
                height: { index: 2, kind: "preset" },
                windowKey: "stored-c",
              },
            ],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "fixed", value: 640 },
          },
        ],
        desktopId: "desktop-1",
        outputKey: internalOutput.key,
        restoreFingerprint: RESTORE_FINGERPRINT,
        viewportOffset: -120,
      },
      {
        activeColumnIndex: 0,
        activityId: WORK_ACTIVITY,
        columns: [
          {
            members: [
              {
                height: { kind: "auto", weight: 2 },
                windowKey: "stored-d",
              },
            ],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "proportion", value: 0.5 },
          },
        ],
        desktopId: "desktop-2",
        outputKey: internalOutput.key,
        viewportOffset: 40,
      },
    ],
    floatingWindows: [
      {
        activityId: WORK_ACTIVITY,
        anchor: {
          columnIndex: 0,
          columnPresentation: "tabbed",
          columnWidth: { kind: "proportion", value: 1 },
          memberIndex: 1,
          nextWindowKey: "stored-b",
          previousWindowKey: "stored-a",
          windowHeight: { index: 3, kind: "preset" },
        },
        desktopId: "desktop-1",
        outputKey: internalOutput.key,
        windowKey: "stored-floating",
      },
    ],
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [internalOutput],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [
      { key: "stored-a", liveId: "live-a" },
      { key: "stored-b", liveId: "live-b" },
      { key: "stored-c", liveId: "live-c" },
      { key: "stored-d", liveId: "live-d" },
      { key: "stored-floating", liveId: "live-floating" },
    ],
  };
}

function topology(
  ...outputs: readonly PersistedOutputV1[]
): LayoutPersistenceTopologyV2 {
  return { outputs };
}

function snapshot(
  state: LayoutPersistenceV4,
  persistedTopology: LayoutPersistenceTopologyV2,
): LayoutPersistenceCatalogSnapshot {
  return { state, topology: persistedTopology };
}

function catalog(
  ...snapshots: readonly LayoutPersistenceCatalogSnapshot[]
): LayoutPersistenceCatalogV2 {
  return {
    format: LAYOUT_PERSISTENCE_FORMAT,
    snapshots,
    version: LAYOUT_PERSISTENCE_CATALOG_VERSION,
  };
}

function documentFor(
  state = representativeState(),
  persistedTopology = topology(internalOutput, externalOutput),
): string {
  return encodeLayoutPersistenceCatalog(
    catalog(snapshot(state, persistedTopology)),
  );
}

function liveLayout(
  overrides: Partial<OverviewLiveLayout> = {},
): OverviewLiveLayout {
  return {
    activityIds: [WORK_ACTIVITY, PERSONAL_ACTIVITY],
    currentActivityId: WORK_ACTIVITY,
    desktopIds: ["desktop-1", "desktop-2"],
    outputs: [
      {
        manufacturer: internalOutput.manufacturer,
        model: internalOutput.model,
        name: internalOutput.name,
        serialNumber: internalOutput.serialNumber,
      },
      {
        manufacturer: externalOutput.manufacturer,
        model: externalOutput.model,
        name: externalOutput.name,
        serialNumber: externalOutput.serialNumber,
      },
    ],
    windowIds: ["live-a", "live-b", "live-c", "live-d", "live-floating"],
    ...overrides,
  };
}

function success(document = documentFor(), live = liveLayout()) {
  const projected = projectOverviewLayout(document, live);

  if (!projected.ok) {
    throw new Error(`projection failed: ${projected.error}`);
  }

  return projected.value;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test fixture is incomplete");
  }

  return value;
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);

  for (const child of Object.values(value)) {
    expectDeepFrozen(child);
  }
}

function oneWindowState(
  persistedOutput: PersistedOutputV1,
  suffix: string,
): LayoutPersistenceV4 {
  return {
    contexts: [
      {
        activeColumnIndex: 0,
        activityId: WORK_ACTIVITY,
        columns: [
          {
            members: [{ windowKey: `stored-${suffix}` }],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "fixed", value: 600 },
          },
        ],
        desktopId: "desktop-1",
        outputKey: persistedOutput.key,
        viewportOffset: 0,
      },
    ],
    floatingWindows: [],
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [persistedOutput],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [{ key: `stored-${suffix}`, liveId: `live-${suffix}` }],
  };
}

describe("projectOverviewLayout", () => {
  it("projects the active catalog snapshot without private restore state", () => {
    const projected = success();

    expect(projected).toEqual({
      contexts: [
        {
          activeColumnIndex: 1,
          activityId: WORK_ACTIVITY,
          columns: [
            {
              fullWidthRestore: { kind: "fixed", value: 800 },
              members: [
                {
                  height: { clientHeight: 480, kind: "fixed" },
                  windowId: "live-a",
                },
                { windowId: "live-b" },
              ],
              presentation: "tabbed",
              selectedMemberIndex: 1,
              width: { kind: "proportion", value: 1 },
            },
            {
              members: [
                {
                  height: { index: 2, kind: "preset" },
                  windowId: "live-c",
                },
              ],
              presentation: "stacked",
              selectedMemberIndex: 0,
              width: { kind: "fixed", value: 640 },
            },
          ],
          desktopId: "desktop-1",
          outputId: "eDP-1",
          viewportOffset: -120,
        },
        {
          activeColumnIndex: 0,
          activityId: WORK_ACTIVITY,
          columns: [
            {
              members: [
                {
                  height: { kind: "auto", weight: 2 },
                  windowId: "live-d",
                },
              ],
              presentation: "stacked",
              selectedMemberIndex: 0,
              width: { kind: "proportion", value: 0.5 },
            },
          ],
          desktopId: "desktop-2",
          outputId: "eDP-1",
          viewportOffset: 40,
        },
      ],
      currentActivityId: WORK_ACTIVITY,
      desktopIds: ["desktop-1", "desktop-2"],
      floatingWindows: [
        {
          activityId: WORK_ACTIVITY,
          anchor: {
            columnIndex: 0,
            columnWidth: { kind: "proportion", value: 1 },
            memberIndex: 1,
            nextWindowId: "live-b",
            previousWindowId: "live-a",
            windowHeight: { index: 3, kind: "preset" },
          },
          desktopId: "desktop-1",
          outputId: "eDP-1",
          windowId: "live-floating",
        },
      ],
      outputs: [
        {
          manufacturer: externalOutput.manufacturer,
          model: externalOutput.model,
          name: externalOutput.name,
          outputId: externalOutput.name,
          serialNumber: externalOutput.serialNumber,
        },
        {
          manufacturer: internalOutput.manufacturer,
          model: internalOutput.model,
          name: internalOutput.name,
          outputId: internalOutput.name,
          serialNumber: internalOutput.serialNumber,
        },
      ],
    });
    expectDeepFrozen(projected);
    expect(JSON.stringify(projected)).not.toContain("restoreBaseline");
    expect(JSON.stringify(projected)).not.toContain("restoreFingerprint");
    expect(JSON.stringify(projected)).not.toContain("stored-");
  });

  it("projects immutable live height bounds onto matching layout members", () => {
    const projected = success(
      documentFor(),
      liveLayout({
        windowHeightBounds: [
          {
            decorationHeight: 28,
            maximumClientHeight: 900,
            minimumClientHeight: 120,
            windowId: "live-a",
          },
          {
            decorationHeight: 0,
            maximumClientHeight: Number.POSITIVE_INFINITY,
            minimumClientHeight: 1,
            windowId: "live-b",
          },
          {
            decorationHeight: 12,
            maximumClientHeight: 720,
            minimumClientHeight: 80,
            windowId: "unrelated",
          },
        ],
        windowIds: [...liveLayout().windowIds, "unrelated"],
      }),
    );

    expect(projected.contexts[0]?.columns[0]?.members).toEqual([
      {
        height: { clientHeight: 480, kind: "fixed" },
        heightBounds: {
          decorationHeight: 28,
          maximumClientHeight: 900,
          minimumClientHeight: 120,
        },
        windowId: "live-a",
      },
      {
        heightBounds: {
          decorationHeight: 0,
          maximumClientHeight: Number.POSITIVE_INFINITY,
          minimumClientHeight: 1,
        },
        windowId: "live-b",
      },
    ]);
    expect(JSON.stringify(projected)).not.toContain("unrelated");
    expectDeepFrozen(projected);
  });

  it("leaves members without a validly supplied live height bound unchanged", () => {
    const projected = success(
      documentFor(),
      liveLayout({
        windowHeightBounds: [
          {
            decorationHeight: 28,
            maximumClientHeight: 900,
            minimumClientHeight: 120,
            windowId: "live-a",
          },
        ],
      }),
    );

    expect(projected.contexts[0]?.columns[0]?.members[0]).toMatchObject({
      heightBounds: {
        decorationHeight: 28,
        maximumClientHeight: 900,
        minimumClientHeight: 120,
      },
      windowId: "live-a",
    });
    expect(projected.contexts[0]?.columns[0]?.members[1]).toEqual({
      windowId: "live-b",
    });
  });

  it.each([
    ["a non-array value", {}],
    ["a non-object entry", [null]],
    [
      "an unknown window",
      [
        {
          decorationHeight: 0,
          maximumClientHeight: Number.POSITIVE_INFINITY,
          minimumClientHeight: 1,
          windowId: "unknown",
        },
      ],
    ],
    [
      "a duplicate window",
      [
        {
          decorationHeight: 0,
          maximumClientHeight: 800,
          minimumClientHeight: 1,
          windowId: "live-a",
        },
        {
          decorationHeight: 0,
          maximumClientHeight: 900,
          minimumClientHeight: 1,
          windowId: "live-a",
        },
      ],
    ],
    [
      "an invalid decoration height",
      [
        {
          decorationHeight: -1,
          maximumClientHeight: 800,
          minimumClientHeight: 1,
          windowId: "live-a",
        },
      ],
    ],
    [
      "an invalid minimum height",
      [
        {
          decorationHeight: 0,
          maximumClientHeight: 800,
          minimumClientHeight: Number.NaN,
          windowId: "live-a",
        },
      ],
    ],
    [
      "a nonpositive maximum height",
      [
        {
          decorationHeight: 0,
          maximumClientHeight: 0,
          minimumClientHeight: 0,
          windowId: "live-a",
        },
      ],
    ],
    [
      "an inverted height range",
      [
        {
          decorationHeight: 0,
          maximumClientHeight: 199,
          minimumClientHeight: 200,
          windowId: "live-a",
        },
      ],
    ],
    [
      "an oversized number",
      [
        {
          decorationHeight: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
          maximumClientHeight: Number.POSITIVE_INFINITY,
          minimumClientHeight: 1,
          windowId: "live-a",
        },
      ],
    ],
  ])("rejects live height bounds with %s", (_label, windowHeightBounds) => {
    expect(
      projectOverviewLayout(
        documentFor(),
        liveLayout({
          windowHeightBounds: windowHeightBounds as NonNullable<
            OverviewLiveLayout["windowHeightBounds"]
          >,
        }),
      ),
    ).toEqual({ error: "invalid-live-window-height-bound", ok: false });
  });

  it("rejects an oversized live height-bound catalog", () => {
    const windowHeightBounds = Array.from(
      { length: LAYOUT_PERSISTENCE_LIMITS.windows + 1 },
      (_value, index) => ({
        decorationHeight: 0,
        maximumClientHeight: Number.POSITIVE_INFINITY,
        minimumClientHeight: 1,
        windowId: `live-${String(index)}`,
      }),
    );

    expect(
      projectOverviewLayout(documentFor(), liveLayout({ windowHeightBounds })),
    ).toEqual({ error: "invalid-live-window-height-bound", ok: false });
  });

  it("projects only the current activity", () => {
    const base = representativeState();
    const state: LayoutPersistenceV4 = {
      ...base,
      contexts: [
        ...base.contexts,
        {
          activeColumnIndex: 0,
          activityId: PERSONAL_ACTIVITY,
          columns: [
            {
              members: [{ windowKey: "stored-personal" }],
              presentation: "stacked",
              selectedMemberIndex: 0,
              width: { kind: "proportion", value: 1 / 3 },
            },
          ],
          desktopId: "desktop-1",
          outputKey: internalOutput.key,
          viewportOffset: 0,
        },
      ],
      windows: [
        ...base.windows,
        { key: "stored-personal", liveId: "live-personal" },
      ],
    };
    const projected = success(
      documentFor(state),
      liveLayout({
        currentActivityId: PERSONAL_ACTIVITY,
        windowIds: [...liveLayout().windowIds, "live-personal"],
      }),
    );

    expect(projected.currentActivityId).toBe(PERSONAL_ACTIVITY);
    expect(projected.contexts).toHaveLength(1);
    expect(projected.contexts[0]?.activityId).toBe(PERSONAL_ACTIVITY);
    expect(projected.contexts[0]?.columns[0]?.members).toEqual([
      { windowId: "live-personal" },
    ]);
    expect(projected.floatingWindows).toEqual([]);
  });

  it("uses snapshot zero instead of selecting a historical topology", () => {
    const historicalOutput = {
      key: "historical",
      manufacturer: "Other",
      model: "Projector",
      name: "HDMI-A-1",
      serialNumber: "historical-1",
    } satisfies PersistedOutputV1;
    const current = snapshot(
      oneWindowState(internalOutput, "current"),
      topology(internalOutput),
    );
    const historical = snapshot(
      oneWindowState(historicalOutput, "historical"),
      topology(historicalOutput),
    );
    const document = encodeLayoutPersistenceCatalog(
      catalog(current, historical),
    );

    expect(
      projectOverviewLayout(document, {
        activityIds: [WORK_ACTIVITY, PERSONAL_ACTIVITY],
        currentActivityId: WORK_ACTIVITY,
        desktopIds: ["desktop-1"],
        outputs: [
          {
            manufacturer: historicalOutput.manufacturer,
            model: historicalOutput.model,
            name: historicalOutput.name,
            serialNumber: historicalOutput.serialNumber,
          },
        ],
        windowIds: ["live-historical"],
      }),
    ).toEqual({ error: "topology-mismatch", ok: false });
  });

  it.each([
    ["missing", "", "missing-state"],
    ["corrupt", "{", "invalid-json"],
    [
      "invalid",
      JSON.stringify({
        format: LAYOUT_PERSISTENCE_FORMAT,
        snapshots: [],
        version: LAYOUT_PERSISTENCE_CATALOG_VERSION,
      }),
      "invalid-state",
    ],
    [
      "future",
      JSON.stringify({
        format: LAYOUT_PERSISTENCE_FORMAT,
        snapshots: [],
        version: LAYOUT_PERSISTENCE_CATALOG_VERSION + 10,
      }),
      "unsupported-version",
    ],
    [
      "oversize",
      " ".repeat(LAYOUT_PERSISTENCE_LIMITS.documentCharacters + 1),
      "document-too-large",
    ],
  ])("rejects %s state", (_label, document, error) => {
    expect(projectOverviewLayout(document, liveLayout())).toEqual({
      error,
      ok: false,
    });
  });

  it("rejects a bare v3 state with no authoritative topology", () => {
    expect(
      projectOverviewLayout(
        encodeLayoutPersistence(representativeState()),
        liveLayout(),
      ),
    ).toEqual({ error: "legacy-topology", ok: false });
  });

  it.each([
    [
      "a missing output",
      liveLayout({ outputs: liveLayout().outputs.slice(0, 1) }),
      "topology-mismatch",
    ],
    [
      "a stale descriptor",
      liveLayout({
        outputs: liveLayout().outputs.map((output) =>
          output.name === internalOutput.name
            ? { ...output, model: "Changed" }
            : output,
        ),
      }),
      "topology-mismatch",
    ],
    [
      "a duplicate output name",
      liveLayout({
        outputs: [
          required(liveLayout().outputs[0]),
          required(liveLayout().outputs[0]),
        ],
      }),
      "invalid-live-output",
    ],
    [
      "an invalid output name",
      liveLayout({
        outputs: [{ ...required(liveLayout().outputs[0]), name: "bad\nname" }],
      }),
      "invalid-live-output",
    ],
    [
      "too many outputs",
      liveLayout({
        outputs: Array.from(
          { length: LAYOUT_PERSISTENCE_LIMITS.outputs + 1 },
          (_value, index) => ({ name: `output-${String(index)}` }),
        ),
      }),
      "invalid-live-output",
    ],
  ])("rejects live topology with %s", (_label, live, error) => {
    expect(projectOverviewLayout(documentFor(), live)).toEqual({
      error,
      ok: false,
    });
  });

  it("accepts extra empty-tail desktops and unrelated live windows", () => {
    const projected = success(
      documentFor(),
      liveLayout({
        desktopIds: ["desktop-3", "desktop-2", "desktop-1"],
        windowIds: [
          "unrelated",
          "live-floating",
          "live-d",
          "live-c",
          "live-b",
          "live-a",
        ],
      }),
    );

    expect(projected.desktopIds).toEqual([
      "desktop-1",
      "desktop-2",
      "desktop-3",
    ]);
    expect(JSON.stringify(projected)).not.toContain("unrelated");
  });

  it.each([
    [
      "duplicate desktops",
      liveLayout({ desktopIds: ["desktop-1", "desktop-1"] }),
      "invalid-live-desktop",
    ],
    [
      "invalid desktops",
      liveLayout({ desktopIds: ["desktop-1", ""] }),
      "invalid-live-desktop",
    ],
    [
      "stale desktops",
      liveLayout({ desktopIds: ["desktop-1"] }),
      "desktop-mismatch",
    ],
    [
      "too many desktops",
      liveLayout({
        desktopIds: Array.from(
          { length: LAYOUT_PERSISTENCE_LIMITS.contexts + 1 },
          (_value, index) => `desktop-${String(index)}`,
        ),
      }),
      "invalid-live-desktop",
    ],
    [
      "duplicate windows",
      liveLayout({ windowIds: ["live-a", "live-a"] }),
      "invalid-live-window",
    ],
    [
      "invalid windows",
      liveLayout({ windowIds: ["live-a", "bad\u0000window"] }),
      "invalid-live-window",
    ],
    [
      "stale windows",
      liveLayout({
        windowIds: ["live-a", "live-b", "live-c", "live-d"],
      }),
      "window-mismatch",
    ],
    [
      "a stale hidden tab member",
      liveLayout({
        windowIds: ["live-b", "live-c", "live-d", "live-floating"],
      }),
      "window-mismatch",
    ],
    [
      "too many windows",
      liveLayout({
        windowIds: Array.from(
          { length: LAYOUT_PERSISTENCE_LIMITS.windows + 1 },
          (_value, index) => `window-${String(index)}`,
        ),
      }),
      "invalid-live-window",
    ],
  ])("rejects %s", (_label, live, error) => {
    expect(projectOverviewLayout(documentFor(), live)).toEqual({
      error,
      ok: false,
    });
  });

  it("is deterministic when every live input is reordered", () => {
    const forward = success();
    const reversed = success(
      documentFor(),
      liveLayout({
        desktopIds: [...liveLayout().desktopIds].reverse(),
        outputs: [...liveLayout().outputs].reverse(),
        windowIds: [...liveLayout().windowIds].reverse(),
      }),
    );

    expect(reversed).toEqual(forward);
  });

  it("performance budget: resolves the maximum window catalog linearly", () => {
    const windowCount = LAYOUT_PERSISTENCE_LIMITS.windows;
    const contextCount = LAYOUT_PERSISTENCE_LIMITS.contexts;
    const windowsPerContext = windowCount / contextCount;
    const windows = Array.from({ length: windowCount }, (_value, index) => ({
      key: `stored-${String(index)}`,
      liveId: `live-${String(index)}`,
    }));
    const state: LayoutPersistenceV4 = {
      contexts: Array.from({ length: contextCount }, (_value, contextIndex) => {
        const contextWindows = windows.slice(
          contextIndex * windowsPerContext,
          (contextIndex + 1) * windowsPerContext,
        );

        return {
          activeColumnIndex: 0,
          activityId: WORK_ACTIVITY,
          columns: contextWindows.map((window) => ({
            members: [{ windowKey: window.key }],
            presentation: "stacked" as const,
            selectedMemberIndex: 0,
            width: { kind: "fixed" as const, value: 600 },
          })),
          desktopId: `desktop-${String(contextIndex)}`,
          outputKey: internalOutput.key,
          viewportOffset: 0,
        };
      }),
      floatingWindows: [],
      format: LAYOUT_PERSISTENCE_FORMAT,
      outputs: [internalOutput],
      version: LAYOUT_PERSISTENCE_VERSION,
      windows,
    };
    const metrics = { operations: 0 };
    const projected = projectOverviewLayout(
      documentFor(state, topology(internalOutput)),
      {
        activityIds: [WORK_ACTIVITY],
        currentActivityId: WORK_ACTIVITY,
        desktopIds: Array.from(
          { length: contextCount },
          (_value, index) => `desktop-${String(index)}`,
        ),
        outputs: [
          {
            manufacturer: internalOutput.manufacturer,
            model: internalOutput.model,
            name: internalOutput.name,
            serialNumber: internalOutput.serialNumber,
          },
        ],
        windowIds: windows.map((window) => window.liveId),
      },
      metrics,
    );

    expect(projected.ok).toBe(true);
    expect(metrics.operations).toBeLessThanOrEqual(
      windowCount * MAXIMUM_OPERATIONS_PER_WINDOW,
    );
    expect(
      projected.ok
        ? projected.value.contexts.reduce(
            (total, context) =>
              total +
              context.columns.reduce(
                (contextTotal, column) => contextTotal + column.members.length,
                0,
              ),
            0,
          )
        : 0,
    ).toBe(windowCount);
  });
});
