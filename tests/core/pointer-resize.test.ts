import { describe, expect, it } from "vitest";
import type { Rect } from "../../src/core/geometry";
import {
  inferPointerHorizontalResize,
  inferPointerVerticalResize,
} from "../../src/core/pointer-resize";

const before: Rect = { height: 400, width: 500, x: 100, y: 200 };

describe("inferPointerHorizontalResize", () => {
  it.each([
    {
      accepted: { ...before, width: 600 },
      edge: "right",
      width: 600,
    },
    {
      accepted: { ...before, width: 400, x: 200 },
      edge: "left",
      width: 400,
    },
  ] as const)(
    "accepts an exact $edge-edge resize",
    ({ accepted, edge, width }) => {
      const inferred = inferPointerHorizontalResize(before, accepted);

      expect(inferred).toEqual({ edge, width });
      expect(Object.isFrozen(inferred)).toBe(true);
    },
  );

  it.each([
    ["cancelled", before],
    ["vertical", { ...before, height: 500 }],
    ["top-left corner", { ...before, height: 500, width: 400, x: 200 }],
    ["bottom-right corner", { ...before, height: 500, width: 600 }],
    ["both horizontal edges", { ...before, width: 700, x: 50 }],
    ["translation", { ...before, x: 200 }],
  ] as const)("rejects %s geometry", (_name, accepted) => {
    expect(inferPointerHorizontalResize(before, accepted)).toBeNull();
  });

  it.each([
    { ...before, width: 0 },
    { ...before, height: -1 },
    { ...before, x: Number.NaN },
    { ...before, width: Number.POSITIVE_INFINITY },
  ])("rejects an unusable accepted rectangle", (accepted) => {
    expect(inferPointerHorizontalResize(before, accepted)).toBeNull();
  });

  it("rejects an unusable initial rectangle", () => {
    expect(
      inferPointerHorizontalResize(
        { ...before, y: Number.NaN },
        acceptedRight(),
      ),
    ).toBeNull();
  });
});

describe("inferPointerVerticalResize", () => {
  it.each([
    {
      accepted: { ...before, height: 500 },
      edge: "bottom",
      height: 500,
    },
    {
      accepted: { ...before, height: 500, y: 100 },
      edge: "top",
      height: 500,
    },
  ] as const)(
    "accepts an exact $edge-edge resize",
    ({ accepted, edge, height }) => {
      const inferred = inferPointerVerticalResize(before, accepted);

      expect(inferred).toEqual({ edge, height });
      expect(Object.isFrozen(inferred)).toBe(true);
    },
  );

  it.each([
    ["cancelled", before],
    ["horizontal", { ...before, width: 600 }],
    ["top-left corner", { ...before, height: 500, width: 400, x: 200 }],
    ["bottom-right corner", { ...before, height: 500, width: 600 }],
    ["both vertical edges", { ...before, height: 600, y: 150 }],
    ["translation", { ...before, y: 300 }],
  ] as const)("rejects %s geometry", (_name, accepted) => {
    expect(inferPointerVerticalResize(before, accepted)).toBeNull();
  });
});

function acceptedRight(): Rect {
  return { ...before, width: before.width + 100 };
}
