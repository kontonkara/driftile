import { describe, expect, it } from "vitest";
import {
  matchPersistedOutputs,
  matchPersistedWindows,
  type LiveOutputPersistenceDescriptor,
  type LiveWindowPersistenceDescriptor,
} from "../../src/core/layout-persistence-match";
import type {
  PersistedOutputV1,
  PersistedWindowMatchV1,
  PersistedWindowV1,
} from "../../src/core/layout-persistence";

function persistedWindow(
  key: string,
  liveId: string,
  sessionMatch?: PersistedWindowMatchV1,
): PersistedWindowV1 {
  return {
    key,
    liveId,
    ...(sessionMatch === undefined ? {} : { sessionMatch }),
  };
}

describe("persisted window matching", () => {
  it("reserves unique live ids before matching session descriptors", () => {
    const persisted = [
      persistedWindow("exact", "live-exact", {
        desktopFileName: "org.example.Editor",
      }),
      persistedWindow("restored", "stale-restored", {
        desktopFileName: "org.example.Editor",
        tag: "secondary",
      }),
    ];
    const live: LiveWindowPersistenceDescriptor[] = [
      {
        desktopFileName: "org.example.Editor",
        liveId: "live-exact",
        tag: "primary",
      },
      {
        desktopFileName: "org.example.Editor",
        liveId: "live-restored",
        tag: "secondary",
      },
    ];

    expect(matchPersistedWindows(persisted, live)).toEqual({
      matches: [
        {
          basis: "live-id",
          liveId: "live-exact",
          persistedKey: "exact",
        },
        {
          basis: "session",
          liveId: "live-restored",
          persistedKey: "restored",
        },
      ],
      unmatchedLiveIds: [],
      unmatchedPersistedKeys: [],
    });
  });

  it.each([
    ["desktopFileName", "org.example.Editor"],
    ["resourceClass", "example-editor"],
    ["resourceName", "editor-main"],
    ["tag", "primary-document"],
    ["windowRole", "main"],
  ] as const)("matches the %s session field exactly", (field, value) => {
    const sessionMatch: PersistedWindowMatchV1 = { [field]: value };
    const live: LiveWindowPersistenceDescriptor[] = [
      { [field]: `${value}-other`, liveId: "other" },
      { [field]: value, liveId: "restored" },
    ];

    expect(
      matchPersistedWindows(
        [persistedWindow("persisted", "stale", sessionMatch)],
        live,
      ).matches,
    ).toEqual([
      {
        basis: "session",
        liveId: "restored",
        persistedKey: "persisted",
      },
    ]);
  });

  it("leaves overlapping global matches unresolved", () => {
    const persisted = [
      persistedWindow("broad", "stale-broad", {
        desktopFileName: "org.example.Editor",
      }),
      persistedWindow("specific", "stale-specific", {
        desktopFileName: "org.example.Editor",
        tag: "primary",
      }),
    ];
    const live: LiveWindowPersistenceDescriptor[] = [
      {
        desktopFileName: "org.example.Editor",
        liveId: "live-primary",
        tag: "primary",
      },
      {
        desktopFileName: "org.example.Editor",
        liveId: "live-secondary",
        tag: "secondary",
      },
    ];

    expect(matchPersistedWindows(persisted, live)).toEqual({
      matches: [],
      unmatchedLiveIds: ["live-primary", "live-secondary"],
      unmatchedPersistedKeys: ["broad", "specific"],
    });
  });

  it("does not resolve duplicate live identities through metadata", () => {
    const persisted = [
      persistedWindow("persisted", "duplicate", { tag: "primary" }),
    ];
    const live: LiveWindowPersistenceDescriptor[] = [
      { liveId: "duplicate", tag: "primary" },
      { liveId: "duplicate", tag: "secondary" },
    ];

    expect(matchPersistedWindows(persisted, live)).toEqual({
      matches: [],
      unmatchedLiveIds: ["duplicate", "duplicate"],
      unmatchedPersistedKeys: ["persisted"],
    });
  });

  it("returns the same ordered result for every input order", () => {
    const persisted = [
      persistedWindow("window-b", "stale-b", { tag: "tag-b" }),
      persistedWindow("window-a", "stale-a", { tag: "tag-a" }),
      persistedWindow("window-c", "stale-c", { tag: "missing" }),
    ];
    const live: LiveWindowPersistenceDescriptor[] = [
      { liveId: "live-b", tag: "tag-b" },
      { liveId: "live-extra", tag: "extra" },
      { liveId: "live-a", tag: "tag-a" },
    ];
    const expected = matchPersistedWindows(persisted, live);

    expect(
      matchPersistedWindows([...persisted].reverse(), [...live].reverse()),
    ).toEqual(expected);
    expect(expected).toEqual({
      matches: [
        {
          basis: "session",
          liveId: "live-a",
          persistedKey: "window-a",
        },
        {
          basis: "session",
          liveId: "live-b",
          persistedKey: "window-b",
        },
      ],
      unmatchedLiveIds: ["live-extra"],
      unmatchedPersistedKeys: ["window-c"],
    });
  });

  it("handles the full persisted window limit without pairwise scanning", () => {
    const count = 4_096;
    const persisted = Array.from({ length: count }, (_value, index) =>
      persistedWindow(`key-${String(index)}`, `stale-${String(index)}`, {
        tag: `tag-${String(index)}`,
      }),
    );
    const live = Array.from({ length: count }, (_value, index) => ({
      liveId: `live-${String(index)}`,
      tag: `tag-${String(index)}`,
    }));

    const result = matchPersistedWindows(persisted, live);

    expect(result.matches).toHaveLength(count);
    expect(result.unmatchedLiveIds).toEqual([]);
    expect(result.unmatchedPersistedKeys).toEqual([]);
  });
});

describe("persisted output matching", () => {
  it("uses stable serial metadata before exact connector metadata", () => {
    const persisted: PersistedOutputV1[] = [
      { key: "schema-output", name: "DP-1" },
      {
        key: "old-serial",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-2",
        serialNumber: "serial-1",
      },
      {
        key: "old-connector",
        manufacturer: "Other",
        model: "Display",
        name: "HDMI-A-1",
      },
    ];
    const live: LiveOutputPersistenceDescriptor[] = [
      { liveId: "DP-1", name: "DP-1" },
      {
        liveId: "current-serial",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-9",
        serialNumber: "serial-1",
      },
      {
        liveId: "current-connector",
        manufacturer: "Other",
        model: "Display",
        name: "HDMI-A-1",
      },
    ];

    expect(matchPersistedOutputs(persisted, live)).toEqual({
      matches: [
        {
          basis: "descriptor",
          liveId: "current-connector",
          persistedKey: "old-connector",
        },
        {
          basis: "descriptor",
          liveId: "current-serial",
          persistedKey: "old-serial",
        },
        {
          basis: "descriptor",
          liveId: "DP-1",
          persistedKey: "schema-output",
        },
      ],
      unmatchedLiveIds: [],
      unmatchedPersistedKeys: [],
    });
  });

  it("leaves duplicate display descriptors unmatched", () => {
    const persisted: PersistedOutputV1[] = [
      {
        key: "old",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-1",
        serialNumber: "serial-1",
      },
    ];
    const live: LiveOutputPersistenceDescriptor[] = [
      {
        liveId: "live-a",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-1",
        serialNumber: "serial-1",
      },
      {
        liveId: "live-b",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-2",
        serialNumber: "serial-1",
      },
    ];

    expect(matchPersistedOutputs(persisted, live)).toEqual({
      matches: [],
      unmatchedLiveIds: ["live-a", "live-b"],
      unmatchedPersistedKeys: ["old"],
    });
  });

  it("does not reuse a connector name when stable metadata conflicts", () => {
    const persisted: PersistedOutputV1[] = [
      {
        key: "old",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-1",
        serialNumber: "serial-old",
      },
    ];
    const live: LiveOutputPersistenceDescriptor[] = [
      {
        liveId: "DP-1",
        manufacturer: "Example",
        model: "Panel",
        name: "DP-1",
        serialNumber: "serial-new",
      },
    ];

    expect(matchPersistedOutputs(persisted, live)).toEqual({
      matches: [],
      unmatchedLiveIds: ["DP-1"],
      unmatchedPersistedKeys: ["old"],
    });
  });
});
