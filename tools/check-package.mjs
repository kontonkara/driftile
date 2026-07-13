import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
const pluginId = "io.github.kontonkara.driftile";
const overviewPluginId = "io.github.kontonkara.driftile.overview";
const expectedPackageEntries = [
  "contents/code/main.js",
  "contents/config/main.xml",
  "contents/ui/LayoutStateStore.qml",
  "contents/ui/config.ui",
  "contents/ui/main.qml",
  "metadata.json",
];
const expectedOverviewPackageEntries = [
  "contents/code/main.js",
  "contents/ui/DesktopCard.qml",
  "contents/ui/LayoutStateReader.qml",
  "contents/ui/OverviewScene.qml",
  "contents/ui/main.qml",
  "metadata.json",
];
const packageArtifact = resolve(
  outputDirectory,
  `driftile-${version}.kwinscript`,
);
const overviewPackageArtifact = resolve(
  outputDirectory,
  `driftile-overview-${version}.kwineffect`,
);
const releaseArtifacts = [
  licenseArtifact,
  packageArtifact,
  overviewPackageArtifact,
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

verifyPackageEntries(packageArtifact, expectedPackageEntries, "KWin script");
verifyPackageEntries(
  overviewPackageArtifact,
  expectedOverviewPackageEntries,
  "overview effect",
);
await verifyPackageMetadata(
  packageArtifact,
  resolve(rootDirectory, "packaging/kwin-script/metadata.json"),
  {
    packageStructure: "KWin/Script",
    pluginId,
  },
);
await verifyPackageMetadata(
  overviewPackageArtifact,
  resolve(rootDirectory, "packaging/kwin-effect/metadata.json"),
  {
    forbidConfigModule: true,
    packageStructure: "KWin/Effect",
    pluginId: overviewPluginId,
  },
);

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

function verifyPackageEntries(artifact, expectedEntries, packageName) {
  const entries = runUnzip(["-Z1", artifact])
    .trimEnd()
    .split("\n")
    .filter((entry) => entry !== "")
    .sort();

  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
    throw new Error(
      `${packageName} entries differ from the release contract: ${entries.join(", ")}`,
    );
  }
}

async function verifyPackageMetadata(
  artifact,
  sourceMetadataPath,
  { forbidConfigModule = false, packageStructure, pluginId: expectedPluginId },
) {
  const archivedMetadata = runUnzip(["-p", artifact, "metadata.json"]);

  if (archivedMetadata !== (await readFile(sourceMetadataPath, "utf8"))) {
    throw new Error("packaged metadata does not match its repository source");
  }

  let metadata;

  try {
    metadata = JSON.parse(archivedMetadata);
  } catch (error) {
    throw new Error("KWin package metadata is not valid JSON", {
      cause: error,
    });
  }

  if (metadata["KPackageStructure"] !== packageStructure) {
    throw new Error("KWin package metadata has an unexpected structure");
  }

  if (metadata["KPlugin"]?.["Id"] !== expectedPluginId) {
    throw new Error("KWin package metadata contains an unexpected plugin ID");
  }

  if (metadata["KPlugin"]?.["Version"] !== version) {
    throw new Error("KWin package metadata version does not match the release");
  }

  if (metadata["KPlugin"]?.["EnabledByDefault"] !== false) {
    throw new Error("KWin package metadata must be disabled by default");
  }

  if (metadata["X-Plasma-API"] !== "declarativescript") {
    throw new Error("KWin package metadata must use the declarative API");
  }

  if (forbidConfigModule && "X-KDE-ConfigModule" in metadata) {
    throw new Error("overview effect metadata must not expose a config module");
  }
}

function runUnzip(arguments_) {
  const result = spawnSync("unzip", arguments_, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `unzip exited with status ${String(result.status)}: ${result.stderr.trim()}`,
    );
  }

  return result.stdout;
}
