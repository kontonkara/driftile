import type {
  PersistedOutputV1,
  PersistedWindowMatchV1,
  PersistedWindowV1,
} from "./layout-persistence";

const WINDOW_MATCH_FIELDS = [
  "desktopFileName",
  "resourceClass",
  "resourceName",
  "tag",
  "windowRole",
] as const;

const OUTPUT_MATCH_FIELDS = [
  "manufacturer",
  "model",
  "name",
  "serialNumber",
] as const;

export interface LiveWindowPersistenceDescriptor extends PersistedWindowMatchV1 {
  readonly liveId: string;
}

export interface LiveOutputPersistenceDescriptor {
  readonly liveId: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly name: string;
  readonly serialNumber?: string;
}

export interface ResolvedPersistedWindow {
  readonly basis: "live-id" | "session";
  readonly liveId: string;
  readonly persistedKey: string;
}

export interface ResolvedPersistedOutput {
  readonly basis: "descriptor";
  readonly liveId: string;
  readonly persistedKey: string;
}

export interface PersistedWindowMatchResult {
  readonly matches: readonly ResolvedPersistedWindow[];
  readonly unmatchedLiveIds: readonly string[];
  readonly unmatchedPersistedKeys: readonly string[];
}

export interface PersistedOutputMatchResult {
  readonly matches: readonly ResolvedPersistedOutput[];
  readonly unmatchedLiveIds: readonly string[];
  readonly unmatchedPersistedKeys: readonly string[];
}

interface IndexedDescriptor {
  readonly index: number;
  readonly mask: number;
  readonly values: readonly (string | undefined)[];
}

interface DescriptorGroup {
  count: number;
  index: number;
}

interface IdentityMatch {
  readonly liveIndex: number;
  readonly persistedIndex: number;
}

export function matchPersistedWindows(
  persisted: readonly PersistedWindowV1[],
  live: readonly LiveWindowPersistenceDescriptor[],
): PersistedWindowMatchResult {
  const matches: ResolvedPersistedWindow[] = [];
  const matchedPersisted = new Uint8Array(persisted.length);
  const matchedLive = new Uint8Array(live.length);

  for (const match of matchUniqueLiveIds(
    persisted.map((window) => window.liveId),
    live.map((window) => window.liveId),
  )) {
    matchedPersisted[match.persistedIndex] = 1;
    matchedLive[match.liveIndex] = 1;
    matches.push({
      basis: "live-id",
      liveId: required(live[match.liveIndex]).liveId,
      persistedKey: required(persisted[match.persistedIndex]).key,
    });
  }

  const persistedDescriptors: IndexedDescriptor[] = [];
  const liveDescriptors: IndexedDescriptor[] = [];

  for (const [index, window] of persisted.entries()) {
    if (matchedPersisted[index] !== 0 || window.sessionMatch === undefined) {
      continue;
    }

    const values = WINDOW_MATCH_FIELDS.map(
      (field) => window.sessionMatch?.[field],
    );
    const mask = presentMask(values);

    if (mask !== 0) {
      persistedDescriptors.push({ index, mask, values });
    }
  }

  const duplicateLiveIds = duplicateValues(live.map((window) => window.liveId));

  for (const [index, window] of live.entries()) {
    if (matchedLive[index] !== 0 || duplicateLiveIds.has(window.liveId)) {
      continue;
    }

    const values = WINDOW_MATCH_FIELDS.map((field) => window[field]);
    liveDescriptors.push({ index, mask: presentMask(values), values });
  }

  for (const match of matchMutuallyUniqueDescriptors(
    persistedDescriptors,
    liveDescriptors,
  )) {
    matchedPersisted[match.persistedIndex] = 1;
    matchedLive[match.liveIndex] = 1;
    matches.push({
      basis: "session",
      liveId: required(live[match.liveIndex]).liveId,
      persistedKey: required(persisted[match.persistedIndex]).key,
    });
  }

  return windowResult(matches, persisted, live, matchedPersisted, matchedLive);
}

export function matchPersistedOutputs(
  persisted: readonly PersistedOutputV1[],
  live: readonly LiveOutputPersistenceDescriptor[],
): PersistedOutputMatchResult {
  const matches: ResolvedPersistedOutput[] = [];
  const matchedPersisted = new Uint8Array(persisted.length);
  const matchedLive = new Uint8Array(live.length);

  const persistedDescriptors: IndexedDescriptor[] = [];
  const liveDescriptors: IndexedDescriptor[] = [];

  for (const [index, output] of persisted.entries()) {
    const values = OUTPUT_MATCH_FIELDS.map((field) => output[field]);
    let mask = presentMask(values);

    if (output.serialNumber !== undefined) {
      mask &= ~(1 << OUTPUT_MATCH_FIELDS.indexOf("name"));
    }

    persistedDescriptors.push({ index, mask, values });
  }

  const duplicateLiveIds = duplicateValues(live.map((output) => output.liveId));

  for (const [index, output] of live.entries()) {
    if (matchedLive[index] !== 0 || duplicateLiveIds.has(output.liveId)) {
      continue;
    }

    const values = OUTPUT_MATCH_FIELDS.map((field) => output[field]);
    liveDescriptors.push({ index, mask: presentMask(values), values });
  }

  for (const match of matchMutuallyUniqueDescriptors(
    persistedDescriptors,
    liveDescriptors,
  )) {
    matchedPersisted[match.persistedIndex] = 1;
    matchedLive[match.liveIndex] = 1;
    matches.push({
      basis: "descriptor",
      liveId: required(live[match.liveIndex]).liveId,
      persistedKey: required(persisted[match.persistedIndex]).key,
    });
  }

  return outputResult(matches, persisted, live, matchedPersisted, matchedLive);
}

function matchUniqueLiveIds(
  persistedIds: readonly string[],
  liveIds: readonly string[],
): readonly IdentityMatch[] {
  const persistedGroups = groupIdentities(persistedIds);
  const liveGroups = groupIdentities(liveIds);
  const matches: IdentityMatch[] = [];

  for (const [liveId, persistedGroup] of persistedGroups) {
    const liveGroup = liveGroups.get(liveId);

    if (
      persistedGroup.count === 1 &&
      liveGroup !== undefined &&
      liveGroup.count === 1
    ) {
      matches.push({
        liveIndex: liveGroup.index,
        persistedIndex: persistedGroup.index,
      });
    }
  }

  return matches;
}

function matchMutuallyUniqueDescriptors(
  persisted: readonly IndexedDescriptor[],
  live: readonly IndexedDescriptor[],
): readonly IdentityMatch[] {
  const liveGroups = new Map<string, DescriptorGroup>();

  for (const descriptor of live) {
    forEachSubset(descriptor.mask, (mask) => {
      addGroup(
        liveGroups,
        descriptorKey(descriptor.values, mask),
        descriptor.index,
      );
    });
  }

  const persistedGroups = new Map<string, DescriptorGroup>();

  for (const descriptor of persisted) {
    addGroup(
      persistedGroups,
      descriptorKey(descriptor.values, descriptor.mask),
      descriptor.index,
    );
  }

  const liveDegrees = new Map<number, number>();

  for (const descriptor of live) {
    let degree = 0;

    forEachSubset(descriptor.mask, (mask) => {
      degree +=
        persistedGroups.get(descriptorKey(descriptor.values, mask))?.count ?? 0;
    });
    liveDegrees.set(descriptor.index, degree);
  }

  const matches: IdentityMatch[] = [];

  for (const descriptor of persisted) {
    const group = liveGroups.get(
      descriptorKey(descriptor.values, descriptor.mask),
    );

    if (
      group?.count === 1 &&
      persistedGroups.get(descriptorKey(descriptor.values, descriptor.mask))
        ?.count === 1 &&
      liveDegrees.get(group.index) === 1
    ) {
      matches.push({
        liveIndex: group.index,
        persistedIndex: descriptor.index,
      });
    }
  }

  return matches;
}

function groupIdentities(
  values: readonly string[],
): Map<string, DescriptorGroup> {
  const groups = new Map<string, DescriptorGroup>();

  for (const [index, value] of values.entries()) {
    addGroup(groups, value, index);
  }

  return groups;
}

function duplicateValues(values: readonly string[]): ReadonlySet<string> {
  const groups = groupIdentities(values);
  const duplicates = new Set<string>();

  for (const [value, group] of groups) {
    if (group.count > 1) {
      duplicates.add(value);
    }
  }

  return duplicates;
}

function addGroup(
  groups: Map<string, DescriptorGroup>,
  signature: string,
  index: number,
): void {
  const group = groups.get(signature);

  if (group === undefined) {
    groups.set(signature, { count: 1, index });
  } else {
    group.count += 1;
  }
}

function presentMask(values: readonly (string | undefined)[]): number {
  let mask = 0;

  for (const [index, value] of values.entries()) {
    if (value !== undefined) {
      mask |= 1 << index;
    }
  }

  return mask;
}

function forEachSubset(mask: number, visit: (subset: number) => void): void {
  for (let subset = mask; subset !== 0; subset = (subset - 1) & mask) {
    visit(subset);
  }
}

function descriptorKey(
  values: readonly (string | undefined)[],
  mask: number,
): string {
  let key = String(mask);

  for (const [index, value] of values.entries()) {
    if ((mask & (1 << index)) !== 0 && value !== undefined) {
      key += `:${String(value.length)}:${value}`;
    }
  }

  return key;
}

function windowResult(
  matches: ResolvedPersistedWindow[],
  persisted: readonly PersistedWindowV1[],
  live: readonly LiveWindowPersistenceDescriptor[],
  matchedPersisted: Uint8Array,
  matchedLive: Uint8Array,
): PersistedWindowMatchResult {
  return {
    matches: matches.sort(compareMatches),
    unmatchedLiveIds: unmatchedLive(live, matchedLive),
    unmatchedPersistedKeys: unmatchedPersisted(persisted, matchedPersisted),
  };
}

function outputResult(
  matches: ResolvedPersistedOutput[],
  persisted: readonly PersistedOutputV1[],
  live: readonly LiveOutputPersistenceDescriptor[],
  matchedPersisted: Uint8Array,
  matchedLive: Uint8Array,
): PersistedOutputMatchResult {
  return {
    matches: matches.sort(compareMatches),
    unmatchedLiveIds: unmatchedLive(live, matchedLive),
    unmatchedPersistedKeys: unmatchedPersisted(persisted, matchedPersisted),
  };
}

function unmatchedLive(
  live: readonly { readonly liveId: string }[],
  matched: Uint8Array,
): readonly string[] {
  return live
    .filter((_descriptor, index) => matched[index] === 0)
    .map((descriptor) => descriptor.liveId)
    .sort(compareStrings);
}

function unmatchedPersisted(
  persisted: readonly { readonly key: string }[],
  matched: Uint8Array,
): readonly string[] {
  return persisted
    .filter((_descriptor, index) => matched[index] === 0)
    .map((descriptor) => descriptor.key)
    .sort(compareStrings);
}

function compareMatches(
  left: { readonly liveId: string; readonly persistedKey: string },
  right: { readonly liveId: string; readonly persistedKey: string },
): number {
  return (
    compareStrings(left.persistedKey, right.persistedKey) ||
    compareStrings(left.liveId, right.liveId)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("matched descriptor is missing");
  }

  return value;
}
