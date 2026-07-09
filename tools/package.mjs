import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildProject } from "./build.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(rootDirectory, "dist/kwin-script");
const artifactPath = resolve(rootDirectory, "dist/driftile.kwinscript");

await buildProject();
await rm(artifactPath, { force: true });

const result = spawnSync("zip", ["-qr", artifactPath, "."], {
  cwd: packageDirectory,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`zip exited with status ${String(result.status)}`);
}
