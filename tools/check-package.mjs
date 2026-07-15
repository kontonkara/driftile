import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeContentHash } from "./build.mjs";
import { packageProject } from "./package.mjs";
import { releaseVersion } from "./release-version.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(rootDirectory, "dist");
const version = await releaseVersion(rootDirectory);
const licenseArtifact = resolve(outputDirectory, "LICENSE");
const checksumManifestPath = resolve(outputDirectory, "SHA256SUMS");
const pluginId = "io.github.kontonkara.driftile";
const overviewPluginId = "io.github.kontonkara.driftile.overview";
const transitionPluginId = "io.github.kontonkara.driftile.transitions";
const expectedPackageEntries = [
  "contents/config/main.xml",
  "contents/runtime/selector.qml",
  "contents/ui/config.ui",
  "contents/ui/main.qml",
  "metadata.json",
];
const expectedRuntimeEntries = [
  "code/main.js",
  "ui/LayoutStateStore.qml",
  "ui/TouchpadNavigation.qml",
  "ui/TouchpadWorkspaceNavigation.qml",
  "ui/main.qml",
];
const expectedOverviewPackageEntries = [
  "contents/config/main.xml",
  "contents/runtime/selector.qml",
  "contents/ui/config.ui",
  "contents/ui/main.qml",
  "metadata.json",
];
const expectedOverviewRuntimeEntries = [
  "code/main.js",
  "ui/DesktopCard.qml",
  "ui/LayoutStateReader.qml",
  "ui/OverviewScene.qml",
  "ui/OverviewTouchpadGesture.qml",
  "ui/main.qml",
];
const expectedTransitionPackageEntries = [
  "contents/code/main.js",
  "contents/config/main.xml",
  "contents/ui/config.ui",
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
const transitionPackageArtifact = resolve(
  outputDirectory,
  `driftile-transitions-${version}.kwineffect`,
);
const releaseArtifacts = [
  licenseArtifact,
  packageArtifact,
  overviewPackageArtifact,
  resolve(outputDirectory, `driftile-shortcuts-${version}.mjs`),
  transitionPackageArtifact,
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
    configModule: "kcm_kwin4_genericscripted",
    packageStructure: "KWin/Effect",
    pluginId: overviewPluginId,
  },
);
await verifyPackageMetadata(
  transitionPackageArtifact,
  resolve(rootDirectory, "packaging/kwin-transition-effect/metadata.json"),
  {
    configModule: "kcm_kwin4_genericscripted",
    mainScript: null,
    packageStructure: "KWin/Effect",
    plasmaApi: "javascript",
    pluginId: transitionPluginId,
  },
);
await Promise.all([
  verifyArchivedSourceFile(
    packageArtifact,
    "contents/ui/main.qml",
    resolve(rootDirectory, "packaging/kwin-script/contents/ui/main.qml"),
  ),
  verifyArchivedSourceFile(
    overviewPackageArtifact,
    "contents/ui/main.qml",
    resolve(rootDirectory, "packaging/kwin-effect/contents/ui/main.qml"),
  ),
  verifyArchivedSourceFile(
    overviewPackageArtifact,
    "contents/config/main.xml",
    resolve(rootDirectory, "packaging/kwin-effect/contents/config/main.xml"),
  ),
  verifyArchivedSourceFile(
    overviewPackageArtifact,
    "contents/ui/config.ui",
    resolve(rootDirectory, "packaging/kwin-effect/contents/ui/config.ui"),
  ),
  verifyArchivedSourceFile(
    transitionPackageArtifact,
    "contents/code/main.js",
    resolve(
      rootDirectory,
      "packaging/kwin-transition-effect/contents/code/main.js",
    ),
  ),
  verifyArchivedSourceFile(
    transitionPackageArtifact,
    "contents/config/main.xml",
    resolve(
      rootDirectory,
      "packaging/kwin-transition-effect/contents/config/main.xml",
    ),
  ),
  verifyArchivedSourceFile(
    transitionPackageArtifact,
    "contents/ui/config.ui",
    resolve(
      rootDirectory,
      "packaging/kwin-transition-effect/contents/ui/config.ui",
    ),
  ),
]);
const packageRuntimeHash = packagedRuntimeHash(packageArtifact);
const overviewRuntimeHash = packagedRuntimeHash(overviewPackageArtifact);
verifyPackageEntries(
  packageArtifact,
  withRuntimeEntries(
    expectedPackageEntries,
    expectedRuntimeEntries,
    packageRuntimeHash,
  ),
  "KWin script",
);
verifyPackageEntries(
  overviewPackageArtifact,
  withRuntimeEntries(
    expectedOverviewPackageEntries,
    expectedOverviewRuntimeEntries,
    overviewRuntimeHash,
  ),
  "overview effect",
);
verifyPackageEntries(
  transitionPackageArtifact,
  expectedTransitionPackageEntries,
  "transition effect",
);
verifyRuntimeHash(packageArtifact, expectedRuntimeEntries, packageRuntimeHash);
verifyRuntimeHash(
  overviewPackageArtifact,
  expectedOverviewRuntimeEntries,
  overviewRuntimeHash,
);
verifyRuntimeSelector(packageArtifact, packageRuntimeHash);
verifyRuntimeSelector(overviewPackageArtifact, overviewRuntimeHash);

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

await verifyKPackageInstalls([
  {
    artifact: packageArtifact,
    packageType: "KWin/Script",
    pluginId,
    relativeInstallPath: `kwin/scripts/${pluginId}`,
    requiredEntries: ["contents/ui/main.qml", "contents/runtime/selector.qml"],
  },
  {
    artifact: overviewPackageArtifact,
    packageType: "KWin/Effect",
    pluginId: overviewPluginId,
    relativeInstallPath: `kwin/effects/${overviewPluginId}`,
    requiredEntries: [
      "contents/config/main.xml",
      "contents/runtime/selector.qml",
      "contents/ui/config.ui",
      "contents/ui/main.qml",
    ],
  },
  {
    artifact: transitionPackageArtifact,
    packageType: "KWin/Effect",
    pluginId: transitionPluginId,
    relativeInstallPath: `kwin/effects/${transitionPluginId}`,
    requiredEntries: [
      "contents/code/main.js",
      "contents/config/main.xml",
      "contents/ui/config.ui",
    ],
  },
]);

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

function withRuntimeEntries(entries, runtimeEntries, runtimeHash) {
  return [
    ...entries,
    ...runtimeEntries.map(
      (entry) => `contents/runtime/${runtimeHash}/${entry}`,
    ),
  ].sort();
}

function verifyPackageEntries(artifact, expectedEntries, packageName) {
  const entries = packageEntries(artifact);

  if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
    throw new Error(
      `${packageName} entries differ from the release contract: ${entries.join(", ")}`,
    );
  }
}

function packageEntries(artifact) {
  return runUnzip(["-Z1", artifact])
    .trimEnd()
    .split("\n")
    .filter((entry) => entry !== "")
    .sort();
}

async function verifyPackageMetadata(
  artifact,
  sourceMetadataPath,
  {
    configModule,
    mainScript = "ui/main.qml",
    packageStructure,
    plasmaApi = "declarativescript",
    pluginId: expectedPluginId,
  },
) {
  const archivedMetadata = runUnzip(["-p", artifact, "metadata.json"]);
  let metadata;

  try {
    metadata = JSON.parse(archivedMetadata);
  } catch (error) {
    throw new Error("KWin package metadata is not valid JSON", {
      cause: error,
    });
  }

  if (archivedMetadata !== (await readFile(sourceMetadataPath, "utf8"))) {
    throw new Error("packaged metadata differs from its repository source");
  }

  if (
    mainScript === null
      ? "X-Plasma-MainScript" in metadata
      : metadata["X-Plasma-MainScript"] !== mainScript
  ) {
    throw new Error("KWin package metadata has an unexpected main entrypoint");
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

  if (metadata["X-Plasma-API"] !== plasmaApi) {
    throw new Error("KWin package metadata has an unexpected Plasma API");
  }

  if (
    configModule !== undefined &&
    metadata["X-KDE-ConfigModule"] !== configModule
  ) {
    throw new Error("KWin package metadata has an unexpected config module");
  }
}

async function verifyArchivedSourceFile(artifact, archivePath, sourcePath) {
  const archivedFile = runUnzipBytes(["-p", artifact, archivePath]);
  const sourceFile = await readFile(sourcePath);

  if (!archivedFile.equals(sourceFile)) {
    throw new Error(`${archivePath} differs from its repository source`);
  }
}

function packagedRuntimeHash(artifact) {
  const runtimeHashes = new Set();

  for (const entry of packageEntries(artifact)) {
    const match = /^contents\/runtime\/([0-9a-f]{64})\/(?:code|ui)\/.+$/u.exec(
      entry,
    );

    if (match !== null) {
      runtimeHashes.add(match[1]);
    }
  }

  if (runtimeHashes.size !== 1) {
    throw new Error(
      `package must contain exactly one hashed runtime: ${[...runtimeHashes].join(", ")}`,
    );
  }

  return [...runtimeHashes][0];
}

function verifyRuntimeSelector(artifact, runtimeHash) {
  const selector = runUnzip(["-p", artifact, "contents/runtime/selector.qml"]);
  const expectedSelector = `import QtQuick\n\nLoader {\n    source: Qt.resolvedUrl("${runtimeHash}/ui/main.qml")\n}\n`;

  if (selector !== expectedSelector) {
    throw new Error(
      "runtime selector does not select the packaged content hash",
    );
  }
}

function verifyRuntimeHash(artifact, runtimeEntries, expectedHash) {
  const files = runtimeEntries.map((logicalPath) => ({
    content: runUnzipBytes([
      "-p",
      artifact,
      `contents/runtime/${expectedHash}/${logicalPath}`,
    ]),
    logicalPath,
  }));
  const actualHash = runtimeContentHash(files);

  if (actualHash !== expectedHash) {
    throw new Error(
      `packaged runtime content hash ${actualHash} does not match ${expectedHash}`,
    );
  }
}

async function verifyKPackageInstalls(packages) {
  const temporaryHome = await mkdtemp(
    resolve(tmpdir(), "driftile-package-check-"),
  );
  const dataHome = resolve(temporaryHome, "data");
  const runtimeDirectory = resolve(temporaryHome, "runtime");
  const environment = {
    ...process.env,
    HOME: temporaryHome,
    XDG_CACHE_HOME: resolve(temporaryHome, "cache"),
    XDG_CONFIG_HOME: resolve(temporaryHome, "config"),
    XDG_DATA_HOME: dataHome,
    XDG_RUNTIME_DIR: runtimeDirectory,
    XDG_STATE_HOME: resolve(temporaryHome, "state"),
  };

  try {
    await Promise.all([
      mkdir(environment.XDG_CACHE_HOME, { recursive: true }),
      mkdir(environment.XDG_CONFIG_HOME, { recursive: true }),
      mkdir(dataHome, { recursive: true }),
      mkdir(runtimeDirectory, { recursive: true }),
      mkdir(environment.XDG_STATE_HOME, { recursive: true }),
    ]);
    await chmod(runtimeDirectory, 0o700);

    for (const package_ of packages) {
      runCommand(
        "kpackagetool6",
        [`--type=${package_.packageType}`, "--install", package_.artifact],
        environment,
      );

      const installedDirectory = resolve(
        dataHome,
        package_.relativeInstallPath,
      );
      const installedMetadata = JSON.parse(
        await readFile(resolve(installedDirectory, "metadata.json"), "utf8"),
      );

      if (installedMetadata["KPlugin"]?.["Id"] !== package_.pluginId) {
        throw new Error(
          `${package_.packageType} installed an unexpected plugin ID`,
        );
      }

      await Promise.all(
        package_.requiredEntries.map((entry) =>
          readFile(resolve(installedDirectory, entry)),
        ),
      );
    }
  } finally {
    await rm(temporaryHome, { force: true, recursive: true });
  }
}

function runCommand(command, arguments_, environment) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    env: environment,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} exited with status ${String(result.status)}: ${result.stderr.trim()}`,
    );
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

function runUnzipBytes(arguments_) {
  const result = spawnSync("unzip", arguments_, {
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `unzip exited with status ${String(result.status)}: ${result.stderr.toString("utf8").trim()}`,
    );
  }

  return result.stdout;
}
