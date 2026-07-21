import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAYOUT_PERSISTENCE_LIMITS } from "../src/core/layout-persistence";
import {
  decodeOverviewWorkspaceCommand,
  encodeOverviewWorkspaceCommand,
  OVERVIEW_WORKSPACE_COMMAND_FORMAT,
  OVERVIEW_WORKSPACE_COMMAND_LIMITS,
  OVERVIEW_WORKSPACE_COMMAND_VERSION,
  type OverviewWorkspaceAction,
  type OverviewWorkspaceCommand,
} from "../src/overview/workspace-command";

const codecSource = readFileSync(
  new URL("../src/overview/workspace-command.ts", import.meta.url),
  "utf8",
);

const desktopIds = Object.freeze([
  "desktop-leading",
  "desktop-work",
  "desktop-trailing",
]);

const createAction = Object.freeze({
  adjacentDesktopId: "desktop-leading",
  anchorDesktopId: "desktop-work",
  kind: "create",
  position: 1,
}) satisfies OverviewWorkspaceAction;
const renameAction = Object.freeze({
  desktopId: "desktop-work",
  expectedName: "Work",
  kind: "rename",
  name: "Development 🦀",
}) satisfies OverviewWorkspaceAction;
const removeAction = Object.freeze({
  desktopId: "desktop-work",
  expectedName: "Work",
  kind: "remove",
}) satisfies OverviewWorkspaceAction;
const actions = Object.freeze([createAction, renameAction, removeAction]);

function command(
  action: OverviewWorkspaceAction = createAction,
  ids: readonly string[] = desktopIds,
): OverviewWorkspaceCommand {
  return {
    action,
    activityId: "activity-a",
    createdAt: 1_751_000_000_000,
    desktopIds: ids,
    format: OVERVIEW_WORKSPACE_COMMAND_FORMAT,
    outputId: "output-a",
    requestId: 41,
    version: OVERVIEW_WORKSPACE_COMMAND_VERSION,
  };
}

describe("overview workspace command codec", () => {
  it.each(actions)("round-trips and freezes the $kind action", (action) => {
    const encoded = encodeOverviewWorkspaceCommand(command(action));
    const decoded = decodeOverviewWorkspaceCommand(encoded);

    expect(encoded).not.toBeNull();
    expect(decoded).toEqual(command(action));
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded?.action)).toBe(true);
    expect(Object.isFrozen(decoded?.desktopIds)).toBe(true);
    expect(encodeOverviewWorkspaceCommand(decoded)).toBe(encoded);
  });

  it("uses a numeric exact interior position with both adjacent anchors", () => {
    const expected = command({
      adjacentDesktopId: "desktop-work",
      anchorDesktopId: "desktop-trailing",
      kind: "create",
      position: 2,
    });

    expect(
      decodeOverviewWorkspaceCommand(encodeOverviewWorkspaceCommand(expected)),
    ).toEqual(expected);
    expect(
      encodeOverviewWorkspaceCommand({
        ...expected,
        action: { ...expected.action, position: 0 },
      }),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...expected,
        action: { ...expected.action, position: 3 },
      }),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...expected,
        action: {
          ...expected.action,
          adjacentDesktopId: "desktop-leading",
        },
      }),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...expected,
        action: { ...expected.action, anchorDesktopId: "desktop-work" },
      }),
    ).toBeNull();
  });

  it("keeps rename names exact while accepting an unnamed live desktop", () => {
    const unnamedRename = command({
      desktopId: "desktop-work",
      expectedName: "",
      kind: "rename",
      name: " Work  review ",
    });
    const unnamedRemove = command({
      desktopId: "desktop-work",
      expectedName: "",
      kind: "remove",
    });

    expect(
      decodeOverviewWorkspaceCommand(
        encodeOverviewWorkspaceCommand(unnamedRename),
      )?.action,
    ).toEqual(unnamedRename.action);
    expect(
      decodeOverviewWorkspaceCommand(
        encodeOverviewWorkspaceCommand(unnamedRemove),
      )?.action,
    ).toEqual(unnamedRemove.action);
    expect(encodeOverviewWorkspaceCommand(unnamedRename)).toContain(
      '"name":" Work  review "',
    );
  });

  it("bounds one through twenty-five unique ordered desktop ids", () => {
    const one = command(
      {
        desktopId: "desktop-1",
        expectedName: "Desktop 1",
        kind: "remove",
      },
      ["desktop-1"],
    );
    const maximumIds = Array.from(
      { length: OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopIds },
      (_, index) => `desktop-${String(index + 1)}`,
    );
    const maximum = command(
      {
        desktopId: maximumIds[12] ?? "",
        expectedName: "Desktop 13",
        kind: "rename",
        name: "Work",
      },
      maximumIds,
    );

    expect(
      decodeOverviewWorkspaceCommand(encodeOverviewWorkspaceCommand(one)),
    ).toEqual(one);
    expect(
      decodeOverviewWorkspaceCommand(encodeOverviewWorkspaceCommand(maximum)),
    ).toEqual(maximum);
    expect(
      encodeOverviewWorkspaceCommand(command(renameAction, [])),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand(
        command(renameAction, [...maximumIds, "desktop-26"]),
      ),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand(
        command(renameAction, ["desktop-work", "desktop-work"]),
      ),
    ).toBeNull();
  });

  it("requires every action reference to belong to the exact snapshot", () => {
    expect(
      encodeOverviewWorkspaceCommand(
        command({
          desktopId: "desktop-missing",
          expectedName: "Missing",
          kind: "rename",
          name: "Other",
        }),
      ),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand(
        command({
          desktopId: "desktop-missing",
          expectedName: "Missing",
          kind: "remove",
        }),
      ),
    ).toBeNull();
  });

  it("shares identifier bounds and keeps the complete document bounded", () => {
    expect(OVERVIEW_WORKSPACE_COMMAND_LIMITS.identifierCharacters).toBe(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters,
    );
    expect(OVERVIEW_WORKSPACE_COMMAND_LIMITS.documentCharacters).toBeLessThan(
      LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
    );

    const identifiers = Array.from(
      { length: OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopIds },
      (_, index) =>
        `${String(index).padStart(2, "0")}${"x".repeat(
          OVERVIEW_WORKSPACE_COMMAND_LIMITS.identifierCharacters - 2,
        )}`,
    );
    const maximum = command(
      {
        desktopId: identifiers[1] ?? "",
        expectedName: "é".repeat(127),
        kind: "rename",
        name: "x".repeat(OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameBytes),
      },
      identifiers,
    );
    const encoded = encodeOverviewWorkspaceCommand({
      ...maximum,
      activityId: "a".repeat(
        OVERVIEW_WORKSPACE_COMMAND_LIMITS.identifierCharacters,
      ),
      outputId: "o".repeat(
        OVERVIEW_WORKSPACE_COMMAND_LIMITS.identifierCharacters,
      ),
    });

    expect(encoded).not.toBeNull();
    expect(encoded?.length).toBeLessThanOrEqual(
      OVERVIEW_WORKSPACE_COMMAND_LIMITS.documentCharacters,
    );
    expect(decodeOverviewWorkspaceCommand(encoded)).not.toBeNull();
    expect(
      decodeOverviewWorkspaceCommand(
        " ".repeat(OVERVIEW_WORKSPACE_COMMAND_LIMITS.documentCharacters + 1),
      ),
    ).toBeNull();
  });

  it.each([
    { ...command(), format: "other" },
    { ...command(), version: 2 },
    { ...command(), requestId: 0 },
    { ...command(), requestId: 1.5 },
    { ...command(), requestId: Number.MAX_SAFE_INTEGER + 1 },
    { ...command(), createdAt: -1 },
    { ...command(), createdAt: 1.5 },
    { ...command(), createdAt: Number.MAX_SAFE_INTEGER + 1 },
    { ...command(), unexpected: true },
    { ...command(), activityId: "" },
    { ...command(), activityId: "activity\u0085a" },
    { ...command(), outputId: "output\u2028a" },
    { ...command(), desktopIds: ["desktop-leading", "desktop\u0000work"] },
    { ...command(), desktopIds: ["desktop-leading", "desktop\ud800work"] },
    { ...command(), action: { ...createAction, position: 1.5 } },
    { ...command(), action: { ...createAction, position: "before" } },
    { ...command(), action: { ...createAction, insertionIndex: 1 } },
    { ...command(), action: { ...renameAction, name: "" } },
    { ...command(), action: { ...renameAction, name: "bad\u0009name" } },
    { ...command(), action: { ...renameAction, name: "bad\u2029name" } },
    { ...command(), action: { ...renameAction, name: "bad\udc00name" } },
    {
      ...command(),
      action: { ...renameAction, expectedName: "bad\u007fname" },
    },
    { ...command(), action: { ...removeAction, name: "unsupported" } },
    { ...command(), action: { ...removeAction, kind: "delete" } },
  ])("rejects malformed or excess input: %#", (value) => {
    expect(encodeOverviewWorkspaceCommand(value)).toBeNull();
    expect(decodeOverviewWorkspaceCommand(JSON.stringify(value))).toBeNull();
  });

  it("enforces UTF-8 desktop-name bounds", () => {
    const maximumAsciiName = "a".repeat(
      OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameBytes,
    );
    const validAscii = command({
      desktopId: "desktop-work",
      expectedName: "",
      kind: "rename",
      name: maximumAsciiName,
    });
    const validUnicode = command({
      desktopId: "desktop-work",
      expectedName: "é".repeat(127),
      kind: "rename",
      name: "é".repeat(127),
    });

    expect(encodeOverviewWorkspaceCommand(validAscii)).not.toBeNull();
    expect(encodeOverviewWorkspaceCommand(validUnicode)).not.toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...validAscii,
        action: { ...validAscii.action, name: `${maximumAsciiName}a` },
      }),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...validUnicode,
        action: {
          ...validUnicode.action,
          expectedName: "é".repeat(128),
        },
      }),
    ).toBeNull();
  });

  it("accepts only safe request and timestamp boundaries", () => {
    const encoded = encodeOverviewWorkspaceCommand({
      ...command(),
      createdAt: Number.MAX_SAFE_INTEGER,
      requestId: Number.MAX_SAFE_INTEGER,
    });

    expect(decodeOverviewWorkspaceCommand(encoded)).toMatchObject({
      createdAt: Number.MAX_SAFE_INTEGER,
      requestId: Number.MAX_SAFE_INTEGER,
    });
    expect(
      decodeOverviewWorkspaceCommand(
        JSON.stringify({ ...command(), createdAt: 0, requestId: 1 }),
      ),
    ).toMatchObject({ createdAt: 0, requestId: 1 });
    expect(
      encodeOverviewWorkspaceCommand({ ...command(), createdAt: -0 }),
    ).toBeNull();
    expect(
      decodeOverviewWorkspaceCommand(
        JSON.stringify(command()).replace(
          '"createdAt":1751000000000',
          '"createdAt":-0',
        ),
      ),
    ).toBeNull();
  });

  it("requires plain exact own-data records and dense plain arrays", () => {
    const inherited = Object.create(command()) as Record<string, unknown>;
    const nullPrototype = Object.create(null) as Record<string, unknown>;
    Object.assign(nullPrototype, command());
    const excessSymbol = { ...command(), [Symbol("excess")]: true };
    const sparseIds = ["desktop-leading"];
    sparseIds.length = 3;
    sparseIds[2] = "desktop-trailing";
    const excessIds = [...desktopIds] as Array<string> & { extra?: boolean };
    excessIds.extra = true;

    expect(encodeOverviewWorkspaceCommand(inherited)).toBeNull();
    expect(encodeOverviewWorkspaceCommand(nullPrototype)).toBeNull();
    expect(encodeOverviewWorkspaceCommand(excessSymbol)).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({ ...command(), desktopIds: sparseIds }),
    ).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({ ...command(), desktopIds: excessIds }),
    ).toBeNull();
  });

  it("rejects hostile objects without invoking their accessors", () => {
    let reads = 0;
    const hostileAction = Object.defineProperty({ ...renameAction }, "name", {
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
    const hostileIds = new Proxy([...desktopIds], {
      ownKeys(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      encodeOverviewWorkspaceCommand({ ...command(), action: hostileAction }),
    ).toBeNull();
    expect(reads).toBe(0);
    expect(encodeOverviewWorkspaceCommand(hostileCommand)).toBeNull();
    expect(
      encodeOverviewWorkspaceCommand({
        ...command(),
        desktopIds: hostileIds,
      }),
    ).toBeNull();
  });

  it.each([null, undefined, "", "null", "[]", "{}", "not-json"])(
    "rejects invalid documents: %o",
    (document) => {
      expect(decodeOverviewWorkspaceCommand(document)).toBeNull();
    },
  );

  it("has no weak references, timers, or retained command cache", () => {
    expect(codecSource).not.toMatch(
      /Weak(?:Map|Set)|setTimeout|setInterval|new (?:Map|Set)(?:\s*<|\s*\()/u,
    );
  });
});
