import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { fingerprintOverviewSpatialDropBasis } from "../src/overview/spatial-drop-basis";

const geometryFingerprint =
  "1\u00000\u00000\u00001920\u00001080\u00000\u000030\u00001920\u00001050";

function model() {
  return {
    contexts: [
      {
        activeColumnIndex: 0,
        activityId: "activity-α",
        columns: [
          {
            fullWidthRestore: { kind: "fixed", value: 640 },
            members: [
              {
                height: { kind: "auto", weight: 1 },
                heightBounds: {
                  decorationHeight: 30,
                  maximumClientHeight: Number.POSITIVE_INFINITY,
                  minimumClientHeight: 80,
                },
                windowId: "window-😀",
              },
            ],
            presentation: "stacked",
            selectedMemberIndex: 0,
            width: { kind: "proportion", value: 0.5 },
          },
        ],
        desktopId: "desktop-1",
        outputId: "DP-1",
        viewportOffset: 12,
      },
    ],
    currentActivityId: "activity-α",
    desktopIds: ["desktop-1"],
    floatingWindows: [],
    outputs: [{ name: "DP-1", outputId: "DP-1" }],
  } as const;
}

function basis() {
  return {
    alwaysCenterSingleColumn: true,
    contextGeometries: [
      {
        activityId: "activity-α",
        desktopId: "desktop-1",
        fingerprint: geometryFingerprint,
        outputId: "DP-1",
      },
    ],
    gap: 16,
    model: model(),
    source: {
      activityId: "activity-α",
      desktopId: "desktop-1",
      outputId: "DP-1",
      scope: "window",
      windowId: "window-😀",
    },
    target: {
      activityId: "activity-α",
      desktopId: "desktop-1",
      kind: "column-boundary",
      outputId: "DP-1",
      position: "after",
      targetWindowId: "window-target",
    },
  } as const;
}

describe("overview spatial drop basis", () => {
  it("produces the expected lowercase SHA-256 digest", () => {
    const canonical = JSON.stringify([
      1,
      true,
      16,
      ["activity-α", "DP-1", "desktop-1", "window", "window-😀"],
      [
        "column-boundary",
        "activity-α",
        "DP-1",
        "desktop-1",
        "after",
        "window-target",
      ],
      null,
      [
        [
          "activity-α",
          "DP-1",
          "desktop-1",
          0,
          12,
          [
            [
              "stacked",
              0,
              ["proportion", 0.5],
              ["fixed", 640],
              [["window-😀", ["auto", 1], [30, 80, "positive-infinity"]]],
            ],
          ],
        ],
      ],
      [["activity-α", "DP-1", "desktop-1", geometryFingerprint]],
    ]);
    const expected = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");

    expect(fingerprintOverviewSpatialDropBasis(basis())).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("ignores unrelated model contexts", () => {
    const first = basis();
    const secondContext = {
      activeColumnIndex: null,
      activityId: "activity-α",
      columns: [],
      desktopId: "desktop-2",
      outputId: "DP-2",
      viewportOffset: 0,
    } as const;
    const forward = {
      ...first,
      model: {
        ...first.model,
        contexts: [...first.model.contexts, secondContext],
        desktopIds: ["desktop-1", "desktop-2"],
      },
    };
    const reversed = {
      ...forward,
      model: {
        ...forward.model,
        contexts: [...forward.model.contexts].reverse(),
      },
    };

    expect(fingerprintOverviewSpatialDropBasis(reversed)).toBe(
      fingerprintOverviewSpatialDropBasis(forward),
    );
    expect(
      fingerprintOverviewSpatialDropBasis({
        ...forward,
        model: {
          ...forward.model,
          contexts: [
            forward.model.contexts[0],
            { ...secondContext, viewportOffset: 400 },
          ],
        },
      }),
    ).toBe(fingerprintOverviewSpatialDropBasis(forward));
  });

  it("binds workspace-gap commands to the ordered desktop topology", () => {
    const first = basis();
    const workspaceGapBasis = {
      ...first,
      contextGeometries: [
        first.contextGeometries[0],
        {
          activityId: "activity-α",
          desktopId: "desktop-2",
          fingerprint: geometryFingerprint,
          outputId: "DP-1",
        },
      ],
      model: {
        ...first.model,
        desktopIds: ["desktop-1", "desktop-2"],
      },
      target: {
        activityId: "activity-α",
        adjacentDesktopId: "desktop-2",
        anchorDesktopId: "desktop-1",
        kind: "workspace-gap",
        outputId: "DP-1",
        position: "after",
      },
    } as const;

    const forward = fingerprintOverviewSpatialDropBasis(workspaceGapBasis);
    const reversed = fingerprintOverviewSpatialDropBasis({
      ...workspaceGapBasis,
      model: {
        ...workspaceGapBasis.model,
        desktopIds: [...workspaceGapBasis.model.desktopIds].reverse(),
      },
    });

    expect(forward).toMatch(/^[0-9a-f]{64}$/u);
    expect(reversed).toMatch(/^[0-9a-f]{64}$/u);
    expect(reversed).not.toBe(forward);
  });

  it.each([
    { ...basis(), gap: 17 },
    { ...basis(), alwaysCenterSingleColumn: false },
    { ...basis(), source: { ...basis().source, scope: "column" } },
    { ...basis(), source: { ...basis().source, windowId: "other-window" } },
    { ...basis(), target: { ...basis().target, position: "before" } },
    {
      ...basis(),
      target: { ...basis().target, targetWindowId: "other-target" },
    },
    {
      ...basis(),
      contextGeometries: [
        {
          ...basis().contextGeometries[0],
          fingerprint: geometryFingerprint.replace("1050", "1040"),
        },
      ],
    },
    {
      ...basis(),
      model: {
        ...model(),
        contexts: [
          {
            ...model().contexts[0],
            columns: [
              {
                ...model().contexts[0].columns[0],
                width: { kind: "fixed", value: 700 },
              },
            ],
          },
        ],
      },
    },
  ])("changes when any placement input changes", (changed) => {
    expect(fingerprintOverviewSpatialDropBasis(changed)).not.toBe(
      fingerprintOverviewSpatialDropBasis(basis()),
    );
  });

  it.each([
    null,
    {},
    { ...basis(), gap: -1 },
    {
      ...basis(),
      model: {
        ...model(),
        contexts: [{ ...model().contexts[0], activeColumnIndex: 2 }],
      },
    },
    { ...basis(), contextGeometries: [] },
    {
      ...basis(),
      contextGeometries: [
        { ...basis().contextGeometries[0], fingerprint: "invalid" },
      ],
    },
  ])("fails closed for malformed input", (invalid) => {
    expect(fingerprintOverviewSpatialDropBasis(invalid)).toBeNull();
  });
});
