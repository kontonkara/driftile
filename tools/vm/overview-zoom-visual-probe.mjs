#!/usr/bin/env node

import { readFileSync } from "node:fs";

const maximumPixelCount = 16 * 1024 * 1024;
const configuredZoom = 0.43;
const steppedZoom = 0.48;
const anchorFraction = 0.75;
const maximumCardGap = 48;
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
    .filter((name) => name !== "baseline")
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
const anchorRegistration = bestVerticalShift(
  images.wheelIn,
  images.anchorWheelIn,
  images.anchorBaseline,
  maximumAnchorSearchShift,
);
const anchorShiftTolerance = Math.max(2, expectedAnchorShift * 0.1);
const anchorMinimumImprovement = Math.max(0.0015, sameStateNoise * 4 + 0.0005);
const anchorZoomDistance = normalizedMeanAbsoluteError(
  images.anchorBaseline,
  images.anchorWheelIn,
);

const report = {
  anchor: {
    bestScore: roundMetric(anchorRegistration.bestScore),
    bestShift: anchorRegistration.bestShift,
    expectedShift: roundMetric(expectedAnchorShift),
    improvement: roundMetric(anchorRegistration.improvement),
    minimumImprovement: roundMetric(anchorMinimumImprovement),
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
  maximumEquivalenceDistance: roundMetric(maximumEquivalenceDistance),
  maximumResetDistance: roundMetric(maximumResetDistance),
  minimumClosingDistance: roundMetric(minimumClosingDistance),
  minimumZoomDistance: roundMetric(minimumZoomDistance),
  resetDistances: roundMetrics(resetDistances),
  resetLimit: roundMetric(resetLimit),
  resetSignalFraction: roundMetric(resetLimit / minimumZoomDistance),
  sameStateNoise: roundMetric(sameStateNoise),
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

function spatialStride(sceneHeight, zoom) {
  const cardHeight = sceneHeight * zoom;
  return cardHeight + Math.min(cardHeight * 0.1, maximumCardGap);
}

function bestVerticalShift(reference, moved, movedBaseline, maximumShift) {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestShift = 0;
  let zeroShiftScore = Number.POSITIVE_INFINITY;

  for (let shift = -maximumShift; shift <= maximumShift; shift += 1) {
    const score = shiftedRegionMeanAbsoluteError(
      reference,
      moved,
      movedBaseline,
      shift,
      maximumShift,
    );
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
  let sampledChannels = 0;
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
      difference += Math.abs(
        reference.bytes[referenceOffset] - moved.bytes[movedOffset],
      );
      difference += Math.abs(
        reference.bytes[referenceOffset + 1] - moved.bytes[movedOffset + 1],
      );
      difference += Math.abs(
        reference.bytes[referenceOffset + 2] - moved.bytes[movedOffset + 2],
      );
      sampledChannels += 3;
    }
  }

  if (sampledChannels < 300) {
    fail("anchor registration did not find enough zoom-sensitive pixels");
  }
  return difference / (sampledChannels * 255);
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
