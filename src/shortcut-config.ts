import { createHash } from "node:crypto";

import { shortcutActions, type ShortcutAction } from "./shortcut-actions";
import { encodeShortcut } from "./shortcut-profile";

export const SHORTCUT_CONFIG_VERSION = 1;

export interface ResolvedShortcut {
  readonly key: number;
  readonly sequence: string;
}

export interface ShortcutConfigTarget {
  readonly action: ShortcutAction;
  readonly shortcuts: readonly ResolvedShortcut[];
}

export interface CustomShortcutProfile {
  readonly id: string;
  readonly mode: "replace-listed";
  readonly targets: readonly ShortcutConfigTarget[];
  readonly version: typeof SHORTCUT_CONFIG_VERSION;
}

export class ShortcutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortcutConfigError";
  }
}

const ROOT_FIELDS = ["bindings", "version"] as const;
const PROFILE_MODE = "replace-listed" as const;
const MODIFIER_MASK = 0x1e000000;
const SHIFT_MODIFIER = 0x02000000;

const normalizedModifierNames = [
  [0x10000000, "Meta"],
  [0x04000000, "Ctrl"],
  [0x08000000, "Alt"],
  [0x02000000, "Shift"],
] as const;

const normalizedNamedKeys = new Map<number, string>([
  [0x01000015, "Down"],
  [0x01000011, "End"],
  [0x01000010, "Home"],
  [0x01000012, "Left"],
  [0x01000017, "PgDown"],
  [0x01000016, "PgUp"],
  [0x01000014, "Right"],
  [0x01000013, "Up"],
]);

const actionsByName = new Map(
  shortcutActions.map((action) => [action.name, action] as const),
);

export function parseShortcutConfig(text: string): CustomShortcutProfile {
  if (typeof text !== "string") {
    fail("Shortcut configuration must be JSON text");
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    fail(`Invalid shortcut configuration JSON${detail}`);
  }

  return decodeShortcutConfig(value);
}

export function decodeShortcutConfig(value: unknown): CustomShortcutProfile {
  try {
    return decodeShortcutConfigValue(value);
  } catch (error) {
    if (error instanceof ShortcutConfigError) {
      throw error;
    }

    const detail = error instanceof Error ? `: ${error.message}` : "";
    fail(`Could not decode shortcut configuration${detail}`);
  }
}

function decodeShortcutConfigValue(value: unknown): CustomShortcutProfile {
  const root = strictRecord(value, "$", ROOT_FIELDS);

  if (root["version"] !== SHORTCUT_CONFIG_VERSION) {
    fail(`$.version must be ${String(SHORTCUT_CONFIG_VERSION)}`);
  }

  const bindings = record(root["bindings"], "$.bindings");
  const actionNames = ownStringKeys(bindings, "$.bindings");

  if (actionNames.length === 0) {
    fail("$.bindings must contain at least one action");
  }

  const targets: ShortcutConfigTarget[] = [];
  const desiredOwners = new Map<number, string>();

  for (const actionName of actionNames.sort(compareStrings)) {
    const action = actionsByName.get(actionName);
    const path = bindingPath(actionName);

    if (!action) {
      fail(`${path} is not a known shortcut action`);
    }

    const sequences = bindings[actionName];

    if (!Array.isArray(sequences)) {
      fail(`${path} must be an array of single-chord strings`);
    }

    const shortcuts: ResolvedShortcut[] = [];
    const actionKeys = new Set<number>();

    for (const [index, candidate] of sequences.entries()) {
      const sequencePath = `${path}[${String(index)}]`;

      if (typeof candidate !== "string") {
        fail(`${sequencePath} must be a single-chord string`);
      }

      const shortcut = resolveShortcut(candidate, sequencePath);

      if (actionKeys.has(shortcut.key)) {
        fail(
          `${path} contains the duplicate normalized shortcut ${JSON.stringify(shortcut.sequence)}`,
        );
      }

      const owner = desiredOwners.get(shortcut.key);

      if (owner !== undefined) {
        fail(
          `${path} conflicts with ${bindingPath(owner)} on ${JSON.stringify(shortcut.sequence)}`,
        );
      }

      actionKeys.add(shortcut.key);
      desiredOwners.set(shortcut.key, actionName);
      shortcuts.push(shortcut);
    }

    shortcuts.sort(compareShortcuts);
    targets.push(
      Object.freeze({
        action: freezeAction(action),
        shortcuts: Object.freeze(shortcuts),
      }),
    );
  }

  const frozenTargets = Object.freeze(targets);
  const id = profileId(frozenTargets);

  return Object.freeze({
    id,
    mode: PROFILE_MODE,
    targets: frozenTargets,
    version: SHORTCUT_CONFIG_VERSION,
  });
}

function resolveShortcut(candidate: string, path: string): ResolvedShortcut {
  let key: number;

  try {
    key = encodeShortcut(candidate);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    fail(
      `${path} contains an unsupported single-chord shortcut ${JSON.stringify(candidate)}${detail}`,
    );
  }

  const keyCode = key & ~MODIFIER_MASK;

  if (
    (key & SHIFT_MODIFIER) !== 0 &&
    !normalizedNamedKeys.has(keyCode) &&
    (keyCode < 0x41 || keyCode > 0x5a)
  ) {
    fail(
      `${path} must use the produced character without Shift for a shifted printable key`,
    );
  }

  return Object.freeze({
    key,
    sequence: normalizedSequence(key),
  });
}

function normalizedSequence(key: number): string {
  const parts: string[] = [];

  for (const [modifier, name] of normalizedModifierNames) {
    if ((key & modifier) !== 0) {
      parts.push(name);
    }
  }

  const keyCode = key & ~MODIFIER_MASK;
  const namedKey = normalizedNamedKeys.get(keyCode);

  if (namedKey !== undefined) {
    parts.push(namedKey);
  } else {
    parts.push(String.fromCodePoint(keyCode));
  }

  return parts.join("+");
}

function profileId(targets: readonly ShortcutConfigTarget[]): string {
  const canonical = JSON.stringify({
    bindings: targets.map((target) => ({
      action: target.action.name,
      shortcuts: target.shortcuts.map(
        (shortcut) => [shortcut.key, 0, 0, 0] as const,
      ),
    })),
    mode: PROFILE_MODE,
    version: SHORTCUT_CONFIG_VERSION,
  });
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");

  return `custom-v1:sha256:${digest}`;
}

function freezeAction(action: ShortcutAction): ShortcutAction {
  if (action.defaultSequence === undefined) {
    return Object.freeze({ name: action.name, text: action.text });
  }

  return Object.freeze({
    defaultSequence: action.defaultSequence,
    name: action.name,
    text: action.text,
  });
}

function strictRecord(
  value: unknown,
  path: string,
  fields: readonly string[],
): Record<string, unknown> {
  const candidate = record(value, path);
  const keys = ownStringKeys(candidate, path);

  if (
    keys.length !== fields.length ||
    fields.some(
      (field) => !Object.prototype.hasOwnProperty.call(candidate, field),
    )
  ) {
    fail(`${path} must contain exactly ${quotedList(fields)}`);
  }

  return candidate;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function ownStringKeys(value: Record<string, unknown>, path: string): string[] {
  const keys = Reflect.ownKeys(value);

  if (keys.some((key) => typeof key !== "string")) {
    fail(`${path} must contain only string fields`);
  }

  return keys as string[];
}

function quotedList(values: readonly string[]): string {
  return values.map((value) => JSON.stringify(value)).join(" and ");
}

function bindingPath(actionName: string): string {
  return `$.bindings[${JSON.stringify(actionName)}]`;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function compareShortcuts(
  left: ResolvedShortcut,
  right: ResolvedShortcut,
): number {
  return left.key - right.key || compareStrings(left.sequence, right.sequence);
}

function fail(message: string): never {
  throw new ShortcutConfigError(message);
}
