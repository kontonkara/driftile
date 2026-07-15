import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageSource = resolve(rootDirectory, "packaging/kwin-script");
const packageOutput = resolve(rootDirectory, "dist/kwin-script");
const runtimeOutput = resolve(packageOutput, "contents/code/main.js");
const overviewPackageSource = resolve(rootDirectory, "packaging/kwin-effect");
const overviewPackageOutput = resolve(rootDirectory, "dist/kwin-effect");
const overviewRuntimeOutput = resolve(
  overviewPackageOutput,
  "contents/code/main.js",
);
const shortcutToolOutput = resolve(
  rootDirectory,
  "dist/bin/driftile-shortcuts.mjs",
);
const layoutStateValidatorOutput = resolve(
  rootDirectory,
  "dist/bin/driftile-layout-state-validator.mjs",
);

export async function buildProject() {
  await Promise.all([
    rm(packageOutput, { force: true, recursive: true }),
    rm(overviewPackageOutput, { force: true, recursive: true }),
  ]);
  await Promise.all([
    cp(packageSource, packageOutput, { recursive: true }),
    cp(overviewPackageSource, overviewPackageOutput, { recursive: true }),
  ]);
  await Promise.all([
    mkdir(dirname(runtimeOutput), { recursive: true }),
    mkdir(dirname(overviewRuntimeOutput), { recursive: true }),
  ]);

  await Promise.all([
    build({
      bundle: true,
      entryPoints: [resolve(rootDirectory, "src/runtime.ts")],
      format: "iife",
      globalName: "DriftileRuntime",
      legalComments: "none",
      outfile: runtimeOutput,
      platform: "neutral",
      target: "es2017",
      treeShaking: true,
    }),
    build({
      bundle: true,
      entryPoints: [resolve(rootDirectory, "src/overview/runtime.ts")],
      format: "iife",
      globalName: "DriftileOverview",
      legalComments: "none",
      outfile: overviewRuntimeOutput,
      platform: "neutral",
      target: "es2017",
      treeShaking: true,
    }),
    buildShortcutTool(),
    buildLayoutStateValidator(),
  ]);

  await Promise.all([
    relocateRuntime(packageOutput),
    relocateRuntime(overviewPackageOutput),
  ]);
}

export function runtimeContentHash(files) {
  const orderedFiles = [...files].sort((left, right) => {
    if (left.logicalPath < right.logicalPath) {
      return -1;
    }

    return left.logicalPath > right.logicalPath ? 1 : 0;
  });
  const hash = createHash("sha256");

  for (let index = 0; index < orderedFiles.length; index += 1) {
    const file = orderedFiles[index];

    assertCanonicalRuntimePath(file.logicalPath);

    if (index > 0 && file.logicalPath === orderedFiles[index - 1].logicalPath) {
      throw new Error(`duplicate runtime path: ${file.logicalPath}`);
    }

    updateHashFrame(hash, Buffer.from(file.logicalPath, "utf8"));
    updateHashFrame(hash, file.content);
  }

  return hash.digest("hex");
}

async function relocateRuntime(packageDirectory) {
  const contentsDirectory = resolve(packageDirectory, "contents");
  const runtimeFiles = [
    ...(await findRuntimeFiles(contentsDirectory, "code", ".js")),
    ...(await findRuntimeFiles(contentsDirectory, "ui", ".qml")),
  ];
  const logicalPaths = new Set(
    runtimeFiles.map((runtimeFile) => runtimeFile.logicalPath),
  );

  if (!logicalPaths.has("code/main.js") || !logicalPaths.has("ui/main.qml")) {
    throw new Error(
      "runtime package is missing its main JavaScript or QML file",
    );
  }

  const runtimeHash = runtimeContentHash(runtimeFiles);
  const runtimeDirectory = resolve(contentsDirectory, "runtime", runtimeHash);

  await Promise.all(
    runtimeFiles.map(async (runtimeFile) => {
      const destination = resolve(runtimeDirectory, runtimeFile.logicalPath);

      await mkdir(dirname(destination), { recursive: true });
      await rename(runtimeFile.path, destination);
    }),
  );
  await rm(resolve(contentsDirectory, "code"), {
    force: true,
    recursive: true,
  });

  const metadataPath = resolve(packageDirectory, "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

  metadata["X-Plasma-MainScript"] = `runtime/${runtimeHash}/ui/main.qml`;
  await writeFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
}

async function findRuntimeFiles(contentsDirectory, directory, extension) {
  const root = resolve(contentsDirectory, directory);
  const files = [];

  await visitRuntimeDirectory(root, extension, files);

  return Promise.all(
    files.map(async (path) => ({
      content: await readFile(path),
      logicalPath: relative(contentsDirectory, path).replaceAll("\\", "/"),
      path,
    })),
  );
}

async function visitRuntimeDirectory(directory, extension, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      await visitRuntimeDirectory(path, extension, files);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(path);
    }
  }
}

function assertCanonicalRuntimePath(logicalPath) {
  const parts = logicalPath.split("/");

  if (
    logicalPath.startsWith("/") ||
    logicalPath.includes("\\") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`runtime path is not canonical: ${logicalPath}`);
  }
}

function updateHashFrame(hash, value) {
  const bytes = Buffer.from(value);
  const length = Buffer.allocUnsafe(8);

  length.writeBigUInt64BE(BigInt(bytes.byteLength));
  hash.update(length);
  hash.update(bytes);
}

export async function buildShortcutTool() {
  await mkdir(dirname(shortcutToolOutput), { recursive: true });
  await build({
    bundle: true,
    entryPoints: [resolve(rootDirectory, "src/shortcut-cli.ts")],
    format: "esm",
    legalComments: "none",
    outfile: shortcutToolOutput,
    platform: "node",
    target: "node22",
    treeShaking: true,
  });
}

async function buildLayoutStateValidator() {
  await mkdir(dirname(layoutStateValidatorOutput), { recursive: true });
  await build({
    bundle: true,
    entryPoints: [
      resolve(rootDirectory, "src/layout-persistence-validator-cli.ts"),
    ],
    format: "esm",
    legalComments: "none",
    outfile: layoutStateValidatorOutput,
    platform: "node",
    target: "node22",
    treeShaking: true,
  });
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await buildProject();
}
