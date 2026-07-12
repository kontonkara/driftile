import { describe, expect, it } from "vitest";
import {
  LAYOUT_PERSISTENCE_CATALOG_LIMITS,
  LAYOUT_PERSISTENCE_CATALOG_VERSION,
  activeLayoutPersistenceState,
  decodeLayoutPersistenceCatalog,
  encodeLayoutPersistenceCatalog,
  mergeLayoutPersistenceCatalog,
  selectLayoutPersistenceSnapshot,
  type LayoutPersistenceCatalogSnapshot,
  type LayoutPersistenceCatalogV2,
  type LayoutPersistenceTopologyV2,
} from "../../src/core/layout-persistence-catalog";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LIMITS,
  LAYOUT_PERSISTENCE_VERSION,
  encodeLayoutPersistence,
  type LayoutPersistenceV1,
  type PersistedOutputV1,
} from "../../src/core/layout-persistence";

const CONTEXT_FINGERPRINT =
  "1\u00000\u00000\u00001000\u0000800\u00000\u00000\u00001000\u0000800";

function output(name: string, serialNumber?: string): PersistedOutputV1 {
  return {
    key: name,
    ...(serialNumber === undefined
      ? {}
      : {
          manufacturer: "Example",
          model: "Panel",
          serialNumber,
        }),
    name,
  };
}

function topology(...outputs: readonly PersistedOutputV1[]) {
  return { outputs } satisfies LayoutPersistenceTopologyV2;
}

function state(
  persistedOutput: PersistedOutputV1,
  windowKey: string,
  withBaseline = false,
): LayoutPersistenceV1 {
  return {
    contexts: [
      {
        activeColumnIndex: 0,
        columns: [
          {
            members: [
              {
                height: { clientHeight: 420, kind: "fixed" },
                ...(withBaseline ? { restoreBaseline: restoreBaseline() } : {}),
                windowKey,
              },
            ],
            width: { kind: "fixed", value: 720 },
          },
        ],
        desktopId: "desktop-1",
        outputKey: persistedOutput.key,
        ...(withBaseline ? { restoreFingerprint: CONTEXT_FINGERPRINT } : {}),
        viewportOffset: -80,
      },
    ],
    floatingWindows: [],
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [persistedOutput],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: [{ key: windowKey, liveId: `live-${windowKey}` }],
  };
}

function restoreBaseline() {
  return {
    clientFrame: { height: 420, width: 700, x: 110, y: 90 },
    frame: { height: 450, width: 720, x: 100, y: 70 },
    kind: "client" as const,
    noBorder: false,
  };
}

function snapshot(
  persistedTopology: LayoutPersistenceTopologyV2,
  windowKey: string,
  withBaseline = false,
): LayoutPersistenceCatalogSnapshot {
  const activeOutput = required(persistedTopology.outputs[0]);

  return {
    state: state(activeOutput, windowKey, withBaseline),
    topology: persistedTopology,
  };
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

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test fixture is incomplete");
  }

  return value;
}

describe("layout persistence catalog codec", () => {
  it("decodes a bare v1 document as one incomplete legacy snapshot", () => {
    const legacyState = state(output("DP-1"), "legacy", true);
    const decoded = decodeLayoutPersistenceCatalog(
      encodeLayoutPersistence(legacyState),
    );

    expect(decoded).toEqual({
      ok: true,
      value: catalog({ state: legacyState, topology: null }),
    });

    if (!decoded.ok) {
      throw new Error("legacy document did not decode");
    }

    expect(activeLayoutPersistenceState(decoded.value)).toEqual(legacyState);
    expect(() => encodeLayoutPersistenceCatalog(decoded.value)).toThrow();
  });

  it("round trips a canonical v2 MRU with empty outputs in its topology", () => {
    const activeOutput = output("DP-1", "serial-1");
    const emptyOutput = output("HDMI-A-1", "serial-2");
    const current = snapshot(
      topology(emptyOutput, activeOutput),
      "current",
      true,
    );
    const historical = snapshot(
      topology(output("eDP-1", "serial-3")),
      "historical",
    );
    const value = catalog(current, historical);
    const document = encodeLayoutPersistenceCatalog(value);
    const decoded = decodeLayoutPersistenceCatalog(document);

    const parsed = JSON.parse(document) as {
      readonly format: string;
      readonly snapshots: readonly {
        readonly topology: {
          readonly outputs: readonly { readonly key: string }[];
        };
      }[];
      readonly version: number;
    };

    expect(parsed.format).toBe(LAYOUT_PERSISTENCE_FORMAT);
    expect(parsed.version).toBe(LAYOUT_PERSISTENCE_CATALOG_VERSION);
    expect(
      parsed.snapshots[0]?.topology.outputs.map((entry) => entry.key),
    ).toEqual(["DP-1", "HDMI-A-1"]);
    expect(decoded).toEqual({
      ok: true,
      value: catalog(
        {
          ...current,
          topology: topology(activeOutput, emptyOutput),
        },
        historical,
      ),
    });
  });

  it("encodes the same document for every topology registry order", () => {
    const first = output("DP-1", "serial-1");
    const second = output("HDMI-A-1", "serial-2");
    const persistedState = state(first, "window");
    const forward = {
      state: persistedState,
      topology: topology(first, second),
    };
    const reverse = {
      state: persistedState,
      topology: topology(second, first),
    };

    expect(encodeLayoutPersistenceCatalog(catalog(forward))).toBe(
      encodeLayoutPersistenceCatalog(catalog(reverse)),
    );
  });

  it.each([
    [
      "unknown envelope fields",
      (value: LayoutPersistenceCatalogV2) => ({ ...value, extra: true }),
    ],
    [
      "unknown snapshot fields",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [{ ...required(value.snapshots[0]), extra: true }],
      }),
    ],
    [
      "unknown topology fields",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [
          {
            ...required(value.snapshots[0]),
            topology: {
              ...required(required(value.snapshots[0]).topology ?? undefined),
              extra: true,
            },
          },
        ],
      }),
    ],
    [
      "an incomplete v2 topology",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [{ ...required(value.snapshots[0]), topology: null }],
      }),
    ],
    [
      "duplicate output keys",
      (value: LayoutPersistenceCatalogV2) => {
        const current = required(value.snapshots[0]);
        const first = required(
          required(current.topology ?? undefined).outputs[0],
        );
        return {
          ...value,
          snapshots: [
            {
              ...current,
              topology: topology(first, { ...first, name: "DP-2" }),
            },
          ],
        };
      },
    ],
    [
      "duplicate output names",
      (value: LayoutPersistenceCatalogV2) => {
        const current = required(value.snapshots[0]);
        const first = required(
          required(current.topology ?? undefined).outputs[0],
        );
        return {
          ...value,
          snapshots: [
            {
              ...current,
              topology: topology(first, { ...first, key: "DP-2" }),
            },
          ],
        };
      },
    ],
    [
      "ambiguous stable output descriptors",
      (value: LayoutPersistenceCatalogV2) => {
        const current = required(value.snapshots[0]);
        return {
          ...value,
          snapshots: [
            {
              ...current,
              topology: topology(
                output("DP-1", "duplicate"),
                output("DP-2", "duplicate"),
              ),
            },
          ],
        };
      },
    ],
    [
      "a state output missing from the complete topology",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [
          {
            ...required(value.snapshots[0]),
            topology: topology(output("DP-2", "serial-2")),
          },
        ],
      }),
    ],
    [
      "a conflicting state output descriptor",
      (value: LayoutPersistenceCatalogV2) => {
        const current = required(value.snapshots[0]);
        const persistedTopology = required(current.topology ?? undefined);
        const activeOutput = required(persistedTopology.outputs[0]);
        return {
          ...value,
          snapshots: [
            {
              ...current,
              state: {
                ...current.state,
                outputs: [{ ...activeOutput, model: "Other" }],
              },
            },
          ],
        };
      },
    ],
    [
      "restore baselines in history",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [
          required(value.snapshots[0]),
          snapshot(topology(output("DP-2", "serial-2")), "old", true),
        ],
      }),
    ],
    [
      "equivalent duplicate topologies",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: [
          required(value.snapshots[0]),
          snapshot(topology(output("DP-9", "serial-1")), "old"),
        ],
      }),
    ],
    [
      "more than four snapshots",
      (value: LayoutPersistenceCatalogV2) => ({
        ...value,
        snapshots: Array.from(
          { length: LAYOUT_PERSISTENCE_CATALOG_LIMITS.snapshots + 1 },
          (_unused, index) =>
            snapshot(
              topology(
                output(
                  `DP-${String(index + 1)}`,
                  `serial-${String(index + 1)}`,
                ),
              ),
              `window-${String(index)}`,
            ),
        ),
      }),
    ],
  ] as const)("rejects %s", (_name, mutate) => {
    const value = catalog(
      snapshot(topology(output("DP-1", "serial-1")), "current", true),
    );
    const document = JSON.stringify(mutate(value));

    expect(decodeLayoutPersistenceCatalog(document)).toEqual({
      error: "invalid-state",
      ok: false,
    });
  });

  it("rejects malformed and unsupported catalog documents before state use", () => {
    const value = catalog(
      snapshot(topology(output("DP-1", "serial-1")), "current"),
    );

    expect(decodeLayoutPersistenceCatalog("{")).toEqual({
      error: "invalid-json",
      ok: false,
    });
    expect(
      decodeLayoutPersistenceCatalog(JSON.stringify({ ...value, version: 3 })),
    ).toEqual({ error: "unsupported-version", ok: false });
    expect(
      decodeLayoutPersistenceCatalog(
        JSON.stringify({ ...value, version: "2" }),
      ),
    ).toEqual({ error: "invalid-state", ok: false });
    expect(
      decodeLayoutPersistenceCatalog(
        " ".repeat(LAYOUT_PERSISTENCE_LIMITS.documentCharacters + 1),
      ),
    ).toEqual({ error: "document-too-large", ok: false });
  });
});

describe("layout persistence catalog merge", () => {
  it("rejects an incomplete current topology", () => {
    const activeState = state(output("DP-1"), "current", true);

    expect(
      mergeLayoutPersistenceCatalog(null, {
        state: activeState,
        topology: null,
      } as unknown as Parameters<typeof mergeLayoutPersistenceCatalog>[1]),
    ).toEqual({ error: "invalid-state", ok: false });
  });

  it("moves the current topology to the front and strips baselines from history", () => {
    const previous = catalog(
      snapshot(topology(output("DP-1", "serial-1")), "previous-active", true),
      snapshot(topology(output("DP-2", "serial-2")), "previous-2"),
      snapshot(topology(output("DP-3", "serial-3")), "previous-3"),
      snapshot(topology(output("DP-4", "serial-4")), "oldest"),
    );
    const current = snapshot(
      topology(output("DP-5", "serial-5")),
      "current",
      true,
    );
    const merged = mergeLayoutPersistenceCatalog(previous, {
      state: current.state,
      topology: required(current.topology ?? undefined),
    });

    expect(merged.ok).toBe(true);

    if (!merged.ok) {
      throw new Error("catalog merge failed");
    }

    expect(merged.value.snapshots).toHaveLength(4);
    expect(
      merged.value.snapshots.map(
        (entry) => entry.topology?.outputs[0]?.serialNumber,
      ),
    ).toEqual(["serial-5", "serial-1", "serial-2", "serial-3"]);
    expect(
      merged.value.snapshots[0]?.state.contexts[0]?.restoreFingerprint,
    ).toBe(CONTEXT_FINGERPRINT);
    expect(merged.value.snapshots[1]?.state.contexts[0]).not.toHaveProperty(
      "restoreFingerprint",
    );
    expect(
      merged.value.snapshots[1]?.state.contexts[0]?.columns[0]?.members[0],
    ).toEqual({
      height: { clientHeight: 420, kind: "fixed" },
      windowKey: "previous-active",
    });
    expect(previous.snapshots[0]?.state.contexts[0]?.restoreFingerprint).toBe(
      CONTEXT_FINGERPRINT,
    );
    expect(decodeLayoutPersistenceCatalog(merged.document)).toEqual({
      ok: true,
      value: merged.value,
    });
  });

  it("deduplicates a known display set across connector renames", () => {
    const previous = catalog(
      snapshot(topology(output("HDMI-A-1", "other")), "active", true),
      snapshot(topology(output("DP-1", "same")), "duplicate"),
      snapshot(topology(output("DP-2", "old")), "old"),
    );
    const current = snapshot(topology(output("DP-9", "same")), "current");
    const merged = mergeLayoutPersistenceCatalog(previous, {
      state: current.state,
      topology: required(current.topology ?? undefined),
    });

    expect(merged).toMatchObject({ ok: true });

    if (!merged.ok) {
      throw new Error("catalog merge failed");
    }

    expect(
      merged.value.snapshots.map(
        (entry) => entry.topology?.outputs[0]?.serialNumber,
      ),
    ).toEqual(["same", "other", "old"]);
  });

  it("deduplicates when a current output gains optional metadata", () => {
    const previousOutput = output("DP-1");
    const currentOutput = { ...previousOutput, manufacturer: "Example" };
    const previous = catalog(
      snapshot(topology(previousOutput), "previous", true),
    );
    const current = snapshot(topology(currentOutput), "current");
    const merged = mergeLayoutPersistenceCatalog(previous, {
      state: current.state,
      topology: required(current.topology ?? undefined),
    });

    expect(merged).toMatchObject({ ok: true });

    if (!merged.ok) {
      throw new Error("catalog merge failed");
    }

    expect(merged.value.snapshots).toEqual([current]);
  });

  it("drops incomplete legacy history on the first complete merge", () => {
    const legacyState = state(output("DP-1"), "legacy", true);
    const decoded = decodeLayoutPersistenceCatalog(
      encodeLayoutPersistence(legacyState),
    );

    if (!decoded.ok) {
      throw new Error("legacy document did not decode");
    }

    const current = snapshot(topology(output("DP-2")), "current", true);
    const merged = mergeLayoutPersistenceCatalog(decoded.value, {
      state: current.state,
      topology: required(current.topology ?? undefined),
    });

    expect(merged).toMatchObject({ ok: true });

    if (!merged.ok) {
      throw new Error("catalog merge failed");
    }

    expect(merged.value.snapshots).toEqual([current]);
  });

  it(
    "evicts the oldest snapshots until the encoded document fits",
    { timeout: 30_000 },
    () => {
      const snapshots = ["one", "two", "three", "four"].map((name) => {
        const persistedTopology = topology(output(`DP-${name}`));
        return {
          state: largeFloatingState(
            required(persistedTopology.outputs[0]),
            name,
            1_400,
            220,
          ),
          topology: persistedTopology,
        } satisfies LayoutPersistenceCatalogSnapshot;
      });
      const previous = catalog(
        required(snapshots[1]),
        required(snapshots[2]),
        required(snapshots[3]),
      );
      const current = required(snapshots[0]);
      const merged = mergeLayoutPersistenceCatalog(previous, {
        state: current.state,
        topology: current.topology,
      });

      expect(merged).toMatchObject({ ok: true });

      if (!merged.ok) {
        throw new Error("catalog merge failed");
      }

      expect(merged.document.length).toBeLessThanOrEqual(
        LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
      );
      expect(
        merged.value.snapshots.map((entry) => entry.topology?.outputs[0]?.name),
      ).toEqual(["DP-one", "DP-two", "DP-three"]);
    },
  );

  it(
    "fails when the current snapshot alone cannot fit",
    { timeout: 30_000 },
    () => {
      const activeOutput = output("out-0");
      const currentState = largeFloatingState(
        activeOutput,
        "current",
        4_096,
        256,
        59,
      );
      const outputs = [
        activeOutput,
        ...Array.from({ length: 31 }, (_unused, index) => {
          const suffix = String(index + 1);
          return {
            key: `out-${suffix}`,
            manufacturer: longIdentifier("manufacturer", index, 256),
            model: longIdentifier("model", index, 256),
            name: `out-${suffix}`,
            serialNumber: longIdentifier("serial", index, 256),
          } satisfies PersistedOutputV1;
        }),
      ];

      expect(encodeLayoutPersistence(currentState).length).toBeLessThanOrEqual(
        LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
      );
      expect(
        mergeLayoutPersistenceCatalog(null, {
          state: currentState,
          topology: topology(...outputs),
        }),
      ).toEqual({ error: "document-too-large", ok: false });
    },
  );
});

describe("layout persistence catalog selection", () => {
  it("selects the most recent complete topology through safe output matching", () => {
    const first = snapshot(
      topology(output("HDMI-A-1", "serial-other")),
      "first",
    );
    const matching = snapshot(
      topology(output("DP-1", "serial-match"), output("DP-2", "serial-empty")),
      "matching",
    );
    const value = catalog(first, matching);

    expect(
      selectLayoutPersistenceSnapshot(
        value,
        topology(
          output("DP-9", "serial-match"),
          output("DP-8", "serial-empty"),
        ),
      ),
    ).toEqual(matching);
    expect(
      selectLayoutPersistenceSnapshot(
        value,
        topology(
          output("DP-9", "serial-match"),
          output("DP-8", "serial-empty"),
          output("DP-7", "additional-empty-output"),
        ),
      ),
    ).toBeNull();
  });
});

function largeFloatingState(
  persistedOutput: PersistedOutputV1,
  prefix: string,
  count: number,
  identifierLength: number,
  tagLength?: number,
): LayoutPersistenceV1 {
  const windows = Array.from({ length: count }, (_unused, index) => {
    const key = longIdentifier(`${prefix}-window`, index, identifierLength);
    const liveId = longIdentifier(`${prefix}-live`, index, identifierLength);
    const tag =
      tagLength === undefined
        ? undefined
        : longIdentifier(`${prefix}-tag`, index, tagLength);

    return {
      key,
      liveId,
      ...(tag === undefined ? {} : { sessionMatch: { tag } }),
    };
  });

  return {
    contexts: [],
    floatingWindows: windows.map((window) => ({
      anchor: {
        columnIndex: 0,
        columnWidth: { kind: "fixed", value: 500 },
        memberIndex: 0,
      },
      desktopId: "desktop-1",
      outputKey: persistedOutput.key,
      windowKey: window.key,
    })),
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: [persistedOutput],
    version: LAYOUT_PERSISTENCE_VERSION,
    windows,
  };
}

function longIdentifier(prefix: string, index: number, length: number): string {
  const suffix = `-${String(index)}`;
  const padding = length - prefix.length - suffix.length;

  if (padding < 0) {
    throw new Error("identifier fixture is too short");
  }

  return `${prefix}${"x".repeat(padding)}${suffix}`;
}
