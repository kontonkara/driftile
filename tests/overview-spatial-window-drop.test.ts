import { readFileSync } from "node:fs";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../src/core/layout-persistence";
import {
  buildOverviewSpatialWindowDropPlan,
  hitTestOverviewSpatialWindowDrop,
  type OverviewSpatialWindowDropPlanInput,
} from "../src/overview/spatial-window-drop";

const plannerSource = readFileSync(
  new URL("../src/overview/spatial-window-drop.ts", import.meta.url),
  "utf8",
);

function fixture(): OverviewSpatialWindowDropPlanInput {
  return {
    rows: [
      {
        activityId: "activity-a",
        columns: [
          {
            frame: { height: 400, width: 250, x: 100, y: 50 },
            members: [
              {
                frame: { height: 100, width: 220, x: 115, y: 50 },
                windowId: "window-a1",
              },
              {
                frame: { height: 280, width: 250, x: 100, y: 170 },
                windowId: "window-a2",
              },
            ],
          },
          {
            frame: { height: 400, width: 300, x: 450, y: 50 },
            members: [
              {
                frame: { height: 400, width: 300, x: 450, y: 50 },
                windowId: "window-b1",
              },
            ],
          },
        ],
        desktopId: "desktop-a",
        frame: { height: 500, width: 1_000, x: 0, y: 0 },
        outputId: "output-a",
      },
      {
        activityId: "activity-a",
        columns: [],
        desktopId: "desktop-empty",
        frame: { height: 500, width: 1_000, x: 0, y: 550 },
        outputId: "output-a",
      },
    ],
  };
}

function hit(x: number, y: number) {
  const plan = buildOverviewSpatialWindowDropPlan(fixture());

  if (plan === null) {
    throw new Error("expected a valid spatial drop plan");
  }

  return hitTestOverviewSpatialWindowDrop(plan, { x, y });
}

describe("buildOverviewSpatialWindowDropPlan", () => {
  it("builds one immutable bounded index for rows, columns, and members", () => {
    const plan = buildOverviewSpatialWindowDropPlan(fixture());

    expect(plan).not.toBeNull();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan?.rows)).toBe(true);
    expect(plan?.rows).toHaveLength(2);
  });

  it.each([
    {
      name: "workspace rows",
      update: (input: OverviewSpatialWindowDropPlanInput) => ({
        rows: [
          input.rows[0],
          {
            ...input.rows[1],
            frame: { height: 500, width: 1_000, x: 0, y: 499 },
          },
        ],
      }),
    },
    {
      name: "columns",
      update: (input: OverviewSpatialWindowDropPlanInput) => ({
        rows: [
          {
            ...input.rows[0],
            columns: [
              input.rows[0]?.columns[0],
              {
                ...input.rows[0]?.columns[1],
                frame: { height: 400, width: 300, x: 349, y: 50 },
              },
            ],
          },
          input.rows[1],
        ],
      }),
    },
    {
      name: "stack members",
      update: (input: OverviewSpatialWindowDropPlanInput) => ({
        rows: [
          {
            ...input.rows[0],
            columns: [
              {
                ...input.rows[0]?.columns[0],
                members: [
                  input.rows[0]?.columns[0]?.members[0],
                  {
                    ...input.rows[0]?.columns[0]?.members[1],
                    frame: { height: 280, width: 250, x: 100, y: 149 },
                  },
                ],
              },
              input.rows[0]?.columns[1],
            ],
          },
          input.rows[1],
        ],
      }),
    },
  ])(
    "rejects overlapping $name instead of resolving ambiguity",
    ({ update }) => {
      expect(buildOverviewSpatialWindowDropPlan(update(fixture()))).toBeNull();
    },
  );

  it("rejects duplicate window anchors and geometry outside its parent zone", () => {
    const input = fixture();
    const firstRow = input.rows[0];
    const firstColumn = firstRow?.columns[0];
    const secondColumn = firstRow?.columns[1];
    const firstMember = firstColumn?.members[0];

    if (
      firstRow === undefined ||
      firstColumn === undefined ||
      secondColumn === undefined ||
      firstMember === undefined
    ) {
      throw new Error("expected complete fixture geometry");
    }

    expect(
      buildOverviewSpatialWindowDropPlan({
        rows: [
          {
            ...firstRow,
            columns: [
              firstColumn,
              {
                ...secondColumn,
                members: [
                  {
                    ...secondColumn.members[0],
                    windowId: firstMember.windowId,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
    expect(
      buildOverviewSpatialWindowDropPlan({
        rows: [
          {
            ...firstRow,
            columns: [
              {
                ...firstColumn,
                members: [
                  {
                    frame: { height: 100, width: 260, x: 95, y: 50 },
                    windowId: "window-outside",
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("fails closed for malformed and hostile snapshot values", () => {
    const hostile = Object.defineProperty({}, "columns", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(buildOverviewSpatialWindowDropPlan(null)).toBeNull();
    expect(buildOverviewSpatialWindowDropPlan({ rows: [] })).toBeNull();
    expect(buildOverviewSpatialWindowDropPlan({ rows: [hostile] })).toBeNull();
    expect(
      buildOverviewSpatialWindowDropPlan({
        rows: [
          {
            ...fixture().rows[0],
            columns: [
              {
                frame: { height: 100, width: 100, x: 0, y: 0 },
                members: [],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
    expect(
      buildOverviewSpatialWindowDropPlan({
        rows: [
          {
            ...fixture().rows[0],
            frame: {
              height: 500,
              width: Number.POSITIVE_INFINITY,
              x: 0,
              y: 0,
            },
          },
        ],
      }),
    ).toBeNull();
    expect(
      buildOverviewSpatialWindowDropPlan({
        rows: Array.from(
          { length: LAYOUT_PERSISTENCE_LIMITS.contexts + 1 },
          (_, index) => ({
            activityId: "activity-a",
            columns: [],
            desktopId: `desktop-${String(index)}`,
            frame: { height: 1, width: 1, x: 0, y: index },
            outputId: "output-a",
          }),
        ),
      }),
    ).toBeNull();
  });
});

describe("hitTestOverviewSpatialWindowDrop", () => {
  it("selects canonical outer and interior column boundaries", () => {
    expect(hit(0, 250)).toEqual({
      activityId: "activity-a",
      desktopId: "desktop-a",
      kind: "column-boundary",
      outputId: "output-a",
      position: "before",
      rowIndex: 0,
      targetWindowId: "window-a1",
    });
    expect(hit(350, 250)).toEqual({
      activityId: "activity-a",
      desktopId: "desktop-a",
      kind: "column-boundary",
      outputId: "output-a",
      position: "after",
      rowIndex: 0,
      targetWindowId: "window-a1",
    });
    expect(hit(999.999, 250)).toEqual({
      activityId: "activity-a",
      desktopId: "desktop-a",
      kind: "column-boundary",
      outputId: "output-a",
      position: "after",
      rowIndex: 0,
      targetWindowId: "window-b1",
    });
  });

  it("uses half-open column boundaries and exact stack midpoints", () => {
    expect(hit(99.999, 250)?.kind).toBe("column-boundary");
    expect(hit(100, 250)).toMatchObject({
      kind: "stack-insertion",
      position: "before",
      targetWindowId: "window-a2",
    });
    expect(hit(200, 99.999)).toMatchObject({
      kind: "stack-insertion",
      position: "before",
      targetWindowId: "window-a1",
    });
    expect(hit(200, 100)).toMatchObject({
      kind: "stack-insertion",
      position: "after",
      targetWindowId: "window-a1",
    });
    expect(hit(450, 250)).toMatchObject({
      kind: "stack-insertion",
      position: "after",
      targetWindowId: "window-b1",
    });
    expect(hit(450, 250)).not.toHaveProperty("targetColumnId");
  });

  it("uses exact mixed stack frames and leaves visual gaps untargeted", () => {
    expect(hit(110, 60)).toBeNull();
    expect(hit(120, 60)).toMatchObject({
      position: "before",
      targetWindowId: "window-a1",
    });
    expect(hit(200, 150)).toBeNull();
    expect(hit(200, 169.999)).toBeNull();
    expect(hit(200, 170)).toMatchObject({
      position: "before",
      targetWindowId: "window-a2",
    });
    expect(hit(200, 310)).toMatchObject({
      position: "after",
      targetWindowId: "window-a2",
    });
  });

  it("returns the exact empty-row target and rejects row gaps and outer edges", () => {
    expect(hit(500, 800)).toEqual({
      activityId: "activity-a",
      desktopId: "desktop-empty",
      kind: "empty-row",
      outputId: "output-a",
      rowIndex: 1,
    });
    expect(hit(500, 500)).toBeNull();
    expect(hit(500, 549.999)).toBeNull();
    expect(hit(500, 1_050)).toBeNull();
    expect(hit(1_000, 800)).toBeNull();
  });

  it("rejects malformed points and plans without invoking external code", () => {
    const plan = buildOverviewSpatialWindowDropPlan(fixture());
    const hostilePoint = Object.defineProperty({}, "x", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(hitTestOverviewSpatialWindowDrop(plan, hostilePoint)).toBeNull();
    expect(
      hitTestOverviewSpatialWindowDrop(plan, { x: Number.NaN, y: 250 }),
    ).toBeNull();
    expect(
      hitTestOverviewSpatialWindowDrop(
        Object.freeze({ rows: Object.freeze([]) }),
        { x: 0, y: 0 },
      ),
    ).toBeNull();
  });

  it("maps every bounded interior gap to the column on its left", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 300, min: 20 }),
        fc.integer({ max: 120, min: 1 }),
        fc.integer({ max: 300, min: 20 }),
        fc.integer({ max: 99, min: 0 }),
        (leftWidth, gapWidth, rightWidth, gapPercent) => {
          const left = 25;
          const gapLeft = left + leftWidth;
          const rightLeft = gapLeft + gapWidth;
          const rowRight = rightLeft + rightWidth + 25;
          const plan = buildOverviewSpatialWindowDropPlan({
            rows: [
              {
                activityId: "activity",
                columns: [
                  {
                    frame: { height: 100, width: leftWidth, x: left, y: 0 },
                    members: [
                      {
                        frame: {
                          height: 100,
                          width: leftWidth,
                          x: left,
                          y: 0,
                        },
                        windowId: "left-window",
                      },
                    ],
                  },
                  {
                    frame: {
                      height: 100,
                      width: rightWidth,
                      x: rightLeft,
                      y: 0,
                    },
                    members: [
                      {
                        frame: {
                          height: 100,
                          width: rightWidth,
                          x: rightLeft,
                          y: 0,
                        },
                        windowId: "right-window",
                      },
                    ],
                  },
                ],
                desktopId: "desktop",
                frame: { height: 100, width: rowRight, x: 0, y: 0 },
                outputId: "output",
              },
            ],
          });
          const x = gapLeft + (gapWidth * gapPercent) / 100;

          expect(
            hitTestOverviewSpatialWindowDrop(plan, { x, y: 50 }),
          ).toMatchObject({
            kind: "column-boundary",
            position: "after",
            targetWindowId: "left-window",
          });
        },
      ),
    );
  });

  it("keeps mixed-height midpoint selection deterministic", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 400, min: 2 }),
        fc.integer({ max: 400, min: 2 }),
        (firstHeight, secondHeight) => {
          const secondTop = firstHeight + 7;
          const totalHeight = secondTop + secondHeight;
          const plan = buildOverviewSpatialWindowDropPlan({
            rows: [
              {
                activityId: "activity",
                columns: [
                  {
                    frame: {
                      height: totalHeight,
                      width: 100,
                      x: 0,
                      y: 0,
                    },
                    members: [
                      {
                        frame: {
                          height: firstHeight,
                          width: 100,
                          x: 0,
                          y: 0,
                        },
                        windowId: "first",
                      },
                      {
                        frame: {
                          height: secondHeight,
                          width: 100,
                          x: 0,
                          y: secondTop,
                        },
                        windowId: "second",
                      },
                    ],
                  },
                ],
                desktopId: "desktop",
                frame: {
                  height: totalHeight,
                  width: 100,
                  x: 0,
                  y: 0,
                },
                outputId: "output",
              },
            ],
          });

          expect(
            hitTestOverviewSpatialWindowDrop(plan, {
              x: 50,
              y: firstHeight / 2,
            }),
          ).toMatchObject({ position: "after", targetWindowId: "first" });
          expect(
            hitTestOverviewSpatialWindowDrop(plan, {
              x: 50,
              y: secondTop + secondHeight / 2,
            }),
          ).toMatchObject({ position: "after", targetWindowId: "second" });
        },
      ),
    );
  });

  it("contains no cache, timer, weak collection, or live KWin scan", () => {
    expect(plannerSource).not.toMatch(
      /Weak(?:Map|Set)|setTimeout|setInterval|workspace|stackingOrder/u,
    );
    expect(plannerSource).not.toMatch(/new Map(?:\s*<|\s*\()/u);
    expect(plannerSource).not.toContain("targetColumnId");
    expect(plannerSource).not.toMatch(/readonly columnId:/u);
  });
});
