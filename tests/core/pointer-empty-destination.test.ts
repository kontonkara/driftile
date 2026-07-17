import { describe, expect, it } from "vitest";

import { solveStripGeometry } from "../../src/core/geometry";
import {
  activityId,
  columnId,
  desktopId,
  outputId,
  windowId,
} from "../../src/core/ids";
import {
  planPointerEmptyDestinationPreview,
  type PointerEmptyDestinationPreviewInput,
} from "../../src/core/pointer-empty-destination";

describe("planPointerEmptyDestinationPreview", () => {
  it.each([false, true])(
    "matches the strip solver with single-column centering set to %s",
    (centerSingleColumn) => {
      const input = previewInput({ centerSingleColumn });
      const frame = planPointerEmptyDestinationPreview(input);
      const expected = solveStripGeometry({
        centerSingleColumn,
        context: {
          activeColumnId: columnId("column"),
          activityId: activityId("activity"),
          columns: [
            {
              id: columnId("column"),
              presentation: "stacked",
              selectedWindowId: windowId("window"),
              width: { kind: "proportion", value: 1 / 3 },
              windowIds: [windowId("window")],
            },
          ],
          desktopId: desktopId("desktop"),
          outputId: outputId("output"),
          viewportOffset: 0,
        },
        devicePixelRatio: input.devicePixelRatio,
        gap: input.gap,
        pixelGridOrigin: input.pixelGridOrigin,
        workArea: input.workArea,
      }).windows[0]?.frame;

      expect(frame).toEqual(expected);
      expect(Object.isFrozen(frame)).toBe(true);
    },
  );

  it("resolves a constrained fixed client height on the physical grid", () => {
    const frame = planPointerEmptyDestinationPreview(
      previewInput({
        column: {
          presentation: "stacked",
          selected: true,
          width: { kind: "fixed", value: 420 },
          windowHeight: { clientHeight: 240, kind: "fixed" },
        },
        constraints: {
          decorationHeight: 8,
          maximumClientHeight: 500,
          maximumFrameWidth: 500,
          minimumClientHeight: 100,
          minimumFrameWidth: 300,
        },
        devicePixelRatio: 1.25,
        gap: 10,
      }),
    );

    expect(frame).toEqual({ height: 248, width: 420, x: 110.4, y: 60.4 });
    expect(Object.isFrozen(frame)).toBe(true);
  });

  it("uses the common tabbed singleton frame", () => {
    expect(
      planPointerEmptyDestinationPreview(
        previewInput({
          column: {
            presentation: "tabbed",
            selected: true,
            width: { kind: "fixed", value: 600 },
          },
        }),
      ),
    ).toEqual({ height: 1048, width: 600, x: 116, y: 66 });
  });

  it("does not mutate the synthetic policy input", () => {
    const input = previewInput({
      column: {
        presentation: "stacked",
        selected: true,
        width: { kind: "fixed", value: 640 },
        windowHeight: { kind: "auto", weight: 1 },
      },
      constraints: { minimumFrameWidth: 320 },
    });
    const before = structuredClone(input);

    expect(planPointerEmptyDestinationPreview(input)).not.toBeNull();
    expect(input).toEqual(before);
  });

  it.each([
    {
      name: "unselected policy",
      overrides: { column: { selected: false } },
    },
    {
      name: "invalid width",
      overrides: {
        column: { width: { kind: "fixed", value: Number.NaN } },
      },
    },
    {
      name: "undersized work area",
      overrides: { workArea: { height: 20, width: 20, x: 0, y: 0 } },
    },
    {
      name: "minimum width violation",
      overrides: { constraints: { minimumFrameWidth: 700 } },
    },
    {
      name: "maximum height violation",
      overrides: { constraints: { maximumClientHeight: 500 } },
    },
    {
      name: "missing height preset",
      overrides: {
        column: { windowHeight: { index: 99, kind: "preset" } },
      },
    },
    {
      name: "throwing height resolver",
      overrides: {
        column: { windowHeight: { index: 0, kind: "preset" } },
        windowHeightPresetResolver: () => {
          throw new Error("resolver failed");
        },
      },
    },
  ])("fails closed for $name", ({ overrides }) => {
    expect(
      planPointerEmptyDestinationPreview(
        previewInput(
          overrides as Partial<PointerEmptyDestinationPreviewInput> & {
            readonly column?: Partial<
              PointerEmptyDestinationPreviewInput["column"]
            >;
          },
        ),
      ),
    ).toBeNull();
  });
});

function previewInput(
  overrides: Partial<PointerEmptyDestinationPreviewInput> & {
    readonly column?: Partial<PointerEmptyDestinationPreviewInput["column"]>;
  } = {},
): PointerEmptyDestinationPreviewInput {
  const column = {
    presentation: "stacked" as const,
    selected: true,
    width: { kind: "proportion" as const, value: 1 / 3 },
    ...overrides.column,
  };

  return {
    centerSingleColumn: false,
    devicePixelRatio: 1,
    gap: 16,
    pixelGridOrigin: { x: 100, y: 50 },
    workArea: { height: 1080, width: 1920, x: 100, y: 50 },
    ...overrides,
    column,
  };
}
