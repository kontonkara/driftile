import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShortcutTool } from "./build.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = resolve(rootDirectory, "dist/bin/driftile-shortcuts.mjs");

await buildShortcutTool();

const result = spawnSync(
  process.execPath,
  [executable, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
