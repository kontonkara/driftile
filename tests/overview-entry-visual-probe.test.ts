import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const width = 64;
const height = 48;
const probePath = resolve("tools/vm/overview-entry-visual-probe.mjs");

type Image = Uint8Array;
type Pixel = readonly [number, number, number];

describe("overview entry visual probe", () => {
  it("accepts a smoothly moving dark wallpaper band", () => {
    const result = runFixture(createMovingBandFixture());

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      maximumWideDarkAreaFraction: 0,
      wideDarkCulprit: null,
    });
  });

  it("rejects a one-frame wide fallback rectangle", () => {
    const result = runFixture(createFallbackRectangleFixture());

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "an entry frame exposed a wide dark rectangular region",
    );
    expect(result.stderr).toContain(
      "at frame 3 (x=0, y=20, width=64, height=4)",
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      maximumWideDarkAreaFraction: 0.083333,
      wideDarkCulprit: {
        fallbackPixelFraction: 1,
        frameIndex: 3,
        height: 4,
        maximumChannelStandardDeviation: 18,
        width: 64,
        x: 0,
        y: 20,
      },
    });
  });

  it("rejects a one-frame low-variance rectangle away from the fallback color", () => {
    const result = runFixture(
      createTransientRectangleFixture(() => [58, 66, 76]),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "an entry frame exposed a wide dark rectangular region",
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      wideDarkCulprit: {
        fallbackPixelFraction: 0,
        maximumChannelStandardDeviation: 0,
      },
    });
  });
});

function createMovingBandFixture(): readonly Image[] {
  return [4, 6, 8, 10, 12, 14, 16, 18, 20].map((bandTop) =>
    makeImage((x, y) =>
      y >= bandTop && y < bandTop + 8
        ? darkWallpaperPixel(x, y)
        : wallpaperPixel(x, y),
    ),
  );
}

function createFallbackRectangleFixture(): readonly Image[] {
  return createTransientRectangleFixture((x, y) =>
    (x + y) % 2 === 0 ? [5, 12, 24] : [41, 48, 60],
  );
}

function createTransientRectangleFixture(
  rectanglePixel: (x: number, y: number) => Pixel,
): readonly Image[] {
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((progress, index) =>
    makeImage((x, y) =>
      index === 2 && y >= 20 && y < 24
        ? rectanglePixel(x, y)
        : transitionPixel(x, y, progress),
    ),
  );
}

function runFixture(frames: readonly Image[]): {
  status: number;
  stderr: string;
  stdout: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "driftile-entry-probe-"));
  try {
    const desktopPath = writeImage(directory, "desktop", frames[0]);
    const overviewPath = writeImage(
      directory,
      "overview",
      frames[frames.length - 1],
    );
    const overviewDuplicatePath = writeImage(
      directory,
      "overview-duplicate",
      frames[frames.length - 1],
    );
    const framePaths = frames.map((frame, index) =>
      writeImage(directory, `frame-${String(index + 1)}`, frame),
    );
    const manifestPath = join(directory, "frames.list");
    writeFileSync(manifestPath, `${framePaths.join("\n")}\n`);

    const result = spawnSync(
      process.execPath,
      [
        probePath,
        desktopPath,
        overviewPath,
        overviewDuplicatePath,
        manifestPath,
      ],
      { encoding: "utf8" },
    );
    if (result.error) {
      throw result.error;
    }
    return {
      status: result.status ?? -1,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function writeImage(
  directory: string,
  name: string,
  image: Image | undefined,
): string {
  if (!image) {
    throw new Error(`Missing ${name} fixture image`);
  }
  const path = join(directory, `${name}.ppm`);
  writeFileSync(path, portablePixmap(image));
  return path;
}

function makeImage(pixel: (x: number, y: number) => Pixel): Image {
  const bytes = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      bytes.set(pixel(x, y), (y * width + x) * 3);
    }
  }
  return bytes;
}

function wallpaperPixel(x: number, y: number): Pixel {
  return [
    96 + ((x * 7 + y * 3) % 60),
    104 + ((x * 5 + y * 7) % 56),
    112 + ((x * 3 + y * 5) % 52),
  ];
}

function darkWallpaperPixel(x: number, y: number): Pixel {
  return [
    36 + ((x * 3 + y) % 9),
    42 + ((x + y * 3) % 9),
    48 + ((x * 2 + y * 5) % 9),
  ];
}

function transitionPixel(x: number, y: number, progress: number): Pixel {
  const desktop = wallpaperPixel(x, y);
  return [
    Math.round(desktop[0] + 32 * progress),
    Math.round(desktop[1] + 24 * progress),
    Math.round(desktop[2] + 16 * progress),
  ];
}

function portablePixmap(bytes: Image): Buffer {
  return Buffer.concat([
    Buffer.from(`P6\n${String(width)} ${String(height)}\n255\n`),
    bytes,
  ]);
}
