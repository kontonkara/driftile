import { describe, expect, it } from "vitest";
import {
  encodeSpatialDropCommand,
  SPATIAL_DROP_COMMAND_VERSION,
  type SpatialDropCommand,
} from "../src/overview/spatial-drop-command";
import {
  applyOverviewSpatialDrop,
  OVERVIEW_SPATIAL_DROP_COMMAND_TTL_MILLISECONDS,
} from "../src/runtime";

const CREATED_AT = 1_751_000_000_000;

function command(requestId = 41, createdAt = CREATED_AT): SpatialDropCommand {
  return {
    createdAt,
    format: "driftile-spatial-drop",
    requestId,
    source: {
      activityId: "activity-a",
      desktopId: "desktop-a",
      outputId: "output-a",
      scope: "window",
      windowId: "window-a",
    },
    target: {
      activityId: "activity-a",
      desktopId: "desktop-a",
      kind: "stack-insertion",
      outputId: "output-a",
      position: "after",
      targetWindowId: "window-b",
    },
    version: SPATIAL_DROP_COMMAND_VERSION,
  };
}

function documentFor(requestId = 41, createdAt = CREATED_AT): string {
  const document = encodeSpatialDropCommand(command(requestId, createdAt));

  if (document === null) {
    throw new Error("could not encode spatial drop test command");
  }

  return document;
}

describe("applyOverviewSpatialDrop", () => {
  it("consumes a fresh command even when no controller can apply it", () => {
    const result = applyOverviewSpatialDrop(documentFor(), CREATED_AT, 40);

    expect(result).toEqual({ applied: false, consumed: true, requestId: 41 });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects malformed, future, stale, and replayed transport values", () => {
    const boundary = documentFor(41, CREATED_AT);

    expect(applyOverviewSpatialDrop("{}", CREATED_AT, 40)).toBeNull();
    expect(applyOverviewSpatialDrop(boundary, "now", 40)).toBeNull();
    expect(applyOverviewSpatialDrop(boundary, CREATED_AT, -0)).toBeNull();
    expect(applyOverviewSpatialDrop(boundary, CREATED_AT - 1, 40)).toBeNull();
    expect(
      applyOverviewSpatialDrop(
        boundary,
        CREATED_AT + OVERVIEW_SPATIAL_DROP_COMMAND_TTL_MILLISECONDS + 1,
        40,
      ),
    ).toBeNull();
    expect(applyOverviewSpatialDrop(boundary, CREATED_AT, 41)).toBeNull();
    expect(applyOverviewSpatialDrop(boundary, CREATED_AT, 42)).toBeNull();
    expect(
      applyOverviewSpatialDrop(
        boundary,
        CREATED_AT + OVERVIEW_SPATIAL_DROP_COMMAND_TTL_MILLISECONDS,
        40,
      ),
    ).toEqual({ applied: false, consumed: true, requestId: 41 });
  });

  it("orders wrapped request ids with a bounded half-range policy", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const halfRange = Math.floor(maximum / 2);

    expect(
      applyOverviewSpatialDrop(documentFor(1), CREATED_AT, maximum - 1),
    ).toEqual({ applied: false, consumed: true, requestId: 1 });
    expect(
      applyOverviewSpatialDrop(documentFor(maximum), CREATED_AT, 1),
    ).toBeNull();
    expect(
      applyOverviewSpatialDrop(documentFor(1 + halfRange), CREATED_AT, 1),
    ).toEqual({
      applied: false,
      consumed: true,
      requestId: 1 + halfRange,
    });
    expect(
      applyOverviewSpatialDrop(documentFor(1 + halfRange + 1), CREATED_AT, 1),
    ).toBeNull();
    expect(
      applyOverviewSpatialDrop(documentFor(maximum), CREATED_AT, 0),
    ).toEqual({ applied: false, consumed: true, requestId: maximum });
  });
});
