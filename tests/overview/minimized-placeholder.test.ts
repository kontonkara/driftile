import { describe, expect, it } from "vitest";
import { planOverviewMinimizedPlaceholder } from "../../src/overview/runtime";

describe("planOverviewMinimizedPlaceholder", () => {
  it("centers a compact placeholder on a fully visible frame", () => {
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 400, width: 600, x: 100, y: 50 },
        { height: 1080, width: 1920, x: 0, y: 0 },
      ),
    ).toEqual({ height: 28, width: 180, x: 310, y: 236 });
  });

  it("supports negative desktop coordinates", () => {
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 240, width: 360, x: -800, y: -400 },
        { height: 600, width: 1000, x: -1000, y: -600 },
      ),
    ).toEqual({ height: 28, width: 180, x: -710, y: -294 });
  });

  it("clamps the placeholder into a partially visible frame", () => {
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 100, width: 1000, x: -900, y: 100 },
        { height: 1080, width: 1920, x: 0, y: 0 },
      ),
    ).toEqual({ height: 28, width: 100, x: 0, y: 136 });
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 200, width: 400, x: 1800, y: 100 },
        { height: 1080, width: 1920, x: 0, y: 0 },
      ),
    ).toEqual({ height: 28, width: 120, x: 1800, y: 186 });
  });

  it("returns null without a practical visible intersection", () => {
    const viewport = { height: 600, width: 800, x: 0, y: 0 };

    expect(
      planOverviewMinimizedPlaceholder(
        { height: 100, width: 100, x: 900, y: 0 },
        viewport,
      ),
    ).toBeNull();
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 100, width: 100, x: 776.01, y: 0 },
        viewport,
      ),
    ).toBeNull();
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 100, width: 100, x: 0, y: 588.01 },
        viewport,
      ),
    ).toBeNull();
  });

  it("accepts the minimum practical intersection exactly", () => {
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 12, width: 24, x: -24, y: -12 },
        { height: 100, width: 100, x: -24, y: -12 },
      ),
    ).toEqual({ height: 12, width: 24, x: -24, y: -12 });
  });

  it.each([
    null,
    [],
    {},
    { height: 100, width: 100, x: 0 },
    { height: 100, width: 0, x: 0, y: 0 },
    { height: -1, width: 100, x: 0, y: 0 },
    { height: 100, width: 100, x: Number.NaN, y: 0 },
    { height: 100, width: 100, x: 0, y: Number.POSITIVE_INFINITY },
    { height: 100, width: 100, x: 999_950, y: 0 },
    { height: Number.MAX_VALUE, width: 100, x: 0, y: 0 },
  ])("rejects malformed or extreme frame geometry (%o)", (frame) => {
    const valid = { height: 1080, width: 1920, x: 0, y: 0 };

    expect(planOverviewMinimizedPlaceholder(frame, valid)).toBeNull();
    expect(planOverviewMinimizedPlaceholder(valid, frame)).toBeNull();
  });

  it("fails closed for hostile geometry accessors", () => {
    const hostile = Object.defineProperty({}, "x", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewMinimizedPlaceholder(hostile, {
        height: 1080,
        width: 1920,
        x: 0,
        y: 0,
      }),
    ).toBeNull();
    expect(
      planOverviewMinimizedPlaceholder(
        { height: 100, width: 100, x: 0, y: 0 },
        hostile,
      ),
    ).toBeNull();
  });
});
