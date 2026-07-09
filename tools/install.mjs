import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildProject } from "./build.mjs";

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
const pluginId = "io.github.kontonkara.driftile";

if (action !== "remove") {
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
