import type { ColumnWidth, WindowHeight } from "./layout-engine";

export const LAYOUT_PERSISTENCE_FORMAT = "driftile-layout";
export const LAYOUT_PERSISTENCE_VERSION = 1;

export const LAYOUT_PERSISTENCE_LIMITS = Object.freeze({
  columnsPerContext: 512,
  contextFingerprintCharacters: 256,
  contexts: 512,
  documentCharacters: 4_194_304,
  floatingWindows: 4_096,
  identifierCharacters: 256,
  membersPerColumn: 256,
  numericMagnitude: 1_000_000,
  outputs: 32,
  presetIndex: 255,
  windows: 4_096,
});

export interface PersistedOutputV1 {
  readonly key: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly name: string;
  readonly serialNumber?: string;
}

export interface PersistedWindowMatchV1 {
  readonly desktopFileName?: string;
  readonly resourceClass?: string;
  readonly resourceName?: string;
  readonly tag?: string;
  readonly windowRole?: string;
}

export interface PersistedWindowV1 {
  readonly key: string;
  readonly liveId: string;
  readonly sessionMatch?: PersistedWindowMatchV1;
}

export interface PersistedRectV1 {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface PersistedRestoreBaselineV1 {
  readonly clientFrame: PersistedRectV1;
  readonly frame: PersistedRectV1;
  readonly kind: "client" | "frame";
  readonly noBorder: boolean | null;
}

export interface PersistedColumnMemberV1 {
  readonly height?: WindowHeight;
  readonly restoreBaseline?: PersistedRestoreBaselineV1;
  readonly windowKey: string;
}

export interface PersistedColumnV1 {
  readonly fullWidthRestore?: ColumnWidth;
  readonly members: readonly PersistedColumnMemberV1[];
  readonly width: ColumnWidth;
}

export interface PersistedContextV1 {
  readonly activeColumnIndex: number | null;
  readonly columns: readonly PersistedColumnV1[];
  readonly desktopId: string;
  readonly outputKey: string;
  readonly restoreFingerprint?: string;
  readonly viewportOffset: number;
}

export interface PersistedFloatingAnchorV1 {
  readonly columnIndex: number;
  readonly columnWidth: ColumnWidth;
  readonly memberIndex: number;
  readonly nextWindowKey?: string;
  readonly previousWindowKey?: string;
  readonly windowHeight?: WindowHeight;
}

export interface PersistedFloatingWindowV1 {
  readonly anchor: PersistedFloatingAnchorV1;
  readonly desktopId: string;
  readonly outputKey: string;
  readonly windowKey: string;
}

export interface LayoutPersistenceV1 {
  readonly contexts: readonly PersistedContextV1[];
  readonly floatingWindows: readonly PersistedFloatingWindowV1[];
  readonly format: typeof LAYOUT_PERSISTENCE_FORMAT;
  readonly outputs: readonly PersistedOutputV1[];
  readonly version: typeof LAYOUT_PERSISTENCE_VERSION;
  readonly windows: readonly PersistedWindowV1[];
}

export type LayoutPersistenceDecodeError =
  | "document-too-large"
  | "invalid-json"
  | "invalid-state"
  | "unsupported-version";

export type LayoutPersistenceDecodeResult =
  | {
      readonly error: LayoutPersistenceDecodeError;
      readonly ok: false;
    }
  | {
      readonly ok: true;
      readonly value: LayoutPersistenceV1;
    };

class InvalidPersistenceState extends Error {}

export function encodeLayoutPersistence(state: LayoutPersistenceV1): string {
  const document = `${JSON.stringify(parseV1(state))}\n`;

  if (document.length > LAYOUT_PERSISTENCE_LIMITS.documentCharacters) {
    invalid();
  }

  return document;
}

export function decodeLayoutPersistence(
  document: string,
): LayoutPersistenceDecodeResult {
  if (document.length > LAYOUT_PERSISTENCE_LIMITS.documentCharacters) {
    return { error: "document-too-large", ok: false };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(document) as unknown;
  } catch {
    return { error: "invalid-json", ok: false };
  }

  if (
    isRecord(parsed) &&
    parsed["format"] === LAYOUT_PERSISTENCE_FORMAT &&
    typeof parsed["version"] === "number" &&
    Number.isInteger(parsed["version"]) &&
    parsed["version"] !== LAYOUT_PERSISTENCE_VERSION
  ) {
    return { error: "unsupported-version", ok: false };
  }

  try {
    return { ok: true, value: parseV1(parsed) };
  } catch {
    return { error: "invalid-state", ok: false };
  }
}

function parseV1(value: unknown): LayoutPersistenceV1 {
  const state = recordWithKeys(
    value,
    ["contexts", "floatingWindows", "format", "outputs", "version", "windows"],
    [],
  );

  if (
    state["format"] !== LAYOUT_PERSISTENCE_FORMAT ||
    state["version"] !== LAYOUT_PERSISTENCE_VERSION
  ) {
    invalid();
  }

  const outputs = boundedArray(
    state["outputs"],
    LAYOUT_PERSISTENCE_LIMITS.outputs,
  ).map(parseOutput);
  const windows = boundedArray(
    state["windows"],
    LAYOUT_PERSISTENCE_LIMITS.windows,
  ).map(parseWindow);
  const contexts = boundedArray(
    state["contexts"],
    LAYOUT_PERSISTENCE_LIMITS.contexts,
  ).map(parseContext);
  const floatingWindows = boundedArray(
    state["floatingWindows"],
    LAYOUT_PERSISTENCE_LIMITS.floatingWindows,
  ).map(parseFloatingWindow);

  validateReferences(outputs, windows, contexts, floatingWindows);

  return {
    contexts: contexts.sort(compareContexts),
    floatingWindows: floatingWindows.sort((left, right) =>
      compareStrings(left.windowKey, right.windowKey),
    ),
    format: LAYOUT_PERSISTENCE_FORMAT,
    outputs: outputs.sort((left, right) => compareStrings(left.key, right.key)),
    version: LAYOUT_PERSISTENCE_VERSION,
    windows: windows.sort((left, right) => compareStrings(left.key, right.key)),
  };
}

function parseOutput(value: unknown): PersistedOutputV1 {
  const output = recordWithKeys(
    value,
    ["key", "name"],
    ["manufacturer", "model", "serialNumber"],
  );
  const manufacturer = optionalIdentifier(output["manufacturer"]);
  const model = optionalIdentifier(output["model"]);
  const serialNumber = optionalIdentifier(output["serialNumber"]);

  return {
    key: identifier(output["key"]),
    ...(manufacturer === undefined ? {} : { manufacturer }),
    ...(model === undefined ? {} : { model }),
    name: identifier(output["name"]),
    ...(serialNumber === undefined ? {} : { serialNumber }),
  };
}

function parseWindow(value: unknown): PersistedWindowV1 {
  const window = recordWithKeys(value, ["key", "liveId"], ["sessionMatch"]);
  const sessionMatch =
    window["sessionMatch"] === undefined
      ? undefined
      : parseWindowMatch(window["sessionMatch"]);

  return {
    key: identifier(window["key"]),
    liveId: identifier(window["liveId"]),
    ...(sessionMatch === undefined ? {} : { sessionMatch }),
  };
}

function parseWindowMatch(value: unknown): PersistedWindowMatchV1 {
  const match = recordWithKeys(
    value,
    [],
    ["desktopFileName", "resourceClass", "resourceName", "tag", "windowRole"],
  );
  const desktopFileName = optionalIdentifier(match["desktopFileName"]);
  const resourceClass = optionalIdentifier(match["resourceClass"]);
  const resourceName = optionalIdentifier(match["resourceName"]);
  const tag = optionalIdentifier(match["tag"]);
  const windowRole = optionalIdentifier(match["windowRole"]);

  if (
    desktopFileName === undefined &&
    resourceClass === undefined &&
    resourceName === undefined &&
    tag === undefined &&
    windowRole === undefined
  ) {
    invalid();
  }

  return {
    ...(desktopFileName === undefined ? {} : { desktopFileName }),
    ...(resourceClass === undefined ? {} : { resourceClass }),
    ...(resourceName === undefined ? {} : { resourceName }),
    ...(tag === undefined ? {} : { tag }),
    ...(windowRole === undefined ? {} : { windowRole }),
  };
}

function parseContext(value: unknown): PersistedContextV1 {
  const context = recordWithKeys(
    value,
    [
      "activeColumnIndex",
      "columns",
      "desktopId",
      "outputKey",
      "viewportOffset",
    ],
    ["restoreFingerprint"],
  );
  const columns = boundedArray(
    context["columns"],
    LAYOUT_PERSISTENCE_LIMITS.columnsPerContext,
    false,
  ).map(parseColumn);
  const activeColumnIndex = nullableIndex(
    context["activeColumnIndex"],
    columns.length,
  );
  const restoreFingerprint =
    context["restoreFingerprint"] === undefined
      ? undefined
      : contextFingerprint(context["restoreFingerprint"]);
  const hasRestoreBaseline = columns.some((column) =>
    column.members.some((member) => member.restoreBaseline !== undefined),
  );

  if (hasRestoreBaseline !== (restoreFingerprint !== undefined)) {
    invalid();
  }

  return {
    activeColumnIndex,
    columns,
    desktopId: identifier(context["desktopId"]),
    outputKey: identifier(context["outputKey"]),
    ...(restoreFingerprint === undefined ? {} : { restoreFingerprint }),
    viewportOffset: boundedNumber(context["viewportOffset"], true),
  };
}

function parseColumn(value: unknown): PersistedColumnV1 {
  const column = recordWithKeys(
    value,
    ["members", "width"],
    ["fullWidthRestore"],
  );
  const members = boundedArray(
    column["members"],
    LAYOUT_PERSISTENCE_LIMITS.membersPerColumn,
    false,
  ).map(parseColumnMember);
  const width = parseWidth(column["width"]);
  const fullWidthRestore =
    column["fullWidthRestore"] === undefined
      ? undefined
      : parseWidth(column["fullWidthRestore"]);
  let nonAutomaticHeights = 0;

  for (const member of members) {
    if (member.height && member.height.kind !== "auto") {
      nonAutomaticHeights += 1;
    }
  }

  if (
    nonAutomaticHeights > 1 ||
    (fullWidthRestore !== undefined &&
      (width.kind !== "proportion" || width.value !== 1))
  ) {
    invalid();
  }

  return {
    ...(fullWidthRestore === undefined ? {} : { fullWidthRestore }),
    members,
    width,
  };
}

function parseColumnMember(value: unknown): PersistedColumnMemberV1 {
  const member = recordWithKeys(
    value,
    ["windowKey"],
    ["height", "restoreBaseline"],
  );
  const parsedHeight =
    member["height"] === undefined
      ? undefined
      : parseWindowHeight(member["height"]);
  const height = isDefaultWindowHeight(parsedHeight) ? undefined : parsedHeight;
  const restoreBaseline =
    member["restoreBaseline"] === undefined
      ? undefined
      : parseRestoreBaseline(member["restoreBaseline"]);

  return {
    ...(height === undefined ? {} : { height }),
    ...(restoreBaseline === undefined ? {} : { restoreBaseline }),
    windowKey: identifier(member["windowKey"]),
  };
}

function parseRestoreBaseline(value: unknown): PersistedRestoreBaselineV1 {
  const baseline = recordWithKeys(
    value,
    ["clientFrame", "frame", "kind", "noBorder"],
    [],
  );
  const kind = baseline["kind"];
  const noBorder = baseline["noBorder"];

  if (kind !== "client" && kind !== "frame") {
    invalid();
  }

  if (noBorder !== null && typeof noBorder !== "boolean") {
    invalid();
  }

  return {
    clientFrame: parseRect(baseline["clientFrame"]),
    frame: parseRect(baseline["frame"]),
    kind,
    noBorder,
  };
}

function parseRect(value: unknown): PersistedRectV1 {
  const rect = recordWithKeys(value, ["height", "width", "x", "y"], []);

  return {
    height: boundedNumber(rect["height"], false),
    width: boundedNumber(rect["width"], false),
    x: boundedNumber(rect["x"], true),
    y: boundedNumber(rect["y"], true),
  };
}

function parseFloatingWindow(value: unknown): PersistedFloatingWindowV1 {
  const floating = recordWithKeys(
    value,
    ["anchor", "desktopId", "outputKey", "windowKey"],
    [],
  );

  return {
    anchor: parseFloatingAnchor(floating["anchor"]),
    desktopId: identifier(floating["desktopId"]),
    outputKey: identifier(floating["outputKey"]),
    windowKey: identifier(floating["windowKey"]),
  };
}

function parseFloatingAnchor(value: unknown): PersistedFloatingAnchorV1 {
  const anchor = recordWithKeys(
    value,
    ["columnIndex", "columnWidth", "memberIndex"],
    ["nextWindowKey", "previousWindowKey", "windowHeight"],
  );
  const nextWindowKey = optionalIdentifier(anchor["nextWindowKey"]);
  const previousWindowKey = optionalIdentifier(anchor["previousWindowKey"]);
  const parsedWindowHeight =
    anchor["windowHeight"] === undefined
      ? undefined
      : parseWindowHeight(anchor["windowHeight"]);
  const windowHeight = isDefaultWindowHeight(parsedWindowHeight)
    ? undefined
    : parsedWindowHeight;

  if (
    nextWindowKey !== undefined &&
    previousWindowKey !== undefined &&
    nextWindowKey === previousWindowKey
  ) {
    invalid();
  }

  return {
    columnIndex: boundedIndex(
      anchor["columnIndex"],
      LAYOUT_PERSISTENCE_LIMITS.columnsPerContext,
    ),
    columnWidth: parseWidth(anchor["columnWidth"]),
    memberIndex: boundedIndex(
      anchor["memberIndex"],
      LAYOUT_PERSISTENCE_LIMITS.membersPerColumn,
    ),
    ...(nextWindowKey === undefined ? {} : { nextWindowKey }),
    ...(previousWindowKey === undefined ? {} : { previousWindowKey }),
    ...(windowHeight === undefined ? {} : { windowHeight }),
  };
}

function parseWidth(value: unknown): ColumnWidth {
  const width = recordWithKeys(value, ["kind", "value"], []);
  const kind = width["kind"];

  if (kind !== "fixed" && kind !== "proportion") {
    invalid();
  }

  return { kind, value: boundedNumber(width["value"], false) };
}

function parseWindowHeight(value: unknown): WindowHeight {
  const height = record(value);
  const kind = height["kind"];

  switch (kind) {
    case "auto":
      requireExactKeys(height, ["kind", "weight"]);
      return {
        kind,
        weight: boundedNumber(height["weight"], false),
      };
    case "fixed":
      requireExactKeys(height, ["clientHeight", "kind"]);
      return {
        clientHeight: boundedNumber(height["clientHeight"], false),
        kind,
      };
    case "preset":
      requireExactKeys(height, ["index", "kind"]);
      return {
        index: boundedIndex(
          height["index"],
          LAYOUT_PERSISTENCE_LIMITS.presetIndex + 1,
        ),
        kind,
      };
    default:
      return invalid();
  }
}

function isDefaultWindowHeight(height: WindowHeight | undefined): boolean {
  return height?.kind === "auto" && height.weight === 1;
}

function validateReferences(
  outputs: readonly PersistedOutputV1[],
  windows: readonly PersistedWindowV1[],
  contexts: readonly PersistedContextV1[],
  floatingWindows: readonly PersistedFloatingWindowV1[],
): void {
  const outputKeys = uniqueValues(outputs.map((output) => output.key));
  const windowKeys = uniqueValues(windows.map((window) => window.key));
  uniqueValues(windows.map((window) => window.liveId));
  const referencedOutputs = new Set<string>();
  const referencedWindows = new Set<string>();
  const contextKeys = new Set<string>();
  const tiledWindowsByContext = new Map<
    string,
    Map<string, { readonly columnIndex: number; readonly memberIndex: number }>
  >();

  for (const context of contexts) {
    if (!outputKeys.has(context.outputKey)) {
      invalid();
    }

    const key = `${context.outputKey}\u0000${context.desktopId}`;

    if (contextKeys.has(key)) {
      invalid();
    }

    contextKeys.add(key);
    referencedOutputs.add(context.outputKey);
    const tiledWindows = new Map<
      string,
      { readonly columnIndex: number; readonly memberIndex: number }
    >();
    tiledWindowsByContext.set(key, tiledWindows);

    for (const [columnIndex, column] of context.columns.entries()) {
      for (const [memberIndex, member] of column.members.entries()) {
        referenceWindow(member.windowKey, windowKeys, referencedWindows);
        tiledWindows.set(member.windowKey, { columnIndex, memberIndex });
      }
    }
  }

  for (const floating of floatingWindows) {
    if (!outputKeys.has(floating.outputKey)) {
      invalid();
    }

    referencedOutputs.add(floating.outputKey);
    referenceWindow(floating.windowKey, windowKeys, referencedWindows);
    const tiledWindows = tiledWindowsByContext.get(
      `${floating.outputKey}\u0000${floating.desktopId}`,
    );

    const previous = floating.anchor.previousWindowKey;
    const next = floating.anchor.nextWindowKey;
    const previousPosition =
      previous === undefined ? undefined : tiledWindows?.get(previous);
    const nextPosition =
      next === undefined ? undefined : tiledWindows?.get(next);

    if (
      (previous !== undefined && previousPosition === undefined) ||
      (next !== undefined && nextPosition === undefined) ||
      (previousPosition !== undefined &&
        nextPosition !== undefined &&
        (previousPosition.columnIndex !== nextPosition.columnIndex ||
          previousPosition.memberIndex >= nextPosition.memberIndex))
    ) {
      invalid();
    }
  }

  if (
    referencedOutputs.size !== outputKeys.size ||
    referencedWindows.size !== windowKeys.size
  ) {
    invalid();
  }
}

function referenceWindow(
  key: string,
  known: ReadonlySet<string>,
  referenced: Set<string>,
): void {
  if (!known.has(key) || referenced.has(key)) {
    invalid();
  }

  referenced.add(key);
}

function uniqueValues(values: readonly string[]): ReadonlySet<string> {
  const unique = new Set(values);

  if (unique.size !== values.length) {
    invalid();
  }

  return unique;
}

function compareContexts(
  left: PersistedContextV1,
  right: PersistedContextV1,
): number {
  return (
    compareStrings(left.outputKey, right.outputKey) ||
    compareStrings(left.desktopId, right.desktopId)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    invalid();
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordWithKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
): Record<string, unknown> {
  const candidate = record(value);
  const allowed = new Set([...required, ...optional]);

  if (
    required.some(
      (key) => !Object.prototype.hasOwnProperty.call(candidate, key),
    ) ||
    Object.keys(candidate).some((key) => !allowed.has(key))
  ) {
    invalid();
  }

  return candidate;
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value);

  if (
    actual.length !== keys.length ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    invalid();
  }
}

function boundedArray(
  value: unknown,
  maximumLength: number,
  allowEmpty = true,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > maximumLength ||
    (!allowEmpty && value.length === 0)
  ) {
    invalid();
  }

  return value;
}

function boundedIndex(value: unknown, exclusiveMaximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= exclusiveMaximum
  ) {
    invalid();
  }

  return value;
}

function nullableIndex(
  value: unknown,
  exclusiveMaximum: number,
): number | null {
  return value === null ? null : boundedIndex(value, exclusiveMaximum);
}

function boundedNumber(value: unknown, allowZero: boolean): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > LAYOUT_PERSISTENCE_LIMITS.numericMagnitude ||
    (allowZero ? false : value <= 0)
  ) {
    invalid();
  }

  return Object.is(value, -0) ? 0 : value;
}

function optionalIdentifier(value: unknown): string | undefined {
  return value === undefined ? undefined : identifier(value);
}

function contextFingerprint(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.contextFingerprintCharacters
  ) {
    invalid();
  }

  const components = value.split("\u0000");

  if (components.length !== 9) {
    invalid();
  }

  for (const [index, component] of components.entries()) {
    const numeric = Number(component);
    const mustBePositive =
      index === 0 || index === 3 || index === 4 || index === 7 || index === 8;

    if (
      component.length === 0 ||
      !Number.isFinite(numeric) ||
      Math.abs(numeric) > LAYOUT_PERSISTENCE_LIMITS.numericMagnitude ||
      String(numeric) !== component ||
      (mustBePositive && numeric <= 0)
    ) {
      invalid();
    }
  }

  return value;
}

function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters ||
    containsControlCharacter(value)
  ) {
    invalid();
  }

  return value;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function invalid(): never {
  throw new InvalidPersistenceState();
}
