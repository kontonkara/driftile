import { describe, expect, it } from "vitest";
import {
  actionKey,
  applyShortcutClaimPlan,
  bindingAction,
  buildShortcutClaimPlan,
  buildShortcutReplacementPlan,
  inspectShortcutProfile,
  inspectShortcutReplacements,
  releaseShortcutClaim,
  rollbackShortcutClaim,
  singleKeySequence,
  type ShortcutActionId,
  type ShortcutBackend,
  type ShortcutClaimState,
  type ShortcutMatchType,
  type ShortcutMutation,
  type ShortcutReplacement,
  type ShortcutSequence,
} from "../src/shortcut-ownership";
import { encodeShortcut, type ShortcutBinding } from "../src/shortcut-profile";

const stockAction: ShortcutActionId = [
  "kwin",
  "stock_action",
  "KWin",
  "Stock action",
];
const contextAction: ShortcutActionId = [
  "kwin|alternate",
  "context_action",
  "KWin",
  "Context action",
];
const newAction: ShortcutActionId = [
  "kwin",
  "new_action",
  "KWin",
  "New action",
];
const extraKey = encodeShortcut("Meta+X");
const changedKey = encodeShortcut("Meta+Y");
const extraSequence: ShortcutSequence = [extraKey, changedKey, 0, 0];
const emptySequence: ShortcutSequence = [0, 0, 0, 0];

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
    expect(encodeShortcut("Meta+Q")).toBe(0x10000051);
    expect(encodeShortcut("Meta+W")).toBe(0x10000057);
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

  it("orders additive default dependencies before their desired owners", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const backend = new FakeBackend([left, right]);
    backend.setInitial(bindingAction(left), [extraSequence]);
    backend.setInitial(bindingAction(right), [singleKeySequence(left.key)]);
    backend.setInitial(stockAction, [singleKeySequence(right.key)]);

    const plan = await buildShortcutClaimPlan(backend, [left, right]);

    expect(plan.mutations.map(({ action }) => action)).toEqual([
      stockAction,
      bindingAction(right),
      bindingAction(left),
    ]);
    await applyShortcutClaimPlan(backend, plan);
    expect(await backend.getShortcuts(bindingAction(left))).toEqual([
      extraSequence,
      singleKeySequence(left.key),
    ]);
    expect(await backend.getShortcuts(bindingAction(right))).toEqual([
      singleKeySequence(right.key),
    ]);
    expect(await inspectShortcutProfile(backend, [left, right])).toEqual([]);
  });

  it("rejects an additive default reassignment cycle before writing", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const backend = new FakeBackend([left, right]);
    backend.setInitial(bindingAction(left), [singleKeySequence(right.key)]);
    backend.setInitial(bindingAction(right), [singleKeySequence(left.key)]);

    await expect(
      buildShortcutClaimPlan(backend, [left, right]),
    ).rejects.toThrow("Shortcut reassignment cycle");
    expect(backend.writes).toEqual([]);
  });

  it("replaces listed action shortcuts exactly", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(bindingAction(target), [
      extraSequence,
      singleKeySequence(target.key),
    ]);
    const replacement = replace(target, [changedKey, extraKey]);

    const plan = await buildShortcutReplacementPlan(backend, [replacement]);

    expect(plan.mutations).toEqual([
      {
        action: bindingAction(target),
        before: [extraSequence, singleKeySequence(target.key)],
        after: [singleKeySequence(extraKey), singleKeySequence(changedKey)],
      },
    ]);
    await applyShortcutClaimPlan(backend, plan);
    expect(await inspectShortcutReplacements(backend, [replacement])).toEqual(
      [],
    );
  });

  it("unbinds a listed action while leaving omitted actions untouched", async () => {
    const target = binding("left", "Meta+Left");
    const omitted = binding("right", "Meta+Right");
    const backend = new FakeBackend([target, omitted]);
    backend.setInitial(bindingAction(target), [singleKeySequence(target.key)]);
    backend.setInitial(bindingAction(omitted), [
      singleKeySequence(omitted.key),
    ]);

    const plan = await buildShortcutReplacementPlan(backend, [
      replace(target, []),
    ]);
    await applyShortcutClaimPlan(backend, plan);

    expect(await backend.getShortcuts(bindingAction(target))).toEqual([]);
    expect(await backend.getShortcuts(bindingAction(omitted))).toEqual([
      singleKeySequence(omitted.key),
    ]);
    expect(
      await inspectShortcutReplacements(backend, [replace(target, [])]),
    ).toEqual([]);
  });

  it("normalizes KGlobalAccel's empty sequence as an unbound action", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [emptySequence]);

    const plan = await buildShortcutReplacementPlan(backend, [
      replace(target, []),
    ]);

    expect(plan.mutations).toEqual([
      { action: desired, before: [], after: [] },
    ]);
    await applyShortcutClaimPlan(backend, plan);
    expect(backend.writes).toEqual([]);
    expect(
      await inspectShortcutReplacements(backend, [replace(target, [])]),
    ).toEqual([]);
  });

  it("removes only a requested key from an omitted conflict owner", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, [
      extraSequence,
      singleKeySequence(target.key),
    ]);

    const plan = await buildShortcutReplacementPlan(backend, [
      replace(target, [target.key]),
    ]);
    await applyShortcutClaimPlan(backend, plan);

    expect(await backend.getShortcuts(stockAction)).toEqual([extraSequence]);
    expect(await backend.getShortcuts(bindingAction(target))).toEqual([
      singleKeySequence(target.key),
    ]);
  });

  it("snapshots an unchanged replacement target for reversible duplicates", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [singleKeySequence(target.key)]);
    backend.setInitial(stockAction, [singleKeySequence(target.key)]);

    const plan = await buildShortcutReplacementPlan(backend, [
      replace(target, [target.key]),
    ]);

    expect(plan.mutations).toEqual([
      {
        action: stockAction,
        before: [singleKeySequence(target.key)],
        after: [],
      },
      {
        action: desired,
        before: [singleKeySequence(target.key)],
        after: [singleKeySequence(target.key)],
      },
    ]);
    await applyShortcutClaimPlan(backend, plan);
    expect(backend.writes).toEqual([stockAction]);

    const result = await releaseShortcutClaim(backend, {
      mutations: plan.mutations,
      profile: "custom-v1:sha256:test",
      status: "claimed",
      version: 1,
    });

    expect(result.pending).toEqual([]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      singleKeySequence(target.key),
    ]);
    expect(await backend.getShortcuts(desired)).toEqual([
      singleKeySequence(target.key),
    ]);
    expect(backend.writes).toEqual([stockAction, stockAction]);
  });

  it("orders an acyclic reassignment before each dependent owner", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const backend = new FakeBackend([left, right]);
    backend.setInitial(bindingAction(left), [singleKeySequence(left.key)]);
    backend.setInitial(bindingAction(right), [singleKeySequence(right.key)]);
    backend.setInitial(stockAction, [singleKeySequence(changedKey)]);

    const plan = await buildShortcutReplacementPlan(backend, [
      replace(left, [right.key]),
      replace(right, [changedKey]),
    ]);

    expect(plan.mutations.map(({ action }) => action)).toEqual([
      stockAction,
      bindingAction(right),
      bindingAction(left),
    ]);
    await applyShortcutClaimPlan(backend, plan);
    expect(await backend.getShortcuts(bindingAction(left))).toEqual([
      singleKeySequence(right.key),
    ]);
    expect(await backend.getShortcuts(bindingAction(right))).toEqual([
      singleKeySequence(changedKey),
    ]);
  });

  it("rejects a reassignment cycle before writing shortcuts", async () => {
    const left = binding("left", "Meta+Left");
    const right = binding("right", "Meta+Right");
    const backend = new FakeBackend([left, right]);
    backend.setInitial(bindingAction(left), [singleKeySequence(left.key)]);
    backend.setInitial(bindingAction(right), [singleKeySequence(right.key)]);

    await expect(
      buildShortcutReplacementPlan(backend, [
        replace(left, [right.key]),
        replace(right, [left.key]),
      ]),
    ).rejects.toThrow("Shortcut reassignment cycle");
    expect(backend.writes).toEqual([]);
  });

  it("checks exact replacement lists including unbound actions", async () => {
    const bound = binding("left", "Meta+Left");
    const unbound = binding("right", "Meta+Right");
    const backend = new FakeBackend([bound, unbound]);
    backend.setInitial(bindingAction(bound), [
      singleKeySequence(bound.key),
      singleKeySequence(extraKey),
    ]);

    expect(
      await inspectShortcutReplacements(backend, [
        replace(bound, [bound.key]),
        replace(unbound, []),
      ]),
    ).toEqual([expect.objectContaining({ action: bindingAction(bound) })]);

    backend.setInitial(bindingAction(bound), [singleKeySequence(bound.key)]);
    expect(
      await inspectShortcutReplacements(backend, [
        replace(bound, [bound.key]),
        replace(unbound, []),
      ]),
    ).toEqual([]);
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

  it("does not restore a shortcut while a preserved action still owns it", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [
      singleKeySequence(target.key),
      singleKeySequence(changedKey),
    ]);
    const displaced: ShortcutMutation = {
      action: stockAction,
      before: [singleKeySequence(target.key)],
      after: [],
    };
    const claimed: ShortcutMutation = {
      action: desired,
      before: [],
      after: [singleKeySequence(target.key)],
    };
    const state: ShortcutClaimState = {
      mutations: [displaced, claimed],
      profile: `${target.name}:${String(target.key)}`,
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state);

    expect(result.pending).toEqual([displaced, claimed]);
    expect(await backend.getShortcuts(stockAction)).toEqual([]);
    expect(await backend.getShortcuts(desired)).toEqual([
      singleKeySequence(changedKey),
      singleKeySequence(target.key),
    ]);
    expect(backend.writes).toEqual([]);
  });

  it("preserves edits to topology-only replacement snapshots", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [singleKeySequence(changedKey)]);
    const snapshot: ShortcutMutation = {
      action: desired,
      before: [singleKeySequence(target.key)],
      after: [singleKeySequence(target.key)],
    };
    const state: ShortcutClaimState = {
      mutations: [snapshot],
      profile: "custom-v1:sha256:test",
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state, true);

    expect(result.pending).toEqual([]);
    expect(result.restored).toEqual([snapshot]);
    expect(await backend.getShortcuts(desired)).toEqual([
      singleKeySequence(changedKey),
    ]);
    expect(backend.writes).toEqual([]);

    await expect(
      rollbackShortcutClaim(backend, state),
    ).resolves.toBeUndefined();
    expect(await backend.getShortcuts(desired)).toEqual([
      singleKeySequence(changedKey),
    ]);
    expect(backend.writes).toEqual([]);
  });

  it("restores duplicate owners recorded by an old default profile", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [singleKeySequence(target.key)]);
    backend.setInitial(stockAction, []);
    const displaced: ShortcutMutation = {
      action: stockAction,
      before: [singleKeySequence(target.key)],
      after: [],
    };
    const state: ShortcutClaimState = {
      mutations: [displaced],
      profile: `${target.name}:${String(target.key)}`,
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state);

    expect(result.pending).toEqual([]);
    expect(result.restored).toEqual([displaced]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      singleKeySequence(target.key),
    ]);
    expect(await backend.getShortcuts(desired)).toEqual([
      singleKeySequence(target.key),
    ]);
  });

  it("restores every context that shared a shortcut before claiming", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, []);
    backend.setInitial(contextAction, []);
    backend.setInitial(desired, [singleKeySequence(target.key)]);
    const state: ShortcutClaimState = {
      mutations: [
        {
          action: stockAction,
          before: [singleKeySequence(target.key)],
          after: [],
        },
        {
          action: contextAction,
          before: [singleKeySequence(target.key)],
          after: [],
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

    expect(result.pending).toEqual([]);
    expect(await backend.getShortcuts(desired)).toEqual([]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      singleKeySequence(target.key),
    ]);
    expect(await backend.getShortcuts(contextAction)).toEqual([
      singleKeySequence(target.key),
    ]);
  });

  it("preserves a new equal owner and lets force finish restoration", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, []);
    backend.setInitial(newAction, [singleKeySequence(target.key)]);
    const mutation: ShortcutMutation = {
      action: stockAction,
      before: [singleKeySequence(target.key)],
      after: [],
    };
    const state: ShortcutClaimState = {
      mutations: [mutation],
      profile: "test",
      status: "claimed",
      version: 1,
    };

    const first = await releaseShortcutClaim(backend, state);

    expect(first.pending).toEqual([mutation]);
    expect(backend.writes).toEqual([]);

    const forced = await releaseShortcutClaim(backend, state, true);

    expect(forced.pending).toEqual([]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      singleKeySequence(target.key),
    ]);
    expect(await backend.getShortcuts(newAction)).toEqual([
      singleKeySequence(target.key),
    ]);
  });

  it("detects new multi-step owners before release and lets force finish", async () => {
    const target = binding("left", "Meta+Left");
    const backend = new FakeBackend([target]);
    backend.setInitial(stockAction, []);
    backend.setMatchOwners(target.key, 2, [newAction]);
    const mutation: ShortcutMutation = {
      action: stockAction,
      before: [singleKeySequence(target.key)],
      after: [],
    };
    const state: ShortcutClaimState = {
      mutations: [mutation],
      profile: "test",
      status: "claimed",
      version: 1,
    };

    const first = await releaseShortcutClaim(backend, state);

    expect(first.pending).toEqual([mutation]);
    expect(backend.writes).toEqual([]);

    const forced = await releaseShortcutClaim(backend, state, true);

    expect(forced.pending).toEqual([]);
    expect(await backend.getShortcuts(stockAction)).toEqual([
      singleKeySequence(target.key),
    ]);
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

  it("releases legacy state containing an empty sequence sentinel", async () => {
    const target = binding("left", "Meta+Left");
    const desired = bindingAction(target);
    const backend = new FakeBackend([target]);
    backend.setInitial(desired, [singleKeySequence(target.key)]);
    const mutation: ShortcutMutation = {
      action: desired,
      before: [emptySequence],
      after: [emptySequence, singleKeySequence(target.key)],
    };
    const state: ShortcutClaimState = {
      mutations: [mutation],
      profile: `${target.name}:${String(target.key)}`,
      status: "claimed",
      version: 1,
    };

    const result = await releaseShortcutClaim(backend, state);

    expect(result.pending).toEqual([]);
    expect(await backend.getShortcuts(desired)).toEqual([]);
    expect(backend.writes).toEqual([desired]);
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
    shortcut: number | ShortcutSequence,
    matchType: ShortcutMatchType = 0,
  ): Promise<readonly ShortcutActionId[]> {
    const sequence =
      typeof shortcut === "number" ? singleKeySequence(shortcut) : shortcut;

    if (matchType !== 0) {
      return Promise.resolve(
        this.#matchOwners.get(matchOwnerKey(sequence, matchType)) ?? [],
      );
    }

    return Promise.resolve(
      [...this.#actions.values()].filter((action) =>
        (this.#shortcuts.get(actionKey(action)) ?? []).some((candidate) =>
          sameSequence(candidate, sequence),
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
    this.#matchOwners.set(
      matchOwnerKey(singleKeySequence(key), matchType),
      owners,
    );
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

function replace(
  binding: ShortcutBinding,
  keys: readonly number[],
): ShortcutReplacement {
  return {
    action: bindingAction(binding),
    shortcuts: keys.map(singleKeySequence),
  };
}

function matchOwnerKey(
  sequence: ShortcutSequence,
  matchType: ShortcutMatchType,
): string {
  return `${sequence.join(":")}:${String(matchType)}`;
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
