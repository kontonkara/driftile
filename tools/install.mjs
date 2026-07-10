import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildProject, buildShortcutTool } from "./build.mjs";

const actions = {
  install: "--install",
  remove: "--remove",
  upgrade: "--upgrade",
};

const action = process.argv[2];

if (!(action in actions)) {
  throw new Error("Expected one of: install, upgrade, remove");
}

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(rootDirectory, "dist/kwin-script");
const shortcutTool = resolve(rootDirectory, "dist/bin/driftile-shortcuts.mjs");
const pluginId = "io.github.kontonkara.driftile";

if (action === "remove") {
  try {
    await access(shortcutTool);
  } catch {
    await buildShortcutTool();
  }

  const release = spawnSync(process.execPath, [shortcutTool, "release"], {
    stdio: "inherit",
  });

  if (release.error) {
    throw release.error;
  }

  if (release.status !== 0) {
    throw new Error(
      `shortcut release exited with status ${String(release.status)}`,
    );
  }
} else {
  await buildProject();
}

const target = action === "remove" ? pluginId : packageDirectory;
const result = spawnSync(
  "kpackagetool6",
  ["--type=KWin/Script", actions[action], target],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`kpackagetool6 exited with status ${String(result.status)}`);
}

if (action !== "remove") {
  console.log("Enable Driftile, then run: npm run shortcuts:claim");
}
