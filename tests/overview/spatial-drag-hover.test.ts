import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import { planOverviewSpatialDragHover } from "../../src/overview/runtime";

const plannerSource = readFileSync(
  new URL("../../src/overview/spatial-drag-hover.ts", import.meta.url),
  "utf8",
);

const baseInput = Object.freeze({
  activationThresholdMilliseconds: 500,
  activeGeometryEpoch: 8,
  activeModelEpoch: 5,
  activeSessionId: 3,
  currentDesktopId: "desktop-current",
  elapsedMilliseconds: 499.99,
  geometryEpoch: 8,
  modelEpoch: 5,
  rowCount: 4,
  sessionId: 3,
  sourceDesktopId: "desktop-source",
  targetDesktopId: "desktop-target",
  targetRowIndex: 2,
});

describe("planOverviewSpatialDragHover", () => {
  it("keeps a valid hover pending before the dwell threshold", () => {
    const plan = planOverviewSpatialDragHover(baseInput);

    expect(plan).toEqual({
      intent: "pending",
      targetDesktopId: "desktop-target",
      targetRowIndex: 2,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("activates exactly at and after the dwell threshold", () => {
    expect(
      planOverviewSpatialDragHover({
        ...baseInput,
        elapsedMilliseconds: 500,
      }),
    ).toEqual({
      intent: "activate",
      targetDesktopId: "desktop-target",
      targetRowIndex: 2,
    });
    expect(
      planOverviewSpatialDragHover({
        ...baseInput,
        elapsedMilliseconds: 750.5,
      }),
    ).toEqual({
      intent: "activate",
      targetDesktopId: "desktop-target",
      targetRowIndex: 2,
    });
  });

  it.each([
    { activeSessionId: 4 },
    { activeModelEpoch: 6 },
    { activeGeometryEpoch: 9 },
  ])("rejects stale ownership (%o)", (overrides) => {
    expect(
      planOverviewSpatialDragHover({ ...baseInput, ...overrides }),
    ).toBeNull();
  });

  it.each([
    { targetDesktopId: "desktop-source" },
    { targetDesktopId: "desktop-current" },
  ])("rejects source and current desktop no-ops (%o)", (overrides) => {
    expect(
      planOverviewSpatialDragHover({ ...baseInput, ...overrides }),
    ).toBeNull();
  });

  it("accepts every persistence boundary without scanning the row count", () => {
    const identifier = "d".repeat(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters,
    );
    const plan = planOverviewSpatialDragHover({
      ...baseInput,
      activationThresholdMilliseconds:
        LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      activeGeometryEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      activeModelEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      activeSessionId: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      elapsedMilliseconds: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      geometryEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      modelEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      rowCount: LAYOUT_PERSISTENCE_LIMITS.contexts,
      sessionId: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude,
      targetDesktopId: identifier,
      targetRowIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
    });

    expect(plan).toEqual({
      intent: "activate",
      targetDesktopId: identifier,
      targetRowIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
    });
  });

  it.each([
    null,
    [],
    {},
    { ...baseInput, activeSessionId: 0, sessionId: 0 },
    { ...baseInput, sessionId: 1.5, activeSessionId: 1.5 },
    { ...baseInput, modelEpoch: -1, activeModelEpoch: -1 },
    { ...baseInput, geometryEpoch: 1.5, activeGeometryEpoch: 1.5 },
    { ...baseInput, sourceDesktopId: "" },
    { ...baseInput, currentDesktopId: "desktop\u0000current" },
    { ...baseInput, targetDesktopId: "x".repeat(257) },
    { ...baseInput, rowCount: 0 },
    { ...baseInput, rowCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1 },
    { ...baseInput, targetRowIndex: -1 },
    { ...baseInput, targetRowIndex: 4 },
    { ...baseInput, targetRowIndex: 1.5 },
    { ...baseInput, elapsedMilliseconds: -1 },
    { ...baseInput, elapsedMilliseconds: Number.NaN },
    { ...baseInput, elapsedMilliseconds: Number.POSITIVE_INFINITY },
    {
      ...baseInput,
      elapsedMilliseconds: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
    },
    { ...baseInput, activationThresholdMilliseconds: 0 },
    { ...baseInput, activationThresholdMilliseconds: Number.NaN },
    {
      ...baseInput,
      activationThresholdMilliseconds:
        LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
    },
    {
      ...baseInput,
      activeGeometryEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
      geometryEpoch: LAYOUT_PERSISTENCE_LIMITS.numericMagnitude + 1,
    },
  ])("rejects invalid, non-finite, or oversized input (%o)", (input) => {
    expect(planOverviewSpatialDragHover(input)).toBeNull();
  });

  it("fails closed for hostile accessors", () => {
    const hostile = Object.defineProperty({}, "activeSessionId", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialDragHover(hostile)).toBeNull();
  });

  it("has no timer, object cache, or unbounded collection runtime", () => {
    expect(plannerSource).not.toMatch(
      /Weak(?:Map|Set)|setTimeout|setInterval/u,
    );
    expect(plannerSource).not.toMatch(/new (?:Map|Set)(?:\s*<|\s*\()/u);
  });
});
