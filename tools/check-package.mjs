import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageProject } from "./package.mjs";
import { releaseVersion } from "./release-version.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(rootDirectory, "dist");
const version = await releaseVersion(rootDirectory);
const releaseArtifacts = [
  resolve(outputDirectory, `driftile-${version}.kwinscript`),
  resolve(outputDirectory, `driftile-shortcuts-${version}.mjs`),
].sort();

await packageProject();
const firstBuild = await readArtifacts(releaseArtifacts);

await delay(2_100);

await packageProject();
const secondBuild = await readArtifacts(releaseArtifacts);

for (let index = 0; index < releaseArtifacts.length; index += 1) {
  if (!firstBuild[index].equals(secondBuild[index])) {
    throw new Error(
      `consecutive package builds produced different ${basename(releaseArtifacts[index])} artifacts`,
    );
  }
}

const checksums = secondBuild.map((bytes) =>
  createHash("sha256").update(bytes).digest("hex"),
);
const checksumManifest = await readFile(
  resolve(outputDirectory, "SHA256SUMS"),
  "utf8",
);
const expectedManifest = releaseArtifacts
  .map((artifact, index) => `${checksums[index]}  ${basename(artifact)}\n`)
  .join("");

if (checksumManifest !== expectedManifest) {
  throw new Error("SHA256SUMS does not match the packaged artifacts");
}

const packagedReleaseArtifacts = (
  await readdir(outputDirectory, {
    withFileTypes: true,
  })
)
  .filter(
    (entry) =>
      entry.isFile() &&
      (/^driftile(?:-[^/]+)?\.kwinscript$/u.test(entry.name) ||
        /^driftile-shortcuts-[^/]+\.mjs$/u.test(entry.name)),
  )
  .map((entry) => entry.name)
  .sort();
const expectedReleaseArtifacts = releaseArtifacts.map((artifact) =>
  basename(artifact),
);

if (
  JSON.stringify(packagedReleaseArtifacts) !==
  JSON.stringify(expectedReleaseArtifacts)
) {
  throw new Error("dist contains unexpected release artifacts");
}

for (let index = 0; index < releaseArtifacts.length; index += 1) {
  console.log(`${basename(releaseArtifacts[index])} ${checksums[index]}`);
}

async function readArtifacts(artifacts) {
  return Promise.all(artifacts.map((artifact) => readFile(artifact)));
}
