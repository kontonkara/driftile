import { spawnSync } from "node:child_process";
import { chmod, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyShortcutClaimPlan,
  buildShortcutClaimPlan,
  inspectShortcutProfile,
  releaseShortcutClaim,
  rollbackShortcutClaim,
  type ShortcutActionId,
  type ShortcutBackend,
  type ShortcutClaimState,
  type ShortcutMutation,
  type ShortcutMatchType,
  type ShortcutSequence,
} from "./shortcut-ownership";
import { shortcutBindings, shortcutProfileId } from "./shortcut-profile";

interface BusctlReply {
  readonly data: readonly unknown[];
  readonly type: string;
}

const service = "org.kde.kglobalaccel";
const objectPath = "/kglobalaccel";
const dbusInterface = "org.kde.KGlobalAccel";
const lockEnvironment = "DRIFTILE_SHORTCUT_LOCKED";
const pluginId = "io.github.kontonkara.driftile";
const statePath = shortcutStatePath();

class BusctlShortcutBackend implements ShortcutBackend {
  readonly #executable = process.env.DRIFTILE_BUSCTL || "busctl";

  getOwners(
    key: number,
    matchType: ShortcutMatchType = 0,
  ): readonly ShortcutActionId[] {
    const value = this.#call("globalShortcutsByKey", "(ai)(i)", [
      "4",
      String(key),
      "0",
      "0",
      "0",
      String(matchType),
    ]);

    if (!Array.isArray(value)) {
      throw new Error("KGlobalAccel returned an invalid owner list");
    }

    return value.map((entry) => {
      if (
        !Array.isArray(entry) ||
        entry.length < 5 ||
        typeof entry[0] !== "string" ||
        typeof entry[1] !== "string" ||
        typeof entry[2] !== "string" ||
        typeof entry[3] !== "string" ||
        typeof entry[4] !== "string"
      ) {
        throw new Error("KGlobalAccel returned an invalid shortcut owner");
      }

      const component =
        entry[4] === "default" ? entry[2] : `${entry[2]}|${entry[4]}`;
      return [component, entry[0], entry[3], entry[1]];
    });
  }

  getShortcuts(action: ShortcutActionId): readonly ShortcutSequence[] {
    const value = this.#call("shortcutKeys", "as", actionArguments(action));

    if (!Array.isArray(value)) {
      throw new Error("KGlobalAccel returned an invalid shortcut list");
    }

    return (value as readonly unknown[]).map((entry): ShortcutSequence => {
      const sequence: unknown = Array.isArray(entry) ? entry[0] : undefined;

      if (
        !Array.isArray(sequence) ||
        sequence.length !== 4 ||
        typeof sequence[0] !== "number" ||
        typeof sequence[1] !== "number" ||
        typeof sequence[2] !== "number" ||
        typeof sequence[3] !== "number"
      ) {
        throw new Error("KGlobalAccel returned an invalid key sequence");
      }

      return [sequence[0], sequence[1], sequence[2], sequence[3]];
    });
  }

  hasAction(action: ShortcutActionId): boolean {
    const value = this.#callComponent("shortcutNames");

    if (
      !Array.isArray(value) ||
      !value.every((name) => typeof name === "string")
    ) {
      throw new Error("KGlobalAccel returned an invalid action list");
    }

    return value.includes(action[1]);
  }

  isRuntimeActive(): boolean {
    const value = this.#callObject(
      "org.kde.KWin",
      "/Scripting",
      "org.kde.kwin.Scripting",
      "isScriptLoaded",
      "s",
      [pluginId],
    );

    if (typeof value !== "boolean") {
      throw new Error("KWin returned an invalid script state");
    }

    return value;
  }

  setShortcuts(
    action: ShortcutActionId,
    shortcuts: readonly ShortcutSequence[],
  ): void {
    const shortcutArguments = shortcuts.flatMap((shortcut) => [
      "4",
      ...shortcut.map(String),
    ]);

    this.#call("setForeignShortcutKeys", "asa(ai)", [
      ...actionArguments(action),
      String(shortcuts.length),
      ...shortcutArguments,
    ]);
  }

  #call(method: string, signature: string, values: readonly string[]): unknown {
    return this.#callObject(
      service,
      objectPath,
      dbusInterface,
      method,
      signature,
      values,
    );
  }

  #callComponent(method: string): unknown {
    return this.#callObject(
      service,
      "/component/kwin",
      "org.kde.kglobalaccel.Component",
      method,
      "",
      [],
    );
  }

  #callObject(
    serviceName: string,
    path: string,
    interfaceName: string,
    method: string,
    signature: string,
    values: readonly string[],
  ): unknown {
    const callArguments = [
      "--user",
      "--json=short",
      "call",
      serviceName,
      path,
      interfaceName,
      method,
    ];

    if (signature.length > 0) {
      callArguments.push(signature, ...values);
    }

    const result = spawnSync(this.#executable, callArguments, {
      encoding: "utf8",
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const detail = result.stderr.trim();
      throw new Error(
        detail.length > 0
          ? `KGlobalAccel ${method} failed: ${detail}`
          : `KGlobalAccel ${method} exited with status ${String(result.status)}`,
      );
    }

    const output = result.stdout.trim();

    if (output.length === 0) {
      return undefined;
    }

    const reply: unknown = JSON.parse(output);

    if (!isBusctlReply(reply)) {
      throw new Error(`KGlobalAccel ${method} returned invalid JSON`);
    }

    return reply.data[0];
  }
}

async function main(): Promise<void> {
  if (process.env[lockEnvironment] !== "1") {
    await runUnderLock();
    return;
  }

  const command = process.argv[2];
  const force = process.argv.slice(3).includes("--force");

  if (!command || !["check", "claim", "release"].includes(command)) {
    throw new Error("Expected one of: check, claim, release");
  }

  const backend = new BusctlShortcutBackend();

  switch (command) {
    case "check":
      await checkProfile(backend);
      break;
    case "claim":
      await claimProfile(backend, force);
      break;
    case "release":
      await releaseProfile(backend, force);
      break;
  }
}

async function runUnderLock(): Promise<void> {
  const lockPath = `${statePath}.lock`;
  const directory = dirname(lockPath);
  await mkdir(directory, { mode: 0o700, recursive: true });
  await chmod(directory, 0o700);
  const result = spawnSync(
    process.env.DRIFTILE_FLOCK || "flock",
    [
      "--exclusive",
      "--nonblock",
      "--conflict-exit-code",
      "75",
      lockPath,
      process.execPath,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {
      env: { ...process.env, [lockEnvironment]: "1" },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status === 75) {
    throw new Error("Another shortcut operation is running");
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

async function claimProfile(
  backend: ShortcutBackend,
  force: boolean,
): Promise<void> {
  const existing = await readState();

  if (existing) {
    if (force) {
      const released = await releaseShortcutClaim(backend, existing, true);

      if (released.pending.length > 0) {
        throw new Error("Could not replace the previous shortcut claim");
      }

      await removeState();
    } else if (existing.status === "claiming") {
      await rollbackShortcutClaim(backend, existing);
      await removeState();
    } else {
      if (existing.profile !== shortcutProfileId) {
        throw new Error(
          "The shortcut profile changed; release it before claiming the new profile",
        );
      }

      const issues = await inspectShortcutProfile(backend, shortcutBindings);

      if (issues.length === 0) {
        console.log("Driftile already owns the shortcut profile.");
        return;
      }

      throw new Error(
        "The claimed shortcuts were changed; use claim --force to replace them",
      );
    }
  }

  const plan = await buildShortcutClaimPlan(backend, shortcutBindings);
  const claimingState: ShortcutClaimState = {
    mutations: plan.mutations,
    profile: shortcutProfileId,
    status: "claiming",
    version: 1,
  };
  await writeState(claimingState);

  try {
    await applyShortcutClaimPlan(backend, plan);
    const issues = await inspectShortcutProfile(backend, shortcutBindings);

    if (issues.length > 0) {
      throw new Error(describeIssues(issues));
    }

    await writeState({ ...claimingState, status: "claimed" });
  } catch (error) {
    try {
      await rollbackShortcutClaim(backend, claimingState);
      await removeState();
    } catch (rollbackError) {
      throw Object.assign(
        new Error(
          `Shortcut claim failed: ${errorMessage(error)}; rollback failed: ${errorMessage(rollbackError)}`,
        ),
        { cause: error },
      );
    }

    throw error;
  }

  console.log(
    `Driftile claimed ${String(shortcutBindings.length)} shortcuts and saved the previous assignments.`,
  );
}

async function checkProfile(backend: ShortcutBackend): Promise<void> {
  const issues = await inspectShortcutProfile(backend, shortcutBindings);

  if (issues.length > 0) {
    throw new Error(describeIssues(issues));
  }

  console.log(
    `Driftile owns all ${String(shortcutBindings.length)} shortcuts.`,
  );
}

async function releaseProfile(
  backend: ShortcutBackend,
  force: boolean,
): Promise<void> {
  const state = await readState();

  if (!state) {
    console.log("Driftile has no saved shortcut claim.");
    return;
  }

  const result = await releaseShortcutClaim(backend, state, force);

  if (result.pending.length === 0) {
    await removeState();
    console.log("Driftile released the shortcut profile.");
    return;
  }

  await writeState({ ...state, mutations: result.pending, status: "claimed" });
  throw new Error(
    `${String(result.pending.length)} assignments changed after the claim and were preserved; use release --force to restore them`,
  );
}

function describeIssues(
  issues: Awaited<ReturnType<typeof inspectShortcutProfile>>,
): string {
  return issues
    .map(({ binding, owners }) => {
      const ownerNames = owners
        .map((owner) => `${owner[0]}/${owner[1]}`)
        .join(", ");
      return `${binding.sequence}: ${ownerNames || "unassigned"}`;
    })
    .join("\n");
}

function actionArguments(action: ShortcutActionId): readonly string[] {
  return ["4", ...action];
}

function isBusctlReply(value: unknown): value is BusctlReply {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "data" in value &&
    Array.isArray(value.data)
  );
}

function shortcutStatePath(): string {
  const home = process.env.HOME;
  const stateHome =
    process.env.XDG_STATE_HOME || (home ? join(home, ".local/state") : "");

  if (!stateHome) {
    throw new Error("HOME or XDG_STATE_HOME must be set");
  }

  return join(stateHome, "driftile/shortcut-claim.json");
}

async function readState(): Promise<ShortcutClaimState | undefined> {
  let contents: string;

  try {
    contents = await readFile(statePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const value: unknown = JSON.parse(contents);

  if (!isShortcutClaimState(value)) {
    throw new Error(`Invalid shortcut state: ${statePath}`);
  }

  return value;
}

async function writeState(state: ShortcutClaimState): Promise<void> {
  const directory = dirname(statePath);
  const temporaryPath = `${statePath}.${String(process.pid)}.tmp`;
  await mkdir(directory, { mode: 0o700, recursive: true });
  await chmod(directory, 0o700);
  const stateFile = await open(temporaryPath, "w", 0o600);

  try {
    await stateFile.writeFile(`${JSON.stringify(state, undefined, 2)}\n`);
    await stateFile.sync();
  } finally {
    await stateFile.close();
  }

  await rename(temporaryPath, statePath);
  const directoryHandle = await open(directory, "r");

  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

async function removeState(): Promise<void> {
  try {
    await unlink(statePath);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function isShortcutClaimState(value: unknown): value is ShortcutClaimState {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "profile" in value &&
    typeof value.profile === "string" &&
    "status" in value &&
    (value.status === "claimed" || value.status === "claiming") &&
    "mutations" in value &&
    Array.isArray(value.mutations) &&
    value.mutations.every(isShortcutMutation)
  );
}

function isShortcutMutation(value: unknown): value is ShortcutMutation {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    isActionId(value.action) &&
    "before" in value &&
    isSequenceArray(value.before) &&
    "after" in value &&
    isSequenceArray(value.after)
  );
}

function isActionId(value: unknown): value is ShortcutActionId {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((part) => typeof part === "string")
  );
}

function isSequenceArray(value: unknown): value is readonly ShortcutSequence[] {
  return Array.isArray(value) && value.every(isSequence);
}

function isSequence(value: unknown): value is ShortcutSequence {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((part) => Number.isInteger(part))
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
