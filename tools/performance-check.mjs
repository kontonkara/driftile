import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const vitest = resolve(
  dirname(require.resolve("vitest/package.json")),
  "vitest.mjs",
);

const expectedTests = [
  "RuntimeController > performance budget: bounds large startup planning",
  "RuntimeController > performance budget: keeps ownership classification linear",
  "RuntimeController > performance budget: settles sustained lifecycle changes",
  "RuntimeController > performance budget: coalesces dirty visible contexts",
  "solveStripGeometry > performance budget: bounds automatic height policy reads",
  "projectOverviewLayout > performance budget: resolves the maximum window catalog linearly",
];
const pattern = "performance budget:";
const testFiles = [
  "tests/runtime-controller.test.ts",
  "tests/core/geometry.test.ts",
  "tests/overview/layout-view.test.ts",
];
const arguments_ = process.argv.slice(2);
const listOnly = arguments_.length === 1 && arguments_[0] === "--list-only";

if (arguments_.length > (listOnly ? 1 : 0)) {
  console.error("Usage: node tools/performance-check.mjs [--list-only]");
  process.exit(2);
}

const listed = spawnSync(
  process.execPath,
  [
    vitest,
    "list",
    ...testFiles,
    "--testNamePattern",
    pattern,
    "--json",
    "--no-color",
  ],
  { encoding: "utf8" },
);

if (listed.error || listed.status !== 0) {
  process.stderr.write(listed.stderr || String(listed.error));
  process.exit(listed.status ?? 1);
}

let collected;

try {
  collected = JSON.parse(listed.stdout);
} catch (error) {
  console.error(
    `Could not decode the performance test manifest: ${String(error)}`,
  );
  process.exit(1);
}

const collectedNames = Array.isArray(collected)
  ? collected.map((test) => test?.name)
  : [];
const expectedManifest = [...expectedTests].sort();
const collectedManifest = [...collectedNames].sort();

if (
  collectedManifest.length !== expectedManifest.length ||
  expectedManifest.some((name, index) => collectedManifest[index] !== name)
) {
  console.error("The deterministic performance test manifest changed.");
  console.error(`Expected: ${JSON.stringify(expectedManifest)}`);
  console.error(`Received: ${JSON.stringify(collectedManifest)}`);
  process.exit(1);
}

if (listOnly) {
  console.log(`performance budgets: ${String(expectedTests.length)}`);
  process.exit(0);
}

const completed = spawnSync(
  process.execPath,
  [vitest, "run", ...testFiles, "--testNamePattern", pattern, "--no-color"],
  { stdio: "inherit" },
);

if (completed.error) {
  console.error(String(completed.error));
  process.exit(1);
}

process.exit(completed.status ?? 1);
