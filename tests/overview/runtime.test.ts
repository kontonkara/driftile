import { describe, expect, it } from "vitest";
import { loadOverviewModel } from "../../src/overview/runtime";

const emptyCatalog = `${JSON.stringify({
  format: "driftile-layout",
  snapshots: [
    {
      state: {
        contexts: [],
        floatingWindows: [],
        format: "driftile-layout",
        outputs: [],
        version: 1,
        windows: [],
      },
      topology: { outputs: [] },
    },
  ],
  version: 2,
})}\n`;

describe("loadOverviewModel", () => {
  it("projects a valid plain live snapshot", () => {
    expect(
      loadOverviewModel(emptyCatalog, {
        desktopIds: [],
        outputs: [],
        windowIds: [],
      }),
    ).toEqual({
      ok: true,
      value: {
        contexts: [],
        desktopIds: [],
        floatingWindows: [],
        outputs: [],
      },
    });
  });

  it("rejects missing state and malformed live snapshots", () => {
    expect(loadOverviewModel(undefined, {})).toEqual({
      error: "missing-state",
      ok: false,
    });
    expect(loadOverviewModel(emptyCatalog, {})).toEqual({
      error: "invalid-live-layout",
      ok: false,
    });
  });

  it("fails closed when a live snapshot accessor throws", () => {
    const live = Object.defineProperty({}, "desktopIds", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(loadOverviewModel(emptyCatalog, live)).toEqual({
      error: "invalid-live-layout",
      ok: false,
    });
  });
});
