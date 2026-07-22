#!/usr/bin/env node

import { readFileSync } from "node:fs";

const maximumPixelCount = 16 * 1024 * 1024;
const configuredZoom = 0.43;
const steppedZoom = 0.48;
const anchorFraction = 0.75;
const minimumAnchorSalienceEnergy = 2400;
const maximumCardGap = 48;
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
];

if (process.argv.length !== imageNames.length + 2) {
  process.stderr.write(
    `Usage: ${process.argv[1]} ${imageNames.join(".ppm ")}.ppm\n`,
  );
  process.exit(2);
}

const images = Object.fromEntries(
  imageNames.map((name, index) => [
    name,
    readPortablePixmap(process.argv[index + 2]),
  ]),
);
const baseline = images.baseline;

for (const [name, image] of Object.entries(images)) {
  if (image.width !== baseline.width || image.height !== baseline.height) {
    fail(
      `${name} has ${image.width}x${image.height}; expected ${baseline.width}x${baseline.height}`,
    );
  }
}

const baselineDistances = Object.fromEntries(
  imageNames
    .slice(1, imageNames.indexOf("freshClose"))
    .map((name) => [name, normalizedMeanAbsoluteError(baseline, images[name])]),
);
const duplicateDistances = {
  anchorBaseline: normalizedMeanAbsoluteError(
    images.anchorBaseline,
    images.anchorBaselineDuplicate,
  ),
  baseline: baselineDistances.baselineDuplicate,
  wheelIn: normalizedMeanAbsoluteError(images.wheelIn, images.wheelInDuplicate),
};
const sameStateNoise = Math.max(...Object.values(duplicateDistances));
const zoomNames = [
  "wheelIn",
  "keyIn",
  "continuitySeed",
  "continuity",
  "freshSeed",
];
const resetNames = ["wheelReset", "keyReset", "configuredReset", "freshOpen"];
const minimumZoomDistance = Math.min(
  ...zoomNames.map((name) => baselineDistances[name]),
);
const equivalenceLimit = Math.min(
  minimumZoomDistance * 0.12,
  Math.max(0.001, sameStateNoise * 4 + 0.0005),
);
const resetLimit = Math.min(
  minimumZoomDistance * 0.15,
  Math.max(0.0015, sameStateNoise * 5 + 0.00075),
);
const resetDistances = {
  ...Object.fromEntries(
    resetNames.map((name) => [name, baselineDistances[name]]),
  ),
  anchorWheelReset: normalizedMeanAbsoluteError(
    images.anchorBaseline,
    images.anchorWheelReset,
  ),
};
const maximumResetDistance = Math.max(...Object.values(resetDistances));
const equivalenceDistances = {
  continuity: normalizedMeanAbsoluteError(
    images.continuitySeed,
    images.continuity,
  ),
  freshSeed: normalizedMeanAbsoluteError(images.keyIn, images.freshSeed),
  repeatedKeyboard: normalizedMeanAbsoluteError(
    images.keyIn,
    images.continuitySeed,
  ),
  wheelKeyboard: normalizedMeanAbsoluteError(images.wheelIn, images.keyIn),
};
const maximumEquivalenceDistance = Math.max(
  ...Object.values(equivalenceDistances),
);
const closingDistances = {
  final: normalizedMeanAbsoluteError(
    images.continuityClosing,
    images.continuity,
  ),
  seed: normalizedMeanAbsoluteError(
    images.continuityClosing,
    images.continuitySeed,
  ),
};
const minimumClosingDistance = Math.min(...Object.values(closingDistances));
const closingDistanceLimit = Math.max(
  0.008,
  minimumZoomDistance * 0.2,
  sameStateNoise * 8 + 0.001,
);
const exitDarkDeficitThreshold = Math.max(
  12,
  Math.ceil(sameStateNoise * 255 * 12),
);
const exitWholeFrameUnderflowLimit = Math.max(
  0.025,
  sameStateNoise * 12 + 0.002,
);
const exitEndpointLimit = Math.max(0.01, sameStateNoise * 10 + 0.002);
const exitFrameMetrics = Object.fromEntries(
  exitFrameNames.map((name) => [
    name,
    exitContinuityMetrics(
      images.freshSeed,
      images.freshClose,
      images[name],
      exitDarkDeficitThreshold,
    ),
  ]),
);
const maximumExitWholeFrameUnderflow = Math.max(
  ...Object.values(exitFrameMetrics).map(
    (metrics) => metrics.wholeFrameUnderflow,
  ),
);
const maximumExitWideDarkAreaFraction = Math.max(
  ...Object.values(exitFrameMetrics).map(
    (metrics) => metrics.wideDarkAreaFraction,
  ),
);
const minimumExitEndpointDistance = Math.min(
  ...Object.values(exitFrameMetrics).map((metrics) =>
    Math.min(metrics.seedDistance, metrics.desktopDistance),
  ),
);
const minimumExitDesktopDistance = Math.min(
  ...Object.values(exitFrameMetrics).map((metrics) => metrics.desktopDistance),
);
const maximumExitEndpointDistance = Math.max(
  ...Object.values(exitFrameMetrics).map((metrics) =>
    Math.min(metrics.seedDistance, metrics.desktopDistance),
  ),
);
const desktopSurfaceMetrics = wallpaperSurfaceMetrics(images.desktopSurface);
const desktopSurfaceRangeLimit = Math.max(0.02, sameStateNoise * 8 + 0.002);
const desktopSurfaceGradientLimit = Math.max(
  0.0008,
  sameStateNoise * 2 + 0.0002,
);

const configuredStride = spatialStride(baseline.height, configuredZoom);
const steppedStride = spatialStride(baseline.height, steppedZoom);
const expectedAnchorShift =
  (anchorFraction - 0.5) *
  baseline.height *
  (steppedStride / configuredStride - 1);
const maximumAnchorSearchShift = Math.max(
  8,
  Math.ceil(expectedAnchorShift * 2),
);
const anchorZoomDistance = normalizedMeanAbsoluteError(
  images.anchorBaseline,
  images.anchorWheelIn,
);
const anchorRegistration = bestVerticalShift(
  images.wheelIn,
  images.anchorWheelIn,
  images.anchorBaseline,
  maximumAnchorSearchShift,
);
const minimumAnchorSampledPixels = Math.max(
  24,
  Math.ceil(maximumAnchorSearchShift / 2),
);
const anchorShiftTolerance = Math.max(2, expectedAnchorShift * 0.1);
const anchorMinimumImprovement = Math.max(0.0015, sameStateNoise * 4 + 0.0005);

const report = {
  anchor: {
    bestScore: roundMetric(anchorRegistration.bestScore),
    bestShift: anchorRegistration.bestShift,
    expectedShift: roundMetric(expectedAnchorShift),
    improvement: roundMetric(anchorRegistration.improvement),
    minimumImprovement: roundMetric(anchorMinimumImprovement),
    minimumSalienceEnergy: minimumAnchorSalienceEnergy,
    minimumSampledPixels: minimumAnchorSampledPixels,
    salienceEnergy: anchorRegistration.salienceEnergy,
    sampledPixels: anchorRegistration.sampledPixels,
    shiftTolerance: roundMetric(anchorShiftTolerance),
    zeroShiftScore: roundMetric(anchorRegistration.zeroShiftScore),
    zoomDistance: roundMetric(anchorZoomDistance),
  },
  baselineDistances: roundMetrics(baselineDistances),
  closingDistanceLimit: roundMetric(closingDistanceLimit),
  closingDistances: roundMetrics(closingDistances),
  duplicateDistances: roundMetrics(duplicateDistances),
  equivalenceDistances: roundMetrics(equivalenceDistances),
  equivalenceLimit: roundMetric(equivalenceLimit),
  equivalenceSignalFraction: roundMetric(
    equivalenceLimit / minimumZoomDistance,
  ),
  exit: {
    darkDeficitThreshold: exitDarkDeficitThreshold,
    frames: Object.fromEntries(
      Object.entries(exitFrameMetrics).map(([name, metrics]) => [
        name,
        roundMetrics(metrics),
      ]),
    ),
    maximumEndpointDistance: roundMetric(maximumExitEndpointDistance),
    maximumWholeFrameUnderflow: roundMetric(maximumExitWholeFrameUnderflow),
    maximumWideDarkAreaFraction: roundMetric(maximumExitWideDarkAreaFraction),
    minimumDesktopDistance: roundMetric(minimumExitDesktopDistance),
    minimumEndpointDistance: roundMetric(minimumExitEndpointDistance),
    endpointLimit: roundMetric(exitEndpointLimit),
    wholeFrameUnderflowLimit: roundMetric(exitWholeFrameUnderflowLimit),
  },
  maximumEquivalenceDistance: roundMetric(maximumEquivalenceDistance),
  maximumResetDistance: roundMetric(maximumResetDistance),
  minimumClosingDistance: roundMetric(minimumClosingDistance),
  minimumZoomDistance: roundMetric(minimumZoomDistance),
  resetDistances: roundMetrics(resetDistances),
  resetLimit: roundMetric(resetLimit),
  resetSignalFraction: roundMetric(resetLimit / minimumZoomDistance),
  sameStateNoise: roundMetric(sameStateNoise),
  wallpaperSurface: {
    ...roundMetrics(desktopSurfaceMetrics),
    gradientLimit: roundMetric(desktopSurfaceGradientLimit),
    rangeLimit: roundMetric(desktopSurfaceRangeLimit),
  },
};

process.stdout.write(`${JSON.stringify(report)}\n`);

if (minimumZoomDistance < 0.01) {
  fail("zoom-in frames did not differ materially from the configured baseline");
}
if (sameStateNoise > equivalenceLimit) {
  fail(
    "duplicate same-state captures were too unstable to calibrate the oracle",
  );
}
if (maximumResetDistance > resetLimit) {
  fail("an inverse, configured reset, or fresh open missed its baseline");
}
if (maximumEquivalenceDistance > equivalenceLimit) {
  fail(
    "equivalent center-anchored zoom frames exceeded calibrated capture noise",
  );
}
if (anchorZoomDistance < 0.01) {
  fail("off-centre physical wheel-up did not change zoom materially");
}
if (
  anchorRegistration.sampledPixels < minimumAnchorSampledPixels ||
  anchorRegistration.salienceEnergy < minimumAnchorSalienceEnergy
) {
  fail(
    `anchor registration found ${anchorRegistration.sampledPixels} zoom-sensitive pixels with ${anchorRegistration.salienceEnergy} salience; expected at least ${minimumAnchorSampledPixels} pixels and ${minimumAnchorSalienceEnergy} salience`,
  );
}
if (
  Math.abs(anchorRegistration.bestShift - expectedAnchorShift) >
  anchorShiftTolerance
) {
  fail(
    `off-centre zoom registered at shift ${anchorRegistration.bestShift}, expected ${roundMetric(expectedAnchorShift)}`,
  );
}
if (anchorRegistration.improvement < anchorMinimumImprovement) {
  fail(
    "off-centre zoom did not exhibit a distinct anchored vertical displacement",
  );
}
if (minimumClosingDistance < closingDistanceLimit) {
  fail("the interrupted close screendump did not materially enter closing");
}
if (maximumExitEndpointDistance < closingDistanceLimit) {
  fail("the exit burst did not contain a material transition frame");
}
if (minimumExitDesktopDistance > exitEndpointLimit) {
  fail("the exit burst did not reach the stable desktop endpoint");
}
if (maximumExitWholeFrameUnderflow > exitWholeFrameUnderflowLimit) {
  fail("an exit frame became materially darker than both stable endpoints");
}
if (maximumExitWideDarkAreaFraction >= 0.08) {
  fail("an exit frame exposed a wide dark rectangular region");
}
if (
  desktopSurfaceMetrics.dynamicRange < desktopSurfaceRangeLimit ||
  desktopSurfaceMetrics.neighborGradient < desktopSurfaceGradientLimit ||
  desktopSurfaceMetrics.modalFraction >= 0.8
) {
  fail("the visible empty workspace did not contain a real wallpaper surface");
}

function spatialStride(sceneHeight, zoom) {
  const cardHeight = sceneHeight * zoom;
  return cardHeight + Math.min(cardHeight * 0.1, maximumCardGap);
}

function bestVerticalShift(reference, moved, movedBaseline, maximumShift) {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestShift = 0;
  let salienceEnergy = 0;
  let sampledPixels = 0;
  let zeroShiftScore = Number.POSITIVE_INFINITY;

  for (let shift = -maximumShift; shift <= maximumShift; shift += 1) {
    const evidence = shiftedRegionMeanAbsoluteError(
      reference,
      moved,
      movedBaseline,
      shift,
      maximumShift,
    );
    const score = evidence.score;
    if (shift === -maximumShift) {
      salienceEnergy = evidence.salienceEnergy;
      sampledPixels = evidence.sampledPixels;
    }
    if (shift === 0) {
      zeroShiftScore = score;
    }
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return {
    bestScore,
    bestShift,
    improvement: zeroShiftScore - bestScore,
    salienceEnergy,
    sampledPixels,
    zeroShiftScore,
  };
}

function shiftedRegionMeanAbsoluteError(
  reference,
  moved,
  movedBaseline,
  shift,
  maximumShift,
) {
  const xStart = Math.floor(reference.width * 0.08);
  const xEnd = Math.ceil(reference.width * 0.92);
  const yStart = Math.floor(reference.height * 0.2) + maximumShift;
  const yEnd = Math.ceil(reference.height * 0.8) - maximumShift;
  if (xEnd <= xStart || yEnd <= yStart) {
    fail("the image is too small for bounded anchor registration");
  }

  let difference = 0;
  let salienceEnergy = 0;
  let sampledPixels = 0;
  for (let y = yStart; y < yEnd; y += 2) {
    const referenceY = y + shift;
    for (let x = xStart; x < xEnd; x += 3) {
      const referenceOffset = (referenceY * reference.width + x) * 3;
      const movedOffset = (y * moved.width + x) * 3;
      const salience =
        Math.abs(moved.bytes[movedOffset] - movedBaseline.bytes[movedOffset]) +
        Math.abs(
          moved.bytes[movedOffset + 1] - movedBaseline.bytes[movedOffset + 1],
        ) +
        Math.abs(
          moved.bytes[movedOffset + 2] - movedBaseline.bytes[movedOffset + 2],
        );
      if (salience < 24) {
        continue;
      }
      salienceEnergy += salience;
      difference += Math.abs(
        reference.bytes[referenceOffset] - moved.bytes[movedOffset],
      );
      difference += Math.abs(
        reference.bytes[referenceOffset + 1] - moved.bytes[movedOffset + 1],
      );
      difference += Math.abs(
        reference.bytes[referenceOffset + 2] - moved.bytes[movedOffset + 2],
      );
      sampledPixels += 1;
    }
  }

  return {
    salienceEnergy,
    sampledPixels,
    score:
      sampledPixels > 0
        ? difference / (sampledPixels * 3 * 255)
        : Number.POSITIVE_INFINITY,
  };
}

function exitContinuityMetrics(seed, desktop, frame, deficitThreshold) {
  const gridColumns = 16;
  const gridRows = 12;
  const darkCells = Array.from({ length: gridRows }, () =>
    Array.from({ length: gridColumns }, () => false),
  );
  let desktopLuminance = 0;
  let frameLuminance = 0;
  let seedLuminance = 0;
  let sampledPixels = 0;

  for (let gridY = 0; gridY < gridRows; gridY += 1) {
    const yStart = Math.floor((gridY * frame.height) / gridRows);
    const yEnd = Math.floor(((gridY + 1) * frame.height) / gridRows);
    for (let gridX = 0; gridX < gridColumns; gridX += 1) {
      const xStart = Math.floor((gridX * frame.width) / gridColumns);
      const xEnd = Math.floor(((gridX + 1) * frame.width) / gridColumns);
      let cellDeficit = 0;
      let darkPixels = 0;
      let eligiblePixels = 0;
      let cellPixels = 0;

      for (let y = yStart; y < yEnd; y += 2) {
        for (let x = xStart; x < xEnd; x += 2) {
          const offset = (y * frame.width + x) * 3;
          const seedValue = pixelLuminance(seed.bytes, offset);
          const desktopValue = pixelLuminance(desktop.bytes, offset);
          const frameValue = pixelLuminance(frame.bytes, offset);
          const endpointFloor = Math.min(seedValue, desktopValue);
          seedLuminance += seedValue;
          desktopLuminance += desktopValue;
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

  const seedMean = seedLuminance / (sampledPixels * 255);
  const desktopMean = desktopLuminance / (sampledPixels * 255);
  const frameMean = frameLuminance / (sampledPixels * 255);
  const wideDarkAreaFraction = largestWideRectangleFraction(darkCells, 0.5);
  return {
    desktopDistance: normalizedMeanAbsoluteError(frame, desktop),
    frameMean,
    seedDistance: normalizedMeanAbsoluteError(frame, seed),
    wholeFrameUnderflow: Math.max(
      0,
      Math.min(seedMean, desktopMean) - frameMean,
    ),
    wideDarkAreaFraction,
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

function wallpaperSurfaceMetrics(image) {
  const cardHeight = image.height * configuredZoom;
  const nextCardStart =
    image.height / 2 +
    cardHeight / 2 +
    Math.min(cardHeight * 0.1, maximumCardGap);
  const xStart = Math.floor(image.width * 0.08);
  const xEnd = Math.ceil(image.width * 0.92);
  const yStart = Math.ceil(nextCardStart + cardHeight * 0.12);
  const yEnd = Math.min(
    Math.floor(image.height * 0.96),
    Math.floor(nextCardStart + cardHeight * 0.88),
  );
  if (xEnd <= xStart || yEnd <= yStart) {
    fail("the image is too small for the empty-workspace wallpaper crop");
  }

  const luminances = [];
  const colors = new Map();
  let gradient = 0;
  let gradientSamples = 0;
  let maximumColorCount = 0;
  let sampledPixels = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const offset = (y * image.width + x) * 3;
      const luminance = pixelLuminance(image.bytes, offset);
      luminances.push(luminance);
      const color =
        (image.bytes[offset] << 16) |
        (image.bytes[offset + 1] << 8) |
        image.bytes[offset + 2];
      const count = (colors.get(color) ?? 0) + 1;
      colors.set(color, count);
      maximumColorCount = Math.max(maximumColorCount, count);
      sampledPixels += 1;

      if (x + 2 < xEnd) {
        gradient += Math.abs(
          luminance - pixelLuminance(image.bytes, offset + 6),
        );
        gradientSamples += 1;
      }
      if (y + 2 < yEnd) {
        gradient += Math.abs(
          luminance - pixelLuminance(image.bytes, offset + image.width * 6),
        );
        gradientSamples += 1;
      }
    }
  }

  luminances.sort((left, right) => left - right);
  const low = luminances[Math.floor(luminances.length * 0.05)];
  const high = luminances[Math.floor(luminances.length * 0.95)];
  return {
    dynamicRange: (high - low) / 255,
    modalFraction: maximumColorCount / sampledPixels,
    neighborGradient: gradient / (gradientSamples * 255),
  };
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
  process.stderr.write(`Overview zoom visual probe failed: ${message}.\n`);
  process.exit(1);
}
