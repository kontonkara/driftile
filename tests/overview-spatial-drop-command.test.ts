import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAYOUT_PERSISTENCE_LIMITS } from "../src/core/layout-persistence";
import {
  decodeSpatialDropCommand,
  encodeSpatialDropCommand,
  SPATIAL_DROP_COMMAND_FORMAT,
  SPATIAL_DROP_COMMAND_LIMITS,
  SPATIAL_DROP_COMMAND_VERSION,
  type SpatialDropCommand,
  type SpatialDropTarget,
} from "../src/overview/spatial-drop-command";

const codecSource = readFileSync(
  new URL("../src/overview/spatial-drop-command.ts", import.meta.url),
  "utf8",
);

const source = Object.freeze({
  activityId: "activity-source",
  desktopId: "desktop-source",
  outputId: "output-source",
  windowId: "window-source",
});

const emptyRowTarget = Object.freeze({
  activityId: "activity-target",
  desktopId: "desktop-target",
  kind: "empty-row",
  outputId: "output-target",
}) satisfies SpatialDropTarget;

const workspaceGapTarget = Object.freeze({
  activityId: "activity-target",
  adjacentDesktopId: "desktop-adjacent",
  anchorDesktopId: "desktop-anchor",
  kind: "workspace-gap",
  outputId: "output-target",
  position: "before",
}) satisfies SpatialDropTarget;

const targets = Object.freeze([
  emptyRowTarget,
  Object.freeze({
    activityId: "activity-target",
    desktopId: "desktop-target",
    kind: "column-boundary",
    outputId: "output-target",
    position: "before",
    targetWindowId: "window-column-anchor",
  }),
  Object.freeze({
    activityId: "activity-target",
    desktopId: "desktop-target",
    kind: "column-boundary",
    outputId: "output-target",
    position: "after",
    targetWindowId: "window-column-anchor",
  }),
  Object.freeze({
    activityId: "activity-target",
    desktopId: "desktop-target",
    kind: "stack-insertion",
    outputId: "output-target",
    position: "before",
    targetWindowId: "window-stack-anchor",
  }),
  Object.freeze({
    activityId: "activity-target",
    desktopId: "desktop-target",
    kind: "stack-insertion",
    outputId: "output-target",
    position: "after",
    targetWindowId: "window-stack-anchor",
  }),
  workspaceGapTarget,
] satisfies readonly SpatialDropTarget[]);

function command(
  target: SpatialDropTarget = emptyRowTarget,
): SpatialDropCommand {
  return {
    createdAt: 1_751_000_000_000,
    format: SPATIAL_DROP_COMMAND_FORMAT,
    requestId: 41,
    source,
    target,
    version: SPATIAL_DROP_COMMAND_VERSION,
  };
}

describe("spatial drop command codec", () => {
  it.each(targets)("round-trips the $kind target", (target) => {
    const encoded = encodeSpatialDropCommand(command(target));
    const decoded = decodeSpatialDropCommand(encoded);

    expect(encoded).not.toBeNull();
    expect(decoded).toEqual(command(target));
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded?.source)).toBe(true);
    expect(Object.isFrozen(decoded?.target)).toBe(true);
    expect(encodeSpatialDropCommand(decoded)).toBe(encoded);
  });

  it("uses an existing target window as every anchored drop reference", () => {
    for (const target of targets.filter(
      (candidate) => candidate.kind !== "workspace-gap",
    )) {
      if (target.kind === "empty-row") {
        continue;
      }
      const encoded = encodeSpatialDropCommand(command(target));

      expect(encoded).toContain('"targetWindowId"');
      expect(encoded).not.toContain("targetColumnId");
    }
  });

  it("carries only the bounded adjacent workspace gap relation", () => {
    const encoded = encodeSpatialDropCommand(command(workspaceGapTarget));
    const decoded = decodeSpatialDropCommand(encoded);

    expect(decoded?.target).toEqual(workspaceGapTarget);
    expect(decoded?.target).not.toHaveProperty("desktopId");
    expect(encoded).not.toContain("desktopIds");
    expect(encoded).not.toContain("insertionIndex");
  });

  it("reuses persistence identifier bounds and keeps documents small", () => {
    expect(SPATIAL_DROP_COMMAND_LIMITS.identifierCharacters).toBe(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters,
    );
    expect(SPATIAL_DROP_COMMAND_LIMITS.documentCharacters).toBeLessThan(
      LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
    );

    const identifier = "x".repeat(
      SPATIAL_DROP_COMMAND_LIMITS.identifierCharacters,
    );
    const maximum = command({
      activityId: identifier,
      desktopId: identifier,
      kind: "stack-insertion",
      outputId: identifier,
      position: "after",
      targetWindowId: identifier,
    });
    const encoded = encodeSpatialDropCommand({
      ...maximum,
      source: {
        activityId: identifier,
        desktopId: identifier,
        outputId: identifier,
        windowId: identifier,
      },
    });
    const encodedWorkspaceGap = encodeSpatialDropCommand({
      ...command({
        activityId: identifier,
        adjacentDesktopId: `a${identifier.slice(1)}`,
        anchorDesktopId: `b${identifier.slice(1)}`,
        kind: "workspace-gap",
        outputId: identifier,
        position: "before",
      }),
      source: {
        activityId: identifier,
        desktopId: identifier,
        outputId: identifier,
        windowId: identifier,
      },
    });

    expect(encoded).not.toBeNull();
    expect(encodedWorkspaceGap).not.toBeNull();
    expect(encoded?.length).toBeLessThanOrEqual(
      SPATIAL_DROP_COMMAND_LIMITS.documentCharacters,
    );
    expect(encodedWorkspaceGap?.length).toBeLessThanOrEqual(
      SPATIAL_DROP_COMMAND_LIMITS.documentCharacters,
    );
    expect(decodeSpatialDropCommand(encoded)).not.toBeNull();
    expect(decodeSpatialDropCommand(encodedWorkspaceGap)).not.toBeNull();
    expect(
      decodeSpatialDropCommand(
        " ".repeat(SPATIAL_DROP_COMMAND_LIMITS.documentCharacters + 1),
      ),
    ).toBeNull();
  });

  it.each([
    { ...command(), format: "other" },
    { ...command(), version: 1 },
    { ...command(), version: 3 },
    { ...command(), requestId: 0 },
    { ...command(), requestId: 1.5 },
    { ...command(), requestId: Number.MAX_SAFE_INTEGER + 1 },
    { ...command(), createdAt: -1 },
    { ...command(), createdAt: 1.5 },
    { ...command(), createdAt: Number.MAX_SAFE_INTEGER + 1 },
    { ...command(), unexpected: true },
    {
      ...command(),
      source: { ...source, windowId: "" },
    },
    {
      ...command(),
      source: { ...source, windowId: "window\u0000source" },
    },
    {
      ...command(),
      source: {
        ...source,
        windowId: "w".repeat(
          SPATIAL_DROP_COMMAND_LIMITS.identifierCharacters + 1,
        ),
      },
    },
    {
      ...command(),
      source: { ...source, unexpected: true },
    },
    {
      ...command(),
      target: { ...targets[0], position: "before" },
    },
    {
      ...command(),
      target: { ...targets[1], position: "inside" },
    },
    {
      ...command(),
      target: { ...targets[1], targetColumnId: "unsupported" },
    },
    {
      ...command(),
      target: { ...targets[1], targetWindowId: "" },
    },
    {
      ...command(),
      target: { ...targets[1], kind: "unknown" },
    },
    {
      ...command(),
      target: { ...workspaceGapTarget, adjacentDesktopId: "" },
    },
    {
      ...command(),
      target: {
        ...workspaceGapTarget,
        adjacentDesktopId: workspaceGapTarget.anchorDesktopId,
      },
    },
    {
      ...command(),
      target: { ...workspaceGapTarget, desktopId: "unsupported" },
    },
    {
      ...command(),
      target: { ...workspaceGapTarget, position: "inside" },
    },
  ])("rejects malformed or excess encoded input: %#", (value) => {
    expect(encodeSpatialDropCommand(value)).toBeNull();
    expect(decodeSpatialDropCommand(JSON.stringify(value))).toBeNull();
  });

  it.each([null, undefined, "", "null", "[]", "{}", "not-json"])(
    "rejects invalid documents: %o",
    (document) => {
      expect(decodeSpatialDropCommand(document)).toBeNull();
    },
  );

  it("accepts only safe request and timestamp boundaries", () => {
    const encoded = encodeSpatialDropCommand({
      ...command(),
      createdAt: Number.MAX_SAFE_INTEGER,
      requestId: Number.MAX_SAFE_INTEGER,
    });

    expect(decodeSpatialDropCommand(encoded)).toMatchObject({
      createdAt: Number.MAX_SAFE_INTEGER,
      requestId: Number.MAX_SAFE_INTEGER,
    });
    expect(
      decodeSpatialDropCommand(
        JSON.stringify({ ...command(), createdAt: 0, requestId: 1 }),
      ),
    ).toMatchObject({ createdAt: 0, requestId: 1 });
    expect(
      encodeSpatialDropCommand({ ...command(), createdAt: -0 }),
    ).toBeNull();
    expect(
      decodeSpatialDropCommand(
        JSON.stringify(command()).replace(
          '"createdAt":1751000000000',
          '"createdAt":-0',
        ),
      ),
    ).toBeNull();
  });

  it("rejects hostile objects without invoking their accessors", () => {
    let reads = 0;
    const hostileSource = Object.defineProperty({ ...source }, "windowId", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("unavailable");
      },
    });
    const hostileCommand = new Proxy(command(), {
      ownKeys(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      encodeSpatialDropCommand({ ...command(), source: hostileSource }),
    ).toBeNull();
    expect(reads).toBe(0);
    expect(encodeSpatialDropCommand(hostileCommand)).toBeNull();
    expect(
      encodeSpatialDropCommand({ ...command(), [Symbol("excess")]: true }),
    ).toBeNull();
  });

  it("has no weak references, timers, or retained command cache", () => {
    expect(codecSource).not.toMatch(
      /Weak(?:Map|Set)|setTimeout|setInterval|new (?:Map|Set)(?:\s*<|\s*\()/u,
    );
  });
});
