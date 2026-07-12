import type { ShortcutBinding } from "./shortcut-profile";

export type ShortcutActionId = readonly [string, string, string, string];
export type ShortcutMatchType = 0 | 1 | 2;
export type ShortcutSequence = readonly [number, number, number, number];
type MaybePromise<T> = Promise<T> | T;

export interface ShortcutBackend {
  getOwners(
    shortcut: number | ShortcutSequence,
    matchType?: ShortcutMatchType,
  ): MaybePromise<readonly ShortcutActionId[]>;
  getShortcuts(
    action: ShortcutActionId,
  ): MaybePromise<readonly ShortcutSequence[]>;
  hasAction(action: ShortcutActionId): MaybePromise<boolean>;
  isRuntimeActive(): MaybePromise<boolean>;
  setShortcuts(
    action: ShortcutActionId,
    shortcuts: readonly ShortcutSequence[],
  ): MaybePromise<void>;
}

export interface ShortcutMutation {
  readonly action: ShortcutActionId;
  readonly after: readonly ShortcutSequence[];
  readonly before: readonly ShortcutSequence[];
}

export interface ShortcutClaimPlan {
  readonly mutations: readonly ShortcutMutation[];
}

export interface ShortcutClaimState {
  readonly mutations: readonly ShortcutMutation[];
  readonly profile: string;
  readonly status: "claimed" | "claiming";
  readonly version: 1;
}

export interface ShortcutProfileIssue {
  readonly binding: ShortcutBinding;
  readonly owners: readonly ShortcutActionId[];
}

export interface ShortcutReplacement {
  readonly action: ShortcutActionId;
  readonly shortcuts: readonly ShortcutSequence[];
}

export interface ShortcutReplacementIssue {
  readonly action: ShortcutActionId;
  readonly actual: readonly ShortcutSequence[];
  readonly expected: readonly ShortcutSequence[];
  readonly owners: readonly ShortcutActionId[];
}

export interface ShortcutReleaseResult {
  readonly pending: readonly ShortcutMutation[];
  readonly restored: readonly ShortcutMutation[];
}

const componentFriendlyName = "KWin";
const componentUniqueName = "kwin";

export async function buildShortcutClaimPlan(
  backend: ShortcutBackend,
  bindings: readonly ShortcutBinding[],
): Promise<ShortcutClaimPlan> {
  if (!(await backend.isRuntimeActive())) {
    throw new Error("Driftile must be enabled before claiming shortcuts");
  }

  const actions = new Map<string, ShortcutActionId>();
  const before = new Map<string, readonly ShortcutSequence[]>();
  const final = new Map<string, readonly ShortcutSequence[]>();
  const conflictOrder: string[] = [];
  const desiredOrder: string[] = [];
  const dependencies = new Map<string, Set<string>>();
  const removalKeys = new Map<string, Set<string>>();

  async function capture(action: ShortcutActionId): Promise<string> {
    const key = actionKey(action);

    if (!before.has(key)) {
      actions.set(key, action);
      before.set(key, normalizeSequences(await backend.getShortcuts(action)));
    }

    return key;
  }

  for (const binding of bindings) {
    const action = bindingAction(binding);

    if (!(await backend.hasAction(action))) {
      throw new Error(
        `Shortcut action is unavailable; enable Driftile first: ${binding.name}`,
      );
    }

    const key = await capture(action);

    if (!desiredOrder.includes(key)) {
      desiredOrder.push(key);
    }
  }

  for (const binding of bindings) {
    const desiredAction = bindingAction(binding);
    const desiredKey = actionKey(desiredAction);

    for (const matchType of [1, 2] as const) {
      const multiStepOwners = uniqueActions(
        await backend.getOwners(binding.key, matchType),
      ).filter((owner) => !sameAction(owner, desiredAction));

      if (multiStepOwners.length > 0) {
        throw new Error(
          `Multi-step shortcut conflict for ${binding.sequence}: ${multiStepOwners
            .map((owner) => `${owner[0]}/${owner[1]}`)
            .join(", ")}`,
        );
      }
    }

    for (const owner of await backend.getOwners(binding.key)) {
      if (sameAction(owner, desiredAction)) {
        continue;
      }

      const key = await capture(owner);
      let keys = removalKeys.get(key);

      if (!keys) {
        keys = new Set<string>();
        removalKeys.set(key, keys);
        conflictOrder.push(key);
      }

      keys.add(sequenceKey(singleKeySequence(binding.key)));

      let dependents = dependencies.get(key);

      if (!dependents) {
        dependents = new Set<string>();
        dependencies.set(key, dependents);
      }

      dependents.add(desiredKey);
    }
  }

  for (const [key, removals] of removalKeys) {
    final.set(
      key,
      requiredMapValue(before, key).filter(
        (shortcut) => !removals.has(sequenceKey(shortcut)),
      ),
    );
  }

  for (const binding of bindings) {
    const key = actionKey(bindingAction(binding));
    const current = final.get(key) ?? requiredMapValue(before, key);
    final.set(
      key,
      normalizeSequences([...current, singleKeySequence(binding.key)]),
    );
  }

  const mutationOrder = buildMutationOrder(
    before,
    final,
    dependencies,
    uniqueStrings([...conflictOrder, ...desiredOrder, ...before.keys()]),
  );
  const mutations: ShortcutMutation[] = [];

  for (const key of mutationOrder) {
    const action = requiredMapValue(actions, key);
    const previous = requiredMapValue(before, key);
    const next = normalizeSequences(final.get(key) ?? previous);

    mutations.push({ action, after: next, before: previous });
  }

  return { mutations };
}

export async function buildShortcutReplacementPlan(
  backend: ShortcutBackend,
  replacements: readonly ShortcutReplacement[],
): Promise<ShortcutClaimPlan> {
  if (!(await backend.isRuntimeActive())) {
    throw new Error("Driftile must be enabled before claiming shortcuts");
  }

  const actions = new Map<string, ShortcutActionId>();
  const before = new Map<string, readonly ShortcutSequence[]>();
  const final = new Map<string, readonly ShortcutSequence[]>();
  const dependencies = new Map<string, Set<string>>();
  const conflictOrder: string[] = [];
  const targetOrder: string[] = [];
  const desiredOwners = new Map<string, string>();

  async function capture(action: ShortcutActionId): Promise<string> {
    const key = actionKey(action);

    if (!before.has(key)) {
      actions.set(key, action);
      const shortcuts = normalizeSequences(await backend.getShortcuts(action));
      before.set(key, shortcuts);
      final.set(key, shortcuts);
    }

    return key;
  }

  for (const replacement of replacements) {
    const key = actionKey(replacement.action);

    if (targetOrder.includes(key)) {
      throw new Error(`Duplicate shortcut target: ${replacement.action[1]}`);
    }

    if (!(await backend.hasAction(replacement.action))) {
      throw new Error(
        `Shortcut action is unavailable; enable Driftile first: ${replacement.action[1]}`,
      );
    }

    const shortcuts = normalizeSequences(replacement.shortcuts);

    if (shortcuts.length !== replacement.shortcuts.length) {
      throw new Error(
        `Duplicate shortcut requested for: ${replacement.action[1]}`,
      );
    }

    await capture(replacement.action);
    final.set(key, shortcuts);
    targetOrder.push(key);

    for (const shortcut of shortcuts) {
      const sequence = sequenceKey(shortcut);
      const owner = desiredOwners.get(sequence);

      if (owner && owner !== key) {
        throw new Error("One shortcut cannot be assigned to several actions");
      }

      desiredOwners.set(sequence, key);
    }
  }

  for (const replacement of replacements) {
    const desiredKey = actionKey(replacement.action);

    for (const shortcut of normalizeSequences(replacement.shortcuts)) {
      for (const matchType of [1, 2] as const) {
        const multiStepOwners = uniqueActions(
          await backend.getOwners(shortcut, matchType),
        ).filter((owner) => !sameAction(owner, replacement.action));

        if (multiStepOwners.length > 0) {
          throw new Error(
            `Multi-step shortcut conflict for ${sequenceKey(shortcut)}: ${multiStepOwners
              .map((owner) => `${owner[0]}/${owner[1]}`)
              .join(", ")}`,
          );
        }
      }

      for (const owner of await backend.getOwners(shortcut)) {
        if (sameAction(owner, replacement.action)) {
          continue;
        }

        const ownerKey = await capture(owner);
        const previous = requiredMapValue(before, ownerKey);

        if (!previous.some((candidate) => sameSequence(candidate, shortcut))) {
          throw new Error("Shortcut ownership changed while planning");
        }

        const next = requiredMapValue(final, ownerKey).filter(
          (candidate) => !sameSequence(candidate, shortcut),
        );
        final.set(ownerKey, next);

        let dependents = dependencies.get(ownerKey);

        if (!dependents) {
          dependents = new Set<string>();
          dependencies.set(ownerKey, dependents);
          conflictOrder.push(ownerKey);
        }

        dependents.add(desiredKey);
      }
    }
  }

  const mutationOrder = buildMutationOrder(
    before,
    final,
    dependencies,
    uniqueStrings([...conflictOrder, ...targetOrder, ...before.keys()]),
  );
  const unchangedTargets = targetOrder.filter((key) =>
    sameSequences(requiredMapValue(before, key), requiredMapValue(final, key)),
  );

  return {
    mutations: [...mutationOrder, ...unchangedTargets].map((key) => ({
      action: requiredMapValue(actions, key),
      after: requiredMapValue(final, key),
      before: requiredMapValue(before, key),
    })),
  };
}

export async function applyShortcutClaimPlan(
  backend: ShortcutBackend,
  plan: ShortcutClaimPlan,
): Promise<void> {
  const applied: ShortcutMutation[] = [];

  try {
    for (const mutation of plan.mutations) {
      if (sameSequences(mutation.before, mutation.after)) {
        continue;
      }

      applied.push(mutation);
      await backend.setShortcuts(mutation.action, mutation.after);
      await expectShortcuts(backend, mutation.action, mutation.after);
    }
  } catch (error) {
    await rollbackMutations(backend, applied);
    throw error;
  }
}

export async function rollbackShortcutClaim(
  backend: ShortcutBackend,
  state: ShortcutClaimState,
): Promise<void> {
  await rollbackMutations(backend, state.mutations);
}

export async function releaseShortcutClaim(
  backend: ShortcutBackend,
  state: ShortcutClaimState,
  force = false,
): Promise<ShortcutReleaseResult> {
  const pending: ShortcutMutation[] = [];
  const restored: ShortcutMutation[] = [];
  const originalOwners = originalShortcutOwners(state);

  for (const mutation of [...state.mutations].reverse()) {
    if (sameSequences(mutation.before, mutation.after)) {
      restored.push(mutation);
      continue;
    }

    const previous = normalizeSequences(mutation.before);
    const claimed = normalizeSequences(mutation.after);
    const current = normalizeSequences(
      await backend.getShortcuts(mutation.action),
    );

    if (sameSequences(current, previous)) {
      restored.push(mutation);
      continue;
    }

    if (!force && !sameSequences(current, claimed)) {
      pending.push(mutation);
      continue;
    }

    if (
      !force &&
      (await hasNewForeignOwners(
        backend,
        mutation.action,
        previous,
        originalOwners,
      ))
    ) {
      pending.push(mutation);
      continue;
    }

    await backend.setShortcuts(mutation.action, previous);

    try {
      await expectShortcuts(backend, mutation.action, previous);
      restored.push(mutation);
    } catch {
      pending.push(mutation);
    }
  }

  return { pending: pending.reverse(), restored };
}

async function hasNewForeignOwners(
  backend: ShortcutBackend,
  action: ShortcutActionId,
  shortcuts: readonly ShortcutSequence[],
  originalOwners: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<boolean> {
  for (const shortcut of shortcuts) {
    const owners = uniqueActions([
      ...(await backend.getOwners(shortcut)),
      ...(await backend.getOwners(shortcut, 1)),
      ...(await backend.getOwners(shortcut, 2)),
    ]);
    const allowedOwners = originalOwners.get(sequenceKey(shortcut));

    if (
      owners.some(
        (owner) =>
          !sameAction(owner, action) && !allowedOwners?.has(actionKey(owner)),
      )
    ) {
      return true;
    }
  }

  return false;
}

function originalShortcutOwners(
  state: ShortcutClaimState,
): ReadonlyMap<string, ReadonlySet<string>> {
  const owners = new Map<string, Set<string>>();
  const mutatedActions = new Set(
    state.mutations.map((mutation) => actionKey(mutation.action)),
  );

  function add(sequence: ShortcutSequence, action: string): void {
    const key = sequenceKey(sequence);
    let sequenceOwners = owners.get(key);

    if (!sequenceOwners) {
      sequenceOwners = new Set<string>();
      owners.set(key, sequenceOwners);
    }

    sequenceOwners.add(action);
  }

  for (const mutation of state.mutations) {
    const owner = actionKey(mutation.action);

    for (const shortcut of normalizeSequences(mutation.before)) {
      add(shortcut, owner);
    }
  }

  for (const entry of state.profile.split("|")) {
    const separator = entry.lastIndexOf(":");

    if (separator < 1) {
      continue;
    }

    const name = entry.slice(0, separator);
    const encoded = entry.slice(separator + 1);

    if (!/^driftile_[a-z0-9_]+$/.test(name) || !/^-?\d+$/.test(encoded)) {
      continue;
    }

    const key = Number(encoded);

    if (!Number.isSafeInteger(key)) {
      continue;
    }

    const owner = `${componentUniqueName}\u0000${name}`;

    if (!mutatedActions.has(owner)) {
      add(singleKeySequence(key), owner);
    }
  }

  return owners;
}

export async function inspectShortcutProfile(
  backend: ShortcutBackend,
  bindings: readonly ShortcutBinding[],
): Promise<readonly ShortcutProfileIssue[]> {
  if (!(await backend.isRuntimeActive())) {
    throw new Error("Driftile is not active");
  }

  const issues: ShortcutProfileIssue[] = [];

  for (const binding of bindings) {
    const desired = bindingAction(binding);
    const equalOwners = uniqueActions(await backend.getOwners(binding.key));
    const owner = equalOwners[0];
    const shadowOwners = uniqueActions([
      ...(await backend.getOwners(binding.key, 1)),
      ...(await backend.getOwners(binding.key, 2)),
    ]).filter((candidate) => !sameAction(candidate, desired));

    if (
      equalOwners.length !== 1 ||
      !owner ||
      !sameAction(owner, desired) ||
      shadowOwners.length > 0
    ) {
      issues.push({
        binding,
        owners: uniqueActions([...equalOwners, ...shadowOwners]),
      });
    }
  }

  return issues;
}

export async function inspectShortcutReplacements(
  backend: ShortcutBackend,
  replacements: readonly ShortcutReplacement[],
): Promise<readonly ShortcutReplacementIssue[]> {
  if (!(await backend.isRuntimeActive())) {
    throw new Error("Driftile is not active");
  }

  const issues: ShortcutReplacementIssue[] = [];

  for (const replacement of replacements) {
    if (!(await backend.hasAction(replacement.action))) {
      throw new Error(
        `Shortcut action is unavailable; enable Driftile first: ${replacement.action[1]}`,
      );
    }

    const expected = normalizeSequences(replacement.shortcuts);
    const actual = normalizeSequences(
      await backend.getShortcuts(replacement.action),
    );
    const owners: ShortcutActionId[] = [];
    let invalidOwnership = false;

    for (const shortcut of expected) {
      const equalOwners = uniqueActions(await backend.getOwners(shortcut));
      const shadowOwners = uniqueActions([
        ...(await backend.getOwners(shortcut, 1)),
        ...(await backend.getOwners(shortcut, 2)),
      ]).filter((owner) => !sameAction(owner, replacement.action));

      owners.push(...equalOwners, ...shadowOwners);
      invalidOwnership ||=
        equalOwners.length !== 1 ||
        !equalOwners.some((owner) => sameAction(owner, replacement.action)) ||
        shadowOwners.length > 0;
    }

    const unique = uniqueActions(owners);

    if (!sameSequences(actual, expected) || invalidOwnership) {
      issues.push({
        action: replacement.action,
        actual,
        expected,
        owners: unique,
      });
    }
  }

  return issues;
}

export function bindingAction(
  binding: Pick<ShortcutBinding, "name" | "text">,
): ShortcutActionId {
  return [
    componentUniqueName,
    binding.name,
    componentFriendlyName,
    binding.text,
  ];
}

export function actionKey(action: ShortcutActionId): string {
  return `${action[0]}\u0000${action[1]}`;
}

export function sameAction(
  left: ShortcutActionId,
  right: ShortcutActionId,
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export function singleKeySequence(key: number): ShortcutSequence {
  return [key, 0, 0, 0];
}

function normalizeSequences(
  sequences: readonly ShortcutSequence[],
): readonly ShortcutSequence[] {
  const unique = new Map<string, ShortcutSequence>();

  for (const sequence of sequences) {
    if (sequence.every((key) => key === 0)) {
      continue;
    }

    unique.set(sequenceKey(sequence), sequence);
  }

  return [...unique.values()].sort(compareSequences);
}

function sameSequences(
  left: readonly ShortcutSequence[],
  right: readonly ShortcutSequence[],
): boolean {
  const normalizedLeft = normalizeSequences(left);
  const normalizedRight = normalizeSequences(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((sequence, index) => {
      const other = normalizedRight[index];
      return (
        other !== undefined && sequenceKey(sequence) === sequenceKey(other)
      );
    })
  );
}

function sameSequence(
  left: ShortcutSequence,
  right: ShortcutSequence,
): boolean {
  return sequenceKey(left) === sequenceKey(right);
}

async function expectShortcuts(
  backend: ShortcutBackend,
  action: ShortcutActionId,
  expected: readonly ShortcutSequence[],
): Promise<void> {
  const actual = await backend.getShortcuts(action);

  if (!sameSequences(actual, expected)) {
    throw new Error(
      `KGlobalAccel rejected shortcuts for ${action[0]}/${action[1]}`,
    );
  }
}

async function rollbackMutations(
  backend: ShortcutBackend,
  mutations: readonly ShortcutMutation[],
): Promise<void> {
  const failures: string[] = [];

  for (const mutation of [...mutations].reverse()) {
    try {
      if (sameSequences(mutation.before, mutation.after)) {
        continue;
      }

      const before = normalizeSequences(mutation.before);
      const after = normalizeSequences(mutation.after);
      const current = normalizeSequences(
        await backend.getShortcuts(mutation.action),
      );

      if (sameSequences(current, before)) {
        continue;
      }

      if (!sameSequences(current, after)) {
        failures.push(`${mutation.action[0]}/${mutation.action[1]}`);
        continue;
      }

      await backend.setShortcuts(mutation.action, before);
      await expectShortcuts(backend, mutation.action, before);
    } catch {
      failures.push(`${mutation.action[0]}/${mutation.action[1]}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Shortcut rollback failed for: ${failures.join(", ")}`);
  }
}

function uniqueActions(
  actions: readonly ShortcutActionId[],
): readonly ShortcutActionId[] {
  const unique = new Map<string, ShortcutActionId>();

  for (const action of actions) {
    unique.set(actionKey(action), action);
  }

  return [...unique.values()];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function buildMutationOrder(
  before: ReadonlyMap<string, readonly ShortcutSequence[]>,
  final: ReadonlyMap<string, readonly ShortcutSequence[]>,
  dependencies: ReadonlyMap<string, ReadonlySet<string>>,
  preferredOrder: readonly string[],
): readonly string[] {
  const changed = [...before.keys()].filter(
    (key) =>
      !sameSequences(
        requiredMapValue(before, key),
        requiredMapValue(final, key),
      ),
  );
  const changedSet = new Set(changed);
  const indegree = new Map(changed.map((key) => [key, 0]));

  for (const [owner, dependents] of dependencies) {
    if (!changedSet.has(owner)) {
      continue;
    }

    for (const dependent of dependents) {
      if (changedSet.has(dependent) && dependent !== owner) {
        indegree.set(dependent, requiredMapValue(indegree, dependent) + 1);
      }
    }
  }

  const remaining = new Set(changed);
  const mutationOrder: string[] = [];

  while (remaining.size > 0) {
    const next = preferredOrder.find(
      (key) => remaining.has(key) && requiredMapValue(indegree, key) === 0,
    );

    if (!next) {
      throw new Error(
        "Shortcut reassignment cycle; unbind one participating action first",
      );
    }

    remaining.delete(next);
    mutationOrder.push(next);

    for (const dependent of dependencies.get(next) ?? []) {
      if (remaining.has(dependent)) {
        indegree.set(dependent, requiredMapValue(indegree, dependent) - 1);
      }
    }
  }

  return mutationOrder;
}

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error("Shortcut claim plan is internally inconsistent");
  }

  return value;
}

function sequenceKey(sequence: ShortcutSequence): string {
  return sequence.map(String).join(":");
}

function compareSequences(
  left: ShortcutSequence,
  right: ShortcutSequence,
): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}
