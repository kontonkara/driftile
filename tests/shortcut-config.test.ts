import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { shortcutActions, type ShortcutAction } from "../src/shortcut-actions";
import {
  SHORTCUT_CONFIG_VERSION,
  ShortcutConfigError,
  decodeShortcutConfig,
  parseShortcutConfig,
} from "../src/shortcut-config";
import { encodeShortcut } from "../src/shortcut-profile";

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("test fixture is unavailable");
  }

  return value;
}

const leftAction = action("driftile_focus_column_left");
const rightAction = action("driftile_focus_column_right");
const catalogUnboundAction = required(
  shortcutActions.find((candidate) => candidate.defaultSequence === undefined),
);

function action(name: string): ShortcutAction {
  return required(shortcutActions.find((candidate) => candidate.name === name));
}

function config(bindings: Record<string, unknown>): {
  readonly bindings: Record<string, unknown>;
  readonly version: 1;
} {
  return { bindings, version: SHORTCUT_CONFIG_VERSION };
}

describe("custom shortcut profile codec", () => {
  it("resolves listed actions, exact unbinds, and multiple alternatives", () => {
    const profile = decodeShortcutConfig(
      config({
        [rightAction.name]: [],
        [leftAction.name]: ["Alt+Meta+a", "Ctrl+Meta+b"],
      }),
    );

    expect(profile.id).toMatch(/^custom-v1:sha256:[0-9a-f]{64}$/);
    expect(profile.mode).toBe("replace-listed");
    expect(profile.version).toBe(1);
    expect(profile.targets.map((target) => target.action.name)).toEqual([
      leftAction.name,
      rightAction.name,
    ]);
    expect(profile.targets[0]).toEqual({
      action: leftAction,
      shortcuts: [
        { key: encodeShortcut("Meta+Ctrl+B"), sequence: "Meta+Ctrl+B" },
        { key: encodeShortcut("Meta+Alt+A"), sequence: "Meta+Alt+A" },
      ],
    });
    expect(profile.targets[1]).toEqual({
      action: rightAction,
      shortcuts: [],
    });
  });

  it("leaves omitted catalog actions outside the replacement targets", () => {
    const profile = decodeShortcutConfig(config({ [leftAction.name]: [] }));
    const bothUnbound = decodeShortcutConfig(
      config({ [leftAction.name]: [], [rightAction.name]: [] }),
    );

    expect(profile.targets).toHaveLength(1);
    expect(profile.targets[0]?.action.name).toBe(leftAction.name);
    expect(profile.id).not.toBe(bothUnbound.id);
  });

  it("supports catalog actions without a default binding", () => {
    const profile = decodeShortcutConfig(
      config({ [catalogUnboundAction.name]: ["Shift+Meta+z"] }),
    );

    expect(profile.targets).toEqual([
      {
        action: catalogUnboundAction,
        shortcuts: [
          {
            key: encodeShortcut("Meta+Shift+Z"),
            sequence: "Meta+Shift+Z",
          },
        ],
      },
    ]);
  });

  it("uses normalized semantics rather than input order or JSON bytes for identity", () => {
    const first = parseShortcutConfig(`{
      "bindings": {
        "${rightAction.name}": ["Shift+Meta+z"],
        "${leftAction.name}": ["Alt+Meta+a", "Ctrl+Meta+b"]
      },
      "version": 1
    }`);
    const second = parseShortcutConfig(
      JSON.stringify({
        version: 1,
        bindings: {
          [leftAction.name]: ["Meta+Ctrl+B", "Meta+Alt+A"],
          [rightAction.name]: ["Meta+Shift+Z"],
        },
      }),
    );
    const changed = decodeShortcutConfig(
      config({
        [leftAction.name]: ["Meta+Ctrl+B", "Meta+Alt+A"],
        [rightAction.name]: [],
      }),
    );

    expect(first).toEqual(second);
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(
      "custom-v1:sha256:760bf72294679860e510fd47f8a2ac58d99dc32bd6a5f3cb2ac60a418db20eb4",
    );
    expect(first.id).not.toBe(changed.id);

    const canonical = JSON.stringify({
      bindings: first.targets.map((target) => ({
        action: target.action.name,
        shortcuts: target.shortcuts.map(
          (shortcut) => [shortcut.key, 0, 0, 0] as const,
        ),
      })),
      mode: "replace-listed",
      version: 1,
    });
    const digest = createHash("sha256").update(canonical, "utf8").digest("hex");

    expect(first.id).toBe(`custom-v1:sha256:${digest}`);
  });

  it.each([
    ["a null root", null, "$ must be an object"],
    ["an array root", [], "$ must be an object"],
    ["a missing bindings field", { version: 1 }, "must contain exactly"],
    ["a missing version field", { bindings: {} }, "must contain exactly"],
    [
      "an unknown root field",
      { bindings: { [leftAction.name]: [] }, extra: true, version: 1 },
      "must contain exactly",
    ],
    [
      "a future version",
      { bindings: { [leftAction.name]: [] }, version: 2 },
      "$.version must be 1",
    ],
    [
      "a string version",
      { bindings: { [leftAction.name]: [] }, version: "1" },
      "$.version must be 1",
    ],
    ["null bindings", { bindings: null, version: 1 }, "must be an object"],
    ["array bindings", { bindings: [], version: 1 }, "must be an object"],
    ["empty bindings", { bindings: {}, version: 1 }, "at least one action"],
  ])("rejects %s", (_label, value, message) => {
    expect(() => decodeShortcutConfig(value)).toThrow(message);
  });

  it("rejects symbol fields at every schema object boundary", () => {
    const root = config({ [leftAction.name]: [] }) as Record<
      PropertyKey,
      unknown
    >;
    root[Symbol("extra")] = true;
    const bindings = config({ [leftAction.name]: [] });
    bindings.bindings[Symbol("extra") as unknown as string] = [];

    expect(() => decodeShortcutConfig(root)).toThrow(
      "must contain only string fields",
    );
    expect(() => decodeShortcutConfig(bindings)).toThrow(
      "must contain only string fields",
    );
  });

  it("rejects unknown actions and non-array binding values", () => {
    expect(() =>
      decodeShortcutConfig(config({ driftile_unknown_action: [] })),
    ).toThrow("is not a known shortcut action");
    expect(() =>
      decodeShortcutConfig(config({ [leftAction.name]: "Meta+H" })),
    ).toThrow("must be an array of single-chord strings");
  });

  it.each([42, null, {}, ["Meta+H"]])(
    "rejects a non-string shortcut value %#",
    (value) => {
      expect(() =>
        decodeShortcutConfig(config({ [leftAction.name]: [value] })),
      ).toThrow("must be a single-chord string");
    },
  );

  it.each(["Meta+H,Meta+J", "Meta+Space", "Meta+Meta+H", "Meta+"])(
    "rejects unsupported shortcut sequence %s",
    (sequence) => {
      expect(() =>
        decodeShortcutConfig(config({ [leftAction.name]: [sequence] })),
      ).toThrow("contains an unsupported single-chord shortcut");
    },
  );

  it.each(["Meta+Shift+-", "Meta+Shift+=", "Meta+Shift+1"])(
    "rejects layout-dependent shifted printable spelling %s",
    (sequence) => {
      expect(() =>
        decodeShortcutConfig(config({ [leftAction.name]: [sequence] })),
      ).toThrow("must use the produced character without Shift");
    },
  );

  it("rejects duplicate normalized keys within one action", () => {
    expect(() =>
      decodeShortcutConfig(
        config({
          [leftAction.name]: ["Meta+Ctrl+h", "Ctrl+Meta+H"],
        }),
      ),
    ).toThrow('contains the duplicate normalized shortcut "Meta+Ctrl+H"');
  });

  it("rejects one desired normalized key assigned to different actions", () => {
    expect(() =>
      decodeShortcutConfig(
        config({
          [leftAction.name]: ["Meta+h"],
          [rightAction.name]: ["Meta+H"],
        }),
      ),
    ).toThrow(`conflicts with $.bindings["${leftAction.name}"] on "Meta+H"`);
  });

  it("reports invalid JSON separately from schema errors", () => {
    expect(() => parseShortcutConfig(42 as unknown as string)).toThrow(
      "Shortcut configuration must be JSON text",
    );
    expect(() => parseShortcutConfig("{")).toThrow(ShortcutConfigError);
    expect(() => parseShortcutConfig("{")).toThrow(
      "Invalid shortcut configuration JSON",
    );
    expect(() => parseShortcutConfig("null")).toThrow("$ must be an object");
  });

  it("wraps hostile unknown objects in a configuration error", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("blocked reflection");
        },
      },
    );

    expect(() => decodeShortcutConfig(hostile)).toThrow(ShortcutConfigError);
    expect(() => decodeShortcutConfig(hostile)).toThrow(
      "Could not decode shortcut configuration: blocked reflection",
    );
  });

  it("returns detached recursively immutable profiles", () => {
    const alternatives = ["Meta+H"];
    const input = config({ [leftAction.name]: alternatives });
    const profile = decodeShortcutConfig(input);
    const target = required(profile.targets[0]);
    const shortcut = required(target.shortcuts[0]);

    alternatives[0] = "Meta+L";
    input.bindings[leftAction.name] = [];

    expect(shortcut.sequence).toBe("Meta+H");
    expect(target.action).not.toBe(leftAction);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.targets)).toBe(true);
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.action)).toBe(true);
    expect(Object.isFrozen(target.shortcuts)).toBe(true);
    expect(Object.isFrozen(shortcut)).toBe(true);
    expect(Reflect.set(profile, "mode", "other")).toBe(false);
    expect(Reflect.set(shortcut, "sequence", "Meta+L")).toBe(false);
  });
});
