import { pathToFileURL } from "node:url";
import {
  decodeLayoutPersistenceCatalog,
  encodeLayoutPersistenceCatalog,
} from "./core/layout-persistence-catalog";
import { encodeLayoutPersistence } from "./core/layout-persistence";

function canonicalizeLayoutStateRepresentation(input: string): string {
  const representation = parseRepresentation(input);
  const document =
    typeof representation === "string"
      ? representation
      : JSON.stringify(representation);
  const decoded = decodeLayoutPersistenceCatalog(document);

  if (!decoded.ok) {
    throw new Error(`Layout state is invalid: ${decoded.error}`);
  }

  const active = decoded.value.snapshots[0];

  if (active === undefined) {
    throw new Error("Layout state is invalid: missing active snapshot");
  }

  return active.topology === null
    ? encodeLayoutPersistence(active.state)
    : encodeLayoutPersistenceCatalog(decoded.value);
}

function parseRepresentation(input: string): string | Record<string, unknown> {
  let value: unknown;

  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new Error("Layout state representation is not valid JSON");
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error("Layout state representation must be a string or object");
}

async function main(): Promise<void> {
  const input = await readStandardInput();
  process.stdout.write(canonicalizeLayoutStateRepresentation(input));
}

function readStandardInput(): Promise<string> {
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let input = "";

    process.stdin.on("data", (chunk: string) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      resolve(input);
    });
    process.stdin.on("error", reject);
  });
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Layout state validation failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
