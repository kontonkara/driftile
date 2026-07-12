import { describe, expect, it } from "vitest";
import {
  LAYOUT_PERSISTENCE_CATALOG_VERSION,
  decodeLayoutPersistenceCatalog,
  encodeLayoutPersistenceCatalog,
  type LayoutPersistenceCatalogSnapshot,
  type LayoutPersistenceCatalogV2,
  type LayoutPersistenceTopologyV2,
} from "../src/core/layout-persistence-catalog";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LIMITS,
  LAYOUT_PERSISTENCE_VERSION,
  decodeLayoutPersistence,
  encodeLayoutPersistence,
  type LayoutPersistenceV1,
  type PersistedOutputV1,
} from "../src/core/layout-persistence";
import type { KWinOutput } from "../src/platform/kwin/api";
import { layoutPersistenceOutputDescriptor } from "../src/platform/kwin/persistence-descriptors";
import { createRuntimeLayoutPersistence } from "../src/runtime-persistence";

interface MutableWorkspace {
  readonly screens: readonly KWinOutput[];
  setScreens(screens: readonly KWinOutput[]): void;
}

function output(
  name: string,
  serialNumber?: string,
  metadata: Partial<KWinOutput> = {},
): KWinOutput {
  return {
    devicePixelRatio: 1,
    geometry: { height: 1080, width: 1920, x: 0, y: 0 },
    manufacturer: "Example",
    model: "Panel",
    name,
    ...(serialNumber === undefined ? {} : { serialNumber }),
    ...metadata,
  };
}

function persistedOutput(source: KWinOutput): PersistedOutputV1 {
  const descriptor = layoutPersistenceOutputDescriptor(source);

  return { key: descriptor.name, ...descriptor };
}

function topology(
  ...outputs: readonly PersistedOutputV1[]
): LayoutPersistenceTopologyV2 {
  return { outputs };
}

function state(...outputs: readonly PersistedOutputV1[]): LayoutPersistenceV1 {
  const windows = outputs.map((persistedOutput, index) => ({
    key: `window-${String(index)}`,
    liveId: `live-window-${String(index)}`,
  }));

  return {
    contexts: [],
    floatingWindows: outputs.map((persistedOutput, index) => ({
      anchor: {
        columnIndex: 0,
        columnWidth: { kind: "fixed", value: 800 },
        memberIndex: 0,
      },
      desktopId: "desktop-1",
      outputKey: persistedOutput.key,
      windowKey: `window-${String(index)}`,
    })),
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs,
    version: LAYOUT_PERSISTENCE_VERSION,
    windows,
  };
}

function snapshot(
  persistedTopology: LayoutPersistenceTopologyV2,
  persistedState: LayoutPersistenceV1,
): LayoutPersistenceCatalogSnapshot {
  return { state: persistedState, topology: persistedTopology };
}

function catalogDocument(
  ...snapshots: readonly LayoutPersistenceCatalogSnapshot[]
): string {
  const value: LayoutPersistenceCatalogV2 = {
    format: LAYOUT_PERSISTENCE_FORMAT,
    snapshots,
    version: LAYOUT_PERSISTENCE_CATALOG_VERSION,
  };

  return encodeLayoutPersistenceCatalog(value);
}

function mutableWorkspace(
  initialScreens: readonly KWinOutput[],
): MutableWorkspace {
  let screens = initialScreens;

  return {
    get screens() {
      return screens;
    },
    setScreens(nextScreens): void {
      screens = nextScreens;
    },
  };
}

function decodedCatalog(document: string): LayoutPersistenceCatalogV2 {
  const decoded = decodeLayoutPersistenceCatalog(document);

  if (!decoded.ok) {
    throw new Error(`catalog did not decode: ${decoded.error}`);
  }

  return decoded.value;
}

describe("runtime layout persistence bridge", () => {
  it("starts empty and publishes a complete v2 topology including unused outputs", () => {
    const active = output("DP-1", "serial-active");
    const empty = output("HDMI-A-1", "serial-empty");
    const workspace = mutableWorkspace([active, empty]);
    const published: string[] = [];
    const persistence = createRuntimeLayoutPersistence(
      workspace,
      "",
      (document) => {
        published.push(document);
      },
    );

    expect(persistence.initialState).toBe("");
    persistence.onStateChanged?.(
      encodeLayoutPersistence(state(persistedOutput(active))),
    );

    expect(published).toHaveLength(1);
    const decoded = decodedCatalog(published[0] ?? "");
    expect(decoded.snapshots[0]?.topology?.outputs).toEqual([
      persistedOutput(active),
      persistedOutput(empty),
    ]);
    expect(decoded.snapshots[0]?.state).toEqual(state(persistedOutput(active)));
  });

  it("selects and canonicalizes a valid bare v1 document", () => {
    const active = output("DP-1", "serial-active");
    const legacy = state(persistedOutput(active));
    const document = JSON.stringify(legacy);
    const persistence = createRuntimeLayoutPersistence(
      mutableWorkspace([active]),
      document,
      undefined,
    );

    expect(persistence.initialState).toBe(encodeLayoutPersistence(legacy));
    expect(persistence.stateForCurrentTopology()).toBe(
      encodeLayoutPersistence(legacy),
    );
    expect(persistence.onStateChanged).toBeUndefined();
  });

  it("selects a complete v2 snapshot by the full live output topology", () => {
    const other = output("DP-3", "serial-other");
    const active = output("DP-1", "serial-active");
    const empty = output("HDMI-A-1", "serial-empty");
    const activeDescriptor = persistedOutput(active);
    const emptyDescriptor = persistedOutput(empty);
    const matchingState = state(activeDescriptor);
    const document = catalogDocument(
      snapshot(topology(persistedOutput(other)), state(persistedOutput(other))),
      snapshot(topology(activeDescriptor, emptyDescriptor), matchingState),
    );
    const renamedActive = output("DP-9", "serial-active");
    const renamedEmpty = output("DP-8", "serial-empty");
    const persistence = createRuntimeLayoutPersistence(
      mutableWorkspace([renamedEmpty, renamedActive]),
      document,
      undefined,
    );

    expect(persistence.initialState).toBe(
      encodeLayoutPersistence(matchingState),
    );
  });

  it("reselects a v2 snapshot against the current topology on demand", () => {
    const first = output("DP-1", "serial-first");
    const second = output("DP-2", "serial-second");
    const firstDescriptor = persistedOutput(first);
    const secondDescriptor = persistedOutput(second);
    const firstState = state(firstDescriptor);
    const secondState = state(secondDescriptor);
    const workspace = mutableWorkspace([first]);
    const persistence = createRuntimeLayoutPersistence(
      workspace,
      catalogDocument(
        snapshot(topology(firstDescriptor), firstState),
        snapshot(topology(secondDescriptor), secondState),
      ),
      undefined,
    );

    expect(persistence.initialState).toBe(encodeLayoutPersistence(firstState));

    workspace.setScreens([second]);
    expect(persistence.stateForCurrentTopology()).toBe(
      encodeLayoutPersistence(secondState),
    );
    expect(persistence.initialState).toBe(encodeLayoutPersistence(firstState));

    workspace.setScreens([output("DP-3", "serial-unknown")]);
    expect(persistence.stateForCurrentTopology()).toBe("");
  });

  it("keeps a canonical bare v1 state available after topology changes", () => {
    const first = output("DP-1", "serial-first");
    const legacy = state(persistedOutput(first));
    const workspace = mutableWorkspace([first]);
    const persistence = createRuntimeLayoutPersistence(
      workspace,
      JSON.stringify(legacy),
      undefined,
    );

    workspace.setScreens([output("DP-2", "serial-second")]);

    expect(persistence.stateForCurrentTopology()).toBe(
      encodeLayoutPersistence(legacy),
    );
  });

  it("starts without layout state when an empty output makes v2 topology incomplete", () => {
    const active = output("DP-1", "serial-active");
    const empty = output("HDMI-A-1", "serial-empty");
    const activeDescriptor = persistedOutput(active);
    const document = catalogDocument(
      snapshot(
        topology(activeDescriptor, persistedOutput(empty)),
        state(activeDescriptor),
      ),
    );
    const persistence = createRuntimeLayoutPersistence(
      mutableWorkspace([active]),
      document,
      undefined,
    );

    expect(persistence.initialState).toBe("");
  });

  it("merges publications with the latest topology and sanitizes metadata", () => {
    const active = output("DP-1", "serial-active");
    const historical = output("DP-2", "serial-historical");
    const loadedDocument = catalogDocument(
      snapshot(
        topology(persistedOutput(historical)),
        state(persistedOutput(historical)),
      ),
    );
    const unsafe = output("DP-3", undefined, {
      manufacturer: "unsafe\u0000manufacturer",
      model: "m".repeat(LAYOUT_PERSISTENCE_LIMITS.identifierCharacters + 1),
      serialNumber: "safe-serial",
    });
    const workspace = mutableWorkspace([active]);
    const published: string[] = [];
    const persistence = createRuntimeLayoutPersistence(
      workspace,
      loadedDocument,
      (document) => {
        published.push(document);
      },
    );

    workspace.setScreens([unsafe]);
    persistence.onStateChanged?.(
      encodeLayoutPersistence(state(persistedOutput(unsafe))),
    );

    const decoded = decodedCatalog(published[0] ?? "");
    expect(decoded.snapshots).toHaveLength(2);
    expect(decoded.snapshots[0]?.topology?.outputs).toEqual([
      {
        key: "DP-3",
        name: "DP-3",
        serialNumber: "safe-serial",
      },
    ]);
    expect(decoded.snapshots[1]?.topology?.outputs).toEqual([
      persistedOutput(historical),
    ]);
  });

  it("keeps the prior MRU unchanged when the downstream callback fails", () => {
    const legacyOutput = output("DP-legacy", "serial-legacy");
    const first = output("DP-1", "serial-first");
    const second = output("DP-2", "serial-second");
    const workspace = mutableWorkspace([first]);
    const attempts: string[] = [];
    let fail = true;
    const persistence = createRuntimeLayoutPersistence(
      workspace,
      encodeLayoutPersistence(state(persistedOutput(legacyOutput))),
      (document) => {
        attempts.push(document);

        if (fail) {
          throw new Error("temporary write failure");
        }
      },
    );

    expect(() =>
      persistence.onStateChanged?.(
        encodeLayoutPersistence(state(persistedOutput(first))),
      ),
    ).toThrow("temporary write failure");
    expect(persistence.snapshots()).toEqual([
      {
        state: state(persistedOutput(legacyOutput)),
        topology: null,
      },
    ]);

    fail = false;
    workspace.setScreens([second]);
    persistence.onStateChanged?.(
      encodeLayoutPersistence(state(persistedOutput(second))),
    );

    expect(attempts).toHaveLength(2);
    const decoded = decodedCatalog(attempts[1] ?? "");
    expect(decoded.snapshots).toHaveLength(1);
    expect(decoded.snapshots[0]?.topology?.outputs).toEqual([
      persistedOutput(second),
    ]);
    expect(persistence.snapshots()).toEqual(decoded.snapshots);
  });

  it("maps a malformed current v2 document to recoverable controller policy", () => {
    const malformed = JSON.stringify({
      format: LAYOUT_PERSISTENCE_FORMAT,
      snapshots: [],
      unexpected: true,
      version: LAYOUT_PERSISTENCE_CATALOG_VERSION,
    });
    const published: string[] = [];
    const active = output("DP-1", "serial-active");
    const persistence = createRuntimeLayoutPersistence(
      mutableWorkspace([active]),
      malformed,
      (document) => {
        published.push(document);
      },
    );

    expect(persistence.initialState).not.toBe(malformed);
    expect(decodeLayoutPersistence(persistence.initialState)).toEqual({
      error: "invalid-state",
      ok: false,
    });
    expect(persistence.stateForCurrentTopology()).toBe(
      persistence.initialState,
    );
    expect(published).toEqual([]);

    persistence.onStateChanged?.(
      encodeLayoutPersistence(state(persistedOutput(active))),
    );

    expect(published).toHaveLength(1);
    expect(decodedCatalog(published[0] ?? "").snapshots[0]?.state).toEqual(
      state(persistedOutput(active)),
    );
  });

  it.each([
    ["invalid json", "{"],
    [
      "invalid v1",
      JSON.stringify({
        format: LAYOUT_PERSISTENCE_FORMAT,
        version: LAYOUT_PERSISTENCE_VERSION,
      }),
    ],
    [
      "future",
      JSON.stringify({ format: LAYOUT_PERSISTENCE_FORMAT, version: 3 }),
    ],
    ["oversize", " ".repeat(LAYOUT_PERSISTENCE_LIMITS.documentCharacters + 1)],
  ])(
    "passes a %s loaded document through for controller policy",
    (_name, document) => {
      const persistence = createRuntimeLayoutPersistence(
        mutableWorkspace([output("DP-1")]),
        document,
        undefined,
      );

      expect(persistence.initialState).toBe(document);
      expect(persistence.stateForCurrentTopology()).toBe(document);
    },
  );
});
