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
const licenseArtifact = resolve(outputDirectory, "LICENSE");
const checksumManifestPath = resolve(outputDirectory, "SHA256SUMS");
const releaseArtifacts = [
  licenseArtifact,
  resolve(outputDirectory, `driftile-${version}.kwinscript`),
  resolve(outputDirectory, `driftile-shortcuts-${version}.mjs`),
].sort(compareFilenames);
const packagedAssets = [...releaseArtifacts, checksumManifestPath];

await packageProject();
const firstBuild = await readArtifacts(packagedAssets);

await delay(2_100);

await packageProject();
const secondBuild = await readArtifacts(packagedAssets);

for (let index = 0; index < packagedAssets.length; index += 1) {
  if (!firstBuild[index].equals(secondBuild[index])) {
    throw new Error(
      `consecutive package builds produced different ${basename(packagedAssets[index])} assets`,
    );
  }
}

const releaseAssetBytes = secondBuild.slice(0, releaseArtifacts.length);
const checksums = releaseAssetBytes.map((bytes) =>
  createHash("sha256").update(bytes).digest("hex"),
);
const checksumManifest = secondBuild.at(-1).toString("utf8");
const expectedManifest = releaseArtifacts
  .map((artifact, index) => `${checksums[index]}  ${basename(artifact)}\n`)
  .join("");

if (checksumManifest !== expectedManifest) {
  throw new Error("SHA256SUMS does not match the packaged artifacts");
}

if (
  !releaseAssetBytes[releaseArtifacts.indexOf(licenseArtifact)].equals(
    await readFile(resolve(rootDirectory, "LICENSE")),
  )
) {
  throw new Error("packaged LICENSE does not match the repository LICENSE");
}

const packagedReleaseArtifacts = (
  await readdir(outputDirectory, {
    withFileTypes: true,
  })
)
  .filter((entry) => !entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedReleaseArtifacts = packagedAssets
  .map((artifact) => basename(artifact))
  .sort();

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

function compareFilenames(left, right) {
  const leftName = basename(left);
  const rightName = basename(right);

  if (leftName < rightName) {
    return -1;
  }

  return leftName > rightName ? 1 : 0;
}
