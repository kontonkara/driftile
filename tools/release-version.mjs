import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const semanticVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export async function releaseVersion(directory = rootDirectory) {
  const [packageManifest, packageLock, metadata, overviewMetadata, flake] =
    await Promise.all([
      readJson(resolve(directory, "package.json")),
      readJson(resolve(directory, "package-lock.json")),
      readJson(resolve(directory, "packaging/kwin-script/metadata.json")),
      readJson(resolve(directory, "packaging/kwin-effect/metadata.json")),
      readFile(resolve(directory, "flake.nix"), "utf8"),
    ]);
  const flakeVersions = [...flake.matchAll(/^\s*version = "([^"]+)";$/gmu)].map(
    (match) => match[1],
  );

  if (flakeVersions.length !== 1) {
    throw new Error("flake.nix must declare exactly one package version");
  }

  const versions = {
    "flake.nix": flakeVersions[0],
    "package-lock.json": packageLock["version"],
    "package-lock.json root": packageLock["packages"]?.[""]?.["version"],
    "package.json": packageManifest["version"],
    "packaging metadata": metadata["KPlugin"]?.["Version"],
    "overview packaging metadata": overviewMetadata["KPlugin"]?.["Version"],
  };
  const unique = new Set(Object.values(versions));
  const version = versions["package.json"];

  if (
    unique.size !== 1 ||
    typeof version !== "string" ||
    !semanticVersion.test(version)
  ) {
    throw new Error(
      `release version mismatch: ${Object.entries(versions)
        .map(([source, value]) => `${source}=${String(value)}`)
        .join(", ")}`,
    );
  }

  return version;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const version = await releaseVersion();
  const expectedTag = process.argv[2];

  if (expectedTag !== undefined && expectedTag !== `v${version}`) {
    throw new Error(`expected tag v${version}, received ${expectedTag}`);
  }

  console.log(version);
}
