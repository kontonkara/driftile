import { DEFAULT_WINDOW_HEIGHT_PRESETS } from "./core/geometry";
import type { ColumnWidth } from "./core/layout-engine";

export const WINDOW_HEIGHT_PRESET_LIMITS = Object.freeze({
  documentCharacters: 256,
  entries: 16,
  maximumPixels: 16_384,
  maximumPercent: 100,
  minimumPixels: 1,
  minimumPercent: 10,
});

const CUSTOM_WINDOW_HEIGHT_PRESET_INDEX_OFFSET = 100;
const CUSTOM_FIXED_WINDOW_HEIGHT_PRESET_INDEX_OFFSET =
  CUSTOM_WINDOW_HEIGHT_PRESET_INDEX_OFFSET +
  WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent;
const fixedWindowHeightPresetPolicies = new Map<number, ColumnWidth>();

export interface WindowHeightPresetCycleEntry {
  readonly policy: ColumnWidth;
  readonly stateIndex: number;
}

export interface WindowHeightPresetPercentages {
  readonly canonicalValue: string;
  readonly cycle: readonly WindowHeightPresetCycleEntry[];
  readonly percentages: readonly number[];
}

type WindowHeightPresetUnit = "percent" | "pixels";

interface ParsedWindowHeightPreset {
  readonly canonicalValue: string;
  readonly policy: ColumnWidth;
  readonly stateIndex: number;
  readonly unit: WindowHeightPresetUnit;
  readonly value: number;
}

const canonicalPreset = /^([1-9][0-9]*)(%|px)?$/u;

export const WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE =
  createWindowHeightPresetResolutionTable();

export const DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE = Object.freeze(
  DEFAULT_WINDOW_HEIGHT_PRESETS.map((policy, stateIndex) =>
    Object.freeze({ policy, stateIndex }),
  ),
);

export const EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES = createPresetValue(
  [],
  DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE,
  [],
);

export function resolveWindowHeightPresetPolicy(
  stateIndex: number,
): ColumnWidth | null {
  if (
    typeof stateIndex !== "number" ||
    !Number.isFinite(stateIndex) ||
    !Number.isInteger(stateIndex) ||
    stateIndex < 0
  ) {
    return null;
  }

  const existing = WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE[stateIndex];

  if (existing) {
    return existing;
  }

  const pixels = stateIndex - CUSTOM_FIXED_WINDOW_HEIGHT_PRESET_INDEX_OFFSET;

  if (
    pixels < WINDOW_HEIGHT_PRESET_LIMITS.minimumPixels ||
    pixels > WINDOW_HEIGHT_PRESET_LIMITS.maximumPixels
  ) {
    return null;
  }

  const cached = fixedWindowHeightPresetPolicies.get(pixels);

  if (cached) {
    return cached;
  }

  const policy = Object.freeze({ kind: "fixed" as const, value: pixels });
  fixedWindowHeightPresetPolicies.set(pixels, policy);
  return policy;
}

export function decodeWindowHeightPresetPercentages(
  value: unknown,
): WindowHeightPresetPercentages | null {
  if (
    typeof value !== "string" ||
    value.length > WINDOW_HEIGHT_PRESET_LIMITS.documentCharacters
  ) {
    return null;
  }

  if (value.trim().length === 0) {
    return EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES;
  }

  const candidates = value.split(",");

  if (
    candidates.length === 0 ||
    candidates.length > WINDOW_HEIGHT_PRESET_LIMITS.entries
  ) {
    return null;
  }

  const canonicalValues: string[] = [];
  const cycle: WindowHeightPresetCycleEntry[] = [];
  const percentages: number[] = [];
  let previousPercent = WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent - 1;
  let previousPixels = WINDOW_HEIGHT_PRESET_LIMITS.minimumPixels - 1;

  for (const candidate of candidates) {
    const parsed = parseWindowHeightPreset(candidate.trim());

    if (!parsed) {
      return null;
    }

    if (parsed.unit === "percent") {
      if (parsed.value <= previousPercent) {
        return null;
      }

      percentages.push(parsed.value);
      previousPercent = parsed.value;
    } else {
      if (parsed.value <= previousPixels) {
        return null;
      }

      previousPixels = parsed.value;
    }

    canonicalValues.push(parsed.canonicalValue);
    cycle.push(
      Object.freeze({ policy: parsed.policy, stateIndex: parsed.stateIndex }),
    );
  }

  return createPresetValue(canonicalValues, cycle, percentages);
}

export function sameWindowHeightPresetPercentages(
  left: WindowHeightPresetPercentages,
  right: WindowHeightPresetPercentages,
): boolean {
  return left === right || left.canonicalValue === right.canonicalValue;
}

export function windowHeightPresetCycleFromPercentages(
  percentages: readonly number[],
): readonly WindowHeightPresetCycleEntry[] | null {
  if (
    !Array.isArray(percentages) ||
    percentages.length > WINDOW_HEIGHT_PRESET_LIMITS.entries
  ) {
    return null;
  }

  const candidates = percentages as readonly unknown[];

  if (candidates.length === 0) {
    return DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE;
  }

  const cycle: WindowHeightPresetCycleEntry[] = [];
  let previous = WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent - 1;

  for (const candidate of candidates) {
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      !Number.isInteger(candidate) ||
      candidate < WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent ||
      candidate > WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent ||
      candidate <= previous
    ) {
      return null;
    }

    const stateIndex = customWindowHeightPresetIndex(candidate);
    const policy = WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE[stateIndex];

    if (!policy) {
      return null;
    }

    cycle.push(Object.freeze({ policy, stateIndex }));
    previous = candidate;
  }

  return Object.freeze(cycle);
}

export function sameWindowHeightPresetCycles(
  left: readonly WindowHeightPresetCycleEntry[],
  right: readonly WindowHeightPresetCycleEntry[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every(
        (entry, index) => entry.stateIndex === right[index]?.stateIndex,
      ))
  );
}

function createPresetValue(
  canonicalValues: readonly string[],
  cycle: readonly WindowHeightPresetCycleEntry[],
  percentages: readonly number[],
): WindowHeightPresetPercentages {
  const immutableCycle = Object.isFrozen(cycle)
    ? cycle
    : Object.freeze([...cycle]);
  const immutablePercentages = Object.freeze([...percentages]);

  return Object.freeze({
    canonicalValue: canonicalValues.join(","),
    cycle: immutableCycle,
    percentages: immutablePercentages,
  });
}

function parseWindowHeightPreset(
  encoded: string,
): ParsedWindowHeightPreset | null {
  const match = canonicalPreset.exec(encoded);

  if (!match) {
    return null;
  }

  const digits = match[1];
  const suffix = match[2];

  if (!digits) {
    return null;
  }

  const value = Number(digits);

  if (suffix === "px") {
    if (
      value < WINDOW_HEIGHT_PRESET_LIMITS.minimumPixels ||
      value > WINDOW_HEIGHT_PRESET_LIMITS.maximumPixels
    ) {
      return null;
    }

    const stateIndex = customFixedWindowHeightPresetIndex(value);
    const policy = resolveWindowHeightPresetPolicy(stateIndex);

    return policy
      ? {
          canonicalValue: `${String(value)}px`,
          policy,
          stateIndex,
          unit: "pixels",
          value,
        }
      : null;
  }

  if (
    value < WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent ||
    value > WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent
  ) {
    return null;
  }

  const stateIndex = customWindowHeightPresetIndex(value);
  const policy = WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE[stateIndex];

  return policy
    ? {
        canonicalValue: String(value),
        policy,
        stateIndex,
        unit: "percent",
        value,
      }
    : null;
}

function createWindowHeightPresetResolutionTable(): readonly ColumnWidth[] {
  const table = new Array<ColumnWidth>(
    customWindowHeightPresetIndex(WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent) +
      1,
  );

  for (const [stateIndex, policy] of DEFAULT_WINDOW_HEIGHT_PRESETS.entries()) {
    table[stateIndex] = policy;
  }

  for (
    let percent: number = WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent;
    percent <= WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent;
    percent += 1
  ) {
    table[customWindowHeightPresetIndex(percent)] = Object.freeze({
      kind: "proportion",
      value: percent / 100,
    });
  }

  return Object.freeze(table);
}

function customWindowHeightPresetIndex(percent: number): number {
  return CUSTOM_WINDOW_HEIGHT_PRESET_INDEX_OFFSET + percent;
}

function customFixedWindowHeightPresetIndex(pixels: number): number {
  return CUSTOM_FIXED_WINDOW_HEIGHT_PRESET_INDEX_OFFSET + pixels;
}
