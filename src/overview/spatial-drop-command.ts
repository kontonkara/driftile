import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export const SPATIAL_DROP_COMMAND_FORMAT = "driftile-spatial-drop";
export const SPATIAL_DROP_COMMAND_VERSION = 3;

const MAXIMUM_COMMAND_IDENTIFIER_FIELDS = 8;
const MAXIMUM_JSON_IDENTIFIER_EXPANSION = 6;
const MAXIMUM_COMMAND_STRUCTURE_IDENTIFIER_UNITS = 4;

export const SPATIAL_DROP_COMMAND_LIMITS = Object.freeze({
  documentCharacters: Math.min(
    LAYOUT_PERSISTENCE_LIMITS.documentCharacters,
    LAYOUT_PERSISTENCE_LIMITS.identifierCharacters *
      (MAXIMUM_COMMAND_IDENTIFIER_FIELDS * MAXIMUM_JSON_IDENTIFIER_EXPANSION +
        MAXIMUM_COMMAND_STRUCTURE_IDENTIFIER_UNITS),
  ),
  identifierCharacters: LAYOUT_PERSISTENCE_LIMITS.identifierCharacters,
});

export type SpatialDropPosition = "after" | "before";
export type SpatialDropSourceScope = "column" | "window";

export interface SpatialDropSource {
  readonly activityId: string;
  readonly desktopId: string;
  readonly outputId: string;
  readonly scope: SpatialDropSourceScope;
  readonly windowId: string;
}

interface SpatialDropTargetContext {
  readonly activityId: string;
  readonly outputId: string;
}

interface SpatialDropDesktopTargetContext extends SpatialDropTargetContext {
  readonly desktopId: string;
}

export interface SpatialDropEmptyRowTarget extends SpatialDropDesktopTargetContext {
  readonly kind: "empty-row";
}

export interface SpatialDropColumnBoundaryTarget extends SpatialDropDesktopTargetContext {
  readonly kind: "column-boundary";
  readonly position: SpatialDropPosition;
  readonly targetWindowId: string;
}

export interface SpatialDropStackInsertionTarget extends SpatialDropDesktopTargetContext {
  readonly kind: "stack-insertion";
  readonly position: SpatialDropPosition;
  readonly targetWindowId: string;
}

export interface SpatialDropWorkspaceGapTarget extends SpatialDropTargetContext {
  readonly adjacentDesktopId: string;
  readonly anchorDesktopId: string;
  readonly kind: "workspace-gap";
  readonly position: SpatialDropPosition;
}

export type SpatialDropTarget =
  | SpatialDropColumnBoundaryTarget
  | SpatialDropEmptyRowTarget
  | SpatialDropStackInsertionTarget
  | SpatialDropWorkspaceGapTarget;

export interface SpatialDropCommand {
  readonly createdAt: number;
  readonly format: typeof SPATIAL_DROP_COMMAND_FORMAT;
  readonly requestId: number;
  readonly source: SpatialDropSource;
  readonly target: SpatialDropTarget;
  readonly version: typeof SPATIAL_DROP_COMMAND_VERSION;
}

const COMMAND_KEYS = [
  "createdAt",
  "format",
  "requestId",
  "source",
  "target",
  "version",
] as const;
const SOURCE_KEYS = [
  "activityId",
  "desktopId",
  "outputId",
  "scope",
  "windowId",
] as const;
const EMPTY_ROW_TARGET_KEYS = [
  "activityId",
  "desktopId",
  "kind",
  "outputId",
] as const;
const ANCHORED_TARGET_KEYS = [
  "activityId",
  "desktopId",
  "kind",
  "outputId",
  "position",
  "targetWindowId",
] as const;
const WORKSPACE_GAP_TARGET_KEYS = [
  "activityId",
  "adjacentDesktopId",
  "anchorDesktopId",
  "kind",
  "outputId",
  "position",
] as const;

export function encodeSpatialDropCommand(value: unknown): string | null {
  try {
    const command = readCommand(value);
    if (command === null) {
      return null;
    }

    const document = JSON.stringify(command);
    return document.length <= SPATIAL_DROP_COMMAND_LIMITS.documentCharacters
      ? document
      : null;
  } catch {
    return null;
  }
}

export function decodeSpatialDropCommand(
  document: unknown,
): SpatialDropCommand | null {
  if (
    typeof document !== "string" ||
    document.length === 0 ||
    document.length > SPATIAL_DROP_COMMAND_LIMITS.documentCharacters
  ) {
    return null;
  }

  try {
    return readCommand(JSON.parse(document) as unknown);
  } catch {
    return null;
  }
}

function readCommand(value: unknown): SpatialDropCommand | null {
  const candidate = readExactRecord(value, COMMAND_KEYS);
  if (candidate === null) {
    return null;
  }

  const createdAt = candidate["createdAt"];
  const format = candidate["format"];
  const requestId = candidate["requestId"];
  const source = readSource(candidate["source"]);
  const target = readTarget(candidate["target"]);
  const version = candidate["version"];

  if (
    format !== SPATIAL_DROP_COMMAND_FORMAT ||
    version !== SPATIAL_DROP_COMMAND_VERSION ||
    !isPositiveSafeInteger(requestId) ||
    !isNonNegativeSafeInteger(createdAt) ||
    source === null ||
    target === null ||
    (source.scope === "column" && target.kind === "stack-insertion")
  ) {
    return null;
  }

  return Object.freeze({
    createdAt,
    format,
    requestId,
    source,
    target,
    version,
  });
}

function readSource(value: unknown): SpatialDropSource | null {
  const candidate = readExactRecord(value, SOURCE_KEYS);
  if (candidate === null) {
    return null;
  }

  const activityId = candidate["activityId"];
  const desktopId = candidate["desktopId"];
  const outputId = candidate["outputId"];
  const scope = candidate["scope"];
  const windowId = candidate["windowId"];

  return isIdentifier(activityId) &&
    isIdentifier(desktopId) &&
    isIdentifier(outputId) &&
    isSourceScope(scope) &&
    isIdentifier(windowId)
    ? Object.freeze({ activityId, desktopId, outputId, scope, windowId })
    : null;
}

function readTarget(value: unknown): SpatialDropTarget | null {
  const kind = readOwnDataProperty(value, "kind");
  if (kind === "empty-row") {
    const candidate = readExactRecord(value, EMPTY_ROW_TARGET_KEYS);
    return candidate === null ? null : readEmptyRowTarget(candidate);
  }
  if (kind === "column-boundary" || kind === "stack-insertion") {
    const candidate = readExactRecord(value, ANCHORED_TARGET_KEYS);
    return candidate === null ? null : readAnchoredTarget(candidate, kind);
  }
  if (kind === "workspace-gap") {
    const candidate = readExactRecord(value, WORKSPACE_GAP_TARGET_KEYS);
    return candidate === null ? null : readWorkspaceGapTarget(candidate);
  }
  return null;
}

function readEmptyRowTarget(
  candidate: Record<string, unknown>,
): SpatialDropEmptyRowTarget | null {
  const activityId = candidate["activityId"];
  const desktopId = candidate["desktopId"];
  const outputId = candidate["outputId"];

  return isIdentifier(activityId) &&
    isIdentifier(desktopId) &&
    isIdentifier(outputId)
    ? Object.freeze({ activityId, desktopId, kind: "empty-row", outputId })
    : null;
}

function readAnchoredTarget(
  candidate: Record<string, unknown>,
  kind: "column-boundary" | "stack-insertion",
): SpatialDropColumnBoundaryTarget | SpatialDropStackInsertionTarget | null {
  const activityId = candidate["activityId"];
  const desktopId = candidate["desktopId"];
  const outputId = candidate["outputId"];
  const position = candidate["position"];
  const targetWindowId = candidate["targetWindowId"];

  if (
    !isIdentifier(activityId) ||
    !isIdentifier(desktopId) ||
    !isIdentifier(outputId) ||
    !isPosition(position) ||
    !isIdentifier(targetWindowId)
  ) {
    return null;
  }

  return Object.freeze({
    activityId,
    desktopId,
    kind,
    outputId,
    position,
    targetWindowId,
  });
}

function readWorkspaceGapTarget(
  candidate: Record<string, unknown>,
): SpatialDropWorkspaceGapTarget | null {
  const activityId = candidate["activityId"];
  const adjacentDesktopId = candidate["adjacentDesktopId"];
  const anchorDesktopId = candidate["anchorDesktopId"];
  const outputId = candidate["outputId"];
  const position = candidate["position"];

  return isIdentifier(activityId) &&
    isIdentifier(adjacentDesktopId) &&
    isIdentifier(anchorDesktopId) &&
    adjacentDesktopId !== anchorDesktopId &&
    isIdentifier(outputId) &&
    isPosition(position)
    ? Object.freeze({
        activityId,
        adjacentDesktopId,
        anchorDesktopId,
        kind: "workspace-gap",
        outputId,
        position,
      })
    : null;
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
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > SPATIAL_DROP_COMMAND_LIMITS.identifierCharacters
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return false;
    }
  }
  return true;
}

function isPosition(value: unknown): value is SpatialDropPosition {
  return value === "after" || value === "before";
}

function isSourceScope(value: unknown): value is SpatialDropSourceScope {
  return value === "column" || value === "window";
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
