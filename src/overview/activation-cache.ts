import {
  LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID,
  LAYOUT_PERSISTENCE_LIMITS,
} from "../core/layout-persistence";

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type OverviewActivationCacheMissReason =
  | "changed-document"
  | "changed-live-snapshot"
  | "empty"
  | "invalid-document"
  | "invalid-live-snapshot"
  | "invalid-model";

export interface OverviewActivationCacheHit<Model extends object> {
  readonly ok: true;
  readonly value: DeepReadonly<Model>;
}

export interface OverviewActivationCacheMiss {
  readonly ok: false;
  readonly reason: OverviewActivationCacheMissReason;
}

export type OverviewActivationCacheLookupResult<Model extends object> =
  OverviewActivationCacheHit<Model> | OverviewActivationCacheMiss;

export interface OverviewActivationCache<Model extends object> {
  clear(): void;
  lookup(
    document: unknown,
    liveSnapshot: unknown,
  ): OverviewActivationCacheLookupResult<Model>;
  store(
    document: unknown,
    liveSnapshot: unknown,
    validatedModel: Model,
  ): OverviewActivationCacheLookupResult<Model>;
}

interface OverviewActivationCacheEntry<Model extends object> {
  readonly document: string;
  readonly liveSnapshotKey: string;
  readonly model: DeepReadonly<Model>;
}

type CanonicalOutput = readonly [
  name: string,
  manufacturer: string | null,
  model: string | null,
  serialNumber: string | null,
];

type CanonicalWindowHeightBound = readonly [
  windowId: string,
  decorationHeight: number,
  minimumClientHeight: number,
  maximumClientHeight: number | "positive-infinity",
];

type CloneResult =
  { readonly ok: false } | { readonly ok: true; readonly value: unknown };

const MAXIMUM_MODEL_GRAPH_DEPTH = 32;
const MAXIMUM_MODEL_GRAPH_NODES = 262_144;

export function createOverviewActivationCache<
  Model extends object,
>(): OverviewActivationCache<Model> {
  let entry: OverviewActivationCacheEntry<Model> | null = null;

  const clear = (): void => {
    entry = null;
  };

  const miss = (
    reason: OverviewActivationCacheMissReason,
  ): OverviewActivationCacheMiss => Object.freeze({ ok: false, reason });

  const lookup = (
    document: unknown,
    liveSnapshot: unknown,
  ): OverviewActivationCacheLookupResult<Model> => {
    if (!isCacheableDocument(document)) {
      clear();
      return miss("invalid-document");
    }

    if (entry !== null && document !== entry.document) {
      clear();
      return miss("changed-document");
    }

    const liveSnapshotKey = canonicalLiveSnapshotKey(liveSnapshot);
    if (liveSnapshotKey === null) {
      clear();
      return miss("invalid-live-snapshot");
    }

    if (entry === null) {
      return miss("empty");
    }

    if (liveSnapshotKey !== entry.liveSnapshotKey) {
      clear();
      return miss("changed-live-snapshot");
    }

    return cacheHit(entry.model);
  };

  const store = (
    document: unknown,
    liveSnapshot: unknown,
    validatedModel: Model,
  ): OverviewActivationCacheLookupResult<Model> => {
    if (!isCacheableDocument(document)) {
      clear();
      return miss("invalid-document");
    }

    const liveSnapshotKey = canonicalLiveSnapshotKey(liveSnapshot);
    if (liveSnapshotKey === null) {
      clear();
      return miss("invalid-live-snapshot");
    }

    const frozenModel = cloneAndDeepFreezeModel(validatedModel);
    if (frozenModel === null) {
      clear();
      return miss("invalid-model");
    }

    entry = Object.freeze({
      document,
      liveSnapshotKey,
      model: frozenModel,
    });
    return cacheHit(frozenModel);
  };

  return Object.freeze({ clear, lookup, store });
}

function cacheHit<Model extends object>(
  model: DeepReadonly<Model>,
): OverviewActivationCacheHit<Model> {
  const source = model as unknown as Readonly<Record<string, unknown>>;
  const view: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    Object.defineProperty(view, key, {
      configurable: false,
      enumerable: true,
      value: source[key],
      writable: false,
    });
  }
  const value = Object.freeze(view) as unknown as DeepReadonly<Model>;
  return Object.freeze({ ok: true, value });
}

function isCacheableDocument(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= LAYOUT_PERSISTENCE_LIMITS.documentCharacters
  );
}

function canonicalLiveSnapshotKey(value: unknown): string | null {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const currentActivityId = value["currentActivityId"];
    const activityIds = canonicalIdentifiers(
      value["activityIds"],
      LAYOUT_PERSISTENCE_LIMITS.contexts,
      false,
    );
    const desktopIds = canonicalIdentifiers(
      value["desktopIds"],
      LAYOUT_PERSISTENCE_LIMITS.contexts,
      true,
    );
    const windowIds = canonicalIdentifiers(
      value["windowIds"],
      LAYOUT_PERSISTENCE_LIMITS.windows,
      true,
    );

    if (
      !validIdentifier(currentActivityId) ||
      currentActivityId === LAYOUT_PERSISTENCE_LEGACY_CURRENT_ACTIVITY_ID ||
      activityIds === null ||
      !activityIds.includes(currentActivityId) ||
      desktopIds === null ||
      windowIds === null
    ) {
      return null;
    }

    const outputs = canonicalOutputs(value["outputs"]);
    const windowHeightBounds = canonicalWindowHeightBounds(
      value["windowHeightBounds"],
      new Set(windowIds),
    );
    if (outputs === null || windowHeightBounds === null) {
      return null;
    }

    return JSON.stringify([
      currentActivityId,
      activityIds,
      desktopIds,
      outputs,
      windowIds,
      windowHeightBounds,
    ]);
  } catch {
    return null;
  }
}

function canonicalIdentifiers(
  value: unknown,
  maximum: number,
  emptyAllowed: boolean,
): readonly string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    (!emptyAllowed && value.length === 0)
  ) {
    return null;
  }

  const identifiers = new Set<string>();
  for (const identifier of value) {
    if (!validIdentifier(identifier) || identifiers.has(identifier)) {
      return null;
    }
    identifiers.add(identifier);
  }

  return [...identifiers].sort(compareStrings);
}

function canonicalOutputs(value: unknown): readonly CanonicalOutput[] | null {
  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.outputs
  ) {
    return null;
  }

  const names = new Set<string>();
  const outputs: CanonicalOutput[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const name = candidate["name"];
    const manufacturer = candidate["manufacturer"];
    const model = candidate["model"];
    const serialNumber = candidate["serialNumber"];
    if (
      !validIdentifier(name) ||
      names.has(name) ||
      !validOptionalIdentifier(manufacturer) ||
      !validOptionalIdentifier(model) ||
      !validOptionalIdentifier(serialNumber)
    ) {
      return null;
    }

    names.add(name);
    outputs.push([
      name,
      manufacturer ?? null,
      model ?? null,
      serialNumber ?? null,
    ]);
  }

  return outputs.sort((left, right) => compareStrings(left[0], right[0]));
}

function canonicalWindowHeightBounds(
  value: unknown,
  windowIds: ReadonlySet<string>,
): readonly CanonicalWindowHeightBound[] | null {
  if (value === undefined) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.windows
  ) {
    return null;
  }

  const boundedWindowIds = new Set<string>();
  const bounds: CanonicalWindowHeightBound[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return null;
    }

    const windowId = candidate["windowId"];
    const decorationHeight = candidate["decorationHeight"];
    const minimumClientHeight = candidate["minimumClientHeight"];
    const maximumClientHeight = candidate["maximumClientHeight"];
    if (
      !validIdentifier(windowId) ||
      !windowIds.has(windowId) ||
      boundedWindowIds.has(windowId) ||
      !validNonNegativeBoundedNumber(decorationHeight) ||
      !validNonNegativeBoundedNumber(minimumClientHeight) ||
      !validMaximumClientHeight(maximumClientHeight) ||
      (maximumClientHeight !== Number.POSITIVE_INFINITY &&
        maximumClientHeight < minimumClientHeight)
    ) {
      return null;
    }

    boundedWindowIds.add(windowId);
    bounds.push([
      windowId,
      normalizeZero(decorationHeight),
      normalizeZero(minimumClientHeight),
      maximumClientHeight === Number.POSITIVE_INFINITY
        ? "positive-infinity"
        : normalizeZero(maximumClientHeight),
    ]);
  }

  return bounds.sort((left, right) => compareStrings(left[0], right[0]));
}

function cloneAndDeepFreezeModel<Model extends object>(
  model: Model,
): DeepReadonly<Model> | null {
  if (!isRecord(model)) {
    return null;
  }

  try {
    const result = cloneAndDeepFreeze(
      model,
      new Map<object, unknown>(),
      new Set<object>(),
      { nodes: 0 },
      0,
    );
    return result.ok ? (result.value as DeepReadonly<Model>) : null;
  } catch {
    return null;
  }
}

function cloneAndDeepFreeze(
  value: unknown,
  clones: Map<object, unknown>,
  active: Set<object>,
  state: { nodes: number },
  depth: number,
): CloneResult {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) || value === Number.POSITIVE_INFINITY
      ? { ok: true, value }
      : { ok: false };
  }
  if (typeof value !== "object" || depth > MAXIMUM_MODEL_GRAPH_DEPTH) {
    return { ok: false };
  }

  const previous = clones.get(value);
  if (previous !== undefined) {
    return active.has(value) ? { ok: false } : { ok: true, value: previous };
  }

  state.nodes += 1;
  if (state.nodes > MAXIMUM_MODEL_GRAPH_NODES) {
    return { ok: false };
  }

  active.add(value);
  if (Array.isArray(value)) {
    if (value.length > LAYOUT_PERSISTENCE_LIMITS.windows) {
      return { ok: false };
    }

    const clone: unknown[] = [];
    clones.set(value, clone);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor)) {
        return { ok: false };
      }
      const child = cloneAndDeepFreeze(
        descriptor.value,
        clones,
        active,
        state,
        depth + 1,
      );
      if (!child.ok) {
        return child;
      }
      clone.push(child.value);
    }
    active.delete(value);
    return { ok: true, value: Object.freeze(clone) };
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false };
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length > LAYOUT_PERSISTENCE_LIMITS.windows ||
    keys.some((key) => typeof key !== "string")
  ) {
    return { ok: false };
  }

  const clone: Record<string, unknown> = {};
  clones.set(value, clone);
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      return { ok: false };
    }
    const child = cloneAndDeepFreeze(
      descriptor.value,
      clones,
      active,
      state,
      depth + 1,
    );
    if (!child.ok) {
      return child;
    }
    Object.defineProperty(clone, key, {
      configurable: false,
      enumerable: true,
      value: child.value,
      writable: false,
    });
  }
  active.delete(value);
  return { ok: true, value: Object.freeze(clone) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validOptionalIdentifier(value: unknown): value is string | undefined {
  return value === undefined || validIdentifier(value);
}

function validIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
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

function validNonNegativeBoundedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function validMaximumClientHeight(value: unknown): value is number {
  return (
    value === Number.POSITIVE_INFINITY ||
    (validNonNegativeBoundedNumber(value) && value > 0)
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
