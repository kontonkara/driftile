import { createHash } from "node:crypto";
import {
  copyFile,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProject } from "./build.mjs";
import { releaseVersion } from "./release-version.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(rootDirectory, "dist/kwin-script");
const overviewPackageDirectory = resolve(rootDirectory, "dist/kwin-effect");
const outputDirectory = resolve(rootDirectory, "dist");
const licenseSource = resolve(rootDirectory, "LICENSE");
const licenseArtifact = resolve(outputDirectory, "LICENSE");
const shortcutTool = resolve(outputDirectory, "bin/driftile-shortcuts.mjs");
const minimumZipTimestamp = 315_532_800;

export async function packageProject() {
  const version = await releaseVersion(rootDirectory);
  const artifactPath = resolve(
    outputDirectory,
    `driftile-${version}.kwinscript`,
  );
  const overviewArtifactPath = resolve(
    outputDirectory,
    `driftile-overview-${version}.kwineffect`,
  );
  const shortcutArtifactPath = resolve(
    outputDirectory,
    `driftile-shortcuts-${version}.mjs`,
  );
  await buildProject();
  await removeOldArtifacts();

  const timestamp = archiveTimestamp();

  await createDeterministicArchive(packageDirectory, artifactPath, timestamp);
  await createDeterministicArchive(
    overviewPackageDirectory,
    overviewArtifactPath,
    timestamp,
  );

  await Promise.all([
    copyFile(licenseSource, licenseArtifact),
    copyFile(shortcutTool, shortcutArtifactPath),
  ]);

  const releaseArtifacts = [
    artifactPath,
    licenseArtifact,
    overviewArtifactPath,
    shortcutArtifactPath,
  ].sort(compareFilenames);
  const checksumLines = await Promise.all(
    releaseArtifacts.map(async (releaseArtifact) => {
      const checksum = createHash("sha256")
        .update(await readFile(releaseArtifact))
        .digest("hex");

      return `${checksum}  ${basename(releaseArtifact)}\n`;
    }),
  );
  await writeFile(
    resolve(outputDirectory, "SHA256SUMS"),
    checksumLines.join(""),
    "utf8",
  );

  return artifactPath;
}

async function removeOldArtifacts() {
  for (const entry of await readdir(outputDirectory, { withFileTypes: true })) {
    if (
      entry.name === "LICENSE" ||
      entry.name === "SHA256SUMS" ||
      /^driftile(?:-[^/]+)?\.kwinscript$/u.test(entry.name) ||
      /^driftile-overview(?:-[^/]+)?\.kwineffect$/u.test(entry.name) ||
      /^driftile-shortcuts-[^/]+\.mjs$/u.test(entry.name)
    ) {
      await rm(resolve(outputDirectory, entry.name), {
        force: true,
        recursive: entry.isDirectory(),
      });
    }
  }
}

export async function createDeterministicArchive(
  packageRoot,
  artifactPath,
  timestamp,
) {
  const entries = await archiveEntries(packageRoot);

  await Promise.all(
    entries.map((entry) =>
      utimes(resolve(packageRoot, entry), timestamp, timestamp),
    ),
  );

  const result = spawnSync("zip", ["-0Xq", artifactPath, ...entries], {
    cwd: packageRoot,
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

function compareFilenames(left, right) {
  const leftName = basename(left);
  const rightName = basename(right);

  if (leftName < rightName) {
    return -1;
  }

  return leftName > rightName ? 1 : 0;
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
