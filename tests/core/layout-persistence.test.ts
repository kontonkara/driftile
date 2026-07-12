import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LIMITS,
  LAYOUT_PERSISTENCE_VERSION,
  decodeLayoutPersistence,
  encodeLayoutPersistence,
  type LayoutPersistenceV1,
} from "../../src/core/layout-persistence";

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test fixture is incomplete");
  }

  return value;
}

function persistedState(): LayoutPersistenceV1 {
  return {
    contexts: [
      {
        activeColumnIndex: 1,
        columns: [
          {
            members: [{ windowKey: "window-1" }],
            width: { kind: "proportion", value: 0.5 },
          },
          {
            fullWidthRestore: { kind: "fixed", value: 720 },
            members: [
              {
                height: { kind: "auto", weight: 2 },
                windowKey: "window-2",
              },
              {
                height: { index: 1, kind: "preset" },
                windowKey: "window-3",
              },
            ],
            width: { kind: "proportion", value: 1 },
          },
        ],
        desktopId: "desktop-1",
        outputKey: "output-1",
        viewportOffset: -140,
      },
    ],
    floatingWindows: [
      {
        anchor: {
          columnIndex: 2,
          columnWidth: { kind: "fixed", value: 480 },
          memberIndex: 0,
          previousWindowKey: "window-3",
          windowHeight: { clientHeight: 360, kind: "fixed" },
        },
        desktopId: "desktop-1",
        outputKey: "output-1",
        windowKey: "window-4",
      },
    ],
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [
      {
        key: "output-1",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-1",
        serialNumber: "1234",
      },
    ],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [
      {
        key: "window-1",
        liveId: "00000000-0000-0000-0000-000000000001",
        sessionMatch: {
          desktopFileName: "org.example.Editor",
          tag: "document-primary",
        },
      },
      {
        key: "window-2",
        liveId: "00000000-0000-0000-0000-000000000002",
        sessionMatch: {
          resourceClass: "terminal",
          resourceName: "terminal",
        },
      },
      {
        key: "window-3",
        liveId: "00000000-0000-0000-0000-000000000003",
      },
      {
        key: "window-4",
        liveId: "00000000-0000-0000-0000-000000000004",
        sessionMatch: { windowRole: "main" },
      },
    ],
  };
}

describe("layout persistence codec", () => {
  it("round trips every durable v1 policy without runtime state", () => {
    const state = persistedState();
    const document = encodeLayoutPersistence(state);

    expect(decodeLayoutPersistence(document)).toEqual({
      ok: true,
      value: state,
    });
  });

  it("encodes registries and contexts in a deterministic order", () => {
    const state = persistedState();
    const secondOutput = {
      key: "output-2",
      name: "HDMI-A-1",
    };
    const secondWindow = {
      key: "window-5",
      liveId: "00000000-0000-0000-0000-000000000005",
    };
    const reordered: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        {
          activeColumnIndex: 0,
          columns: [
            {
              members: [{ windowKey: secondWindow.key }],
              width: { kind: "fixed", value: 500 },
            },
          ],
          desktopId: "desktop-2",
          outputKey: secondOutput.key,
          viewportOffset: 0,
        },
        ...state.contexts,
      ],
      outputs: [secondOutput, ...state.outputs],
      windows: [secondWindow, ...state.windows],
    };
    const canonical: LayoutPersistenceV1 = {
      ...reordered,
      contexts: [required(state.contexts[0]), required(reordered.contexts[0])],
      outputs: [...reordered.outputs].reverse(),
      windows: [...reordered.windows].reverse(),
    };

    expect(encodeLayoutPersistence(reordered)).toBe(
      encodeLayoutPersistence(canonical),
    );
  });

  it("normalizes negative zero and omitted optional values", () => {
    const state = persistedState();
    const context = required(state.contexts[0]);
    const firstColumn = required(context.columns[0]);
    const input = {
      ...state,
      contexts: [
        {
          ...context,
          columns: [
            {
              ...firstColumn,
              members: [
                {
                  height: { kind: "auto", weight: 1 },
                  windowKey: "window-1",
                },
              ],
            },
            required(context.columns[1]),
          ],
          viewportOffset: -0,
        },
      ],
      outputs: [
        {
          ...required(state.outputs[0]),
          manufacturer: undefined,
        },
      ],
    } as unknown as LayoutPersistenceV1;
    const decoded = decodeLayoutPersistence(encodeLayoutPersistence(input));

    expect(decoded).toMatchObject({
      ok: true,
      value: {
        contexts: [{ viewportOffset: 0 }],
        outputs: [{ key: "output-1", name: "DP-1" }],
      },
    });

    if (!decoded.ok) {
      throw new Error("normalized state did not decode");
    }

    expect(decoded.value.contexts[0]?.columns[0]?.members[0]).toEqual({
      windowKey: "window-1",
    });
  });

  it.each([
    ["invalid json", "{", "invalid-json"],
    [
      "unknown format",
      JSON.stringify({ ...persistedState(), format: "other" }),
      "invalid-state",
    ],
    [
      "future version",
      JSON.stringify({ ...persistedState(), version: 2 }),
      "unsupported-version",
    ],
    [
      "unknown field",
      JSON.stringify({ ...persistedState(), unexpected: true }),
      "invalid-state",
    ],
  ] as const)("rejects %s", (_name, document, error) => {
    expect(decodeLayoutPersistence(document)).toEqual({ error, ok: false });
  });

  it("rejects documents over the codec boundary before parsing", () => {
    const document = " ".repeat(
      LAYOUT_PERSISTENCE_LIMITS.documentCharacters + 1,
    );

    expect(decodeLayoutPersistence(document)).toEqual({
      error: "document-too-large",
      ok: false,
    });
  });

  it("rejects duplicate, missing, and multiply owned window references", () => {
    const state = persistedState();
    const duplicateLiveId: LayoutPersistenceV1 = {
      ...state,
      windows: [
        ...state.windows.slice(0, -1),
        {
          ...required(state.windows[3]),
          liveId: required(state.windows[0]).liveId,
        },
      ],
    };
    const missingWindow: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        {
          ...required(state.contexts[0]),
          columns: [
            {
              members: [{ windowKey: "missing" }],
              width: { kind: "fixed", value: 400 },
            },
          ],
        },
      ],
    };
    const multiplyOwned: LayoutPersistenceV1 = {
      ...state,
      floatingWindows: [
        {
          ...required(state.floatingWindows[0]),
          windowKey: "window-1",
        },
      ],
    };

    for (const invalid of [duplicateLiveId, missingWindow, multiplyOwned]) {
      expect(() => encodeLayoutPersistence(invalid)).toThrow();
    }
  });

  it("rejects invalid layout policies and floating anchors", () => {
    const state = persistedState();
    const twoFixedHeights: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        {
          ...required(state.contexts[0]),
          columns: [
            {
              members: [
                {
                  height: { clientHeight: 200, kind: "fixed" },
                  windowKey: "window-1",
                },
                {
                  height: { index: 0, kind: "preset" },
                  windowKey: "window-2",
                },
              ],
              width: { kind: "fixed", value: 500 },
            },
            {
              members: [{ windowKey: "window-3" }],
              width: { kind: "fixed", value: 500 },
            },
          ],
        },
      ],
    };
    const selfAnchor: LayoutPersistenceV1 = {
      ...state,
      floatingWindows: [
        {
          ...required(state.floatingWindows[0]),
          anchor: {
            ...required(state.floatingWindows[0]).anchor,
            previousWindowKey: "window-4",
          },
        },
      ],
    };
    const splitAnchor: LayoutPersistenceV1 = {
      ...state,
      floatingWindows: [
        {
          ...required(state.floatingWindows[0]),
          anchor: {
            ...required(state.floatingWindows[0]).anchor,
            nextWindowKey: "window-3",
            previousWindowKey: "window-1",
          },
        },
      ],
    };
    const staleFullWidthRestore: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        {
          ...required(state.contexts[0]),
          columns: [
            required(required(state.contexts[0]).columns[0]),
            {
              ...required(required(state.contexts[0]).columns[1]),
              width: { kind: "fixed", value: 500 },
            },
          ],
        },
      ],
    };

    expect(() => encodeLayoutPersistence(twoFixedHeights)).toThrow();
    expect(() => encodeLayoutPersistence(selfAnchor)).toThrow();
    expect(() => encodeLayoutPersistence(splitAnchor)).toThrow();
    expect(() => encodeLayoutPersistence(staleFullWidthRestore)).toThrow();
  });

  it("rejects floating anchors outside their tiled source context", () => {
    const state = persistedState();
    const otherWindow = {
      key: "window-5",
      liveId: "00000000-0000-0000-0000-000000000005",
    };
    const otherContext: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        ...state.contexts,
        {
          activeColumnIndex: 0,
          columns: [
            {
              members: [{ windowKey: otherWindow.key }],
              width: { kind: "fixed", value: 500 },
            },
          ],
          desktopId: "desktop-2",
          outputKey: "output-2",
          viewportOffset: 0,
        },
      ],
      floatingWindows: [
        {
          ...required(state.floatingWindows[0]),
          anchor: {
            ...required(state.floatingWindows[0]).anchor,
            previousWindowKey: otherWindow.key,
          },
        },
      ],
      outputs: [...state.outputs, { key: "output-2", name: "HDMI-A-1" }],
      windows: [...state.windows, otherWindow],
    };
    const floatingAnchor: LayoutPersistenceV1 = {
      ...state,
      floatingWindows: [
        {
          ...required(state.floatingWindows[0]),
          anchor: {
            ...required(state.floatingWindows[0]).anchor,
            previousWindowKey: otherWindow.key,
          },
        },
        {
          anchor: {
            columnIndex: 0,
            columnWidth: { kind: "fixed", value: 500 },
            memberIndex: 0,
            previousWindowKey: "window-1",
          },
          desktopId: "desktop-1",
          outputKey: "output-1",
          windowKey: otherWindow.key,
        },
      ],
      windows: [...state.windows, otherWindow],
    };

    expect(() => encodeLayoutPersistence(otherContext)).toThrow();
    expect(() => encodeLayoutPersistence(floatingAnchor)).toThrow();
  });

  it("rejects identifiers and numbers outside bounded storage limits", () => {
    const state = persistedState();
    const longOutputKey = "x".repeat(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters + 1,
    );
    const longIdentifier: LayoutPersistenceV1 = {
      ...state,
      contexts: [{ ...required(state.contexts[0]), outputKey: longOutputKey }],
      outputs: [{ key: longOutputKey, name: "DP-1" }],
    };
    const hugeViewport: LayoutPersistenceV1 = {
      ...state,
      contexts: [
        {
          ...required(state.contexts[0]),
          viewportOffset: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
        },
      ],
    };

    expect(() => encodeLayoutPersistence(longIdentifier)).toThrow();
    expect(() => encodeLayoutPersistence(hugeViewport)).toThrow();
  });

  it("never throws while decoding arbitrary JSON values", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() =>
          decodeLayoutPersistence(JSON.stringify(value)),
        ).not.toThrow();
      }),
    );
  });
});
