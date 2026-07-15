import { DEFAULT_WINDOW_HEIGHT_PRESETS } from "./core/geometry";
import type { ColumnWidth } from "./core/layout-engine";

export const WINDOW_HEIGHT_PRESET_LIMITS = Object.freeze({
  documentCharacters: 256,
  entries: 16,
  maximumPercent: 100,
  minimumPercent: 10,
});

const CUSTOM_WINDOW_HEIGHT_PRESET_INDEX_OFFSET = 100;

export interface WindowHeightPresetCycleEntry {
  readonly policy: ColumnWidth;
  readonly stateIndex: number;
}

export interface WindowHeightPresetPercentages {
  readonly canonicalValue: string;
  readonly percentages: readonly number[];
}

const canonicalPercent = /^(?:1[0-9]|[2-9][0-9]|100)$/u;

export const EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES = createPercentages([]);

export const WINDOW_HEIGHT_PRESET_RESOLUTION_TABLE =
  createWindowHeightPresetResolutionTable();

export const DEFAULT_WINDOW_HEIGHT_PRESET_CYCLE = Object.freeze(
  DEFAULT_WINDOW_HEIGHT_PRESETS.map((policy, stateIndex) =>
    Object.freeze({ policy, stateIndex }),
  ),
);

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

  const percentages: number[] = [];
  let previous = WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent - 1;

  for (const candidate of candidates) {
    const encoded = candidate.trim();

    if (!canonicalPercent.test(encoded)) {
      return null;
    }

    const percent = Number(encoded);

    if (
      percent < WINDOW_HEIGHT_PRESET_LIMITS.minimumPercent ||
      percent > WINDOW_HEIGHT_PRESET_LIMITS.maximumPercent ||
      percent <= previous
    ) {
      return null;
    }

    percentages.push(percent);
    previous = percent;
  }

  return createPercentages(percentages);
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

function createPercentages(
  percentages: readonly number[],
): WindowHeightPresetPercentages {
  const immutablePercentages = Object.freeze([...percentages]);

  return Object.freeze({
    canonicalValue: immutablePercentages.join(","),
    percentages: immutablePercentages,
  });
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
