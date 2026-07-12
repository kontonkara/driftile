import { matchPersistedOutputs } from "./layout-persistence-match";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_LIMITS,
  canonicalizePersistedOutput,
  decodeLayoutPersistence,
  encodeLayoutPersistence,
  type LayoutPersistenceDecodeError,
  type LayoutPersistenceV1,
  type PersistedContextV1,
  type PersistedOutputV1,
} from "./layout-persistence";

export const LAYOUT_PERSISTENCE_CATALOG_VERSION = 2;

export const LAYOUT_PERSISTENCE_CATALOG_LIMITS = Object.freeze({
  snapshots: 4,
});

export interface LayoutPersistenceTopologyV2 {
  readonly outputs: readonly PersistedOutputV1[];
}

export interface LayoutPersistenceCatalogSnapshot {
  readonly state: LayoutPersistenceV1;
  readonly topology: LayoutPersistenceTopologyV2 | null;
}

export interface LayoutPersistenceCatalogV2 {
  readonly format: typeof LAYOUT_PERSISTENCE_FORMAT;
  readonly snapshots: readonly LayoutPersistenceCatalogSnapshot[];
  readonly version: typeof LAYOUT_PERSISTENCE_CATALOG_VERSION;
}

export type LayoutPersistenceCatalogDecodeResult =
  | {
      readonly error: LayoutPersistenceDecodeError;
      readonly ok: false;
    }
  | {
      readonly ok: true;
      readonly value: LayoutPersistenceCatalogV2;
    };

export type LayoutPersistenceCatalogMergeResult =
  | {
      readonly error: "document-too-large" | "invalid-state";
      readonly ok: false;
    }
  | {
      readonly document: string;
      readonly ok: true;
      readonly value: LayoutPersistenceCatalogV2;
    };

class InvalidPersistenceCatalog extends Error {}

export function decodeLayoutPersistenceCatalog(
  document: string,
): LayoutPersistenceCatalogDecodeResult {
  if (document.length > LAYOUT_PERSISTENCE_LIMITS.documentCharacters) {
    return { error: "document-too-large", ok: false };
  }

  let value: unknown;

  try {
    value = JSON.parse(document) as unknown;
  } catch {
    return { error: "invalid-json", ok: false };
  }

  if (!isRecord(value) || value["format"] !== LAYOUT_PERSISTENCE_FORMAT) {
    return { error: "invalid-state", ok: false };
  }

  const version = value["version"];

  if (version === 1) {
    const decoded = decodeLayoutPersistence(document);

    return decoded.ok
      ? { ok: true, value: legacyCatalog(decoded.value) }
      : decoded;
  }

  if (typeof version === "number" && Number.isInteger(version)) {
    if (version !== LAYOUT_PERSISTENCE_CATALOG_VERSION) {
      return { error: "unsupported-version", ok: false };
    }
  } else {
    return { error: "invalid-state", ok: false };
  }

  try {
    return { ok: true, value: parseCatalog(value, false) };
  } catch {
    return { error: "invalid-state", ok: false };
  }
}

export function encodeLayoutPersistenceCatalog(
  catalog: LayoutPersistenceCatalogV2,
): string {
  const normalized = parseCatalog(catalog, false);
  const document = serializeCatalog(normalized);

  if (document.length > LAYOUT_PERSISTENCE_LIMITS.documentCharacters) {
    invalid();
  }

  return document;
}

export function mergeLayoutPersistenceCatalog(
  previous: LayoutPersistenceCatalogV2 | null,
  current: {
    readonly state: LayoutPersistenceV1;
    readonly topology: LayoutPersistenceTopologyV2;
  },
): LayoutPersistenceCatalogMergeResult {
  if (serializedDocumentTooLarge(current)) {
    return { error: "document-too-large", ok: false };
  }

  let currentSnapshot: LayoutPersistenceCatalogSnapshot;
  let previousCatalog: LayoutPersistenceCatalogV2 | null;

  try {
    currentSnapshot = parseSnapshot(current, false);
    previousCatalog = previous === null ? null : parseCatalog(previous, true);
  } catch {
    return { error: "invalid-state", ok: false };
  }

  const snapshots: LayoutPersistenceCatalogSnapshot[] = [currentSnapshot];

  if (previousCatalog !== null) {
    for (const snapshot of previousCatalog.snapshots) {
      const topology = snapshot.topology;

      if (
        topology === null ||
        snapshots.some(
          (candidate) =>
            candidate.topology !== null &&
            topologiesEquivalent(topology, candidate.topology),
        )
      ) {
        continue;
      }

      snapshots.push(stripRestoreBaselines(snapshot));

      if (snapshots.length === LAYOUT_PERSISTENCE_CATALOG_LIMITS.snapshots) {
        break;
      }
    }
  }

  while (snapshots.length > 0) {
    const value = catalog(snapshots);
    const document = serializeCatalog(value);

    if (document.length <= LAYOUT_PERSISTENCE_LIMITS.documentCharacters) {
      return { document, ok: true, value };
    }

    if (snapshots.length === 1) {
      return { error: "document-too-large", ok: false };
    }

    snapshots.pop();
  }

  return { error: "invalid-state", ok: false };
}

export function selectLayoutPersistenceSnapshot(
  catalogValue: LayoutPersistenceCatalogV2,
  currentTopology: LayoutPersistenceTopologyV2,
): LayoutPersistenceCatalogSnapshot | null {
  const normalizedCatalog = parseCatalog(catalogValue, true);
  const topology = parseTopology(currentTopology);

  for (const snapshot of normalizedCatalog.snapshots) {
    if (
      snapshot.topology !== null &&
      topologiesEquivalent(snapshot.topology, topology)
    ) {
      return snapshot;
    }
  }

  return null;
}

export function activeLayoutPersistenceState(
  catalogValue: LayoutPersistenceCatalogV2,
): LayoutPersistenceV1 {
  const normalized = parseCatalog(catalogValue, true);
  const active = normalized.snapshots[0];

  if (active === undefined) {
    return invalid();
  }

  return active.state;
}

function parseCatalog(
  value: unknown,
  allowLegacyTopology: boolean,
): LayoutPersistenceCatalogV2 {
  const candidate = exactRecord(value, ["format", "snapshots", "version"]);

  if (
    candidate["format"] !== LAYOUT_PERSISTENCE_FORMAT ||
    candidate["version"] !== LAYOUT_PERSISTENCE_CATALOG_VERSION
  ) {
    invalid();
  }

  const values = boundedSnapshots(candidate["snapshots"]);
  const snapshots = values.map((snapshot, index) => {
    const parsed = parseSnapshot(snapshot, allowLegacyTopology);

    if (index > 0 && hasRestoreBaselines(parsed.state)) {
      invalid();
    }

    return parsed;
  });

  if (
    snapshots.some((snapshot, index) => {
      const topology = snapshot.topology;

      return (
        topology !== null &&
        snapshots.some(
          (candidateSnapshot, candidateIndex) =>
            candidateIndex < index &&
            candidateSnapshot.topology !== null &&
            topologiesEquivalent(topology, candidateSnapshot.topology),
        )
      );
    })
  ) {
    invalid();
  }

  const incompleteSnapshots = snapshots.filter(
    (snapshot) => snapshot.topology === null,
  );

  if (
    incompleteSnapshots.length > 0 &&
    (!allowLegacyTopology ||
      snapshots.length !== 1 ||
      incompleteSnapshots.length !== 1)
  ) {
    invalid();
  }

  return catalog(snapshots);
}

function parseSnapshot(
  value: unknown,
  allowLegacyTopology: boolean,
): LayoutPersistenceCatalogSnapshot {
  const snapshot = exactRecord(value, ["state", "topology"]);
  const state = canonicalState(snapshot["state"]);
  const topologyValue = snapshot["topology"];

  if (topologyValue === null) {
    if (!allowLegacyTopology) {
      invalid();
    }

    return { state, topology: null };
  }

  const topology = parseTopology(topologyValue);
  validateStateTopology(state, topology);
  return { state, topology };
}

function parseTopology(value: unknown): LayoutPersistenceTopologyV2 {
  const topology = exactRecord(value, ["outputs"]);
  const outputsValue = topology["outputs"];

  if (
    !Array.isArray(outputsValue) ||
    outputsValue.length > LAYOUT_PERSISTENCE_LIMITS.outputs
  ) {
    invalid();
  }

  const outputs = outputsValue
    .map((output) => canonicalizePersistedOutput(output))
    .sort((left, right) => compareStrings(left.key, right.key));

  unique(outputs.map((output) => output.key));
  unique(outputs.map((output) => output.name));

  if (!topologyMatchesItself(outputs)) {
    invalid();
  }

  return { outputs };
}

function canonicalState(value: unknown): LayoutPersistenceV1 {
  const document = encodeLayoutPersistence(value as LayoutPersistenceV1);
  const decoded = decodeLayoutPersistence(document);

  if (!decoded.ok) {
    return invalid();
  }

  return decoded.value;
}

function validateStateTopology(
  state: LayoutPersistenceV1,
  topology: LayoutPersistenceTopologyV2,
): void {
  const topologyByKey = new Map(
    topology.outputs.map((output) => [output.key, output] as const),
  );

  for (const output of state.outputs) {
    const topologyOutput = topologyByKey.get(output.key);

    if (
      topologyOutput === undefined ||
      !outputDescriptorsEqual(output, topologyOutput)
    ) {
      invalid();
    }
  }
}

function topologyMatchesItself(outputs: readonly PersistedOutputV1[]): boolean {
  if (outputs.length === 0) {
    return true;
  }

  const result = matchPersistedOutputs(
    outputs,
    outputs.map((output) => ({
      liveId: output.key,
      ...(output.manufacturer === undefined
        ? {}
        : { manufacturer: output.manufacturer }),
      ...(output.model === undefined ? {} : { model: output.model }),
      name: output.name,
      ...(output.serialNumber === undefined
        ? {}
        : { serialNumber: output.serialNumber }),
    })),
  );

  return (
    result.matches.length === outputs.length &&
    result.unmatchedLiveIds.length === 0 &&
    result.unmatchedPersistedKeys.length === 0
  );
}

function topologiesEquivalent(
  persisted: LayoutPersistenceTopologyV2,
  current: LayoutPersistenceTopologyV2,
): boolean {
  if (persisted.outputs.length !== current.outputs.length) {
    return false;
  }

  const result = matchPersistedOutputs(
    persisted.outputs,
    current.outputs.map((output) => ({
      liveId: output.key,
      ...(output.manufacturer === undefined
        ? {}
        : { manufacturer: output.manufacturer }),
      ...(output.model === undefined ? {} : { model: output.model }),
      name: output.name,
      ...(output.serialNumber === undefined
        ? {}
        : { serialNumber: output.serialNumber }),
    })),
  );

  return (
    result.matches.length === persisted.outputs.length &&
    result.unmatchedLiveIds.length === 0 &&
    result.unmatchedPersistedKeys.length === 0
  );
}

function outputDescriptorsEqual(
  left: PersistedOutputV1,
  right: PersistedOutputV1,
): boolean {
  return (
    left.key === right.key &&
    left.manufacturer === right.manufacturer &&
    left.model === right.model &&
    left.name === right.name &&
    left.serialNumber === right.serialNumber
  );
}

function stripRestoreBaselines(
  snapshot: LayoutPersistenceCatalogSnapshot,
): LayoutPersistenceCatalogSnapshot {
  if (snapshot.topology === null) {
    return invalid();
  }

  return {
    state: {
      ...snapshot.state,
      contexts: snapshot.state.contexts.map(stripContextRestoreBaselines),
    },
    topology: snapshot.topology,
  };
}

function stripContextRestoreBaselines(
  context: PersistedContextV1,
): PersistedContextV1 {
  return {
    activeColumnIndex: context.activeColumnIndex,
    columns: context.columns.map((column) => ({
      ...(column.fullWidthRestore === undefined
        ? {}
        : { fullWidthRestore: column.fullWidthRestore }),
      members: column.members.map((member) => ({
        ...(member.height === undefined ? {} : { height: member.height }),
        windowKey: member.windowKey,
      })),
      width: column.width,
    })),
    desktopId: context.desktopId,
    outputKey: context.outputKey,
    viewportOffset: context.viewportOffset,
  };
}

function hasRestoreBaselines(state: LayoutPersistenceV1): boolean {
  return state.contexts.some(
    (context) =>
      context.restoreFingerprint !== undefined ||
      context.columns.some((column) =>
        column.members.some((member) => member.restoreBaseline !== undefined),
      ),
  );
}

function legacyCatalog(state: LayoutPersistenceV1): LayoutPersistenceCatalogV2 {
  return catalog([{ state, topology: null }]);
}

function catalog(
  snapshots: readonly LayoutPersistenceCatalogSnapshot[],
): LayoutPersistenceCatalogV2 {
  return {
    format: LAYOUT_PERSISTENCE_FORMAT,
    snapshots,
    version: LAYOUT_PERSISTENCE_CATALOG_VERSION,
  };
}

function serializeCatalog(catalogValue: LayoutPersistenceCatalogV2): string {
  return `${JSON.stringify(catalogValue)}\n`;
}

function serializedDocumentTooLarge(value: unknown): boolean {
  try {
    const document = JSON.stringify(value);
    return document.length + 1 > LAYOUT_PERSISTENCE_LIMITS.documentCharacters;
  } catch {
    return false;
  }
}

function boundedSnapshots(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_CATALOG_LIMITS.snapshots
  ) {
    invalid();
  }

  return value;
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) {
    invalid();
  }

  const actual = Object.keys(value);

  if (
    actual.length !== keys.length ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    invalid();
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) {
    invalid();
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(): never {
  throw new InvalidPersistenceCatalog();
}
