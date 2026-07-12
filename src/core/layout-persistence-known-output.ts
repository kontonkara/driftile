import type {
  LayoutPersistenceCatalogSnapshot,
  LayoutPersistenceTopologyV2,
} from "./layout-persistence-catalog";
import {
  planLayoutHydration,
  resolveLayoutPersistenceWindowIdentities,
  type LayoutPersistenceHydrationFailure,
  type LayoutPersistenceHydrationInput,
  type LayoutPersistenceHydrationPlan,
} from "./layout-persistence-hydration";
import { matchPersistedOutputs } from "./layout-persistence-match";
import {
  LAYOUT_PERSISTENCE_LIMITS,
  decodeLayoutPersistence,
  type LayoutPersistenceV1,
  type PersistedOutputV1,
} from "./layout-persistence";

export type LayoutPersistenceKnownOutputFailure =
  | LayoutPersistenceHydrationFailure
  | "current-topology-invalid"
  | "eligible-window-set-mismatch"
  | "historical-floating-window"
  | "historical-restore-baseline"
  | "historical-state-invalid"
  | "historical-state-topology-mismatch"
  | "historical-topology-incomplete"
  | "historical-topology-invalid"
  | "historical-topology-unresolved"
  | "live-topology-mismatch"
  | "returned-output-missing";

export type LayoutPersistenceKnownOutputResult =
  | {
      readonly kind: "failed";
      readonly ok: false;
      readonly reason: LayoutPersistenceKnownOutputFailure;
    }
  | {
      readonly kind: "no-historical-contexts";
      readonly ok: true;
    }
  | {
      readonly kind: "plan";
      readonly ok: true;
      readonly value: LayoutPersistenceHydrationPlan;
    };

export function planKnownOutputLayoutHydration(
  historicalSnapshot: LayoutPersistenceCatalogSnapshot,
  currentTopology: LayoutPersistenceTopologyV2,
  returnedLiveOutputName: string,
  input: LayoutPersistenceHydrationInput,
): LayoutPersistenceKnownOutputResult {
  if (!validIdentifier(returnedLiveOutputName)) {
    return failed("returned-output-missing");
  }

  const historicalTopology = historicalSnapshot.topology;

  if (historicalTopology === null) {
    return failed("historical-topology-incomplete");
  }

  const historicalState = canonicalState(historicalSnapshot.state);

  if (historicalState === null) {
    return failed("historical-state-invalid");
  }

  if (hasRestoreBaseline(historicalState)) {
    return failed("historical-restore-baseline");
  }

  if (!validTopology(historicalTopology)) {
    return failed("historical-topology-invalid");
  }

  if (!stateMatchesTopology(historicalState, historicalTopology)) {
    return failed("historical-state-topology-mismatch");
  }

  if (!validTopology(currentTopology)) {
    return failed("current-topology-invalid");
  }

  if (!inputMatchesCurrentTopology(input, currentTopology)) {
    return failed("live-topology-mismatch");
  }

  if (
    !currentTopology.outputs.some(
      (output) => output.name === returnedLiveOutputName,
    )
  ) {
    return failed("returned-output-missing");
  }

  const topologyMatches = matchPersistedOutputs(
    historicalTopology.outputs,
    liveOutputDescriptors(currentTopology.outputs),
  );

  if (
    !completeTopologyMatch(topologyMatches, historicalTopology, currentTopology)
  ) {
    return failed("historical-topology-unresolved");
  }

  const historicalOutputKey = topologyMatches.matches.find(
    (match) => match.liveId === returnedLiveOutputName,
  )?.persistedKey;

  if (historicalOutputKey === undefined) {
    return failed("historical-topology-unresolved");
  }

  if (
    historicalState.floatingWindows.some(
      (floating) => floating.outputKey === historicalOutputKey,
    )
  ) {
    return failed("historical-floating-window");
  }

  const contexts = historicalState.contexts.filter(
    (context) => context.outputKey === historicalOutputKey,
  );

  if (contexts.length === 0) {
    return Object.freeze({ kind: "no-historical-contexts", ok: true });
  }

  const selectedWindowKeys = new Set<string>();

  for (const context of contexts) {
    for (const column of context.columns) {
      for (const member of column.members) {
        selectedWindowKeys.add(member.windowKey);
      }
    }
  }

  const historicalOutput = historicalState.outputs.find(
    (output) => output.key === historicalOutputKey,
  );

  if (historicalOutput === undefined) {
    return failed("historical-state-topology-mismatch");
  }

  const windows = historicalState.windows.filter((window) =>
    selectedWindowKeys.has(window.key),
  );

  if (windows.length !== selectedWindowKeys.size) {
    return failed("historical-state-invalid");
  }

  const eligibleWindows = input.windows.filter((window) => window.eligible);
  const globallyResolved = resolveLayoutPersistenceWindowIdentities(
    historicalState.windows,
    eligibleWindows,
    selectedWindowKeys,
  );

  if (!globallyResolved.ok) {
    return failed(globallyResolved.reason);
  }

  const resolvedWindowIds = new Map(
    globallyResolved.matches.map((match) => [match.persistedKey, match.liveId]),
  );

  if (resolvedWindowIds.size !== selectedWindowKeys.size) {
    return failed("unresolved-live-window");
  }

  const subset: LayoutPersistenceV1 = {
    contexts,
    floatingWindows: [],
    format: historicalState.format,
    outputs: [historicalOutput],
    version: historicalState.version,
    windows: windows.map((window) => ({
      ...window,
      liveId: resolvedWindowIds.get(window.key) ?? window.liveId,
    })),
  };
  const returnedWindows = eligibleWindows.filter(
    (window) => window.outputName === returnedLiveOutputName,
  );
  const returnedInput: LayoutPersistenceHydrationInput = {
    ...input,
    windows: eligibleWindows,
  };
  const hydrated = planLayoutHydration(subset, returnedInput);

  if (!hydrated.ok) {
    return failed(hydrated.reason);
  }

  if (
    hydrated.value.contexts.length !== contexts.length ||
    hydrated.value.floatingWindows.length !== 0 ||
    hydrated.value.restoreBaselines.length !== 0
  ) {
    return failed("historical-state-invalid");
  }

  const plannedWindowIds = new Set<string>();

  for (const context of hydrated.value.contexts) {
    for (const column of context.layout.columns) {
      for (const windowId of column.windowIds) {
        const id = String(windowId);

        if (plannedWindowIds.has(id)) {
          return failed("historical-state-invalid");
        }

        plannedWindowIds.add(id);
      }
    }
  }

  const globallyMatchedWindowIds = new Set(
    globallyResolved.matches.map((match) => match.liveId),
  );

  if (
    globallyMatchedWindowIds.size !== selectedWindowKeys.size ||
    !equalSets(globallyMatchedWindowIds, plannedWindowIds)
  ) {
    return failed("unresolved-live-window");
  }

  const eligibleWindowIds = new Set(
    returnedWindows.map((window) => window.liveId),
  );

  if (!equalSets(plannedWindowIds, eligibleWindowIds)) {
    return failed("eligible-window-set-mismatch");
  }

  return Object.freeze({ kind: "plan", ok: true, value: hydrated.value });
}

function canonicalState(
  state: LayoutPersistenceV1,
): LayoutPersistenceV1 | null {
  let document: string;

  try {
    document = JSON.stringify(state);
  } catch {
    return null;
  }

  const decoded = decodeLayoutPersistence(document);
  return decoded.ok ? decoded.value : null;
}

function hasRestoreBaseline(state: LayoutPersistenceV1): boolean {
  return state.contexts.some(
    (context) =>
      context.restoreFingerprint !== undefined ||
      context.columns.some((column) =>
        column.members.some((member) => member.restoreBaseline !== undefined),
      ),
  );
}

function validTopology(topology: LayoutPersistenceTopologyV2): boolean {
  if (topology.outputs.length > LAYOUT_PERSISTENCE_LIMITS.outputs) {
    return false;
  }

  const keys = new Set<string>();
  const names = new Set<string>();

  for (const output of topology.outputs) {
    if (
      !validIdentifier(output.key) ||
      !validIdentifier(output.name) ||
      !validOptionalIdentifier(output.manufacturer) ||
      !validOptionalIdentifier(output.model) ||
      !validOptionalIdentifier(output.serialNumber) ||
      keys.has(output.key) ||
      names.has(output.name)
    ) {
      return false;
    }

    keys.add(output.key);
    names.add(output.name);
  }

  const selfMatch = matchPersistedOutputs(
    topology.outputs,
    liveOutputDescriptors(topology.outputs),
  );

  return (
    selfMatch.matches.length === topology.outputs.length &&
    selfMatch.unmatchedLiveIds.length === 0 &&
    selfMatch.unmatchedPersistedKeys.length === 0
  );
}

function stateMatchesTopology(
  state: LayoutPersistenceV1,
  topology: LayoutPersistenceTopologyV2,
): boolean {
  const topologyOutputs = new Map(
    topology.outputs.map((output) => [output.key, output] as const),
  );

  return state.outputs.every((output) => {
    const topologyOutput = topologyOutputs.get(output.key);
    return topologyOutput !== undefined && equalOutputs(output, topologyOutput);
  });
}

function inputMatchesCurrentTopology(
  input: LayoutPersistenceHydrationInput,
  topology: LayoutPersistenceTopologyV2,
): boolean {
  if (input.outputs.length !== topology.outputs.length) {
    return false;
  }

  const liveByName = new Map(
    input.outputs.map((output) => [output.name, output]),
  );

  if (liveByName.size !== input.outputs.length) {
    return false;
  }

  return topology.outputs.every((output) => {
    const live = liveByName.get(output.name);

    return (
      live !== undefined &&
      output.manufacturer === live.manufacturer &&
      output.model === live.model &&
      output.serialNumber === live.serialNumber
    );
  });
}

function completeTopologyMatch(
  matches: ReturnType<typeof matchPersistedOutputs>,
  historical: LayoutPersistenceTopologyV2,
  current: LayoutPersistenceTopologyV2,
): boolean {
  return (
    historical.outputs.length === current.outputs.length &&
    matches.matches.length === historical.outputs.length &&
    matches.unmatchedLiveIds.length === 0 &&
    matches.unmatchedPersistedKeys.length === 0
  );
}

function liveOutputDescriptors(outputs: readonly PersistedOutputV1[]) {
  return outputs.map((output) => ({
    liveId: output.name,
    ...(output.manufacturer === undefined
      ? {}
      : { manufacturer: output.manufacturer }),
    ...(output.model === undefined ? {} : { model: output.model }),
    name: output.name,
    ...(output.serialNumber === undefined
      ? {}
      : { serialNumber: output.serialNumber }),
  }));
}

function equalOutputs(
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

function equalSets(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function validOptionalIdentifier(value: string | undefined): boolean {
  return value === undefined || validIdentifier(value);
}

function validIdentifier(value: string): boolean {
  if (
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

function failed(
  reason: LayoutPersistenceKnownOutputFailure,
): LayoutPersistenceKnownOutputResult {
  return Object.freeze({ kind: "failed", ok: false, reason });
}
