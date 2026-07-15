import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProject, buildShortcutTool } from "./build.mjs";

const actions = {
  install: "--install",
  remove: "--remove",
  upgrade: "--upgrade",
};
const pluginId = "io.github.kontonkara.driftile";
const pluginKey = `${pluginId}Enabled`;
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataHome =
  process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.length > 0
    ? process.env.XDG_DATA_HOME
    : resolve(homedir(), ".local/share");
const defaultPaths = {
  installedPackageDirectory: resolve(dataHome, "kwin/scripts", pluginId),
  packageDirectory: resolve(rootDirectory, "dist/kwin-script"),
  shortcutTool: resolve(rootDirectory, "dist/bin/driftile-shortcuts.mjs"),
};
const unloadPollAttempts = 100;
const unloadPollDelayMilliseconds = 50;

export async function runInstallLifecycle(action, dependencies = {}) {
  if (typeof action !== "string" || !Object.hasOwn(actions, action)) {
    throw new Error("Expected one of: install, upgrade, remove");
  }

  const buildPackage = dependencies.buildProject ?? buildProject;
  const buildShortcuts = dependencies.buildShortcutTool ?? buildShortcutTool;
  const log = dependencies.log ?? console.log;
  const paths = { ...defaultPaths, ...dependencies.paths };
  const run = dependencies.runCommand ?? runCommand;
  const sleep = dependencies.sleep ?? delay;
  const pollAttempts = dependencies.unloadPollAttempts ?? unloadPollAttempts;
  const needsBootstrapRestart =
    dependencies.bootstrapRestartRequired ?? bootstrapRestartRequired;

  if (!Number.isInteger(pollAttempts) || pollAttempts < 1) {
    throw new Error("Unload poll attempts must be a positive integer");
  }

  if (action === "remove") {
    await buildShortcuts();
  } else {
    await buildPackage();
  }

  const restartRequired =
    action === "upgrade" &&
    needsBootstrapRestart(
      paths.packageDirectory,
      paths.installedPackageDirectory,
    );

  run(process.execPath, [paths.shortcutTool, "release"]);
  run("kwriteconfig6", [
    "--file",
    "kwinrc",
    "--group",
    "Plugins",
    "--key",
    pluginKey,
    "--type",
    "bool",
    "false",
  ]);
  run("busctl", [
    "--user",
    "call",
    "org.kde.KWin",
    "/Scripting",
    "org.kde.kwin.Scripting",
    "start",
  ]);

  await waitUntilUnloaded(run, sleep, pollAttempts);

  const target = action === "remove" ? pluginId : paths.packageDirectory;
  run("kpackagetool6", ["--type=KWin/Script", actions[action], target]);

  if (action !== "remove") {
    log(enableInstructions(action, restartRequired));
  }
}

async function waitUntilUnloaded(run, sleep, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const output = run(
      "busctl",
      [
        "--user",
        "--json=short",
        "call",
        "org.kde.KWin",
        "/Scripting",
        "org.kde.kwin.Scripting",
        "isScriptLoaded",
        "s",
        pluginId,
      ],
      { capture: true },
    );

    if (!parseScriptLoadedReply(output)) {
      return;
    }

    if (attempt + 1 < attempts) {
      await sleep(unloadPollDelayMilliseconds);
    }
  }

  throw new Error(
    "KWin did not unload Driftile; the installed package was not changed",
  );
}

export function parseScriptLoadedReply(output) {
  let reply;

  try {
    reply = JSON.parse(output);
  } catch (error) {
    throw new Error("KWin returned an invalid script state", { cause: error });
  }

  if (
    typeof reply !== "object" ||
    reply === null ||
    reply.type !== "b" ||
    !Array.isArray(reply.data) ||
    reply.data.length !== 1 ||
    typeof reply.data[0] !== "boolean"
  ) {
    throw new Error("KWin returned an invalid script state");
  }

  return reply.data[0];
}

export function bootstrapRestartRequired(
  packageDirectory,
  installedPackageDirectory,
  readFile = readFileSync,
) {
  try {
    const relativePath = "contents/ui/main.qml";
    const nextBootstrap = readFile(resolve(packageDirectory, relativePath));
    const installedBootstrap = readFile(
      resolve(installedPackageDirectory, relativePath),
    );

    return !nextBootstrap.equals(installedBootstrap);
  } catch {
    return true;
  }
}

function enableInstructions(action, restartRequired) {
  const lines = ["Driftile is installed and disabled."];

  if (restartRequired) {
    lines.push("Restart the Plasma session once before enabling this upgrade.");
  }

  lines.push(
    restartRequired
      ? "Then enable it and claim its shortcut profile with:"
      : "Enable it and claim its shortcut profile with:",
    `  kwriteconfig6 --file kwinrc --group Plugins --key ${pluginKey} --type bool true`,
    "  busctl --user call org.kde.KWin /KWin org.kde.KWin reconfigure",
    "  busctl --user call org.kde.KWin /Scripting org.kde.kwin.Scripting start",
    "  npm run shortcuts:claim",
  );

  return lines.join("\n");
}

function runCommand(command, arguments_, options = {}) {
  const capture = options.capture === true;
  const result = spawnSync(
    command,
    arguments_,
    capture ? { encoding: "utf8" } : { stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = capture ? result.stderr.trim() : "";
    throw new Error(
      detail.length > 0
        ? `${command} failed: ${detail}`
        : `${command} exited with status ${String(result.status)}`,
    );
  }

  return capture ? result.stdout.trim() : "";
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await runInstallLifecycle(process.argv[2]);
}
