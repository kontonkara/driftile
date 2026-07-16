import { describe, expect, it } from "vitest";

import { activityId, desktopId, outputId } from "../src/core/ids";
import {
  PointerPreviewContextCache,
  type PointerPreviewContextKey,
} from "../src/pointer-preview-context";

function contextKey(
  overrides: Partial<PointerPreviewContextKey> = {},
): PointerPreviewContextKey {
  return {
    activityId: activityId("activity-1"),
    desktopId: desktopId("desktop-1"),
    gap: 10,
    geometryFingerprint: "geometry-1",
    outputId: outputId("DP-1"),
    topologyRevision: 1,
    ...overrides,
  };
}

describe("PointerPreviewContextCache", () => {
  it("reuses one immutable lease for an unchanged destination key", () => {
    const cache = new PointerPreviewContextCache<{ readonly target: string }>();
    let computations = 0;
    const first = cache.acquire(contextKey(), () => {
      computations += 1;
      return Object.freeze({ target: "window-1" });
    });
    const second = cache.acquire(contextKey(), () => {
      computations += 1;
      return Object.freeze({ target: "window-2" });
    });

    expect(second).toBe(first);
    expect(second.preview).toEqual({ target: "window-1" });
    expect(computations).toBe(1);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.key)).toBe(true);
    expect(cache.owns(second)).toBe(true);
  });

  it.each([
    ["output", { outputId: outputId("HDMI-A-1") }],
    ["desktop", { desktopId: desktopId("desktop-2") }],
    ["activity", { activityId: activityId("activity-2") }],
    ["topology revision", { topologyRevision: 2 }],
    ["geometry fingerprint", { geometryFingerprint: "geometry-2" }],
    ["gap", { gap: 11 }],
  ] satisfies ReadonlyArray<
    readonly [string, Partial<PointerPreviewContextKey>]
  >)("invalidates when the %s changes", (_name, overrides) => {
    const cache = new PointerPreviewContextCache<number>();
    let computations = 0;
    const first = cache.acquire(contextKey(), () => {
      computations += 1;
      return computations;
    });
    const second = cache.acquire(contextKey(overrides), () => {
      computations += 1;
      return computations;
    });

    expect(second).not.toBe(first);
    expect(second.preview).toBe(2);
    expect(computations).toBe(2);
    expect(cache.owns(first)).toBe(false);
    expect(cache.owns(second)).toBe(true);
  });

  it("snapshots the destination key before computing a preview", () => {
    const cache = new PointerPreviewContextCache<string>();
    const mutableKey = contextKey() as {
      -readonly [
        TKey in keyof PointerPreviewContextKey
      ]: PointerPreviewContextKey[TKey];
    };
    const lease = cache.acquire(mutableKey, () => {
      mutableKey.geometryFingerprint = "mutated-during-compute";
      return "preview";
    });

    expect(lease.key.geometryFingerprint).toBe("geometry-1");
    expect(cache.acquire(contextKey(), () => "replacement")).toBe(lease);
  });

  it("does not let a stale owner release a newer lease", () => {
    const cache = new PointerPreviewContextCache<string>();
    const first = cache.acquire(contextKey(), () => "first");
    const second = cache.acquire(
      contextKey({ geometryFingerprint: "geometry-2" }),
      () => "second",
    );

    expect(cache.release(first)).toBe(false);
    expect(cache.owns(second)).toBe(true);
    expect(cache.release(second)).toBe(true);
    expect(cache.owns(second)).toBe(false);
    expect(cache.clear()).toBe(false);
  });

  it("drops the stale lease before a replacement computation fails", () => {
    const cache = new PointerPreviewContextCache<string>();
    const first = cache.acquire(contextKey(), () => "first");

    expect(() =>
      cache.acquire(contextKey({ geometryFingerprint: "geometry-2" }), () => {
        throw new Error("preview failed");
      }),
    ).toThrow("preview failed");
    expect(cache.owns(first)).toBe(false);

    const replacement = cache.acquire(contextKey(), () => "replacement");
    expect(replacement).not.toBe(first);
    expect(replacement.preview).toBe("replacement");
    expect(cache.clear()).toBe(true);
    expect(cache.clear()).toBe(false);
  });
});
