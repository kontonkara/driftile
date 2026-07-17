import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { planOverviewSpatialVisibleRange } from "../../src/overview/spatial-visible-range";

const plannerSource = readFileSync(
  new URL("../../src/overview/spatial-visible-range.ts", import.meta.url),
  "utf8",
);

describe("planOverviewSpatialVisibleRange", () => {
  it("returns the one visible workspace without allocating a collection", () => {
    const plan = planOverviewSpatialVisibleRange({
      cardHeight: 500,
      contentHeight: 1000,
      contentY: 0,
      edgeMargin: 250,
      gap: 48,
      overscan: 2,
      sceneHeight: 1000,
      workspaceCount: 1,
    });

    expect(plan).toEqual({ firstIndex: 0, lastIndex: 0 });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.keys(plan ?? {})).toHaveLength(2);
  });

  it.each([
    [0, 0, 1],
    [90, 1, 2],
    [180, 2, 3],
  ])(
    "finds the exact half-open intersection at contentY=%i",
    (contentY, firstIndex, lastIndex) => {
      expect(
        planOverviewSpatialVisibleRange({
          cardHeight: 50,
          contentHeight: 280,
          contentY,
          edgeMargin: 25,
          gap: 10,
          overscan: 0,
          sceneHeight: 100,
          workspaceCount: 4,
        }),
      ).toEqual({ firstIndex, lastIndex });
    },
  );

  it("excludes cards that only touch the viewport boundary", () => {
    expect(
      planOverviewSpatialVisibleRange({
        cardHeight: 10,
        contentHeight: 50,
        contentY: 10,
        edgeMargin: 0,
        gap: 0,
        overscan: 0,
        sceneHeight: 10,
        workspaceCount: 5,
      }),
    ).toEqual({ firstIndex: 1, lastIndex: 1 });
  });

  it("returns null when the viewport intersects only a stack gap", () => {
    expect(
      planOverviewSpatialVisibleRange({
        cardHeight: 10,
        contentHeight: 40,
        contentY: 10,
        edgeMargin: 0,
        gap: 10,
        overscan: 0,
        sceneHeight: 5,
        workspaceCount: 2,
      }),
    ).toBeNull();
  });

  it.each([
    [0, 0, 2],
    [40, 2, 6],
    [90, 7, 9],
  ])(
    "adds bounded overscan and clamps it at contentY=%i",
    (contentY, firstIndex, lastIndex) => {
      expect(
        planOverviewSpatialVisibleRange({
          cardHeight: 10,
          contentHeight: 100,
          contentY,
          edgeMargin: 0,
          gap: 0,
          overscan: 2,
          sceneHeight: 10,
          workspaceCount: 10,
        }),
      ).toEqual({ firstIndex, lastIndex });
    },
  );

  it("accepts the bounded maximum workspace count", () => {
    expect(
      planOverviewSpatialVisibleRange({
        cardHeight: 1,
        contentHeight: 512,
        contentY: 511,
        edgeMargin: 0,
        gap: 0,
        overscan: 0,
        sceneHeight: 1,
        workspaceCount: 512,
      }),
    ).toEqual({ firstIndex: 511, lastIndex: 511 });
  });

  it("matches exact intersection and bounded overscan across stack geometry", () => {
    fc.assert(
      fc.property(
        fc.record({
          cardHeight: fc.integer({ min: 1, max: 80 }),
          contentYSeed: fc.nat(),
          edgeMargin: fc.integer({ min: 0, max: 40 }),
          gap: fc.integer({ min: 0, max: 20 }),
          overscan: fc.integer({ min: 0, max: 2 }),
          sceneHeight: fc.integer({ min: 1, max: 80 }),
          trailingMargin: fc.integer({ min: 0, max: 40 }),
          workspaceCount: fc.integer({ min: 1, max: 24 }),
        }),
        (sample) => {
          const stride = sample.cardHeight + sample.gap;
          const lastCardEnd =
            sample.edgeMargin +
            (sample.workspaceCount - 1) * stride +
            sample.cardHeight;
          const contentHeight = Math.max(
            sample.sceneHeight,
            lastCardEnd + sample.trailingMargin,
          );
          const maximumContentY = contentHeight - sample.sceneHeight;
          const contentY = sample.contentYSeed % (maximumContentY + 1);
          const viewportEnd = contentY + sample.sceneHeight;
          const intersecting: number[] = [];

          for (let index = 0; index < sample.workspaceCount; index += 1) {
            const cardStart = sample.edgeMargin + index * stride;
            const cardEnd = cardStart + sample.cardHeight;

            if (cardEnd > contentY && cardStart < viewportEnd) {
              intersecting.push(index);
            }
          }

          const actual = planOverviewSpatialVisibleRange({
            ...sample,
            contentHeight,
            contentY,
          });

          if (intersecting.length === 0) {
            expect(actual).toBeNull();
            return;
          }

          const firstExact = intersecting[0] as number;
          const lastExact = intersecting[intersecting.length - 1] as number;
          expect(actual).toEqual({
            firstIndex: Math.max(0, firstExact - sample.overscan),
            lastIndex: Math.min(
              sample.workspaceCount - 1,
              lastExact + sample.overscan,
            ),
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it.each([
    null,
    [],
    {},
    validInput({ sceneHeight: 0 }),
    validInput({ sceneHeight: Number.POSITIVE_INFINITY }),
    validInput({ contentHeight: 0 }),
    validInput({ contentY: -1 }),
    validInput({ contentY: 181 }),
    validInput({ edgeMargin: -1 }),
    validInput({ cardHeight: 0 }),
    validInput({ gap: -1 }),
    validInput({ workspaceCount: 0 }),
    validInput({ workspaceCount: 513 }),
    validInput({ workspaceCount: 1.5 }),
    validInput({ overscan: -1 }),
    validInput({ overscan: 3 }),
    validInput({ overscan: 0.5 }),
    validInput({ sceneHeight: 281 }),
    validInput({ contentHeight: 200 }),
    validInput({ edgeMargin: 100 }),
    {
      cardHeight: Number.MAX_VALUE,
      contentHeight: Number.MAX_VALUE,
      contentY: 0,
      edgeMargin: Number.MAX_VALUE,
      gap: 0,
      overscan: 0,
      sceneHeight: 1,
      workspaceCount: 2,
    },
  ])("rejects malformed, inconsistent, or overflowing input (%o)", (input) => {
    expect(planOverviewSpatialVisibleRange(input)).toBeNull();
  });

  it("fails closed for hostile input accessors", () => {
    const hostile = Object.defineProperty({}, "sceneHeight", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialVisibleRange(hostile)).toBeNull();
  });

  it("keeps planning independent of workspace-sized collections", () => {
    expect(plannerSource).not.toMatch(
      /\b(?:for|while)\s*\(|\.map\s*\(|\.filter\s*\(|new\s+Array\s*\(/u,
    );
  });
});

function validInput(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    cardHeight: 50,
    contentHeight: 280,
    contentY: 90,
    edgeMargin: 25,
    gap: 10,
    overscan: 0,
    sceneHeight: 100,
    workspaceCount: 4,
    ...overrides,
  };
}
