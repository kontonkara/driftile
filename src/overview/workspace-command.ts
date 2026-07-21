import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export const OVERVIEW_WORKSPACE_COMMAND_FORMAT =
  "driftile-overview-workspace-command";
export const OVERVIEW_WORKSPACE_COMMAND_VERSION = 1;

export const OVERVIEW_WORKSPACE_COMMAND_LIMITS = Object.freeze({
  desktopIds: 25,
  desktopNameBytes: 255,
  desktopNameCharacters: 256,
  documentCharacters: Math.min(
    LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
    16_384,
  ),
  identifierCharacters: LAYOUT_PERSISTENCE_LIMITS.identifierCharacters,
});

export interface OverviewWorkspaceCreateAction {
  readonly adjacentDesktopId: string;
  readonly anchorDesktopId: string;
  readonly kind: "create";
  readonly position: number;
}

export interface OverviewWorkspaceRenameAction {
  readonly desktopId: string;
  readonly expectedName: string;
  readonly kind: "rename";
  readonly name: string;
}

export interface OverviewWorkspaceRemoveAction {
  readonly desktopId: string;
  readonly expectedName: string;
  readonly kind: "remove";
}

export type OverviewWorkspaceAction =
  | OverviewWorkspaceCreateAction
  | OverviewWorkspaceRemoveAction
  | OverviewWorkspaceRenameAction;

export interface OverviewWorkspaceCommand {
  readonly action: OverviewWorkspaceAction;
  readonly activityId: string;
  readonly createdAt: number;
  readonly desktopIds: readonly string[];
  readonly format: typeof OVERVIEW_WORKSPACE_COMMAND_FORMAT;
  readonly outputId: string;
  readonly requestId: number;
  readonly version: typeof OVERVIEW_WORKSPACE_COMMAND_VERSION;
}

const COMMAND_KEYS = [
  "action",
  "activityId",
  "createdAt",
  "desktopIds",
  "format",
  "outputId",
  "requestId",
  "version",
] as const;
const CREATE_ACTION_KEYS = [
  "adjacentDesktopId",
  "anchorDesktopId",
  "kind",
  "position",
] as const;
const RENAME_ACTION_KEYS = [
  "desktopId",
  "expectedName",
  "kind",
  "name",
] as const;
const REMOVE_ACTION_KEYS = ["desktopId", "expectedName", "kind"] as const;

export function encodeOverviewWorkspaceCommand(value: unknown): string | null {
  try {
    const command = readCommand(value);
    if (command === null) {
      return null;
    }

    const document = JSON.stringify(command);
    return document.length <=
      OVERVIEW_WORKSPACE_COMMAND_LIMITS.documentCharacters
      ? document
      : null;
  } catch {
    return null;
  }
}

export function decodeOverviewWorkspaceCommand(
  document: unknown,
): OverviewWorkspaceCommand | null {
  if (
    typeof document !== "string" ||
    document.length === 0 ||
    document.length > OVERVIEW_WORKSPACE_COMMAND_LIMITS.documentCharacters
  ) {
    return null;
  }

  try {
    return readCommand(JSON.parse(document) as unknown);
  } catch {
    return null;
  }
}

function readCommand(value: unknown): OverviewWorkspaceCommand | null {
  const candidate = readExactRecord(value, COMMAND_KEYS);
  if (candidate === null) {
    return null;
  }

  const action = readAction(candidate["action"]);
  const activityId = candidate["activityId"];
  const createdAt = candidate["createdAt"];
  const desktopIds = readDesktopIds(candidate["desktopIds"]);
  const format = candidate["format"];
  const outputId = candidate["outputId"];
  const requestId = candidate["requestId"];
  const version = candidate["version"];

  if (
    action === null ||
    !isIdentifier(activityId) ||
    !isNonNegativeSafeInteger(createdAt) ||
    desktopIds === null ||
    format !== OVERVIEW_WORKSPACE_COMMAND_FORMAT ||
    !isIdentifier(outputId) ||
    !isPositiveSafeInteger(requestId) ||
    version !== OVERVIEW_WORKSPACE_COMMAND_VERSION ||
    !actionMatchesDesktopSnapshot(action, desktopIds)
  ) {
    return null;
  }

  return Object.freeze({
    action,
    activityId,
    createdAt,
    desktopIds,
    format,
    outputId,
    requestId,
    version,
  });
}

function readAction(value: unknown): OverviewWorkspaceAction | null {
  const kind = readOwnDataProperty(value, "kind");
  if (kind === "create") {
    const candidate = readExactRecord(value, CREATE_ACTION_KEYS);
    if (candidate === null) {
      return null;
    }

    const adjacentDesktopId = candidate["adjacentDesktopId"];
    const anchorDesktopId = candidate["anchorDesktopId"];
    const position = candidate["position"];
    return isIdentifier(adjacentDesktopId) &&
      isIdentifier(anchorDesktopId) &&
      adjacentDesktopId !== anchorDesktopId &&
      isPositiveSafeInteger(position) &&
      position <= OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopIds
      ? Object.freeze({
          adjacentDesktopId,
          anchorDesktopId,
          kind,
          position,
        })
      : null;
  }

  if (kind === "rename") {
    const candidate = readExactRecord(value, RENAME_ACTION_KEYS);
    if (candidate === null) {
      return null;
    }

    const desktopId = candidate["desktopId"];
    const expectedName = candidate["expectedName"];
    const name = candidate["name"];
    return isIdentifier(desktopId) &&
      isExpectedDesktopName(expectedName) &&
      isDesktopName(name)
      ? Object.freeze({ desktopId, expectedName, kind, name })
      : null;
  }

  if (kind === "remove") {
    const candidate = readExactRecord(value, REMOVE_ACTION_KEYS);
    if (candidate === null) {
      return null;
    }

    const desktopId = candidate["desktopId"];
    const expectedName = candidate["expectedName"];
    return isIdentifier(desktopId) && isExpectedDesktopName(expectedName)
      ? Object.freeze({ desktopId, expectedName, kind })
      : null;
  }

  return null;
}

function readDesktopIds(value: unknown): readonly string[] | null {
  const candidates = readExactArray(value);
  if (
    candidates === null ||
    candidates.length < 1 ||
    candidates.length > OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopIds
  ) {
    return null;
  }

  const result: string[] = [];
  for (const candidate of candidates) {
    if (!isIdentifier(candidate) || result.includes(candidate)) {
      return null;
    }
    result.push(candidate);
  }

  return Object.freeze(result);
}

function actionMatchesDesktopSnapshot(
  action: OverviewWorkspaceAction,
  desktopIds: readonly string[],
): boolean {
  if (action.kind === "rename" || action.kind === "remove") {
    return desktopIds.includes(action.desktopId);
  }

  return (
    action.position < desktopIds.length &&
    desktopIds[action.position] === action.anchorDesktopId &&
    desktopIds[action.position - 1] === action.adjacentDesktopId
  );
}

function readExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!hasPlainObjectPrototype(value)) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length) {
      return null;
    }

    const result: Record<string, unknown> = {};
    for (const expectedKey of expectedKeys) {
      if (!ownKeys.includes(expectedKey)) {
        return null;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, expectedKey);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        return null;
      }
      result[expectedKey] = descriptor.value;
    }

    return result;
  } catch {
    return null;
  }
}

function readExactArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length: unknown =
      lengthDescriptor !== undefined && "value" in lengthDescriptor
        ? (lengthDescriptor.value as unknown)
        : undefined;
    if (
      !("value" in (lengthDescriptor ?? {})) ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      lengthDescriptor?.enumerable !== false
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1 || !ownKeys.includes("length")) {
      return null;
    }

    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!ownKeys.includes(key)) {
        return null;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        return null;
      }
      result.push(descriptor.value);
    }

    return result;
  } catch {
    return null;
  }
}

function readOwnDataProperty(value: unknown, key: string): unknown {
  try {
    if (!hasPlainObjectPrototype(value)) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function hasPlainObjectPrototype(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= OVERVIEW_WORKSPACE_COMMAND_LIMITS.identifierCharacters &&
    hasPlainUnicodeWithoutControls(value)
  );
}

function isDesktopName(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameCharacters ||
    !hasPlainUnicodeWithoutControls(value)
  ) {
    return false;
  }

  const bytes = utf8ByteLength(value);
  return (
    bytes !== null &&
    bytes <= OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameBytes
  );
}

function isExpectedDesktopName(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameCharacters ||
    !hasPlainUnicodeWithoutControls(value)
  ) {
    return false;
  }

  const bytes = utf8ByteLength(value);
  return (
    bytes !== null &&
    bytes <= OVERVIEW_WORKSPACE_COMMAND_LIMITS.desktopNameBytes
  );
}

function hasPlainUnicodeWithoutControls(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code <= 31 ||
      (code >= 127 && code <= 159) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return false;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (trailing < 0xdc00 || trailing > 0xdfff) {
        return false;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }

  return true;
}

function utf8ByteLength(value: string): number | null {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (trailing < 0xdc00 || trailing > 0xdfff) {
        return null;
      }
      bytes += 4;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return null;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0)
  );
}
