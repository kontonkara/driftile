import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageSource = resolve(rootDirectory, "packaging/kwin-script");
const packageOutput = resolve(rootDirectory, "dist/kwin-script");
const runtimeOutput = resolve(packageOutput, "contents/code/main.js");
const shortcutToolOutput = resolve(
  rootDirectory,
  "dist/bin/driftile-shortcuts.mjs",
);
const layoutStateValidatorOutput = resolve(
  rootDirectory,
  "dist/bin/driftile-layout-state-validator.mjs",
);

export async function buildProject() {
  await rm(packageOutput, { force: true, recursive: true });
  await cp(packageSource, packageOutput, { recursive: true });
  await mkdir(dirname(runtimeOutput), { recursive: true });

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
    buildShortcutTool(),
    buildLayoutStateValidator(),
  ]);
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
