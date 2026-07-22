#!/usr/bin/env node

import { readFileSync } from "node:fs";

const maximumPixelCount = 16 * 1024 * 1024;
const maximumFrameCount = 64;

if (process.argv.length !== 6) {
  process.stderr.write(
    `Usage: ${process.argv[1]} desktop.ppm overview.ppm overview-duplicate.ppm frames.list\n`,
  );
  process.exit(2);
}

const [desktopPath, overviewPath, overviewDuplicatePath, manifestPath] =
  process.argv.slice(2);
const framePaths = readFrameManifest(manifestPath);
const desktop = readPortablePixmap(desktopPath);
const overview = readPortablePixmap(overviewPath);
const overviewDuplicate = readPortablePixmap(overviewDuplicatePath);
const frames = framePaths.map(readPortablePixmap);

for (const [name, image] of [
  ["overview", overview],
  ["overview duplicate", overviewDuplicate],
  ...frames.map((frame, index) => [`entry frame ${index + 1}`, frame]),
]) {
  if (image.width !== desktop.width || image.height !== desktop.height) {
    fail(
      `${name} has ${image.width}x${image.height}; expected ${desktop.width}x${desktop.height}`,
    );
  }
}

const endpointSignal = normalizedMeanAbsoluteError(desktop, overview);
const sameStateNoise = normalizedMeanAbsoluteError(overview, overviewDuplicate);
const sameStateNoiseLimit = 0.01;
const materialLimit = Math.min(
  endpointSignal * 0.15,
  Math.max(0.003, sameStateNoise * 8 + 0.001),
);
const endpointLimit = Math.max(0.01, sameStateNoise * 10 + 0.002);
const darkDeficitThreshold = Math.max(12, Math.ceil(sameStateNoise * 255 * 12));
const wholeFrameUnderflowLimit = Math.max(0.025, sameStateNoise * 12 + 0.002);
const endpointModalFraction = Math.max(
  quantizedModalFraction(desktop),
  quantizedModalFraction(overview),
);
const modalFractionLimit = Math.max(0.88, endpointModalFraction + 0.12);
const frameMetrics = frames.map((frame) => ({
  ...entryContinuityMetrics(desktop, overview, frame, darkDeficitThreshold),
  modalFraction: quantizedModalFraction(frame),
}));
const firstMaterialFrameIndex = frameMetrics.findIndex(
  (metrics) => metrics.desktopDistance > materialLimit,
);
const maximumEndpointDistance = Math.max(
  ...frameMetrics.map((metrics) =>
    Math.min(metrics.desktopDistance, metrics.overviewDistance),
  ),
);
const maximumWholeFrameUnderflow = Math.max(
  ...frameMetrics.map((metrics) => metrics.wholeFrameUnderflow),
);
const maximumWideDarkAreaFraction = Math.max(
  ...frameMetrics.map((metrics) => metrics.wideDarkAreaFraction),
);
const maximumModalFraction = Math.max(
  ...frameMetrics.map((metrics) => metrics.modalFraction),
);
const firstMaterialFrame =
  firstMaterialFrameIndex >= 0 ? frameMetrics[firstMaterialFrameIndex] : null;
const terminalFrameDistance =
  frameMetrics[frameMetrics.length - 1].overviewDistance;
const report = {
  darkDeficitThreshold,
  endpointLimit: roundMetric(endpointLimit),
  endpointSignal: roundMetric(endpointSignal),
  firstMaterialFrame: firstMaterialFrame
    ? {
        index: firstMaterialFrameIndex + 1,
        ...roundMetrics(firstMaterialFrame),
      }
    : null,
  frameCount: frames.length,
  frames: frameMetrics.map((metrics, index) => ({
    index: index + 1,
    ...roundMetrics(metrics),
  })),
  materialLimit: roundMetric(materialLimit),
  maximumEndpointDistance: roundMetric(maximumEndpointDistance),
  maximumModalFraction: roundMetric(maximumModalFraction),
  maximumWholeFrameUnderflow: roundMetric(maximumWholeFrameUnderflow),
  maximumWideDarkAreaFraction: roundMetric(maximumWideDarkAreaFraction),
  modalFractionLimit: roundMetric(modalFractionLimit),
  sameStateNoise: roundMetric(sameStateNoise),
  sameStateNoiseLimit: roundMetric(sameStateNoiseLimit),
  terminalFrameDistance: roundMetric(terminalFrameDistance),
  wholeFrameUnderflowLimit: roundMetric(wholeFrameUnderflowLimit),
};

process.stdout.write(`${JSON.stringify(report)}\n`);

if (endpointSignal < 0.03) {
  fail("the stable desktop and Overview endpoints are not materially distinct");
}
if (sameStateNoise > sameStateNoiseLimit) {
  fail("duplicate stable Overview captures are too unstable");
}
if (firstMaterialFrameIndex < 0 || maximumEndpointDistance < materialLimit) {
  fail("the entry burst did not contain a material transition frame");
}
if (terminalFrameDistance > endpointLimit) {
  fail("the entry burst did not reach the stable Overview endpoint");
}
if (maximumWholeFrameUnderflow > wholeFrameUnderflowLimit) {
  fail("an entry frame became materially darker than both stable endpoints");
}
if (maximumWideDarkAreaFraction >= 0.08) {
  fail("an entry frame exposed a wide dark rectangular region");
}
if (maximumModalFraction > modalFractionLimit) {
  fail("an entry frame collapsed into a fullscreen modal color");
}

function readFrameManifest(path) {
  const document = readFileSync(path, "utf8");
  const paths = document
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (paths.length < 2 || paths.length > maximumFrameCount) {
    fail(
      `${path} contains ${paths.length} frame paths; expected 2..${maximumFrameCount}`,
    );
  }
  if (new Set(paths).size !== paths.length) {
    fail(`${path} contains duplicate frame paths`);
  }
  return paths;
}

function entryContinuityMetrics(desktop, overview, frame, deficitThreshold) {
  const gridColumns = 16;
  const gridRows = 12;
  const darkCells = Array.from({ length: gridRows }, () =>
    Array.from({ length: gridColumns }, () => false),
  );
  let desktopLuminance = 0;
  let frameLuminance = 0;
  let overviewLuminance = 0;
  let sampledPixels = 0;

  for (let gridY = 0; gridY < gridRows; gridY += 1) {
    const yStart = Math.floor((gridY * frame.height) / gridRows);
    const yEnd = Math.floor(((gridY + 1) * frame.height) / gridRows);
    for (let gridX = 0; gridX < gridColumns; gridX += 1) {
      const xStart = Math.floor((gridX * frame.width) / gridColumns);
      const xEnd = Math.floor(((gridX + 1) * frame.width) / gridColumns);
      let cellDeficit = 0;
      let cellPixels = 0;
      let darkPixels = 0;
      let eligiblePixels = 0;

      for (let y = yStart; y < yEnd; y += 2) {
        for (let x = xStart; x < xEnd; x += 2) {
          const offset = (y * frame.width + x) * 3;
          const desktopValue = pixelLuminance(desktop.bytes, offset);
          const overviewValue = pixelLuminance(overview.bytes, offset);
          const frameValue = pixelLuminance(frame.bytes, offset);
          const endpointFloor = Math.min(desktopValue, overviewValue);
          desktopLuminance += desktopValue;
          overviewLuminance += overviewValue;
          frameLuminance += frameValue;
          sampledPixels += 1;
          cellPixels += 1;

          if (endpointFloor < 24) {
            continue;
          }
          eligiblePixels += 1;
          const deficit = endpointFloor - frameValue;
          if (deficit >= deficitThreshold) {
            darkPixels += 1;
            cellDeficit += deficit;
          }
        }
      }

      darkCells[gridY][gridX] =
        eligiblePixels >= cellPixels * 0.25 &&
        darkPixels >= eligiblePixels * 0.6 &&
        cellDeficit >= darkPixels * deficitThreshold * 1.15;
    }
  }

  const desktopMean = desktopLuminance / (sampledPixels * 255);
  const overviewMean = overviewLuminance / (sampledPixels * 255);
  const frameMean = frameLuminance / (sampledPixels * 255);
  return {
    desktopDistance: normalizedMeanAbsoluteError(frame, desktop),
    frameMean,
    overviewDistance: normalizedMeanAbsoluteError(frame, overview),
    wholeFrameUnderflow: Math.max(
      0,
      Math.min(desktopMean, overviewMean) - frameMean,
    ),
    wideDarkAreaFraction: largestWideRectangleFraction(darkCells, 0.5),
  };
}

function largestWideRectangleFraction(cells, minimumWidthFraction) {
  const rows = cells.length;
  const columns = cells[0]?.length ?? 0;
  const heights = Array.from({ length: columns }, () => 0);
  let maximumArea = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      heights[column] = cells[row][column] ? heights[column] + 1 : 0;
    }
    for (let left = 0; left < columns; left += 1) {
      let height = Number.POSITIVE_INFINITY;
      for (let right = left; right < columns; right += 1) {
        height = Math.min(height, heights[right]);
        const width = right - left + 1;
        if (height <= 0 || width / columns < minimumWidthFraction) {
          continue;
        }
        maximumArea = Math.max(maximumArea, width * height);
      }
    }
  }

  return rows > 0 && columns > 0 ? maximumArea / (rows * columns) : 0;
}

function quantizedModalFraction(image) {
  const colors = new Map();
  let maximumColorCount = 0;
  let sampledPixels = 0;

  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const offset = (y * image.width + x) * 3;
      const color =
        ((image.bytes[offset] >> 3) << 10) |
        ((image.bytes[offset + 1] >> 3) << 5) |
        (image.bytes[offset + 2] >> 3);
      const count = (colors.get(color) ?? 0) + 1;
      colors.set(color, count);
      maximumColorCount = Math.max(maximumColorCount, count);
      sampledPixels += 1;
    }
  }

  return maximumColorCount / sampledPixels;
}

function pixelLuminance(bytes, offset) {
  return (
    bytes[offset] * 0.2126 +
    bytes[offset + 1] * 0.7152 +
    bytes[offset + 2] * 0.0722
  );
}

function readPortablePixmap(path) {
  const bytes = readFileSync(path);
  let offset = 0;

  const token = () => {
    while (offset < bytes.length) {
      const byte = bytes[offset];
      if (byte === 35) {
        while (offset < bytes.length && bytes[offset] !== 10) {
          offset += 1;
        }
      } else if (isWhitespace(byte)) {
        offset += 1;
      } else {
        break;
      }
    }

    const start = offset;
    while (
      offset < bytes.length &&
      !isWhitespace(bytes[offset]) &&
      bytes[offset] !== 35
    ) {
      offset += 1;
    }
    if (start === offset) {
      fail(`${path} has an incomplete PPM header`);
    }
    return bytes.toString("ascii", start, offset);
  };

  const magic = token();
  const width = Number(token());
  const height = Number(token());
  const maximum = Number(token());
  if (
    magic !== "P6" ||
    !Number.isSafeInteger(width) ||
    width < 1 ||
    !Number.isSafeInteger(height) ||
    height < 1 ||
    maximum !== 255
  ) {
    fail(`${path} is not a bounded 8-bit binary PPM image`);
  }
  if (!isWhitespace(bytes[offset])) {
    fail(`${path} is missing the PPM raster separator`);
  }
  offset += 1;

  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > maximumPixelCount) {
    fail(`${path} exceeds the bounded PPM pixel count`);
  }
  const expectedLength = pixelCount * 3;
  if (
    !Number.isSafeInteger(expectedLength) ||
    bytes.length - offset !== expectedLength
  ) {
    fail(`${path} has an invalid PPM raster length`);
  }

  return {
    bytes: bytes.subarray(offset),
    height,
    width,
  };
}

function normalizedMeanAbsoluteError(left, right) {
  let difference = 0;
  let sampledChannels = 0;
  const pixelStride = 4;

  for (let pixel = 0; pixel < left.width * left.height; pixel += pixelStride) {
    const offset = pixel * 3;
    difference += Math.abs(left.bytes[offset] - right.bytes[offset]);
    difference += Math.abs(left.bytes[offset + 1] - right.bytes[offset + 1]);
    difference += Math.abs(left.bytes[offset + 2] - right.bytes[offset + 2]);
    sampledChannels += 3;
  }

  return difference / (sampledChannels * 255);
}

function isWhitespace(byte) {
  return byte === 9 || byte === 10 || byte === 13 || byte === 32;
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}

function roundMetrics(metrics) {
  return Object.fromEntries(
    Object.entries(metrics).map(([name, value]) => [name, roundMetric(value)]),
  );
}

function fail(message) {
  process.stderr.write(`Overview entry visual probe failed: ${message}.\n`);
  process.exit(1);
}
