import { describe, expect, it } from "vitest";
import {
  actionKey,
  applyShortcutClaimPlan,
  bindingAction,
  buildShortcutClaimPlan,
  inspectShortcutProfile,
  releaseShortcutClaim,
  rollbackShortcutClaim,
  singleKeySequence,
  type ShortcutActionId,
  type ShortcutBackend,
  type ShortcutClaimState,
  type ShortcutMatchType,
  type ShortcutSequence,
} from "../src/shortcut-ownership";
import { encodeShortcut, type ShortcutBinding } from "../src/shortcut-profile";

const stockAction: ShortcutActionId = [
  "kwin",
  "stock_action",
  "KWin",
  "Stock action",
];
const extraKey = encodeShortcut("Meta+X");
const changedKey = encodeShortcut("Meta+Y");
const extraSequence: ShortcutSequence = [extraKey, changedKey, 0, 0];

describe("shortcut ownership", () => {
  it("encodes Qt key sequences including shifted symbols and navigation keys", () => {
    expect(encodeShortcut("Meta+H")).toBe(0x10000048);
    expect(encodeShortcut("Meta+1")).toBe(0x10000031);
    expect(encodeShortcut("Meta+Ctrl+9")).toBe(0x14000039);
    expect(encodeShortcut("Meta+=")).toBe(0x1000003d);
    expect(encodeShortcut("Meta+,")).toBe(0x1000002c);
    expect(encodeShortcut("Meta+.")).toBe(0x1000002e);
    expect(encodeShortcut("Meta+_")).toBe(0x1000005f);
    expect(encodeShortcut("Meta++")).toBe(0x1000002b);
    expect(encodeShortcut("Meta+Ctrl+R")).toBe(0x14000052);
    expect(encodeShortcut("Meta+Ctrl+Shift+R")).toBe(0x16000052);
    expect(encodeShortcut("Meta+Shift+F")).toBe(0x12000046);
    expect(encodeShortcut("Meta+M")).toBe(0x1000004d);
    expect(encodeShortcut("Meta+Ctrl+C")).toBe(0x14000043);
    expect(encodeShortcut("Meta+Ctrl+F")).toBe(0x14000046);
    expect(encodeShortcut("Meta+Home")).toBe(0x11000010);
    expect(encodeShortcut("Meta+End")).toBe(0x11000011);
    expect(encodeShortcut("Meta+Ctrl+Home")).toBe(0x15000010);
    expect(encodeShortcut("Meta+Ctrl+End")).toBe(0x15000011);
    expect(encodeShortcut("Meta+Ctrl+Shift+Left")).toBe(0x17000012);
  });

  it("removes several target keys from one owner without losing other keys", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const bindings = [left, right];
    const backend = new FakeBackend(bindings);
    backend.setInitial(stockAction, [
      singleKeySequence(left.key),
      singleKeySequence(right.key),
      extraSequence,
    ]);
    backend.setInitial(bindingAction(left), [singleKeySequence(left.key)]);
    backend.setInitial(bindingAction(right), [singleKeySequence(right.key)]);

    const plan = await buildShortcutClaimPlan(backend, bindings);

    expect(plan.mutations).toEqual([
      {
        action: stockAction,
        before: [
          extraSequence,
          singleKeySequence(left.key),
          singleKeySequence(right.key),
        ],
        after: [extraSequence],
      },
    ]);

    await applyShortcutClaimPlan(backend, plan);

    expect(await backend.getShortcuts(stockAction)).toEqual([extraSequence]);
    expect(await inspectShortcutProfile(backend, bindings)).toEqual([]);
  });

  it("adds the profile key without deleting a custom Driftile shortcut", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(bindingAction(target), [extraSequence]);

    const plan = await buildShortcutClaimPlan(backend, [target]);

    expect(plan.mutations).toEqual([
      {
        action: bindingAction(target),
        before: [extraSequence],
        after: [extraSequence, singleKeySequence(target.key)],
      },
    ]);
  });

  it("moves a profile key away from the wrong Driftile action", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const backend = new FakeBackend([left, right]);
    backend.setInitial(bindingAction(left), [singleKeySequence(right.key)]);

    const plan = await buildShortcutClaimPlan(backend, [left, right]);
    await applyShortcutClaimPlan(backend, plan);

    expect(await backend.getShortcuts(bindingAction(left))).toEqual([
      singleKeySequence(left.key),
    ]);
    expect(await backend.getShortcuts(bindingAction(right))).toEqual([
      singleKeySequence(right.key),
    ]);
    expect(await inspectShortcutProfile(backend, [left, right])).toEqual([]);
  });

  it("rolls applied mutations back when KGlobalAccel rejects a write", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, [
      singleKeySequence(target.key),
      extraSequence,
    ]);
    backend.failNextWrite(bindingAction(target));
    const plan = await buildShortcutClaimPlan(backend, [target]);

    await expect(applyShortcutClaimPlan(backend, plan)).rejects.toThrow(
      "injected write failure",
    );
    expect(await backend.getShortcuts(stockAction)).toEqual([
      extraSequence,
      singleKeySequence(target.key),
    ]);
    expect(await backend.getShortcuts(bindingAction(target))).toEqual([]);
  });

  it("preserves assignments changed after claiming during release", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, [
      extraSequence,
      singleKeySequence(changedKey),
    ]);
    backend.setInitial(desired, [singleKeySequence(target.key)]);
    const state: ShortcutClaimState = {
      mutations: [
        {
          action: stockAction,
          before: [singleKeySequence(target.key), extraSequence],
          after: [extraSequence],
        },
        {
          action: desired,
          before: [],
          after: [singleKeySequence(target.key)],
        },
      ],
      profile: "test",
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state);

    expect(result.pending.map((mutation) => mutation.action)).toEqual([
      stockAction,
    ]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      extraSequence,
      singleKeySequence(changedKey),
    ]);
    expect(await backend.getShortcuts(desired)).toEqual([]);
  });

  it("treats an already restored assignment as released", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, [singleKeySequence(target.key)]);
    const mutation = {
      action: stockAction,
      before: [singleKeySequence(target.key)],
      after: [] as readonly ShortcutSequence[],
    };
    const state: ShortcutClaimState = {
      mutations: [mutation],
      profile: "test",
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state);

    expect(result.pending).toEqual([]);
    expect(result.restored).toEqual([mutation]);
    expect(backend.writes).toEqual([]);
  });

  it("does not overwrite a divergent assignment during crash recovery", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, [
      extraSequence,
      singleKeySequence(changedKey),
    ]);
    const state: ShortcutClaimState = {
      mutations: [
        {
          action: stockAction,
          before: [singleKeySequence(target.key), extraSequence],
          after: [extraSequence],
        },
      ],
      profile: "test",
      status: "claiming",
      version: 1,
    };

    await expect(rollbackShortcutClaim(backend, state)).rejects.toThrow(
      "Shortcut rollback failed",
    );
    expect(await backend.getShortcuts(stockAction)).toEqual([
      extraSequence,
      singleKeySequence(changedKey),
    ]);
  });

  it("refuses to plan before every Driftile action is available", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([]);

    await expect(buildShortcutClaimPlan(backend, [target])).rejects.toThrow(
      "enable Driftile first",
    );
  });

  it("refuses to claim or validate an inactive runtime", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setRuntimeActive(false);

    await expect(buildShortcutClaimPlan(backend, [target])).rejects.toThrow(
      "must be enabled",
    );
    await expect(inspectShortcutProfile(backend, [target])).rejects.toThrow(
      "not active",
    );
  });

  it("reports multi-step conflicts without mutating them", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setMatchOwners(target.key, 1, [stockAction]);

    await expect(buildShortcutClaimPlan(backend, [target])).rejects.toThrow(
      "Multi-step shortcut conflict",
    );
    expect(backend.writes).toEqual([]);
  });

  it("detects a multi-step conflict added after claiming", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(bindingAction(target), [singleKeySequence(target.key)]);
    backend.setMatchOwners(target.key, 2, [stockAction]);

    const issues = await inspectShortcutProfile(backend, [target]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.owners).toContainEqual(stockAction);
  });
});

class FakeBackend implements ShortcutBackend {
  readonly writes: ShortcutActionId[] = [];
  readonly #actions = new Map<string, ShortcutActionId>();
  readonly #failures = new Set<string>();
  readonly #matchOwners = new Map<string, readonly ShortcutActionId[]>();
  #runtimeActive = true;
  readonly #shortcuts = new Map<string, readonly ShortcutSequence[]>();

  constructor(bindings: readonly ShortcutBinding[]) {
    for (const item of bindings) {
      const action = bindingAction(item);
      this.#actions.set(actionKey(action), action);
      this.#shortcuts.set(actionKey(action), []);
    }
  }

  getOwners(
    key: number,
    matchType: ShortcutMatchType = 0,
  ): Promise<readonly ShortcutActionId[]> {
    if (matchType !== 0) {
      return Promise.resolve(
        this.#matchOwners.get(matchOwnerKey(key, matchType)) ?? [],
      );
    }

    return Promise.resolve(
      [...this.#actions.values()].filter((action) =>
        (this.#shortcuts.get(actionKey(action)) ?? []).some((sequence) =>
          sameSequence(sequence, singleKeySequence(key)),
        ),
      ),
    );
  }

  getShortcuts(action: ShortcutActionId): Promise<readonly ShortcutSequence[]> {
    return Promise.resolve(this.#shortcuts.get(actionKey(action)) ?? []);
  }

  hasAction(action: ShortcutActionId): Promise<boolean> {
    return Promise.resolve(this.#actions.has(actionKey(action)));
  }

  isRuntimeActive(): Promise<boolean> {
    return Promise.resolve(this.#runtimeActive);
  }

  setShortcuts(
    action: ShortcutActionId,
    shortcuts: readonly ShortcutSequence[],
  ): Promise<void> {
    const key = actionKey(action);

    if (this.#failures.delete(key)) {
      return Promise.reject(new Error("injected write failure"));
    }

    this.writes.push(action);
    this.#actions.set(key, action);
    this.#shortcuts.set(key, [...shortcuts].sort(compareSequences));
    return Promise.resolve();
  }

  failNextWrite(action: ShortcutActionId): void {
    this.#failures.add(actionKey(action));
  }

  setInitial(
    action: ShortcutActionId,
    shortcuts: readonly ShortcutSequence[],
  ): void {
    const key = actionKey(action);
    this.#actions.set(key, action);
    this.#shortcuts.set(key, [...shortcuts].sort(compareSequences));
  }

  setMatchOwners(
    key: number,
    matchType: Exclude<ShortcutMatchType, 0>,
    owners: readonly ShortcutActionId[],
  ): void {
    this.#matchOwners.set(matchOwnerKey(key, matchType), owners);
  }

  setRuntimeActive(active: boolean): void {
    this.#runtimeActive = active;
  }
}

function binding(name: string, sequence: string): ShortcutBinding {
  return {
    key: encodeShortcut(sequence),
    name: `driftile_${name}`,
    sequence,
    text: `Driftile: ${name}`,
  };
}

function matchOwnerKey(key: number, matchType: ShortcutMatchType): string {
  return `${String(key)}:${String(matchType)}`;
}

function sameSequence(
  left: ShortcutSequence,
  right: ShortcutSequence,
): boolean {
  return left.every((part, index) => part === right[index]);
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
