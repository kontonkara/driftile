import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const width = 320;
const height = 240;
const expectedAnchorShift = 7;
const feature = {
  height: 18,
  width: 30,
  x: 148,
  y: 104,
};
const exitFrameNames = Array.from(
  { length: 16 },
  (_, index) => `exitFrame${String(index + 1).padStart(2, "0")}`,
);
const imageNames = [
  "baseline",
  "baselineDuplicate",
  "wheelIn",
  "wheelInDuplicate",
  "wheelReset",
  "anchorBaseline",
  "anchorBaselineDuplicate",
  "anchorWheelIn",
  "anchorWheelReset",
  "keyIn",
  "keyReset",
  "continuitySeed",
  "continuityClosing",
  "continuity",
  "configuredReset",
  "freshSeed",
  "freshOpen",
  "freshClose",
  "desktopSurface",
  ...exitFrameNames,
] as const;
const probePath = resolve("tools/vm/overview-zoom-visual-probe.mjs");

describe("overview zoom visual probe", () => {
  it("preserves a sparse pointer anchor over a desktop-surface-dominated frame", () => {
    const result = runFixture(0);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      anchor: {
        bestShift: expectedAnchorShift,
      },
    });
  });

  it("rejects an unshifted sparse feature under the same desktop surface", () => {
    const result = runFixture(expectedAnchorShift);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("off-centre zoom registered at shift 0");
  });
});

function runFixture(anchorShift: number): {
  status: number;
  stderr: string;
  stdout: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "driftile-zoom-probe-"));
  try {
    const paths = writeFixture(directory, anchorShift);
    try {
      const stdout = execFileSync(
        process.execPath,
        [probePath, ...imageNames.map((name) => paths[name])],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return { status: 0, stderr: "", stdout };
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("status" in error) ||
        !("stderr" in error) ||
        !("stdout" in error)
      ) {
        throw error;
      }
      return {
        status: Number(error.status),
        stderr: String(error.stderr),
        stdout: String(error.stdout),
      };
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function writeFixture(
  directory: string,
  anchorShift: number,
): Record<(typeof imageNames)[number], string> {
  const baseline = makeImage((x, y) => desktopPixel(x, y));
  const zoomed = makeImage((x, y) =>
    isInsideFeature(x, y, feature.y + expectedAnchorShift)
      ? featurePixel(x, y, feature.y + expectedAnchorShift)
      : brighten(desktopPixel(x, y), 7),
  );
  const anchorZoomed = makeImage((x, y) =>
    isInsideFeature(x, y, feature.y + anchorShift)
      ? featurePixel(x, y, feature.y + anchorShift)
      : brighten(desktopPixel(x, y), 7),
  );
  const desktop = makeImage((x, y) => [
    200 - ((x * 3 + y) % 120),
    42 + ((x + y * 2) % 150),
    54 + ((x * 2 + y * 3) % 140),
  ]);
  const closing = blend(zoomed, desktop, 0.5);
  const images: Record<string, Uint8Array> = {
    anchorBaseline: baseline,
    anchorBaselineDuplicate: baseline,
    anchorWheelIn: anchorZoomed,
    anchorWheelReset: baseline,
    baseline,
    baselineDuplicate: baseline,
    configuredReset: baseline,
    continuity: zoomed,
    continuityClosing: closing,
    continuitySeed: zoomed,
    desktopSurface: desktop,
    freshClose: desktop,
    freshOpen: baseline,
    freshSeed: zoomed,
    keyIn: zoomed,
    keyReset: baseline,
    wheelIn: zoomed,
    wheelInDuplicate: zoomed,
    wheelReset: baseline,
  };

  for (const [index, name] of exitFrameNames.entries()) {
    images[name] = blend(zoomed, desktop, (index + 1) / exitFrameNames.length);
  }

  return Object.fromEntries(
    imageNames.map((name) => {
      const path = join(directory, `${name}.ppm`);
      writeFileSync(path, portablePixmap(images[name]));
      return [name, path];
    }),
  );
}

function makeImage(
  pixel: (x: number, y: number) => readonly [number, number, number],
): Uint8Array {
  const bytes = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      bytes.set(pixel(x, y), offset);
    }
  }
  return bytes;
}

function desktopPixel(x: number, y: number): readonly [number, number, number] {
  return [
    34 + ((x * 2 + y) % 150),
    38 + ((x + y * 3) % 144),
    44 + ((x * 3 + y * 2) % 138),
  ];
}

function brighten(
  pixel: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  return [
    Math.min(255, pixel[0] + amount),
    Math.min(255, pixel[1] + amount),
    Math.min(255, pixel[2] + amount),
  ];
}

function featurePixel(
  x: number,
  y: number,
  featureY: number,
): readonly [number, number, number] {
  return (x - feature.x + y - featureY) % 2 === 0
    ? [242, 34, 218]
    : [28, 232, 246];
}

function isInsideFeature(x: number, y: number, featureY: number): boolean {
  return (
    x >= feature.x &&
    x < feature.x + feature.width &&
    y >= featureY &&
    y < featureY + feature.height
  );
}

function blend(
  left: Uint8Array,
  right: Uint8Array,
  amount: number,
): Uint8Array {
  return left.map((channel, index) =>
    Math.round(channel * (1 - amount) + right[index] * amount),
  );
}

function portablePixmap(bytes: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from(`P6\n${String(width)} ${String(height)}\n255\n`),
    bytes,
  ]);
}
