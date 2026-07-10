import type { ShortcutBinding } from "./shortcut-profile";

export type ShortcutActionId = readonly [string, string, string, string];
export type ShortcutMatchType = 0 | 1 | 2;
export type ShortcutSequence = readonly [number, number, number, number];
type MaybePromise<T> = Promise<T> | T;

export interface ShortcutBackend {
  getOwners(
    key: number,
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

  const mutationOrder = [...conflictOrder, ...desiredOrder].filter(
    (key, index, keys) => keys.indexOf(key) === index,
  );
  const mutations: ShortcutMutation[] = [];

  for (const key of mutationOrder) {
    const action = requiredMapValue(actions, key);
    const previous = requiredMapValue(before, key);
    const next = normalizeSequences(final.get(key) ?? previous);

    if (!sameSequences(previous, next)) {
      mutations.push({ action, after: next, before: previous });
    }
  }

  return { mutations };
}

export async function applyShortcutClaimPlan(
  backend: ShortcutBackend,
  plan: ShortcutClaimPlan,
): Promise<void> {
  const applied: ShortcutMutation[] = [];

  try {
    for (const mutation of plan.mutations) {
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

  for (const mutation of [...state.mutations].reverse()) {
    const current = normalizeSequences(
      await backend.getShortcuts(mutation.action),
    );

    if (sameSequences(current, mutation.before)) {
      restored.push(mutation);
      continue;
    }

    if (!force && !sameSequences(current, mutation.after)) {
      pending.push(mutation);
      continue;
    }

    await backend.setShortcuts(mutation.action, mutation.before);

    try {
      await expectShortcuts(backend, mutation.action, mutation.before);
      restored.push(mutation);
    } catch {
      pending.push(mutation);
    }
  }

  return { pending: pending.reverse(), restored };
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

export function bindingAction(binding: ShortcutBinding): ShortcutActionId {
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
      const current = normalizeSequences(
        await backend.getShortcuts(mutation.action),
      );

      if (sameSequences(current, mutation.before)) {
        continue;
      }

      if (!sameSequences(current, mutation.after)) {
        failures.push(`${mutation.action[0]}/${mutation.action[1]}`);
        continue;
      }

      await backend.setShortcuts(mutation.action, mutation.before);
      await expectShortcuts(backend, mutation.action, mutation.before);
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
