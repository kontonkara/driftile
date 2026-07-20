import { describe, expect, it } from "vitest";
import { planOverviewDesktopSurfaceLifecycleRefresh } from "../../src/overview/runtime";

const outputA = Object.freeze({ name: "DP-1" });
const outputB = Object.freeze({ name: "HDMI-A-1" });

describe("planOverviewDesktopSurfaceLifecycleRefresh", () => {
  it("targets one exact output, desktop, and activity context", () => {
    const plan = planOverviewDesktopSurfaceLifecycleRefresh(
      input({
        scopes: [
          scope({
            activityIds: ["activity-a"],
            desktopIds: ["desktop-a"],
          }),
        ],
      }),
    );

    expect(plan).toEqual({ revision: 7, targeted: true });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("treats explicit all-desktop and all-activity scopes as exact matches", () => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({
          scopes: [
            scope({
              activityIds: [],
              allActivities: true,
              allDesktops: true,
              desktopIds: [],
            }),
          ],
        }),
      ),
    ).toEqual({ revision: 7, targeted: true });
  });

  it.each([
    [
      "another output identity",
      scope({ output: outputB, outputName: "HDMI-A-1" }),
    ],
    ["another desktop", scope({ desktopIds: ["desktop-b"] })],
    ["another activity", scope({ activityIds: ["activity-b"] })],
  ])("ignores a scope for %s", (_label, candidateScope) => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({ scopes: [candidateScope] }),
      ),
    ).toEqual({ revision: 7, targeted: false });
  });

  it.each([
    ["the output object", scope({ output: outputB })],
    ["the output name", scope({ outputName: "DP-2" })],
  ])(
    "fails a partial collision in %s safe-global",
    (_label, candidateScope) => {
      expect(
        planOverviewDesktopSurfaceLifecycleRefresh(
          input({ scopes: [candidateScope] }),
        ),
      ).toEqual({ revision: 7, targeted: true });
    },
  );

  it("matches any exact scope without stopping validation of the event", () => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({
          scopes: [
            scope({ output: outputB, outputName: "HDMI-A-1" }),
            scope({ desktopIds: ["desktop-b"] }),
            scope(),
          ],
        }),
      ),
    ).toEqual({ revision: 7, targeted: true });
  });

  it("targets every exact context for a valid global event", () => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({ global: true, scopes: [] }),
      ),
    ).toEqual({ revision: 7, targeted: true });
  });

  it("preserves the maximum QML lifecycle revision", () => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({ revision: 2_147_483_647 }),
      ),
    ).toEqual({ revision: 2_147_483_647, targeted: true });
  });

  it.each([
    { global: "yes", scopes: [] },
    { global: true, scopes: [scope()] },
    { global: false, scopes: [] },
    { global: false, scopes: [null] },
    { global: false, scopes: [scope({ output: null })] },
    { global: false, scopes: [scope({ outputName: "" })] },
    { global: false, scopes: [scope({ allDesktops: "yes" })] },
    {
      global: false,
      scopes: [scope({ allDesktops: true, desktopIds: ["desktop-a"] })],
    },
    { global: false, scopes: [scope({ desktopIds: [] })] },
    {
      global: false,
      scopes: [scope({ desktopIds: ["desktop-a", "desktop-a"] })],
    },
    {
      global: false,
      scopes: [scope({ allActivities: true, activityIds: ["activity-a"] })],
    },
    { global: false, scopes: [scope({ activityIds: [] })] },
    {
      global: false,
      scopes: [scope({ activityIds: ["activity-a", "activity-a"] })],
    },
  ])("fails a malformed confirmed event safe-global (%o)", (event) => {
    expect(planOverviewDesktopSurfaceLifecycleRefresh(input(event))).toEqual({
      revision: 7,
      targeted: true,
    });
  });

  it.each([
    null,
    {},
    input({ revision: 0 }),
    input({ revision: 2_147_483_648 }),
    input({ revision: 1.5 }),
    input({}, { output: null }),
    input({}, { outputName: "" }),
    input({}, { desktopId: "" }),
    input({}, { activityId: "" }),
  ])("rejects an invalid context or revision (%o)", (candidate) => {
    expect(planOverviewDesktopSurfaceLifecycleRefresh(candidate)).toBeNull();
  });

  it("bounds scopes and identifiers before matching", () => {
    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({ scopes: Array.from({ length: 65 }, () => scope()) }),
      ),
    ).toEqual({ revision: 7, targeted: true });

    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input({
          scopes: [
            scope({
              desktopIds: Array.from(
                { length: 513 },
                (_value, index) => `desktop-${String(index)}`,
              ),
            }),
          ],
        }),
      ),
    ).toEqual({ revision: 7, targeted: true });

    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(
        input(
          {},
          {
            outputName: "x".repeat(257),
          },
        ),
      ),
    ).toBeNull();
  });

  it("does not mutate event collections", () => {
    const desktopIds = ["desktop-a"];
    const activityIds = ["activity-a"];
    const scopes = [scope({ activityIds, desktopIds })];
    const event = { global: false, revision: 7, scopes };

    expect(planOverviewDesktopSurfaceLifecycleRefresh(input(event))).toEqual({
      revision: 7,
      targeted: true,
    });
    expect(desktopIds).toEqual(["desktop-a"]);
    expect(activityIds).toEqual(["activity-a"]);
    expect(scopes).toHaveLength(1);
  });

  it("fails hostile confirmed event access safe-global", () => {
    const event = Object.defineProperty({ revision: 7 }, "global", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewDesktopSurfaceLifecycleRefresh(input({}, { event })),
    ).toEqual({ revision: 7, targeted: true });
  });
});

function input(
  eventOverrides: Record<string, unknown> = {},
  inputOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    activityId: "activity-a",
    desktopId: "desktop-a",
    event: {
      global: false,
      revision: 7,
      scopes: [scope()],
      ...eventOverrides,
    },
    output: outputA,
    outputName: "DP-1",
    ...inputOverrides,
  };
}

function scope(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    activityIds: ["activity-a"],
    allActivities: false,
    allDesktops: false,
    desktopIds: ["desktop-a"],
    output: outputA,
    outputName: "DP-1",
    ...overrides,
  };
}
