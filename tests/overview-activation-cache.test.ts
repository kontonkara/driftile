import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../src/core/layout-persistence";
import {
  createOverviewActivationCache,
  type DeepReadonly,
  type OverviewActivationCacheLookupResult,
} from "../src/overview/activation-cache";

interface TestOverviewModel {
  contexts: { members: string[]; viewportOffset: number }[];
  currentActivityId: string;
  desktopIds: string[];
  outputs: { name: string }[];
}

describe("createOverviewActivationCache", () => {
  it("checks the exact raw document before live snapshot construction", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();

    expect(cache.hasExactDocument("raw-layout")).toBe(false);
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));
    expect(cache.hasExactDocument("raw-layout")).toBe(true);

    expect(cache.hasExactDocument("changed-layout")).toBe(false);
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("detaches and deeply freezes one validated model", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    const model = testModel();
    const stored = requireHit(cache.store("raw-layout", liveSnapshot(), model));

    model.contexts[0]?.members.push("mutated-after-store");
    const firstOutput = model.outputs[0];
    if (firstOutput === undefined) {
      throw new Error("expected a test output");
    }
    firstOutput.name = "mutated-output";

    const reused = requireHit(cache.lookup("raw-layout", liveSnapshot()));
    expect(reused).toEqual(testModel());
    expect(stored).toEqual(testModel());
    expect(Object.isFrozen(reused)).toBe(true);
    expect(Object.isFrozen(reused.contexts)).toBe(true);
    expect(Object.isFrozen(reused.contexts[0])).toBe(true);
    expect(Object.isFrozen(reused.contexts[0]?.members)).toBe(true);
    expect(Object.isFrozen(reused.outputs)).toBe(true);
    expect(Object.isFrozen(reused.outputs[0])).toBe(true);
  });

  it("returns a fresh top-level model and result wrapper for every session", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    const storedResult = cache.store("raw-layout", liveSnapshot(), testModel());
    const firstResult = cache.lookup("raw-layout", liveSnapshot());
    const secondResult = cache.lookup("raw-layout", liveSnapshot());
    const stored = requireHit(storedResult);
    const first = requireHit(firstResult);
    const second = requireHit(secondResult);

    expect(storedResult).not.toBe(firstResult);
    expect(firstResult).not.toBe(secondResult);
    expect(stored).not.toBe(first);
    expect(first).not.toBe(second);
    expect(stored.contexts).toBe(first.contexts);
    expect(first.contexts).toBe(second.contexts);
    expect(Object.isFrozen(storedResult)).toBe(true);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(Object.isFrozen(secondResult)).toBe(true);
  });

  it("canonicalizes unordered projection inputs and ignores unrelated fields", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

    const reordered = liveSnapshot({
      activityIds: ["activity-b", "activity-a"],
      desktopIds: ["desktop-b", "desktop-a"],
      ignoredRuntimeRevision: 99,
      outputs: [
        {
          ignoredGeometry: { height: 1440, width: 2560 },
          manufacturer: "Vendor B",
          model: "Panel B",
          name: "HDMI-A-1",
          serialNumber: "serial-b",
        },
        {
          serialNumber: "serial-a",
          name: "DP-1",
          model: "Panel A",
          manufacturer: "Vendor A",
        },
      ],
      windowHeightBounds: [
        {
          maximumClientHeight: 900,
          minimumClientHeight: 100,
          decorationHeight: 32,
          windowId: "window-b",
        },
        {
          maximumClientHeight: Number.POSITIVE_INFINITY,
          minimumClientHeight: 0,
          decorationHeight: 32,
          windowId: "window-a",
        },
      ],
      windowIds: ["window-b", "window-a"],
    });

    expect(cache.lookup("raw-layout", reordered).ok).toBe(true);
  });

  it("treats omitted and empty live height bounds as one projection", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(
      cache.store(
        "raw-layout",
        liveSnapshot({ windowHeightBounds: undefined }),
        testModel(),
      ),
    );

    expect(
      cache.lookup("raw-layout", liveSnapshot({ windowHeightBounds: [] })).ok,
    ).toBe(true);
  });

  it.each([
    ["the current activity", liveSnapshot({ currentActivityId: "activity-b" })],
    [
      "the activity set",
      liveSnapshot({ activityIds: ["activity-a", "activity-c"] }),
    ],
    [
      "the desktop set",
      liveSnapshot({ desktopIds: ["desktop-a", "desktop-c"] }),
    ],
    [
      "an output descriptor",
      liveSnapshot({
        outputs: [
          output("DP-1", { model: "Replacement Panel" }),
          output("HDMI-A-1", {
            manufacturer: "Vendor B",
            model: "Panel B",
            serialNumber: "serial-b",
          }),
        ],
      }),
    ],
    [
      "the window set",
      liveSnapshot({
        windowIds: ["window-a", "window-b", "window-c"],
      }),
    ],
    [
      "a window height bound",
      liveSnapshot({
        windowHeightBounds: [
          heightBound("window-a", { decorationHeight: 33 }),
          heightBound("window-b", {
            maximumClientHeight: 900,
            minimumClientHeight: 100,
          }),
        ],
      }),
    ],
  ])("misses when %s changes", (_label, changedLiveSnapshot) => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

    expect(cache.lookup("raw-layout", changedLiveSnapshot)).toEqual({
      ok: false,
      reason: "changed-live-snapshot",
    });
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("invalidates the entry when the exact raw document changes", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

    expect(cache.lookup("raw-layout\n", liveSnapshot())).toEqual({
      ok: false,
      reason: "changed-document",
    });
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("never returns a stale entry for malformed live data", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

    expect(
      cache.lookup(
        "raw-layout",
        liveSnapshot({ windowIds: ["window-a", "window-a"] }),
      ),
    ).toEqual({ ok: false, reason: "invalid-live-snapshot" });
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("fails hostile live access closed and clears the previous entry", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));
    const hostile = Object.defineProperty(liveSnapshot(), "outputs", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(cache.lookup("raw-layout", hostile)).toEqual({
      ok: false,
      reason: "invalid-live-snapshot",
    });
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it.each([
    null,
    "",
    "x".repeat(LAYOUT_PERSISTENCE_LIMITS.documentCharacters + 1),
  ])(
    "rejects an invalid raw document without retaining a model (%o)",
    (raw) => {
      const cache = createOverviewActivationCache<TestOverviewModel>();
      requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

      expect(cache.lookup(raw, liveSnapshot())).toEqual({
        ok: false,
        reason: "invalid-document",
      });
      expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
        ok: false,
        reason: "empty",
      });
    },
  );

  it("rejects a cyclic model and does not preserve an older cache entry", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(
      cache.store(
        "replacement-layout",
        liveSnapshot(),
        cyclic as unknown as TestOverviewModel,
      ),
    ).toEqual({ ok: false, reason: "invalid-model" });
    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("clears the one-entry cache explicitly", () => {
    const cache = createOverviewActivationCache<TestOverviewModel>();
    requireHit(cache.store("raw-layout", liveSnapshot(), testModel()));

    cache.clear();

    expect(cache.lookup("raw-layout", liveSnapshot())).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

function requireHit<Model extends object>(
  result: OverviewActivationCacheLookupResult<Model>,
): DeepReadonly<Model> {
  if (!result.ok) {
    throw new Error(`expected cache hit, received ${result.reason}`);
  }
  return result.value;
}

function testModel(): TestOverviewModel {
  return {
    contexts: [{ members: ["window-a", "window-b"], viewportOffset: 16 }],
    currentActivityId: "activity-a",
    desktopIds: ["desktop-a", "desktop-b"],
    outputs: [{ name: "DP-1" }, { name: "HDMI-A-1" }],
  };
}

function liveSnapshot(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    activityIds: ["activity-a", "activity-b"],
    currentActivityId: "activity-a",
    desktopIds: ["desktop-a", "desktop-b"],
    outputs: [
      output("DP-1"),
      output("HDMI-A-1", {
        manufacturer: "Vendor B",
        model: "Panel B",
        serialNumber: "serial-b",
      }),
    ],
    windowHeightBounds: [
      heightBound("window-a"),
      heightBound("window-b", {
        maximumClientHeight: 900,
        minimumClientHeight: 100,
      }),
    ],
    windowIds: ["window-a", "window-b"],
    ...overrides,
  };
}

function output(
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    manufacturer: "Vendor A",
    model: "Panel A",
    name,
    serialNumber: "serial-a",
    ...overrides,
  };
}

function heightBound(
  windowId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    decorationHeight: 32,
    maximumClientHeight: Number.POSITIVE_INFINITY,
    minimumClientHeight: 0,
    windowId,
    ...overrides,
  };
}
