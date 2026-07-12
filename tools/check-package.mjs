import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageProject } from "./package.mjs";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const firstArtifact = await packageProject();
const firstBytes = await readFile(firstArtifact);

await delay(2_100);

const secondArtifact = await packageProject();
const secondBytes = await readFile(secondArtifact);

if (!firstBytes.equals(secondBytes)) {
  throw new Error("consecutive package builds produced different artifacts");
}

const checksum = createHash("sha256").update(secondBytes).digest("hex");
const checksumManifest = await readFile(
  resolve(rootDirectory, "dist/SHA256SUMS"),
  "utf8",
);
const expectedManifest = `${checksum}  ${basename(secondArtifact)}\n`;

if (checksumManifest !== expectedManifest) {
  throw new Error("SHA256SUMS does not match the packaged artifact");
}

console.log(`${basename(secondArtifact)} ${checksum}`);
