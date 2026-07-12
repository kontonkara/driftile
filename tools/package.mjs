import { readdir, rm, utimes } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProject } from "./build.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(rootDirectory, "dist/kwin-script");
const artifactPath = resolve(rootDirectory, "dist/driftile.kwinscript");
const minimumZipTimestamp = 315_532_800;

export async function packageProject() {
  await buildProject();
  await rm(artifactPath, { force: true });

  const entries = await archiveEntries(packageDirectory);
  const timestamp = archiveTimestamp();

  await Promise.all(
    entries.map((entry) =>
      utimes(resolve(packageDirectory, entry), timestamp, timestamp),
    ),
  );

  const result = spawnSync("zip", ["-0Xq", artifactPath, ...entries], {
    cwd: packageDirectory,
    env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`zip exited with status ${String(result.status)}`);
  }
}

async function archiveEntries(directory, prefix = "") {
  const entries = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      entries.push(
        ...(await archiveEntries(resolve(directory, entry.name), relativePath)),
      );
    } else if (entry.isFile()) {
      entries.push(relativePath);
    } else {
      throw new Error(`unsupported package entry: ${relativePath}`);
    }
  }

  return entries.sort();
}

function archiveTimestamp() {
  const rawTimestamp = process.env["SOURCE_DATE_EPOCH"];
  const timestamp =
    rawTimestamp === undefined ? minimumZipTimestamp : Number(rawTimestamp);

  if (!Number.isInteger(timestamp) || timestamp < minimumZipTimestamp) {
    throw new Error(
      "SOURCE_DATE_EPOCH must be an integer at or after 1980-01-01",
    );
  }

  return timestamp;
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await packageProject();
}
